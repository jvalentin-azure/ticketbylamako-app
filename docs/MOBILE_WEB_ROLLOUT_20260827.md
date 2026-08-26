# Expérience client web mobile — plan de staging et de release

Statut au 27 août 2026 : implémentation locale uniquement. Aucun fichier de staging ou de production n'a été modifié.

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

`NOT RUN / NO GO` pour staging et production tant que la matrice authentifiée, seating et paiement sandbox n'a pas été exécutée sur la même origine staging. Le build local et le smoke test anonyme ne suffisent pas à prononcer un GO.
