import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';
import { z } from 'zod';

import {
  annotateTextResponseSchema,
  generateExplanationPreviewResponseSchema,
  generateKnowledgeCardResponseSchema,
  inlineKeywordDraftSchema,
  type CardRelationType,
  type CardSourceType,
  type CompanionMessage,
  type InlineKeywordDraft,
} from './contracts';

const aiStatusSchema = z.object({
  provider: z.string(),
  configured: z.boolean(),
  mock_fallback_enabled: z.boolean(),
}).strict();

export type AIServiceStatus = z.infer<typeof aiStatusSchema>;

const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? `http://${fallbackHost}:8010/api/v1`;

const metaSchema = z.object({
  conversation_id: z.string(),
  message_id: z.string(),
  provider: z.string(),
  model: z.string(),
}).strict();

const textDeltaSchema = z.object({ text: z.string() }).strict();
const keywordsEventSchema = z.object({ items: z.array(inlineKeywordDraftSchema) }).strict();
const doneSchema = z.object({
  finish_reason: z.string(),
  reasoning_chars: z.number().int().nonnegative(),
  answer_chars: z.number().int().nonnegative(),
}).strict();
const errorSchema = z.object({ code: z.string(), message: z.string() }).strict();

type StreamHandlers = {
  onMeta: (meta: z.infer<typeof metaSchema>) => void;
  onReasoningDelta: (text: string) => void;
  onAnswerStart: () => void;
  onAnswerDelta: (text: string) => void;
  onKeywords: (items: InlineKeywordDraft[]) => void;
  onDone: (data: z.infer<typeof doneSchema>) => void;
};

async function requestJson(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload
      ? JSON.stringify(payload.detail)
      : `HTTP ${response.status}`;
    throw new Error(`伴学服务请求失败：${detail}`);
  }
  return payload;
}

function dispatchSseBlock(block: string, handlers: StreamHandlers): void {
  const lines = block.split('\n');
  const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
  const dataText = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!event || !dataText) return;

  const value: unknown = JSON.parse(dataText);
  switch (event) {
    case 'meta':
      handlers.onMeta(metaSchema.parse(value));
      break;
    case 'reasoning_delta':
      handlers.onReasoningDelta(textDeltaSchema.parse(value).text);
      break;
    case 'answer_start':
      handlers.onAnswerStart();
      break;
    case 'answer_delta':
      handlers.onAnswerDelta(textDeltaSchema.parse(value).text);
      break;
    case 'keywords':
      handlers.onKeywords(keywordsEventSchema.parse(value).items);
      break;
    case 'done':
      handlers.onDone(doneSchema.parse(value));
      break;
    case 'error':
      throw new Error(errorSchema.parse(value).message);
  }
}

export async function streamStudyChat(
  conversationId: string,
  messages: CompanionMessage[],
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${apiBase}/ai/study-chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      conversation_id: conversationId,
      messages: messages.slice(-24).map((message) => ({
        id: message.serverId ?? message.id,
        role: message.role,
        content: message.content,
      })),
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`AI 流式请求失败：HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error('当前运行环境没有提供可读取的响应流。');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) dispatchSseBlock(block, handlers);
  }

  buffer += decoder.decode();
  if (buffer.trim()) dispatchSseBlock(buffer.trim(), handlers);
}

export async function getAIServiceStatus(): Promise<AIServiceStatus> {
  const payload = await requestJson('/ai/status', { method: 'GET' });
  return aiStatusSchema.parse(payload);
}

type AnnotateTextInput = {
  text: string;
  sourceContext?: string | null;
  learnerContext?: string | null;
};

export async function annotateText(input: AnnotateTextInput) {
  const payload = await requestJson('/ai/annotate-text', {
    method: 'POST',
    body: JSON.stringify({
      text: input.text,
      source_context: input.sourceContext ?? null,
      learner_context: input.learnerContext ?? null,
    }),
  });
  return annotateTextResponseSchema.parse(payload);
}

type GenerateCardInput = {
  selectedText: string;
  sourceMessageId: string;
  sourceMessageContent: string;
  parentCardId?: string | null;
  keywordContext?: string | null;
  relation?: CardRelationType;
  sourceType?: CardSourceType;
};

type GenerateExplanationPreviewInput = {
  selectedText: string;
  sourceMessageId: string;
  sourceMessageContent: string;
  parentPreviewId?: string | null;
  parentCardId?: string | null;
  keywordContext?: string | null;
  relation?: CardRelationType;
  sourceType?: CardSourceType;
};

export async function generateExplanationPreview(input: GenerateExplanationPreviewInput) {
  const payload = await requestJson('/ai/explanation-preview', {
    method: 'POST',
    body: JSON.stringify({
      selected_text: input.selectedText,
      source_message_id: input.sourceMessageId,
      source_message_content: input.sourceMessageContent,
      parent_preview_id: input.parentPreviewId ?? null,
      parent_card_id: input.parentCardId ?? null,
      keyword_context: input.keywordContext ?? null,
      relation: input.relation ?? 'deepen',
      source_type: input.sourceType ?? 'message',
    }),
  });
  return generateExplanationPreviewResponseSchema.parse(payload);
}

export async function generateKnowledgeCard(input: GenerateCardInput) {
  const payload = await requestJson('/ai/knowledge-card', {
    method: 'POST',
    body: JSON.stringify({
      selected_text: input.selectedText,
      source_message_id: input.sourceMessageId,
      source_message_content: input.sourceMessageContent,
      parent_card_id: input.parentCardId ?? null,
      keyword_context: input.keywordContext ?? null,
      relation: input.relation ?? 'deepen',
      source_type: input.sourceType ?? 'message',
    }),
  });
  return generateKnowledgeCardResponseSchema.parse(payload);
}

export { apiBase };
