import { describe, expect, it } from "vitest";
import { BUILT_IN_WORLD_RULE_TYPE_ID, StoryEntity } from "../types";
import {
  applyTimelineEffectToProject,
  addGameStateVariableToProject,
  createBlankProject,
  createCustomItemType,
  createCustomLinkType,
  createGameStateCondition,
  createStoryRelationship,
  createStoryEntity,
  deleteEntityFromProject,
  findItemType,
  isRelationshipActiveAt,
  linkDirection,
  resolveRelationshipAt,
  setProjectModeInProject,
  updateGameStateVariableInProject,
  updateGameStoryProjectMetadata
} from "./story";
import {
  buildProjectFiles,
  parseEntityMarkdown,
  projectFromBundleFile,
  projectFromFiles,
  readProjectFromDirectory,
  serializeEntityMarkdown,
  writeProjectToDirectory
} from "./projectFiles";

describe("project file model", () => {
  it("creates the planned folder project files and restores the project", () => {
    const project = createProjectFixture();
    const files = buildProjectFiles(project);
    const restoredProject = projectFromFiles(files);

    expect(files["storyteller.project.json"]).toBeTruthy();
    expect(files["graph/relationships.json"]).toBeTruthy();
    expect(Object.keys(files).some((path) => path.startsWith("entities/character/"))).toBe(true);
    expect(JSON.parse(files["storyteller.project.json"]).schemaVersion).toBe(3);
    expect(JSON.parse(files["storyteller.project.json"]).projectMode).toBe("story");
    expect(JSON.parse(files["storyteller.project.json"]).timelineLaneNames).toEqual(project.timelineLaneNames);
    expect(Object.keys(restoredProject.entities)).toHaveLength(Object.keys(project.entities).length);
    expect(restoredProject.relationships).toHaveLength(project.relationships.length);
    expect(restoredProject.layout).toEqual(project.layout);
    expect(restoredProject.timelineLaneNames).toEqual(project.timelineLaneNames);
  });

  it("migrates v1 project files to schema v3 with built-in type catalogs", () => {
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

    expect(project.schemaVersion).toBe(3);
    expect(project.projectMode).toBe("story");
    expect(project.itemTypes.some((type) => type.id === "character")).toBe(true);
    expect(project.linkTypes.some((type) => type.id === "relates_to")).toBe(true);
    expect(project.timelineLaneNames).toEqual(["Track 1"]);
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

  it("round-trips timeline lane names through folder files and bundles", async () => {
    const project = createBlankProject("Named Lanes");
    const event = createStoryEntity("event", project.itemTypes, "Parallel Scene");
    event.timeline = { order: 1, track: 1, effects: [] };
    const projectWithLanes = {
      ...project,
      timelineLaneNames: ["Main Plot", "Parallel Plot"],
      entities: {
        [event.id]: event
      }
    };

    const files = buildProjectFiles(projectWithLanes);
    const restoredFromFiles = projectFromFiles(files);
    const restoredFromBundle = await projectFromBundleFile({
      text: async () =>
        JSON.stringify({
          kind: "storyteller.project.bundle",
          exportedAt: "2026-01-01T00:00:00.000Z",
          files
        })
    } as File);

    expect(JSON.parse(files["storyteller.project.json"]).timelineLaneNames).toEqual(["Main Plot", "Parallel Plot"]);
    expect(restoredFromFiles.timelineLaneNames).toEqual(["Main Plot", "Parallel Plot"]);
    expect(restoredFromBundle.timelineLaneNames).toEqual(["Main Plot", "Parallel Plot"]);
  });

  it("round-trips structured world rule metadata through folder files and bundles", async () => {
    const project = createBlankProject("Rules");
    const rule = createStoryEntity(BUILT_IN_WORLD_RULE_TYPE_ID, project.itemTypes, "Memory Trade Is Final");
    rule.worldRule = {
      domain: "Magic",
      status: "Canon",
      statement: "A willingly traded memory cannot be restored.",
      reason: "Memory exchange rewrites the owner and the civic record.",
      limits: "Coerced theft leaves fragments.",
      exceptions: "Charged objects can hold echoes.",
      storyPurpose: "Keeps memory magic costly."
    };
    const projectWithRule = {
      ...project,
      entities: {
        [rule.id]: rule
      },
      layout: {
        [rule.id]: { x: 10, y: 20 }
      }
    };

    const files = buildProjectFiles(projectWithRule);
    const restoredFromFiles = projectFromFiles(files);
    const restoredFromBundle = await projectFromBundleFile({
      text: async () =>
        JSON.stringify({
          kind: "storyteller.project.bundle",
          exportedAt: "2026-01-01T00:00:00.000Z",
          files
        })
    } as File);

    expect(files[`entities/${BUILT_IN_WORLD_RULE_TYPE_ID}/${rule.id}.md`]).toContain('"worldRule"');
    expect(restoredFromFiles.entities[rule.id].worldRule).toEqual(rule.worldRule);
    expect(restoredFromBundle.entities[rule.id].worldRule).toEqual(rule.worldRule);
  });

  it("round-trips schema v3 game story metadata through folder files and bundles", async () => {
    let project = setProjectModeInProject(createBlankProject("Branching Game"), "game_story");
    project = addGameStateVariableToProject(project, "flag");
    const variable = project.gameStory!.stateVariables[0];
    project = updateGameStateVariableInProject(project, variable.id, {
      id: "met-ally",
      label: "Met Ally",
      defaultValue: false
    });
    const start = createStoryEntity("dialogue", project.itemTypes, "Meet the Ally");
    const ending = createStoryEntity("ending", project.itemTypes, "Alliance Ending");
    start.gameStory!.dialogue!.responses = [
      {
        id: "response-accept",
        text: "Accept the offer",
        targetNodeId: ending.id,
        conditions: [{ ...createGameStateCondition("met-ally"), value: false }],
        effects: [],
        notes: "Locks the alliance route."
      }
    ];
    const relationship = {
      ...createStoryRelationship(project, start.id, ending.id, "branches_to"),
      gameStory: {
        choiceText: "Accept the offer",
        requirements: [],
        effects: [],
        consequenceNotes: "The ally joins the finale.",
        priority: 1
      }
    };
    project = updateGameStoryProjectMetadata(
      {
        ...project,
        entities: {
          [start.id]: start,
          [ending.id]: ending
        },
        relationships: [relationship],
        layout: {
          [start.id]: { x: 10, y: 20 },
          [ending.id]: { x: 300, y: 20 }
        }
      },
      { startNodeId: start.id }
    );

    const files = buildProjectFiles(project);
    const restoredFromFiles = projectFromFiles(files);
    const restoredFromBundle = await projectFromBundleFile({
      text: async () =>
        JSON.stringify({
          kind: "storyteller.project.bundle",
          exportedAt: "2026-01-01T00:00:00.000Z",
          files
        })
    } as File);
    const manifest = JSON.parse(files["storyteller.project.json"]);

    expect(manifest.schemaVersion).toBe(3);
    expect(manifest.projectMode).toBe("game_story");
    expect(manifest.gameStory.startNodeId).toBe(start.id);
    expect(restoredFromFiles.gameStory?.stateVariables[0].id).toBe("met-ally");
    expect(restoredFromFiles.entities[start.id].gameStory?.dialogue?.responses[0].targetNodeId).toBe(ending.id);
    expect(restoredFromFiles.relationships[0].gameStory?.choiceText).toBe("Accept the offer");
    expect(restoredFromBundle.projectMode).toBe("game_story");
  });

  it("removes stale entity markdown files when saving a folder project", async () => {
    const project = createProjectFixture();
    const directory = createMemoryDirectoryHandle();
    const deletedEntity = Object.values(project.entities).find((entity) => entity.type === "item")!;
    const deletedPath = `entities/${deletedEntity.type}/${deletedEntity.id}.md`;

    await writeProjectToDirectory(project, directory.handle);

    expect(directory.hasFile(deletedPath)).toBe(true);

    const nextProject = deleteEntityFromProject(project, deletedEntity.id);
    await writeProjectToDirectory(nextProject, directory.handle);

    const savedManifest = JSON.parse(directory.readFile("storyteller.project.json")) as {
      entityIndex: Array<{ id: string; path: string }>;
    };
    const restoredProject = await readProjectFromDirectory(directory.handle);

    expect(directory.hasFile(deletedPath)).toBe(false);
    expect(savedManifest.entityIndex).not.toContainEqual(expect.objectContaining({ id: deletedEntity.id }));
    expect(restoredProject.entities[deletedEntity.id]).toBeUndefined();
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

type MemoryDirectoryEntry = string | Map<string, MemoryDirectoryEntry>;

function createMemoryDirectoryHandle() {
  const root = new Map<string, MemoryDirectoryEntry>();

  return {
    handle: directoryHandle(root),
    hasFile: (path: string) => typeof entryAtPath(root, path) === "string",
    readFile: (path: string) => {
      const entry = entryAtPath(root, path);

      if (typeof entry !== "string") {
        throw fileSystemError("NotFoundError", `File not found: ${path}`);
      }

      return entry;
    }
  };
}

function directoryHandle(entries: Map<string, MemoryDirectoryEntry>): FileSystemDirectoryHandle {
  return {
    getDirectoryHandle: async (name: string, options?: { create?: boolean }) => {
      const entry = entries.get(name);

      if (entry instanceof Map) {
        return directoryHandle(entry);
      }

      if (entry === undefined && options?.create) {
        const nextDirectory = new Map<string, MemoryDirectoryEntry>();
        entries.set(name, nextDirectory);

        return directoryHandle(nextDirectory);
      }

      throw fileSystemError("NotFoundError", `Directory not found: ${name}`);
    },
    getFileHandle: async (name: string, options?: { create?: boolean }) => {
      const entry = entries.get(name);

      if (typeof entry === "string") {
        return fileHandle(entries, name);
      }

      if (entry === undefined && options?.create) {
        entries.set(name, "");

        return fileHandle(entries, name);
      }

      throw fileSystemError("NotFoundError", `File not found: ${name}`);
    },
    removeEntry: async (name: string) => {
      const entry = entries.get(name);

      if (entry === undefined) {
        throw fileSystemError("NotFoundError", `Entry not found: ${name}`);
      }

      if (entry instanceof Map && entry.size > 0) {
        throw fileSystemError("InvalidModificationError", `Directory is not empty: ${name}`);
      }

      entries.delete(name);
    }
  } as FileSystemDirectoryHandle;
}

function fileHandle(entries: Map<string, MemoryDirectoryEntry>, name: string): FileSystemFileHandle {
  return {
    getFile: async () =>
      ({
        text: async () => String(entries.get(name) ?? "")
      }) as File,
    createWritable: async () =>
      ({
        write: async (data: string | Blob | BufferSource) => {
          entries.set(name, typeof data === "string" ? data : String(data));
        },
        close: async () => undefined
      }) as FileSystemWritableFileStream
  } as FileSystemFileHandle;
}

function entryAtPath(root: Map<string, MemoryDirectoryEntry>, path: string): MemoryDirectoryEntry | undefined {
  const parts = path.split("/");
  let current: MemoryDirectoryEntry = root;

  for (const part of parts) {
    if (!(current instanceof Map)) {
      return undefined;
    }

    const entry = current.get(part);

    if (entry === undefined) {
      return undefined;
    }

    current = entry;
  }

  return current;
}

function fileSystemError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;

  return error;
}
