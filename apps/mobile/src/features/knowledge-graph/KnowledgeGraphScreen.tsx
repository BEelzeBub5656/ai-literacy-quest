// 类 Obsidian 知识关系图谱主屏（设计文档第 4 / 5 / 12 / 13 节）。
// 集成到「我的」标签页：顶部统计 + 三视图切换 + 搜索 + 画布 + 详情 / 关系 / 筛选面板。
import { memo, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import type { GraphMode, KnowledgeNode } from './contracts';
import { GraphCanvas, type FocusRequest } from './GraphCanvas';
import { KnowledgeDetailSheet } from './KnowledgeDetailSheet';
import { KnowledgeEdgeSheet } from './KnowledgeEdgeSheet';
import { GraphFilters } from './GraphFilters';
import { useGraphState } from './useGraphState';
import { categoryMeta } from './visualEncoding';
import { DEFAULT_FORCE_PARAMS, type ForceParams } from './layouts';
import { palette, radii, spacing } from '@/src/ui/theme';
import { useKnowledgeWorkspace } from '@/src/features/knowledge-workspace';

const MODES: { key: GraphMode; label: string }[] = [
  { key: 'network', label: '知识网络' },
  { key: 'path', label: '学习路径' },
  { key: 'weak', label: '我的薄弱点' },
];

const SearchResultItem = memo(function SearchResultItem({
  node,
  onSelect,
}: {
  node: KnowledgeNode;
  onSelect: (node: KnowledgeNode) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.searchResultItem, pressed && styles.searchResultPressed]}
      onPress={() => onSelect(node)}>
      <View style={[styles.searchResultDot, { backgroundColor: categoryMeta[node.category].color }]} />
      <Text style={styles.searchResultText} numberOfLines={1}>{node.title}</Text>
    </Pressable>
  );
});

export function KnowledgeGraphScreen() {
  const workspace = useKnowledgeWorkspace();
  const [forceParams, setForceParams] = useState<ForceParams>(DEFAULT_FORCE_PARAMS);
  const g = useGraphState(
    workspace.nodes,
    workspace.edges,
    workspace.layoutsByMode,
    workspace.setNodePosition,
    workspace.resetLayout,
    forceParams,
  );
  const [resetToken, setResetToken] = useState(0);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showForceSettings, setShowForceSettings] = useState(false);

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
      {/* 紧凑头部 */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.eyebrow}>知识图谱</Text>
            <Text style={styles.title}>关系网络</Text>
          </View>
          <View style={styles.progressBadge}>
            <Text style={styles.progressValue}>{stats.pct}%</Text>
            <Text style={styles.progressLabel}>已掌握</Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statPill}>
            <Text style={styles.statNum}>{stats.nodes}</Text>
            <Text style={styles.statLabel}>知识点</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statNum}>{stats.edges}</Text>
            <Text style={styles.statLabel}>关系</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statNum}>{stats.review}</Text>
            <Text style={styles.statLabel}>待复习</Text>
          </View>
        </View>
      </View>

      {/* 视图切换 + 搜索 合并行 */}
      <View style={styles.toolbar}>
        <View style={styles.segment}>
          {MODES.map((m) => {
            const active = g.mode === m.key;
            return (
              <Pressable
                key={m.key}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.segmentItem,
                  active && styles.segmentItemActive,
                  pressed && styles.segmentPressed,
                ]}
                onPress={() => g.setMode(m.key)}>
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
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
            <Pressable accessibilityRole="button" onPress={() => g.setSearch('')} hitSlop={8}>
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
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.fabBtn, pressed && styles.fabPressed]}
            onPress={() => setShowForceSettings(true)}>
            <Text style={styles.fabText}>力学</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.fabBtn, pressed && styles.fabPressed]}
            onPress={() => setShowFilters(true)}>
            <Text style={styles.fabText}>筛选</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.fabBtn, pressed && styles.fabPressed]}
            onPress={() => setResetToken((t) => t + 1)}>
            <Text style={styles.fabText}>复位</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.fabBtn, pressed && styles.fabPressed]}
            onPress={() => setShowLegend((v) => !v)}>
            <Text style={styles.fabText}>图例</Text>
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
            <Text style={styles.legendHint}>实线=已理解 · 虚线=学习中/待复习</Text>
          </View>
        )}

        {/* 搜索结果下拉 */}
        {g.searchMatches.length > 0 && (
          <View style={styles.searchResults}>
            <ScrollView
              style={styles.searchResultsScroll}
              contentContainerStyle={styles.searchResultsContent}
              keyboardShouldPersistTaps="handled">
              {g.searchMatches.map((item) => (
                <SearchResultItem key={item.id} node={item} onSelect={selectSearchResult} />
              ))}
            </ScrollView>
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
      <ForceSettingsSheet
        visible={showForceSettings}
        params={forceParams}
        onChange={setForceParams}
        onClose={() => setShowForceSettings(false)}
        onReset={() => {
          setForceParams(DEFAULT_FORCE_PARAMS);
          setResetToken((t) => t + 1);
        }}
      />
    </SafeAreaView>
  );
}

const cardShadow = {
  shadowColor: '#26305C',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  // ─── 头部 ───
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, ...cardShadow },
  backText: { color: palette.indigo, fontSize: 22, fontWeight: '800' },
  headerCenter: { flex: 1 },
  eyebrow: { color: palette.indigo, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  title: { color: palette.ink, fontSize: 22, fontWeight: '800', marginTop: 1 },
  progressBadge: {
    alignItems: 'center',
    backgroundColor: palette.indigo,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  progressValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  progressLabel: { color: '#D7DAFF', fontSize: 10, fontWeight: '600' },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  statNum: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  statLabel: { color: palette.muted, fontSize: 11, fontWeight: '600' },
  // ─── 工具栏（segment + search 合并） ───
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    marginTop: 10,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceSoft,
    borderRadius: radii.md,
    padding: 3,
  },
  segmentItem: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 11 },
  segmentItemActive: { backgroundColor: palette.surface, ...cardShadow },
  segmentPressed: { opacity: 0.7 },
  segmentText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: palette.ink },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchIcon: { color: palette.muted, fontSize: 16 },
  searchInput: { flex: 1, color: palette.ink, fontSize: 14, padding: 0 },
  searchClear: { color: palette.faint, fontSize: 13, paddingHorizontal: 4 },
  // ─── 画布 ───
  canvasWrap: { flex: 1, marginTop: 8, position: 'relative', overflow: 'hidden' },
  canvasActions: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    gap: 6,
  },
  fabBtn: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...cardShadow,
  },
  fabPressed: { opacity: 0.75 },
  fabText: { color: palette.ink, fontSize: 12, fontWeight: '800' },
  // ─── 图例 ───
  legend: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...cardShadow,
  },
  legendTitle: { color: palette.ink, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: palette.muted, fontSize: 12.5 },
  legendDivider: { height: 1, backgroundColor: palette.border, marginVertical: 8 },
  legendHint: { color: palette.faint, fontSize: 11, lineHeight: 16 },
  // ─── 搜索结果 ───
  searchResults: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    maxHeight: 220,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    ...cardShadow,
  },
  searchResultsScroll: { flex: 1 },
  searchResultsContent: { paddingBottom: 8 },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  searchResultPressed: { backgroundColor: palette.surfaceSoft },
  searchResultDot: { width: 10, height: 10, borderRadius: 5 },
  searchResultText: { color: palette.ink, fontSize: 14, fontWeight: '600', flex: 1 },
});

// ─── 力学参数设置面板 ───
type ForceSettingsProps = {
  visible: boolean;
  params: ForceParams;
  onChange: (params: ForceParams) => void;
  onClose: () => void;
  onReset: () => void;
};

const FORCE_SLIDERS: {
  key: keyof ForceParams;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'repulse', label: '排斥力', hint: '越大节点越分散', min: 1000, max: 20000, step: 500 },
  { key: 'spring', label: '吸引力', hint: '越大连线越短', min: 0.01, max: 0.2, step: 0.005 },
  { key: 'gravity', label: '向心力', hint: '越大整体越紧凑', min: 0, max: 0.1, step: 0.002 },
  { key: 'linkDistance', label: '连线长度', hint: '越大节点间距越大', min: 0.3, max: 3, step: 0.1 },
];

function ForceSettingsSheet({ visible, params, onChange, onClose, onReset }: ForceSettingsProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={fsStyles.backdrop} onPress={onClose}>
        <Pressable style={fsStyles.sheet} onPress={() => {}}>
          <View style={fsStyles.handle} />
          <Text style={fsStyles.title}>力学参数</Text>
          <Text style={fsStyles.subtitle}>调整图谱布局的物理模型，松手后自动重算</Text>

          {FORCE_SLIDERS.map((s) => (
            <View key={s.key} style={fsStyles.sliderRow}>
              <View style={fsStyles.sliderHeader}>
                <Text style={fsStyles.sliderLabel}>{s.label}</Text>
                <Text style={fsStyles.sliderValue}>
                  {params[s.key].toFixed(s.step < 0.01 ? 4 : s.step < 1 ? 3 : 0)}
                </Text>
              </View>
              <Slider
                style={fsStyles.slider}
                minimumValue={s.min}
                maximumValue={s.max}
                step={s.step}
                value={params[s.key]}
                minimumTrackTintColor={palette.indigo}
                maximumTrackTintColor={palette.border}
                thumbTintColor={palette.indigo}
                onValueChange={(v: number) => onChange({ ...params, [s.key]: v })}
              />
              <Text style={fsStyles.sliderHint}>{s.hint}</Text>
            </View>
          ))}

          <View style={fsStyles.actions}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [fsStyles.btn, fsStyles.btnGhost, pressed && fsStyles.btnPressed]}
              onPress={onReset}>
              <Text style={fsStyles.btnGhostText}>恢复默认</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [fsStyles.btn, fsStyles.btnPrimary, pressed && fsStyles.btnPressed]}
              onPress={onClose}>
              <Text style={fsStyles.btnPrimaryText}>完成</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const fsSheetShadow = {
  shadowColor: '#26305C',
  shadowOpacity: 0.15,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: -4 },
  elevation: 8,
};

const fsStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(24,32,51,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    ...fsSheetShadow,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: palette.border,
    marginBottom: spacing.md,
  },
  title: { color: palette.ink, fontSize: 20, fontWeight: '800' },
  subtitle: { color: palette.muted, fontSize: 13, marginTop: 4, marginBottom: spacing.md },
  sliderRow: { marginTop: 14 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderLabel: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  sliderValue: { color: palette.indigo, fontSize: 14, fontWeight: '800' },
  slider: { width: '100%', height: 40, marginTop: 4 },
  sliderHint: { color: palette.faint, fontSize: 11, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  btn: { flex: 1, paddingVertical: 13, borderRadius: radii.md, alignItems: 'center' },
  btnGhost: { backgroundColor: palette.surfaceSoft, borderWidth: 1, borderColor: palette.border },
  btnGhostText: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  btnPrimary: { backgroundColor: palette.indigo },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  btnPressed: { opacity: 0.7 },
});
