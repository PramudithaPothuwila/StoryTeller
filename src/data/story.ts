import {
  EntityType,
  EntityTypeMeta,
  Point,
  RelationshipType,
  RelationshipTypeMeta,
  StoryEntity,
  StoryProject,
  StoryRelationship
} from "../types";

export const entityTypeMeta: Record<EntityType, EntityTypeMeta> = {
  character: {
    label: "Character",
    accent: "#0f766e",
    softAccent: "#d8f3ef"
  },
  note: {
    label: "Note",
    accent: "#b45309",
    softAccent: "#f7e6c7"
  },
  location: {
    label: "Location",
    accent: "#2563eb",
    softAccent: "#dbeafe"
  },
  event: {
    label: "Event",
    accent: "#be123c",
    softAccent: "#ffe1e8"
  },
  item: {
    label: "Item",
    accent: "#7c3aed",
    softAccent: "#ece4ff"
  },
  faction: {
    label: "Faction",
    accent: "#15803d",
    softAccent: "#dcfce7"
  }
};

export const relationshipTypeMeta: RelationshipTypeMeta[] = [
  { value: "relates_to", label: "Relates to" },
  { value: "knows", label: "Knows" },
  { value: "hides", label: "Hides" },
  { value: "loves", label: "Loves" },
  { value: "opposes", label: "Opposes" },
  { value: "owns", label: "Owns" },
  { value: "located_in", label: "Located in" },
  { value: "causes", label: "Causes" },
  { value: "member_of", label: "Member of" }
];

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function relationshipLabel(type: RelationshipType): string {
  return relationshipTypeMeta.find((item) => item.value === type)?.label ?? "Relates to";
}

export function createStoryEntity(type: EntityType, title?: string): StoryEntity {
  const timestamp = nowIso();
  const label = entityTypeMeta[type].label;

  return {
    id: makeId(type),
    type,
    title: title ?? `New ${label}`,
    summary: "",
    tags: [],
    publicInfo: "",
    privateInfo: "",
    bodyMarkdown: "",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function createStoryRelationship(
  sourceId: string,
  targetId: string,
  type: RelationshipType = "relates_to"
): StoryRelationship {
  return {
    id: makeId("link"),
    sourceId,
    targetId,
    type,
    label: relationshipLabel(type),
    notes: ""
  };
}

export function createBlankProject(title = "Untitled Story"): StoryProject {
  return {
    schemaVersion: 1,
    title,
    updatedAt: nowIso(),
    entities: {},
    relationships: [],
    layout: {}
  };
}

export function createStarterProject(): StoryProject {
  const project = createBlankProject("The Hidden Crown");
  const heir = createStoryEntity("character", "Mara Vale");
  const mentor = createStoryEntity("character", "Orin Ash");
  const city = createStoryEntity("location", "The Glass Quarter");
  const incident = createStoryEntity("event", "Market Fire");
  const crown = createStoryEntity("item", "Hidden Crown");

  heir.summary = "A courier with a name people keep recognizing before she does.";
  heir.publicInfo = "Known for crossing the city faster than any guild runner.";
  heir.privateInfo = "Carries the royal bloodline without knowing it.";

  mentor.summary = "A retired archivist who knows too much about the old succession.";
  mentor.publicInfo = "Runs a small map shop near the west canal.";
  mentor.privateInfo = "Destroyed the last public record of Mara's lineage.";

  city.summary = "A neighborhood of mirrors, canal bridges, and unofficial histories.";
  incident.summary = "The moment that puts Mara, Orin, and the missing crown on the same path.";
  crown.summary = "A political symbol that can unite the city or break it apart.";
  crown.privateInfo = "The crown is hidden in plain sight inside Orin's signet box.";

  const entities = [heir, mentor, city, incident, crown];
  const relationships = [
    createStoryRelationship(mentor.id, heir.id, "hides"),
    createStoryRelationship(heir.id, city.id, "located_in"),
    createStoryRelationship(incident.id, heir.id, "causes"),
    createStoryRelationship(crown.id, incident.id, "causes")
  ];

  return {
    ...project,
    entities: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    relationships,
    layout: {
      [heir.id]: { x: 120, y: 90 },
      [mentor.id]: { x: 470, y: 80 },
      [city.id]: { x: 120, y: 330 },
      [incident.id]: { x: 470, y: 315 },
      [crown.id]: { x: 800, y: 205 }
    }
  };
}

export function addEntityToProject(project: StoryProject, entity: StoryEntity, position: Point): StoryProject {
  return touchProject({
    ...project,
    entities: {
      ...project.entities,
      [entity.id]: entity
    },
    layout: {
      ...project.layout,
      [entity.id]: position
    }
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
      [entityId]: {
        ...entity,
        ...patch,
        updatedAt: nowIso()
      }
    }
  });
}

export function deleteEntityFromProject(project: StoryProject, entityId: string): StoryProject {
  const { [entityId]: _removed, ...remainingEntities } = project.entities;
  const { [entityId]: _removedLayout, ...remainingLayout } = project.layout;

  return touchProject({
    ...project,
    entities: remainingEntities,
    layout: remainingLayout,
    relationships: project.relationships.filter(
      (relationship) => relationship.sourceId !== entityId && relationship.targetId !== entityId
    )
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
        ? {
            ...relationship,
            ...patch
          }
        : relationship
    )
  });
}

export function deleteRelationshipFromProject(project: StoryProject, relationshipId: string): StoryProject {
  return touchProject({
    ...project,
    relationships: project.relationships.filter((relationship) => relationship.id !== relationshipId)
  });
}

export function setProjectLayout(project: StoryProject, layout: Record<string, Point>): StoryProject {
  return touchProject({
    ...project,
    layout
  });
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
