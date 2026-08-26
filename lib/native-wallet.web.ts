export type NativeWalletResult = "added" | "cancelled";

export async function addTicketToNativeWallet(
  _signedWalletUrl: string,
): Promise<NativeWalletResult> {
  throw new Error("Wallet natif indisponible sur cette plateforme.");
}
