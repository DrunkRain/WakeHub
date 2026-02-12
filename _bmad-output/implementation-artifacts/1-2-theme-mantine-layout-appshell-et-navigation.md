# Story 1.2: Theme Mantine, layout AppShell & navigation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur,
I want voir une interface soignee avec une navigation claire,
So that je peux naviguer entre les pages de WakeHub.

## Acceptance Criteria

1. **Theme dark avec couleurs personnalisees**
   - Given j'ouvre WakeHub dans mon navigateur
   - When la page se charge
   - Then le theme dark est applique par defaut (fond `#1A1B1E`, accents bleu tech `#339AF0`)
   - And la police Inter est utilisee pour le texte courant et JetBrains Mono pour les elements techniques
   - And les couleurs de statut semantiques sont definies dans le theme (vert `#51CF66`, gris `#868E96`, jaune `#FCC419`, rouge `#FF6B6B`, orange `#FF922B`)

2. **AppShell et navigation desktop**
   - Given l'AppShell Mantine est configure
   - When la page se charge sur desktop (>=992px)
   - Then un header avec le logo WakeHub et la navigation principale est visible (Dashboard, Machines, Settings, Logs)
   - And la zone de contenu principale affiche la page courante

3. **Navigation mobile**
   - Given je suis sur mobile (<768px)
   - When je clique sur le menu hamburger
   - Then la navigation s'ouvre en overlay
   - And les cibles tactiles font minimum 44x44px

4. **Routing client-side**
   - Given React Router est configure
   - When je navigue vers une page (Dashboard, Machines, Settings, Logs)
   - Then la page correspondante s'affiche sans rechargement complet
   - And l'URL du navigateur est mise a jour

5. **Etats vides contextuels**
   - Given je navigue vers une page vide (aucune donnee)
   - When la page se charge
   - Then un message d'etat vide contextuel est affiche avec une icone
   - And un call-to-action est propose si applicable ("Ajoutez votre premiere machine")

6. **Skeleton loaders**
   - Given une page est en cours de chargement
   - When les donnees ne sont pas encore disponibles
   - Then des skeleton loaders reprenant la forme des elements attendus sont affiches
   - And aucun spinner generique plein ecran n'est utilise

7. **Accessibilite clavier**
   - Given je navigue au clavier
   - When je Tab entre les elements interactifs
   - Then un focus ring bleu (2px) est visible sur chaque element
   - And l'ordre de tabulation est logique (header → contenu)
   - And un skip link "Aller au contenu" est present en haut de page

8. **Systeme d'icones**
   - Given le systeme d'icones est configure
   - When je consulte l'interface
   - Then les icones Tabler Icons sont disponibles dans tous les composants

## Tasks / Subtasks

- [x] Task 1 : Installer les dependances manquantes (AC: #2, #4, #8)
  - [x] 1.1 Installer `react-router` (v7) dans apps/web
  - [x] 1.2 Installer `@tabler/icons-react` (v3.x) dans apps/web
  - [x] 1.3 Verifier la compatibilite des versions avec React 19 et Vite 7

- [x] Task 2 : Configurer le theme Mantine personnalise (AC: #1)
  - [x] 2.1 Creer `apps/web/src/theme/theme.ts` avec le theme dark WakeHub
  - [x] 2.2 Definir la palette de couleurs : primary blue `#339AF0`, fond `#1A1B1E`, cartes `#25262B`
  - [x] 2.3 Definir les couleurs semantiques de statut dans le theme (vert, gris, jaune, rouge, orange)
  - [x] 2.4 Configurer la typographie : Inter (principale) + JetBrains Mono (monospace)
  - [x] 2.5 Configurer le focus ring global (bleu 2px) et les styles globaux
  - [x] 2.6 Mettre a jour `main.tsx` pour utiliser le theme personnalise dans MantineProvider

- [x] Task 3 : Configurer React Router (AC: #4)
  - [x] 3.1 Creer `apps/web/src/router.tsx` avec les routes : `/` (Dashboard), `/machines` (Machines), `/settings` (Settings), `/logs` (Logs)
  - [x] 3.2 Creer les pages placeholder : `features/dashboard/dashboard-page.tsx`, `features/machines/machines-page.tsx`, `features/settings/settings-page.tsx`, `features/logs/logs-page.tsx`
  - [x] 3.3 Configurer le fallback route (404 → redirect vers Dashboard)
  - [x] 3.4 Integrer le router dans `App.tsx` avec `BrowserRouter` et `Routes`

- [x] Task 4 : Creer le layout AppShell (AC: #2, #3, #7)
  - [x] 4.1 Creer `apps/web/src/components/layout/app-shell.tsx` avec AppShell Mantine compound API
  - [x] 4.2 Creer `apps/web/src/components/layout/navigation.tsx` avec les NavLinks (Dashboard, Machines, Settings, Logs) et icones Tabler
  - [x] 4.3 Configurer le header avec logo WakeHub + burger menu mobile
  - [x] 4.4 Configurer le AppShell.Navbar collapsable pour mobile (overlay)
  - [x] 4.5 Ajouter le skip link "Aller au contenu" en haut de la page
  - [x] 4.6 Mettre a jour `index.html` pour changer le titre en "WakeHub"

- [x] Task 5 : Creer les pages avec etats vides (AC: #5, #6)
  - [x] 5.1 Creer un composant partage `apps/web/src/components/shared/empty-state.tsx` (icone + message + CTA optionnel)
  - [x] 5.2 Implementer la page Dashboard avec etat vide ("Ajoutez votre premiere machine" + bouton "+")
  - [x] 5.3 Implementer la page Machines avec etat vide ("Aucune machine configuree" + bouton vers wizard)
  - [x] 5.4 Implementer la page Settings avec contenu placeholder
  - [x] 5.5 Implementer la page Logs avec etat vide ("Aucun evenement enregistre")
  - [x] 5.6 Creer un composant skeleton loader de base pour les futures pages de donnees

- [x] Task 6 : Responsive et accessibilite (AC: #3, #7)
  - [x] 6.1 Tester et ajuster le layout responsive : desktop (>=992px), tablette (768-991px), mobile (<768px)
  - [x] 6.2 Verifier les cibles tactiles minimum 44x44px sur mobile
  - [x] 6.3 Verifier l'ordre de tabulation clavier (header → contenu)
  - [x] 6.4 Verifier le focus ring visible sur tous les elements interactifs
  - [x] 6.5 Ajouter les aria-labels sur les elements de navigation

- [x] Task 7 : Tests (AC: tous)
  - [x] 7.1 Creer un test pour le composant AppShell (rendu, navigation visible)
  - [x] 7.2 Creer un test pour la navigation (liens corrects, lien actif)
  - [x] 7.3 Creer un test pour le routeur (changement de page sans rechargement)

## Dev Notes

### Stack technique et versions — contexte Story 1.1

| Package | Version | Notes |
|---|---|---|
| React | ~19.2 | Deja installe. PropTypes/defaultProps supprimes |
| Mantine | ~7.17 | Deja installe. CSS Modules (pas CSS-in-JS). `createStyles` SUPPRIME |
| React Router | ~7.x | **A INSTALLER**. Importer depuis `react-router` (PAS `react-router-dom`). Data Routers |
| @tabler/icons-react | ~3.x | **A INSTALLER**. 5900+ icones. ESM-first |
| Vite | ~7.3 | Deja installe. Requiert Node 20.19+ |
| Vitest | ~4.x | Deja installe dans chaque workspace |
| PostCSS | — | Deja configure avec `postcss-preset-mantine` et `postcss-simple-vars` |

### Configuration Mantine v7 — points critiques

1. **PostCSS obligatoire** : deja configure dans story 1.1 (`postcss.config.mjs`)
2. **Pas de `createStyles`** : utiliser CSS Modules (`.module.css`) ou les props Mantine (`style`, `className`)
3. **AppShell compound API** : syntaxe `<AppShell.Header>`, `<AppShell.Navbar>`, `<AppShell.Main>`, etc.
4. **MantineProvider** : deja a la racine dans `main.tsx` — ajouter le theme custom
5. **Import** : `@mantine/core/styles.css` deja importe dans `main.tsx`

### React Router v7 — points critiques

1. **Import** : `import { BrowserRouter, Routes, Route, NavLink } from 'react-router'` — PAS depuis `react-router-dom`
2. **Data Routers** : v7 supporte les data routers mais pas requis pour cette story
3. **NavLink** : composant avec prop `className` recevant `({ isActive }) => ...` pour styler le lien actif

### Fichiers existants a modifier

- `apps/web/src/main.tsx` — Ajouter le theme custom au MantineProvider
- `apps/web/src/App.tsx` — Remplacer la page minimale par le layout AppShell + Router
- `apps/web/index.html` — Changer le `<title>` en "WakeHub"

### Fichiers a creer

```
apps/web/src/
├── theme/
│   └── theme.ts                     ← Theme Mantine dark personnalise
├── router.tsx                       ← Config React Router
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx            ← Layout AppShell Mantine
│   │   └── navigation.tsx           ← NavLinks avec icones Tabler
│   └── shared/
│       └── empty-state.tsx          ← Composant etat vide reutilisable
├── features/
│   ├── dashboard/
│   │   └── dashboard-page.tsx       ← Page Dashboard (etat vide)
│   ├── machines/
│   │   └── machines-page.tsx        ← Page Machines (etat vide)
│   ├── logs/
│   │   └── logs-page.tsx            ← Page Logs (etat vide)
│   └── settings/
│       └── settings-page.tsx        ← Page Settings (placeholder)
```

### Theme Mantine — specification complete

**Couleurs de fond (dark mode) :**
- Background principal : `#1A1B1E` (Mantine `dark.8`)
- Background cartes/navbar : `#25262B` (Mantine `dark.7`)
- Background eleve (hover) : `#2C2E33` (Mantine `dark.6`)

**Couleur principale :**
- Bleu tech : `#339AF0` (Mantine `blue.5`) — accent principal, liens, boutons primaires

**Couleurs semantiques de statut :**
- Actif / Succes : `#51CF66` (Mantine `green.5`)
- Eteint / Inactif : `#868E96` (Mantine `gray.6`)
- En demarrage / En cours : `#FCC419` (Mantine `yellow.5`)
- Erreur : `#FF6B6B` (Mantine `red.5`)
- En arret : `#FF922B` (Mantine `orange.5`)

**Typographie :**
- Police principale : Inter (sans-serif, defaut Mantine)
- Police monospace : JetBrains Mono (logs, IPs, noms techniques)
- Interligne : 1.55 (defaut Mantine)

**Espacements :**
- Gap entre cartes : `lg` (24px)
- Padding cartes : `md` (16px)
- Padding page : `xl` (32px) desktop, `md` (16px) mobile

### Layout AppShell — specification

**Structure :**
- Header : 60px, contient logo WakeHub + burger menu mobile
- Navbar : largeur desktop — via NavLinks dans le header (pas de sidebar separee, la navigation est dans le header)
- Main : zone de contenu avec padding

**Navigation principale (dans le header) :**
- Dashboard — icone `IconDashboard`
- Machines — icone `IconServer`
- Settings — icone `IconSettings`
- Logs — icone `IconFileText`

**Responsive :**
- Desktop (>=992px) : header avec navigation visible en ligne
- Tablette (768-991px) : header avec navigation visible (version compacte)
- Mobile (<768px) : burger menu dans le header, navigation en overlay (Navbar)

### Accessibilite — checklist

- [ ] Focus ring bleu 2px visible (`--mantine-primary-color-filled`)
- [ ] Skip link "Aller au contenu" (premier element focusable, masque visuellement sauf focus)
- [ ] `aria-label` sur le burger menu ("Ouvrir/Fermer la navigation")
- [ ] `aria-current="page"` sur le lien actif (natif NavLink React Router)
- [ ] Ordre de tabulation : skip link → header/nav → contenu principal
- [ ] Cibles tactiles minimum 44x44px pour NavLinks et burger

### Conventions de nommage (ARCH-17) — rappel

- **Fichiers** : `kebab-case` — `app-shell.tsx`, `dashboard-page.tsx`
- **Composants React** : PascalCase — `AppShell`, `DashboardPage`
- **Dossiers** : `kebab-case` — `features/dashboard/`, `components/layout/`

### Anti-patterns a eviter absolument

- **NE PAS** utiliser `createStyles` — supprime dans Mantine v7
- **NE PAS** importer depuis `react-router-dom` — v7 importe depuis `react-router`
- **NE PAS** creer une sidebar laterale — le design specifie un header avec navigation
- **NE PAS** utiliser de spinner generique plein ecran — skeleton loaders uniquement
- **NE PAS** hardcoder les couleurs — utiliser les tokens du theme Mantine
- **NE PAS** creer un dossier `__tests__/` — tests co-localises (`foo.test.tsx`)
- **NE PAS** nommer les fichiers en PascalCase — `kebab-case` pour les fichiers

### Intelligence de la story precedente (1.1)

**Enseignements de la story 1.1 :**
- Le monorepo npm workspaces fonctionne correctement (apps/web, apps/server, packages/shared)
- MantineProvider est deja en place dans `main.tsx` avec `defaultColorScheme="dark"`
- PostCSS est configure avec les plugins Mantine
- Vite proxy `/api` → `http://localhost:3000` est en place
- ESLint 9 flat config (pas v10) avec typescript-eslint, jsx-a11y, react-hooks
- Le build Docker fonctionne structurellement (DNS bloque en env de dev)
- `@mantine/core` et `@mantine/hooks` sont deja installes (v7.17)
- TypeScript strict est active (noUncheckedIndexedAccess, noUnusedLocals)

**Patterns etablis a suivre :**
- Tests co-localises : `foo.test.tsx` a cote de `foo.tsx`
- Configuration via export de fonction/objet (pattern Vite, ESLint, PostCSS)
- Imports TypeScript stricts (pas de `any`)

### Project Structure Notes

- Structure alignee avec l'architecture document `architecture.md` section "Organisation frontend par feature"
- Le dossier `features/` suit le pattern defini : dashboard, machines, logs, settings
- Le dossier `components/layout/` contient les composants de mise en page partages
- Le dossier `components/shared/` contient les composants reutilisables (empty-state, status-badge futur)
- Le theme est isole dans `theme/theme.ts` comme prevu par l'architecture

### References

- [Source: epics.md#Story-1.2] — Acceptance criteria et description de la story
- [Source: architecture.md#Frontend-Architecture] — TanStack Query + Zustand (futures stories)
- [Source: architecture.md#Implementation-Patterns] — Conventions de nommage, patterns de structure
- [Source: architecture.md#Complete-Project-Directory-Structure] — Arbre de fichiers frontend
- [Source: ux-design-specification.md#Design-System-Foundation] — Mantine v7+, PostCSS, theme dark
- [Source: ux-design-specification.md#Color-System] — Palette de couleurs complete
- [Source: ux-design-specification.md#Typography-System] — Inter + JetBrains Mono
- [Source: ux-design-specification.md#Design-Direction-Decision] — Layout AppShell, header navigation
- [Source: ux-design-specification.md#Responsive-Design-Accessibilite] — Breakpoints, WCAG AA, clavier
- [Source: ux-design-specification.md#Component-Strategy] — Composants Mantine, ServiceTile, StatsBar
- [Source: prd.md#Exigences-Non-Fonctionnelles] — Dashboard <15s, WCAG AA, navigation clavier
- [Source: 1-1-initialisation-du-projet-et-premier-demarrage.md] — Stack technique, patterns, learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

**Story 1.2 Implementation Complete - 2026-02-10**

All 7 tasks completed successfully:
- ✅ Task 1: Installed react-router@7.13.0 and @tabler/icons-react@3.36.1
- ✅ Task 2: Created custom Mantine theme with dark mode, semantic status colors, typography (Inter/JetBrains Mono), focus ring, and global styles
- ✅ Task 3: Configured React Router v7 with 4 routes (Dashboard, Machines, Settings, Logs) and fallback
- ✅ Task 4: Created AppShell layout with responsive header, collapsible navbar, skip link, and navigation component using Tabler icons
- ✅ Task 5: Created EmptyState and SkeletonLoader components, updated all pages with contextual empty states
- ✅ Task 6: Verified responsive layout (desktop/tablet/mobile), 44x44px touch targets, keyboard tab order, focus ring, and aria-labels
- ✅ Task 7: Created comprehensive tests for AppShell, Navigation, and Router (17 tests, all passing)

**Key Technical Implementations:**
- React Router v7 imported from 'react-router' (not react-router-dom)
- Mantine v7 AppShell compound API with responsive navbar collapse
- Custom theme with semantic colors: green (#51CF66), gray (#868E96), yellow (#FCC419), red (#FF6B6B), orange (#FF922B)
- Accessibility: focus ring, skip link, aria-labels, minimum touch targets, logical tab order
- Test setup with matchMedia mock and @testing-library/jest-dom for Mantine components

**Testing:**
- 17 tests passing (4 test files)
- AppShell: 5 tests (header, skip link, navigation, content, burger menu)
- Navigation: 5 tests (links, hrefs, active state, aria-current, icons)
- Router: 6 tests (page rendering, navigation, URL updates, active link marking)
- App: 1 trivial test

**Files Modified/Created:** 22 files total
- 13 source files (theme, router, pages, components, layouts)
- 4 test files (app-shell.test.tsx, navigation.test.tsx, router.test.tsx, test-setup.ts)
- 3 config/meta files (package.json, vitest.config.ts, index.html)
- 2 CSS modules (navigation.module.css)

All acceptance criteria met. Ready for code review.

### File List

- `apps/web/package.json` (modified - added react-router@7.13.0, @tabler/icons-react@3.36.1)
- `apps/web/src/theme/theme.ts` (created - custom Mantine theme with colors, typography, focus ring, component overrides)
- `apps/web/src/global.css` (created - Global CSS for skip link accessibility styles)
- `apps/web/src/main.tsx` (modified - imported custom theme and global.css)
- `apps/web/src/router.tsx` (created - React Router configuration with 4 routes and fallback)
- `apps/web/src/features/dashboard/dashboard-page.tsx` (created - Dashboard placeholder page)
- `apps/web/src/features/machines/machines-page.tsx` (created - Machines placeholder page)
- `apps/web/src/features/settings/settings-page.tsx` (created - Settings placeholder page)
- `apps/web/src/features/logs/logs-page.tsx` (created - Logs placeholder page)
- `apps/web/src/App.tsx` (modified - replaced placeholder with BrowserRouter and AppRoutes)
- `apps/web/src/components/layout/app-shell.tsx` (created - AppShell layout with header, navbar, main content, skip link)
- `apps/web/src/components/layout/navigation.tsx` (created - Navigation with NavLinks and Tabler icons)
- `apps/web/src/components/layout/navigation.module.css` (created - Navigation styles with active state and responsive)
- `apps/web/index.html` (modified - changed title from "web" to "WakeHub")
- `apps/web/src/router.tsx` (modified - wrapped Routes with AppShell)
- `apps/web/src/components/shared/empty-state.tsx` (created - Reusable empty state component with icon, title, description, optional CTA)
- `apps/web/src/components/shared/skeleton-loader.tsx` (created - Skeleton loader component for loading states)
- `apps/web/src/features/dashboard/dashboard-page.tsx` (modified - Added EmptyState with "Ajoutez votre première machine")
- `apps/web/src/features/machines/machines-page.tsx` (modified - Added EmptyState with "Aucune machine configurée")
- `apps/web/src/features/logs/logs-page.tsx` (modified - Added EmptyState with "Aucun événement enregistré")
- `apps/web/package.json` (modified - Added @testing-library/react, @testing-library/user-event, @testing-library/jest-dom)
- `apps/web/vitest.config.ts` (modified - Added setupFiles configuration for test setup)
- `apps/web/src/test-setup.ts` (created - Test setup with matchMedia mock and jest-dom matchers)
- `apps/web/src/components/layout/app-shell.test.tsx` (created - Tests for AppShell component: header, skip link, navigation, burger menu)
- `apps/web/src/components/layout/navigation.test.tsx` (created - Tests for Navigation component: links, hrefs, active state, icons)
- `apps/web/src/router.test.tsx` (created - Tests for Router: page rendering, navigation, URL updates, active link marking)
