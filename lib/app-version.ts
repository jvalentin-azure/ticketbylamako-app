import Constants from "expo-constants";

export function getAppVersionLabel(): string {
  const version = Constants.expoConfig?.version?.trim() || "1.0.0";
  return `TicketByLamako v${version}`;
}
