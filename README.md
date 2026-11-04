# LIVREX · Lifekhalifa

Application Next.js pour les voyages, les envois de marchandises et les opérations des équipes. Interface française conçue pour le téléphone, puis adaptée à la tablette et à l’ordinateur.

## Démarrer

Node.js **24 LTS** et npm. Les versions exactes des dépendances sont verrouillées dans `package-lock.json`.

```sh
npm ci
npm run dev
```

Next.js **16.4.5**, React **19.3.1**, TypeScript **6.0.3**. TypeScript 7 n’est pas encore pris en charge par typescript-eslint ; ESLint 9.39.5 reste la version compatible avec les plugins livrés par Next.js. Aucun contrôle de signature ou de certificat n’est désactivé.

Au premier démarrage, `/connexion` affiche la création du premier compte administrateur. Effectuer cette configuration **avant d’exposer l’application au public**. Les inscriptions suivantes créent uniquement des clients. Aucun compte ni mot de passe de production n’est livré. Chaque collaborateur s’inscrit, puis l’administrateur attribue son rôle dans `/equipe` ; ce changement invalide ses sessions existantes.

## Trois espaces

- `/voyager` : recherche, choix des places, coordonnées, confirmation et billets QR imprimables.
- `/envoyer` : trajet, marchandise, contacts, devis recalculé par le serveur, confirmation et bordereau.
- `/pro` : accès aux outils autorisés selon le rôle. Agent (`/agent`), chauffeur (`/chauffeur`), livreur (`/livreur`), gestionnaire (`/gestion`), administrateur (`/admin`).

`/activites` regroupe les envois et billets du compte, ainsi que les notifications internes. `/suivre` affiche les étapes des envois appartenant au compte connecté. Les espaces métier sont des consoles par métier ; les agents autorisés peuvent sélectionner les agences ou membres de flotte. Une restriction supplémentaire par agence ou collaborateur n’est pas mise en place.

## Données et sécurité

SQLite natif de Node (`node:sqlite`) : `.data/livrex.sqlite`, WAL activé. `LIVREX_DATA_DIR` permet de choisir un autre répertoire persistant. Les photos et signatures sont stockées séparément du document d’état dans la même base, accessibles via une route authentifiée. Les photos sont limitées à 2 Mo côté interface. Le code de remise n’est pas exposé aux comptes livreurs ; il est vérifié côté serveur pour la livraison avec signature.

Les mots de passe utilisent scrypt avec sel individuel. Les sessions utilisent un cookie HttpOnly/SameSite et un jeton aléatoire dont seul le condensat est enregistré. Les écritures de navigateur vérifient leur origine. Les prix, disponibilités et droits sont contrôlés côté serveur. Les réservations sont transactionnelles, avec contrôle des sièges et idempotence. Les opérations concurrentes utilisent une révision : un conflit n’écrase pas silencieusement les changements d’un autre opérateur. Un journal d’audit est enregistré.

Les données initiales de flotte, agences, horaires et barèmes sont des références de démonstration héritées du dépôt, sans faux envoi, faux client ni encaissement ajouté. Les règles commerciales et la réconciliation des axes des documents restent à valider. Les tarifs et seuils sont configurables dans l’administration. Le « transport de masse » marchandises de l’ancien prototype est présenté comme « camion dédié », distinct des voyageurs.

## Paiements et communication

Le parcours disponible est le **paiement en espèces auprès de l’équipe**. Une commande ou une réservation n’est jamais marquée payée par un faux retour Wave/Orange Money/carte. Le guichet enregistre l’encaissement ; les réservations peuvent être encaissées par l’administrateur ou le gestionnaire. Aucun débit bancaire n’est effectué.

Les notifications sont internes à l’application, actualisées toutes les cinq secondes. Le scan utilise BarcodeDetector lorsque disponible, avec saisie manuelle de l’étiquette en alternative. La géolocalisation nécessite une autorisation et HTTPS hors localhost. Il n’y a plus de déplacement ou de lecture QR simulé automatiquement. Les cartes sont schématiques ; elles ne constituent pas un calcul d’itinéraire routier en temps réel. La signature et la photo sont enregistrées.

L’activation des paiements externes, SMS, e-mails et webhooks nécessite le choix des prestataires, leurs comptes, leurs identifiants et des URL publiques de retour. Ces connexions ne sont pas actives. La récupération de mot de passe par e-mail et les politiques commerciales de remboursement/annulation ne sont pas implémentées.

## API e-commerce

Depuis `/integrations` (accessible dans Mon compte), créer une clé pour sa boutique. Seul son condensat est conservé ; la valeur n’est affichée qu’une fois et peut être révoquée. Ne jamais exposer une clé dans le code du navigateur de la boutique.

`GET /api/v1/shipments` décrit le service et les quartiers. `POST /api/v1/shipments` nécessite `Authorization: Bearer <clé>` (ou une session), `Content-Type: application/json` et de préférence `Idempotency-Key` unique par commande. Le résultat contient le numéro persistant et le prix en XOF. Le paiement reste à encaisser. Exemple de corps :

```json
{
  "pickup": "Plateau",
  "dropoff": "Almadies",
  "weight_kg": 2,
  "description": "Commande boutique",
  "sender": { "name": "Boutique", "phone": "771234567" },
  "recipient": { "name": "Awa Diop", "phone": "781234567" }
}
```

L’ancienne clé publique de démonstration n’est plus acceptée.

## Validation

```sh
npm run typecheck
npm run lint
npm run build
npm test
```

Les tests Playwright compilent puis exécutent la version de production, avec une base temporaire distincte et un serveur sur le port 3100. Chromium est attendu à `/usr/bin/chromium` dans l’environnement cloud. Pour un autre poste, adapter `launchOptions.executablePath` dans `playwright.config.ts` ou utiliser le navigateur installé par Playwright. Les tests couvrent notamment les parcours mobiles, les droits, la confidentialité, les conflits de réservation et d’écriture, l’API, l’encaissement et les preuves. Ne pas lancer le build et le serveur de développement simultanément sur le même dossier `.next`.

## Exécution et sauvegarde

```sh
npm run build
npm start -- --hostname 0.0.0.0
```

Cette version utilise un **serveur Node unique avec disque persistant**. Un hébergement serverless à disque éphémère ne convient pas à cette configuration SQLite. Mettre en place HTTPS, un volume durable et des sauvegardes avant une exploitation réelle. Pour sauvegarder une base active avec cohérence : `npm run db:backup -- /chemin/securise/livrex.sqlite`. La copie contient des données personnelles et doit rester privée. La restauration se fait serveur arrêté, à partir d’une sauvegarde vérifiée ; ne pas copier seulement le fichier principal pendant que WAL est actif.

La publication n’est pas effectuée automatiquement. Les processus doivent être redémarrés après restauration d’un environnement cloud.
