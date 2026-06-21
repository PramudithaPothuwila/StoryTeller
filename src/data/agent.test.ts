import { describe, expect, it } from "vitest";
import { BUILT_IN_WORLD_RULE_TYPE_ID } from "../types";
import { addEntityToProject, createBlankProject, createStoryEntity, createStoryRelationship, setProjectModeInProject } from "./story";
import {
  AgentChangePlan,
  applyAgentChangePlan,
  buildAgentProjectContext,
  buildAgentResponseSchema,
  buildAgentInput,
  buildNvidiaSystemPrompt,
  parseAgentResponsePayload,
  validateAgentChangePlan
} from "./agent";

describe("agent project helpers", () => {
  it("builds a compact schema v7 project context with structured metadata", () => {
    let project = setProjectModeInProject(createBlankProject("Agent Context"), "game_story");
    const character = createStoryEntity("character", project.itemTypes, "Mara Vale");
    character.bodyMarkdown = "A".repeat(900);
    const event = createStoryEntity("event", project.itemTypes, "Market Fire");
    event.timeline = { order: 1, track: 0, effects: [] };
    const rule = createStoryEntity(BUILT_IN_WORLD_RULE_TYPE_ID, project.itemTypes, "Memory Rule");
    rule.worldRule = {
      domain: "Magic",
      status: "Canon",
      statement: "Memories can be traded.",
      reason: "The city records identity as debt.",
      limits: "Only willing trades bind.",
      exceptions: "Echoes remain in glass.",
      storyPurpose: "Makes bargains costly."
    };
    const scene = createStoryEntity("scene", project.itemTypes, "Opening Choice", "story_flow");
    const relationship = createStoryRelationship(project, character.id, rule.id, "known_by");

    project = {
      ...project,
      entities: {
        [character.id]: character,
        [event.id]: event,
        [rule.id]: rule,
        [scene.id]: scene
      },
      relationships: [relationship],
      layout: {
        [character.id]: { x: 1, y: 2 }
      }
    };

    const context = buildAgentProjectContext(project);

    expect(context.schemaVersion).toBe(7);
    expect(context.projectMode).toBe("game_story");
    expect(context.runtime).toEqual(project.runtime);
    expect(context.itemTypes.some((type) => type.id === "scene")).toBe(true);
    expect(context.linkTypes.some((type) => type.id === "branches_to")).toBe(true);
    expect(context.gameStory).toBeTruthy();
    expect(context.entities.find((entity) => entity.id === event.id)?.timeline?.order).toBe(1);
    expect(context.entities.find((entity) => entity.id === rule.id)?.worldRule?.domain).toBe("Magic");
    expect(context.entities.find((entity) => entity.id === scene.id)?.gameStory?.role).toBe("scene");
    expect(context.entities.find((entity) => entity.id === character.id)?.bodyMarkdown.length).toBeLessThan(800);
    expect(context.relationships[0].sourceId).toBe(character.id);
    expect(context).not.toHaveProperty("layout");
  });

  it("builds expanded runtime authoring context when requested", () => {
    const project = createBlankProject("Runtime Context");
    const character = createStoryEntity("character", project.itemTypes, "Mara Vale");
    character.summary = "S".repeat(1200);
    character.publicInfo = "P".repeat(1200);
    character.privateInfo = "H".repeat(1200);
    character.bodyMarkdown = "B".repeat(1200);
    const projectWithRuntime = {
      ...project,
      entities: {
        [character.id]: character
      },
      runtime: {
        ...project.runtime,
        facts: [
          {
            id: "fact-ledger-forged",
            statement: "The ledger was forged.",
            truth: "true" as const,
            sourceEntityIds: [character.id],
            sourceNotes: "Author source note.",
            tags: [],
            notes: ""
          }
        ]
      }
    };

    const context = buildAgentProjectContext(projectWithRuntime, { mode: "runtime_authoring" });
    const input = JSON.parse(buildAgentInput(projectWithRuntime, "Create facts.", { mode: "runtime_authoring" }));

    expect(context.agentMode).toBe("runtime_authoring");
    expect(context.entities[0].bodyMarkdown.length).toBe(1200);
    expect(context.entities[0].summary.length).toBe(1200);
    expect(context.runtime.facts[0].sourceNotes).toBe("Author source note.");
    expect(input.agentMode).toBe("runtime_authoring");
  });

  it("validates missing references and invalid type IDs", () => {
    const project = createBlankProject("Invalid Plan");
    const plan: AgentChangePlan = {
      summary: "Invalid",
      assumptions: [],
      followUpQuestions: [],
      changes: [
        {
          operation: "create_entity",
          summary: "Bad type",
          entity: {
            id: "character-hero",
            type: "unknown",
            title: "Hero"
          }
        },
        {
          operation: "create_relationship",
          summary: "Missing target",
          relationship: {
            id: "link-missing-target",
            sourceId: "character-hero",
            targetId: "character-villain",
            type: "knows"
          }
        },
        {
          operation: "add_timeline_effect",
          summary: "Missing event",
          eventId: "event-missing",
          effect: {
            action: "end",
            relationshipId: "link-missing"
          }
        }
      ]
    };

    const validation = validateAgentChangePlan(project, plan);

    expect(validation[0].errors).toContain("Unknown item type: unknown");
    expect(validation[1].errors).toContain("Relationship target does not exist: character-villain");
    expect(validation[2].errors).toContain("Timeline event does not exist: event-missing");
    expect(validation[2].errors).toContain("Timeline relationship does not exist: link-missing");
  });

  it("applies approved agent changes through project helpers", () => {
    let project = createBlankProject("Apply Plan");
    const hero = createStoryEntity("character", project.itemTypes, "Hero");
    const event = createStoryEntity("event", project.itemTypes, "First Meeting");
    event.timeline = { order: 1, effects: [] };
    project = addEntityToProject(project, hero, { x: 10, y: 20 });
    project = addEntityToProject(project, event, { x: 40, y: 20 });
    const plan: AgentChangePlan = {
      summary: "Add rival",
      assumptions: [],
      followUpQuestions: [],
      changes: [
        {
          operation: "create_entity",
          summary: "Create rival",
          entity: {
            id: "character-rival",
            type: "character",
            title: "Rival",
            summary: "A mirror to the hero."
          }
        },
        {
          operation: "create_relationship",
          summary: "Connect hero and rival",
          relationship: {
            id: "link-hero-rival",
            sourceId: hero.id,
            targetId: "character-rival",
            type: "opposes",
            label: "Opposes"
          }
        },
        {
          operation: "add_timeline_effect",
          summary: "Start rivalry at the first meeting",
          eventId: event.id,
          effect: {
            action: "start",
            sourceId: hero.id,
            targetId: "character-rival",
            type: "opposes",
            label: "Publicly challenges",
            notes: "The rivalry becomes visible."
          }
        }
      ]
    };

    const result = applyAgentChangePlan(project, plan);

    expect(result.project.schemaVersion).toBe(7);
    expect(result.project.entities["character-rival"].title).toBe("Rival");
    expect(result.project.relationships.some((relationship) => relationship.id === "link-hero-rival")).toBe(true);
    expect(result.project.relationships.some((relationship) => relationship.startsAtEventId === event.id)).toBe(true);
    expect(result.changedEntityIds).toContain("character-rival");
    expect(result.changedRelationshipIds).toContain("link-hero-rival");
  });

  it("parses, validates, and applies runtime CRUD changes", () => {
    const project = createBlankProject("Runtime Agent");
    const character = createStoryEntity("character", project.itemTypes, "Mara Vale");
    const projectWithCharacter = {
      ...project,
      entities: {
        [character.id]: character
      }
    };
    const plan = parseAgentResponsePayload({
      output_text: JSON.stringify({
        summary: "Author runtime data.",
        assumptions: [],
        followUpQuestions: [],
        changes: [
          {
            operation: "create_runtime_fact",
            summary: "Create fact",
            fact: {
              id: "fact-ledger-forged",
              statement: "The ledger was forged.",
              truth: "true",
              sourceEntityIds: [character.id],
              sourceNotes: "From chapter 2.",
              tags: ["mystery"],
              notes: ""
            }
          },
          {
            operation: "create_runtime_evidence",
            summary: "Create evidence",
            evidence: {
              id: "evidence-ink",
              label: "Moonlit ink",
              description: "The ink appears under cold light.",
              factIds: ["fact-ledger-forged"],
              reliability: "confirmed",
              playerVisibility: "discoverable",
              discoveredByCharacterIds: [character.id],
              sourceEntityIds: [character.id],
              sourceNotes: "",
              notes: ""
            }
          },
          {
            operation: "create_runtime_character_knowledge",
            summary: "Create knowledge",
            knowledge: {
              id: "knowledge-mara-ledger",
              characterId: character.id,
              factId: "fact-ledger-forged",
              knowledge: "knows",
              belief: "believes_true",
              evidenceIds: ["evidence-ink"],
              notes: ""
            }
          },
          {
            operation: "create_runtime_contradiction",
            summary: "Create contradiction",
            contradiction: {
              id: "contradiction-ledger",
              label: "Ledger conflict",
              factIds: ["fact-ledger-forged"],
              severity: "warning",
              resolution: "",
              notes: ""
            }
          },
          {
            operation: "create_runtime_theory_rule",
            summary: "Create theory",
            theoryRule: {
              id: "theory-ledger",
              label: "Accuse forger",
              requiredEvidenceIds: ["evidence-ink"],
              supportingFactIds: ["fact-ledger-forged"],
              contradictingFactIds: [],
              conclusion: "The player can accuse the forger.",
              playerVisibility: "hidden",
              notes: ""
            }
          },
          {
            operation: "update_runtime_fact",
            summary: "Update fact",
            id: "fact-ledger-forged",
            patch: {
              statement: "The signal room ledger was forged."
            }
          },
          {
            operation: "update_runtime_evidence",
            summary: "Update evidence",
            id: "evidence-ink",
            patch: {
              reliability: "unverified"
            }
          },
          {
            operation: "update_runtime_character_knowledge",
            summary: "Update knowledge",
            id: "knowledge-mara-ledger",
            patch: {
              notes: "Mara saw the page."
            }
          },
          {
            operation: "update_runtime_contradiction",
            summary: "Update contradiction",
            id: "contradiction-ledger",
            patch: {
              severity: "error"
            }
          },
          {
            operation: "update_runtime_theory_rule",
            summary: "Update theory",
            id: "theory-ledger",
            patch: {
              conclusion: "The player can confront the forger."
            }
          }
        ]
      })
    });

    expect(plan.changes[0].operation).toBe("create_runtime_fact");
    expect(validateAgentChangePlan(projectWithCharacter, plan).flatMap((item) => item.errors)).toEqual([]);

    const result = applyAgentChangePlan(projectWithCharacter, plan);

    expect(result.changedEntityIds).toEqual([]);
    expect(result.changedRelationshipIds).toEqual([]);
    expect(result.project.runtime.facts[0]).toEqual(
      expect.objectContaining({ id: "fact-ledger-forged", statement: "The signal room ledger was forged." })
    );
    expect(result.project.runtime.evidence[0]).toEqual(
      expect.objectContaining({ id: "evidence-ink", reliability: "unverified", factIds: ["fact-ledger-forged"] })
    );
    expect(result.project.runtime.characterKnowledge[0]).toEqual(
      expect.objectContaining({ id: "knowledge-mara-ledger", evidenceIds: ["evidence-ink"], notes: "Mara saw the page." })
    );
    expect(result.project.runtime.contradictionRules[0]).toEqual(
      expect.objectContaining({ id: "contradiction-ledger", severity: "error" })
    );
    expect(result.project.runtime.theoryRules[0]).toEqual(
      expect.objectContaining({ id: "theory-ledger", conclusion: "The player can confront the forger." })
    );
  });

  it("allows runtime deletes but rejects missing runtime references", () => {
    const project = createBlankProject("Runtime Delete Agent");
    const character = createStoryEntity("character", project.itemTypes, "Mara Vale");
    const projectWithRuntime = applyAgentChangePlan(
      {
        ...project,
        entities: {
          [character.id]: character
        }
      },
      {
        summary: "Seed runtime.",
        assumptions: [],
        followUpQuestions: [],
        changes: [
          {
            operation: "create_runtime_fact",
            summary: "Create fact",
            fact: {
              id: "fact-ledger",
              statement: "The ledger was forged.",
              truth: "true",
              sourceEntityIds: [],
              sourceNotes: "",
              tags: [],
              notes: ""
            }
          },
          {
            operation: "create_runtime_evidence",
            summary: "Create evidence",
            evidence: {
              id: "evidence-ink",
              label: "Ink",
              description: "",
              factIds: ["fact-ledger"],
              reliability: "confirmed",
              playerVisibility: "hidden",
              discoveredByCharacterIds: [],
              sourceEntityIds: [],
              sourceNotes: "",
              notes: ""
            }
          }
        ]
      }
    ).project;
    const deletePlan: AgentChangePlan = {
      summary: "Delete runtime records.",
      assumptions: [],
      followUpQuestions: [],
      changes: [
        {
          operation: "delete_runtime_fact",
          summary: "Delete fact",
          id: "fact-ledger"
        },
        {
          operation: "delete_runtime_evidence",
          summary: "Delete evidence",
          id: "evidence-ink"
        }
      ]
    };
    const invalidPlan: AgentChangePlan = {
      summary: "Bad runtime reference.",
      assumptions: [],
      followUpQuestions: [],
      changes: [
        {
          operation: "create_runtime_evidence",
          summary: "Bad evidence",
          evidence: {
            id: "evidence-missing",
            label: "Missing",
            description: "",
            factIds: ["fact-missing"],
            reliability: "confirmed",
            playerVisibility: "hidden",
            discoveredByCharacterIds: [],
            sourceEntityIds: [],
            sourceNotes: "",
            notes: ""
          }
        },
        {
          operation: "delete_runtime_fact",
          summary: "Delete missing fact",
          id: "fact-missing"
        }
      ]
    };

    const deleted = applyAgentChangePlan(projectWithRuntime, deletePlan).project;
    const invalidErrors = validateAgentChangePlan(projectWithRuntime, invalidPlan).flatMap((item) => item.errors);

    expect(deleted.runtime.facts).toEqual([]);
    expect(deleted.runtime.evidence).toEqual([]);
    expect(invalidErrors).toContain("Runtime fact does not exist: fact-missing");
    expect(invalidErrors).toContain("Fact does not exist: fact-missing");
  });

  it("builds mode-specific NVIDIA system instructions for JSON-only change plans", () => {
    const storyPrompt = buildNvidiaSystemPrompt();
    const storySchema = JSON.stringify(buildAgentResponseSchema("story"));
    const runtimePrompt = buildNvidiaSystemPrompt("runtime_authoring");
    const runtimeSchema = JSON.stringify(buildAgentResponseSchema("runtime_authoring"));

    expect(storyPrompt).toContain("detailed thinking off");
    expect(storyPrompt).toContain("Return only valid JSON");
    expect(storyPrompt).toContain("structured change plan");
    expect(storySchema).toContain("create_entity");
    expect(storySchema).toContain("create_relationship");
    expect(storySchema).not.toContain("create_runtime_fact");

    expect(runtimePrompt).toContain("Runtime records live in project.runtime");
    expect(runtimePrompt).toContain("Never use create_entity");
    expect(runtimeSchema).toContain("create_runtime_fact");
    expect(runtimeSchema).toContain("update_runtime_evidence");
    expect(runtimeSchema).toContain("create_runtime_character_knowledge");
    expect(runtimeSchema).toContain("update_runtime_contradiction");
    expect(runtimeSchema).toContain("update_runtime_theory_rule");
    expect(runtimeSchema).not.toContain("create_entity");
    expect(runtimeSchema).not.toContain("create_relationship");
  });

  it("rejects story entity operations in runtime authoring mode with a clear error", () => {
    const project = createBlankProject("Runtime Guard", "game_story");
    const plan: AgentChangePlan = {
      summary: "Bad runtime plan.",
      assumptions: [],
      followUpQuestions: [],
      changes: [
        {
          operation: "create_entity",
          summary: "Create a fact as an entity",
          entity: {
            id: "fact-drag-marks",
            type: "fact",
            title: "Drag marks contradict murder site"
          }
        }
      ]
    };

    const errors = validateAgentChangePlan(project, plan, { mode: "runtime_authoring" }).flatMap((item) => item.errors);

    expect(errors).toEqual(["Runtime records must use create_runtime_* operations, not story entities."]);
  });

  it("parses NVIDIA Chat Completions JSON output into an agent change plan", () => {
    const plan = parseAgentResponsePayload({
      choices: [
        {
          message: {
            content:
              "```json\n" +
              JSON.stringify({
                summary: "Add a rival.",
                assumptions: [],
                followUpQuestions: [],
                changes: [
                  {
                    operation: "create_entity",
                    summary: "Create rival",
                    entity: {
                      id: "character-rival",
                      type: "character",
                      title: "Rival"
                    }
                  }
                ]
              }) +
              "\n```"
          }
        }
      ]
    });

    expect(plan.summary).toBe("Add a rival.");
    expect(plan.changes[0].operation).toBe("create_entity");
  });

  it("reports non-JSON chat completion output clearly", () => {
    expect(() =>
      parseAgentResponsePayload({
        choices: [
          {
            message: {
              content: "Here is the detailed thinking plan for the provided schema."
            }
          }
        ]
      })
    ).toThrow(/agent returned non-JSON content/i);
  });
});
