# Catalogue mobile - déploiement staging du 21 août 2026

## Périmètre

- Application client TicketByLamako uniquement.
- API WordPress `lamako-mobile/v2` sur staging uniquement.
- Aucun fichier de production modifié.
- Aucun paiement, billet ou check-in réel créé pendant la validation.

## Commits

- `425f680` : synchronisation dans Git de la source PHP réellement active sur staging.
- `e4d32af` : limitation de la requête des produits Tickera aux événements du catalogue retourné.

## Validation locale

- `pnpm check` : OK.
- `pnpm test` : 106 tests réussis, 4 ignorés.
- `pnpm lint` : OK.
- `pnpm check:mobile-secrets` : OK.
- `php -l scripts/lamako-mobile-api/includes/v2-commerce.php` : OK.
- `git diff --check` : OK.

## Déploiement staging

Fichier déployé :

`/home/master/applications/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php`

SHA-256 déployé :

`e6e6c7bcd2e196274b22a5ca331a7c9a3d1e4519d0698ba55f5f49802fdae5f2`

Backup avant déploiement :

`/home/master/tbl-compliance-backups/wvvtwdcenn-20260821T020414Z-pre-catalog-scope/v2-commerce.php`

SHA-256 du backup :

`4dde70325a0fc5e935593d4b5b8c709fd2bf5b6ca0fe6e937d98353b2b5d1f5e`

## QA API après déploiement

- `public/home-data` : HTTP 200.
- `public/events-data` : HTTP 200, 31 événements et 5 catégories.
- `public/shop-data` : HTTP 200.
- Événement standard `13842` : HTTP 200, 1 billet, sans seating.
- Événement seating `12673` : HTTP 200, 2 billets, seating détecté.
- Aucun nouveau fatal PHP détecté dans `debug.log`.

Le temps serveur reste variable, généralement entre 2 et 4 secondes. La requête produit est mieux bornée, mais ce déploiement ne suffit pas à lui seul à réduire fortement toute la latence WordPress. Le cache persistant et les skeletons côté application réduisent l'impact utilisateur.

## Rollback staging

À exécuter depuis le serveur uniquement si une régression est confirmée :

```bash
cp -p /home/master/tbl-compliance-backups/wvvtwdcenn-20260821T020414Z-pre-catalog-scope/v2-commerce.php /home/master/applications/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
php -l /home/master/applications/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
```

Après rollback, retester `public/home-data`, `public/events-data`, `public/shop-data`, l'événement standard `13842` et l'événement seating `12673`.

## Builds de QA

- Android staging APK : build EAS `e1138d3b-6211-41af-a858-8199f6ea28c1`, versionCode 46.
- iOS staging TestFlight : build EAS `21670023-56a9-4f18-84a3-3d651cf220f2`, buildNumber 32.

Les deux builds ont été lancés depuis `e4d32af` et pointent vers `https://staging.ticketbylamako.com`.
