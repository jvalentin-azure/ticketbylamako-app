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

## Navigation compte et activité LamakoRewards - 23 août 2026

La navigation client ne duplique plus `Mes billets` entre le tiroir, le profil
et la barre principale. `Mes billets` reste une destination primaire de la barre
d'onglets. Le tiroir regroupe les destinations secondaires et affiche le solde
LamakoRewards. Le profil est recentré sur l'identité et les préférences.

La page LamakoRewards recharge désormais le journal à chaque ouverture, accepte
le rafraîchissement par glissement et présente les connexions, achats et débits
près du solde. Le serveur trie les mouvements par date puis identifiant afin de
préserver un ordre stable quand plusieurs écritures partagent le même timestamp.

Validation locale :

- commit applicatif : `dcc79df20e9bdd4d98dd8a72637ebd3407f4f907` ;
- TypeScript et ESLint : OK ;
- PHP local : aucune erreur de syntaxe ;
- Vitest : 232 tests réussis, 4 ignorés ;
- `git diff --check` : OK.

Déploiement staging ciblé :

- fichier PHP uniquement : `lamako-mobile-api/includes/v2-commerce.php` ;
- empreinte finale :
  `46e15d27add784482bc9a0722f8fc5c317b6326f15fbc24035d5b6b905bc008c` ;
- backup avant déploiement :
  `/home/master/tbl-compliance-backups/rewards-menu-20260823T123232Z/v2-commerce.php` ;
- plugin `lamako-mobile-api` actif, version `2.0.4` ;
- route publique catalogue : HTTP 200 ;
- route Rewards sans JWT : HTTP 401 attendu ;
- aucun fatal Rewards/PHP détecté dans la fin du journal staging ;
- les références `daily_login`, `woocommerce_each_order` et `purchase` sont
  présentes dans le journal myCred staging ;
- aucun fichier de production modifié.

OTA staging :

- canal et branche : `staging` ;
- runtime : `1.0.0` ;
- groupe : `8e9b7fce-74ac-4f8c-b4cf-0dd9ca475de4` ;
- Android : `01a02ea1-5540-7232-a979-ec8bf55e3f17` ;
- iOS : `01a02ea1-5540-7332-a1a2-fdaee03b86c9`.

Rollback serveur staging :

```bash
cp -p /home/master/tbl-compliance-backups/rewards-menu-20260823T123232Z/v2-commerce.php /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
php -l /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
```

L'OTA peut être remplacée par une nouvelle publication sur la branche staging
ou annulée depuis le groupe d'updates Expo. Une QA physique reste requise pour
le tiroir, Profil, Mes billets et l'activité Rewards authentifiée.

## Builds QA wallet et carte - 22 août 2026

Les deux candidats ont été construits depuis le commit
`0bfbcc8af5e8925f9c547f028968c184bd0a1c4e`. Ils ciblent le staging et
n'incluent aucun déploiement de production.

- Android staging APK, versionCode `53` :
  - build EAS : `ea11b263-b324-4cf6-827a-7335d3337c4a` ;
  - artefact :
    `https://expo.dev/artifacts/eas/BAQvc-7CE2IZ5auj90bupJG-wYQ14kzanaV0mMY8Xmg.apk` ;
  - statut : terminé.
- iOS staging/TestFlight, buildNumber `39` :
  - build EAS : `ef238319-0a8a-48d2-8b7b-7a2fb49f8a00` ;
  - soumission App Store Connect :
    `8e54a44d-39c1-4641-9967-7e58dbbaaf84` ;
  - statut : binaire envoyé, traitement TestFlight Apple en cours.

QA physique requise : affiches du wallet, commande multi-billets, QR plein
écran et hors ligne, carte Google Maps intégrée, itinéraire, puis régression
seating chart, panier, coupons et paiements.

## Builds QA safe area et carte Google Maps - 22 août 2026

Les deux candidats ont été construits depuis le commit
`8a46d775e9a606e6ad15304f97f26061f9454936`. Ils ciblent le staging et
n'incluent aucun déploiement WordPress ou de production.

- Android staging APK, versionCode `54` :
  - build EAS : `22160aa8-6c01-4502-b6cf-c954d183288f` ;
  - artefact :
    `https://expo.dev/artifacts/eas/bTQWyIE1LKpluMPEaPI4QysCpaUZ3Of-C4K5kb7H0j0.apk` ;
  - statut : terminé.
- iOS staging/TestFlight, buildNumber `40` :
  - build EAS : `8386b858-4a8f-44f1-9926-37b7d8a58eae` ;
  - soumission App Store Connect :
    `e05910e2-8fad-4ac2-92de-2e8ec1a1d462` ;
  - statut : binaire envoyé, traitement TestFlight Apple en cours.

QA physique requise : ouvrir le mode d'entrée hors ligne sur un iPhone avec
Dynamic Island et vérifier les zones haute/basse, puis vérifier le rendu de la
carte intégrée et l'ouverture de l'itinéraire depuis les détails événement et
billet. La clé Maps publique reste fournie par EAS et n'est pas versionnée.

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
  `8cf508cd-ed78-474b-a45a-a1504e5a0a89`, terminé.
  - Artefact :
    `https://expo.dev/artifacts/eas/ReSAeaP5Innet5bZ4jd1iAVG1pORHaOYlbKEOwQ0E8M.apk`.
- iOS staging/TestFlight, buildNumber `36` :
  `a98dc0be-5a49-4560-85bf-7f50ee71e6ed`, terminé.
  - Artefact :
    `https://expo.dev/artifacts/eas/9cG_m-NjRRx2-x7MlQZjUdW6xPwV68grrdJ9jM-HJPM.ipa`.
  - Soumission TestFlight planifiée :
    `2281d531-4dd7-4c0e-9a37-330412dda176`.

## Billets actifs pendant l'événement - 21 août 2026

Le wallet utilise désormais la date de fin de l'événement pour distinguer les
billets à venir des billets passés. Les événements historiques sans date de fin
conservent une période de grâce bornée de 24 heures après leur début afin que le
QR code ne disparaisse pas pendant l'exploitation terrain.

- Réponse API enrichie avec `eventEndDate`, en lisant les clés Tickera actuelles
  et historiques.
- Les notifications déjà reçues conservent leur date lorsqu'elles sont ouvertes.
- Backup serveur avant remplacement :
  `/home/master/tbl-compliance-backups/wvvtwdcenn-20260821T154928Z-pre-ticket-end-date/v2-commerce.php`.
- SHA-256 du backup :
  `31388f6ee8093dedc800c17de9b27360c47a52d6a83040b7205dab95d9b6d08d`.
- SHA-256 déployé :
  `dd98baccfa346e91da5651cafd6ae587e1233d9b8a5a857dcc4e04081789a4d7`.
- `php -l` local et distant : OK.
- Contrat vérifié sur une commande staging existante : `eventEndDate` présent.
- Catalogue, boutique, événement standard `13842` et événement seating `12673` :
  HTTP 200.
- Validation mobile : TypeScript et lint OK, 172 tests réussis, 4 ignorés,
  contrôle des secrets mobile OK.
- Aucun paiement, billet, commande ou check-in créé pendant cette validation.

Rollback staging :

```bash
cp -p /home/master/tbl-compliance-backups/wvvtwdcenn-20260821T154928Z-pre-ticket-end-date/v2-commerce.php /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
php -l /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
```

## Billet et QR hors ligne - 21 août 2026

Les billets et leurs QR sont préchargés de façon chiffrée dès l'ouverture du
wallet et restent disponibles lorsque le réseau disparaît, y compris après un
redémarrage de l'application tant que le JWT stocké n'est pas expiré.

- Cache natif chiffré avec `expo-secure-store`, séparé par utilisateur et par
  commande.
- Écriture découpée et atomique afin de respecter les limites du Keychain et de
  rejeter toute copie partielle ou corrompue.
- Aucun QR ou détail de facturation n'est placé dans `AsyncStorage`; seul
  l'index non sensible des numéros de commande y est conservé pour la purge.
- Rafraîchissement serveur silencieux dès que le réseau est disponible.
- Préchargement automatique des commandes visibles dans `Mes billets`, sans
  obligation d'ouvrir chaque QR une première fois.
- Bannière visible lorsque l'écran affiche une copie hors ligne.
- Réponse serveur `401` ou `403` : suppression immédiate de la copie locale et
  aucun affichage du QR.
- Déconnexion : purge du cache API général et de tous les billets chiffrés du
  compte courant.
- Démarrage hors ligne : le JWT est accepté localement uniquement s'il contient
  une expiration encore valide; une réponse négative explicite du serveur reste
  prioritaire.
- Validation : TypeScript, lint, contrôle des secrets et suite Vitest complète
  réussis (`180` tests réussis, `4` ignorés).

Aucun fichier PHP n'a été modifié ou redéployé pour cette brique. Aucun build
EAS supplémentaire n'a été lancé afin de regrouper les changements avant le
prochain candidat QA.

Rollback applicatif : revenir au commit précédant la fonctionnalité de cache
hors ligne. Les anciennes installations ne contiennent aucune donnée sous les
clés `tbl.ticket.detail.v1.*`; une déconnexion depuis la version corrigée purge
les entrées créées.

Builds QA incluant le cache hors ligne :

- Android staging, versionCode `51` :
  `3ac651b7-dcef-4438-857e-2318ee64b74f`, terminé.
- iOS staging/TestFlight, buildNumber `37` :
  `8563dcbb-754a-4829-b356-f3db2f28428e`, terminé.
- Soumission TestFlight planifiée :
  `a559b4f8-4a22-4399-b235-991aaeafa07b`.

## Navigation des notifications - 21 août 2026

La navigation depuis une notification système ou la boîte Notifications est
désormais centralisée et compatible avec les deux contrats historiques :
`eventId` / `orderId` côté application et `event_id` / `order_id` côté PHP.

- Les notifications événement ouvrent l'événement concerné.
- Les notifications commande et billet sont privées. Si la session a expiré,
  le login conserve la destination puis ramène vers la commande ou le billet.
- L'ouverture à froid attend que l'onboarding, l'authentification et le routeur
  soient prêts avant de naviguer.
- La dernière réponse Expo est consommée après traitement afin d'éviter une
  réouverture répétée au prochain démarrage.
- Seules les routes locales événement, commande, billet et liste de commandes
  sont autorisées. Les URLs externes et identifiants mal formés sont rejetés.
- Validation : TypeScript, lint, contrôle des secrets, format et suite Vitest
  complète réussis (`185` tests réussis, `4` ignorés).

Aucun fichier PHP n'a été modifié ou redéployé. Aucun build EAS supplémentaire
n'a été lancé pour cette brique afin de la regrouper avec le prochain candidat
QA.

Rollback applicatif : revenir au commit précédant la centralisation de la
navigation des notifications. Le contrat PHP existant reste inchangé.

## Préférences de notifications effectives - 21 août 2026

Les quatre réglages de l'application sont désormais appliqués à la réception
locale et aux envois serveur : nouveaux événements, suivi des commandes,
rappels d'événement et promotions.

- Le token Expo est resynchronisé avec ses préférences après chaque changement.
- Les notifications désactivées ne sont ni affichées au premier plan ni ajoutées
  à la boîte Notifications.
- La désactivation des rappels annule les rappels locaux déjà planifiés.
- Le serveur filtre les diffusions `newEvents` et les notifications
  `orderUpdates` avant l'appel à Expo.
- Les anciens tokens sans bloc `preferences` restent activés par défaut pour
  préserver la compatibilité avec les versions déjà installées.
- `POST /lamako-mobile/v2/push-token` reste protégé : HTTP 401 sans JWT.

Déploiement limité au staging. Le fichier principal actif était une variante
historique `2.0.0`, très différente de la source Git `2.0.4`; il a donc reçu un
patch minimal au lieu d'un remplacement complet. Une modification seating de
`v2-commerce.php`, déployée en parallèle, a également été conservée puis
fusionnée avec le stockage des préférences.

- Backup serveur :
  `/home/master/tbl-compliance-backups/wvvtwdcenn-20260821T180033Z-pre-notification-preferences/`.
- SHA-256 avant patch du fichier principal :
  `f6cce7ae3e105f07650db41a5268f56c0f8613b9de06b8e6e5eef79d7d436dd1`.
- SHA-256 avant patch du fichier v2 parallèle :
  `7ce2f032099b343ce6713fcce528edb63e55bcc931f9222ce91bda9e5e4c7ff9`.
- SHA-256 staging après déploiement du fichier principal :
  `356c53b651b96f0363fa59f51290baed6e40a3a7bb1234f46d7455c80a4756fe`.
- SHA-256 staging après fusion du fichier v2 :
  `743a78616970e1c415954f00aaf7434ed37c1a2e38ade3fa3f3c580d4c9278f5`.
- `php -l` local, transfert et fichiers actifs : OK.
- Smoke tests publics : HTTP 200 pour home, événements, boutique, événement
  standard `13842` et événement seating `12673`.
- Test contrôlé avec un token Expo factice : préférences persistées avec les
  quatre valeurs attendues, puis suppression vérifiée
  (`CLEANUP_REMAINING=0`). Aucun push réel n'a été envoyé.
- Aucun paiement, billet, commande ou check-in n'a été créé.

Rollback staging ciblé :

```bash
cp /home/master/tbl-compliance-backups/wvvtwdcenn-20260821T180033Z-pre-notification-preferences/lamako-mobile-api.php /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/lamako-mobile-api.php
cp /home/master/tbl-compliance-backups/wvvtwdcenn-20260821T180033Z-pre-notification-preferences/includes/v2-commerce-concurrent-pre-notification.php /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
php -l /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/lamako-mobile-api.php
php -l /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
```

Après rollback, retester les routes publiques et vérifier que le token factice
`TBL-NOTIFICATION-PREF-QA-20260821` reste absent de l'option
`lamako_push_tokens`.

## Cache serveur du catalogue public - 21 août 2026

Les routes publiques utilisées par l'accueil, la liste des événements et la
boutique disposent maintenant d'un cache serveur court de deux minutes :

- `public/home-data` ;
- `public/events-data` ;
- `public/shop-data`.

Le cache est séparé par route et paramètres, expose les métadonnées `version`
et `generatedAt`, et s'invalide automatiquement après modification ou
suppression d'un événement ou produit, ainsi qu'après modification des
catégories concernées. Les fiches détaillées, le checkout, les stocks validés
pendant l'achat, les paiements et le seating restent hors de ce cache.

Déploiement staging ciblé :

- fichier actif avant déploiement :
  `a0df2a89a766166a708594fd4e76177e3f5ced2d8c8be5ae84330f2fe57c239a` ;
- fichier actif après fusion :
  `87afad4634b2bd092cf40a4ed1748cf94f40cbf12631230a714129ed74269c2d` ;
- backup :
  `/home/master/tbl-compliance-backups/wvvtwdcenn-20260821T200058Z-pre-catalog-server-cache/includes/v2-commerce.php`.

La fusion a été faite depuis le fichier réellement actif sur staging afin de
préserver les changements seating et paiement déployés en parallèle. Aucun
fichier de production n'a été modifié.

Mesures staging, contrat réellement utilisé par l'application :

- `home-data`, 12 événements et 8 produits : `12,5 Ko`, environ `3,0 s` à
  froid puis `1,4-1,6 s` à chaud ;
- `events-data`, limite 80 : `41,9 Ko`, environ `2,4 s` à froid puis `1,4 s` à
  chaud ;
- `shop-data`, limite 8 : `2 Ko`, environ `2,7 s` à froid puis `1,5-2,0 s` à
  chaud.

Les réponses exposent `X-Lamako-Catalog-Cache: MISS|HIT`. L'invalidation
contrôlée a fait progresser la version de cache de `1` à `2`, sans modifier de
donnée métier. Les warnings WP-CLI préexistants concernant les traductions
WooCommerce/Eventchamp, WP Mail SMTP PHP 8.4 et `theme-helper.php` restent à
traiter séparément.

Rollback staging :

```bash
cp -p /home/master/tbl-compliance-backups/wvvtwdcenn-20260821T200058Z-pre-catalog-server-cache/includes/v2-commerce.php /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
php -l /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
```

Après rollback, retester les trois routes catalogue, l'événement standard
`13842` et l'événement seating `12673`.

## Images catalogue adaptées aux cartes - 21 août 2026

Les listes événement et boutique utilisent désormais la variante WordPress
`medium_large` au lieu de `large`. Les fiches détaillées conservent la variante
`large`, afin de ne pas dégrader les visuels plein écran.

Contrôle staging sur l'événement `13842` :

- image catalogue : `768x429`, `418172` octets ;
- image détail : `1024x572`, `725223` octets ;
- économie catalogue observée : environ `42 %` pour ce visuel.

Le composant mobile partagé conserve `expo-image`, le cache mémoire/disque, le
placeholder et le recyclage des cellules. Cette modification agit donc sur le
poids réseau sans changer le layout ni les proportions des cartes.

Déploiement staging ciblé :

- fichier actif avant déploiement :
  `87afad4634b2bd092cf40a4ed1748cf94f40cbf12631230a714129ed74269c2d` ;
- fichier actif après fusion :
  `19c0dd956330717887d2e70c9d68bf6131abed0d584f29fda1efb5bbf391e426` ;
- backup :
  `/home/master/tbl-compliance-backups/wvvtwdcenn-20260821T201400Z-pre-catalog-image-sizing/includes/v2-commerce.php`.

Rollback staging :

```bash
cp -p /home/master/tbl-compliance-backups/wvvtwdcenn-20260821T201400Z-pre-catalog-image-sizing/includes/v2-commerce.php /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
php -l /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
```

## Regroupement des requêtes du wallet - 22 août 2026

La route authentifiée `GET /lamako-mobile/v2/orders?include_tickets=1` charge
désormais les instances Tickera des commandes visibles avec une requête
groupée. Le rendu conserve l'ordre historique des lignes WooCommerce et le
fallback `tc_orders` pour les anciennes commandes qui ne possèdent pas le lien
direct `item_id`.

Le déploiement a été fusionné depuis le fichier réellement actif sur staging,
afin de préserver les changements seating et paiement présents sur le serveur
mais issus d'un chantier parallèle. Aucun fichier de production n'a été
modifié.

Déploiement staging ciblé :

- fichier actif avant la fonctionnalité :
  `19c0dd956330717887d2e70c9d68bf6131abed0d584f29fda1efb5bbf391e426` ;
- fichier actif final :
  `15b1127000ba4a6cf156c913a85c24cc38de8b74bbf8048ef14f84afe4e9ee19` ;
- backup complet avant la fonctionnalité :
  `/home/master/tbl-compliance-backups/wallet-batch-20260822-070257/v2-commerce.php` ;
- backup intermédiaire avant la correction de l'ordre des billets :
  `/home/master/tbl-compliance-backups/wallet-order-20260822-071801/v2-commerce.php`.

Benchmark WP-CLI en lecture seule, sur le même compte anonymisé, 20 commandes
et 147 billets existants :

- chemin historique à froid : environ `172 ms`, `317` requêtes observées ;
- chemin groupé à froid : environ `65 ms`, `151` requêtes observées ;
- exécution finale avec caches amorcés : `129 ms` pour le chemin historique et
  `57 ms` pour le chemin groupé ; la recherche groupée des instances utilise
  une seule requête ;
- le nombre de commandes et de billets retournés est identique dans les deux
  modes.

QA après déploiement :

- route orders sans JWT : HTTP 401 attendu ;
- route orders avec JWT POS QA : HTTP 200, 4 commandes, contrat intact ;
- `public/home-data`, `public/events-data`, `public/shop-data` : HTTP 200 ;
- événement standard `13842` et événement seating `12673` : HTTP 200 ;
- PHP 8.4 local et serveur : aucune erreur de syntaxe ;
- TypeScript, ESLint et contrôle des secrets mobiles : OK ;
- Vitest : 202 tests réussis, 4 ignorés ;
- `git diff --check` : OK.

Le `debug.log` contient des erreurs de syntaxe WP-CLI provoquées par une
première tentative de benchmark mal échappée à `04:09 UTC`. Elles précèdent le
déploiement final et ne proviennent pas d'une requête web ou du plugin actif.

Rollback staging complet :

```bash
cp -p /home/master/tbl-compliance-backups/wallet-batch-20260822-070257/v2-commerce.php /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
php -l /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
```

Après rollback, retester la route orders avec et sans JWT, les trois routes
catalogue et les événements `13842` et `12673`.

## Builds QA consolidés - 22 août 2026

Les correctifs catalogue, wallet et notifications ont été regroupés dans un
seul candidat QA par plateforme, construit depuis le commit
`e44111c33d8f20251c318443a13af0f631afd6af`. Les deux builds pointent vers
`https://staging.ticketbylamako.com`. Aucun déploiement de production n'a été
effectué.

- Android staging APK, versionCode `52` :
  - build EAS : `19456a2c-a76c-40a8-8cad-708484c6a0c7` ;
  - artefact :
    `https://expo.dev/artifacts/eas/wCNqY6YrKYWKE4On8lx-7Fw3UPBlJ5BSZJ0BzOB57kM.apk` ;
  - statut : terminé.
- iOS staging/TestFlight, buildNumber `38` :
  - build EAS : `bcd22973-8603-4ba3-87ea-c94126e9e6b7` ;
  - statut build : terminé ;
  - soumission TestFlight terminée :
    `ba8d5a29-0a52-4515-bc49-52aca706cec4`.

QA physique requise avant toute promotion : authentification, catalogue et
images, événement standard, seating chart, panier, coupons, quatre moyens de
paiement, retour prestataire, Mes billets avec QR hors ligne et notifications.

## Affiches du wallet et carte Google Maps intégrée - 22 août 2026

Le contrat des billets expose désormais `eventImage`, dérivé de l'image mise en
avant du `tc_events` en taille `medium_large`. L'application l'utilise dans
`Mes billets` sans requête supplémentaire par carte. Les anciens billets ou les
événements sans image conservent l'icône billet comme fallback.

Les pages événement et détail billet chargent maintenant une vraie carte Google
Maps intégrée. Le bouton `Itinéraire vers le lieu` reste une action secondaire
et ouvre le guidage Google Maps. Une seule WebView est montée pour le billet
actif afin de ne pas multiplier le coût mémoire pour une commande multi-billets.

Déploiement staging ciblé :

- fichier PHP : `lamako-mobile-api/includes/v2-commerce.php` uniquement ;
- fichier actif final :
  `a55a6b8da19f1216214ee02a78b4646086ecac13327796c92b826ff1d2f1f3bc` ;
- backup avant déploiement :
  `/home/master/tbl-compliance-backups/event-map-20260822T152715Z/v2-commerce.php` ;
- aucun fichier de production modifié.

QA staging :

- PHP local et serveur : aucune erreur de syntaxe ;
- route commandes sans JWT : HTTP 401 attendu ;
- route publique `public/home-data` : HTTP 200 ;
- contrôle WP-CLI en lecture seule : 74 billets inspectés, 67 avec affiche ;
- les 7 billets sans affiche utilisent le fallback visuel de l'application ;
- ESLint, TypeScript et contrôle des secrets : OK ;
- Vitest : 211 tests réussis, 4 ignorés ;
- `git diff --check` : OK.

Rollback staging :

```bash
cp -p /home/master/tbl-compliance-backups/event-map-20260822T152715Z/v2-commerce.php /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
php -l /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
```

## Signature Apple et Google Wallet - 23 août 2026

La signature Wallet est active uniquement sur le staging. Les clés privées sont
stockées hors du webroot et hors Git. L'API mobile expose des liens Wallet
signés uniquement pour les billets appartenant à une commande payée et au
client authentifié.

- disponibilité serveur vérifiée : Apple `true`, Google `true` ;
- Pass Type ID Apple : `pass.com.ticketbylamako.eventticket` ;
- Google Wallet issuer : `3388000000023176380` ;
- projet Google Cloud dédié : `ticketbylamako-wallet-stg` ;
- compte de service Google enregistré comme développeur Wallet, sans rôle Cloud
  global ;
- compte Google de QA ajouté aux testeurs du mode démo ;
- billet payé staging `14115`, commande `14114` : lien signé Google généré,
  classe `event_13839` créée et active, pass ajouté au Wallet avec événement,
  dates, lieu, titulaire, numéro et QR code ;
- aucune modification de production.

Backup `wp-config.php` avant activation Google :

```text
/home/master/tbl-compliance-backups/wallet-google-20260823-193757/wp-config.php
```

Rollback Google staging : restaurer ce `wp-config.php`, purger le cache, puis
vérifier que `lamako_mobile_v2_wallet_availability()` retourne Google `false`.
En cas de suspicion sur la clé, la révoquer dans Google Cloud avant d'en créer
une nouvelle. Le JSON de compte de service ne doit jamais être copié dans le
dépôt, un log ou une réponse API.

La fiche d'établissement Google est désormais complète et liée au profil de
paiement validé `LAMAKO EVENTS` (Organisation, Madagascar). Elle contient la
catégorie `Theatrical Ticket Agencies (7922)`, le site et les coordonnées de
support TicketByLamako. Google l'a placée en vérification.

La demande d'accès en publication Google Wallet a été soumise le 23 août 2026.
La checklist Console affiche `3/3`, `100 %` et une réponse annoncée sous deux à
trois jours ouvrés. Le mode démo et le testeur autorisé restent utilisables
pendant l'examen. Après approbation, les classes actives seront publiées
automatiquement ; aucun fichier de production n'a été modifié dans cette étape.

## Stabilisation client, seating et branding Wallet - 25 août 2026

Ce lot reste limité à l'application client et à son API staging. Il corrige le
formulaire participant avant paiement, l'autorisation calendrier, la gestion
des notifications, le récapitulatif du paiement, le seating mobile et le logo
des passes Wallet. Aucun fichier de production, POS ou back-office n'a été
modifié.

Déploiement staging ciblé :

- `includes/v2-commerce.php` : couche d'interaction Tickera issue du correctif
  POS validé, sans sa logique POS, checkout ou paiement ;
- `includes/v2-wallet.php` : génération Apple/Google avec wordmark
  TicketByLamako ;
- `assets/wallet-logo.png` : wordmark horizontal versionné et public en HTTPS ;
- empreinte locale `v2-commerce.php` :
  `25756dd24c60bb975b0f4e3dc9ec5c6fd5d001ee1a64f89a9aa717fc9a5a84c1` ;
- empreinte locale `v2-wallet.php` :
  `612b6eafeeeb8f402349a63be29efe35fcb78f24b85e0738d6d4e8301e15047f` ;
- empreinte `wallet-logo.png` :
  `e1a459a1e85243b14aa6aaebdbd2aeec163aad858df27b3994387fc993bf8449`.

Points de rollback staging :

```text
/home/master/tbl-compliance-backups/client-ux-wallet-seating-20260824T204352Z
/home/master/tbl-compliance-backups/client-wallet-logo-20260824T210000Z
```

Rollback complet du code PHP :

```bash
cp -p /home/master/tbl-compliance-backups/client-ux-wallet-seating-20260824T204352Z/v2-commerce.php /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
cp -p /home/master/tbl-compliance-backups/client-ux-wallet-seating-20260824T204352Z/v2-wallet.php /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-wallet.php
rm -f /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/assets/wallet-logo.png
php -l /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php
php -l /home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-wallet.php
```

QA effectuée :

- session seating éphémère créée sur l'événement `12673`, sans commande ni
  paiement ; page de plan complète, viewport zoomable, interactions restaurées
  et script FunnelKit absent ;
- formulaire checkout présent pour l'événement QA `13842` et absent pour
  l'événement standard `13839`, conformément à la réponse serveur ;
- pass Apple signé réellement généré depuis le billet QA `14115` : archive
  valide, `logo.png` et `logo@2x.png` présents, signature présente ;
- JWT Google signé vérifié sans l'ouvrir : classe
  `event_13839_v2`, objet `ticket_14115_v2` et wordmark HTTPS en
  `200 image/png`. Le suffixe `v2` évite de réutiliser une ancienne classe sans
  branding ;
- routes catalogue publiques en HTTP 200 et route commandes sans JWT en HTTP
  401 attendu ;
- les notices WooCommerce/Eventchamp et la dépréciation WP Mail SMTP observées
  en WP-CLI existaient avant ce lot et ne sont pas des erreurs du plugin mobile.
