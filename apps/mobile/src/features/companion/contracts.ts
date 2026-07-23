import { z } from 'zod';

export const reasoningStepSchema = z.object({
  step: z.number().int().min(1).max(5),
  title: z.string().min(2),
  explanation: z.string().min(4),
  based_on: z.array(z.string()).min(1).max(5),
}).strict();

export const keywordSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  normalized_text: z.string().min(1),
  definition: z.string().min(4),
  selection_reason: z.string().min(4),
  confidence: z.number().min(0).max(1),
}).strict();

export const studyAssistantOutputSchema = z.object({
  schema_version: z.literal('1.0'),
  answer_markdown: z.string().min(8),
  reasoning_summary: z.string().min(8),
  reasoning_steps: z.array(reasoningStepSchema).min(2).max(5),
  assumptions: z.array(z.string()).max(5),
  uncertainties: z.array(z.string()).max(5),
  keywords: z.array(keywordSchema).min(3).max(6),
  follow_up_questions: z.array(z.string()).min(1).max(3),
}).strict();

export const studyChatResponseSchema = z.object({
  conversation_id: z.string(),
  message_id: z.string(),
  provider: z.string(),
  model: z.string(),
  fallback_used: z.boolean(),
  output: studyAssistantOutputSchema,
}).strict();

export const inlineKeywordDraftSchema = z.object({
  text: z.string().min(1).max(30),
  normalized_text: z.string().min(1).max(60),
  importance: z.number().int().min(1).max(3),
}).strict();

export const annotateTextResponseSchema = z.object({
  keywords: z.array(inlineKeywordDraftSchema).max(8),
}).strict();

const evidenceRefSchema = z.object({
  type: z.enum(['message', 'card', 'course', 'concept', 'vision-result']),
  id: z.string(),
}).strict();

export const explanationPreviewSchema = z.object({
  preview_id: z.string().min(1),
  parent_preview_id: z.string().nullable(),
  parent_card_id: z.string().nullable(),
  source_message_id: z.string().min(1),
  source_type: z.enum(['message', 'vision-result']),
  relation: z.enum(['deepen', 'associate', 'branch']),
  selected_text: z.string().min(1),
  title: z.string().min(2),
  explanation: z.string().min(8).max(220),
  keywords: z.array(inlineKeywordDraftSchema).max(5),
  evidence_refs: z.array(evidenceRefSchema),
}).strict();

export const generateExplanationPreviewResponseSchema = z.object({
  provider: z.string(),
  model: z.string(),
  fallback_used: z.boolean(),
  preview: explanationPreviewSchema,
}).strict();

export const knowledgeCardSchema = z.object({
  schema_version: z.literal('1.0'),
  card_id: z.string(),
  parent_card_id: z.string().nullable(),
  source_message_id: z.string(),
  source_type: z.enum(['message', 'vision-result']),
  relation: z.enum(['deepen', 'associate', 'branch']),
  selected_text: z.string(),
  title: z.string(),
  plain_explanation: z.string().max(180),
  reasoning_summary: z.string(),
  reasoning_steps: z.array(reasoningStepSchema).min(1).max(3),
  key_points: z.array(z.string()).min(2).max(3),
  keywords: z.array(keywordSchema).min(2).max(4),
  evidence_refs: z.array(evidenceRefSchema),
  assumptions: z.array(z.string()).max(5),
  uncertainties: z.array(z.string()).max(5),
}).strict();

export const generateKnowledgeCardResponseSchema = z.object({
  provider: z.string(),
  model: z.string(),
  fallback_used: z.boolean(),
  card: knowledgeCardSchema,
}).strict();

export type CardRelationType = 'deepen' | 'associate' | 'branch';
export type CardSourceType = 'message' | 'vision-result';

export type KeywordItem = z.infer<typeof keywordSchema>;
export type StudyAssistantOutput = z.infer<typeof studyAssistantOutputSchema>;
export type StudyChatResponse = z.infer<typeof studyChatResponseSchema>;
export type KnowledgeCard = z.infer<typeof knowledgeCardSchema>;
export type ExplanationPreview = z.infer<typeof explanationPreviewSchema>;
export type KnowledgeArtifact = KnowledgeCard;
export type InlineKeywordDraft = z.infer<typeof inlineKeywordDraftSchema>;
export type InlineKeywordItem = InlineKeywordDraft & { id: string };
export type AnnotateTextResponse = z.infer<typeof annotateTextResponseSchema>;

export function explanationPreviewKeywords(
  preview: ExplanationPreview,
): InlineKeywordItem[] {
  return preview.keywords.map((keyword, index) => ({
    ...keyword,
    id: `${preview.preview_id}-keyword-${index + 1}`,
  }));
}

export function promoteExplanationPreview(
  preview: ExplanationPreview,
): KnowledgeArtifact {
  const inlineKeywords = explanationPreviewKeywords(preview);
  return {
    schema_version: '1.0',
    card_id: preview.preview_id.replace(/^preview-/, 'card-'),
    parent_card_id: preview.parent_card_id,
    source_message_id: preview.source_message_id,
    source_type: preview.source_type,
    relation: preview.relation,
    selected_text: preview.selected_text,
    title: preview.title,
    plain_explanation: preview.explanation,
    reasoning_summary: '由用户确认的即时解释升级为知识成果。',
    reasoning_steps: [{
      step: 1,
      title: '保留来源',
      explanation: '成果内容沿用已阅读的即时解释，不再次改写。',
      based_on: [`${preview.source_type}:${preview.source_message_id}`],
    }],
    key_points: [],
    keywords: inlineKeywords.map((keyword) => ({
      id: keyword.id,
      text: keyword.text,
      normalized_text: keyword.normalized_text,
      definition: `可从“${keyword.text}”继续展开理解。`,
      selection_reason: '来自用户确认保存的即时解释。',
      confidence: keyword.importance === 3 ? 0.95 : keyword.importance === 2 ? 0.86 : 0.75,
    })),
    evidence_refs: preview.evidence_refs,
    assumptions: [],
    uncertainties: [],
  };
}

export type CompanionMessage = {
  id: string;
  serverId?: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  isStreaming?: boolean;
  keywords?: InlineKeywordItem[];
  provider?: string;
  model?: string;
};

export type CardNode = KnowledgeCard & {
  children: CardNode[];
  isExpanded?: boolean;
  depth: number;
};

export function cardTreeFromList(cards: KnowledgeCard[]): CardNode[] {
  const byId = new Map<string, CardNode>();
  const roots: CardNode[] = [];

  for (const card of cards) {
    byId.set(card.card_id, { ...card, children: [], depth: 0 });
  }

  for (const node of byId.values()) {
    if (node.parent_card_id && byId.has(node.parent_card_id)) {
      const parent = byId.get(node.parent_card_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      node.depth = 0;
      roots.push(node);
    }
  }

  return roots;
}

export function findCardNode(tree: CardNode[], cardId: string): CardNode | null {
  for (const node of tree) {
    if (node.card_id === cardId) return node;
    const found = findCardNode(node.children, cardId);
    if (found) return found;
  }
  return null;
}

export type ConversationSession = {
  id: string;
  title: string;
  messages: CompanionMessage[];
  contextMessages: CompanionMessage[];
  parentConversationId?: string;
  sourceCardId?: string;
};

export type AgentRuntimePhase =
  | 'checking'
  | 'ready'
  | 'connecting'
  | 'reasoning'
  | 'answering'
  | 'extracting'
  | 'generating_card'
  | 'completed'
  | 'error';

export type AgentRuntimeStatus = {
  phase: AgentRuntimePhase;
  provider?: string;
  model?: string;
  configured?: boolean;
  fallbackEnabled?: boolean;
};
