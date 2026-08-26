import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

export function getAppVersionLabel(): string {
  const version = Constants.expoConfig?.version?.trim() || "1.0.0";
  return `TicketByLamako v${version}`;
}

export function getAppReleaseLabel(): string {
  const build = Platform.select({
    ios: Constants.platform?.ios?.buildNumber,
    android: Constants.platform?.android?.versionCode?.toString(),
  });
  const channel = Updates.channel || "sans canal";
  const runtime = Updates.runtimeVersion || "inconnu";
  const update = Updates.isEmbeddedLaunch
    ? "version intégrée"
    : `OTA ${Updates.updateId?.slice(0, 8) || "inconnue"}`;

  return [
    build ? `Build ${build}` : null,
    channel,
    `runtime ${runtime}`,
    update,
  ]
    .filter(Boolean)
    .join(" • ");
}
