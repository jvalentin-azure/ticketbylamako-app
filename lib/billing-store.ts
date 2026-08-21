import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import {
  parseStoredBillingInfo,
  type StoredBillingInfo,
} from "@/lib/billing-info";

const BILLING_STORAGE_KEY = "billing_info";

export async function saveBillingInfo(
  billing: StoredBillingInfo,
): Promise<void> {
  const normalized = parseStoredBillingInfo(JSON.stringify(billing));
  if (!normalized) {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(BILLING_STORAGE_KEY);
      return;
    }
    await Promise.all([
      SecureStore.deleteItemAsync(BILLING_STORAGE_KEY),
      AsyncStorage.removeItem(BILLING_STORAGE_KEY),
    ]);
    return;
  }
  const serialized = JSON.stringify(normalized);

  if (Platform.OS === "web") {
    await AsyncStorage.setItem(BILLING_STORAGE_KEY, serialized);
    return;
  }

  await SecureStore.setItemAsync(BILLING_STORAGE_KEY, serialized);
  await AsyncStorage.removeItem(BILLING_STORAGE_KEY).catch(() => undefined);
}

export async function getBillingInfo(): Promise<StoredBillingInfo | null> {
  if (Platform.OS === "web") {
    const stored = await AsyncStorage.getItem(BILLING_STORAGE_KEY);
    const billing = parseStoredBillingInfo(stored);
    if (!billing && stored) {
      await AsyncStorage.removeItem(BILLING_STORAGE_KEY).catch(() => undefined);
    }
    return billing;
  }

  const secureValue = await SecureStore.getItemAsync(BILLING_STORAGE_KEY);
  const secureBilling = parseStoredBillingInfo(secureValue);
  if (secureBilling) return secureBilling;

  if (secureValue) {
    await SecureStore.deleteItemAsync(BILLING_STORAGE_KEY).catch(
      () => undefined,
    );
  }

  // One-time migration for installations that stored billing data before
  // SecureStore was introduced.
  const legacyValue = await AsyncStorage.getItem(BILLING_STORAGE_KEY);
  const legacyBilling = parseStoredBillingInfo(legacyValue);
  if (!legacyBilling) {
    if (legacyValue) {
      await AsyncStorage.removeItem(BILLING_STORAGE_KEY).catch(() => undefined);
    }
    return null;
  }

  await saveBillingInfo(legacyBilling);
  return legacyBilling;
}
