import { Crosshair, Eye, EyeOff, Link2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  BUILT_IN_EVENT_TYPE_ID,
  BUILT_IN_WORLD_RULE_TYPE_ID,
  GraphPresence,
  LinkTypeId,
  Selection,
  StoryEntity,
  StoryProject,
  StoryRelationship,
  TimelineEffectDraft
} from "../types";
import {
  entityVisibleInGraph,
  ensureEventTimeline,
  findItemType,
  findLinkType,
  getGameStoryNodes,
  getGameStoryTriggerRelationships,
  getWorldTriggerRelationships,
  isGameStoryNodeEntity,
  isGameStoryItemType,
  isGameStoryLinkType,
  linkLabel,
  normalizeGameStoryRelationshipMetadata
} from "../data/story";
import { ConditionEffectEditor, GameStoryFields } from "./GameStoryFields";
import { WorldRuleFields } from "./WorldRuleFields";

interface DetailInspectorProps {
  project: StoryProject;
  selection: Selection | null;
  onStartTriggerPick: (mode: "game_target" | "world_source", fixedEntityId: string) => void;
  onEntityChange: (id: string, patch: Partial<StoryEntity>) => void;
  onRelationshipChange: (id: string, patch: Partial<StoryRelationship>) => void;
  onSelectEntityInGraph: (id: string, graphView: "world" | "story_flow") => void;
  onTimelineEffect: (eventId: string, draft: TimelineEffectDraft) => void;
  onDeleteEntity: (id: string) => void;
  onDeleteRelationship: (id: string) => void;
}

export function DetailInspector({
  project,
  selection,
  onStartTriggerPick,
  onEntityChange,
  onRelationshipChange,
  onSelectEntityInGraph,
  onTimelineEffect,
  onDeleteEntity,
  onDeleteRelationship
}: DetailInspectorProps) {
  const [privateVisible, setPrivateVisible] = useState(false);

  const selectedEntity = selection?.kind === "entity" ? project.entities[selection.id] : null;
  const selectedRelationship =
    selection?.kind === "relationship"
      ? project.relationships.find((relationship) => relationship.id === selection.id) ?? null
      : null;

  if (selectedEntity) {
    const meta = findItemType(project, selectedEntity.type);

    return (
      <aside className="inspector">
        <div className="inspector__header" style={{ "--inspector-accent": meta.color } as React.CSSProperties}>
          <span>{meta.label}</span>
          <button
            type="button"
            className="icon-button danger"
            aria-label="Delete selected item"
            onClick={() => onDeleteEntity(selectedEntity.id)}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>

        <label className="field-stack">
          Title
          <input
            value={selectedEntity.title}
            onChange={(event) => onEntityChange(selectedEntity.id, { title: event.target.value })}
          />
        </label>

        <label className="field-stack">
          Summary
          <textarea
            rows={3}
            value={selectedEntity.summary}
            onChange={(event) => onEntityChange(selectedEntity.id, { summary: event.target.value })}
          />
        </label>

        <label className="field-stack">
          Tags
          <input
            value={selectedEntity.tags.join(", ")}
            onChange={(event) =>
              onEntityChange(selectedEntity.id, {
                tags: event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
              })
            }
          />
        </label>

        {project.projectMode === "game_story" ? (
          <label className="field-stack">
            Graph Visibility
            <select
              aria-label="Graph visibility"
              value={selectedEntity.graphPresence}
              onChange={(event) =>
                onEntityChange(selectedEntity.id, { graphPresence: event.target.value as GraphPresence })
              }
            >
              <option value="story_flow">Game Story</option>
              <option value="both">World Building + Game Story</option>
              <option value="world">World Building</option>
            </select>
          </label>
        ) : null}

        {selectedEntity.type === BUILT_IN_EVENT_TYPE_ID ? (
          <EventTimelineEditor
            project={project}
            eventEntity={selectedEntity}
            onTimelineEffect={onTimelineEffect}
          />
        ) : null}

        {selectedEntity.type === BUILT_IN_WORLD_RULE_TYPE_ID ? (
          <WorldRuleFields
            entity={selectedEntity}
            idPrefix={`inspector-${selectedEntity.id}`}
            onEntityChange={(patch) => onEntityChange(selectedEntity.id, patch)}
          />
        ) : null}

        {project.projectMode === "game_story" && (isGameStoryItemType(selectedEntity.type) || selectedEntity.gameStory) ? (
          <GameStoryFields
            project={project}
            entity={selectedEntity}
            idPrefix={`inspector-${selectedEntity.id}`}
            onEntityChange={(patch) => onEntityChange(selectedEntity.id, patch)}
          />
        ) : null}

        {project.projectMode === "game_story" ? (
          isGameStoryNodeEntity(selectedEntity) ? (
            <TriggeredByWorldBuilding
              project={project}
              entity={selectedEntity}
              onStartTriggerPick={onStartTriggerPick}
              onDeleteRelationship={onDeleteRelationship}
              onSelectEntityInGraph={onSelectEntityInGraph}
            />
          ) : (
            <TriggersGameStory
              project={project}
              entity={selectedEntity}
              onStartTriggerPick={onStartTriggerPick}
              onDeleteRelationship={onDeleteRelationship}
              onSelectEntityInGraph={onSelectEntityInGraph}
            />
          )
        ) : null}

        <label className="field-stack">
          Public Information
          <textarea
            rows={5}
            value={selectedEntity.publicInfo}
            onChange={(event) => onEntityChange(selectedEntity.id, { publicInfo: event.target.value })}
          />
        </label>

        <section className="private-section">
          <div className="private-section__header">
            <h2>Private Information</h2>
            <button
              type="button"
              className="icon-button"
              aria-label={privateVisible ? "Hide private information" : "Show private information"}
              onClick={() => setPrivateVisible((visible) => !visible)}
            >
              {privateVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
          {privateVisible ? (
            <textarea
              aria-label="Private information"
              rows={5}
              value={selectedEntity.privateInfo}
              onChange={(event) => onEntityChange(selectedEntity.id, { privateInfo: event.target.value })}
            />
          ) : (
            <div className="private-placeholder">Hidden</div>
          )}
        </section>

        <label className="field-stack">
          Notes
          <textarea
            rows={7}
            value={selectedEntity.bodyMarkdown}
            onChange={(event) => onEntityChange(selectedEntity.id, { bodyMarkdown: event.target.value })}
          />
        </label>
      </aside>
    );
  }

  if (selectedRelationship) {
    return (
      <RelationshipInspector
        project={project}
        relationship={selectedRelationship}
        onRelationshipChange={onRelationshipChange}
        onDeleteRelationship={onDeleteRelationship}
      />
    );
  }

  return (
    <aside className="inspector inspector--empty">
      <Link2 aria-hidden="true" />
      <h2>Select an item</h2>
      <p>The graph and item list both open details here.</p>
    </aside>
  );
}

interface TriggerLinksProps {
  project: StoryProject;
  entity: StoryEntity;
  onStartTriggerPick: (mode: "game_target" | "world_source", fixedEntityId: string) => void;
  onDeleteRelationship: (id: string) => void;
  onSelectEntityInGraph: (id: string, graphView: "world" | "story_flow") => void;
}

function TriggersGameStory({
  project,
  entity,
  onStartTriggerPick,
  onDeleteRelationship,
  onSelectEntityInGraph
}: TriggerLinksProps) {
  const triggerLinks = getWorldTriggerRelationships(project, entity.id);
  const linkedTargetIds = new Set(triggerLinks.map((relationship) => relationship.targetId));
  const targetOptions = getGameStoryNodes(project).filter((node) => !linkedTargetIds.has(node.id));

  return (
    <section className="game-subsection">
      <div className="game-subsection__header">
        <h3>Triggers Game Story</h3>
      </div>

      <TriggerRelationshipList
        emptyText="No game story triggers yet."
        project={project}
        relationships={triggerLinks}
        linkedEntitySide="target"
        openLabel="Open game node"
        openGraphView="story_flow"
        onDeleteRelationship={onDeleteRelationship}
        onSelectEntityInGraph={onSelectEntityInGraph}
      />

      <div className="game-condition-row">
        {!targetOptions.length ? <p className="game-empty-note">All game story nodes are already linked.</p> : null}
        <button
          type="button"
          className="text-tool-button"
          disabled={!targetOptions.length}
          onClick={() => onStartTriggerPick("game_target", entity.id)}
        >
          <Plus aria-hidden="true" />
          Trigger
        </button>
      </div>
    </section>
  );
}

function TriggeredByWorldBuilding({
  project,
  entity,
  onStartTriggerPick,
  onDeleteRelationship,
  onSelectEntityInGraph
}: TriggerLinksProps) {
  const triggerLinks = getGameStoryTriggerRelationships(project, entity.id);
  const linkedSourceIds = new Set(triggerLinks.map((relationship) => relationship.sourceId));
  const sourceOptions = Object.values(project.entities)
    .filter((candidate) => entityVisibleInGraph(candidate, "world"))
    .filter((candidate) => !isGameStoryNodeEntity(candidate))
    .filter((candidate) => !linkedSourceIds.has(candidate.id));

  return (
    <section className="game-subsection">
      <div className="game-subsection__header">
        <h3>Triggered By World Building</h3>
      </div>

      <TriggerRelationshipList
        emptyText="No world-building triggers yet."
        project={project}
        relationships={triggerLinks}
        linkedEntitySide="source"
        openLabel="Open world item"
        openGraphView="world"
        onDeleteRelationship={onDeleteRelationship}
        onSelectEntityInGraph={onSelectEntityInGraph}
      />

      <div className="game-condition-row">
        {!sourceOptions.length ? <p className="game-empty-note">All world-building items are already linked.</p> : null}
        <button
          type="button"
          className="text-tool-button"
          disabled={!sourceOptions.length}
          onClick={() => onStartTriggerPick("world_source", entity.id)}
        >
          <Plus aria-hidden="true" />
          Trigger Source
        </button>
      </div>
    </section>
  );
}

interface TriggerRelationshipListProps {
  emptyText: string;
  linkedEntitySide: "source" | "target";
  openGraphView: "world" | "story_flow";
  openLabel: string;
  project: StoryProject;
  relationships: StoryRelationship[];
  onDeleteRelationship: (id: string) => void;
  onSelectEntityInGraph: (id: string, graphView: "world" | "story_flow") => void;
}

function TriggerRelationshipList({
  emptyText,
  linkedEntitySide,
  openGraphView,
  openLabel,
  project,
  relationships,
  onDeleteRelationship,
  onSelectEntityInGraph
}: TriggerRelationshipListProps) {
  if (!relationships.length) {
    return <p className="game-empty-note">{emptyText}</p>;
  }

  return (
    <div className="timeline-effects">
      {relationships.map((relationship) => {
        const linkedEntityId = linkedEntitySide === "source" ? relationship.sourceId : relationship.targetId;
        const linkedEntity = project.entities[linkedEntityId];

        return (
          <div key={relationship.id}>
            <button
              type="button"
              className="text-tool-button"
              aria-label={`${openLabel}: ${linkedEntity?.title ?? "Missing item"}`}
              onClick={() => onSelectEntityInGraph(linkedEntityId, openGraphView)}
            >
              <Crosshair aria-hidden="true" />
              <strong>{linkedEntity?.title ?? "Missing item"}</strong>
            </button>
            <button
              type="button"
              className="icon-button danger"
              aria-label={`Remove trigger ${linkedEntity?.title ?? relationship.id}`}
              onClick={() => onDeleteRelationship(relationship.id)}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

interface EventTimelineEditorProps {
  project: StoryProject;
  eventEntity: StoryEntity;
  onTimelineEffect: (eventId: string, draft: TimelineEffectDraft) => void;
}

function EventTimelineEditor({ project, eventEntity, onTimelineEffect }: EventTimelineEditorProps) {
  const timeline = ensureEventTimeline(eventEntity);
  const entities = Object.values(project.entities);
  const firstEntityId = entities[0]?.id ?? "";
  const secondEntityId = entities.find((entity) => entity.id !== firstEntityId)?.id ?? firstEntityId;
  const firstRelationship = project.relationships[0];
  const [action, setAction] = useState<TimelineEffectDraft["action"]>("start");
  const [sourceId, setSourceId] = useState(firstEntityId);
  const [targetId, setTargetId] = useState(secondEntityId);
  const [relationshipId, setRelationshipId] = useState(firstRelationship?.id ?? "");
  const [type, setType] = useState<LinkTypeId>(project.linkTypes[0]?.id ?? "relates_to");
  const [label, setLabel] = useState(project.linkTypes[0]?.label ?? "");
  const [notes, setNotes] = useState("");

  const activeRelationship =
    project.relationships.find((relationship) => relationship.id === relationshipId) ?? firstRelationship;
  const canStart = sourceId && targetId && sourceId !== targetId;
  const canTargetRelationship = Boolean(activeRelationship);

  useEffect(() => {
    if (action === "start" || !activeRelationship) {
      return;
    }

    setType(activeRelationship.type);
    setLabel(activeRelationship.label);
    setNotes(activeRelationship.notes);
  }, [action, activeRelationship?.id]);

  function handleSubmit() {
    if (action === "start") {
      if (!canStart) {
        return;
      }

      onTimelineEffect(eventEntity.id, {
        action: "start",
        sourceId,
        targetId,
        type,
        label: label || linkLabel(project, type),
        notes
      });
      setNotes("");
      return;
    }

    if (!canTargetRelationship) {
      return;
    }

    if (action === "end") {
      onTimelineEffect(eventEntity.id, {
        action: "end",
        relationshipId: activeRelationship.id
      });
      return;
    }

    onTimelineEffect(eventEntity.id, {
      action: "update",
      relationshipId: activeRelationship.id,
      type,
      label,
      notes
    });
    setNotes("");
  }

  return (
    <section className="timeline-editor">
      <div className="timeline-effect-card">
        <div className="timeline-effect-card__header">
          <h2>Relationship Change</h2>
        </div>

        <label className="field-stack">
          Action
          <select value={action} onChange={(event) => setAction(event.target.value as TimelineEffectDraft["action"])}>
            <option value="start">Start relationship</option>
            <option value="update">Update relationship</option>
            <option value="end">End relationship</option>
          </select>
        </label>

        {action === "start" ? (
          <>
            <label className="field-stack">
              Source
              <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-stack">
              Target
              <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.title}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <label className="field-stack">
            Relationship
            <select value={activeRelationship?.id ?? ""} onChange={(event) => setRelationshipId(event.target.value)}>
              {project.relationships.map((relationship) => (
                <option key={relationship.id} value={relationship.id}>
                  {relationshipTitle(project, relationship)}
                </option>
              ))}
            </select>
          </label>
        )}

        {action !== "end" ? (
          <>
            <label className="field-stack">
              Link Type
              <select
                value={type}
                onChange={(event) => {
                  const nextType = event.target.value;
                  setType(nextType);
                  setLabel(linkLabel(project, nextType));
                }}
              >
                {project.linkTypes.map((linkType) => (
                  <option key={linkType.id} value={linkType.id}>
                    {linkType.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-stack">
              Label
              <input value={label} onChange={(event) => setLabel(event.target.value)} />
            </label>
            <label className="field-stack">
              Notes
              <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </>
        ) : null}

        <button
          type="button"
          className="primary-action"
          disabled={action === "start" ? !canStart : !canTargetRelationship}
          onClick={handleSubmit}
        >
          <Plus aria-hidden="true" />
          Add Change
        </button>
      </div>

      {timeline.effects.length ? (
        <div className="timeline-effects">
          {timeline.effects.map((effect) => (
            <div key={effect.id}>
              <strong>{effect.action}</strong>
              <span>{effectSummary(project, effect.relationshipId)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

interface RelationshipInspectorProps {
  project: StoryProject;
  relationship: StoryRelationship;
  onRelationshipChange: (id: string, patch: Partial<StoryRelationship>) => void;
  onDeleteRelationship: (id: string) => void;
}

function RelationshipInspector({
  project,
  relationship,
  onRelationshipChange,
  onDeleteRelationship
}: RelationshipInspectorProps) {
  const source = project.entities[relationship.sourceId];
  const target = project.entities[relationship.targetId];
  const linkType = findLinkType(project, relationship.type);
  const title = useMemo(
    () => `${source?.title ?? "Missing item"} -> ${target?.title ?? "Missing item"}`,
    [source?.title, target?.title]
  );

  return (
    <aside className="inspector">
      <div className="inspector__header relationship-header" style={{ "--inspector-accent": linkType.color } as React.CSSProperties}>
        <span>Relationship</span>
        <button
          type="button"
          className="icon-button danger"
          aria-label="Delete selected relationship"
          onClick={() => onDeleteRelationship(relationship.id)}
        >
          <Trash2 aria-hidden="true" />
        </button>
      </div>

      <div className="relationship-title">
        <Link2 aria-hidden="true" />
        <strong>{title}</strong>
      </div>

      <label className="field-stack">
        Type
        <select
          value={relationship.type}
          onChange={(event) => {
            const type = event.target.value;
            onRelationshipChange(relationship.id, {
              type,
              label: relationship.label === linkLabel(project, relationship.type) ? linkLabel(project, type) : relationship.label
            });
          }}
        >
          {project.linkTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field-stack">
        Label
        <input
          value={relationship.label}
          onChange={(event) => onRelationshipChange(relationship.id, { label: event.target.value })}
        />
      </label>

      <label className="field-stack">
        Starts At Event
        <select
          value={relationship.startsAtEventId ?? ""}
          onChange={(event) =>
            onRelationshipChange(relationship.id, {
              startsAtEventId: event.target.value || undefined
            })
          }
        >
          <option value="">Always active</option>
          {Object.values(project.entities)
            .filter((entity) => entity.type === BUILT_IN_EVENT_TYPE_ID)
            .map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.title}
              </option>
            ))}
        </select>
      </label>

      <label className="field-stack">
        Ends At Event
        <select
          value={relationship.endsAtEventId ?? ""}
          onChange={(event) =>
            onRelationshipChange(relationship.id, {
              endsAtEventId: event.target.value || undefined
            })
          }
        >
          <option value="">No ending yet</option>
          {Object.values(project.entities)
            .filter((entity) => entity.type === BUILT_IN_EVENT_TYPE_ID)
            .map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.title}
              </option>
            ))}
        </select>
      </label>

      <label className="field-stack">
        Notes
        <textarea
          rows={7}
          value={relationship.notes}
          onChange={(event) => onRelationshipChange(relationship.id, { notes: event.target.value })}
        />
      </label>

      {project.projectMode === "game_story" && (isGameStoryLinkType(relationship.type) || relationship.gameStory) ? (
        <GameRelationshipFields
          project={project}
          relationship={relationship}
          onRelationshipChange={onRelationshipChange}
        />
      ) : null}
    </aside>
  );
}

interface GameRelationshipFieldsProps {
  project: StoryProject;
  relationship: StoryRelationship;
  onRelationshipChange: (id: string, patch: Partial<StoryRelationship>) => void;
}

function GameRelationshipFields({ project, relationship, onRelationshipChange }: GameRelationshipFieldsProps) {
  const metadata = normalizeGameStoryRelationshipMetadata(relationship.gameStory);

  function handleMetadataChange(patch: Partial<typeof metadata>) {
    onRelationshipChange(relationship.id, {
      gameStory: normalizeGameStoryRelationshipMetadata({
        ...metadata,
        ...patch
      })
    });
  }

  return (
    <section className="game-story-fields">
      <h2>Branch Fields</h2>
      <label className="field-stack">
        Choice Text
        <input
          value={metadata.choiceText}
          onChange={(event) => handleMetadataChange({ choiceText: event.target.value })}
        />
      </label>
      <label className="field-stack">
        Priority
        <input
          type="number"
          value={metadata.priority}
          onChange={(event) => handleMetadataChange({ priority: Number(event.target.value) || 0 })}
        />
      </label>
      <ConditionEffectEditor
        project={project}
        title="Branch Requirements"
        conditions={metadata.requirements}
        onConditionsChange={(requirements) => handleMetadataChange({ requirements })}
      />
      <ConditionEffectEditor
        project={project}
        title="Branch Effects"
        effects={metadata.effects}
        onEffectsChange={(effects) => handleMetadataChange({ effects })}
      />
      <label className="field-stack">
        Consequence Notes
        <textarea
          rows={3}
          value={metadata.consequenceNotes}
          onChange={(event) => handleMetadataChange({ consequenceNotes: event.target.value })}
        />
      </label>
    </section>
  );
}

function relationshipTitle(project: StoryProject, relationship: StoryRelationship): string {
  const source = project.entities[relationship.sourceId]?.title ?? "Missing item";
  const target = project.entities[relationship.targetId]?.title ?? "Missing item";

  return `${source} -> ${target}`;
}

function effectSummary(project: StoryProject, relationshipId: string): string {
  const relationship = project.relationships.find((item) => item.id === relationshipId);

  return relationship ? relationshipTitle(project, relationship) : "Deleted relationship";
}
