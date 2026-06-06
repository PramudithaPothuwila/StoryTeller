export const BUILT_IN_EVENT_TYPE_ID = "event";

export type ItemTypeId = string;
export type LinkTypeId = string;
export type LinkDirection = "directed" | "mutual";

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

export interface StoryEntity {
  id: string;
  type: ItemTypeId;
  title: string;
  summary: string;
  tags: string[];
  publicInfo: string;
  privateInfo: string;
  bodyMarkdown: string;
  createdAt: string;
  updatedAt: string;
  timeline?: EventTimeline;
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
}

export interface StoryProject {
  schemaVersion: 2;
  title: string;
  updatedAt: string;
  itemTypes: ItemTypeDefinition[];
  linkTypes: LinkTypeDefinition[];
  entities: Record<string, StoryEntity>;
  relationships: StoryRelationship[];
  layout: Record<string, Point>;
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
