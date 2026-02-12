# Story 1.5: Reinitialisation du mot de passe

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur,
I want reinitialiser mon mot de passe si je l'oublie,
So that je ne suis pas bloque hors de mon instance WakeHub.

## Acceptance Criteria

1. **Lien "Mot de passe oublie" sur la page login**
   - Given je suis sur la page de login
   - When je consulte le formulaire
   - Then un lien "Mot de passe oublie ?" est visible sous le bouton de connexion
   - And ce lien me redirige vers `/forgot-password`

2. **Formulaire de reinitialisation - Phase 1 : Saisie du nom d'utilisateur**
   - Given je suis sur la page `/forgot-password`
   - When je saisis mon nom d'utilisateur et clique sur "Continuer"
   - Then la question de securite de l'utilisateur est affichee
   - And les champs reponse, nouveau mot de passe et confirmation apparaissent

3. **Reinitialisation avec reponse correcte**
   - Given je fournis la bonne reponse a la question de securite et un nouveau mot de passe valide (>= 8 caracteres)
   - When je soumets le formulaire
   - Then le mot de passe est mis a jour en base (hache avec argon2id)
   - And toutes les sessions existantes de l'utilisateur sont invalidees (supprimees de la table `sessions`)
   - And je suis redirige vers le formulaire de login avec un message de succes
   - And l'operation est enregistree dans les logs

4. **Reinitialisation avec mauvaise reponse**
   - Given je fournis une mauvaise reponse a la question de securite
   - When je soumets le formulaire
   - Then un message d'erreur s'affiche ("Reponse incorrecte")
   - And le mot de passe n'est pas modifie

5. **Nom d'utilisateur inexistant**
   - Given je saisis un nom d'utilisateur qui n'existe pas
   - When je soumets le formulaire de reinitialisation
   - Then un message d'erreur generique s'affiche sans reveler si l'utilisateur existe ou non

6. **Validation mot de passe trop court**
   - Given le nouveau mot de passe fait moins de 8 caracteres
   - When je soumets le formulaire
   - Then un message d'erreur s'affiche sous le champ mot de passe
   - And le mot de passe n'est pas modifie

7. **Confirmation mot de passe**
   - Given le nouveau mot de passe et sa confirmation ne correspondent pas
   - When je soumets le formulaire
   - Then un message d'erreur s'affiche
   - And le mot de passe n'est pas modifie

## Tasks / Subtasks

- [x] Task 1 : Implementer l'endpoint GET security question (AC: #2, #5)
  - [x] 1.1 Ajouter `POST /api/auth/get-security-question` dans `routes/auth.ts`
  - [x] 1.2 Validation JSON Schema : `{ username: string (minLength: 3) }`
  - [x] 1.3 Si utilisateur existe : retourner `{ data: { securityQuestion: "..." } }`
  - [x] 1.4 Si utilisateur n'existe pas : retourner erreur generique `{ error: { code: 'INVALID_REQUEST', message: 'Impossible de traiter la demande' } }`
  - [x] 1.5 Ecrire les tests unitaires (user valide, user inexistant)

- [x] Task 2 : Implementer l'endpoint reset password (AC: #3, #4, #5, #6, #7)
  - [x] 2.1 Ajouter `POST /api/auth/reset-password` dans `routes/auth.ts`
  - [x] 2.2 Validation JSON Schema : `{ username, securityAnswer, newPassword, newPasswordConfirm }` (tous requis, newPassword minLength: 8)
  - [x] 2.3 Verifier que newPassword === newPasswordConfirm (sinon erreur PASSWORD_MISMATCH)
  - [x] 2.4 Chercher l'utilisateur par username
  - [x] 2.5 Si user inexistant : retourner erreur generique `{ error: { code: 'INVALID_SECURITY_ANSWER', message: 'Reponse incorrecte' } }` (ne pas reveler l'inexistence)
  - [x] 2.6 Verifier la reponse de securite avec `argon2.verify(user.securityAnswerHash, securityAnswer)`
  - [x] 2.7 Si mauvaise reponse : retourner `{ error: { code: 'INVALID_SECURITY_ANSWER', message: 'Reponse incorrecte' } }`
  - [x] 2.8 Hasher le nouveau mot de passe avec `argon2.hash(newPassword, { type: argon2.argon2id })`
  - [x] 2.9 Mettre a jour le `passwordHash` et `updatedAt` dans la table `users`
  - [x] 2.10 Supprimer TOUTES les sessions de l'utilisateur dans la table `sessions`
  - [x] 2.11 Logger l'operation dans `operation_logs` (level: 'info', source: 'auth', reason: 'password-reset')
  - [x] 2.12 Retourner `{ data: { success: true } }`
  - [x] 2.13 Ecrire les tests (reponse correcte, mauvaise reponse, user inexistant, password mismatch, password trop court)

- [x] Task 3 : Ajouter les routes publiques dans le middleware auth (AC: tous)
  - [x] 3.1 Dans `app.ts`, ajouter `/api/auth/get-security-question` et `/api/auth/reset-password` aux routes publiques exclues du middleware auth

- [x] Task 4 : Creer les hooks API frontend (AC: #2, #3, #4, #5)
  - [x] 4.1 Ajouter `useGetSecurityQuestion` mutation dans `auth.api.ts` : POST vers `/api/auth/get-security-question`
  - [x] 4.2 Ajouter `useResetPassword` mutation dans `auth.api.ts` : POST vers `/api/auth/reset-password`
  - [x] 4.3 Ajouter les types TypeScript correspondants (GetSecurityQuestionRequest, GetSecurityQuestionResponse, ResetPasswordRequest)

- [x] Task 5 : Creer le composant PasswordResetForm (AC: #1, #2, #3, #4, #5, #6, #7)
  - [x] 5.1 Creer `apps/web/src/features/auth/password-reset-form.tsx`
  - [x] 5.2 Phase 1 : Champ username + bouton "Continuer" — appelle `useGetSecurityQuestion`
  - [x] 5.3 Phase 2 (apres succes Phase 1) : Afficher la question de securite + champs reponse, nouveau mot de passe, confirmation
  - [x] 5.4 Validation client-side Mantine Form : reponse non vide, mot de passe >= 8 chars, confirmation match
  - [x] 5.5 Soumission via `useResetPassword`, gestion erreurs API via toast Notification
  - [x] 5.6 Sur succes : rediriger vers `/login` avec notification succes "Mot de passe reinitialise avec succes"
  - [x] 5.7 Lien "Retour a la connexion" vers `/login`

- [x] Task 6 : Creer la page et la route (AC: #1)
  - [x] 6.1 Creer `apps/web/src/features/auth/password-reset-page.tsx` (meme pattern que login-page.tsx)
  - [x] 6.2 Ajouter la route `/forgot-password` dans `router.tsx` (route publique, hors AuthGuard)
  - [x] 6.3 Ajouter le lien "Mot de passe oublie ?" dans `login-form.tsx` sous le bouton de connexion

- [x] Task 7 : Tests frontend (AC: tous)
  - [x] 7.1 Tester le flux complet : saisie username → affichage question → saisie reponse + password → succes → redirect login
  - [x] 7.2 Tester les erreurs : mauvaise reponse, user inexistant, password mismatch
  - [x] 7.3 Verifier que les tests existants (router, app-shell, auth) passent toujours

## Dev Notes

### Stack technique et versions — rappel Stories 1.3/1.4

| Package | Version | Notes |
|---|---|---|
| React | ~19.2 | Deja installe |
| Mantine | ~7.17 | useForm pour validation |
| React Router | ~7.x | Deja installe |
| Fastify | ~5.x | Backend API |
| Drizzle ORM | ~0.45.x | Code-first TypeScript ORM |
| better-sqlite3 | ~11.x | Driver SQLite synchrone |
| argon2 | ~0.31.x | Deja installe. `argon2.verify()` pour reponse securite |
| TanStack Query | ~5.x | Deja installe. useMutation pour les appels API |
| @fastify/cookie | ~11.x | Deja installe. Gestion cookies |

### Architecture — Points critiques pour cette story

**Pas de nouvelle table ni migration :**
- La table `users` a deja les champs `securityQuestion` (texte clair) et `securityAnswerHash` (argon2id)
- La table `sessions` existe deja pour l'invalidation
- Aucune migration Drizzle necessaire

**Endpoints a creer (routes publiques, pas de middleware auth) :**

1. `POST /api/auth/get-security-question`
   - Body : `{ username: string }`
   - Succes : `{ data: { securityQuestion: string } }`
   - Erreur (user inexistant) : `{ error: { code: 'INVALID_REQUEST', message: 'Impossible de traiter la demande' } }`

2. `POST /api/auth/reset-password`
   - Body : `{ username: string, securityAnswer: string, newPassword: string, newPasswordConfirm: string }`
   - Succes : `{ data: { success: true } }`
   - Erreur reponse : `{ error: { code: 'INVALID_SECURITY_ANSWER', message: 'Reponse incorrecte' } }`
   - Erreur password : `{ error: { code: 'PASSWORD_MISMATCH', message: 'Le mot de passe et la confirmation ne correspondent pas' } }`

**Note securite — ne pas reveler l'existence de l'utilisateur :**
- Sur `/api/auth/get-security-question` : si user inexistant, retourner erreur generique (pas "utilisateur non trouve")
- Sur `/api/auth/reset-password` : si user inexistant, retourner la MEME erreur que mauvaise reponse (`INVALID_SECURITY_ANSWER`)

**Invalidation des sessions apres reset :**
```typescript
// Supprimer TOUTES les sessions de l'utilisateur
await fastify.db.delete(sessions).where(eq(sessions.userId, user.id));
```

**Logging :**
```typescript
await fastify.db.insert(operationLogs).values({
  timestamp: new Date(),
  level: 'info',
  source: 'auth',
  message: `Password reset for user: ${username}`,
  reason: 'password-reset',
  details: JSON.stringify({ userId: user.id, username }),
});
```

### Frontend — Pattern a suivre (identique login-form.tsx)

**Formulaire multi-etape dans un seul composant :**
- Etat `step` : 1 (username) ou 2 (question + reset)
- Phase 1 : TextInput username + Button "Continuer"
- Phase 2 : Text affichant la question + TextInput reponse + PasswordInput nouveau mdp + PasswordInput confirmation + Button "Reinitialiser"

**Pattern page (identique login-page.tsx) :**
```typescript
import { Container, Title, Paper } from '@mantine/core';
import { PasswordResetForm } from './password-reset-form';

export function PasswordResetPage() {
  return (
    <Container size={420} my={40}>
      <Title ta="center">Reinitialiser le mot de passe</Title>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <PasswordResetForm />
      </Paper>
    </Container>
  );
}
```

**Lien dans login-form.tsx :**
```typescript
import { Anchor } from '@mantine/core';
import { Link } from 'react-router';

// Ajouter apres le bouton "Se connecter" :
<Anchor component={Link} to="/forgot-password" size="sm" ta="center" mt="sm">
  Mot de passe oublie ?
</Anchor>
```

**Route dans router.tsx (route publique, hors AuthGuard) :**
```typescript
{ path: '/forgot-password', element: <PasswordResetPage /> }
```

### Middleware auth — Exclusions a ajouter dans app.ts

```typescript
// Ajouter ces routes aux exclusions du preHandler dans app.ts :
request.url.startsWith('/api/auth/get-security-question') ||
request.url.startsWith('/api/auth/reset-password')
```

### Schema JSON Fastify pour les endpoints

**POST /api/auth/get-security-question :**
```typescript
{
  schema: {
    body: {
      type: 'object',
      required: ['username'],
      properties: {
        username: { type: 'string', minLength: 3, maxLength: 50 },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              securityQuestion: { type: 'string' },
            },
          },
        },
      },
    },
  },
}
```

**POST /api/auth/reset-password :**
```typescript
{
  schema: {
    body: {
      type: 'object',
      required: ['username', 'securityAnswer', 'newPassword', 'newPasswordConfirm'],
      properties: {
        username: { type: 'string', minLength: 3, maxLength: 50 },
        securityAnswer: { type: 'string', minLength: 1 },
        newPassword: { type: 'string', minLength: 8, maxLength: 128 },
        newPasswordConfirm: { type: 'string', minLength: 8, maxLength: 128 },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
      },
    },
  },
}
```

### Hooks API a ajouter dans auth.api.ts

```typescript
// Types
interface GetSecurityQuestionRequest { username: string; }
interface GetSecurityQuestionResponse { data: { securityQuestion: string; }; }
interface ResetPasswordRequest {
  username: string;
  securityAnswer: string;
  newPassword: string;
  newPasswordConfirm: string;
}

// Hook 1 : Get security question
export function useGetSecurityQuestion() {
  return useMutation<GetSecurityQuestionResponse, ErrorResponse, GetSecurityQuestionRequest>({
    mutationFn: async (data) => {
      const response = await fetch(`${API_BASE}/get-security-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as GetSecurityQuestionResponse;
    },
  });
}

// Hook 2 : Reset password
export function useResetPassword() {
  return useMutation<{ data: { success: boolean } }, ErrorResponse, ResetPasswordRequest>({
    mutationFn: async (data) => {
      const response = await fetch(`${API_BASE}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      const json = await response.json();
      if (!response.ok) throw json as ErrorResponse;
      return json as { data: { success: boolean } };
    },
  });
}
```

### Intelligence de Story 1.4 — Lecons apprises

**Patterns etablis a reutiliser :**
- Formulaire Mantine Form avec `useForm` et validation `validate:`
- Hooks API dans `auth.api.ts` avec `useMutation` et pattern fetch + credentials: 'include'
- Toast notifications : `notifications.show({ title, message, color })`
- Pages auth : Container size={420} + Title + Paper withBorder (voir login-page.tsx)
- Routes publiques : ajoutees directement dans router.tsx hors AuthGuard/AppShell

**Problemes rencontres et solutions :**
- `tsconfig.json` doit exclure `src/**/*.test.ts` pour le build Docker — deja corrige
- Les response schemas Fastify doivent inclure TOUS les codes de retour utilises (200 + erreurs) sinon TypeScript erreur au build
- Les tests frontend qui utilisent des hooks TanStack Query doivent etre wrapes dans `QueryClientProvider`
- `window.history.pushState({}, '', '/')` dans `beforeEach` des tests router pour reset la location

**Fichiers crees/modifies par Story 1.4 :**
- `apps/web/src/features/auth/login-form.tsx` — Le modifier pour ajouter le lien "Mot de passe oublie ?"
- `apps/web/src/features/auth/login-page.tsx` — Pattern a copier pour password-reset-page.tsx
- `apps/web/src/api/auth.api.ts` — Ajouter les nouveaux hooks dedans
- `apps/web/src/router.tsx` — Ajouter la route /forgot-password
- `apps/server/src/routes/auth.ts` — Ajouter les 2 nouveaux endpoints dedans
- `apps/server/src/app.ts` — Ajouter les exclusions middleware auth

### Anti-patterns a eviter

- **NE PAS** creer une nouvelle table pour les tokens de reset — la verification se fait via question de securite, pas de token
- **NE PAS** reveler l'existence d'un utilisateur dans les messages d'erreur (`get-security-question` et `reset-password`)
- **NE PAS** oublier d'invalider TOUTES les sessions apres un reset reussi
- **NE PAS** oublier `credentials: 'include'` dans les fetch frontend
- **NE PAS** oublier d'ajouter les response schemas pour les codes d'erreur (400, 401) dans Fastify sinon le build Docker echouera
- **NE PAS** creer des fichiers test dans un dossier separe — tests co-localises (ex: `password-reset-form.test.tsx`)
- **NE PAS** oublier de wrapper les tests frontend dans `QueryClientProvider`
- **NE PAS** utiliser `any` — typer correctement toutes les interfaces

### Testing approach

**Tests backend (dans auth.test.ts) :**
- Test `get-security-question` avec user valide → retourne la question
- Test `get-security-question` avec user inexistant → retourne erreur generique
- Test `reset-password` avec reponse correcte → password mis a jour, sessions supprimees, log cree
- Test `reset-password` avec mauvaise reponse → erreur INVALID_SECURITY_ANSWER, password inchange
- Test `reset-password` avec user inexistant → meme erreur que mauvaise reponse
- Test `reset-password` avec password mismatch → erreur PASSWORD_MISMATCH
- Test `reset-password` avec password trop court → erreur validation (JSON Schema)
- Test que l'ancien password ne fonctionne plus apres reset
- Test que le nouveau password fonctionne apres reset

**Tests frontend :**
- Test rendering du PasswordResetForm (phase 1 visible)
- Test transition phase 1 → phase 2 apres saisie username
- Test validation client-side (password trop court, confirmation mismatch, reponse vide)
- Test affichage erreur API (mauvaise reponse, user inexistant)
- Test redirect vers /login apres succes
- Test lien "Mot de passe oublie ?" visible sur login-form

### References

- [Source: epics.md#Story-1.5] — User story, acceptance criteria
- [Source: architecture.md#Authentication-&-Security] — Sessions cookie, argon2, format API
- [Source: architecture.md#API-&-Communication-Patterns] — Format d'erreur normalise
- [Source: architecture.md#Naming-Patterns] — Conventions de nommage DB/API/Code
- [Source: architecture.md#Implementation-Patterns] — Tests co-localises, format API data/error
- [Source: 1-4-login-et-gestion-de-session.md#Dev-Agent-Record] — Lecons apprises, patterns etablis

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Tests frontend `getByLabelText` echouait car Mantine ajoute ` *` au label avec `required`. Corrige en utilisant `getByPlaceholderText` et regex.

### Completion Notes List

- Task 1 : Endpoint `POST /api/auth/get-security-question` implemente avec validation JSON Schema, retourne la question de securite ou erreur generique si user inexistant. 3 tests backend.
- Task 2 : Endpoint `POST /api/auth/reset-password` implemente avec verification argon2 de la reponse, hashage du nouveau mot de passe, invalidation de toutes les sessions, logging operation. 8 tests backend couvrant tous les cas (succes, mauvaise reponse, user inexistant, password mismatch, password trop court, login avec nouveau/ancien mdp, invalidation sessions, log).
- Task 3 : Routes publiques ajoutees dans app.ts (exclusion middleware auth).
- Task 4 : Hooks `useGetSecurityQuestion` et `useResetPassword` ajoutes dans auth.api.ts avec types TypeScript.
- Task 5 : Composant PasswordResetForm avec formulaire multi-etape (phase 1: username, phase 2: question + reponse + nouveau mdp), validation Mantine Form, gestion erreurs API via toast, redirection vers /login apres succes.
- Task 6 : PasswordResetPage cree, route /forgot-password ajoutee, lien "Mot de passe oublie ?" ajoute sur login-form.
- Task 7 : 9 tests frontend (rendering step 1, transition step 2, erreur user inexistant, validation username, validation password court, validation confirmation mismatch, lien retour login, flux complet step 2 succes + redirect, erreur mauvaise reponse step 2). Tous les tests existants passent (71 total : 45 server + 26 web).

### File List

**Nouveaux fichiers :**
- `apps/web/src/features/auth/password-reset-form.tsx` — Composant formulaire de reinitialisation multi-etape
- `apps/web/src/features/auth/password-reset-page.tsx` — Page de reinitialisation (container + PasswordResetForm)
- `apps/web/src/features/auth/password-reset-form.test.tsx` — Tests frontend du formulaire (9 tests)

**Fichiers modifies :**
- `apps/server/src/routes/auth.ts` — Ajout endpoints get-security-question et reset-password
- `apps/server/src/routes/auth.test.ts` — Ajout 12 tests backend (get-security-question + reset-password)
- `apps/server/src/app.ts` — Ajout exclusions middleware auth pour les nouvelles routes publiques
- `apps/web/src/api/auth.api.ts` — Ajout hooks useGetSecurityQuestion, useResetPassword + types
- `apps/web/src/features/auth/login-form.tsx` — Ajout lien "Mot de passe oublie ?" + imports Anchor/Link
- `apps/web/src/router.tsx` — Ajout route /forgot-password + import PasswordResetPage

## Change Log

- 2026-02-10 : Implementation complete Story 1.5 — Reinitialisation du mot de passe via question de securite, 2 endpoints backend, formulaire multi-etape frontend, 69 tests passent
- 2026-02-10 : Code review (Claude Opus 4.6) — 5 issues trouvees (3 HIGH, 2 MEDIUM). Corrections appliquees : accents francais ajoutes sur toutes les chaines UI (H3), 2 tests frontend manquants ajoutes (H1: happy path step 2, H2: erreur mauvaise reponse step 2), SELECT selectif dans reset-password (M2). M1 (enumeration username via get-security-question) documente comme compromis de design acceptable pour app homelab. 71 tests passent (45 server + 26 web).
