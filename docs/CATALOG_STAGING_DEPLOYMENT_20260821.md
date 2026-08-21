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

- Android staging APK : build EAS `e1138d3b-6211-41af-a858-8199f6ea28c1`, versionCode 46, terminé.
  - Artefact : `https://expo.dev/artifacts/eas/Gg-0LCeDi_EmI5m3p-r7EZD3jdXFjimEwbcaBMdCE30.apk`
- iOS staging TestFlight : build EAS `21670023-56a9-4f18-84a3-3d651cf220f2`, buildNumber 32, terminé.
  - Artefact : `https://expo.dev/artifacts/eas/wTKUuZhEgGfsGj7TgpJ79BpHsjiGh2fPaE1LrSvws2M.ipa`
  - Soumission TestFlight planifiée : `7aa7257e-e1de-4406-a3af-c8105dcf0612`.

Les deux builds ont été lancés depuis `e4d32af` et pointent vers `https://staging.ticketbylamako.com`.

## Extension profil mobile v2 - 21 août 2026

Le même fichier PHP a été redéployé sur staging uniquement après l'ajout des
routes authentifiées `GET/POST /lamako-mobile/v2/profile`.

- Commit source : `cb518dc`.
- Validation locale PHP 8.4 : aucune erreur de syntaxe.
- Backup serveur avant remplacement :
  `/home/master/tbl-compliance-backups/wvvtwdcenn-20260821T114634Z-pre-mobile-profile-v2/v2-commerce.php`.
- SHA-256 du backup :
  `e6e6c7bcd2e196274b22a5ca331a7c9a3d1e4519d0698ba55f5f49802fdae5f2`.
- SHA-256 déployé :
  `56240abcf554735d5b00533d312085487204ad51684f73e29b3918492d4f2867`.
- `php -l` distant : OK avant et après remplacement.
- Endpoints catalogue : HTTP 200 pour home, événements, boutique, événement
  standard `13842` et événement seating `12673`.
- Profil sans JWT : HTTP 401.
- Profil avec utilisateur authentifié simulé par WP-CLI : HTTP 200, e-mail et
  bloc billing présents. Aucune donnée utilisateur n'a été modifiée.
- `debug.log` staging : absent au moment du contrôle; aucune erreur fatale
  détectée.

Deux warnings WP-CLI préexistants restent visibles hors réponse REST : chargement
de traduction Eventchamp trop tôt et dépréciation PHP 8.4 dans WP Mail SMTP Pro.
Ils ne sont pas causés par le fichier déployé.

Rollback staging :

```bash
cp -p /home/master/tbl-compliance-backups/wvvtwdcenn-20260821T114634Z-pre-mobile-profile-v2/v2-commerce.php /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
php -l /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
```

Après rollback, retester les cinq endpoints catalogue ci-dessus et vérifier que
`GET /lamako-mobile/v2/profile` redevient indisponible comme avant ce déploiement.

## Wallet billets et révocation push - 21 août 2026

Le fichier `v2-commerce.php` a été redéployé sur staging uniquement pour ajouter
la route authentifiée `DELETE /lamako-mobile/v2/push-token`. Cette route retire
uniquement le token appartenant à l'utilisateur JWT courant.

- SHA-256 déployé :
  `31388f6ee8093dedc800c17de9b27360c47a52d6a83040b7205dab95d9b6d08d`.
- Backup serveur avant remplacement :
  `/home/master/tbl-compliance-backups/wvvtwdcenn-20260821T140136Z-pre-push-token-revoke/v2-commerce.php`.
- SHA-256 du backup :
  `56240abcf554735d5b00533d312085487204ad51684f73e29b3918492d4f2867`.
- `php -l` local et distant : OK.
- Requête DELETE sans JWT : HTTP 401.
- Smoke test avec deux comptes staging : inscription HTTP 200, suppression par
  un autre utilisateur `removed: 0`, suppression par le propriétaire
  `removed: 1`, puis stockage restauré à son état initial.
- Catalogue, boutique, événement standard `13842` et événement seating `12673` :
  HTTP 200 après déploiement.
- Aucun paiement, billet, commande ou check-in créé pendant cette validation.

Rollback staging :

```bash
cp -p /home/master/tbl-compliance-backups/wvvtwdcenn-20260821T140136Z-pre-push-token-revoke/v2-commerce.php /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
php -l /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
```

Builds déclenchés après QA staging :

- Android staging, versionCode `50` :
  `8cf508cd-ed78-474b-a45a-a1504e5a0a89`.
- iOS staging/TestFlight, buildNumber `36` :
  `a98dc0be-5a49-4560-85bf-7f50ee71e6ed`.
