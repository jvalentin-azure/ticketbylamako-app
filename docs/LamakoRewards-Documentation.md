# LamakoRewards - Documentation Technique Complète

**Version :** 3.1.0  
**Dernière mise à jour :** 30 avril 2026  
**Modèle :** Conservatif (basé sur Otayo, Live Nation, Ticketmaster, AMC Stubs)

---

## 1. Vue d'ensemble

LamakoRewards est le programme de fidélisation de TicketByLamako. Il récompense les clients pour leurs achats de billets et produits, avec un modèle conservatif qui privilégie les **avantages expérientiels** (early access, backstage, upgrades) plutôt que les remises directes.

**Philosophie :** Les récompenses les plus attractives (préventes, upgrades, backstage) ne coûtent rien à l'entreprise. Le cashback réel est limité à **2%** (standard industrie).

### Architecture globale

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

## 2. Système de Tiers (5 Niveaux)

Basé sur les benchmarks **Otayo** (5 tiers, même marché insulaire), **Live Nation** (expérientiel), **AMC Stubs** (2% cashback), **Ticketmaster/Audience Rewards** (tier VIP unique élevé).

### Tableau des tiers

| Tier | Seuil (pts lifetime) | Dépense requise | Multiplicateur | Avantages principaux |
|------|---------------------|-----------------|----------------|---------------------|
| **Fan** | 0 | Inscription gratuite | x1 | 1pt/1000Ar, code parrainage, historique |
| **Silver** | 500 | ~500 000 Ar (3-5 events) | x1 | Réductions membres, préventes, offres spéciales, support WhatsApp |
| **Gold** | 2 000 | ~2 000 000 Ar (10-15 events) | x1.25 | Invitations exclusives, early access, cadeaux surprises |
| **Platinum** | 5 000 | ~5 000 000 Ar (30+ events) | x1.5 | Surclassement billets, accès VIP, support dédié |
| **Diamond** | 10 000 | ~10 000 000 Ar (top 1%) | x2 | Backstage, meet & greet, conciergerie, surclassement auto |

### Justification des seuils

- **Fan → Silver (500 pts)** : Atteignable en 3-5 événements. Encourage la rétention après les premiers achats.
- **Silver → Gold (2 000 pts)** : Nécessite un engagement régulier (10-15 événements). Récompense la fidélité.
- **Gold → Platinum (5 000 pts)** : Superfans uniquement. Les avantages (upgrades, VIP) ne coûtent presque rien.
- **Platinum → Diamond (10 000 pts)** : Top 1% des clients. Statut aspirationnel. Les avantages (backstage, meet & greet) créent du bouche-à-oreille gratuit.

> **Note importante :** Pas de réduction automatique par tier. Les réductions viennent UNIQUEMENT de l'échange de points (2% fixe). Les avantages par tier sont expérientiels et ne coûtent rien à l'entreprise.

---

## 3. Accumulation de Points

### Règles de gain

| Action | Points gagnés | Constante PHP | Fréquence |
|--------|--------------|---------------|-----------|
| Achat (billets/produits) | 1 pt / 1 000 Ar | `LR_POINTS_PER_1000AR` | Par transaction |
| Inscription | +100 pts | `LR_REGISTRATION_BONUS` | Une fois |
| Compléter son profil | +100 pts | `LR_PROFILE_BONUS` | Une fois |
| Premier achat | +200 pts | `LR_FIRST_PURCHASE_BONUS` | Une fois |
| Connexion quotidienne | +2 pts | `LR_LOGIN_BONUS` | 1x/jour max |
| Assister à un événement | +10 pts | `LR_ATTENDANCE_BONUS` | Par événement |
| Laisser un avis | +15 pts | `LR_REVIEW_BONUS` | Par avis |
| Parrainage (1er achat du filleul) | +75 pts | `LR_REFERRAL_BONUS` | Par filleul |
| Être parrainé | +25 pts | `LR_REFEREE_BONUS` | Une fois |
| Anniversaire | +200 pts | `LR_BIRTHDAY_BONUS` | 1x/an |
| Partage social | +20 pts | `LR_SHARE_BONUS` | Par partage |
| S'abonner à la newsletter | +100 pts | `LR_NEWSLETTER_BONUS` | Une fois |

### Multiplicateurs par tier

Les multiplicateurs s'appliquent UNIQUEMENT aux points d'achat (pas aux bonus fixes).

| Tier | Multiplicateur | Exemple (billet 100 000 Ar) |
|------|---------------|---------------------------|
| Fan | x1 | 100 pts |
| Silver | x1 | 100 pts |
| Gold | x1.25 | 125 pts |
| Platinum | x1.5 | 150 pts |
| Diamond | x2 | 200 pts |

---

## 4. Échange de Points (Redemption)

**Taux fixe : 20 Ar/pt** (soit 2% de cashback - standard industrie AMC/Vivid Seats)

| Points échangés | Valeur de réduction | Taux |
|-----------------|--------------------:|------|
| 500 pts | 10 000 Ar | 20 Ar/pt |
| 1 000 pts | 20 000 Ar | 20 Ar/pt |
| 2 000 pts | 40 000 Ar | 20 Ar/pt |
| 5 000 pts | 100 000 Ar | 20 Ar/pt |

> **Pourquoi un taux fixe ?** Plus simple à comprendre pour le client, plus prévisible pour l'entreprise. Le taux de 2% est le standard dans la billetterie et le divertissement. Pas de taux progressif qui encourage l'accumulation excessive.

> **Note :** L'échange de points génère un coupon WooCommerce à usage unique, applicable sur la prochaine commande.

---

## 5. Système de Parrainage (Côté serveur)

### Fonctionnement complet

1. **Génération du code** : Chaque utilisateur reçoit un code unique au format `TBL-{4 premiers chars user_id}{4 chars aléatoires}` (ex: `TBL-12ABXYZ9`). Stocké dans `user_meta` WordPress (`_lamako_referral_code`).

2. **Validation** : Quand un nouveau utilisateur entre un code parrain lors de l'inscription, l'API valide que le code existe et retourne le nom du parrain.

3. **Enregistrement** : Après inscription, l'app enregistre la relation parrain-filleul via `POST /referral/register`. Le filleul reçoit immédiatement **+25 pts** bonus.

4. **Crédit du parrain** : Un hook myCred (`woocommerce_order_status_completed`) détecte le premier achat du filleul et crédite **+75 pts** au parrain.

### Endpoints API du parrainage

| Endpoint | Méthode | Paramètres | Réponse |
|----------|---------|------------|---------|
| `/referral/validate` | POST | `code`, `api_key` | `{ valid: bool, referrer_name: string, bonus: int }` |
| `/referral/register` | POST | `referee_user_id`, `referrer_code`, `api_key` | `{ success: bool, referee_bonus: int }` |
| `/referral/code` | GET | `user_id`, `api_key` | `{ code: string, referral_count: int }` |

---

## 6. Sécurité de l'API

### Authentification

1. **JWT Token** (recommandé) : Header `Authorization: Bearer {token}`. Validé via plugin `jwt-auth`.
2. **Clé API** (fallback) : Paramètre `api_key`. Utilisé pour les appels non-authentifiés.

### Variables d'environnement

```php
// wp-config.php
define( 'LAMAKO_REWARDS_API_KEY', 'votre_cle_secrete_ici' );
```

```
// App mobile (.env)
EXPO_PUBLIC_REWARDS_API_KEY=votre_cle_secrete_ici
```

### Rate Limiting

- **Limite** : 60 requêtes/minute/IP (configurable via `LR_RATE_LIMIT`)
- **Fenêtre** : 60 secondes (configurable via `LR_RATE_WINDOW`)
- **Stockage** : WordPress transients
- **Dépassement** : HTTP 429 avec header `Retry-After`

---

## 7. Plugin WordPress - Installation

### Fichier : `scripts/lamako-rewards-api/lamako-rewards-api.php`

### Prérequis
- WordPress 5.8+
- **myCred** (plugin gratuit de gestion de points)
- **JWT Authentication** (pour tokens mobiles)
- WooCommerce (pour hooks d'achat)

### Installation

1. Uploader `lamako-rewards-api/` dans `/wp-content/plugins/`
2. Activer dans WordPress Admin > Extensions
3. Ajouter dans `wp-config.php` : `define('LAMAKO_REWARDS_API_KEY', 'clé');`
4. Réglages > Permaliens > Enregistrer (flush rewrite rules)
5. Créer page `/lamako-rewards` avec shortcode `[lamako_rewards_page]`

### Constantes PHP (modifiables)

```php
// Tiers
define( 'LR_TIER_FAN', 0 );
define( 'LR_TIER_SILVER', 500 );
define( 'LR_TIER_GOLD', 2000 );
define( 'LR_TIER_PLATINUM', 5000 );
define( 'LR_TIER_DIAMOND', 10000 );

// Multiplicateurs
define( 'LR_MULTIPLIER_FAN', 1.0 );
define( 'LR_MULTIPLIER_SILVER', 1.0 );
define( 'LR_MULTIPLIER_GOLD', 1.25 );
define( 'LR_MULTIPLIER_PLATINUM', 1.5 );
define( 'LR_MULTIPLIER_DIAMOND', 2.0 );

// Bonus
define( 'LR_REGISTRATION_BONUS', 100 );
define( 'LR_PROFILE_BONUS', 100 );
define( 'LR_LOGIN_BONUS', 2 );
define( 'LR_FIRST_PURCHASE_BONUS', 200 );
define( 'LR_ATTENDANCE_BONUS', 10 );
define( 'LR_REVIEW_BONUS', 15 );
define( 'LR_REFERRAL_BONUS', 75 );
define( 'LR_REFEREE_BONUS', 25 );
define( 'LR_BIRTHDAY_BONUS', 200 );
define( 'LR_SHARE_BONUS', 20 );
define( 'LR_NEWSLETTER_BONUS', 100 );
```

### Shortcodes

| Shortcode | Usage |
|-----------|-------|
| `[lamako_rewards_page]` | Page complète du programme |
| `[lamako_rewards_cta]` | Bannière CTA compacte |
| `[lamako_rewards_checkout_popup]` | Popup checkout pour invités |

### Hooks automatiques

| Hook | Action |
|------|--------|
| `woocommerce_before_add_to_cart_form` | CTA "Gagnez X points" sur pages produits |
| `woocommerce_before_checkout_form` | Popup inscription pour invités (3s) |
| `woocommerce_account_menu_items` | Onglet "Mes Récompenses" dans Mon Compte |
| `woocommerce_order_status_completed` | Crédite parrain si 1er achat filleul |

---

## 8. Application Mobile - Architecture

### Fichiers

| Fichier | Rôle |
|---------|------|
| `lib/rewards-provider.tsx` | Provider Context, API calls, tier logic, referral |
| `app/rewards.tsx` | Écran principal LamakoRewards |
| `app/(tabs)/profile.tsx` | Carte résumé dans le profil |
| `app/(auth)/register.tsx` | Champ "Code parrain" à l'inscription |
| `components/rewards-popup.tsx` | Popup invitation (30s après lancement) |

### Popup LamakoRewards

- **Déclenchement** : 30 secondes après le montage
- **Condition** : 1 seule fois par session (flag en mémoire, reset à chaque lancement)
- **Cible** : Tous les utilisateurs
- **Action** : Bouton "Découvrir" → `/rewards`

---

## 9. Site Web - Surfaces

### Page dédiée
**URL :** `ticketbylamako.com/lamako-rewards`  
**Contenu :** Shortcode `[lamako_rewards_page]` (5 cartes tiers, gains, échange, parrainage, profil)

### CTA produits
Automatique sur chaque produit WooCommerce : "Gagnez X points sur cet achat"

### Popup checkout
3 secondes après chargement pour les invités : "Inscrivez-vous et gagnez 100 pts"

### Onglet Mon Compte
"Mes Récompenses" : solde, tier, progression, code parrainage, nombre de filleuls

---

## 10. Modifier le Programme

### Changer les seuils de tiers

**PHP** : Modifier les `define()` en haut du plugin
```php
define( 'LR_TIER_SILVER', 500 );  // ← modifier
define( 'LR_TIER_GOLD', 2000 );   // ← modifier
```

**App** : Modifier `lib/rewards-provider.tsx` → tableau `TIERS`
```typescript
{ id: "silver", name: "Silver", minPoints: 500, ... },  // ← modifier minPoints
```

> **Important :** Les deux fichiers DOIVENT être synchronisés.

### Changer les bonus

Modifier les `define()` dans le plugin PHP ET `EARN_RULES` dans `rewards-provider.tsx`.

### Changer le taux d'échange

Modifier `REDEMPTION_TIERS` dans `rewards-provider.tsx` et la fonction `lr_get_redemption_value()` dans le plugin.

### Désactiver le popup app

Dans `app/_layout.tsx` → commenter `<RewardsPopup />`

---

## 11. Endpoints API - Référence

### Base URL
```
https://www.ticketbylamako.com/wp-json/lamako-rewards/v1
```

| Méthode | Endpoint | Description | Paramètres |
|---------|----------|-------------|------------|
| GET | `/balance` | Solde et tier | `user_id` |
| GET | `/history` | Historique transactions | `user_id`, `limit` |
| GET | `/tier-info` | Infos tous les tiers | - |
| POST | `/redeem` | Échanger des points | `user_id`, `points` |
| POST | `/referral/validate` | Valider un code | `code` |
| POST | `/referral/register` | Enregistrer parrainage | `referee_user_id`, `referrer_code` |
| GET | `/referral/code` | Code d'un user | `user_id` |

### Exemple réponse `/balance`

```json
{
  "balance": 245,
  "total_earned": 520,
  "tier": "silver",
  "tier_name": "Silver",
  "next_tier": "Gold",
  "points_to_next_tier": 1755,
  "multiplier": 1.0
}
```

---

## 12. Checklist de Déploiement

- [ ] Installer et activer myCred sur WordPress
- [ ] Uploader `lamako-rewards-api/` dans `/wp-content/plugins/`
- [ ] Activer le plugin
- [ ] Ajouter `LAMAKO_REWARDS_API_KEY` dans `wp-config.php`
- [ ] Créer page `/lamako-rewards` avec shortcode `[lamako_rewards_page]`
- [ ] Flush permaliens
- [ ] Configurer `EXPO_PUBLIC_REWARDS_API_KEY` dans l'app
- [ ] Tester inscription avec code parrain
- [ ] Vérifier accumulation de points après achat
- [ ] Vérifier onglet "Mes Récompenses" dans Mon Compte
- [ ] Vérifier popup checkout pour invités
- [ ] Vérifier CTA sur pages produits

---

## 13. Résumé des Constantes

```
// API
Base URL: https://www.ticketbylamako.com/wp-json/lamako-rewards/v1
Clé API: Définie dans wp-config.php (LAMAKO_REWARDS_API_KEY)

// Tiers (points lifetime requis)
Fan: 0 | Silver: 500 | Gold: 2 000 | Platinum: 5 000 | Diamond: 10 000

// Multiplicateurs
Fan: x1 | Silver: x1 | Gold: x1.25 | Platinum: x1.5 | Diamond: x2

// Échange (taux fixe 2%)
500 pts = 10 000 Ar | 1000 pts = 20 000 Ar | 2000 pts = 40 000 Ar | 5000 pts = 100 000 Ar

// Accumulation
1 pt / 1 000 Ar dépensés
Inscription: +100 | Profil: +100 | 1er achat: +200
Connexion: +2/jour | Parrainage: +75 | Filleul: +25
Événement: +10 | Avis: +15 | Anniversaire: +200
Partage: +20 | Newsletter: +100

// Rate Limiting
60 requêtes / minute / IP

// Popup App
Délai: 30 secondes | Fréquence: 1x par session

// Popup Checkout Web
Délai: 3 secondes | Cible: invités non-connectés
```
