import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "tbl_favorites";

export interface FavoriteItem {
  id: number;
  type: "event" | "product";
  name: string;
  image?: string;
  addedAt: string;
}

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
    AsyncStorage.getItem(STORAGE_KEY).then(data => {
      if (data) {
        try {
          setFavorites(JSON.parse(data));
        } catch {
          // Invalid data, reset
          setFavorites([]);
        }
      }
    });
  }, []);

  // Persist to AsyncStorage whenever favorites change
  const persist = useCallback((items: FavoriteItem[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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

  const favoriteEvents = favorites.filter(f => f.type === "event");
  const favoriteProducts = favorites.filter(f => f.type === "product");

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
