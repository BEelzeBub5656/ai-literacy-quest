import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ConversationSession } from './contracts';
import { palette, radii, spacing } from '@/src/ui/theme';

type Props = {
  activeSessionId: string;
  sessions: ConversationSession[];
  visible: boolean;
  onClose: () => void;
  onSelect: (sessionId: string) => void;
};

export function SessionSwitcherModal({
  activeSessionId,
  sessions,
  visible,
  onClose,
  onSelect,
}: Props) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="关闭会话列表" onPress={onClose} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>会话</Text>
          <Text style={styles.description}>原会话与从知识卡片创建的深入会话都会保留在这里。</Text>
          <FlatList
            data={sessions}
            keyExtractor={(session) => session.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const active = item.id === activeSessionId;
              return (
                <Pressable
                  onPress={() => onSelect(item.id)}
                  style={({ pressed }) => [
                    styles.item,
                    active && styles.activeItem,
                    pressed && styles.pressedItem,
                  ]}>
                  <View style={styles.itemBody}>
                    <Text numberOfLines={1} style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemMeta}>
                      {item.parentConversationId ? '知识卡片分支' : '主会话'} · {item.messages.length} 条消息
                    </Text>
                  </View>
                  {active && <Text style={styles.activeText}>当前</Text>}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(19,24,42,0.38)' },
  sheet: { maxHeight: '62%', padding: spacing.lg, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: palette.surface },
  handle: { width: 44, height: 5, alignSelf: 'center', marginBottom: 18, borderRadius: 3, backgroundColor: palette.border },
  title: { color: palette.ink, fontSize: 21, fontWeight: '800' },
  description: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  list: { gap: 9, paddingTop: 16, paddingBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background },
  activeItem: { borderColor: '#A9AFF0', backgroundColor: palette.surfaceSoft },
  pressedItem: { opacity: 0.72 },
  itemBody: { flex: 1 },
  itemTitle: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  itemMeta: { color: palette.faint, fontSize: 10, marginTop: 3 },
  activeText: { color: palette.indigo, fontSize: 10, fontWeight: '800' },
});
