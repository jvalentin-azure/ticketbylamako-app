# Incident « Continuer avec Apple » — diagnostic, correctif et reprise

**Statut :** garde-fou WordPress déployé; connexions Apple, Google et Facebook validées sur iPhone
**Date du diagnostic :** 2 septembre 2026  
**Auteur :** Manus AI  
**Dépôt :** `jvalentin-azure/ticketbylamako-app`  
**Branche de reprise :** `fix/apple-social-json-response-20260902`  
**Base analysée :** `origin/feat/client-mobile-web-20260827` au commit `d9520c7a01f233ad0d4ff70c131b410da3de25da`

## 1. Résumé exécutif

La connexion par email, Google et Facebook fonctionne dans l’application publiée. Le défaut signalé concerne **« Continuer avec Apple » sur iPhone**. Après la feuille d’authentification Apple, l’écran de connexion affiche le message brut suivant :

> `JSON Parse error: Unexpected character: <`

Ce message prouve que le client React Native a tenté de décoder comme JSON une réponse commençant par `<`, donc vraisemblablement une page HTML. Le défaut client est confirmé : la fonction `socialLogin()` appelait directement `res.json()` lorsque le serveur répondait avec un statut HTTP réussi, sans vérifier le corps ni le type de contenu.

Le point d’accès WordPress de production répond correctement en JSON à trois sondes Apple non authentifiantes. L’HTML n’est donc pas produit par la validation initiale du format, de l’algorithme ou de la signature du jeton. La cause serveur exacte demeure à confirmer dans les journaux de production. L’hypothèse la plus probable est une sortie HTML parasite ou une exception déclenchée après la validation d’un vrai jeton Apple, pendant la liaison/création du compte WordPress, l’exécution d’un hook ou la génération du JWT utilisateur.

Le correctif préparé agit aux deux frontières. Le client lit maintenant le corps une seule fois, détecte une réponse vide, HTML ou illisible et affiche une erreur claire. Le serveur enveloppe la route sociale dans un tampon de sortie, supprime toute sortie parasite de la réponse REST, transforme les exceptions non gérées en `WP_Error` JSON et écrit uniquement des métadonnées non sensibles dans les journaux.

## 2. Portée et état de confiance

| Élément | Conclusion | Confiance |
|---|---|---:|
| Plateforme concernée | iOS/iPhone, et non Android | Élevée |
| Capacité Apple du binaire | `usesAppleSignIn: true`, plugin Expo présent, bundle `com.ticketbylamako.app` | Élevée |
| Étape de rupture | Après l’obtention de l’identité Apple, pendant l’échange avec WordPress | Élevée |
| Défaut client | Décodage JSON non défensif sur une réponse HTTP réussie | Confirmé |
| Validation Apple côté serveur | Signature RS256, clés Apple, audience, expiration et nonce sont contrôlés | Confirmé |
| Résolution opérationnelle | Le garde-fou serveur rétablit le login Apple; aucune récidive ni trace d’exception pendant le test réel | Confirmé |
| Correctif de production | Garde-fou WordPress actif; client React Native non publié | Confirmé |

## 3. Chronologie détaillée

| Étape | Action réalisée | Résultat et preuve |
|---:|---|---|
| 1 | Réception de l’archive de captures WhatsApp | Les images ont été extraites dans un dossier de travail hors du dépôt. Elles ne sont pas versionnées afin d’éviter d’enregistrer des données personnelles. |
| 2 | Création d’une planche de contact et lecture des captures | L’interface et la barre d’état confirment un iPhone. Le message exact est `JSON Parse error: Unexpected character: <`. |
| 3 | Recherche des dépôts GitHub du propriétaire | Le dépôt d’application `jvalentin-azure/ticketbylamako-app` a été identifié et cloné en lecture locale. |
| 4 | Traçage du flux Apple | `expo-apple-authentication` renvoie un `identityToken`; `socialLogin()` l’envoie à `POST /wp-json/lamako-mobile/v1/social-login`; le serveur vérifie le jeton puis crée ou relie l’utilisateur. |
| 5 | Comparaison des branches | La branche `main` ne correspond pas au binaire visible. La branche `feat/client-mobile-web-20260827`, finalisée le 29 août, correspond à la version publiée et au design des captures. |
| 6 | Vérification de la fiche publique Apple | L’API Apple confirme le bundle `com.ticketbylamako.app`, la version publique `1.0` et une version courante datée du 29 août 2026.[1] |
| 7 | Vérification de la configuration iOS | La branche de publication contient `ios.usesAppleSignIn: true` et le plugin `expo-apple-authentication`, conformément aux exigences Expo.[2] |
| 8 | Vérification du nonce | La source native Expo SDK 54 affecte directement `options.state` et `options.nonce` à la requête iOS; aucune transformation cachée n’explique le défaut.[3] |
| 9 | Sonde serveur : token mal formé | La route retourne une erreur HTTP 401 en JSON. Aucun compte n’est créé. |
| 10 | Sonde serveur : algorithme interdit | La route retourne `social_token_algorithm` en JSON. Aucun compte n’est créé. |
| 11 | Sonde serveur : JWT RS256 réaliste avec signature invalide | La route récupère les clés Apple, ne redirige pas et retourne `social_signature_invalid` en JSON. Aucun compte n’est créé.[4] |
| 12 | Tentative d’accès aux journaux WordPress | L’administration exige une connexion et la reprise du navigateur n’était pas disponible. Aucun journal de production n’a été consulté. |
| 13 | Création du correctif | Une branche isolée `fix/apple-social-json-response-20260902` a été créée depuis la branche de publication. |
| 14 | Validation locale | TypeScript, syntaxe PHP, tests ciblés et suite complète réussissent. |
| 15 | Rétablissement de l’accès Cloudways | Clé SSH dédiée ajoutée par le propriétaire; hôte et application de production vérifiés. |
| 16 | Sauvegarde de production | Fichier actif et module de sécurité copiés dans un dossier privé horodaté avec manifestes SHA-256. |
| 17 | Réconciliation production/Git | Après normalisation CRLF/LF, la production active et la base Git sont identiques. |
| 18 | Déploiement atomique | Le garde-fou WordPress a remplacé le fichier actif avec rollback automatique et vérification PHP/hash. |
| 19 | Postflight et déverrouillage | Site, route sociale et routes de contenu réussis; résultats consignés; verrou supprimé. |
| 20 | Test Apple réel | Le propriétaire confirme une authentification réussie et l’affichage de son compte; aucune trace d’erreur ciblée. |
| 21 | Test Google sur iPhone | Le propriétaire confirme une authentification réussie. |
| 22 | Test Facebook sur iPhone | Le compte s’ouvre; le callback répond HTTP 200; un message visuel aperçu une fois n’est plus reproductible. |

## 4. Flux technique analysé

| Couche | Fichier | Responsabilité |
|---|---|---|
| Interface iOS | `components/auth/social-auth-buttons.tsx` | Affiche le bouton Apple natif, lance le flux et présente le message d’erreur. |
| Client Apple | `lib/api/social-auth.ts` | Génère `state` et `nonce`, appelle Apple, transmet le jeton d’identité à WordPress et enregistre la session. |
| Route REST | `scripts/lamako-mobile-api.php` | Enregistre `/lamako-mobile/v1/social-login`, valide le fournisseur, crée/relie l’utilisateur et génère le JWT. |
| Vérification OIDC | `scripts/lamako-mobile-api/includes/social-auth-security.php` | Vérifie RS256, `kid`, signature, émetteur, audience, expiration et nonce. |

Apple recommande d’associer la session d’authentification au jeton au moyen du nonce et de vérifier les jetons côté serveur.[5] Le projet suit ce principe. Expo confirme aussi que `identityToken`, `state` et `nonce` constituent les données attendues du flux natif iOS.[2]

## 5. Diagnostic différentiel

| Hypothèse | Contrôle | Conclusion |
|---|---|---|
| La fonctionnalité Apple n’est pas activée dans le binaire | Lecture de `app.config.ts` de la branche publiée | Écartée : capacité et plugin présents. |
| Le bundle reçu par le serveur ne correspond pas à l’app | Configuration serveur et API Apple publique | Écartée à ce stade : `com.ticketbylamako.app` est autorisé et correspond à la fiche. |
| Expo transforme le nonce et provoque un rejet | Lecture de la source native SDK 54 | Écartée : le nonce est transmis directement. |
| La longueur ou la forme d’un vrai JWT déclenche une redirection HTML | Sonde RS256 de taille réaliste avec `kid` Apple actuel | Écartée : réponse 401 JSON, zéro redirection. |
| La validation cryptographique Apple ne fonctionne pas | Sonde avec une signature invalide | Écartée : le serveur atteint bien le contrôle de signature et retourne l’erreur attendue. |
| Une étape post-validation produit de l’HTML | Déduction à partir du message client et des sondes | Hypothèse principale; elle nécessite un essai avec un vrai compte Apple et le journal serveur. |

## 6. Modifications apportées

### 6.1 Client React Native

Le fichier `lib/api/social-auth.ts` contient désormais `parseSocialApiResponse()`. Cette fonction lit le corps avec `response.text()`, retire un éventuel BOM, refuse une réponse vide, détecte une page HTML ou un contenu illisible, puis appelle `JSON.parse()` dans un bloc contrôlé. La réponse n’est lue qu’une fois, ce qui préserve les messages JSON normaux du serveur et empêche l’erreur native opaque `Unexpected character: <`.

Le message utilisateur devient explicite, par exemple :

> `Le service de connexion apple a renvoyé une page HTML au lieu du JSON attendu (200). Veuillez réessayer.`

Cette modification s’applique à Apple, Google, Facebook et au parcours web sans changer leurs contrats JSON.

### 6.2 Serveur WordPress

La route `social-login` appelle désormais `lamako_mobile_social_login_json_guard()`. Ce garde-fou démarre un tampon de sortie avant le traitement, capture toute sortie inattendue provenant d’un hook ou d’un avertissement, puis retourne uniquement l’objet REST. Une exception `Throwable` non gérée devient une erreur REST `social_login_server_error` avec le statut 500.

Le journal ne contient ni jeton Apple, ni email, ni nom, ni corps HTML. Il conserve uniquement le fournisseur, le type d’exception, le code, le nombre d’octets supprimés et le SHA-256 du contenu supprimé. Cette stratégie permet la corrélation technique sans exposer de données d’authentification.

### 6.3 Tests de non-régression

Le fichier `tests/social-auth-security.test.ts` impose désormais que le client utilise `response.text()`, détecte l’HTML avant le décodage JSON et n’appelle plus `res.json()` dans le flux social. Il vérifie aussi que la route WordPress est reliée au garde-fou, démarre un tampon de sortie et retourne une erreur REST contrôlée en cas d’exception.

## 7. Résultats de validation

| Contrôle | Commande | Résultat |
|---|---|---|
| TypeScript | `pnpm check` | Réussi |
| Tests ciblés | `pnpm exec vitest run tests/social-auth-security.test.ts` | 13 tests réussis |
| Suite complète | `pnpm test` | 67 fichiers réussis, 3 ignorés; 353 tests réussis, 4 ignorés |
| Syntaxe PHP principale | `php -l scripts/lamako-mobile-api.php` | Aucune erreur |
| Syntaxe du module de sécurité | `php -l scripts/lamako-mobile-api/includes/social-auth-security.php` | Aucune erreur |
| Hygiène Git | `git diff --check` | Réussi |

## 8. Limites actuelles

L’accès SSH Cloudways a ensuite été rétabli et le garde-fou serveur déployé. Les journaux ont été recherchés uniquement sur le préfixe `[Lamako Social Auth]`. Aucune ligne n’est apparue pendant les sondes invalides ni après le login Apple réel réussi. Le correctif est donc validé opérationnellement, même si l’émetteur historique de la réponse HTML n’a pas pu être reproduit après protection.

Aucun jeton Apple réel n’a été collecté ou enregistré. Les sondes ont utilisé des jetons factices volontairement invalides et n’ont créé, modifié ou lié aucun compte.

## 9. Procédure de déploiement recommandée

| Ordre | Opération | Critère de réussite |
|---:|---|---|
| 1 | Déployer d’abord `scripts/lamako-mobile-api.php` et les fichiers `includes` déjà associés sur un environnement de staging ou de production contrôlé. | Une sonde invalide retourne toujours un objet JSON et le site reste opérationnel. |
| 2 | Purger uniquement le cache REST/CDN relatif à `/wp-json/lamako-mobile/v1/social-login`, si un cache existe. | La route exécute le nouveau callback. |
| 3 | Tester « Continuer avec Apple » sur un iPhone réel avec un compte de test. | La connexion crée ou relie le compte et ouvre la session. |
| 4 | Rechercher dans le journal le préfixe `[Lamako Social Auth]`. | Aucun message, ou une ligne `Suppressed unexpected output` permettant d’identifier le hook fautif. |
| 5 | Si le serveur fonctionne mais que le binaire actuel affiche encore l’erreur brute, publier le correctif client par le canal compatible avec la politique `runtimeVersion`; sinon produire un nouveau build iOS. | Le message brut de parsing n’apparaît plus. |
| 6 | Rejouer email, Google et Facebook. | Les trois parcours existants restent fonctionnels. |

Le déploiement WordPress doit précéder le nouveau build iOS, car il peut résoudre immédiatement le problème pour le binaire déjà publié. Le correctif client reste nécessaire pour empêcher qu’une réponse non JSON future soit présentée comme une erreur technique incompréhensible.

## 10. Procédure de test Apple

Le test doit être effectué sur un iPhone réel, conformément aux recommandations Expo.[2] Il faut tester une première autorisation et une autorisation répétée, car Apple ne renvoie le nom que lors de la première autorisation tandis que le jeton d’identité continue de porter les informations vérifiables pertinentes.[5]

| Scénario | Résultat attendu |
|---|---|
| Premier login, email réel partagé | Compte créé ou relié, prénom/nom stockés si fournis. |
| Premier login, email masqué | Compte créé avec l’adresse relais Apple vérifiée. |
| Login répété, nom absent | Compte retrouvé par l’identifiant Apple; aucune création en double. |
| Compte WordPress existant avec même email | Identité Apple reliée au compte existant. |
| Annulation de la feuille Apple | Retour silencieux à l’écran de connexion, sans erreur. |
| Erreur serveur JSON | Message serveur lisible affiché. |
| Réponse serveur HTML | Message contrôlé « page HTML au lieu du JSON attendu ». |

## 11. Retour arrière

Le retour arrière est limité et déterministe. Côté WordPress, il consiste à remettre le callback de la route sur `lamako_mobile_social_login` et à supprimer `lamako_mobile_social_login_json_guard()`. Côté client, il consiste à restaurer le décodage précédent, bien que ce retour ne soit pas recommandé puisqu’il réintroduit l’erreur opaque.

Avant toute restauration, conserver les lignes `[Lamako Social Auth]` et le statut HTTP observé; elles constituent la meilleure preuve de la sortie parasite. Ne jamais copier dans un ticket Git un jeton d’identité, un JWT WordPress, une adresse relais Apple complète ou le corps HTML brut susceptible de contenir des données personnelles.

## 12. Consignes de reprise pour Codex

La reprise doit commencer sur `fix/apple-social-json-response-20260902`, sans repartir de `main`. La base du binaire publié est `origin/feat/client-mobile-web-20260827`, commit `d9520c7a01f233ad0d4ff70c131b410da3de25da`. Le diff utile porte uniquement sur `lib/api/social-auth.ts`, `scripts/lamako-mobile-api.php`, `tests/social-auth-security.test.ts` et le présent journal.

Le garde-fou WordPress est déployé et les connexions Apple, Google et Facebook ont réussi sur iPhone. Ne pas redéployer ou retirer le garde-fou tant que son hash actif correspond au journal de production. Le message Facebook `Something went wrong` est non reproductible; ne pas modifier Meta ni le callback sans une nouvelle preuve. Le diagnostic et le protocole de récidive sont dans `docs/facebook-ios-transient-message-2026-09-02.md`. Toute instrumentation supplémentaire doit journaliser des étapes et identifiants de corrélation, jamais les jetons ou informations personnelles.

Si la route retourne une erreur JSON `social_nonce_invalid`, vérifier que le nonce transmis par `startAppleLogin()` correspond au claim du jeton. La source Expo consultée montre toutefois que le nonce est transmis sans transformation dans cette version, donc aucune modification de hachage ne doit être introduite sans une preuve issue du jeton décodé de façon sûre.[3]

## 13. Livraison Git

| Élément | Référence |
|---|---|
| Branche distante | `fix/apple-social-json-response-20260902` |
| Commit du correctif | `06ac889` — `fix(auth): harden Apple social login JSON handling` |
| Commit de documentation initial | `852a03d` — `docs(auth): record Apple sign-in incident handoff` |
| Pull request | [#8 — fix(auth): harden iOS Apple sign-in response handling](https://github.com/jvalentin-azure/ticketbylamako-app/pull/8) |
| Branche cible de la PR | `feat/client-mobile-web-20260827` |
| État au moment du diagnostic | Ouverte, en brouillon et fusionnable; aucun contrôle distant configuré n’est remonté |

Les connexions Apple, Google et Facebook ont été rejouées avec succès sur iPhone. Le message Facebook aperçu une fois est non reproductible et ne justifie aucun changement. La pull request reste volontairement en brouillon jusqu’à la décision concernant le correctif défensif client et la vérification finale de la connexion directe par email. La branche distante et la PR constituent le point de reprise officiel pour Codex.

## 14. Déploiement production du 2 septembre 2026

Le garde-fou WordPress a été déployé sur l’application Cloudways de production `bvprmuerhv`. Le fichier actif possède désormais le SHA-256 `e75bc568ed9d7972d0609e0e11a53acc4b276488b2f3a3853ffed0192d746b98`. La sauvegarde exacte pré-déploiement possède le SHA-256 `0613564f2be9037af5d48020045ae9167fed278c3f76131d7d79ef229bf46a11` et se trouve dans un dossier privé du serveur.

Le postflight a validé la page d’accueil, les réponses JSON de la route sociale, la syntaxe PHP, l’activation du plugin et les routes `home-data`, `events-data` et `shop-data`. Le verrou de déploiement a été libéré. À `2026-09-02T18:29:54Z`, le propriétaire a confirmé que « Continuer avec Apple » ouvre correctement son compte; Google et Facebook ont ensuite réussi sur le même iPhone. Le hash actif est resté inchangé et aucune ligne d’erreur ciblée n’a été relevée. Le détail complet, les horaires, chemins, hashes, commandes de rollback et résultats iPhone sont consignés dans [`docs/apple-sign-in-production-deployment-2026-09-02.md`](apple-sign-in-production-deployment-2026-09-02.md). L’anomalie visuelle Facebook non reproductible est documentée dans [`docs/facebook-ios-transient-message-2026-09-02.md`](facebook-ios-transient-message-2026-09-02.md).

## 15. Références

[1]: https://itunes.apple.com/lookup?id=6793957219&country=us "Apple Lookup API — TicketByLamako"
[2]: https://docs.expo.dev/versions/latest/sdk/apple-authentication/ "Expo SDK — AppleAuthentication"
[3]: https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo-apple-authentication/ios/AppleAuthenticationRequest.swift "Expo SDK 54 — AppleAuthenticationRequest.swift"
[4]: https://appleid.apple.com/auth/keys "Apple — Public keys for Sign in with Apple"
[5]: https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple "Apple Developer — Authenticating users with Sign in with Apple"
