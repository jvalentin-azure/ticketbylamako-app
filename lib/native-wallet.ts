import { Platform } from "react-native";
import WalletKitModule from "@azizuysal/wallet-kit";
import { fromByteArray } from "base64-js";

export type NativeWalletResult = "added" | "cancelled";

function googleWalletJwt(url: string): string {
  const marker = "/gp/v/save/";
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error("Lien Google Wallet invalide.");
  }

  const jwt = decodeURIComponent(url.slice(markerIndex + marker.length)).trim();
  if (jwt.split(".").length !== 3) {
    throw new Error("Jeton Google Wallet invalide.");
  }
  return jwt;
}

async function applePassBase64(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.apple.pkpass" },
  });
  if (!response.ok) {
    throw new Error(`Téléchargement Wallet impossible (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/vnd.apple.pkpass")) {
    throw new Error("Le serveur n'a pas renvoyé un pass Apple Wallet valide.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 100) {
    throw new Error("Le pass Apple Wallet reçu est vide.");
  }
  return fromByteArray(bytes);
}

export async function addTicketToNativeWallet(
  signedWalletUrl: string,
): Promise<NativeWalletResult> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw new Error("Wallet natif indisponible sur cette plateforme.");
  }

  const available = await WalletKitModule.canAddPasses();
  if (!available) {
    throw new Error("Wallet n'est pas disponible sur cet appareil.");
  }

  const passData =
    Platform.OS === "ios"
      ? await applePassBase64(signedWalletUrl)
      : googleWalletJwt(signedWalletUrl);
  const added = await WalletKitModule.addPass(passData);
  return added ? "added" : "cancelled";
}
