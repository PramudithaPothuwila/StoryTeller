import { describe, expect, it } from "vitest";
import { BUILT_IN_WORLD_RULE_TYPE_ID } from "../types";
import { addEntityToProject, createBlankProject, createStoryEntity, createStoryRelationship, setProjectModeInProject } from "./story";
import {
  AgentChangePlan,
  applyAgentChangePlan,
  buildAgentProjectContext,
  buildNvidiaSystemPrompt,
  parseAgentResponsePayload,
  validateAgentChangePlan
} from "./agent";

describe("agent project helpers", () => {
  it("builds a compact schema v6 project context with structured metadata", () => {
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

    expect(context.schemaVersion).toBe(6);
    expect(context.projectMode).toBe("game_story");
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

    expect(result.project.schemaVersion).toBe(6);
    expect(result.project.entities["character-rival"].title).toBe("Rival");
    expect(result.project.relationships.some((relationship) => relationship.id === "link-hero-rival")).toBe(true);
    expect(result.project.relationships.some((relationship) => relationship.startsAtEventId === event.id)).toBe(true);
    expect(result.changedEntityIds).toContain("character-rival");
    expect(result.changedRelationshipIds).toContain("link-hero-rival");
  });

  it("builds NVIDIA system instructions for JSON-only change plans", () => {
    const prompt = buildNvidiaSystemPrompt();

    expect(prompt).toContain("detailed thinking off");
    expect(prompt).toContain("Return only valid JSON");
    expect(prompt).toContain("structured change plan");
    expect(prompt).toContain("create_entity");
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
