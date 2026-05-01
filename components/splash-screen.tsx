import { useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { WelcomeScreen } from "@/components/welcome-screen";

interface CustomSplashProps {
  onFinish: () => void;
}

/**
 * CustomSplash - Two-step intro flow:
 * 1. OnboardingScreen: 4 swipeable slides with Skip/Suivant
 * 2. WelcomeScreen: Main screen with logo, S'inscrire, Se connecter, Explorer
 *
 * The onboarding slides show once, then the welcome screen appears.
 * From the welcome screen, user can sign up, log in, or explore the app.
 */
export function CustomSplash({ onFinish }: CustomSplashProps) {
  const [step, setStep] = useState<"onboarding" | "welcome">("onboarding");

  const handleOnboardingFinish = useCallback(() => {
    setStep("welcome");
  }, []);

  const handleExplore = useCallback(() => {
    onFinish();
  }, [onFinish]);

  return (
    <View style={styles.container}>
      {step === "onboarding" ? (
        <OnboardingScreen onFinish={handleOnboardingFinish} />
      ) : (
        <WelcomeScreen onExplore={handleExplore} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});
