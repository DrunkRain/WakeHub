---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - prd.md
  - architecture.md
  - ux-design-specification.md
---

# WakeHub - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for WakeHub, decomposing the requirements from the PRD, UX Design and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**Authentification & Securite Utilisateur**
- FR1: Lors de la premiere ouverture, le systeme affiche un formulaire de creation de compte (nom d'utilisateur, mot de passe, confirmation)
- FR2: L'utilisateur peut se connecter via login avec mot de passe hache et session authentifiee (nom d'utilisateur + mot de passe)
- FR3: L'utilisateur peut activer "Se souvenir de moi" pour maintenir sa session
- FR4: L'utilisateur peut reinitialiser son mot de passe via un formulaire de reset securise (verification de l'identite par question ou token)

**Gestion de l'Infrastructure**
- FR5: L'administrateur peut ajouter une machine physique (adresse IP, adresse MAC)
- FR6: L'administrateur peut ajouter un serveur Proxmox (URL API, identifiants)
- FR7: L'administrateur peut ajouter un hote Docker (URL API)
- FR8: Le systeme liste les VMs disponibles sur un serveur Proxmox connecte
- FR9: Le systeme liste les conteneurs disponibles sur un hote Docker connecte
- FR10: L'administrateur peut tester la connexion a une machine ou un service
- FR11: L'administrateur peut supprimer une machine, VM ou conteneur
- FR12: L'administrateur peut modifier les parametres d'une machine, VM ou conteneur

**Gestion des Dependances**
- FR13: L'administrateur peut definir des liens de dependance entre machines, VMs, conteneurs et services
- FR14: L'administrateur peut definir des dependances partagees (ressource utilisee par plusieurs services)
- FR15: Le systeme calcule la chaine de dependances complete pour un service donne
- FR16: L'administrateur peut visualiser le graphe de dependances de son infrastructure
- FR17: L'administrateur peut modifier ou supprimer un lien de dependance

**Controle d'Alimentation**
- FR18: L'utilisateur peut demarrer un service en un clic depuis le dashboard
- FR19: Le systeme demarre automatiquement toute la chaine de dependances (cascade ascendante)
- FR20: L'utilisateur peut arreter manuellement un service depuis le dashboard
- FR21: Le systeme arrete un service et ses dependances en cascade (cascade descendante)
- FR22: Le systeme verifie qu'aucun service actif n'utilise une dependance partagee avant de l'eteindre
- FR23: Le systeme demarre une machine physique via Wake-on-LAN
- FR24: Le systeme arrete une machine physique via SSH ou API
- FR25: Le systeme demarre et arrete une VM via l'API Proxmox
- FR26: Le systeme demarre et arrete un conteneur via l'API Docker
- FR27: Le systeme affiche la progression de chaque etape lors d'un demarrage en cascade
- FR28: L'utilisateur peut relancer un demarrage en cascade apres un echec

**Surveillance d'Inactivite & Arret Automatique**
- FR29: Le systeme surveille l'activite d'un service selon des criteres configurables (connexions reseau, requetes API, activite CPU/RAM, sessions utilisateur)
- FR30: Le systeme declenche un arret automatique apres une periode d'inactivite configurable
- FR31: L'administrateur peut definir un delai d'inactivite par defaut (30 minutes)
- FR32: L'administrateur peut personnaliser le delai d'inactivite par service
- FR33: Le systeme respecte les dependances partagees lors d'un arret automatique
- FR34: Le systeme annule un arret automatique si un dependant actif est detecte

**Dashboard & Visualisation**
- FR35: L'utilisateur voit l'etat de toutes les machines, VMs et conteneurs en temps reel
- FR36: L'utilisateur voit le statut de chaque service (allume, eteint, en demarrage, en arret, erreur)
- FR37: Le systeme met a jour les statuts en temps reel sans rechargement de page
- FR38: L'utilisateur peut acceder a une vue detaillee d'une machine (VMs, conteneurs, dependances)
- FR39: L'utilisateur peut ouvrir le service une fois operationnel via un bouton "Ouvrir" (pas de redirection automatique — decision UX)

**Configuration & Parametrage**
- FR40: L'administrateur peut acceder a une page de parametres dediee
- FR41: L'administrateur peut configurer les identifiants de connexion aux API (Proxmox, Docker)
- FR42: L'administrateur peut configurer les parametres de connexion SSH pour les machines physiques
- FR43: L'administrateur peut definir l'URL d'acces a chaque service (pour le bouton "Ouvrir")

**Journalisation & Diagnostic**
- FR44: Le systeme enregistre toutes les operations (demarrages, arrets, erreurs) avec horodatage
- FR45: Le systeme enregistre la raison de chaque decision (arret annule car dependant actif, etc.)
- FR46: L'utilisateur peut consulter l'historique des logs depuis l'interface
- FR47: Le systeme affiche l'etape en echec, le code d'erreur et le message de la plateforme lors d'une cascade echouee

### NonFunctional Requirements

**Performance**
- NFR1: Dashboard charge en moins de 15 secondes
- NFR2: Cascade complete en moins de 2 minutes (variable selon complexite)
- NFR3: Mises a jour temps reel en moins de 3 secondes apres changement d'etat
- NFR4: Appels API avec timeout configurable (30 secondes par defaut) pour eviter les blocages

**Securite**
- NFR5: Donnees sensibles chiffrees au repos (identifiants API, cles SSH, tokens) — AES-256-GCM
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
- UX-04: Layout AppShell — header avec logo + navigation (Dashboard, Machines, Settings, Logs, Notifications) + zone de contenu
- UX-05: Dashboard — StatsBar (4 tuiles : services actifs, cascades du jour, temps moyen cascade, economie d'energie) + grille ServiceTiles (3 col desktop, 2 tablette, 1 mobile)
- UX-06: ServiceTile — carte interactive avec icone, nom, badge statut, plateforme, resume dependances, bouton contextuel unique (Demarrer/Ouvrir/Reessayer selon etat)
- UX-07: CascadeProgress — barre fine 3px en bordure basse de la carte + animation dependance en cours (nom + icone avec transition 200ms)
- UX-08: ServiceDetailPanel — Drawer lateral 380px desktop / plein ecran mobile. Onglets : Dependances (chaine avec statut chaque maillon) + Logs (recents). Zone Actions fixee en bas
- UX-09: Page Machines — vue tabulaire compacte (Table Mantine). Colonnes : icone, nom, statut badge, plateforme, IP, derniere activite. Filtres par statut et plateforme
- UX-10: Page Detail Machine — page dediee avec en-tete, section parametres editables, section dependances, regles d'inactivite, logs, actions (test connexion, demarrer, arreter, supprimer)
- UX-11: Page Logs — tableau chronologique filtrable (machine/service, stack dependances, type evenement, periode, recherche libre) avec colonne "raison de la decision"
- UX-12: Wizard ajout machine — Stepper Mantine (selection type → formulaire specifique → test connexion → decouverte VMs/conteneurs si applicable)
- UX-13: Toasts Notification Mantine — ~5s tous types, position haut-droite, un seul a la fois, 4 types (succes vert, erreur rouge, warning orange, info bleu)
- UX-14: Modals de confirmation pour actions destructives uniquement (Arreter → popup "Arreter X et ses dependances ?", Supprimer → popup "Supprimer definitivement X ?"). Jamais de confirmation pour Demarrer/Ouvrir/Reessayer
- UX-15: Skeleton loaders pour chargement initial (forme des elements attendus), boutons en etat loading pendant les actions, pas de spinner generique plein ecran
- UX-16: Responsive desktop-first — desktop >=992px (3+ col, Drawer 380px), tablette 768-991px (2 col), mobile <768px (1 col, hamburger menu, Drawer plein ecran, stats 2x2)
- UX-17: Accessibilite WCAG AA — contraste 4.5:1, focus ring bleu 2px, aria-labels explicites, role="progressbar" + aria-valuenow sur CascadeProgress, aria-live="polite" pendant cascade, prefers-reduced-motion respecte, cibles tactiles 44x44px minimum, skip link
- UX-18: Bouton unique contextuel par carte (Demarrer/Ouvrir/Reessayer) + Arreter uniquement dans le panneau lateral
- UX-19: Icones — Tabler Icons (defaut Mantine) + dashboard-icons (icones de services homelab : Jellyfin, Nextcloud, Proxmox, etc.)
- UX-20: Note FR39 — Le PRD mentionne une redirection automatique, mais le UX spec a explicitement decide contre. L'utilisateur clique sur "Ouvrir" quand il le souhaite. L'architecture suit cette decision UX

### FR Coverage Map

- FR1: Epic 1 — Creation de compte au premier lancement
- FR2: Epic 1 — Login avec session authentifiee
- FR3: Epic 1 — Option "Se souvenir de moi"
- FR4: Epic 1 — Reset de mot de passe securise
- FR5: Epic 2 — Ajout machine physique (IP + MAC)
- FR6: Epic 2 — Ajout serveur Proxmox (URL API + identifiants)
- FR7: Epic 2 — Ajout hote Docker (URL API)
- FR8: Epic 2 — Liste des VMs Proxmox
- FR9: Epic 2 — Liste des conteneurs Docker
- FR10: Epic 2 — Test de connexion machine/service
- FR11: Epic 2 — Suppression machine/VM/conteneur
- FR12: Epic 2 — Modification parametres machine/VM/conteneur
- FR13: Epic 3 — Definition liens de dependance
- FR14: Epic 3 — Definition dependances partagees
- FR15: Epic 3 — Calcul chaine de dependances complete
- FR16: Epic 3 — Visualisation graphe de dependances
- FR17: Epic 3 — Modification/suppression lien de dependance
- FR18: Epic 4 — Demarrage service en un clic
- FR19: Epic 4 — Cascade ascendante automatique
- FR20: Epic 4 — Arret manuel depuis le dashboard
- FR21: Epic 4 — Cascade descendante
- FR22: Epic 4 — Verification dependances partagees avant arret
- FR23: Epic 4 — Demarrage machine physique via WoL
- FR24: Epic 4 — Arret machine physique via SSH/API
- FR25: Epic 4 — Demarrage/arret VM via API Proxmox
- FR26: Epic 4 — Demarrage/arret conteneur via API Docker
- FR27: Epic 4 — Progression cascade en temps reel
- FR28: Epic 4 — Relance cascade apres echec
- FR29: Epic 5 — Surveillance activite selon criteres configurables
- FR30: Epic 5 — Arret automatique apres inactivite
- FR31: Epic 5 — Delai d'inactivite par defaut (30 min)
- FR32: Epic 5 — Delai d'inactivite personnalise par service
- FR33: Epic 5 — Respect dependances partagees en arret auto
- FR34: Epic 5 — Annulation arret auto si dependant actif
- FR35: Epic 4 — Etat temps reel de toutes les ressources
- FR36: Epic 4 — Statut de chaque service (allume, eteint, en demarrage, en arret, erreur)
- FR37: Epic 4 — Mise a jour temps reel sans rechargement
- FR38: Epic 4 — Vue detaillee d'une machine
- FR39: Epic 4 — Bouton "Ouvrir" vers le service (decision UX : pas de redirection automatique)
- FR40: Epic 2 — Page de parametres dediee
- FR41: Epic 2 — Configuration identifiants API (Proxmox, Docker)
- FR42: Epic 2 — Configuration parametres SSH
- FR43: Epic 2 — Definition URL d'acces a chaque service
- FR44: Epic 6 — Enregistrement de toutes les operations avec horodatage
- FR45: Epic 6 — Enregistrement de la raison de chaque decision
- FR46: Epic 6 — Consultation historique des logs depuis l'interface
- FR47: Epic 6 — Affichage etape en echec, code d'erreur et message plateforme

**Couverture : 47/47 FRs mappes.**

## Epic List

### Epic 1 : Fondation & Authentification
L'utilisateur peut installer WakeHub via `docker compose up`, creer son compte, se connecter et acceder a un dashboard fonctionnel (vide) avec navigation complete. L'infrastructure technique (monorepo, base de donnees, theme, logging) est en place.
**FRs couverts :** FR1, FR2, FR3, FR4
**Exigences supplementaires :** ARCH-01 a ARCH-21, UX-01 a UX-04, UX-15, UX-16, UX-17, NFR6, NFR7, NFR8, NFR9, NFR13-16
**Depend de :** —

### Epic 2 : Gestion de l'Infrastructure
L'utilisateur peut ajouter ses machines physiques, serveurs Proxmox et hotes Docker via un wizard guide, decouvrir les VMs/conteneurs, tester les connexions, configurer et modifier les parametres, et supprimer des ressources. Les credentials sont stockes de maniere securisee (AES-256-GCM).
**FRs couverts :** FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR40, FR41, FR42, FR43
**Exigences supplementaires :** UX-09, UX-10, UX-12, UX-13, UX-14, NFR5, NFR10, NFR11, NFR12, ARCH-11, ARCH-13
**Depend de :** Epic 1

### Epic 3 : Configuration des Dependances
L'utilisateur peut definir les liens de dependance entre ses ressources (machine → VM → conteneur), gerer les dependances partagees, visualiser le graphe complet et modifier les relations. Le moteur de calcul des chaines de dependances (DAG) est operationnel.
**FRs couverts :** FR13, FR14, FR15, FR16, FR17
**Exigences supplementaires :** Service dependency-graph backend
**Depend de :** Epic 2

### Epic 4 : Dashboard & Controle d'Alimentation
L'utilisateur peut demarrer et arreter ses services depuis le dashboard avec cascade automatique des dependances, feedback temps reel via SSE (barre de progression + animation), et acces au service via bouton "Ouvrir". C'est l'experience centrale — le "clic magique".
**FRs couverts :** FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28, FR35, FR36, FR37, FR38, FR39
**Exigences supplementaires :** ARCH-07, ARCH-08, UX-05 a UX-08, UX-18, UX-19, NFR1, NFR2, NFR3, NFR4
**Note FR39 :** Implemente comme bouton "Ouvrir" (decision UX), pas comme redirection automatique.
**Depend de :** Epic 2, Epic 3

### Epic 5 : Arret Automatique sur Inactivite
Le systeme surveille l'activite des services selon des criteres configurables et les eteint automatiquement apres le delai configure, tout en protegeant les dependances partagees. Le homelab se gere tout seul — "l'intelligence invisible".
**FRs couverts :** FR29, FR30, FR31, FR32, FR33, FR34
**Depend de :** Epic 4

### Epic 6 : Journalisation & Diagnostic
L'utilisateur peut consulter l'historique complet de toutes les operations et comprendre chaque decision du systeme via une page de logs filtrable avec horodatage, type d'evenement et raison de chaque decision.
**FRs couverts :** FR44, FR45, FR46, FR47
**Exigences supplementaires :** ARCH-09, UX-11
**Note :** L'infrastructure de logging (pino + table en base) est posee dans l'Epic 1. Chaque epic enrichit les logs. L'Epic 6 construit la page Logs utilisateur et complete la couverture.
**Depend de :** Epic 1 (infrastructure logging), Epic 4+ (donnees a afficher)

---

## Epic 1 : Fondation & Authentification

L'utilisateur peut installer WakeHub via `docker compose up`, creer son compte, se connecter et acceder a un dashboard fonctionnel (vide) avec navigation complete. L'infrastructure technique (monorepo, base de donnees, theme, logging) est en place.

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
**Then** l'image se build (frontend Vite + backend compile) et le conteneur demarre
**And** le serveur Fastify sert les fichiers statiques du frontend et l'API sur le meme port
**And** la base SQLite est creee dans un volume persiste
**And** la restart policy est `unless-stopped`

**Given** le serveur Fastify est demarre
**When** j'accede a `GET /docs`
**Then** la documentation Swagger/OpenAPI est accessible (@fastify/swagger-ui)

**Given** le fichier `.env.example` existe
**When** je le copie en `.env` et configure les variables (PORT, ENCRYPTION_KEY, DATABASE_PATH, SESSION_SECRET, NODE_ENV)
**Then** le serveur utilise ces variables au demarrage

**Given** ESLint et eslint-plugin-jsx-a11y sont configures
**When** je lance `npm run lint`
**Then** les regles de qualite et d'accessibilite sont verifiees sur tout le code

**Given** Vitest est configure
**When** je lance `npm run test`
**Then** les tests s'executent sur tous les workspaces

**Given** pino est configure comme logger Fastify
**When** le serveur demarre
**Then** les logs sont emis en JSON structure sur stdout

**Given** Drizzle ORM est configure avec better-sqlite3
**When** le serveur demarre
**Then** la connexion a la base SQLite est etablie et le systeme de migrations est pret

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
**And** les couleurs de statut semantiques sont definies dans le theme (vert, gris, jaune, rouge, orange)

**Given** l'AppShell Mantine est configure
**When** la page se charge sur desktop (>=992px)
**Then** un header avec le logo WakeHub et la navigation principale est visible (Dashboard, Machines, Settings, Logs)
**And** la zone de contenu principale affiche la page courante

**Given** je suis sur mobile (<768px)
**When** je clique sur le menu hamburger
**Then** la navigation s'ouvre en overlay
**And** les cibles tactiles font minimum 44x44px

**Given** React Router est configure
**When** je navigue vers une page (Dashboard, Machines, Settings, Logs)
**Then** la page correspondante s'affiche sans rechargement complet
**And** l'URL du navigateur est mise a jour

**Given** je navigue vers une page vide (aucune donnee)
**When** la page se charge
**Then** un message d'etat vide contextuel est affiche avec une icone
**And** un call-to-action est propose si applicable ("Ajoutez votre premiere machine")

**Given** une page est en cours de chargement
**When** les donnees ne sont pas encore disponibles
**Then** des skeleton loaders reprenant la forme des elements attendus sont affiches
**And** aucun spinner generique plein ecran n'est utilise

**Given** je navigue au clavier
**When** je Tab entre les elements interactifs
**Then** un focus ring bleu (2px) est visible sur chaque element
**And** l'ordre de tabulation est logique (header → contenu)
**And** un skip link "Aller au contenu" est present en haut de page

**Given** le systeme d'icones est configure
**When** je consulte l'interface
**Then** les icones Tabler Icons sont disponibles dans tous les composants

---

### Story 1.3 : Creation de compte au premier lancement

As a utilisateur,
I want creer mon compte lors du premier lancement de WakeHub,
So that mon instance est securisee des le depart.

**Acceptance Criteria:**

**Given** aucun utilisateur n'existe en base de donnees
**When** j'accede a WakeHub
**Then** le systeme affiche un formulaire de creation de compte avec un message de bienvenue
**And** le formulaire contient : nom d'utilisateur, mot de passe, confirmation du mot de passe, question de securite, reponse a la question de securite

**Given** la table `users` n'existe pas encore
**When** la migration Drizzle s'execute pour cette story
**Then** la table `users` est creee avec les colonnes : id, username, password_hash, security_question, security_answer_hash, created_at, updated_at
**And** la table `operation_logs` est creee pour la persistance des logs pino (id, timestamp, level, source, message, reason, details)

**Given** je remplis le formulaire avec des donnees valides
**When** je soumis le formulaire
**Then** le compte est cree en base avec le mot de passe hache via argon2id
**And** la reponse a la question de securite est stockee de maniere securisee (hashee)
**And** je suis redirige vers le dashboard (vide)
**And** une session est automatiquement creee (je suis connecte)
**And** l'operation est enregistree dans les logs

**Given** je remplis le formulaire avec un mot de passe trop court (<8 caracteres)
**When** je soumis le formulaire
**Then** un message d'erreur clair s'affiche sous le champ mot de passe
**And** le compte n'est pas cree

**Given** le mot de passe et la confirmation ne correspondent pas
**When** je soumis le formulaire
**Then** un message d'erreur s'affiche sous le champ confirmation
**And** le compte n'est pas cree

**Given** un utilisateur existe deja en base
**When** j'accede a WakeHub sans session active
**Then** le formulaire de creation de compte n'est plus affiche
**And** le formulaire de login est affiche a la place

**Given** le formulaire est soumis
**When** l'API repond
**Then** la reponse utilise le format normalise `{ data }` pour le succes ou `{ error: { code, message } }` pour les erreurs

---

### Story 1.4 : Login & gestion de session

As a utilisateur,
I want me connecter a WakeHub avec mon compte,
So that seul moi peut acceder a mon homelab.

**Acceptance Criteria:**

**Given** la table `sessions` n'existe pas encore
**When** la migration Drizzle s'execute pour cette story
**Then** la table `sessions` est creee avec les colonnes : id, user_id, token, expires_at, created_at

**Given** un compte utilisateur existe en base
**When** j'accede a WakeHub sans session active
**Then** le formulaire de login est affiche (nom d'utilisateur + mot de passe + checkbox "Se souvenir de moi")

**Given** je saisis des identifiants valides
**When** je soumis le formulaire de login
**Then** une session est creee en base et un cookie HTTP-only, SameSite=Strict est envoye au navigateur
**And** je suis redirige vers le dashboard
**And** l'operation est enregistree dans les logs

**Given** je saisis des identifiants invalides
**When** je soumis le formulaire de login
**Then** un message d'erreur generique s'affiche ("Identifiants incorrects") sans reveler si c'est le nom d'utilisateur ou le mot de passe qui est faux

**Given** je coche "Se souvenir de moi" avant de me connecter
**When** la session est creee
**Then** la duree de vie de la session est etendue (30 jours au lieu de 24h)

**Given** je suis connecte
**When** j'accede a une route protegee `/api/*`
**Then** le middleware auth verifie le cookie de session et autorise l'acces

**Given** je ne suis pas connecte (pas de session ou session expiree)
**When** j'accede a une route protegee
**Then** le serveur retourne 401 et le frontend redirige vers le formulaire de login

**Given** je suis connecte
**When** je clique sur "Deconnexion"
**Then** la session est supprimee en base et le cookie est efface
**And** je suis redirige vers le formulaire de login
**And** l'operation est enregistree dans les logs

**Given** les routes `/api/auth/login` et `/api/auth/register`
**When** elles sont appelees sans session
**Then** elles sont accessibles (pas protegees par le middleware auth)

**Given** TanStack Query et Zustand sont configures
**When** l'application frontend se charge
**Then** le hook `useAuth()` est disponible pour verifier l'etat d'authentification
**And** les queries TanStack sont configurees pour gerer les 401 globalement

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
**When** je le consulte
**Then** il demande le nom d'utilisateur, la reponse a la question de securite, le nouveau mot de passe et sa confirmation
**And** la question de securite de l'utilisateur est affichee apres saisie du nom d'utilisateur

**Given** je fournis la bonne reponse a la question de securite et un nouveau mot de passe valide
**When** je soumis le formulaire
**Then** le mot de passe est mis a jour en base (hache avec argon2id)
**And** toutes les sessions existantes de l'utilisateur sont invalidees (supprimees de la table `sessions`)
**And** je suis redirige vers le formulaire de login avec un message de succes
**And** l'operation est enregistree dans les logs

**Given** je fournis une mauvaise reponse a la question de securite
**When** je soumis le formulaire
**Then** un message d'erreur s'affiche ("Reponse incorrecte")
**And** le mot de passe n'est pas modifie

**Given** je saisis un nom d'utilisateur qui n'existe pas
**When** je soumis le formulaire
**Then** un message d'erreur generique s'affiche sans reveler si l'utilisateur existe ou non

**Given** le nouveau mot de passe est trop court (<8 caracteres)
**When** je soumis le formulaire
**Then** un message d'erreur s'affiche sous le champ mot de passe
**And** le mot de passe n'est pas modifie

---

## Epic 2 : Gestion de l'Infrastructure

L'utilisateur peut ajouter ses machines physiques, serveurs Proxmox et hotes Docker via un wizard guide, decouvrir les VMs/conteneurs, tester les connexions, configurer et modifier les parametres, et supprimer des ressources. Les credentials sont stockes de maniere securisee (AES-256-GCM).

### Story 2.1 : Ajout d'une machine physique (WoL/SSH)

As a administrateur,
I want ajouter une machine physique a WakeHub avec ses parametres de connexion,
So that WakeHub connait ma machine et peut la demarrer/arreter.

**Acceptance Criteria:**

**Given** la table `machines` n'existe pas encore
**When** la migration Drizzle s'execute pour cette story
**Then** la table `machines` est creee avec les colonnes : id, name, type (enum: physical, proxmox, docker), ip_address, mac_address, ssh_user, ssh_credentials_encrypted, api_url, api_credentials_encrypted, service_url, status, created_at, updated_at
**And** le module utilitaire `crypto.ts` est implemente avec les fonctions `encrypt()` et `decrypt()` utilisant AES-256-GCM avec IV unique par credential

**Given** l'interface `PlatformConnector` n'existe pas encore
**When** cette story est implementee
**Then** l'interface `PlatformConnector` est definie dans `connectors/connector.interface.ts` avec les methodes : `testConnection()`, `start()`, `stop()`, `getStatus()`
**And** la classe `PlatformError` est implementee dans `utils/platform-error.ts` avec les proprietes : code, message, platform, details

**Given** je suis sur le dashboard ou la page Machines
**When** je clique sur le bouton "+" (ajouter une machine)
**Then** un wizard s'ouvre (Mantine Stepper) avec la premiere etape : selection du type de machine

**Given** l'etape 1 du wizard est affichee
**When** je selectionne "Machine physique (WoL/SSH)"
**Then** l'etape 2 affiche un formulaire avec : nom, adresse IP, adresse MAC, parametres SSH (utilisateur, mot de passe ou cle)

**Given** je remplis le formulaire avec des donnees valides
**When** je passe a l'etape suivante
**Then** un test de connexion SSH est lance automatiquement vers la machine
**And** le bouton passe en etat loading pendant le test
**And** le resultat du test s'affiche (succes ou echec avec message d'erreur)

**Given** le test de connexion reussit
**When** je confirme l'ajout
**Then** la machine est enregistree en base (table `machines`) avec ses parametres
**And** les credentials SSH sont chiffres avec AES-256-GCM avant stockage
**And** un toast de succes s'affiche (~5s, haut-droite)
**And** l'operation est enregistree dans les logs

**Given** le test de connexion echoue
**When** le resultat s'affiche
**Then** je peux modifier les parametres et relancer le test
**And** je peux aussi forcer l'ajout sans test reussi (avec un avertissement)

**Given** le connecteur WoL/SSH est implemente
**When** il est utilise
**Then** il implemente `PlatformConnector` avec `testConnection()` (ping SSH), `start()` (WoL magic packet), `stop()` (SSH shutdown command) et `getStatus()` (ping)
**And** les erreurs sont encapsulees dans `PlatformError`

**Given** je soumis le formulaire avec des champs obligatoires vides
**When** la validation s'execute
**Then** les champs en erreur sont mis en evidence avec un message d'erreur sous chaque champ

---

### Story 2.2 : Ajout d'un serveur Proxmox & decouverte des VMs

As a administrateur,
I want connecter mon serveur Proxmox a WakeHub et selectionner les VMs a gerer,
So that WakeHub peut controler mes VMs Proxmox.

**Acceptance Criteria:**

**Given** la table `resources` n'existe pas encore
**When** la migration Drizzle s'execute pour cette story
**Then** la table `resources` est creee avec les colonnes : id, machine_id (FK → machines), name, type (enum: vm, container), platform_ref (JSON: node, vmid pour Proxmox / container_id pour Docker), status, service_url, inactivity_timeout, created_at, updated_at

**Given** le wizard d'ajout est ouvert
**When** je selectionne "Serveur Proxmox"
**Then** l'etape 2 affiche un formulaire avec : nom, URL de l'API Proxmox, identifiants (utilisateur + mot de passe ou token API)

**Given** je remplis le formulaire Proxmox avec des donnees valides
**When** je passe a l'etape suivante
**Then** un test de connexion a l'API Proxmox est lance
**And** le bouton passe en etat loading pendant le test
**And** le resultat s'affiche (succes ou echec avec message d'erreur de la plateforme)

**Given** la connexion a l'API Proxmox reussit
**When** l'etape de decouverte s'affiche
**Then** WakeHub liste toutes les VMs disponibles sur le serveur avec leur nom, ID et statut actuel
**And** l'utilisateur peut selectionner les VMs qu'il souhaite ajouter a WakeHub

**Given** j'ai selectionne une ou plusieurs VMs
**When** je confirme l'ajout
**Then** le serveur Proxmox est enregistre en base (table `machines`, type=proxmox) avec ses identifiants chiffres (AES-256-GCM)
**And** les VMs selectionnees sont enregistrees en base (table `resources`, type=vm) avec leur reference Proxmox (node, vmid)
**And** un toast de succes s'affiche
**And** l'operation est enregistree dans les logs

**Given** le connecteur Proxmox est implemente
**When** il est utilise
**Then** il implemente `PlatformConnector` avec `testConnection()`, `start()`, `stop()`, `getStatus()` et `listResources()` via l'API Proxmox
**And** les erreurs API Proxmox sont encapsulees dans `PlatformError`

**Given** l'URL API Proxmox est invalide ou les identifiants sont faux
**When** le test de connexion s'execute
**Then** un message d'erreur clair s'affiche avec le code et la description de l'erreur Proxmox

---

### Story 2.3 : Ajout d'un hote Docker & decouverte des conteneurs

As a administrateur,
I want connecter un hote Docker a WakeHub et selectionner les conteneurs a gerer,
So that WakeHub peut controler mes conteneurs Docker.

**Acceptance Criteria:**

**Given** le wizard d'ajout est ouvert
**When** je selectionne "Hote Docker"
**Then** l'etape 2 affiche un formulaire avec : nom, URL de l'API Docker (ex: `tcp://192.168.1.10:2375` ou socket Unix)

**Given** je remplis le formulaire Docker avec des donnees valides
**When** je passe a l'etape suivante
**Then** un test de connexion a l'API Docker est lance
**And** le bouton passe en etat loading pendant le test
**And** le resultat s'affiche (succes ou echec)

**Given** la connexion a l'API Docker reussit
**When** l'etape de decouverte s'affiche
**Then** WakeHub liste tous les conteneurs disponibles sur l'hote avec leur nom, image et statut actuel
**And** l'utilisateur peut selectionner les conteneurs qu'il souhaite ajouter a WakeHub

**Given** j'ai selectionne un ou plusieurs conteneurs
**When** je confirme l'ajout
**Then** l'hote Docker est enregistre en base (table `machines`, type=docker) avec son URL
**And** les conteneurs selectionnes sont enregistres en base (table `resources`, type=container) avec leur reference Docker (container_id, nom)
**And** un toast de succes s'affiche
**And** l'operation est enregistree dans les logs

**Given** le connecteur Docker est implemente
**When** il est utilise
**Then** il implemente `PlatformConnector` avec `testConnection()`, `start()`, `stop()`, `getStatus()` et `listResources()` via l'API Docker
**And** les erreurs API Docker sont encapsulees dans `PlatformError`

**Given** l'hote Docker est injoignable
**When** le test de connexion s'execute
**Then** un message d'erreur clair s'affiche avec le type d'erreur (timeout, connexion refusee, etc.)

---

### Story 2.4 : Page Machines & vue tabulaire

As a administrateur,
I want voir toutes mes machines, VMs et conteneurs dans une liste organisee,
So that j'ai une vue d'ensemble de mon infrastructure.

**Acceptance Criteria:**

**Given** je navigue vers la page Machines
**When** des machines et resources sont enregistrees en base
**Then** un tableau compact (Mantine Table) affiche toutes les ressources
**And** les colonnes visibles sont : icone, nom, statut (badge colore), plateforme, adresse IP, derniere activite

**Given** le tableau est affiche
**When** je clique sur l'en-tete d'une colonne
**Then** le tableau est trie par cette colonne (ascendant/descendant)

**Given** le tableau est affiche
**When** j'utilise les filtres
**Then** je peux filtrer par statut (actif, eteint, erreur) et par plateforme (Machine physique, Proxmox, Docker)

**Given** aucune machine n'est enregistree
**When** je navigue vers la page Machines
**Then** un message d'etat vide s'affiche ("Aucune machine configuree") avec un bouton vers le wizard d'ajout

**Given** je suis sur tablette (768-991px)
**When** la page Machines s'affiche
**Then** les colonnes secondaires (derniere activite, IP) sont masquees pour gagner de la place

**Given** je suis sur mobile (<768px)
**When** la page Machines s'affiche
**Then** une vue liste simplifiee est affichee (icone + nom + badge statut)

**Given** la page est en cours de chargement
**When** les donnees ne sont pas encore disponibles
**Then** des skeleton loaders en forme de lignes de tableau s'affichent

**Given** les donnees sont chargees via TanStack Query
**When** je consulte la page
**Then** les donnees sont mises en cache et les rechargements subsequents sont instantanes

---

### Story 2.5 : Page detail machine, modification & suppression

As a administrateur,
I want consulter et modifier les parametres d'une machine et la supprimer si necessaire,
So that je peux maintenir ma configuration a jour et gerer mes ressources.

**Acceptance Criteria:**

**Given** je suis sur la page Machines
**When** je clique sur une ligne du tableau
**Then** je suis redirige vers la page de detail de cette machine

**Given** la page de detail est affichee
**When** je consulte les informations
**Then** l'en-tete affiche : icone, nom, statut (badge), plateforme, adresse IP
**And** la section Parametres affiche tous les champs editables (nom, IP, MAC, URL API, identifiants, URL d'acces au service)
**And** les credentials sont masques par defaut (champs mot de passe)

**Given** je modifie un ou plusieurs parametres
**When** je clique sur "Enregistrer"
**Then** les modifications sont sauvegardees en base
**And** les credentials modifies sont re-chiffres avec AES-256-GCM
**And** un toast de succes s'affiche
**And** l'operation est enregistree dans les logs

**Given** je modifie un parametre avec une valeur invalide
**When** je clique sur "Enregistrer"
**Then** les champs en erreur sont mis en evidence avec un message d'erreur
**And** les modifications ne sont pas sauvegardees

**Given** la page de detail affiche les actions
**When** je clique sur "Tester la connexion"
**Then** le connecteur correspondant execute `testConnection()` et le resultat s'affiche (succes ou echec avec details)
**And** le bouton passe en etat loading pendant le test

**Given** je veux supprimer la machine
**When** je clique sur "Supprimer"
**Then** une modal de confirmation s'affiche ("Supprimer definitivement [nom] ?") avec bouton danger rouge

**Given** la modal de confirmation est affichee
**When** je confirme la suppression
**Then** la machine (et ses resources associees) est supprimee de la base
**And** un toast de succes s'affiche
**And** je suis redirige vers la page Machines
**And** l'operation est enregistree dans les logs

**Given** la page de detail affiche le champ "URL d'acces"
**When** je definis l'URL du service (ex: `http://192.168.1.10:8096` pour Jellyfin)
**Then** cette URL est sauvegardee et sera utilisee pour le bouton "Ouvrir" dans le dashboard

**Given** je suis sur la page de detail
**When** je clique sur "Retour"
**Then** je suis redirige vers la page Machines

---

## Epic 3 : Configuration des Dependances

L'utilisateur peut definir les liens de dependance entre ses ressources (machine → VM → conteneur), gerer les dependances partagees, visualiser le graphe complet et modifier les relations. Le moteur de calcul des chaines de dependances (DAG) est operationnel.

### Story 3.1 : Definition des dependances & moteur de graphe

As a administrateur,
I want definir les liens de dependance entre mes machines, VMs et conteneurs,
So that WakeHub connait l'ordre de demarrage et d'arret de mes services.

**Acceptance Criteria:**

**Given** la table `dependency_links` n'existe pas encore
**When** la migration Drizzle s'execute pour cette story
**Then** la table `dependency_links` est creee avec les colonnes : id, parent_type (enum: machine, resource), parent_id, child_type (enum: machine, resource), child_id, is_shared (boolean, defaut false), created_at
**And** un index unique empeche les doublons (parent_type + parent_id + child_type + child_id)

**Given** le service `dependency-graph.ts` est implemente
**When** il est utilise
**Then** il peut calculer la chaine de dependances complete pour un service donne (ascendante et descendante)
**And** il detecte les dependances partagees (une ressource parent avec plusieurs enfants)
**And** il detecte les cycles et refuse les liens qui en creeraient
**And** il expose les methodes : `getUpstreamChain(resourceId)`, `getDownstreamDependents(resourceId)`, `isSharedDependency(resourceId)`, `validateLink(parentId, childId)`

**Given** je suis sur la page de detail d'une machine ou resource
**When** la section Dependances est affichee
**Then** je vois la liste des dependances actuelles (parents et enfants) avec leur nom et type
**And** un bouton "Ajouter une dependance" est disponible

**Given** je clique sur "Ajouter une dependance"
**When** le formulaire d'ajout s'affiche
**Then** je peux selectionner une ressource parente (dont depend cette ressource) ou une ressource enfante (qui depend de cette ressource) depuis une liste deroulante
**And** je peux marquer la dependance comme "partagee" via une checkbox

**Given** je selectionne une dependance et confirme
**When** le lien est valide (pas de cycle, pas de doublon)
**Then** le lien est enregistre en base (table `dependency_links`)
**And** un toast de succes s'affiche
**And** la liste des dependances se met a jour
**And** l'operation est enregistree dans les logs

**Given** je selectionne une dependance qui creerait un cycle
**When** je confirme l'ajout
**Then** un message d'erreur s'affiche ("Ce lien creerait un cycle de dependances")
**And** le lien n'est pas cree

**Given** les routes API `POST /api/dependencies`, `GET /api/dependencies?resourceId=X`, `DELETE /api/dependencies/:id` sont implementees
**When** elles sont appelees
**Then** elles utilisent le format de reponse normalise `{ data }` / `{ error }`
**And** la validation JSON Schema Fastify est appliquee

**Given** je consulte les dependances d'une ressource
**When** la chaine est calculee
**Then** le service `dependency-graph` retourne la chaine complete (ex: NAS → VM-Media → Jellyfin) avec le statut de chaque maillon

---

### Story 3.2 : Visualisation du graphe de dependances

As a administrateur,
I want visualiser le graphe complet de mes dependances,
So that je comprends les relations entre toutes mes ressources d'un coup d'oeil.

**Acceptance Criteria:**

**Given** je suis sur la page de detail d'une machine/resource ou sur une page dediee aux dependances
**When** le graphe de dependances est affiche
**Then** un composant graphe visuel (React Flow ou equivalent) affiche toutes les ressources et leurs liens
**And** chaque noeud affiche : icone, nom, type de plateforme et badge de statut
**And** les liens sont representes par des fleches directionnelles (parent → enfant)

**Given** le graphe est affiche
**When** des dependances partagees existent
**Then** les noeuds partages sont visuellement distincts (bordure speciale ou icone indicateur)
**And** les liens multiples depuis un noeud partage sont clairement visibles

**Given** le graphe est affiche sur desktop
**When** je consulte le graphe
**Then** il est interactif : zoom, pan, et clic sur un noeud pour naviguer vers sa page de detail

**Given** le graphe est affiche sur mobile
**When** je consulte le graphe
**Then** il s'adapte a l'ecran avec une mise en page verticale simplifiee
**And** les interactions tactiles (zoom pince, scroll) sont supportees

**Given** le theme Mantine est applique
**When** le graphe est rendu
**Then** les couleurs de statut semantiques sont utilisees pour les noeuds (vert actif, gris eteint, etc.)
**And** le fond et les lignes respectent le theme dark/light

**Given** aucune dependance n'est definie
**When** le graphe est affiche
**Then** un message invite l'utilisateur a definir des dependances

---

### Story 3.3 : Modification & suppression de dependances

As a administrateur,
I want modifier ou supprimer des liens de dependance existants,
So that je peux ajuster la configuration de mon infrastructure quand elle evolue.

**Acceptance Criteria:**

**Given** je suis sur la page de detail d'une resource, section Dependances
**When** je consulte un lien de dependance existant
**Then** chaque lien affiche un bouton de suppression (icone corbeille)

**Given** je clique sur le bouton de suppression d'un lien
**When** la suppression est demandee
**Then** une modal de confirmation s'affiche ("Supprimer le lien entre [parent] et [enfant] ?")

**Given** la suppression de ce lien isolerait une resource (plus aucun parent dans la chaine)
**When** la modal de confirmation s'affiche
**Then** un avertissement supplementaire est affiche ("Attention : [resource] n'aura plus de dependance parente")

**Given** je confirme la suppression
**When** le lien est supprime
**Then** le lien est retire de la table `dependency_links`
**And** le graphe et la liste des dependances sont mis a jour
**And** un toast de succes s'affiche
**And** l'operation est enregistree dans les logs

**Given** je veux modifier le caractere "partagee" d'une dependance
**When** je bascule le toggle "Dependance partagee" sur un lien existant
**Then** le champ `is_shared` est mis a jour en base
**And** un toast de succes s'affiche

**Given** je modifie les dependances depuis le graphe visuel (Story 3.2)
**When** je fais un clic droit ou un clic long sur un lien
**Then** un menu contextuel propose "Supprimer ce lien"
**And** la meme logique de confirmation et suppression s'applique

**Given** je supprime une machine (Story 2.5) qui a des dependances
**When** la suppression est confirmee
**Then** tous les liens de dependance impliquant cette machine sont automatiquement supprimes en cascade (ON DELETE CASCADE)

---

## Epic 4 : Dashboard & Controle d'Alimentation

L'utilisateur peut demarrer et arreter ses services depuis le dashboard avec cascade automatique des dependances, feedback temps reel via SSE (barre de progression + animation), et acces au service via bouton "Ouvrir". C'est l'experience centrale — le "clic magique".

### Story 4.1 : Moteur de cascade & orchestration

As a utilisateur,
I want que WakeHub demarre automatiquement toute la chaine de dependances quand je lance un service,
So that je n'ai pas a demarrer chaque machine/VM/conteneur manuellement.

**Acceptance Criteria:**

**Given** la table `cascades` n'existe pas encore
**When** la migration Drizzle s'execute pour cette story
**Then** la table `cascades` est creee avec les colonnes : id, resource_id, type (enum: start, stop), status (enum: pending, in_progress, completed, failed), current_step, total_steps, failed_step, error_code, error_message, started_at, completed_at

**Given** le service `cascade-engine.ts` est implemente
**When** une cascade de demarrage est demandee pour un service
**Then** le moteur utilise `dependency-graph.getUpstreamChain()` pour obtenir la chaine complete
**And** il demarre chaque dependance dans l'ordre (de la racine vers le service cible) en appelant le connecteur correspondant (`start()`)
**And** il attend que chaque dependance soit operationnelle (via `getStatus()` avec polling) avant de passer a la suivante
**And** chaque etape a un timeout configurable (30 secondes par defaut, NFR4)

**Given** une dependance partagee est deja en cours de demarrage par une autre cascade
**When** le moteur rencontre cette dependance
**Then** il attend que le demarrage en cours se termine au lieu de lancer un deuxieme demarrage
**And** la cascade continue normalement une fois la dependance partagee operationnelle

**Given** une cascade de demarrage est en cours
**When** une etape echoue (erreur du connecteur ou timeout)
**Then** la cascade s'arrete a l'etape en echec
**And** l'enregistrement cascade en base est mis a jour avec : status=failed, failed_step, error_code, error_message
**And** les dependances deja demarrees restent actives (pas de rollback automatique)
**And** l'erreur est enregistree dans les logs avec le detail de la plateforme

**Given** une cascade de demarrage reussit
**When** toutes les dependances et le service cible sont operationnels
**Then** l'enregistrement cascade en base est mis a jour avec : status=completed, completed_at
**And** l'operation est enregistree dans les logs

**Given** une cascade d'arret est demandee pour un service
**When** le moteur execute l'arret
**Then** il utilise `dependency-graph.getDownstreamDependents()` pour identifier les enfants
**And** il arrete dans l'ordre inverse (du service cible vers les dependances racine)
**And** avant d'arreter chaque dependance, il verifie via `isSharedDependency()` et `getDownstreamDependents()` qu'aucun autre service actif ne l'utilise

**Given** une dependance partagee est utilisee par un autre service actif
**When** le moteur tente de l'arreter
**Then** il saute cette dependance (la laisse active)
**And** la raison est enregistree dans les logs ("Arret de [nom] annule — dependant actif : [service]")

**Given** les routes API sont implementees
**When** `POST /api/cascades/start` est appele avec un resource_id
**Then** une cascade de demarrage est lancee de maniere asynchrone
**And** la reponse retourne immediatement l'ID de la cascade avec status=pending

**Given** les routes API sont implementees
**When** `POST /api/cascades/stop` est appele avec un resource_id
**Then** une cascade d'arret est lancee de maniere asynchrone
**And** la reponse retourne immediatement l'ID de la cascade

---

### Story 4.2 : Endpoint SSE & communication temps reel

As a utilisateur,
I want voir les mises a jour de statut en temps reel sans recharger la page,
So that je sais toujours l'etat actuel de mes services.

**Acceptance Criteria:**

**Given** le service `sse-manager.ts` est implemente
**When** il est utilise
**Then** il gere les connexions SSE des clients (ajout, suppression a la deconnexion)
**And** il expose une methode `broadcast(event, data)` pour envoyer un evenement a tous les clients connectes
**And** il gere la reconnexion automatique (Last-Event-ID)

**Given** la route `GET /api/events` est implementee
**When** un client authentifie se connecte
**Then** une connexion SSE est etablie (Content-Type: text/event-stream)
**And** la connexion est protegee par le middleware auth (cookie de session)
**And** un heartbeat est envoye toutes les 30 secondes pour maintenir la connexion

**Given** le moteur de cascade (Story 4.1) execute une cascade
**When** une etape de la cascade progresse
**Then** un evenement SSE `cascade-progress` est emis avec : cascadeId, serviceId, step, totalSteps, currentDependency (id, name, status)

**Given** une cascade se termine
**When** elle reussit
**Then** un evenement SSE `cascade-complete` est emis avec : cascadeId, serviceId, success=true
**When** elle echoue
**Then** un evenement SSE `cascade-error` est emis avec : cascadeId, serviceId, failedStep, error (code, message)

**Given** le statut d'une resource change (demarrage, arret, erreur)
**When** le changement est detecte
**Then** un evenement SSE `status-change` est emis avec : resourceId, resourceType, status, timestamp

**Given** le hook React `useSSE()` est implemente
**When** l'application frontend se charge (utilisateur connecte)
**Then** une connexion SSE est etablie au montage de l'app
**And** les evenements SSE declenchent `queryClient.invalidateQueries()` sur les cles de cache TanStack Query concernees
**And** la reconnexion est automatique en cas de coupure (natif EventSource API)

**Given** l'utilisateur n'est pas connecte
**When** il tente d'acceder a `GET /api/events`
**Then** le serveur retourne 401

---

### Story 4.3 : Dashboard — ServiceTiles & StatsBar

As a utilisateur,
I want voir le dashboard avec tous mes services et leur statut en temps reel,
So that je peux demarrer un service en un clic et voir l'etat de mon homelab.

**Acceptance Criteria:**

**Given** je navigue vers la page Dashboard
**When** des services (resources avec service_url) sont configures
**Then** un bandeau StatsBar affiche 4 tuiles en haut : services actifs (compte), cascades du jour (compte), temps moyen de cascade, economie d'energie estimee (heures d'inactivite)
**And** chaque tuile utilise un composant Mantine Paper avec icone, valeur et label

**Given** le StatsBar est affiche
**When** les donnees changent (via SSE)
**Then** les chiffres se mettent a jour en temps reel sans rechargement

**Given** le dashboard est affiche sur desktop (>=992px)
**When** des services sont configures
**Then** une grille de ServiceTiles s'affiche en 3 colonnes sous le StatsBar
**And** le gap entre les cartes est de 24px (lg)

**Given** le dashboard est affiche sur tablette (768-991px)
**When** des services sont configures
**Then** la grille passe a 2 colonnes

**Given** le dashboard est affiche sur mobile (<768px)
**When** des services sont configures
**Then** la grille passe a 1 colonne
**And** le StatsBar s'affiche en grille 2x2

**Given** un ServiceTile est affiche
**When** je le consulte
**Then** il affiche : icone du service (dashboard-icons ou Tabler Icons), nom (H3), badge de statut colore (Actif vert, Eteint gris, En demarrage jaune, Erreur rouge, En arret orange), type de plateforme (texte secondaire), resume de la chaine de dependances (une ligne)

**Given** un service est eteint
**When** son ServiceTile est affiche
**Then** le bouton contextuel affiche "Demarrer" (bleu tech)

**Given** je clique sur le bouton "Demarrer" d'un ServiceTile
**When** le clic est enregistre
**Then** la cascade de demarrage est lancee immediatement (pas de confirmation)
**And** le bouton passe en etat loading (desactive)
**And** le badge passe a "En demarrage" (jaune)

**Given** un service est actif
**When** son ServiceTile est affiche
**Then** le bouton contextuel affiche "Ouvrir" (bleu tech)
**And** le clic sur "Ouvrir" ouvre l'URL du service dans un nouvel onglet

**Given** un service est en erreur (cascade echouee)
**When** son ServiceTile est affiche
**Then** le bouton contextuel affiche "Reessayer" (orange)
**And** un message court d'erreur est affiche sur la carte ("Echec : [nom dependance]")

**Given** je survole un ServiceTile avec la souris
**When** le hover est detecte
**Then** la carte s'eleve legerement (shadow + translate Y -2px)

**Given** aucun service n'est configure
**When** le dashboard est affiche
**Then** un message d'etat vide s'affiche ("Ajoutez votre premiere machine") avec un bouton vers le wizard d'ajout

**Given** les ServiceTiles sont affiches
**When** je navigue au clavier
**Then** `role="article"` avec `aria-label="Service [nom] — [statut]"` est present sur chaque carte
**And** le bouton d'action a un `aria-label` explicite ("Demarrer Jellyfin", "Ouvrir Nextcloud")
**And** Tab navigue entre les cartes, Enter ouvre le panneau lateral, Tab atteint le bouton d'action

---

### Story 4.4 : CascadeProgress & feedback visuel

As a utilisateur,
I want voir la progression de la cascade en temps reel sur la carte du service,
So that je sais exactement ce qui se passe pendant le demarrage.

**Acceptance Criteria:**

**Given** une cascade de demarrage est en cours pour un service
**When** le ServiceTile est affiche
**Then** le composant CascadeProgress est visible sur la carte
**And** une barre de progression fine (3px) apparait en bordure basse de la carte, couleur bleu tech
**And** la progression est proportionnelle au nombre de dependances (etape courante / total)

**Given** la cascade progresse (evenement SSE cascade-progress)
**When** une nouvelle etape demarre
**Then** l'animation de la carte affiche le nom et l'icone de la dependance en cours de demarrage
**And** la transition entre les dependances est fluide (fade 200ms)
**And** la barre de progression avance

**Given** la cascade reussit (evenement SSE cascade-complete)
**When** le service est operationnel
**Then** la barre de progression se remplit completement (vert, flash)
**And** la barre disparait apres une courte transition
**And** le ServiceTile revient a son etat normal avec badge "Actif" (vert) et bouton "Ouvrir"
**And** un toast de succes s'affiche ("Jellyfin demarre avec succes", ~5s)

**Given** la cascade echoue (evenement SSE cascade-error)
**When** une etape echoue
**Then** la barre de progression s'arrete et passe en rouge
**And** la carte affiche "Echec : [nom dependance en echec]" avec icone erreur
**And** le bouton passe a "Reessayer" (orange)
**And** un toast d'erreur s'affiche ("Echec : [message]", ~5s)

**Given** un service est en etat d'echec avec bouton "Reessayer"
**When** je clique sur "Reessayer"
**Then** une nouvelle cascade de demarrage est lancee depuis le debut (tous les dependances)
**And** le CascadeProgress reprend

**Given** le CascadeProgress est affiche
**When** l'accessibilite est verifiee
**Then** la barre a `role="progressbar"` avec `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax=100`
**And** `aria-label="Demarrage en cours — etape [N] sur [total] : [nom dependance]"`
**And** la zone de dependance en cours a `aria-live="polite"`

**Given** l'utilisateur a active `prefers-reduced-motion`
**When** une cascade est en cours
**Then** les transitions sont instantanees (pas d'animation de fade)
**And** la barre de progression avance sans animation

---

### Story 4.5 : ServiceDetailPanel

As a utilisateur,
I want voir le detail complet d'un service avec ses dependances et logs recents,
So that je peux comprendre son etat et agir depuis un seul endroit.

**Acceptance Criteria:**

**Given** je clique sur un ServiceTile (hors bouton d'action)
**When** le clic est enregistre
**Then** le ServiceDetailPanel s'ouvre (Mantine Drawer) a droite
**And** sur desktop : le Drawer fait 380px et la grille passe a 2 colonnes
**And** sur mobile (<768px) : le Drawer s'ouvre en plein ecran

**Given** le ServiceDetailPanel est ouvert
**When** je consulte l'en-tete
**Then** il affiche : icone du service, nom, badge de statut, bouton fermer (ActionIcon X)

**Given** le ServiceDetailPanel est ouvert
**When** l'onglet "Dependances" est actif (par defaut)
**Then** la chaine de dependances complete est affichee en liste verticale
**And** chaque maillon affiche : icone, nom, type de plateforme et badge de statut individuel
**And** les statuts se mettent a jour en temps reel (via SSE)

**Given** le ServiceDetailPanel est ouvert
**When** je clique sur l'onglet "Logs"
**Then** un tableau des derniers evenements lies a ce service s'affiche
**And** les colonnes sont : horodatage, type d'evenement, description
**And** les logs sont filtres automatiquement pour ce service

**Given** le ServiceDetailPanel est ouvert
**When** je consulte la zone Actions (fixee en bas du panneau)
**Then** les boutons disponibles dependent de l'etat du service :
- Eteint → "Demarrer"
- Actif → "Ouvrir" + "Arreter"
- Erreur → "Reessayer"
- En demarrage / En arret → boutons desactives (loading)

**Given** le ServiceDetailPanel est ouvert
**When** je clique sur le bouton X, ou en dehors du Drawer, ou sur la touche Escape
**Then** le panneau se ferme
**And** la grille revient a 3 colonnes sur desktop

**Given** le ServiceDetailPanel est ouvert sur mobile
**When** je swipe vers le bas
**Then** le panneau se ferme

**Given** le ServiceDetailPanel est ouvert
**When** l'accessibilite est verifiee
**Then** le Drawer a `aria-label="Detail du service [nom]"`
**And** les onglets Tabs sont navigables au clavier (fleches gauche/droite)
**And** le focus est trappe dans le panneau (focus lock)
**And** le bouton fermer est premier dans l'ordre de tabulation

**Given** un seul Drawer peut etre ouvert a la fois
**When** je clique sur un autre ServiceTile alors qu'un panneau est deja ouvert
**Then** le panneau se met a jour avec les informations du nouveau service (pas de fermeture/reouverture)

---

### Story 4.6 : Arret manuel avec confirmation & cascade descendante

As a utilisateur,
I want arreter manuellement un service depuis le dashboard,
So that je peux eteindre des services que je n'utilise plus.

**Acceptance Criteria:**

**Given** un service est actif
**When** je clique sur "Arreter" dans le ServiceDetailPanel (zone Actions)
**Then** une modal de confirmation s'affiche ("Arreter [nom] et ses dependances ?")
**And** la modal liste les dependances qui seront arretees (sauf les dependances partagees encore utilisees)

**Given** la modal de confirmation est affichee
**When** je clique sur "Annuler"
**Then** la modal se ferme et rien ne se passe

**Given** la modal de confirmation est affichee
**When** je confirme l'arret
**Then** une cascade d'arret est lancee via `POST /api/cascades/stop`
**And** le badge du ServiceTile passe a "En arret" (orange)
**And** le bouton d'action est desactive (loading)

**Given** la cascade d'arret est en cours
**When** une dependance partagee est encore utilisee par un autre service actif
**Then** cette dependance est sautee (reste active)
**And** un toast warning s'affiche ("Arret de [dependance] annule — utilise par [service]")

**Given** la cascade d'arret se termine avec succes
**When** le service et ses dependances non-partagees sont eteints
**Then** les ServiceTiles concernes passent a "Eteint" (gris) avec bouton "Demarrer"
**And** un toast de succes s'affiche
**And** l'operation est enregistree dans les logs avec la raison pour chaque dependance (arretee ou protegee)

**Given** la cascade d'arret echoue sur une etape
**When** l'erreur est detectee
**Then** le ServiceTile passe en etat erreur
**And** un toast d'erreur s'affiche avec le message
**And** l'erreur est enregistree dans les logs

**Given** le bouton "Arreter" est visible
**When** l'accessibilite est verifiee
**Then** le bouton a `aria-label="Arreter [nom du service]"`
**And** la modal de confirmation est navigable au clavier (Tab entre Annuler et Confirmer, Escape pour fermer)

---

## Epic 5 : Arret Automatique sur Inactivite

Le systeme surveille l'activite des services selon des criteres configurables et les eteint automatiquement apres le delai configure, tout en protegeant les dependances partagees. Le homelab se gere tout seul — "l'intelligence invisible".

### Story 5.1 : Moteur de surveillance d'inactivite

As a administrateur,
I want que WakeHub surveille l'activite de mes services et les eteigne automatiquement apres un delai d'inactivite,
So that mon homelab ne consomme pas d'electricite inutilement.

**Acceptance Criteria:**

**Given** la table `inactivity_rules` n'existe pas encore
**When** la migration Drizzle s'execute pour cette story
**Then** la table `inactivity_rules` est creee avec les colonnes : id, resource_id (FK → resources), timeout_minutes (defaut 30), monitoring_criteria (JSON: types de criteres actifs), is_enabled (boolean, defaut true), created_at, updated_at
**And** une colonne `default_inactivity_timeout` est ajoutee a une table de settings globaux ou geree via variable d'environnement

**Given** le service `inactivity-monitor.ts` est implemente
**When** il est demarre avec le serveur
**Then** il execute une boucle de verification periodique (toutes les minutes) pour chaque service actif ayant une regle d'inactivite activee

**Given** un service actif a une regle d'inactivite configuree
**When** le moniteur verifie l'activite
**Then** il interroge les criteres configurables pour ce service :
- Connexions reseau actives (via le connecteur de la plateforme)
- Activite CPU/RAM (si disponible via l'API de la plateforme)
- Dernier acces connu (timestamp)
**And** si aucune activite n'est detectee, il incremente un compteur d'inactivite pour ce service

**Given** un service est inactif depuis plus longtemps que son delai configure
**When** le delai est depasse
**Then** le moniteur declenche automatiquement une cascade d'arret via `POST /api/cascades/stop` (en interne)
**And** un evenement SSE `auto-shutdown` est emis avec : resourceId, resourceName, inactivityMinutes
**And** l'operation est enregistree dans les logs avec la raison ("Arret automatique apres [X] minutes d'inactivite")

**Given** un service a un delai d'inactivite personnalise (FR32)
**When** le moniteur verifie ce service
**Then** il utilise le delai personnalise de la table `inactivity_rules` au lieu du delai par defaut

**Given** aucun delai personnalise n'est defini pour un service
**When** le moniteur verifie ce service
**Then** il utilise le delai par defaut (30 minutes)

**Given** de l'activite est detectee sur un service
**When** le compteur d'inactivite est en cours
**Then** le compteur est remis a zero
**And** l'arret automatique est annule

**Given** un arret automatique est declenche
**When** le service est eteint
**Then** un toast info discret s'affiche ("Arret automatique de [nom]") sur le dashboard si l'utilisateur est connecte

**Given** les routes API sont implementees
**When** `GET /api/inactivity-rules?resourceId=X` est appele
**Then** les regles d'inactivite pour cette resource sont retournees
**When** `PUT /api/inactivity-rules/:id` est appele
**Then** les regles sont mises a jour (delai, criteres, activation/desactivation)

---

### Story 5.2 : Protection des dependances partagees & configuration UI

As a administrateur,
I want que l'arret automatique respecte les dependances partagees et pouvoir configurer les regles d'inactivite,
So that mes services partages ne sont jamais eteints par erreur et je controle le comportement automatique.

**Acceptance Criteria:**

**Given** un arret automatique est declenche pour un service
**When** la cascade d'arret rencontre une dependance partagee
**Then** le moteur verifie via `dependency-graph.getDownstreamDependents()` si un autre service actif utilise cette dependance
**And** si oui, la dependance est sautee (reste active)
**And** la raison est enregistree dans les logs ("Arret de [dependance] annule — dependant actif : [service] depuis [duree]")

**Given** un arret automatique est sur le point de se declencher
**When** un dependant actif est detecte sur le service lui-meme (un autre service depend de ce service et est actif)
**Then** l'arret automatique est completement annule
**And** la raison est enregistree dans les logs ("Arret automatique de [service] annule — dependant actif : [service dependant]")
**And** un evenement SSE `auto-shutdown` est emis avec un champ `cancelled: true` et la raison

**Given** je suis sur la page de detail d'une resource (Story 2.5)
**When** la section "Regles d'inactivite" est affichee
**Then** je peux configurer :
- Activer/desactiver la surveillance d'inactivite (toggle)
- Delai d'inactivite en minutes (input numerique, defaut 30)
- Criteres de surveillance (checkboxes : connexions reseau, activite CPU/RAM, dernier acces)

**Given** je modifie les regles d'inactivite
**When** je clique sur "Enregistrer"
**Then** les regles sont sauvegardees en base (table `inactivity_rules`)
**And** le moniteur d'inactivite prend en compte les nouvelles regles au prochain cycle
**And** un toast de succes s'affiche
**And** l'operation est enregistree dans les logs

**Given** je desactive la surveillance d'inactivite pour un service
**When** le toggle est desactive et enregistre
**Then** le moniteur ignore ce service lors de ses verifications
**And** le service reste actif indefiniment

**Given** la page Settings existe (FR40)
**When** je consulte les parametres globaux
**Then** je peux configurer le delai d'inactivite par defaut (en minutes) qui s'applique a tous les services sans regle personnalisee

**Given** plusieurs arrets automatiques sont declenches simultanement
**When** les cascades s'executent
**Then** les dependances partagees sont correctement protegees meme avec des cascades paralleles
**And** aucune condition de course ne provoque un arret accidentel d'une dependance partagee

---

## Epic 6 : Journalisation & Diagnostic

L'utilisateur peut consulter l'historique complet de toutes les operations et comprendre chaque decision du systeme via une page de logs filtrable avec horodatage, type d'evenement et raison de chaque decision.

### Story 6.1 : Enrichissement du logging & persistance complete

As a developpeur,
I want que toutes les operations et decisions du systeme soient enregistrees de maniere exhaustive et structuree,
So that l'utilisateur peut comprendre chaque action et chaque decision de WakeHub.

**Acceptance Criteria:**

**Given** la table `operation_logs` a ete creee dans l'Epic 1 (Story 1.3)
**When** le schema est verifie pour cette story
**Then** la table contient au minimum : id, timestamp, level (enum: info, warn, error), source (ex: cascade-engine, inactivity-monitor, proxmox-connector), resource_id (nullable FK), resource_name, event_type (enum: start, stop, auto-shutdown, error, decision, connection-test), message, reason (nullable), error_code (nullable), error_details (nullable JSON), cascade_id (nullable)

**Given** le moteur de cascade (Story 4.1) execute une cascade
**When** chaque etape progresse ou echoue
**Then** un log est enregistre en base avec :
- source: "cascade-engine"
- event_type: "start" ou "stop"
- resource_id et resource_name de la dependance concernee
- cascade_id pour lier tous les logs d'une meme cascade
- message descriptif ("Demarrage de VM-Media via Proxmox API")

**Given** une cascade echoue
**When** l'erreur est capturee
**Then** un log est enregistre avec :
- level: "error"
- event_type: "error"
- error_code: le code de la PlatformError (ex: "VM_START_FAILED", "SSH_TIMEOUT")
- error_details: les details JSON de la PlatformError (platform, IP, message original)
- message: description lisible par l'utilisateur

**Given** le moniteur d'inactivite (Story 5.1) prend une decision
**When** un arret automatique est declenche ou annule
**Then** un log est enregistre avec :
- source: "inactivity-monitor"
- event_type: "auto-shutdown" ou "decision"
- reason: la raison complete (ex: "Arret automatique apres 30 minutes d'inactivite" ou "Arret annule — dependant actif : qBittorrent depuis 72h")

**Given** un connecteur (WoL/SSH, Proxmox, Docker) execute une operation
**When** l'operation reussit ou echoue
**Then** un log est enregistre avec :
- source: nom du connecteur (ex: "proxmox-connector")
- Le code et message de la PlatformError en cas d'echec

**Given** un test de connexion est execute (Story 2.1-2.3, 2.5)
**When** le resultat est obtenu
**Then** un log est enregistre avec event_type: "connection-test" et le resultat (succes/echec)

**Given** les logs pino stdout et les logs en base sont configures
**When** une operation est loguee
**Then** le log est emis simultanement sur stdout (JSON pino pour Docker logs) et persiste en base (table `operation_logs` via Drizzle)
**And** les deux destinations utilisent le meme format structure

**Given** la route `GET /api/logs` est implementee
**When** elle est appelee
**Then** elle retourne les logs depuis la table `operation_logs` avec pagination (limit, offset)
**And** elle supporte les parametres de filtre : resource_id, event_type, level, cascade_id, date_from, date_to, search (recherche libre dans message et reason)

---

### Story 6.2 : Page Logs & interface de diagnostic

As a utilisateur,
I want consulter l'historique des logs depuis l'interface pour comprendre les decisions du systeme,
So that je peux diagnostiquer les problemes et verifier le bon fonctionnement de mon homelab.

**Acceptance Criteria:**

**Given** je navigue vers la page Logs
**When** des logs sont enregistres en base
**Then** un tableau chronologique (Mantine Table) affiche les logs du plus recent au plus ancien
**And** les colonnes visibles sont : horodatage (format local, police mono JetBrains Mono), machine/service (nom + icone), type d'evenement (badge colore), description (message), raison de la decision

**Given** le tableau de logs est affiche
**When** j'utilise les filtres
**Then** je peux filtrer par :
- Machine/service (select deroulant)
- Stack de dependances (selectionner un service → voir tous les logs de sa chaine de dependances)
- Type d'evenement (demarrage, arret, arret auto, erreur, decision, test connexion)
- Periode (date de debut / date de fin)
**And** un champ de recherche libre est disponible (recherche dans message et raison)

**Given** les filtres sont appliques
**When** les resultats s'affichent
**Then** la liste est mise a jour en temps reel (les nouveaux logs correspondant aux filtres apparaissent)
**And** la pagination permet de charger les logs plus anciens

**Given** un log d'erreur est affiche (level: error)
**When** je le consulte
**Then** l'etape en echec est identifiable (resource_name)
**And** le code d'erreur et le message de la plateforme sont affiches (error_code, error_details)
**And** le log est visuellement mis en evidence (fond rouge subtil ou badge rouge)

**Given** un log de decision est affiche (event_type: decision)
**When** je le consulte
**Then** la colonne "raison" affiche la raison complete de la decision
**And** la raison est lisible et comprehensible (ex: "Arret de VM-Storage annule — dependant actif : qBittorrent depuis 72h")

**Given** aucun log n'est enregistre
**When** je navigue vers la page Logs
**Then** un message d'etat vide s'affiche ("Aucun evenement enregistre") avec un texte explicatif ("Les logs apparaitront des que vous commencerez a utiliser WakeHub")

**Given** je suis sur tablette ou mobile
**When** la page Logs s'affiche
**Then** les colonnes secondaires (raison) sont masquees dans le tableau
**And** un clic sur une ligne ouvre le detail complet du log (modal ou expansion de ligne)

**Given** la page est en cours de chargement
**When** les donnees ne sont pas encore disponibles
**Then** des skeleton loaders en forme de lignes de tableau s'affichent

**Given** les logs sont accessibles depuis le ServiceDetailPanel (Story 4.5)
**When** l'onglet Logs du panneau lateral est affiche
**Then** les memes donnees sont presentees, filtrees automatiquement pour le service concerne
**And** un lien "Voir tous les logs" mene a la page Logs globale avec le filtre pre-applique

---

## Epic 7 : Refactoring — Modele Unifie Services

> **Ref :** sprint-change-proposal-2026-02-11.md
> **Declencheur :** Les VMs/conteneurs decouverts sont des entites de seconde classe (resources) non editables. L'utilisateur souhaite un modele unifie ou tout est un "service" de premiere classe.
> **Impact :** Schema DB, types, backend, frontend, tests (~40 fichiers)

### Objectif

Supprimer la distinction `machines` / `resources` et unifier le modele de donnees autour d'une seule entite : **Service**. Les VMs et conteneurs decouverts depuis Proxmox/Docker deviennent des services a part entiere, avec une relation parent-enfant vers le service hote.

### Decisions cles

1. Table `machines` renommee → `services`, table `resources` supprimee
2. `ServiceType` : `physical | proxmox | docker | vm | container`
3. `parent_id` (FK nullable → services) pour la relation structurelle parent → enfant
4. `is_structural` ajoute a `dependency_links` — liens auto-crees non-supprimables
5. `DependencyNodeType` simplifie a `'service'` uniquement

### Story 7.1 : Schema DB + Migration + Types Shared

**Objectif :** Migrer le schema de donnees et les types partages vers le modele unifie.

**Acceptance Criteria :**

**Given** la migration Drizzle est executee
**When** je consulte la base de donnees
**Then** la table `services` existe avec toutes les colonnes (y compris `platform_ref`, `inactivity_timeout`, `parent_id`)
**And** la table `resources` n'existe plus
**And** toutes les anciennes resources ont ete migrees dans `services` avec le bon `parent_id`
**And** un `dependency_link` structurel (`is_structural=true`) existe pour chaque relation parent→enfant
**And** tous les `parent_type`/`child_type` dans `dependency_links` valent `'service'`

**Given** les types shared sont mis a jour
**When** j'importe depuis `@wakehub/shared`
**Then** le type `Service` remplace `Machine` et `Resource`
**And** `ServiceType` inclut `'physical' | 'proxmox' | 'docker' | 'vm' | 'container'`
**And** `DependencyNodeType` est `'service'` uniquement
**And** `DependencyLink` inclut `isStructural: boolean`

### Story 7.2 : Backend Routes + Connectors

**Objectif :** Adapter toutes les routes et connecteurs au modele unifie.

**Acceptance Criteria :**

**Given** les routes backend sont mises a jour
**When** j'appelle `GET /api/services`
**Then** toutes les entites (physique, Proxmox, Docker, VM, conteneur) sont retournees
**And** les anciennes routes `/api/machines` et `/api/resources` n'existent plus

**Given** je cree un service Proxmox avec decouverte
**When** les VMs sont selectionnees
**Then** chaque VM est creee comme un service (type=vm) avec `parent_id` pointant vers le service Proxmox
**And** un `dependency_link` structurel est cree automatiquement

**Given** j'essaie de supprimer un dependency_link structurel
**When** j'appelle `DELETE /api/dependencies/:id`
**Then** je recois une erreur 400 avec code `STRUCTURAL_LINK`

**Given** les cascades fonctionnent
**When** je demarre une cascade pour un service
**Then** le moteur de cascade utilise le nouveau modele unifie

### Story 7.3 : Frontend — API Hooks + Components

**Objectif :** Adapter l'ensemble du frontend au modele unifie.

**Acceptance Criteria :**

**Given** la navigation est mise a jour
**When** je consulte le menu
**Then** le lien affiche "Services" au lieu de "Machines"

**Given** le dashboard affiche les services
**When** je consulte le dashboard
**Then** tous les services epingles (physique, VM, conteneur) s'affichent dans la meme grille
**And** le ServiceTile n'a plus de discriminant resource/machine

**Given** le wizard de creation fonctionne
**When** j'ajoute un serveur Proxmox et je selectionne des VMs
**Then** les VMs apparaissent comme des services dans la page Services
**And** elles ont un lien de dependance vers le serveur Proxmox

**Given** la page Services fonctionne
**When** je clique sur un service (VM, conteneur, physique)
**Then** la page detail affiche les memes champs editables pour tous les types

### Story 7.4 : Tests + Build + Nettoyage

**Objectif :** Verification finale et nettoyage.

**Acceptance Criteria :**

**Given** le build est verifie
**When** je lance `tsc --noEmit` sur le frontend et le backend
**Then** aucune erreur

**Given** les tests sont a jour
**When** je lance tous les tests
**Then** tous les tests backend passent
**And** tous les tests frontend passent

**Given** le build Docker fonctionne
**When** je lance `docker compose build`
**Then** le build reussit sans erreur

**Given** les fichiers obsoletes sont supprimes
**When** je verifie le codebase
**Then** `resources.routes.ts`, `resources.routes.test.ts`, `resources.api.ts` n'existent plus

### Story 7.5 : Comportement Uniforme pour Tous les Services

**Objectif :** Supprimer les distinctions parent/enfant residuelles dans le frontend et le connector factory pour que tous les types de services aient le meme comportement (edition, demarrage/arret, dashboard).

**Ref :** sprint-change-proposal-2026-02-11-uniform-services.md

**Acceptance Criteria :**

**Given** un service de n'importe quel type (physical, proxmox, docker, vm, container)
**When** j'ouvre sa page de detail
**Then** je vois les memes champs editables (nom, IP, MAC, SSH, URL service)
**And** je peux modifier et sauvegarder ces champs

**Given** un service de n'importe quel type est epingle au dashboard
**When** il est eteint
**Then** je vois le bouton "Demarrer" et je peux lancer une cascade

**Given** un serveur Proxmox ou Docker host avec MAC + IP + SSH configures
**When** une cascade de demarrage le cible
**Then** il est demarre via WoL+SSH (meme logique que physical)

**Given** un service de n'importe quel type sur le dashboard
**When** je clique dessus
**Then** le panneau de detail s'ouvre avec les dependances et l'activite
