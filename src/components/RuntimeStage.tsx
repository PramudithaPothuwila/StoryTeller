import { ArrowLeft, Download, Plus, Trash2 } from "lucide-react";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  createStoryRuntimeContradictionRule,
  createStoryRuntimeEvidence,
  createStoryRuntimeFact,
  createStoryRuntimeTheoryRule,
  deleteRuntimeEvidenceFromProject,
  deleteRuntimeFactFromProject,
  normalizeStoryRuntimeContradictionRule,
  normalizeStoryRuntimeEvidence,
  normalizeStoryRuntimeFact,
  normalizeStoryRuntimeTheoryRule,
  touchProject
} from "../data/story";
import { createRuntimeBundle } from "../runtime/export";
import {
  Selection,
  StoryEntity,
  StoryProject,
  StoryRuntimeContradictionRule,
  StoryRuntimeEvidence,
  StoryRuntimeEvidenceReliability,
  StoryRuntimeFact,
  StoryRuntimePlayerVisibility,
  StoryRuntimeRuleSeverity,
  StoryRuntimeTheoryRule,
  StoryRuntimeTruthState
} from "../types";
import { CharacterRuntimeFields } from "./CharacterRuntimeFields";

export type RuntimeToolTab = "facts" | "evidence" | "character_knowledge" | "contradictions" | "theory_rules" | "export";

interface RuntimeStageProps {
  project: StoryProject;
  selection: Selection | null;
  onBackToWorkspace: () => void;
  onEntityChange: (id: string, patch: Partial<StoryEntity>) => void;
  onExportRuntime: () => void;
  onProjectChange: (project: StoryProject) => void;
}

const runtimeTabs: Array<{ id: RuntimeToolTab; label: string }> = [
  { id: "facts", label: "Facts" },
  { id: "evidence", label: "Evidence" },
  { id: "character_knowledge", label: "Character Knowledge" },
  { id: "contradictions", label: "Contradictions" },
  { id: "theory_rules", label: "Theory Rules" },
  { id: "export", label: "Export Preview" }
];
const truthStates: StoryRuntimeTruthState[] = ["true", "false", "ambiguous", "unknown"];
const evidenceReliabilityStates: StoryRuntimeEvidenceReliability[] = ["confirmed", "unverified", "misleading"];
const playerVisibilityStates: StoryRuntimePlayerVisibility[] = ["hidden", "discoverable", "revealed"];
const ruleSeverityStates: StoryRuntimeRuleSeverity[] = ["warning", "error"];

export function RuntimeStage({
  project,
  selection,
  onBackToWorkspace,
  onEntityChange,
  onExportRuntime,
  onProjectChange
}: RuntimeStageProps) {
  const [activeTab, setActiveTab] = useState<RuntimeToolTab>("facts");
  const selectedCharacterId =
    selection?.kind === "entity" && project.entities[selection.id]?.type === "character" ? selection.id : "";
  const characters = useMemo(
    () => Object.values(project.entities).filter((entity) => entity.type === "character"),
    [project.entities]
  );
  const [focusedCharacterId, setFocusedCharacterId] = useState(selectedCharacterId || characters[0]?.id || "");
  const activeCharacter =
    project.entities[focusedCharacterId]?.type === "character" ? project.entities[focusedCharacterId] : characters[0];
  const runtimeBundle = useMemo(() => createRuntimeBundle(project), [project]);

  useEffect(() => {
    if (selectedCharacterId) {
      setFocusedCharacterId(selectedCharacterId);
    }
  }, [selectedCharacterId]);

  return (
    <main className="runtime-stage">
      <header className="runtime-stage__header">
        <div>
          <p>Runtime Stage</p>
          <h1>Runtime Tools</h1>
        </div>
        <button type="button" className="text-tool-button" onClick={onBackToWorkspace}>
          <ArrowLeft aria-hidden="true" />
          Workspace
        </button>
      </header>

      <div className="runtime-stage__body">
        <nav className="runtime-stage__tabs segmented-tabs" aria-label="Runtime tabs">
          {runtimeTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "is-active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "facts" ? <FactsTab project={project} onProjectChange={onProjectChange} /> : null}
        {activeTab === "evidence" ? <EvidenceTab project={project} onProjectChange={onProjectChange} /> : null}
        {activeTab === "character_knowledge" ? (
          <CharacterKnowledgeTab
            activeCharacter={activeCharacter}
            characters={characters}
            focusedCharacterId={activeCharacter?.id ?? ""}
            project={project}
            onCharacterFocusChange={setFocusedCharacterId}
            onEntityChange={onEntityChange}
            onProjectChange={onProjectChange}
          />
        ) : null}
        {activeTab === "contradictions" ? (
          <ContradictionsTab project={project} onProjectChange={onProjectChange} />
        ) : null}
        {activeTab === "theory_rules" ? <TheoryRulesTab project={project} onProjectChange={onProjectChange} /> : null}
        {activeTab === "export" ? (
          <ExportPreviewTab runtimeJson={JSON.stringify(runtimeBundle, null, 2)} onExportRuntime={onExportRuntime} />
        ) : null}
      </div>
    </main>
  );
}

function FactsTab({ project, onProjectChange }: { project: StoryProject; onProjectChange: (project: StoryProject) => void }) {
  function handleAddFact() {
    onProjectChange(
      touchProject({
        ...project,
        runtime: {
          ...project.runtime,
          facts: [...project.runtime.facts, createStoryRuntimeFact()]
        }
      })
    );
  }

  function handleFactChange(factId: string, patch: Partial<StoryRuntimeFact>) {
    onProjectChange(
      touchProject({
        ...project,
        runtime: {
          ...project.runtime,
          facts: project.runtime.facts.map((fact) =>
            fact.id === factId ? normalizeStoryRuntimeFact({ ...fact, ...patch, id: fact.id }) : fact
          )
        }
      })
    );
  }

  return (
    <RuntimePanel
      title="Facts"
      empty={!project.runtime.facts.length}
      emptyText="No runtime facts yet."
      action={
        <button type="button" className="text-tool-button" onClick={handleAddFact}>
          <Plus aria-hidden="true" />
          Add Fact
        </button>
      }
    >
      {project.runtime.facts.map((fact) => (
        <FactCard
          key={fact.id}
          fact={fact}
          project={project}
          onChange={(patch) => handleFactChange(fact.id, patch)}
          onDelete={() => onProjectChange(deleteRuntimeFactFromProject(project, fact.id))}
        />
      ))}
    </RuntimePanel>
  );
}

function EvidenceTab({
  project,
  onProjectChange
}: {
  project: StoryProject;
  onProjectChange: (project: StoryProject) => void;
}) {
  function handleAddEvidence() {
    onProjectChange(
      touchProject({
        ...project,
        runtime: {
          ...project.runtime,
          evidence: [...project.runtime.evidence, createStoryRuntimeEvidence()]
        }
      })
    );
  }

  function handleEvidenceChange(evidenceId: string, patch: Partial<StoryRuntimeEvidence>) {
    onProjectChange(
      touchProject({
        ...project,
        runtime: {
          ...project.runtime,
          evidence: project.runtime.evidence.map((evidence) =>
            evidence.id === evidenceId ? normalizeStoryRuntimeEvidence({ ...evidence, ...patch, id: evidence.id }) : evidence
          )
        }
      })
    );
  }

  return (
    <RuntimePanel
      title="Evidence"
      empty={!project.runtime.evidence.length}
      emptyText="No runtime evidence yet."
      action={
        <button type="button" className="text-tool-button" onClick={handleAddEvidence}>
          <Plus aria-hidden="true" />
          Add Evidence
        </button>
      }
    >
      {project.runtime.evidence.map((evidence) => (
        <EvidenceCard
          key={evidence.id}
          evidence={evidence}
          project={project}
          onChange={(patch) => handleEvidenceChange(evidence.id, patch)}
          onDelete={() => onProjectChange(deleteRuntimeEvidenceFromProject(project, evidence.id))}
        />
      ))}
    </RuntimePanel>
  );
}

interface CharacterKnowledgeTabProps {
  activeCharacter?: StoryEntity;
  characters: StoryEntity[];
  focusedCharacterId: string;
  project: StoryProject;
  onCharacterFocusChange: (id: string) => void;
  onEntityChange: (id: string, patch: Partial<StoryEntity>) => void;
  onProjectChange: (project: StoryProject) => void;
}

function CharacterKnowledgeTab({
  activeCharacter,
  characters,
  focusedCharacterId,
  project,
  onCharacterFocusChange,
  onEntityChange,
  onProjectChange
}: CharacterKnowledgeTabProps) {
  if (!characters.length || !activeCharacter) {
    return (
      <RuntimePanel title="Character Knowledge" empty emptyText="Add a character before authoring runtime knowledge." />
    );
  }

  return (
    <section className="runtime-panel">
      <div className="runtime-panel__header">
        <div>
          <p>Selected Character</p>
          <h2>Character Knowledge</h2>
        </div>
        <select
          aria-label="Runtime character"
          value={activeCharacter.id}
          onChange={(event) => onCharacterFocusChange(event.target.value)}
        >
          {characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.title}
            </option>
          ))}
        </select>
      </div>

      <CharacterRuntimeFields
        project={project}
        entity={activeCharacter}
        onEntityChange={(patch) => onEntityChange(activeCharacter.id, patch)}
        onProjectChange={onProjectChange}
      />
    </section>
  );
}

function ContradictionsTab({
  project,
  onProjectChange
}: {
  project: StoryProject;
  onProjectChange: (project: StoryProject) => void;
}) {
  function handleAddRule() {
    onProjectChange(
      touchProject({
        ...project,
        runtime: {
          ...project.runtime,
          contradictionRules: [...project.runtime.contradictionRules, createStoryRuntimeContradictionRule()]
        }
      })
    );
  }

  function handleRuleChange(ruleId: string, patch: Partial<StoryRuntimeContradictionRule>) {
    onProjectChange(
      touchProject({
        ...project,
        runtime: {
          ...project.runtime,
          contradictionRules: project.runtime.contradictionRules.map((rule) =>
            rule.id === ruleId ? normalizeStoryRuntimeContradictionRule({ ...rule, ...patch, id: rule.id }) : rule
          )
        }
      })
    );
  }

  return (
    <RuntimePanel
      title="Contradictions"
      empty={!project.runtime.contradictionRules.length}
      emptyText="No contradiction rules yet."
      action={
        <button type="button" className="text-tool-button" onClick={handleAddRule}>
          <Plus aria-hidden="true" />
          Add Rule
        </button>
      }
    >
      {project.runtime.contradictionRules.map((rule) => (
        <ContradictionRuleCard
          key={rule.id}
          rule={rule}
          project={project}
          onChange={(patch) => handleRuleChange(rule.id, patch)}
          onDelete={() =>
            onProjectChange(
              touchProject({
                ...project,
                runtime: {
                  ...project.runtime,
                  contradictionRules: project.runtime.contradictionRules.filter((candidate) => candidate.id !== rule.id)
                }
              })
            )
          }
        />
      ))}
    </RuntimePanel>
  );
}

function TheoryRulesTab({
  project,
  onProjectChange
}: {
  project: StoryProject;
  onProjectChange: (project: StoryProject) => void;
}) {
  function handleAddRule() {
    onProjectChange(
      touchProject({
        ...project,
        runtime: {
          ...project.runtime,
          theoryRules: [...project.runtime.theoryRules, createStoryRuntimeTheoryRule()]
        }
      })
    );
  }

  function handleRuleChange(ruleId: string, patch: Partial<StoryRuntimeTheoryRule>) {
    onProjectChange(
      touchProject({
        ...project,
        runtime: {
          ...project.runtime,
          theoryRules: project.runtime.theoryRules.map((rule) =>
            rule.id === ruleId ? normalizeStoryRuntimeTheoryRule({ ...rule, ...patch, id: rule.id }) : rule
          )
        }
      })
    );
  }

  return (
    <RuntimePanel
      title="Theory Rules"
      empty={!project.runtime.theoryRules.length}
      emptyText="No theory rules yet."
      action={
        <button type="button" className="text-tool-button" onClick={handleAddRule}>
          <Plus aria-hidden="true" />
          Add Rule
        </button>
      }
    >
      {project.runtime.theoryRules.map((rule) => (
        <TheoryRuleCard
          key={rule.id}
          rule={rule}
          project={project}
          onChange={(patch) => handleRuleChange(rule.id, patch)}
          onDelete={() =>
            onProjectChange(
              touchProject({
                ...project,
                runtime: {
                  ...project.runtime,
                  theoryRules: project.runtime.theoryRules.filter((candidate) => candidate.id !== rule.id)
                }
              })
            )
          }
        />
      ))}
    </RuntimePanel>
  );
}

interface FactCardProps {
  fact: StoryRuntimeFact;
  project: StoryProject;
  onChange: (patch: Partial<StoryRuntimeFact>) => void;
  onDelete: () => void;
}

function FactCard({ fact, project, onChange, onDelete }: FactCardProps) {
  return (
    <article className="runtime-list-card runtime-edit-card">
      <RuntimeCardHeader
        title={fact.statement || "Untitled fact"}
        badge={fact.truth}
        id={fact.id}
        deleteLabel="Delete fact"
        onDelete={onDelete}
      />

      <label className="field-stack">
        Fact statement
        <textarea rows={3} value={fact.statement} onChange={(event) => onChange({ statement: event.target.value })} />
      </label>

      <div className="runtime-edit-grid">
        <label className="field-stack">
          Truth
          <select value={fact.truth} onChange={(event) => onChange({ truth: event.target.value as StoryRuntimeTruthState })}>
            {truthStates.map((truth) => (
              <option key={truth} value={truth}>
                {humanizeRuntimeLabel(truth)}
              </option>
            ))}
          </select>
        </label>

        <EntitySelect
          label="Subject entity"
          project={project}
          value={fact.subjectEntityId ?? ""}
          onChange={(subjectEntityId) => onChange({ subjectEntityId })}
        />

        <EntitySelect
          label="Object entity"
          project={project}
          value={fact.objectEntityId ?? ""}
          onChange={(objectEntityId) => onChange({ objectEntityId })}
        />
      </div>

      <EntityMultiSelect
        label="Source entities"
        project={project}
        value={fact.sourceEntityIds}
        onChange={(sourceEntityIds) => onChange({ sourceEntityIds })}
      />
      <RuntimeSourceSummary ids={fact.sourceEntityIds} project={project} />

      <label className="field-stack">
        Tags
        <input value={fact.tags.join(", ")} onChange={(event) => onChange({ tags: csvToValues(event.target.value) })} />
      </label>

      <label className="field-stack">
        Fact notes
        <textarea rows={3} value={fact.notes} onChange={(event) => onChange({ notes: event.target.value })} />
      </label>

      <label className="field-stack">
        Source notes
        <textarea rows={3} value={fact.sourceNotes} onChange={(event) => onChange({ sourceNotes: event.target.value })} />
      </label>
    </article>
  );
}

interface EvidenceCardProps {
  evidence: StoryRuntimeEvidence;
  project: StoryProject;
  onChange: (patch: Partial<StoryRuntimeEvidence>) => void;
  onDelete: () => void;
}

function EvidenceCard({ evidence, project, onChange, onDelete }: EvidenceCardProps) {
  return (
    <article className="runtime-list-card runtime-edit-card">
      <RuntimeCardHeader
        title={evidence.label || "Untitled evidence"}
        badge={evidence.playerVisibility}
        id={evidence.id}
        deleteLabel="Delete evidence"
        onDelete={onDelete}
      />

      <label className="field-stack">
        Evidence label
        <input value={evidence.label} onChange={(event) => onChange({ label: event.target.value })} />
      </label>

      <label className="field-stack">
        Evidence description
        <textarea rows={3} value={evidence.description} onChange={(event) => onChange({ description: event.target.value })} />
      </label>

      <div className="runtime-edit-grid">
        <EntitySelect
          label="Evidence entity"
          project={project}
          value={evidence.entityId ?? ""}
          onChange={(entityId) => onChange({ entityId })}
        />

        <label className="field-stack">
          Reliability
          <select
            value={evidence.reliability}
            onChange={(event) => onChange({ reliability: event.target.value as StoryRuntimeEvidenceReliability })}
          >
            {evidenceReliabilityStates.map((reliability) => (
              <option key={reliability} value={reliability}>
                {humanizeRuntimeLabel(reliability)}
              </option>
            ))}
          </select>
        </label>

        <label className="field-stack">
          Player visibility
          <select
            value={evidence.playerVisibility}
            onChange={(event) => onChange({ playerVisibility: event.target.value as StoryRuntimePlayerVisibility })}
          >
            {playerVisibilityStates.map((visibility) => (
              <option key={visibility} value={visibility}>
                {humanizeRuntimeLabel(visibility)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <FactMultiSelect
        label="Linked facts"
        project={project}
        value={evidence.factIds}
        onChange={(factIds) => onChange({ factIds })}
      />

      <EntityMultiSelect
        label="Discovered by characters"
        project={project}
        value={evidence.discoveredByCharacterIds}
        filter={(entity) => entity.type === "character"}
        onChange={(discoveredByCharacterIds) => onChange({ discoveredByCharacterIds })}
      />

      <EntityMultiSelect
        label="Source entities"
        project={project}
        value={evidence.sourceEntityIds}
        onChange={(sourceEntityIds) => onChange({ sourceEntityIds })}
      />
      <RuntimeSourceSummary ids={evidence.sourceEntityIds} project={project} />

      <label className="field-stack">
        Evidence notes
        <textarea rows={3} value={evidence.notes} onChange={(event) => onChange({ notes: event.target.value })} />
      </label>

      <label className="field-stack">
        Source notes
        <textarea rows={3} value={evidence.sourceNotes} onChange={(event) => onChange({ sourceNotes: event.target.value })} />
      </label>
    </article>
  );
}

interface ContradictionRuleCardProps {
  rule: StoryRuntimeContradictionRule;
  project: StoryProject;
  onChange: (patch: Partial<StoryRuntimeContradictionRule>) => void;
  onDelete: () => void;
}

function ContradictionRuleCard({ rule, project, onChange, onDelete }: ContradictionRuleCardProps) {
  return (
    <article className="runtime-list-card runtime-edit-card">
      <RuntimeCardHeader
        title={rule.label || "Untitled contradiction"}
        badge={rule.severity}
        id={rule.id}
        deleteLabel="Delete contradiction rule"
        onDelete={onDelete}
      />

      <label className="field-stack">
        Contradiction label
        <input value={rule.label} onChange={(event) => onChange({ label: event.target.value })} />
      </label>

      <FactMultiSelect
        label="Contradicting facts"
        project={project}
        value={rule.factIds}
        onChange={(factIds) => onChange({ factIds })}
      />

      <label className="field-stack">
        Severity
        <select value={rule.severity} onChange={(event) => onChange({ severity: event.target.value as StoryRuntimeRuleSeverity })}>
          {ruleSeverityStates.map((severity) => (
            <option key={severity} value={severity}>
              {humanizeRuntimeLabel(severity)}
            </option>
          ))}
        </select>
      </label>

      <label className="field-stack">
        Resolution
        <textarea rows={3} value={rule.resolution} onChange={(event) => onChange({ resolution: event.target.value })} />
      </label>

      <label className="field-stack">
        Rule notes
        <textarea rows={3} value={rule.notes} onChange={(event) => onChange({ notes: event.target.value })} />
      </label>
    </article>
  );
}

interface TheoryRuleCardProps {
  rule: StoryRuntimeTheoryRule;
  project: StoryProject;
  onChange: (patch: Partial<StoryRuntimeTheoryRule>) => void;
  onDelete: () => void;
}

function TheoryRuleCard({ rule, project, onChange, onDelete }: TheoryRuleCardProps) {
  return (
    <article className="runtime-list-card runtime-edit-card">
      <RuntimeCardHeader
        title={rule.label || "Untitled theory rule"}
        badge={rule.playerVisibility}
        id={rule.id}
        deleteLabel="Delete theory rule"
        onDelete={onDelete}
      />

      <label className="field-stack">
        Theory label
        <input value={rule.label} onChange={(event) => onChange({ label: event.target.value })} />
      </label>

      <EvidenceMultiSelect
        label="Required evidence"
        project={project}
        value={rule.requiredEvidenceIds}
        onChange={(requiredEvidenceIds) => onChange({ requiredEvidenceIds })}
      />

      <div className="runtime-edit-grid">
        <FactMultiSelect
          label="Supporting facts"
          project={project}
          value={rule.supportingFactIds}
          onChange={(supportingFactIds) => onChange({ supportingFactIds })}
        />
        <FactMultiSelect
          label="Contradicting facts"
          project={project}
          value={rule.contradictingFactIds}
          onChange={(contradictingFactIds) => onChange({ contradictingFactIds })}
        />
      </div>

      <label className="field-stack">
        Conclusion
        <textarea rows={3} value={rule.conclusion} onChange={(event) => onChange({ conclusion: event.target.value })} />
      </label>

      <label className="field-stack">
        Player visibility
        <select
          value={rule.playerVisibility}
          onChange={(event) => onChange({ playerVisibility: event.target.value as StoryRuntimePlayerVisibility })}
        >
          {playerVisibilityStates.map((visibility) => (
            <option key={visibility} value={visibility}>
              {humanizeRuntimeLabel(visibility)}
            </option>
          ))}
        </select>
      </label>

      <label className="field-stack">
        Rule notes
        <textarea rows={3} value={rule.notes} onChange={(event) => onChange({ notes: event.target.value })} />
      </label>
    </article>
  );
}

function RuntimeCardHeader({
  badge,
  deleteLabel,
  id,
  onDelete,
  title
}: {
  badge: string;
  deleteLabel: string;
  id: string;
  onDelete: () => void;
  title: string;
}) {
  return (
    <div className="runtime-list-card__header">
      <div>
        <strong>{title}</strong>
        <small>{id}</small>
      </div>
      <div className="runtime-card-actions">
        <span>{humanizeRuntimeLabel(badge)}</span>
        <button type="button" className="icon-button danger" aria-label={deleteLabel} onClick={onDelete}>
          <Trash2 aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

interface EntitySelectProps {
  label: string;
  project: StoryProject;
  value: string;
  onChange: (value: string) => void;
}

function EntitySelect({ label, project, value, onChange }: EntitySelectProps) {
  return (
    <label className="field-stack">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">No entity selected</option>
        {Object.values(project.entities)
          .sort(compareEntityTitles)
          .map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entityLabel(entity)}
            </option>
          ))}
      </select>
    </label>
  );
}

interface EntityMultiSelectProps {
  filter?: (entity: StoryEntity) => boolean;
  label: string;
  project: StoryProject;
  value: string[];
  onChange: (value: string[]) => void;
}

function EntityMultiSelect({ filter, label, project, value, onChange }: EntityMultiSelectProps) {
  const entities = Object.values(project.entities).filter(filter ?? (() => true)).sort(compareEntityTitles);

  return (
    <label className="field-stack">
      {label}
      <select multiple value={value} onChange={(event) => onChange(selectedValues(event.currentTarget))}>
        {entities.map((entity) => (
          <option key={entity.id} value={entity.id}>
            {entityLabel(entity)}
          </option>
        ))}
      </select>
    </label>
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
      <select multiple value={value} onChange={(event) => onChange(selectedValues(event.currentTarget))}>
        {project.runtime.facts.map((fact) => (
          <option key={fact.id} value={fact.id}>
            {fact.statement ? `${fact.statement} (${fact.id})` : fact.id}
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
      <select multiple value={value} onChange={(event) => onChange(selectedValues(event.currentTarget))}>
        {project.runtime.evidence.map((evidence) => (
          <option key={evidence.id} value={evidence.id}>
            {evidence.label ? `${evidence.label} (${evidence.id})` : evidence.id}
          </option>
        ))}
      </select>
    </label>
  );
}

function RuntimeSourceSummary({ ids, project }: { ids: string[]; project: StoryProject }) {
  if (!ids.length) {
    return <p className="runtime-source-summary">No source entities linked.</p>;
  }

  return (
    <p className="runtime-source-summary">
      Sources:{" "}
      {ids
        .map((id) => {
          const entity = project.entities[id];
          return entity ? entity.title : `Missing source: ${id}`;
        })
        .join(", ")}
    </p>
  );
}

function ExportPreviewTab({ runtimeJson, onExportRuntime }: { runtimeJson: string; onExportRuntime: () => void }) {
  return (
    <section className="runtime-panel">
      <div className="runtime-panel__header">
        <div>
          <p>Runtime Bundle</p>
          <h2>Export Preview</h2>
        </div>
        <button type="button" className="text-tool-button" onClick={onExportRuntime}>
          <Download aria-hidden="true" />
          Export Runtime
        </button>
      </div>
      <pre className="runtime-export-preview">{runtimeJson}</pre>
    </section>
  );
}

interface RuntimePanelProps {
  action?: ReactNode;
  children?: ReactNode;
  empty: boolean;
  emptyText: string;
  title: string;
}

function RuntimePanel({ action, children, empty, emptyText, title }: RuntimePanelProps) {
  return (
    <section className="runtime-panel">
      <div className="runtime-panel__header">
        <div>
          <p>Runtime Data</p>
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {empty ? <p className="runtime-empty">{emptyText}</p> : <div className="runtime-list">{children}</div>}
    </section>
  );
}

function compareEntityTitles(first: StoryEntity, second: StoryEntity): number {
  return first.title.localeCompare(second.title) || first.id.localeCompare(second.id);
}

function csvToValues(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function entityLabel(entity: StoryEntity): string {
  return `${entity.title} (${entity.type})`;
}

function humanizeRuntimeLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function selectedValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions, (option) => option.value).filter(Boolean);
}
