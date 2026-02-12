# Sprint Change Proposal — Comportement Uniforme pour Tous les Services

**Date :** 2026-02-11
**Declencheur :** Story 7-3 / 7-4 (Epic 7 — Refactoring Modele Unifie)
**Scope :** Minor — Implementation directe par l'equipe de dev

---

## 1. Resume du Probleme

Apres l'Epic 7 (unification machines+resources en une seule table `services`), le modele de donnees est unifie mais le **comportement du frontend et du connector factory** maintient des distinctions artificielles entre services parents (physical/proxmox/docker) et enfants (vm/container) :

1. **Page d'edition VMs/containers vide** — Le formulaire d'edition (nom, IP, MAC, SSH, URL service) n'est affiche que pour les services parents (`isParentService`). Les VMs/containers n'ont aucun champ editable.
2. **Dashboard restreint** — Seuls les VMs/containers ont le bouton "Demarrer", le suivi cascade et le panneau de detail clickable. Les services parents (physical/proxmox/docker) sont en display-only.
3. **Connector factory incomplet** — Les serveurs Proxmox et Docker hosts retournent `null` (pas de connector), empechant leur demarrage/arret via cascade. Or, ce sont des machines physiques qui peuvent etre controlees par WoL+SSH.

**Reference PRD :** Story 2.5 indique explicitement : *"L'administrateur peut modifier les parametres d'une machine, VM ou conteneur"*. Le comportement actuel est un ecart par rapport au PRD.

---

## 2. Analyse d'Impact

### Impact Epic

| Epic | Impact | Detail |
|------|--------|--------|
| Epic 7 (in-progress) | **Directe** | Ajout d'une story 7-5 pour finaliser l'unification comportementale |
| Epic 4 (in-progress) | Indirect | Le dashboard beneficiera automatiquement du changement |
| Epic 5-6 (backlog) | Aucun | Pas de modification necessaire |

### Impact Artefacts

| Artefact | Modification |
|----------|-------------|
| PRD | Aucune — le PRD attendait deja ce comportement |
| Architecture | Mise a jour du connector factory : proxmox/docker → WolSshConnector |
| UX Spec | Aucune — le design spec ne fait pas de distinction entre types |
| Epics | Ajout de Story 7.5 dans l'Epic 7 |

---

## 3. Approche Recommandee : Ajustement Direct

**Effort :** Low (3 fichiers + tests)
**Risque :** Low (le modele de donnees est deja unifie, seul le comportement doit suivre)

### Changements proposes

#### A. Frontend : `dashboard-page.tsx`

**Ancien :**
```tsx
const isChildService = (type: string) => type === 'vm' || type === 'container';
// ...
activeCascade={isChildService(service.type) ? ... : undefined}
onStart={isChildService(service.type) ? ... : undefined}
onTileClick={isChildService(service.type) ? ... : undefined}
```

**Nouveau :**
```tsx
// Suppression de isChildService — tous les services ont le meme comportement
activeCascade={cascadeByService.get(service.id)}
onStart={(id) => startCascade.mutate(id)}
onTileClick={setSelectedServiceId}
```

#### B. Frontend : `service-detail-page.tsx`

**Ancien :**
```tsx
{isParentService && (
  <Paper> {/* Formulaire d'edition */} </Paper>
)}
{isParentService && (
  <Paper> {/* Zone de suppression */} </Paper>
)}
```

**Nouveau :**
- Afficher les champs communs (nom, IP, MAC, SSH user, SSH password, URL service) pour **TOUS** les types
- Afficher les champs specifiques (API URL, API credentials) uniquement pour proxmox/docker
- Afficher le bouton supprimer pour **TOUS** les types
- Supprimer les gardes `isParentService` / `isChildService`

#### C. Backend : `connector-factory.ts`

**Ancien :**
```typescript
// proxmox/docker → return null (pas de connector)
return null;
```

**Nouveau :**
```typescript
// proxmox/docker avec MAC + IP + SSH → WolSshConnector (meme logique que physical)
if ((service.type === 'proxmox' || service.type === 'docker') &&
    service.macAddress && service.ipAddress && service.sshCredentialsEncrypted) {
  return new WolSshConnector({ ... });
}
return null;
```

**Rationale :** Un serveur Proxmox ou un Docker host est une machine physique. Si l'utilisateur fournit MAC + IP + SSH, il peut etre demarre via WoL et arrete via SSH, exactement comme un service `physical`.

---

## 4. Implementation Handoff

### Story proposee : 7-5 — Comportement Uniforme pour Tous les Services

**Fichiers a modifier :**
1. `apps/web/src/features/dashboard/dashboard-page.tsx` — Supprimer filtre `isChildService`
2. `apps/web/src/features/services/service-detail-page.tsx` — Formulaire d'edition pour tous les types
3. `apps/server/src/services/connector-factory.ts` — WolSshConnector pour proxmox/docker hosts
4. `apps/server/src/services/connector-factory.test.ts` — Tests mis a jour

**Scope :** Minor — Implementation directe
**Handoff :** Dev team (agent dev-story)
**Criteres de succes :**
- Tous les types de services ont les memes champs editables
- Tous les types de services peuvent etre demarres/arretes depuis le dashboard
- `tsc --noEmit` + 350 tests passent
- Aucune regression

---

## 5. Impact MVP

**Aucun impact negatif sur le MVP.** Ce changement aligne l'implementation avec les exigences PRD deja definies. Le MVP est enrichi par un comportement plus coherent et intuitif.
