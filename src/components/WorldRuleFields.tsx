import { defaultWorldRuleMetadata, worldRuleDomainPresets, worldRuleStatusPresets } from "../data/story";
import { StoryEntity, WorldRuleMetadata } from "../types";

interface WorldRuleFieldsProps {
  entity: StoryEntity;
  idPrefix: string;
  onEntityChange: (patch: Partial<StoryEntity>) => void;
}

export function WorldRuleFields({ entity, idPrefix, onEntityChange }: WorldRuleFieldsProps) {
  const worldRule = {
    ...defaultWorldRuleMetadata(),
    ...entity.worldRule
  };
  const safeIdPrefix = idPrefix.replace(/[^a-z0-9_-]+/gi, "-");
  const domainOptionsId = `${safeIdPrefix}-domain-options`;
  const statusOptionsId = `${safeIdPrefix}-status-options`;

  function handleWorldRuleChange(field: keyof WorldRuleMetadata, value: string) {
    onEntityChange({
      worldRule: {
        ...worldRule,
        [field]: value
      }
    });
  }

  return (
    <section className="world-rule-fields">
      <h2>Rule Fields</h2>

      <div className="world-rule-fields__grid">
        <label className="field-stack">
          Domain
          <input
            aria-label="Rule domain"
            list={domainOptionsId}
            value={worldRule.domain}
            onChange={(event) => handleWorldRuleChange("domain", event.target.value)}
          />
        </label>
        <datalist id={domainOptionsId}>
          {worldRuleDomainPresets.map((domain) => (
            <option key={domain} value={domain} />
          ))}
        </datalist>

        <label className="field-stack">
          Status
          <input
            aria-label="Rule status"
            list={statusOptionsId}
            value={worldRule.status}
            onChange={(event) => handleWorldRuleChange("status", event.target.value)}
          />
        </label>
        <datalist id={statusOptionsId}>
          {worldRuleStatusPresets.map((status) => (
            <option key={status} value={status} />
          ))}
        </datalist>
      </div>

      <label className="field-stack">
        Rule Statement
        <textarea
          aria-label="Rule statement"
          rows={3}
          value={worldRule.statement}
          onChange={(event) => handleWorldRuleChange("statement", event.target.value)}
        />
      </label>

      <label className="field-stack">
        Reason
        <textarea
          aria-label="Rule reason"
          rows={3}
          value={worldRule.reason}
          onChange={(event) => handleWorldRuleChange("reason", event.target.value)}
        />
      </label>

      <label className="field-stack">
        Limits
        <textarea
          aria-label="Rule limits"
          rows={3}
          value={worldRule.limits}
          onChange={(event) => handleWorldRuleChange("limits", event.target.value)}
        />
      </label>

      <label className="field-stack">
        Exceptions
        <textarea
          aria-label="Rule exceptions"
          rows={3}
          value={worldRule.exceptions}
          onChange={(event) => handleWorldRuleChange("exceptions", event.target.value)}
        />
      </label>

      <label className="field-stack">
        Story Purpose
        <textarea
          aria-label="Rule story purpose"
          rows={3}
          value={worldRule.storyPurpose}
          onChange={(event) => handleWorldRuleChange("storyPurpose", event.target.value)}
        />
      </label>
    </section>
  );
}
