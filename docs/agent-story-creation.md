# Agent-Assisted Story Creation With A Project Folder

This document is for an AI agent that does not have access to the StoryTeller
source code. The agent only needs access to a StoryTeller project folder and a
conversation with the user.

The project folder is the working story bible. The agent should use it to create
and revise story structure: characters, locations, items, factions, events,
notes, custom types, and the relationships between them.

## When To Use StoryTeller

Use StoryTeller when the user wants help with story planning that benefits from
persistent structure:

- Turning a loose premise into a connected story world.
- Mapping characters, factions, places, important objects, clues, and major
  events.
- Defining worldbuilding rules, limits, exceptions, and who knows or is governed
  by those rules.
- Tracking how relationships change across the timeline.
- Finding gaps, contradictions, missing motivations, or weak cause-and-effect.
- Comparing alternate plot directions without losing the current structure.
- Preparing a story bible for a novel, game, screenplay, campaign, comic, or
  serialized project.
- Revising an existing story where continuity matters.

Do not use the project folder for quick prose-only requests unless the user
wants the result saved as story canon or planning notes.

## Agent Role

The agent is a story-development partner, not the sole author. The user's
creative intent stays in charge. The agent can suggest structure, surface
patterns, ask clarifying questions, and draft options, but it should pause
before making major creative commitments such as killing a character, replacing
the genre, changing the theme, or resolving the central conflict.

Good agent behavior:

- Preserve the user's stated premise, tone, genre, and constraints.
- Ask targeted questions when a choice affects the whole story.
- Offer two or three distinct options when the user is exploring.
- Convert accepted decisions into project files.
- Keep public-facing facts separate from private author notes.
- Mark uncertain ideas as tentative instead of treating them as canon.
- Summarize folder changes after each meaningful round of work.

Avoid:

- Overwriting the user's ideas with a completely different story.
- Filling every ambiguity too early.
- Creating many low-value entities that clutter the graph.
- Editing project files without keeping indexes, links, and event effects in
  sync.

## Project Folder Contract

A StoryTeller project folder normally has this shape:

```text
storyteller.project.json
graph/
  relationships.json
entities/
  character/
    character-id.md
  event/
    event-id.md
  faction/
    faction-id.md
  item/
    item-id.md
  location/
    location-id.md
  note/
    note-id.md
```

Custom entity types may create additional folders under `entities/`, such as
`entities/clue/`.

The agent should treat these files as the source of truth:

- `storyteller.project.json`: project title, type catalogs, graph layout, and
  entity index.
- `graph/relationships.json`: all graph relationships.
- `entities/<type>/<id>.md`: one Markdown file per entity, with JSON
  frontmatter followed by body notes.

Use valid JSON. Do not add comments inside JSON files or JSON frontmatter.
Prefer two-space indentation and ISO timestamps, such as
`2026-06-06T10:30:00.000Z`.

## Manifest File

`storyteller.project.json` uses `schemaVersion: 2`.

Important fields:

- `title`: project title.
- `updatedAt`: ISO timestamp for the last project update.
- `itemTypes`: available entity types.
- `linkTypes`: available relationship types.
- `graphLayout`: map of entity IDs to graph coordinates.
- `entityIndex`: list of every entity file in the project.

When adding an entity, update all of these:

- Add the entity Markdown file.
- Add an `entityIndex` entry.
- Add a `graphLayout` entry.
- Update the manifest `updatedAt`.

Entity index entry format:

```json
{
  "id": "character-mara-vale",
  "type": "character",
  "title": "Mara Vale",
  "updatedAt": "2026-06-06T10:30:00.000Z",
  "path": "entities/character/character-mara-vale.md"
}
```

Graph layout entry format:

```json
"character-mara-vale": {
  "x": 120,
  "y": 100
}
```

## Entity Files

Each entity file is Markdown with JSON frontmatter:

```markdown
---
{
  "id": "character-mara-vale",
  "type": "character",
  "title": "Mara Vale",
  "summary": "A courier whose route book matches the missing royal astronomy logs.",
  "tags": [
    "protagonist",
    "heir"
  ],
  "publicInfo": "Known as the fastest bridge-runner in the Glass Quarter.",
  "privateInfo": "Her birthmark is a star map key.",
  "createdAt": "2026-06-06T10:30:00.000Z",
  "updatedAt": "2026-06-06T10:30:00.000Z"
}
---
## Wants
- Keep her family safe.
- Learn why strangers bow before they know her name.
```

Required entity metadata:

- `id`: unique kebab-case ID.
- `type`: must match an item type ID in the manifest.
- `title`: display name.
- `summary`: short description.
- `tags`: array of short labels.
- `publicInfo`: facts the audience or player may know.
- `privateInfo`: author-only secrets, twists, or future reveals.
- `createdAt`: ISO timestamp.
- `updatedAt`: ISO timestamp.

Event entities may also include `timeline` metadata:

```json
"timeline": {
  "order": 1,
  "effects": []
}
```

Use the Markdown body for richer planning notes: wants, fears, scene goals,
voice notes, clues, unresolved questions, revision concerns, or chapter beats.

## Built-In Entity Types

Use these defaults unless the existing project manifest defines a better custom
type:

- `character`: named people or viewpoint figures with motives.
- `location`: places that shape decisions, reveal history, or recur.
- `faction`: organizations, families, crews, institutions, cultures, or
  ideological groups.
- `item`: objects with ownership, symbolic weight, power, or plot utility.
- `event`: scenes, turning points, revelations, battles, promises, betrayals,
  discoveries, and consequences.
- `world_rule`: canon or tentative rules for magic, technology, culture,
  politics, religion, geography, economy, history, biology, or language.
- `note`: themes, act plans, open questions, tone references, rules,
  constraints, and unresolved decisions.

## Built-In Relationship Types

Use the relationship types already listed in the manifest. Common built-in IDs:

- `relates_to`
- `knows`
- `hides`
- `loves`
- `opposes`
- `owns`
- `located_in`
- `causes`
- `member_of`
- `governs`
- `known_by`
- `exception_to`

Custom link types may also exist, such as `protects`, `owes`, `betrays`, or
`decodes`. If a needed relationship type is missing, either use `relates_to` or
ask the user before adding a custom type to `linkTypes`.

World rule entities may include `worldRule` metadata in frontmatter:

```json
"worldRule": {
  "domain": "Magic",
  "status": "Canon",
  "statement": "Memory cannot be restored once willingly traded.",
  "reason": "Memory bargains rewrite the civic record and the self.",
  "limits": "Coerced theft can leave fragments.",
  "exceptions": "Charged objects can hold echoes.",
  "storyPurpose": "Keeps power costly and prevents easy reversals."
}
```

Use `governs` from a rule to the entity, item, location, faction, or event it
constrains. Use `known_by` from a rule to a character or faction that understands
it. Use `exception_to` from an exception rule to the broader rule it modifies.

## Relationship File

Relationships live in `graph/relationships.json`.

Basic format:

```json
{
  "schemaVersion": 2,
  "relationships": [
    {
      "id": "link-mara-crown",
      "sourceId": "character-mara-vale",
      "targetId": "item-hidden-crown",
      "type": "owns",
      "label": "Wakes the Crown",
      "notes": "The Crown responds because Mara asks instead of commands.",
      "startsAtEventId": "event-vault-awakening",
      "timelineVersions": []
    }
  ]
}
```

Relationship fields:

- `id`: unique relationship ID.
- `sourceId`: existing entity ID.
- `targetId`: existing entity ID.
- `type`: link type ID from the manifest.
- `label`: human-readable relationship label.
- `notes`: story meaning or continuity details.
- `startsAtEventId`: optional event ID where the relationship begins.
- `endsAtEventId`: optional event ID where the relationship ends.
- `timelineVersions`: array of changes to type, label, or notes over time.

Only create relationships that answer a story question:

- Who knows, loves, protects, owes, fears, serves, or opposes whom?
- Who owns, hides, seeks, decodes, broke, forged, or stole an item?
- Which event causes another event?
- Which character belongs to which faction?
- Which location contains an item, secret, faction, or conflict?
- Which relationship changes because of a specific event?

## Timeline Effects

Timeline effects connect event files to relationship changes. When an event
starts, updates, or ends a relationship, update both the event entity and the
relationship entry.

Start a relationship:

- Add the relationship to `graph/relationships.json`.
- Set `startsAtEventId` to the event ID.
- Add a matching `start` effect to the event entity's `timeline.effects`.

```json
{
  "id": "effect-vault-mara-owns-crown",
  "action": "start",
  "relationshipId": "link-mara-crown",
  "sourceId": "character-mara-vale",
  "targetId": "item-hidden-crown",
  "type": "owns",
  "label": "Wakes the Crown",
  "notes": "The Crown responds because Mara asks instead of commands."
}
```

Update a relationship:

- Add a `timelineVersions` entry to the relationship.
- Add a matching `update` effect to the event entity's `timeline.effects`.
- Update the relationship's current `type`, `label`, and `notes` if the new
  version is now the latest known state.

```json
{
  "id": "version-sable-trusts-mara",
  "eventId": "event-dockside-eclipse",
  "type": "knows",
  "label": "Trusts with a knife drawn",
  "notes": "Sable chooses to risk her escape route for Mara."
}
```

Matching event effect:

```json
{
  "id": "effect-dockside-sable-trusts-mara",
  "action": "update",
  "relationshipId": "link-mara-sable",
  "type": "knows",
  "label": "Trusts with a knife drawn",
  "notes": "Sable chooses to risk her escape route for Mara."
}
```

End a relationship:

- Set `endsAtEventId` on the relationship.
- Add an `end` effect to the event entity's `timeline.effects`.

```json
{
  "id": "effect-finale-end-accord-choir-opposition",
  "action": "end",
  "relationshipId": "link-ember-accord"
}
```

## Safe Editing Workflow

Use this workflow whenever modifying a project folder:

1. Read `storyteller.project.json`.
2. Read `graph/relationships.json`.
3. Read any relevant entity files from `entityIndex`.
4. Discuss creative choices with the user when the direction is unclear.
5. Make the smallest set of file changes that captures accepted decisions.
6. Keep IDs, paths, type IDs, relationship references, and timeline effects in
   sync.
7. Update `updatedAt` on changed entities and the project manifest.
8. Validate that every indexed entity file exists.
9. Validate that every relationship endpoint exists.
10. Summarize what changed and what still needs the user's judgment.

## Creating A New Story From A Blank Folder

If the folder is empty, create this minimal structure:

```text
storyteller.project.json
graph/
  relationships.json
entities/
```

Start with this manifest template and change the title and timestamp:

```json
{
  "schemaVersion": 2,
  "title": "Untitled Story",
  "updatedAt": "2026-06-06T10:30:00.000Z",
  "itemTypes": [
    {
      "id": "character",
      "label": "Character",
      "color": "#0f766e",
      "icon": "users",
      "builtIn": true
    },
    {
      "id": "note",
      "label": "Note",
      "color": "#b45309",
      "icon": "sticky-note",
      "builtIn": true
    },
    {
      "id": "location",
      "label": "Location",
      "color": "#2563eb",
      "icon": "map-pin",
      "builtIn": true
    },
    {
      "id": "event",
      "label": "Event",
      "color": "#be123c",
      "icon": "calendar-days",
      "builtIn": true
    },
    {
      "id": "item",
      "label": "Item",
      "color": "#7c3aed",
      "icon": "box",
      "builtIn": true
    },
    {
      "id": "faction",
      "label": "Faction",
      "color": "#15803d",
      "icon": "flag",
      "builtIn": true
    }
  ],
  "linkTypes": [
    {
      "id": "relates_to",
      "label": "Relates to",
      "color": "#46605a",
      "icon": "link",
      "direction": "directed",
      "builtIn": true
    },
    {
      "id": "knows",
      "label": "Knows",
      "color": "#0f766e",
      "icon": "users",
      "direction": "mutual",
      "builtIn": true
    },
    {
      "id": "hides",
      "label": "Hides",
      "color": "#be123c",
      "icon": "eye-off",
      "direction": "directed",
      "builtIn": true
    },
    {
      "id": "loves",
      "label": "Loves",
      "color": "#db2777",
      "icon": "heart",
      "direction": "mutual",
      "builtIn": true
    },
    {
      "id": "opposes",
      "label": "Opposes",
      "color": "#b91c1c",
      "icon": "swords",
      "direction": "directed",
      "builtIn": true
    },
    {
      "id": "owns",
      "label": "Owns",
      "color": "#7c3aed",
      "icon": "key",
      "direction": "directed",
      "builtIn": true
    },
    {
      "id": "located_in",
      "label": "Located in",
      "color": "#2563eb",
      "icon": "map-pin",
      "direction": "directed",
      "builtIn": true
    },
    {
      "id": "causes",
      "label": "Causes",
      "color": "#b45309",
      "icon": "git-branch",
      "direction": "directed",
      "builtIn": true
    },
    {
      "id": "member_of",
      "label": "Member of",
      "color": "#15803d",
      "icon": "flag",
      "direction": "directed",
      "builtIn": true
    }
  ],
  "graphLayout": {},
  "entityIndex": []
}
```

Create this empty relationship file:

```json
{
  "schemaVersion": 2,
  "relationships": []
}
```

Then ask the user for:

- Story format: novel, game, campaign, screenplay, comic, or other.
- Genre and tone.
- Core premise.
- Main character or viewpoint.
- Opposition or central pressure.
- Setting.
- Desired ending, if known.

Create only the first useful entities: a premise note, protagonist, opposition,
main location, and one to three major events. Expand after the user confirms the
direction.

## Useful Starting Questions

Ask only the questions needed for the current step:

- What kind of story are we building?
- What feeling should the reader or player have at the end?
- Who changes the most, and what do they believe at the start?
- What does the protagonist want before the story proves they need something
  else?
- Who benefits if nothing changes?
- What secret, object, place, or promise pulls the plot together?
- What event makes the old situation impossible to continue?
- Which relationship should hurt, surprise, or transform the audience?
- What should remain mysterious for now?

## Session Checklist

Before ending a story-building session, confirm:

- The user can name the current premise and direction.
- The graph contains the main active characters and forces.
- The timeline has the current major turning points.
- Important secrets or unresolved questions are saved as notes.
- Major agent-generated ideas are accepted, rejected, or marked tentative.
- The manifest, entity files, and relationship file are internally consistent.

## Example Agent Opening

```text
I can help build this as a StoryTeller project folder. I will keep the project
files in sync while we decide what belongs in the story. What kind of story are
you making, and what central conflict do you already know?
```
