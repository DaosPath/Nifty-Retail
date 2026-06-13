import { buildAgentSystemInstruction } from "./agentInstructions";
import { executeAgentTool } from "./executeTool";
import { GEMINI_API_BASE, GEMINI_FUNCTION_DECLARATIONS, GEMINI_MODEL } from "./geminiTools";
import type { AgentRunResult, AgentToolContext, NiftyAgentId } from "./types";

const MAX_TOOL_ROUNDS = 8;

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

function extractText(parts: GeminiPart[] | undefined): string {
  if (!parts) return "";
  return parts
    .map((part) => ("text" in part ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractFunctionCalls(parts: GeminiPart[] | undefined) {
  if (!parts) return [];
  return parts
    .filter((part): part is { functionCall: { name: string; args: Record<string, unknown> } } => "functionCall" in part)
    .map((part) => part.functionCall);
}

async function callGemini(apiKey: string, contents: GeminiContent[], systemInstruction: string) {
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      tools: [{ functionDeclarations: GEMINI_FUNCTION_DECLARATIONS }],
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini API (${response.status}): ${detail.slice(0, 240)}`);
  }

  return response.json();
}

export async function runGeminiAgent(options: {
  apiKey: string;
  agentId: NiftyAgentId;
  userMessage: string;
  toolContext: AgentToolContext;
  onToolStart?: (toolName: string) => void;
}): Promise<AgentRunResult> {
  const { apiKey, agentId, userMessage, toolContext, onToolStart } = options;
  const systemInstruction = buildAgentSystemInstruction(agentId, toolContext.locale);
  const toolsUsed: string[] = [];

  const contents: GeminiContent[] = [
    {
      role: "user",
      parts: [{ text: userMessage }],
    },
  ];

  let finalText = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const data = await callGemini(apiKey, contents, systemInstruction);
    const candidate = data.candidates?.[0];
    const parts: GeminiPart[] = candidate?.content?.parts ?? [];
    const text = extractText(parts);
    const functionCalls = extractFunctionCalls(parts);

    if (functionCalls.length === 0) {
      finalText = text;
      break;
    }

    contents.push({ role: "model", parts });

    const responseParts: GeminiPart[] = [];
    for (const call of functionCalls) {
      onToolStart?.(call.name);
      toolsUsed.push(call.name);
      const result = await executeAgentTool(call.name, call.args ?? {}, toolContext);
      responseParts.push({
        functionResponse: {
          name: call.name,
          response: result,
        },
      });
    }

    contents.push({ role: "user", parts: responseParts });

    if (round === MAX_TOOL_ROUNDS - 1) {
      finalText =
        toolContext.locale === "en"
          ? "I reached the tool execution limit. Please refine your question."
          : "Alcancé el límite de ejecuciones. Refina tu pregunta, por favor.";
    }
  }

  if (!finalText) {
    finalText =
      toolContext.locale === "en"
        ? "I could not produce a final answer."
        : "No pude generar una respuesta final.";
  }

  return { text: finalText, toolsUsed, agentId };
}