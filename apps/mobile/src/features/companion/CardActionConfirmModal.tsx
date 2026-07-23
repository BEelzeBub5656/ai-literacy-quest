import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radii, shadows, spacing } from '@/src/ui/theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CardActionConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  destructive = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View accessibilityRole="alert" style={styles.dialog}>
          <View style={styles.icon}><Text style={styles.iconText}>✦</Text></View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>取消</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [styles.primary, destructive && styles.destructive, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(21, 25, 52, 0.28)' },
  dialog: { width: '100%', maxWidth: 390, padding: spacing.lg, borderRadius: radii.xl, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, ...shadows.card },
  icon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: palette.surfaceSoft },
  iconText: { color: palette.purple, fontSize: 17, fontWeight: '800' },
  title: { color: palette.ink, fontSize: 18, lineHeight: 25, fontWeight: '800', marginTop: 12 },
  message: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: spacing.lg },
  secondary: { borderRadius: 99, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: palette.surfaceSoft },
  secondaryText: { color: palette.indigo, fontSize: 12, fontWeight: '800' },
  primary: { borderRadius: 99, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: palette.indigo },
  destructive: { backgroundColor: palette.danger },
  primaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
