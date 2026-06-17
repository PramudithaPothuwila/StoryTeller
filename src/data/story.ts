import {
  BUILT_IN_EVENT_TYPE_ID,
  BUILT_IN_WORLD_RULE_TYPE_ID,
  EventTimeline,
  GameContinuityIssue,
  GameDialogueLine,
  GameDialogueMetadata,
  GameDialogueResponse,
  GameDialogueVariant,
  GraphPresence,
  GamePlaythroughChoice,
  GameQuestMetadata,
  GameQuestObjective,
  GameStateCondition,
  GameStateEffect,
  GameStateValue,
  GameStateVariableDefinition,
  GameStateVariableKind,
  GameStoryEntityMetadata,
  GameStoryNodeRole,
  GameStoryProjectMetadata,
  GameStoryRelationshipMetadata,
  GameStoryValidationSettings,
  ItemTypeDefinition,
  ItemTypeId,
  LinkDirection,
  LinkTypeDefinition,
  LinkTypeId,
  Point,
  ProjectMode,
  RelationshipTimelineVersion,
  STORY_PROJECT_SCHEMA_VERSION,
  StoryEntity,
  StoryProject,
  StoryRelationship,
  TimelineEffect,
  TimelineEffectDraft,
  WorldRuleMetadata
} from "../types";

export const worldRuleDomainPresets = [
  "Magic",
  "Technology",
  "Culture",
  "Politics",
  "Religion",
  "Geography",
  "Economy",
  "History",
  "Biology",
  "Language"
];

export const worldRuleStatusPresets = ["Canon", "Tentative", "Deprecated"];

export const builtInItemTypes: ItemTypeDefinition[] = [
  { id: "character", label: "Character", color: "#0f766e", icon: "users", builtIn: true },
  { id: "note", label: "Note", color: "#b45309", icon: "sticky-note", builtIn: true },
  { id: "location", label: "Location", color: "#2563eb", icon: "map-pin", builtIn: true },
  { id: BUILT_IN_EVENT_TYPE_ID, label: "Event", color: "#be123c", icon: "calendar-days", builtIn: true },
  { id: "item", label: "Item", color: "#7c3aed", icon: "box", builtIn: true },
  { id: "faction", label: "Faction", color: "#15803d", icon: "flag", builtIn: true },
  { id: BUILT_IN_WORLD_RULE_TYPE_ID, label: "World Rule", color: "#0e7490", icon: "scroll-text", builtIn: true }
];

export const builtInGameItemTypes: ItemTypeDefinition[] = [
  { id: "scene", label: "Scene", color: "#dc2626", icon: "calendar-days", builtIn: true },
  { id: "quest", label: "Quest", color: "#0891b2", icon: "flag", builtIn: true },
  { id: "dialogue", label: "Dialogue", color: "#7c3aed", icon: "users", builtIn: true },
  { id: "ending", label: "Ending", color: "#d97706", icon: "sparkles", builtIn: true }
];

export const builtInLinkTypes: LinkTypeDefinition[] = [
  { id: "relates_to", label: "Relates to", color: "#46605a", icon: "link", direction: "directed", builtIn: true },
  { id: "knows", label: "Knows", color: "#0f766e", icon: "users", direction: "mutual", builtIn: true },
  { id: "hides", label: "Hides", color: "#be123c", icon: "eye-off", direction: "directed", builtIn: true },
  { id: "loves", label: "Loves", color: "#db2777", icon: "heart", direction: "mutual", builtIn: true },
  { id: "opposes", label: "Opposes", color: "#b91c1c", icon: "swords", direction: "directed", builtIn: true },
  { id: "owns", label: "Owns", color: "#7c3aed", icon: "key", direction: "directed", builtIn: true },
  { id: "located_in", label: "Located in", color: "#2563eb", icon: "map-pin", direction: "directed", builtIn: true },
  { id: "causes", label: "Causes", color: "#b45309", icon: "git-branch", direction: "directed", builtIn: true },
  { id: "member_of", label: "Member of", color: "#15803d", icon: "flag", direction: "directed", builtIn: true },
  { id: "governs", label: "Governs", color: "#0e7490", icon: "scroll-text", direction: "directed", builtIn: true },
  { id: "known_by", label: "Known by", color: "#0f766e", icon: "users", direction: "directed", builtIn: true },
  { id: "exception_to", label: "Exception to", color: "#b45309", icon: "git-branch", direction: "directed", builtIn: true }
];

export const builtInGameLinkTypes: LinkTypeDefinition[] = [
  { id: "branches_to", label: "Branches to", color: "#dc2626", icon: "git-branch", direction: "directed", builtIn: true },
  { id: "requires", label: "Requires", color: "#7c3aed", icon: "key", direction: "directed", builtIn: true },
  { id: "unlocks", label: "Unlocks", color: "#0891b2", icon: "sparkles", direction: "directed", builtIn: true }
];

export const gameStoryItemTypeIds = new Set(builtInGameItemTypes.map((type) => type.id));
export const gameStoryLinkTypeIds = new Set(builtInGameLinkTypes.map((type) => type.id));

export type GraphLayoutView = "world" | "story_flow";
export const graphPresenceOptions: GraphPresence[] = ["story_flow", "both", "world"];

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix: string): string {
  const cleanPrefix = slugify(prefix) || "id";

  if (globalThis.crypto?.randomUUID) {
    return `${cleanPrefix}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  }

  return `${cleanPrefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function cloneBuiltInItemTypes(): ItemTypeDefinition[] {
  return builtInItemTypes.map((type) => ({ ...type }));
}

export function cloneBuiltInGameItemTypes(): ItemTypeDefinition[] {
  return builtInGameItemTypes.map((type) => ({ ...type }));
}

export function cloneBuiltInLinkTypes(): LinkTypeDefinition[] {
  return builtInLinkTypes.map((type) => ({ ...type }));
}

export function cloneBuiltInGameLinkTypes(): LinkTypeDefinition[] {
  return builtInGameLinkTypes.map((type) => ({ ...type }));
}

export function findItemType(project: Pick<StoryProject, "itemTypes">, typeId: ItemTypeId): ItemTypeDefinition {
  return (
    project.itemTypes.find((type) => type.id === typeId) ??
    builtInItemTypes.find((type) => type.id === typeId) ??
    builtInGameItemTypes.find((type) => type.id === typeId) ??
    fallbackItemType(typeId)
  );
}

export function findLinkType(project: Pick<StoryProject, "linkTypes">, typeId: LinkTypeId): LinkTypeDefinition {
  return (
    project.linkTypes.find((type) => type.id === typeId) ??
    builtInLinkTypes.find((type) => type.id === typeId) ??
    builtInGameLinkTypes.find((type) => type.id === typeId) ??
    fallbackLinkType(typeId)
  );
}

export function linkLabel(project: Pick<StoryProject, "linkTypes">, typeId: LinkTypeId): string {
  return findLinkType(project, typeId).label;
}

export function linkDirection(project: Pick<StoryProject, "linkTypes">, typeId: LinkTypeId): LinkDirection {
  return findLinkType(project, typeId).direction;
}

export function typeSoftColor(color: string): string {
  return /^#[\da-f]{6}$/i.test(color) ? `${color}22` : "#edf2f1";
}

export function createStoryEntity(
  type: ItemTypeId,
  itemTypes: ItemTypeDefinition[] = builtInItemTypes,
  title?: string,
  graphPresence: GraphPresence = "world"
): StoryEntity {
  const timestamp = nowIso();
  const label = itemTypes.find((itemType) => itemType.id === type)?.label ?? fallbackItemType(type).label;

  return ensureEntityDefaults({
    id: makeId(type),
    type,
    graphPresence,
    title: title ?? `New ${label}`,
    summary: "",
    tags: [],
    publicInfo: "",
    privateInfo: "",
    bodyMarkdown: "",
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

export function defaultWorldRuleMetadata(): WorldRuleMetadata {
  return {
    domain: "",
    status: "Tentative",
    statement: "",
    reason: "",
    limits: "",
    exceptions: "",
    storyPurpose: ""
  };
}

export function normalizeWorldRuleMetadata(metadata: Partial<WorldRuleMetadata> | undefined): WorldRuleMetadata {
  const defaults = defaultWorldRuleMetadata();

  return {
    domain: normalizeRuleText(metadata?.domain, defaults.domain),
    status: normalizeRuleText(metadata?.status, defaults.status),
    statement: normalizeRuleText(metadata?.statement, defaults.statement),
    reason: normalizeRuleText(metadata?.reason, defaults.reason),
    limits: normalizeRuleText(metadata?.limits, defaults.limits),
    exceptions: normalizeRuleText(metadata?.exceptions, defaults.exceptions),
    storyPurpose: normalizeRuleText(metadata?.storyPurpose, defaults.storyPurpose)
  };
}

export function defaultGameStoryValidationSettings(): GameStoryValidationSettings {
  return {
    checkUnreachableNodes: true,
    checkInvalidStateReferences: true,
    checkDialogueDeadEnds: true
  };
}

export function defaultGameStoryProjectMetadata(): GameStoryProjectMetadata {
  return {
    startNodeId: undefined,
    stateVariables: [],
    validation: defaultGameStoryValidationSettings()
  };
}

export function normalizeGameStoryProjectMetadata(
  metadata: Partial<GameStoryProjectMetadata> | undefined
): GameStoryProjectMetadata {
  return {
    startNodeId: normalizeOptionalId(metadata?.startNodeId),
    stateVariables: (metadata?.stateVariables ?? []).map(normalizeGameStateVariable),
    validation: {
      ...defaultGameStoryValidationSettings(),
      ...(metadata?.validation ?? {})
    }
  };
}

export function defaultGameStoryEntityMetadata(type: ItemTypeId = "scene"): GameStoryEntityMetadata {
  const role = gameStoryRoleForType(type);

  return {
    role,
    status: "draft",
    criticalPath: role !== "ending",
    timelineAnchorId: undefined,
    entryConditions: [],
    exitEffects: [],
    dialogue: role === "dialogue" ? defaultGameDialogueMetadata() : undefined,
    quest: role === "quest" ? defaultGameQuestMetadata() : undefined
  };
}

export function normalizeGameStoryEntityMetadata(
  metadata: Partial<GameStoryEntityMetadata> | undefined,
  type: ItemTypeId = "scene"
): GameStoryEntityMetadata {
  const defaults = defaultGameStoryEntityMetadata(type);
  const role = isGameStoryRole(metadata?.role) ? metadata.role : defaults.role;

  return {
    role,
    status: isGameStoryStatus(metadata?.status) ? metadata.status : defaults.status,
    criticalPath: typeof metadata?.criticalPath === "boolean" ? metadata.criticalPath : defaults.criticalPath,
    timelineAnchorId: normalizeOptionalId(metadata?.timelineAnchorId),
    entryConditions: normalizeGameStateConditions(metadata?.entryConditions),
    exitEffects: normalizeGameStateEffects(metadata?.exitEffects),
    dialogue: role === "dialogue" ? normalizeGameDialogueMetadata(metadata?.dialogue) : metadata?.dialogue ? normalizeGameDialogueMetadata(metadata.dialogue) : undefined,
    quest: role === "quest" ? normalizeGameQuestMetadata(metadata?.quest) : metadata?.quest ? normalizeGameQuestMetadata(metadata.quest) : undefined
  };
}

export function defaultGameStoryRelationshipMetadata(): GameStoryRelationshipMetadata {
  return {
    choiceText: "",
    requirements: [],
    effects: [],
    consequenceNotes: "",
    priority: 0
  };
}

export function normalizeGameStoryRelationshipMetadata(
  metadata: Partial<GameStoryRelationshipMetadata> | undefined
): GameStoryRelationshipMetadata {
  return {
    choiceText: normalizeRuleText(metadata?.choiceText, ""),
    requirements: normalizeGameStateConditions(metadata?.requirements),
    effects: normalizeGameStateEffects(metadata?.effects),
    consequenceNotes: normalizeRuleText(metadata?.consequenceNotes, ""),
    priority: typeof metadata?.priority === "number" && Number.isFinite(metadata.priority) ? Math.floor(metadata.priority) : 0
  };
}

export function defaultGameDialogueMetadata(): GameDialogueMetadata {
  return {
    lines: [],
    responses: [],
    variants: []
  };
}

export function normalizeGameDialogueMetadata(metadata: Partial<GameDialogueMetadata> | undefined): GameDialogueMetadata {
  return {
    lines: (metadata?.lines ?? []).map(normalizeGameDialogueLine),
    responses: (metadata?.responses ?? []).map(normalizeGameDialogueResponse),
    variants: (metadata?.variants ?? []).map(normalizeGameDialogueVariant)
  };
}

export function defaultGameQuestMetadata(): GameQuestMetadata {
  return {
    questType: "main",
    giverId: undefined,
    objectives: [],
    successConditions: [],
    failureConditions: [],
    rewards: "",
    consequences: ""
  };
}

export function normalizeGameQuestMetadata(metadata: Partial<GameQuestMetadata> | undefined): GameQuestMetadata {
  return {
    questType: isGameQuestType(metadata?.questType) ? metadata.questType : "main",
    giverId: normalizeOptionalId(metadata?.giverId),
    objectives: (metadata?.objectives ?? []).map(normalizeGameQuestObjective),
    successConditions: normalizeGameStateConditions(metadata?.successConditions),
    failureConditions: normalizeGameStateConditions(metadata?.failureConditions),
    rewards: normalizeRuleText(metadata?.rewards, ""),
    consequences: normalizeRuleText(metadata?.consequences, "")
  };
}

export function createGameStateVariable(kind: GameStateVariableKind = "flag"): GameStateVariableDefinition {
  const id = makeId(kind);

  return normalizeGameStateVariable({
    id,
    label: humanizeId(id),
    kind,
    defaultValue: defaultGameStateValue(kind),
    enumOptions: kind === "enum" ? ["Unset", "Known", "Resolved"] : [],
    notes: ""
  });
}

export function createGameStateCondition(variableId = ""): GameStateCondition {
  return normalizeGameStateCondition({
    id: makeId("condition"),
    variableId,
    operator: "equals",
    value: true
  });
}

export function createGameStateEffect(variableId = ""): GameStateEffect {
  return normalizeGameStateEffect({
    id: makeId("effect"),
    variableId,
    operation: "set",
    value: true
  });
}

export function createGameDialogueLine(): GameDialogueLine {
  return normalizeGameDialogueLine({
    id: makeId("line"),
    text: "",
    tone: "",
    voiceNotes: ""
  });
}

export function createGameDialogueResponse(): GameDialogueResponse {
  return normalizeGameDialogueResponse({
    id: makeId("response"),
    text: "",
    conditions: [],
    effects: [],
    notes: ""
  });
}

export function createGameDialogueVariant(): GameDialogueVariant {
  return normalizeGameDialogueVariant({
    id: makeId("variant"),
    label: "Variant",
    conditions: [],
    lines: []
  });
}

export function createGameQuestObjective(): GameQuestObjective {
  return normalizeGameQuestObjective({
    id: makeId("objective"),
    text: "",
    optional: false,
    hidden: false,
    completeConditions: []
  });
}

export function createStoryRelationship(
  project: Pick<StoryProject, "linkTypes">,
  sourceId: string,
  targetId: string,
  type: LinkTypeId = "relates_to"
): StoryRelationship {
  return normalizeRelationship({
    id: makeId("link"),
    sourceId,
    targetId,
    type,
    label: linkLabel(project, type),
    notes: "",
    timelineVersions: []
  });
}

export function createBlankProject(title = "Untitled Story", projectMode: ProjectMode = "story"): StoryProject {
  const project: StoryProject = {
    schemaVersion: STORY_PROJECT_SCHEMA_VERSION,
    title,
    updatedAt: nowIso(),
    projectMode,
    gameStory: projectMode === "game_story" ? defaultGameStoryProjectMetadata() : undefined,
    itemTypes: projectMode === "game_story" ? [...cloneBuiltInItemTypes(), ...cloneBuiltInGameItemTypes()] : cloneBuiltInItemTypes(),
    linkTypes: projectMode === "game_story" ? [...cloneBuiltInLinkTypes(), ...cloneBuiltInGameLinkTypes()] : cloneBuiltInLinkTypes(),
    timelineLaneNames: [defaultTimelineLaneName(0)],
    entities: {},
    relationships: [],
    layout: {},
    storyFlowLayout: {}
  };

  return projectMode === "game_story" ? ensureGameStoryCatalog(project) : project;
}

export function addEntityToProject(project: StoryProject, entity: StoryEntity, position: Point): StoryProject {
  const normalizedEntity = ensureEntityDefaults(entity);
  const isStoryFlowNode = isGameStoryItemType(normalizedEntity.type) || Boolean(normalizedEntity.gameStory);

  return touchProject({
    ...project,
    entities: {
      ...project.entities,
      [normalizedEntity.id]: normalizedEntity
    },
    layout: {
      ...project.layout,
      [normalizedEntity.id]: position
    },
    storyFlowLayout: isStoryFlowNode
      ? {
          ...project.storyFlowLayout,
          [normalizedEntity.id]: position
        }
      : project.storyFlowLayout
  });
}

export function updateEntityInProject(
  project: StoryProject,
  entityId: string,
  patch: Partial<Omit<StoryEntity, "id" | "createdAt">>
): StoryProject {
  const entity = project.entities[entityId];

  if (!entity) {
    return project;
  }

  return touchProject({
    ...project,
    entities: {
      ...project.entities,
      [entityId]: ensureEntityDefaults({
        ...entity,
        ...patch,
        updatedAt: nowIso()
      })
    }
  });
}

export function deleteEntityFromProject(project: StoryProject, entityId: string): StoryProject {
  const { [entityId]: _removed, ...remainingEntities } = project.entities;
  const { [entityId]: _removedLayout, ...remainingLayout } = project.layout;
  const { [entityId]: _removedStoryFlowLayout, ...remainingStoryFlowLayout } = project.storyFlowLayout;

  return touchProject({
    ...project,
    entities: remainingEntities,
    layout: remainingLayout,
    storyFlowLayout: remainingStoryFlowLayout,
    relationships: project.relationships
      .filter((relationship) => relationship.sourceId !== entityId && relationship.targetId !== entityId)
      .map((relationship) => ({
        ...relationship,
        startsAtEventId: relationship.startsAtEventId === entityId ? undefined : relationship.startsAtEventId,
        endsAtEventId: relationship.endsAtEventId === entityId ? undefined : relationship.endsAtEventId,
        timelineVersions: relationship.timelineVersions?.filter((version) => version.eventId !== entityId) ?? []
      }))
  });
}

export function updateRelationshipInProject(
  project: StoryProject,
  relationshipId: string,
  patch: Partial<Omit<StoryRelationship, "id" | "sourceId" | "targetId">>
): StoryProject {
  return touchProject({
    ...project,
    relationships: project.relationships.map((relationship) =>
      relationship.id === relationshipId
        ? normalizeRelationship({
            ...relationship,
            ...patch
          })
        : relationship
    )
  });
}

export function deleteRelationshipFromProject(project: StoryProject, relationshipId: string): StoryProject {
  return touchProject({
    ...project,
    relationships: project.relationships.filter((relationship) => relationship.id !== relationshipId),
    entities: Object.fromEntries(
      Object.values(project.entities).map((entity) => [
        entity.id,
        entity.timeline
          ? {
              ...entity,
              timeline: {
                ...entity.timeline,
                effects: entity.timeline.effects.filter((effect) => effect.relationshipId !== relationshipId)
              }
            }
          : entity
      ])
    )
  });
}

export function projectLayoutForView(project: StoryProject, graphView: GraphLayoutView): Record<string, Point> {
  return graphView === "story_flow" ? project.storyFlowLayout : project.layout;
}

export function setProjectLayout(
  project: StoryProject,
  layout: Record<string, Point>,
  graphView: GraphLayoutView = "world"
): StoryProject {
  return touchProject({
    ...project,
    ...(graphView === "story_flow" ? { storyFlowLayout: layout } : { layout })
  });
}

export function createCustomItemType(label = "Custom Item"): ItemTypeDefinition {
  return {
    id: makeId("item-type"),
    label,
    color: "#0f766e",
    icon: "sparkles",
    builtIn: false
  };
}

export function createCustomLinkType(label = "Custom Link"): LinkTypeDefinition {
  return {
    id: makeId("link-type"),
    label,
    color: "#46605a",
    icon: "link",
    direction: "directed",
    builtIn: false
  };
}

export function isItemTypeInUse(project: StoryProject, typeId: ItemTypeId): boolean {
  return Object.values(project.entities).some((entity) => entity.type === typeId);
}

export function isLinkTypeInUse(project: StoryProject, typeId: LinkTypeId): boolean {
  return project.relationships.some((relationship) => relationship.type === typeId);
}

export function deleteItemTypeFromProject(project: StoryProject, typeId: ItemTypeId): StoryProject {
  const type = project.itemTypes.find((itemType) => itemType.id === typeId);

  if (!type || type.builtIn || isItemTypeInUse(project, typeId)) {
    return project;
  }

  return touchProject({
    ...project,
    itemTypes: project.itemTypes.filter((itemType) => itemType.id !== typeId)
  });
}

export function deleteLinkTypeFromProject(project: StoryProject, typeId: LinkTypeId): StoryProject {
  const type = project.linkTypes.find((linkType) => linkType.id === typeId);

  if (!type || type.builtIn || isLinkTypeInUse(project, typeId)) {
    return project;
  }

  return touchProject({
    ...project,
    linkTypes: project.linkTypes.filter((linkType) => linkType.id !== typeId)
  });
}

export function setProjectModeInProject(project: StoryProject, projectMode: ProjectMode): StoryProject {
  const nextProject = touchProject({
    ...project,
    schemaVersion: STORY_PROJECT_SCHEMA_VERSION,
    projectMode,
    gameStory:
      projectMode === "game_story" || project.gameStory
        ? normalizeGameStoryProjectMetadata(project.gameStory)
        : undefined
  });

  return projectMode === "game_story" ? ensureGameStoryCatalog(nextProject) : nextProject;
}

export function ensureGameStoryCatalog(project: StoryProject): StoryProject {
  return {
    ...project,
    itemTypes: mergeTypeCatalog([...cloneBuiltInItemTypes(), ...cloneBuiltInGameItemTypes()], project.itemTypes),
    linkTypes: mergeTypeCatalog([...cloneBuiltInLinkTypes(), ...cloneBuiltInGameLinkTypes()], project.linkTypes),
    gameStory: normalizeGameStoryProjectMetadata(project.gameStory)
  };
}

export function updateGameStoryProjectMetadata(
  project: StoryProject,
  patch: Partial<GameStoryProjectMetadata>
): StoryProject {
  return touchProject({
    ...project,
    gameStory: normalizeGameStoryProjectMetadata({
      ...(project.gameStory ?? defaultGameStoryProjectMetadata()),
      ...patch
    })
  });
}

export function addGameStateVariableToProject(
  project: StoryProject,
  kind: GameStateVariableKind = "flag"
): StoryProject {
  const metadata = normalizeGameStoryProjectMetadata(project.gameStory);
  const variable = createGameStateVariable(kind);

  return updateGameStoryProjectMetadata(project, {
    stateVariables: [...metadata.stateVariables, variable]
  });
}

export function updateGameStateVariableInProject(
  project: StoryProject,
  variableId: string,
  patch: Partial<GameStateVariableDefinition>
): StoryProject {
  const metadata = normalizeGameStoryProjectMetadata(project.gameStory);

  return updateGameStoryProjectMetadata(project, {
    stateVariables: metadata.stateVariables.map((variable) =>
      variable.id === variableId ? normalizeGameStateVariable({ ...variable, ...patch }) : variable
    )
  });
}

export function deleteGameStateVariableFromProject(project: StoryProject, variableId: string): StoryProject {
  const metadata = normalizeGameStoryProjectMetadata(project.gameStory);

  return updateGameStoryProjectMetadata(project, {
    stateVariables: metadata.stateVariables.filter((variable) => variable.id !== variableId)
  });
}

export function ensureEventTimeline(entity: StoryEntity, order = 0): EventTimeline {
  return {
    order: Number.isFinite(entity.timeline?.order) ? entity.timeline!.order : order,
    track: normalizeTimelineTrack(entity.timeline?.track),
    effects: entity.timeline?.effects ?? []
  };
}

export function getTimelineEvents(project: StoryProject): StoryEntity[] {
  return Object.values(project.entities)
    .filter((entity) => entity.type === BUILT_IN_EVENT_TYPE_ID)
    .map((entity) => ({
      ...entity,
      timeline: ensureEventTimeline(entity, nextTimelineOrder(project))
    }))
    .sort((a, b) => {
      const aOrder = a.timeline?.order ?? 0;
      const bOrder = b.timeline?.order ?? 0;
      const aTrack = a.timeline?.track ?? 0;
      const bTrack = b.timeline?.track ?? 0;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      return aTrack === bTrack ? a.title.localeCompare(b.title) : aTrack - bTrack;
    });
}

export function getTimelineLaneNames(project: StoryProject): string[] {
  return normalizeTimelineLaneNames(project.timelineLaneNames, project.entities);
}

export function addTimelineLaneToProject(project: StoryProject): StoryProject {
  const laneNames = getTimelineLaneNames(project);

  return touchProject({
    ...project,
    timelineLaneNames: [...laneNames, defaultTimelineLaneName(laneNames.length)]
  });
}

export function renameTimelineLaneInProject(project: StoryProject, track: number, name: string): StoryProject {
  const normalizedTrack = normalizeTimelineTrack(track);
  const laneNames = normalizeTimelineLaneNames(project.timelineLaneNames, project.entities, normalizedTrack + 1);
  const nextName = name.trim() || defaultTimelineLaneName(normalizedTrack);

  if (laneNames[normalizedTrack] === nextName) {
    return project;
  }

  const nextLaneNames = [...laneNames];
  nextLaneNames[normalizedTrack] = nextName;

  return touchProject({
    ...project,
    timelineLaneNames: nextLaneNames
  });
}

export function nextTimelineOrder(project: StoryProject, track = 0): number {
  const normalizedTrack = normalizeTimelineTrack(track);
  const orders = Object.values(project.entities)
    .filter((entity) => entity.type === BUILT_IN_EVENT_TYPE_ID)
    .filter((entity) => normalizeTimelineTrack(entity.timeline?.track) === normalizedTrack)
    .map((entity) => entity.timeline?.order ?? 0);

  return orders.length ? Math.max(...orders) + 1 : 1;
}

export function moveTimelineEventInProject(
  project: StoryProject,
  eventId: string,
  targetTrack: number,
  targetIndex: number
): StoryProject {
  const movedEvent = project.entities[eventId];

  if (!movedEvent || movedEvent.type !== BUILT_IN_EVENT_TYPE_ID) {
    return project;
  }

  const normalizedTrack = normalizeTimelineTrack(targetTrack);
  const laneNames = normalizeTimelineLaneNames(project.timelineLaneNames, project.entities, normalizedTrack + 1);
  const events = getTimelineEvents(project);
  const sourceTimeline = ensureEventTimeline(movedEvent);
  const sourceTrack = sourceTimeline.track ?? 0;
  const sourceTrackEvents = events.filter((event) => (event.timeline?.track ?? 0) === sourceTrack);
  const sourceIndex = sourceTrackEvents.findIndex((event) => event.id === eventId);
  const tracks = new Map<number, StoryEntity[]>();

  for (const event of events) {
    if (event.id === eventId) {
      continue;
    }

    const track = event.timeline?.track ?? 0;
    tracks.set(track, [...(tracks.get(track) ?? []), event]);
  }

  const destinationEvents = tracks.get(normalizedTrack) ?? [];
  const adjustedIndex =
    sourceTrack === normalizedTrack && sourceIndex >= 0 && targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
  const insertIndex = Math.max(0, Math.min(adjustedIndex, destinationEvents.length));
  destinationEvents.splice(insertIndex, 0, {
    ...movedEvent,
    timeline: {
      ...sourceTimeline,
      track: normalizedTrack
    }
  });
  tracks.set(normalizedTrack, destinationEvents);

  const nextEntities = { ...project.entities };
  let changed = false;

  for (const [track, trackEvents] of tracks) {
    trackEvents.forEach((event, index) => {
      const originalEvent = project.entities[event.id];

      if (!originalEvent) {
        return;
      }

      const originalTimeline = ensureEventTimeline(originalEvent);
      const nextTimeline: EventTimeline = {
        ...originalTimeline,
        order: index + 1,
        track
      };

      if (originalTimeline.order === nextTimeline.order && originalTimeline.track === nextTimeline.track) {
        return;
      }

      nextEntities[event.id] = {
        ...originalEvent,
        timeline: nextTimeline,
        updatedAt: nowIso()
      };
      changed = true;
    });
  }

  return changed
    ? touchProject({
        ...project,
        entities: nextEntities,
        timelineLaneNames: laneNames
      })
    : project;
}

export function deleteEmptyTimelineTrackFromProject(project: StoryProject, targetTrack: number): StoryProject {
  const normalizedTrack = normalizeTimelineTrack(targetTrack);
  const events = getTimelineEvents(project);
  const laneNames = getTimelineLaneNames(project);

  if (events.some((event) => (event.timeline?.track ?? 0) === normalizedTrack)) {
    return project;
  }

  if (laneNames.length <= 1 || normalizedTrack >= laneNames.length) {
    return project;
  }

  const nextEntities = { ...project.entities };
  let changed = false;

  for (const event of events) {
    const timeline = ensureEventTimeline(event);
    const track = timeline.track ?? 0;

    if (track <= normalizedTrack) {
      continue;
    }

    nextEntities[event.id] = {
      ...project.entities[event.id],
      timeline: {
        ...timeline,
        track: track - 1
      },
      updatedAt: nowIso()
    };
    changed = true;
  }

  return changed
    ? touchProject({
        ...project,
        entities: nextEntities,
        timelineLaneNames: removeTimelineLaneName(laneNames, normalizedTrack)
      })
    : touchProject({
        ...project,
        timelineLaneNames: removeTimelineLaneName(laneNames, normalizedTrack)
      });
}

export function eventOrder(project: StoryProject, eventId: string): number | null {
  const event = project.entities[eventId];

  if (!event || event.type !== BUILT_IN_EVENT_TYPE_ID) {
    return null;
  }

  return ensureEventTimeline(event).order;
}

export function isRelationshipActiveAt(project: StoryProject, relationship: StoryRelationship, eventId: string | null): boolean {
  if (!eventId) {
    return true;
  }

  const selectedOrder = eventOrder(project, eventId);

  if (selectedOrder === null) {
    return true;
  }

  const startOrder = relationship.startsAtEventId ? eventOrder(project, relationship.startsAtEventId) : null;
  const endOrder = relationship.endsAtEventId ? eventOrder(project, relationship.endsAtEventId) : null;

  if (startOrder !== null && selectedOrder < startOrder) {
    return false;
  }

  if (endOrder !== null && selectedOrder > endOrder) {
    return false;
  }

  return true;
}

export function resolveRelationshipAt(
  project: StoryProject,
  relationship: StoryRelationship,
  eventId: string | null
): StoryRelationship {
  if (!relationship.timelineVersions?.length) {
    return relationship;
  }

  const selectedOrder = eventId ? eventOrder(project, eventId) : Number.POSITIVE_INFINITY;

  if (selectedOrder === null) {
    return relationship;
  }

  const versions = relationship.timelineVersions
    .filter((version) => {
      const versionOrder = eventOrder(project, version.eventId);
      return versionOrder !== null && versionOrder <= selectedOrder;
    })
    .sort((a, b) => (eventOrder(project, a.eventId) ?? 0) - (eventOrder(project, b.eventId) ?? 0));

  return versions.reduce<StoryRelationship>(
    (resolved, version) => ({
      ...resolved,
      type: version.type ?? resolved.type,
      label: version.label ?? resolved.label,
      notes: version.notes ?? resolved.notes
    }),
    relationship
  );
}

export function applyTimelineEffectToProject(
  project: StoryProject,
  eventId: string,
  draft: TimelineEffectDraft
): { project: StoryProject; relationshipId: string } {
  const event = project.entities[eventId];

  if (!event || event.type !== BUILT_IN_EVENT_TYPE_ID) {
    return { project, relationshipId: "" };
  }

  if (draft.action === "start") {
    const relationship: StoryRelationship = {
      ...createStoryRelationship(project, draft.sourceId, draft.targetId, draft.type),
      label: draft.label || linkLabel(project, draft.type),
      notes: draft.notes,
      startsAtEventId: eventId
    };
    const effect: TimelineEffect = {
      id: makeId("effect"),
      relationshipId: relationship.id,
      ...draft,
      label: relationship.label,
      notes: relationship.notes
    };

    return {
      project: appendEventEffect(
        touchProject({
          ...project,
          relationships: [...project.relationships, relationship]
        }),
        eventId,
        effect
      ),
      relationshipId: relationship.id
    };
  }

  const relationship = project.relationships.find((item) => item.id === draft.relationshipId);

  if (!relationship) {
    return { project, relationshipId: "" };
  }

  if (draft.action === "end") {
    const effect: TimelineEffect = {
      id: makeId("effect"),
      action: "end",
      relationshipId: relationship.id
    };

    return {
      project: appendEventEffect(
        touchProject({
          ...project,
          relationships: project.relationships.map((item) =>
            item.id === relationship.id
              ? {
                  ...item,
                  endsAtEventId: eventId
                }
              : item
          )
        }),
        eventId,
        effect
      ),
      relationshipId: relationship.id
    };
  }

  const version: RelationshipTimelineVersion = {
    id: makeId("version"),
    eventId,
    type: draft.type || undefined,
    label: draft.label || undefined,
    notes: draft.notes || undefined
  };
  const effect: TimelineEffect = {
    id: makeId("effect"),
    action: "update",
    relationshipId: relationship.id,
    type: version.type,
    label: version.label,
    notes: version.notes
  };

  return {
    project: appendEventEffect(
      touchProject({
        ...project,
        relationships: project.relationships.map((item) =>
          item.id === relationship.id
            ? normalizeRelationship({
                ...item,
                type: version.type ?? item.type,
                label: version.label ?? item.label,
                notes: version.notes ?? item.notes,
                timelineVersions: [...(item.timelineVersions ?? []), version]
              })
            : item
        )
      }),
      eventId,
      effect
    ),
    relationshipId: relationship.id
  };
}

export function touchProject(project: StoryProject): StoryProject {
  return {
    ...project,
    updatedAt: nowIso()
  };
}

export function nextEntityPosition(project: StoryProject): Point {
  const count = Object.keys(project.entities).length;
  const column = count % 3;
  const row = Math.floor(count / 3);

  return {
    x: 120 + column * 310,
    y: 100 + row * 220
  };
}

export function migrateProjectShape(project: unknown): StoryProject {
  const value = project as Partial<StoryProject> & { schemaVersion?: number };
  const projectMode: ProjectMode = value.projectMode === "game_story" ? "game_story" : "story";
  const layout = value.layout ?? {};
  const hasStoryFlowLayout = Boolean(value.storyFlowLayout);
  const schemaVersion = typeof value.schemaVersion === "number" ? value.schemaVersion : 1;
  const defaultItemTypes =
    projectMode === "game_story" ? [...cloneBuiltInItemTypes(), ...cloneBuiltInGameItemTypes()] : cloneBuiltInItemTypes();
  const defaultLinkTypes =
    projectMode === "game_story" ? [...cloneBuiltInLinkTypes(), ...cloneBuiltInGameLinkTypes()] : cloneBuiltInLinkTypes();
  const migrated: StoryProject = {
    schemaVersion: STORY_PROJECT_SCHEMA_VERSION,
    title: value.title || "Untitled Story",
    updatedAt: value.updatedAt || nowIso(),
    projectMode,
    gameStory:
      projectMode === "game_story" || value.gameStory
        ? normalizeGameStoryProjectMetadata(value.gameStory)
        : undefined,
    itemTypes: mergeTypeCatalog(defaultItemTypes, value.itemTypes ?? []),
    linkTypes: mergeTypeCatalog(defaultLinkTypes, value.linkTypes ?? []),
    timelineLaneNames: [],
    entities: {},
    relationships: [],
    layout,
    storyFlowLayout: value.storyFlowLayout ?? {}
  };

  migrated.entities = Object.fromEntries(
    Object.values(value.entities ?? {}).map((entity) => {
      const normalized = ensureEntityDefaults({
        ...entity,
        graphPresence: defaultGraphPresenceForMigratedEntity(entity, projectMode, schemaVersion)
      });
      return [normalized.id, normalized];
    })
  );
  migrated.relationships = (value.relationships ?? []).map(normalizeRelationship);
  migrated.timelineLaneNames = normalizeTimelineLaneNames(value.timelineLaneNames, migrated.entities);

  if (!hasStoryFlowLayout && migrated.projectMode === "game_story") {
    migrated.storyFlowLayout = Object.fromEntries(
      Object.values(migrated.entities)
        .filter((entity) => isGameStoryItemType(entity.type) || Boolean(entity.gameStory))
        .map((entity) => [entity.id, migrated.layout[entity.id]])
        .filter((entry): entry is [string, Point] => isPoint(entry[1]))
    );
  }

  return migrated.projectMode === "game_story" ? ensureGameStoryCatalog(migrated) : migrated;
}

export function ensureEntityDefaults(entity: StoryEntity, graphPresence: GraphPresence = "world"): StoryEntity {
  const normalized: StoryEntity = {
    ...entity,
    graphPresence: normalizeGraphPresence(entity.graphPresence, graphPresence),
    tags: entity.tags ?? [],
    publicInfo: entity.publicInfo ?? "",
    privateInfo: entity.privateInfo ?? "",
    bodyMarkdown: entity.bodyMarkdown ?? ""
  };

  if (normalized.type === BUILT_IN_EVENT_TYPE_ID) {
    normalized.timeline = ensureEventTimeline(normalized);
  }

  if (normalized.type === BUILT_IN_WORLD_RULE_TYPE_ID) {
    normalized.worldRule = normalizeWorldRuleMetadata(normalized.worldRule);
  }

  if (isGameStoryItemType(normalized.type) || normalized.gameStory) {
    normalized.gameStory = normalizeGameStoryEntityMetadata(normalized.gameStory, normalized.type);
  }

  return normalized;
}

function defaultGraphPresenceForMigratedEntity(
  entity: Partial<StoryEntity> | undefined,
  projectMode: ProjectMode,
  schemaVersion: number
): GraphPresence {
  if (schemaVersion >= 5 && entity?.graphPresence) {
    return normalizeGraphPresence(entity.graphPresence, "world");
  }

  if (projectMode === "game_story" && entity?.type && isGameStoryItemType(entity.type)) {
    return "both";
  }

  return "world";
}

export function normalizeGraphPresence(value: unknown, fallback: GraphPresence = "world"): GraphPresence {
  return value === "world" || value === "story_flow" || value === "both" ? value : fallback;
}

export function entityVisibleInGraph(entity: StoryEntity, graphView: GraphLayoutView): boolean {
  const graphPresence = normalizeGraphPresence(entity.graphPresence);

  if (graphView === "story_flow") {
    return isGameStoryItemType(entity.type) && (graphPresence === "story_flow" || graphPresence === "both");
  }

  return graphPresence === "world" || graphPresence === "both";
}

export function normalizeRelationship(relationship: StoryRelationship): StoryRelationship {
  const normalized: StoryRelationship = {
    ...relationship,
    notes: relationship.notes ?? "",
    timelineVersions: relationship.timelineVersions ?? []
  };

  if (isGameStoryLinkType(normalized.type) || normalized.gameStory) {
    normalized.gameStory = normalizeGameStoryRelationshipMetadata(normalized.gameStory);
  }

  return normalized;
}

function isPoint(value: unknown): value is Point {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isFinite((value as Point).x) &&
    Number.isFinite((value as Point).y)
  );
}

export function isGameStoryItemType(typeId: ItemTypeId): boolean {
  return gameStoryItemTypeIds.has(typeId);
}

export function isGameStoryLinkType(typeId: LinkTypeId): boolean {
  return gameStoryLinkTypeIds.has(typeId);
}

export function gameStoryRoleForType(typeId: ItemTypeId): GameStoryNodeRole {
  if (typeId === "quest" || typeId === "dialogue" || typeId === "ending") {
    return typeId;
  }

  return "scene";
}

export function getGameStoryNodes(project: StoryProject): StoryEntity[] {
  return Object.values(project.entities)
    .filter((entity) => entityVisibleInGraph(entity, "story_flow"))
    .map((entity) => ensureEntityDefaults(entity));
}

export function getGameStoryRelationships(project: StoryProject): StoryRelationship[] {
  const gameNodeIds = new Set(getGameStoryNodes(project).map((entity) => entity.id));

  return project.relationships
    .filter(
      (relationship) =>
        (isGameStoryLinkType(relationship.type) || relationship.gameStory) &&
        gameNodeIds.has(relationship.sourceId) &&
        gameNodeIds.has(relationship.targetId)
    )
    .map(normalizeRelationship);
}

export function getInitialGameState(project: StoryProject): Record<string, GameStateValue> {
  return Object.fromEntries(
    normalizeGameStoryProjectMetadata(project.gameStory).stateVariables.map((variable) => [
      variable.id,
      variable.defaultValue
    ])
  );
}

export function evaluateGameStateConditions(
  project: StoryProject,
  conditions: GameStateCondition[],
  state: Record<string, GameStateValue>
): boolean {
  const variables = gameStateVariableMap(project);

  return conditions.every((condition) => evaluateGameStateCondition(condition, state, variables));
}

export function applyGameStateEffects(
  project: StoryProject,
  effects: GameStateEffect[],
  state: Record<string, GameStateValue>
): Record<string, GameStateValue> {
  const variables = gameStateVariableMap(project);
  const nextState = { ...state };

  for (const effect of effects) {
    const variable = variables.get(effect.variableId);

    if (!variable) {
      continue;
    }

    const currentValue = nextState[variable.id] ?? variable.defaultValue;
    const effectValue = coerceGameStateValue(effect.value, variable.kind);

    if (effect.operation === "increment" || effect.operation === "decrement") {
      const direction = effect.operation === "increment" ? 1 : -1;
      const amount = typeof effectValue === "number" ? effectValue : 1;
      nextState[variable.id] = Number(currentValue || 0) + direction * amount;
      continue;
    }

    if (effect.operation === "add") {
      nextState[variable.id] = variable.kind === "inventory" || variable.kind === "flag" ? true : effectValue;
      continue;
    }

    if (effect.operation === "remove") {
      nextState[variable.id] = variable.kind === "number" || variable.kind === "faction_reputation" ? 0 : false;
      continue;
    }

    nextState[variable.id] = effectValue;
  }

  return nextState;
}

export function applyGamePlaythroughChoice(
  project: StoryProject,
  currentNodeId: string,
  state: Record<string, GameStateValue>,
  choice: GamePlaythroughChoice
): Record<string, GameStateValue> {
  const currentNode = project.entities[currentNodeId];
  const exitEffects = currentNode?.gameStory?.exitEffects ?? [];

  return applyGameStateEffects(project, [...exitEffects, ...choice.effects], state);
}

export function getGamePlayableChoices(
  project: StoryProject,
  currentNodeId: string,
  state: Record<string, GameStateValue>
): GamePlaythroughChoice[] {
  const currentNode = project.entities[currentNodeId];
  const branchChoices: GamePlaythroughChoice[] = project.relationships
    .filter((relationship) => relationship.sourceId === currentNodeId && relationship.type === "branches_to")
    .filter((relationship) => project.entities[relationship.targetId])
    .map((relationship) => {
      const metadata = normalizeGameStoryRelationshipMetadata(relationship.gameStory);
      const target = project.entities[relationship.targetId];
      const targetEntryConditions = target?.gameStory?.entryConditions ?? [];
      const conditions = [...metadata.requirements, ...targetEntryConditions];
      const available = evaluateGameStateConditions(project, conditions, state);

      return {
        id: relationship.id,
        label: metadata.choiceText || relationship.label || target?.title || "Continue",
        targetNodeId: relationship.targetId,
        available,
        lockedReason: available ? undefined : "Requirements not met",
        conditions,
        effects: metadata.effects,
        relationshipId: relationship.id
      } satisfies GamePlaythroughChoice;
    });
  const dialogueChoices: GamePlaythroughChoice[] = currentNode?.gameStory?.dialogue?.responses
    .filter((response) => response.targetNodeId && project.entities[response.targetNodeId])
    .map((response) => {
      const targetId = response.targetNodeId!;
      const targetEntryConditions = project.entities[targetId]?.gameStory?.entryConditions ?? [];
      const conditions = [...response.conditions, ...targetEntryConditions];
      const available = evaluateGameStateConditions(project, conditions, state);

      return {
        id: response.id,
        label: response.text || project.entities[targetId]?.title || "Respond",
        targetNodeId: targetId,
        available,
        lockedReason: available ? undefined : "Requirements not met",
        conditions,
        effects: response.effects,
        responseId: response.id
      } satisfies GamePlaythroughChoice;
    }) ?? [];

  return [...branchChoices, ...dialogueChoices].sort((a, b) => {
    const aPriority = a.relationshipId
      ? normalizeGameStoryRelationshipMetadata(project.relationships.find((item) => item.id === a.relationshipId)?.gameStory).priority
      : 0;
    const bPriority = b.relationshipId
      ? normalizeGameStoryRelationshipMetadata(project.relationships.find((item) => item.id === b.relationshipId)?.gameStory).priority
      : 0;

    return aPriority === bPriority ? a.label.localeCompare(b.label) : aPriority - bPriority;
  });
}

export function getReachableGameNodeIds(project: StoryProject): Set<string> {
  const metadata = normalizeGameStoryProjectMetadata(project.gameStory);
  const startNodeId = metadata.startNodeId;
  const gameNodes = new Set(getGameStoryNodes(project).map((entity) => entity.id));
  const reachable = new Set<string>();

  if (!startNodeId || !gameNodes.has(startNodeId)) {
    return reachable;
  }

  const queue = [startNodeId];

  while (queue.length) {
    const nodeId = queue.shift()!;

    if (reachable.has(nodeId)) {
      continue;
    }

    reachable.add(nodeId);

    for (const targetId of outgoingGameStoryTargetIds(project, nodeId)) {
      if (gameNodes.has(targetId) && !reachable.has(targetId)) {
        queue.push(targetId);
      }
    }
  }

  return reachable;
}

export function getGameContinuityIssues(project: StoryProject): GameContinuityIssue[] {
  const metadata = normalizeGameStoryProjectMetadata(project.gameStory);
  const issues: GameContinuityIssue[] = [];
  const nodes = getGameStoryNodes(project);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const variableIds = new Set(metadata.stateVariables.map((variable) => variable.id));
  const startNode = metadata.startNodeId ? project.entities[metadata.startNodeId] : null;

  if (nodes.length && (!metadata.startNodeId || !startNode || !nodeIds.has(metadata.startNodeId))) {
    issues.push({
      id: "missing-start-node",
      severity: "error",
      title: "Missing start node",
      details: "Choose a valid game story start node."
    });
  }

  const reachable = getReachableGameNodeIds(project);

  if (metadata.validation.checkUnreachableNodes && metadata.startNodeId && reachable.size) {
    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        issues.push({
          id: `unreachable-${node.id}`,
          severity: "warning",
          title: "Unreachable node",
          details: `${node.title} cannot be reached from the start node.`,
          entityId: node.id
        });
      }
    }
  }

  for (const relationship of project.relationships) {
    if (!isGameStoryLinkType(relationship.type) && !relationship.gameStory) {
      continue;
    }

    if (!project.entities[relationship.sourceId] || !project.entities[relationship.targetId]) {
      issues.push({
        id: `branch-missing-target-${relationship.id}`,
        severity: "error",
        title: "Branch with missing endpoint",
        details: "A game story relationship points to a missing node.",
        relationshipId: relationship.id
      });
    }
  }

  for (const node of nodes) {
    const metadataForNode = normalizeGameStoryEntityMetadata(node.gameStory, node.type);

    if (metadataForNode.role !== "ending" && !outgoingGameStoryTargetIds(project, node.id).length) {
      issues.push({
        id: `dead-end-${node.id}`,
        severity: "warning",
        title: "Non-ending dead end",
        details: `${node.title} has no outgoing branch or dialogue response.`,
        entityId: node.id
      });
    }

    if (metadataForNode.role === "ending" && node.id !== metadata.startNodeId && !incomingGameStorySourceIds(project, node.id).length) {
      issues.push({
        id: `ending-no-path-${node.id}`,
        severity: "warning",
        title: "Ending has no incoming path",
        details: `${node.title} is an ending, but no branch reaches it.`,
        entityId: node.id
      });
    }

    if (metadataForNode.timelineAnchorId && !project.entities[metadataForNode.timelineAnchorId]) {
      issues.push({
        id: `missing-timeline-anchor-${node.id}`,
        severity: "warning",
        title: "Missing timeline anchor",
        details: `${node.title} references a missing timeline event.`,
        entityId: node.id
      });
    }

    addInvalidStateReferenceIssues(
      issues,
      project,
      variableIds,
      `entry-${node.id}`,
      "Node entry condition references a missing state variable.",
      metadataForNode.entryConditions,
      [],
      node.id
    );
    addInvalidStateReferenceIssues(
      issues,
      project,
      variableIds,
      `exit-${node.id}`,
      "Node exit effect references a missing state variable.",
      [],
      metadataForNode.exitEffects,
      node.id
    );
    addImpossibleConditionIssues(issues, project, `node-${node.id}`, metadataForNode.entryConditions, node.id);

    if (metadataForNode.dialogue) {
      addDialogueIssues(issues, project, variableIds, node, metadataForNode.dialogue);
    }

    if (metadataForNode.quest) {
      addQuestIssues(issues, project, variableIds, node, metadataForNode.quest);
    }
  }

  for (const relationship of getGameStoryRelationships(project)) {
    const relationshipMetadata = normalizeGameStoryRelationshipMetadata(relationship.gameStory);

    addInvalidStateReferenceIssues(
      issues,
      project,
      variableIds,
      `branch-${relationship.id}`,
      "Branch requirement or effect references a missing state variable.",
      relationshipMetadata.requirements,
      relationshipMetadata.effects,
      undefined,
      relationship.id
    );
    addImpossibleConditionIssues(
      issues,
      project,
      `branch-${relationship.id}`,
      relationshipMetadata.requirements,
      undefined,
      relationship.id
    );
  }

  return issues;
}

function appendEventEffect(project: StoryProject, eventId: string, effect: TimelineEffect): StoryProject {
  const event = project.entities[eventId];

  if (!event) {
    return project;
  }

  const timeline = ensureEventTimeline(event);

  return touchProject({
    ...project,
    entities: {
      ...project.entities,
      [eventId]: {
        ...event,
        timeline: {
          ...timeline,
          effects: [...timeline.effects, effect]
        },
        updatedAt: nowIso()
      }
    }
  });
}

function normalizeGameStateVariable(variable: Partial<GameStateVariableDefinition>): GameStateVariableDefinition {
  const kind = isGameStateVariableKind(variable.kind) ? variable.kind : "flag";
  const id = slugify(variable.id ?? "") || makeId("state");
  const enumOptions = normalizeStringArray(variable.enumOptions);

  return {
    id,
    label: normalizeRuleText(variable.label, humanizeId(id)),
    kind,
    defaultValue: coerceGameStateValue(variable.defaultValue ?? defaultGameStateValue(kind), kind),
    enumOptions: kind === "enum" ? (enumOptions.length ? enumOptions : ["Unset"]) : enumOptions,
    entityId: normalizeOptionalId(variable.entityId),
    notes: normalizeRuleText(variable.notes, "")
  };
}

function normalizeGameStateConditions(conditions: GameStateCondition[] | undefined): GameStateCondition[] {
  return (conditions ?? []).map(normalizeGameStateCondition);
}

function normalizeGameStateCondition(condition: Partial<GameStateCondition>): GameStateCondition {
  return {
    id: normalizeOptionalId(condition.id) ?? makeId("condition"),
    variableId: normalizeOptionalId(condition.variableId) ?? "",
    operator: isGameStateOperator(condition.operator) ? condition.operator : "equals",
    value: normalizeGameStateLooseValue(condition.value)
  };
}

function normalizeGameStateEffects(effects: GameStateEffect[] | undefined): GameStateEffect[] {
  return (effects ?? []).map(normalizeGameStateEffect);
}

function normalizeGameStateEffect(effect: Partial<GameStateEffect>): GameStateEffect {
  return {
    id: normalizeOptionalId(effect.id) ?? makeId("effect"),
    variableId: normalizeOptionalId(effect.variableId) ?? "",
    operation: isGameStateEffectOperation(effect.operation) ? effect.operation : "set",
    value: normalizeGameStateLooseValue(effect.value)
  };
}

function normalizeGameDialogueLine(line: Partial<GameDialogueLine>): GameDialogueLine {
  return {
    id: normalizeOptionalId(line.id) ?? makeId("line"),
    speakerId: normalizeOptionalId(line.speakerId),
    text: normalizeRuleText(line.text, ""),
    tone: normalizeRuleText(line.tone, ""),
    voiceNotes: normalizeRuleText(line.voiceNotes, "")
  };
}

function normalizeGameDialogueResponse(response: Partial<GameDialogueResponse>): GameDialogueResponse {
  return {
    id: normalizeOptionalId(response.id) ?? makeId("response"),
    text: normalizeRuleText(response.text, ""),
    targetNodeId: normalizeOptionalId(response.targetNodeId),
    conditions: normalizeGameStateConditions(response.conditions),
    effects: normalizeGameStateEffects(response.effects),
    notes: normalizeRuleText(response.notes, "")
  };
}

function normalizeGameDialogueVariant(variant: Partial<GameDialogueVariant>): GameDialogueVariant {
  return {
    id: normalizeOptionalId(variant.id) ?? makeId("variant"),
    label: normalizeRuleText(variant.label, "Variant"),
    conditions: normalizeGameStateConditions(variant.conditions),
    lines: (variant.lines ?? []).map(normalizeGameDialogueLine)
  };
}

function normalizeGameQuestObjective(objective: Partial<GameQuestObjective>): GameQuestObjective {
  return {
    id: normalizeOptionalId(objective.id) ?? makeId("objective"),
    text: normalizeRuleText(objective.text, ""),
    optional: Boolean(objective.optional),
    hidden: Boolean(objective.hidden),
    completeConditions: normalizeGameStateConditions(objective.completeConditions)
  };
}

export function coerceGameStateValue(value: unknown, kind: GameStateVariableKind): GameStateValue {
  if (kind === "flag" || kind === "inventory") {
    if (typeof value === "string") {
      return value === "true" || value === "1" || value.toLowerCase() === "yes";
    }

    return Boolean(value);
  }

  if (kind === "number" || kind === "faction_reputation") {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  return typeof value === "string" ? value : String(value ?? "");
}

function defaultGameStateValue(kind: GameStateVariableKind): GameStateValue {
  if (kind === "number" || kind === "faction_reputation") {
    return 0;
  }

  if (kind === "enum") {
    return "Unset";
  }

  if (kind === "relationship") {
    return "neutral";
  }

  return false;
}

function normalizeGameStateLooseValue(value: unknown): GameStateValue {
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }

  return "";
}

function evaluateGameStateCondition(
  condition: GameStateCondition,
  state: Record<string, GameStateValue>,
  variables: Map<string, GameStateVariableDefinition>
): boolean {
  const variable = variables.get(condition.variableId);

  if (!variable) {
    return false;
  }

  const currentValue = state[variable.id] ?? variable.defaultValue;
  const expectedValue = coerceGameStateValue(condition.value, variable.kind);

  if (condition.operator === "has") {
    return Boolean(currentValue);
  }

  if (condition.operator === "not_has") {
    return !currentValue;
  }

  if (condition.operator === "greater_than") {
    return Number(currentValue) > Number(expectedValue);
  }

  if (condition.operator === "less_than") {
    return Number(currentValue) < Number(expectedValue);
  }

  if (condition.operator === "not_equals") {
    return currentValue !== expectedValue;
  }

  return currentValue === expectedValue;
}

function gameStateVariableMap(project: StoryProject): Map<string, GameStateVariableDefinition> {
  return new Map(normalizeGameStoryProjectMetadata(project.gameStory).stateVariables.map((variable) => [variable.id, variable]));
}

function outgoingGameStoryTargetIds(project: StoryProject, nodeId: string): string[] {
  const branchTargets = project.relationships
    .filter((relationship) => relationship.sourceId === nodeId && relationship.type === "branches_to")
    .map((relationship) => relationship.targetId);
  const responseTargets =
    project.entities[nodeId]?.gameStory?.dialogue?.responses
      .map((response) => response.targetNodeId)
      .filter((targetId): targetId is string => Boolean(targetId)) ?? [];

  return [...branchTargets, ...responseTargets].filter((targetId) => Boolean(project.entities[targetId]));
}

function incomingGameStorySourceIds(project: StoryProject, nodeId: string): string[] {
  const branchSources = project.relationships
    .filter((relationship) => relationship.targetId === nodeId && relationship.type === "branches_to")
    .map((relationship) => relationship.sourceId);
  const responseSources = Object.values(project.entities)
    .filter((entity) => entity.gameStory?.dialogue?.responses.some((response) => response.targetNodeId === nodeId))
    .map((entity) => entity.id);

  return [...branchSources, ...responseSources].filter((sourceId) => Boolean(project.entities[sourceId]));
}

function addInvalidStateReferenceIssues(
  issues: GameContinuityIssue[],
  project: StoryProject,
  variableIds: Set<string>,
  idPrefix: string,
  details: string,
  conditions: GameStateCondition[],
  effects: GameStateEffect[],
  entityId?: string,
  relationshipId?: string
) {
  const validation = normalizeGameStoryProjectMetadata(project.gameStory).validation;

  if (!validation.checkInvalidStateReferences) {
    return;
  }

  const missingCondition = conditions.find((condition) => condition.variableId && !variableIds.has(condition.variableId));
  const missingEffect = effects.find((effect) => effect.variableId && !variableIds.has(effect.variableId));

  if (!missingCondition && !missingEffect) {
    return;
  }

  issues.push({
    id: `invalid-state-${idPrefix}`,
    severity: "error",
    title: "Invalid state reference",
    details,
    entityId,
    relationshipId
  });
}

function addImpossibleConditionIssues(
  issues: GameContinuityIssue[],
  project: StoryProject,
  idPrefix: string,
  conditions: GameStateCondition[],
  entityId?: string,
  relationshipId?: string
) {
  const reason = impossibleConditionReason(project, conditions);

  if (!reason) {
    return;
  }

  issues.push({
    id: `impossible-${idPrefix}`,
    severity: "warning",
    title: "Impossible condition",
    details: reason,
    entityId,
    relationshipId
  });
}

function impossibleConditionReason(project: StoryProject, conditions: GameStateCondition[]): string {
  const variables = gameStateVariableMap(project);
  const equalsByVariable = new Map<string, GameStateValue>();
  const greaterThanByVariable = new Map<string, number>();
  const lessThanByVariable = new Map<string, number>();

  for (const condition of conditions) {
    const variable = variables.get(condition.variableId);

    if (!variable) {
      continue;
    }

    const value = coerceGameStateValue(condition.value, variable.kind);

    if (condition.operator === "equals") {
      const existing = equalsByVariable.get(variable.id);

      if (existing !== undefined && existing !== value) {
        return `${variable.label} is required to equal two different values.`;
      }

      equalsByVariable.set(variable.id, value);
    }

    if (condition.operator === "not_equals" && equalsByVariable.get(variable.id) === value) {
      return `${variable.label} is both required and forbidden.`;
    }

    if (condition.operator === "greater_than") {
      greaterThanByVariable.set(variable.id, Math.max(greaterThanByVariable.get(variable.id) ?? -Infinity, Number(value)));
    }

    if (condition.operator === "less_than") {
      lessThanByVariable.set(variable.id, Math.min(lessThanByVariable.get(variable.id) ?? Infinity, Number(value)));
    }
  }

  for (const [variableId, greaterThan] of greaterThanByVariable) {
    const lessThan = lessThanByVariable.get(variableId);

    if (lessThan !== undefined && greaterThan >= lessThan) {
      const label = variables.get(variableId)?.label ?? variableId;

      return `${label} has incompatible numeric bounds.`;
    }
  }

  return "";
}

function addDialogueIssues(
  issues: GameContinuityIssue[],
  project: StoryProject,
  variableIds: Set<string>,
  node: StoryEntity,
  dialogue: GameDialogueMetadata
) {
  const validation = normalizeGameStoryProjectMetadata(project.gameStory).validation;

  for (const line of dialogue.lines) {
    if (line.speakerId && !project.entities[line.speakerId]) {
      issues.push({
        id: `missing-speaker-${node.id}-${line.id}`,
        severity: "warning",
        title: "Missing speaker",
        details: `${node.title} references a missing dialogue speaker.`,
        entityId: node.id
      });
    }
  }

  for (const response of dialogue.responses) {
    if (validation.checkDialogueDeadEnds && !response.targetNodeId && !response.effects.length) {
      issues.push({
        id: `dialogue-dead-response-${node.id}-${response.id}`,
        severity: "warning",
        title: "Dialogue choice has no outcome",
        details: `${node.title} has a player response without a branch target or state effect.`,
        entityId: node.id
      });
    }

    if (response.targetNodeId && !project.entities[response.targetNodeId]) {
      issues.push({
        id: `dialogue-missing-target-${node.id}-${response.id}`,
        severity: "error",
        title: "Dialogue choice target is missing",
        details: `${node.title} has a response pointing to a missing node.`,
        entityId: node.id
      });
    }

    addInvalidStateReferenceIssues(
      issues,
      project,
      variableIds,
      `dialogue-response-${node.id}-${response.id}`,
      "Dialogue response condition or effect references a missing state variable.",
      response.conditions,
      response.effects,
      node.id
    );
    addImpossibleConditionIssues(issues, project, `dialogue-response-${node.id}-${response.id}`, response.conditions, node.id);
  }

  for (const variant of dialogue.variants) {
    addInvalidStateReferenceIssues(
      issues,
      project,
      variableIds,
      `dialogue-variant-${node.id}-${variant.id}`,
      "Dialogue variant references a missing state variable.",
      variant.conditions,
      [],
      node.id
    );
    addImpossibleConditionIssues(issues, project, `dialogue-variant-${node.id}-${variant.id}`, variant.conditions, node.id);
  }
}

function addQuestIssues(
  issues: GameContinuityIssue[],
  project: StoryProject,
  variableIds: Set<string>,
  node: StoryEntity,
  quest: GameQuestMetadata
) {
  if (quest.giverId && !project.entities[quest.giverId]) {
    issues.push({
      id: `missing-quest-giver-${node.id}`,
      severity: "warning",
      title: "Missing quest giver",
      details: `${node.title} references a missing quest giver.`,
      entityId: node.id
    });
  }

  if (!quest.objectives.length) {
    issues.push({
      id: `quest-no-objectives-${node.id}`,
      severity: "warning",
      title: "Quest has no objectives",
      details: `${node.title} needs at least one objective.`,
      entityId: node.id
    });
  }

  addInvalidStateReferenceIssues(
    issues,
    project,
    variableIds,
    `quest-success-${node.id}`,
    "Quest success or failure condition references a missing state variable.",
    [...quest.successConditions, ...quest.failureConditions],
    [],
    node.id
  );
  addImpossibleConditionIssues(issues, project, `quest-success-${node.id}`, quest.successConditions, node.id);
  addImpossibleConditionIssues(issues, project, `quest-failure-${node.id}`, quest.failureConditions, node.id);

  for (const objective of quest.objectives) {
    addInvalidStateReferenceIssues(
      issues,
      project,
      variableIds,
      `quest-objective-${node.id}-${objective.id}`,
      "Quest objective condition references a missing state variable.",
      objective.completeConditions,
      [],
      node.id
    );
    addImpossibleConditionIssues(
      issues,
      project,
      `quest-objective-${node.id}-${objective.id}`,
      objective.completeConditions,
      node.id
    );
  }
}

function isGameStateVariableKind(value: unknown): value is GameStateVariableKind {
  return (
    value === "flag" ||
    value === "number" ||
    value === "enum" ||
    value === "relationship" ||
    value === "faction_reputation" ||
    value === "inventory"
  );
}

function isGameStateOperator(value: unknown): value is GameStateCondition["operator"] {
  return (
    value === "equals" ||
    value === "not_equals" ||
    value === "greater_than" ||
    value === "less_than" ||
    value === "has" ||
    value === "not_has"
  );
}

function isGameStateEffectOperation(value: unknown): value is GameStateEffect["operation"] {
  return value === "set" || value === "increment" || value === "decrement" || value === "add" || value === "remove";
}

function isGameStoryRole(value: unknown): value is GameStoryNodeRole {
  return value === "scene" || value === "quest" || value === "dialogue" || value === "ending";
}

function isGameStoryStatus(value: unknown): value is GameStoryEntityMetadata["status"] {
  return value === "draft" || value === "ready" || value === "deprecated";
}

function isGameQuestType(value: unknown): value is GameQuestMetadata["questType"] {
  return value === "main" || value === "side" || value === "companion" || value === "faction" || value === "hidden";
}

function normalizeOptionalId(value: string | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeStringArray(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function mergeTypeCatalog<T extends { id: string; builtIn: boolean }>(defaults: T[], incoming: T[]): T[] {
  const merged = new Map<string, T>();

  for (const type of defaults) {
    merged.set(type.id, { ...type });
  }

  for (const type of incoming) {
    merged.set(type.id, {
      ...type,
      builtIn: defaults.some((defaultType) => defaultType.id === type.id) ? true : Boolean(type.builtIn)
    });
  }

  return [...merged.values()];
}

function fallbackItemType(typeId: ItemTypeId): ItemTypeDefinition {
  return {
    id: typeId,
    label: humanizeId(typeId),
    color: "#64748b",
    icon: "sparkles",
    builtIn: false
  };
}

function fallbackLinkType(typeId: LinkTypeId): LinkTypeDefinition {
  return {
    id: typeId,
    label: humanizeId(typeId),
    color: "#46605a",
    icon: "link",
    direction: "directed",
    builtIn: false
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function humanizeId(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeRuleText(value: string | undefined, fallback: string): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function defaultTimelineLaneName(track: number): string {
  return `Track ${track + 1}`;
}

function normalizeTimelineLaneNames(
  laneNames: string[] | undefined,
  entities: Record<string, StoryEntity>,
  minCount = 1
): string[] {
  const maxEventTrack = Object.values(entities)
    .filter((entity) => entity.type === BUILT_IN_EVENT_TYPE_ID)
    .reduce((maxTrack, entity) => Math.max(maxTrack, normalizeTimelineTrack(entity.timeline?.track)), 0);
  const count = Math.max(1, minCount, laneNames?.length ?? 0, maxEventTrack + 1);

  return Array.from({ length: count }, (_, track) => {
    const name = laneNames?.[track];

    return typeof name === "string" && name.trim() ? name.trim() : defaultTimelineLaneName(track);
  });
}

function removeTimelineLaneName(laneNames: string[], targetTrack: number): string[] {
  const nextLaneNames: string[] = [];

  laneNames.forEach((name, track) => {
    if (track === targetTrack) {
      return;
    }

    const nextTrack = nextLaneNames.length;
    nextLaneNames.push(name === defaultTimelineLaneName(track) ? defaultTimelineLaneName(nextTrack) : name);
  });

  return nextLaneNames.length ? nextLaneNames : [defaultTimelineLaneName(0)];
}

function normalizeTimelineTrack(track: number | undefined): number {
  return typeof track === "number" && Number.isFinite(track) ? Math.max(0, Math.floor(track)) : 0;
}
