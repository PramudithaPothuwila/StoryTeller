export const entityTypes = ["character", "note", "location", "event", "item", "faction"] as const;

export type EntityType = (typeof entityTypes)[number];

export type RelationshipType =
  | "relates_to"
  | "knows"
  | "hides"
  | "loves"
  | "opposes"
  | "owns"
  | "located_in"
  | "causes"
  | "member_of";

export interface Point {
  x: number;
  y: number;
}

export interface StoryEntity {
  id: string;
  type: EntityType;
  title: string;
  summary: string;
  tags: string[];
  publicInfo: string;
  privateInfo: string;
  bodyMarkdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoryRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  label: string;
  notes: string;
  startsAt?: string;
  endsAt?: string;
  timelineContext?: string;
}

export interface StoryProject {
  schemaVersion: 1;
  title: string;
  updatedAt: string;
  entities: Record<string, StoryEntity>;
  relationships: StoryRelationship[];
  layout: Record<string, Point>;
}

export interface EntityTypeMeta {
  label: string;
  accent: string;
  softAccent: string;
}

export interface RelationshipTypeMeta {
  value: RelationshipType;
  label: string;
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
