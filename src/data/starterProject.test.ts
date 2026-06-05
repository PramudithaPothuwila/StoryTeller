import { describe, expect, it } from "vitest";
import { loadStarterProject } from "./starterProject";

describe("starter project loader", () => {
  it("loads a starter from public folder project files", async () => {
    const requestedUrls: string[] = [];
    const files: Record<string, string> = {
      "/projects/storyteller.project.json": JSON.stringify({
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
      "/projects/graph/relationships.json": JSON.stringify({
        schemaVersion: 2,
        relationships: []
      }),
      "/projects/entities/character/character-mara-vale.md": `---
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
    });

    expect(project.title).toBe("The Hidden Crown");
    expect(Object.keys(project.entities)).toContain("character-mara-vale");
    expect(project.entities["character-mara-vale"].privateInfo).toBe("Carries the royal bloodline without knowing it.");
    expect(project.relationships).toHaveLength(0);
    expect(requestedUrls).toContain("/projects/storyteller.project.json");
    expect(requestedUrls).toContain("/projects/graph/relationships.json");
    expect(requestedUrls).toContain("/projects/entities/character/character-mara-vale.md");
  });
});
