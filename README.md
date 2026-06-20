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
- Structured worldbuilding rulebook for tracking canon rules, domains, limits,
  exceptions, and story purpose.
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

Configure Supabase for cloud projects:

```sh
cp .env.example .env.local
```

Then set these values in `.env.local`:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
```

Use the Supabase publishable key for Vite/browser env files. Do not add a
secret or service-role key to the frontend.

Configure the cloud-only AI agent as Supabase function secrets:

```sh
supabase secrets set NVIDIA_API_KEY=nvapi_your-key
```

Optional backend-only overrides:

```sh
supabase secrets set NVIDIA_MODEL=meta/llama-3.2-1b-instruct
supabase secrets set NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
```

The Edge Function uses the OpenAI-compatible SDK client with `NVIDIA_BASE_URL`
pointing at NVIDIA's API.

For local Supabase, use the project-local CLI:

```sh
npx supabase status
```

Create a local function env file from the example:

```sh
cp supabase/.env.example supabase/.env.local
```

Then set `NVIDIA_API_KEY` in `supabase/.env.local` and serve functions with
that file:

```sh
npx supabase functions serve --env-file supabase/.env.local
```

The local agent function is served from:

```text
http://127.0.0.1:54321/functions/v1/agent
```

`npx supabase functions list` lists functions deployed to the linked Supabase
project, not local files. Locally, the function is discovered from
`supabase/functions/agent/index.ts`.

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
    RulebookSidebar.tsx      Worldbuilding rule browsing and editing
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
- World rule entities carry structured rulebook metadata in Markdown
  frontmatter.
- Selecting a timeline event dims inactive relationships and resolves any
  relationship versions active at that point in the story.
- Project files currently use schema version `5`; older project shapes are
  migrated on load.

## Documentation

- [Agent-assisted story creation](docs/agent-story-creation.md)
