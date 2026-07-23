// 类 Obsidian 知识关系图谱主屏（设计文档第 4 / 5 / 12 / 13 节）。
// 集成到「我的」标签页：顶部统计 + 三视图切换 + 搜索 + 画布 + 详情 / 关系 / 筛选面板。
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import type { GraphMode, KnowledgeNode } from './contracts';
import { GraphCanvas, type FocusRequest } from './GraphCanvas';
import { KnowledgeDetailSheet } from './KnowledgeDetailSheet';
import { KnowledgeEdgeSheet } from './KnowledgeEdgeSheet';
import { GraphFilters } from './GraphFilters';
import { useGraphState } from './useGraphState';
import { categoryMeta } from './visualEncoding';
import { palette, radii, spacing } from '@/src/ui/theme';
import { useKnowledgeWorkspace } from '@/src/features/knowledge-workspace';

const MODES: { key: GraphMode; label: string }[] = [
  { key: 'network', label: '知识网络' },
  { key: 'path', label: '学习路径' },
  { key: 'weak', label: '我的薄弱点' },
];

export function KnowledgeGraphScreen() {
  const workspace = useKnowledgeWorkspace();
  const g = useGraphState(
    workspace.nodes,
    workspace.edges,
    workspace.layoutsByMode,
    workspace.setNodePosition,
    workspace.resetLayout,
  );
  const [resetToken, setResetToken] = useState(0);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const stats = useMemo(() => {
    const understood = workspace.nodes.filter((n) => n.mastery === 'understood').length;
    const review = workspace.nodes.filter((n) => n.mastery === 'review' || n.review).length;
    const pct = workspace.nodes.length
      ? Math.round((understood / workspace.nodes.length) * 100)
      : 0;
    return {
      nodes: workspace.nodes.length,
      edges: workspace.edges.length,
      understood,
      review,
      pct,
    };
  }, [workspace.nodes, workspace.edges]);

  const selectedNode = g.selectedNodeId ? g.nodeById.get(g.selectedNodeId) ?? null : null;
  const relatedCount = g.focusedNodeId ? Math.max(0, g.neighbors.size - 1) : 0;
  const selectedEdge = g.selectedEdgeId ? g.edgeById.get(g.selectedEdgeId) ?? null : null;

  const onAsk = (node: KnowledgeNode) => {
    const prompt = `围绕「${node.title}」帮我深入理解：${node.summary}`;
    router.push({ pathname: '/chat', params: { prompt } });
  };
  const onContinue = (node: KnowledgeNode) => {
    const prompt = `我想继续学习「${node.title}」，给我一个循序渐进的学习路径。`;
    router.push({ pathname: '/chat', params: { prompt } });
  };

  const selectSearchResult = (node: KnowledgeNode) => {
    g.focusNode(node.id);
    setFocusRequest({ nodeId: node.id, token: Date.now() });
    g.setSearch('');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backText}>‹ 返回我的</Text>
        </Pressable>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.eyebrow}>我的学习空间</Text>
            <Text style={styles.title}>知识关系图谱</Text>
          </View>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeValue}>{stats.pct}%</Text>
            <Text style={styles.statBadgeLabel}>已掌握</Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statItem}>知识点 {stats.nodes}</Text>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.statItem}>关系 {stats.edges}</Text>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.statItem}>待复习 {stats.review}</Text>
        </View>
      </View>

      {/* 三视图切换 */}
      <View style={styles.segment}>
        {MODES.map((m) => {
          const active = g.mode === m.key;
          return (
            <Pressable
              key={m.key}
              accessibilityRole="button"
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => g.setMode(m.key)}>
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 搜索 */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索知识点…"
            placeholderTextColor={palette.faint}
            value={g.search}
            onChangeText={g.setSearch}
          />
          {g.search.length > 0 && (
            <Pressable accessibilityRole="button" onPress={() => g.setSearch('')}>
              <Text style={styles.searchClear}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* 画布区域 */}
      <View style={styles.canvasWrap}>
        <GraphCanvas
          positions={g.positions}
          nodes={g.visibleNodes}
          edges={g.visibleEdges}
          nodeById={g.nodeById}
          neighbors={g.neighbors}
          focusedNodeId={g.focusedNodeId}
          selectedNodeId={g.selectedNodeId}
          mode={g.mode}
          resetToken={resetToken}
          focusRequest={focusRequest}
          onNodeTap={g.onNodeTap}
          onEdgeTap={g.onEdgeTap}
          onBackgroundTap={g.onBackgroundTap}
          onNodeDrag={g.onNodeDrag}
        />

        {/* 画布右上角悬浮操作 */}
        <View style={styles.canvasActions}>
          <Pressable accessibilityRole="button" style={styles.roundBtn} onPress={() => setShowFilters(true)}>
            <Text style={styles.roundBtnText}>筛选</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.roundBtn} onPress={() => setResetToken((t) => t + 1)}>
            <Text style={styles.roundBtnText}>复位</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.roundBtn} onPress={() => setShowLegend((v) => !v)}>
            <Text style={styles.roundBtnText}>图例</Text>
          </Pressable>
        </View>

        {/* 图例面板 */}
        {showLegend && (
          <View style={styles.legend}>
            <Text style={styles.legendTitle}>知识分类</Text>
            {(Object.keys(categoryMeta) as (keyof typeof categoryMeta)[]).map((key) => (
              <View key={key} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: categoryMeta[key].color }]} />
                <Text style={styles.legendText}>{categoryMeta[key].label}</Text>
              </View>
            ))}
            <View style={styles.legendDivider} />
            <Text style={styles.legendTitle}>掌握状态</Text>
            <Text style={styles.legendHint}>实线=已理解 · 虚线=学习中/待复习 · ! = 需复习</Text>
          </View>
        )}

        {/* 搜索结果下拉 */}
        {g.searchMatches.length > 0 && (
          <View style={styles.searchResults}>
            <FlatList
              data={g.searchMatches}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  style={styles.searchResultItem}
                  onPress={() => selectSearchResult(item)}>
                  <View style={[styles.searchResultDot, { backgroundColor: categoryMeta[item.category].color }]} />
                  <Text style={styles.searchResultText}>{item.title}</Text>
                </Pressable>
              )}
            />
          </View>
        )}
      </View>

      <KnowledgeDetailSheet
        node={selectedNode}
        relatedCount={relatedCount}
        onClose={g.clearSelection}
        onAsk={onAsk}
        onContinue={onContinue}
      />
      <KnowledgeEdgeSheet
        edge={selectedEdge}
        sourceNode={selectedEdge ? g.nodeById.get(selectedEdge.source) : undefined}
        targetNode={selectedEdge ? g.nodeById.get(selectedEdge.target) : undefined}
        onClose={g.clearSelection}
      />
      <GraphFilters
        visible={showFilters}
        filter={g.filter}
        onApply={g.setFilter}
        onClose={() => setShowFilters(false)}
        onResetLayout={g.resetLayout}
        hasManualLayout={g.hasManualLayout}
      />
    </SafeAreaView>
  );
}

const shadows = {
  shadowColor: '#26305C',
  shadowOpacity: 0.1,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  backRow: { alignSelf: 'flex-start', paddingVertical: 4, paddingRight: 12 },
  backText: { color: palette.indigo, fontSize: 13, fontWeight: '800' },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: palette.indigo, fontSize: 13, fontWeight: '700' },
  title: { color: palette.ink, fontSize: 26, fontWeight: '800', marginTop: 4 },
  statBadge: {
    alignItems: 'center',
    backgroundColor: palette.indigo,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statBadgeValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  statBadgeLabel: { color: '#D7DAFF', fontSize: 11 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  statItem: { color: palette.muted, fontSize: 13, fontWeight: '600' },
  statDot: { color: palette.faint },
  segment: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: palette.surfaceSoft,
    borderRadius: radii.lg,
    padding: 4,
  },
  segmentItem: { flex: 1, paddingVertical: 9, borderRadius: radii.md, alignItems: 'center' },
  segmentItemActive: { backgroundColor: palette.surface, ...shadows },
  segmentText: { color: palette.muted, fontSize: 13.5, fontWeight: '700' },
  segmentTextActive: { color: palette.ink },
  searchWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchIcon: { color: palette.muted, fontSize: 18 },
  searchInput: { flex: 1, color: palette.ink, fontSize: 15 },
  searchClear: { color: palette.faint, fontSize: 14, paddingHorizontal: 4 },
  canvasWrap: { flex: 1, marginTop: spacing.md, position: 'relative', overflow: 'hidden' },
  canvasActions: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    gap: 6,
  },
  roundBtn: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...shadows,
  },
  roundBtnText: { color: palette.ink, fontSize: 12, fontWeight: '800' },
  legend: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadows,
  },
  legendTitle: { color: palette.ink, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: palette.muted, fontSize: 12.5 },
  legendDivider: { height: 1, backgroundColor: palette.border, marginVertical: 8 },
  legendHint: { color: palette.faint, fontSize: 11, lineHeight: 16 },
  searchResults: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    maxHeight: 220,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    ...shadows,
  },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.lg, paddingVertical: 11 },
  searchResultDot: { width: 10, height: 10, borderRadius: 5 },
  searchResultText: { color: palette.ink, fontSize: 14, fontWeight: '600' },
});
