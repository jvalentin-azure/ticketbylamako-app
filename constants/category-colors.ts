/**
 * Category colors matching the website (ticketbylamako.com)
 * Each category ID maps to its background color used on the web.
 * Parent categories (parent: 0) are used for filter chips.
 */

export interface CategoryColorConfig {
  id: number;
  color: string; // hex background color
  emoji: string; // emoji prefix from category name
  label: string; // clean label without emoji
}

// Parent categories with their website colors
export const PARENT_CATEGORY_COLORS: CategoryColorConfig[] = [
  { id: 46, color: "#FF9800", emoji: "🎶", label: "Musique & Divertissement" },
  { id: 65, color: "#2196F3", emoji: "🎤", label: "Conférences & Pro" },
  { id: 75, color: "#9C27B0", emoji: "🌍", label: "Culture & Communauté" },
  { id: 83, color: "#4CAF50", emoji: "🏆", label: "Sport & Loisirs" },
  { id: 90, color: "#F44336", emoji: "🏢", label: "Foires, Salons & Ventes" },
];

// All category colors by ID (includes sub-categories)
export const CATEGORY_COLOR_MAP: Record<number, string> = {
  // Parent categories
  46: "#FF9800", // Musique & Divertissement
  65: "#2196F3", // Conférences & Pro
  75: "#9C27B0", // Culture & Communauté
  83: "#4CAF50", // Sport & Loisirs
  90: "#F44336", // Foires, Salons & Ventes

  // Sub-categories of Musique & Divertissement (46)
  48: "#FF9800", // Concerts
  50: "#009688", // Artistes Locaux
  51: "#3F51B5", // Artistes Internationaux
  54: "#8BC34A", // Festivals
  55: "#FF5722", // Spectacles

  // Sub-sub-categories of Spectacles (55)
  58: "#E91E63", // Danse
  60: "#FFC107", // Humour
  61: "#9C27B0", // Magie & Illusion
  64: "#E91E63", // Comédie Musicale

  // Sub-categories of Conférences & Pro (65)
  68: "#2196F3", // Conférences
  69: "#0D47A1", // Séminaires
  72: "#2196F3", // Workshops / Formations
  74: "#795548", // Corporate Events
  120: "#00BCD4", // Conférences En Ligne
  121: "#00BCD4", // Conference & Formation

  // Sub-categories of Culture & Communauté (75)
  78: "#FF9800", // Expositions
  79: "#673AB7", // Événements culturels
  82: "#9C27B0", // Caritatif & Associatif

  // Sub-categories of Sport & Loisirs (83)
  86: "#F44336", // Tournois & Compétitions
  87: "#4CAF50", // Expériences Outdoor

  // Sub-categories of Foires, Salons & Ventes (90)
  91: "#F44336", // Foires & Salons
  92: "#9C27B0", // Ventes Privées
  93: "#795548", // Espaces Exposants
  104: "#FF9800", // Grand Public
  105: "#3F51B5", // Professionnels
  106: "#FF5722", // Mode & Beauté
  107: "#E91E63", // Maison & Décoration
  108: "#607D8B", // Réservation de Stand
  109: "#00BCD4", // Services Techniques
  110: "#607D8B", // Accréditations & Badges
};

/**
 * Get the color for a category by its ID.
 * Falls back to a default neutral color if not found.
 */
export function getCategoryColor(categoryId: number): string {
  return CATEGORY_COLOR_MAP[categoryId] || "#607D8B";
}

/**
 * Get the parent category color for a given category ID.
 * Useful for chips that should use the parent's color.
 */
export function getParentCategoryColor(categoryId: number, parentId: number): string {
  // If this IS a parent category, return its own color
  if (CATEGORY_COLOR_MAP[categoryId] && parentId === 0) {
    return CATEGORY_COLOR_MAP[categoryId];
  }
  // Otherwise return the parent's color
  return CATEGORY_COLOR_MAP[parentId] || CATEGORY_COLOR_MAP[categoryId] || "#607D8B";
}
