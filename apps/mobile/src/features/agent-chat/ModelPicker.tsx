import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { CHAT_MODELS, type ChatModel } from './models';
import { palette, radii, spacing } from '@/src/ui/theme';

type Props = {
  selected: ChatModel;
  onSelect: (model: ChatModel) => void;
};

export function ModelPicker({ selected, onSelect }: Props) {
  const [visible, setVisible] = useState(false);
  const freeModels = CHAT_MODELS.filter((model) => model.tier === 'free');
  const lockedModels = CHAT_MODELS.filter((model) => model.tier === 'locked');
  const byokModels = CHAT_MODELS.filter((model) => model.tier === 'byok');

  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setVisible(true)} style={styles.trigger}>
        <Text style={styles.triggerLabel}>模型</Text>
        <Text style={styles.triggerValue} numberOfLines={1}>{selected.label}</Text>
        <Text style={styles.triggerChevron}>▾</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>选择模型</Text>

            <Text style={styles.groupLabel}>可用</Text>
            {freeModels.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                active={model.id === selected.id}
                onPress={() => {
                  onSelect(model);
                  setVisible(false);
                }}
              />
            ))}

            <Text style={styles.groupLabel}>升级解锁</Text>
            {lockedModels.map((model) => (
              <ModelRow key={model.id} model={model} locked onPress={() => {}} />
            ))}

            {byokModels.map((model) => (
              <ModelRow key={model.id} model={model} onPress={() => {}} />
            ))}

            <Pressable style={styles.closeButton} onPress={() => setVisible(false)}>
              <Text style={styles.closeText}>取消</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function ModelRow({
  model,
  active,
  locked,
  onPress,
}: {
  model: ChatModel;
  active?: boolean;
  locked?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={locked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        active && styles.rowActive,
        pressed && styles.rowPressed,
        locked && styles.rowLocked,
      ]}>
      <View style={styles.rowMain}>
        <Text style={styles.rowLabel}>{model.label}</Text>
        {model.provider ? <Text style={styles.rowProvider}>{model.provider}</Text> : null}
      </View>
      {locked ? (
        <Text style={styles.lockTag}>锁定 · {model.hint ?? '升级解锁'}</Text>
      ) : active ? (
        <Text style={styles.activeTag}>已选</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.surface,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: palette.border,
    maxWidth: 150,
  },
  triggerLabel: { color: palette.faint, fontSize: 10, fontWeight: '700' },
  triggerValue: { color: palette.ink, fontSize: 11, fontWeight: '800', flexShrink: 1 },
  triggerChevron: { color: palette.muted, fontSize: 10 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(24,32,51,0.42)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '82%',
  },
  sheetTitle: { color: palette.ink, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  groupLabel: {
    color: palette.purple,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 8,
  },
  rowActive: { borderColor: palette.indigo, backgroundColor: palette.surfaceSoft },
  rowPressed: { opacity: 0.78 },
  rowLocked: { opacity: 0.6 },
  rowMain: { flex: 1 },
  rowLabel: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  rowProvider: { color: palette.muted, fontSize: 11, marginTop: 2 },
  lockTag: { color: palette.faint, fontSize: 11, fontWeight: '700' },
  activeTag: { color: palette.indigo, fontSize: 12, fontWeight: '800' },
  closeButton: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceSoft,
  },
  closeText: { color: palette.indigo, fontSize: 14, fontWeight: '800' },
});
