import { describe, expect, it } from "vitest";
import { BUILT_IN_TRIGGER_LINK_TYPE_ID, BUILT_IN_WORLD_RULE_TYPE_ID, StoryEntity } from "../types";
import {
  addGameStateVariableToProject,
  addTimelineLaneToProject,
  applyGamePlaythroughChoice,
  createBlankProject,
  createGameStateCondition,
  createGameStateEffect,
  createStoryRuntimeContradictionRule,
  createStoryRuntimeEvidence,
  createStoryRuntimeFact,
  createStoryRuntimeTheoryRule,
  createStoryEntity,
  createStoryRelationship,
  defaultRuntimeToolsEnabled,
  deleteRuntimeEvidenceFromProject,
  deleteRuntimeFactFromProject,
  deleteEntityFromProject,
  deleteEmptyTimelineTrackFromProject,
  entityVisibleInGraph,
  ensureEventTimeline,
  evaluateGameStateConditions,
  getGameContinuityIssues,
  getGameStoryNodes,
  getGameStoryTriggerRelationships,
  getGamePlayableChoices,
  getInitialGameState,
  getTimelineLaneNames,
  getWorldTriggerRelationships,
  isGameStoryLinkType,
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

describe("runtime authoring metadata", () => {
  it("creates blank schema v7 projects with empty runtime defaults", () => {
    const project = createBlankProject("Runtime Ready");

    expect(project.schemaVersion).toBe(7);
    expect(project.runtime).toEqual({
      facts: [],
      evidence: [],
      characterKnowledge: [],
      contradictionRules: [],
      theoryRules: []
    });
  });

  it("defaults runtime tools off for story projects and on for game or runtime-populated projects", () => {
    const storyProject = createBlankProject("Book Draft", "story");
    const gameProject = createBlankProject("Playable Story", "game_story");
    const runtimeProject = {
      ...storyProject,
      runtime: {
        ...storyProject.runtime,
        facts: [
          {
            id: "fact-ledger-forged",
            statement: "The ledger was forged.",
            truth: "true" as const,
            subjectEntityId: "",
            sourceEntityIds: [],
            sourceNotes: "",
            tags: [],
            notes: ""
          }
        ]
      }
    };

    expect(defaultRuntimeToolsEnabled(storyProject)).toBe(false);
    expect(defaultRuntimeToolsEnabled(gameProject)).toBe(true);
    expect(defaultRuntimeToolsEnabled(runtimeProject)).toBe(true);
    expect(defaultRuntimeToolsEnabled({ ...runtimeProject, runtimeToolsEnabled: false })).toBe(false);
  });

  it("creates runtime records with safe editable defaults", () => {
    expect(createStoryRuntimeFact()).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^fact-/),
        statement: "",
        truth: "unknown",
        sourceEntityIds: [],
        sourceNotes: "",
        tags: [],
        notes: ""
      })
    );
    expect(createStoryRuntimeEvidence()).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^evidence-/),
        label: "",
        description: "",
        factIds: [],
        reliability: "unverified",
        playerVisibility: "hidden",
        discoveredByCharacterIds: [],
        sourceEntityIds: [],
        sourceNotes: "",
        notes: ""
      })
    );
    expect(createStoryRuntimeContradictionRule()).toEqual(
      expect.objectContaining({ id: expect.stringMatching(/^contradiction-/), severity: "warning", factIds: [] })
    );
    expect(createStoryRuntimeTheoryRule()).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^theory-/),
        requiredEvidenceIds: [],
        supportingFactIds: [],
        contradictingFactIds: [],
        playerVisibility: "hidden"
      })
    );
  });

  it("migrates v6 projects to v7 without losing existing story data", () => {
    const timestamp = "2026-01-01T00:00:00.000Z";
    const character = createStoryEntity("character", [], "Mara");
    const migrated = migrateProjectShape({
      schemaVersion: 6,
      title: "Legacy Runtime",
      updatedAt: timestamp,
      projectMode: "story",
      entities: {
        [character.id]: character
      },
      relationships: [],
      gameplayTransitions: [],
      designConstraints: [{ id: "constraint-tone", category: "Tone", rule: "No slapstick", severity: "required" }],
      aiProposals: [{ id: "proposal-1", status: "approved", createdAt: timestamp, summary: "Keep noir tone." }],
      layout: {
        [character.id]: { x: 10, y: 20 }
      },
      storyFlowLayout: {}
    });

    expect(migrated.schemaVersion).toBe(7);
    expect(migrated.entities[character.id].title).toBe("Mara");
    expect(migrated.designConstraints[0].rule).toBe("No slapstick");
    expect(migrated.aiProposals[0].summary).toBe("Keep noir tone.");
    expect(migrated.runtime).toEqual({
      facts: [],
      evidence: [],
      characterKnowledge: [],
      contradictionRules: [],
      theoryRules: []
    });
  });

  it("normalizes runtime truth, knowledge, belief, and player visibility separately", () => {
    const migrated = migrateProjectShape({
      schemaVersion: 7,
      title: "Runtime Data",
      updatedAt: "2026-01-01T00:00:00.000Z",
      projectMode: "story",
      entities: {},
      relationships: [],
      gameplayTransitions: [],
      layout: {},
      storyFlowLayout: {},
      runtime: {
        facts: [
          {
            id: "fact-ledger-forged",
            statement: "The ledger was forged.",
            truth: "true",
            subjectEntityId: "item-ledger",
            sourceEntityIds: ["item-ledger"],
            sourceNotes: "Draft chapter 3",
            tags: ["mystery"]
          }
        ],
        evidence: [
          {
            id: "evidence-ink",
            label: "Moonlit ink",
            description: "The ink only appears under moonlight.",
            factIds: ["fact-ledger-forged"],
            reliability: "confirmed",
            playerVisibility: "discoverable",
            sourceEntityIds: ["scene-search-signal-room"],
            sourceNotes: "Seen during the locker search."
          }
        ],
        characterKnowledge: [
          {
            id: "knowledge-mara-ledger",
            characterId: "character-mara",
            factId: "fact-ledger-forged",
            knowledge: "knows",
            belief: "believes_false",
            evidenceIds: ["evidence-ink"]
          }
        ],
        contradictionRules: [
          {
            id: "contradiction-ledger",
            label: "Ledger testimony conflict",
            factIds: ["fact-ledger-forged", "fact-ledger-authentic"],
            severity: "error",
            resolution: "Only one ledger origin can be canon."
          }
        ],
        theoryRules: [
          {
            id: "theory-forgery",
            label: "Player can accuse the forger",
            requiredEvidenceIds: ["evidence-ink"],
            supportingFactIds: ["fact-ledger-forged"],
            contradictingFactIds: ["fact-ledger-authentic"],
            conclusion: "The ledger is forged.",
            playerVisibility: "hidden"
          }
        ]
      }
    });

    expect(migrated.runtime.facts[0]).toEqual(
      expect.objectContaining({
        truth: "true",
        sourceEntityIds: ["item-ledger"],
        sourceNotes: "Draft chapter 3",
        tags: ["mystery"]
      })
    );
    expect(migrated.runtime.evidence[0]).toEqual(
      expect.objectContaining({
        reliability: "confirmed",
        playerVisibility: "discoverable",
        sourceEntityIds: ["scene-search-signal-room"],
        sourceNotes: "Seen during the locker search."
      })
    );
    expect(migrated.runtime.characterKnowledge[0]).toEqual(
      expect.objectContaining({ knowledge: "knows", belief: "believes_false", evidenceIds: ["evidence-ink"] })
    );
    expect(migrated.runtime.contradictionRules[0].severity).toBe("error");
    expect(migrated.runtime.theoryRules[0].playerVisibility).toBe("hidden");
  });

  it("normalizes character runtime metadata only for character entities", () => {
    const character = createStoryEntity("character", [], "Mara");
    const item = createStoryEntity("item", [], "Moonlit Ledger") as StoryEntity;
    character.runtimeCharacter = {
      goals: ["Find the ledger", ""],
      attitude: 250,
      emotionalState: "Guarded",
      communicationStyle: "Deflects questions about the archive.",
      knownFactIds: ["fact-ledger"],
      believedFactIds: ["fact-false-route"],
      hiddenFactIds: ["fact-royal-blood"],
      deceptionRules: [
        {
          id: "",
          condition: "Asked about the ledger",
          deceptionGoal: "Protect Orin",
          allowedStrategies: ["deny", "invent" as never],
          forbiddenFactIds: ["fact-royal-blood"],
          revealWhenEvidenceIds: ["evidence-ink"],
          notes: "Do not improvise a new culprit."
        }
      ],
      disclosureRules: [
        {
          id: "",
          condition: "Player shows the ink",
          revealFactIds: ["fact-ledger"],
          requiredEvidenceIds: ["evidence-ink"],
          audience: "Player",
          notes: "Admit only the forged page."
        }
      ]
    };
    item.runtimeCharacter = character.runtimeCharacter;

    const migrated = migrateProjectShape({
      schemaVersion: 7,
      title: "Runtime Characters",
      updatedAt: "2026-01-01T00:00:00.000Z",
      projectMode: "story",
      entities: {
        [character.id]: character,
        [item.id]: item
      },
      relationships: [],
      gameplayTransitions: [],
      layout: {},
      storyFlowLayout: {}
    });

    expect(migrated.entities[character.id].runtimeCharacter).toEqual(
      expect.objectContaining({
        goals: ["Find the ledger"],
        attitude: 100,
        emotionalState: "Guarded",
        communicationStyle: "Deflects questions about the archive.",
        knownFactIds: ["fact-ledger"],
        believedFactIds: ["fact-false-route"],
        hiddenFactIds: ["fact-royal-blood"]
      })
    );
    expect(migrated.entities[character.id].runtimeCharacter?.deceptionRules[0]).toEqual(
      expect.objectContaining({
        condition: "Asked about the ledger",
        allowedStrategies: ["deny"],
        forbiddenFactIds: ["fact-royal-blood"],
        revealWhenEvidenceIds: ["evidence-ink"]
      })
    );
    expect(migrated.entities[character.id].runtimeCharacter?.disclosureRules[0]).toEqual(
      expect.objectContaining({
        condition: "Player shows the ink",
        revealFactIds: ["fact-ledger"],
        requiredEvidenceIds: ["evidence-ink"],
        audience: "Player"
      })
    );
    expect(migrated.entities[item.id].runtimeCharacter).toBeUndefined();
  });

  it("removes deleted character references from runtime knowledge and evidence discovery", () => {
    const project = createBlankProject("Runtime Cleanup");
    const character = createStoryEntity("character", project.itemTypes, "Mara");
    const otherCharacter = createStoryEntity("character", project.itemTypes, "Orin");
    const deleted = deleteEntityFromProject(
      {
        ...project,
        entities: {
          [character.id]: character,
          [otherCharacter.id]: otherCharacter
        },
        runtime: {
          ...project.runtime,
          evidence: [
            {
              id: "evidence-ink",
              label: "Moonlit ink",
              description: "",
              factIds: [],
              reliability: "confirmed",
              playerVisibility: "hidden",
              discoveredByCharacterIds: [character.id, otherCharacter.id],
              sourceEntityIds: [],
              sourceNotes: "",
              notes: ""
            }
          ],
          characterKnowledge: [
            {
              id: "knowledge-mara",
              characterId: character.id,
              factId: "fact-ledger",
              knowledge: "knows",
              belief: "believes_true",
              evidenceIds: [],
              notes: ""
            },
            {
              id: "knowledge-orin",
              characterId: otherCharacter.id,
              factId: "fact-ledger",
              knowledge: "suspects",
              belief: "uncertain",
              evidenceIds: [],
              notes: ""
            }
          ]
        }
      },
      character.id
    );

    expect(deleted.runtime.characterKnowledge).toEqual([
      expect.objectContaining({ id: "knowledge-orin", characterId: otherCharacter.id })
    ]);
    expect(deleted.runtime.evidence[0].discoveredByCharacterIds).toEqual([otherCharacter.id]);
  });

  it("removes deleted fact and evidence references from runtime authoring data", () => {
    const project = createBlankProject("Runtime Cleanup");
    const character = createStoryEntity("character", project.itemTypes, "Mara");
    character.runtimeCharacter = {
      goals: [],
      attitude: 0,
      emotionalState: "",
      communicationStyle: "",
      knownFactIds: ["fact-ledger"],
      believedFactIds: ["fact-ledger"],
      hiddenFactIds: ["fact-ledger"],
      deceptionRules: [
        {
          id: "deception-ledger",
          condition: "",
          deceptionGoal: "",
          allowedStrategies: ["deflect"],
          forbiddenFactIds: ["fact-ledger"],
          revealWhenEvidenceIds: ["evidence-ink"],
          notes: ""
        }
      ],
      disclosureRules: [
        {
          id: "disclosure-ledger",
          condition: "",
          revealFactIds: ["fact-ledger"],
          requiredEvidenceIds: ["evidence-ink"],
          audience: "",
          notes: ""
        }
      ]
    };

    const projectWithRuntime = {
      ...project,
      entities: {
        [character.id]: character
      },
      runtime: {
        ...project.runtime,
        facts: [
          {
            id: "fact-ledger",
            statement: "The ledger was forged.",
            truth: "true" as const,
            sourceEntityIds: [],
            sourceNotes: "",
            tags: [],
            notes: ""
          }
        ],
        evidence: [
          {
            id: "evidence-ink",
            label: "Moonlit ink",
            description: "",
            factIds: ["fact-ledger"],
            reliability: "confirmed" as const,
            playerVisibility: "discoverable" as const,
            discoveredByCharacterIds: [],
            sourceEntityIds: [],
            sourceNotes: "",
            notes: ""
          }
        ],
        characterKnowledge: [
          {
            id: "knowledge-ledger",
            characterId: character.id,
            factId: "fact-ledger",
            knowledge: "knows" as const,
            belief: "believes_true" as const,
            evidenceIds: ["evidence-ink"],
            notes: ""
          }
        ],
        contradictionRules: [
          {
            id: "contradiction-ledger",
            label: "",
            factIds: ["fact-ledger"],
            severity: "warning" as const,
            resolution: "",
            notes: ""
          }
        ],
        theoryRules: [
          {
            id: "theory-ledger",
            label: "",
            requiredEvidenceIds: ["evidence-ink"],
            supportingFactIds: ["fact-ledger"],
            contradictingFactIds: ["fact-ledger"],
            conclusion: "",
            playerVisibility: "hidden" as const,
            notes: ""
          }
        ]
      }
    };

    const withoutFact = deleteRuntimeFactFromProject(projectWithRuntime, "fact-ledger");

    expect(withoutFact.runtime.facts).toEqual([]);
    expect(withoutFact.runtime.evidence[0].factIds).toEqual([]);
    expect(withoutFact.runtime.characterKnowledge).toEqual([]);
    expect(withoutFact.runtime.contradictionRules[0].factIds).toEqual([]);
    expect(withoutFact.runtime.theoryRules[0].supportingFactIds).toEqual([]);
    expect(withoutFact.runtime.theoryRules[0].contradictingFactIds).toEqual([]);
    expect(withoutFact.entities[character.id].runtimeCharacter?.knownFactIds).toEqual([]);
    expect(withoutFact.entities[character.id].runtimeCharacter?.deceptionRules[0].forbiddenFactIds).toEqual([]);
    expect(withoutFact.entities[character.id].runtimeCharacter?.disclosureRules[0].revealFactIds).toEqual([]);

    const withoutEvidence = deleteRuntimeEvidenceFromProject(projectWithRuntime, "evidence-ink");

    expect(withoutEvidence.runtime.evidence).toEqual([]);
    expect(withoutEvidence.runtime.characterKnowledge[0].evidenceIds).toEqual([]);
    expect(withoutEvidence.runtime.theoryRules[0].requiredEvidenceIds).toEqual([]);
    expect(withoutEvidence.entities[character.id].runtimeCharacter?.deceptionRules[0].revealWhenEvidenceIds).toEqual([]);
    expect(withoutEvidence.entities[character.id].runtimeCharacter?.disclosureRules[0].requiredEvidenceIds).toEqual([]);
  });
});

describe("game story mode", () => {
  it("upgrades projects to schema v7 and installs game story catalogs only when enabled", () => {
    const storyProject = createBlankProject("Story");
    const gameProject = setProjectModeInProject(storyProject, "game_story");

    expect(storyProject.schemaVersion).toBe(7);
    expect(storyProject.storyFlowLayout).toEqual({});
    expect(storyProject.projectMode).toBe("story");
    expect(storyProject.itemTypes.some((type) => type.id === "scene")).toBe(false);
    expect(gameProject.projectMode).toBe("game_story");
    expect(gameProject.gameStory?.stateVariables).toEqual([]);
    expect(gameProject.itemTypes).toEqual(expect.arrayContaining([expect.objectContaining({ id: "scene", builtIn: true })]));
    expect(gameProject.linkTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "branches_to", builtIn: true }),
        expect.objectContaining({ id: BUILT_IN_TRIGGER_LINK_TYPE_ID, label: "Triggers", builtIn: true })
      ])
    );
    expect(isGameStoryLinkType(BUILT_IN_TRIGGER_LINK_TYPE_ID)).toBe(false);
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

    expect(migrated.schemaVersion).toBe(7);
    expect(migrated.layout[start.id]).toEqual({ x: 10, y: 20 });
    expect(migrated.entities[start.id].graphPresence).toBe("both");
    expect(migrated.entities[character.id].graphPresence).toBe("world");
    expect(migrated.storyFlowLayout).toEqual({
      [start.id]: { x: 10, y: 20 }
    });
  });

  it("normalizes graph presence defaults and keeps shared reference items out of game node validation", () => {
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
    expect(entityVisibleInGraph(character, "story_flow")).toBe(true);
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

  it("finds valid trigger links from both world-building and game-story sides", () => {
    const project = setProjectModeInProject(createBlankProject("Triggers"), "game_story");
    const event = createStoryEntity("event", project.itemTypes, "Storm Opens", "world");
    const scene = createStoryEntity("scene", project.itemTypes, "Opening Scene", "story_flow");
    const trigger = createStoryRelationship(project, event.id, scene.id, BUILT_IN_TRIGGER_LINK_TYPE_ID);
    const projectWithTrigger = {
      ...project,
      entities: {
        [event.id]: event,
        [scene.id]: scene
      },
      relationships: [trigger]
    };

    expect(getWorldTriggerRelationships(projectWithTrigger, event.id)).toEqual([trigger]);
    expect(getGameStoryTriggerRelationships(projectWithTrigger, scene.id)).toEqual([trigger]);

    const deleted = deleteEntityFromProject(projectWithTrigger, scene.id);

    expect(getWorldTriggerRelationships(deleted, event.id)).toEqual([]);
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

  it("evaluates nested condition groups with all, any, and not", () => {
    let project = setProjectModeInProject(createBlankProject("Nested Conditions"), "game_story");
    project = addGameStateVariableToProject(project, "flag");
    project = updateGameStateVariableInProject(project, project.gameStory!.stateVariables[0].id, {
      id: "knows-truth",
      label: "Knows Truth",
      defaultValue: false
    });
    project = addGameStateVariableToProject(project, "number");
    project = updateGameStateVariableInProject(project, project.gameStory!.stateVariables[1].id, {
      id: "evidence-pressure",
      label: "Evidence Pressure",
      defaultValue: 0
    });

    expect(
      evaluateGameStateConditions(
        project,
        {
          all: [
            { ...createGameStateCondition("knows-truth"), value: true },
            {
              any: [
                { ...createGameStateCondition("evidence-pressure"), operator: "greater_than_or_equal", value: 3 },
                { not: { ...createGameStateCondition("knows-truth"), value: false } }
              ]
            }
          ]
        },
        {
          "knows-truth": true,
          "evidence-pressure": 2
        }
      )
    ).toBe(true);
  });

  it("validates variable value types and invalid effect operations", () => {
    let project = setProjectModeInProject(createBlankProject("State Validation"), "game_story");
    project = addGameStateVariableToProject(project, "flag");
    project = updateGameStateVariableInProject(project, project.gameStory!.stateVariables[0].id, {
      id: "has-key",
      label: "Has Key",
      defaultValue: false
    });
    project = addGameStateVariableToProject(project, "enum");
    project = updateGameStateVariableInProject(project, project.gameStory!.stateVariables[1].id, {
      id: "trust-silas",
      label: "Trust Silas",
      defaultValue: "unknown",
      enumOptions: ["unknown", "trusted"]
    });
    const start = createStoryEntity("scene", project.itemTypes, "Start", "story_flow");
    const ending = createStoryEntity("ending", project.itemTypes, "Ending", "story_flow");

    project = updateGameStoryProjectMetadata(
      {
        ...project,
        entities: {
          [start.id]: start,
          [ending.id]: ending
        },
        gameplayTransitions: [
          {
            id: "transition-invalid",
            sourceNodeId: start.id,
            targetNodeId: ending.id,
            choice: { text: "Invalid choice" },
            requirements: {
              all: [
                { ...createGameStateCondition("has-key"), value: "true" },
                { ...createGameStateCondition("trust-silas"), value: "alienated" }
              ]
            },
            effects: [{ ...createGameStateEffect("has-key"), operation: "increment", value: 1 }],
            presentation: { priority: 0 },
            authorNotes: { purpose: "" },
            metadata: {}
          }
        ]
      },
      { startNodeId: start.id }
    );

    const issueTitles = getGameContinuityIssues(project).map((issue) => issue.title);

    expect(issueTitles).toContain("Invalid state value");
  });
});

function exitBranchToChoice(project: ReturnType<typeof createBlankProject>, relationshipId: string) {
  const relationship = project.relationships.find((item) => item.id === relationshipId)!;

  return getGamePlayableChoices(project, relationship.sourceId, { "has-key": true }).find(
    (choice) => choice.relationshipId === relationshipId
  )!;
}
