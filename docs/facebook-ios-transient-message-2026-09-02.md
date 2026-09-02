# Facebook iOS — message transitoire non reproductible

**Statut :** authentification réussie; message « Something went wrong » non reproductible; aucun changement de code ou de configuration appliqué

**Date :** 2 septembre 2026  
**Auteur :** Manus AI  
**Dépôt :** `jvalentin-azure/ticketbylamako-app`  
**Branche :** `fix/apple-social-json-response-20260902`  
**Pull request :** [#8](https://github.com/jvalentin-azure/ticketbylamako-app/pull/8)

## 1. Résumé

Lors d’un premier essai sur iPhone, Facebook a brièvement affiché **« Something went wrong »** avant de retourner dans TicketByLamako. Malgré ce message, l’authentification a réussi et le compte s’est affiché dans l’application. Le propriétaire n’a ensuite plus réussi à reproduire le message.

Les preuves Cloudways confirment que Facebook a atteint le callback TicketByLamako depuis un iPhone, que WordPress et Nginx ont répondu HTTP 200 et que l’application a terminé le login. Les URI OAuth, l’identifiant Facebook public et le secret serveur sont correctement configurés. Aucun défaut fonctionnel reproductible n’est donc présent au moment de la clôture.

> **Décision :** ne pas modifier un flux Facebook fonctionnel à partir d’un message visuel transitoire non reproductible. Conserver les preuves et appliquer le protocole de capture ci-dessous uniquement en cas de récidive.

## 2. Résultats réels sur iPhone

| Fournisseur | Résultat rapporté | Compte visible | État |
|---|---|---:|---|
| Apple | Connexion réussie après le correctif WordPress | Oui | Validé |
| Google | Connexion réussie sur iPhone | Oui | Validé |
| Facebook | Connexion réussie malgré un premier message transitoire | Oui | Validé; message non reproductible |

La trace privée Cloudways du test Facebook a été enregistrée à `2026-09-02T18:44:09Z` sans identité, email ni jeton. Elle référence le callback observé à `2026-09-02T18:30:13Z` et confirme que le hash du plugin Apple actif est resté inchangé.

## 3. Flux Facebook iOS confirmé

Le client ouvre le dialogue OAuth Facebook au moyen de `WebBrowser.openAuthSessionAsync()`. Sur iOS, cette API utilise `ASWebAuthenticationSession`.[1] Le flux actuel est le suivant :

| Étape | Composant | Action |
|---:|---|---|
| 1 | `lib/api/social-auth.ts` | Génère un `state` aléatoire contenant le retour applicatif `ticketbylamako://oauth/facebook-callback`. |
| 2 | Facebook | Ouvre `https://www.facebook.com/v24.0/dialog/oauth` avec `response_type=token`. |
| 3 | Meta OAuth | Retourne vers l’URI HTTPS autorisée `https://www.ticketbylamako.com/lamako-mobile/oauth/facebook-callback`. |
| 4 | WordPress | Sert une page relais HTTP 200 qui lit le fragment et appelle `window.location.replace()` après 120 ms. |
| 5 | iOS | Ouvre `ticketbylamako://oauth/facebook-callback` et rend le résultat à l’application. |
| 6 | Application | Vérifie le `state`, récupère le token Facebook et l’envoie à `/wp-json/lamako-mobile/v1/social-login`. |
| 7 | WordPress | Vérifie le token auprès de Facebook, crée ou relie l’identité, puis retourne le JWT TicketByLamako. |

Meta documente que `redirect_uri` doit correspondre à une URI autorisée, que `state` doit être renvoyé sans modification et que `response_type=token` place le token dans le fragment d’URL.[2] Le flux TicketByLamako suit ce modèle et vérifie le token côté serveur.

## 4. Preuves Cloudways

Les journaux d’accès contiennent les entrées suivantes, sans paramètres OAuth ni jeton :

| Couche | Heure UTC | Requête | Statut | Référent | Client |
|---|---|---|---:|---|---|
| WordPress backend | 18:30:13 | `GET /lamako-mobile/oauth/facebook-callback` | 200 | `https://m.facebook.com/` | iPhone OS 18.7 |
| Nginx | 18:30:15 | `GET /lamako-mobile/oauth/facebook-callback` | 200 | `https://m.facebook.com/` | iPhone OS 18.7 |

La requête PHP s’est terminée normalement. Le propriétaire confirme ensuite que le compte Facebook est ouvert dans l’application. Ces deux preuves excluent un rejet du callback, une erreur HTTP du serveur ou un échec fonctionnel du deep link pendant ce test.

## 5. Configuration vérifiée

### 5.1 WordPress

| Paramètre | Valeur vérifiée |
|---|---|
| Facebook App ID | `1642777483642147` |
| Secret serveur | Présent; valeur jamais affichée ni enregistrée |
| Callback calculé | `https://www.ticketbylamako.com/lamako-mobile/oauth/facebook-callback` |
| Domaine WordPress | `https://www.ticketbylamako.com/` |

### 5.2 Meta for Developers

L’application Meta `ticketbylamako.com` est **publiée**. Les options OAuth client, OAuth Web, HTTPS, navigateur intégré et mode strict sont activées. Les URI valides visibles comprennent notamment :

| URI autorisée | Usage |
|---|---|
| `https://www.ticketbylamako.com/lamako-mobile/oauth/facebook-callback` | Callback du client iOS actuel |
| `https://staging.ticketbylamako.com/lamako-mobile/oauth/facebook-callback` | Staging |
| `https://www.ticketbylamako.com/wp-json/lamako-mobile/v1/social-login/callback` | Ancien ou autre parcours |
| `https://www.ticketbylamako.com/wp-login.php?loginSocial=facebook` | Parcours WordPress historique |

Le validateur Meta indique que `ticketbylamako://oauth/facebook-callback` n’est pas actuellement une URI valide, car elle n’est pas dans cette liste. Aucun réglage Meta n’a été modifié ou enregistré pendant le diagnostic.

La page des paramètres généraux montre les domaines `ticketbylamako.com` et `staging.ticketbylamako.com`, mais aucune plateforme iOS dédiée. Le flux actuel est un OAuth Web manuel; une plateforme iOS deviendrait nécessaire ou pertinente lors d’une migration vers un SDK Facebook natif.

## 6. Diagnostic différentiel

| Hypothèse | Preuve | Conclusion |
|---|---|---|
| Callback HTTPS non autorisé | URI présente exactement dans Meta et mode strict actif | Écartée |
| Erreur WordPress ou Nginx | Deux réponses HTTP 200 pendant le test | Écartée |
| Token Facebook non reçu ou invalide | Le compte s’ouvre dans l’application | Écartée pour le test observé |
| Deep link iOS non traité | Retour dans l’application et compte visible | Écartée pour le test observé |
| Erreur durable de configuration Meta | Le message n’est plus reproductible | Non démontrée |
| Anomalie visuelle transitoire pendant la transition à deux étapes | Compatible avec le succès complet et l’absence de récidive | Possible, non prouvée |

Sans capture de l’écran transitoire, il est impossible d’attribuer avec certitude le texte à Meta, au navigateur d’authentification ou à une transition d’interface. Une modification immédiate serait donc spéculative.

## 7. Options étudiées et non appliquées

### 7.1 Utiliser directement le schéma de l’application

Expo indique que le callback d’`openAuthSessionAsync()` sur iOS peut utiliser le schéma déclaré dans l’application.[1] Cette approche supprimerait la page relais HTTPS. Elle exigerait toutefois d’ajouter et valider une URI personnalisée dans Meta, de retester l’ensemble du flux et potentiellement de publier une nouvelle version du client. Meta ne considère pas actuellement cette URI comme valide.

### 7.2 Utiliser un Universal Link HTTPS

Le binaire déclare les domaines associés, mais les deux emplacements Apple App Site Association retournent HTTP 404 :

| URL | Résultat |
|---|---|
| `https://www.ticketbylamako.com/.well-known/apple-app-site-association` | HTTP 404, HTML WordPress |
| `https://www.ticketbylamako.com/apple-app-site-association` | HTTP 404, HTML WordPress |

L’option `preferUniversalLinks` d’Expo ne doit pas être activée tant que le domaine ne publie pas une association Apple valide.[1]

### 7.3 Migrer vers le SDK Facebook natif

Expo recommande d’utiliser une bibliothèque du fournisseur lorsqu’elle existe, notamment `react-native-fbsdk-next` pour Facebook.[3] Cette migration constitue une amélioration d’architecture nécessitant une plateforme iOS Meta, une configuration native et un nouveau build. Elle n’est pas justifiée comme correctif d’urgence pour un message non reproductible alors que le login réussit.

## 8. Décision de non-changement

Aucun fichier de production, réglage Meta ou code client n’a été modifié pour Facebook. Cette décision protège les parcours Apple, Google et Facebook déjà validés et évite d’introduire une régression à partir d’une hypothèse visuelle non confirmée.

Le garde-fou WordPress déployé pour Apple reste actif avec le SHA-256 :

`e75bc568ed9d7972d0609e0e11a53acc4b276488b2f3a3853ffed0192d746b98`

## 9. Protocole en cas de récidive

Si le message réapparaît, il faut démarrer un enregistrement d’écran avant de lancer Facebook, noter l’heure locale ou UTC, et indiquer si le compte s’ouvre malgré le message. La vidéo ne doit pas montrer un mot de passe, un code à usage unique, un token, l’adresse email complète ou d’autres données personnelles.

Le contrôle serveur doit ensuite rechercher uniquement l’URI `/lamako-mobile/oauth/facebook-callback` autour de l’heure fournie et relever le statut HTTP, la durée, le référent et le type de client. Les paramètres `access_token`, `code` et `state` doivent toujours être supprimés des extraits. Si le callback reste HTTP 200 et le compte s’ouvre, l’incident demeure visuel. Si le callback échoue, ouvrir un correctif distinct à partir des preuves.

## 10. Consignes de reprise pour Codex

Ne pas ajouter aujourd’hui `ticketbylamako://oauth/facebook-callback` dans Meta et ne pas remplacer le callback HTTPS. Ne pas créer de plateforme iOS Meta ni introduire `react-native-fbsdk-next` sans une décision explicite de migration et un plan de build App Store.

La source principale est `lib/api/social-auth.ts`; la page relais est dans `scripts/lamako-mobile-api.php`, fonction `lamako_mobile_maybe_serve_facebook_oauth_callback()`. Le callback serveur Web distinct se trouve dans `scripts/lamako-mobile-api/includes/web-facebook-auth.php` et ne gère que le flux `code` avec session WordPress.

L’état final du 2 septembre 2026 est : Apple réussi, Google réussi, Facebook réussi, message Facebook non reproductible, et aucune modification Facebook nécessaire.

## 11. Références

[1]: https://docs.expo.dev/versions/latest/sdk/webbrowser/ "Expo WebBrowser — openAuthSessionAsync et retours iOS"
[2]: https://developers.facebook.com/documentation/facebook-login/guides/advanced/manual-flow "Meta for Developers — Manually Build a Login Flow"
[3]: https://docs.expo.dev/versions/latest/sdk/auth-session/ "Expo AuthSession — recommandation d’utiliser la bibliothèque du fournisseur"
