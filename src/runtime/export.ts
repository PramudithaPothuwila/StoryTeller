import {
  BUILT_IN_EVENT_TYPE_ID,
  BUILT_IN_WORLD_RULE_TYPE_ID,
  GameplayTransition,
  StoryEntity,
  StoryProject,
  StoryRelationship
} from "../types";
import {
  getGameContinuityIssues,
  getGameStoryNodes,
  getTimelineEvents,
  migrateProjectShape,
  normalizeGameStoryEntityMetadata,
  normalizeGameplayTransition
} from "../data/story";
import {
  RuntimeCapability,
  RuntimeCharacterProfile,
  RuntimeEvidence,
  RuntimeFact,
  RuntimeRelationship,
  RuntimeStoryFlow,
  RuntimeStoryTransition,
  RuntimeTimeline,
  RuntimeValidationIssue,
  STORY_RUNTIME_BUNDLE_KIND,
  STORY_RUNTIME_SCHEMA_VERSION,
  StoryRuntimeBundle
} from "./types";

export function createRuntimeBundle(project: StoryProject, exportedAt = new Date().toISOString()): StoryRuntimeBundle {
  const sourceProject = migrateProjectShape(project);
  const entities = Object.values(sourceProject.entities).sort(compareById);
  const relationships = sourceProject.relationships.map(toRuntimeRelationship).sort(compareById);
  const timeline = buildRuntimeTimeline(sourceProject);
  const storyFlow = buildRuntimeStoryFlow(sourceProject);
  const facts = buildRuntimeFacts(sourceProject);
  const evidence = buildRuntimeEvidence(sourceProject, facts);
  const characterProfiles = buildRuntimeCharacterProfiles(sourceProject);
  const validation = validateRuntimeExport(sourceProject, {
    facts,
    evidence,
    relationships,
    storyFlow,
    characterProfiles
  });

  return {
    kind: STORY_RUNTIME_BUNDLE_KIND,
    schemaVersion: STORY_RUNTIME_SCHEMA_VERSION,
    exportedAt,
    sourceProject: {
      title: sourceProject.title,
      schemaVersion: sourceProject.schemaVersion,
      projectMode: sourceProject.projectMode,
      updatedAt: sourceProject.updatedAt
    },
    manifest: {
      startNodeId: sourceProject.gameStory?.startNodeId,
      startTimelineEventId: timeline.events[0]?.id,
      capabilities: runtimeCapabilities(sourceProject, {
        facts,
        evidence,
        timeline,
        storyFlow,
        characterProfiles
      }),
      warningCount: validation.filter((issue) => issue.severity === "warning").length,
      errorCount: validation.filter((issue) => issue.severity === "error").length
    },
    entities: entities.map(toRuntimeEntity),
    facts,
    evidence,
    relationships,
    timeline,
    storyFlow,
    characterProfiles,
    validation
  };
}

export function createRuntimeBundleBlob(project: StoryProject): Blob {
  return new Blob([prettyJson(createRuntimeBundle(project))], { type: "application/json" });
}

function toRuntimeEntity(entity: StoryEntity) {
  return {
    id: entity.id,
    sourceId: entity.id,
    type: entity.type,
    graphPresence: entity.graphPresence,
    title: entity.title,
    summary: entity.summary,
    tags: [...entity.tags],
    visibleText: {
      publicInfo: entity.publicInfo,
      bodyMarkdown: entity.bodyMarkdown
    },
    authorHiddenText: entity.privateInfo,
    metadata: {
      worldRule: entity.worldRule,
      gameStory: entity.gameStory
    }
  };
}

function buildRuntimeFacts(project: StoryProject): RuntimeFact[] {
  const facts: RuntimeFact[] = [];

  for (const entity of Object.values(project.entities).sort(compareById)) {
    if (entity.type === BUILT_IN_WORLD_RULE_TYPE_ID && entity.worldRule) {
      facts.push({
        id: `fact-${entity.id}`,
        sourceId: entity.id,
        sourceKind: "world_rule",
        subjectId: entity.id,
        predicate: "world_rule",
        value: entity.worldRule.statement || entity.summary || entity.publicInfo || entity.title,
        canonical: entity.worldRule.status.toLowerCase() === "canon",
        reliability: entity.worldRule.status.toLowerCase() === "deprecated" ? 0 : 1,
        visibleToPlayer: Boolean(entity.publicInfo || entity.bodyMarkdown || entity.worldRule.statement),
        notes: [entity.worldRule.reason, entity.worldRule.limits, entity.worldRule.exceptions, entity.worldRule.storyPurpose]
          .filter(Boolean)
          .join("\n")
      });
    }
  }

  for (const relationship of project.relationships.slice().sort(compareById)) {
    facts.push({
      id: `fact-${relationship.id}`,
      sourceId: relationship.id,
      sourceKind: "relationship",
      subjectId: relationship.sourceId,
      predicate: relationship.type,
      objectId: relationship.targetId,
      value: relationship.label || relationship.type,
      canonical: true,
      reliability: 1,
      visibleToPlayer: true,
      notes: relationship.notes
    });
  }

  return facts;
}

function buildRuntimeEvidence(project: StoryProject, facts: RuntimeFact[]): RuntimeEvidence[] {
  const factIdsBySubject = new Map<string, string[]>();

  for (const fact of facts) {
    factIdsBySubject.set(fact.subjectId, [...(factIdsBySubject.get(fact.subjectId) ?? []), fact.id]);

    if (fact.objectId) {
      factIdsBySubject.set(fact.objectId, [...(factIdsBySubject.get(fact.objectId) ?? []), fact.id]);
    }
  }

  return Object.values(project.entities)
    .filter(isEvidenceCandidate)
    .sort(compareById)
    .map((entity) => ({
      id: `evidence-${entity.id}`,
      sourceId: entity.id,
      entityId: entity.id,
      title: entity.title,
      evidenceType: entity.type,
      supportsFactIds: factIdsBySubject.get(entity.id) ?? [],
      contradictsFactIds: [],
      reliability: 1,
      visibleText: {
        publicInfo: entity.publicInfo,
        bodyMarkdown: entity.bodyMarkdown
      },
      authorHiddenText: entity.privateInfo,
      notes: entity.summary
    }));
}

function buildRuntimeCharacterProfiles(project: StoryProject): RuntimeCharacterProfile[] {
  return Object.values(project.entities)
    .filter((entity) => entity.type === "character")
    .sort(compareById)
    .map((entity) => ({
      id: `character-profile-${entity.id}`,
      sourceId: entity.id,
      title: entity.title,
      summary: entity.summary,
      publicInfo: entity.publicInfo,
      authorHiddenText: entity.privateInfo,
      relationshipIds: project.relationships
        .filter((relationship) => relationship.sourceId === entity.id || relationship.targetId === entity.id)
        .map((relationship) => relationship.id)
        .sort()
    }));
}

function buildRuntimeTimeline(project: StoryProject): RuntimeTimeline {
  const events = getTimelineEvents(project).map((event) => ({
    id: event.id,
    sourceId: event.id,
    title: event.title,
    order: event.timeline?.order ?? 0,
    track: event.timeline?.track ?? 0,
    effects: event.timeline?.effects ?? []
  }));

  return {
    events,
    relationshipAnchors: project.relationships
      .filter(
        (relationship) =>
          Boolean(relationship.startsAtEventId) ||
          Boolean(relationship.endsAtEventId) ||
          Boolean(relationship.timelineVersions?.length)
      )
      .sort(compareById)
      .map((relationship) => ({
        relationshipId: relationship.id,
        startsAtEventId: relationship.startsAtEventId,
        endsAtEventId: relationship.endsAtEventId,
        versionEventIds: (relationship.timelineVersions ?? []).map((version) => version.eventId)
      }))
  };
}

function buildRuntimeStoryFlow(project: StoryProject): RuntimeStoryFlow {
  const nodes = getGameStoryNodes(project).map((entity) => {
    const metadata = normalizeGameStoryEntityMetadata(entity.gameStory, entity.type);

    return {
      id: entity.id,
      sourceId: entity.id,
      type: entity.type,
      title: entity.title,
      role: metadata.role,
      status: metadata.status,
      criticalPath: metadata.criticalPath,
      entryConditions: metadata.entryConditions,
      exitEffects: metadata.exitEffects
    };
  });

  return {
    startNodeId: project.gameStory?.startNodeId,
    nodes: nodes.sort(compareById),
    transitions: buildRuntimeStoryTransitions(project)
  };
}

function buildRuntimeStoryTransitions(project: StoryProject): RuntimeStoryTransition[] {
  const transitions = project.gameplayTransitions.map((transition) => normalizeGameplayTransition(transition));
  const existingTransitionIds = new Set(transitions.map((transition) => transition.id));

  for (const relationship of project.relationships) {
    if (!relationship.gameStory || existingTransitionIds.has(relationship.id)) {
      continue;
    }

    transitions.push(
      normalizeGameplayTransition({
        id: relationship.id,
        sourceNodeId: relationship.sourceId,
        targetNodeId: relationship.targetId,
        choice: {
          text: relationship.gameStory.choiceText || relationship.label
        },
        requirements: {
          all: relationship.gameStory.requirements
        },
        effects: relationship.gameStory.effects,
        presentation: {
          priority: relationship.gameStory.priority
        },
        authorNotes: {
          purpose: relationship.gameStory.consequenceNotes || relationship.notes
        },
        metadata: {}
      })
    );
  }

  return transitions.sort(compareById).map(toRuntimeStoryTransition);
}

function toRuntimeStoryTransition(transition: GameplayTransition): RuntimeStoryTransition {
  return {
    id: transition.id,
    sourceId: transition.id,
    sourceNodeId: transition.sourceNodeId,
    targetNodeId: transition.targetNodeId,
    choiceText: transition.choice.text,
    requirements: transition.requirements,
    effects: transition.effects,
    priority: transition.presentation.priority,
    notes: transition.authorNotes.purpose
  };
}

function toRuntimeRelationship(relationship: StoryRelationship): RuntimeRelationship {
  return {
    id: relationship.id,
    sourceId: relationship.id,
    sourceEntityId: relationship.sourceId,
    targetEntityId: relationship.targetId,
    type: relationship.type,
    label: relationship.label,
    notes: relationship.notes,
    startsAtEventId: relationship.startsAtEventId,
    endsAtEventId: relationship.endsAtEventId,
    timelineVersionEventIds: (relationship.timelineVersions ?? []).map((version) => version.eventId)
  };
}

function validateRuntimeExport(
  project: StoryProject,
  compiled: {
    facts: RuntimeFact[];
    evidence: RuntimeEvidence[];
    relationships: RuntimeRelationship[];
    storyFlow: RuntimeStoryFlow;
    characterProfiles: RuntimeCharacterProfile[];
  }
): RuntimeValidationIssue[] {
  const issues: RuntimeValidationIssue[] = [];
  const entityIds = new Set(Object.keys(project.entities));
  const eventIds = new Set(
    Object.values(project.entities)
      .filter((entity) => entity.type === BUILT_IN_EVENT_TYPE_ID)
      .map((entity) => entity.id)
  );
  const factIds = new Set(compiled.facts.map((fact) => fact.id));
  const evidenceEntityIds = new Set(compiled.evidence.map((evidence) => evidence.entityId));

  addDuplicateIssues(issues, compiled.relationships.map((relationship) => relationship.id), "runtime-relationship");
  addDuplicateIssues(issues, project.gameplayTransitions.map((transition) => transition.id), "runtime-story-transition");

  for (const relationship of project.relationships) {
    if (!entityIds.has(relationship.sourceId)) {
      issues.push(missingReference("relationship-missing-source", relationship.id, `Relationship source is missing: ${relationship.sourceId}`));
    }

    if (!entityIds.has(relationship.targetId)) {
      issues.push(missingReference("relationship-missing-target", relationship.id, `Relationship target is missing: ${relationship.targetId}`));
    }

    for (const [label, eventId] of [
      ["start", relationship.startsAtEventId],
      ["end", relationship.endsAtEventId]
    ] as const) {
      if (eventId && !eventIds.has(eventId)) {
        issues.push(missingReference(`relationship-missing-${label}-event`, relationship.id, `Relationship ${label} event is missing: ${eventId}`));
      }
    }

    for (const version of relationship.timelineVersions ?? []) {
      if (!eventIds.has(version.eventId)) {
        issues.push(missingReference("relationship-missing-version-event", relationship.id, `Relationship timeline version event is missing: ${version.eventId}`));
      }
    }
  }

  for (const evidence of compiled.evidence) {
    if (!entityIds.has(evidence.entityId)) {
      issues.push(missingReference("evidence-missing-entity", evidence.id, `Evidence source entity is missing: ${evidence.entityId}`));
    }

    for (const factId of [...evidence.supportsFactIds, ...evidence.contradictsFactIds]) {
      if (!factIds.has(factId)) {
        issues.push(missingReference("evidence-missing-fact", evidence.id, `Evidence references a missing fact: ${factId}`));
      }
    }
  }

  for (const profile of compiled.characterProfiles) {
    for (const relationshipId of profile.relationshipIds) {
      if (!compiled.relationships.some((relationship) => relationship.id === relationshipId)) {
        issues.push(missingReference("character-profile-missing-relationship", profile.id, `Character profile references a missing relationship: ${relationshipId}`));
      }
    }
  }

  for (const entity of Object.values(project.entities)) {
    if (isEvidenceCandidate(entity) && !evidenceEntityIds.has(entity.id)) {
      issues.push({
        id: `evidence-not-exported-${entity.id}`,
        severity: "warning",
        title: "Evidence candidate was not exported",
        details: `${entity.title} looks like evidence but did not compile to an evidence record.`,
        sourceId: entity.id
      });
    }
  }

  if (project.projectMode === "game_story") {
    for (const issue of getGameContinuityIssues(project)) {
      issues.push({
        id: `game-continuity-${issue.id}`,
        severity: issue.severity,
        title: issue.title,
        details: issue.details,
        sourceId: issue.entityId ?? issue.relationshipId
      });
    }

    const gameNodeIds = new Set(compiled.storyFlow.nodes.map((node) => node.id));

    if (compiled.storyFlow.startNodeId && !gameNodeIds.has(compiled.storyFlow.startNodeId)) {
      issues.push(missingReference("story-flow-missing-start", compiled.storyFlow.startNodeId, `Story flow start node is missing: ${compiled.storyFlow.startNodeId}`));
    }

    for (const transition of compiled.storyFlow.transitions) {
      if (!gameNodeIds.has(transition.sourceNodeId)) {
        issues.push(missingReference("story-flow-missing-transition-source", transition.id, `Story transition source node is missing: ${transition.sourceNodeId}`));
      }

      if (!gameNodeIds.has(transition.targetNodeId)) {
        issues.push(missingReference("story-flow-missing-transition-target", transition.id, `Story transition target node is missing: ${transition.targetNodeId}`));
      }
    }
  }

  return issues.sort((left, right) => left.id.localeCompare(right.id));
}

function runtimeCapabilities(
  project: StoryProject,
  compiled: {
    facts: RuntimeFact[];
    evidence: RuntimeEvidence[];
    timeline: RuntimeTimeline;
    storyFlow: RuntimeStoryFlow;
    characterProfiles: RuntimeCharacterProfile[];
  }
): RuntimeCapability[] {
  const capabilities: RuntimeCapability[] = ["semantic_graph"];

  if (compiled.timeline.events.length) {
    capabilities.push("timeline");
  }

  if (project.projectMode === "game_story" || compiled.storyFlow.nodes.length || compiled.storyFlow.transitions.length) {
    capabilities.push("story_flow");
  }

  if (compiled.facts.length) {
    capabilities.push("facts");
  }

  if (compiled.evidence.length) {
    capabilities.push("evidence");
  }

  if (compiled.characterProfiles.length) {
    capabilities.push("character_profiles");
  }

  return capabilities;
}

function addDuplicateIssues(issues: RuntimeValidationIssue[], ids: string[], idPrefix: string) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
      continue;
    }

    seen.add(id);
  }

  for (const duplicateId of duplicates) {
    issues.push({
      id: `${idPrefix}-duplicate-${duplicateId}`,
      severity: "error",
      title: "Duplicate runtime ID",
      details: `${duplicateId} is used more than once.`,
      sourceId: duplicateId
    });
  }
}

function missingReference(idPrefix: string, sourceId: string, details: string): RuntimeValidationIssue {
  return {
    id: `${idPrefix}-${sourceId}`,
    severity: "error",
    title: "Missing runtime reference",
    details,
    sourceId
  };
}

function isEvidenceCandidate(entity: StoryEntity): boolean {
  const tags = new Set(entity.tags.map((tag) => tag.toLowerCase()));

  return entity.type === "clue" || entity.type === "item" || entity.type === "evidence" || tags.has("clue") || tags.has("evidence");
}

function compareById<T extends { id: string }>(left: T, right: T): number {
  return left.id.localeCompare(right.id);
}

function prettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
