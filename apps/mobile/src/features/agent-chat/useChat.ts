import { useCallback, useRef, useState } from 'react';

import { streamChat } from './api';
import type { ChatMessage } from './types';

export type UseChatResult = {
  messages: ChatMessage[];
  isStreaming: boolean;
  send: (text: string, model: string | null) => Promise<void>;
  stop: () => void;
  reset: () => void;
};

const welcomeMessage: ChatMessage = {
  id: 'chat-welcome',
  role: 'assistant',
  content: '你好，我是 AI 问答助手。可以问我任何关于 AI、课程或实验的问题，我会边思考边回答。',
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef(createId('conv'));

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    conversationIdRef.current = createId('conv');
    setMessages([welcomeMessage]);
    setIsStreaming(false);
  }, []);

  const send = useCallback(
    async (text: string, model: string | null) => {
      const content = text.trim();
      if (!content || isStreaming) return;

      const userMessage: ChatMessage = { id: createId('u'), role: 'user', content };
      const assistantId = createId('a');
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        reasoning: '',
        isStreaming: true,
      };

      const history = [...messages, userMessage];
      setMessages([...history, assistantMessage]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const patch = (updater: (message: ChatMessage) => ChatMessage) => {
        setMessages((current) =>
          current.map((message) => (message.id === assistantId ? updater(message) : message)),
        );
      };

      try {
        await streamChat({
          conversationId: conversationIdRef.current,
          messages: history,
          model,
          signal: controller.signal,
          handlers: {
            onMeta: (meta) =>
              patch((message) => ({ ...message, model: meta.model, provider: meta.provider })),
            onReasoningDelta: (delta) =>
              patch((message) => ({
                ...message,
                reasoning: `${message.reasoning ?? ''}${delta}`,
              })),
            onAnswerStart: () => {},
            onAnswerDelta: (delta) =>
              patch((message) => ({ ...message, content: `${message.content}${delta}` })),
            onDone: () => patch((message) => ({ ...message, isStreaming: false })),
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '回答生成失败，请稍后重试。';
        patch((m) => ({
          ...m,
          isStreaming: false,
          content: m.content || message,
          error: true,
        }));
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [messages, isStreaming],
  );

  return { messages, isStreaming, send, stop, reset };
}
