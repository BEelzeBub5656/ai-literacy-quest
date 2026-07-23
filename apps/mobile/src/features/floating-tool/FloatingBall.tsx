import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  clamp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFloatingTool } from './FloatingToolProvider';
import { TOOLS, type FloatingTool } from './tools';
import { BALL_SIZE, EDGE_MARGIN, TAP_THRESHOLD } from './config';

export function FloatingBall() {
  const { stage, openMenu, closeMenu, startCamera, ballX, ballY } = useFloatingTool();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const expanded = stage === 'menu';
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(expanded ? 1 : 0, { damping: 18, stiffness: 220 });
  }, [expanded, progress]);

  // 拖拽起始点（共享值，避免手势 context 的 TS 类型问题）
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // 点击行为：菜单态→收起；半藏停靠态→先滑入全显再展开菜单；否则直接展开
  const activateBall = () => {
    if (stage === 'menu') {
      closeMenu();
      return;
    }
    const dockedLeft = ballX.value <= -BALL_SIZE / 2 + 1;
    const dockedRight = ballX.value >= screenW - BALL_SIZE / 2 - 1;
    if (dockedLeft) {
      ballX.value = withSpring(EDGE_MARGIN, { damping: 20, stiffness: 200 });
    } else if (dockedRight) {
      ballX.value = withSpring(screenW - BALL_SIZE - EDGE_MARGIN, { damping: 20, stiffness: 200 });
    }
    openMenu();
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      'worklet';
      startX.value = ballX.value;
      startY.value = ballY.value;
      if (stage === 'menu') {
        runOnJS(closeMenu)();
      }
    })
    .onUpdate((event) => {
      'worklet';
      ballX.value = clamp(
        startX.value + event.translationX,
        -BALL_SIZE / 2,
        screenW - BALL_SIZE / 2,
      );
      ballY.value = clamp(
        startY.value + event.translationY,
        insets.top,
        screenH - BALL_SIZE - insets.bottom,
      );
    })
    .onEnd((event) => {
      'worklet';
      const moved = Math.hypot(event.translationX, event.translationY);
      if (moved < TAP_THRESHOLD) {
        runOnJS(activateBall)();
        return;
      }
      // 仅当松手时球已有一部分超出边缘才吸附藏一半；否则停在松手位置
      const releaseX = ballX.value;
      if (releaseX < 0) {
        ballX.value = withSpring(-BALL_SIZE / 2, { damping: 20, stiffness: 200 });
      } else if (releaseX > screenW - BALL_SIZE) {
        ballX.value = withSpring(screenW - BALL_SIZE / 2, { damping: 20, stiffness: 200 });
      }
      // 其余：保持松手位置（ballY 已在 onUpdate 被 clamp 到安全区）
    });

  // 独立 Tap 手势：纯点击时 Pan 不会进入 ACTIVE 态、onEnd 不触发，
  // 故用 Tap 可靠识别点击；与 Pan 互斥组合（拖拽时 Pan 激活则 Tap 取消）
  const tap = Gesture.Tap().onEnd(() => {
    'worklet';
    runOnJS(activateBall)();
  });

  const composed = Gesture.Exclusive(pan, tap);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(progress.value, [0, 1], [0, 135], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  const menuStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [16, 0], Extrapolation.CLAMP) },
      { scale: interpolate(progress.value, [0, 1], [0.85, 1], Extrapolation.CLAMP) },
    ],
  }));

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ballX.value }, { translateY: ballY.value }],
  }));

  const pickTool = (tool: FloatingTool) => {
    if (tool.enabled && tool.id === 'camera') startCamera();
  };

  return (
    <Animated.View style={[styles.container, dragStyle]} pointerEvents="box-none">
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
      <GestureDetector gesture={composed}>
        <Animated.View
          accessibilityRole="button"
          accessibilityLabel={expanded ? '收起工具' : '打开学习工具'}
          style={styles.ball}>
          <Animated.Text style={[styles.plus, ballStyle]}>＋</Animated.Text>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 容器仅作为球的定位锚点（菜单绝对定位，不影响布局），translate 即球左上角
  container: { position: 'absolute', left: 0, top: 0, zIndex: 999 },
  menu: {
    position: 'absolute',
    bottom: BALL_SIZE + 14,
    right: 0,
    alignItems: 'flex-end',
  },
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
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
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
