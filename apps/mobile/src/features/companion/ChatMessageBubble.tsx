import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CompanionMessage, InlineKeywordItem } from './contracts';
import { HighlightedText } from './HighlightedText';
import { palette, radii, spacing } from '@/src/ui/theme';

type Props = {
  message: CompanionMessage;
  onLongPress: (message: CompanionMessage) => void;
  onKeywordPress: (message: CompanionMessage, keyword: InlineKeywordItem) => void;
};

export function ChatMessageBubble({ message, onLongPress, onKeywordPress }: Props) {
  const isUser = message.role === 'user';
  const [reasoningExpanded, setReasoningExpanded] = useState(true);
  const autoCollapsed = useRef(false);

  useEffect(() => {
    if (!autoCollapsed.current && message.reasoning && message.content) {
      autoCollapsed.current = true;
      setReasoningExpanded(false);
    }
  }, [message.content, message.reasoning]);

  return (
    <View style={[styles.row, isUser && styles.userRow]}>
      <Pressable
        delayLongPress={350}
        onLongPress={() => onLongPress(message)}
        style={({ pressed }) => [
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          pressed && styles.pressed,
        ]}>
        {!isUser && (
          <View style={styles.roleRow}>
            <Text style={styles.role}>AI 伴学</Text>
            {message.isStreaming && <View style={styles.streamingDot} />}
          </View>
        )}

        {!isUser && message.reasoning !== undefined && (
          <View style={styles.reasoningPanel}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setReasoningExpanded((current) => !current)}
              style={styles.reasoningHeader}>
              <Text style={styles.reasoningTitle}>
                {message.content ? '已深度思考' : '正在深度思考'}
              </Text>
              <Text style={styles.reasoningToggle}>{reasoningExpanded ? '收起⌃' : '展开⌄'}</Text>
            </Pressable>
            {reasoningExpanded && (
              <Text selectable style={styles.reasoningText}>
                {message.reasoning || '正在等待 DeepSeek 返回推理过程…'}
              </Text>
            )}
          </View>
        )}

        {message.content ? (
          <HighlightedText
            text={message.content}
            keywords={message.keywords}
            style={[styles.content, isUser && styles.userContent]}
            onKeywordPress={(keyword) => onKeywordPress(message, keyword)}
          />
        ) : !isUser && message.isStreaming ? (
          <Text style={styles.waiting}>等待正文…</Text>
        ) : null}

        {!isUser && Boolean(message.keywords?.length) && (
          <Text style={styles.hint}>带下划线的重点词可继续生长为知识卡片 · 长按正文可精确选取</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: spacing.md, marginBottom: 14 },
  userRow: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '91%', padding: 14, borderRadius: radii.lg },
  assistantBubble: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  userBubble: { backgroundColor: palette.indigo },
  pressed: { opacity: 0.88 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  role: { color: palette.purple, fontSize: 11, fontWeight: '800' },
  streamingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.mint },
  content: { color: palette.ink, fontSize: 15, lineHeight: 24 },
  userContent: { color: '#FFFFFF' },
  reasoningPanel: {
    marginBottom: 11,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: radii.md,
    backgroundColor: '#F2F3FA',
    borderLeftWidth: 3,
    borderLeftColor: '#B6A8FF',
  },
  reasoningHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reasoningTitle: { color: palette.muted, fontSize: 12, fontWeight: '800' },
  reasoningToggle: { color: palette.purple, fontSize: 10, fontWeight: '700' },
  reasoningText: { color: '#686D82', fontSize: 12, lineHeight: 19, marginTop: 8 },
  waiting: { color: palette.faint, fontSize: 12, fontStyle: 'italic' },
  hint: { color: palette.faint, fontSize: 10, lineHeight: 15, marginTop: 11 },
});
