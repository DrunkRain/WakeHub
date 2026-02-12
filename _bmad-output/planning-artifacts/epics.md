---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - prd.md
  - architecture.md
  - ux-design-specification.md
  - brainstorming-session-2026-02-12.md
---

# WakeHub - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for WakeHub, decomposing the requirements from the PRD, UX Design, Architecture and the brainstorming session (two-layer infrastructure model) into implementable stories.

## Requirements Inventory

### Functional Requirements

**Authentification & Securite Utilisateur**
- FR1: Lors de la premiere ouverture, le systeme affiche un formulaire de creation de compte (nom d'utilisateur, mot de passe, confirmation, question de securite)
- FR2: L'utilisateur peut se connecter via login avec mot de passe hache et session authentifiee (nom d'utilisateur + mot de passe)
- FR3: L'utilisateur peut activer "Se souvenir de moi" pour maintenir sa session (30 jours au lieu de 24h)
- FR4: L'utilisateur peut reinitialiser son mot de passe via question de securite

**Gestion de l'Infrastructure — Arbre d'Hebergement (Couche 1)**
- FR5: L'administrateur peut ajouter manuellement une machine physique (nom, adresse IP, adresse MAC) — racine de l'arbre d'hebergement
- FR6: L'administrateur peut configurer la capacite `proxmox_api` sur une machine physique (URL API, identifiants) pour controler VMs et LXCs
- FR7: L'administrateur peut configurer la capacite `docker_api` sur une machine physique, VM ou LXC (URL API ou tunnel SSH) pour controler des conteneurs Docker
- FR8: Le systeme decouvre automatiquement les VMs et LXCs disponibles via l'API Proxmox d'un noeud avec capacite `proxmox_api`
- FR9: Le systeme decouvre automatiquement les conteneurs disponibles via l'API Docker d'un noeud avec capacite `docker_api`
- FR10: Les entites auto-decouvertes restent en etat "decouvert mais pas configure" — l'utilisateur voit "X services a configurer" dans la page detail de l'hote
- FR11: Quand l'utilisateur configure un service auto-detecte, le formulaire est pre-rempli avec les donnees connues de l'API (nom, ID plateforme, statut, ressources, ports, image)
- FR12: L'administrateur peut tester la connexion a n'importe quel noeud (machine physique, VM, LXC, conteneur)
- FR13: L'administrateur peut supprimer n'importe quel noeud de l'arbre d'hebergement
- FR14: L'administrateur peut modifier les parametres d'un noeud (nom, IP, MAC, credentials, URL service, capacites)

**Gestion des Dependances — Graphe Fonctionnel (Couche 2)**
- FR15: L'administrateur peut definir des liens de dependance fonctionnelle entre n'importe quels noeuds (cross-arbre possible)
- FR16: Les dependances peuvent etre partagees (un NAS utilise par Jellyfin ET Plex)
- FR17: Le systeme calcule la chaine de dependances complete pour un noeud donne (en combinant Couche 1 et Couche 2)
- FR18: L'administrateur peut visualiser le graphe de dependances fonctionnelles de son infrastructure
- FR19: L'administrateur peut modifier ou supprimer un lien de dependance fonctionnelle
- FR20: Le systeme detecte et bloque les cycles au moment de la creation d'un lien de dependance

**Controle d'Alimentation — Orchestration Deux Couches**
- FR21: L'utilisateur peut demarrer un noeud en un clic depuis le dashboard (noeud epingle)
- FR22: Le systeme demarre sequentiellement les dependances fonctionnelles (Couche 2) d'abord, puis remonte l'arbre d'hebergement (Couche 1) pour chaque noeud a demarrer
- FR23: L'utilisateur peut arreter manuellement un noeud depuis le dashboard
- FR24: Le systeme arrete un noeud en descendant l'arbre d'hebergement (bottom-up : enfants d'abord), puis re-evalue les dependances fonctionnelles orphelines
- FR25: Lors de la re-evaluation post-extinction, le systeme respecte l'option "Confirmer avant extinction" de chaque noeud dependance
- FR26: Le systeme protege les dependances partagees : avant d'eteindre un noeud, verifier qu'aucun dependant actif n'existe en dehors de la cascade en cours
- FR27: Le systeme demarre une machine physique via Wake-on-LAN
- FR28: Le systeme arrete une machine physique via SSH
- FR29: Le systeme demarre et arrete une VM ou LXC via l'API Proxmox du parent
- FR30: Le systeme demarre et arrete un conteneur Docker via l'API Docker du parent
- FR31: Le canal de commande est deduit automatiquement de la capacite du parent (pas de configuration explicite)
- FR32: Le systeme affiche la progression de chaque etape lors d'une cascade (demarrage ou arret)
- FR33: L'utilisateur peut relancer une cascade apres un echec

**Surveillance d'Inactivite & Arret Automatique**
- FR34: Le systeme surveille l'activite d'un noeud selon des criteres configurables (connexions reseau, activite CPU/RAM, dernier acces)
- FR35: Le systeme declenche un arret automatique apres une periode d'inactivite configurable
- FR36: L'administrateur peut definir un delai d'inactivite par defaut (30 minutes)
- FR37: L'administrateur peut personnaliser le delai d'inactivite par noeud
- FR38: Le systeme respecte les dependances partagees et l'arbre d'hebergement lors d'un arret automatique
- FR39: Le systeme annule un arret automatique si un dependant actif est detecte

**Dashboard & Visibilite**
- FR40: Tout noeud (machine physique, VM, LXC, conteneur) est epinglable sur le dashboard
- FR41: L'utilisateur compose son dashboard librement via bouton "Epingler" (page detail, ligne tableau) ou bouton "+" sur le dashboard
- FR42: L'utilisateur voit l'etat de tous les noeuds epingles en temps reel
- FR43: L'utilisateur voit le statut de chaque noeud (allume, eteint, en demarrage, en arret, erreur)
- FR44: Le systeme met a jour les statuts en temps reel sans rechargement de page (SSE)
- FR45: L'utilisateur peut acceder a une vue detaillee d'un noeud (enfants heberges, dependances fonctionnelles, services a configurer)
- FR46: L'utilisateur peut ouvrir le service une fois operationnel via un bouton "Ouvrir" (pas de redirection automatique)

**Configuration & Parametrage**
- FR47: L'administrateur peut configurer l'option "Confirmer avant extinction automatique" par noeud (defaut ON pour machines physiques, OFF pour VM/LXC/conteneurs)
- FR48: L'administrateur peut configurer les parametres de connexion Docker API : acces direct (IP:port 2375/2376) ou tunnel SSH
- FR49: L'administrateur peut definir l'URL d'acces a chaque service (pour le bouton "Ouvrir")

**Journalisation & Diagnostic**
- FR50: Le systeme enregistre toutes les operations (demarrages, arrets, erreurs) avec horodatage
- FR51: Le systeme enregistre la raison de chaque decision (arret annule car dependant actif, extinction proposee apres re-evaluation, etc.)
- FR52: L'utilisateur peut consulter l'historique des logs depuis l'interface
- FR53: Le systeme affiche l'etape en echec, le code d'erreur et le message de la plateforme lors d'une cascade echouee

### NonFunctional Requirements

**Performance**
- NFR1: Dashboard charge en moins de 15 secondes
- NFR2: Cascade complete en moins de 2 minutes (variable selon complexite de l'arbre)
- NFR3: Mises a jour temps reel en moins de 3 secondes apres changement d'etat
- NFR4: Appels API avec timeout configurable (30 secondes par defaut) pour eviter les blocages

**Securite**
- NFR5: Donnees sensibles chiffrees au repos (identifiants API Proxmox/Docker, cles SSH, tokens) — AES-256-GCM
- NFR6: Mots de passe utilisateur haches avec argon2id
- NFR7: Communications frontend-backend via HTTPS (delegue au reverse proxy)

**Fiabilite**
- NFR8: Service permanent 24/7 — redemarrage automatique du conteneur apres defaillance ou reboot (Docker restart policy `unless-stopped`)
- NFR9: Resilience : les operations en cours lors d'un crash ne corrompent pas la base de donnees

**Integration**
- NFR10: Connecteurs d'API avec interface commune (`PlatformConnector`) pour ajouter de nouvelles plateformes
- NFR11: Gestion des erreurs API avec messages incluant le type d'erreur, le code et la description
- NFR12: Compatibilite avec les versions majeures actuelles des API Proxmox et Docker

**Accessibilite**
- NFR13: Navigation au clavier fonctionnelle
- NFR14: Contraste conforme WCAG AA (ratio 4.5:1 minimum)
- NFR15: Labels ARIA sur les elements interactifs
- NFR16: Information non dependante de la couleur seule

**Fiabilite d'Orchestration**
- NFR17: Demarrage toujours sequentiel (jamais parallele) pour eviter les race conditions
- NFR18: L'arbre d'hebergement (Couche 1) est toujours respecte : un noeud ne peut demarrer que si tous ses parents dans l'arbre sont up

### Additional Requirements

**Exigences issues de l'Architecture :**
- ARCH-01: Starter template — monorepo npm workspaces (apps/web, apps/server, packages/shared). Initialisation du projet comme premiere story d'implementation
- ARCH-02: TypeScript strict partout (frontend + backend + shared) avec tsconfig.base.json partage
- ARCH-03: Frontend — Vite + React 19 + Mantine v7+ + React Router
- ARCH-04: Backend — Fastify avec validation JSON Schema + architecture plugin par domaine
- ARCH-05: ORM & DB — Drizzle ORM code-first avec migrations SQL + better-sqlite3 (SQLite)
- ARCH-06: Auth — Sessions cookie HTTP-only, SameSite=Strict, stockees en base SQLite via Drizzle (pas de JWT)
- ARCH-07: Temps reel — SSE (Server-Sent Events) via endpoint unique `GET /api/events`. Types d'evenements : status-change, cascade-progress, cascade-complete, cascade-error, auto-shutdown
- ARCH-08: State management frontend — TanStack Query (server state) + Zustand (client state). SSE invalide le cache TanStack Query
- ARCH-09: Logging — pino (natif Fastify) JSON structure + double destination (stdout + persistance base SQLite via Drizzle)
- ARCH-10: Deploiement — Docker multi-stage build (Vite build → backend compile → Node.js Alpine + SQLite). Volume Docker pour la base. Restart policy `unless-stopped`
- ARCH-11: Erreurs — Classe `PlatformError` (code, message, platform, details) pour les connecteurs. Format API normalise `{ data }` / `{ error: { code, message, details } }`
- ARCH-12: Config — Variables d'environnement via .env + dotenv (PORT, ENCRYPTION_KEY, DATABASE_PATH, SESSION_SECRET, NODE_ENV)
- ARCH-13: Securite credentials — AES-256-GCM (module `crypto` natif Node.js), cle en variable d'environnement ENCRYPTION_KEY, IV unique par credential
- ARCH-14: API docs — @fastify/swagger + @fastify/swagger-ui, auto-genere depuis les schemas JSON
- ARCH-15: Tests — Vitest (frontend + backend), tests co-localises (foo.test.ts a cote de foo.ts)
- ARCH-16: Qualite de code — ESLint + eslint-plugin-jsx-a11y
- ARCH-17: Conventions de nommage — DB snake_case, API JSON camelCase, fichiers kebab-case, composants React PascalCase, constantes SCREAMING_SNAKE
- ARCH-18: Organisation backend par domaine (routes/, services/, connectors/, db/, middleware/, sse/)
- ARCH-19: Organisation frontend par feature (features/, components/, hooks/, api/, stores/, theme/)
- ARCH-20: HTTPS delegue au reverse proxy (non gere par l'application)
- ARCH-21: Sequence d'implementation recommandee : monorepo → schema DB → auth → connecteurs → cascade + SSE → frontend → inactivite → Docker

**Exigences issues du UX Design :**
- UX-01: Theme dark par defaut avec palette Mantine personnalisee — bleu tech `#339AF0`, fond `#1A1B1E`, cartes `#25262B`
- UX-02: Couleurs de statut semantiques — vert `#51CF66` (actif), gris `#868E96` (eteint), jaune `#FCC419` (en demarrage), rouge `#FF6B6B` (erreur), orange `#FF922B` (en arret)
- UX-03: Police Inter (principale) + JetBrains Mono (monospace pour logs/IPs/noms techniques)
- UX-04: Layout AppShell — header avec logo + navigation + zone de contenu
- UX-05: Dashboard — grille de noeuds epingles (ServiceTiles) avec StatsBar
- UX-06: ServiceTile — carte interactive avec icone, nom, badge statut, plateforme, resume dependances, bouton contextuel unique (Demarrer/Ouvrir/Reessayer selon etat)
- UX-07: CascadeProgress — barre fine 3px en bordure basse de la carte + animation dependance en cours
- UX-08: ServiceDetailPanel — Drawer lateral 380px desktop / plein ecran mobile. Onglets : Dependances (chaine avec statut chaque maillon) + Logs (recents). Zone Actions fixee en bas
- UX-09: Page Noeuds — vue tabulaire compacte (Table Mantine). Colonnes : icone, nom, type (machine/VM/LXC/conteneur), statut badge, plateforme, IP, derniere activite. Filtres par statut et type
- UX-10: Page Detail Noeud — page dediee avec en-tete, parametres editables, enfants heberges (Couche 1), dependances fonctionnelles (Couche 2), services a configurer (auto-detectes), regles d'inactivite, logs, actions
- UX-11: Page Logs — tableau chronologique filtrable (noeud, stack dependances, type evenement, periode, recherche libre) avec colonne "raison de la decision"
- UX-12: Wizard ajout machine physique — formulaire (nom, IP, MAC, SSH) → test connexion → configuration capacites (Proxmox et/ou Docker optionnels)
- UX-13: Toasts Notification Mantine — ~5s tous types, position haut-droite, un seul a la fois, 4 types (succes vert, erreur rouge, warning orange, info bleu)
- UX-14: Modals de confirmation — Arret : "Eteindre X et ses Y enfants/dependants ?". Suppression : "Supprimer definitivement X ?". Re-evaluation : "Proposer l'extinction de X ? (plus de dependants actifs)". Jamais de confirmation pour Demarrer/Ouvrir/Reessayer
- UX-15: Skeleton loaders pour chargement initial, boutons loading pendant actions, pas de spinner plein ecran
- UX-16: Responsive desktop-first — desktop >=992px (3+ col, Drawer 380px), tablette 768-991px (2 col), mobile <768px (1 col, hamburger menu, Drawer plein ecran, stats 2x2)
- UX-17: Accessibilite WCAG AA — contraste 4.5:1, focus ring bleu 2px, aria-labels, role="progressbar" sur CascadeProgress, aria-live="polite" pendant cascade, prefers-reduced-motion, cibles tactiles 44x44px, skip link
- UX-18: Bouton unique contextuel par carte (Demarrer/Ouvrir/Reessayer) + Arreter uniquement dans le panneau lateral
- UX-19: Icones — Tabler Icons (defaut Mantine) + dashboard-icons (icones de services homelab)
- UX-20: Note FR46 — Le bouton "Ouvrir" est un choix UX explicite (pas de redirection automatique)

**Exigences issues du Brainstorming (modele deux couches) :**
- BS-01: Modele de donnees a deux couches superposees : Couche 1 (arbre d'hebergement structurel) + Couche 2 (graphe de dependances fonctionnelles)
- BS-02: Types d'entites : machine physique (WoL+SSH), VM (Proxmox API parent), LXC (Proxmox API parent), conteneur Docker (Docker API parent)
- BS-03: Capacites optionnelles par noeud : `proxmox_api`, `docker_api` — determinent le canal de commande vers les enfants
- BS-04: Canal de commande deduit de la capacite du parent (pas de config explicite par l'utilisateur)
- BS-05: Topologies supportees : Machine→Proxmox→VM/LXC→Docker→Conteneurs, Machine→Docker→Conteneurs, Machine→Proxmox→VM/LXC, Machine seule
- BS-06: Decouverte auto (Proxmox/Docker) + configuration manuelle (machines physiques uniquement)
- BS-07: Entites decouvertes en etat "decouvert non configure" avec pre-remplissage automatique du formulaire
- BS-08: Demarrage sequentiel : dependances fonctionnelles d'abord (Couche 2), puis arbre d'hebergement (Couche 1) du haut vers le bas
- BS-09: Extinction bottom-up dans l'arbre + re-evaluation des dependances fonctionnelles orphelines
- BS-10: Dashboard a epinglage libre — tout noeud est epinglable
- BS-11: Option "Confirmer avant extinction automatique" configurable par noeud (defaut selon type)
- BS-12: Acces Docker API : deux modes (direct IP:port ou tunnel SSH)

### FR Coverage Map

- FR1: Epic 1 — Creation de compte au premier lancement
- FR2: Epic 1 — Login avec session authentifiee
- FR3: Epic 1 — Option "Se souvenir de moi"
- FR4: Epic 1 — Reset de mot de passe via question de securite
- FR5: Epic 2 — Ajout manuel machine physique (racine arbre)
- FR6: Epic 2 — Configuration capacite proxmox_api
- FR7: Epic 2 — Configuration capacite docker_api
- FR8: Epic 2 — Decouverte auto VMs/LXCs via Proxmox API
- FR9: Epic 2 — Decouverte auto conteneurs via Docker API
- FR10: Epic 2 — Entites en etat "decouvert non configure"
- FR11: Epic 2 — Pre-remplissage formulaire config auto-detecte
- FR12: Epic 2 — Test de connexion noeud
- FR13: Epic 2 — Suppression noeud
- FR14: Epic 2 — Modification parametres noeud
- FR15: Epic 3 — Definition liens dependance fonctionnelle (cross-arbre)
- FR16: Epic 3 — Dependances partagees
- FR17: Epic 3 — Calcul chaine dependances (Couche 1 + Couche 2)
- FR18: Epic 3 — Visualisation graphe dependances
- FR19: Epic 3 — Modification/suppression lien dependance
- FR20: Epic 3 — Detection et blocage de cycles
- FR21: Epic 4 — Demarrage noeud en un clic (dashboard)
- FR22: Epic 4 — Cascade demarrage (deps fonctionnelles → arbre hebergement)
- FR23: Epic 4 — Arret manuel noeud (dashboard)
- FR24: Epic 4 — Cascade arret (bottom-up arbre + re-evaluation deps)
- FR25: Epic 4 — Respect option "Confirmer avant extinction" lors re-evaluation
- FR26: Epic 4 — Protection dependances partagees pendant cascade
- FR27: Epic 4 — Demarrage machine physique via WoL
- FR28: Epic 4 — Arret machine physique via SSH
- FR29: Epic 4 — Demarrage/arret VM et LXC via Proxmox API parent
- FR30: Epic 4 — Demarrage/arret conteneur via Docker API parent
- FR31: Epic 4 — Canal de commande deduit de la capacite du parent
- FR32: Epic 4 — Progression cascade en temps reel
- FR33: Epic 4 — Relance cascade apres echec
- FR34: Epic 5 — Surveillance activite selon criteres configurables
- FR35: Epic 5 — Arret automatique apres inactivite
- FR36: Epic 5 — Delai d'inactivite par defaut (30 min)
- FR37: Epic 5 — Delai d'inactivite personnalise par noeud
- FR38: Epic 5 — Respect dependances partagees et arbre lors arret auto
- FR39: Epic 5 — Annulation arret auto si dependant actif
- FR40: Epic 4 — Tout noeud epinglable sur dashboard
- FR41: Epic 4 — Composition libre du dashboard (epinglage + bouton "+")
- FR42: Epic 4 — Etat temps reel noeuds epingles
- FR43: Epic 4 — Statut par noeud (allume, eteint, en demarrage, en arret, erreur)
- FR44: Epic 4 — Mise a jour temps reel SSE
- FR45: Epic 4 — Vue detaillee noeud (enfants, deps, services a configurer)
- FR46: Epic 4 — Bouton "Ouvrir" service (pas de redirection auto)
- FR47: Epic 4 — Option "Confirmer avant extinction" configurable par noeud
- FR48: Epic 2 — Configuration acces Docker API (direct ou tunnel SSH)
- FR49: Epic 2 — Definition URL d'acces service (bouton "Ouvrir")

**Couverture : 53/53 FRs mappes.**

## Epic List

### Epic 1 : Fondation & Authentification
L'utilisateur peut installer WakeHub via `docker compose up`, creer son compte, se connecter et acceder a une interface vide prete a etre configuree. L'infrastructure technique (monorepo, base de donnees, theme, logging) est en place.
**FRs couverts :** FR1, FR2, FR3, FR4
**Exigences supplementaires :** ARCH-01 a ARCH-21, UX-01 a UX-04, UX-15, UX-16, UX-17, NFR6, NFR7, NFR8, NFR9, NFR13-16
**Depend de :** —

### Epic 2 : Arbre d'Hebergement & Gestion des Noeuds
L'utilisateur ajoute ses machines physiques, configure les capacites Proxmox/Docker, decouvre automatiquement VMs/LXCs/conteneurs, configure les services detectes (formulaires pre-remplis), teste les connexions et gere ses noeuds (CRUD). La Couche 1 (arbre d'hebergement structurel) est completement operationnelle. Les credentials sont stockes de maniere securisee (AES-256-GCM).
**FRs couverts :** FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR48, FR49
**Exigences supplementaires :** UX-09, UX-10, UX-12, UX-13, UX-14, NFR5, NFR10, NFR11, NFR12, ARCH-11, ARCH-13, BS-01 a BS-07, BS-12
**Depend de :** Epic 1

### Epic 3 : Dependances Fonctionnelles
L'utilisateur definit les liens de dependance fonctionnelle (Couche 2) entre ses noeuds, visualise le graphe oriente, et gere les relations. Le moteur de calcul des chaines (DAG) est operationnel avec detection de cycles.
**FRs couverts :** FR15, FR16, FR17, FR18, FR19, FR20
**Exigences supplementaires :** BS-01
**Depend de :** Epic 2

### Epic 4 : Dashboard, Controle d'Alimentation & Temps Reel
L'utilisateur compose son dashboard en epinglant les noeuds de son choix, voit les statuts en temps reel (SSE), demarre et arrete ses services en un clic avec cascade automatique (orchestration deux couches). Le feedback temps reel (barre de progression, animations) est complet. C'est l'experience centrale — le "clic magique".
**FRs couverts :** FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR40, FR41, FR42, FR43, FR44, FR45, FR46, FR47
**Exigences supplementaires :** ARCH-07, ARCH-08, UX-05 a UX-08, UX-18, UX-19, NFR1, NFR2, NFR3, NFR4, NFR17, NFR18, BS-08 a BS-11
**Depend de :** Epic 2, Epic 3

### Epic 5 : Arret Automatique sur Inactivite
Le systeme surveille l'activite des noeuds selon des criteres configurables et les eteint automatiquement apres le delai configure, tout en protegeant les dependances partagees et en respectant l'arbre d'hebergement.
**FRs couverts :** FR34, FR35, FR36, FR37, FR38, FR39
**Depend de :** Epic 4

### Epic 6 : Journalisation & Diagnostic
L'utilisateur consulte l'historique complet des operations via une page de logs filtrable avec horodatage, type d'evenement et raison de chaque decision du systeme.
**FRs couverts :** FR50, FR51, FR52, FR53
**Exigences supplementaires :** ARCH-09, UX-11
**Note :** L'infrastructure de logging (pino + table en base) est posee dans l'Epic 1. Chaque epic enrichit les logs. L'Epic 6 construit la page Logs et complete la couverture.
**Depend de :** Epic 1 (infrastructure logging), Epic 4+ (donnees a afficher)

---

## Epic 1 : Fondation & Authentification

L'utilisateur peut installer WakeHub via `docker compose up`, creer son compte, se connecter et acceder a une interface vide prete a etre configuree. L'infrastructure technique (monorepo, base de donnees, theme, logging) est en place.

> **Statut : DONE** — Les 5 stories ci-dessous sont deja implementees sur la branche `nouvel-axe`.

### Story 1.1 : Initialisation du projet & premier demarrage

As a developpeur,
I want initialiser le monorepo WakeHub avec toute la stack technique,
So that l'application peut demarrer et servir une page minimale via Docker.

**Acceptance Criteria:**

**Given** le repo est clone et les dependances installees
**When** je lance `npm run dev`
**Then** le serveur Fastify demarre et sert une page React minimale ("WakeHub is running")
**And** le frontend Vite tourne en mode HMR sur un port separe en dev

**Given** le monorepo npm workspaces est configure
**When** j'inspecte la structure du projet
**Then** les workspaces `apps/web`, `apps/server` et `packages/shared` existent et sont lies
**And** TypeScript strict est configure partout via `tsconfig.base.json`
**And** le package `packages/shared` exporte des types utilisables depuis `apps/web` et `apps/server`

**Given** le fichier `docker-compose.yml` et le `Dockerfile` multi-stage existent
**When** je lance `docker compose up --build`
**Then** l'image se build et le conteneur demarre avec restart policy `unless-stopped`
**And** la base SQLite est creee dans un volume persiste

**Given** le serveur Fastify est demarre
**When** j'accede a `GET /docs`
**Then** la documentation Swagger/OpenAPI est accessible

**Given** ESLint, Vitest et pino sont configures
**When** je lance les outils
**Then** le linting, les tests et le logging JSON structure fonctionnent

---

### Story 1.2 : Theme Mantine, layout AppShell & navigation

As a utilisateur,
I want voir une interface soignee avec une navigation claire,
So that je peux naviguer entre les pages de WakeHub.

**Acceptance Criteria:**

**Given** j'ouvre WakeHub dans mon navigateur
**When** la page se charge
**Then** le theme dark est applique par defaut (fond `#1A1B1E`, accents bleu tech `#339AF0`)
**And** la police Inter est utilisee pour le texte courant et JetBrains Mono pour les elements techniques
**And** les couleurs de statut semantiques sont definies dans le theme

**Given** l'AppShell Mantine est configure
**When** la page se charge sur desktop (>=992px)
**Then** un header avec le logo WakeHub et la navigation principale est visible
**And** la zone de contenu principale affiche la page courante

**Given** je suis sur mobile (<768px)
**When** je clique sur le menu hamburger
**Then** la navigation s'ouvre en overlay avec cibles tactiles minimum 44x44px

**Given** React Router est configure
**When** je navigue entre les pages
**Then** la page correspondante s'affiche sans rechargement complet

**Given** je navigue au clavier
**When** je Tab entre les elements
**Then** un focus ring bleu (2px) est visible et l'ordre de tabulation est logique

---

### Story 1.3 : Creation de compte au premier lancement

As a utilisateur,
I want creer mon compte lors du premier lancement de WakeHub,
So that mon instance est securisee des le depart.

**Acceptance Criteria:**

**Given** aucun utilisateur n'existe en base de donnees
**When** j'accede a WakeHub
**Then** le systeme affiche un formulaire de creation de compte (nom d'utilisateur, mot de passe, confirmation, question de securite, reponse)

**Given** la table `users` n'existe pas encore
**When** la migration Drizzle s'execute
**Then** la table `users` est creee (id, username, password_hash, security_question, security_answer_hash, created_at, updated_at)
**And** la table `operation_logs` est creee (id, timestamp, level, source, message, reason, details)

**Given** je remplis le formulaire avec des donnees valides
**When** je soumets le formulaire
**Then** le compte est cree avec mot de passe hache via argon2id
**And** la reponse a la question de securite est hashee
**And** une session est automatiquement creee et je suis redirige vers l'accueil

**Given** le mot de passe et la confirmation ne correspondent pas
**When** je soumets le formulaire
**Then** un message d'erreur s'affiche et le compte n'est pas cree

**Given** un utilisateur existe deja en base
**When** j'accede a WakeHub sans session active
**Then** le formulaire de login est affiche a la place

---

### Story 1.4 : Login & gestion de session

As a utilisateur,
I want me connecter a WakeHub avec mon compte,
So that seul moi peut acceder a mon homelab.

**Acceptance Criteria:**

**Given** la table `sessions` n'existe pas encore
**When** la migration Drizzle s'execute
**Then** la table `sessions` est creee (id, user_id, token, expires_at, created_at)

**Given** un compte utilisateur existe en base
**When** j'accede a WakeHub sans session active
**Then** le formulaire de login est affiche (nom d'utilisateur + mot de passe + checkbox "Se souvenir de moi")

**Given** je saisis des identifiants valides
**When** je soumets le formulaire de login
**Then** une session est creee et un cookie HTTP-only SameSite=Lax est envoye
**And** je suis redirige vers l'accueil

**Given** je saisis des identifiants invalides
**When** je soumets le formulaire
**Then** un message generique "Identifiants incorrects" s'affiche

**Given** je coche "Se souvenir de moi"
**When** la session est creee
**Then** la duree de vie est 30 jours au lieu de 24h

**Given** je ne suis pas connecte
**When** j'accede a une route protegee
**Then** le serveur retourne 401 et le frontend redirige vers le login

**Given** je suis connecte
**When** je clique sur "Deconnexion"
**Then** la session est supprimee et le cookie efface

---

### Story 1.5 : Reinitialisation du mot de passe

As a utilisateur,
I want reinitialiser mon mot de passe si je l'oublie,
So that je ne suis pas bloque hors de mon instance WakeHub.

**Acceptance Criteria:**

**Given** je suis sur la page de login
**When** je clique sur "Mot de passe oublie"
**Then** un formulaire de reinitialisation s'affiche

**Given** le formulaire de reset est affiche
**When** je saisis mon nom d'utilisateur
**Then** la question de securite correspondante s'affiche

**Given** je fournis la bonne reponse et un nouveau mot de passe valide
**When** je soumets le formulaire
**Then** le mot de passe est mis a jour (hache argon2id)
**And** toutes les sessions existantes sont invalidees
**And** je suis redirige vers le login avec un message de succes

**Given** je fournis une mauvaise reponse
**When** je soumets le formulaire
**Then** un message d'erreur generique s'affiche sans reveler si l'utilisateur existe

---

## Epic 2 : Arbre d'Hebergement & Gestion des Noeuds

L'utilisateur ajoute ses machines physiques, configure les capacites Proxmox/Docker, decouvre automatiquement VMs/LXCs/conteneurs, configure les services detectes (formulaires pre-remplis), teste les connexions et gere ses noeuds (CRUD). La Couche 1 (arbre d'hebergement structurel) est completement operationnelle.

### Story 2.1 : Ajout d'une machine physique & base technique

As a administrateur,
I want ajouter une machine physique a WakeHub avec ses parametres de connexion,
So that WakeHub connait ma machine et peut la demarrer/arreter.

**Acceptance Criteria:**

**Given** la table `nodes` n'existe pas encore
**When** la migration Drizzle s'execute pour cette story
**Then** la table `nodes` est creee avec les colonnes : id, name, type (enum: physical, vm, lxc, container), status (enum: online, offline, starting, stopping, error), ip_address, mac_address, ssh_user, ssh_credentials_encrypted, parent_id (FK nullable → nodes), capabilities (JSON: {proxmox_api?: {...}, docker_api?: {...}}), platform_ref (JSON nullable: reference Proxmox/Docker), service_url, is_pinned (boolean defaut false), confirm_before_shutdown (boolean defaut selon type), discovered (boolean defaut false), configured (boolean defaut true), created_at, updated_at
**And** le module utilitaire `crypto.ts` est implemente avec `encrypt()` et `decrypt()` utilisant AES-256-GCM avec IV unique

**Given** l'interface `PlatformConnector` n'existe pas encore
**When** cette story est implementee
**Then** l'interface est definie dans `connectors/connector.interface.ts` avec : `testConnection()`, `start()`, `stop()`, `getStatus()`
**And** la classe `PlatformError` est implementee avec : code, message, platform, details

**Given** les types shared n'existent pas encore
**When** cette story est implementee
**Then** le package `@wakehub/shared` exporte les types : `Node`, `NodeType`, `NodeStatus`, `NodeCapabilities`, `PlatformRef`

**Given** je suis sur la page d'accueil ou la page Noeuds
**When** je clique sur le bouton "+" (ajouter une machine)
**Then** un wizard s'ouvre (Mantine Stepper) avec la premiere etape : formulaire machine physique (nom, adresse IP, adresse MAC, parametres SSH)

**Given** je remplis le formulaire avec des donnees valides
**When** je passe a l'etape suivante
**Then** un test de connexion SSH est lance automatiquement
**And** le bouton passe en etat loading pendant le test
**And** le resultat s'affiche (succes ou echec avec message d'erreur)

**Given** le test de connexion reussit
**When** je confirme l'ajout
**Then** la machine est enregistree en base (table `nodes`, type=physical) avec credentials SSH chiffres AES-256-GCM
**And** un toast de succes s'affiche
**And** l'operation est enregistree dans les logs

**Given** le test de connexion echoue
**When** le resultat s'affiche
**Then** je peux modifier les parametres et relancer le test
**And** je peux forcer l'ajout sans test reussi (avec avertissement)

**Given** le connecteur WoL/SSH est implemente
**When** il est utilise
**Then** il implemente `PlatformConnector` avec `testConnection()` (ping SSH), `start()` (WoL magic packet), `stop()` (SSH shutdown) et `getStatus()` (ping)

**Given** les routes API sont implementees
**When** `POST /api/nodes` et `GET /api/nodes` sont appeles
**Then** ils utilisent le format normalise `{ data }` / `{ error }` avec validation JSON Schema

---

### Story 2.2 : Capacite Proxmox & decouverte VMs/LXCs

As a administrateur,
I want connecter mon serveur Proxmox et decouvrir les VMs/LXCs disponibles,
So that WakeHub peut controler mes VMs et LXCs via l'API Proxmox.

**Acceptance Criteria:**

**Given** une machine physique existe en base
**When** je suis sur sa page de detail, section "Capacites"
**Then** je vois un bouton "Configurer Proxmox" si la capacite n'est pas encore configuree

**Given** je clique sur "Configurer Proxmox"
**When** le formulaire s'affiche
**Then** il demande : URL de l'API Proxmox, identifiants (utilisateur + mot de passe ou token API)

**Given** je remplis le formulaire et confirme
**When** le test de connexion Proxmox reussit
**Then** la capacite `proxmox_api` est ajoutee au champ `capabilities` du noeud avec identifiants chiffres AES-256-GCM
**And** la decouverte automatique est lancee immediatement

**Given** la decouverte Proxmox est lancee
**When** l'API Proxmox repond
**Then** toutes les VMs et LXCs sont listees avec leur nom, ID Proxmox (node, vmid) et statut actuel
**And** chaque entite decouverte est enregistree en base (table `nodes`, type=vm ou lxc, parent_id=machine, discovered=true, configured=false)
**And** la page detail de la machine affiche "X services a configurer"

**Given** je clique sur un service "decouvert non configure"
**When** le formulaire de configuration s'affiche
**Then** il est pre-rempli avec les donnees connues de l'API Proxmox (nom, ID plateforme, statut)
**And** je n'ai qu'a completer les infos manquantes (URL service, dependances)

**Given** je confirme la configuration d'un service decouvert
**When** la sauvegarde est effectuee
**Then** le noeud passe a `configured=true`
**And** il apparait dans la liste des noeuds configures
**And** un toast de succes s'affiche

**Given** le connecteur Proxmox est implemente
**When** il est utilise
**Then** il implemente `PlatformConnector` avec `testConnection()`, `start()`, `stop()`, `getStatus()` et `listResources()` via l'API Proxmox
**And** les erreurs API sont encapsulees dans `PlatformError`

**Given** l'URL API Proxmox est invalide ou les identifiants sont faux
**When** le test de connexion s'execute
**Then** un message d'erreur clair s'affiche avec le code et la description de l'erreur

---

### Story 2.3 : Capacite Docker & decouverte conteneurs

As a administrateur,
I want connecter Docker sur une machine, VM ou LXC et decouvrir les conteneurs,
So that WakeHub peut controler mes conteneurs Docker.

**Acceptance Criteria:**

**Given** un noeud de type physical, vm ou lxc existe en base
**When** je suis sur sa page de detail, section "Capacites"
**Then** je vois un bouton "Configurer Docker" si la capacite n'est pas encore configuree

**Given** je clique sur "Configurer Docker"
**When** le formulaire s'affiche
**Then** il demande : mode d'acces (direct IP:port ou tunnel SSH) et les parametres correspondants
**And** si mode direct : IP et port (defaut 2375/2376)
**And** si mode tunnel SSH : les parametres SSH du noeud sont reutilises ou configurables

**Given** je remplis le formulaire et confirme
**When** le test de connexion Docker reussit
**Then** la capacite `docker_api` est ajoutee au champ `capabilities` du noeud
**And** la decouverte automatique des conteneurs est lancee

**Given** la decouverte Docker est lancee
**When** l'API Docker repond
**Then** tous les conteneurs sont listes avec nom, image, statut et ports
**And** chaque conteneur decouvert est enregistre en base (type=container, parent_id=noeud hote, discovered=true, configured=false)

**Given** je clique sur un conteneur "decouvert non configure"
**When** le formulaire de configuration s'affiche
**Then** il est pre-rempli avec les donnees Docker (nom, image, ports, statut)

**Given** le connecteur Docker est implemente
**When** il est utilise
**Then** il implemente `PlatformConnector` avec `testConnection()`, `start()`, `stop()`, `getStatus()` et `listResources()` via l'API Docker
**And** il supporte les deux modes d'acces (direct et tunnel SSH)

**Given** l'hote Docker est injoignable
**When** le test de connexion s'execute
**Then** un message d'erreur clair s'affiche (timeout, connexion refusee, etc.)

---

### Story 2.4 : Page Noeuds & vue tabulaire

As a administrateur,
I want voir tous mes noeuds dans une liste organisee,
So that j'ai une vue d'ensemble de mon infrastructure.

**Acceptance Criteria:**

**Given** je navigue vers la page Noeuds
**When** des noeuds configures existent en base
**Then** un tableau compact (Mantine Table) affiche tous les noeuds configures
**And** les colonnes visibles sont : icone, nom, type (machine/VM/LXC/conteneur), statut (badge colore), IP, derniere activite

**Given** le tableau est affiche
**When** j'utilise les filtres
**Then** je peux filtrer par statut (actif, eteint, erreur) et par type (physical, vm, lxc, container)

**Given** aucun noeud n'est configure
**When** je navigue vers la page Noeuds
**Then** un message d'etat vide s'affiche avec un bouton vers le wizard d'ajout

**Given** je suis sur tablette (768-991px)
**When** la page Noeuds s'affiche
**Then** les colonnes secondaires (derniere activite, IP) sont masquees

**Given** je suis sur mobile (<768px)
**When** la page Noeuds s'affiche
**Then** une vue liste simplifiee est affichee (icone + nom + badge statut)

**Given** la page est en cours de chargement
**When** les donnees ne sont pas encore disponibles
**Then** des skeleton loaders en forme de lignes de tableau s'affichent

**Given** la navigation est mise a jour
**When** je consulte le menu
**Then** un lien "Noeuds" est present dans la navigation principale

---

### Story 2.5 : Page detail noeud, modification & suppression

As a administrateur,
I want consulter et modifier les parametres d'un noeud et le supprimer si necessaire,
So that je peux maintenir ma configuration a jour.

**Acceptance Criteria:**

**Given** je suis sur la page Noeuds
**When** je clique sur une ligne du tableau
**Then** je suis redirige vers la page de detail de ce noeud

**Given** la page de detail est affichee
**When** je consulte les informations
**Then** l'en-tete affiche : icone, nom, type, statut (badge), IP
**And** la section Parametres affiche les champs editables (nom, IP, MAC, URL service, credentials masques)
**And** la section "Enfants heberges" (Couche 1) affiche les VMs/LXCs/conteneurs heberges par ce noeud
**And** la section "Services a configurer" affiche les entites decouvertes non configurees avec un compteur

**Given** je modifie un ou plusieurs parametres
**When** je clique sur "Enregistrer"
**Then** les modifications sont sauvegardees en base
**And** les credentials modifies sont re-chiffres AES-256-GCM
**And** un toast de succes s'affiche

**Given** la page de detail affiche les actions
**When** je clique sur "Tester la connexion"
**Then** le connecteur correspondant execute `testConnection()` et le resultat s'affiche
**And** le bouton passe en etat loading pendant le test

**Given** je veux supprimer le noeud
**When** je clique sur "Supprimer"
**Then** une modal de confirmation s'affiche ("Supprimer definitivement [nom] ?")

**Given** le noeud a des enfants heberges
**When** la modal de confirmation s'affiche
**Then** un avertissement supplementaire liste les enfants qui seront egalement supprimes

**Given** je confirme la suppression
**When** la suppression est effectuee
**Then** le noeud et ses enfants heberges sont supprimes de la base
**And** je suis redirige vers la page Noeuds
**And** un toast de succes s'affiche

**Given** la page de detail affiche le champ "URL d'acces"
**When** je definis l'URL du service
**Then** cette URL est sauvegardee pour le bouton "Ouvrir" du dashboard

---

## Epic 3 : Dependances Fonctionnelles

L'utilisateur definit les liens de dependance fonctionnelle (Couche 2) entre ses noeuds, visualise le graphe oriente, et gere les relations. Le moteur de calcul des chaines (DAG) est operationnel avec detection de cycles.

### Story 3.1 : Definition des dependances & moteur de graphe (DAG)

As a administrateur,
I want definir les liens de dependance fonctionnelle entre mes noeuds,
So that WakeHub connait l'ordre de demarrage et d'arret de mes services.

**Acceptance Criteria:**

**Given** la table `dependency_links` n'existe pas encore
**When** la migration Drizzle s'execute
**Then** la table est creee avec : id, from_node_id (FK → nodes), to_node_id (FK → nodes), created_at
**And** un index unique empeche les doublons (from_node_id + to_node_id)
**And** la semantique est : from_node_id "depend de" to_node_id

**Given** le service `dependency-graph.ts` est implemente
**When** il est utilise
**Then** il expose : `getUpstreamChain(nodeId)` (toutes les deps recursives), `getDownstreamDependents(nodeId)` (qui depend de ce noeud), `isSharedDependency(nodeId)` (plus d'un dependant), `validateLink(fromId, toId)` (detection cycle)
**And** il detecte les cycles et refuse les liens qui en creeraient

**Given** je suis sur la page de detail d'un noeud
**When** la section Dependances fonctionnelles est affichee
**Then** je vois la liste des dependances actuelles (ce noeud depend de... / dependants de ce noeud)
**And** un bouton "Ajouter une dependance" est disponible

**Given** je clique sur "Ajouter une dependance"
**When** le formulaire s'affiche
**Then** je peux selectionner un noeud dont ce noeud depend (ou un noeud qui depend de celui-ci) via liste deroulante

**Given** je selectionne une dependance et confirme
**When** le lien est valide (pas de cycle, pas de doublon)
**Then** le lien est enregistre en base
**And** la liste des dependances se met a jour
**And** un toast de succes s'affiche

**Given** je selectionne une dependance qui creerait un cycle
**When** je confirme l'ajout
**Then** un message d'erreur s'affiche ("Ce lien creerait un cycle de dependances")
**And** le lien n'est pas cree

**Given** je veux supprimer un lien de dependance
**When** je clique sur l'icone corbeille a cote du lien
**Then** une confirmation rapide est demandee et le lien est supprime

**Given** les routes API sont implementees
**When** `POST /api/dependencies`, `GET /api/dependencies?nodeId=X`, `DELETE /api/dependencies/:id` sont appeles
**Then** ils utilisent le format normalise avec validation JSON Schema

---

### Story 3.2 : Visualisation du graphe de dependances

As a administrateur,
I want visualiser le graphe complet de mes dependances fonctionnelles,
So that je comprends les relations entre tous mes noeuds d'un coup d'oeil.

**Acceptance Criteria:**

**Given** je suis sur une page dediee aux dependances ou dans la section graphe
**When** le graphe est affiche
**Then** un composant graphe visuel (React Flow ou equivalent) affiche tous les noeuds et leurs liens fonctionnels
**And** chaque noeud affiche : icone, nom, type et badge de statut
**And** les liens sont representes par des fleches directionnelles (dependant → dependance)

**Given** des dependances partagees existent
**When** le graphe est affiche
**Then** les noeuds partages (plus d'un dependant) sont visuellement distincts (bordure speciale)

**Given** le graphe est affiche sur desktop
**When** je consulte le graphe
**Then** il est interactif : zoom, pan, et clic sur un noeud pour naviguer vers sa page de detail

**Given** le graphe est affiche sur mobile
**When** je consulte le graphe
**Then** il s'adapte a l'ecran avec zoom pince et scroll tactile

**Given** aucune dependance fonctionnelle n'est definie
**When** le graphe est affiche
**Then** un message invite l'utilisateur a definir des dependances

**Given** le theme Mantine est applique
**When** le graphe est rendu
**Then** les couleurs de statut semantiques sont utilisees pour les noeuds

---

## Epic 4 : Dashboard, Controle d'Alimentation & Temps Reel

L'utilisateur compose son dashboard en epinglant les noeuds de son choix, voit les statuts en temps reel (SSE), demarre et arrete ses services en un clic avec cascade automatique (orchestration deux couches). C'est l'experience centrale — le "clic magique".

### Story 4.1 : Moteur de cascade & orchestration deux couches

As a utilisateur,
I want que WakeHub demarre automatiquement toute la chaine quand je lance un service,
So that je n'ai pas a demarrer chaque machine/VM/conteneur manuellement.

**Acceptance Criteria:**

**Given** la table `cascades` n'existe pas encore
**When** la migration Drizzle s'execute
**Then** la table est creee avec : id, node_id, type (enum: start, stop), status (enum: pending, in_progress, completed, failed), current_step, total_steps, failed_step, error_code, error_message, started_at, completed_at

**Given** le service `cascade-engine.ts` est implemente
**When** une cascade de demarrage est demandee pour un noeud
**Then** le moteur resout d'abord les dependances fonctionnelles (Couche 2, recursif, les plus profondes d'abord)
**And** pour chaque noeud a demarrer, il remonte l'arbre d'hebergement (Couche 1) et s'assure que chaque parent est up du haut vers le bas
**And** il attend que chaque noeud soit effectivement up avant de passer au suivant (sequentiel, jamais parallele)
**And** chaque etape a un timeout configurable (30 secondes par defaut)

**Given** le service `connector-factory.ts` est implemente
**When** il doit controler un noeud
**Then** il selectionne le connecteur correct selon le type du noeud et la capacite du parent (FR31)
**And** machine physique → WoL/SSH, VM/LXC → Proxmox API du parent, conteneur → Docker API du parent

**Given** une cascade de demarrage est en cours
**When** une etape echoue (erreur connecteur ou timeout)
**Then** la cascade s'arrete a l'etape en echec
**And** l'enregistrement en base est mis a jour (status=failed, failed_step, error_code, error_message)
**And** les dependances deja demarrees restent actives (pas de rollback)

**Given** une cascade d'arret est demandee
**When** le moteur execute l'arret
**Then** il descend l'arbre d'hebergement (bottom-up : enfants d'abord, recursivement)
**And** il eteint le noeud demande
**And** il re-evalue les dependances fonctionnelles : les deps du noeud eteint ont-elles encore des dependants actifs ?

**Given** la re-evaluation detecte une dependance orpheline
**When** l'option "Confirmer avant extinction" est activee sur ce noeud
**Then** une notification/popup propose l'extinction (pas d'arret automatique)
**When** l'option est desactivee
**Then** le noeud est eteint automatiquement

**Given** une dependance partagee est utilisee par un autre service actif (hors cascade en cours)
**When** le moteur tente de l'eteindre
**Then** il la laisse active et enregistre la raison dans les logs

**Given** les routes API sont implementees
**When** `POST /api/cascades/start` ou `POST /api/cascades/stop` sont appeles avec un node_id
**Then** la cascade est lancee de maniere asynchrone et la reponse retourne immediatement l'ID de la cascade

---

### Story 4.2 : Endpoint SSE & communication temps reel

As a utilisateur,
I want voir les mises a jour de statut en temps reel sans recharger la page,
So that je sais toujours l'etat actuel de mes services.

**Acceptance Criteria:**

**Given** le service `sse-manager.ts` est implemente
**When** il est utilise
**Then** il gere les connexions SSE des clients (ajout, suppression a la deconnexion)
**And** il expose `broadcast(event, data)` pour envoyer un evenement a tous les clients
**And** il gere la reconnexion automatique (Last-Event-ID)

**Given** la route `GET /api/events` est implementee
**When** un client authentifie se connecte
**Then** une connexion SSE est etablie (Content-Type: text/event-stream)
**And** la connexion est protegee par le middleware auth
**And** un heartbeat est envoye toutes les 30 secondes

**Given** le moteur de cascade execute une cascade
**When** une etape progresse
**Then** un evenement SSE `cascade-progress` est emis avec : cascadeId, nodeId, step, totalSteps, currentDependency

**Given** une cascade se termine
**When** elle reussit → evenement `cascade-complete` (cascadeId, nodeId, success=true)
**When** elle echoue → evenement `cascade-error` (cascadeId, nodeId, failedStep, error)

**Given** le statut d'un noeud change
**When** le changement est detecte
**Then** un evenement SSE `status-change` est emis avec : nodeId, nodeType, status, timestamp

**Given** le hook React `useSSE()` est implemente
**When** l'utilisateur est connecte
**Then** une connexion SSE est etablie au montage
**And** les evenements SSE declenchent `queryClient.invalidateQueries()` sur les cles TanStack Query concernees
**And** la reconnexion est automatique en cas de coupure

---

### Story 4.3 : Dashboard — Epinglage, ServiceTiles & StatsBar

As a utilisateur,
I want voir mon dashboard avec les noeuds que j'ai epingles et leur statut en temps reel,
So that je peux demarrer un service en un clic et voir l'etat de mon homelab.

**Acceptance Criteria:**

**Given** je navigue vers le Dashboard
**When** des noeuds epingles existent (is_pinned=true)
**Then** un bandeau StatsBar affiche 4 tuiles : noeuds actifs, cascades du jour, temps moyen cascade, heures d'inactivite
**And** une grille de ServiceTiles affiche les noeuds epingles

**Given** le dashboard est affiche sur desktop (>=992px) / tablette (768-991px) / mobile (<768px)
**When** des noeuds epingles existent
**Then** la grille passe de 3 colonnes (desktop) a 2 (tablette) a 1 (mobile)

**Given** un ServiceTile est affiche
**When** je le consulte
**Then** il affiche : icone, nom, badge statut colore, type/plateforme, resume dependances, bouton contextuel unique

**Given** un noeud est eteint
**When** son ServiceTile est affiche
**Then** le bouton affiche "Demarrer" (bleu tech) — clic lance une cascade immediatement (pas de confirmation)

**Given** un noeud est actif
**When** son ServiceTile est affiche
**Then** le bouton affiche "Ouvrir" — clic ouvre l'URL du service dans un nouvel onglet

**Given** un noeud est en erreur
**When** son ServiceTile est affiche
**Then** le bouton affiche "Reessayer" (orange) et un message court d'erreur est visible

**Given** je veux epingler/desepingler un noeud
**When** je clique sur le bouton epingler (page detail, ligne tableau) ou "+" sur le dashboard
**Then** le champ `is_pinned` est mis a jour et le dashboard se rafraichit

**Given** aucun noeud n'est epingle
**When** le dashboard est affiche
**Then** un message invite l'utilisateur a epingler des noeuds depuis la page Noeuds

**Given** les ServiceTiles sont affiches
**When** je navigue au clavier
**Then** `role="article"` avec `aria-label` est present, Tab navigue entre les cartes

---

### Story 4.4 : CascadeProgress & feedback visuel

As a utilisateur,
I want voir la progression de la cascade en temps reel sur la carte du service,
So that je sais exactement ce qui se passe pendant le demarrage.

**Acceptance Criteria:**

**Given** une cascade est en cours pour un noeud
**When** le ServiceTile est affiche
**Then** une barre de progression fine (3px) apparait en bordure basse de la carte (bleu tech)
**And** la progression est proportionnelle (etape courante / total)

**Given** la cascade progresse (evenement SSE cascade-progress)
**When** une nouvelle etape demarre
**Then** le nom et l'icone de la dependance en cours s'affichent avec transition fade 200ms
**And** la barre avance

**Given** la cascade reussit (cascade-complete)
**When** le service est operationnel
**Then** la barre se remplit, flash vert, puis disparait
**And** le ServiceTile passe a badge "Actif" + bouton "Ouvrir"
**And** un toast de succes s'affiche

**Given** la cascade echoue (cascade-error)
**When** une etape echoue
**Then** la barre passe en rouge et s'arrete
**And** un message "Echec : [nom dependance]" s'affiche sur la carte
**And** le bouton passe a "Reessayer"
**And** un toast d'erreur s'affiche

**Given** le CascadeProgress est affiche
**When** l'accessibilite est verifiee
**Then** `role="progressbar"` avec `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax=100` est present
**And** `aria-live="polite"` sur la zone de dependance en cours

**Given** l'utilisateur a active `prefers-reduced-motion`
**When** une cascade est en cours
**Then** les transitions sont instantanees (pas d'animation)

---

### Story 4.5 : ServiceDetailPanel & arret manuel

As a utilisateur,
I want voir le detail complet d'un noeud et pouvoir l'arreter depuis le panneau lateral,
So that je peux comprendre son etat et agir depuis un seul endroit.

**Acceptance Criteria:**

**Given** je clique sur un ServiceTile (hors bouton d'action)
**When** le clic est enregistre
**Then** le ServiceDetailPanel s'ouvre (Mantine Drawer) a droite
**And** sur desktop : 380px, sur mobile : plein ecran

**Given** le ServiceDetailPanel est ouvert
**When** je consulte l'en-tete
**Then** il affiche : icone, nom, badge statut, bouton fermer (X), bouton editer (crayon) qui navigue vers la page detail/edition du noeud

**Given** l'onglet "Dependances" est actif (par defaut)
**When** je le consulte
**Then** la chaine de dependances complete est affichee en liste verticale
**And** chaque maillon affiche : icone, nom, type et badge de statut individuel (mis a jour en temps reel)

**Given** l'onglet "Logs" est selectionne
**When** je le consulte
**Then** les derniers evenements lies a ce noeud s'affichent (horodatage, type, description)

**Given** la zone Actions est affichee (fixee en bas du panneau)
**When** le noeud est eteint → bouton "Demarrer"
**When** le noeud est actif → boutons "Ouvrir" + "Arreter"
**When** le noeud est en erreur → bouton "Reessayer"
**When** le noeud est en demarrage/arret → boutons desactives (loading)

**Given** je clique sur "Arreter" dans la zone Actions
**When** la modal de confirmation s'affiche
**Then** elle liste les enfants heberges et dependants qui seront arretes
**And** elle mentionne les dependances partagees qui seront protegees

**Given** je confirme l'arret
**When** la cascade d'arret est lancee
**Then** le badge passe a "En arret" (orange) et les boutons sont desactives

**Given** le panneau est ouvert
**When** je clique sur X, en dehors du Drawer, ou Escape
**Then** le panneau se ferme

**Given** un autre ServiceTile est clique alors que le panneau est ouvert
**When** le clic est enregistre
**Then** le panneau se met a jour avec les infos du nouveau noeud (pas de fermeture/reouverture)

**Given** le panneau est ouvert
**When** l'accessibilite est verifiee
**Then** `aria-label="Detail du service [nom]"` est present, focus trappe dans le panneau, onglets navigables au clavier

---

## Epic 5 : Arret Automatique sur Inactivite

Le systeme surveille l'activite des noeuds selon des criteres configurables et les eteint automatiquement apres le delai configure, tout en protegeant les dependances partagees et en respectant l'arbre d'hebergement.

### Story 5.1 : Moteur de surveillance d'inactivite

As a administrateur,
I want que WakeHub surveille l'activite de mes services et les eteigne automatiquement apres un delai d'inactivite,
So that mon homelab ne consomme pas d'electricite inutilement.

**Acceptance Criteria:**

**Given** la table `inactivity_rules` n'existe pas encore
**When** la migration Drizzle s'execute
**Then** la table est creee avec : id, node_id (FK → nodes), timeout_minutes (defaut 30), monitoring_criteria (JSON: types de criteres actifs), is_enabled (boolean defaut true), created_at, updated_at

**Given** le service `inactivity-monitor.ts` est implemente
**When** il est demarre avec le serveur
**Then** il execute une boucle de verification periodique (toutes les minutes) pour chaque noeud actif ayant une regle d'inactivite activee

**Given** un noeud actif a une regle d'inactivite configuree
**When** le moniteur verifie l'activite
**Then** il interroge les criteres configurables : connexions reseau, activite CPU/RAM, dernier acces
**And** si aucune activite → incremente le compteur d'inactivite

**Given** le delai d'inactivite est depasse
**When** le moniteur le detecte
**Then** il declenche une cascade d'arret via le cascade-engine
**And** un evenement SSE `auto-shutdown` est emis
**And** l'operation est enregistree dans les logs avec la raison

**Given** de l'activite est detectee sur un noeud
**When** le compteur d'inactivite est en cours
**Then** le compteur est remis a zero et l'arret est annule

**Given** les routes API sont implementees
**When** `GET /api/inactivity-rules?nodeId=X` et `PUT /api/inactivity-rules/:id` sont appeles
**Then** les regles sont retournees ou mises a jour

---

### Story 5.2 : Protection des dependances & configuration UI

As a administrateur,
I want que l'arret automatique respecte les dependances et pouvoir configurer les regles d'inactivite,
So that mes services partages ne sont jamais eteints par erreur.

**Acceptance Criteria:**

**Given** un arret automatique est declenche
**When** la cascade d'arret rencontre une dependance partagee avec un dependant actif
**Then** la dependance est sautee (reste active)
**And** la raison est enregistree dans les logs

**Given** un arret automatique est sur le point de se declencher
**When** un dependant actif est detecte sur le noeud lui-meme
**Then** l'arret automatique est completement annule
**And** la raison est enregistree dans les logs

**Given** je suis sur la page de detail d'un noeud
**When** la section "Regles d'inactivite" est affichee
**Then** je peux configurer : activer/desactiver (toggle), delai en minutes (defaut 30), criteres de surveillance (checkboxes)

**Given** je modifie les regles d'inactivite
**When** je clique sur "Enregistrer"
**Then** les regles sont sauvegardees en base
**And** le moniteur prend en compte les nouvelles regles au prochain cycle
**And** un toast de succes s'affiche

**Given** je desactive la surveillance pour un noeud
**When** le toggle est desactive
**Then** le moniteur ignore ce noeud et il reste actif indefiniment

---

## Epic 6 : Journalisation & Diagnostic

L'utilisateur consulte l'historique complet des operations via une page de logs filtrable avec horodatage, type d'evenement et raison de chaque decision du systeme.

### Story 6.1 : Enrichissement du logging & persistance complete

As a developpeur,
I want que toutes les operations et decisions soient enregistrees de maniere exhaustive,
So that l'utilisateur peut comprendre chaque action de WakeHub.

**Acceptance Criteria:**

**Given** la table `operation_logs` existe depuis l'Epic 1
**When** le schema est enrichi pour cette story
**Then** la table contient : id, timestamp, level (info/warn/error), source (cascade-engine, inactivity-monitor, connector-*), node_id (nullable), node_name, event_type (start, stop, auto-shutdown, error, decision, connection-test), message, reason (nullable), error_code (nullable), error_details (nullable JSON), cascade_id (nullable)

**Given** le moteur de cascade execute une cascade
**When** chaque etape progresse ou echoue
**Then** un log est enregistre avec source "cascade-engine", node_id, cascade_id et message descriptif

**Given** une cascade echoue
**When** l'erreur est capturee
**Then** un log est enregistre avec level "error", error_code (PlatformError code) et error_details

**Given** le moniteur d'inactivite prend une decision
**When** un arret auto est declenche ou annule
**Then** un log est enregistre avec source "inactivity-monitor", event_type "auto-shutdown" ou "decision", et la raison complete

**Given** un connecteur execute une operation
**When** l'operation reussit ou echoue
**Then** un log est enregistre avec source du connecteur et details PlatformError si echec

**Given** la route `GET /api/logs` est implementee
**When** elle est appelee
**Then** elle retourne les logs avec pagination (limit, offset) et filtres (node_id, event_type, level, cascade_id, date_from, date_to, search)

---

### Story 6.2 : Page Logs & interface de diagnostic

As a utilisateur,
I want consulter l'historique des logs depuis l'interface,
So that je peux diagnostiquer les problemes et verifier le bon fonctionnement de mon homelab.

**Acceptance Criteria:**

**Given** je navigue vers la page Logs
**When** des logs sont enregistres
**Then** un tableau chronologique (Mantine Table) affiche les logs du plus recent au plus ancien
**And** colonnes : horodatage (JetBrains Mono), noeud (nom + icone), type evenement (badge colore), description, raison

**Given** le tableau est affiche
**When** j'utilise les filtres
**Then** je peux filtrer par noeud, stack dependances, type evenement, periode, et recherche libre

**Given** un log d'erreur est affiche
**When** je le consulte
**Then** le code d'erreur et le message de la plateforme sont visibles
**And** le log est visuellement mis en evidence (fond rouge subtil)

**Given** aucun log n'existe
**When** je navigue vers la page Logs
**Then** un message d'etat vide s'affiche

**Given** je suis sur tablette ou mobile
**When** la page Logs s'affiche
**Then** les colonnes secondaires sont masquees et un clic ouvre le detail complet

**Given** les logs sont accessibles depuis le ServiceDetailPanel (Story 4.5)
**When** l'onglet Logs est affiche
**Then** les logs sont filtres pour le noeud concerne avec un lien "Voir tous les logs"

**Given** la navigation est mise a jour
**When** je consulte le menu
**Then** un lien "Logs" est present dans la navigation principale
