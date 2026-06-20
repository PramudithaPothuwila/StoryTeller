# StoryTeller Schema Update Context

This context is for the next schema update after the model/runtime architecture discussion. The goal is to evolve the current StoryTeller project schema toward AI-ready runtime data while preserving the existing local-first authoring workflow.

## Current Repository State

- The active in-memory project schema is `STORY_PROJECT_SCHEMA_VERSION = 6` in `src/types.ts`.
- Core schema types are defined in `src/types.ts`.
- Default creation, normalization, migration, continuity checks, graph helpers, timeline helpers, and game-story helpers live in `src/data/story.ts`.
- Folder and bundle import/export live in `src/data/projectFiles.ts`.
- Starter projects live under `public/projects/*`.
- Starter manifests currently use `schemaVersion: 5`, but the app migrates them to v6 on load.
- `schemaVersion: 6` introduced game-story separation, story-flow layout, and `graph/gameplay-transitions.json`.

## Current Project Model Summary

`StoryProject` currently contains:

- `schemaVersion`
- `title`
- `updatedAt`
- `projectMode`
- `gameStory`
- `itemTypes`
- `linkTypes`
- `timelineLaneNames`
- `entities`
- `relationships`
- `gameplayTransitions`
- `designConstraints`
- `aiProposals`
- `layout`
- `storyFlowLayout`

`StoryEntity` currently contains:

- Basic identity and text fields: `id`, `type`, `title`, `summary`, `tags`, `publicInfo`, `privateInfo`, `bodyMarkdown`
- Graph visibility: `graphPresence`
- Timestamps
- Optional `timeline`
- Optional `worldRule`
- Optional `gameStory`

`StoryRelationship` currently contains:

- Source/target/type/label/notes
- Optional timeline anchors and timeline versions
- Optional legacy date fields
- Optional `gameStory`

## Core Architectural Rule

The schema should support this runtime rule:

> The engine decides what is true. The model decides how it is expressed.

Do not make the LLM the story database. The schema update should make canonical truth, character knowledge, player discovery, contradiction rules, and runtime visibility explicit enough for deterministic code to evaluate.

## Proposed Schema Direction

The next schema version should probably be `7`.

Schema v7 should introduce AI/runtime authoring structures without forcing all old projects to become AI runtime projects. Existing story and game-story projects must continue to load.

The schema should distinguish:

- Canonical facts: what is true in the story world.
- Character knowledge: what a character knows.
- Character beliefs: what a character thinks is true.
- Character statements: what a character has said or may say.
- Player discoveries: what the player has unlocked.
- Secrets: author/runtime-hidden facts with visibility rules.
- Evidence: discoverable proof that can support or contradict claims.
- Contradictions: deterministic conflict definitions and candidate indexes.
- Runtime dialogue rules: character voice, deception, disclosure, and response boundaries.
- AI provider settings: local-first model routing, fallback rules, and telemetry controls.

## Candidate New Top-Level Fields

Add optional top-level structures so old projects can migrate safely:

```ts
interface StoryProject {
  schemaVersion: typeof STORY_PROJECT_SCHEMA_VERSION;
  runtime?: RuntimeProjectMetadata;
  facts: Record<string, StoryFact>;
  evidence: Record<string, EvidenceRecord>;
  characterKnowledge: Record<string, CharacterKnowledgeProfile>;
  contradictionRules: ContradictionRule[];
  theoryRules: TheoryRule[];
}
```

These names are candidates. Prefer final names that match the codebase's existing style.

## Candidate Runtime Metadata

```ts
interface RuntimeProjectMetadata {
  enabled: boolean;
  startStoryTimeEventId?: string;
  defaultPlayerKnowledgeFactIds: string[];
  defaultDiscoveredEvidenceIds: string[];
  modelRouting: ModelRoutingSettings;
  validation: RuntimeValidationSettings;
}
```

Use this to keep AI/runtime concerns separate from general authoring.

## Candidate Fact Model

Facts should be structured records, not prose hidden in `privateInfo`.

```ts
interface StoryFact {
  id: string;
  subjectId: string;
  predicate: string;
  objectId?: string;
  value?: string | number | boolean;
  canonical: boolean;
  reliability: number;
  validFromEventId?: string;
  validUntilEventId?: string;
  sourceIds: string[];
  knownByCharacterIds: string[];
  believedByCharacterIds: string[];
  visibleToPlayerWhen: VisibilityCondition[];
  tags: string[];
  notes: string;
}
```

Design constraint: canonical truth, knowledge, belief, and visibility must not be collapsed into one text field.

## Candidate Evidence Model

There is currently a custom `clue` item type in at least one starter project. The schema update should decide whether to keep `clue` as a custom item type, formalize it as a built-in `evidence` type, or support both.

```ts
interface EvidenceRecord {
  id: string;
  entityId: string;
  supportsFactIds: string[];
  contradictsFactIds: string[];
  discoveredWhen: VisibilityCondition[];
  reliability: number;
  notes: string;
}
```

Recommendation: introduce `evidence` as a built-in type only if the UI will expose evidence-specific fields soon. Otherwise, keep the project entity flexible and add `evidence` metadata to entities whose type is `clue`, `item`, or future `evidence`.

## Candidate Character Runtime Metadata

Character AI behavior should be authorable but constrained.

```ts
interface CharacterRuntimeMetadata {
  goals: string[];
  attitude: number;
  emotionalState: string;
  communicationStyle: string;
  knownFactIds: string[];
  believedFactIds: string[];
  hiddenFactIds: string[];
  deceptionRules: DeceptionRule[];
  disclosureRules: DisclosureRule[];
}
```

This probably belongs as an optional field on `StoryEntity` for character entities:

```ts
interface StoryEntity {
  runtimeCharacter?: CharacterRuntimeMetadata;
}
```

## Candidate Deception Rule

```ts
interface DeceptionRule {
  id: string;
  condition: string;
  deceptionGoal: string;
  allowedStrategies: Array<"deny" | "deflect" | "minimize" | "partial_truth">;
  forbiddenFactIds: string[];
  revealWhenEvidenceIds: string[];
  notes: string;
}
```

The schema must distinguish intentional character lies from model hallucination.

## Candidate Contradiction Rule

```ts
type ContradictionType =
  | "direct_value_conflict"
  | "timeline_conflict"
  | "spatial_conflict"
  | "knowledge_conflict"
  | "evidence_conflict"
  | "relationship_conflict"
  | "behavioral_conflict"
  | "omission";

interface ContradictionRule {
  id: string;
  type: ContradictionType;
  factIds: string[];
  evidenceIds: string[];
  statementFactId?: string;
  severity: "weak" | "moderate" | "strong" | "decisive";
  unlocksFactIds: string[];
  notes: string;
}
```

The engine should evaluate these. The model may explain the result after validation.

## Candidate Model Routing Settings

Keep provider-specific details behind configuration and interfaces.

```ts
interface ModelRoutingSettings {
  dialogueModelId: string;
  intentModelId: string;
  embeddingModelId: string;
  rerankingModelId: string;
  fallbackModelId?: string;
  localFirst: boolean;
  cloudFallbackEnabled: boolean;
  fallbackReasons: FallbackReason[];
  contextTokenTarget: number;
}
```

Do not hard-code Qwen, Ollama, NVIDIA NIM, or any provider into the schema as required choices. Store model IDs or provider references as config values.

## Serialization Implications

If v7 adds top-level runtime files, update `src/data/projectFiles.ts`.

Possible folder layout:

```text
storyteller.project.json
graph/relationships.json
graph/gameplay-transitions.json
runtime/facts.json
runtime/evidence.json
runtime/character-knowledge.json
runtime/contradictions.json
runtime/theory-rules.json
entities/<type>/<id>.md
```

Keep the manifest small. Large runtime indexes should not be embedded directly in `storyteller.project.json` if they will grow.

## Migration Requirements

When moving to v7:

- Increment `STORY_PROJECT_SCHEMA_VERSION` in `src/types.ts`.
- Add v7 manifest/file interfaces in `src/data/projectFiles.ts`.
- Extend accepted manifest versions to include 7.
- Ensure v1-v6 projects migrate to v7 with empty/default runtime structures.
- Preserve `graphLayout` manifest naming unless deliberately renaming it. The in-memory field is `layout`.
- Preserve `storyFlowLayout`.
- Preserve old `relationships` and `gameplayTransitions` behavior.
- Do not require starter projects to be manually upgraded immediately unless tests need it.
- Add focused migration tests for v6 to v7.
- Add round-trip tests for any new runtime files.

## Tests To Add Or Update

Add or update tests in:

- `src/data/story.test.ts`
- `src/data/projectFiles.test.ts`
- `src/data/starterProject.test.ts` if starter project loading changes.
- `src/data/cloudProjects.test.ts` if cloud project migration or save metadata changes.

Minimum tests:

- `createBlankProject` returns schema v7 with empty runtime defaults.
- v6 project migrates to v7 with runtime fields present and no data loss.
- v7 folder export writes new runtime files.
- v7 folder import restores runtime files.
- v7 bundle export/import round-trips runtime files.
- Character runtime metadata normalizes only for character entities.
- Facts validate references only in deterministic validation code, not through model output.

## UI Implications

The schema can land before the full UI, but avoid adding fields that authors cannot eventually inspect or edit.

Likely first UI surfaces:

- Character runtime panel: goals, knowledge, beliefs, secrets, deception rules.
- Evidence/fact panel: canonical facts, supporting evidence, player visibility.
- Contradiction panel: defined conflicts and unlocks.
- Runtime settings panel: local-first model routing and fallback mode.

## Non-Goals For This Schema Pass

- Do not implement full AI runtime inference.
- Do not build vector search yet.
- Do not store generated embeddings in the authoring schema unless the export/build stage is ready.
- Do not force all `clue` entities to migrate to `evidence`.
- Do not evaluate player theories with model judgment.
- Do not silently introduce cloud-required behavior.

## Recommended First Implementation Slice

Implement v7 as a data-only schema expansion:

1. Add runtime/fact/evidence/contradiction/types in `src/types.ts`.
2. Add default and normalize helpers in `src/data/story.ts`.
3. Update `migrateProjectShape` to produce v7.
4. Update `projectFiles.ts` to read/write v7 runtime files.
5. Add round-trip and migration tests.
6. Leave UI fields for a follow-up unless the user explicitly asks for them in this pass.

This keeps the schema update small, testable, and aligned with the local-first AI runtime plan.
