---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-02-09'
inputDocuments:
  - product-brief-wakehub2-2026-02-08.md
  - prd.md
  - prd-validation-report.md
  - ux-design-specification.md
workflowType: 'architecture'
project_name: 'wakehub2'
user_name: 'Drunkrain'
date: '2026-02-09'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
47 FRs organises en 8 domaines de capacite. Le coeur fonctionnel repose sur 3 mecanismes interconnectes : (1) orchestration multi-plateforme via connecteurs WoL/SSH, Proxmox API et Docker API, (2) gestion d'un graphe de dependances avec cascades ascendantes/descendantes et protection des dependances partagees, (3) surveillance d'inactivite avec arret automatique intelligent.

**Non-Functional Requirements:**
- Performance : dashboard <15s, cascade complete <2min, mises a jour temps reel <3s, timeout API 30s
- Securite : credentials chiffrees au repos, mots de passe haches (bcrypt/argon2), communications HTTPS
- Fiabilite : service 24/7, redemarrage automatique apres defaillance, recovery apres coupure de courant
- Integration : interface connecteur commune, gestion d'erreurs API avec type/code/description, compatibilite API Proxmox et Docker versions majeures actuelles
- Accessibilite : WCAG AA, navigation clavier, ARIA, couleur non-seule

**Scale & Complexity:**
- Domaine primaire : full-stack web app (SPA React + API backend + base de donnees)
- Niveau de complexite : moyen
- Contexte : greenfield, mono-utilisateur, mono-instance, reseau local
- Composants architecturaux estimes : ~8-10 (frontend SPA, API backend, base de donnees, gestionnaire de cascade, 3 connecteurs plateforme, moteur d'inactivite, service temps reel)

### Technical Constraints & Dependencies

- **Deploiement Docker unique** : frontend + backend dans un seul conteneur, deploye via `docker compose up`
- **Reseau local uniquement** : pas de cloud, pas d'acces Internet requis pour le fonctionnement
- **Developpeur solo + IA** : l'architecture doit rester simple et maintenable
- **Service permanent 24/7** : WakeHub est le seul composant toujours allume du homelab
- **API externes** : dependance aux API Proxmox, Docker et aux protocoles WoL/SSH — evolution des API hors controle
- **Frontend impose** : React + Mantine v7+ (decision UX validee)
- **Temps reel** : WebSocket ou SSE requis pour les mises a jour de statut sans rechargement

### Cross-Cutting Concerns Identified

- **Gestion d'erreurs unifiee** : les 3 connecteurs (WoL/SSH, Proxmox, Docker) doivent remonter des erreurs dans un format normalise (type, code, description, plateforme)
- **Logging transversal** : chaque operation et chaque decision du systeme (demarrage, arret, arret annule car dependance partagee) doit etre tracee avec horodatage et raison
- **Pattern connecteur** : interface commune pour les plateformes, facilitant l'ajout futur de connecteurs (TrueNAS, VMware, LXC)
- **Communication temps reel** : le frontend doit recevoir les mises a jour de statut de toutes les ressources en temps reel — concerne le dashboard, la cascade, et les logs
- **Securite des credentials** : les identifiants API et cles SSH stockes en base doivent etre chiffres au repos — concerne tous les connecteurs et la configuration

## Starter Template Evaluation

### Primary Technology Domain

Full-stack TypeScript (SPA React + API Node.js) — monorepo avec types partages entre frontend et backend.

### Starter Options Considered

**Framework backend :**

| Framework | Evaluation | Verdict |
|---|---|---|
| Express | Le plus populaire, ecosysteme enorme, mais patterns anciens et TypeScript ajoute apres coup | Ecarte — trop legacy pour un projet greenfield TypeScript |
| Fastify | TypeScript natif, validation JSON Schema, architecture plugin, bien maintenu, bonne communaute | **Selectionne** |
| Hono | Ultra-leger, moderne, mais oriente edge/serverless, moins de ressources communautaires | Ecarte — trop niche pour ce contexte |

**ORM :**

| ORM | Evaluation | Verdict |
|---|---|---|
| Prisma | DX excellente, populaire, mais schema externe + generation, performances faibles avec SQLite | Ecarte — overhead pour SQLite |
| Drizzle ORM | Code-first TypeScript, 0 dependance, ~7.4kb, 100x+ plus rapide que Prisma sur SQLite, excellent support SQLite | **Selectionne** |

**Structure projet :**

| Approche | Evaluation | Verdict |
|---|---|---|
| Turborepo monorepo | Caching et orchestration, mais overhead de config pour un dev solo | Ecarte — surdimensionne |
| npm workspaces monorepo | Types partages front/back, simple, zero overhead | **Selectionne** |
| Deux projets separes | Le plus simple, mais pas de partage de types | Ecarte — insuffisant |

### Selected Starter: Assemblage de briques officielles en monorepo npm workspaces

**Rationale for Selection:**
Aucun starter "clef en main" ne combine React+Mantine+Fastify+Drizzle+SQLite. L'assemblage des briques officielles dans un monorepo npm workspaces offre le meilleur equilibre entre simplicite, maintenabilite et partage de types pour un developpeur solo.

**Initialization Command:**

```bash
# Frontend
npm create vite@latest apps/web -- --template react-ts

# Backend
mkdir -p apps/server && cd apps/server && npm init -y
# + installation Fastify, Drizzle, better-sqlite3

# Workspaces root
# package.json avec "workspaces": ["apps/*", "packages/*"]
```

**Project Structure:**

```
wakehub2/
├── apps/
│   ├── web/          ← Vite + React + TypeScript + Mantine v7
│   └── server/       ← Fastify + TypeScript + Drizzle ORM + better-sqlite3
├── packages/
│   └── shared/       ← Types TypeScript partages (modeles, API contracts)
├── package.json      ← npm workspaces root
├── tsconfig.base.json
└── docker/
    └── Dockerfile    ← Build multi-stage (frontend build + backend)
```

### Architectural Decisions Provided by Starter

**Language & Runtime:**
TypeScript strict partout (frontend + backend + shared), Node.js LTS

**Frontend Stack:**
Vite (build + HMR), React 19, Mantine v7+, React Router

**Backend Stack:**
Fastify (HTTP, validation JSON Schema, architecture plugin)

**ORM & Database:**
Drizzle ORM code-first avec migrations SQL, SQLite via better-sqlite3 (synchrone, performant)

**Testing Framework:**
Vitest (frontend + backend, compatible Vite nativement)

**Code Quality:**
ESLint + eslint-plugin-jsx-a11y (accessibilite)

**Build & Deployment:**
Docker multi-stage — Vite build produit des fichiers statiques servis par le serveur Fastify

**Note:** L'initialisation du projet avec cette structure sera la premiere story d'implementation.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Authentification : sessions cookie
- Hashage mots de passe : argon2
- Chiffrement credentials : AES-256-GCM (module crypto natif Node.js)
- Communication temps reel : SSE (Server-Sent Events)
- State management frontend : TanStack Query + Zustand

**Important Decisions (Shape Architecture):**
- API REST avec validation JSON Schema Fastify
- Documentation API : Swagger/OpenAPI auto-genere via @fastify/swagger
- Logging : pino (natif Fastify) + persistance en base via Drizzle
- Configuration : variables d'environnement via .env + dotenv

**Deferred Decisions (Post-MVP):**
- Rate limiting : pas necessaire en mono-utilisateur reseau local
- CI/CD : GitHub Actions basique quand le repo sera public
- Scaling : mono-instance, pas de strategie de scaling
- Monitoring externe : les logs internes suffisent pour le MVP

### Authentication & Security

**Session Management : Sessions cookie**
- Le serveur stocke la session en base SQLite via Drizzle
- Le navigateur recoit un cookie HTTP-only, Secure (si HTTPS), SameSite=Strict
- Revocation immediate en supprimant la session en base
- Rationale : WakeHub est mono-instance, reseau local, un seul utilisateur. Les sessions sont plus simples et plus securisees que JWT pour ce contexte
- Affects : API backend, middleware d'authentification, frontend (pas de gestion de token)

**Password Hashing : argon2**
- Algorithme argon2id (recommande OWASP)
- Librairie : `argon2` pour Node.js
- Rationale : plus moderne et plus resistant que bcrypt, recommande par OWASP depuis 2023
- Affects : creation de compte (FR1), login (FR2), reset mot de passe (FR4)

**Credential Encryption at Rest : AES-256-GCM**
- Chiffrement des identifiants API (Proxmox, Docker) et cles SSH en base SQLite
- Module `crypto` natif de Node.js — zero dependance externe
- Cle de chiffrement stockee en variable d'environnement (ENCRYPTION_KEY)
- Chaque credential chiffre individuellement avec IV unique
- Rationale : AES-256-GCM est le standard, le module crypto est natif et audite
- Affects : tous les connecteurs (WoL/SSH, Proxmox, Docker), configuration des machines (FR5-7, FR41-42)

**HTTPS : Delegue au reverse proxy**
- WakeHub ne gere pas HTTPS nativement — c'est un service reseau local
- Documentation fournie pour configurer un reverse proxy (Caddy, Traefik, nginx) si necessaire
- Rationale : simplifier le deploiement, ne pas gerer les certificats dans l'application
- Affects : documentation de deploiement

### API & Communication Patterns

**API Design : REST avec validation JSON Schema Fastify**
- Routes RESTful organisees en plugins Fastify par domaine (auth, machines, services, cascades, logs)
- Validation des requetes et reponses via JSON Schema (natif Fastify)
- Format d'erreur normalise : `{ error: string, code: string, details?: object }`
- Affects : toutes les routes API, frontend API client

**Real-Time Communication : SSE (Server-Sent Events)**
- Flux unidirectionnel serveur → client pour les mises a jour de statut
- Endpoint SSE unique : `GET /api/events` avec filtrage par type d'evenement
- Reconnexion automatique cote client (natif EventSource API)
- Types d'evenements : status-change, cascade-progress, cascade-complete, cascade-error, auto-shutdown
- Rationale : WakeHub pousse des statuts du serveur vers le client, le client envoie des commandes via REST. Pas besoin de bidirectionnel. SSE est plus simple, natif HTTP, sans lib externe
- Affects : dashboard temps reel (FR35-37), progression de cascade (FR27), arret automatique (FR30)

**API Documentation : Swagger/OpenAPI auto-genere**
- Plugin `@fastify/swagger` + `@fastify/swagger-ui`
- Documentation generee automatiquement depuis les schemas JSON de validation Fastify
- Accessible en dev a `/docs`
- Rationale : zero effort supplementaire, documentation toujours a jour
- Affects : DX, documentation contributeur

### Frontend Architecture

**Server State : TanStack Query (React Query)**
- Gestion du state serveur : donnees API, cache automatique, invalidation, refetch
- Les evenements SSE invalident le cache TanStack Query — quand le serveur envoie un changement de statut, les queries concernees sont automatiquement invalidees et refetchees
- Rationale : standard pour les SPAs React modernes, gestion du cache et des etats de loading/error integree
- Affects : toutes les pages (dashboard, machines, logs, settings)

**Client State : Zustand**
- Gestion du state client local : UI state (panneau lateral ouvert, onglet actif), preferences utilisateur
- Leger (~1kb), API simple, pas de boilerplate
- Rationale : le state client de WakeHub est minimal (pas de formulaire complexe, pas de state global lourd). Zustand suffit largement sans la complexite de Redux
- Affects : ServiceDetailPanel (ouverture/fermeture), navigation, preferences UI

**SSE Integration Pattern:**
- Un hook React `useSSE()` etablit la connexion SSE au montage de l'app
- Les evenements SSE declenchent `queryClient.invalidateQueries()` sur les cles de cache concernees
- Le frontend ne poll jamais — toutes les mises a jour viennent du serveur via SSE

### Infrastructure & Deployment

**Logging : pino (natif Fastify)**
- Logger JSON structure, performant, inclus par defaut dans Fastify
- Double destination : stdout (logs Docker) + persistance en base SQLite via Drizzle
- Les logs en base sont consultables dans l'UI (page Logs, panneau lateral)
- Chaque log inclut : horodatage, niveau, source (connecteur/service), message, raison de la decision
- Rationale : pino est le logger par defaut de Fastify, JSON structure parsable, zero config
- Affects : FR44-47, page Logs, panneau lateral ServiceDetailPanel

**Environment Configuration : .env + dotenv**
- Variables d'environnement minimales : PORT, ENCRYPTION_KEY, DATABASE_PATH, SESSION_SECRET, NODE_ENV
- Fichier `.env.example` fourni dans le repo
- Rationale : standard Node.js, simple, compatible Docker (env_file dans docker-compose.yml)
- Affects : deploiement, configuration initiale

**Docker Deployment : Multi-stage build**
- Stage 1 : Build frontend (Vite → fichiers statiques)
- Stage 2 : Build backend (TypeScript → JavaScript)
- Stage 3 : Image de production (Node.js Alpine + fichiers statiques + backend compile + SQLite)
- Le serveur Fastify sert les fichiers statiques du frontend + expose l'API REST + endpoint SSE
- Volume Docker pour la base SQLite (persistance des donnees)
- Restart policy : `unless-stopped`
- Affects : deploiement, docker-compose.yml

### Decision Impact Analysis

**Implementation Sequence:**
1. Initialisation monorepo npm workspaces + configuration TypeScript
2. Schema base de donnees Drizzle (machines, dependances, services, sessions, logs)
3. Backend Fastify : auth (sessions + argon2) + routes CRUD machines/services
4. Backend Fastify : connecteurs plateforme (WoL/SSH, Proxmox, Docker)
5. Backend Fastify : moteur de cascade + endpoint SSE
6. Frontend React : layout Mantine + dashboard + TanStack Query + SSE
7. Backend Fastify : moteur d'inactivite + arret automatique
8. Integration Docker multi-stage + docker-compose

**Cross-Component Dependencies:**
- Les connecteurs plateforme dependent du schema Drizzle (credentials chiffrees) et du format d'erreur normalise
- Le moteur de cascade depend des connecteurs et du graphe de dependances en base
- Le frontend SSE depend de l'endpoint SSE backend et invalide le cache TanStack Query
- L'authentification (sessions) est un middleware Fastify qui protege toutes les routes sauf login/register
- Le logging pino ecrit en base via Drizzle — partage la meme connexion SQLite

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database (Drizzle/SQLite) :**
- Tables : `snake_case`, pluriel — `machines`, `services`, `dependency_links`, `cascade_logs`
- Colonnes : `snake_case` — `machine_id`, `created_at`, `is_active`
- Foreign keys : `{table_singulier}_id` — `machine_id`, `service_id`
- Index : `idx_{table}_{colonne}` — `idx_machines_name`

**API REST :**
- Endpoints : pluriel, kebab-case — `/api/machines`, `/api/services`, `/api/cascade-logs`
- Parametres de route : `:id` — `/api/machines/:id`
- Query params : camelCase — `?machineType=proxmox&isActive=true`
- Corps JSON : camelCase — `{ machineName, ipAddress, macAddress }`

**Code TypeScript :**
- Fichiers : kebab-case — `service-tile.tsx`, `cascade-engine.ts`, `proxmox-connector.ts`
- Composants React : PascalCase — `ServiceTile`, `CascadeProgress`, `StatsBar`
- Fonctions/variables : camelCase — `startCascade()`, `getMachineStatus()`, `isActive`
- Types/Interfaces : PascalCase — `Machine`, `Service`, `CascadeEvent`
- Constantes : SCREAMING_SNAKE — `DEFAULT_INACTIVITY_TIMEOUT`, `MAX_CASCADE_RETRIES`
- Dossiers : kebab-case — `platform-connectors/`, `cascade-engine/`

### Structure Patterns

**Tests : co-localises**
- Chaque fichier `foo.ts` a son test `foo.test.ts` a cote — pas de dossier `__tests__` separe
- Convention Vitest, plus facile a trouver et maintenir

**Organisation backend : par domaine fonctionnel**

```
apps/server/src/
├── routes/              ← Plugins Fastify par domaine
│   ├── auth.ts
│   ├── machines.ts
│   ├── services.ts
│   ├── cascades.ts
│   └── logs.ts
├── services/            ← Logique metier
│   ├── cascade-engine.ts
│   ├── inactivity-monitor.ts
│   └── dependency-graph.ts
├── connectors/          ← Interface commune + implementations
│   ├── connector.interface.ts
│   ├── wol-ssh.connector.ts
│   ├── proxmox.connector.ts
│   └── docker.connector.ts
├── db/                  ← Schema Drizzle + migrations
│   ├── schema.ts
│   ├── migrations/
│   └── index.ts
├── middleware/           ← Auth, error handling
├── sse/                 ← Gestion SSE
└── app.ts               ← Point d'entree Fastify
```

**Organisation frontend : par feature**

```
apps/web/src/
├── features/
│   ├── dashboard/       ← ServiceTile, StatsBar, ServiceDetailPanel
│   ├── machines/        ← MachineList, MachineDetail
│   ├── auth/            ← Login, Register
│   ├── logs/            ← LogTable, LogFilters
│   └── settings/        ← SettingsForm
├── components/          ← Composants partages (Layout, Navigation)
├── hooks/               ← useSSE, useAuth, custom hooks
├── api/                 ← Fonctions d'appel API (TanStack Query)
├── stores/              ← Zustand stores
├── theme/               ← Configuration theme Mantine
└── App.tsx
```

### Format Patterns

**Reponse API succes :**

```json
{ "data": { ... } }
```

**Reponse API erreur :**

```json
{
  "error": {
    "code": "MACHINE_UNREACHABLE",
    "message": "Impossible de joindre la machine",
    "details": { "ip": "192.168.1.10", "platform": "proxmox" }
  }
}
```

**Dates :** ISO 8601 partout dans l'API — `"2026-02-09T14:30:00Z"`. Formatage local uniquement cote frontend.

**Evenements SSE :**

```
event: status-change
data: {"resourceId":"abc123","resourceType":"service","status":"active","timestamp":"2026-02-09T14:30:00Z"}

event: cascade-progress
data: {"cascadeId":"xyz789","serviceId":"abc123","step":2,"totalSteps":4,"currentDependency":{"id":"def456","name":"VM-Media","status":"starting"}}

event: cascade-complete
data: {"cascadeId":"xyz789","serviceId":"abc123","success":true}

event: cascade-error
data: {"cascadeId":"xyz789","serviceId":"abc123","failedStep":2,"error":{"code":"VM_START_FAILED","message":"..."}}
```

### Process Patterns

**Gestion d'erreurs backend :**
- Chaque connecteur lance des erreurs typees heritant d'une classe `PlatformError` avec `code`, `message`, `platform`, `details`
- Le middleware Fastify error handler les attrape et les transforme en reponse API normalisee
- Jamais d'erreur non catchee — tout est logue via pino + enregistre en base

**Gestion d'erreurs frontend :**
- TanStack Query gere les etats error de chaque requete
- `onError` global affiche un toast Mantine Notification
- Les erreurs de cascade sont affichees sur le ServiceTile (message simple) + toast

**Loading states :**
- TanStack Query fournit `isLoading`, `isFetching` nativement
- Skeleton loaders pour le chargement initial de page (Mantine Skeleton)
- Bouton en etat `loading` pendant les actions (Mantine Button loading prop)
- Pas de spinner generique plein ecran

**Validation :**
- Backend : JSON Schema Fastify sur toutes les routes (validation automatique)
- Frontend : validation HTML5 + validation custom sur les formulaires (Mantine useForm)
- Shared : types TypeScript dans `packages/shared` pour les contrats API

### Enforcement Guidelines

**Tous les agents IA DOIVENT :**
- Respecter les conventions de nommage definies ci-dessus sans exception
- Placer les tests co-localises a cote du fichier source
- Utiliser le format de reponse API normalise (data/error wrapper)
- Utiliser les types partages de `packages/shared` pour les contrats API
- Ecrire les erreurs via `PlatformError` dans les connecteurs
- Ne jamais hardcoder de valeurs de configuration — utiliser les variables d'environnement

**Anti-patterns a eviter :**
- Creer un dossier `__tests__` separe
- Utiliser `snake_case` dans le JSON API (c'est `camelCase`)
- Utiliser `camelCase` dans la base de donnees (c'est `snake_case`)
- Retourner des reponses API sans le wrapper `{ data }` ou `{ error }`
- Creer des fichiers composant en PascalCase (c'est `kebab-case` pour les fichiers)
- Utiliser `any` dans TypeScript — typage strict obligatoire

## Project Structure & Boundaries

### Complete Project Directory Structure

```
wakehub2/
├── package.json                    ← npm workspaces root
├── tsconfig.base.json              ← Config TS partagee
├── .gitignore
├── .env.example                    ← Variables d'environnement template
├── docker-compose.yml              ← Deploiement production
├── README.md
│
├── apps/
│   ├── web/                        ← FRONTEND (Vite + React + Mantine)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       ├── vite-env.d.ts
│   │       ├── theme/
│   │       │   └── theme.ts                ← Config theme Mantine (couleurs, typo)
│   │       ├── api/
│   │       │   ├── client.ts               ← Instance fetch configuree
│   │       │   ├── machines.api.ts         ← Queries TanStack machines
│   │       │   ├── services.api.ts         ← Queries TanStack services
│   │       │   ├── cascades.api.ts         ← Mutations TanStack cascades
│   │       │   ├── auth.api.ts             ← Queries/mutations auth
│   │       │   └── logs.api.ts             ← Queries TanStack logs
│   │       ├── hooks/
│   │       │   ├── use-sse.ts              ← Hook connexion SSE + invalidation cache
│   │       │   └── use-auth.ts             ← Hook authentification
│   │       ├── stores/
│   │       │   └── ui.store.ts             ← Zustand : panneau ouvert, preferences
│   │       ├── components/
│   │       │   ├── layout/
│   │       │   │   ├── app-shell.tsx        ← AppShell Mantine (header + contenu)
│   │       │   │   └── navigation.tsx       ← NavLinks (Dashboard, Machines, etc.)
│   │       │   └── shared/
│   │       │       └── status-badge.tsx     ← Badge de statut reutilisable
│   │       ├── features/
│   │       │   ├── auth/
│   │       │   │   ├── login-form.tsx
│   │       │   │   └── register-form.tsx
│   │       │   ├── dashboard/
│   │       │   │   ├── dashboard-page.tsx
│   │       │   │   ├── service-tile.tsx
│   │       │   │   ├── service-tile.test.ts
│   │       │   │   ├── cascade-progress.tsx
│   │       │   │   ├── service-detail-panel.tsx
│   │       │   │   └── stats-bar.tsx
│   │       │   ├── machines/
│   │       │   │   ├── machines-page.tsx
│   │       │   │   ├── machine-detail-page.tsx
│   │       │   │   └── machine-wizard.tsx
│   │       │   ├── logs/
│   │       │   │   └── logs-page.tsx
│   │       │   └── settings/
│   │       │       └── settings-page.tsx
│   │       └── router.tsx                   ← React Router config
│   │
│   └── server/                     ← BACKEND (Fastify + Drizzle)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── app.ts                       ← Point d'entree Fastify + plugins
│           ├── config.ts                    ← Chargement .env + validation
│           ├── routes/
│           │   ├── auth.routes.ts           ← POST /login, /register, /logout
│           │   ├── machines.routes.ts       ← CRUD /api/machines
│           │   ├── services.routes.ts       ← CRUD /api/services
│           │   ├── cascades.routes.ts       ← POST /api/cascades/start, /stop
│           │   ├── dependencies.routes.ts   ← CRUD /api/dependencies
│           │   ├── logs.routes.ts           ← GET /api/logs
│           │   └── events.routes.ts         ← GET /api/events (SSE)
│           ├── services/
│           │   ├── cascade-engine.ts        ← Orchestration cascade up/down
│           │   ├── cascade-engine.test.ts
│           │   ├── dependency-graph.ts      ← Calcul DAG, resolution chaines
│           │   ├── dependency-graph.test.ts
│           │   ├── inactivity-monitor.ts    ← Surveillance + arret auto
│           │   └── inactivity-monitor.test.ts
│           ├── connectors/
│           │   ├── connector.interface.ts   ← Interface commune PlatformConnector
│           │   ├── wol-ssh.connector.ts     ← WoL + SSH
│           │   ├── wol-ssh.connector.test.ts
│           │   ├── proxmox.connector.ts     ← API Proxmox
│           │   ├── proxmox.connector.test.ts
│           │   ├── docker.connector.ts      ← API Docker
│           │   └── docker.connector.test.ts
│           ├── db/
│           │   ├── index.ts                 ← Connexion Drizzle + instance DB
│           │   ├── schema.ts               ← Tous les schemas de tables
│           │   └── migrations/              ← Fichiers de migration SQL
│           ├── middleware/
│           │   ├── auth.middleware.ts        ← Verification session cookie
│           │   └── error-handler.middleware.ts ← PlatformError → reponse API
│           ├── sse/
│           │   ├── sse-manager.ts           ← Gestion connexions SSE + broadcast
│           │   └── sse-manager.test.ts
│           ├── utils/
│           │   ├── crypto.ts               ← AES-256-GCM encrypt/decrypt
│           │   └── platform-error.ts       ← Classe PlatformError
│           └── logger.ts                    ← Config pino + transport base
│
├── packages/
│   └── shared/                     ← TYPES PARTAGES
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── models/
│           │   ├── machine.ts              ← Types Machine, MachineType
│           │   ├── service.ts              ← Types Service, ServiceStatus
│           │   ├── cascade.ts              ← Types CascadeEvent, CascadeStatus
│           │   ├── dependency.ts           ← Types DependencyLink
│           │   └── log.ts                  ← Types LogEntry, LogLevel
│           └── api/
│               ├── requests.ts             ← Types des requetes API
│               ├── responses.ts            ← Types des reponses API (ApiResponse<T>, ApiError)
│               └── events.ts               ← Types des evenements SSE
│
└── docker/
    └── Dockerfile                  ← Multi-stage build
```

### Architectural Boundaries

**API Boundaries :**
- Toutes les routes API derriere le prefixe `/api/` — protegees par le middleware auth (sauf `/login`, `/register`)
- Le endpoint SSE `/api/events` est une route GET long-lived, protegee par session
- Le frontend accede au backend uniquement via `/api/*` — jamais d'acces direct a la DB ou aux connecteurs
- Les fichiers statiques du frontend sont servis par Fastify a la racine `/`

**Component Boundaries :**
- Chaque connecteur (`wol-ssh`, `proxmox`, `docker`) implemente l'interface `PlatformConnector` et ne connait que sa propre plateforme
- Le `cascade-engine` orchestre les connecteurs via l'interface commune — il ne connait pas les details d'implementation de chaque plateforme
- Le `dependency-graph` est un service pur (logique de graphe) sans dependance aux connecteurs
- Le `sse-manager` recoit des evenements des services backend et les broadcast aux clients — il ne produit pas d'evenements lui-meme

**Data Boundaries :**
- Seul le dossier `db/` accede directement a SQLite via Drizzle
- Les routes appellent les services, les services appellent la DB — jamais d'acces DB direct depuis une route
- Les credentials sont chiffrees/dechiffrees uniquement dans `utils/crypto.ts` — les connecteurs recoivent les credentials deja dechiffrees

### Requirements to Structure Mapping

| FRs | Domaine | Backend | Frontend |
|---|---|---|---|
| FR1-4 | Auth | `routes/auth.routes.ts`, `middleware/auth.middleware.ts` | `features/auth/` |
| FR5-12 | Infrastructure | `routes/machines.routes.ts`, `connectors/*` | `features/machines/` |
| FR13-17 | Dependances | `routes/dependencies.routes.ts`, `services/dependency-graph.ts` | `features/machines/` (config) |
| FR18-28 | Alimentation | `routes/cascades.routes.ts`, `services/cascade-engine.ts` | `features/dashboard/` |
| FR29-34 | Inactivite | `services/inactivity-monitor.ts` | — (invisible) |
| FR35-39 | Dashboard | `routes/events.routes.ts`, `sse/sse-manager.ts` | `features/dashboard/*` |
| FR40-43 | Config | `routes/machines.routes.ts` (CRUD) | `features/settings/` |
| FR44-47 | Logs | `routes/logs.routes.ts`, `logger.ts` | `features/logs/` |

### Data Flow

```
[Navigateur] ← fichiers statiques (Vite build)
     │
     ├── REST API ──→ [Fastify Routes] → [Services] → [Drizzle/SQLite]
     │                                        │
     │                                        ├── [Connectors] → WoL/SSH
     │                                        ├── [Connectors] → Proxmox API
     │                                        └── [Connectors] → Docker API
     │
     └── SSE ←──── [SSE Manager] ← evenements des Services
```

### Development Workflow

- `npm run dev` a la racine : demarre Vite (frontend HMR) + Fastify (backend avec tsx watch)
- `npm run build` : build frontend Vite + compile backend TypeScript
- `npm run test` : Vitest sur tous les workspaces
- `docker compose up` : build multi-stage + deploiement production

## Architecture Validation Results

### Coherence Validation

**Compatibilite des decisions :** Toutes les technologies fonctionnent ensemble sans conflit.
- React 19 + Vite + Mantine v7+ : stack frontend standard, compatible
- Fastify + Drizzle + better-sqlite3 : integration native
- TanStack Query + Zustand : pas de chevauchement (server state vs client state)
- SSE + TanStack Query : pattern naturel d'invalidation de cache
- argon2 + AES-256-GCM + crypto natif Node.js : pas de dependance externe conflictuelle
- pino : logger natif Fastify, zero config

**Consistance des patterns :** Pas de contradiction detectee. Regles de nommage claires et sans ambiguite entre les couches (DB snake_case, API camelCase, fichiers kebab-case).

**Alignement structure :** L'arbre de fichiers supporte toutes les decisions et patterns definis.

### Requirements Coverage Validation

**Couverture fonctionnelle : 47/47 FRs couverts**

| FRs | Couverture architecturale | Statut |
|---|---|---|
| FR1-4 (Auth) | Sessions cookie + argon2 + auth middleware | OK |
| FR5-12 (Infrastructure) | Routes machines + 3 connecteurs | OK |
| FR13-17 (Dependances) | Service dependency-graph (DAG) | OK |
| FR18-28 (Alimentation) | Cascade-engine + connecteurs + SSE | OK |
| FR29-34 (Inactivite) | Service inactivity-monitor | OK |
| FR35-39 (Dashboard) | SSE + TanStack Query + composants UX | OK |
| FR40-43 (Config) | Routes CRUD + settings page | OK |
| FR44-47 (Logs) | pino + persistance Drizzle + logs page | OK |

**Note FR39 (redirection automatique) :** Le PRD mentionne une redirection automatique, mais le UX spec a explicitement decide contre — l'utilisateur clique sur "Ouvrir" quand il le souhaite. L'architecture suit la decision UX.

**Couverture non-fonctionnelle : 10/10 NFRs couverts**

| NFR | Solution architecturale | Statut |
|---|---|---|
| Dashboard <15s | Vite build optimise, SSE (pas de polling) | OK |
| Cascade <2min | Connecteurs asynchrones, timeout configurable | OK |
| Temps reel <3s | SSE + invalidation TanStack Query | OK |
| Credentials chiffrees | AES-256-GCM, crypto natif | OK |
| Mots de passe haches | argon2 | OK |
| HTTPS | Delegue reverse proxy, documente | OK |
| Service 24/7 | Docker restart unless-stopped | OK |
| Recovery coupure | Documentation chaine de recovery | OK |
| Interface connecteur commune | PlatformConnector interface | OK |
| WCAG AA | Mantine + jsx-a11y + patterns UX | OK |

### Implementation Readiness Validation

**Decision Completeness :** Toutes les decisions critiques documentees avec versions et rationale.
**Structure Completeness :** Arbre de fichiers specifique avec mapping FR → fichiers.
**Pattern Completeness :** Nommage, structure, format API, SSE, erreurs, loading states couverts.

### Gap Analysis

**Gaps critiques : 0**

**Gaps importants (non-bloquants) :**
1. Schema DB non detaille (tables/colonnes) — voulu, c'est le niveau story/implementation
2. Mecanisme de reset mot de passe (FR4) — decision differee a l'implementation

**Gaps mineurs :**
- Pas de schema detaille des endpoints API — couvert au niveau domaine, details dans les stories

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Contexte projet analyse (47 FRs, 8 domaines, NFRs)
- [x] Complexite evaluee (moyenne, greenfield, mono-instance)
- [x] Contraintes techniques identifiees (Docker, reseau local, dev solo)
- [x] Preoccupations transversales mappees (erreurs, logging, SSE, securite)

**Architectural Decisions**
- [x] Stack technologique complet (React/Vite/Mantine + Fastify/Drizzle/SQLite)
- [x] Auth : sessions cookie + argon2
- [x] Temps reel : SSE
- [x] State management : TanStack Query + Zustand
- [x] Chiffrement : AES-256-GCM
- [x] Logging : pino + persistance base

**Implementation Patterns**
- [x] Conventions de nommage (DB, API, code)
- [x] Patterns de structure (tests, frontend, backend)
- [x] Formats API et SSE normalises
- [x] Gestion d'erreurs (PlatformError, error handler, toasts)
- [x] Regles d'application et anti-patterns

**Project Structure**
- [x] Arbre de fichiers complet
- [x] Frontieres architecturales definies (API, composants, donnees)
- [x] Mapping FRs → structure
- [x] Flux de donnees documente

### Architecture Readiness Assessment

**Statut : PRET POUR L'IMPLEMENTATION**

**Niveau de confiance : Eleve**

**Forces :**
- Architecture simple et maintenable pour un dev solo
- Stack 100% TypeScript — coherence et type safety de bout en bout
- Patterns de connecteurs extensibles pour les futures plateformes
- Decisions UX et architecture alignees

**Ameliorations futures (post-MVP) :**
- Rate limiting si multi-utilisateurs
- CI/CD GitHub Actions
- Tests E2E (Playwright)

### Implementation Handoff

**Tous les agents IA doivent :**
- Suivre les decisions architecturales exactement comme documentees
- Utiliser les patterns d'implementation de maniere consistante
- Respecter la structure projet et les frontieres
- Consulter ce document pour toute question architecturale

**Premiere priorite d'implementation :**
Initialisation du monorepo npm workspaces avec la structure definie, configuration TypeScript, et scaffolding des deux apps (web + server) + package shared.
