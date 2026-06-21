import { describe, expect, it } from "vitest";
import { BUILT_IN_WORLD_RULE_TYPE_ID, StoryRelationship } from "../types";
import {
  createBlankProject,
  createGameplayTransition,
  createStoryEntity,
  createStoryRelationship,
  setProjectModeInProject,
  updateGameStoryProjectMetadata
} from "../data/story";
import { createRuntimeBundle } from "./export";
import { STORY_RUNTIME_BUNDLE_KIND, STORY_RUNTIME_SCHEMA_VERSION } from "./types";

describe("runtime export", () => {
  it("exports a valid runtime bundle from a blank project without changing authoring schema", () => {
    const project = createBlankProject("Blank Runtime");
    const bundle = createRuntimeBundle(project, "2026-01-01T00:00:00.000Z");

    expect(bundle.kind).toBe(STORY_RUNTIME_BUNDLE_KIND);
    expect(bundle.schemaVersion).toBe(STORY_RUNTIME_SCHEMA_VERSION);
    expect(bundle.sourceProject).toEqual({
      title: "Blank Runtime",
      schemaVersion: 7,
      projectMode: "story",
      updatedAt: project.updatedAt
    });
    expect(bundle.entities).toEqual([]);
    expect(bundle.facts).toEqual([]);
    expect(bundle.evidence).toEqual([]);
    expect(bundle.manifest.capabilities).toEqual(["semantic_graph"]);
    expect(bundle.validation).toEqual([]);
    expect(project.schemaVersion).toBe(7);
  });

  it("exports characters, world rules, evidence, relationships, and timeline data with source IDs", () => {
    const project = createBlankProject("Runtime Fixture");
    const character = createStoryEntity("character", project.itemTypes, "Mara Vale");
    const clue = createStoryEntity("clue", project.itemTypes, "Moonlit Ledger");
    const rule = createStoryEntity(BUILT_IN_WORLD_RULE_TYPE_ID, project.itemTypes, "Memory Trade Is Final");
    const event = createStoryEntity("event", project.itemTypes, "Archive Bargain");
    const relationship = createStoryRelationship(project, character.id, clue.id, "owns");

    character.summary = "A negotiator with dangerous debts.";
    character.publicInfo = "Mara brokers memory contracts.";
    character.privateInfo = "Mara knows who forged the ledger.";
    clue.summary = "A ledger with impossible moonlit ink.";
    clue.publicInfo = "The ledger lists a payment at midnight.";
    clue.bodyMarkdown = "The final page is torn out.";
    clue.privateInfo = "The torn page names Mara.";
    rule.worldRule = {
      domain: "Magic",
      status: "Canon",
      statement: "A willingly traded memory cannot be restored.",
      reason: "The civic record rewrites around the trade.",
      limits: "Coerced theft leaves fragments.",
      exceptions: "Charged objects can hold echoes.",
      storyPurpose: "Keeps memory magic costly."
    };
    event.timeline = { order: 2, track: 1, effects: [] };

    const bundle = createRuntimeBundle(
      {
        ...project,
        entities: {
          [character.id]: character,
          [clue.id]: clue,
          [rule.id]: rule,
          [event.id]: event
        },
        relationships: [relationship]
      },
      "2026-01-01T00:00:00.000Z"
    );

    expect(bundle.entities.find((entity) => entity.id === character.id)?.sourceId).toBe(character.id);
    expect(bundle.characterProfiles[0]).toEqual(
      expect.objectContaining({
        sourceId: character.id,
        relationshipIds: [relationship.id]
      })
    );
    expect(bundle.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `fact-${rule.id}`, sourceId: rule.id, sourceKind: "world_rule" }),
        expect.objectContaining({ id: `fact-${relationship.id}`, subjectId: character.id, objectId: clue.id })
      ])
    );
    expect(bundle.evidence[0]).toEqual(
      expect.objectContaining({
        id: `evidence-${clue.id}`,
        sourceId: clue.id,
        entityId: clue.id,
        evidenceType: "clue"
      })
    );
    expect(bundle.relationships[0]).toEqual(expect.objectContaining({ sourceId: relationship.id }));
    expect(bundle.timeline.events[0]).toEqual(
      expect.objectContaining({
        id: event.id,
        sourceId: event.id,
        order: 2,
        track: 1
      })
    );
    expect(bundle.manifest.capabilities).toEqual(
      expect.arrayContaining(["semantic_graph", "timeline", "facts", "evidence", "character_profiles"])
    );
  });

  it("keeps privateInfo out of player-visible runtime fields", () => {
    const project = createBlankProject("Secrets");
    const character = createStoryEntity("character", project.itemTypes, "Silas Crowe");
    const item = createStoryEntity("item", project.itemTypes, "Locker Key");

    character.publicInfo = "Silas works the night shift.";
    character.privateInfo = "Silas hid the key after midnight.";
    item.publicInfo = "A brass key marked 12.";
    item.privateInfo = "The key was stolen from Silas.";

    const bundle = createRuntimeBundle({
      ...project,
      entities: {
        [character.id]: character,
        [item.id]: item
      }
    });
    const visibleJson = JSON.stringify({
      entities: bundle.entities.map((entity) => entity.visibleText),
      evidence: bundle.evidence.map((evidence) => evidence.visibleText),
      characterProfiles: bundle.characterProfiles.map((profile) => profile.publicInfo)
    });

    expect(visibleJson).not.toContain("Silas hid the key");
    expect(visibleJson).not.toContain("stolen from Silas");
    expect(bundle.entities.find((entity) => entity.id === character.id)?.authorHiddenText).toContain("Silas hid the key");
    expect(bundle.evidence.find((evidence) => evidence.entityId === item.id)?.authorHiddenText).toContain("stolen from Silas");
  });

  it("exports character runtime metadata and knowledge separately from canonical facts", () => {
    const project = createBlankProject("Runtime Knowledge");
    const character = createStoryEntity("character", project.itemTypes, "Mara Vale");
    character.runtimeCharacter = {
      goals: ["Protect Orin"],
      attitude: -20,
      emotionalState: "Guarded",
      communicationStyle: "Answers indirectly.",
      knownFactIds: ["fact-ledger-forged"],
      believedFactIds: ["fact-ledger-authentic"],
      hiddenFactIds: ["fact-royal-blood"],
      deceptionRules: [
        {
          id: "deception-ledger",
          condition: "Asked about the ledger",
          deceptionGoal: "Keep the forged page hidden",
          allowedStrategies: ["deflect"],
          forbiddenFactIds: ["fact-royal-blood"],
          revealWhenEvidenceIds: ["evidence-ink"],
          notes: ""
        }
      ],
      disclosureRules: []
    };

    const bundle = createRuntimeBundle({
      ...project,
      runtime: {
        ...project.runtime,
        facts: [
          {
            id: "fact-ledger-forged",
            statement: "The ledger was forged.",
            truth: "true",
            sourceEntityIds: [],
            tags: [],
            notes: ""
          },
          {
            id: "fact-ledger-authentic",
            statement: "The ledger is authentic.",
            truth: "false",
            sourceEntityIds: [],
            tags: [],
            notes: ""
          }
        ],
        characterKnowledge: [
          {
            id: "knowledge-mara-ledger",
            characterId: character.id,
            factId: "fact-ledger-forged",
            knowledge: "knows",
            belief: "believes_false",
            evidenceIds: ["evidence-ink"],
            notes: "Mara knows the truth but says the opposite."
          }
        ]
      },
      entities: {
        [character.id]: character
      }
    });
    const profile = bundle.characterProfiles[0];

    expect(bundle.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "fact-ledger-forged", value: "The ledger was forged." }),
        expect.objectContaining({ id: "fact-ledger-authentic", value: "The ledger is authentic." })
      ])
    );
    expect(profile.runtimeCharacter).toEqual(
      expect.objectContaining({
        knownFactIds: ["fact-ledger-forged"],
        believedFactIds: ["fact-ledger-authentic"],
        hiddenFactIds: ["fact-royal-blood"]
      })
    );
    expect(profile.knowledge).toEqual([
      expect.objectContaining({
        id: "knowledge-mara-ledger",
        factId: "fact-ledger-forged",
        knowledge: "knows",
        belief: "believes_false"
      })
    ]);
  });

  it("exports game story nodes and transitions", () => {
    let project = setProjectModeInProject(createBlankProject("Game Runtime"), "game_story");
    const start = createStoryEntity("scene", project.itemTypes, "Gate Scene", "both");
    const ending = createStoryEntity("ending", project.itemTypes, "Bright Ending", "both");
    const transition = {
      ...createGameplayTransition(start.id, ending.id),
      id: "transition-open-gate",
      choice: { text: "Open the gate" },
      effects: [
        {
          id: "effect-open",
          variableId: "gate-open",
          operation: "set" as const,
          value: true
        }
      ],
      authorNotes: { purpose: "The player reaches the ending." }
    };

    project = updateGameStoryProjectMetadata(
      {
        ...project,
        entities: {
          [start.id]: start,
          [ending.id]: ending
        },
        gameplayTransitions: [transition]
      },
      { startNodeId: start.id }
    );

    const bundle = createRuntimeBundle(project);

    expect(bundle.storyFlow.startNodeId).toBe(start.id);
    expect(bundle.storyFlow.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: start.id, role: "scene" }),
        expect.objectContaining({ id: ending.id, role: "ending" })
      ])
    );
    expect(bundle.storyFlow.transitions[0]).toEqual(
      expect.objectContaining({
        id: "transition-open-gate",
        sourceNodeId: start.id,
        targetNodeId: ending.id,
        choiceText: "Open the gate"
      })
    );
    expect(bundle.manifest.capabilities).toContain("story_flow");
  });

  it("includes deterministic validation warnings and errors for broken references", () => {
    const project = createBlankProject("Broken Runtime");
    const character = createStoryEntity("character", project.itemTypes, "Arden Pike");
    const missingTargetRelationship: StoryRelationship = {
      id: "link-broken",
      sourceId: character.id,
      targetId: "missing-clue",
      type: "owns",
      label: "Owns",
      notes: "",
      startsAtEventId: "missing-event",
      timelineVersions: []
    };
    const duplicateRelationship: StoryRelationship = {
      ...missingTargetRelationship,
      sourceId: "missing-source"
    };

    const bundle = createRuntimeBundle({
      ...project,
      entities: {
        [character.id]: character
      },
      relationships: [missingTargetRelationship, duplicateRelationship]
    });

    expect(bundle.validation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "runtime-relationship-duplicate-link-broken", severity: "error" }),
        expect.objectContaining({ id: "relationship-missing-source-link-broken", severity: "error" }),
        expect.objectContaining({ id: "relationship-missing-target-link-broken", severity: "error" }),
        expect.objectContaining({ id: "relationship-missing-start-event-link-broken", severity: "error" })
      ])
    );
    expect(bundle.manifest.errorCount).toBeGreaterThanOrEqual(4);
  });
});
