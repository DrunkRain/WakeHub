# Story 2-4 : Page machines et vue tabulaire

## Status: done

## Description
Afficher la liste des machines dans un tableau triable/filtrable avec vue responsive (table desktop, cards mobile).

## Acceptance Criteria
- [x] Page /machines avec tableau des machines
- [x] Colonnes : icône type, nom, statut (badge), plateforme, IP, dernière activité
- [x] Tri par colonnes (nom, statut, type, IP, updatedAt)
- [x] Filtres par statut et type (chips)
- [x] Vue mobile en cards
- [x] Vue tablet masque colonnes IP et activité
- [x] Empty state si aucune machine
- [x] Loading skeleton
- [x] Hook useMachinesTable pour logique tri/filtre
- [x] Bouton "Ajouter une machine" ouvre le wizard

## Implementation
- `apps/web/src/features/machines/machines-page.tsx`
- `apps/web/src/features/machines/machines-table.tsx`
- `apps/web/src/features/machines/machines-filters.tsx`
- `apps/web/src/features/machines/use-machines-table.ts`
- `apps/web/src/api/machines.api.ts` — `useMachines()`
