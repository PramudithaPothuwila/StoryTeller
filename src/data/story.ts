import {
  BUILT_IN_EVENT_TYPE_ID,
  EventTimeline,
  ItemTypeDefinition,
  ItemTypeId,
  LinkDirection,
  LinkTypeDefinition,
  LinkTypeId,
  Point,
  RelationshipTimelineVersion,
  StoryEntity,
  StoryProject,
  StoryRelationship,
  TimelineEffect,
  TimelineEffectDraft
} from "../types";

export const builtInItemTypes: ItemTypeDefinition[] = [
  { id: "character", label: "Character", color: "#0f766e", icon: "users", builtIn: true },
  { id: "note", label: "Note", color: "#b45309", icon: "sticky-note", builtIn: true },
  { id: "location", label: "Location", color: "#2563eb", icon: "map-pin", builtIn: true },
  { id: BUILT_IN_EVENT_TYPE_ID, label: "Event", color: "#be123c", icon: "calendar-days", builtIn: true },
  { id: "item", label: "Item", color: "#7c3aed", icon: "box", builtIn: true },
  { id: "faction", label: "Faction", color: "#15803d", icon: "flag", builtIn: true }
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
  { id: "member_of", label: "Member of", color: "#15803d", icon: "flag", direction: "directed", builtIn: true }
];

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

export function cloneBuiltInLinkTypes(): LinkTypeDefinition[] {
  return builtInLinkTypes.map((type) => ({ ...type }));
}

export function findItemType(project: Pick<StoryProject, "itemTypes">, typeId: ItemTypeId): ItemTypeDefinition {
  return (
    project.itemTypes.find((type) => type.id === typeId) ??
    builtInItemTypes.find((type) => type.id === typeId) ??
    fallbackItemType(typeId)
  );
}

export function findLinkType(project: Pick<StoryProject, "linkTypes">, typeId: LinkTypeId): LinkTypeDefinition {
  return (
    project.linkTypes.find((type) => type.id === typeId) ??
    builtInLinkTypes.find((type) => type.id === typeId) ??
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

export function createStoryEntity(type: ItemTypeId, itemTypes: ItemTypeDefinition[] = builtInItemTypes, title?: string): StoryEntity {
  const timestamp = nowIso();
  const label = itemTypes.find((itemType) => itemType.id === type)?.label ?? fallbackItemType(type).label;

  return ensureEntityDefaults({
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
  });
}

export function createStoryRelationship(
  project: Pick<StoryProject, "linkTypes">,
  sourceId: string,
  targetId: string,
  type: LinkTypeId = "relates_to"
): StoryRelationship {
  return {
    id: makeId("link"),
    sourceId,
    targetId,
    type,
    label: linkLabel(project, type),
    notes: "",
    timelineVersions: []
  };
}

export function createBlankProject(title = "Untitled Story"): StoryProject {
  return {
    schemaVersion: 2,
    title,
    updatedAt: nowIso(),
    itemTypes: cloneBuiltInItemTypes(),
    linkTypes: cloneBuiltInLinkTypes(),
    entities: {},
    relationships: [],
    layout: {}
  };
}

export function addEntityToProject(project: StoryProject, entity: StoryEntity, position: Point): StoryProject {
  return touchProject({
    ...project,
    entities: {
      ...project.entities,
      [entity.id]: ensureEntityDefaults(entity)
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

  return touchProject({
    ...project,
    entities: remainingEntities,
    layout: remainingLayout,
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

export function setProjectLayout(project: StoryProject, layout: Record<string, Point>): StoryProject {
  return touchProject({
    ...project,
    layout
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

export function ensureEventTimeline(entity: StoryEntity, order = 0): EventTimeline {
  return {
    order: Number.isFinite(entity.timeline?.order) ? entity.timeline!.order : order,
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
      return aOrder === bOrder ? a.title.localeCompare(b.title) : aOrder - bOrder;
    });
}

export function nextTimelineOrder(project: StoryProject): number {
  const orders = Object.values(project.entities)
    .filter((entity) => entity.type === BUILT_IN_EVENT_TYPE_ID)
    .map((entity) => entity.timeline?.order ?? 0);

  return orders.length ? Math.max(...orders) + 1 : 1;
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
  if (!eventId || !relationship.timelineVersions?.length) {
    return relationship;
  }

  const selectedOrder = eventOrder(project, eventId);

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
  const migrated: StoryProject = {
    schemaVersion: 2,
    title: value.title || "Untitled Story",
    updatedAt: value.updatedAt || nowIso(),
    itemTypes: mergeTypeCatalog(cloneBuiltInItemTypes(), value.itemTypes ?? []),
    linkTypes: mergeTypeCatalog(cloneBuiltInLinkTypes(), value.linkTypes ?? []),
    entities: {},
    relationships: [],
    layout: value.layout ?? {}
  };

  migrated.entities = Object.fromEntries(
    Object.values(value.entities ?? {}).map((entity) => {
      const normalized = ensureEntityDefaults(entity);
      return [normalized.id, normalized];
    })
  );
  migrated.relationships = (value.relationships ?? []).map(normalizeRelationship);

  return migrated;
}

export function ensureEntityDefaults(entity: StoryEntity): StoryEntity {
  const normalized: StoryEntity = {
    ...entity,
    tags: entity.tags ?? [],
    publicInfo: entity.publicInfo ?? "",
    privateInfo: entity.privateInfo ?? "",
    bodyMarkdown: entity.bodyMarkdown ?? ""
  };

  if (normalized.type === BUILT_IN_EVENT_TYPE_ID) {
    normalized.timeline = ensureEventTimeline(normalized);
  }

  return normalized;
}

export function normalizeRelationship(relationship: StoryRelationship): StoryRelationship {
  return {
    ...relationship,
    notes: relationship.notes ?? "",
    timelineVersions: relationship.timelineVersions ?? []
  };
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
