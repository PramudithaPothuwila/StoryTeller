import { Eye, EyeOff, Link2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { RelationshipType, Selection, StoryEntity, StoryProject, StoryRelationship } from "../types";
import { entityTypeMeta, relationshipLabel, relationshipTypeMeta } from "../data/story";

interface DetailInspectorProps {
  project: StoryProject;
  selection: Selection | null;
  onEntityChange: (id: string, patch: Partial<StoryEntity>) => void;
  onRelationshipChange: (id: string, patch: Partial<StoryRelationship>) => void;
  onDeleteEntity: (id: string) => void;
  onDeleteRelationship: (id: string) => void;
}

export function DetailInspector({
  project,
  selection,
  onEntityChange,
  onRelationshipChange,
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
    const meta = entityTypeMeta[selectedEntity.type];

    return (
      <aside className="inspector">
        <div className="inspector__header" style={{ "--inspector-accent": meta.accent } as React.CSSProperties}>
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
  const title = useMemo(
    () => `${source?.title ?? "Missing item"} -> ${target?.title ?? "Missing item"}`,
    [source?.title, target?.title]
  );

  return (
    <aside className="inspector">
      <div className="inspector__header relationship-header">
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
            const type = event.target.value as RelationshipType;
            onRelationshipChange(relationship.id, {
              type,
              label: relationship.label === relationshipLabel(relationship.type) ? relationshipLabel(type) : relationship.label
            });
          }}
        >
          {relationshipTypeMeta.map((type) => (
            <option key={type.value} value={type.value}>
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
        Notes
        <textarea
          rows={7}
          value={relationship.notes}
          onChange={(event) => onRelationshipChange(relationship.id, { notes: event.target.value })}
        />
      </label>
    </aside>
  );
}
