import { useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { OnboardingScreen } from "@/components/onboarding-screen";

interface CustomSplashProps {
  onFinish: () => void | Promise<void>;
}

export function CustomSplash({ onFinish }: CustomSplashProps) {
  const handleLogin = useCallback(async () => {
    await onFinish();
    setTimeout(() => router.push("/(auth)/login" as any), 100);
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <OnboardingScreen onFinish={onFinish} onLogin={handleLogin} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0908",
  },
});
