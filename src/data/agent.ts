import {
  BUILT_IN_EVENT_TYPE_ID,
  GameStoryProjectMetadata,
  GraphPresence,
  ItemTypeId,
  LinkTypeId,
  STORY_PROJECT_SCHEMA_VERSION,
  StoryEntity,
  StoryProject,
  StoryRelationship,
  StoryRuntimeCharacterKnowledge,
  StoryRuntimeContradictionRule,
  StoryRuntimeEvidence,
  StoryRuntimeFact,
  StoryRuntimeTheoryRule,
  TimelineEffectDraft
} from "../types";
import {
  addEntityToProject,
  applyTimelineEffectToProject,
  createStoryRuntimeContradictionRule,
  createStoryRuntimeEvidence,
  createStoryRuntimeFact,
  createStoryRuntimeTheoryRule,
  createStoryRelationship,
  deleteRuntimeEvidenceFromProject,
  deleteRuntimeFactFromProject,
  ensureEntityDefaults,
  findLinkType,
  isGameStoryItemType,
  isGameStoryLinkType,
  nextEntityPosition,
  normalizeStoryRuntimeCharacterKnowledge,
  normalizeStoryRuntimeContradictionRule,
  normalizeStoryRuntimeEvidence,
  normalizeStoryRuntimeFact,
  normalizeStoryRuntimeTheoryRule,
  normalizeRelationship,
  nowIso,
  touchProject,
  updateEntityInProject,
  updateGameStoryProjectMetadata,
  updateRelationshipInProject
} from "./story";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface AgentChangePlan {
  summary: string;
  assumptions: string[];
  changes: AgentChange[];
  followUpQuestions: string[];
}

export type AgentMode = "story" | "runtime_authoring";

export interface AgentRequestOptions {
  mode?: AgentMode;
}

export type AgentChange =
  | AgentCreateEntityChange
  | AgentUpdateEntityChange
  | AgentCreateRelationshipChange
  | AgentUpdateRelationshipChange
  | AgentTimelineEffectChange
  | AgentUpdateGameStoryChange
  | AgentCreateRuntimeFactChange
  | AgentUpdateRuntimeFactChange
  | AgentDeleteRuntimeFactChange
  | AgentCreateRuntimeEvidenceChange
  | AgentUpdateRuntimeEvidenceChange
  | AgentDeleteRuntimeEvidenceChange
  | AgentCreateRuntimeCharacterKnowledgeChange
  | AgentUpdateRuntimeCharacterKnowledgeChange
  | AgentDeleteRuntimeCharacterKnowledgeChange
  | AgentCreateRuntimeContradictionChange
  | AgentUpdateRuntimeContradictionChange
  | AgentDeleteRuntimeContradictionChange
  | AgentCreateRuntimeTheoryRuleChange
  | AgentUpdateRuntimeTheoryRuleChange
  | AgentDeleteRuntimeTheoryRuleChange;

export interface AgentCreateEntityChange {
  operation: "create_entity";
  summary: string;
  entity: AgentEntityInput;
}

export interface AgentUpdateEntityChange {
  operation: "update_entity";
  summary: string;
  id: string;
  patch: Partial<AgentEntityInput>;
}

export interface AgentCreateRelationshipChange {
  operation: "create_relationship";
  summary: string;
  relationship: AgentRelationshipInput;
}

export interface AgentUpdateRelationshipChange {
  operation: "update_relationship";
  summary: string;
  id: string;
  patch: Partial<AgentRelationshipInput>;
}

export interface AgentTimelineEffectChange {
  operation: "add_timeline_effect";
  summary: string;
  eventId: string;
  effect: TimelineEffectDraft;
}

export interface AgentUpdateGameStoryChange {
  operation: "update_game_story";
  summary: string;
  patch: Partial<GameStoryProjectMetadata>;
}

export interface AgentCreateRuntimeFactChange {
  operation: "create_runtime_fact";
  summary: string;
  fact: StoryRuntimeFact;
}

export interface AgentUpdateRuntimeFactChange {
  operation: "update_runtime_fact";
  summary: string;
  id: string;
  patch: Partial<StoryRuntimeFact>;
}

export interface AgentDeleteRuntimeFactChange {
  operation: "delete_runtime_fact";
  summary: string;
  id: string;
}

export interface AgentCreateRuntimeEvidenceChange {
  operation: "create_runtime_evidence";
  summary: string;
  evidence: StoryRuntimeEvidence;
}

export interface AgentUpdateRuntimeEvidenceChange {
  operation: "update_runtime_evidence";
  summary: string;
  id: string;
  patch: Partial<StoryRuntimeEvidence>;
}

export interface AgentDeleteRuntimeEvidenceChange {
  operation: "delete_runtime_evidence";
  summary: string;
  id: string;
}

export interface AgentCreateRuntimeCharacterKnowledgeChange {
  operation: "create_runtime_character_knowledge";
  summary: string;
  knowledge: StoryRuntimeCharacterKnowledge;
}

export interface AgentUpdateRuntimeCharacterKnowledgeChange {
  operation: "update_runtime_character_knowledge";
  summary: string;
  id: string;
  patch: Partial<StoryRuntimeCharacterKnowledge>;
}

export interface AgentDeleteRuntimeCharacterKnowledgeChange {
  operation: "delete_runtime_character_knowledge";
  summary: string;
  id: string;
}

export interface AgentCreateRuntimeContradictionChange {
  operation: "create_runtime_contradiction";
  summary: string;
  contradiction: StoryRuntimeContradictionRule;
}

export interface AgentUpdateRuntimeContradictionChange {
  operation: "update_runtime_contradiction";
  summary: string;
  id: string;
  patch: Partial<StoryRuntimeContradictionRule>;
}

export interface AgentDeleteRuntimeContradictionChange {
  operation: "delete_runtime_contradiction";
  summary: string;
  id: string;
}

export interface AgentCreateRuntimeTheoryRuleChange {
  operation: "create_runtime_theory_rule";
  summary: string;
  theoryRule: StoryRuntimeTheoryRule;
}

export interface AgentUpdateRuntimeTheoryRuleChange {
  operation: "update_runtime_theory_rule";
  summary: string;
  id: string;
  patch: Partial<StoryRuntimeTheoryRule>;
}

export interface AgentDeleteRuntimeTheoryRuleChange {
  operation: "delete_runtime_theory_rule";
  summary: string;
  id: string;
}

export interface AgentEntityInput extends Partial<Omit<StoryEntity, "createdAt" | "updatedAt">> {
  id: string;
  type: ItemTypeId;
  title: string;
}

export interface AgentRelationshipInput extends Partial<StoryRelationship> {
  id: string;
  sourceId: string;
  targetId: string;
  type: LinkTypeId;
}

export interface AgentChangeValidation {
  change: AgentChange;
  index: number;
  errors: string[];
}

export interface AgentApplyResult {
  project: StoryProject;
  changedEntityIds: string[];
  changedRelationshipIds: string[];
}

interface RuntimeIdState {
  factIds: Set<string>;
  evidenceIds: Set<string>;
  knowledgeIds: Set<string>;
  contradictionIds: Set<string>;
  theoryRuleIds: Set<string>;
}

interface AgentProjectContext {
  agentMode: AgentMode;
  schemaVersion: typeof STORY_PROJECT_SCHEMA_VERSION;
  title: string;
  projectMode: StoryProject["projectMode"];
  itemTypes: StoryProject["itemTypes"];
  linkTypes: StoryProject["linkTypes"];
  timelineLaneNames: string[];
  gameStory?: StoryProject["gameStory"];
  runtime: StoryProject["runtime"];
  entities: Array<
    Pick<
      StoryEntity,
      | "id"
      | "type"
      | "graphPresence"
      | "title"
      | "summary"
      | "tags"
      | "publicInfo"
      | "privateInfo"
      | "timeline"
      | "worldRule"
      | "gameStory"
    > & { bodyMarkdown: string }
  >;
  relationships: StoryRelationship[];
}

const BODY_EXCERPT_LENGTH = 700;
const RUNTIME_CONTEXT_EXCERPT_LENGTH = 4000;
const RUNTIME_AUTHORING_STORY_OPERATION_ERROR =
  "Runtime records must use create_runtime_* operations, not story entities.";

export function buildAgentSystemPrompt(mode: AgentMode = "story"): string {
  const shared = [
    "You are the in-app AI story agent for StoryTeller, a local-first story planning workspace.",
    "Preserve the user's creative intent. Suggest focused structural edits instead of rewriting the whole story.",
    "Return only a structured change plan matching the supplied schema."
  ];

  if (mode === "runtime_authoring") {
    return [
      ...shared,
      "Runtime records live in project.runtime, not project.entities.",
      "Never use create_entity, update_entity, create_relationship, or update_relationship for facts, evidence, character knowledge, contradiction rules, or theory rules.",
      "Use only runtime CRUD operations: create_runtime_fact, update_runtime_fact, delete_runtime_fact, create_runtime_evidence, update_runtime_evidence, delete_runtime_evidence, create_runtime_character_knowledge, update_runtime_character_knowledge, delete_runtime_character_knowledge, create_runtime_contradiction, update_runtime_contradiction, delete_runtime_contradiction, create_runtime_theory_rule, update_runtime_theory_rule, delete_runtime_theory_rule.",
      "Runtime deletes are allowed only for runtime records. Never delete story entities or relationships.",
      "Use stable kebab-case IDs for new runtime records."
    ].join("\n");
  }

  return [
    ...shared,
    "Do not include destructive operations. Do not delete entities, relationships, files, or raw project data.",
    "Use existing item and link type IDs from the project context. Use stable kebab-case IDs for new entities and relationships.",
    "Every create_entity operation must include entity.id, entity.type, and entity.title.",
    "Every create_relationship operation must include relationship.id, sourceId, targetId, and type.",
    "Use privateInfo for author-only secrets and publicInfo for audience/player-facing facts.",
    "For game-story projects, use graphPresence to place each item in the world graph, story_flow graph, or both."
  ].join("\n");
}

export const AGENT_SYSTEM_PROMPT = buildAgentSystemPrompt("story");

export const DEFAULT_NVIDIA_AGENT_MODEL = "meta/llama-3.2-1b-instruct";

export function buildAgentResponseSchema(mode: AgentMode = "story") {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      assumptions: { type: "array", items: { type: "string" } },
      followUpQuestions: { type: "array", items: { type: "string" } },
      changes: {
        type: "array",
        items: {
          anyOf: mode === "runtime_authoring" ? runtimeChangeSchemas() : storyChangeSchemas()
        }
      }
    },
    required: ["summary", "assumptions", "changes", "followUpQuestions"]
  };
}

export function buildAgentResponseFormat(mode: AgentMode = "story") {
  return {
    type: "json_schema",
    name: "storyteller_agent_change_plan",
    strict: true,
    schema: buildAgentResponseSchema(mode)
  } as const;
}

export const AGENT_RESPONSE_FORMAT = buildAgentResponseFormat("story");

export function buildAgentProjectContext(project: StoryProject, options: AgentRequestOptions = {}): AgentProjectContext {
  const mode = options.mode ?? "story";
  const textLimit = mode === "runtime_authoring" ? RUNTIME_CONTEXT_EXCERPT_LENGTH : BODY_EXCERPT_LENGTH;

  return {
    agentMode: mode,
    schemaVersion: project.schemaVersion,
    title: project.title,
    projectMode: project.projectMode,
    itemTypes: project.itemTypes,
    linkTypes: project.linkTypes,
    timelineLaneNames: project.timelineLaneNames,
    gameStory: project.gameStory,
    runtime: project.runtime,
    entities: Object.values(project.entities).map((entity) => ({
      id: entity.id,
      type: entity.type,
      graphPresence: entity.graphPresence,
      title: entity.title,
      summary: mode === "runtime_authoring" ? excerpt(entity.summary, textLimit) : entity.summary,
      tags: entity.tags,
      publicInfo: mode === "runtime_authoring" ? excerpt(entity.publicInfo, textLimit) : entity.publicInfo,
      privateInfo: mode === "runtime_authoring" ? excerpt(entity.privateInfo, textLimit) : entity.privateInfo,
      bodyMarkdown: excerpt(entity.bodyMarkdown, textLimit),
      timeline: entity.timeline,
      worldRule: entity.worldRule,
      gameStory: entity.gameStory
    })),
    relationships: project.relationships
  };
}

export function buildAgentInput(project: StoryProject, userPrompt: string, options: AgentRequestOptions = {}): string {
  return JSON.stringify(
    {
      task: userPrompt,
      agentMode: options.mode ?? "story",
      project: buildAgentProjectContext(project, options)
    },
    null,
    2
  );
}

export function normalizeAgentChangePlan(value: unknown): AgentChangePlan {
  const record = objectRecord(value, "Agent response must be an object.");
  const changes = arrayValue(record.changes, "changes").map(normalizeAgentChange);

  return {
    summary: stringValue(record.summary, "summary"),
    assumptions: arrayValue(record.assumptions, "assumptions").map((item) => stringValue(item, "assumption")),
    changes,
    followUpQuestions: arrayValue(record.followUpQuestions, "followUpQuestions").map((item) =>
      stringValue(item, "followUpQuestion")
    )
  };
}

export function parseAgentResponsePayload(payload: unknown): AgentChangePlan {
  const parsed = objectRecord(payload, "Response payload must be an object.");

  const chatCompletionPlan = parseChatCompletionPayload(parsed);

  if (chatCompletionPlan) {
    return chatCompletionPlan;
  }

  if (typeof parsed.output_parsed === "object" && parsed.output_parsed !== null) {
    return normalizeAgentChangePlan(parsed.output_parsed);
  }

  if (typeof parsed.output_text === "string" && parsed.output_text.trim()) {
    return normalizeAgentChangePlan(JSON.parse(parsed.output_text));
  }

  const output = Array.isArray(parsed.output) ? parsed.output : [];

  for (const item of output) {
    const itemRecord = isRecord(item) ? item : {};
    const content = Array.isArray(itemRecord.content) ? itemRecord.content : [];

    for (const contentItem of content) {
      if (!isRecord(contentItem)) {
        continue;
      }

      if (typeof contentItem.parsed === "object" && contentItem.parsed !== null) {
        return normalizeAgentChangePlan(contentItem.parsed);
      }

      if (typeof contentItem.text === "string" && contentItem.text.trim()) {
        return normalizeAgentChangePlan(JSON.parse(contentItem.text));
      }
    }
  }

  throw new Error("The agent response did not include a structured change plan.");
}

function parseChatCompletionPayload(parsed: Record<string, unknown>): AgentChangePlan | null {
  const choices = Array.isArray(parsed.choices) ? parsed.choices : [];

  for (const choice of choices) {
    if (!isRecord(choice) || !isRecord(choice.message)) {
      continue;
    }

    const content = choice.message.content;

    if (typeof content === "string" && content.trim()) {
      try {
        return normalizeAgentChangePlan(JSON.parse(cleanJsonText(content)));
      } catch (error) {
        throw new Error(`The agent returned non-JSON content instead of a change plan: ${excerptForError(content)}`);
      }
    }
  }

  return null;
}

export function validateAgentChangePlan(
  project: StoryProject,
  plan: AgentChangePlan,
  options: AgentRequestOptions = {}
): AgentChangeValidation[] {
  const entityIds = new Set(Object.keys(project.entities));
  const relationshipIds = new Set(project.relationships.map((relationship) => relationship.id));
  const runtimeIds = runtimeIdState(project);

  return plan.changes.map((change, index) => {
    const errors = validateAgentChange(project, change, entityIds, relationshipIds, runtimeIds, options);

    if (change.operation === "create_entity") {
      entityIds.add(change.entity.id);
    }

    if (change.operation === "create_relationship") {
      relationshipIds.add(change.relationship.id);
    }

    if (change.operation === "add_timeline_effect" && change.effect.action === "start") {
      relationshipIds.add(`timeline-start-${index}`);
    }

    updateRuntimeIdState(change, runtimeIds, errors);

    return { change, index, errors };
  });
}

export function applyAgentChangePlan(
  project: StoryProject,
  plan: AgentChangePlan,
  options: AgentRequestOptions = {}
): AgentApplyResult {
  const validation = validateAgentChangePlan(project, plan, options);
  const firstInvalid = validation.find((item) => item.errors.length);

  if (firstInvalid) {
    throw new Error(firstInvalid.errors[0]);
  }

  let nextProject = project;
  const changedEntityIds: string[] = [];
  const changedRelationshipIds: string[] = [];

  for (const change of plan.changes) {
    if (change.operation === "create_entity") {
      const entity = createEntityFromAgentInput(change.entity);
      nextProject = addEntityToProject(nextProject, entity, nextEntityPosition(nextProject));
      changedEntityIds.push(entity.id);
    }

    if (change.operation === "update_entity") {
      nextProject = updateEntityInProject(nextProject, change.id, sanitizeEntityPatch(change.patch));
      changedEntityIds.push(change.id);
    }

    if (change.operation === "create_relationship") {
      const relationship = createRelationshipFromAgentInput(nextProject, change.relationship);
      nextProject = touchProject({
        ...nextProject,
        relationships: [...nextProject.relationships, relationship]
      });
      changedRelationshipIds.push(relationship.id);
    }

    if (change.operation === "update_relationship") {
      nextProject = updateRelationshipInProject(nextProject, change.id, sanitizeRelationshipPatch(change.patch));
      changedRelationshipIds.push(change.id);
    }

    if (change.operation === "add_timeline_effect") {
      const result = applyTimelineEffectToProject(nextProject, change.eventId, change.effect);
      nextProject = result.project;

      if (result.relationshipId) {
        changedRelationshipIds.push(result.relationshipId);
      }
    }

    if (change.operation === "update_game_story") {
      nextProject = updateGameStoryProjectMetadata(nextProject, change.patch);
    }

    if (change.operation === "create_runtime_fact") {
      nextProject = touchProject({
        ...nextProject,
        runtime: {
          ...nextProject.runtime,
          facts: [...nextProject.runtime.facts, normalizeStoryRuntimeFact({ ...createStoryRuntimeFact(), ...change.fact })]
        }
      });
    }

    if (change.operation === "update_runtime_fact") {
      nextProject = touchProject({
        ...nextProject,
        runtime: {
          ...nextProject.runtime,
          facts: nextProject.runtime.facts.map((fact) =>
            fact.id === change.id ? normalizeStoryRuntimeFact({ ...fact, ...change.patch, id: fact.id }) : fact
          )
        }
      });
    }

    if (change.operation === "delete_runtime_fact") {
      nextProject = deleteRuntimeFactFromProject(nextProject, change.id);
    }

    if (change.operation === "create_runtime_evidence") {
      nextProject = touchProject({
        ...nextProject,
        runtime: {
          ...nextProject.runtime,
          evidence: [
            ...nextProject.runtime.evidence,
            normalizeStoryRuntimeEvidence({ ...createStoryRuntimeEvidence(), ...change.evidence })
          ]
        }
      });
    }

    if (change.operation === "update_runtime_evidence") {
      nextProject = touchProject({
        ...nextProject,
        runtime: {
          ...nextProject.runtime,
          evidence: nextProject.runtime.evidence.map((evidence) =>
            evidence.id === change.id ? normalizeStoryRuntimeEvidence({ ...evidence, ...change.patch, id: evidence.id }) : evidence
          )
        }
      });
    }

    if (change.operation === "delete_runtime_evidence") {
      nextProject = deleteRuntimeEvidenceFromProject(nextProject, change.id);
    }

    if (change.operation === "create_runtime_character_knowledge") {
      nextProject = touchProject({
        ...nextProject,
        runtime: {
          ...nextProject.runtime,
          characterKnowledge: [
            ...nextProject.runtime.characterKnowledge,
            normalizeStoryRuntimeCharacterKnowledge(change.knowledge)
          ]
        }
      });
    }

    if (change.operation === "update_runtime_character_knowledge") {
      nextProject = touchProject({
        ...nextProject,
        runtime: {
          ...nextProject.runtime,
          characterKnowledge: nextProject.runtime.characterKnowledge.map((knowledge) =>
            knowledge.id === change.id
              ? normalizeStoryRuntimeCharacterKnowledge({ ...knowledge, ...change.patch, id: knowledge.id })
              : knowledge
          )
        }
      });
    }

    if (change.operation === "delete_runtime_character_knowledge") {
      nextProject = touchProject({
        ...nextProject,
        runtime: {
          ...nextProject.runtime,
          characterKnowledge: nextProject.runtime.characterKnowledge.filter((knowledge) => knowledge.id !== change.id)
        }
      });
    }

    if (change.operation === "create_runtime_contradiction") {
      nextProject = touchProject({
        ...nextProject,
        runtime: {
          ...nextProject.runtime,
          contradictionRules: [
            ...nextProject.runtime.contradictionRules,
            normalizeStoryRuntimeContradictionRule({ ...createStoryRuntimeContradictionRule(), ...change.contradiction })
          ]
        }
      });
    }

    if (change.operation === "update_runtime_contradiction") {
      nextProject = touchProject({
        ...nextProject,
        runtime: {
          ...nextProject.runtime,
          contradictionRules: nextProject.runtime.contradictionRules.map((rule) =>
            rule.id === change.id ? normalizeStoryRuntimeContradictionRule({ ...rule, ...change.patch, id: rule.id }) : rule
          )
        }
      });
    }

    if (change.operation === "delete_runtime_contradiction") {
      nextProject = touchProject({
        ...nextProject,
        runtime: {
          ...nextProject.runtime,
          contradictionRules: nextProject.runtime.contradictionRules.filter((rule) => rule.id !== change.id)
        }
      });
    }

    if (change.operation === "create_runtime_theory_rule") {
      nextProject = touchProject({
        ...nextProject,
        runtime: {
          ...nextProject.runtime,
          theoryRules: [
            ...nextProject.runtime.theoryRules,
            normalizeStoryRuntimeTheoryRule({ ...createStoryRuntimeTheoryRule(), ...change.theoryRule })
          ]
        }
      });
    }

    if (change.operation === "update_runtime_theory_rule") {
      nextProject = touchProject({
        ...nextProject,
        runtime: {
          ...nextProject.runtime,
          theoryRules: nextProject.runtime.theoryRules.map((rule) =>
            rule.id === change.id ? normalizeStoryRuntimeTheoryRule({ ...rule, ...change.patch, id: rule.id }) : rule
          )
        }
      });
    }

    if (change.operation === "delete_runtime_theory_rule") {
      nextProject = touchProject({
        ...nextProject,
        runtime: {
          ...nextProject.runtime,
          theoryRules: nextProject.runtime.theoryRules.filter((rule) => rule.id !== change.id)
        }
      });
    }
  }

  return {
    project: nextProject,
    changedEntityIds,
    changedRelationshipIds
  };
}

function validateAgentChange(
  project: StoryProject,
  change: AgentChange,
  entityIds: Set<string>,
  relationshipIds: Set<string>,
  runtimeIds: RuntimeIdState,
  options: AgentRequestOptions = {}
): string[] {
  const errors: string[] = [];

  if (!change.summary.trim()) {
    errors.push("Change summary is required.");
  }

  if (options.mode === "runtime_authoring" && isStoryOperation(change)) {
    errors.push(RUNTIME_AUTHORING_STORY_OPERATION_ERROR);
    return errors;
  }

  if (change.operation === "create_entity") {
    validateNewEntity(project, change.entity, entityIds, errors);
  }

  if (change.operation === "update_entity") {
    if (!entityIds.has(change.id)) {
      errors.push(`Entity does not exist: ${change.id}`);
    }

    validateEntityPatch(project, change.id, change.patch, errors);
  }

  if (change.operation === "create_relationship") {
    validateNewRelationship(project, change.relationship, entityIds, relationshipIds, errors);
  }

  if (change.operation === "update_relationship") {
    if (!relationshipIds.has(change.id)) {
      errors.push(`Relationship does not exist: ${change.id}`);
    }

    validateRelationshipPatch(project, change.patch, entityIds, errors);
  }

  if (change.operation === "add_timeline_effect") {
    validateTimelineEffect(project, change.eventId, change.effect, entityIds, relationshipIds, errors);
  }

  if (change.operation === "update_game_story") {
    if (project.projectMode !== "game_story") {
      errors.push("Game story metadata can only be updated in Game Story mode.");
    }

    if (change.patch.startNodeId && !entityIds.has(change.patch.startNodeId)) {
      errors.push(`Game story start node does not exist: ${change.patch.startNodeId}`);
    }
  }

  validateRuntimeChange(change, entityIds, runtimeIds, errors);

  return errors;
}

function validateNewEntity(
  project: StoryProject,
  entity: AgentEntityInput,
  entityIds: Set<string>,
  errors: string[]
) {
  if (!isSafeId(entity.id)) {
    errors.push("New entity ID must be kebab-case.");
  }

  if (entityIds.has(entity.id)) {
    errors.push(`Entity already exists: ${entity.id}`);
  }

  if (!project.itemTypes.some((type) => type.id === entity.type)) {
    errors.push(`Unknown item type: ${entity.type}`);
  }

  if (!entity.title.trim()) {
    errors.push("New entity title is required.");
  }

  validateGraphPresenceForType(project, entity.type, entity.graphPresence, errors);
}

function validateEntityPatch(project: StoryProject, entityId: string, patch: Partial<AgentEntityInput>, errors: string[]) {
  if (patch.type && !project.itemTypes.some((type) => type.id === patch.type)) {
    errors.push(`Unknown item type: ${patch.type}`);
  }

  if (patch.type || patch.graphPresence) {
    validateGraphPresenceForType(project, patch.type ?? project.entities[entityId]?.type ?? "", patch.graphPresence, errors);
  }
}

function validateGraphPresenceForType(
  project: StoryProject,
  type: string,
  graphPresence: GraphPresence | undefined,
  errors: string[]
) {
  if (!graphPresence) {
    return;
  }

  if (graphPresence !== "world" && graphPresence !== "story_flow" && graphPresence !== "both") {
    errors.push(`Invalid graph presence: ${graphPresence}`);
  }

  if (project.projectMode !== "game_story" && graphPresence === "story_flow") {
    errors.push("Story flow graph presence requires Game Story mode.");
  }

}

function validateNewRelationship(
  project: StoryProject,
  relationship: AgentRelationshipInput,
  entityIds: Set<string>,
  relationshipIds: Set<string>,
  errors: string[]
) {
  if (!isSafeId(relationship.id)) {
    errors.push("New relationship ID must be kebab-case.");
  }

  if (relationshipIds.has(relationship.id)) {
    errors.push(`Relationship already exists: ${relationship.id}`);
  }

  validateRelationshipEndpointsAndType(project, relationship, entityIds, errors);
}

function validateRelationshipPatch(
  project: StoryProject,
  patch: Partial<AgentRelationshipInput>,
  entityIds: Set<string>,
  errors: string[]
) {
  validateRelationshipEndpointsAndType(project, patch, entityIds, errors);
}

function validateRelationshipEndpointsAndType(
  project: StoryProject,
  relationship: Partial<AgentRelationshipInput>,
  entityIds: Set<string>,
  errors: string[]
) {
  if (relationship.sourceId && !entityIds.has(relationship.sourceId)) {
    errors.push(`Relationship source does not exist: ${relationship.sourceId}`);
  }

  if (relationship.targetId && !entityIds.has(relationship.targetId)) {
    errors.push(`Relationship target does not exist: ${relationship.targetId}`);
  }

  if (relationship.type && !project.linkTypes.some((type) => type.id === relationship.type)) {
    errors.push(`Unknown link type: ${relationship.type}`);
  }

  if (relationship.type && isGameStoryLinkType(relationship.type) && project.projectMode !== "game_story") {
    errors.push("Game story link types require Game Story mode.");
  }

  if (relationship.startsAtEventId) {
    validateEventReference(project, relationship.startsAtEventId, "Relationship start event", errors);
  }

  if (relationship.endsAtEventId) {
    validateEventReference(project, relationship.endsAtEventId, "Relationship end event", errors);
  }
}

function validateTimelineEffect(
  project: StoryProject,
  eventId: string,
  effect: TimelineEffectDraft,
  entityIds: Set<string>,
  relationshipIds: Set<string>,
  errors: string[]
) {
  const event = project.entities[eventId];

  if (!event || event.type !== BUILT_IN_EVENT_TYPE_ID) {
    errors.push(`Timeline event does not exist: ${eventId}`);
  }

  if (effect.action === "start") {
    if (!entityIds.has(effect.sourceId)) {
      errors.push(`Timeline start source does not exist: ${effect.sourceId}`);
    }

    if (!entityIds.has(effect.targetId)) {
      errors.push(`Timeline start target does not exist: ${effect.targetId}`);
    }

    if (!project.linkTypes.some((type) => type.id === effect.type)) {
      errors.push(`Unknown timeline link type: ${effect.type}`);
    }
  }

  if ((effect.action === "update" || effect.action === "end") && !relationshipIds.has(effect.relationshipId)) {
    errors.push(`Timeline relationship does not exist: ${effect.relationshipId}`);
  }

  if (effect.action === "update" && effect.type && !project.linkTypes.some((type) => type.id === effect.type)) {
    errors.push(`Unknown timeline update link type: ${effect.type}`);
  }
}

function validateRuntimeChange(
  change: AgentChange,
  entityIds: Set<string>,
  runtimeIds: RuntimeIdState,
  errors: string[]
) {
  if (change.operation === "create_runtime_fact") {
    validateRuntimeCreateId(change.fact.id, runtimeIds.factIds, "Fact", errors);
    validateRuntimeFactReferences(change.fact, entityIds, errors);
  }

  if (change.operation === "update_runtime_fact") {
    validateRuntimeExistingId(change.id, runtimeIds.factIds, "Fact", errors);
    validateRuntimeFactReferences(change.patch, entityIds, errors);
  }

  if (change.operation === "delete_runtime_fact") {
    validateRuntimeExistingId(change.id, runtimeIds.factIds, "Fact", errors);
  }

  if (change.operation === "create_runtime_evidence") {
    validateRuntimeCreateId(change.evidence.id, runtimeIds.evidenceIds, "Evidence", errors);
    validateRuntimeEvidenceReferences(change.evidence, entityIds, runtimeIds, errors);
  }

  if (change.operation === "update_runtime_evidence") {
    validateRuntimeExistingId(change.id, runtimeIds.evidenceIds, "Evidence", errors);
    validateRuntimeEvidenceReferences(change.patch, entityIds, runtimeIds, errors);
  }

  if (change.operation === "delete_runtime_evidence") {
    validateRuntimeExistingId(change.id, runtimeIds.evidenceIds, "Evidence", errors);
  }

  if (change.operation === "create_runtime_character_knowledge") {
    validateRuntimeCreateId(change.knowledge.id, runtimeIds.knowledgeIds, "Knowledge row", errors);
    validateRuntimeKnowledgeReferences(change.knowledge, entityIds, runtimeIds, errors);
  }

  if (change.operation === "update_runtime_character_knowledge") {
    validateRuntimeExistingId(change.id, runtimeIds.knowledgeIds, "Knowledge row", errors);
    validateRuntimeKnowledgeReferences(change.patch, entityIds, runtimeIds, errors);
  }

  if (change.operation === "delete_runtime_character_knowledge") {
    validateRuntimeExistingId(change.id, runtimeIds.knowledgeIds, "Knowledge row", errors);
  }

  if (change.operation === "create_runtime_contradiction") {
    validateRuntimeCreateId(change.contradiction.id, runtimeIds.contradictionIds, "Contradiction rule", errors);
    validateFactIds(change.contradiction.factIds, runtimeIds, errors);
  }

  if (change.operation === "update_runtime_contradiction") {
    validateRuntimeExistingId(change.id, runtimeIds.contradictionIds, "Contradiction rule", errors);
    validateFactIds(change.patch.factIds, runtimeIds, errors);
  }

  if (change.operation === "delete_runtime_contradiction") {
    validateRuntimeExistingId(change.id, runtimeIds.contradictionIds, "Contradiction rule", errors);
  }

  if (change.operation === "create_runtime_theory_rule") {
    validateRuntimeCreateId(change.theoryRule.id, runtimeIds.theoryRuleIds, "Theory rule", errors);
    validateRuntimeTheoryReferences(change.theoryRule, runtimeIds, errors);
  }

  if (change.operation === "update_runtime_theory_rule") {
    validateRuntimeExistingId(change.id, runtimeIds.theoryRuleIds, "Theory rule", errors);
    validateRuntimeTheoryReferences(change.patch, runtimeIds, errors);
  }

  if (change.operation === "delete_runtime_theory_rule") {
    validateRuntimeExistingId(change.id, runtimeIds.theoryRuleIds, "Theory rule", errors);
  }
}

function runtimeIdState(project: StoryProject): RuntimeIdState {
  return {
    factIds: new Set(project.runtime.facts.map((fact) => fact.id)),
    evidenceIds: new Set(project.runtime.evidence.map((evidence) => evidence.id)),
    knowledgeIds: new Set(project.runtime.characterKnowledge.map((knowledge) => knowledge.id)),
    contradictionIds: new Set(project.runtime.contradictionRules.map((rule) => rule.id)),
    theoryRuleIds: new Set(project.runtime.theoryRules.map((rule) => rule.id))
  };
}

function updateRuntimeIdState(change: AgentChange, runtimeIds: RuntimeIdState, errors: string[]) {
  if (errors.length) {
    return;
  }

  if (change.operation === "create_runtime_fact") runtimeIds.factIds.add(change.fact.id);
  if (change.operation === "delete_runtime_fact") runtimeIds.factIds.delete(change.id);
  if (change.operation === "create_runtime_evidence") runtimeIds.evidenceIds.add(change.evidence.id);
  if (change.operation === "delete_runtime_evidence") runtimeIds.evidenceIds.delete(change.id);
  if (change.operation === "create_runtime_character_knowledge") runtimeIds.knowledgeIds.add(change.knowledge.id);
  if (change.operation === "delete_runtime_character_knowledge") runtimeIds.knowledgeIds.delete(change.id);
  if (change.operation === "create_runtime_contradiction") runtimeIds.contradictionIds.add(change.contradiction.id);
  if (change.operation === "delete_runtime_contradiction") runtimeIds.contradictionIds.delete(change.id);
  if (change.operation === "create_runtime_theory_rule") runtimeIds.theoryRuleIds.add(change.theoryRule.id);
  if (change.operation === "delete_runtime_theory_rule") runtimeIds.theoryRuleIds.delete(change.id);
}

function validateRuntimeCreateId(id: string, existingIds: Set<string>, label: string, errors: string[]) {
  if (!isSafeId(id)) {
    errors.push(`${label} ID must be kebab-case.`);
  }

  if (existingIds.has(id)) {
    errors.push(`${label} already exists: ${id}`);
  }
}

function validateRuntimeExistingId(id: string, existingIds: Set<string>, label: string, errors: string[]) {
  if (!existingIds.has(id)) {
    errors.push(`${label} does not exist: ${id}`);
  }
}

function validateRuntimeFactReferences(
  fact: Partial<StoryRuntimeFact>,
  entityIds: Set<string>,
  errors: string[]
) {
  validateOptionalEntityId(fact.subjectEntityId, "Fact subject entity", entityIds, errors);
  validateOptionalEntityId(fact.objectEntityId, "Fact object entity", entityIds, errors);
  validateEntityIds(fact.sourceEntityIds, "Fact source entity", entityIds, errors);
}

function validateRuntimeEvidenceReferences(
  evidence: Partial<StoryRuntimeEvidence>,
  entityIds: Set<string>,
  runtimeIds: RuntimeIdState,
  errors: string[]
) {
  validateOptionalEntityId(evidence.entityId, "Evidence entity", entityIds, errors);
  validateFactIds(evidence.factIds, runtimeIds, errors);
  validateEntityIds(evidence.discoveredByCharacterIds, "Evidence discovered-by character", entityIds, errors);
  validateEntityIds(evidence.sourceEntityIds, "Evidence source entity", entityIds, errors);
}

function validateRuntimeKnowledgeReferences(
  knowledge: Partial<StoryRuntimeCharacterKnowledge>,
  entityIds: Set<string>,
  runtimeIds: RuntimeIdState,
  errors: string[]
) {
  validateOptionalEntityId(knowledge.characterId, "Knowledge character", entityIds, errors);
  if (knowledge.factId && !runtimeIds.factIds.has(knowledge.factId)) {
    errors.push(`Knowledge fact does not exist: ${knowledge.factId}`);
  }
  validateEvidenceIds(knowledge.evidenceIds, runtimeIds, errors);
}

function validateRuntimeTheoryReferences(
  rule: Partial<StoryRuntimeTheoryRule>,
  runtimeIds: RuntimeIdState,
  errors: string[]
) {
  validateEvidenceIds(rule.requiredEvidenceIds, runtimeIds, errors);
  validateFactIds(rule.supportingFactIds, runtimeIds, errors);
  validateFactIds(rule.contradictingFactIds, runtimeIds, errors);
}

function validateFactIds(ids: string[] | undefined, runtimeIds: RuntimeIdState, errors: string[]) {
  for (const id of ids ?? []) {
    if (!runtimeIds.factIds.has(id)) {
      errors.push(`Runtime fact does not exist: ${id}`);
    }
  }
}

function validateEvidenceIds(ids: string[] | undefined, runtimeIds: RuntimeIdState, errors: string[]) {
  for (const id of ids ?? []) {
    if (!runtimeIds.evidenceIds.has(id)) {
      errors.push(`Runtime evidence does not exist: ${id}`);
    }
  }
}

function validateEntityIds(ids: string[] | undefined, label: string, entityIds: Set<string>, errors: string[]) {
  for (const id of ids ?? []) {
    if (!entityIds.has(id)) {
      errors.push(`${label} does not exist: ${id}`);
    }
  }
}

function validateOptionalEntityId(id: string | undefined, label: string, entityIds: Set<string>, errors: string[]) {
  if (id && !entityIds.has(id)) {
    errors.push(`${label} does not exist: ${id}`);
  }
}

function createEntityFromAgentInput(input: AgentEntityInput): StoryEntity {
  const timestamp = nowIso();

  return ensureEntityDefaults({
    id: input.id,
    type: input.type,
    graphPresence: input.graphPresence ?? defaultGraphPresence(input.type),
    title: input.title,
    summary: input.summary ?? "",
    tags: input.tags ?? [],
    publicInfo: input.publicInfo ?? "",
    privateInfo: input.privateInfo ?? "",
    bodyMarkdown: input.bodyMarkdown ?? "",
    createdAt: timestamp,
    updatedAt: timestamp,
    timeline: input.timeline,
    worldRule: input.worldRule,
    gameStory: input.gameStory
  });
}

function createRelationshipFromAgentInput(project: StoryProject, input: AgentRelationshipInput): StoryRelationship {
  return normalizeRelationship({
    ...createStoryRelationship(project, input.sourceId, input.targetId, input.type),
    ...input,
    label: input.label ?? findLinkType(project, input.type).label,
    notes: input.notes ?? "",
    timelineVersions: input.timelineVersions ?? []
  });
}

function sanitizeEntityPatch(patch: Partial<AgentEntityInput>): Partial<StoryEntity> {
  const { id: _id, createdAt: _createdAt, ...safePatch } = patch as Partial<AgentEntityInput> & {
    createdAt?: string;
  };

  return safePatch;
}

function sanitizeRelationshipPatch(patch: Partial<AgentRelationshipInput>): Partial<StoryRelationship> {
  const { id: _id, sourceId: _sourceId, targetId: _targetId, ...safePatch } = patch;

  return safePatch;
}

function normalizeAgentChange(value: unknown): AgentChange {
  const record = objectRecord(value, "Change must be an object.");
  const operation = stringValue(record.operation, "operation");
  const summary = stringValue(record.summary, "summary");

  if (operation === "create_entity") {
    return {
      operation,
      summary,
      entity: normalizeEntityInput(record.entity)
    };
  }

  if (operation === "update_entity") {
    return {
      operation,
      summary,
      id: stringValue(record.id, "id"),
      patch: normalizeEntityPatch(record.patch)
    };
  }

  if (operation === "create_relationship") {
    return {
      operation,
      summary,
      relationship: normalizeRelationshipInput(record.relationship)
    };
  }

  if (operation === "update_relationship") {
    return {
      operation,
      summary,
      id: stringValue(record.id, "id"),
      patch: normalizeRelationshipPatch(record.patch)
    };
  }

  if (operation === "add_timeline_effect") {
    return {
      operation,
      summary,
      eventId: stringValue(record.eventId, "eventId"),
      effect: normalizeTimelineEffectDraft(record.effect)
    };
  }

  if (operation === "update_game_story") {
    return {
      operation,
      summary,
      patch: objectRecord(record.patch, "patch") as Partial<GameStoryProjectMetadata>
    };
  }

  if (operation === "create_runtime_fact") {
    return { operation, summary, fact: normalizeStoryRuntimeFact(objectRecord(record.fact, "fact") as Partial<StoryRuntimeFact>) };
  }

  if (operation === "update_runtime_fact") {
    return {
      operation,
      summary,
      id: stringValue(record.id, "id"),
      patch: normalizeStoryRuntimeFactPatch(record.patch)
    };
  }

  if (operation === "delete_runtime_fact") {
    return { operation, summary, id: stringValue(record.id, "id") };
  }

  if (operation === "create_runtime_evidence") {
    return {
      operation,
      summary,
      evidence: normalizeStoryRuntimeEvidence(objectRecord(record.evidence, "evidence") as Partial<StoryRuntimeEvidence>)
    };
  }

  if (operation === "update_runtime_evidence") {
    return {
      operation,
      summary,
      id: stringValue(record.id, "id"),
      patch: normalizeStoryRuntimeEvidencePatch(record.patch)
    };
  }

  if (operation === "delete_runtime_evidence") {
    return { operation, summary, id: stringValue(record.id, "id") };
  }

  if (operation === "create_runtime_character_knowledge") {
    return {
      operation,
      summary,
      knowledge: normalizeStoryRuntimeCharacterKnowledge(
        objectRecord(record.knowledge, "knowledge") as Partial<StoryRuntimeCharacterKnowledge>
      )
    };
  }

  if (operation === "update_runtime_character_knowledge") {
    return {
      operation,
      summary,
      id: stringValue(record.id, "id"),
      patch: normalizeStoryRuntimeCharacterKnowledgePatch(record.patch)
    };
  }

  if (operation === "delete_runtime_character_knowledge") {
    return { operation, summary, id: stringValue(record.id, "id") };
  }

  if (operation === "create_runtime_contradiction") {
    return {
      operation,
      summary,
      contradiction: normalizeStoryRuntimeContradictionRule(
        objectRecord(record.contradiction, "contradiction") as Partial<StoryRuntimeContradictionRule>
      )
    };
  }

  if (operation === "update_runtime_contradiction") {
    return {
      operation,
      summary,
      id: stringValue(record.id, "id"),
      patch: normalizeStoryRuntimeContradictionRulePatch(record.patch)
    };
  }

  if (operation === "delete_runtime_contradiction") {
    return { operation, summary, id: stringValue(record.id, "id") };
  }

  if (operation === "create_runtime_theory_rule") {
    return {
      operation,
      summary,
      theoryRule: normalizeStoryRuntimeTheoryRule(
        objectRecord(record.theoryRule, "theoryRule") as Partial<StoryRuntimeTheoryRule>
      )
    };
  }

  if (operation === "update_runtime_theory_rule") {
    return {
      operation,
      summary,
      id: stringValue(record.id, "id"),
      patch: normalizeStoryRuntimeTheoryRulePatch(record.patch)
    };
  }

  if (operation === "delete_runtime_theory_rule") {
    return { operation, summary, id: stringValue(record.id, "id") };
  }

  throw new Error(`Unsupported agent change operation: ${operation}`);
}

function normalizeEntityInput(value: unknown): AgentEntityInput {
  const record = objectRecord(value, "entity");

  return {
    ...record,
    id: stringValue(record.id, "entity.id"),
    type: stringValue(record.type, "entity.type"),
    title: stringValue(record.title, "entity.title"),
    tags: Array.isArray(record.tags) ? record.tags.map((tag) => stringValue(tag, "tag")) : undefined
  } as AgentEntityInput;
}

function normalizeEntityPatch(value: unknown): Partial<AgentEntityInput> {
  if (!isRecord(value)) {
    throw new Error("patch must be an object.");
  }

  return {
    ...value,
    tags: Array.isArray(value.tags) ? value.tags.map((tag) => stringValue(tag, "tag")) : undefined
  } as Partial<AgentEntityInput>;
}

function normalizeRelationshipInput(value: unknown): AgentRelationshipInput {
  const record = objectRecord(value, "relationship");

  return {
    ...record,
    id: stringValue(record.id, "relationship.id"),
    sourceId: stringValue(record.sourceId, "relationship.sourceId"),
    targetId: stringValue(record.targetId, "relationship.targetId"),
    type: stringValue(record.type, "relationship.type")
  } as AgentRelationshipInput;
}

function normalizeRelationshipPatch(value: unknown): Partial<AgentRelationshipInput> {
  return objectRecord(value, "patch") as Partial<AgentRelationshipInput>;
}

function normalizeStoryRuntimeFactPatch(value: unknown): Partial<StoryRuntimeFact> {
  return objectRecord(value, "patch") as Partial<StoryRuntimeFact>;
}

function normalizeStoryRuntimeEvidencePatch(value: unknown): Partial<StoryRuntimeEvidence> {
  return objectRecord(value, "patch") as Partial<StoryRuntimeEvidence>;
}

function normalizeStoryRuntimeCharacterKnowledgePatch(value: unknown): Partial<StoryRuntimeCharacterKnowledge> {
  return objectRecord(value, "patch") as Partial<StoryRuntimeCharacterKnowledge>;
}

function normalizeStoryRuntimeContradictionRulePatch(value: unknown): Partial<StoryRuntimeContradictionRule> {
  return objectRecord(value, "patch") as Partial<StoryRuntimeContradictionRule>;
}

function normalizeStoryRuntimeTheoryRulePatch(value: unknown): Partial<StoryRuntimeTheoryRule> {
  return objectRecord(value, "patch") as Partial<StoryRuntimeTheoryRule>;
}

function normalizeTimelineEffectDraft(value: unknown): TimelineEffectDraft {
  const record = objectRecord(value, "effect");
  const action = stringValue(record.action, "effect.action");

  if (action === "start") {
    return {
      action,
      sourceId: stringValue(record.sourceId, "effect.sourceId"),
      targetId: stringValue(record.targetId, "effect.targetId"),
      type: stringValue(record.type, "effect.type"),
      label: stringValue(record.label, "effect.label"),
      notes: stringValue(record.notes, "effect.notes")
    };
  }

  if (action === "update") {
    return {
      action,
      relationshipId: stringValue(record.relationshipId, "effect.relationshipId"),
      type: optionalString(record.type),
      label: optionalString(record.label),
      notes: optionalString(record.notes)
    };
  }

  if (action === "end") {
    return {
      action,
      relationshipId: stringValue(record.relationshipId, "effect.relationshipId")
    };
  }

  throw new Error(`Unsupported timeline effect action: ${action}`);
}

function defaultGraphPresence(type: ItemTypeId): GraphPresence {
  return isGameStoryItemType(type) ? "story_flow" : "world";
}

function excerpt(markdown: string, length = BODY_EXCERPT_LENGTH): string {
  const normalized = markdown.trim();

  if (normalized.length <= length) {
    return normalized;
  }

  return `${normalized.slice(0, length)}...`;
}

function isSafeId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(label);
  }

  return value;
}

function arrayValue(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function buildNvidiaSystemPrompt(mode: AgentMode = "story"): string {
  return [
    "detailed thinking off",
    buildAgentSystemPrompt(mode),
    "Return only valid JSON. Do not wrap it in Markdown fences.",
    "The JSON must match this schema:",
    JSON.stringify(buildAgentResponseSchema(mode))
  ].join("\n");
}

function cleanJsonText(value: string): string {
  let cleaned = value.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return cleaned.slice(start, end + 1);
  }

  return cleaned;
}

function excerptForError(value: string): string {
  const singleLine = value.replace(/\s+/g, " ").trim();
  return singleLine.length > 180 ? `${singleLine.slice(0, 180)}...` : singleLine;
}

function validateEventReference(project: StoryProject, eventId: string, label: string, errors: string[]) {
  const event = project.entities[eventId];

  if (!event || event.type !== BUILT_IN_EVENT_TYPE_ID) {
    errors.push(`${label} does not exist: ${eventId}`);
  }
}

function isStoryOperation(change: AgentChange): boolean {
  return (
    change.operation === "create_entity" ||
    change.operation === "update_entity" ||
    change.operation === "create_relationship" ||
    change.operation === "update_relationship" ||
    change.operation === "add_timeline_effect" ||
    change.operation === "update_game_story"
  );
}

function storyChangeSchemas() {
  return [
    createEntitySchema(),
    updateEntitySchema(),
    createRelationshipSchema(),
    updateRelationshipSchema(),
    timelineEffectSchema(),
    updateGameStorySchema()
  ];
}

function runtimeChangeSchemas() {
  return [
    runtimeCreateSchema("create_runtime_fact", "fact", runtimeFactSchema(["id", "statement", "truth"])),
    runtimeUpdateSchema("update_runtime_fact", runtimeFactSchema([])),
    runtimeDeleteSchema("delete_runtime_fact"),
    runtimeCreateSchema("create_runtime_evidence", "evidence", runtimeEvidenceSchema(["id", "label"])),
    runtimeUpdateSchema("update_runtime_evidence", runtimeEvidenceSchema([])),
    runtimeDeleteSchema("delete_runtime_evidence"),
    runtimeCreateSchema(
      "create_runtime_character_knowledge",
      "knowledge",
      runtimeCharacterKnowledgeSchema(["id", "characterId", "factId", "knowledge", "belief"])
    ),
    runtimeUpdateSchema("update_runtime_character_knowledge", runtimeCharacterKnowledgeSchema([])),
    runtimeDeleteSchema("delete_runtime_character_knowledge"),
    runtimeCreateSchema("create_runtime_contradiction", "contradiction", runtimeContradictionSchema(["id", "label"])),
    runtimeUpdateSchema("update_runtime_contradiction", runtimeContradictionSchema([])),
    runtimeDeleteSchema("delete_runtime_contradiction"),
    runtimeCreateSchema("create_runtime_theory_rule", "theoryRule", runtimeTheoryRuleSchema(["id", "label", "conclusion"])),
    runtimeUpdateSchema("update_runtime_theory_rule", runtimeTheoryRuleSchema([])),
    runtimeDeleteSchema("delete_runtime_theory_rule")
  ];
}

function createEntitySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      operation: { const: "create_entity" },
      summary: { type: "string" },
      entity: entityInputSchema(["id", "type", "title"])
    },
    required: ["operation", "summary", "entity"]
  };
}

function updateEntitySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      operation: { const: "update_entity" },
      summary: { type: "string" },
      id: { type: "string" },
      patch: entityInputSchema([])
    },
    required: ["operation", "summary", "id", "patch"]
  };
}

function createRelationshipSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      operation: { const: "create_relationship" },
      summary: { type: "string" },
      relationship: relationshipInputSchema(["id", "sourceId", "targetId", "type"])
    },
    required: ["operation", "summary", "relationship"]
  };
}

function updateRelationshipSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      operation: { const: "update_relationship" },
      summary: { type: "string" },
      id: { type: "string" },
      patch: relationshipInputSchema([])
    },
    required: ["operation", "summary", "id", "patch"]
  };
}

function timelineEffectSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      operation: { const: "add_timeline_effect" },
      summary: { type: "string" },
      eventId: { type: "string" },
      effect: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              action: { const: "start" },
              sourceId: { type: "string" },
              targetId: { type: "string" },
              type: { type: "string" },
              label: { type: "string" },
              notes: { type: "string" }
            },
            required: ["action", "sourceId", "targetId", "type", "label", "notes"]
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              action: { const: "update" },
              relationshipId: { type: "string" },
              type: { type: "string" },
              label: { type: "string" },
              notes: { type: "string" }
            },
            required: ["action", "relationshipId"]
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              action: { const: "end" },
              relationshipId: { type: "string" }
            },
            required: ["action", "relationshipId"]
          }
        ]
      }
    },
    required: ["operation", "summary", "eventId", "effect"]
  };
}

function updateGameStorySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      operation: { const: "update_game_story" },
      summary: { type: "string" },
      patch: { type: "object" }
    },
    required: ["operation", "summary", "patch"]
  };
}

function entityInputSchema(required: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      type: { type: "string" },
      graphPresence: { enum: ["world", "story_flow", "both"] },
      title: { type: "string" },
      summary: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      publicInfo: { type: "string" },
      privateInfo: { type: "string" },
      bodyMarkdown: { type: "string" },
      timeline: { type: "object" },
      worldRule: { type: "object" },
      gameStory: { type: "object" }
    },
    required
  };
}

function relationshipInputSchema(required: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      sourceId: { type: "string" },
      targetId: { type: "string" },
      type: { type: "string" },
      label: { type: "string" },
      notes: { type: "string" },
      startsAtEventId: { type: "string" },
      endsAtEventId: { type: "string" },
      timelineVersions: { type: "array", items: { type: "object" } },
      gameStory: { type: "object" }
    },
    required
  };
}

function runtimeCreateSchema(operation: string, propertyName: string, recordSchema: Record<string, unknown>) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      operation: { const: operation },
      summary: { type: "string" },
      [propertyName]: recordSchema
    },
    required: ["operation", "summary", propertyName]
  };
}

function runtimeUpdateSchema(operation: string, patchSchema: Record<string, unknown>) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      operation: { const: operation },
      summary: { type: "string" },
      id: { type: "string" },
      patch: patchSchema
    },
    required: ["operation", "summary", "id", "patch"]
  };
}

function runtimeDeleteSchema(operation: string) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      operation: { const: operation },
      summary: { type: "string" },
      id: { type: "string" }
    },
    required: ["operation", "summary", "id"]
  };
}

function runtimeFactSchema(required: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      statement: { type: "string" },
      truth: { enum: ["true", "false", "ambiguous", "unknown"] },
      subjectEntityId: { type: "string" },
      objectEntityId: { type: "string" },
      sourceEntityIds: { type: "array", items: { type: "string" } },
      sourceNotes: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      notes: { type: "string" }
    },
    required
  };
}

function runtimeEvidenceSchema(required: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      label: { type: "string" },
      description: { type: "string" },
      entityId: { type: "string" },
      factIds: { type: "array", items: { type: "string" } },
      reliability: { enum: ["confirmed", "unverified", "misleading"] },
      playerVisibility: { enum: ["hidden", "discoverable", "revealed"] },
      discoveredByCharacterIds: { type: "array", items: { type: "string" } },
      sourceEntityIds: { type: "array", items: { type: "string" } },
      sourceNotes: { type: "string" },
      notes: { type: "string" }
    },
    required
  };
}

function runtimeCharacterKnowledgeSchema(required: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      characterId: { type: "string" },
      factId: { type: "string" },
      knowledge: { enum: ["knows", "suspects", "does_not_know"] },
      belief: { enum: ["believes_true", "believes_false", "uncertain", "unaware"] },
      evidenceIds: { type: "array", items: { type: "string" } },
      updatedAt: { type: "string" },
      notes: { type: "string" }
    },
    required
  };
}

function runtimeContradictionSchema(required: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      label: { type: "string" },
      factIds: { type: "array", items: { type: "string" } },
      severity: { enum: ["warning", "error"] },
      resolution: { type: "string" },
      notes: { type: "string" }
    },
    required
  };
}

function runtimeTheoryRuleSchema(required: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      label: { type: "string" },
      requiredEvidenceIds: { type: "array", items: { type: "string" } },
      supportingFactIds: { type: "array", items: { type: "string" } },
      contradictingFactIds: { type: "array", items: { type: "string" } },
      conclusion: { type: "string" },
      playerVisibility: { enum: ["hidden", "discoverable", "revealed"] },
      notes: { type: "string" }
    },
    required
  };
}
