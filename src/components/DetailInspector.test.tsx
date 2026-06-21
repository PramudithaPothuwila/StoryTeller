import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BUILT_IN_WORLD_RULE_TYPE_ID, StoryProject } from "../types";
import { createBlankProject, createStoryEntity } from "../data/story";
import { DetailInspector } from "./DetailInspector";

function renderInspector(
  project: StoryProject,
  entityId: string,
  overrides: Partial<Parameters<typeof DetailInspector>[0]> = {}
) {
  return render(
    <DetailInspector
      project={project}
      selection={{ kind: "entity", id: entityId }}
      onStartTriggerPick={vi.fn()}
      onEntityChange={vi.fn()}
      onProjectChange={vi.fn()}
      onRelationshipChange={vi.fn()}
      onSelectEntityInGraph={vi.fn()}
      onTimelineEffect={vi.fn()}
      onDeleteEntity={vi.fn()}
      onDeleteRelationship={vi.fn()}
      {...overrides}
    />
  );
}

describe("DetailInspector", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps private character information collapsed until the author reveals it", () => {
    const project = createBlankProject("Inspector Test");
    const character = createStoryEntity("character", project.itemTypes, "Mara Vale");
    character.privateInfo = "Carries the royal bloodline without knowing it.";
    const projectWithCharacter = {
      ...project,
      entities: {
        [character.id]: character
      }
    };

    renderInspector(projectWithCharacter, character.id);

    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.queryByLabelText("Private information")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Show private information"));

    expect(screen.getByLabelText("Private information")).toHaveValue(character.privateInfo);
  });

  it("does not expose manual timeline order on event details", () => {
    const project = createBlankProject("Inspector Test");
    const event = createStoryEntity("event", project.itemTypes, "Market Fire");
    event.timeline = { order: 1, effects: [] };
    const projectWithEvent = {
      ...project,
      entities: {
        [event.id]: event
      }
    };

    renderInspector(projectWithEvent, event.id);

    expect(screen.queryByText("Timeline Order")).not.toBeInTheDocument();
    expect(screen.getByText("Relationship Change")).toBeInTheDocument();
  });

  it("renders structured fields for world rules", () => {
    const project = createBlankProject("Inspector Test");
    const rule = createStoryEntity(BUILT_IN_WORLD_RULE_TYPE_ID, project.itemTypes, "Memory Trade Is Final");
    rule.worldRule = {
      domain: "Magic",
      status: "Canon",
      statement: "A willingly traded memory cannot be restored.",
      reason: "Memory has civic weight.",
      limits: "Coerced theft leaves fragments.",
      exceptions: "Charged objects can hold echoes.",
      storyPurpose: "Keeps memory magic costly."
    };
    const onEntityChange = vi.fn();
    const projectWithRule = {
      ...project,
      entities: {
        [rule.id]: rule
      }
    };

    renderInspector(projectWithRule, rule.id, { onEntityChange });

    expect(screen.getByLabelText("Rule domain")).toHaveValue("Magic");
    expect(screen.getByLabelText("Rule status")).toHaveValue("Canon");
    expect(screen.getByLabelText("Rule statement")).toHaveValue("A willingly traded memory cannot be restored.");

    fireEvent.change(screen.getByLabelText("Rule domain"), { target: { value: "Technology" } });

    expect(onEntityChange).toHaveBeenCalledWith(
      rule.id,
      expect.objectContaining({
        worldRule: expect.objectContaining({ domain: "Technology" })
      })
    );
  });

  it("does not render world rule fields for other entity types", () => {
    const project = createBlankProject("Inspector Test");
    const character = createStoryEntity("character", project.itemTypes, "Mara Vale");
    const projectWithCharacter = {
      ...project,
      entities: {
        [character.id]: character
      }
    };

    renderInspector(projectWithCharacter, character.id);

    expect(screen.queryByText("Rule Fields")).not.toBeInTheDocument();
  });

  it("renders character runtime fields only for character entities", () => {
    const project = createBlankProject("Inspector Test");
    const character = createStoryEntity("character", project.itemTypes, "Mara Vale");
    const item = createStoryEntity("item", project.itemTypes, "Moonlit Ledger");
    const projectWithEntities = {
      ...project,
      entities: {
        [character.id]: character,
        [item.id]: item
      }
    };

    const { rerender } = renderInspector(projectWithEntities, character.id);

    expect(screen.getByText("Character Knowledge & Belief")).toBeInTheDocument();

    rerender(
      <DetailInspector
        project={projectWithEntities}
        selection={{ kind: "entity", id: item.id }}
        onStartTriggerPick={vi.fn()}
        onEntityChange={vi.fn()}
        onProjectChange={vi.fn()}
        onRelationshipChange={vi.fn()}
        onSelectEntityInGraph={vi.fn()}
        onTimelineEffect={vi.fn()}
        onDeleteEntity={vi.fn()}
        onDeleteRelationship={vi.fn()}
      />
    );

    expect(screen.queryByText("Character Knowledge & Belief")).not.toBeInTheDocument();
  });

  it("updates character runtime metadata from the panel", () => {
    const project = createBlankProject("Inspector Test");
    const character = createStoryEntity("character", project.itemTypes, "Mara Vale");
    const onEntityChange = vi.fn();
    const projectWithCharacter = {
      ...project,
      runtime: {
        ...project.runtime,
        facts: [
          {
            id: "fact-ledger-forged",
            statement: "The ledger was forged.",
            truth: "true" as const,
            sourceEntityIds: [],
            tags: [],
            notes: ""
          }
        ]
      },
      entities: {
        [character.id]: character
      }
    };

    renderInspector(projectWithCharacter, character.id, { onEntityChange });

    fireEvent.change(screen.getByLabelText("Character goals"), {
      target: { value: "Find the ledger\nProtect Orin" }
    });
    fireEvent.change(screen.getByLabelText("Communication style"), {
      target: { value: "Answers carefully and avoids royal names." }
    });
    fireEvent.change(screen.getByLabelText("Character attitude"), { target: { value: "42" } });

    expect(onEntityChange).toHaveBeenCalledWith(
      character.id,
      expect.objectContaining({
        runtimeCharacter: expect.objectContaining({
          goals: ["Find the ledger", "Protect Orin"]
        })
      })
    );
    expect(onEntityChange).toHaveBeenCalledWith(
      character.id,
      expect.objectContaining({
        runtimeCharacter: expect.objectContaining({
          communicationStyle: "Answers carefully and avoids royal names."
        })
      })
    );
    expect(onEntityChange).toHaveBeenLastCalledWith(
      character.id,
      expect.objectContaining({
        runtimeCharacter: expect.objectContaining({
          attitude: 42
        })
      })
    );
  });

  it("adds, edits, and removes character knowledge rows", () => {
    const project = createBlankProject("Inspector Test");
    const character = createStoryEntity("character", project.itemTypes, "Mara Vale");
    const onProjectChange = vi.fn();
    const projectWithRuntime = {
      ...project,
      runtime: {
        ...project.runtime,
        facts: [
          {
            id: "fact-ledger-forged",
            statement: "The ledger was forged.",
            truth: "true" as const,
            sourceEntityIds: [],
            tags: [],
            notes: ""
          }
        ],
        evidence: [
          {
            id: "evidence-ink",
            label: "Moonlit ink",
            description: "",
            factIds: ["fact-ledger-forged"],
            reliability: "confirmed" as const,
            playerVisibility: "discoverable" as const,
            discoveredByCharacterIds: [],
            notes: ""
          }
        ],
        characterKnowledge: [
          {
            id: "knowledge-ledger",
            characterId: character.id,
            factId: "fact-ledger-forged",
            knowledge: "suspects" as const,
            belief: "uncertain" as const,
            evidenceIds: [],
            notes: ""
          }
        ]
      },
      entities: {
        [character.id]: character
      }
    };

    renderInspector(projectWithRuntime, character.id, { onProjectChange });

    fireEvent.click(screen.getByRole("button", { name: "Knowledge" }));
    expect(onProjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          characterKnowledge: expect.arrayContaining([
            expect.objectContaining({ characterId: character.id, factId: "fact-ledger-forged" })
          ])
        })
      })
    );

    fireEvent.change(screen.getByLabelText("Knowledge state"), { target: { value: "knows" } });
    expect(onProjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          characterKnowledge: expect.arrayContaining([
            expect.objectContaining({ id: "knowledge-ledger", knowledge: "knows" })
          ])
        })
      })
    );

    fireEvent.click(screen.getByLabelText("Delete knowledge row"));
    expect(onProjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          characterKnowledge: []
        })
      })
    );
  });
});
