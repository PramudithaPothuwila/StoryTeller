import { Plus, Trash2 } from "lucide-react";
import {
  characterRuntimeDeceptionStrategies,
  createCharacterRuntimeDeceptionRule,
  createCharacterRuntimeDisclosureRule,
  normalizeCharacterRuntimeMetadata,
  normalizeStoryRuntimeCharacterKnowledge,
  touchProject
} from "../data/story";
import {
  CharacterRuntimeDeceptionRule,
  CharacterRuntimeDisclosureRule,
  CharacterRuntimeMetadata,
  StoryEntity,
  StoryProject,
  StoryRuntimeBeliefState,
  StoryRuntimeCharacterKnowledge,
  StoryRuntimeKnowledgeState
} from "../types";

interface CharacterRuntimeFieldsProps {
  entity: StoryEntity;
  project: StoryProject;
  onEntityChange: (patch: Partial<StoryEntity>) => void;
  onProjectChange: (project: StoryProject) => void;
}

const knowledgeStates: StoryRuntimeKnowledgeState[] = ["knows", "suspects", "does_not_know"];
const beliefStates: StoryRuntimeBeliefState[] = ["believes_true", "believes_false", "uncertain", "unaware"];

export function CharacterRuntimeFields({
  entity,
  project,
  onEntityChange,
  onProjectChange
}: CharacterRuntimeFieldsProps) {
  const metadata = normalizeCharacterRuntimeMetadata(entity.runtimeCharacter);
  const characterKnowledge = project.runtime.characterKnowledge.filter(
    (knowledge) => knowledge.characterId === entity.id
  );

  function handleMetadataChange(patch: Partial<CharacterRuntimeMetadata>) {
    onEntityChange({
      runtimeCharacter: normalizeCharacterRuntimeMetadata({
        ...metadata,
        ...patch
      })
    });
  }

  function handleKnowledgeChange(knowledgeId: string, patch: Partial<StoryRuntimeCharacterKnowledge>) {
    onProjectChange(touchProject({
      ...project,
      runtime: {
        ...project.runtime,
        characterKnowledge: project.runtime.characterKnowledge.map((knowledge) =>
          knowledge.id === knowledgeId
            ? normalizeStoryRuntimeCharacterKnowledge({
                ...knowledge,
                ...patch,
                characterId: entity.id,
                updatedAt: new Date().toISOString()
              })
            : knowledge
          )
      }
    }));
  }

  function handleAddKnowledge() {
    const firstFactId = project.runtime.facts[0]?.id ?? "";

    onProjectChange(touchProject({
      ...project,
      runtime: {
        ...project.runtime,
        characterKnowledge: [
          ...project.runtime.characterKnowledge,
          normalizeStoryRuntimeCharacterKnowledge({
            characterId: entity.id,
            factId: firstFactId,
            knowledge: firstFactId ? "knows" : "does_not_know",
            belief: firstFactId ? "believes_true" : "unaware",
            notes: ""
          })
        ]
      }
    }));
  }

  function handleDeleteKnowledge(knowledgeId: string) {
    onProjectChange(touchProject({
      ...project,
      runtime: {
        ...project.runtime,
        characterKnowledge: project.runtime.characterKnowledge.filter((knowledge) => knowledge.id !== knowledgeId)
      }
    }));
  }

  function handleDeceptionRuleChange(ruleId: string, patch: Partial<CharacterRuntimeDeceptionRule>) {
    handleMetadataChange({
      deceptionRules: metadata.deceptionRules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...patch } : rule
      )
    });
  }

  function handleDisclosureRuleChange(ruleId: string, patch: Partial<CharacterRuntimeDisclosureRule>) {
    handleMetadataChange({
      disclosureRules: metadata.disclosureRules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...patch } : rule
      )
    });
  }

  return (
    <section className="character-runtime-fields">
      <h2>Character Knowledge &amp; Belief</h2>

      <label className="field-stack">
        Character goals
        <textarea
          rows={3}
          value={metadata.goals.join("\n")}
          onChange={(event) => handleMetadataChange({ goals: linesFromText(event.target.value) })}
        />
      </label>

      <div className="character-runtime-fields__grid">
        <label className="field-stack">
          Character attitude
          <input
            type="number"
            min={-100}
            max={100}
            value={metadata.attitude}
            onChange={(event) => handleMetadataChange({ attitude: Number(event.target.value) || 0 })}
          />
        </label>

        <label className="field-stack">
          Attitude slider
          <input
            aria-label="Character attitude slider"
            type="range"
            min={-100}
            max={100}
            value={metadata.attitude}
            onChange={(event) => handleMetadataChange({ attitude: Number(event.target.value) || 0 })}
          />
        </label>
      </div>

      <label className="field-stack">
        Emotional state
        <input
          value={metadata.emotionalState}
          onChange={(event) => handleMetadataChange({ emotionalState: event.target.value })}
        />
      </label>

      <label className="field-stack">
        Communication style
        <textarea
          rows={3}
          value={metadata.communicationStyle}
          onChange={(event) => handleMetadataChange({ communicationStyle: event.target.value })}
        />
      </label>

      <div className="character-runtime-fields__grid">
        <FactMultiSelect
          label="Known fact IDs"
          value={metadata.knownFactIds}
          project={project}
          onChange={(knownFactIds) => handleMetadataChange({ knownFactIds })}
        />
        <FactMultiSelect
          label="Believed fact IDs"
          value={metadata.believedFactIds}
          project={project}
          onChange={(believedFactIds) => handleMetadataChange({ believedFactIds })}
        />
      </div>

      <FactMultiSelect
        label="Hidden fact IDs"
        value={metadata.hiddenFactIds}
        project={project}
        onChange={(hiddenFactIds) => handleMetadataChange({ hiddenFactIds })}
      />

      <section className="game-subsection">
        <div className="game-subsection__header">
          <h3>Knowledge Rows</h3>
          <button type="button" className="text-tool-button" onClick={handleAddKnowledge}>
            <Plus aria-hidden="true" />
            Knowledge
          </button>
        </div>

        {characterKnowledge.length ? (
          <div className="runtime-rule-list">
            {characterKnowledge.map((knowledge) => (
              <KnowledgeRow
                key={knowledge.id}
                knowledge={knowledge}
                project={project}
                onChange={(patch) => handleKnowledgeChange(knowledge.id, patch)}
                onDelete={() => handleDeleteKnowledge(knowledge.id)}
              />
            ))}
          </div>
        ) : (
          <p className="game-empty-note">No knowledge rows yet.</p>
        )}
      </section>

      <section className="game-subsection">
        <div className="game-subsection__header">
          <h3>Deception Rules</h3>
          <button
            type="button"
            className="text-tool-button"
            onClick={() => handleMetadataChange({ deceptionRules: [...metadata.deceptionRules, createCharacterRuntimeDeceptionRule()] })}
          >
            <Plus aria-hidden="true" />
            Rule
          </button>
        </div>

        {metadata.deceptionRules.length ? (
          <div className="runtime-rule-list">
            {metadata.deceptionRules.map((rule) => (
              <DeceptionRuleCard
                key={rule.id}
                project={project}
                rule={rule}
                onChange={(patch) => handleDeceptionRuleChange(rule.id, patch)}
                onDelete={() =>
                  handleMetadataChange({
                    deceptionRules: metadata.deceptionRules.filter((candidate) => candidate.id !== rule.id)
                  })
                }
              />
            ))}
          </div>
        ) : (
          <p className="game-empty-note">No deception rules yet.</p>
        )}
      </section>

      <section className="game-subsection">
        <div className="game-subsection__header">
          <h3>Disclosure Rules</h3>
          <button
            type="button"
            className="text-tool-button"
            onClick={() => handleMetadataChange({ disclosureRules: [...metadata.disclosureRules, createCharacterRuntimeDisclosureRule()] })}
          >
            <Plus aria-hidden="true" />
            Rule
          </button>
        </div>

        {metadata.disclosureRules.length ? (
          <div className="runtime-rule-list">
            {metadata.disclosureRules.map((rule) => (
              <DisclosureRuleCard
                key={rule.id}
                project={project}
                rule={rule}
                onChange={(patch) => handleDisclosureRuleChange(rule.id, patch)}
                onDelete={() =>
                  handleMetadataChange({
                    disclosureRules: metadata.disclosureRules.filter((candidate) => candidate.id !== rule.id)
                  })
                }
              />
            ))}
          </div>
        ) : (
          <p className="game-empty-note">No disclosure rules yet.</p>
        )}
      </section>
    </section>
  );
}

interface FactMultiSelectProps {
  label: string;
  project: StoryProject;
  value: string[];
  onChange: (value: string[]) => void;
}

function FactMultiSelect({ label, project, value, onChange }: FactMultiSelectProps) {
  return (
    <label className="field-stack">
      {label}
      <select
        multiple
        value={value}
        onChange={(event) => onChange(selectedValues(event.currentTarget))}
      >
        {project.runtime.facts.map((fact) => (
          <option key={fact.id} value={fact.id}>
            {factLabel(fact.id, fact.statement)}
          </option>
        ))}
      </select>
    </label>
  );
}

interface EvidenceMultiSelectProps {
  label: string;
  project: StoryProject;
  value: string[];
  onChange: (value: string[]) => void;
}

function EvidenceMultiSelect({ label, project, value, onChange }: EvidenceMultiSelectProps) {
  return (
    <label className="field-stack">
      {label}
      <select
        multiple
        value={value}
        onChange={(event) => onChange(selectedValues(event.currentTarget))}
      >
        {project.runtime.evidence.map((evidence) => (
          <option key={evidence.id} value={evidence.id}>
            {factLabel(evidence.id, evidence.label)}
          </option>
        ))}
      </select>
    </label>
  );
}

interface KnowledgeRowProps {
  knowledge: StoryRuntimeCharacterKnowledge;
  project: StoryProject;
  onChange: (patch: Partial<StoryRuntimeCharacterKnowledge>) => void;
  onDelete: () => void;
}

function KnowledgeRow({ knowledge, project, onChange, onDelete }: KnowledgeRowProps) {
  return (
    <div className="runtime-rule-card">
      <div className="game-card-heading">
        <strong>Knowledge</strong>
        <button type="button" className="icon-button danger" aria-label="Delete knowledge row" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
        </button>
      </div>

      <label className="field-stack">
        Fact
        <select value={knowledge.factId} onChange={(event) => onChange({ factId: event.target.value })}>
          <option value="">No fact selected</option>
          {project.runtime.facts.map((fact) => (
            <option key={fact.id} value={fact.id}>
              {factLabel(fact.id, fact.statement)}
            </option>
          ))}
        </select>
      </label>

      <div className="character-runtime-fields__grid">
        <label className="field-stack">
          Knowledge state
          <select
            value={knowledge.knowledge}
            onChange={(event) => onChange({ knowledge: event.target.value as StoryRuntimeKnowledgeState })}
          >
            {knowledgeStates.map((state) => (
              <option key={state} value={state}>
                {humanizeState(state)}
              </option>
            ))}
          </select>
        </label>

        <label className="field-stack">
          Belief state
          <select
            value={knowledge.belief}
            onChange={(event) => onChange({ belief: event.target.value as StoryRuntimeBeliefState })}
          >
            {beliefStates.map((state) => (
              <option key={state} value={state}>
                {humanizeState(state)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <EvidenceMultiSelect
        label="Evidence IDs"
        value={knowledge.evidenceIds}
        project={project}
        onChange={(evidenceIds) => onChange({ evidenceIds })}
      />

      <label className="field-stack">
        Knowledge notes
        <textarea rows={3} value={knowledge.notes} onChange={(event) => onChange({ notes: event.target.value })} />
      </label>
    </div>
  );
}

interface DeceptionRuleCardProps {
  project: StoryProject;
  rule: CharacterRuntimeDeceptionRule;
  onChange: (patch: Partial<CharacterRuntimeDeceptionRule>) => void;
  onDelete: () => void;
}

function DeceptionRuleCard({ project, rule, onChange, onDelete }: DeceptionRuleCardProps) {
  return (
    <div className="runtime-rule-card">
      <div className="game-card-heading">
        <strong>Deception</strong>
        <button type="button" className="icon-button danger" aria-label="Delete deception rule" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
        </button>
      </div>

      <label className="field-stack">
        Deception condition
        <input value={rule.condition} onChange={(event) => onChange({ condition: event.target.value })} />
      </label>

      <label className="field-stack">
        Deception goal
        <input value={rule.deceptionGoal} onChange={(event) => onChange({ deceptionGoal: event.target.value })} />
      </label>

      <label className="field-stack">
        Allowed strategies
        <select
          multiple
          value={rule.allowedStrategies}
          onChange={(event) => onChange({ allowedStrategies: selectedValues(event.currentTarget) as CharacterRuntimeDeceptionRule["allowedStrategies"] })}
        >
          {characterRuntimeDeceptionStrategies.map((strategy) => (
            <option key={strategy} value={strategy}>
              {humanizeState(strategy)}
            </option>
          ))}
        </select>
      </label>

      <FactMultiSelect
        label="Forbidden fact IDs"
        value={rule.forbiddenFactIds}
        project={project}
        onChange={(forbiddenFactIds) => onChange({ forbiddenFactIds })}
      />

      <EvidenceMultiSelect
        label="Reveal when evidence IDs"
        value={rule.revealWhenEvidenceIds}
        project={project}
        onChange={(revealWhenEvidenceIds) => onChange({ revealWhenEvidenceIds })}
      />

      <label className="field-stack">
        Deception notes
        <textarea rows={3} value={rule.notes} onChange={(event) => onChange({ notes: event.target.value })} />
      </label>
    </div>
  );
}

interface DisclosureRuleCardProps {
  project: StoryProject;
  rule: CharacterRuntimeDisclosureRule;
  onChange: (patch: Partial<CharacterRuntimeDisclosureRule>) => void;
  onDelete: () => void;
}

function DisclosureRuleCard({ project, rule, onChange, onDelete }: DisclosureRuleCardProps) {
  return (
    <div className="runtime-rule-card">
      <div className="game-card-heading">
        <strong>Disclosure</strong>
        <button type="button" className="icon-button danger" aria-label="Delete disclosure rule" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
        </button>
      </div>

      <label className="field-stack">
        Disclosure condition
        <input value={rule.condition} onChange={(event) => onChange({ condition: event.target.value })} />
      </label>

      <FactMultiSelect
        label="Reveal fact IDs"
        value={rule.revealFactIds}
        project={project}
        onChange={(revealFactIds) => onChange({ revealFactIds })}
      />

      <EvidenceMultiSelect
        label="Required evidence IDs"
        value={rule.requiredEvidenceIds}
        project={project}
        onChange={(requiredEvidenceIds) => onChange({ requiredEvidenceIds })}
      />

      <label className="field-stack">
        Audience
        <input value={rule.audience} onChange={(event) => onChange({ audience: event.target.value })} />
      </label>

      <label className="field-stack">
        Disclosure notes
        <textarea rows={3} value={rule.notes} onChange={(event) => onChange({ notes: event.target.value })} />
      </label>
    </div>
  );
}

function selectedValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions, (option) => option.value).filter(Boolean);
}

function linesFromText(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function factLabel(id: string, label: string): string {
  return label ? `${label} (${id})` : id;
}

function humanizeState(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
