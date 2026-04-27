import React, { createContext, useContext, useState, useCallback } from "react";
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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  React.useEffect(() => {
    AsyncStorage.getItem(CART_KEY).then(data => {
      if (data) setItems(JSON.parse(data));
    });
  }, []);

  const persist = (newItems: CartItem[]) => {
    setItems(newItems);
    AsyncStorage.setItem(CART_KEY, JSON.stringify(newItems));
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
      return next;
    });
  }, []);

  const removeItem = useCallback((productId: number, seatLabel?: string) => {
    setItems(prev => {
      const next = prev.filter(i => !(i.productId === productId && i.seatLabel === seatLabel));
      AsyncStorage.setItem(CART_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number, seatLabel?: string) => {
    setItems(prev => {
      const next = quantity <= 0
        ? prev.filter(i => !(i.productId === productId && i.seatLabel === seatLabel))
        : prev.map(i => (i.productId === productId && i.seatLabel === seatLabel) ? { ...i, quantity } : i);
      AsyncStorage.setItem(CART_KEY, JSON.stringify(next));
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
