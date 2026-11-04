# Déployer LIVREX avec Supabase et Vercel

Le code est prévu pour le PostgreSQL de Supabase. Supabase conserve les comptes, sessions, réservations, colis et preuves de livraison. L’authentification LIVREX est gérée par le serveur de l’application : Supabase Auth n’est pas utilisé. Les images sont enregistrées dans PostgreSQL ; aucun bucket Storage ni clé `service_role` n’est nécessaire.

## Tester immédiatement, sans base

Importer la branche `codex/livrex-mobile-platform` dans Vercel et la déployer sans `DATABASE_URL`. Le site fonctionne alors en **mode démo**, avec un bandeau explicite, des exemples fictifs et un stockage propre à chaque navigateur. Les visiteurs peuvent parcourir les espaces et simuler les opérations sans mot de passe. Aucun colis, paiement ou billet réel n’est créé. Aucune variable d’environnement n’est nécessaire pour ce mode.

Pour passer ensuite au service connecté, suivre les étapes ci-dessous. Les exemples de démonstration ne sont pas importés dans Supabase. La connexion d’une vraie base désactive automatiquement le mode démo.

## 1. Créer Supabase

1. Créer un projet dans [Supabase](https://supabase.com/dashboard).
2. Choisir une région proche du déploiement Vercel, définir un mot de passe de base fort, puis attendre que le projet soit prêt.
3. Dans **Connect**, sélectionner la chaîne PostgreSQL du **Transaction pooler** (Supavisor, généralement port 6543). Cette connexion convient aux fonctions Vercel et fonctionne en IPv4. Le pilote n’utilise aucune requête préparée nommée, ce qui permet ce mode de pooling.
4. Copier l’URI complète et y renseigner le mot de passe réel de la base. Si le mot de passe est renseigné manuellement dans une URI, ses caractères réservés doivent être encodés. Garder cette URI privée.

Ne pas utiliser l’URL HTTP du projet (`https://…supabase.co`) à la place de l’URI PostgreSQL. Aucune valeur secrète ne doit être copiée dans GitHub ou dans une conversation.

## 2. Préparer les variables Vercel

Importer `oumar390/livrex` dans [Vercel](https://vercel.com/new), puis sélectionner la branche `codex/livrex-mobile-platform` contenant cette version. Vérifier la branche utilisée pour les déploiements de production si le projet existait déjà ; la branche `main` historique ne contient pas cette refonte.

Framework : **Next.js**. Runtime Node : **24.x**. Le fichier `vercel.json` définit l’installation (`npm ci`) et la compilation (`npm run build`).

Dans **Settings → Environment Variables**, renseigner :

| Nom                 | Valeur                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | L’URI PostgreSQL privée du pooler Supabase                                             |
| `ADMIN_SETUP_TOKEN` | Un code privé aléatoire d’au moins 32 caractères, pour créer le premier administrateur |

Générer le code localement, par exemple avec `openssl rand -hex 24`. Conserver ce code dans un gestionnaire de mots de passe. Ce n’est ni le mot de passe Supabase ni le futur mot de passe du compte administrateur.

Ne jamais préfixer ces variables par `NEXT_PUBLIC_`. Les ajouter aux environnements Vercel voulus. Pour les previews, utiliser un projet ou une branche Supabase distincte si elles doivent rester séparées des données de production.

La vérification TLS est activée pour toute connexion distante. Ne pas ajouter `sslmode=disable`. Si votre configuration Supabase nécessite un certificat spécifique, définir `DATABASE_CA_CERT` avec le certificat PEM fourni par le service ; ne pas désactiver la vérification des certificats.

## 3. Déployer

Lancer le déploiement, ou **Redeploy** après ajout des variables. Le schéma est créé de manière idempotente au premier accès à la base, avec un verrou PostgreSQL empêchant des initialisations concurrentes.

Pour initialiser explicitement depuis une machine de confiance ayant `DATABASE_URL` dans son environnement :

```sh
npm ci
npm run db:migrate
```

Il n’est pas nécessaire de faire accéder le build Vercel à la base. Les accès à la base sont initialisés à l’exécution. Sans base, seule la démonstration dans le navigateur est disponible. Les routes API réelles répondent par une erreur de configuration et ne créent jamais de SQLite temporaire sur Vercel. Une URI configurée mais invalide ne déclenche pas de mode démo silencieux.

## 4. Créer l’administrateur

Ouvrir `/connexion`, renseigner le nom, l’e-mail et le mot de passe du futur administrateur, puis le **code d’initialisation administrateur** correspondant à `ADMIN_SETUP_TOKEN`. Sans ce code, la première inscription est refusée sur Vercel. Une fois le premier administrateur créé, les inscriptions suivantes produisent uniquement des comptes clients et ne demandent plus ce code.

L’administrateur attribue ensuite les rôles des collaborateurs depuis `/equipe`. Les clés API des boutiques se gèrent dans `/integrations`.

## 5. Vérifier le site

- Créer un compte client, enregistrer un envoi et retrouver son suivi après reconnexion.
- Réserver un siège, puis vérifier depuis un deuxième compte qu’il est indisponible.
- Vérifier les opérations dans l’espace professionnel et l’enregistrement d’un encaissement.
- Faire un nouveau déploiement et confirmer que les données sont conservées : elles vivent dans Supabase.

Les tables créées dans le schéma `public` ont la RLS activée et n’accordent aucune politique aux clients Supabase anonymes. La connexion PostgreSQL privée côté serveur utilise le propriétaire des tables (`postgres` fourni par Supabase). Ne pas désactiver la RLS pour faire fonctionner un accès depuis le navigateur : le navigateur doit utiliser les routes de l’application.

## Sauvegardes et limites

Utiliser les sauvegardes Supabase ou `pg_dump` pour PostgreSQL. `npm run db:backup` est réservé à SQLite local et refuse de s’exécuter quand `DATABASE_URL` est défini. Changer de moteur ne copie pas automatiquement une ancienne base SQLite ; aucun jeu d’essai n’est transféré vers Supabase.

Les preuves sont privées et servies par une route authentifiée. Leur stockage dans PostgreSQL convient à cette première version ; surveiller l’espace et prévoir un stockage objet si le volume de photos augmente.

L’état métier est mis à jour transactionnellement avec un verrou partagé par toutes les instances : deux fonctions Vercel ne peuvent pas vendre le même siège. Les écritures sont sérialisées pour préserver les parcours existants ; une modélisation par entité sera adaptée à une montée en charge importante.

Les paiements en ligne, SMS, e-mails externes, webhooks et récupération de mot de passe restent distincts de ce déploiement et ne sont pas activés par la connexion Supabase.

## Validation et portée

La validation locale inclut les parcours Playwright contre SQLite et contre un véritable serveur PostgreSQL temporaire. Un test PostgreSQL doit utiliser une base jetable et passer son URI dans `LIVREX_TEST_DATABASE_URL`, jamais dans une base de production. Un code d’initialisation de test peut être fourni dans `LIVREX_TEST_ADMIN_TOKEN`.

```sh
npm run typecheck
npm run lint
npm test
npm run test:vercel-config
# Sur une base PostgreSQL de test isolée, avec les variables exportées de façon privée :
npm test
```

Ces vérifications ne constituent pas un test sur votre projet Supabase ni un déploiement Vercel : ceux-ci nécessitent les ressources créées dans vos comptes.
