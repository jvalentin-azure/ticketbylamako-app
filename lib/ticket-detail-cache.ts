import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type {
  MobileOrderSummary,
  MobileOrderTicketsResponse,
} from "@/lib/api/mobile";
import {
  parseCachedTicketDetail,
  TICKET_DETAIL_CACHE_VERSION,
  type CachedTicketDetail,
} from "@/lib/ticket-detail-cache-parser";

const CHUNK_SIZE = 1400;
const INDEX_PREFIX = "tbl_ticket_detail_index_v1";
const SECURE_PREFIX = "tbl.ticket.detail.v1";

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function indexKey(userId: number): string {
  return `${INDEX_PREFIX}_${userId}`;
}

function metadataKey(userId: number, orderId: number): string {
  return `${SECURE_PREFIX}.${userId}.${orderId}.meta`;
}

function chunkKey(
  userId: number,
  orderId: number,
  generation: string,
  index: number,
): string {
  return `${SECURE_PREFIX}.${userId}.${orderId}.${generation}.${index}`;
}

interface CacheMetadata {
  count: number;
  generation: string;
}

async function readIndex(userId: number): Promise<number[]> {
  try {
    const stored = await AsyncStorage.getItem(indexKey(userId));
    const parsed = stored ? (JSON.parse(stored) as unknown) : [];
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter(isPositiveInteger))]
      : [];
  } catch {
    return [];
  }
}

async function writeIndex(userId: number, orderIds: number[]): Promise<void> {
  await AsyncStorage.setItem(
    indexKey(userId),
    JSON.stringify([...new Set(orderIds.filter(isPositiveInteger))]),
  );
}

async function readMetadata(
  userId: number,
  orderId: number,
): Promise<CacheMetadata | null> {
  const stored = await SecureStore.getItemAsync(metadataKey(userId, orderId));
  if (!stored) return null;
  try {
    const value = JSON.parse(stored) as Partial<CacheMetadata>;
    return Number.isInteger(value.count) &&
      Number(value.count) > 0 &&
      typeof value.generation === "string" &&
      value.generation.length > 0
      ? { count: Number(value.count), generation: value.generation }
      : null;
  } catch {
    return null;
  }
}

export async function removeCachedTicketDetail(
  userId: number,
  orderId: number,
): Promise<void> {
  if (Platform.OS === "web" || !isPositiveInteger(userId)) return;

  const metadata = await readMetadata(userId, orderId).catch(() => null);
  await Promise.all([
    ...(metadata
      ? Array.from({ length: metadata.count }, (_, index) =>
          SecureStore.deleteItemAsync(
            chunkKey(userId, orderId, metadata.generation, index),
          ).catch(() => undefined),
        )
      : []),
    SecureStore.deleteItemAsync(metadataKey(userId, orderId)).catch(
      () => undefined,
    ),
  ]);

  const orderIds = await readIndex(userId);
  await writeIndex(
    userId,
    orderIds.filter((value) => value !== orderId),
  ).catch(() => undefined);
}

export async function getCachedTicketDetail(
  userId: number,
  orderId: number,
): Promise<CachedTicketDetail | null> {
  if (
    Platform.OS === "web" ||
    !isPositiveInteger(userId) ||
    !isPositiveInteger(orderId)
  ) {
    return null;
  }

  try {
    const metadata = await readMetadata(userId, orderId);
    if (!metadata) return null;

    const chunks = await Promise.all(
      Array.from({ length: metadata.count }, (_, index) =>
        SecureStore.getItemAsync(
          chunkKey(userId, orderId, metadata.generation, index),
        ),
      ),
    );
    if (chunks.some((chunk) => chunk === null)) {
      await removeCachedTicketDetail(userId, orderId);
      return null;
    }

    const cached = parseCachedTicketDetail(chunks.join(""), orderId);
    if (!cached) await removeCachedTicketDetail(userId, orderId);
    return cached;
  } catch {
    return null;
  }
}

export async function setCachedTicketDetail(
  userId: number,
  order: MobileOrderSummary,
  tickets: MobileOrderTicketsResponse,
): Promise<void> {
  if (
    Platform.OS === "web" ||
    !isPositiveInteger(userId) ||
    !isPositiveInteger(order.id) ||
    tickets.orderId !== order.id
  ) {
    return;
  }

  const payload: CachedTicketDetail = {
    version: TICKET_DETAIL_CACHE_VERSION,
    cachedAt: Date.now(),
    order,
    tickets,
  };
  const serialized = JSON.stringify(payload);
  const chunks = serialized.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "gs")) || [];
  const previousMetadata = await readMetadata(userId, order.id).catch(
    () => null,
  );
  const generation = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const orderIds = await readIndex(userId);
  if (!orderIds.includes(order.id)) {
    await writeIndex(userId, [...orderIds, order.id]);
  }

  try {
    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(
          chunkKey(userId, order.id, generation, index),
          chunk,
        ),
      ),
    );
    await SecureStore.setItemAsync(
      metadataKey(userId, order.id),
      JSON.stringify({ count: chunks.length, generation }),
    );
  } catch (error) {
    await Promise.all(
      chunks.map((_, index) =>
        SecureStore.deleteItemAsync(
          chunkKey(userId, order.id, generation, index),
        ).catch(() => undefined),
      ),
    );
    throw error;
  }
  if (previousMetadata) {
    await Promise.all(
      Array.from({ length: previousMetadata.count }, (_, index) =>
        SecureStore.deleteItemAsync(
          chunkKey(userId, order.id, previousMetadata.generation, index),
        ).catch(() => undefined),
      ),
    );
  }
}

export async function clearTicketDetailCache(userId: number): Promise<void> {
  if (Platform.OS === "web" || !isPositiveInteger(userId)) return;

  const orderIds = await readIndex(userId);
  for (const orderId of orderIds) {
    const metadata = await readMetadata(userId, orderId).catch(() => null);
    await Promise.all([
      ...(metadata
        ? Array.from({ length: metadata.count }, (_, index) =>
            SecureStore.deleteItemAsync(
              chunkKey(userId, orderId, metadata.generation, index),
            ).catch(() => undefined),
          )
        : []),
      SecureStore.deleteItemAsync(metadataKey(userId, orderId)).catch(
        () => undefined,
      ),
    ]);
  }
  await AsyncStorage.removeItem(indexKey(userId)).catch(() => undefined);
}
