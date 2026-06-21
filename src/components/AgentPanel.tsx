import { Bot, CheckCircle2, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  AgentChangePlan,
  applyAgentChangePlan,
  parseAgentResponsePayload,
  validateAgentChangePlan
} from "../data/agent";
import type { AgentMode } from "../data/agent";
import { requestAgentPlan } from "../data/cloudProjects";
import { Selection, StoryProject } from "../types";

interface AgentPanelProps {
  project: StoryProject;
  onClose: () => void;
  onProjectChange: (project: StoryProject) => void;
  onSelectEntity: (id: string) => void;
  onSelectRelationship: (id: string) => void;
  onStatusChange: (status: string) => void;
}

export function AgentPanel({
  project,
  onClose,
  onProjectChange,
  onSelectEntity,
  onSelectRelationship,
  onStatusChange
}: AgentPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<AgentChangePlan | null>(null);
  const [runtimeAuthoring, setRuntimeAuthoring] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const validation = useMemo(() => (plan ? validateAgentChangePlan(project, plan) : []), [plan, project]);
  const invalidChangeCount = validation.filter((item) => item.errors.length).length;

  async function requestPlan() {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      setError("Describe what you want the agent to help with.");
      return;
    }

    setIsLoading(true);
    setError("");
    setPlan(null);
    onStatusChange("Agent thinking...");

    try {
      const mode: AgentMode = runtimeAuthoring ? "runtime_authoring" : "story";
      const nextPlan = parseAgentResponsePayload(await requestAgentPlan(project, cleanPrompt, { mode }));
      setPlan(nextPlan);
      onStatusChange("Agent plan ready");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Agent request failed";
      setError(message);
      onStatusChange("Agent request failed");
    } finally {
      setIsLoading(false);
    }
  }

  function applyPlan() {
    if (!plan || invalidChangeCount) {
      return;
    }

    try {
      const result = applyAgentChangePlan(project, plan);
      onProjectChange(result.project);
      selectFirstChangedItem(result.changedEntityIds, result.changedRelationshipIds, onSelectEntity, onSelectRelationship);
      setPlan(null);
      setPrompt("");
      setError("");
      onStatusChange("Agent changes applied");
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Could not apply agent changes");
    }
  }

  return (
    <aside className="agent-panel" aria-label="AI Agent">
      <header className="agent-panel__header">
        <div>
          <p>AI Agent</p>
          <h2>Story Agent</h2>
        </div>
        <button type="button" className="icon-button" aria-label="Close AI Agent" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>

      <div className="agent-panel__body">
        <section className="agent-section">
          <div className="agent-section__heading">
            <Bot aria-hidden="true" />
            <h3>Prompt</h3>
          </div>
          <textarea
            rows={6}
            value={prompt}
            placeholder={
              runtimeAuthoring
                ? "Ask the agent to create, update, or delete runtime facts, evidence, knowledge rows, contradictions, or theory rules."
                : "Ask for focused story structure changes, new entities, timeline effects, or game-story updates."
            }
            onChange={(event) => setPrompt(event.target.value)}
          />
          <label className="agent-mode-toggle">
            <input
              type="checkbox"
              checked={runtimeAuthoring}
              onChange={(event) => setRuntimeAuthoring(event.target.checked)}
            />
            <span>Runtime authoring</span>
          </label>
          {runtimeAuthoring ? (
            <p className="agent-compat-note">
              Runtime authoring sends expanded story context and lets the agent propose CRUD changes for runtime data only.
            </p>
          ) : null}
          <button type="button" className="primary-action" disabled={isLoading} onClick={() => void requestPlan()}>
            <Send aria-hidden="true" />
            {isLoading ? "Thinking..." : "Ask Agent"}
          </button>
          {error ? <p className="agent-error">{error}</p> : null}
        </section>

        {plan ? (
          <section className="agent-section agent-plan">
            <div className="agent-section__heading">
              <CheckCircle2 aria-hidden="true" />
              <h3>Review Plan</h3>
            </div>
            <p className="agent-plan__summary">{plan.summary}</p>

            {plan.assumptions.length ? (
              <div className="agent-note-list">
                <strong>Assumptions</strong>
                {plan.assumptions.map((assumption) => (
                  <span key={assumption}>{assumption}</span>
                ))}
              </div>
            ) : null}

            <div className="agent-change-list">
              {validation.map(({ change, errors, index }) => (
                <article key={`${change.operation}-${index}`} className={errors.length ? "agent-change is-invalid" : "agent-change"}>
                  <small>{displayOperation(change.operation)}</small>
                  <strong>{change.summary}</strong>
                  <span>{changeTargetLabel(change)}</span>
                  {errors.length ? (
                    <div className="agent-change__errors">
                      {errors.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            {plan.followUpQuestions.length ? (
              <div className="agent-note-list">
                <strong>Follow-up</strong>
                {plan.followUpQuestions.map((question) => (
                  <span key={question}>{question}</span>
                ))}
              </div>
            ) : null}

            <button type="button" className="primary-action" disabled={Boolean(invalidChangeCount)} onClick={applyPlan}>
              <CheckCircle2 aria-hidden="true" />
              Apply {plan.changes.length} {plan.changes.length === 1 ? "Change" : "Changes"}
            </button>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

function selectFirstChangedItem(
  entityIds: string[],
  relationshipIds: string[],
  onSelectEntity: (id: string) => void,
  onSelectRelationship: (id: string) => void
) {
  const selection: Selection | null = entityIds[0]
    ? { kind: "entity", id: entityIds[0] }
    : relationshipIds[0]
      ? { kind: "relationship", id: relationshipIds[0] }
      : null;

  if (selection?.kind === "entity") {
    onSelectEntity(selection.id);
  }

  if (selection?.kind === "relationship") {
    onSelectRelationship(selection.id);
  }
}

function changeTargetLabel(change: AgentChangePlan["changes"][number]): string {
  if (change.operation === "create_entity") {
    return `${change.entity.title} (${change.entity.type})`;
  }

  if (change.operation === "update_entity") {
    return change.id;
  }

  if (change.operation === "create_relationship") {
    return `${change.relationship.sourceId} -> ${change.relationship.targetId}`;
  }

  if (change.operation === "update_relationship") {
    return change.id;
  }

  if (change.operation === "add_timeline_effect") {
    return change.eventId;
  }

  if (change.operation === "update_game_story") {
    return "Game story settings";
  }

  if (change.operation === "create_runtime_fact") return `Fact: ${change.fact.id}`;
  if (change.operation === "update_runtime_fact" || change.operation === "delete_runtime_fact") return `Fact: ${change.id}`;

  if (change.operation === "create_runtime_evidence") return `Evidence: ${change.evidence.id}`;
  if (change.operation === "update_runtime_evidence" || change.operation === "delete_runtime_evidence") {
    return `Evidence: ${change.id}`;
  }

  if (change.operation === "create_runtime_character_knowledge") return `Knowledge: ${change.knowledge.id}`;
  if (
    change.operation === "update_runtime_character_knowledge" ||
    change.operation === "delete_runtime_character_knowledge"
  ) {
    return `Knowledge: ${change.id}`;
  }

  if (change.operation === "create_runtime_contradiction") return `Contradiction: ${change.contradiction.id}`;
  if (change.operation === "update_runtime_contradiction" || change.operation === "delete_runtime_contradiction") {
    return `Contradiction: ${change.id}`;
  }

  if (change.operation === "create_runtime_theory_rule") return `Theory Rule: ${change.theoryRule.id}`;
  if (change.operation === "update_runtime_theory_rule" || change.operation === "delete_runtime_theory_rule") {
    return `Theory Rule: ${change.id}`;
  }

  return "Game story settings";
}

function displayOperation(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
