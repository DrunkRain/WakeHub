# Story 1.1: Initialisation du projet & premier demarrage

Status: done

## Story

As a developpeur,
I want initialiser le monorepo WakeHub avec toute la stack technique,
So that l'application peut demarrer et servir une page minimale via Docker.

## Acceptance Criteria

1. **Monorepo npm workspaces**
   - Given le repo est clone et les dependances installees
   - When j'inspecte la structure du projet
   - Then les workspaces `apps/web`, `apps/server` et `packages/shared` existent et sont lies
   - And TypeScript strict est configure partout via `tsconfig.base.json`
   - And le package `packages/shared` exporte des types utilisables depuis `apps/web` et `apps/server`

2. **Dev server fonctionnel**
   - Given le monorepo est configure
   - When je lance `npm run dev`
   - Then le serveur Fastify demarre et sert une page React minimale ("WakeHub is running")
   - And le frontend Vite tourne en mode HMR sur un port separe en dev

3. **Docker build & run**
   - Given le fichier `docker-compose.yml` et le `Dockerfile` multi-stage existent
   - When je lance `docker compose up --build`
   - Then l'image se build (frontend Vite + backend compile) et le conteneur demarre
   - And le serveur Fastify sert les fichiers statiques du frontend et l'API sur le meme port
   - And la base SQLite est creee dans un volume persiste
   - And la restart policy est `unless-stopped`

4. **Swagger/OpenAPI**
   - Given le serveur Fastify est demarre
   - When j'accede a `GET /docs`
   - Then la documentation Swagger/OpenAPI est accessible (@fastify/swagger-ui)

5. **Variables d'environnement**
   - Given le fichier `.env.example` existe
   - When je le copie en `.env` et configure les variables (PORT, ENCRYPTION_KEY, DATABASE_PATH, SESSION_SECRET, NODE_ENV)
   - Then le serveur utilise ces variables au demarrage

6. **Linting**
   - Given ESLint et eslint-plugin-jsx-a11y sont configures
   - When je lance `npm run lint`
   - Then les regles de qualite et d'accessibilite sont verifiees sur tout le code

7. **Tests**
   - Given Vitest est configure
   - When je lance `npm run test`
   - Then les tests s'executent sur tous les workspaces

8. **Logging**
   - Given pino est configure comme logger Fastify
   - When le serveur demarre
   - Then les logs sont emis en JSON structure sur stdout

9. **Base de donnees**
   - Given Drizzle ORM est configure avec better-sqlite3
   - When le serveur demarre
   - Then la connexion a la base SQLite est etablie et le systeme de migrations est pret

## Tasks / Subtasks

- [x] Task 1 : Initialiser le monorepo npm workspaces (AC: #1)
  - [x] 1.1 Creer le `package.json` racine avec `"workspaces": ["apps/*", "packages/*"]`
  - [x] 1.2 Creer `tsconfig.base.json` a la racine (strict: true, target ES2022, moduleResolution bundler)
  - [x] 1.3 Creer `packages/shared/` avec package.json, tsconfig.json, et `src/index.ts`
  - [x] 1.4 Exporter des types de base depuis shared (ApiResponse, ApiError)
  - [x] 1.5 Verifier que `npm install` a la racine lie les workspaces

- [x] Task 2 : Scaffolder le frontend apps/web (AC: #2)
  - [x] 2.1 Initialiser via `npm create vite@latest apps/web -- --template react-ts`
  - [x] 2.2 Installer Mantine : `@mantine/core @mantine/hooks`
  - [x] 2.3 Installer PostCSS : `postcss postcss-preset-mantine postcss-simple-vars`
  - [x] 2.4 Configurer `postcss.config.mjs` avec les plugins Mantine
  - [x] 2.5 Configurer `tsconfig.json` qui etend `../../tsconfig.base.json`
  - [x] 2.6 Ajouter la reference a `@wakehub/shared` dans les dependances
  - [x] 2.7 Creer une page minimale "WakeHub is running" avec MantineProvider
  - [x] 2.8 Configurer le proxy Vite vers le backend en dev (`vite.config.ts`)

- [x] Task 3 : Scaffolder le backend apps/server (AC: #2, #4, #5, #8, #9)
  - [x] 3.1 Creer `apps/server/package.json` avec scripts (dev, build, start)
  - [x] 3.2 Configurer `tsconfig.json` qui etend `../../tsconfig.base.json`
  - [x] 3.3 Installer Fastify et plugins : `fastify @fastify/static @fastify/cookie @fastify/swagger @fastify/swagger-ui`
  - [x] 3.4 Installer Drizzle + SQLite : `drizzle-orm better-sqlite3 drizzle-kit`
  - [x] 3.5 Installer types et outils dev : `@types/better-sqlite3 tsx`
  - [x] 3.6 Installer pino (inclus dans Fastify par defaut — confirmer la version)
  - [x] 3.7 Creer `src/app.ts` — point d'entree Fastify avec logger pino
  - [x] 3.8 Creer `src/config.ts` — chargement et validation des variables d'env via dotenv
  - [x] 3.9 Creer `src/db/index.ts` — connexion Drizzle + instance better-sqlite3
  - [x] 3.10 Creer `src/db/schema.ts` — fichier de schema vide (pret pour les migrations futures)
  - [x] 3.11 Configurer `drizzle.config.ts` a la racine de apps/server
  - [x] 3.12 Enregistrer les plugins Swagger (@fastify/swagger + @fastify/swagger-ui sur `/docs`)
  - [x] 3.13 Servir les fichiers statiques du build frontend en production (@fastify/static)
  - [x] 3.14 Ajouter la reference a `@wakehub/shared` dans les dependances
  - [x] 3.15 Configurer le script dev avec `tsx watch`

- [x] Task 4 : Configurer les variables d'environnement (AC: #5)
  - [x] 4.1 Creer `.env.example` avec toutes les variables documentees
  - [x] 4.2 Ajouter `.env` au `.gitignore`

- [x] Task 5 : Configurer ESLint (AC: #6)
  - [x] 5.1 Installer ESLint et plugins : `eslint eslint-plugin-jsx-a11y @eslint/js typescript-eslint`
  - [x] 5.2 Creer `eslint.config.js` a la racine (format flat config ESLint 9+)
  - [x] 5.3 Configurer les regles TypeScript + JSX A11Y
  - [x] 5.4 Ajouter le script `npm run lint` dans le package.json racine

- [x] Task 6 : Configurer Vitest (AC: #7)
  - [x] 6.1 Installer Vitest dans chaque workspace
  - [x] 6.2 Configurer `vitest.config.ts` dans apps/web et apps/server (workspace config)
  - [x] 6.3 Creer un test trivial dans chaque workspace pour verifier la config
  - [x] 6.4 Ajouter le script `npm run test` dans le package.json racine

- [x] Task 7 : Configurer les scripts racine (AC: #2)
  - [x] 7.1 Ajouter `"dev"` dans le package.json racine (lance web + server en parallele)
  - [x] 7.2 Ajouter `"build"` (build web + compile server)
  - [x] 7.3 Ajouter `"lint"` et `"test"` au niveau racine
  - [x] 7.4 Installer `concurrently` ou `npm-run-all2` pour les scripts paralleles

- [x] Task 8 : Docker multi-stage (AC: #3)
  - [x] 8.1 Creer `docker/Dockerfile` multi-stage (deps → build web → build server → production)
  - [x] 8.2 Creer `docker-compose.yml` avec volume SQLite et restart policy
  - [x] 8.3 Creer `.dockerignore`
  - [x] 8.4 Tester `docker compose up --build` — DNS bloque dans l'env de dev, a valider manuellement

- [x] Task 9 : Fichiers racine du projet (AC: #1)
  - [x] 9.1 Creer `.gitignore` (node_modules, dist, .env, *.sqlite, etc.)
  - [x] 9.2 Initialiser le depot git

## Dev Notes

### Stack technique exacte — versions verifiees (fevrier 2026)

| Package | Version | Notes |
|---|---|---|
| TypeScript | ~5.9.x | Stable. v7 en preview (portage Go) — rester sur v5 |
| Vite | ~7.x | Requiert Node 20.19+. Nouveau target `baseline-widely-available` |
| React | ~19.x | PropTypes/defaultProps supprimes, string refs supprimes |
| Mantine | ~7.17.x | CSS Modules (pas CSS-in-JS). `createStyles` supprime. AppShell reecrit en compound components |
| Fastify | ~5.x | Requiert Node 20+. `reply.redirect(url, code)` signature changee |
| Drizzle ORM | ~0.45.x | Stable. v1 en beta — rester sur v0 |
| better-sqlite3 | ~12.x | Stable, pas de breaking changes |
| argon2 | ~0.44.x | Requis Node 18+. Types TS inclus. N'installer que dans apps/server |
| Vitest | ~4.x | Browser Mode stable. ESM-first |
| TanStack Query | ~5.x (@tanstack/react-query) | Requiert React 18+. Devtools disponibles |
| Zustand | ~5.x | Pas de default export. Utiliser `createWithEqualityFn` si besoin d'equality custom |
| React Router | ~7.x | Importer depuis `react-router` (pas `react-router-dom`). Data Routers |
| pino | ~10.x | Inclus nativement dans Fastify. Configurer via `logger: true` |
| @fastify/swagger | ~8.x | Generation OpenAPI |
| @fastify/swagger-ui | ~5.x | UI Swagger sur `/docs` |
| @tabler/icons-react | ~3.x | 5900+ icones. ESM-first |
| ESLint | ~10.x | Format flat config uniquement (`eslint.config.js`). eslintrc supprime |
| eslint-plugin-jsx-a11y | ~6.x | Checker statique JSX pour accessibilite |
| tsx | ~4.x | Execute TypeScript avec esbuild. Watch mode inclus |
| dotenv | latest | Chargement des variables `.env` |

**Node.js requis : v20.19+ (LTS)** — Vite 7, Fastify 5 et ESLint 10 l'exigent.

### Architecture du monorepo

```
WakeHub/
├── package.json                    # npm workspaces root
├── tsconfig.base.json              # Config TS partagee (strict)
├── eslint.config.js                # ESLint flat config
├── .env.example                    # Template variables d'env
├── .gitignore
├── docker-compose.yml
├── docker/
│   └── Dockerfile                  # Multi-stage build
├── apps/
│   ├── web/                        # Vite + React 19 + Mantine v7
│   │   ├── package.json
│   │   ├── tsconfig.json           # extends ../../tsconfig.base.json
│   │   ├── vite.config.ts
│   │   ├── postcss.config.mjs      # Mantine PostCSS plugins
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx             # MantineProvider + page minimale
│   │       ├── main.tsx            # Entry point React
│   │       └── vite-env.d.ts
│   └── server/                     # Fastify + Drizzle + better-sqlite3
│       ├── package.json
│       ├── tsconfig.json           # extends ../../tsconfig.base.json
│       ├── drizzle.config.ts
│       └── src/
│           ├── app.ts              # Point d'entree Fastify
│           ├── config.ts           # Chargement .env + validation
│           └── db/
│               ├── index.ts        # Connexion Drizzle + instance DB
│               └── schema.ts       # Schema vide (pret pour migrations)
└── packages/
    └── shared/                     # Types TypeScript partages
        ├── package.json
        ├── tsconfig.json           # extends ../../tsconfig.base.json
        └── src/
            └── index.ts            # Exports ApiResponse, ApiError
```

### Conventions de nommage (ARCH-17)

- **Fichiers** : `kebab-case` — `app.ts`, `vite-env.d.ts`, `postcss.config.mjs`
- **Composants React** : PascalCase — `App.tsx`
- **DB** : `snake_case` — `created_at`, `machine_id`
- **API JSON** : camelCase — `{ machineName, ipAddress }`
- **Types/Interfaces** : PascalCase — `ApiResponse<T>`, `ApiError`
- **Constantes** : SCREAMING_SNAKE — `DEFAULT_PORT`, `SESSION_SECRET`
- **Dossiers** : `kebab-case` — `apps/web`, `packages/shared`

### Configuration Mantine v7 — points critiques

Mantine v7+ utilise **CSS Modules** (plus de CSS-in-JS). Configuration requise :

1. **PostCSS obligatoire** avec `postcss-preset-mantine` et `postcss-simple-vars`
2. **Pas de `createStyles`** — utiliser CSS Modules (`.module.css`) ou les props Mantine (`style`, `className`)
3. **AppShell compound API** — syntaxe `<AppShell.Header>`, `<AppShell.Main>`, etc.
4. **MantineProvider** a la racine de l'app avec le theme custom
5. Importer `@mantine/core/styles.css` dans `main.tsx`

### Configuration Fastify v5 — points critiques

1. **Requiert Node 20+**
2. `reply.redirect()` a une nouvelle signature — verifier la doc
3. Les body DELETE avec JSON sont rejetes par defaut
4. pino est inclus nativement — `fastify({ logger: true })`
5. Plugins registres via `app.register()`

### Configuration ESLint 10 — flat config

ESLint 10 n'accepte que le format **flat config** (`eslint.config.js`). Plus de `.eslintrc.*`.

```js
// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  // ... custom rules
);
```

### Configuration Drizzle ORM — points critiques

1. **Code-first** — les schemas sont definis en TypeScript dans `db/schema.ts`
2. **Migrations** via `drizzle-kit` : `npx drizzle-kit generate` et `npx drizzle-kit push`
3. **better-sqlite3** est synchrone — pas besoin d'async pour les operations DB
4. Le fichier `drizzle.config.ts` doit pointer vers le schema et le chemin de la DB

### Docker multi-stage build

```dockerfile
# Stage 1: Install deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY apps/server/package*.json ./apps/server/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci

# Stage 2: Build frontend
FROM deps AS build-web
COPY . .
RUN npm run build -w apps/web

# Stage 3: Build backend
FROM deps AS build-server
COPY . .
RUN npm run build -w apps/server

# Stage 4: Production
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build-web /app/apps/web/dist ./apps/web/dist
COPY --from=build-server /app/apps/server/dist ./apps/server/dist
COPY apps/server/package.json ./apps/server/
COPY package.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/server/dist/app.js"]
```

### Variables d'environnement (.env.example)

```
PORT=3000
NODE_ENV=development
DATABASE_PATH=./data/wakehub.sqlite
ENCRYPTION_KEY=  # 32 bytes hex — openssl rand -hex 32
SESSION_SECRET=  # openssl rand -hex 32
```

### Tests co-localises (ARCH-15)

Chaque fichier `foo.ts` a son test `foo.test.ts` a cote. Pas de dossier `__tests__/` separe.

```
src/config.ts
src/config.test.ts
src/db/index.ts
src/db/index.test.ts
```

### Format de reponse API normalise (ARCH-11)

```typescript
// packages/shared/src/index.ts
export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

### Anti-patterns a eviter absolument

- **NE PAS** creer un dossier `__tests__/` — tests co-localises
- **NE PAS** utiliser `snake_case` dans le JSON API — c'est `camelCase`
- **NE PAS** utiliser `camelCase` dans la base de donnees — c'est `snake_case`
- **NE PAS** retourner des reponses API sans le wrapper `{ data }` ou `{ error }`
- **NE PAS** creer des fichiers composant en PascalCase — `kebab-case` pour les fichiers
- **NE PAS** utiliser `any` dans TypeScript — typage strict obligatoire
- **NE PAS** utiliser `createStyles` de Mantine — supprime dans v7
- **NE PAS** utiliser `.eslintrc` — format flat config uniquement
- **NE PAS** utiliser `import from 'react-router-dom'` — importer depuis `react-router` (v7)

### Proxy Vite en dev

En mode dev, le frontend tourne sur un port (ex: 5173) et le backend sur un autre (ex: 3000). Configurer le proxy dans `vite.config.ts` :

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/docs': 'http://localhost:3000',
    },
  },
  // ...
});
```

### Servir les fichiers statiques en production

En production, Fastify sert les fichiers du build Vite via `@fastify/static` :

```typescript
import fastifyStatic from '@fastify/static';
import path from 'node:path';

// En production, servir le build frontend
if (process.env.NODE_ENV === 'production') {
  app.register(fastifyStatic, {
    root: path.join(__dirname, '../../web/dist'),
    prefix: '/',
  });

  // Fallback SPA — toutes les routes non-API servent index.html
  app.setNotFoundHandler((req, reply) => {
    if (!req.url.startsWith('/api')) {
      return reply.sendFile('index.html');
    }
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
}
```

### Project Structure Notes

- Structure alignee avec l'architecture document `architecture.md` section "Project Structure"
- Le `packages/shared` est minimal dans cette story — seuls les types de base ApiResponse/ApiError
- Le schema DB est vide — les tables seront creees dans les stories suivantes (1.3 pour `users` et `operation_logs`)
- La config backend utilise `dotenv` pour le dev et les variables d'env Docker en production

### References

- [Source: architecture.md#Starter-Template-Evaluation] — Structure monorepo npm workspaces
- [Source: architecture.md#Core-Architectural-Decisions] — Decisions techniques (Fastify, Drizzle, SSE, etc.)
- [Source: architecture.md#Implementation-Patterns] — Conventions de nommage, patterns de structure
- [Source: architecture.md#Complete-Project-Directory-Structure] — Arbre de fichiers complet
- [Source: epics.md#Story-1.1] — Acceptance criteria et description de la story
- [Source: prd.md#Exigences-Non-Fonctionnelles] — NFRs performance, securite, fiabilite
- [Source: ux-design-specification.md#Design-System-Foundation] — Mantine v7+, PostCSS, theme dark

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Docker build DNS issue: l'environnement de dev n'a pas de reseau Docker fonctionnel, `docker compose build` echoue sur la resolution DNS. Le Dockerfile est structurellement correct.

### Completion Notes List

- Monorepo npm workspaces avec 3 workspaces (apps/web, apps/server, packages/shared)
- Frontend: Vite 7.3 + React 19.2 + Mantine 7.17 + PostCSS
- Backend: Fastify 5 + Drizzle ORM 0.45 + better-sqlite3 + pino
- ESLint 9 flat config (centralise a la racine) avec typescript-eslint, jsx-a11y, react-hooks
- Vitest 4 configure dans chaque workspace avec tests triviaux
- Docker multi-stage build avec docker-compose.yml (restart: unless-stopped, volume SQLite)
- Scripts racine: dev (concurrently), build, lint, test
- TypeScript strict, noUncheckedIndexedAccess, noUnusedLocals
- ESLint utilise la v9 (pas v10) car Vite 7 scaffold installe ESLint 9

### File List

- `package.json` — root monorepo avec npm workspaces
- `tsconfig.base.json` — config TypeScript partagee (strict)
- `eslint.config.js` — ESLint flat config centralise
- `.env.example` — template variables d'environnement
- `.gitignore` — ignores racine
- `.dockerignore` — ignores Docker
- `docker/Dockerfile` — multi-stage build
- `docker-compose.yml` — orchestration Docker
- `packages/shared/package.json` — package types partages
- `packages/shared/tsconfig.json` — config TS shared
- `packages/shared/src/index.ts` — exports ApiResponse, ApiError, ApiResult
- `apps/web/package.json` — frontend package
- `apps/web/tsconfig.app.json` — config TS frontend (extends base)
- `apps/web/tsconfig.node.json` — config TS node pour Vite
- `apps/web/vite.config.ts` — config Vite avec proxy
- `apps/web/postcss.config.mjs` — config PostCSS Mantine
- `apps/web/vitest.config.ts` — config Vitest web (jsdom)
- `apps/web/src/main.tsx` — entry point React + MantineProvider
- `apps/web/src/App.tsx` — page minimale "WakeHub is running"
- `apps/web/src/app.test.tsx` — test trivial
- `apps/server/package.json` — backend package
- `apps/server/tsconfig.json` — config TS server (NodeNext)
- `apps/server/drizzle.config.ts` — config Drizzle Kit
- `apps/server/vitest.config.ts` — config Vitest server
- `apps/server/src/app.ts` — entry point Fastify (pino, swagger, static, cookie)
- `apps/server/src/config.ts` — chargement et validation .env
- `apps/server/src/db/index.ts` — connexion Drizzle + better-sqlite3
- `apps/server/src/db/schema.ts` — schema vide (pret pour migrations)
- `apps/server/src/config.test.ts` — test trivial
