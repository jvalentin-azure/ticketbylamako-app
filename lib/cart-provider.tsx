import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { Alert, AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import {
  cartHoldRemainingMs,
  createCartExpiryTimestamp,
  parseCartExpiryTimestamp,
  parseStoredCart,
  type CartItem,
} from "./cart-store";

export type { CartItem } from "./cart-store";

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (productId: number, seatLabel?: string) => void;
  updateQuantity: (
    productId: number,
    quantity: number,
    seatLabel?: string,
  ) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
  expiresAt: number | null;
  checkoutRequestKey: string | null;
  ensureCheckoutRequestKey: () => string;
}

const CartContext = createContext<CartContextType | null>(null);
const CART_KEY = "cart_items";
const CART_EXPIRY_KEY = "cart_expires_at_v2";
const CART_CHECKOUT_REQUEST_KEY = "cart_checkout_request_key_v1";
const LEGACY_CART_ACTIVITY_KEY = "cart_last_activity";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [checkoutRequestKey, setCheckoutRequestKey] = useState<string | null>(
    null,
  );
  const checkoutRequestKeyRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef(AppState.currentState);

  const storeCheckoutRequestKey = useCallback((value: string | null) => {
    checkoutRequestKeyRef.current = value;
    setCheckoutRequestKey(value);
    if (value) {
      void AsyncStorage.setItem(CART_CHECKOUT_REQUEST_KEY, value).catch(
        () => undefined,
      );
    } else {
      void AsyncStorage.removeItem(CART_CHECKOUT_REQUEST_KEY).catch(
        () => undefined,
      );
    }
  }, []);

  const ensureCheckoutRequestKey = useCallback(() => {
    const current = checkoutRequestKeyRef.current;
    if (current) return current;
    const next = randomUUID();
    storeCheckoutRequestKey(next);
    return next;
  }, [storeCheckoutRequestKey]);

  const rotateCheckoutRequestKey = useCallback(() => {
    const next = randomUUID();
    storeCheckoutRequestKey(next);
    return next;
  }, [storeCheckoutRequestKey]);

  // Load cart and check expiry on mount
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [data, storedTimestamp, storedCheckoutRequestKey] =
          await Promise.all([
            AsyncStorage.getItem(CART_KEY),
            AsyncStorage.getItem(CART_EXPIRY_KEY),
            AsyncStorage.getItem(CART_CHECKOUT_REQUEST_KEY),
          ]);
        if (!mounted) return;
        if (!data) {
          storeCheckoutRequestKey(null);
          return;
        }
        const parsed = parseStoredCart(data);
        const storedExpiry = parseCartExpiryTimestamp(storedTimestamp);
        if (parsed.length === 0) {
          await Promise.all([
            AsyncStorage.removeItem(CART_KEY),
            AsyncStorage.removeItem(CART_EXPIRY_KEY),
            AsyncStorage.removeItem(CART_CHECKOUT_REQUEST_KEY),
            AsyncStorage.removeItem(LEGACY_CART_ACTIVITY_KEY),
          ]);
          storeCheckoutRequestKey(null);
          return;
        }
        storeCheckoutRequestKey(storedCheckoutRequestKey || randomUUID());
        if (storedExpiry) {
          const remaining = cartHoldRemainingMs(storedExpiry);
          if (remaining <= 0) {
            persist([]);
            Alert.alert(
              "Panier expiré",
              "Votre réservation de 10 minutes a expiré. Le panier a été vidé.",
              [{ text: "OK" }],
            );
            return;
          }
          setExpiresAt(storedExpiry);
          startTimer(remaining);
        } else {
          const nextExpiry = createCartExpiryTimestamp();
          setExpiresAt(nextExpiry);
          void AsyncStorage.setItem(CART_EXPIRY_KEY, String(nextExpiry));
          startTimer(cartHoldRemainingMs(nextExpiry));
        }
        setItems(parsed);
      } catch {
        if (mounted) setItems([]);
      }
    })();
    return () => {
      mounted = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [storeCheckoutRequestKey]);

  // Listen for app going to background/foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, []);

  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (
      appState.current.match(/active/) &&
      nextState.match(/inactive|background/)
    ) {
      // The hold is absolute: backgrounding the app never extends it.
    } else if (nextState === "active") {
      // App coming back - check if cart expired
      void checkExpiry();
    }
    appState.current = nextState;
  };

  const checkExpiry = async () => {
    try {
      const [storedTimestamp, data] = await Promise.all([
        AsyncStorage.getItem(CART_EXPIRY_KEY),
        AsyncStorage.getItem(CART_KEY),
      ]);
      const storedExpiry = parseCartExpiryTimestamp(storedTimestamp);
      const parsed = parseStoredCart(data);
      if (storedExpiry && parsed.length > 0) {
        const remaining = cartHoldRemainingMs(storedExpiry);
        if (remaining <= 0) {
          persist([]);
          Alert.alert(
            "Panier expiré",
            "Votre réservation de 10 minutes a expiré. Le panier a été vidé.",
            [{ text: "OK" }],
          );
        } else {
          setExpiresAt(storedExpiry);
          startTimer(remaining);
        }
      } else if (data && parsed.length === 0) {
        persist([]);
      }
    } catch {
      // Keep the in-memory cart available if device storage is temporarily unavailable.
    }
  };

  const startTimer = (ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setItems((prev) => {
        if (prev.length > 0) {
          void AsyncStorage.setItem(CART_KEY, JSON.stringify([])).catch(
            () => undefined,
          );
          void AsyncStorage.removeItem(CART_EXPIRY_KEY).catch(() => undefined);
          storeCheckoutRequestKey(null);
          setExpiresAt(null);
          Alert.alert(
            "Panier expiré",
            "Votre réservation de 10 minutes a expiré. Le panier a été vidé.",
            [{ text: "OK" }],
          );
          return [];
        }
        return prev;
      });
    }, ms);
  };

  const persist = (newItems: CartItem[]) => {
    setItems(newItems);
    void AsyncStorage.setItem(CART_KEY, JSON.stringify(newItems)).catch(
      () => undefined,
    );
    if (newItems.length > 0) {
      ensureCheckoutRequestKey();
      if (!expiresAt) {
        const nextExpiry = createCartExpiryTimestamp();
        setExpiresAt(nextExpiry);
        void AsyncStorage.setItem(CART_EXPIRY_KEY, String(nextExpiry));
        startTimer(cartHoldRemainingMs(nextExpiry));
      }
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setExpiresAt(null);
      void AsyncStorage.removeItem(CART_EXPIRY_KEY).catch(() => undefined);
      storeCheckoutRequestKey(null);
    }
  };

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
      rotateCheckoutRequestKey();
      setItems((prev) => {
        const key = item.seatLabel
          ? `${item.productId}-${item.seatLabel}`
          : String(item.productId);
        const existing = prev.find((i) => {
          const iKey = i.seatLabel
            ? `${i.productId}-${i.seatLabel}`
            : String(i.productId);
          return iKey === key;
        });

        let next: CartItem[];
        if (existing && !item.seatLabel) {
          next = prev.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + (item.quantity || 1) }
              : i,
          );
        } else {
          next = [...prev, { ...item, quantity: item.quantity || 1 }];
        }
        void AsyncStorage.setItem(CART_KEY, JSON.stringify(next)).catch(
          () => undefined,
        );
        if (prev.length === 0) {
          const nextExpiry = createCartExpiryTimestamp();
          setExpiresAt(nextExpiry);
          void AsyncStorage.setItem(CART_EXPIRY_KEY, String(nextExpiry));
          startTimer(cartHoldRemainingMs(nextExpiry));
        }
        return next;
      });
    },
    [rotateCheckoutRequestKey],
  );

  const removeItem = useCallback(
    (productId: number, seatLabel?: string) => {
      rotateCheckoutRequestKey();
      setItems((prev) => {
        const next = prev.filter(
          (i) => !(i.productId === productId && i.seatLabel === seatLabel),
        );
        void AsyncStorage.setItem(CART_KEY, JSON.stringify(next)).catch(
          () => undefined,
        );
        if (next.length > 0) {
          // Removing an item does not extend the original hold.
        } else {
          if (timerRef.current) clearTimeout(timerRef.current);
          setExpiresAt(null);
          void AsyncStorage.removeItem(CART_EXPIRY_KEY).catch(() => undefined);
          storeCheckoutRequestKey(null);
        }
        return next;
      });
    },
    [rotateCheckoutRequestKey, storeCheckoutRequestKey],
  );

  const updateQuantity = useCallback(
    (productId: number, quantity: number, seatLabel?: string) => {
      rotateCheckoutRequestKey();
      setItems((prev) => {
        const next =
          quantity <= 0
            ? prev.filter(
                (i) =>
                  !(i.productId === productId && i.seatLabel === seatLabel),
              )
            : prev.map((i) =>
                i.productId === productId && i.seatLabel === seatLabel
                  ? { ...i, quantity }
                  : i,
              );
        void AsyncStorage.setItem(CART_KEY, JSON.stringify(next)).catch(
          () => undefined,
        );
        if (next.length > 0) {
          // Quantity changes do not extend the original hold.
        } else {
          if (timerRef.current) clearTimeout(timerRef.current);
          setExpiresAt(null);
          void AsyncStorage.removeItem(CART_EXPIRY_KEY).catch(() => undefined);
          storeCheckoutRequestKey(null);
        }
        return next;
      });
    },
    [rotateCheckoutRequestKey, storeCheckoutRequestKey],
  );

  const clearCart = useCallback(() => {
    persist([]);
  }, []);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        total,
        itemCount,
        expiresAt,
        checkoutRequestKey,
        ensureCheckoutRequestKey,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
