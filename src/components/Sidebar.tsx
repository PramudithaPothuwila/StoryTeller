import { Search } from "lucide-react";
import { type RefObject } from "react";
import { findItemType } from "../data/story";
import { StoryEntity, StoryProject } from "../types";

interface SidebarProps {
  project: StoryProject;
  search: string;
  searchInputRef?: RefObject<HTMLInputElement>;
  onSelectEntity: (id: string) => void;
  onSearchChange: (value: string) => void;
}

export function Sidebar({
  project,
  search,
  searchInputRef,
  onSelectEntity,
  onSearchChange
}: SidebarProps) {
  const visibleEntities = Object.values(project.entities).filter((entity) => matchesSearch(entity, search));

  return (
    <aside className="sidebar">
      <section className="sidebar-section entity-browser">
        <div className="section-heading">
          <h2>Items</h2>
          <span>{visibleEntities.length}</span>
        </div>
        <label className="search-box">
          <Search aria-hidden="true" />
          <input
            ref={searchInputRef}
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
