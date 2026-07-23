import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MessageMarkdown } from './MessageMarkdown';
import type { ChatMessage } from './types';
import { palette, radii, spacing } from '@/src/ui/theme';

type Props = {
  message: ChatMessage;
};

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const [reasoningExpanded, setReasoningExpanded] = useState(true);
  const autoCollapsed = useRef(false);

  useEffect(() => {
    if (!autoCollapsed.current && message.reasoning && message.content) {
      autoCollapsed.current = true;
      setReasoningExpanded(false);
    }
  }, [message.content, message.reasoning]);

  if (isUser) {
    return (
      <View style={styles.rowUser}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.assistantBubble}>
        <View style={styles.roleRow}>
          <Text style={styles.role}>AI 问答</Text>
          {message.isStreaming && <View style={styles.streamingDot} />}
          {message.model ? <Text style={styles.modelTag}>{message.model}</Text> : null}
        </View>

        {message.reasoning !== undefined && message.reasoning !== '' && (
          <View style={styles.reasoningPanel}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setReasoningExpanded((current) => !current)}
              style={styles.reasoningHeader}>
              <Text style={styles.reasoningTitle}>
                {message.content ? '已深度思考' : '正在深度思考'}
              </Text>
              <Text style={styles.reasoningToggle}>{reasoningExpanded ? '收起' : '展开'}</Text>
            </Pressable>
            {reasoningExpanded && (
              <Text selectable style={styles.reasoningText}>{message.reasoning}</Text>
            )}
          </View>
        )}

        {message.error ? (
          <Text style={styles.errorText}>{message.content || '回答生成失败，请稍后重试。'}</Text>
        ) : message.content ? (
          <MessageMarkdown content={message.content} />
        ) : message.isStreaming ? (
          <Text style={styles.waiting}>正在生成回答…</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: spacing.md, marginBottom: 14 },
  rowUser: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md, marginBottom: 14 },
  assistantBubble: {
    maxWidth: '91%',
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  userBubble: { maxWidth: '85%', padding: 14, borderRadius: radii.lg, backgroundColor: palette.indigo },
  userText: { color: '#FFFFFF', fontSize: 15, lineHeight: 22 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  role: { color: palette.purple, fontSize: 11, fontWeight: '800' },
  streamingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.mint },
  modelTag: {
    color: palette.faint,
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: palette.surfaceSoft,
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  reasoningPanel: {
    marginBottom: 11,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: radii.md,
    backgroundColor: '#F2F3FA',
    borderLeftWidth: 3,
    borderLeftColor: '#B6A8FF',
  },
  reasoningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reasoningTitle: { color: palette.muted, fontSize: 12, fontWeight: '800' },
  reasoningToggle: { color: palette.purple, fontSize: 10, fontWeight: '700' },
  reasoningText: { color: '#686D82', fontSize: 12, lineHeight: 19, marginTop: 8 },
  waiting: { color: palette.faint, fontSize: 12, fontStyle: 'italic' },
  errorText: { color: palette.danger, fontSize: 14, lineHeight: 21 },
});
