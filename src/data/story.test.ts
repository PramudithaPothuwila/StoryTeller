import { describe, expect, it } from "vitest";
import { BUILT_IN_WORLD_RULE_TYPE_ID, StoryEntity } from "../types";
import {
  addTimelineLaneToProject,
  createBlankProject,
  createStoryEntity,
  deleteEmptyTimelineTrackFromProject,
  ensureEventTimeline,
  getTimelineLaneNames,
  migrateProjectShape,
  moveTimelineEventInProject,
  renameTimelineLaneInProject
} from "./story";

describe("story timeline tracks", () => {
  it("renumbers event order from timeline moves across parallel tracks", () => {
    const project = createBlankProject("Parallel Timeline");
    const first = createStoryEntity("event", project.itemTypes, "First");
    const second = createStoryEntity("event", project.itemTypes, "Second");
    const third = createStoryEntity("event", project.itemTypes, "Third");
    first.timeline = { order: 1, effects: [] };
    second.timeline = { order: 2, effects: [] };
    third.timeline = { order: 3, effects: [] };

    const projectWithEvents = {
      ...project,
      entities: {
        [first.id]: first,
        [second.id]: second,
        [third.id]: third
      }
    };

    const movedToParallelTrack = moveTimelineEventInProject(projectWithEvents, third.id, 1, 0);

    expect(ensureEventTimeline(movedToParallelTrack.entities[third.id]).track).toBe(1);
    expect(ensureEventTimeline(movedToParallelTrack.entities[third.id]).order).toBe(1);
    expect(ensureEventTimeline(movedToParallelTrack.entities[first.id]).track).toBe(0);
    expect(ensureEventTimeline(movedToParallelTrack.entities[first.id]).order).toBe(1);
    expect(ensureEventTimeline(movedToParallelTrack.entities[second.id]).order).toBe(2);

    const reorderedSameTrack = moveTimelineEventInProject(movedToParallelTrack, second.id, 0, 0);

    expect(ensureEventTimeline(reorderedSameTrack.entities[second.id]).order).toBe(1);
    expect(ensureEventTimeline(reorderedSameTrack.entities[first.id]).order).toBe(2);
  });

  it("deletes only empty timeline tracks and collapses later tracks", () => {
    const project = createBlankProject("Parallel Timeline");
    const first = createStoryEntity("event", project.itemTypes, "First");
    const second = createStoryEntity("event", project.itemTypes, "Second");
    first.timeline = { order: 1, track: 0, effects: [] };
    second.timeline = { order: 1, track: 2, effects: [] };
    const projectWithGap = {
      ...project,
      entities: {
        [first.id]: first,
        [second.id]: second
      }
    };

    const unchanged = deleteEmptyTimelineTrackFromProject(projectWithGap, 0);
    const collapsed = deleteEmptyTimelineTrackFromProject(projectWithGap, 1);

    expect(unchanged).toBe(projectWithGap);
    expect(ensureEventTimeline(collapsed.entities[first.id]).track).toBe(0);
    expect(ensureEventTimeline(collapsed.entities[second.id]).track).toBe(1);
  });

  it("adds and renames project-backed timeline lane names", () => {
    const project = createBlankProject("Parallel Timeline");
    const addedLane = addTimelineLaneToProject(project);
    const renamedLane = renameTimelineLaneInProject(addedLane, 1, "Conspiracy");
    const resetLane = renameTimelineLaneInProject(renamedLane, 1, " ");

    expect(getTimelineLaneNames(addedLane)).toEqual(["Track 1", "Track 2"]);
    expect(getTimelineLaneNames(renamedLane)).toEqual(["Track 1", "Conspiracy"]);
    expect(getTimelineLaneNames(resetLane)).toEqual(["Track 1", "Track 2"]);
  });

  it("keeps custom lane names aligned when empty tracks are deleted", () => {
    const project = createBlankProject("Parallel Timeline");
    const first = createStoryEntity("event", project.itemTypes, "First");
    const second = createStoryEntity("event", project.itemTypes, "Second");
    first.timeline = { order: 1, track: 0, effects: [] };
    second.timeline = { order: 1, track: 2, effects: [] };
    const projectWithNamedGap = {
      ...project,
      timelineLaneNames: ["Main", "Empty", "Aftermath"],
      entities: {
        [first.id]: first,
        [second.id]: second
      }
    };

    const collapsed = deleteEmptyTimelineTrackFromProject(projectWithNamedGap, 1);

    expect(getTimelineLaneNames(collapsed)).toEqual(["Main", "Aftermath"]);
    expect(ensureEventTimeline(collapsed.entities[second.id]).track).toBe(1);
  });
});

describe("story world rules", () => {
  it("adds world rule item and rule-specific link types to blank projects", () => {
    const project = createBlankProject("Rules");

    expect(project.itemTypes).toContainEqual(
      expect.objectContaining({ id: BUILT_IN_WORLD_RULE_TYPE_ID, label: "World Rule", builtIn: true })
    );
    expect(project.linkTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "governs", direction: "directed", builtIn: true }),
        expect.objectContaining({ id: "known_by", direction: "directed", builtIn: true }),
        expect.objectContaining({ id: "exception_to", direction: "directed", builtIn: true })
      ])
    );
  });

  it("initializes structured metadata for new world rules", () => {
    const project = createBlankProject("Rules");
    const rule = createStoryEntity(BUILT_IN_WORLD_RULE_TYPE_ID, project.itemTypes, "Memory Trade Is Final");

    expect(rule.worldRule).toEqual({
      domain: "",
      status: "Tentative",
      statement: "",
      reason: "",
      limits: "",
      exceptions: "",
      storyPurpose: ""
    });
  });

  it("fills missing world rule metadata only on world rule entities during migration", () => {
    const timestamp = "2026-01-01T00:00:00.000Z";
    const rule: StoryEntity = {
      id: "world-rule-memory",
      type: BUILT_IN_WORLD_RULE_TYPE_ID,
      title: "Memory Trade",
      summary: "",
      tags: [],
      publicInfo: "",
      privateInfo: "",
      bodyMarkdown: "",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const character: StoryEntity = {
      id: "character-mara",
      type: "character",
      title: "Mara",
      summary: "",
      tags: [],
      publicInfo: "",
      privateInfo: "",
      bodyMarkdown: "",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const migrated = migrateProjectShape({
      schemaVersion: 2,
      title: "Rules",
      updatedAt: timestamp,
      entities: {
        [rule.id]: rule,
        [character.id]: character
      },
      relationships: [],
      layout: {}
    });

    expect(migrated.entities[rule.id].worldRule?.status).toBe("Tentative");
    expect(migrated.entities[character.id].worldRule).toBeUndefined();
  });
});
