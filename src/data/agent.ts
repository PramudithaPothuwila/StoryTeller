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
  TimelineEffectDraft
} from "../types";
import {
  addEntityToProject,
  applyTimelineEffectToProject,
  createStoryRelationship,
  ensureEntityDefaults,
  findLinkType,
  isGameStoryItemType,
  isGameStoryLinkType,
  nextEntityPosition,
  normalizeRelationship,
  nowIso,
  touchProject,
  updateEntityInProject,
  updateGameStoryProjectMetadata,
  updateRelationshipInProject
} from "./story";

export interface AgentSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: AgentProvider;
}

export type AgentProvider = "openai" | "nvidia";

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

export type AgentChange =
  | AgentCreateEntityChange
  | AgentUpdateEntityChange
  | AgentCreateRelationshipChange
  | AgentUpdateRelationshipChange
  | AgentTimelineEffectChange
  | AgentUpdateGameStoryChange;

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

interface AgentProjectContext {
  schemaVersion: typeof STORY_PROJECT_SCHEMA_VERSION;
  title: string;
  projectMode: StoryProject["projectMode"];
  itemTypes: StoryProject["itemTypes"];
  linkTypes: StoryProject["linkTypes"];
  timelineLaneNames: string[];
  gameStory?: StoryProject["gameStory"];
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
const ACTIVE_AGENT_PROVIDER = normalizeAgentProvider(import.meta.env.VITE_AGENT_PROVIDER);

const agentProviderDefaults: Record<AgentProvider, Omit<AgentSettings, "apiKey">> = {
  openai: {
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.5"
  },
  nvidia: {
    provider: "nvidia",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    model: "nvidia/llama-3.1-nemotron-nano-8b-v1"
  }
};

export const DEFAULT_AGENT_SETTINGS: AgentSettings = defaultAgentSettings();
export const AGENT_SETTINGS_STORAGE_KEY = "storyteller.agentSettings";

export const AGENT_SYSTEM_PROMPT = [
  "You are the in-app AI story agent for StoryTeller, a local-first story planning workspace.",
  "Preserve the user's creative intent. Suggest focused structural edits instead of rewriting the whole story.",
  "Return only a structured change plan matching the supplied schema.",
  "Do not include destructive operations. Do not delete entities, relationships, files, or raw project data.",
  "Use existing item and link type IDs from the project context. Use stable kebab-case IDs for new entities and relationships.",
  "Every create_entity operation must include entity.id, entity.type, and entity.title.",
  "Every create_relationship operation must include relationship.id, sourceId, targetId, and type.",
  "Use privateInfo for author-only secrets and publicInfo for audience/player-facing facts.",
  "For game-story projects, use graphPresence to place each item in the world graph, story_flow graph, or both."
].join("\n");

export const AGENT_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "storyteller_agent_change_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      assumptions: { type: "array", items: { type: "string" } },
      followUpQuestions: { type: "array", items: { type: "string" } },
      changes: {
        type: "array",
        items: {
          anyOf: [
            createEntitySchema(),
            updateEntitySchema(),
            createRelationshipSchema(),
            updateRelationshipSchema(),
            timelineEffectSchema(),
            updateGameStorySchema()
          ]
        }
      }
    },
    required: ["summary", "assumptions", "changes", "followUpQuestions"]
  }
} as const;

export function activeAgentProvider(): AgentProvider {
  return ACTIVE_AGENT_PROVIDER;
}

export function defaultAgentSettings(provider: AgentProvider = ACTIVE_AGENT_PROVIDER): AgentSettings {
  return {
    apiKey: "",
    ...agentProviderDefaults[provider]
  };
}

export function buildAgentProjectContext(project: StoryProject): AgentProjectContext {
  return {
    schemaVersion: project.schemaVersion,
    title: project.title,
    projectMode: project.projectMode,
    itemTypes: project.itemTypes,
    linkTypes: project.linkTypes,
    timelineLaneNames: project.timelineLaneNames,
    gameStory: project.gameStory,
    entities: Object.values(project.entities).map((entity) => ({
      id: entity.id,
      type: entity.type,
      graphPresence: entity.graphPresence,
      title: entity.title,
      summary: entity.summary,
      tags: entity.tags,
      publicInfo: entity.publicInfo,
      privateInfo: entity.privateInfo,
      bodyMarkdown: excerpt(entity.bodyMarkdown),
      timeline: entity.timeline,
      worldRule: entity.worldRule,
      gameStory: entity.gameStory
    })),
    relationships: project.relationships
  };
}

export function readStoredAgentSettings(): AgentSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_AGENT_SETTINGS };
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(AGENT_SETTINGS_STORAGE_KEY) ?? "{}") as Partial<AgentSettings>;
    const storedProvider = normalizeAgentProvider(stored.provider);
    const hasLegacyProvider = stored.provider === undefined || stored.provider === null;
    const providerMatchesActive = hasLegacyProvider ? ACTIVE_AGENT_PROVIDER === "openai" : storedProvider === ACTIVE_AGENT_PROVIDER;
    const defaults = providerMatchesActive ? defaultAgentSettings(ACTIVE_AGENT_PROVIDER) : DEFAULT_AGENT_SETTINGS;

    return {
      provider: ACTIVE_AGENT_PROVIDER,
      apiKey: providerMatchesActive && typeof stored.apiKey === "string" ? stored.apiKey : defaults.apiKey,
      baseUrl:
        providerMatchesActive && typeof stored.baseUrl === "string" && stored.baseUrl.trim()
          ? stored.baseUrl
          : defaults.baseUrl,
      model:
        providerMatchesActive && typeof stored.model === "string" && stored.model.trim()
          ? stored.model
          : defaults.model
    };
  } catch {
    return { ...DEFAULT_AGENT_SETTINGS };
  }
}

export function writeStoredAgentSettings(settings: AgentSettings) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(AGENT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // The agent can still work for the current session when local storage is unavailable.
  }
}

export function buildAgentInput(project: StoryProject, userPrompt: string): string {
  return JSON.stringify(
    {
      task: userPrompt,
      project: buildAgentProjectContext(project)
    },
    null,
    2
  );
}

export function createAgentRequest(settings: AgentSettings, project: StoryProject, userPrompt: string): Request {
  const provider = settings.provider ?? ACTIVE_AGENT_PROVIDER;
  const baseUrl = settings.baseUrl.replace(/\/+$/, "");
  const headers = {
    Authorization: `Bearer ${settings.apiKey.trim()}`,
    "Content-Type": "application/json"
  };

  if (provider === "nvidia") {
    return new Request(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: settings.model.trim() || agentProviderDefaults.nvidia.model,
        messages: [
          {
            role: "system",
            content: buildNvidiaSystemPrompt()
          },
          {
            role: "user",
            content: buildAgentInput(project, userPrompt)
          }
        ],
        temperature: 0,
        top_p: 0.95,
        max_tokens: 4096,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: false
      })
    });
  }

  return new Request(`${baseUrl}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: settings.model.trim() || agentProviderDefaults.openai.model,
      instructions: AGENT_SYSTEM_PROMPT,
      input: buildAgentInput(project, userPrompt),
      text: {
        format: AGENT_RESPONSE_FORMAT
      }
    })
  });
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
      return normalizeAgentChangePlan(JSON.parse(cleanJsonText(content)));
    }
  }

  return null;
}

export function validateAgentChangePlan(project: StoryProject, plan: AgentChangePlan): AgentChangeValidation[] {
  const entityIds = new Set(Object.keys(project.entities));
  const relationshipIds = new Set(project.relationships.map((relationship) => relationship.id));

  return plan.changes.map((change, index) => {
    const errors = validateAgentChange(project, change, entityIds, relationshipIds);

    if (change.operation === "create_entity") {
      entityIds.add(change.entity.id);
    }

    if (change.operation === "create_relationship") {
      relationshipIds.add(change.relationship.id);
    }

    if (change.operation === "add_timeline_effect" && change.effect.action === "start") {
      relationshipIds.add(`timeline-start-${index}`);
    }

    return { change, index, errors };
  });
}

export function applyAgentChangePlan(project: StoryProject, plan: AgentChangePlan): AgentApplyResult {
  const validation = validateAgentChangePlan(project, plan);
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
  relationshipIds: Set<string>
): string[] {
  const errors: string[] = [];

  if (!change.summary.trim()) {
    errors.push("Change summary is required.");
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

function excerpt(markdown: string): string {
  const normalized = markdown.trim();

  if (normalized.length <= BODY_EXCERPT_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, BODY_EXCERPT_LENGTH)}...`;
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

function normalizeAgentProvider(value: unknown): AgentProvider {
  return value === "nvidia" ? "nvidia" : "openai";
}

function buildNvidiaSystemPrompt(): string {
  return [
    "detailed thinking off",
    AGENT_SYSTEM_PROMPT,
    "Return only valid JSON. Do not wrap it in Markdown fences.",
    "The JSON must match this schema:",
    JSON.stringify(AGENT_RESPONSE_FORMAT.schema)
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

function validateEventReference(project: StoryProject, eventId: string, label: string, errors: string[]) {
  const event = project.entities[eventId];

  if (!event || event.type !== BUILT_IN_EVENT_TYPE_ID) {
    errors.push(`${label} does not exist: ${eventId}`);
  }
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
