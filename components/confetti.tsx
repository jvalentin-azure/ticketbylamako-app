import { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CONFETTI_COUNT = 50;
const COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9", "#F1948A", "#82E0AA"];

interface ConfettiPieceProps {
  index: number;
  onFinish?: () => void;
}

function ConfettiPiece({ index }: ConfettiPieceProps) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  const startX = Math.random() * SCREEN_W;
  const endX = startX + (Math.random() - 0.5) * 200;
  const duration = 2000 + Math.random() * 1500;
  const delay = Math.random() * 600;
  const color = COLORS[index % COLORS.length];
  const size = 6 + Math.random() * 8;
  const isCircle = Math.random() > 0.5;

  useEffect(() => {
    translateY.value = withDelay(delay, withTiming(SCREEN_H + 50, { duration, easing: Easing.out(Easing.quad) }));
    translateX.value = withDelay(delay, withTiming(endX - startX, { duration, easing: Easing.inOut(Easing.sin) }));
    rotate.value = withDelay(delay, withTiming(360 * (2 + Math.random() * 3), { duration }));
    opacity.value = withDelay(delay + duration * 0.7, withTiming(0, { duration: duration * 0.3 }));
    scale.value = withDelay(delay, withTiming(0.3, { duration, easing: Easing.in(Easing.quad) }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: startX,
          top: -20,
          width: size,
          height: isCircle ? size : size * 2.5,
          backgroundColor: color,
          borderRadius: isCircle ? size / 2 : 2,
        },
        animStyle,
      ]}
    />
  );
}

interface ConfettiProps {
  active?: boolean;
  duration?: number;
}

export function Confetti({ active = true, duration = 4000 }: ConfettiProps) {
  const [visible, setVisible] = useRef(active).current ? [true, () => {}] : [active, () => {}];

  if (!active) return null;
  if (Platform.OS === "web") return null; // Skip on web to avoid performance issues

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
        <ConfettiPiece key={i} index={i} />
      ))}
    </View>
  );
}
