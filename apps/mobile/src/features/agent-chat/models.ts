export type ChatModelTier = 'free' | 'locked' | 'byok';

export type ChatModel = {
  id: string;
  label: string;
  tier: ChatModelTier;
  hint?: string;
  provider?: string;
};

/**
 * Demo 模型目录，刻意仿照参考站（ai.explore.poker/chat）的「可用 / 升级解锁 / BYOK」分层。
 * `id` 会作为 `model` 参数透传给后端 /study-chat/stream；
 * `locked` 项仅作视觉占位（不可选），真实路由需后续后端改造支持。
 */
export const CHAT_MODELS: ChatModel[] = [
  { id: 'deepseek-chat', label: 'DeepSeek Chat', tier: 'free', provider: 'DeepSeek' },
  { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', tier: 'free', provider: 'DeepSeek' },
  { id: 'longcat-flash', label: 'LongCat Flash', tier: 'free', provider: 'LongCat' },
  { id: 'claude-opus', label: 'Claude Opus', tier: 'locked', hint: '升级解锁', provider: 'Anthropic' },
  { id: 'gpt-5', label: 'GPT-5', tier: 'locked', hint: '升级解锁', provider: 'OpenAI' },
  { id: 'gemini-pro', label: 'Gemini Pro', tier: 'locked', hint: '升级解锁', provider: 'Google' },
  { id: '__byok__', label: '添加 BYOK 模型', tier: 'byok' },
];

export const DEFAULT_CHAT_MODEL: ChatModel = CHAT_MODELS[0];
