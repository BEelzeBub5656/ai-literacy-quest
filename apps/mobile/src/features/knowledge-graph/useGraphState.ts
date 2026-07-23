import { useCallback, useMemo, useState } from 'react';

import {
  EMPTY_FILTER,
  HIERARCHY_RELATIONS,
  isWeakNode,
  type GraphFilter,
  type GraphMode,
  type KnowledgeEdge,
  type KnowledgeNode,
} from './contracts';
import { forceLayout, layeredLayout, type ForceParams, type Positions } from './layouts';

export type UseGraphState = {
  mode: GraphMode;
  setMode: (mode: GraphMode) => void;
  filter: GraphFilter;
  setFilter: (filter: GraphFilter) => void;
  search: string;
  setSearch: (search: string) => void;
  searchMatches: KnowledgeNode[];
  positions: Positions;
  visibleNodes: KnowledgeNode[];
  visibleEdges: KnowledgeEdge[];
  nodeById: Map<string, KnowledgeNode>;
  edgeById: Map<string, KnowledgeEdge>;
  focusedNodeId: string | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  neighbors: Set<string>;
  onNodeTap: (id: string) => void;
  onEdgeTap: (id: string) => void;
  onBackgroundTap: () => void;
  focusNode: (id: string) => void;
  clearSelection: () => void;
  onNodeDrag: (id: string, x: number, y: number) => void;
  resetLayout: () => void;
  hasManualLayout: boolean;
};

function matchesFilter(node: KnowledgeNode, filter: GraphFilter): boolean {
  if (filter.categories.length && !filter.categories.includes(node.category)) return false;
  if (filter.masteries.length && !filter.masteries.includes(node.mastery)) return false;
  return true;
}

export function useGraphState(
  allNodes: KnowledgeNode[],
  allEdges: KnowledgeEdge[],
  layoutsByMode: Partial<Record<GraphMode, Positions>> = {},
  saveNodePosition?: (mode: GraphMode, nodeId: string, x: number, y: number) => void,
  clearModeLayout?: (mode: GraphMode) => void,
  forceParams?: ForceParams,
): UseGraphState {
  const [mode, setMode] = useState<GraphMode>('network');
  const [filter, setFilter] = useState<GraphFilter>(EMPTY_FILTER);
  const [search, setSearch] = useState('');
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const nodeById = useMemo(
    () => new Map(allNodes.map((node) => [node.id, node])),
    [allNodes],
  );
  const edgeById = useMemo(
    () => new Map(allEdges.map((edge) => [edge.id, edge])),
    [allEdges],
  );

  const basePositions = useMemo(() => {
    const ids = allNodes.map((node) => node.id);
    if (mode === 'path') return layeredLayout(ids, allEdges, HIERARCHY_RELATIONS);
    return forceLayout(ids, allEdges, { force: forceParams });
  }, [allNodes, allEdges, mode, forceParams]);

  const positions = useMemo(() => {
    const overrides = layoutsByMode[mode] ?? {};
    const merged: Positions = {};
    for (const [id, point] of Object.entries(basePositions)) {
      merged[id] = overrides[id] ?? point;
    }
    return merged;
  }, [basePositions, layoutsByMode, mode]);

  const visibleNodes = useMemo(() => {
    const modeNodes = mode === 'weak' ? allNodes.filter(isWeakNode) : allNodes;
    return modeNodes.filter((node) => matchesFilter(node, filter));
  }, [mode, allNodes, filter]);

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  );

  const visibleEdges = useMemo(() => allEdges.filter((edge) => {
    if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) return false;
    if (mode === 'path' && !HIERARCHY_RELATIONS.includes(edge.relation)) return false;
    return true;
  }), [allEdges, visibleNodeIds, mode]);

  const neighbors = useMemo(() => {
    const values = new Set<string>();
    if (!focusedNodeId) return values;
    values.add(focusedNodeId);
    for (const edge of visibleEdges) {
      if (edge.source === focusedNodeId) values.add(edge.target);
      if (edge.target === focusedNodeId) values.add(edge.source);
    }
    return values;
  }, [focusedNodeId, visibleEdges]);

  const onNodeTap = useCallback((id: string) => {
    setFocusedNodeId(id);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  }, []);
  const onEdgeTap = useCallback((id: string) => {
    setSelectedEdgeId(id);
    setSelectedNodeId(null);
    setFocusedNodeId(null);
  }, []);
  const onBackgroundTap = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setFocusedNodeId(null);
  }, []);
  const focusNode = useCallback((id: string) => {
    setFocusedNodeId(id);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setFocusedNodeId(null);
  }, []);
  const onNodeDrag = useCallback((id: string, x: number, y: number) => {
    saveNodePosition?.(mode, id, x, y);
  }, [mode, saveNodePosition]);
  const resetLayout = useCallback(() => clearModeLayout?.(mode), [clearModeLayout, mode]);

  const searchMatches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return [];
    return allNodes.filter((node) => node.title.toLocaleLowerCase().includes(query));
  }, [search, allNodes]);

  return {
    mode,
    setMode,
    filter,
    setFilter,
    search,
    setSearch,
    searchMatches,
    positions,
    visibleNodes,
    visibleEdges,
    nodeById,
    edgeById,
    focusedNodeId,
    selectedNodeId,
    selectedEdgeId,
    neighbors,
    onNodeTap,
    onEdgeTap,
    onBackgroundTap,
    focusNode,
    clearSelection,
    onNodeDrag,
    resetLayout,
    hasManualLayout: Object.keys(layoutsByMode[mode] ?? {}).length > 0,
  };
}
