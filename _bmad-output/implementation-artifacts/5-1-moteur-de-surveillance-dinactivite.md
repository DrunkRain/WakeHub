# Story 5.1 : Moteur de surveillance d'inactivité

Status: ready-for-dev

## Story

As a administrateur,
I want que WakeHub surveille l'activité de mes services et les éteigne automatiquement après un délai d'inactivité,
so that mon homelab ne consomme pas d'électricité inutilement.

## Acceptance Criteria (BDD)

1. **Given** la table `inactivity_rules` n'existe pas encore
   **When** la migration Drizzle s'exécute pour cette story
   **Then** la table `inactivity_rules` est créée avec les colonnes : id (UUID text PK), service_id (FK → services), timeout_minutes (integer, défaut 30), monitoring_criteria (text JSON), is_enabled (integer boolean, défaut 1/true), created_at (integer timestamp), updated_at (integer timestamp)
   **And** le délai d'inactivité par défaut (30 min) est géré comme valeur de fallback dans le code (constante `DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 30`)

2. **Given** le service `inactivity-monitor.ts` est implémenté
   **When** il est démarré avec le serveur Fastify
   **Then** il exécute une boucle de vérification périodique (toutes les 60 secondes) pour chaque service actif ayant une règle d'inactivité activée

3. **Given** un service actif a une règle d'inactivité configurée et activée
   **When** le moniteur vérifie l'activité
   **Then** il interroge le connecteur de la plateforme via `getStatus()` pour vérifier si le service est toujours en ligne
   **And** il consulte les critères de monitoring configurés (dernière activité connue, statut connecteur)
   **And** si aucune activité n'est détectée, il incrémente le temps d'inactivité pour ce service

4. **Given** un service est inactif depuis plus longtemps que son délai configuré
   **When** le délai est dépassé
   **Then** le moniteur déclenche automatiquement une cascade d'arrêt via `executeCascadeStop()` en interne
   **And** un événement SSE `auto-shutdown` est émis avec : serviceId, serviceName, inactivityMinutes
   **And** l'opération est enregistrée dans les logs avec la raison ("Arrêt automatique après X minutes d'inactivité")

5. **Given** un service a un délai d'inactivité personnalisé (table `inactivity_rules`)
   **When** le moniteur vérifie ce service
   **Then** il utilise le délai personnalisé au lieu du délai par défaut (30 min)

6. **Given** aucune règle personnalisée n'est définie pour un service
   **When** le moniteur vérifie ce service
   **Then** il ne déclenche PAS d'arrêt automatique (pas de monitoring par défaut — uniquement les services avec une règle activée)

7. **Given** de l'activité est détectée sur un service (statut change, cascade lancée, etc.)
   **When** le compteur d'inactivité est en cours
   **Then** le compteur est remis à zéro
   **And** l'arrêt automatique est annulé

8. **Given** un arrêt automatique est déclenché
   **When** une cascade d'arrêt est déjà en cours pour ce service
   **Then** le moniteur ne lance PAS une deuxième cascade
   **And** il log un message "Arrêt automatique ignoré — cascade déjà en cours"

9. **Given** un arrêt automatique est déclenché pour un service
   **When** un autre service actif dépend de ce service (dependant downstream actif)
   **Then** l'arrêt automatique est annulé
   **And** la raison est enregistrée dans les logs ("Arrêt automatique de [service] annulé — dépendant actif : [nom]")
   **And** un événement SSE `auto-shutdown` est émis avec `cancelled: true` et la raison

10. **Given** les routes API sont implémentées
    **When** `GET /api/inactivity-rules?serviceId=X` est appelé
    **Then** les règles d'inactivité pour ce service sont retournées
    **When** `POST /api/inactivity-rules` est appelé avec serviceId, timeoutMinutes, monitoringCriteria, isEnabled
    **Then** une règle est créée (une seule règle par service — upsert si déjà existante)
    **When** `PUT /api/inactivity-rules/:id` est appelé
    **Then** la règle est mise à jour (délai, critères, activation/désactivation)
    **When** `DELETE /api/inactivity-rules/:id` est appelé
    **Then** la règle est supprimée

11. **Given** le type SSE `auto-shutdown` est ajouté aux types partagés
    **When** un événement auto-shutdown est émis
    **Then** le frontend peut invalider les queries TanStack appropriées

## Tasks / Subtasks

- [ ] Task 1 — Migration DB : table `inactivity_rules` (AC: #1)
  - [ ] 1.1 Créer le fichier de migration SQL `drizzle/0008_inactivity_rules.sql`
  - [ ] 1.2 Ajouter le schéma `inactivityRules` dans `db/schema.ts`
  - [ ] 1.3 Mettre à jour `drizzle/meta/_journal.json` et créer le snapshot

- [ ] Task 2 — Types partagés (AC: #11)
  - [ ] 2.1 Ajouter `InactivityRule` type dans `packages/shared/src/index.ts`
  - [ ] 2.2 Ajouter `'auto-shutdown'` au type `SSEEventType`
  - [ ] 2.3 Ajouter `AutoShutdownEvent` type (serviceId, serviceName, inactivityMinutes, cancelled?, reason?)

- [ ] Task 3 — Service `inactivity-monitor.ts` (AC: #2, #3, #4, #5, #6, #7, #8, #9)
  - [ ] 3.1 Créer `apps/server/src/services/inactivity-monitor.ts`
  - [ ] 3.2 Implémenter la classe/module avec : `start(db, sseManager)`, `stop()`, `tick()` (un cycle de vérification)
  - [ ] 3.3 Implémenter la logique de tracking d'inactivité (Map en mémoire serviceId → firstInactiveAt)
  - [ ] 3.4 Implémenter la vérification des dépendants actifs avant arrêt (via dependency-graph)
  - [ ] 3.5 Implémenter la protection contre les cascades en double (vérifier cascades en cours dans la DB)
  - [ ] 3.6 Créer les tests `inactivity-monitor.test.ts`

- [ ] Task 4 — Routes API `inactivity-rules.routes.ts` (AC: #10)
  - [ ] 4.1 Créer `apps/server/src/routes/inactivity-rules.routes.ts`
  - [ ] 4.2 Implémenter GET /api/inactivity-rules (query param serviceId optionnel)
  - [ ] 4.3 Implémenter POST /api/inactivity-rules (création)
  - [ ] 4.4 Implémenter PUT /api/inactivity-rules/:id (mise à jour)
  - [ ] 4.5 Implémenter DELETE /api/inactivity-rules/:id (suppression)
  - [ ] 4.6 Créer les tests `inactivity-rules.routes.test.ts`

- [ ] Task 5 — Enregistrement dans app.ts et démarrage du moniteur (AC: #2)
  - [ ] 5.1 Importer et register les routes inactivity-rules dans `app.ts`
  - [ ] 5.2 Démarrer le moniteur d'inactivité après le démarrage du serveur
  - [ ] 5.3 Arrêter le moniteur proprement au shutdown du serveur (hook `onClose`)

- [ ] Task 6 — Vérification finale (AC: tous)
  - [ ] 6.1 `tsc --noEmit` server + web — zero erreur
  - [ ] 6.2 Tous les tests passent (server + web)
  - [ ] 6.3 Vérifier que les tests existants ne sont pas cassés

## Dev Notes

### Architecture du Moteur d'Inactivité

Le moteur d'inactivité est un service backend qui tourne en arrière-plan. Il ne fait PAS de polling réseau — il utilise les connecteurs existants (`getStatus()`) et un tracking en mémoire.

```
[setInterval 60s] → tick()
  → Pour chaque règle active (inactivity_rules WHERE is_enabled = 1) :
    1. Récupérer le service correspondant
    2. Si service.status !== 'online' → ignorer (rien à éteindre)
    3. Vérifier via getStatus() si le service est vraiment actif
    4. Si actif → reset le compteur d'inactivité
    5. Si inactif → vérifier si le temps cumulé dépasse timeout_minutes
    6. Si dépassé → vérifier qu'aucune cascade n'est déjà en cours
    7. Si dépassé → vérifier qu'aucun dépendant downstream n'est actif
    8. Si tout OK → lancer executeCascadeStop() + émettre SSE auto-shutdown
```

### Tracking d'Inactivité (en mémoire)

Utiliser une `Map<string, Date>` pour tracker le moment où chaque service a été détecté inactif pour la première fois :

```typescript
// Map<serviceId, firstInactiveAt>
private inactiveTimers = new Map<string, Date>();

// Quand le service est actif → supprimer du map (reset)
// Quand le service est inactif et PAS dans le map → ajouter maintenant
// Quand le service est inactif et DANS le map → vérifier si (now - firstInactiveAt) > timeout
```

**Avantage** : pas besoin de colonne `last_active_at` en DB, pas de writes fréquents. Le timer est volatil (reset au redémarrage du serveur), ce qui est acceptable — au pire, on repart à zéro sur le délai après un redémarrage.

### Fichiers Existants Critiques

| Fichier | Rôle pour cette story |
|---|---|
| `apps/server/src/db/schema.ts` | Ajouter table `inactivityRules`. Le champ `services.inactivityTimeout` existe déjà mais n'est PAS utilisé — la nouvelle table `inactivity_rules` le remplace avec plus de flexibilité |
| `apps/server/src/services/cascade-engine.ts` | Appeler `executeCascadeStop(db, cascadeId, serviceId, { sseManager })` pour déclencher l'arrêt |
| `apps/server/src/services/dependency-graph.ts` | Appeler `getDownstreamLogicalDependents(db, serviceId)` pour vérifier les dépendants actifs avant arrêt |
| `apps/server/src/sse/sse-manager.ts` | Appeler `sseManager.broadcast('auto-shutdown', data)` pour notifier le frontend |
| `apps/server/src/app.ts` | Register les nouvelles routes + démarrer le moniteur |
| `apps/server/src/connectors/connector.interface.ts` | Interface `PlatformConnector` avec `getStatus(): Promise<'online' \| 'offline' \| 'unknown' \| 'error'>` |
| `apps/server/src/services/connector-factory.ts` | `createConnectorForNode(db, 'service', serviceId)` pour obtenir le connecteur d'un service |
| `packages/shared/src/index.ts` | Ajouter types `InactivityRule`, `AutoShutdownEvent`, mettre à jour `SSEEventType` |

### Schéma DB — Table `inactivity_rules`

```sql
CREATE TABLE inactivity_rules (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  timeout_minutes INTEGER NOT NULL DEFAULT 30,
  monitoring_criteria TEXT DEFAULT '{}',
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_inactivity_rules_service_id ON inactivity_rules(service_id);
```

**Note** : Index UNIQUE sur `service_id` — une seule règle par service. Simplifie la logique et évite les conflits.

### Schéma Drizzle correspondant

```typescript
export const inactivityRules = sqliteTable('inactivity_rules', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  serviceId: text('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  timeoutMinutes: integer('timeout_minutes').notNull().default(30),
  monitoringCriteria: text('monitoring_criteria').default('{}'),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

### Monitoring Criteria JSON

Le champ `monitoring_criteria` est un JSON string qui décrit quels critères de surveillance sont actifs. Pour le MVP, seul le critère "dernière activité" (basé sur `getStatus()`) est implémenté :

```json
{
  "checkConnectorStatus": true
}
```

Les critères avancés (CPU/RAM, connexions réseau) seront ajoutés dans de futures itérations. Le champ est extensible par design.

### Pattern de Route (à suivre strictement)

```typescript
const inactivityRulesRoutes: FastifyPluginAsync = async (fastify) => {
  const errorSchema = {
    type: 'object',
    properties: {
      error: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
  };

  // GET /api/inactivity-rules?serviceId=xxx
  fastify.get('/api/inactivity-rules', {
    schema: {
      querystring: {
        type: 'object',
        properties: { serviceId: { type: 'string' } },
      },
      response: {
        200: { type: 'object', properties: { data: { type: 'array', items: { /* ... */ } } } },
        401: errorSchema,
      },
    },
  }, async (request, reply) => { /* ... */ });
};
```

**Règles :**
- Response schemas pour TOUS les status codes retournés (200, 400, 401, 404)
- Format `{ data: ... }` pour le succès, `{ error: { code, message } }` pour les erreurs
- Validation JSON Schema sur les body/querystring
- Auth middleware automatiquement appliqué (routes sous /api/)

### Pattern de Test (à suivre strictement)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../app';

describe('Inactivity Rules Routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp({ /* test config */ });
  });

  afterEach(async () => {
    await app.close();
  });

  it('should create an inactivity rule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/inactivity-rules',
      payload: { serviceId: '...', timeoutMinutes: 30, isEnabled: true },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.timeoutMinutes).toBe(30);
  });
});
```

### Protection contre les cascades en double

Avant de déclencher un arrêt automatique, le moniteur DOIT vérifier :

```typescript
// 1. Pas de cascade déjà en cours pour ce service
const activeCascade = db.select().from(cascades)
  .where(and(
    eq(cascades.serviceId, serviceId),
    inArray(cascades.status, ['pending', 'in_progress'])
  ))
  .get();

if (activeCascade) {
  // Log et skip
  return;
}

// 2. Pas de dépendant downstream actif
const dependents = getDownstreamLogicalDependents(db, serviceId);
const activeDependents = dependents.filter(d => {
  const svc = db.select().from(services).where(eq(services.id, d.nodeId)).get();
  return svc && svc.status === 'online';
});

if (activeDependents.length > 0) {
  // Log: "Arrêt annulé — dépendant actif : [nom]"
  // Émettre SSE auto-shutdown avec cancelled: true
  return;
}
```

### Opération de Logging

Source : `inactivity-monitor`. Event types :
- `auto-shutdown` : arrêt déclenché
- `decision` : arrêt annulé (raison)

```typescript
db.insert(operationLogs).values({
  timestamp: new Date(),
  level: 'info',
  source: 'inactivity-monitor',
  message: `Arrêt automatique de ${serviceName} après ${timeoutMinutes} minutes d'inactivité`,
  reason: 'inactivity-auto-shutdown',
  details: JSON.stringify({ serviceId, timeoutMinutes }),
}).run();
```

### Lifecycle du Moniteur dans app.ts

```typescript
// Dans buildApp() ou après app.listen():
const monitor = createInactivityMonitor(app.db, app.sseManager);
monitor.start();

// Cleanup au shutdown :
app.addHook('onClose', async () => {
  monitor.stop();
});
```

**Important** : Le moniteur doit être démarré APRÈS que le serveur soit prêt (pas pendant la phase de register des plugins). Utiliser le hook `onReady` ou démarrer après `app.listen()`.

### Événements SSE

```json
// Arrêt déclenché
{
  "event": "auto-shutdown",
  "data": {
    "serviceId": "uuid",
    "serviceName": "Jellyfin",
    "inactivityMinutes": 30,
    "cascadeId": "uuid"
  }
}

// Arrêt annulé
{
  "event": "auto-shutdown",
  "data": {
    "serviceId": "uuid",
    "serviceName": "VM-Storage",
    "cancelled": true,
    "reason": "Dépendant actif : qBittorrent"
  }
}
```

### Anti-patterns à Éviter

- **NE PAS** faire de polling réseau fréquent (ping, HTTP requests) — utiliser `getStatus()` du connecteur qui existe déjà
- **NE PAS** écrire en DB à chaque tick — le tracking est en mémoire (Map)
- **NE PAS** lancer une cascade si une est déjà en cours
- **NE PAS** arrêter un service si un de ses dépendants downstream est actif
- **NE PAS** créer un dossier `__tests__` séparé — tests co-localisés
- **NE PAS** utiliser `snake_case` dans le JSON API — utiliser `camelCase`
- **NE PAS** retourner des réponses API sans le wrapper `{ data }` ou `{ error }`

### Conventions de Nommage Rappel

| Contexte | Convention | Exemple |
|---|---|---|
| Table DB | snake_case, pluriel | `inactivity_rules` |
| Colonnes DB | snake_case | `service_id`, `timeout_minutes`, `is_enabled` |
| JSON API | camelCase | `serviceId`, `timeoutMinutes`, `isEnabled` |
| Fichiers | kebab-case | `inactivity-monitor.ts`, `inactivity-rules.routes.ts` |
| Types TS | PascalCase | `InactivityRule`, `InactivityMonitor` |
| Constantes | SCREAMING_SNAKE | `DEFAULT_INACTIVITY_TIMEOUT_MINUTES` |

### État Actuel du Projet

- **365 tests** passent (261 backend + 104 frontend)
- **tsc --noEmit** : zero erreur sur les 2 workspaces
- **DB** : 7 migrations existantes (`0000` à `0007`)
- **Prochaine migration** : `0008_inactivity_rules.sql`
- **Modèle unifié** : tout est un `Service` (physical, proxmox, docker, vm, container)

### Project Structure Notes

- Le moniteur d'inactivité va dans `apps/server/src/services/inactivity-monitor.ts` (même dossier que cascade-engine.ts et dependency-graph.ts)
- Les routes API vont dans `apps/server/src/routes/inactivity-rules.routes.ts`
- La migration va dans `apps/server/drizzle/0008_inactivity_rules.sql` (vérifier le numéro exact — il pourrait y avoir des migrations non-commitées)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns]
- [Source: _bmad-output/planning-artifacts/prd.md#FR29-FR34]
- [Source: apps/server/src/db/schema.ts — services.inactivityTimeout existant]
- [Source: apps/server/src/services/cascade-engine.ts — executeCascadeStop()]
- [Source: apps/server/src/services/dependency-graph.ts — getDownstreamLogicalDependents()]
- [Source: apps/server/src/services/connector-factory.ts — createConnectorForNode()]
- [Source: apps/server/src/sse/sse-manager.ts — broadcast()]
- [Source: apps/server/src/connectors/connector.interface.ts — PlatformConnector.getStatus()]
- [Source: _bmad-output/implementation-artifacts/7-5-comportement-uniforme-tous-services.md — patterns et tests count]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
