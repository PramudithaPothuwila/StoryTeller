import { ArrowLeft, ListChecks, Play, Plus, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  addGameStateVariableToProject,
  applyGamePlaythroughChoice,
  coerceGameStateValue,
  deleteGameStateVariableFromProject,
  getGameContinuityIssues,
  getGamePlayableChoices,
  getGameStoryNodes,
  getInitialGameState,
  updateGameStateVariableInProject,
  updateGameStoryProjectMetadata
} from "../data/story";
import {
  GameContinuityIssue,
  GameStateValue,
  GameStateVariableDefinition,
  GameStateVariableKind,
  StoryProject
} from "../types";

type GameToolTab = "state" | "preview" | "continuity";

interface GameStoryPanelProps {
  project: StoryProject;
  activeTab: GameToolTab;
  onActiveTabChange: (tab: GameToolTab) => void;
  onProjectChange: (project: StoryProject) => void;
  onSelectEntity: (id: string) => void;
  onSelectRelationship: (id: string) => void;
}

const variableKinds: GameStateVariableKind[] = [
  "flag",
  "number",
  "enum",
  "relationship",
  "faction_reputation",
  "inventory"
];

export function GameStoryPanel({
  project,
  activeTab,
  onActiveTabChange,
  onProjectChange,
  onSelectEntity,
  onSelectRelationship
}: GameStoryPanelProps) {
  const issues = useMemo(() => getGameContinuityIssues(project), [project]);

  return (
    <aside className="game-story-panel" aria-label="Game Story Tools">
      <header className="game-story-panel__header">
        <div>
          <p>Branching RPG</p>
          <h2>Game Story</h2>
        </div>
      </header>

      <div className="segmented-tabs game-story-tabs" role="tablist" aria-label="Game story tabs">
        <button type="button" className={activeTab === "state" ? "is-active" : ""} onClick={() => onActiveTabChange("state")}>
          <SlidersHorizontal aria-hidden="true" />
          State
        </button>
        <button type="button" className={activeTab === "preview" ? "is-active" : ""} onClick={() => onActiveTabChange("preview")}>
          <Play aria-hidden="true" />
          Preview
        </button>
        <button
          type="button"
          className={activeTab === "continuity" ? "is-active" : ""}
          onClick={() => onActiveTabChange("continuity")}
        >
          <ListChecks aria-hidden="true" />
          Continuity
          <span>{issues.length}</span>
        </button>
      </div>

      <div className="game-story-panel__body">
        {activeTab === "state" ? <StateManager project={project} onProjectChange={onProjectChange} /> : null}
        {activeTab === "preview" ? <PlayPreview project={project} /> : null}
        {activeTab === "continuity" ? (
          <ContinuityPanel
            issues={issues}
            onSelectEntity={onSelectEntity}
            onSelectRelationship={onSelectRelationship}
          />
        ) : null}
      </div>
    </aside>
  );
}

interface StateManagerProps {
  project: StoryProject;
  onProjectChange: (project: StoryProject) => void;
}

function StateManager({ project, onProjectChange }: StateManagerProps) {
  const metadata = project.gameStory;
  const gameNodes = getGameStoryNodes(project);
  const variables = metadata?.stateVariables ?? [];

  function updateStartNode(startNodeId: string) {
    onProjectChange(updateGameStoryProjectMetadata(project, { startNodeId: startNodeId || undefined }));
  }

  function updateValidation(field: keyof NonNullable<StoryProject["gameStory"]>["validation"], value: boolean) {
    onProjectChange(
      updateGameStoryProjectMetadata(project, {
        validation: {
          checkUnreachableNodes: true,
          checkInvalidStateReferences: true,
          checkDialogueDeadEnds: true,
          ...metadata?.validation,
          [field]: value
        }
      })
    );
  }

  function updateVariable(variable: GameStateVariableDefinition, patch: Partial<GameStateVariableDefinition>) {
    onProjectChange(updateGameStateVariableInProject(project, variable.id, patch));
  }

  return (
    <section className="game-tool-section">
      <label className="field-stack">
        Start Node
        <select
          aria-label="Game story start node"
          value={metadata?.startNodeId ?? ""}
          onChange={(event) => updateStartNode(event.target.value)}
        >
          <option value="">Choose start node</option>
          {gameNodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.title}
            </option>
          ))}
        </select>
      </label>

      <section className="game-subsection">
        <h3>Validation</h3>
        <div className="checkbox-grid">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={metadata?.validation.checkUnreachableNodes ?? true}
              onChange={(event) => updateValidation("checkUnreachableNodes", event.target.checked)}
            />
            Reachability
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={metadata?.validation.checkInvalidStateReferences ?? true}
              onChange={(event) => updateValidation("checkInvalidStateReferences", event.target.checked)}
            />
            State Refs
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={metadata?.validation.checkDialogueDeadEnds ?? true}
              onChange={(event) => updateValidation("checkDialogueDeadEnds", event.target.checked)}
            />
            Dialogue Outcomes
          </label>
        </div>
      </section>

      <div className="game-subsection__header">
        <h3>State Variables</h3>
        <button type="button" className="text-tool-button" onClick={() => onProjectChange(addGameStateVariableToProject(project))}>
          <Plus aria-hidden="true" />
          Variable
        </button>
      </div>

      {variables.length ? (
        variables.map((variable) => (
          <div key={variable.id} className="state-variable-card">
            <div className="game-card-heading">
              <strong>{variable.label}</strong>
              <button
                type="button"
                className="icon-button danger"
                aria-label={`Delete ${variable.label}`}
                onClick={() => onProjectChange(deleteGameStateVariableFromProject(project, variable.id))}
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
            <div className="game-story-fields__grid">
              <label className="field-stack">
                ID
                <input value={variable.id} onChange={(event) => updateVariable(variable, { id: event.target.value })} />
              </label>
              <label className="field-stack">
                Label
                <input value={variable.label} onChange={(event) => updateVariable(variable, { label: event.target.value })} />
              </label>
            </div>
            <div className="game-story-fields__grid">
              <label className="field-stack">
                Kind
                <select
                  value={variable.kind}
                  onChange={(event) =>
                    updateVariable(variable, {
                      kind: event.target.value as GameStateVariableKind,
                      defaultValue: coerceGameStateValue(variable.defaultValue, event.target.value as GameStateVariableKind)
                    })
                  }
                >
                  {variableKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {displayToken(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-stack">
                Default
                <input
                  value={String(variable.defaultValue)}
                  onChange={(event) =>
                    updateVariable(variable, {
                      defaultValue: coerceGameStateValue(event.target.value, variable.kind)
                    })
                  }
                />
              </label>
            </div>
            {variable.kind === "enum" ? (
              <label className="field-stack">
                Enum Options
                <input
                  value={variable.enumOptions.join(", ")}
                  onChange={(event) =>
                    updateVariable(variable, {
                      enumOptions: event.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean)
                    })
                  }
                />
              </label>
            ) : null}
            <label className="field-stack">
              Notes
              <textarea rows={2} value={variable.notes} onChange={(event) => updateVariable(variable, { notes: event.target.value })} />
            </label>
          </div>
        ))
      ) : (
        <p className="game-empty-note">No state variables yet.</p>
      )}
    </section>
  );
}

interface PlayHistoryEntry {
  nodeId: string;
  state: Record<string, GameStateValue>;
}

function PlayPreview({ project }: { project: StoryProject }) {
  const startNodeId = project.gameStory?.startNodeId ?? "";
  const [currentNodeId, setCurrentNodeId] = useState(startNodeId);
  const [state, setState] = useState<Record<string, GameStateValue>>(() => getInitialGameState(project));
  const [history, setHistory] = useState<PlayHistoryEntry[]>([]);
  const currentNode = currentNodeId ? project.entities[currentNodeId] : null;
  const choices = currentNodeId ? getGamePlayableChoices(project, currentNodeId, state) : [];

  useEffect(() => {
    setCurrentNodeId(startNodeId);
    setState(getInitialGameState(project));
    setHistory([]);
  }, [project.gameStory?.startNodeId, project.gameStory?.stateVariables.length, startNodeId]);

  function handleReset() {
    setCurrentNodeId(startNodeId);
    setState(getInitialGameState(project));
    setHistory([]);
  }

  function handleBack() {
    const previous = history[history.length - 1];

    if (!previous) {
      return;
    }

    setCurrentNodeId(previous.nodeId);
    setState(previous.state);
    setHistory(history.slice(0, -1));
  }

  return (
    <section className="game-tool-section">
      <div className="play-preview-header">
        <button type="button" className="icon-button" aria-label="Backtrack preview" disabled={!history.length} onClick={handleBack}>
          <ArrowLeft aria-hidden="true" />
        </button>
        <button type="button" className="icon-button" aria-label="Reset preview" onClick={handleReset}>
          <RotateCcw aria-hidden="true" />
        </button>
      </div>

      {currentNode ? (
        <section className="play-current-node">
          <small>{displayToken(currentNode.gameStory?.role ?? currentNode.type)}</small>
          <h3>{currentNode.title}</h3>
          <p>{currentNode.summary || currentNode.publicInfo || "No preview text yet."}</p>
        </section>
      ) : (
        <p className="game-empty-note">Choose a start node in State Manager.</p>
      )}

      <section className="game-subsection">
        <h3>Choices</h3>
        {choices.length ? (
          choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={`play-choice ${choice.available ? "" : "is-locked"}`}
              disabled={!choice.available}
              onClick={() => {
                setHistory([...history, { nodeId: currentNodeId, state }]);
                setState(applyGamePlaythroughChoice(project, currentNodeId, state, choice));
                setCurrentNodeId(choice.targetNodeId);
              }}
            >
              <strong>{choice.label}</strong>
              <span>{choice.available ? project.entities[choice.targetNodeId]?.title : choice.lockedReason}</span>
            </button>
          ))
        ) : (
          <p className="game-empty-note">No available story choices from this node.</p>
        )}
      </section>

      <section className="game-subsection">
        <h3>State</h3>
        {Object.entries(state).length ? (
          <div className="state-readout">
            {Object.entries(state).map(([key, value]) => (
              <div key={key}>
                <span>{project.gameStory?.stateVariables.find((variable) => variable.id === key)?.label ?? key}</span>
                <strong>{String(value)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="game-empty-note">No state variables.</p>
        )}
      </section>
    </section>
  );
}

interface ContinuityPanelProps {
  issues: GameContinuityIssue[];
  onSelectEntity: (id: string) => void;
  onSelectRelationship: (id: string) => void;
}

function ContinuityPanel({ issues, onSelectEntity, onSelectRelationship }: ContinuityPanelProps) {
  return (
    <section className="game-tool-section">
      {issues.length ? (
        issues.map((issue) => (
          <button
            key={issue.id}
            type="button"
            className={`continuity-issue is-${issue.severity}`}
            onClick={() => {
              if (issue.entityId) {
                onSelectEntity(issue.entityId);
                return;
              }

              if (issue.relationshipId) {
                onSelectRelationship(issue.relationshipId);
              }
            }}
          >
            <strong>{issue.title}</strong>
            <span>{issue.details}</span>
          </button>
        ))
      ) : (
        <p className="game-empty-note">No continuity issues found.</p>
      )}
    </section>
  );
}

function displayToken(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export type { GameToolTab };
