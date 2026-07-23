import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

const MIN = 48;

export interface CropBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

type Props = {
  frameX: SharedValue<number>;
  frameY: SharedValue<number>;
  frameW: SharedValue<number>;
  frameH: SharedValue<number>;
  bounds: CropBounds;
};

export function CropFrame({ frameX, frameY, frameW, frameH, bounds }: Props) {
  const moveStartX = useSharedValue(0);
  const moveStartY = useSharedValue(0);
  const resizeStartW = useSharedValue(0);
  const resizeStartH = useSharedValue(0);

  const move = Gesture.Pan()
    .maxPointers(1)
    .onBegin(() => {
      moveStartX.value = frameX.value;
      moveStartY.value = frameY.value;
    })
    .onUpdate((event) => {
      frameX.value = Math.min(
        Math.max(moveStartX.value + event.translationX, bounds.left),
        bounds.right - frameW.value,
      );
      frameY.value = Math.min(
        Math.max(moveStartY.value + event.translationY, bounds.top),
        bounds.bottom - frameH.value,
      );
    });

  const resize = Gesture.Pan()
    .maxPointers(1)
    .onBegin(() => {
      resizeStartW.value = frameW.value;
      resizeStartH.value = frameH.value;
    })
    .onUpdate((event) => {
      frameW.value = Math.min(
        Math.max(resizeStartW.value + event.translationX, MIN),
        bounds.right - frameX.value,
      );
      frameH.value = Math.min(
        Math.max(resizeStartH.value + event.translationY, MIN),
        bounds.bottom - frameY.value,
      );
    });

  const frameStyle = useAnimatedStyle(() => ({
    left: frameX.value,
    top: frameY.value,
    width: frameW.value,
    height: frameH.value,
  }));

  return (
    <GestureDetector gesture={move}>
      <Animated.View style={[styles.frame, frameStyle]}>
        <Animated.View pointerEvents="none" style={styles.grid} />
        <GestureDetector gesture={resize}>
          <Animated.View style={styles.handle} />
        </GestureDetector>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', borderWidth: 2, borderColor: '#7A82ED' },
  grid: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.36)' },
  handle: {
    position: 'absolute', right: -11, bottom: -11,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#4E57C8', borderWidth: 2, borderColor: '#FFFFFF',
  },
});
