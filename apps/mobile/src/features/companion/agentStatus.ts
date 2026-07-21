import type { AgentRuntimeStatus } from './contracts';

const providerNames: Record<string, string> = {
  deepseek: 'DeepSeek',
  longcat: 'LongCat',
  mock: 'Mock',
};

export function agentName(status: AgentRuntimeStatus): string {
  if (status.model) return status.model;
  if (status.provider) return providerNames[status.provider] ?? status.provider;
  return 'AI 服务';
}

export function agentStatusLabel(status: AgentRuntimeStatus): string {
  const name = agentName(status);
  switch (status.phase) {
    case 'checking': return '正在检查 AI 服务';
    case 'ready':
      if (status.provider === 'mock') return 'Mock · 演示模式';
      return status.configured ? `${name} · 已配置` : `${name} · 等待配置`;
    case 'connecting': return `${name} · 正在连接`;
    case 'reasoning': return `${name} · 正在推理`;
    case 'answering': return `${name} · 正在回答`;
    case 'extracting': return `${name} · 重点词已提取`;
    case 'generating_card': return `${name} · 正在提炼卡片`;
    case 'completed': return `${name} · 本次完成`;
    case 'error': return `${name} · 暂不可用`;
  }
}
