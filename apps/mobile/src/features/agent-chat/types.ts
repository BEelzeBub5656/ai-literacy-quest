export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  reasoning?: string;
  isStreaming?: boolean;
  model?: string;
  provider?: string;
  error?: boolean;
};

export type ChatStreamHandlers = {
  onMeta: (meta: {
    conversationId: string;
    messageId: string;
    provider: string;
    model: string;
  }) => void;
  onReasoningDelta: (text: string) => void;
  onAnswerStart: () => void;
  onAnswerDelta: (text: string) => void;
  onDone: (data: {
    finishReason: string;
    reasoningChars: number;
    answerChars: number;
  }) => void;
};
