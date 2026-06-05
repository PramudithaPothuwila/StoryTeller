import {
  BookMarked,
  Box,
  CalendarDays,
  Download,
  Flag,
  FolderOpen,
  MapPin,
  Plus,
  Save,
  Search,
  StickyNote,
  Upload,
  Users
} from "lucide-react";
import { entityTypes, EntityType, RelationshipType, StoryEntity, StoryProject } from "../types";
import { entityTypeMeta, relationshipTypeMeta } from "../data/story";

const entityIcons: Record<EntityType, typeof Users> = {
  character: Users,
  note: StickyNote,
  location: MapPin,
  event: CalendarDays,
  item: Box,
  faction: Flag
};

interface SidebarProps {
  project: StoryProject;
  search: string;
  status: string;
  isDirty: boolean;
  folderProjectSupported: boolean;
  defaultRelationshipType: RelationshipType;
  onCreateEntity: (type: EntityType) => void;
  onOpenFolder: () => void;
  onSaveFolder: () => void;
  onExportBundle: () => void;
  onImportBundle: () => void;
  onSelectEntity: (id: string) => void;
  onSearchChange: (value: string) => void;
  onProjectTitleChange: (title: string) => void;
  onDefaultRelationshipTypeChange: (type: RelationshipType) => void;
}

export function Sidebar({
  project,
  search,
  status,
  isDirty,
  folderProjectSupported,
  defaultRelationshipType,
  onCreateEntity,
  onOpenFolder,
  onSaveFolder,
  onExportBundle,
  onImportBundle,
  onSelectEntity,
  onSearchChange,
  onProjectTitleChange,
  onDefaultRelationshipTypeChange
}: SidebarProps) {
  const visibleEntities = Object.values(project.entities).filter((entity) => matchesSearch(entity, search));

  return (
    <aside className="sidebar">
      <div className="brand-row">
        <BookMarked aria-hidden="true" />
        <div>
          <p>StoryTeller</p>
          <input
            aria-label="Project title"
            value={project.title}
            onChange={(event) => onProjectTitleChange(event.target.value)}
          />
        </div>
      </div>

      <div className="project-actions">
        <button type="button" onClick={onSaveFolder} disabled={!folderProjectSupported}>
          <Save aria-hidden="true" />
          Save folder
        </button>
        <button type="button" onClick={onOpenFolder} disabled={!folderProjectSupported}>
          <FolderOpen aria-hidden="true" />
          Open folder
        </button>
        <button type="button" onClick={onExportBundle}>
          <Download aria-hidden="true" />
          Export
        </button>
        <button type="button" onClick={onImportBundle}>
          <Upload aria-hidden="true" />
          Import
        </button>
      </div>

      <p className={`status-line ${isDirty ? "is-dirty" : ""}`}>{status}</p>

      <section className="sidebar-section">
        <div className="section-heading">
          <h2>Add Item</h2>
        </div>
        <div className="entity-type-grid">
          {entityTypes.map((type) => {
            const Icon = entityIcons[type];
            const meta = entityTypeMeta[type];

            return (
              <button key={type} type="button" onClick={() => onCreateEntity(type)}>
                <Icon aria-hidden="true" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="sidebar-section">
        <label className="field-label" htmlFor="default-link-type">
          Default Link
        </label>
        <select
          id="default-link-type"
          value={defaultRelationshipType}
          onChange={(event) => onDefaultRelationshipTypeChange(event.target.value as RelationshipType)}
        >
          {relationshipTypeMeta.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </section>

      <section className="sidebar-section entity-browser">
        <div className="section-heading">
          <h2>Items</h2>
          <span>{visibleEntities.length}</span>
        </div>
        <label className="search-box">
          <Search aria-hidden="true" />
          <input
            aria-label="Search story items"
            value={search}
            placeholder="Search"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <div className="entity-list">
          {visibleEntities.map((entity) => {
            const meta = entityTypeMeta[entity.type];

            return (
              <button key={entity.id} type="button" onClick={() => onSelectEntity(entity.id)}>
                <span style={{ backgroundColor: meta.accent }} />
                <strong>{entity.title}</strong>
                <small>{meta.label}</small>
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}

function matchesSearch(entity: StoryEntity, search: string): boolean {
  const query = search.trim().toLowerCase();

  if (!query) {
    return true;
  }

  return [entity.title, entity.summary, entity.publicInfo, entity.bodyMarkdown, entity.tags.join(" ")]
    .join(" ")
    .toLowerCase()
    .includes(query);
}
