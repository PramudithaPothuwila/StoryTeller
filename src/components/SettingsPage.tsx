import { ArrowLeft, Bot, BookOpen, Gamepad2, Plus, Trash2 } from "lucide-react";
import { ReactNode, useState } from "react";
import { AgentSettings, DEFAULT_AGENT_SETTINGS } from "../data/agent";
import { iconForName, iconOptions } from "../data/icons";
import { isItemTypeInUse, isLinkTypeInUse } from "../data/story";
import {
  ItemTypeDefinition,
  LinkTypeDefinition,
  LinkTypeId,
  ProjectMode,
  StoryProject
} from "../types";

interface SettingsPageProps {
  project: StoryProject;
  agentSettings: AgentSettings;
  defaultRelationshipType: LinkTypeId;
  onAddItemType: () => void;
  onAddLinkType: () => void;
  onAgentSettingsChange: (settings: AgentSettings) => void;
  onBackToWorkspace: () => void;
  onDefaultRelationshipTypeChange: (type: LinkTypeId) => void;
  onDeleteItemType: (typeId: string) => void;
  onDeleteLinkType: (typeId: string) => void;
  onProjectModeChange: (projectMode: ProjectMode) => void;
  onProjectTitleChange: (title: string) => void;
  onUpdateItemType: (typeId: string, patch: Partial<ItemTypeDefinition>) => void;
  onUpdateLinkType: (typeId: string, patch: Partial<LinkTypeDefinition>) => void;
}

export function SettingsPage({
  project,
  agentSettings,
  defaultRelationshipType,
  onAddItemType,
  onAddLinkType,
  onAgentSettingsChange,
  onBackToWorkspace,
  onDefaultRelationshipTypeChange,
  onDeleteItemType,
  onDeleteLinkType,
  onProjectModeChange,
  onProjectTitleChange,
  onUpdateItemType,
  onUpdateLinkType
}: SettingsPageProps) {
  const [activeTypeTab, setActiveTypeTab] = useState<"items" | "links">("items");

  return (
    <main className="settings-page">
      <header className="settings-page__header">
        <div>
          <p>Project Settings</p>
          <h1>Settings</h1>
        </div>
        <button type="button" className="text-tool-button" onClick={onBackToWorkspace}>
          <ArrowLeft aria-hidden="true" />
          Workspace
        </button>
      </header>

      <div className="settings-layout">
        <section className="settings-panel" aria-labelledby="project-settings-title">
          <h2 id="project-settings-title">Project</h2>
          <label className="field-label" htmlFor="settings-project-title">
            Title
          </label>
          <input
            id="settings-project-title"
            aria-label="Project title"
            value={project.title}
            onChange={(event) => onProjectTitleChange(event.target.value)}
          />

          <div className="settings-control-group">
            <span>Mode</span>
            <div className="mode-toggle" role="group" aria-label="Project mode">
              <button
                type="button"
                className={project.projectMode === "story" ? "is-active" : ""}
                aria-pressed={project.projectMode === "story"}
                onClick={() => onProjectModeChange("story")}
              >
                <BookOpen aria-hidden="true" />
                Story
              </button>
              <button
                type="button"
                className={project.projectMode === "game_story" ? "is-active" : ""}
                aria-pressed={project.projectMode === "game_story"}
                onClick={() => onProjectModeChange("game_story")}
              >
                <Gamepad2 aria-hidden="true" />
                Game Story
              </button>
            </div>
          </div>
        </section>

        <section className="settings-panel" aria-labelledby="workspace-defaults-title">
          <h2 id="workspace-defaults-title">Defaults</h2>
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

        <section className="settings-panel" aria-labelledby="agent-settings-title">
          <div className="settings-panel-heading">
            <Bot aria-hidden="true" />
            <h2 id="agent-settings-title">AI Agent</h2>
          </div>
          <p className="agent-warning">
            Browser-side API keys can be inspected by anyone using this browser session. Use a limited, personal key.
          </p>
          <p className="agent-compat-note">
            The Agent API must support OpenAPI-compatible Responses API behavior, including the /responses endpoint and
            structured outputs.
          </p>
          <label className="field-label" htmlFor="settings-agent-api-key">
            API Key
          </label>
          <input
            id="settings-agent-api-key"
            aria-label="Agent API key"
            type="password"
            autoComplete="off"
            placeholder="sk-..."
            value={agentSettings.apiKey}
            onChange={(event) => onAgentSettingsChange({ ...agentSettings, apiKey: event.target.value })}
          />
          <div className="agent-settings-grid">
            <label className="field-stack">
              Model
              <input
                aria-label="Agent model"
                value={agentSettings.model}
                onChange={(event) => onAgentSettingsChange({ ...agentSettings, model: event.target.value })}
              />
            </label>
            <label className="field-stack">
              Base URL
              <input
                aria-label="Agent base URL"
                value={agentSettings.baseUrl}
                onChange={(event) => onAgentSettingsChange({ ...agentSettings, baseUrl: event.target.value })}
              />
            </label>
          </div>
          <button
            type="button"
            className="text-tool-button"
            onClick={() => onAgentSettingsChange({ ...DEFAULT_AGENT_SETTINGS })}
          >
            <Trash2 aria-hidden="true" />
            Clear Agent Settings
          </button>
        </section>

        <section className="settings-panel settings-panel--wide" aria-labelledby="type-settings-title">
          <div className="settings-section-heading">
            <h2 id="type-settings-title">Types</h2>
            <div className="segmented-tabs" role="tablist" aria-label="Type manager tabs">
              <button
                type="button"
                className={activeTypeTab === "items" ? "is-active" : ""}
                onClick={() => setActiveTypeTab("items")}
              >
                Item Types
              </button>
              <button
                type="button"
                className={activeTypeTab === "links" ? "is-active" : ""}
                onClick={() => setActiveTypeTab("links")}
              >
                Link Types
              </button>
            </div>
          </div>

          {activeTypeTab === "items" ? (
            <TypeList title="Item Types" actionLabel="Add item type" onAdd={onAddItemType}>
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
            <TypeList title="Link Types" actionLabel="Add link type" onAdd={onAddLinkType}>
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
    </main>
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
