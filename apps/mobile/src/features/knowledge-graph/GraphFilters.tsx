// 图谱筛选面板（设计文档第 5.1 / 11 节）：按分类与掌握度筛选。
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  EMPTY_FILTER,
  type GraphFilter,
  type KnowledgeCategory,
  type Mastery,
} from './contracts';
import { categoryMeta, masteryMeta } from './visualEncoding';
import { palette, radii, spacing } from '@/src/ui/theme';

type Props = {
  visible: boolean;
  filter: GraphFilter;
  onApply: (filter: GraphFilter) => void;
  onClose: () => void;
  // 还原手动拖拽的节点布局（MVP#13 持久化覆盖）。
  onResetLayout?: () => void;
  hasManualLayout?: boolean;
};

const CATEGORIES: KnowledgeCategory[] = [
  'ai-basic',
  'machine-learning',
  'computer-vision',
  'generative-ai',
  'ai-ethics',
  'other',
];
const MASTERIES: Mastery[] = ['unknown', 'learning', 'understood', 'review'];

// 与 GraphCanvas 保持一致的「需复习 / 危险」强调色。
const REVIEW_BADGE = '#D84C62';

export function GraphFilters({ visible, filter, onApply, onClose, onResetLayout, hasManualLayout }: Props) {
  const toggleCategory = (c: KnowledgeCategory) => {
    const has = filter.categories.includes(c);
    const next = has
      ? filter.categories.filter((x) => x !== c)
      : [...filter.categories, c];
    onApply({ ...filter, categories: next });
  };
  const toggleMastery = (m: Mastery) => {
    const has = filter.masteries.includes(m);
    const next = has ? filter.masteries.filter((x) => x !== m) : [...filter.masteries, m];
    onApply({ ...filter, masteries: next });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>筛选图谱</Text>

          <Text style={styles.groupLabel}>知识分类</Text>
          <View style={styles.chipWrap}>
            {CATEGORIES.map((c) => {
              const active = filter.categories.includes(c);
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleCategory(c)}>
                  {!active && <View style={[styles.chipDot, { backgroundColor: categoryMeta[c].color }]} />}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {categoryMeta[c].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.groupLabel}>掌握状态</Text>
          <View style={styles.chipWrap}>
            {MASTERIES.map((m) => {
              const active = filter.masteries.includes(m);
              return (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleMastery(m)}>
                  {!active && <View style={[styles.chipDot, { backgroundColor: masteryMeta[m].ring }]} />}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {masteryMeta[m].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {hasManualLayout && onResetLayout && (
            <Pressable
              accessibilityRole="button"
              style={[styles.btn, styles.btnDanger]}
              onPress={() => {
                onResetLayout();
                onClose();
              }}>
              <Text style={styles.btnDangerText}>还原拖拽布局</Text>
            </Pressable>
          )}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={[styles.btn, styles.btnGhost]}
              onPress={() => onApply(EMPTY_FILTER)}>
              <Text style={styles.btnGhostText}>重置</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={[styles.btn, styles.btnPrimary]} onPress={onClose}>
              <Text style={styles.btnPrimaryText}>完成</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(24,32,51,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: palette.border,
    marginBottom: spacing.md,
  },
  title: { color: palette.ink, fontSize: 20, fontWeight: '800', marginBottom: spacing.md },
  groupLabel: { color: palette.muted, fontSize: 13, fontWeight: '700', marginTop: spacing.md, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 99,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
  },
  chipActive: { backgroundColor: palette.indigo, borderColor: palette.indigo },
  chipDot: { width: 9, height: 9, borderRadius: 5 },
  chipText: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  btn: { flex: 1, paddingVertical: 13, borderRadius: radii.md, alignItems: 'center' },
  btnGhost: { backgroundColor: palette.surfaceSoft, borderWidth: 1, borderColor: palette.border },
  btnGhostText: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  btnPrimary: { backgroundColor: palette.indigo },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  btnDanger: {
    marginTop: spacing.lg,
    paddingVertical: 13,
    borderRadius: radii.md,
    alignItems: 'center',
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: REVIEW_BADGE,
  },
  btnDangerText: { color: REVIEW_BADGE, fontSize: 14, fontWeight: '800' },
});
