import { Crosshair, Plus, ScrollText, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { defaultWorldRuleMetadata, worldRuleDomainPresets, worldRuleStatusPresets } from "../data/story";
import { BUILT_IN_WORLD_RULE_TYPE_ID, StoryEntity, StoryProject } from "../types";
import { WorldRuleFields } from "./WorldRuleFields";

interface RulebookSidebarProps {
  project: StoryProject;
  onClose: () => void;
  onCreateRule: () => string;
  onDeleteRule: (id: string) => void;
  onFocusRule: (id: string) => void;
  onRuleChange: (id: string, patch: Partial<StoryEntity>) => void;
}

interface RuleGroup {
  key: string;
  rules: StoryEntity[];
}

const BLANK_FILTER_VALUE = "__blank";

export function RulebookSidebar({
  project,
  onClose,
  onCreateRule,
  onDeleteRule,
  onFocusRule,
  onRuleChange
}: RulebookSidebarProps) {
  const rules = useMemo(
    () =>
      Object.values(project.entities)
        .filter((entity) => entity.type === BUILT_IN_WORLD_RULE_TYPE_ID)
        .sort((a, b) => ruleSortKey(a).localeCompare(ruleSortKey(b))),
    [project.entities]
  );
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(() => rules[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    setSelectedRuleId((currentRuleId) => {
      if (!rules.length) {
        return null;
      }

      return currentRuleId && rules.some((rule) => rule.id === currentRuleId) ? currentRuleId : rules[0].id;
    });
  }, [rules]);

  const filteredRules = useMemo(
    () => rules.filter((rule) => matchesRuleFilters(rule, search, domainFilter, statusFilter)),
    [domainFilter, rules, search, statusFilter]
  );
  const groupedRules = useMemo(() => groupRules(filteredRules), [filteredRules]);
  const domainOptions = useMemo(() => buildFilterOptions(worldRuleDomainPresets, rules.map((rule) => ruleWorldRule(rule).domain), "Unsorted"), [rules]);
  const statusOptions = useMemo(() => buildFilterOptions(worldRuleStatusPresets, rules.map((rule) => ruleWorldRule(rule).status), "No Status"), [rules]);
  const selectedRule = selectedRuleId ? project.entities[selectedRuleId] ?? null : null;

  function handleCreateRule() {
    setSelectedRuleId(onCreateRule());
  }

  function handleDeleteRule() {
    if (!selectedRule) {
      return;
    }

    const nextRule = rules.find((rule) => rule.id !== selectedRule.id) ?? null;
    setSelectedRuleId(nextRule?.id ?? null);
    onDeleteRule(selectedRule.id);
  }

  return (
    <aside className="rulebook-sidebar-panel" aria-label="Rulebook">
      <header className="rulebook-sidebar-panel__header">
        <div>
          <p>Worldbuilding</p>
          <h2>Rulebook</h2>
        </div>
        <button type="button" className="icon-button" aria-label="Close rulebook" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>

      <div className="rulebook-sidebar-panel__actions">
        <button type="button" className="primary-action" onClick={handleCreateRule}>
          <Plus aria-hidden="true" />
          New Rule
        </button>
      </div>

      <div className="rulebook-filters">
        <label className="search-box">
          <Search aria-hidden="true" />
          <input
            aria-label="Rulebook search"
            value={search}
            placeholder="Search"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <select
          aria-label="Filter rules by domain"
          value={domainFilter}
          onChange={(event) => setDomainFilter(event.target.value)}
        >
          <option value="">All Domains</option>
          {domainOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter rules by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All Statuses</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rulebook-rule-list">
        {groupedRules.length ? (
          groupedRules.map((group) => (
            <section key={group.key} className="rulebook-rule-group">
              <h3>{group.key}</h3>
              {group.rules.map((rule) => {
                const worldRule = ruleWorldRule(rule);

                return (
                  <button
                    key={rule.id}
                    type="button"
                    className={selectedRuleId === rule.id ? "is-selected" : ""}
                    onClick={() => setSelectedRuleId(rule.id)}
                  >
                    <strong>{rule.title}</strong>
                    <span>{worldRule.statement || rule.summary || "No statement yet."}</span>
                  </button>
                );
              })}
            </section>
          ))
        ) : (
          <p className="rulebook-empty">No rules</p>
        )}
      </div>

      <section className="rulebook-detail">
        {selectedRule ? (
          <>
            <div className="rulebook-detail__header">
              <div>
                <ScrollText aria-hidden="true" />
                <strong>{selectedRule.title}</strong>
              </div>
              <div className="rulebook-detail__actions">
                <button type="button" className="text-tool-button" onClick={() => onFocusRule(selectedRule.id)}>
                  <Crosshair aria-hidden="true" />
                  Focus In Graph
                </button>
                <button type="button" className="icon-button danger" aria-label="Delete Rule" onClick={handleDeleteRule}>
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="rulebook-detail__fields">
              <label className="field-stack">
                Title
                <input
                  aria-label="Rule title"
                  value={selectedRule.title}
                  onChange={(event) => onRuleChange(selectedRule.id, { title: event.target.value })}
                />
              </label>

              <label className="field-stack">
                Summary
                <textarea
                  aria-label="Rule summary"
                  rows={3}
                  value={selectedRule.summary}
                  onChange={(event) => onRuleChange(selectedRule.id, { summary: event.target.value })}
                />
              </label>

              <label className="field-stack">
                Tags
                <input
                  aria-label="Rule tags"
                  value={selectedRule.tags.join(", ")}
                  onChange={(event) =>
                    onRuleChange(selectedRule.id, {
                      tags: event.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean)
                    })
                  }
                />
              </label>

              <WorldRuleFields
                entity={selectedRule}
                idPrefix={`rulebook-${selectedRule.id}`}
                onEntityChange={(patch) => onRuleChange(selectedRule.id, patch)}
              />
            </div>
          </>
        ) : (
          <div className="rulebook-empty-detail">
            <ScrollText aria-hidden="true" />
            <h3>No rules</h3>
          </div>
        )}
      </section>
    </aside>
  );
}

function ruleWorldRule(rule: StoryEntity) {
  return {
    ...defaultWorldRuleMetadata(),
    ...rule.worldRule
  };
}

function matchesRuleFilters(rule: StoryEntity, search: string, domainFilter: string, statusFilter: string): boolean {
  const worldRule = ruleWorldRule(rule);
  const domain = worldRule.domain;
  const status = worldRule.status;

  if (domainFilter && (domainFilter === BLANK_FILTER_VALUE ? domain : domain !== domainFilter)) {
    return false;
  }

  if (statusFilter && (statusFilter === BLANK_FILTER_VALUE ? status : status !== statusFilter)) {
    return false;
  }

  const query = search.trim().toLowerCase();

  if (!query) {
    return true;
  }

  return [
    rule.title,
    rule.summary,
    rule.tags.join(" "),
    worldRule.domain,
    worldRule.status,
    worldRule.statement,
    worldRule.reason,
    worldRule.limits,
    worldRule.exceptions,
    worldRule.storyPurpose
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function groupRules(rules: StoryEntity[]): RuleGroup[] {
  const groups = new Map<string, StoryEntity[]>();

  for (const rule of rules) {
    const worldRule = ruleWorldRule(rule);
    const key = `${displayFilterValue(worldRule.domain, "Unsorted")} / ${displayFilterValue(worldRule.status, "No Status")}`;
    groups.set(key, [...(groups.get(key) ?? []), rule]);
  }

  return [...groups.entries()].map(([key, groupRules]) => ({
    key,
    rules: groupRules
  }));
}

function buildFilterOptions(presets: string[], values: string[], blankLabel: string) {
  const options = new Map<string, string>();

  for (const preset of presets) {
    options.set(preset, preset);
  }

  if (values.some((value) => !value)) {
    options.set(BLANK_FILTER_VALUE, blankLabel);
  }

  for (const value of values) {
    if (value) {
      options.set(value, value);
    }
  }

  return [...options.entries()].map(([value, label]) => ({ value, label }));
}

function displayFilterValue(value: string, fallback: string): string {
  return value || fallback;
}

function ruleSortKey(rule: StoryEntity): string {
  const worldRule = ruleWorldRule(rule);

  return `${worldRule.domain || "zz"}-${worldRule.status || "zz"}-${rule.title}`;
}
