import { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  type ViewToken,
  type ListRenderItemInfo,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

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

export function OnboardingScreen({ onFinish }: OnboardingScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      onFinish();
    }
  }, [currentIndex, onFinish]);

  const handleSkip = useCallback(() => {
    onFinish();
  }, [onFinish]);

  const renderSlide = useCallback(
    ({ item }: ListRenderItemInfo<OnboardingSlide>) => (
      <View style={[styles.slide, { width }]}>
        <Image source={item.image} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.92)"]}
          locations={[0.3, 0.55, 0.85]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.slideContent, { paddingBottom: Math.max(insets.bottom, 20) + 100 }]}>
          <Text style={styles.slideTitle}>
            {item.title}
            <Text style={styles.slideTitleAccent}>{item.titleAccent}</Text>
          </Text>
          <Text style={styles.slideDescription}>{item.description}</Text>
        </View>
      </View>
    ),
    [insets.bottom]
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      />

      {/* Bottom controls overlay */}
      <View style={[styles.controlsContainer, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}>
        {/* Dot indicators */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
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
    flex: 1,
    height,
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
    fontFamily: "Raleway-Bold",
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 12,
  },
  slideTitleAccent: {
    color: "#c79f6c",
    fontFamily: "Raleway-ExtraBold",
  },
  slideDescription: {
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Raleway-Regular",
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
  },
  dotActive: {
    width: 28,
    backgroundColor: "#c79f6c",
  },
  dotInactive: {
    width: 8,
    backgroundColor: "rgba(255,255,255,0.35)",
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
    fontFamily: "Raleway-SemiBold",
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
    fontFamily: "Raleway-Bold",
    fontWeight: "700",
  },
});
