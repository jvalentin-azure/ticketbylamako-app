/**
 * Global filter state for cross-tab category filtering.
 * Used when home page filter chips need to navigate to events tab with a pre-selected category.
 * This avoids Expo Router's limitation where tab navigation doesn't reliably pass params.
 */

type FilterListener = (category: string | null) => void;

let pendingCategory: string | null = null;
const listeners: Set<FilterListener> = new Set();

export function setPendingCategory(category: string | null) {
  pendingCategory = category;
  // Notify all listeners
  listeners.forEach(fn => fn(category));
}

export function consumePendingCategory(): string | null {
  const cat = pendingCategory;
  pendingCategory = null;
  return cat;
}

export function subscribeToPendingCategory(fn: FilterListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
