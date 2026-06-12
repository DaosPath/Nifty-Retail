import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useI18n } from "../i18n";
import { MessageIcon, LogoIcon, KeyIcon } from "./Icons";
import { ChatMessageContent } from "./ChatMessageContent";
import { AI_WIDGET_ACTION_EVENT, type WidgetActionDetail } from "../features/ai-chat";

interface Message {
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  explanation?: string;
}

interface AiChatProps {
  products: any[];
  lots: any[];
  debts: any[];
  sales: any[];
  activeSession: any | null;
  cashSessions: any[];
  storeConfig: any;
}

export const AiChat: React.FC<AiChatProps> = ({
  products,
  lots,
  debts,
  sales,
  activeSession,
  cashSessions,
  storeConfig,
}) => {
  const { t, locale, localeTag } = useI18n();

  const formatTime = useCallback(
    () => new Date().toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" }),
    [localeTag]
  );

  const makeWelcomeMessage = useCallback(
    (): Message => ({
      sender: "ai",
      text: t("aiChat.welcome"),
      timestamp: formatTime(),
    }),
    [t, formatTime]
  );

  const [messages, setMessages] = useState<Message[]>(() => [makeWelcomeMessage()]);
  const [inputValue, setInputValue] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load API Key
    const key = localStorage.getItem("nifty_gemini_api_key") || "";
    setGeminiKey(key);
    setInputKey(key);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0]?.sender === "ai") {
        return [makeWelcomeMessage()];
      }
      return prev;
    });
  }, [locale, makeWelcomeMessage]);

  useEffect(() => {
    const onWidgetAction = (event: Event) => {
      const detail = (event as CustomEvent<WidgetActionDetail>).detail;
      if (!detail || detail.action !== "fill_input") return;
      setInputValue(detail.value);
    };

    window.addEventListener(AI_WIDGET_ACTION_EVENT, onWidgetAction);
    return () => window.removeEventListener(AI_WIDGET_ACTION_EVENT, onWidgetAction);
  }, []);

  const saveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("nifty_gemini_api_key", inputKey.trim());
    setGeminiKey(inputKey.trim());
    setShowKeyModal(false);
    alert(t("aiChat.apiKeySaved"));
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      sender: "user",
      text,
      timestamp: formatTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setAiLoading(true);

    try {
      if (geminiKey) {
        // AGENT MODE: Generate JavaScript query code using Gemini and execute it locally
        const responseJson = await queryGeminiAgent(text);
        let explanation = responseJson.explanation || "";
        let code = responseJson.code || "";
        
        let resultAnswer = "";
        try {
          // Dynamic execution of generated query code
          const queryFunc = new Function(
            "products",
            "lots",
            "debts",
            "sales",
            "activeSession",
            "cashSessions",
            "storeConfig",
            code
          );
          resultAnswer = queryFunc(products, lots, debts, sales, activeSession, cashSessions, storeConfig);
        } catch (execError: any) {
          console.warn("First execution failed, attempting agent self-correction...", execError);
          try {
            // Agent self-correction loop
            const correctionJson = await correctGeminiCode(text, code, execError.message);
            explanation = `${explanation}${t("aiChat.autoCorrected")}`;
            code = correctionJson.code || "";
            
            const queryFuncCorrected = new Function(
              "products",
              "lots",
              "debts",
              "sales",
              "activeSession",
              "cashSessions",
              "storeConfig",
              code
            );
            resultAnswer = queryFuncCorrected(products, lots, debts, sales, activeSession, cashSessions, storeConfig);
          } catch (correctError: any) {
            console.error("Agent self-correction execution failed:", correctError);
            resultAnswer = t("aiChat.execError", { error: correctError.message });
          }
        }

        const aiMsg: Message = {
          sender: "ai",
          text: resultAnswer,
          timestamp: formatTime(),
          explanation: explanation,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        // FALLBACK: Local Heuristics Parsing (offline mode)
        setTimeout(() => {
          const aiResponseText = generateLocalAiResponse(text);
          const aiMsg: Message = {
            sender: "ai",
            text: aiResponseText,
            timestamp: formatTime(),
          };
          setMessages((prev) => [...prev, aiMsg]);
        }, 500);
      }
    } catch (err: any) {
      console.error("Error calling Gemini Agent API:", err);
      // Fallback on HTTP errors
      const aiResponseText =
        generateLocalAiResponse(text) + t("aiChat.geminiFallback", { error: err.message });
      const aiMsg: Message = {
        sender: "ai",
        text: aiResponseText,
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setAiLoading(false);
    }
  };

  const cleanResponseJson = (rawText: string): string => {
    let cleanText = rawText.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.substring(7);
    } else if (cleanText.startsWith("```javascript")) {
      cleanText = cleanText.substring(13);
    } else if (cleanText.startsWith("```js")) {
      cleanText = cleanText.substring(5);
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    return cleanText.trim();
  };

  const buildAgentSystemInstruction = (mode: "query" | "correct", extras?: { userQuery?: string; failedCode?: string; errorMessage?: string }) => {
    const isEn = locale === "en";
    const responseLang = isEn ? "English" : "Spanish";
    const userLabel = isEn ? "cashier" : "cajero";

    if (mode === "correct" && extras) {
      return isEn
        ? `You act as a Database Code Correction Agent for Nifty Retail.\nA JavaScript script was generated to answer the user's query, but it failed at runtime.\nYour goal is to fix the code to resolve the error.\n\nYou have access to these 7 variables in the function scope:\n1. \`products\`: Product array.\n2. \`lots\`: Lot array.\n3. \`debts\`: Accounts receivable array.\n4. \`sales\`: Sales history array.\n5. \`activeSession\`: Active cash session object or null.\n6. \`cashSessions\`: Full cash session history.\n7. \`storeConfig\`: Store configuration object.\n\nOriginal ${userLabel} question: "${extras.userQuery}"\nFailed code:\n\`\`\`javascript\n${extras.failedCode}\n\`\`\`\nRuntime error: "${extras.errorMessage}"\n\nYou MUST return a valid JSON object with:\n- "explanation": Brief explanation in ${responseLang} of the error and your fix.\n- "code": The CORRECTED JavaScript function body (without the function declaration). It must return a STRING.\n\nWrite robust code that handles empty arrays and missing properties. Return JSON only.`
        : `Actúas como un Agente de Corrección de Código de Base de Datos para Nifty Retail.\nSe generó un script de JavaScript para responder a la consulta del usuario, pero falló al ejecutarse.\nTu objetivo es corregir el código para solucionar el error.\n\nTienes acceso a estas 7 variables en el ámbito de ejecución de la función:\n1. \`products\`: Arreglo de productos.\n2. \`lots\`: Arreglo de lotes.\n3. \`debts\`: Arreglo de cuentas por cobrar.\n4. \`sales\`: Arreglo de ventas históricas.\n5. \`activeSession\`: Objeto de la sesión de caja activa o null.\n6. \`cashSessions\`: Historial completo de todas las sesiones de caja.\n7. \`storeConfig\`: Configuración y datos del negocio.\n\nPregunta original del cajero: "${extras.userQuery}"\nCódigo fallido:\n\`\`\`javascript\n${extras.failedCode}\n\`\`\`\nError de ejecución lanzado: "${extras.errorMessage}"\n\nDebes retornar OBLIGATORIAMENTE un objeto JSON válido con dos propiedades:\n- "explanation": Breve explicación en español del error encontrado y cómo lo solucionas.\n- "code": El cuerpo de la función JavaScript CORREGIDO (excluyendo la declaración 'function() {'). Debe operar sobre las variables y retornar un STRING.\n\nEscribe código robusto que controle arreglos vacíos o propiedades inexistentes. Tu respuesta debe ser solo el JSON.`;
    }

    return isEn
      ? `You act as a Database Query Agent for Nifty Retail (a small store POS system in Peru).\nYour goal is to translate the user's natural-language question into executable JavaScript that queries the in-memory database.\n\nYou have access to these 7 variables:\n1. \`products\`: Product array with { code, name, category, purchasePrice, sellingPrice, stock, minStock, expiryDate?, image? }\n2. \`lots\`: Lot array with { id, productCode, lotNumber, purchasePrice, initialQty, stock, expiryDate }\n3. \`debts\`: Accounts receivable with { id, customerName, customerPhone?, customerDni?, totalDebt, history }\n4. \`sales\`: Sales history with { id, timestamp, items, subtotal, discount, total, paymentMethod, customerName?, customerDni? }\n5. \`activeSession\`: Active cash session or null\n6. \`cashSessions\`: Full cash session history\n7. \`storeConfig\`: Store config with { businessName, ruc, address, ticketSeries, boletaSeries, lastTicketNumber, lastBoletaNumber }\n\nYou MUST return a valid JSON object with:\n- "explanation": Brief explanation in ${responseLang} of what you will query or calculate.\n- "code": JavaScript function body (without 'function() {') that returns a friendly, well-formatted STRING in ${responseLang}.\n\nWrite robust code that handles empty arrays and missing properties. Return JSON only.`
      : `Actúas como un Agente de Consultas de Base de Datos para Nifty Retail (sistema de tiendita/bodega en Perú).\n` +
      `Tu objetivo es traducir la pregunta en lenguaje natural del usuario a un script de JavaScript ejecutable localmente para consultar la base de datos en memoria.\n\n` +
      `Tienes acceso a estas 7 variables en el ámbito de ejecución de la función:\n` +
      `1. \`products\`: Arreglo de productos. Esquema de cada item:\n` +
      `   { code: string, name: string, category: string, purchasePrice: number, sellingPrice: number, stock: number, minStock: number, expiryDate?: string, image?: string }\n` +
      `2. \`lots\`: Arreglo de lotes. Esquema de cada item:\n` +
      `   { id: string, productCode: string, lotNumber: string, purchasePrice: number, initialQty: number, stock: number, expiryDate: string }\n` +
      `3. \`debts\`: Arreglo de cuentas por cobrar. Esquema de cada deudor:\n` +
      `   { id: string, customerName: string, customerPhone?: string, customerDni?: string, totalDebt: number, history: Array<{ date: string, amount: number, type: 'sale'|'payment', notes?: string }> }\n` +
      `4. \`sales\`: Arreglo de ventas históricas. Esquema de cada venta:\n` +
      `   { id: string, timestamp: string, items: Array<{ code: string, name: string, price: number, quantity: number }>, subtotal: number, discount: number, total: number, paymentMethod: 'Efectivo'|'Tarjeta'|'Yape'|'Fiado', customerName?: string, customerDni?: string }\n` +
      `5. \`activeSession\`: Objeto de la sesión de caja activa o null. Esquema:\n` +
      `   { id: string, startTime: string, endTime: string | null, initialBalance: number, salesCash: number, salesCard: number, salesYape: number, withdrawals: number, deposits: number, expectedCash: number }\n` +
      `6. \`cashSessions\`: Historial completo de todas las sesiones de caja (abiertas y cerradas). Cada sesión tiene el esquema:\n` +
      `   { id: string, startTime: string, endTime: string | null, initialBalance: number, salesCash: number, salesCard: number, salesYape: number, withdrawals: number, deposits: number, expectedCash: number, actualCash: number | null, difference: number | null, notes?: string }\n` +
      `7. \`storeConfig\`: Configuración y datos del negocio. Esquema:\n` +
      `   { businessName: string, ruc: string, address: string, ticketSeries: string, boletaSeries: string, lastTicketNumber: number, lastBoletaNumber: number }\n\n` +
      `Debes retornar OBLIGATORIAMENTE un objeto JSON válido con dos propiedades:\n` +
      `- "explanation": Breve explicación en español de qué vas a buscar o calcular.\n` +
      `- "code": El cuerpo de la función JavaScript (excluyendo la declaración 'function() {'). Debe operar sobre los arreglos/objetos y retornar un STRING que responda de forma natural, amigable y muy formateada en español la pregunta.\n\n` +
      `Ejemplo para la consulta: "¿Cuál es el valor total del inventario?"\n` +
      `Retorno:\n` +
      `{\n` +
      `  "explanation": "Calculando la suma del stock de cada producto multiplicado por su precio de venta.",\n` +
      `  "code": "const valor = products.reduce((acc, p) => acc + (p.stock * p.sellingPrice), 0); return \`El valor de venta total del inventario actualmente registrado es de S/ \${valor.toFixed(2)}.\`;"\n` +
      `}\n\n` +
      `Ejemplo para la consulta: "¿Quién es mi mayor deudor?"\n` +
      `Retorno:\n` +
      `{\n` +
      `  "explanation": "Buscando al cliente con la mayor deuda registrada.",\n` +
      `  "code": "if (debts.length === 0) return 'No hay deudores registrados.'; const max = debts.reduce((prev, current) => (prev.totalDebt > current.totalDebt) ? prev : current); if (max.totalDebt === 0) return 'Ningún cliente tiene deudas pendientes.'; return \`El cliente con mayor deuda es \${max.customerName} con un saldo pendiente de S/ \${max.totalDebt.toFixed(2)}.\`;"\n` +
      `}\n\n` +
      `Escribe código robusto que controle arreglos vacíos o propiedades inexistentes. Tu respuesta debe ser solo el JSON.`;
  };

  const queryGeminiAgent = async (userQuery: string): Promise<{ explanation: string; code: string }> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    const systemInstruction = buildAgentSystemInstruction("query");

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: locale === "en" ? `Cashier question: "${userQuery}"` : `Pregunta del cajero: "${userQuery}"`,
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          {
            text: systemInstruction
          }
        ]
      },
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Error API (${response.status})`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanedText = cleanResponseJson(responseText);
    return JSON.parse(cleanedText);
  };

  const correctGeminiCode = async (
    userQuery: string,
    failedCode: string,
    errorMessage: string
  ): Promise<{ explanation: string; code: string }> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

    const systemInstruction = buildAgentSystemInstruction("correct", { userQuery, failedCode, errorMessage });

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: locale === "en" ? "Fix the JavaScript code error." : "Corrige el error de código JavaScript.",
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          {
            text: systemInstruction
          }
        ]
      },
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Error API Corrección (${response.status})`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanedText = cleanResponseJson(responseText);
    return JSON.parse(cleanedText);
  };

  const matchesAny = (q: string, words: string[]) => words.some((word) => q.includes(word));

  const generateLocalAiResponse = (query: string): string => {
    const q = query.toLowerCase();
    const dateLocale = localeTag;

    if (
      matchesAny(q, ["deuda", "debe", "fiado", "cliente", "debt", "owe", "credit", "customer", "receivable"])
    ) {
      const activeDebtors = debts.filter((d) => d.totalDebt > 0);
      if (activeDebtors.length === 0) {
        return t("aiChat.debtsNone");
      }
      const list = activeDebtors
        .map((d) =>
          t("aiChat.debtItem", {
            name: d.customerName,
            dni: d.customerDni || "-",
            amount: d.totalDebt.toFixed(2),
          })
        )
        .join("\n");
      const total = activeDebtors.reduce((acc, curr) => acc + curr.totalDebt, 0);
      return t("aiChat.debtsList", {
        count: activeDebtors.length,
        total: total.toFixed(2),
        list,
      });
    }

    if (
      matchesAny(q, [
        "vence",
        "fecha",
        "caduca",
        "vencid",
        "vencim",
        "expir",
        "expire",
        "spoil",
        "caduc",
      ])
    ) {
      const now = new Date();
      const limitDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

      const expired = lots.filter((l) => l.stock > 0 && new Date(l.expiryDate) < now);
      const expiringSoon = lots.filter(
        (l) => l.stock > 0 && new Date(l.expiryDate) >= now && new Date(l.expiryDate) <= limitDate
      );

      let response = "";
      if (expired.length > 0) {
        const expiredList = expired
          .map((l) => {
            const prod = products.find((p) => p.code === l.productCode);
            return t("aiChat.expiryExpiredItem", {
              name: prod?.name || t("aiChat.unknownProduct"),
              lot: l.lotNumber,
              date: new Date(l.expiryDate).toLocaleDateString(dateLocale),
              stock: l.stock,
            });
          })
          .join("\n");
        response += t("aiChat.expiryExpiredTitle", { list: expiredList });
      }

      if (expiringSoon.length > 0) {
        const soonList = expiringSoon
          .map((l) => {
            const prod = products.find((p) => p.code === l.productCode);
            const daysLeft = Math.ceil((new Date(l.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return t("aiChat.expirySoonItem", {
              name: prod?.name || t("aiChat.unknownProduct"),
              lot: l.lotNumber,
              date: new Date(l.expiryDate).toLocaleDateString(dateLocale),
              days: daysLeft,
              stock: l.stock,
            });
          })
          .join("\n");
        response += t("aiChat.expirySoonTitle", { list: soonList });
      }

      if (!response) {
        return t("aiChat.expiryOk");
      }
      return response;
    }

    if (
      matchesAny(q, [
        "caja",
        "cuadre",
        "monto",
        "efectivo",
        "turno",
        "cash",
        "register",
        "drawer",
        "shift",
        "balance",
      ])
    ) {
      if (!activeSession) {
        return t("aiChat.cashClosed");
      }
      const totalInformativos = (activeSession.salesCard || 0) + (activeSession.salesYape || 0);
      return t("aiChat.cashSummary", {
        date: new Date(activeSession.startTime).toLocaleDateString(dateLocale),
        opening: activeSession.initialBalance.toFixed(2),
        cash: activeSession.salesCash.toFixed(2),
        deposits: activeSession.deposits.toFixed(2),
        withdrawals: activeSession.withdrawals.toFixed(2),
        expected: activeSession.expectedCash.toFixed(2),
        card: activeSession.salesCard.toFixed(2),
        yape: (activeSession.salesYape || 0).toFixed(2),
        electronic: totalInformativos.toFixed(2),
      });
    }

    if (
      matchesAny(q, [
        "stock",
        "bajo",
        "critico",
        "alerta",
        "inventario",
        "low",
        "critical",
        "inventory",
        "replenish",
      ])
    ) {
      const lowStockProds = products
        .filter((p) => p.stock <= p.minStock)
        .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, localeTag));
      if (lowStockProds.length === 0) {
        return t("aiChat.stockOk");
      }
      const emptyCount = lowStockProds.filter((p) => p.stock <= 0).length;
      const list = lowStockProds
        .map((p) =>
          t("aiChat.stockItem", {
            name: p.name,
            code: p.code,
            stock: p.stock,
            min: p.minStock,
          })
        )
        .join("\n");
      const intro =
        emptyCount > 0
          ? t("aiChat.stockCriticalWithEmpty", { count: lowStockProds.length, empty: emptyCount })
          : t("aiChat.stockCritical", { count: lowStockProds.length });
      return `${intro}\n\n${list}`;
    }

    if (
      matchesAny(q, [
        "ventas",
        "venta",
        "total",
        "ingresos",
        "ganad",
        "sales",
        "sale",
        "revenue",
        "income",
        "earned",
      ])
    ) {
      const totalSalesSum = sales.reduce((acc, curr) => acc + curr.total, 0);
      const totalCashSum = sales.filter((s) => s.paymentMethod === "Efectivo").reduce((acc, curr) => acc + curr.total, 0);
      const totalCardSum = sales.filter((s) => s.paymentMethod === "Tarjeta").reduce((acc, curr) => acc + curr.total, 0);
      const totalYapeSum = sales.filter((s) => s.paymentMethod === "Yape").reduce((acc, curr) => acc + curr.total, 0);
      const totalFiadoSum = sales.filter((s) => s.paymentMethod === "Fiado").reduce((acc, curr) => acc + curr.total, 0);

      return t("aiChat.salesSummary", {
        count: sales.length,
        total: totalSalesSum.toFixed(2),
        cash: totalCashSum.toFixed(2),
        card: totalCardSum.toFixed(2),
        yape: totalYapeSum.toFixed(2),
        credit: totalFiadoSum.toFixed(2),
      });
    }

    return t("aiChat.fallbackTips");
  };

  const quickPrompts = useMemo(
    () => [
      { label: t("aiChat.promptCash"), query: t("aiChat.queryCash"), tone: "cash" },
      { label: t("aiChat.promptExpiry"), query: t("aiChat.queryExpiry"), tone: "date" },
      { label: t("aiChat.promptDebt"), query: t("aiChat.queryDebt"), tone: "debt" },
      { label: t("aiChat.promptStock"), query: t("aiChat.queryStock"), tone: "alert" },
      { label: t("aiChat.promptTop"), query: t("aiChat.queryTop"), tone: "chart" },
    ],
    [t]
  );

  const showWelcome = messages.length === 1 && messages[0]?.sender === "ai";

  return (
    <div className="ai-chat-page">
      <header className="ai-chat-header">
        <div className="ai-chat-header-main">
          <div className="ai-chat-header-icon">
            <LogoIcon size={22} />
          </div>
          <div>
            <p className="ai-chat-kicker">{t("aiChat.kicker")}</p>
            <h3>{t("aiChat.title")}</h3>
            <p className="ai-chat-header-desc">{t("aiChat.subtitle")}</p>
          </div>
        </div>
        <div className="ai-chat-header-actions">
          <span className={`ai-chat-mode-pill ${geminiKey ? "is-agent" : "is-local"}`}>
            {geminiKey ? t("aiChat.modeAgent") : t("aiChat.modeLocal")}
          </span>
          <button type="button" className="btn btn-secondary btn-sm ai-chat-key-btn" onClick={() => setShowKeyModal(true)}>
            <KeyIcon size={14} /> {t("aiChat.configureApiKey")}
          </button>
        </div>
      </header>

      <div className="ai-chat-messages">
        <div className="ai-chat-messages-inner">
          {showWelcome && (
            <div className="ai-chat-welcome">
              <div className="ai-chat-welcome-icon">
                <LogoIcon size={28} />
              </div>
              <h4>{t("aiChat.welcomeTitle")}</h4>
              <p>{t("aiChat.welcomeHint")}</p>
              <div className="ai-chat-prompt-grid">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    className={`ai-chat-prompt-card ai-chat-prompt-card--${prompt.tone}`}
                    onClick={() => handleSend(prompt.query)}
                    disabled={aiLoading}
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, index) => (
            <div key={index} className={`ai-chat-message ${m.sender === "user" ? "is-user" : "is-ai"}`}>
              {m.sender === "ai" && (
                <div className="ai-chat-avatar ai-chat-avatar--bot">
                  <LogoIcon size={14} />
                </div>
              )}
              <div className="ai-chat-message-body">
                {m.explanation && <span className="ai-chat-explanation">🔎 {m.explanation}</span>}
                <div className={m.sender === "user" ? "chat-bubble-user" : "chat-bubble-bot"}>
                  <ChatMessageContent text={m.text} variant={m.sender} />
                  <span className="chat-timestamp">{m.timestamp}</span>
                </div>
              </div>
              {m.sender === "user" && <div className="ai-chat-avatar ai-chat-avatar--user">{t("aiChat.you")}</div>}
            </div>
          ))}

          {aiLoading && (
            <div className="ai-chat-message is-ai">
              <div className="ai-chat-avatar ai-chat-avatar--bot">
                <LogoIcon size={14} />
              </div>
              <div className="chat-loading-row">
                <div className="chat-spinner" />
                <span>{t("aiChat.loading")}</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      <footer className="ai-chat-composer">
        <div className="ai-chat-chips">
          {quickPrompts.map((prompt) => (
            <button
              key={`chip-${prompt.label}`}
              type="button"
              className={`ai-chat-chip ai-chat-chip--${prompt.tone}`}
              onClick={() => handleSend(prompt.query)}
              disabled={aiLoading}
            >
              {prompt.label}
            </button>
          ))}
        </div>
        <form
          className="ai-chat-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(inputValue);
          }}
        >
          <input
            type="text"
            className="form-control ai-chat-input"
            placeholder={t("aiChat.inputPlaceholder")}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={aiLoading}
          />
          <button type="submit" className="btn btn-primary ai-chat-send-btn" disabled={aiLoading || !inputValue.trim()}>
            <MessageIcon size={16} /> {t("aiChat.send")}
          </button>
        </form>
      </footer>

      {/* Modal: API Key Configuration */}
      {showKeyModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{t("aiChat.modalTitle")}</h3>
              <button className="modal-close" onClick={() => setShowKeyModal(false)}>×</button>
            </div>
            <form onSubmit={saveApiKey}>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "15px", lineHeight: "1.4" }}>
                {t("aiChat.modalDesc")}{" "}
                <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>
                  Google AI Studio
                </a>.
              </p>
              <div className="form-group">
                <label>{t("aiChat.apiKeyLabel")}</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder={t("aiChat.apiKeyPlaceholder")}
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowKeyModal(false)}>
                  {t("common.cancel")}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {t("aiChat.saveKey")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
