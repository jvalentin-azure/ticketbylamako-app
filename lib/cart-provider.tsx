import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { Alert, AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
  isEvent: boolean;
  ticketType?: string;
  seatLabel?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (productId: number, seatLabel?: string) => void;
  updateQuantity: (productId: number, quantity: number, seatLabel?: string) => void;
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
    (async () => {
      const data = await AsyncStorage.getItem(CART_KEY);
      const timestamp = await AsyncStorage.getItem(CART_TIMESTAMP_KEY);
      if (data) {
        const parsed = JSON.parse(data) as CartItem[];
        if (parsed.length > 0 && timestamp) {
          const elapsed = Date.now() - parseInt(timestamp, 10);
          if (elapsed >= CART_EXPIRY_MS) {
            // Cart expired while app was closed
            persist([]);
            Alert.alert(
              "Panier expiré",
              "Votre panier a été vidé car il est resté inactif trop longtemps.",
              [{ text: "OK" }]
            );
            return;
          }
        }
        setItems(parsed);
        if (parsed.length > 0) startTimer();
      }
    })();
  }, []);

  // Listen for app going to background/foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, []);

  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (appState.current.match(/active/) && nextState.match(/inactive|background/)) {
      // App going to background - record timestamp
      AsyncStorage.setItem(CART_TIMESTAMP_KEY, String(Date.now()));
    } else if (nextState === "active") {
      // App coming back - check if cart expired
      checkExpiry();
    }
    appState.current = nextState;
  };

  const checkExpiry = async () => {
    const timestamp = await AsyncStorage.getItem(CART_TIMESTAMP_KEY);
    const data = await AsyncStorage.getItem(CART_KEY);
    if (timestamp && data) {
      const parsed = JSON.parse(data) as CartItem[];
      if (parsed.length > 0) {
        const elapsed = Date.now() - parseInt(timestamp, 10);
        if (elapsed >= CART_EXPIRY_MS) {
          persist([]);
          Alert.alert(
            "Panier expiré",
            "Votre panier a été vidé car il est resté inactif trop longtemps.",
            [{ text: "OK" }]
          );
        } else {
          startTimer(CART_EXPIRY_MS - elapsed);
        }
      }
    }
  };

  const startTimer = (ms: number = CART_EXPIRY_MS) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setItems(prev => {
        if (prev.length > 0) {
          AsyncStorage.setItem(CART_KEY, JSON.stringify([]));
          AsyncStorage.removeItem(CART_TIMESTAMP_KEY);
          Alert.alert(
            "Panier expiré",
            "Votre panier a été vidé automatiquement après 15 minutes d'inactivité.",
            [{ text: "OK" }]
          );
          return [];
        }
        return prev;
      });
    }, ms);
  };

  const resetTimer = () => {
    AsyncStorage.setItem(CART_TIMESTAMP_KEY, String(Date.now()));
    startTimer();
  };

  const persist = (newItems: CartItem[]) => {
    setItems(newItems);
    AsyncStorage.setItem(CART_KEY, JSON.stringify(newItems));
    if (newItems.length > 0) {
      resetTimer();
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      AsyncStorage.removeItem(CART_TIMESTAMP_KEY);
    }
  };

  const addItem = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
    setItems(prev => {
      const key = item.seatLabel ? `${item.productId}-${item.seatLabel}` : String(item.productId);
      const existing = prev.find(i => {
        const iKey = i.seatLabel ? `${i.productId}-${i.seatLabel}` : String(i.productId);
        return iKey === key;
      });

      let next: CartItem[];
      if (existing && !item.seatLabel) {
        next = prev.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity + (item.quantity || 1) } : i);
      } else {
        next = [...prev, { ...item, quantity: item.quantity || 1 }];
      }
      AsyncStorage.setItem(CART_KEY, JSON.stringify(next));
      AsyncStorage.setItem(CART_TIMESTAMP_KEY, String(Date.now()));
      startTimer();
      return next;
    });
  }, []);

  const removeItem = useCallback((productId: number, seatLabel?: string) => {
    setItems(prev => {
      const next = prev.filter(i => !(i.productId === productId && i.seatLabel === seatLabel));
      AsyncStorage.setItem(CART_KEY, JSON.stringify(next));
      if (next.length > 0) {
        resetTimer();
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
        AsyncStorage.removeItem(CART_TIMESTAMP_KEY);
      }
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number, seatLabel?: string) => {
    setItems(prev => {
      const next = quantity <= 0
        ? prev.filter(i => !(i.productId === productId && i.seatLabel === seatLabel))
        : prev.map(i => (i.productId === productId && i.seatLabel === seatLabel) ? { ...i, quantity } : i);
      AsyncStorage.setItem(CART_KEY, JSON.stringify(next));
      if (next.length > 0) {
        resetTimer();
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
        AsyncStorage.removeItem(CART_TIMESTAMP_KEY);
      }
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    persist([]);
  }, []);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
