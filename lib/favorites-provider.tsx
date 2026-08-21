import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  normalizeStoredFavorites,
  parseStoredFavorites,
  type FavoriteItem,
} from "./favorite-store";

const STORAGE_KEY = "tbl_favorites";

export type { FavoriteItem } from "./favorite-store";

interface FavoritesContextType {
  favorites: FavoriteItem[];
  isFavorite: (id: number, type: "event" | "product") => boolean;
  toggleFavorite: (item: Omit<FavoriteItem, "addedAt">) => void;
  removeFavorite: (id: number, type: "event" | "product") => void;
  favoriteEvents: FavoriteItem[];
  favoriteProducts: FavoriteItem[];
  eventCount: number;
  productCount: number;
  totalCount: number;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: [],
  isFavorite: () => false,
  toggleFavorite: () => {},
  removeFavorite: () => {},
  favoriteEvents: [],
  favoriteProducts: [],
  eventCount: 0,
  productCount: 0,
  totalCount: 0,
});

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  // Load from AsyncStorage on mount
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((data) => {
        if (!mounted || !data) return;
        const stored = parseStoredFavorites(data);
        if (stored.length === 0) {
          void AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
          return;
        }
        setFavorites((current) => normalizeStoredFavorites([...current, ...stored]));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  // Persist to AsyncStorage whenever favorites change
  const persist = useCallback((items: FavoriteItem[]) => {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(
      () => undefined,
    );
  }, []);

  const isFavorite = useCallback((id: number, type: "event" | "product") => {
    return favorites.some(f => f.id === id && f.type === type);
  }, [favorites]);

  const toggleFavorite = useCallback((item: Omit<FavoriteItem, "addedAt">) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.id === item.id && f.type === item.type);
      let next: FavoriteItem[];
      if (exists) {
        next = prev.filter(f => !(f.id === item.id && f.type === item.type));
      } else {
        next = [...prev, { ...item, addedAt: new Date().toISOString() }];
      }
      persist(next);
      return next;
    });
  }, [persist]);

  const removeFavorite = useCallback((id: number, type: "event" | "product") => {
    setFavorites(prev => {
      const next = prev.filter(f => !(f.id === id && f.type === type));
      persist(next);
      return next;
    });
  }, [persist]);

  const favoriteEvents = useMemo(
    () => favorites.filter((favorite) => favorite.type === "event"),
    [favorites],
  );
  const favoriteProducts = useMemo(
    () => favorites.filter((favorite) => favorite.type === "product"),
    [favorites],
  );

  return (
    <FavoritesContext.Provider value={{
      favorites,
      isFavorite,
      toggleFavorite,
      removeFavorite,
      favoriteEvents,
      favoriteProducts,
      eventCount: favoriteEvents.length,
      productCount: favoriteProducts.length,
      totalCount: favorites.length,
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
