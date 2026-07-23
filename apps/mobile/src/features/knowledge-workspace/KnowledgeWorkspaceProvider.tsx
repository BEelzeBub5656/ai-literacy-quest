import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { KnowledgeCard } from '@/src/features/companion/contracts';
import type {
  GraphMode,
  KnowledgeEdge,
  KnowledgeNode,
  RelationType,
  SourceRef,
} from '@/src/features/knowledge-graph/contracts';
import type { Positions } from '@/src/features/knowledge-graph/layouts';
import { MOCK_EDGES, MOCK_NODES } from '@/src/features/knowledge-graph/mockData';

const STORAGE_KEY = '@campus-ai:knowledge-workspace:v1';

export type VisionCardSource = {
  label: string;
  confidence: number;
  provider: string;
  model: string;
  fallbackUsed: boolean;
};

export type AddKnowledgeCardOptions = {
  sourceMessageContent?: string;
  vision?: VisionCardSource;
};

export type KnowledgeWorkspaceSnapshot = {
  schemaVersion: 1;
  cards: KnowledgeCard[];
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  stashedCardIds: string[];
  layoutsByMode: Partial<Record<GraphMode, Positions>>;
};

type KnowledgeWorkspaceContextValue = KnowledgeWorkspaceSnapshot & {
  hydrated: boolean;
  addCard: (card: KnowledgeCard, options?: AddKnowledgeCardOptions) => void;
  removeCard: (cardId: string) => void;
  stashCard: (cardId: string) => void;
  restoreCard: (cardId: string) => void;
  reorderStashedCard: (cardId: string, targetIndex: number) => void;
  setNodePosition: (mode: GraphMode, nodeId: string, x: number, y: number) => void;
  resetLayout: (mode: GraphMode) => void;
};

const initialSnapshot = (): KnowledgeWorkspaceSnapshot => ({
  schemaVersion: 1,
  cards: [],
  nodes: [...MOCK_NODES],
  edges: [...MOCK_EDGES],
  stashedCardIds: [],
  layoutsByMode: {},
});

const KnowledgeWorkspaceContext = createContext<KnowledgeWorkspaceContextValue | null>(null);

function upsertById<T extends { id: string }>(items: T[], value: T): T[] {
  const index = items.findIndex((item) => item.id === value.id);
  if (index < 0) return [...items, value];
  const next = [...items];
  next[index] = value;
  return next;
}

function normalizeCard(card: KnowledgeCard): KnowledgeCard {
  return {
    ...card,
    source_type: card.source_type ?? 'message',
    relation: card.relation ?? 'deepen',
  };
}

function restoreSnapshot(raw: string): KnowledgeWorkspaceSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as Partial<KnowledgeWorkspaceSnapshot>;
    if (parsed.schemaVersion !== 1) return null;
    if (!Array.isArray(parsed.cards) || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return null;
    }
    return {
      schemaVersion: 1,
      cards: parsed.cards.map(normalizeCard),
      nodes: parsed.nodes,
      edges: parsed.edges,
      stashedCardIds: Array.isArray(parsed.stashedCardIds) ? parsed.stashedCardIds : [],
      layoutsByMode: parsed.layoutsByMode ?? {},
    };
  } catch {
    return null;
  }
}

function sourceNodeForCard(
  card: KnowledgeCard,
  options?: AddKnowledgeCardOptions,
): KnowledgeNode {
  const vision = options?.vision;
  const summary = vision
    ? `识别到“${vision.label}”，置信度 ${Math.round(vision.confidence * 100)}%。来源模型：${vision.model}。`
    : options?.sourceMessageContent ?? card.selected_text;
  return {
    id: `source:${card.source_type}:${card.source_message_id}`,
    title: card.source_type === 'vision-result' ? `识物：${card.selected_text}` : '对话摘录',
    summary: summary.slice(0, 240),
    category: card.source_type === 'vision-result' ? 'computer-vision' : 'other',
    mastery: 'learning',
    importance: 1,
    confidence: vision?.confidence ?? 0.8,
    sourceRefs: [
      {
        type: card.source_type,
        id: card.source_message_id,
        label: card.source_type === 'vision-result' ? '拍照识物结果' : 'AI 伴学消息',
        selectedText: card.selected_text,
      },
    ],
  };
}

function cardNode(card: KnowledgeCard): KnowledgeNode {
  return {
    id: card.card_id,
    title: card.title,
    summary: card.plain_explanation,
    category: card.source_type === 'vision-result' ? 'computer-vision' : 'other',
    mastery: 'learning',
    importance: 2,
    confidence: Math.max(0.6, card.keywords[0]?.confidence ?? 0.82),
    sourceRefs: [
      {
        type: 'knowledge-card',
        id: card.card_id,
        label: 'AI 生成知识卡',
        selectedText: card.selected_text,
      },
    ],
  };
}

function relationEdge(card: KnowledgeCard, sourceId: string): KnowledgeEdge {
  const ref: SourceRef = {
    type: 'knowledge-card',
    id: card.card_id,
    label: `知识卡：${card.title}`,
    selectedText: card.selected_text,
  };
  return {
    id: `card-edge:${sourceId}:${card.card_id}`,
    source: sourceId,
    target: card.card_id,
    relation: card.relation as RelationType,
    directed: card.relation !== 'associate',
    weight: 2,
    confidence: 0.9,
    sourceRefs: [ref],
  };
}

function clampStashedTarget(
  cards: KnowledgeCard[],
  order: string[],
  cardId: string,
  targetIndex: number,
): number {
  const cardById = new Map(cards.map((card) => [card.card_id, card]));
  const descendants = new Set<string>();
  const collectDescendants = (parentId: string) => {
    for (const card of cards) {
      if (card.parent_card_id === parentId && !descendants.has(card.card_id)) {
        descendants.add(card.card_id);
        collectDescendants(card.card_id);
      }
    }
  };
  collectDescendants(cardId);

  const ancestors = new Set<string>();
  let parentId = cardById.get(cardId)?.parent_card_id ?? null;
  while (parentId && !ancestors.has(parentId)) {
    ancestors.add(parentId);
    parentId = cardById.get(parentId)?.parent_card_id ?? null;
  }

  const without = order.filter((id) => id !== cardId);
  let min = 0;
  let max = without.length;
  for (const ancestorId of ancestors) {
    const index = without.indexOf(ancestorId);
    if (index >= 0) min = Math.max(min, index + 1);
  }
  for (const descendantId of descendants) {
    const index = without.indexOf(descendantId);
    if (index >= 0) max = Math.min(max, index);
  }
  return Math.max(min, Math.min(max, targetIndex));
}

export function KnowledgeWorkspaceProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<KnowledgeWorkspaceSnapshot>(initialSnapshot);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const restored = restoreSnapshot(raw);
        if (restored) setSnapshot(restored);
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => undefined);
    }, 250);
    return () => clearTimeout(timeout);
  }, [hydrated, snapshot]);

  const addCard = useCallback((cardInput: KnowledgeCard, options?: AddKnowledgeCardOptions) => {
    const card = normalizeCard(cardInput);
    setSnapshot((current) => {
      const sourceId = card.parent_card_id ?? `source:${card.source_type}:${card.source_message_id}`;
      let nodes = upsertById(current.nodes, cardNode(card));
      let edges = current.edges;
      if (!card.parent_card_id) nodes = upsertById(nodes, sourceNodeForCard(card, options));
      edges = upsertById(edges, relationEdge(card, sourceId));

      if (options?.vision) {
        const anchor = MOCK_NODES.find((node) => node.id === 'image-classification');
        if (anchor) nodes = upsertById(nodes, anchor);
        edges = upsertById(edges, {
          id: `vision-applies:${card.card_id}`,
          source: 'image-classification',
          target: card.card_id,
          relation: 'applies_to',
          directed: true,
          weight: 3,
          confidence: options.vision.confidence,
          sourceRefs: [
            {
              type: 'vision-result',
              id: card.source_message_id,
              label: `${options.vision.provider} · ${options.vision.model}`,
              selectedText: options.vision.label,
            },
          ],
        });
      }

      const cardIndex = current.cards.findIndex((item) => item.card_id === card.card_id);
      const cards = [...current.cards];
      if (cardIndex >= 0) cards[cardIndex] = card;
      else cards.push(card);
      return { ...current, cards, nodes, edges };
    });
  }, []);

  const removeCard = useCallback((cardId: string) => {
    setSnapshot((current) => ({
      ...current,
      cards: current.cards
        .filter((card) => card.card_id !== cardId)
        .map((card) => (
          card.parent_card_id === cardId ? { ...card, parent_card_id: null } : card
        )),
      nodes: current.nodes.filter((node) => node.id !== cardId),
      edges: current.edges.filter((edge) => edge.source !== cardId && edge.target !== cardId),
      stashedCardIds: current.stashedCardIds.filter((id) => id !== cardId),
    }));
  }, []);

  const stashCard = useCallback((cardId: string) => {
    setSnapshot((current) => ({
      ...current,
      stashedCardIds: current.stashedCardIds.includes(cardId)
        ? current.stashedCardIds
        : [...current.stashedCardIds, cardId],
    }));
  }, []);

  const restoreCard = useCallback((cardId: string) => {
    setSnapshot((current) => ({
      ...current,
      stashedCardIds: current.stashedCardIds.filter((id) => id !== cardId),
    }));
  }, []);

  const reorderStashedCard = useCallback((cardId: string, targetIndex: number) => {
    setSnapshot((current) => {
      if (!current.stashedCardIds.includes(cardId)) return current;
      const without = current.stashedCardIds.filter((id) => id !== cardId);
      const safeIndex = clampStashedTarget(
        current.cards,
        current.stashedCardIds,
        cardId,
        targetIndex,
      );
      without.splice(safeIndex, 0, cardId);
      return { ...current, stashedCardIds: without };
    });
  }, []);

  const setNodePosition = useCallback(
    (mode: GraphMode, nodeId: string, x: number, y: number) => {
      setSnapshot((current) => ({
        ...current,
        layoutsByMode: {
          ...current.layoutsByMode,
          [mode]: {
            ...(current.layoutsByMode[mode] ?? {}),
            [nodeId]: { x, y },
          },
        },
      }));
    },
    [],
  );

  const resetLayout = useCallback((mode: GraphMode) => {
    setSnapshot((current) => {
      const layoutsByMode = { ...current.layoutsByMode };
      delete layoutsByMode[mode];
      return { ...current, layoutsByMode };
    });
  }, []);

  const value = useMemo<KnowledgeWorkspaceContextValue>(() => ({
    ...snapshot,
    hydrated,
    addCard,
    removeCard,
    stashCard,
    restoreCard,
    reorderStashedCard,
    setNodePosition,
    resetLayout,
  }), [
    snapshot,
    hydrated,
    addCard,
    removeCard,
    stashCard,
    restoreCard,
    reorderStashedCard,
    setNodePosition,
    resetLayout,
  ]);

  return (
    <KnowledgeWorkspaceContext.Provider value={value}>
      {children}
    </KnowledgeWorkspaceContext.Provider>
  );
}

export function useKnowledgeWorkspace(): KnowledgeWorkspaceContextValue {
  const value = useContext(KnowledgeWorkspaceContext);
  if (!value) {
    throw new Error('useKnowledgeWorkspace must be used inside KnowledgeWorkspaceProvider');
  }
  return value;
}
