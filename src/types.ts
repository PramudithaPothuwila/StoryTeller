export const BUILT_IN_EVENT_TYPE_ID = "event";
export const BUILT_IN_WORLD_RULE_TYPE_ID = "world_rule";
export const BUILT_IN_TRIGGER_LINK_TYPE_ID = "triggers";
export const STORY_PROJECT_SCHEMA_VERSION = 6;

export type ItemTypeId = string;
export type LinkTypeId = string;
export type LinkDirection = "directed" | "mutual";
export type ProjectMode = "story" | "game_story";
export type GraphPresence = "world" | "story_flow" | "both";

export interface Point {
  x: number;
  y: number;
}

export interface ItemTypeDefinition {
  id: ItemTypeId;
  label: string;
  color: string;
  icon: string;
  builtIn: boolean;
}

export interface LinkTypeDefinition {
  id: LinkTypeId;
  label: string;
  color: string;
  icon: string;
  direction: LinkDirection;
  builtIn: boolean;
}

export interface EventTimeline {
  order: number;
  track?: number;
  effects: TimelineEffect[];
}

export type TimelineEffect =
  | {
      id: string;
      action: "start";
      relationshipId: string;
      sourceId: string;
      targetId: string;
      type: LinkTypeId;
      label: string;
      notes: string;
    }
  | {
      id: string;
      action: "update";
      relationshipId: string;
      type?: LinkTypeId;
      label?: string;
      notes?: string;
    }
  | {
      id: string;
      action: "end";
      relationshipId: string;
    };

export type TimelineEffectDraft =
  | {
      action: "start";
      sourceId: string;
      targetId: string;
      type: LinkTypeId;
      label: string;
      notes: string;
    }
  | {
      action: "update";
      relationshipId: string;
      type?: LinkTypeId;
      label?: string;
      notes?: string;
    }
  | {
      action: "end";
      relationshipId: string;
    };

export interface RelationshipTimelineVersion {
  id: string;
  eventId: string;
  type?: LinkTypeId;
  label?: string;
  notes?: string;
}

export interface WorldRuleMetadata {
  domain: string;
  status: string;
  statement: string;
  reason: string;
  limits: string;
  exceptions: string;
  storyPurpose: string;
}

export type GameStateVariableKind =
  | "flag"
  | "number"
  | "enum"
  | "relationship"
  | "faction_reputation"
  | "inventory";
export type GameStateValue = boolean | number | string;
export type GameStateOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "contains"
  | "exists"
  | "has"
  | "not_has";
export type GameStateEffectOperation = "set" | "increment" | "decrement" | "add" | "remove";
export type GameStoryNodeRole = "scene" | "quest" | "dialogue" | "ending";
export type GameStoryNodeStatus = "draft" | "ready" | "deprecated";
export type GameQuestType = "main" | "side" | "companion" | "faction" | "hidden";
export type GameContinuitySeverity = "warning" | "error";

export interface GameStateVariableDefinition {
  id: string;
  label: string;
  kind: GameStateVariableKind;
  defaultValue: GameStateValue;
  enumOptions: string[];
  entityId?: string;
  notes: string;
}

export type GameplayVariableDefinition = GameStateVariableDefinition;

export interface GameStateCondition {
  id: string;
  variableId: string;
  operator: GameStateOperator;
  value: GameStateValue;
}

export type ConditionExpression = GameStateCondition;

export type ConditionGroup =
  | {
      all: Array<ConditionGroup | ConditionExpression>;
    }
  | {
      any: Array<ConditionGroup | ConditionExpression>;
    }
  | {
      not: ConditionGroup | ConditionExpression;
    };

export interface GameplayEffect {
  id: string;
  variableId: string;
  operation: GameStateEffectOperation;
  value: GameStateValue;
}

export type GameStateEffect = GameplayEffect;

export interface GameStoryValidationSettings {
  checkUnreachableNodes: boolean;
  checkInvalidStateReferences: boolean;
  checkDialogueDeadEnds: boolean;
}

export interface GameStoryProjectMetadata {
  startNodeId?: string;
  stateVariables: GameStateVariableDefinition[];
  validation: GameStoryValidationSettings;
}

export interface GameDialogueLine {
  id: string;
  speakerId?: string;
  text: string;
  tone: string;
  voiceNotes: string;
}

export interface GameDialogueResponse {
  id: string;
  text: string;
  targetNodeId?: string;
  conditions: GameStateCondition[];
  effects: GameStateEffect[];
  notes: string;
}

export interface GameDialogueVariant {
  id: string;
  label: string;
  conditions: GameStateCondition[];
  lines: GameDialogueLine[];
}

export interface GameDialogueMetadata {
  lines: GameDialogueLine[];
  responses: GameDialogueResponse[];
  variants: GameDialogueVariant[];
}

export interface GameQuestObjective {
  id: string;
  text: string;
  optional: boolean;
  hidden: boolean;
  completeConditions: GameStateCondition[];
}

export interface GameQuestMetadata {
  questType: GameQuestType;
  giverId?: string;
  objectives: GameQuestObjective[];
  successConditions: GameStateCondition[];
  failureConditions: GameStateCondition[];
  rewards: string;
  consequences: string;
}

export interface GameStoryEntityMetadata {
  role: GameStoryNodeRole;
  status: GameStoryNodeStatus;
  criticalPath: boolean;
  timelineAnchorId?: string;
  entryConditions: GameStateCondition[];
  exitEffects: GameStateEffect[];
  dialogue?: GameDialogueMetadata;
  quest?: GameQuestMetadata;
}

export interface GameStoryRelationshipMetadata {
  choiceText: string;
  requirements: GameStateCondition[];
  effects: GameStateEffect[];
  consequenceNotes: string;
  priority: number;
}

export interface StoryEntity {
  id: string;
  type: ItemTypeId;
  graphPresence: GraphPresence;
  title: string;
  summary: string;
  tags: string[];
  publicInfo: string;
  privateInfo: string;
  bodyMarkdown: string;
  createdAt: string;
  updatedAt: string;
  timeline?: EventTimeline;
  worldRule?: WorldRuleMetadata;
  gameStory?: GameStoryEntityMetadata;
}

export interface StoryRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: LinkTypeId;
  label: string;
  notes: string;
  startsAtEventId?: string;
  endsAtEventId?: string;
  timelineVersions?: RelationshipTimelineVersion[];
  startsAt?: string;
  endsAt?: string;
  timelineContext?: string;
  gameStory?: GameStoryRelationshipMetadata;
}

export type SemanticRelationship = StoryRelationship;

export interface GameplayTransitionChoice {
  text: string;
  intent?: string;
}

export interface GameplayTransitionPresentation {
  priority: number;
}

export interface GameplayTransitionAuthorNotes {
  purpose: string;
  legacyNotes?: string;
}

export interface GameplayTransition {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  choice: GameplayTransitionChoice;
  requirements: ConditionGroup;
  effects: GameplayEffect[];
  presentation: GameplayTransitionPresentation;
  authorNotes: GameplayTransitionAuthorNotes;
  metadata: Record<string, unknown>;
}

export interface DesignConstraint {
  id: string;
  entityId?: string;
  category: string;
  rule: string;
  severity: "required" | "preferred" | "optional";
  metadata?: Record<string, unknown>;
}

export interface AiProposal {
  id: string;
  status: "proposed" | "approved" | "rejected" | "applied";
  createdAt: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface StoryProject {
  schemaVersion: typeof STORY_PROJECT_SCHEMA_VERSION;
  title: string;
  updatedAt: string;
  projectMode: ProjectMode;
  gameStory?: GameStoryProjectMetadata;
  itemTypes: ItemTypeDefinition[];
  linkTypes: LinkTypeDefinition[];
  timelineLaneNames: string[];
  entities: Record<string, StoryEntity>;
  relationships: SemanticRelationship[];
  gameplayTransitions: GameplayTransition[];
  designConstraints: DesignConstraint[];
  aiProposals: AiProposal[];
  layout: Record<string, Point>;
  storyFlowLayout: Record<string, Point>;
}

export type Selection =
  | {
      kind: "entity";
      id: string;
    }
  | {
      kind: "relationship";
      id: string;
    };

export interface GameContinuityIssue {
  id: string;
  severity: GameContinuitySeverity;
  title: string;
  details: string;
  entityId?: string;
  relationshipId?: string;
}

export interface GamePlaythroughChoice {
  id: string;
  label: string;
  targetNodeId: string;
  available: boolean;
  lockedReason?: string;
  conditions: GameStateCondition[];
  effects: GameStateEffect[];
  relationshipId?: string;
  transitionId?: string;
  responseId?: string;
}
