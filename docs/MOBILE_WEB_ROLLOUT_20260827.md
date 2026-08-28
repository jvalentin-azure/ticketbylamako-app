# Expérience client web mobile — plan de staging et de release

Statut au 28 août 2026 : release candidate déployée sur le staging sous `/mobile`, en accès direct uniquement. Le routage automatique est désactivé et la production n'a pas été modifiée.

## Résultat visé

- WordPress reste le site canonique, le CMS et l'expérience desktop.
- Sur téléphone, la navigation publique bascule vers l'interface client Expo sous `/mobile`.
- L'expérience web mobile n'est pas une PWA : aucun manifest, service worker, bouton d'installation ou prompt « Ajouter à l'écran d'accueil ».
- La SPA et WordPress restent sur la même origine. L'authentification web utilise donc les cookies WordPress HttpOnly et un nonce REST, jamais le JWT natif dans le stockage du navigateur.

```text
Visiteur desktop ───────────────> WordPress
Visiteur téléphone ── flag ─────> /mobile (Expo Router SPA)
                                      │
                                      └── /wp-json/lamako-mobile/v2
                                          cookie HttpOnly + X-WP-Nonce
```

## Périmètre implémenté

- export SPA Expo Router avec base `/mobile` et fallback Apache ;
- routage WordPress mobile pour accueil, événements, produits, boutique, panier, commandes et profil ;
- exclusion stricte de l'administration, REST, checkout, order-pay et callbacks `/lamako-mobile` ;
- exclusion des robots et option « Version classique du site » ;
- feature flag `LAMAKO_MOBILE_WEB_ENABLED`, désactivé par défaut ;
- rollout stable par navigateur avec `LAMAKO_MOBILE_WEB_ROLLOUT_PERCENT` ;
- session web WordPress same-origin, login, inscription, social login et logout ;
- requêtes v2 avec cookie et nonce CSRF ;
- placement en iframe first-party, retours de paiement navigateur, Wallet et export calendrier ICS ;
- runtime notifications natif exclu du bundle web ;
- variantes natives existantes conservées.

## Artefacts

- bundle : `pnpm export:web`, sortie locale `dist-web/` ;
- QA complète : `pnpm qa:web` ;
- API et routage :
  - `scripts/lamako-mobile-api/includes/v2-commerce.php` ;
  - `scripts/lamako-mobile-api/includes/mobile-web-router.php` ;
- hébergement SPA : contenu de `dist-web/`, y compris `.htaccess`, dans le répertoire web `/mobile/` de l'environnement ciblé.

Le build staging doit définir `EXPO_PUBLIC_SITE_URL=https://staging.ticketbylamako.com` et conserver `EXPO_PUBLIC_WEB_BASE_URL=/mobile`. La SPA ne doit pas être servie depuis un autre sous-domaine : cela casserait le modèle de cookie same-origin.

## Release staging active

- commit client : `8b00609` ;
- release immuable : `tbl-mobile-web-8b00609-20260828T050916Z` ;
- bundle : `entry-94be810bda51cc783d4d7203a478df7b.js` ;
- SHA-256 du bundle : `dde37a21a0eea62120cb9a7aae90ab27d66c686832220606d071b20a76be9fdb` ;
- SHA-256 de l'archive : `d65f045a6c46bfcf25790d35e6845d86e34d304b3007ec94b0cbcfa8ad0134c8` ;
- SHA-256 de l'API `v2-commerce.php` active : `51198073a3c507f81d995f7e1bd67bb5c45d67cec1a5b08260de40c6d6667272` ;
- SHA-256 de l'index actif : `89ed36ddfca480e5ee09619829f07d280501025cc15a573c125916041014071b` ;
- sauvegarde API : `tmp/tbl-mobile-web-94084df-20260828T011900Z/backup/v2-commerce.php.before` ;
- rollback du bundle précédent : `tmp/tbl-mobile-web-8b00609-20260828T050916Z/release/mobile.previous` ;
- URL de QA : `https://staging.ticketbylamako.com/mobile/` ;
- `LAMAKO_MOBILE_WEB_ENABLED` absent de `wp-config.php`, donc aucun visiteur mobile de la racine WordPress n'est redirigé.

Les constantes d'API du bundle pointent vers le staging. Trois URL publiques de contact/partage restent volontairement sur le domaine public, sans servir d'origine API. Le bundle ne contient ni manifest, service worker, prompt d'installation ou stockage JWT navigateur. Aucun second domaine n'est nécessaire ou souhaitable.

## Déploiement staging proposé

1. Geler le commit candidat et exécuter `pnpm qa:web`.
2. Sauvegarder les deux fichiers PHP actifs du staging et relever leurs SHA-256.
3. Déployer `mobile-web-router.php`, puis fusionner le `v2-commerce.php` candidat avec le fichier réellement actif sur staging.
4. Exécuter `php -l` sur les deux fichiers distants.
5. Uploader le bundle dans un répertoire temporaire, vérifier les hashes, puis le promouvoir atomiquement vers `/mobile/`.
6. Laisser `LAMAKO_MOBILE_WEB_ENABLED` à `false` et tester directement `https://staging.ticketbylamako.com/mobile/`.
7. Activer ensuite sur staging :

   ```php
   define( 'LAMAKO_MOBILE_WEB_ENABLED', true );
   define( 'LAMAKO_MOBILE_WEB_ROLLOUT_PERCENT', 100 );
   ```

8. Purger uniquement les caches staging, puis exécuter la matrice QA ci-dessous.

## Matrice bloquante staging

- anonyme : accueil, événements, recherche, boutique, panier ;
- compte de test : login, refresh, nouvel onglet, logout réel ;
- inscription avec une adresse de test nettoyable ;
- Google/Facebook sans fuite de JWT dans le stockage navigateur ;
- fiche événement standard et événement avec plan de salle ;
- ajout panier et double clic sans duplication ;
- checkout jusqu'au choix du moyen de paiement, sans paiement réel ;
- paiement sandbox : succès, attente, annulation, retour popup bloqué ;
- commandes, billets, QR, calendrier ICS, Apple/Google Wallet selon appareil ;
- URL profonde + refresh pour `/mobile/event/{id}`, `/mobile/product/{id}`, `/mobile/order/{id}` et `/mobile/ticket/{id}` ;
- iPhone Safari, Android Chrome, viewport étroit et paysage ;
- desktop WordPress inchangé ;
- `/checkout`, `/order-pay` et `/lamako-mobile/*` jamais redirigés ;
- navigation avec `?desktop=1` conservée sur WordPress pour l'onglet courant ;
- clavier, focus visible, lecteur d'écran et réduction des animations sur les actions critiques.

Les paiements doivent utiliser exclusivement le sandbox staging et des comptes de test. Aucun paiement réel n'est autorisé par ce plan.

## Résultats QA exécutés

### Code et artefact

- Vitest : 61 fichiers réussis, 3 ignorés ; 311 tests réussis, 4 ignorés intentionnellement ;
- TypeScript `tsc --noEmit` : réussi ;
- lint Expo : réussi ;
- export web Expo avec cache Metro vidé : réussi ;
- routes `/mobile/`, `/mobile/event/12673`, `/mobile/shop`, `/mobile/cart` et `/mobile/login` : HTTP 200 ;
- bundle statique : HTTP 200, cache immuable ; index : `no-store` ;
- route API publique `/wp-json/lamako-mobile/v2/public/shop-data` : HTTP 200 ;
- CSP, `nosniff`, politique de référent, permissions et protection d'iframe présentes ;
- un user-agent iPhone sur `/` reste sur WordPress pendant que le flag est désactivé.

### Session et UX authentifiée

- inscription, cookie WordPress `HttpOnly`, `Secure`, `SameSite=Lax`, profil protégé et logout réel validés ;
- login, restauration après actualisation et nouvel onglet logique validés ;
- récupération automatique d'un nonce REST périmé validée pour la restauration de session et les requêtes v2 ;
- accueil authentifié, LamakoRewards et confirmation de déconnexion accessible validés ;
- compte et données synthétiques de QA supprimés après les tests.

### Responsive, navigation et accessibilité web

- URL profondes événement et produit conservées après actualisation, avec contenu restauré et sans débordement horizontal ;
- route privée `/mobile/orders` anonyme protégée sans fuite de commande, et API `/wp-json/lamako-mobile/v2/orders` en HTTP 401 sans cookie ;
- contrôles critiques de connexion exposés comme boutons ou liens nommés, champs identifiés indépendamment des placeholders et messages d'erreur annoncés ;
- cibles Retour, visibilité du mot de passe, mot de passe oublié, connexion, inscription et confidentialité mesurées à au moins 44 px ;
- écrans contrôlés en 375 × 667, 412 × 915 et paysage 844 × 390, sans erreur console ni débordement horizontal ;
- Safari iOS et Chrome Android physiques restent requis : ces preuves utilisent le navigateur de staging avec des viewports mobiles.

### Placement

- événement `12673` chargé dans l'interface mobile ;
- page de placement first-party chargée dans l'iframe web sécurisée ;
- ouverture, fermeture et seconde ouverture consécutive validées sans reconnexion ni erreur applicative ;
- preuve serveur répétée : flux temporaires du compte QA `3 → 4 → 3`, donc la fermeture libère bien la session abandonnée ;
- aucun paiement ou commande réelle n'a été créé pendant ce test.

### Paiements et limites restantes

- CyberSource est configuré en environnement `sandbox` sur staging ;
- le parcours CyberSource sandbox a été validé de bout en bout dans le navigateur : Hosted Checkout, carte de test, 3-D Secure, retour applicatif, confirmation persistante après actualisation et historique de commande payé ;
- le serveur a conservé exactement une commande et une transaction `ACCEPT` de 300 MGA pour cette tentative, sans billet émis puisque le produit QA était un article boutique ;
- la signature de callback, l'idempotence du rejeu, le maintien d'une commande non payée et le refus d'une signature altérée ont réussi dans le smoke test isolé ;
- l'annulation REST d'une commande impayée et son rejeu idempotent ont réussi ; une commande déjà payée ne peut pas être rétrogradée ;
- une commande expirée sans tentative est annulée, une tentative prestataire encore active est préservée, puis passe en revue manuelle après son délai de vérification ; ces scénarios n'ont émis aucun billet ;
- le smoke terminal a supprimé ses commandes et son compte synthétique ; les contrôles `codex.terminal` et `_lamako_v2_qa_label` sont revenus à zéro dans les stockages WordPress et HPOS ;
- le récapitulatif distingue maintenant les articles boutique des billets : `Panier`, `1 article`, `ARTICLE` et quantité `1 article` ont été vérifiés sur la release active ;
- les deux commandes QA, la transaction sandbox et le compte synthétique ont été supprimés après vérification ; le contrôle final indique zéro commande, transaction ou billet résiduel ;
- Airtel Money, MVola et Orange utilisent des endpoints qui ressemblent aux endpoints de production et n'exposent aucun mode test vérifiable dans leur configuration active ;
- aucun appel de paiement Airtel, MVola ou Orange n'a été lancé, afin d'éviter un paiement réel ;
- l'annulation depuis la page Hosted Checkout et l'état d'attente CyberSource ne sont pas encore validés de bout en bout dans le navigateur ; tous les scénarios Airtel, MVola et Orange restent également non exécutés ;
- Safari iOS et Chrome Android sur appareils physiques, les fournisseurs sociaux réels et les Wallets physiques restent à vérifier ;
- l'iframe WordPress embarquée émet des avertissements de dépréciation jQuery/blocs et Complianz, sans erreur applicative observée.

## Promotion progressive production

Après autorisation explicite de mise en production :

1. déployer les fichiers et le bundle avec le flag à `false` ;
2. valider `/mobile/` directement avec des contrôles non destructifs ;
3. activer à 5 %, puis 25 %, 50 % et 100 %, avec purge du cache WordPress à chaque changement de constante ;
4. observer au moins 30 minutes par palier et une fenêtre de pointe avant 100 % ;
5. conserver WordPress et le bundle natif sans modification pendant la surveillance.

Signaux et seuils d'arrêt proposés :

- erreurs HTTP 5xx de `/mobile` ou `/wp-json/lamako-mobile/v2` > 1 % sur 5 minutes ;
- hausse des 401/403 de session web > 2 points par rapport au staging ;
- création de commande, démarrage de paiement ou retour de paiement en baisse de plus de 5 % ;
- toute commande dupliquée, tout billet émis avant confirmation, ou tout callback paiement mal corrélé ;
- régression desktop, checkout WordPress ou callbacks prestataires.

## Rollback

Rollback immédiat du routage :

```php
define( 'LAMAKO_MOBILE_WEB_ENABLED', false );
```

Puis purger le cache WordPress/edge. Les téléphones reviennent alors au WordPress responsive ; le répertoire `/mobile` peut rester présent sans recevoir de trafic automatique.

Si l'API web-session est en cause, restaurer les sauvegardes de `v2-commerce.php` et `mobile-web-router.php`, vérifier la syntaxe PHP, purger le cache, puis retester WordPress desktop, login et les callbacks. Si le bundle seul est en cause, restaurer atomiquement le répertoire `/mobile` précédent sans toucher à l'API.

## Décision actuelle

- `GO` pour la release directe staging `/mobile` avec le flag désactivé et pour le parcours de succès CyberSource sandbox ;
- `NO GO` pour activer le routage automatique staging ou promouvoir cette expérience web mobile en production tant que les moyens de paiement mobile ne disposent pas d'un sandbox vérifiable et que leur matrice de paiement n'a pas été exécutée ;
- `NO GO` également pour un passage à 100 % sans contrôle Safari iOS et Chrome Android sur appareils physiques.
