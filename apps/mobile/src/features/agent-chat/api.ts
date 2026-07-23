import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';
import { z } from 'zod';

import type { ChatMessage, ChatStreamHandlers } from './types';

const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
export const chatApiBase =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? `http://${fallbackHost}:8010/api/v1`;

const metaSchema = z.object({
  conversation_id: z.string(),
  message_id: z.string(),
  provider: z.string(),
  model: z.string(),
}).strict();

const textDeltaSchema = z.object({ text: z.string() }).strict();
const doneSchema = z.object({
  finish_reason: z.string(),
  reasoning_chars: z.number().int().nonnegative(),
  answer_chars: z.number().int().nonnegative(),
}).strict();
const errorSchema = z.object({ code: z.string(), message: z.string() }).strict();

function dispatchSseBlock(block: string, handlers: ChatStreamHandlers): void {
  const lines = block.split('\n');
  const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
  const dataText = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!event || !dataText) return;

  const value: unknown = JSON.parse(dataText);
  switch (event) {
    case 'meta': {
      const meta = metaSchema.parse(value);
      handlers.onMeta({
        conversationId: meta.conversation_id,
        messageId: meta.message_id,
        provider: meta.provider,
        model: meta.model,
      });
      break;
    }
    case 'reasoning_delta':
      handlers.onReasoningDelta(textDeltaSchema.parse(value).text);
      break;
    case 'answer_start':
      handlers.onAnswerStart();
      break;
    case 'answer_delta':
      handlers.onAnswerDelta(textDeltaSchema.parse(value).text);
      break;
    case 'done': {
      const done = doneSchema.parse(value);
      handlers.onDone({
        finishReason: done.finish_reason,
        reasoningChars: done.reasoning_chars,
        answerChars: done.answer_chars,
      });
      break;
    }
    case 'error':
      throw new Error(errorSchema.parse(value).message);
    // 'keywords' 事件在本通用聊天 UI 中忽略（那是知识卡功能）。
  }
}

export async function streamChat(params: {
  conversationId: string;
  messages: ChatMessage[];
  model?: string | null;
  handlers: ChatStreamHandlers;
  signal?: AbortSignal;
}): Promise<void> {
  const { conversationId, messages, model, handlers, signal } = params;
  const response = await fetch(`${chatApiBase}/ai/study-chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      conversation_id: conversationId,
      model: model ?? null,
      messages: messages.slice(-24).map((message) => ({
        id: message.id,
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
