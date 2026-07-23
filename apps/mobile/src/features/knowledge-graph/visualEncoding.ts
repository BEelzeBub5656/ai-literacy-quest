// 视觉编码：颜色、掌握状态外圈、关系标签、节点大小
// 参考《类 Obsidian 知识关系图谱设计方案》第 11 节。

import type { KnowledgeCategory, Mastery, RelationType } from './contracts';

export type CategoryMeta = { label: string; color: string };

/** 节点分类颜色（第 11.1 节）。 */
export const categoryMeta: Record<KnowledgeCategory, CategoryMeta> = {
  'ai-basic': { label: 'AI 基础', color: '#3B82F6' },
  'machine-learning': { label: '机器学习', color: '#8B5CF6' },
  'computer-vision': { label: '计算机视觉', color: '#22C55E' },
  'generative-ai': { label: '生成式 AI', color: '#F59E0B' },
  'ai-ethics': { label: 'AI 伦理与风险', color: '#EF4444' },
  other: { label: '其他', color: '#94A3B8' },
};

export type MasteryMeta = {
  label: string;
  /** 掌握状态外圈颜色（第 11.3 节）。 */
  ring: string;
  /** 外圈是否使用虚线。 */
  dashed: boolean;
};

export const masteryMeta: Record<Mastery, MasteryMeta> = {
  unknown: { label: '未学习', ring: '#B8BDD3', dashed: false },
  learning: { label: '学习中', ring: '#E6A83C', dashed: true },
  understood: { label: '已理解', ring: '#22C55E', dashed: false },
  review: { label: '待复习', ring: '#D84C62', dashed: true },
};

/** 关系类型中文标签（第 7 节）。 */
export const relationLabel: Record<RelationType, string> = {
  deepen: '深入',
  associate: '关联',
  branch: '分支',
  prerequisite: '前置',
  contains: '包含',
  related: '相关',
  contrast: '对比',
  causes: '导致',
  applies_to: '应用于',
  example_of: '例如',
  misconception: '易混淆',
};

export const RELATION_ORDER: RelationType[] = [
  'deepen',
  'associate',
  'branch',
  'prerequisite',
  'contains',
  'related',
  'contrast',
  'causes',
  'applies_to',
  'example_of',
  'misconception',
];

/** 根据重要度（1-3）返回节点半径（图谱坐标单位）。 */
export function nodeRadius(importance: number): number {
  const clamped = Math.max(1, Math.min(3, importance));
  return 10 + clamped * 4; // 14 / 18 / 22
}

/** 中性边颜色。 */
export const EDGE_COLOR = '#C2C8DA';
export const EDGE_HIGHLIGHT = '#4E57C8';
