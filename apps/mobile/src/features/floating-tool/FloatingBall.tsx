import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFloatingTool } from './FloatingToolProvider';
import { TOOLS, type FloatingTool } from './tools';

export function FloatingBall() {
  const { stage, openMenu, closeMenu, startCamera } = useFloatingTool();
  const insets = useSafeAreaInsets();
  const expanded = stage === 'menu';
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(expanded ? 1 : 0, { damping: 18, stiffness: 220 });
  }, [expanded, progress]);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [{
      rotate: `${interpolate(progress.value, [0, 1], [0, 135], Extrapolation.CLAMP)}deg`,
    }],
  }));
  const menuStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [16, 0], Extrapolation.CLAMP) },
      { scale: interpolate(progress.value, [0, 1], [0.85, 1], Extrapolation.CLAMP) },
    ],
  }));

  const pickTool = (tool: FloatingTool) => {
    if (tool.enabled && tool.id === 'camera') startCamera();
  };

  return (
    <View style={[styles.container, { bottom: insets.bottom + 76 }]} pointerEvents="box-none">
      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        style={[styles.menu, menuStyle]}>
        {TOOLS.map((tool) => (
          <Pressable
            key={tool.id}
            disabled={!tool.enabled}
            onPress={() => pickTool(tool)}
            style={({ pressed }) => [
              styles.chip,
              !tool.enabled && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.chipLabel}>{tool.label}</Text>
            {!tool.enabled && <Text style={styles.soon}>即将上线</Text>}
          </Pressable>
        ))}
      </Animated.View>
      <Pressable
        accessibilityLabel={expanded ? '收起工具' : '打开学习工具'}
        hitSlop={14}
        onPress={expanded ? closeMenu : openMenu}
        style={styles.ball}>
        <Animated.Text style={[styles.plus, ballStyle]}>＋</Animated.Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', right: 18, alignItems: 'flex-end', zIndex: 999 },
  menu: { marginBottom: 14, alignItems: 'flex-end' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  chipLabel: { color: '#182033', fontSize: 14, fontWeight: '700' },
  soon: { marginLeft: 8, color: '#98A0B4', fontSize: 10 },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.82 },
  ball: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4E57C8',
    elevation: 7,
    shadowColor: '#4E57C8',
    shadowOpacity: 0.38,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 4 },
  },
  plus: { color: '#FFFFFF', fontSize: 29, lineHeight: 32, fontWeight: '300' },
});
