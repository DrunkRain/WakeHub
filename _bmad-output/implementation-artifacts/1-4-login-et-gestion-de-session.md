# Story 1.4: Login & gestion de session

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur,
I want me connecter à WakeHub avec mon compte,
So that seul moi peut accéder à mon homelab.

## Acceptance Criteria

1. **Migration table sessions**
   - Given la table `sessions` n'existe pas encore
   - When la migration Drizzle s'exécute pour cette story
   - Then la table `sessions` est créée avec les colonnes : id, user_id, token, expires_at, created_at

2. **Affichage formulaire login si utilisateur existe**
   - Given un compte utilisateur existe en base
   - When j'accède à WakeHub sans session active
   - Then le formulaire de login est affiché (nom d'utilisateur + mot de passe + checkbox "Se souvenir de moi")

3. **Login avec identifiants valides**
   - Given je saisis des identifiants valides
   - When je soumets le formulaire de login
   - Then une session est créée en base et un cookie HTTP-only, SameSite=Strict est envoyé au navigateur
   - And je suis redirigé vers le dashboard
   - And l'opération est enregistrée dans les logs

4. **Login avec identifiants invalides**
   - Given je saisis des identifiants invalides
   - When je soumets le formulaire de login
   - Then un message d'erreur générique s'affiche ("Identifiants incorrects") sans révéler si c'est le nom d'utilisateur ou le mot de passe qui est faux

5. **Option "Se souvenir de moi"**
   - Given je coche "Se souvenir de moi" avant de me connecter
   - When la session est créée
   - Then la durée de vie de la session est étendue (30 jours au lieu de 24h)

6. **Middleware auth sur routes protégées**
   - Given je suis connecté
   - When j'accède à une route protégée `/api/*`
   - Then le middleware auth vérifie le cookie de session et autorise l'accès

7. **Redirect vers login si non connecté**
   - Given je ne suis pas connecté (pas de session ou session expirée)
   - When j'accède à une route protégée
   - Then le serveur retourne 401 et le frontend redirige vers le formulaire de login

8. **Déconnexion**
   - Given je suis connecté
   - When je clique sur "Déconnexion"
   - Then la session est supprimée en base et le cookie est effacé
   - And je suis redirigé vers le formulaire de login
   - And l'opération est enregistrée dans les logs

9. **Routes publiques**
   - Given les routes `/api/auth/login` et `/api/auth/register`
   - When elles sont appelées sans session
   - Then elles sont accessibles (pas protégées par le middleware auth)

10. **Configuration TanStack Query et Zustand**
    - Given TanStack Query et Zustand sont configurés
    - When l'application frontend se charge
    - Then le hook `useAuth()` est disponible pour vérifier l'état d'authentification
    - And les queries TanStack sont configurées pour gérer les 401 globalement

## Tasks / Subtasks

- [x] Task 1 : Créer la migration Drizzle pour la table sessions (AC: #1)
  - [x] 1.1 Ajouter la définition de la table `sessions` dans `apps/server/src/db/schema.ts`
  - [x] 1.2 Générer la migration SQL via `drizzle-kit generate`
  - [x] 1.3 Appliquer la migration (la migration programmatique du serveur la gère automatiquement)
  - [x] 1.4 Tester la migration avec un test unitaire

- [x] Task 2 : Implémenter le middleware d'authentification (AC: #6, #7)
  - [x] 2.1 Créer `apps/server/src/middleware/auth.middleware.ts`
  - [x] 2.2 Implémenter la vérification du cookie de session
  - [x] 2.3 Vérifier la session en base et vérifier l'expiration
  - [x] 2.4 Retourner 401 si pas de session ou session expirée
  - [x] 2.5 Ajouter `userId` dans le contexte Fastify request pour les routes protégées
  - [x] 2.6 Tester le middleware avec des tests unitaires

- [x] Task 3 : Implémenter les endpoints auth login et logout (AC: #3, #4, #5, #8, #9)
  - [x] 3.1 Créer l'endpoint `POST /api/auth/login` dans `routes/auth.ts`
  - [x] 3.2 Validation JSON Schema (username, password, rememberMe)
  - [x] 3.3 Vérifier les credentials via argon2.verify()
  - [x] 3.4 Créer une session en base avec token aléatoire (crypto.randomUUID())
  - [x] 3.5 Calculer expires_at selon rememberMe (24h ou 30 jours)
  - [x] 3.6 Envoyer le cookie HTTP-only, SameSite=Strict avec le token
  - [x] 3.7 Logger l'opération dans operation_logs
  - [x] 3.8 Retourner `{ data: { userId, username } }`
  - [x] 3.9 Si credentials invalides, retourner erreur générique code: INVALID_CREDENTIALS
  - [x] 3.10 Créer l'endpoint `POST /api/auth/logout`
  - [x] 3.11 Supprimer la session en base
  - [x] 3.12 Effacer le cookie (set maxAge=0)
  - [x] 3.13 Logger l'opération
  - [x] 3.14 Retourner `{ data: { success: true } }`
  - [x] 3.15 Écrire les tests d'intégration pour login et logout

- [x] Task 4 : Créer le composant LoginForm frontend (AC: #2, #3, #4, #5)
  - [x] 4.1 Créer `apps/web/src/features/auth/login-form.tsx`
  - [x] 4.2 Utiliser Mantine Form avec validation client-side
  - [x] 4.3 Champs : TextInput (username), PasswordInput (password), Checkbox (rememberMe "Se souvenir de moi")
  - [x] 4.4 Bouton soumission avec état loading
  - [x] 4.5 Afficher les erreurs de validation sous chaque champ
  - [x] 4.6 Gérer les erreurs API avec toast Notification
  - [x] 4.7 Rediriger vers dashboard après succès

- [x] Task 5 : Configurer le hook useAuth et gestion globale 401 (AC: #7, #10)
  - [x] 5.1 Créer `apps/web/src/hooks/use-auth.ts` (implémenté dans auth.api.ts pour cohérence)
  - [x] 5.2 Implémenter un query TanStack pour vérifier la session (`GET /api/auth/me`)
  - [x] 5.3 Créer l'endpoint `GET /api/auth/me` côté serveur (retourne user si session valide, 401 sinon)
  - [x] 5.4 Configurer TanStack Query pour gérer les 401 globalement (onError global)
  - [x] 5.5 Sur 401, rediriger vers /login et invalider toutes les queries
  - [x] 5.6 Mettre à jour AuthGuard pour utiliser useAuth()

- [x] Task 6 : Ajouter le bouton déconnexion et UI (AC: #8)
  - [x] 6.1 Ajouter un bouton "Déconnexion" dans le header AppShell
  - [x] 6.2 Appeler l'endpoint logout via TanStack Query mutation
  - [x] 6.3 Rediriger vers /login après déconnexion
  - [x] 6.4 Invalider toutes les queries TanStack après logout

- [x] Task 7 : Enregistrer les routes auth dans app.ts et tester le flux complet (AC: tous)
  - [x] 7.1 Enregistrer le middleware auth sur toutes les routes sauf /api/auth/login, /api/auth/register, /api/auth/check-setup
  - [x] 7.2 Tester le flux complet login → dashboard → logout → login
  - [x] 7.3 Tester l'option "Se souvenir de moi" (vérifier expires_at en base)
  - [x] 7.4 Tester l'accès à une route protégée sans session (doit retourner 401)
  - [x] 7.5 Tester que les logs sont bien enregistrés

## Dev Notes

### Stack technique et versions — rappel Story 1.3

| Package | Version | Notes |
|---|---|---|
| React | ~19.2 | Déjà installé |
| Mantine | ~7.17 | Déjà installé. useForm pour validation |
| React Router | ~7.x | Déjà installé (Story 1.2) |
| Fastify | ~5.x | Backend API, plugins |
| Drizzle ORM | ~0.36.x | Code-first TypeScript ORM |
| better-sqlite3 | ~11.x | Driver SQLite synchrone |
| argon2 | ~0.31.x | Déjà installé (Story 1.3). Verification password |
| @fastify/cookie | ~11.x | **À INSTALLER**. Gestion cookies Fastify |
| TanStack Query | Déjà installé (Story 1.3) | Server state management |
| pino | inclus Fastify | Logger JSON structuré |

### Architecture — Points critiques pour cette story

**Sessions cookie (ARCH-06) :**
- Cookie HTTP-only, Secure (si HTTPS disponible), SameSite=Strict
- Session stockée en base SQLite (table `sessions`)
- Token de session : UUID aléatoire via `crypto.randomUUID()`
- Durée : 24h par défaut, 30 jours si "Se souvenir de moi"
- Vérification : middleware Fastify vérifie le cookie + session en base + expires_at

**Middleware auth Fastify :**
- Hook `preHandler` qui s'exécute avant chaque route protégée
- Lit le cookie via `@fastify/cookie`
- Query la table `sessions` pour vérifier token + expires_at
- Si valide : injecter `request.userId` pour usage dans les routes
- Si invalide : retourner 401 avec format normalisé

**Format API normalisé (ARCH-11) :**
- Succès login : `{ data: { userId, username } }`
- Succès logout : `{ data: { success: true } }`
- Erreur credentials : `{ error: { code: 'INVALID_CREDENTIALS', message: 'Identifiants incorrects' } }`
- Erreur session : `{ error: { code: 'UNAUTHORIZED', message: 'Session invalide ou expirée' } }`

**Logging pino + persistance (ARCH-09) :**
- Chaque login/logout enregistré dans operation_logs
- Format : `{ timestamp, level: 'info', source: 'auth', message: 'User logged in', details: { userId, username } }`

**Frontend auth flow :**
- TanStack Query gère l'état auth avec query `useAuth()`
- AuthGuard vérifie l'état auth et redirige si non connecté
- Sur 401 API, TanStack Query global onError redirige vers login
- Pas de stockage local du user — toujours fetch depuis `/api/auth/me`

### Schema Drizzle — Table sessions

```typescript
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

### Validation côté serveur — JSON Schema Fastify

**POST /api/auth/login :**

```typescript
const loginSchema = {
  body: {
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 50 },
      password: { type: 'string', minLength: 1 },
      rememberMe: { type: 'boolean' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            username: { type: 'string' },
          },
        },
      },
    },
  },
};
```

**GET /api/auth/me :**

```typescript
const meSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            username: { type: 'string' },
          },
        },
      },
    },
  },
};
```

### Middleware auth implementation pattern

```typescript
// apps/server/src/middleware/auth.middleware.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { sessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // Lire le cookie de session
  const sessionToken = request.cookies.session_token;

  if (!sessionToken) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Session invalide ou expirée',
      },
    });
  }

  // Vérifier la session en base
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, sessionToken))
    .limit(1);

  if (!session || new Date() > new Date(session.expiresAt)) {
    // Session expirée ou inexistante
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Session invalide ou expirée',
      },
    });
  }

  // Session valide - injecter userId dans request
  request.userId = session.userId;
}
```

### Frontend LoginForm pattern

```typescript
// apps/web/src/features/auth/login-form.tsx
import { useForm } from '@mantine/form';
import { TextInput, PasswordInput, Checkbox, Button } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router';

export function LoginForm() {
  const navigate = useNavigate();
  const form = useForm({
    initialValues: {
      username: '',
      password: '',
      rememberMe: false,
    },
    validate: {
      username: (val) => (val.length < 3 ? 'Minimum 3 caractères' : null),
      password: (val) => (val.length < 1 ? 'Mot de passe requis' : null),
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (values: typeof form.values) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include', // Important pour les cookies
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error.message);
      }

      return response.json();
    },
    onSuccess: () => {
      notifications.show({
        title: 'Connexion réussie',
        message: 'Bienvenue sur WakeHub',
        color: 'green',
      });
      navigate('/dashboard');
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message,
        color: 'red',
      });
    },
  });

  return (
    <form onSubmit={form.onSubmit((values) => loginMutation.mutate(values))}>
      <TextInput
        label="Nom d'utilisateur"
        {...form.getInputProps('username')}
      />
      <PasswordInput
        label="Mot de passe"
        {...form.getInputProps('password')}
      />
      <Checkbox
        label="Se souvenir de moi"
        {...form.getInputProps('rememberMe', { type: 'checkbox' })}
      />
      <Button type="submit" loading={loginMutation.isPending}>
        Se connecter
      </Button>
    </form>
  );
}
```

### Hook useAuth pattern

```typescript
// apps/web/src/hooks/use-auth.ts
import { useQuery } from '@tanstack/react-query';

export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Not authenticated');
      }

      const { data } = await response.json();
      return data;
    },
    retry: false, // Ne pas retry sur 401
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### TanStack Query global 401 handler

```typescript
// apps/web/src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      onError: (error: any) => {
        if (error?.response?.status === 401) {
          // Rediriger vers login sur 401
          queryClient.clear(); // Vider le cache
          window.location.href = '/login'; // Hard redirect pour éviter les problèmes de contexte
        }
      },
    },
  },
});
```

### Enregistrement du middleware dans app.ts

```typescript
// apps/server/src/app.ts
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authMiddleware } from './middleware/auth.middleware.js';
import authRoutes from './routes/auth.js';
// ... autres imports

const app = Fastify({ logger: true });

// Register cookie plugin
await app.register(cookie);

// Register auth routes (publiques)
await app.register(authRoutes, { prefix: '/api/auth' });

// Register auth middleware sur toutes les routes sauf auth
app.addHook('preHandler', async (request, reply) => {
  // Skip middleware pour les routes publiques
  if (
    request.url.startsWith('/api/auth/login') ||
    request.url.startsWith('/api/auth/register') ||
    request.url.startsWith('/api/auth/check-setup')
  ) {
    return;
  }

  // Appliquer le middleware auth
  await authMiddleware(request, reply);
});

// ... autres routes protégées
```

### Intelligence de Story 1.3 — Ce qui a déjà été fait

**Files créés :**
- `apps/server/src/db/schema.ts` — Tables `users` et `operation_logs` déjà créées
- `apps/server/src/routes/auth.ts` — Routes `/api/auth/register` et `/api/auth/check-setup` déjà implémentées
- `apps/web/src/features/auth/register-form.tsx` — Formulaire de création de compte
- `apps/web/src/features/auth/first-time-setup.tsx` — Page de setup initial
- `apps/web/src/features/auth/auth-guard.tsx` — Guard pour protéger les routes
- `apps/web/src/api/auth.api.ts` — Queries TanStack pour register et check-setup

**Patterns établis à suivre :**
- Validation Mantine Form avec `useForm`
- Hashage argon2 pour les mots de passe
- Format API normalisé `{ data }` / `{ error: { code, message } }`
- Logging pino + persistance dans operation_logs
- TanStack Query pour les mutations et queries
- Notifications Mantine pour les toasts

**À réutiliser :**
- Le fichier `routes/auth.ts` existe déjà — ajouter les nouveaux endpoints dedans
- Le schéma `users` existe déjà — référencer pour la table `sessions`
- Le helper de logging existe déjà (pino configuré)
- Le AuthGuard existe — le mettre à jour pour utiliser `useAuth()`

### Anti-patterns à éviter

- **NE PAS** stocker le mot de passe en clair dans la session
- **NE PAS** utiliser JWT — c'est sessions cookie
- **NE PAS** oublier le flag HTTP-only sur le cookie (sécurité XSS)
- **NE PAS** oublier SameSite=Strict (sécurité CSRF)
- **NE PAS** révéler si c'est le username ou le password qui est faux (message générique)
- **NE PAS** créer une nouvelle table users — elle existe déjà
- **NE PAS** utiliser localStorage pour stocker des credentials — tout est côté serveur
- **NE PAS** oublier `credentials: 'include'` dans les fetch frontend (pour envoyer les cookies)

### Testing approach

**Tests unitaires backend :**
- Tester le middleware auth avec session valide/invalide/expirée
- Tester l'endpoint login avec credentials valides/invalides
- Tester l'endpoint logout
- Tester que rememberMe modifie bien expires_at

**Tests d'intégration :**
- Test complet : register → login → accès route protégée → logout
- Test session expirée : créer session avec expires_at passé → vérifier 401
- Test "Se souvenir de moi" : vérifier que expires_at = now + 30 jours

### Références

- [Source: epics.md#Story-1.4] — User story, acceptance criteria, requirements
- [Source: architecture.md#Authentication-&-Security] — Sessions cookie, argon2, format API
- [Source: architecture.md#API-&-Communication-Patterns] — Format d'erreur normalisé
- [Source: architecture.md#Naming-Patterns] — Conventions de nommage DB/API/Code

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fix test "should create session with 24h expiry by default" : le orderBy sur createdAt (stocké en secondes) ne distinguait pas les sessions register/login créées dans la même seconde. Corrigé en filtrant par le token de la réponse cookie.

### Completion Notes List

- Tasks 1-3 (backend) étaient déjà implémentées par une session précédente (Claude Sonnet 4.5). Vérification et correction de tests.
- Task 4 : Créé LoginForm avec Mantine Form, validation client-side, checkbox "Se souvenir de moi", gestion erreurs API via toast, redirection vers dashboard après succès.
- Task 5 : Ajouté hooks useLogin, useLogout, useAuth dans auth.api.ts. Configuré handler global 401 dans main.tsx (retry: false sur UNAUTHORIZED + redirect /login). Mis à jour AuthGuard pour utiliser useAuth() + useCheckSetup().
- Task 6 : Ajouté bouton déconnexion (ActionIcon + Tooltip) dans le header AppShell. Utilise useLogout mutation, redirige vers /login, clear le cache TanStack.
- Task 7 : Enregistré le middleware auth en hook preHandler dans app.ts, avec exclusions pour les routes publiques (/api/auth/login, /register, /check-setup, /api/health). Tests existants couvrent le flux complet.
- Mis à jour les tests frontend (router.test.tsx, app-shell.test.tsx) pour fournir QueryClientProvider et mocker fetch pour simuler l'état authentifié.

### File List

**Nouveaux fichiers :**
- `apps/web/src/features/auth/login-form.tsx` — Composant formulaire de login
- `apps/web/src/features/auth/login-page.tsx` — Page de login (container + LoginForm)

**Fichiers modifiés :**
- `apps/server/src/app.ts` — Ajout import authMiddleware + hook preHandler pour routes protégées
- `apps/server/src/routes/auth.test.ts` — Fix tests session expiry (utilisation token cookie au lieu de orderBy)
- `apps/web/src/api/auth.api.ts` — Ajout hooks useLogin, useLogout, useAuth + types
- `apps/web/src/features/auth/auth-guard.tsx` — Utilise useAuth() pour vérifier la session
- `apps/web/src/router.tsx` — Ajout route /login
- `apps/web/src/main.tsx` — Handler global 401 TanStack Query
- `apps/web/src/components/layout/app-shell.tsx` — Bouton déconnexion dans header
- `apps/web/src/components/layout/app-shell.test.tsx` — Ajout QueryClientProvider
- `apps/web/src/router.test.tsx` — Ajout QueryClientProvider + mock fetch + async awaits

## Change Log

- 2026-02-10 : Implémentation complète Story 1.4 — Login, session management, middleware auth, frontend LoginForm, useAuth hook, bouton déconnexion, handler global 401
