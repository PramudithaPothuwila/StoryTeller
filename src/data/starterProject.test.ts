import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUILT_IN_TRIGGER_LINK_TYPE_ID, BUILT_IN_WORLD_RULE_TYPE_ID } from "../types";
import { projectFromFiles } from "./projectFiles";
import { getGameContinuityIssues } from "./story";
import { DEFAULT_STARTER_PROJECT_ID, getStarterProjects, loadStarterProject } from "./starterProject";

describe("starter project loader", () => {
  it("loads a starter from public folder project files", async () => {
    const requestedUrls: string[] = [];
    const files: Record<string, string> = {
      "/projects/The Crown Beneath Glass/storyteller.project.json": JSON.stringify({
        schemaVersion: 2,
        title: "The Hidden Crown",
        updatedAt: "2026-06-05T10:00:00.000Z",
        itemTypes: [
          { id: "character", label: "Character", color: "#0f766e", icon: "users", builtIn: true },
          { id: "event", label: "Event", color: "#be123c", icon: "calendar-days", builtIn: true }
        ],
        linkTypes: [
          {
            id: "hides",
            label: "Hides",
            color: "#be123c",
            icon: "eye-off",
            direction: "directed",
            builtIn: true
          }
        ],
        graphLayout: {
          "character-mara-vale": { x: 120, y: 90 }
        },
        entityIndex: [
          {
            id: "character-mara-vale",
            type: "character",
            title: "Mara Vale",
            updatedAt: "2026-06-05T10:00:00.000Z",
            path: "entities/character/character-mara-vale.md"
          }
        ]
      }),
      "/projects/The Crown Beneath Glass/graph/relationships.json": JSON.stringify({
        schemaVersion: 2,
        relationships: []
      }),
      "/projects/The Crown Beneath Glass/entities/character/character-mara-vale.md": `---
{
  "id": "character-mara-vale",
  "type": "character",
  "title": "Mara Vale",
  "summary": "A courier with a name people keep recognizing before she does.",
  "tags": [],
  "publicInfo": "Known for crossing the city faster than any guild runner.",
  "privateInfo": "Carries the royal bloodline without knowing it.",
  "createdAt": "2026-06-05T10:00:00.000Z",
  "updatedAt": "2026-06-05T10:00:00.000Z"
}
---
`
    };
    const project = await loadStarterProject(async (url) => {
      const path = String(url);
      requestedUrls.push(path);
      const text = files[path];

      if (!text) {
        return {
          ok: false,
          status: 404,
          text: async () => ""
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        text: async () => text
      } as Response;
    }, DEFAULT_STARTER_PROJECT_ID);

    expect(project.title).toBe("The Hidden Crown");
    expect(Object.keys(project.entities)).toContain("character-mara-vale");
    expect(project.entities["character-mara-vale"].privateInfo).toBe("Carries the royal bloodline without knowing it.");
    expect(project.relationships).toHaveLength(0);
    expect(requestedUrls).toContain("/projects/The Crown Beneath Glass/storyteller.project.json");
    expect(requestedUrls).toContain("/projects/The Crown Beneath Glass/graph/relationships.json");
    expect(requestedUrls).toContain(
      "/projects/The Crown Beneath Glass/entities/character/character-mara-vale.md"
    );
  });

  it("bundles sample world rules with valid graph relationships", () => {
    const files = readBundledStarterProjectFiles();
    const project = projectFromFiles(files);
    const rules = Object.values(project.entities).filter((entity) => entity.type === BUILT_IN_WORLD_RULE_TYPE_ID);

    expect(rules.map((rule) => rule.title)).toEqual(
      expect.arrayContaining([
        "Memory Trade Is Final",
        "Blue Glass Anchors Storm Routes",
        "Ritual Speech Cannot Lie"
      ])
    );
    expect(project.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "world-rule-memory-trade-is-final",
          targetId: "location-bellwater-archive",
          type: "governs"
        }),
        expect.objectContaining({
          sourceId: "world-rule-memory-trade-is-final",
          targetId: "faction-mirror-guild",
          type: "known_by"
        }),
        expect.objectContaining({
          sourceId: "world-rule-blue-glass-anchors-storm-routes",
          targetId: "item-blue-glass-lantern",
          type: "governs"
        }),
        expect.objectContaining({
          sourceId: "world-rule-ritual-speech-cannot-lie",
          targetId: "faction-ember-choir",
          type: "known_by"
        })
      ])
    );
  });

  it("registers the Black Hollow game story starter", () => {
    const starters = getStarterProjects();
    const blackHollow = starters.find((starter) => starter.id === "black-hollow-last-stop");

    expect(blackHollow).toEqual(
      expect.objectContaining({
        title: "Black Hollow: Last Stop",
        root: "/projects/Black Hollow Last Stop",
        projectMode: "game_story"
      })
    );
  });

  it("bundles Black Hollow as a valid game story project", () => {
    const files = readBundledStarterProjectFiles("Black Hollow Last Stop");
    const project = projectFromFiles(files);

    expect(project.title).toBe("Black Hollow: Last Stop");
    expect(project.projectMode).toBe("game_story");
    expect(project.gameStory?.startNodeId).toBe("scene-murder-victim-found");
    expect(project.gameStory?.stateVariables.map((variable) => variable.id)).toEqual(
      expect.arrayContaining(["recognized-body-dump", "found-locker-key", "read-signal-ledger"])
    );
    expect(project.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "dialogue-confront-evelyn-park",
          targetId: "ending-true-route",
          type: "branches_to"
        }),
        expect.objectContaining({
          sourceId: "dialogue-confront-evelyn-park",
          targetId: "ending-false-frame",
          type: "branches_to"
        }),
        expect.objectContaining({
          sourceId: "event-murder-victim-found",
          targetId: "scene-murder-victim-found",
          type: BUILT_IN_TRIGGER_LINK_TYPE_ID
        }),
        expect.objectContaining({
          sourceId: "clue-signal-room-ledger",
          targetId: "dialogue-confront-evelyn-park",
          type: BUILT_IN_TRIGGER_LINK_TYPE_ID
        })
      ])
    );
    expect(project.entities["scene-murder-victim-found"].graphPresence).toBe("story_flow");
    expect(project.entities["item-locker-12-key"].graphPresence).toBe("world");
    expect(project.storyFlowLayout["scene-murder-victim-found"]).toEqual({ x: -720, y: 0 });
    expect(project.storyFlowLayout["item-locker-12-key"]).toBeUndefined();
    expect(getGameContinuityIssues(project)).toEqual([]);
  });
});

function readBundledStarterProjectFiles(starterFolder = "The Crown Beneath Glass"): Record<string, string> {
  const manifest = JSON.parse(readBundledStarterFile(starterFolder, "storyteller.project.json")) as {
    entityIndex: Array<{ path: string }>;
  };
  const files: Record<string, string> = {
    "storyteller.project.json": readBundledStarterFile(starterFolder, "storyteller.project.json"),
    "graph/relationships.json": readBundledStarterFile(starterFolder, "graph/relationships.json")
  };

  for (const indexedEntity of manifest.entityIndex) {
    files[indexedEntity.path] = readBundledStarterFile(starterFolder, indexedEntity.path);
  }

  return files;
}

function readBundledStarterFile(starterFolder: string, path: string): string {
  return readFileSync(join(process.cwd(), "public", "projects", starterFolder, path), "utf8");
}
