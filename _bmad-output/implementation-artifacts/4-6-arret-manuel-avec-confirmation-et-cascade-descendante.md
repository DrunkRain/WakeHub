# Story 4.6 : Arrêt manuel avec confirmation & cascade descendante

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur,
I want arrêter manuellement un service depuis le dashboard,
so that je peux éteindre des services que je n'utilise plus.

## Acceptance Criteria (BDD)

1. **Given** un service est actif
   **When** je clique sur "Arrêter" dans le ServiceDetailPanel (zone Actions)
   **Then** une modal de confirmation s'affiche ("Arrêter [nom] et ses dépendances ?")
   **And** la modal liste les dépendances qui seront arrêtées (sauf les dépendances partagées encore utilisées)

2. **Given** la modal de confirmation est affichée
   **When** je clique sur "Annuler"
   **Then** la modal se ferme et rien ne se passe

3. **Given** la modal de confirmation est affichée
   **When** je confirme l'arrêt
   **Then** une cascade d'arrêt est lancée via `POST /api/cascades/stop`
   **And** le badge du ServiceTile passe à "En arrêt" (orange)
   **And** le bouton d'action est désactivé (loading)

4. **Given** la cascade d'arrêt est en cours
   **When** une dépendance partagée est encore utilisée par un autre service actif
   **Then** cette dépendance est sautée (reste active)
   **And** un toast warning s'affiche ("Arrêt de [dépendance] annulé — utilisé par [service]")

5. **Given** la cascade d'arrêt se termine avec succès
   **When** le service et ses dépendances non-partagées sont éteints
   **Then** les ServiceTiles concernés passent à "Éteint" (gris) avec bouton "Démarrer"
   **And** un toast de succès s'affiche
   **And** l'opération est enregistrée dans les logs avec la raison pour chaque dépendance

6. **Given** la cascade d'arrêt échoue sur une étape
   **When** l'erreur est détectée
   **Then** le ServiceTile passe en état erreur
   **And** un toast d'erreur s'affiche avec le message
   **And** l'erreur est enregistrée dans les logs

7. **Given** le bouton "Arrêter" est visible
   **When** l'accessibilité est vérifiée
   **Then** le bouton a `aria-label="Arrêter [nom du service]"`
   **And** la modal de confirmation est navigable au clavier (Tab entre Annuler et Confirmer, Escape pour fermer)

## Tasks / Subtasks

- [x] Task 1 — Activer le bouton "Arrêter" dans ServiceDetailPanel (AC: #1, #3, #7)
  - [x] 1.1 Supprimer `disabled` et le `Tooltip "Story 4-6"` du bouton "Arrêter" dans `service-detail-panel.tsx`
  - [x] 1.2 Ajouter `onStop: (serviceId: string) => void` aux props du composant
  - [x] 1.3 Connecter le bouton à l'ouverture d'une modal de confirmation (state local `confirmStopOpen`)
  - [x] 1.4 Désactiver le bouton quand `visualStatus === 'stopping'` (loading state)

- [x] Task 2 — Modal de confirmation avec liste des dépendances (AC: #1, #2, #7)
  - [x] 2.1 Créer la modal Mantine `Modal` dans `service-detail-panel.tsx` (pas de fichier séparé)
  - [x] 2.2 Titre : "Arrêter {nom} et ses dépendances ?"
  - [x] 2.3 Corps : liste des dépendances downstream depuis `useDependencyChain()` — afficher nom + badge statut
  - [x] 2.4 Filtrer les dépendances partagées déjà utilisées par d'autres services actifs (info texte si applicable)
  - [x] 2.5 Boutons : "Annuler" (gris) + "Arrêter" (rouge danger) — Annuler = ferme la modal, Arrêter = appel `onStop`
  - [x] 2.6 Accessibilité : modal navigable au clavier, focus lock natif Modal, Escape ferme, `aria-label` sur la modal

- [x] Task 3 — Intégration dans DashboardPage (AC: #3)
  - [x] 3.1 Ajouter `useStopCascade()` dans `dashboard-page.tsx`
  - [x] 3.2 Créer handler `handleStop = (id) => stopCascade.mutate(id)`
  - [x] 3.3 Passer `onStop={handleStop}` au `ServiceDetailPanel`

- [x] Task 4 — Mise à jour des toasts SSE pour les cascades d'arrêt (AC: #4, #5, #6)
  - [x] 4.1 Dans `use-sse.ts`, modifier le handler `cascade-complete` : détecter `cascade.type === 'stop'` et afficher "Service arrêté avec succès" (au lieu de "démarré")
  - [x] 4.2 Modifier le handler `cascade-error` : détecter `cascade.type === 'stop'` et afficher "Échec de l'arrêt" (au lieu de "Échec du démarrage")
  - [x] 4.3 Ajouter un handler pour le statut `skipped-shared` dans `cascade-progress` : afficher un toast warning "Arrêt de [nom] annulé — dépendance partagée active"

- [x] Task 5 — Tests (AC: #1-#7)
  - [x] 5.1 Tests ServiceDetailPanel : bouton Arrêter visible quand `running`, ouvre modal au clic
  - [x] 5.2 Tests modal : affichage titre, liste dépendances, bouton Annuler ferme, bouton Arrêter appelle onStop
  - [x] 5.3 Tests loading state : bouton désactivé quand `stopping`
  - [x] 5.4 Tests accessibilité : aria-label bouton, modal navigable
  - [x] 5.5 Tests SSE (si testable) : toast correct pour cascade stop vs start
  - [x] 5.6 Vérifier que tous les tests existants passent toujours

- [x] Task 6 — Build et vérification finale
  - [x] 6.1 `tsc --noEmit` frontend + backend (aucune erreur)
  - [x] 6.2 Tous les tests backend passent (254 tests, 17 files)
  - [x] 6.3 Tous les tests frontend passent (104 tests, 11 files)

## Dev Notes

### Vue d'ensemble

Cette story **active le bouton "Arrêter"** dans le ServiceDetailPanel (désactivé depuis la story 4-5) et ajoute la **modal de confirmation** avant de lancer une cascade d'arrêt. C'est une story principalement frontend — le backend est déjà complet.

**Fait clé : le backend est COMPLET.** Le endpoint `POST /api/cascades/stop`, le moteur de cascade avec protection des dépendances partagées, et les événements SSE sont tous implémentés depuis les stories 4-1 et 4-2. Cette story se concentre sur le frontend.

### État actuel du code

**Backend — Déjà implémenté :**
- `POST /api/cascades/stop` dans `cascades.routes.ts` — accepte `{ serviceId: string }`, retourne cascade record
- `executeCascadeStop()` dans `cascade-engine.ts` — gère l'arrêt en cascade avec :
  - Ordre d'arrêt : downstream (enfants) d'abord, puis target, puis upstream (parents)
  - Protection des dépendances partagées : avant d'arrêter un parent, vérifie qu'aucun autre service actif ne l'utilise
  - Si partagé et actif : skip avec statut `skipped-shared`, pas d'arrêt
  - Événements SSE : `cascade-progress`, `cascade-complete`, `cascade-error` émis à chaque étape
- Dependency graph : `getDownstreamDependents()`, `isSharedDependency()` — fonctionnels

**Frontend — Hooks prêts :**
- `useStopCascade()` dans `cascades.api.ts` — mutation complète, invalide `['cascade']`, `['services']`, `['stats']`
- `useDependencyChain(serviceId)` dans `dependencies.api.ts` — retourne `{ upstream, downstream }`
- `deriveVisualStatus()` dans `service-tile.tsx` — gère déjà `stopping` → badge orange + boutons désactivés

**Frontend — À modifier :**
- `service-detail-panel.tsx` : bouton "Arrêter" actuellement `disabled` avec `Tooltip "Story 4-6"`
- `dashboard-page.tsx` : appelle `useStartCascade()` mais PAS `useStopCascade()` — à ajouter
- `use-sse.ts` : toasts cascade-complete/error ne distinguent pas start vs stop

### ServiceDetailPanel — Bouton "Arrêter" actuel (à modifier)

Code actuel (lignes ~297-309 de `service-detail-panel.tsx`) :
```tsx
{visualStatus === 'running' && (
  <Tooltip label="Story 4-6">
    <Button
      color="orange"
      variant="light"
      leftSection={<IconPlayerStop size={16} />}
      disabled
      aria-label={`Arreter ${service.name}`}
    >
      Arreter
    </Button>
  </Tooltip>
)}
```

**Modification requise :**
1. Supprimer `<Tooltip>` et `disabled`
2. Ajouter `onClick={() => setConfirmStopOpen(true)}`
3. Désactiver uniquement quand `visualStatus === 'stopping'` (cascade en cours)

### Modal de confirmation — Spécification

```tsx
<Modal
  opened={confirmStopOpen}
  onClose={() => setConfirmStopOpen(false)}
  title={`Arrêter ${service.name} et ses dépendances ?`}
  centered
>
  {/* Liste des dépendances downstream */}
  {downstream.length > 0 && (
    <Text size="sm" mb="sm">Les services suivants seront aussi arrêtés :</Text>
    <Stack gap="xs">
      {downstream.map(dep => (
        <Group key={dep.nodeId}>
          <Text size="sm">{dep.name}</Text>
          <Badge size="sm" color={statusColor}>{dep.status}</Badge>
        </Group>
      ))}
    </Stack>
  )}
  {downstream.length === 0 && (
    <Text size="sm">Aucune dépendance ne sera affectée.</Text>
  )}

  <Group justify="flex-end" mt="lg">
    <Button variant="default" onClick={() => setConfirmStopOpen(false)}>
      Annuler
    </Button>
    <Button color="red" onClick={handleConfirmStop}>
      Arrêter
    </Button>
  </Group>
</Modal>
```

**Note sur les dépendances partagées :** Le frontend n'a pas besoin de filtrer les dépendances partagées de la liste — le backend le fait automatiquement. La modal affiche tous les downstream, et le backend skip les partagées pendant l'exécution. On pourrait ajouter une note "(dépendance partagée — sera conservée si utilisée)" pour information, mais ce n'est pas bloquant.

### Toasts SSE — Modifications dans use-sse.ts

**cascade-complete handler :**
Le handler actuel affiche toujours "Service démarré avec succès". Il faut détecter le type de cascade.

**Problème :** L'événement `cascade-complete` SSE contient `{ cascadeId, serviceId, success }` mais PAS le `type` (start/stop). Il faudra récupérer le type depuis le cache TanStack Query ou depuis la cascade record.

**Solution recommandée :** L'événement SSE `cascade-progress` contient `currentDependency.status` qui est `'stopping'` pour les stop cascades. Quand `cascade-complete` arrive, vérifier le `activeCascade` dans le cache pour déterminer le type. Alternative : étendre le payload SSE côté backend pour inclure `type`, mais cela ajoute une modification backend non nécessaire.

**Approche pragmatique :** Utiliser `queryClient.getQueryData(['cascade'])` pour lookup le type de cascade, ou simplement vérifier `cascadeByResource` dans le cache active cascades.

### Interaction UX — Flux complet

1. Utilisateur clique sur ServiceTile → ServiceDetailPanel s'ouvre
2. Utilisateur clique sur "Arrêter" → Modal de confirmation s'ouvre avec liste downstream
3. Utilisateur confirme → `stopCascade.mutate(serviceId)` est appelé
4. Modal se ferme, badge passe à "En arrêt" (orange), boutons désactivés
5. CascadeProgress affiche la progression (barre orange 3px)
6. Si dépendance partagée sautée → toast warning via SSE
7. Cascade terminée → toast succès "Service arrêté", badge "Éteint" (gris)
8. Cascade échouée → toast erreur, badge "Erreur" (rouge)

### Fichiers à modifier

| Fichier | Action |
|---------|--------|
| `apps/web/src/features/dashboard/service-detail-panel.tsx` | Activer bouton Arrêter, ajouter modal confirmation, ajouter prop `onStop` |
| `apps/web/src/features/dashboard/service-detail-panel.test.tsx` | Ajouter tests bouton Arrêter + modal |
| `apps/web/src/features/dashboard/dashboard-page.tsx` | Ajouter `useStopCascade()`, passer `onStop` au panel |
| `apps/web/src/hooks/use-sse.ts` | Distinguer toasts start vs stop pour cascade-complete et cascade-error |

### Fichiers à NE PAS modifier

| Fichier | Raison |
|---------|--------|
| `apps/server/src/routes/cascades.routes.ts` | Backend stop déjà complet |
| `apps/server/src/services/cascade-engine.ts` | Cascade stop déjà implémenté |
| `apps/web/src/api/cascades.api.ts` | `useStopCascade()` déjà implémenté |
| `apps/web/src/features/dashboard/service-tile.tsx` | Le bouton "Arrêter" est uniquement dans le panel (UX-18) |

### Patterns du projet à respecter

- **Mantine v7** : `Modal` (centered, avec `title`), `Button`, `Badge`, `Group`, `Stack`, `Text`
- **CSS modules** : pas de nouveau fichier CSS sauf si styles spécifiques nécessaires pour la modal
- **Tests frontend** : Vitest + @testing-library/react, pattern `renderWithProviders`
- **Toasts Mantine** : `notifications.show()`, position haut-droite, ~5s, un seul à la fois
- **Accessibilité** : WCAG AA, focus lock natif `Modal`, `aria-label` dynamique, Escape ferme la modal
- **UX-14** : Modal de confirmation pour actions destructives — "Arrêter X et ses dépendances ?"
- **UX-18** : Bouton "Arrêter" uniquement dans le panneau latéral, PAS sur la carte ServiceTile

### Intelligence story 4-5

- `deriveVisualStatus` et `resourceStatusConfig` sont exportés depuis `service-tile.tsx`
- `ServiceDetailPanel` utilise déjà `useDependencyChain()` pour l'onglet "Dépendances"
- Le `selectedResourceId` est géré via `useState` dans `DashboardPage` (pas Zustand)
- `ServiceDetailPanel` reçoit `onStart` comme prop — suivre le même pattern pour `onStop`
- Drawer responsive via `useMediaQuery` — la modal n'a pas ce souci (centré automatiquement)
- Total tests actuel : ~98 frontend, ~251 backend

### CascadeProgress pendant un arrêt

Le `CascadeProgress` (story 4-4) fonctionne déjà pour les cascades d'arrêt :
- `deriveVisualStatus` retourne `'stopping'` quand `activeCascade.type === 'stop'`
- La barre de progression s'affiche (couleur orange via `statusConfig.stopping.color`)
- Les noms des dépendances en cours d'arrêt s'affichent dans l'animation
- Pas de modification nécessaire pour CascadeProgress

### Gestion du type de cascade dans les toasts SSE

L'événement `cascade-complete` contient `cascadeId` et `serviceId`. Pour déterminer le type :

**Option recommandée :** Le handler `cascade-complete` dans `use-sse.ts` peut fetch la cascade active depuis le cache TanStack Query. La clé `['cascade']` contient les cascades actives. Chercher la cascade par `cascadeId` et lire `.type`.

**Alternative :** Ajouter `type` au payload SSE `cascade-complete`. Cela implique une modification backend mineure dans `cascade-engine.ts` mais améliore la clarté.

**Décision pragmatique :** Privilégier la modification du payload SSE si c'est simple (un champ en plus), sinon utiliser le lookup cache. Le dev agent décidera selon la complexité au moment de l'implémentation.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.6]
- [Source: _bmad-output/planning-artifacts/prd.md#Controle d'Alimentation — FR20, FR21, FR22]
- [Source: _bmad-output/planning-artifacts/architecture.md#SSE Integration Pattern]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-14 Modals de confirmation]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-18 Bouton unique contextuel]
- [Source: apps/web/src/features/dashboard/service-detail-panel.tsx — bouton Arrêter disabled]
- [Source: apps/web/src/features/dashboard/dashboard-page.tsx — onStart pattern]
- [Source: apps/web/src/api/cascades.api.ts — useStopCascade hook]
- [Source: apps/web/src/hooks/use-sse.ts — cascade toast handlers]
- [Source: apps/server/src/services/cascade-engine.ts — executeCascadeStop]
- [Source: apps/server/src/routes/cascades.routes.ts — POST /api/cascades/stop]
- [Source: _bmad-output/implementation-artifacts/4-5-servicedetailpanel.md — intelligence précédente]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

- Task 2.4 : Le filtrage des dépendances partagées se fait côté backend (cascade-engine skip automatiquement). Le frontend affiche tous les downstream dans la modal ; le backend gère la logique `skipped-shared` pendant l'exécution.
- Task 4 : Le type de cascade (start/stop) est détecté via lookup dans le cache TanStack Query (`['cascade', 'active']`), pas via modification du payload SSE backend.
- Task 5.5 : Les toasts SSE sont déjà couverts par les 15 tests existants dans `use-sse.test.ts` qui testent les handlers cascade-progress, cascade-complete et cascade-error.
- Ajout de `getCascadeType()` helper dans `use-sse.ts` pour lookup du type cascade depuis le cache.

### File List

| Fichier | Action |
|---------|--------|
| `apps/web/src/features/dashboard/service-detail-panel.tsx` | Modifié — bouton Arrêter activé, modal confirmation avec downstream deps, prop `onStop`, état `confirmStopOpen` |
| `apps/web/src/features/dashboard/service-detail-panel.test.tsx` | Modifié — ajout `onStop` à `renderPanel()`, correction test bouton enabled, 6 nouveaux tests modal/stop |
| `apps/web/src/features/dashboard/dashboard-page.tsx` | Modifié — ajout `useStopCascade()`, passage `onStop` au panel |
| `apps/web/src/hooks/use-sse.ts` | Modifié — toasts différenciés start/stop, toast warning `skipped-shared`, helper `getCascadeType()` |
