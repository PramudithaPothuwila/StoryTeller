import { Plus, Trash2 } from "lucide-react";
import {
  coerceGameStateValue,
  createGameDialogueLine,
  createGameDialogueResponse,
  createGameDialogueVariant,
  createGameQuestObjective,
  createGameStateCondition,
  createGameStateEffect,
  gameStoryRoleForType,
  getGameStoryNodes,
  normalizeGameDialogueMetadata,
  normalizeGameQuestMetadata,
  normalizeGameStoryEntityMetadata
} from "../data/story";
import {
  GameDialogueLine,
  GameDialogueMetadata,
  GameDialogueResponse,
  GameDialogueVariant,
  GameQuestMetadata,
  GameQuestObjective,
  GameStateCondition,
  GameStateEffect,
  GameStoryEntityMetadata,
  StoryEntity,
  StoryProject
} from "../types";

interface GameStoryFieldsProps {
  project: StoryProject;
  entity: StoryEntity;
  idPrefix: string;
  onEntityChange: (patch: Partial<StoryEntity>) => void;
}

const roleOptions: GameStoryEntityMetadata["role"][] = ["scene", "quest", "dialogue", "ending"];
const statusOptions: GameStoryEntityMetadata["status"][] = ["draft", "ready", "deprecated"];
const questTypes: GameQuestMetadata["questType"][] = ["main", "side", "companion", "faction", "hidden"];
const conditionOperators: GameStateCondition["operator"][] = [
  "equals",
  "not_equals",
  "greater_than",
  "less_than",
  "has",
  "not_has"
];
const effectOperations: GameStateEffect["operation"][] = ["set", "increment", "decrement", "add", "remove"];

export function GameStoryFields({ project, entity, idPrefix, onEntityChange }: GameStoryFieldsProps) {
  const metadata = normalizeGameStoryEntityMetadata(entity.gameStory, entity.type);
  const events = Object.values(project.entities).filter((item) => item.type === "event");

  function handleGameStoryChange(patch: Partial<GameStoryEntityMetadata>) {
    onEntityChange({
      gameStory: normalizeGameStoryEntityMetadata(
        {
          ...metadata,
          ...patch
        },
        entity.type
      )
    });
  }

  function handleRoleChange(role: GameStoryEntityMetadata["role"]) {
    handleGameStoryChange({
      role,
      dialogue: role === "dialogue" ? normalizeGameDialogueMetadata(metadata.dialogue) : metadata.dialogue,
      quest: role === "quest" ? normalizeGameQuestMetadata(metadata.quest) : metadata.quest
    });
  }

  return (
    <section className="game-story-fields">
      <h2>Game Story</h2>

      <div className="game-story-fields__grid">
        <label className="field-stack">
          Node Role
          <select
            aria-label="Game node role"
            value={metadata.role}
            onChange={(event) => handleRoleChange(event.target.value as GameStoryEntityMetadata["role"])}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {displayToken(role)}
              </option>
            ))}
          </select>
        </label>

        <label className="field-stack">
          Status
          <select
            aria-label="Game node status"
            value={metadata.status}
            onChange={(event) =>
              handleGameStoryChange({ status: event.target.value as GameStoryEntityMetadata["status"] })
            }
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {displayToken(status)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={metadata.criticalPath}
          onChange={(event) => handleGameStoryChange({ criticalPath: event.target.checked })}
        />
        Critical Path
      </label>

      <label className="field-stack">
        Timeline Anchor
        <select
          aria-label="Game timeline anchor"
          value={metadata.timelineAnchorId ?? ""}
          onChange={(event) => handleGameStoryChange({ timelineAnchorId: event.target.value || undefined })}
        >
          <option value="">None</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </label>

      <ConditionEffectEditor
        project={project}
        title="Entry Conditions"
        conditions={metadata.entryConditions}
        onConditionsChange={(entryConditions) => handleGameStoryChange({ entryConditions })}
      />

      <ConditionEffectEditor
        project={project}
        title="Exit Effects"
        effects={metadata.exitEffects}
        onEffectsChange={(exitEffects) => handleGameStoryChange({ exitEffects })}
      />

      {metadata.role === "dialogue" ? (
        <DialogueEditor
          project={project}
          idPrefix={idPrefix}
          dialogue={normalizeGameDialogueMetadata(metadata.dialogue)}
          onChange={(dialogue) => handleGameStoryChange({ dialogue })}
        />
      ) : null}

      {metadata.role === "quest" ? (
        <QuestEditor
          project={project}
          quest={normalizeGameQuestMetadata(metadata.quest)}
          onChange={(quest) => handleGameStoryChange({ quest })}
        />
      ) : null}
    </section>
  );
}

interface ConditionEffectEditorProps {
  project: StoryProject;
  title: string;
  conditions?: GameStateCondition[];
  effects?: GameStateEffect[];
  onConditionsChange?: (conditions: GameStateCondition[]) => void;
  onEffectsChange?: (effects: GameStateEffect[]) => void;
}

export function ConditionEffectEditor({
  project,
  title,
  conditions,
  effects,
  onConditionsChange,
  onEffectsChange
}: ConditionEffectEditorProps) {
  const variables = project.gameStory?.stateVariables ?? [];
  const firstVariableId = variables[0]?.id ?? "";

  function variableKind(variableId: string) {
    return variables.find((variable) => variable.id === variableId)?.kind ?? "flag";
  }

  function valueForInput(value: unknown): string {
    return typeof value === "boolean" ? String(value) : String(value ?? "");
  }

  return (
    <section className="game-subsection">
      <div className="game-subsection__header">
        <h3>{title}</h3>
        {onConditionsChange ? (
          <button
            type="button"
            className="text-tool-button"
            disabled={!firstVariableId}
            onClick={() => onConditionsChange([...(conditions ?? []), createGameStateCondition(firstVariableId)])}
          >
            <Plus aria-hidden="true" />
            Condition
          </button>
        ) : null}
        {onEffectsChange ? (
          <button
            type="button"
            className="text-tool-button"
            disabled={!firstVariableId}
            onClick={() => onEffectsChange([...(effects ?? []), createGameStateEffect(firstVariableId)])}
          >
            <Plus aria-hidden="true" />
            Effect
          </button>
        ) : null}
      </div>

      {!variables.length ? <p className="game-empty-note">Add state variables in State Manager.</p> : null}

      {conditions?.map((condition, index) => (
        <div key={condition.id} className="game-condition-row">
          <select
            aria-label={`${title} condition variable`}
            value={condition.variableId}
            onChange={(event) =>
              onConditionsChange?.(
                conditions.map((item) =>
                  item.id === condition.id
                    ? {
                        ...item,
                        variableId: event.target.value,
                        value: coerceGameStateValue(item.value, variableKind(event.target.value))
                      }
                    : item
                )
              )
            }
          >
            <option value="">Missing variable</option>
            {variables.map((variable) => (
              <option key={variable.id} value={variable.id}>
                {variable.label}
              </option>
            ))}
          </select>
          <select
            aria-label={`${title} condition operator`}
            value={condition.operator}
            onChange={(event) =>
              onConditionsChange?.(
                conditions.map((item) =>
                  item.id === condition.id
                    ? { ...item, operator: event.target.value as GameStateCondition["operator"] }
                    : item
                )
              )
            }
          >
            {conditionOperators.map((operator) => (
              <option key={operator} value={operator}>
                {displayToken(operator)}
              </option>
            ))}
          </select>
          <input
            aria-label={`${title} condition value ${index + 1}`}
            value={valueForInput(condition.value)}
            onChange={(event) =>
              onConditionsChange?.(
                conditions.map((item) =>
                  item.id === condition.id
                    ? {
                        ...item,
                        value: coerceGameStateValue(event.target.value, variableKind(item.variableId))
                      }
                    : item
                )
              )
            }
          />
          <button
            type="button"
            className="icon-button danger"
            aria-label={`Delete ${title} condition`}
            onClick={() => onConditionsChange?.(conditions.filter((item) => item.id !== condition.id))}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      ))}

      {effects?.map((effect, index) => (
        <div key={effect.id} className="game-condition-row">
          <select
            aria-label={`${title} effect variable`}
            value={effect.variableId}
            onChange={(event) =>
              onEffectsChange?.(
                effects.map((item) =>
                  item.id === effect.id
                    ? {
                        ...item,
                        variableId: event.target.value,
                        value: coerceGameStateValue(item.value, variableKind(event.target.value))
                      }
                    : item
                )
              )
            }
          >
            <option value="">Missing variable</option>
            {variables.map((variable) => (
              <option key={variable.id} value={variable.id}>
                {variable.label}
              </option>
            ))}
          </select>
          <select
            aria-label={`${title} effect operation`}
            value={effect.operation}
            onChange={(event) =>
              onEffectsChange?.(
                effects.map((item) =>
                  item.id === effect.id
                    ? { ...item, operation: event.target.value as GameStateEffect["operation"] }
                    : item
                )
              )
            }
          >
            {effectOperations.map((operation) => (
              <option key={operation} value={operation}>
                {displayToken(operation)}
              </option>
            ))}
          </select>
          <input
            aria-label={`${title} effect value ${index + 1}`}
            value={valueForInput(effect.value)}
            onChange={(event) =>
              onEffectsChange?.(
                effects.map((item) =>
                  item.id === effect.id
                    ? {
                        ...item,
                        value: coerceGameStateValue(event.target.value, variableKind(item.variableId))
                      }
                    : item
                )
              )
            }
          />
          <button
            type="button"
            className="icon-button danger"
            aria-label={`Delete ${title} effect`}
            onClick={() => onEffectsChange?.(effects.filter((item) => item.id !== effect.id))}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      ))}
    </section>
  );
}

interface DialogueEditorProps {
  project: StoryProject;
  idPrefix: string;
  dialogue: GameDialogueMetadata;
  onChange: (dialogue: GameDialogueMetadata) => void;
}

function DialogueEditor({ project, dialogue, onChange }: DialogueEditorProps) {
  const speakers = Object.values(project.entities).filter((entity) => entity.type === "character" || entity.type === "faction");
  const targetNodes = getGameStoryNodes(project);

  function updateLine(lineId: string, patch: Partial<GameDialogueLine>) {
    onChange({
      ...dialogue,
      lines: dialogue.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line))
    });
  }

  function updateResponse(responseId: string, patch: Partial<GameDialogueResponse>) {
    onChange({
      ...dialogue,
      responses: dialogue.responses.map((response) => (response.id === responseId ? { ...response, ...patch } : response))
    });
  }

  function updateVariant(variantId: string, patch: Partial<GameDialogueVariant>) {
    onChange({
      ...dialogue,
      variants: dialogue.variants.map((variant) => (variant.id === variantId ? { ...variant, ...patch } : variant))
    });
  }

  return (
    <section className="game-subsection">
      <div className="game-subsection__header">
        <h3>Dialogue Lines</h3>
        <button
          type="button"
          className="text-tool-button"
          onClick={() => onChange({ ...dialogue, lines: [...dialogue.lines, createGameDialogueLine()] })}
        >
          <Plus aria-hidden="true" />
          Line
        </button>
      </div>

      {dialogue.lines.map((line, index) => (
        <div key={line.id} className="game-dialogue-card">
          <div className="game-card-heading">
            <strong>Line {index + 1}</strong>
            <button
              type="button"
              className="icon-button danger"
              aria-label="Delete dialogue line"
              onClick={() => onChange({ ...dialogue, lines: dialogue.lines.filter((item) => item.id !== line.id) })}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
          <label className="field-stack">
            Speaker
            <select value={line.speakerId ?? ""} onChange={(event) => updateLine(line.id, { speakerId: event.target.value || undefined })}>
              <option value="">Narration</option>
              {speakers.map((speaker) => (
                <option key={speaker.id} value={speaker.id}>
                  {speaker.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field-stack">
            Line
            <textarea rows={3} value={line.text} onChange={(event) => updateLine(line.id, { text: event.target.value })} />
          </label>
          <div className="game-story-fields__grid">
            <label className="field-stack">
              Tone
              <input value={line.tone} onChange={(event) => updateLine(line.id, { tone: event.target.value })} />
            </label>
            <label className="field-stack">
              Voice Notes
              <input value={line.voiceNotes} onChange={(event) => updateLine(line.id, { voiceNotes: event.target.value })} />
            </label>
          </div>
        </div>
      ))}

      <div className="game-subsection__header">
        <h3>Player Responses</h3>
        <button
          type="button"
          className="text-tool-button"
          onClick={() => onChange({ ...dialogue, responses: [...dialogue.responses, createGameDialogueResponse()] })}
        >
          <Plus aria-hidden="true" />
          Response
        </button>
      </div>

      {dialogue.responses.map((response, index) => (
        <div key={response.id} className="game-dialogue-card">
          <div className="game-card-heading">
            <strong>Response {index + 1}</strong>
            <button
              type="button"
              className="icon-button danger"
              aria-label="Delete dialogue response"
              onClick={() =>
                onChange({ ...dialogue, responses: dialogue.responses.filter((item) => item.id !== response.id) })
              }
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
          <label className="field-stack">
            Response Text
            <input value={response.text} onChange={(event) => updateResponse(response.id, { text: event.target.value })} />
          </label>
          <label className="field-stack">
            Branch Target
            <select
              value={response.targetNodeId ?? ""}
              onChange={(event) => updateResponse(response.id, { targetNodeId: event.target.value || undefined })}
            >
              <option value="">No target</option>
              {targetNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.title}
                </option>
              ))}
            </select>
          </label>
          <ConditionEffectEditor
            project={project}
            title="Response Conditions"
            conditions={response.conditions}
            onConditionsChange={(conditions) => updateResponse(response.id, { conditions })}
          />
          <ConditionEffectEditor
            project={project}
            title="Response Effects"
            effects={response.effects}
            onEffectsChange={(effects) => updateResponse(response.id, { effects })}
          />
          <label className="field-stack">
            Notes
            <textarea rows={2} value={response.notes} onChange={(event) => updateResponse(response.id, { notes: event.target.value })} />
          </label>
        </div>
      ))}

      <div className="game-subsection__header">
        <h3>Conditional Variants</h3>
        <button
          type="button"
          className="text-tool-button"
          onClick={() => onChange({ ...dialogue, variants: [...dialogue.variants, createGameDialogueVariant()] })}
        >
          <Plus aria-hidden="true" />
          Variant
        </button>
      </div>

      {dialogue.variants.map((variant, index) => (
        <div key={variant.id} className="game-dialogue-card">
          <div className="game-card-heading">
            <strong>Variant {index + 1}</strong>
            <button
              type="button"
              className="icon-button danger"
              aria-label="Delete dialogue variant"
              onClick={() => onChange({ ...dialogue, variants: dialogue.variants.filter((item) => item.id !== variant.id) })}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
          <label className="field-stack">
            Label
            <input value={variant.label} onChange={(event) => updateVariant(variant.id, { label: event.target.value })} />
          </label>
          <ConditionEffectEditor
            project={project}
            title="Variant Conditions"
            conditions={variant.conditions}
            onConditionsChange={(conditions) => updateVariant(variant.id, { conditions })}
          />
        </div>
      ))}
    </section>
  );
}

interface QuestEditorProps {
  project: StoryProject;
  quest: GameQuestMetadata;
  onChange: (quest: GameQuestMetadata) => void;
}

function QuestEditor({ project, quest, onChange }: QuestEditorProps) {
  const givers = Object.values(project.entities).filter((entity) => entity.type === "character" || entity.type === "faction");

  function updateObjective(objectiveId: string, patch: Partial<GameQuestObjective>) {
    onChange({
      ...quest,
      objectives: quest.objectives.map((objective) => (objective.id === objectiveId ? { ...objective, ...patch } : objective))
    });
  }

  return (
    <section className="game-subsection">
      <h3>Quest Fields</h3>
      <div className="game-story-fields__grid">
        <label className="field-stack">
          Quest Type
          <select value={quest.questType} onChange={(event) => onChange({ ...quest, questType: event.target.value as GameQuestMetadata["questType"] })}>
            {questTypes.map((questType) => (
              <option key={questType} value={questType}>
                {displayToken(questType)}
              </option>
            ))}
          </select>
        </label>
        <label className="field-stack">
          Giver
          <select value={quest.giverId ?? ""} onChange={(event) => onChange({ ...quest, giverId: event.target.value || undefined })}>
            <option value="">None</option>
            {givers.map((giver) => (
              <option key={giver.id} value={giver.id}>
                {giver.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="game-subsection__header">
        <h3>Objectives</h3>
        <button
          type="button"
          className="text-tool-button"
          onClick={() => onChange({ ...quest, objectives: [...quest.objectives, createGameQuestObjective()] })}
        >
          <Plus aria-hidden="true" />
          Objective
        </button>
      </div>

      {quest.objectives.map((objective, index) => (
        <div key={objective.id} className="game-dialogue-card">
          <div className="game-card-heading">
            <strong>Objective {index + 1}</strong>
            <button
              type="button"
              className="icon-button danger"
              aria-label="Delete quest objective"
              onClick={() => onChange({ ...quest, objectives: quest.objectives.filter((item) => item.id !== objective.id) })}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
          <label className="field-stack">
            Objective
            <input value={objective.text} onChange={(event) => updateObjective(objective.id, { text: event.target.value })} />
          </label>
          <div className="checkbox-grid">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={objective.optional}
                onChange={(event) => updateObjective(objective.id, { optional: event.target.checked })}
              />
              Optional
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={objective.hidden}
                onChange={(event) => updateObjective(objective.id, { hidden: event.target.checked })}
              />
              Hidden
            </label>
          </div>
          <ConditionEffectEditor
            project={project}
            title="Objective Conditions"
            conditions={objective.completeConditions}
            onConditionsChange={(completeConditions) => updateObjective(objective.id, { completeConditions })}
          />
        </div>
      ))}

      <ConditionEffectEditor
        project={project}
        title="Success Conditions"
        conditions={quest.successConditions}
        onConditionsChange={(successConditions) => onChange({ ...quest, successConditions })}
      />
      <ConditionEffectEditor
        project={project}
        title="Failure Conditions"
        conditions={quest.failureConditions}
        onConditionsChange={(failureConditions) => onChange({ ...quest, failureConditions })}
      />

      <label className="field-stack">
        Rewards
        <textarea rows={3} value={quest.rewards} onChange={(event) => onChange({ ...quest, rewards: event.target.value })} />
      </label>
      <label className="field-stack">
        Consequences
        <textarea rows={3} value={quest.consequences} onChange={(event) => onChange({ ...quest, consequences: event.target.value })} />
      </label>
    </section>
  );
}

function displayToken(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function defaultRoleForEntity(entity: StoryEntity): GameStoryEntityMetadata["role"] {
  return gameStoryRoleForType(entity.type);
}
