import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";

/**
 * Static bridge matching the native launch screen exactly.
 * Keeping both frames identical avoids a flash or a perceived second splash.
 */
export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require("@/assets/images/logo-white.png")}
          style={styles.logo}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0908",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 220,
    height: 79,
  },
});
