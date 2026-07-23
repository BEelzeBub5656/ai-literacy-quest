import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';

import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';
import { ModelPicker } from './ModelPicker';
import { DEFAULT_CHAT_MODEL, type ChatModel } from './models';
import { useChat } from './useChat';
import type { ChatMessage } from './types';
import { palette, radii, spacing } from '@/src/ui/theme';

export function ChatScreen() {
  const { messages, isStreaming, send, stop, reset } = useChat();
  const [model, setModel] = useState<ChatModel>(DEFAULT_CHAT_MODEL);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ prompt?: string }>();
  const initialPrompt = typeof params.prompt === 'string' ? params.prompt : undefined;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={6}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>AI 问答</Text>
          </View>
          <ModelPicker selected={model} onSelect={setModel} />
          <Pressable accessibilityRole="button" onPress={reset} style={styles.newButton}>
            <Text style={styles.newText}>新对话</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
          />
        </View>

        <ChatInput
          onSend={(text) => void send(text, model.id)}
          onStop={stop}
          isStreaming={isStreaming}
          initialValue={initialPrompt}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: { paddingHorizontal: 6, paddingVertical: 6 },
  backText: { color: palette.indigo, fontSize: 22, fontWeight: '800' },
  titleWrap: { flex: 1 },
  title: { color: palette.ink, fontSize: 20, fontWeight: '800' },
  newButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  newText: { color: palette.indigo, fontSize: 10, fontWeight: '800' },
  body: { flex: 1 },
  messageList: { paddingTop: 16, paddingBottom: 18 },
});
