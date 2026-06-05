import { Plus, Trash2, X } from "lucide-react";
import { ReactNode, useState } from "react";
import { iconForName, iconOptions } from "../data/icons";
import { isItemTypeInUse, isLinkTypeInUse } from "../data/story";
import { ItemTypeDefinition, LinkTypeDefinition, StoryProject } from "../types";

interface TypeManagerProps {
  project: StoryProject;
  onClose: () => void;
  onAddItemType: () => void;
  onAddLinkType: () => void;
  onUpdateItemType: (typeId: string, patch: Partial<ItemTypeDefinition>) => void;
  onUpdateLinkType: (typeId: string, patch: Partial<LinkTypeDefinition>) => void;
  onDeleteItemType: (typeId: string) => void;
  onDeleteLinkType: (typeId: string) => void;
}

export function TypeManager({
  project,
  onClose,
  onAddItemType,
  onAddLinkType,
  onUpdateItemType,
  onUpdateLinkType,
  onDeleteItemType,
  onDeleteLinkType
}: TypeManagerProps) {
  const [activeTab, setActiveTab] = useState<"items" | "links">("items");

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="type-manager" role="dialog" aria-modal="true" aria-labelledby="type-manager-title">
        <header className="type-manager__header">
          <div>
            <p>Project Settings</p>
            <h2 id="type-manager-title">Type Manager</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close type manager" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="segmented-tabs" role="tablist" aria-label="Type manager tabs">
          <button type="button" className={activeTab === "items" ? "is-active" : ""} onClick={() => setActiveTab("items")}>
            Item Types
          </button>
          <button type="button" className={activeTab === "links" ? "is-active" : ""} onClick={() => setActiveTab("links")}>
            Link Types
          </button>
        </div>

        {activeTab === "items" ? (
          <TypeList
            title="Item Types"
            actionLabel="Add item type"
            onAdd={onAddItemType}
          >
            {project.itemTypes.map((type) => {
              const Icon = iconForName(type.icon);
              const locked = type.builtIn;
              const inUse = isItemTypeInUse(project, type.id);

              return (
                <div key={type.id} className="type-row">
                  <Icon aria-hidden="true" style={{ color: type.color }} />
                  <input
                    aria-label={`${type.label} label`}
                    value={type.label}
                    disabled={locked}
                    onChange={(event) => onUpdateItemType(type.id, { label: event.target.value })}
                  />
                  <input
                    aria-label={`${type.label} color`}
                    className="color-input"
                    type="color"
                    value={type.color}
                    disabled={locked}
                    onChange={(event) => onUpdateItemType(type.id, { color: event.target.value })}
                  />
                  <select
                    aria-label={`${type.label} icon`}
                    value={type.icon}
                    disabled={locked}
                    onChange={(event) => onUpdateItemType(type.id, { icon: event.target.value })}
                  >
                    {iconOptions.map((icon) => (
                      <option key={icon.value} value={icon.value}>
                        {icon.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Delete ${type.label}`}
                    disabled={locked || inUse}
                    title={locked ? "Built-in types are locked" : inUse ? "Type is in use" : "Delete type"}
                    onClick={() => onDeleteItemType(type.id)}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </TypeList>
        ) : (
          <TypeList
            title="Link Types"
            actionLabel="Add link type"
            onAdd={onAddLinkType}
          >
            {project.linkTypes.map((type) => {
              const Icon = iconForName(type.icon);
              const locked = type.builtIn;
              const inUse = isLinkTypeInUse(project, type.id);

              return (
                <div key={type.id} className="type-row type-row--links">
                  <Icon aria-hidden="true" style={{ color: type.color }} />
                  <input
                    aria-label={`${type.label} label`}
                    value={type.label}
                    disabled={locked}
                    onChange={(event) => onUpdateLinkType(type.id, { label: event.target.value })}
                  />
                  <input
                    aria-label={`${type.label} color`}
                    className="color-input"
                    type="color"
                    value={type.color}
                    disabled={locked}
                    onChange={(event) => onUpdateLinkType(type.id, { color: event.target.value })}
                  />
                  <select
                    aria-label={`${type.label} icon`}
                    value={type.icon}
                    disabled={locked}
                    onChange={(event) => onUpdateLinkType(type.id, { icon: event.target.value })}
                  >
                    {iconOptions.map((icon) => (
                      <option key={icon.value} value={icon.value}>
                        {icon.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`${type.label} direction`}
                    value={type.direction}
                    disabled={locked}
                    onChange={(event) =>
                      onUpdateLinkType(type.id, { direction: event.target.value as LinkTypeDefinition["direction"] })
                    }
                  >
                    <option value="directed">Directed</option>
                    <option value="mutual">Mutual</option>
                  </select>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Delete ${type.label}`}
                    disabled={locked || inUse}
                    title={locked ? "Built-in types are locked" : inUse ? "Type is in use" : "Delete type"}
                    onClick={() => onDeleteLinkType(type.id)}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </TypeList>
        )}
      </section>
    </div>
  );
}

interface TypeListProps {
  title: string;
  actionLabel: string;
  onAdd: () => void;
  children: ReactNode;
}

function TypeList({ title, actionLabel, onAdd, children }: TypeListProps) {
  return (
    <section className="type-list">
      <div className="type-list__heading">
        <h3>{title}</h3>
        <button type="button" onClick={onAdd}>
          <Plus aria-hidden="true" />
          {actionLabel}
        </button>
      </div>
      <div className="type-list__rows">{children}</div>
    </section>
  );
}
