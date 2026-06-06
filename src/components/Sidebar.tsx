import {
  BookMarked,
  Download,
  FilePlus2,
  FolderPlus,
  FolderOpen,
  Save,
  Search,
  Settings2
} from "lucide-react";
import { iconForName } from "../data/icons";
import { findItemType } from "../data/story";
import { ItemTypeId, LinkTypeId, StoryEntity, StoryProject } from "../types";

interface SidebarProps {
  project: StoryProject;
  search: string;
  status: string;
  isDirty: boolean;
  projectFolderName: string | null;
  defaultRelationshipType: LinkTypeId;
  onCreateEntity: (type: ItemTypeId) => void;
  onNewProject: () => void;
  onOpenTypeManager: () => void;
  onOpenProject: () => void;
  onSelectProjectFolder: () => void;
  onSaveProject: () => void;
  onExportBackup: () => void;
  onSelectEntity: (id: string) => void;
  onSearchChange: (value: string) => void;
  onProjectTitleChange: (title: string) => void;
  onDefaultRelationshipTypeChange: (type: LinkTypeId) => void;
}

export function Sidebar({
  project,
  search,
  status,
  isDirty,
  projectFolderName,
  defaultRelationshipType,
  onCreateEntity,
  onNewProject,
  onOpenTypeManager,
  onOpenProject,
  onSelectProjectFolder,
  onSaveProject,
  onExportBackup,
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
        <button type="button" onClick={onNewProject}>
          <FilePlus2 aria-hidden="true" />
          New Project
        </button>
        <button type="button" onClick={onOpenProject}>
          <FolderOpen aria-hidden="true" />
          Open Project
        </button>
        <button type="button" onClick={onSelectProjectFolder}>
          <FolderPlus aria-hidden="true" />
          Select Folder
        </button>
        <button type="button" onClick={onSaveProject}>
          <Save aria-hidden="true" />
          Save Project
        </button>
        <button type="button" onClick={onExportBackup}>
          <Download aria-hidden="true" />
          Export Backup
        </button>
      </div>

      <p className="folder-line">
        Folder: <strong>{projectFolderName ?? "Not selected"}</strong>
      </p>
      <p className={`status-line ${isDirty ? "is-dirty" : ""}`}>{status}</p>

      <section className="sidebar-section">
        <div className="section-heading">
          <h2>Add Item</h2>
          <button type="button" className="text-tool-button" onClick={onOpenTypeManager}>
            <Settings2 aria-hidden="true" />
            Types
          </button>
        </div>
        <div className="entity-type-grid">
          {project.itemTypes.map((type) => {
            const Icon = iconForName(type.icon);

            return (
              <button key={type.id} type="button" onClick={() => onCreateEntity(type.id)}>
                <Icon aria-hidden="true" />
                {type.label}
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
          onChange={(event) => onDefaultRelationshipTypeChange(event.target.value)}
        >
          {project.linkTypes.map((type) => (
            <option key={type.id} value={type.id}>
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
            const meta = findItemType(project, entity.type);

            return (
              <button key={entity.id} type="button" onClick={() => onSelectEntity(entity.id)}>
                <span style={{ backgroundColor: meta.color }} />
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

  return [
    entity.title,
    entity.summary,
    entity.publicInfo,
    entity.bodyMarkdown,
    entity.tags.join(" "),
    ...Object.values(entity.worldRule ?? {})
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}
