# Story 2-5 : Page détail machine, modification & suppression

## Status: done

## Description
Permettre à l'utilisateur de cliquer sur une machine dans le tableau pour voir ses détails, modifier ses paramètres et la supprimer.

## Acceptance Criteria
- [x] API PUT /api/machines/:id permet de modifier une machine
- [x] API DELETE /api/machines/:id permet de supprimer une machine
- [x] Tests API passent pour PUT et DELETE
- [x] Page détail affiche les informations de la machine
- [x] Formulaire d'édition fonctionnel avec sauvegarde
- [x] Zone danger avec suppression + modal de confirmation
- [x] Navigation depuis le tableau vers la page détail
- [x] Gestion loading (skeleton) et 404

## Tasks
1. API — PUT /api/machines/:id + DELETE /api/machines/:id
2. Tests API — PUT + DELETE
3. Hooks frontend — useMachine, useUpdateMachine, useDeleteMachine
4. MachineDetailPage — page complète
5. Route + navigation depuis le tableau
