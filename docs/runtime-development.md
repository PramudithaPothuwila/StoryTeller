# Runtime Development From A StoryTeller Runtime Bundle

This document is for engineers or agents building a game runtime without access
to the StoryTeller source code. The runtime should treat the exported
`.storyruntime.json` file as its only contract.

Core rule:

> The runtime engine decides what is true. AI narration decides how validated
> state is expressed.

Do not make the language model the story database. The runtime should load the
bundle, validate it, build deterministic indexes, evaluate state and story-flow
rules in code, and only then pass curated context to an AI narration or dialogue
adapter.

## Runtime Input

The only required input is a single JSON bundle exported from StoryTeller:

```text
<project-title>.storyruntime.json
```

The bundle is read-only runtime data. A runtime should not depend on the
StoryTeller authoring folder, React app, TypeScript types, Markdown entity
files, or project backup format.

At minimum, validate these fields before loading:

- `kind` must be `storyteller.runtime.bundle`.
- `schemaVersion` must be `1`.
- Required top-level collections must exist, even when empty.

## Bundle Shape

Current runtime schema version: `1`.

Compact shape reference:

```json
{
  "kind": "storyteller.runtime.bundle",
  "schemaVersion": 1,
  "exportedAt": "2026-06-21T10:30:00.000Z",
  "sourceProject": {
    "title": "Example Story",
    "schemaVersion": 6,
    "projectMode": "game_story",
    "updatedAt": "2026-06-21T10:00:00.000Z"
  },
  "manifest": {
    "startNodeId": "scene-opening",
    "startTimelineEventId": "event-arrival",
    "capabilities": [
      "semantic_graph",
      "timeline",
      "story_flow",
      "facts",
      "evidence",
      "character_profiles"
    ],
    "warningCount": 0,
    "errorCount": 0
  },
  "entities": [],
  "facts": [],
  "evidence": [],
  "relationships": [],
  "timeline": {
    "events": [],
    "relationshipAnchors": []
  },
  "storyFlow": {
    "startNodeId": "scene-opening",
    "nodes": [],
    "transitions": []
  },
  "characterProfiles": [],
  "validation": []
}
```

Optional fields may be absent or undefined. Arrays should be treated as empty
only when the schema explicitly allows an empty collection; missing required
top-level collections should be a load error.

## Runtime Collections

### Entities

`entities` are inspectable story objects: characters, locations, items, clues,
events, scenes, notes, factions, world rules, and custom entity types.

Each entity has:

- `id`: runtime ID, currently reused from the source authoring entity.
- `sourceId`: traceability ID back to the authoring project.
- `type`: entity type such as `character`, `item`, `clue`, `scene`, or custom
  IDs.
- `graphPresence`: `world`, `story_flow`, or `both`.
- `title`, `summary`, and `tags`.
- `visibleText`: player-safe public text.
- `authorHiddenText`: engine-only/private author material.
- `metadata`: structured world-rule or game-story metadata when available.

Runtime rule: player-facing UI and AI narration prompts may use `visibleText`.
They must not expose `authorHiddenText` unless deterministic game state says the
player has discovered it.

### Facts

`facts` are deterministic assertions compiled from authoring structures such as
world rules and relationships.

Each fact has:

- `id` and `sourceId`.
- `sourceKind`: `world_rule`, `relationship`, or `entity`.
- `subjectId`, `predicate`, optional `objectId`, and optional scalar `value`.
- `canonical`: whether this fact should be treated as canonical truth.
- `reliability`: numeric confidence supplied by the export.
- `visibleToPlayer`: whether the fact starts as player-visible.
- `notes`: runtime-private supporting notes.

Runtime rule: do not infer missing canonical truth from prose. If a fact is not
present, the runtime may present uncertainty, but it should not invent truth.

### Evidence

`evidence` records are discoverable clue/item records linked to facts where the
export can do so.

Each evidence record has:

- `id`, `sourceId`, and `entityId`.
- `title` and `evidenceType`.
- `supportsFactIds` and `contradictsFactIds`.
- `reliability`.
- `visibleText`, `authorHiddenText`, and `notes`.

Runtime rule: evidence can unlock player knowledge only through deterministic
runtime state. AI may describe discovered evidence, but it should not decide
whether evidence proves a fact.

### Relationships

`relationships` are semantic graph edges between runtime entities.

Each relationship has:

- `id` and `sourceId`.
- `sourceEntityId` and `targetEntityId`.
- `type`, `label`, and `notes`.
- Optional `startsAtEventId` and `endsAtEventId`.
- `timelineVersionEventIds` for event-anchored relationship changes.

Runtime rule: relationships are graph facts and context edges. If timeline
anchors exist, the runtime should evaluate whether the relationship is active
for the current story time before using it as current context.

### Timeline

`timeline` contains ordered story events and relationship state anchors.

`timeline.events` records:

- `id` and `sourceId`.
- `title`.
- `order` and `track`.
- `effects`, such as starting, updating, or ending relationships.

`timeline.relationshipAnchors` records:

- `relationshipId`.
- Optional `startsAtEventId` and `endsAtEventId`.
- `versionEventIds`.

Runtime rule: timeline ordering is deterministic. If the runtime supports story
time, it should use event order and relationship anchors to decide which
relationships and facts are active.

### Story Flow

`storyFlow` contains playable nodes and transitions for game-story projects.

Each node has:

- `id` and `sourceId`.
- `type`, `title`, `role`, and `status`.
- `criticalPath`.
- `entryConditions`.
- `exitEffects`.

Each transition has:

- `id` and `sourceId`.
- `sourceNodeId` and `targetNodeId`.
- `choiceText`.
- `requirements`.
- `effects`.
- `priority`.
- `notes`.

Runtime rule: transitions must be gated in code. Evaluate `requirements`
against the runtime state store, show only available choices or explain locked
ones according to product design, then apply `effects` deterministically when a
choice is committed.

### Character Profiles

`characterProfiles` provide character context for dialogue and narration.

Each profile has:

- `id` and `sourceId`.
- `title`, `summary`, and `publicInfo`.
- `authorHiddenText`.
- `relationshipIds`.

Runtime rule: character profiles are context inputs, not autonomous truth. A
dialogue system should combine the character profile with current facts,
evidence, player knowledge, and scene state before calling an AI model.

### Validation

`validation` contains build-time warnings and errors produced during export.

Each issue has:

- `id`.
- `severity`: `warning` or `error`.
- `title`.
- `details`.
- Optional `sourceId`.

Recommended load behavior:

- Reject bundles with validation issues of severity `error`.
- Surface `warning` issues in developer/debug tooling.
- Include validation counts from `manifest` in startup logs.

## Loading Workflow

Use this workflow in a runtime that has no StoryTeller code context:

1. Parse the `.storyruntime.json` file as JSON.
2. Validate `kind`, `schemaVersion`, and required top-level fields.
3. Reject unsupported schema versions.
4. Reject bundles with duplicate IDs inside each collection.
5. Build in-memory indexes:
   - entities by `id`
   - facts by `id`
   - evidence by `id` and `entityId`
   - relationships by `id`, source entity, and target entity
   - timeline events by `id`
   - story nodes by `id`
   - story transitions by `id` and source node
   - character profiles by `sourceId`
6. Validate references between collections.
7. Load or initialize runtime state.
8. Determine the start story node from `storyFlow.startNodeId` or
   `manifest.startNodeId`.
9. Assemble context from deterministic indexes before any AI call.

Treat `sourceId` as traceability only. It should help logs, debugging, tooling,
and error messages. It must not require access to StoryTeller authoring files.

## Runtime State

The exported bundle is static. The runtime owns mutable play state, such as:

- current story node
- current timeline position, if supported
- player inventory
- discovered evidence IDs
- player-known fact IDs
- game state variables
- visited node IDs
- relationship or reputation state
- transcript or recent dialogue memory

Store runtime state separately from `.storyruntime.json`. Do not mutate the
bundle.

## AI Context Boundary

AI can help express validated state, but it should not decide canonical state.

Before calling a model, build a context packet from deterministic runtime data:

- current node and scene text
- available entities in scope
- player-visible facts
- discovered evidence
- relevant active relationships
- character profile for the speaker
- hidden author material only when the engine permits it
- explicit response boundaries and forbidden reveals

The model output should be treated as presentation. The runtime should validate
player choices, state changes, reveals, and unlocks in code.

## Recommended Architecture

### Bundle Loader

Responsible for reading JSON, validating `kind` and `schemaVersion`, and
returning a raw bundle object.

### Schema Validator

Responsible for required fields, collection shapes, duplicate IDs, unsupported
versions, and cross-reference checks.

### Runtime State Store

Responsible for mutable playthrough state. It should be serializable separately
from the bundle so save files can survive runtime updates.

### Fact And Evidence Index

Responsible for querying facts, discovered evidence, fact support, and
contradictions represented in the bundle.

### Story-Flow Evaluator

Responsible for current node, available transitions, requirement checks,
effect application, and transition ordering.

### Character Context Builder

Responsible for assembling character-specific context for dialogue from
profiles, facts, relationships, player knowledge, and scene state.

### AI Narration Or Dialogue Adapter

Responsible for converting validated context into prompts and parsing model
responses. It should not directly mutate runtime state.

## Non-Goals

- Do not import StoryTeller React, TypeScript, or authoring code.
- Do not import StoryTeller project folders or `.storyteller.json` backups.
- Do not mutate `.storyruntime.json`.
- Do not use an LLM to decide truth, contradictions, transition availability,
  unlocks, inventory, or player knowledge.
- Do not require cloud services for baseline runtime loading.

## Minimal Runtime Startup Checklist

Before the first playable scene:

- Bundle `kind` and `schemaVersion` are supported.
- No validation errors are present.
- Required collections are loaded and indexed.
- Story start node exists when `story_flow` is supported.
- Every transition references existing story nodes.
- Every relationship references existing entities.
- Player-visible context excludes `authorHiddenText`.
- Runtime state has been initialized separately from the bundle.
