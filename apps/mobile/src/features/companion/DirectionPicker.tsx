import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CardRelationType } from './contracts';
import { palette, radii, spacing } from '@/src/ui/theme';

type Props = {
  visible: boolean;
  keyword: string;
  onClose: () => void;
  onSelect: (relation: CardRelationType) => void;
};

const directions: { relation: CardRelationType; icon: string; label: string; desc: string }[] = [
  {
    relation: 'deepen',
    icon: '↗',
    label: '深入了解',
    desc: '围绕这个概念向下深挖，说明原理和例子',
  },
  {
    relation: 'associate',
    icon: '→',
    label: '发散关联',
    desc: '横向对比相关概念，说明异同和适用场景',
  },
  {
    relation: 'branch',
    icon: '↓',
    label: '分支探索',
    desc: '保留对话上下文，换个角度重新解释',
  },
];

export function DirectionPicker({ visible, keyword, onClose, onSelect }: Props) {
  if (!visible) return null;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>选择探索方向</Text>
          <Text style={styles.keyword}>「{keyword}」</Text>

          {directions.map((dir) => (
            <Pressable
              key={dir.relation}
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              onPress={() => onSelect(dir.relation)}>
              <View style={styles.optionIconWrap}>
                <Text style={styles.optionIcon}>{dir.icon}</Text>
              </View>
              <View style={styles.optionBody}>
                <Text style={styles.optionLabel}>{dir.label}</Text>
                <Text style={styles.optionDesc}>{dir.desc}</Text>
              </View>
            </Pressable>
          ))}

          <Pressable onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>取消</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(18,24,43,0.45)',
  },
  sheet: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 36,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: palette.surface,
  },
  title: { color: palette.ink, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  keyword: { color: palette.purple, fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 6, marginBottom: 18 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: radii.lg,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
  },
  optionPressed: { opacity: 0.7 },
  optionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceSoft,
  },
  optionIcon: { fontSize: 20, color: palette.indigo, fontWeight: '800' },
  optionBody: { flex: 1 },
  optionLabel: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  optionDesc: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  cancel: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  cancelText: { color: palette.faint, fontSize: 14, fontWeight: '600' },
});
