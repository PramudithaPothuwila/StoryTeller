import { describe, expect, it } from "vitest";
import { BUILT_IN_WORLD_RULE_TYPE_ID, StoryEntity } from "../types";
import {
  addGameStateVariableToProject,
  addTimelineLaneToProject,
  applyGamePlaythroughChoice,
  createBlankProject,
  createGameStateCondition,
  createGameStateEffect,
  createStoryEntity,
  createStoryRelationship,
  deleteEntityFromProject,
  deleteEmptyTimelineTrackFromProject,
  entityVisibleInGraph,
  ensureEventTimeline,
  getGameContinuityIssues,
  getGameStoryNodes,
  getGamePlayableChoices,
  getInitialGameState,
  getTimelineLaneNames,
  migrateProjectShape,
  moveTimelineEventInProject,
  renameTimelineLaneInProject,
  setProjectModeInProject,
  updateGameStateVariableInProject,
  updateGameStoryProjectMetadata
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
    const rule = {
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
    } as unknown as StoryEntity;
    const character = {
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
    } as unknown as StoryEntity;

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

describe("game story mode", () => {
  it("upgrades projects to schema v5 and installs game story catalogs only when enabled", () => {
    const storyProject = createBlankProject("Story");
    const gameProject = setProjectModeInProject(storyProject, "game_story");

    expect(storyProject.schemaVersion).toBe(5);
    expect(storyProject.storyFlowLayout).toEqual({});
    expect(storyProject.projectMode).toBe("story");
    expect(storyProject.itemTypes.some((type) => type.id === "scene")).toBe(false);
    expect(gameProject.projectMode).toBe("game_story");
    expect(gameProject.gameStory?.stateVariables).toEqual([]);
    expect(gameProject.itemTypes).toEqual(expect.arrayContaining([expect.objectContaining({ id: "scene", builtIn: true })]));
    expect(gameProject.linkTypes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "branches_to", builtIn: true })])
    );
  });

  it("migrates v3 game projects by copying game node positions into Story Flow layout", () => {
    const timestamp = "2026-01-01T00:00:00.000Z";
    const start = createStoryEntity("scene", [], "Start");
    const character = createStoryEntity("character", [], "Guide");

    const migrated = migrateProjectShape({
      schemaVersion: 3,
      title: "Legacy Game",
      updatedAt: timestamp,
      projectMode: "game_story",
      entities: {
        [start.id]: start,
        [character.id]: character
      },
      relationships: [],
      layout: {
        [start.id]: { x: 10, y: 20 },
        [character.id]: { x: 300, y: 40 }
      }
    });

    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.layout[start.id]).toEqual({ x: 10, y: 20 });
    expect(migrated.entities[start.id].graphPresence).toBe("both");
    expect(migrated.entities[character.id].graphPresence).toBe("world");
    expect(migrated.storyFlowLayout).toEqual({
      [start.id]: { x: 10, y: 20 }
    });
  });

  it("normalizes graph presence defaults and Story Flow eligibility", () => {
    const storyProject = createBlankProject("Presence");
    const scene = createStoryEntity("scene", storyProject.itemTypes, "Scene", "story_flow");
    const character = createStoryEntity("character", storyProject.itemTypes, "Character", "both");

    const migratedStory = migrateProjectShape({
      schemaVersion: 4,
      title: "Legacy Story",
      updatedAt: "2026-01-01T00:00:00.000Z",
      entities: {
        [character.id]: {
          ...character,
          graphPresence: undefined
        }
      },
      relationships: [],
      layout: {}
    });

    expect(scene.graphPresence).toBe("story_flow");
    expect(migratedStory.entities[character.id].graphPresence).toBe("world");
    expect(entityVisibleInGraph(character, "world")).toBe(true);
    expect(entityVisibleInGraph(character, "story_flow")).toBe(false);
    expect(getGameStoryNodes({ ...storyProject, entities: { [character.id]: character } })).toEqual([]);
  });

  it("deletes entity positions from both World and Story Flow layouts", () => {
    const project = setProjectModeInProject(createBlankProject("Delete Layout"), "game_story");
    const start = createStoryEntity("scene", project.itemTypes, "Start");
    const nextProject = {
      ...project,
      entities: {
        [start.id]: start
      },
      layout: {
        [start.id]: { x: 10, y: 20 }
      },
      storyFlowLayout: {
        [start.id]: { x: 200, y: 300 }
      }
    };

    const deleted = deleteEntityFromProject(nextProject, start.id);

    expect(deleted.layout[start.id]).toBeUndefined();
    expect(deleted.storyFlowLayout[start.id]).toBeUndefined();
  });

  it("simulates available and locked branches from state variables without mutating the project", () => {
    let project = setProjectModeInProject(createBlankProject("Game"), "game_story");
    project = addGameStateVariableToProject(project, "flag");
    const variable = project.gameStory!.stateVariables[0];
    project = updateGameStateVariableInProject(project, variable.id, {
      id: "has-key",
      label: "Has Key",
      defaultValue: false
    });
    const start = createStoryEntity("scene", project.itemTypes, "Locked Door", "story_flow");
    const open = createStoryEntity("scene", project.itemTypes, "Open Door", "story_flow");
    const ending = createStoryEntity("ending", project.itemTypes, "Escape", "story_flow");
    const lockedBranch = {
      ...createStoryRelationship(project, start.id, open.id, "branches_to"),
      gameStory: {
        choiceText: "Unlock the door",
        requirements: [{ ...createGameStateCondition("has-key"), value: true }],
        effects: [],
        consequenceNotes: "",
        priority: 0
      }
    };
    const exitBranch = {
      ...createStoryRelationship(project, open.id, ending.id, "branches_to"),
      gameStory: {
        choiceText: "Leave",
        requirements: [],
        effects: [{ ...createGameStateEffect("has-key"), operation: "remove" as const, value: false }],
        consequenceNotes: "",
        priority: 0
      }
    };
    project = updateGameStoryProjectMetadata(
      {
        ...project,
        entities: {
          [start.id]: start,
          [open.id]: open,
          [ending.id]: ending
        },
        relationships: [lockedBranch, exitBranch]
      },
      { startNodeId: start.id }
    );

    const initialState = getInitialGameState(project);
    const lockedChoices = getGamePlayableChoices(project, start.id, initialState);
    const unlockedChoices = getGamePlayableChoices(project, start.id, { ...initialState, "has-key": true });
    const nextState = applyGamePlaythroughChoice(project, open.id, { ...initialState, "has-key": true }, exitBranchToChoice(project, exitBranch.id));

    expect(lockedChoices[0].available).toBe(false);
    expect(unlockedChoices[0].available).toBe(true);
    expect(nextState["has-key"]).toBe(false);
    expect(project.gameStory?.stateVariables[0].defaultValue).toBe(false);
  });

  it("reports continuity issues for unreachable nodes, dead ends, invalid state refs, and empty quests", () => {
    let project = setProjectModeInProject(createBlankProject("Continuity"), "game_story");
    const start = createStoryEntity("scene", project.itemTypes, "Start", "story_flow");
    const lonely = createStoryEntity("scene", project.itemTypes, "Lonely Scene", "story_flow");
    const quest = createStoryEntity("quest", project.itemTypes, "Empty Quest", "story_flow");
    const branch = {
      ...createStoryRelationship(project, start.id, quest.id, "branches_to"),
      gameStory: {
        choiceText: "Take quest",
        requirements: [{ ...createGameStateCondition("missing-flag"), value: true }],
        effects: [],
        consequenceNotes: "",
        priority: 0
      }
    };
    project = updateGameStoryProjectMetadata(
      {
        ...project,
        entities: {
          [start.id]: start,
          [lonely.id]: lonely,
          [quest.id]: quest
        },
        relationships: [branch]
      },
      { startNodeId: start.id }
    );

    const issueTitles = getGameContinuityIssues(project).map((issue) => issue.title);

    expect(issueTitles).toEqual(
      expect.arrayContaining([
        "Unreachable node",
        "Non-ending dead end",
        "Invalid state reference",
        "Quest has no objectives"
      ])
    );
  });
});

function exitBranchToChoice(project: ReturnType<typeof createBlankProject>, relationshipId: string) {
  const relationship = project.relationships.find((item) => item.id === relationshipId)!;

  return getGamePlayableChoices(project, relationship.sourceId, { "has-key": true }).find(
    (choice) => choice.relationshipId === relationshipId
  )!;
}
