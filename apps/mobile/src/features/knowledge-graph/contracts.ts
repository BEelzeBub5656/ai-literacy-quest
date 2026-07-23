// 类 Obsidian 知识关系图谱 —— 数据合同
// 字段设计参考《类 Obsidian 知识关系图谱设计方案》第 6 节。
// 第一版（MVP）只保留图谱渲染与交互所需字段，来源证据以 SourceRef 形式保留。

export type KnowledgeCategory =
  | 'ai-basic'
  | 'machine-learning'
  | 'computer-vision'
  | 'generative-ai'
  | 'ai-ethics'
  | 'other';

export type Mastery = 'unknown' | 'learning' | 'understood' | 'review';

export type RelationType =
  | 'prerequisite'
  | 'contains'
  | 'related'
  | 'contrast'
  | 'causes'
  | 'applies_to'
  | 'example_of'
  | 'misconception'
  | 'deepen'
  | 'associate'
  | 'branch';

export type SourceType =
  | 'course'
  | 'lesson'
  | 'conversation'
  | 'message'
  | 'knowledge-card'
  | 'vision-result'
  | 'experiment'
  | 'manual';

export type SourceRef = {
  type: SourceType;
  id: string;
  /** 展示用的可读来源说明，例如「AI 通识课 · 第 2 章」。 */
  label?: string;
  /** 来源中的原文引用，用于证据展示。 */
  selectedText?: string;
};

export type KnowledgeNode = {
  id: string;
  title: string;
  summary: string;
  category: KnowledgeCategory;
  mastery: Mastery;
  /** 重要度 1-3，决定节点大小。 */
  importance: number;
  /** 概念置信度 0-1。 */
  confidence: number;
  sourceRefs: SourceRef[];
  /** 显式标记需要复习（即使 mastery 还不是 review）。 */
  review?: boolean;
};

export type KnowledgeEdge = {
  id: string;
  source: string;
  target: string;
  relation: RelationType;
  directed: boolean;
  /** 关系强度 / 验证次数，决定线宽。 */
  weight: number;
  /** 关系置信度 0-1，低于阈值用虚线表示。 */
  confidence: number;
  sourceRefs: SourceRef[];
};

export type GraphFilter = {
  /** 空数组表示不按分类过滤。 */
  categories: KnowledgeCategory[];
  /** 空数组表示不按掌握度过滤。 */
  masteries: Mastery[];
};

export type GraphMode = 'network' | 'path' | 'weak';

export const EMPTY_FILTER: GraphFilter = { categories: [], masteries: [] };

/** 仅用于「学习路径」视图的层级关系（前置 / 包含）。 */
export const HIERARCHY_RELATIONS: RelationType[] = [
  'prerequisite',
  'contains',
  'deepen',
  'branch',
];

/** 判断节点是否属于「薄弱点」集合。 */
export function isWeakNode(node: KnowledgeNode): boolean {
  return node.mastery === 'review' || node.mastery === 'unknown' || node.mastery === 'learning';
}
