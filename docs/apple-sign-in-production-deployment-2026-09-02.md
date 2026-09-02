# Déploiement production — garde-fou « Continuer avec Apple »

**Statut :** garde-fou WordPress déployé et postflight réussi; test réel Apple sur iPhone en attente  
**Date :** 2 septembre 2026  
**Auteur :** Manus AI  
**Pull request :** [#8 — `fix(auth): harden iOS Apple sign-in response handling`](https://github.com/jvalentin-azure/ticketbylamako-app/pull/8)  
**Commit du correctif :** `06ac889`

## 1. Autorisation et périmètre

Le propriétaire a explicitement autorisé l’intervention sur Cloudways par SSH. Le déploiement a été limité au garde-fou serveur contenu dans le fichier principal du plugin `lamako-mobile-api`. La pull request n’a pas été fusionnée, le correctif React Native n’a pas été publié, aucun autre plugin, cache, réglage WordPress, compte ou contenu n’a été modifié.

| Élément | Valeur vérifiée |
|---|---|
| Domaine de production | `https://www.ticketbylamako.com` |
| Adresse du serveur | `139.84.234.183` |
| Nom d’hôte distant | `1525593.cloudwaysapps.com` |
| Application Cloudways | `bvprmuerhv` |
| Racine WordPress | `/home/master/applications/bvprmuerhv/public_html` |
| Fichier actif ciblé | `/home/master/applications/bvprmuerhv/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api.php` |
| Empreinte de la clé d’hôte RSA | `SHA256:WvG6SN1KhYdCCDnU5avyizL+3nVuLm9KSk88Kit+Oy0` |
| Empreinte de la clé de déploiement dédiée | `SHA256:p6lNsf4CTqFqWxOAD5iik5zz4JvOjy1LSeEGj8V1hNU` |

## 2. Chronologie d’exécution

| Heure UTC | Étape | Résultat |
|---|---|---|
| 18:15:06 | Acquisition atomique du verrou | Verrou créé dans `/home/master/applications/bvprmuerhv/tmp/.tbl-wordpress-mono-writer`. |
| 18:16:00 | Sauvegarde privée | Fichier principal actif et module `social-auth-security.php` copiés dans un dossier privé horodaté. |
| 18:16–18:17 | Récupération et comparaison | La production active a été téléchargée par flux SSH et comparée à la base Git. |
| 18:17 | Construction du candidat | Deux modifications seulement ont été appliquées en conservant les fins de ligne CRLF de production. |
| 18:17 | Staging privé du candidat | Hash et syntaxe PHP vérifiés dans le dossier privé, sans toucher au fichier actif. |
| 18:18:11 | Remplacement atomique | Le candidat a été installé sous un nom temporaire dans le même répertoire, validé puis déplacé atomiquement sur le fichier actif. |
| 18:18–18:19 | Postflight | Site, route sociale, plugin et routes publiques de contenu validés. |
| 18:19:59 | Libération du verrou | Résultats écrits dans `postflight.txt`, puis verrou supprimé et absence vérifiée. |

## 3. Identification du fichier actif

Une première inspection a visé la copie imbriquée suivante :

`wp-content/plugins/lamako-mobile-api/lamako-mobile-api/lamako-mobile-api.php`

Ce fichier ancien, daté du 28 avril 2026 et d’une taille de 69 653 octets, **n’est pas le fichier principal actif**. Aucune modification ne lui a été apportée. Une recherche par les symboles `social_token_algorithm`, `lamako_mobile_validate_apple_identity` et `lamako_mobile_social_login` a permis d’identifier le véritable fichier actif au niveau supérieur :

`wp-content/plugins/lamako-mobile-api/lamako-mobile-api.php`

Le véritable fichier actif avait une taille de 186 890 octets, était daté du 28 août 2026 et chargeait `lamako-mobile-api/includes/social-auth-security.php`. Son callback social était encore `lamako_mobile_social_login` avant le déploiement.

## 4. Sauvegarde et empreintes

Le dossier de sauvegarde privé est :

`/home/master/applications/bvprmuerhv/private_html/tbl-apple-social-json-20260902T181506Z-06ac889`

| Artefact | SHA-256 |
|---|---|
| `lamako-mobile-api.php.before` | `0613564f2be9037af5d48020045ae9167fed278c3f76131d7d79ef229bf46a11` |
| `social-auth-security.php.observed` | `6574bfef10e4e495057aa2b3c9cdd2e027c333aeb42db2e29a9a873d989406e0` |
| `lamako-mobile-api.php.candidate` | `e75bc568ed9d7972d0609e0e11a53acc4b276488b2f3a3853ffed0192d746b98` |
| Fichier actif après déploiement | `e75bc568ed9d7972d0609e0e11a53acc4b276488b2f3a3853ffed0192d746b98` |

Le dossier contient aussi `manifest.txt`, `manifest.sha256` et `postflight.txt`. Les fichiers sont privés et aucun jeton, email, mot de passe ou corps HTML n’y est enregistré.

## 5. Réconciliation production/Git

Le hash brut de production différait de la base Git uniquement parce que la production utilisait des fins de ligne CRLF. Après normalisation CRLF vers LF, la production active et `d9520c7:scripts/lamako-mobile-api.php` avaient exactement le même SHA-256 :

`52f04ac4a3b34814fd93ded65b2736e82a39c327301e7d8cecd2d28eaa7b458d`

Le candidat a été généré à partir de la production active, en conservant CRLF. Après normalisation, il correspond exactement au fichier revu dans la branche `fix/apple-social-json-response-20260902`. Le diff effectif contient 38 lignes ajoutées et une ligne remplacée.

| Modification | Avant | Après |
|---|---|---|
| Callback REST | `lamako_mobile_social_login` | `lamako_mobile_social_login_json_guard` |
| Garde-fou | Absent | Tampon de sortie, erreur REST contrôlée et journalisation non sensible |

## 6. Méthode de remplacement

Le candidat a d’abord été copié vers un fichier temporaire caché situé dans le même répertoire que le fichier actif. Son hash et sa syntaxe PHP ont été validés avant le déplacement. Le remplacement a ensuite utilisé `mv` sur le même système de fichiers. La commande de déploiement contenait un rollback automatique vers la sauvegarde si une validation échouait après le swap.

Après le remplacement, le fichier actif avait les caractéristiques suivantes :

| Propriété | Valeur |
|---|---|
| Taille | 188 237 octets |
| Mode | `0644` |
| Propriétaire/groupe | compte master Cloudways / `www-data` |
| SHA-256 | `e75bc568ed9d7972d0609e0e11a53acc4b276488b2f3a3853ffed0192d746b98` |
| Syntaxe PHP | Aucune erreur |
| Plugin WordPress | Actif |

## 7. Résultats du postflight

| Contrôle | Résultat |
|---|---|
| Page d’accueil | HTTP 200, HTML attendu |
| `POST /wp-json/lamako-mobile/v1/social-login` sans paramètres | HTTP 400, JSON commençant par `{` |
| Sonde Apple RS256 avec signature volontairement invalide | HTTP 401, JSON `social_signature_invalid`, zéro redirection |
| `/wp-json/lamako-mobile/v1/home-data` | HTTP 200, JSON, 289 006 octets |
| `/wp-json/lamako-mobile/v1/events-data` | HTTP 200, JSON, 287 091 octets |
| `/wp-json/lamako-mobile/v1/shop-data` | HTTP 200, JSON, 1 741 octets |
| Callback actif | `lamako_mobile_social_login_json_guard` |
| Fonction du garde-fou | Présente dans le fichier actif |
| Sauvegarde pré-déploiement | Hash vérifié |
| Verrou mono-writer | Supprimé et absence vérifiée |

Aucune ligne `[Lamako Social Auth]` n’a été produite par les sondes invalides. Ce résultat est attendu : elles échouent pendant la validation du jeton et ne déclenchent aucune sortie parasite. Le test décisif reste un vrai login Apple sur iPhone.

## 8. Retour arrière

Le rollback doit être utilisé uniquement en cas d’incident confirmé. Il restaure le fichier exact sauvegardé avant cette intervention. Il faut conserver le même principe de verrou et de remplacement atomique :

```bash
APP=/home/master/applications/bvprmuerhv
ACTIVE="$APP/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api.php"
BACKUP="$APP/private_html/tbl-apple-social-json-20260902T181506Z-06ac889"
LOCK="$APP/tmp/.tbl-wordpress-mono-writer"
TMP="$APP/public_html/wp-content/plugins/lamako-mobile-api/.lamako-mobile-api.php.rollback.tmp"

mkdir "$LOCK" || exit 73
cp -p "$BACKUP/lamako-mobile-api.php.before" "$TMP"
php -l "$TMP" || { rm -f "$TMP"; rm -rf "$LOCK"; exit 1; }
test "$(sha256sum "$TMP" | awk '{print $1}')" = \
  "0613564f2be9037af5d48020045ae9167fed278c3f76131d7d79ef229bf46a11" || \
  { rm -f "$TMP"; rm -rf "$LOCK"; exit 1; }
mv -f "$TMP" "$ACTIVE"
php -l "$ACTIVE"
rm -rf "$LOCK"
```

Après rollback, il faut vérifier la page d’accueil, les trois routes publiques de contenu et les deux sondes JSON de la route sociale.

## 9. Prochaine étape obligatoire

Tester maintenant **« Continuer avec Apple » sur un iPhone réel** avec l’application App Store actuelle. Noter l’heure UTC approximative et le résultat affiché, sans communiquer le jeton ni l’email relais Apple. Après le test, rechercher uniquement les lignes `[Lamako Social Auth]` dans les journaux Cloudways.

| Résultat iPhone | Action suivante |
|---|---|
| Connexion réussie | Consigner le succès, rejouer email/Google/Facebook, puis décider de la publication du correctif client. |
| Erreur JSON lisible | Consigner le code et le message sans donnée personnelle; corriger la cause spécifique. |
| Même erreur brute `Unexpected character: <` | Relever l’heure; inspecter les lignes `Suppressed unexpected output`; le binaire client actuel reste vulnérable au parsing brut. |
| Message serveur temporairement indisponible | Inspecter `Unhandled server error` et la classe d’exception, puis corriger le hook fautif. |

La pull request doit rester en brouillon jusqu’au test iPhone et à la vérification des autres méthodes de connexion.
