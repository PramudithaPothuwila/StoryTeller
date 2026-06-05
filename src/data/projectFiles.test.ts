import { describe, expect, it } from "vitest";
import { StoryEntity } from "../types";
import {
  applyTimelineEffectToProject,
  createBlankProject,
  createCustomItemType,
  createCustomLinkType,
  createStoryRelationship,
  createStoryEntity,
  findItemType,
  isRelationshipActiveAt,
  linkDirection,
  resolveRelationshipAt
} from "./story";
import {
  buildProjectFiles,
  parseEntityMarkdown,
  projectFromBundleFile,
  projectFromFiles,
  serializeEntityMarkdown
} from "./projectFiles";

describe("project file model", () => {
  it("creates the planned folder project files and restores the project", () => {
    const project = createProjectFixture();
    const files = buildProjectFiles(project);
    const restoredProject = projectFromFiles(files);

    expect(files["storyteller.project.json"]).toBeTruthy();
    expect(files["graph/relationships.json"]).toBeTruthy();
    expect(Object.keys(files).some((path) => path.startsWith("entities/character/"))).toBe(true);
    expect(JSON.parse(files["storyteller.project.json"]).schemaVersion).toBe(2);
    expect(Object.keys(restoredProject.entities)).toHaveLength(Object.keys(project.entities).length);
    expect(restoredProject.relationships).toHaveLength(project.relationships.length);
    expect(restoredProject.layout).toEqual(project.layout);
  });

  it("migrates v1 project files to schema v2 with built-in type catalogs", () => {
    const entity: StoryEntity = {
      id: "character-1",
      type: "character",
      title: "Ada",
      summary: "",
      tags: [],
      publicInfo: "",
      privateInfo: "Villain",
      bodyMarkdown: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const files = {
      "storyteller.project.json": JSON.stringify({
        schemaVersion: 1,
        title: "Legacy",
        updatedAt: "2026-01-01T00:00:00.000Z",
        graphLayout: { [entity.id]: { x: 1, y: 2 } },
        entityIndex: [
          {
            id: entity.id,
            type: entity.type,
            title: entity.title,
            updatedAt: entity.updatedAt,
            path: `entities/${entity.type}/${entity.id}.md`
          }
        ]
      }),
      "graph/relationships.json": JSON.stringify({
        schemaVersion: 1,
        relationships: []
      }),
      [`entities/${entity.type}/${entity.id}.md`]: serializeEntityMarkdown(entity)
    };

    const project = projectFromFiles(files);

    expect(project.schemaVersion).toBe(2);
    expect(project.itemTypes.some((type) => type.id === "character")).toBe(true);
    expect(project.linkTypes.some((type) => type.id === "relates_to")).toBe(true);
    expect(project.entities[entity.id].privateInfo).toBe("Villain");
  });

  it("round-trips custom item and link types through folder files and bundles", async () => {
    const customItemType = createCustomItemType("Prophecy");
    const customLinkType = {
      ...createCustomLinkType("Foreshadows"),
      direction: "mutual" as const
    };
    const project = createBlankProject("Custom Types");
    const entity = createStoryEntity(customItemType.id, [...project.itemTypes, customItemType], "The Red Moon");
    const relationship = {
      id: "link-custom",
      sourceId: entity.id,
      targetId: entity.id,
      type: customLinkType.id,
      label: customLinkType.label,
      notes: "",
      timelineVersions: []
    };
    const projectWithTypes = {
      ...project,
      itemTypes: [...project.itemTypes, customItemType],
      linkTypes: [...project.linkTypes, customLinkType],
      entities: { [entity.id]: entity },
      relationships: [relationship],
      layout: { [entity.id]: { x: 10, y: 20 } }
    };

    const files = buildProjectFiles(projectWithTypes);
    const restoredFromFiles = projectFromFiles(files);
    const restoredFromBundle = await projectFromBundleFile({
      text: async () =>
        JSON.stringify({
          kind: "storyteller.project.bundle",
          exportedAt: "2026-01-01T00:00:00.000Z",
          files
        })
    } as File);

    expect(findItemType(restoredFromFiles, customItemType.id).label).toBe("Prophecy");
    expect(linkDirection(restoredFromFiles, customLinkType.id)).toBe("mutual");
    expect(findItemType(restoredFromBundle, customItemType.id).label).toBe("Prophecy");
  });

  it("applies event relationship changes across timeline positions", () => {
    let project = createBlankProject("Timeline");
    const a = createStoryEntity("character", project.itemTypes, "A");
    const b = createStoryEntity("character", project.itemTypes, "B");
    const start = createStoryEntity("event", project.itemTypes, "Meet");
    const end = createStoryEntity("event", project.itemTypes, "Betrayal");
    const after = createStoryEntity("event", project.itemTypes, "Aftermath");
    start.timeline = { order: 1, effects: [] };
    end.timeline = { order: 2, effects: [] };
    after.timeline = { order: 3, effects: [] };
    project = {
      ...project,
      entities: {
        [a.id]: a,
        [b.id]: b,
        [start.id]: start,
        [end.id]: end,
        [after.id]: after
      }
    };
    const started = applyTimelineEffectToProject(project, start.id, {
      action: "start",
      sourceId: a.id,
      targetId: b.id,
      type: "knows",
      label: "Knows",
      notes: ""
    });
    const relationship = started.project.relationships[0];
    const ended = applyTimelineEffectToProject(started.project, end.id, {
      action: "end",
      relationshipId: relationship.id
    });
    const endedRelationship = ended.project.relationships[0];

    expect(isRelationshipActiveAt(ended.project, endedRelationship, start.id)).toBe(true);
    expect(isRelationshipActiveAt(ended.project, endedRelationship, end.id)).toBe(true);
    expect(isRelationshipActiveAt(ended.project, endedRelationship, after.id)).toBe(false);
    expect(isRelationshipActiveAt(ended.project, endedRelationship, "missing-event")).toBe(true);
  });

  it("resolves relationship versions for full and selected timeline states", () => {
    let project = createBlankProject("Timeline Versions");
    const a = createStoryEntity("character", project.itemTypes, "A");
    const b = createStoryEntity("character", project.itemTypes, "B");
    const start = createStoryEntity("event", project.itemTypes, "Meet");
    const update = createStoryEntity("event", project.itemTypes, "Trust");
    start.timeline = { order: 1, effects: [] };
    update.timeline = { order: 2, effects: [] };
    const relationship = {
      id: "link-versioned",
      sourceId: a.id,
      targetId: b.id,
      type: "hides",
      label: "Keeps secret",
      notes: "",
      startsAtEventId: start.id,
      timelineVersions: [
        {
          id: "version-trust",
          eventId: update.id,
          type: "protects",
          label: "Protects openly",
          notes: "The secret becomes a promise."
        }
      ]
    };
    project = {
      ...project,
      entities: {
        [a.id]: a,
        [b.id]: b,
        [start.id]: start,
        [update.id]: update
      },
      relationships: [relationship]
    };

    expect(resolveRelationshipAt(project, relationship, start.id).label).toBe("Keeps secret");
    expect(resolveRelationshipAt(project, relationship, update.id).label).toBe("Protects openly");
    expect(resolveRelationshipAt(project, relationship, null).label).toBe("Protects openly");
  });

  it("keeps private entity information out of markdown body text", () => {
    const entity = Object.values(createProjectFixture().entities).find((item) => item.privateInfo)!;
    const markdown = serializeEntityMarkdown(entity);
    const restoredEntity = parseEntityMarkdown(markdown);

    expect(restoredEntity.privateInfo).toBe(entity.privateInfo);
    expect(restoredEntity.bodyMarkdown).toBe(entity.bodyMarkdown);
  });

  it("raises a recoverable parsing error for invalid project files", () => {
    expect(() => projectFromFiles({})).toThrow(/storyteller\.project\.json/);
    expect(() =>
      projectFromFiles({
        "storyteller.project.json": "{not-json"
      })
    ).toThrow(/Could not parse project manifest/);
  });
});

function createProjectFixture() {
  const project = createBlankProject("Fixture Story");
  const hero = createStoryEntity("character", project.itemTypes, "Hero");
  const secret = createStoryEntity("item", project.itemTypes, "Secret");
  const relationship = createStoryRelationship(project, hero.id, secret.id, "owns");

  hero.privateInfo = "Secret heir";

  return {
    ...project,
    entities: {
      [hero.id]: hero,
      [secret.id]: secret
    },
    relationships: [relationship],
    layout: {
      [hero.id]: { x: 10, y: 20 },
      [secret.id]: { x: 300, y: 40 }
    }
  };
}
