import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useI18n } from "../i18n";
import { MessageIcon, LogoIcon, KeyIcon } from "./Icons";
import { ChatMessageContent } from "./ChatMessageContent";
import {
  AI_WIDGET_ACTION_EVENT,
  NIFTY_AGENTS,
  runGeminiAgent,
  ensureWidgetRenderersRegistered,
  generateLocalAiResponse,
  type NiftyAgentId,
  type WidgetActionDetail,
} from "../features/ai-chat";

interface Message {
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  explanation?: string;
  toolsUsed?: string[];
}

interface AiChatProps {
  products: any[];
  lots: any[];
  debts: any[];
  sales: any[];
  activeSession: any | null;
  cashSessions: any[];
  storeConfig: any;
  suppliers?: any[];
  categories?: any[];
  warehouses?: any[];
  stockMovements?: any[];
}

ensureWidgetRenderersRegistered();

export const AiChat: React.FC<AiChatProps> = ({
  products,
  lots,
  debts,
  sales,
  activeSession,
  cashSessions,
  storeConfig,
  suppliers = [],
  categories = [],
  warehouses = [],
  stockMovements = [],
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
  const [activeTool, setActiveTool] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<NiftyAgentId>("workspace");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = localStorage.getItem("nifty_gemini_api_key") || "";
    setGeminiKey(key);
    setInputKey(key);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiLoading, activeTool]);

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
    setActiveTool("");

    try {
      if (geminiKey) {
        const result = await runGeminiAgent({
          apiKey: geminiKey,
          agentId: selectedAgent,
          userMessage: text,
          toolContext: {
            locale,
            products,
            lots,
            debts,
            sales,
            activeSession,
            cashSessions,
            storeConfig,
            suppliers,
            categories,
            warehouses,
            stockMovements,
          },
          onToolStart: (toolName) => setActiveTool(toolName),
        });

        const toolsLabel =
          result.toolsUsed.length > 0
            ? t("aiChat.toolsUsed", { tools: result.toolsUsed.join(", ") })
            : undefined;

        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: result.text,
            timestamp: formatTime(),
            explanation: toolsLabel,
            toolsUsed: result.toolsUsed,
          },
        ]);
      } else {
        setTimeout(() => {
          const aiResponseText = generateLocalAiResponse(
            text,
            { products, lots, debts, sales, activeSession, localeTag },
            t
          );
          setMessages((prev) => [
            ...prev,
            { sender: "ai", text: aiResponseText, timestamp: formatTime() },
          ]);
        }, 400);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const fallback = generateLocalAiResponse(
        text,
        { products, lots, debts, sales, activeSession, localeTag },
        t
      );
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `${fallback}${t("aiChat.geminiFallback", { error: message })}`,
          timestamp: formatTime(),
        },
      ]);
    } finally {
      setAiLoading(false);
      setActiveTool("");
    }
  };

  const quickPrompts = useMemo(
    () => [
      { label: t("aiChat.promptCash"), query: t("aiChat.queryCash"), tone: "cash" },
      { label: t("aiChat.promptExpiry"), query: t("aiChat.queryExpiry"), tone: "date" },
      { label: t("aiChat.promptDebt"), query: t("aiChat.queryDebt"), tone: "debt" },
      { label: t("aiChat.promptStock"), query: t("aiChat.queryStock"), tone: "alert" },
      { label: t("aiChat.promptTop"), query: t("aiChat.queryTop"), tone: "chart" },
      { label: t("aiChat.promptSql"), query: t("aiChat.querySql"), tone: "sql" },
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
            {geminiKey ? t("aiChat.modeAgentGemini") : t("aiChat.modeLocal")}
          </span>
          <button type="button" className="btn btn-secondary btn-sm ai-chat-key-btn" onClick={() => setShowKeyModal(true)}>
            <KeyIcon size={14} /> {t("aiChat.configureApiKey")}
          </button>
        </div>
      </header>

      <section className="ai-agent-strip-shell" aria-label={t("aiChat.agentPickerAria")}>
        <div className="ai-agent-strip-head">
          <span className="ai-agent-strip-title">{t("aiChat.agentPickerTitle")}</span>
          <span className="ai-agent-strip-badge">SQLite + Gemini</span>
        </div>
        <div className="ai-agent-strip">
          {NIFTY_AGENTS.map((agent) => {
            const label = locale === "en" ? agent.labelEn : agent.label;
            const tagline = locale === "en" ? agent.taglineEn : agent.tagline;
            const isActive = selectedAgent === agent.id;
            return (
              <button
                key={agent.id}
                type="button"
                className={`ai-agent-card${isActive ? " is-active" : ""}`}
                style={{ "--agent-accent": agent.accent } as React.CSSProperties}
                onClick={() => setSelectedAgent(agent.id)}
                disabled={aiLoading}
                aria-pressed={isActive}
              >
                <span className="ai-agent-card-top">
                  <span className="ai-agent-card-emoji" aria-hidden="true">
                    {agent.emoji}
                  </span>
                  <span className="ai-agent-card-copy">
                    <strong>{label}</strong>
                  </span>
                </span>
                <small className="ai-agent-card-tagline">{tagline}</small>
              </button>
            );
          })}
        </div>
      </section>

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
                {m.explanation && <span className="ai-chat-explanation">⚡ {m.explanation}</span>}
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
                <span>
                  {activeTool
                    ? t("aiChat.runningTool", { tool: activeTool })
                    : t("aiChat.loading")}
                </span>
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

      {showKeyModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{t("aiChat.modalTitle")}</h3>
              <button className="modal-close" onClick={() => setShowKeyModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={saveApiKey}>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "15px", lineHeight: "1.4" }}>
                {t("aiChat.modalDesc")}{" "}
                <a
                  href="https://aistudio.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--accent)", textDecoration: "underline" }}
                >
                  Google AI Studio
                </a>
                . {t("aiChat.modalProviderNote")}
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