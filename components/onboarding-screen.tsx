import { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  interpolate,
  Extrapolation,
  Easing,
  useAnimatedScrollHandler,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

// Parallax: image moves slower than scroll (30% of scroll speed)
const PARALLAX_FACTOR = 0.3;

interface OnboardingSlide {
  id: string;
  image: any;
  title: string;
  titleAccent: string;
  description: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: "1",
    image: require("@/assets/images/onboarding-1.jpg"),
    title: "Découvrez les ",
    titleAccent: "meilleurs événements",
    description:
      "Concerts, festivals, spectacles et soirées — retrouvez tout ce qui se passe à Madagascar.",
  },
  {
    id: "2",
    image: require("@/assets/images/onboarding-2.jpg"),
    title: "Vivez des ",
    titleAccent: "expériences uniques",
    description:
      "Explorez des concerts, ateliers et rencontres qui se passent autour de vous.",
  },
  {
    id: "3",
    image: require("@/assets/images/onboarding-3.jpg"),
    title: "Réservez vos ",
    titleAccent: "billets en un clic",
    description:
      "Achetez vos places facilement avec un paiement rapide et sécurisé.",
  },
  {
    id: "4",
    image: require("@/assets/images/onboarding-4.jpg"),
    title: "Ne ratez ",
    titleAccent: "aucun événement",
    description:
      "Recevez des rappels, des recommandations et soyez toujours au courant.",
  },
];

interface OnboardingScreenProps {
  onFinish: () => void;
}

/**
 * Individual slide component with parallax image and fade-in text
 */
function SlideItem({
  item,
  index,
  scrollX,
  bottomPadding,
}: {
  item: OnboardingSlide;
  index: number;
  scrollX: { value: number };
  bottomPadding: number;
}) {
  // Parallax: shift the image opposite to scroll direction
  const imageAnimatedStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [width * PARALLAX_FACTOR, 0, -width * PARALLAX_FACTOR],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX }],
    };
  });

  // Text fade-in + slide up when slide becomes active
  const textAnimatedStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 0.5) * width, index * width, (index + 0.5) * width];
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [30, 0, -30],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <View style={[styles.slide, { width }]}>
      {/* Parallax image - wider than screen to allow movement */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { left: -width * PARALLAX_FACTOR, right: -width * PARALLAX_FACTOR, width: width * (1 + 2 * PARALLAX_FACTOR) },
          imageAnimatedStyle,
        ]}
      >
        <Image
          source={item.image}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
        />
      </Animated.View>

      {/* Gradient overlay */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.92)"]}
        locations={[0.3, 0.55, 0.85]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Text content with fade-in animation */}
      <Animated.View
        style={[
          styles.slideContent,
          { paddingBottom: bottomPadding },
          textAnimatedStyle,
        ]}
      >
        <Text style={styles.slideTitle}>
          {item.title}
          <Text style={styles.slideTitleAccent}>{item.titleAccent}</Text>
        </Text>
        <Text style={styles.slideDescription}>{item.description}</Text>
      </Animated.View>
    </View>
  );
}

/**
 * Animated dot indicator
 */
function DotIndicator({
  index,
  scrollX,
}: {
  index: number;
  scrollX: { value: number };
}) {
  const dotStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const dotWidth = interpolate(
      scrollX.value,
      inputRange,
      [8, 28, 8],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.35, 1, 0.35],
      Extrapolation.CLAMP
    );
    const backgroundColor =
      dotWidth > 14 ? "#c79f6c" : "rgba(255,255,255,0.35)";
    return {
      width: dotWidth,
      opacity,
    };
  });

  // Use two overlapping views for smooth color transition
  const activeStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const activeOpacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      Extrapolation.CLAMP
    );
    return { opacity: activeOpacity };
  });

  const inactiveStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const inactiveOpacity = interpolate(
      scrollX.value,
      inputRange,
      [1, 0, 1],
      Extrapolation.CLAMP
    );
    return { opacity: inactiveOpacity };
  });

  return (
    <Animated.View style={[styles.dot, dotStyle]}>
      {/* Inactive layer */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: "rgba(255,255,255,0.35)", borderRadius: 4 },
          inactiveStyle,
        ]}
      />
      {/* Active layer */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: "#c79f6c", borderRadius: 4 },
          activeStyle,
        ]}
      />
    </Animated.View>
  );
}

export function OnboardingScreen({ onFinish }: OnboardingScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(0);
  const insets = useSafeAreaInsets();

  const updateIndex = useCallback((idx: number) => {
    setCurrentIndex(idx);
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onMomentumEnd: (event) => {
      const idx = Math.round(event.contentOffset.x / width);
      runOnJS(updateIndex)(idx);
    },
  });

  const handleNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      scrollViewRef.current?.scrollTo({ x: nextIndex * width, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      onFinish();
    }
  }, [currentIndex, onFinish]);

  const handleSkip = useCallback(() => {
    onFinish();
  }, [onFinish]);

  const isLastSlide = currentIndex === SLIDES.length - 1;
  const bottomPadding = Math.max(insets.bottom, 20) + 100;

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {SLIDES.map((item, index) => (
          <SlideItem
            key={item.id}
            item={item}
            index={index}
            scrollX={scrollX}
            bottomPadding={bottomPadding}
          />
        ))}
      </Animated.ScrollView>

      {/* Bottom controls overlay */}
      <View style={[styles.controlsContainer, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}>
        {/* Animated dot indicators */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, index) => (
            <DotIndicator key={index} index={index} scrollX={scrollX} />
          ))}
        </View>

        {/* Buttons row */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            onPress={handleSkip}
            style={styles.skipBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.skipBtnText}>Passer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNext}
            style={styles.nextBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>
              {isLastSlide ? "Commencer" : "Suivant"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  slide: {
    height,
    overflow: "hidden",
  },
  slideContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  slideTitle: {
    fontSize: 28,
    color: "#fff",
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 12,
  },
  slideTitleAccent: {
    color: "#c79f6c",
  },
  slideDescription: {
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  controlsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  skipBtnText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
  },
  nextBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 30,
    backgroundColor: "#c79f6c",
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
