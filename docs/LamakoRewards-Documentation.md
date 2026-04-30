# LamakoRewards - Documentation Technique Complète

**Version :** 3.0.0  
**Dernière mise à jour :** 30 avril 2026  
**Auteur :** Lamako Events

---

## 1. Vue d'ensemble

LamakoRewards est le programme de fidélisation de TicketByLamako. Il récompense les clients pour leurs achats de billets et produits, leur engagement (connexions, avis, partages) et leur activité de parrainage. Le programme est disponible sur l'application mobile et le site web.

### Architecture globale

Le système repose sur trois composants principaux interconnectés :

| Composant | Technologie | Rôle |
|-----------|-------------|------|
| **Plugin WordPress** | PHP (lamako-rewards-api.php) | API REST, logique métier, gestion myCred, shortcodes |
| **Application mobile** | React Native (rewards-provider.tsx) | Interface utilisateur, synchronisation, cache local |
| **myCred** | Plugin WordPress tiers | Stockage des points, historique des transactions |

```
┌─────────────────┐     REST API      ┌──────────────────────┐
│  App Mobile     │ ◄──────────────► │  WordPress Server     │
│  (Expo/RN)      │                   │  ┌─────────────────┐ │
│                 │                   │  │ lamako-rewards   │ │
│  rewards-       │                   │  │ -api.php         │ │
│  provider.tsx   │                   │  └────────┬────────┘ │
└─────────────────┘                   │           │          │
                                      │  ┌────────▼────────┐ │
┌─────────────────┐     Shortcodes    │  │    myCred        │ │
│  Site Web       │ ◄──────────────► │  │  (points DB)     │ │
│  (WordPress)    │                   │  └─────────────────┘ │
└─────────────────┘                   └──────────────────────┘
```

---

## 2. Système de Tiers (Niveaux)

Les tiers sont basés sur les **points lifetime** (total cumulé depuis l'inscription). Le design s'inspire des benchmarks de Sephora Beauty Insider, Starbucks Rewards et Fnac+ avec des seuils adaptés au marché malgache (ticket moyen : 50 000 Ar = 50 pts par événement).

### Tableau des tiers

| Tier | Seuil (pts lifetime) | Équivalent achats | Icône | Couleur | Avantages principaux |
|------|---------------------|-------------------|-------|---------|---------------------|
| **Fan** | 0 | Inscription | 🎵 | #8B6914 | 1pt/1000Ar, code parrainage, historique |
| **VIP** | 150 | 2-3 événements | ⭐ | #C0C0C0 | +5% réduction, x1.5 multiplicateur, préventes |
| **Super VIP** | 750 | 5-8 événements | 🌟 | #FFD700 | +10% réduction, x2 multiplicateur, accès VIP, loterie places gratuites |
| **Elite** | 3 000 | 20+ événements | 💎 | #E5E4E2 | +15% réduction, x3 multiplicateur, backstage, 1 billet gratuit/trimestre, meet & greet |

### Justification des seuils

Le seuil Fan → VIP (150 pts) est atteignable en 2-3 événements, ce qui encourage la rétention rapide. Le seuil Elite (3 000 pts) représente un engagement significatif (20+ événements ou 3 000 000 Ar dépensés), créant un sentiment d'exclusivité réel. Le ratio est inspiré de Sephora (3 tiers accessibles + 1 tier aspirationnel).

---

## 3. Accumulation de Points

### Règles de gain

| Action | Points gagnés | Constante PHP | Fréquence |
|--------|--------------|---------------|-----------|
| Achat (billets/produits) | 1 pt / 1 000 Ar | `LR_POINTS_PER_1000AR` | Par transaction |
| Inscription | +50 pts | `LR_REGISTRATION_BONUS` | Une fois |
| Connexion quotidienne | +5 pts | `LR_LOGIN_BONUS` | 1x/jour |
| Assister à un événement | +10 pts | `LR_ATTENDANCE_BONUS` | Par événement |
| Laisser un avis | +15 pts | `LR_REVIEW_BONUS` | Par avis |
| Parrainage (1er achat du filleul) | +100 pts | `LR_REFERRAL_BONUS` | Par filleul |
| Être parrainé | +25 pts | `LR_REFEREE_BONUS` | Une fois |
| Anniversaire | +50 pts | `LR_BIRTHDAY_BONUS` | 1x/an |
| Partage social | +5 pts | `LR_SHARE_BONUS` | Par partage |

### Multiplicateurs par tier

| Tier | Multiplicateur | Exemple (billet 100 000 Ar) |
|------|---------------|---------------------------|
| Fan | x1 | 100 pts |
| VIP | x1.5 | 150 pts |
| Super VIP | x2 | 200 pts |
| Elite | x3 | 300 pts |

---

## 4. Échange de Points (Redemption)

Le système utilise des paliers progressifs avec un taux qui s'améliore à mesure que l'utilisateur échange plus de points d'un coup, encourageant l'accumulation.

| Points échangés | Valeur de réduction | Taux effectif |
|-----------------|--------------------:|---------------|
| 50 pts | 5 000 Ar | 100 Ar/pt |
| 100 pts | 12 000 Ar | 120 Ar/pt |
| 200 pts | 30 000 Ar | 150 Ar/pt |
| 500 pts | 80 000 Ar | 160 Ar/pt |
| 1 000 pts | 180 000 Ar | 180 Ar/pt |

> **Note :** L'échange de points génère un coupon WooCommerce à usage unique, applicable sur la prochaine commande.

---

## 5. Système de Parrainage (Implémenté côté serveur)

### Fonctionnement complet

Le parrainage est **entièrement géré côté serveur** (WordPress). Voici le flux :

1. **Génération du code** : Chaque utilisateur reçoit un code unique au format `TBL-{4 premiers chars user_id}{4 chars aléatoires}` (ex: `TBL-12ABXYZ9`). Le code est stocké dans `user_meta` WordPress (`_lamako_referral_code`).

2. **Validation** : Quand un nouveau utilisateur entre un code parrain lors de l'inscription, l'API valide que le code existe et retourne le nom du parrain.

3. **Enregistrement** : Après inscription, l'app enregistre la relation parrain-filleul via l'endpoint `POST /referral/register`. Le filleul reçoit immédiatement 25 pts bonus.

4. **Crédit du parrain** : Un hook myCred (`woocommerce_order_status_completed`) détecte le premier achat du filleul et crédite 100 pts au parrain.

### Endpoints API du parrainage

| Endpoint | Méthode | Paramètres | Réponse |
|----------|---------|------------|---------|
| `/referral/validate` | POST | `code`, `api_key` | `{ valid: bool, referrer_name: string, bonus: int }` |
| `/referral/register` | POST | `referee_user_id`, `referrer_code`, `api_key` | `{ success: bool, referee_bonus: int }` |
| `/referral/code` | GET | `user_id`, `api_key` | `{ code: string, referral_count: int }` |

### Champ "Code parrain" à l'inscription

L'application mobile affiche un champ optionnel "Code parrain" sur l'écran d'inscription. La validation est en temps réel (après 8 caractères saisis). Le code est envoyé au serveur après la création du compte.

**Fichier source :** `app/(auth)/register.tsx`

---

## 6. Sécurité de l'API

### Authentification

L'API supporte deux modes d'authentification :

1. **JWT Token** (recommandé) : Le token JWT de l'utilisateur connecté est envoyé dans le header `Authorization: Bearer {token}`. Le plugin valide le token via le plugin `jwt-auth`.

2. **Clé API** (legacy/fallback) : Paramètre `api_key` dans la requête. Utilisé pour les appels non-authentifiés (validation de code parrain).

### Variable d'environnement

La clé API est configurée via :
- **WordPress** : Constante `LAMAKO_REWARDS_API_KEY` dans `wp-config.php`
- **App mobile** : Variable `EXPO_PUBLIC_REWARDS_API_KEY` (ou fallback dans `app.config.ts` → `extra.rewardsApiKey`)

```php
// wp-config.php
define( 'LAMAKO_REWARDS_API_KEY', 'votre_cle_secrete_ici' );
```

### Rate Limiting

Le plugin implémente un rate limiting par IP :
- **Limite** : 60 requêtes par minute (configurable via `LR_RATE_LIMIT`)
- **Fenêtre** : 60 secondes (configurable via `LR_RATE_WINDOW`)
- **Stockage** : WordPress transients
- **Réponse en cas de dépassement** : HTTP 429 avec header `Retry-After`

---

## 7. Plugin WordPress - Installation et Configuration

### Fichiers

```
scripts/lamako-rewards-api/
└── lamako-rewards-api.php    ← Plugin principal (à uploader dans wp-content/plugins/)
```

### Prérequis

1. **myCred** : Plugin WordPress de gestion de points (gratuit). Doit être installé et activé.
2. **JWT Authentication** : Pour la validation des tokens mobiles.

### Installation

1. Uploader le dossier `lamako-rewards-api` dans `/wp-content/plugins/`
2. Activer le plugin dans WordPress Admin > Extensions
3. Ajouter dans `wp-config.php` :
   ```php
   define( 'LAMAKO_REWARDS_API_KEY', 'votre_cle_secrete_ici' );
   ```
4. Aller dans Réglages > Permaliens et cliquer "Enregistrer" (flush rewrite rules)
5. Créer une page WordPress avec le shortcode `[lamako_rewards_page]` et l'URL `/lamako-rewards`

### Shortcodes disponibles

| Shortcode | Usage | Où l'utiliser |
|-----------|-------|---------------|
| `[lamako_rewards_page]` | Page complète du programme (tiers, gains, échange, parrainage) | Page dédiée `/lamako-rewards` |
| `[lamako_rewards_cta]` | Bannière CTA compacte | Pages produits, articles de blog |
| `[lamako_rewards_checkout_popup]` | Popup incitant à s'inscrire | Auto-inséré au checkout (guests) |

### Hooks automatiques (pas besoin de shortcode)

| Hook | Action | Cible |
|------|--------|-------|
| `woocommerce_before_add_to_cart_form` | Affiche "Gagnez X points sur cet achat" | Pages produits |
| `woocommerce_before_checkout_form` | Popup d'inscription pour les invités | Page checkout |
| `woocommerce_account_menu_items` | Ajoute onglet "Mes Récompenses" | Mon Compte |
| `woocommerce_order_status_completed` | Crédite le parrain si 1er achat du filleul | Commandes |

---

## 8. Application Mobile - Architecture

### Fichiers principaux

| Fichier | Rôle |
|---------|------|
| `lib/rewards-provider.tsx` | Provider React Context, API calls, tier logic, referral functions |
| `app/rewards.tsx` | Écran principal LamakoRewards (tiers, historique, échange) |
| `app/(tabs)/profile.tsx` | Carte résumé LamakoRewards dans le profil |
| `app/(auth)/register.tsx` | Champ "Code parrain" à l'inscription |
| `components/rewards-popup.tsx` | Popup d'invitation (30s après lancement) |

### Provider (rewards-provider.tsx)

Le `RewardsProvider` encapsule toute la logique :
- **Cache local** : AsyncStorage pour fonctionnement offline
- **Sync automatique** : À chaque connexion, synchronise avec le serveur
- **Tier calculation** : Calcul local du tier basé sur les points lifetime
- **Referral functions** : `validateReferralCode()`, `registerReferral()`, `fetchReferralCode()` exportées

### Popup LamakoRewards (rewards-popup.tsx)

- **Déclenchement** : 30 secondes après le montage du composant
- **Condition** : Affiché 1 seule fois par session (flag en mémoire, reset à chaque lancement)
- **Cible** : Tous les utilisateurs (connectés ou non)
- **Action** : Bouton "Découvrir" → navigation vers `/rewards`
- **Background** : Image concert (`assets/images/rewards-bg.jpg`)

---

## 9. Site Web - Surfaces d'affichage

### Page dédiée LamakoRewards

**URL :** `https://www.ticketbylamako.com/lamako-rewards`  
**Contenu :** Shortcode `[lamako_rewards_page]`  
**Sections :**
- Hero avec CTA d'inscription
- 4 cartes de tiers avec avantages détaillés
- Grille "Comment gagner des points"
- Tableau d'échange de points
- Section parrainage avec code personnel
- Profil utilisateur (si connecté) avec solde et progression
- CTA téléchargement app

### CTA sur pages produits

Automatiquement inséré avant le bouton "Ajouter au panier" sur chaque produit WooCommerce. Affiche le nombre de points que l'achat rapportera. Inclut un lien d'inscription pour les visiteurs non-connectés.

### Popup au checkout

Affiché 3 secondes après le chargement de la page checkout pour les visiteurs non-connectés. Propose de s'inscrire pour gagner 50 pts bonus + des points sur l'achat en cours.

### Onglet Mon Compte

Accessible via Mon Compte > Mes Récompenses. Affiche :
- Solde de points disponibles
- Niveau actuel
- Barre de progression vers le prochain tier
- Code de parrainage personnel
- Nombre de filleuls

---

## 10. Modifier le Programme

### Changer les seuils de tiers

**Fichier PHP :** `lamako-rewards-api.php` lignes 36-39
```php
define( 'LR_TIER_FAN', 0 );
define( 'LR_TIER_VIP', 150 );      // ← modifier ici
define( 'LR_TIER_SUPERVIP', 750 );  // ← modifier ici
define( 'LR_TIER_ELITE', 3000 );    // ← modifier ici
```

**Fichier App :** `lib/rewards-provider.tsx` → constante `TIERS` et fonction `getTierForPoints()`
```typescript
export const TIERS: TierInfo[] = [
  { id: "fan", name: "Fan", minPoints: 0, ... },
  { id: "vip", name: "VIP", minPoints: 150, ... },      // ← modifier ici
  { id: "supervip", name: "Super VIP", minPoints: 750, ... }, // ← modifier ici
  { id: "elite", name: "Elite", minPoints: 3000, ... },  // ← modifier ici
];
```

> **Important :** Les deux fichiers doivent être synchronisés. Modifier l'un sans l'autre causera des incohérences.

### Changer les bonus de points

**Fichier PHP :** `lamako-rewards-api.php` lignes 42-50
```php
define( 'LR_POINTS_PER_1000AR', 1 );
define( 'LR_REGISTRATION_BONUS', 50 );
define( 'LR_LOGIN_BONUS', 5 );
define( 'LR_ATTENDANCE_BONUS', 10 );
define( 'LR_REVIEW_BONUS', 15 );
define( 'LR_REFERRAL_BONUS', 100 );
define( 'LR_REFEREE_BONUS', 25 );
define( 'LR_BIRTHDAY_BONUS', 50 );
define( 'LR_SHARE_BONUS', 5 );
```

### Changer les paliers d'échange

**Fichier PHP :** Fonction `lr_get_redemption_value()` 
**Fichier App :** `lib/rewards-provider.tsx` → constante `REDEMPTION_TIERS`

```typescript
const REDEMPTION_TIERS = [
  { points: 50, value: 5000 },
  { points: 100, value: 12000 },
  { points: 200, value: 30000 },
  { points: 500, value: 80000 },
  { points: 1000, value: 180000 },
];
```

### Ajouter un nouveau tier

1. Ajouter la constante PHP : `define( 'LR_TIER_NOUVEAU', seuil );`
2. Mettre à jour `lr_get_tier()`, `lr_get_tier_name()`, `lr_get_next_tier()` dans le PHP
3. Ajouter l'entrée dans `TIERS` array dans `rewards-provider.tsx`
4. Mettre à jour `getTierForPoints()` dans le TypeScript
5. Mettre à jour le shortcode `[lamako_rewards_page]` pour afficher la nouvelle carte

### Désactiver le popup

**Fichier App :** `components/rewards-popup.tsx` → changer le timer ou retourner `null` directement
**Ou** dans `app/_layout.tsx` → commenter `<RewardsPopup />`

### Modifier le délai du popup checkout (web)

**Fichier PHP :** Dans `lr_shortcode_checkout_popup()`, modifier le `setTimeout` :
```javascript
setTimeout(function() { ... }, 3000); // ← 3000ms = 3 secondes
```

---

## 11. Endpoints API - Référence Complète

### Base URL
```
https://www.ticketbylamako.com/wp-json/lamako-rewards/v1
```

### Authentification
- Header : `Authorization: Bearer {jwt_token}`
- Ou paramètre : `?api_key={clé}`

### Endpoints

| Méthode | Endpoint | Description | Paramètres |
|---------|----------|-------------|------------|
| GET | `/balance` | Solde et tier d'un utilisateur | `user_id` |
| GET | `/history` | Historique des transactions | `user_id`, `limit` (défaut: 20) |
| GET | `/user-by-email` | Trouver un user par email | `email` |
| POST | `/redeem` | Échanger des points | `user_id`, `points`, `tier` (palier) |
| POST | `/referral/validate` | Valider un code parrain | `code` |
| POST | `/referral/register` | Enregistrer un parrainage | `referee_user_id`, `referrer_code` |
| GET | `/referral/code` | Obtenir le code d'un user | `user_id` |

### Exemples de réponses

**GET /balance?user_id=123**
```json
{
  "balance": 245,
  "total_earned": 890,
  "tier": "vip",
  "tier_name": "VIP",
  "next_tier": "Super VIP",
  "points_to_next_tier": 610,
  "multiplier": 1.5
}
```

**POST /referral/validate**
```json
{
  "valid": true,
  "referrer_name": "Jean Rakoto",
  "bonus": 25
}
```

**POST /redeem**
```json
{
  "success": true,
  "coupon_code": "LR-ABC123XY",
  "discount_value": 12000,
  "points_deducted": 100,
  "new_balance": 145
}
```

---

## 12. Checklist de Déploiement

- [ ] Installer et activer myCred sur WordPress
- [ ] Uploader `lamako-rewards-api.php` dans `/wp-content/plugins/lamako-rewards-api/`
- [ ] Activer le plugin dans WordPress Admin
- [ ] Ajouter `LAMAKO_REWARDS_API_KEY` dans `wp-config.php`
- [ ] Créer la page `/lamako-rewards` avec shortcode `[lamako_rewards_page]`
- [ ] Flush les permaliens (Réglages > Permaliens > Enregistrer)
- [ ] Configurer `EXPO_PUBLIC_REWARDS_API_KEY` dans l'app mobile
- [ ] Tester l'inscription avec code parrain
- [ ] Vérifier que les points s'accumulent après un achat
- [ ] Vérifier l'onglet "Mes Récompenses" dans Mon Compte
- [ ] Vérifier le popup checkout pour les invités
- [ ] Vérifier les CTA sur les pages produits

---

## 13. FAQ Technique

**Q : Les points sont-ils synchronisés en temps réel ?**  
R : L'app synchronise à chaque ouverture et après chaque action. Le site web lit directement depuis myCred.

**Q : Que se passe-t-il si myCred est désactivé ?**  
R : L'API retournera des soldes à 0. Les fonctions de parrainage continueront de fonctionner (stockées en user_meta).

**Q : Comment créditer manuellement des points ?**  
R : Via l'admin myCred (Utilisateurs > Points) ou via l'API avec une clé admin.

**Q : Les points expirent-ils ?**  
R : Non, par défaut. Pour ajouter une expiration, configurer dans myCred > Paramètres > Expiration.

**Q : Comment voir les stats du programme ?**  
R : myCred fournit un tableau de bord avec les statistiques globales. Pour des rapports custom, utiliser les tables `mycred_log` en base de données.

**Q : Le parrainage fonctionne-t-il sur le site web aussi ?**  
R : Oui. La page LamakoRewards affiche le code de parrainage pour les utilisateurs connectés. Le champ "Code parrain" est disponible lors de l'inscription WordPress standard.

**Q : Comment tester le rate limiting ?**  
R : Envoyer plus de 60 requêtes en 1 minute depuis la même IP. La 61ème retournera HTTP 429.

---

## 14. Résumé des Constantes

```
// API
Base URL: https://www.ticketbylamako.com/wp-json/lamako-rewards/v1
Clé API: Définie dans wp-config.php (LAMAKO_REWARDS_API_KEY)

// Tiers (points lifetime requis)
Fan: 0 | VIP: 150 | Super VIP: 750 | Elite: 3000

// Multiplicateurs
Fan: x1 | VIP: x1.5 | Super VIP: x2 | Elite: x3

// Conversion (paliers progressifs)
50 pts = 5000 Ar | 100 pts = 12000 Ar | 200 pts = 30000 Ar
500 pts = 80000 Ar | 1000 pts = 180000 Ar

// Accumulation
1 pt / 1000 Ar dépensés
Inscription: +50 | Connexion: +5/jour | Parrainage: +100
Filleul: +25 | Événement: +10 | Avis: +15 | Anniversaire: +50

// Rate Limiting
60 requêtes / minute / IP

// Popup App
Délai: 30 secondes | Fréquence: 1x par session

// Popup Checkout Web
Délai: 3 secondes | Cible: invités non-connectés
```
