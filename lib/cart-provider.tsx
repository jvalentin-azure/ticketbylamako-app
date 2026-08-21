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
import {
  parseCartActivityTimestamp,
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
}

const CartContext = createContext<CartContextType | null>(null);
const CART_KEY = "cart_items";
const CART_TIMESTAMP_KEY = "cart_last_activity";
const CART_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef(AppState.currentState);

  // Load cart and check expiry on mount
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [data, storedTimestamp] = await Promise.all([
          AsyncStorage.getItem(CART_KEY),
          AsyncStorage.getItem(CART_TIMESTAMP_KEY),
        ]);
        if (!mounted || !data) return;
        const parsed = parseStoredCart(data);
        const timestamp = parseCartActivityTimestamp(storedTimestamp);
        if (parsed.length === 0) {
          await Promise.all([
            AsyncStorage.removeItem(CART_KEY),
            AsyncStorage.removeItem(CART_TIMESTAMP_KEY),
          ]);
          return;
        }
        if (timestamp) {
          const elapsed = Date.now() - timestamp;
          if (elapsed >= CART_EXPIRY_MS) {
            persist([]);
            Alert.alert(
              "Panier expiré",
              "Votre panier a été vidé car il est resté inactif trop longtemps.",
              [{ text: "OK" }],
            );
            return;
          }
          startTimer(CART_EXPIRY_MS - Math.max(0, elapsed));
        } else {
          resetTimer();
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
  }, []);

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
      // App going to background - record timestamp
      void AsyncStorage.setItem(CART_TIMESTAMP_KEY, String(Date.now())).catch(
        () => undefined,
      );
    } else if (nextState === "active") {
      // App coming back - check if cart expired
      void checkExpiry();
    }
    appState.current = nextState;
  };

  const checkExpiry = async () => {
    try {
      const [storedTimestamp, data] = await Promise.all([
        AsyncStorage.getItem(CART_TIMESTAMP_KEY),
        AsyncStorage.getItem(CART_KEY),
      ]);
      const timestamp = parseCartActivityTimestamp(storedTimestamp);
      const parsed = parseStoredCart(data);
      if (timestamp && parsed.length > 0) {
        const elapsed = Date.now() - timestamp;
        if (elapsed >= CART_EXPIRY_MS) {
          persist([]);
          Alert.alert(
            "Panier expiré",
            "Votre panier a été vidé car il est resté inactif trop longtemps.",
            [{ text: "OK" }],
          );
        } else {
          startTimer(CART_EXPIRY_MS - Math.max(0, elapsed));
        }
      } else if (data && parsed.length === 0) {
        persist([]);
      }
    } catch {
      // Keep the in-memory cart available if device storage is temporarily unavailable.
    }
  };

  const startTimer = (ms: number = CART_EXPIRY_MS) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setItems((prev) => {
        if (prev.length > 0) {
          void AsyncStorage.setItem(CART_KEY, JSON.stringify([])).catch(
            () => undefined,
          );
          void AsyncStorage.removeItem(CART_TIMESTAMP_KEY).catch(
            () => undefined,
          );
          Alert.alert(
            "Panier expiré",
            "Votre panier a été vidé automatiquement après 15 minutes d'inactivité.",
            [{ text: "OK" }],
          );
          return [];
        }
        return prev;
      });
    }, ms);
  };

  const resetTimer = () => {
    void AsyncStorage.setItem(CART_TIMESTAMP_KEY, String(Date.now())).catch(
      () => undefined,
    );
    startTimer();
  };

  const persist = (newItems: CartItem[]) => {
    setItems(newItems);
    void AsyncStorage.setItem(CART_KEY, JSON.stringify(newItems)).catch(
      () => undefined,
    );
    if (newItems.length > 0) {
      resetTimer();
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      void AsyncStorage.removeItem(CART_TIMESTAMP_KEY).catch(() => undefined);
    }
  };

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
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
        void AsyncStorage.setItem(
          CART_TIMESTAMP_KEY,
          String(Date.now()),
        ).catch(() => undefined);
        startTimer();
        return next;
      });
    },
    [],
  );

  const removeItem = useCallback((productId: number, seatLabel?: string) => {
    setItems((prev) => {
      const next = prev.filter(
        (i) => !(i.productId === productId && i.seatLabel === seatLabel),
      );
      void AsyncStorage.setItem(CART_KEY, JSON.stringify(next)).catch(
        () => undefined,
      );
      if (next.length > 0) {
        resetTimer();
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
        void AsyncStorage.removeItem(CART_TIMESTAMP_KEY).catch(() => undefined);
      }
      return next;
    });
  }, []);

  const updateQuantity = useCallback(
    (productId: number, quantity: number, seatLabel?: string) => {
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
          resetTimer();
        } else {
          if (timerRef.current) clearTimeout(timerRef.current);
          void AsyncStorage.removeItem(CART_TIMESTAMP_KEY).catch(
            () => undefined,
          );
        }
        return next;
      });
    },
    [],
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
