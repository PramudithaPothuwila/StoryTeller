import {
  GameStateCondition,
  GameStateEffect,
  GameplayTransition,
  GraphPresence,
  ProjectMode,
  CharacterRuntimeMetadata,
  StoryRuntimeCharacterKnowledge,
  StoryProject,
  TimelineEffect
} from "../types";

export const STORY_RUNTIME_SCHEMA_VERSION = 1;
export const STORY_RUNTIME_BUNDLE_KIND = "storyteller.runtime.bundle";

export type RuntimeValidationSeverity = "warning" | "error";
export type RuntimeFactSourceKind = "author_fact" | "world_rule" | "relationship" | "entity";

export interface StoryRuntimeBundle {
  kind: typeof STORY_RUNTIME_BUNDLE_KIND;
  schemaVersion: typeof STORY_RUNTIME_SCHEMA_VERSION;
  exportedAt: string;
  sourceProject: RuntimeSourceProject;
  manifest: RuntimeManifest;
  entities: RuntimeEntity[];
  facts: RuntimeFact[];
  evidence: RuntimeEvidence[];
  relationships: RuntimeRelationship[];
  timeline: RuntimeTimeline;
  storyFlow: RuntimeStoryFlow;
  characterProfiles: RuntimeCharacterProfile[];
  validation: RuntimeValidationIssue[];
}

export interface RuntimeSourceProject {
  title: string;
  schemaVersion: StoryProject["schemaVersion"];
  projectMode: ProjectMode;
  updatedAt: string;
}

export interface RuntimeManifest {
  startNodeId?: string;
  startTimelineEventId?: string;
  capabilities: RuntimeCapability[];
  warningCount: number;
  errorCount: number;
}

export type RuntimeCapability =
  | "semantic_graph"
  | "timeline"
  | "story_flow"
  | "facts"
  | "evidence"
  | "character_profiles";

export interface RuntimeEntity {
  id: string;
  sourceId: string;
  type: string;
  graphPresence: GraphPresence;
  title: string;
  summary: string;
  tags: string[];
  visibleText: RuntimeVisibleText;
  authorHiddenText: string;
  metadata: {
    worldRule?: StoryProject["entities"][string]["worldRule"];
    gameStory?: StoryProject["entities"][string]["gameStory"];
  };
}

export interface RuntimeVisibleText {
  publicInfo: string;
  bodyMarkdown: string;
}

export interface RuntimeFact {
  id: string;
  sourceId: string;
  sourceKind: RuntimeFactSourceKind;
  subjectId: string;
  predicate: string;
  objectId?: string;
  value?: string | number | boolean;
  canonical: boolean;
  reliability: number;
  visibleToPlayer: boolean;
  notes: string;
}

export interface RuntimeEvidence {
  id: string;
  sourceId: string;
  entityId: string;
  title: string;
  evidenceType: string;
  supportsFactIds: string[];
  contradictsFactIds: string[];
  reliability: number;
  visibleText: RuntimeVisibleText;
  authorHiddenText: string;
  notes: string;
}

export interface RuntimeRelationship {
  id: string;
  sourceId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  label: string;
  notes: string;
  startsAtEventId?: string;
  endsAtEventId?: string;
  timelineVersionEventIds: string[];
}

export interface RuntimeTimeline {
  events: RuntimeTimelineEvent[];
  relationshipAnchors: RuntimeRelationshipAnchor[];
}

export interface RuntimeTimelineEvent {
  id: string;
  sourceId: string;
  title: string;
  order: number;
  track: number;
  effects: TimelineEffect[];
}

export interface RuntimeRelationshipAnchor {
  relationshipId: string;
  startsAtEventId?: string;
  endsAtEventId?: string;
  versionEventIds: string[];
}

export interface RuntimeStoryFlow {
  startNodeId?: string;
  nodes: RuntimeStoryNode[];
  transitions: RuntimeStoryTransition[];
}

export interface RuntimeStoryNode {
  id: string;
  sourceId: string;
  type: string;
  title: string;
  role: string;
  status: string;
  criticalPath: boolean;
  entryConditions: GameStateCondition[];
  exitEffects: GameStateEffect[];
}

export interface RuntimeStoryTransition {
  id: string;
  sourceId: string;
  sourceNodeId: string;
  targetNodeId: string;
  choiceText: string;
  requirements: GameplayTransition["requirements"];
  effects: GameStateEffect[];
  priority: number;
  notes: string;
}

export interface RuntimeCharacterProfile {
  id: string;
  sourceId: string;
  title: string;
  summary: string;
  publicInfo: string;
  authorHiddenText: string;
  runtimeCharacter?: CharacterRuntimeMetadata;
  knowledge: StoryRuntimeCharacterKnowledge[];
  relationshipIds: string[];
}

export interface RuntimeValidationIssue {
  id: string;
  severity: RuntimeValidationSeverity;
  title: string;
  details: string;
  sourceId?: string;
}
