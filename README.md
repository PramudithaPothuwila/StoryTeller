# StoryTeller

StoryTeller is a local-first story planning workspace for mapping characters,
locations, items, events, notes, factions, and the relationships between them.
It uses an interactive graph for spatial story structure, an inspector for
editing details, and a timeline panel for seeing how relationships change across
events.

## Features

- Interactive story graph powered by React Flow.
- Built-in item types for characters, notes, locations, events, items, and
  factions.
- Built-in relationship types such as knows, hides, loves, opposes, owns,
  located in, causes, and member of.
- Project-level type manager for adding custom item and link types.
- Detail inspector for titles, summaries, tags, public notes, private notes, and
  Markdown body notes.
- Timeline events that can start, update, or end relationships.
- Folder-based project storage using readable Markdown entity files and JSON
  graph files.
- Single-file `.storyteller.json` backup export/import.
- Starter project included in `public/projects`.

## Tech Stack

- React 18
- TypeScript
- Vite
- React Flow (`@xyflow/react`)
- Lucide React icons
- Vitest and Testing Library

## Getting Started

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

Then open the local URL printed by Vite, usually:

```text
http://localhost:5173
```

## Scripts

```sh
npm run dev
```

Runs the Vite development server.

```sh
npm run build
```

Type-checks the project and creates a production build in `dist`.

```sh
npm run preview
```

Serves the production build locally.

```sh
npm test
```

Runs the Vitest test suite once.

## Project Storage

StoryTeller stores projects as folders when the browser supports the File System
Access API.

```text
storyteller.project.json
graph/
  relationships.json
entities/
  character/
    character-id.md
  event/
    event-id.md
```

The project manifest stores project metadata, item/link type definitions, graph
layout, and an entity index. Relationships live in `graph/relationships.json`.
Each entity is a Markdown file with JSON frontmatter followed by body notes.

Browsers without folder access can still open and save work through exported
`.storyteller.json` backup files. For folder projects, use a Chromium-based
browser on `localhost` or another secure context.

## Source Layout

```text
src/
  App.tsx                    Main workspace and graph orchestration
  components/
    Sidebar.tsx              Project actions, item creation, search
    DetailInspector.tsx      Entity, relationship, and event editing
    TimelinePanel.tsx        Event timeline navigation
    TypeManager.tsx          Custom item/link type management
  data/
    story.ts                 Project model helpers and timeline logic
    projectFiles.ts          Folder and backup import/export
    starterProject.ts        Starter project loader
  types.ts                   Shared project types
public/
  projects/                  Bundled starter project
```

## Development Notes

- Built-in item and link types are locked in the UI.
- Custom types can be deleted only when they are not in use.
- Event entities carry timeline order and relationship effects.
- Selecting a timeline event dims inactive relationships and resolves any
  relationship versions active at that point in the story.
- Project files currently use schema version `2`; older project shapes are
  migrated on load.

## Documentation

- [Agent-assisted story creation](docs/agent-story-creation.md)
