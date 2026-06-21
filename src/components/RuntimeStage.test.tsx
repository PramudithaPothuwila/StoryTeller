import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject, createStoryEntity, normalizeStoryRuntimeCharacterKnowledge } from "../data/story";
import type { StoryProject } from "../types";
import { RuntimeStage } from "./RuntimeStage";

function createRuntimeProject(): StoryProject {
  const project = createBlankProject("Runtime Test");
  const character = createStoryEntity("character", project.itemTypes, "Mara Vale");
  const otherCharacter = createStoryEntity("character", project.itemTypes, "Orin Pike");

  return {
    ...project,
    entities: {
      [character.id]: {
        ...character,
        runtimeCharacter: {
          goals: ["Find the ledger"],
          attitude: 15,
          emotionalState: "Guarded",
          communicationStyle: "Careful and clipped.",
          knownFactIds: ["fact-ledger-forged"],
          believedFactIds: [],
          hiddenFactIds: ["fact-mara-lineage"],
          deceptionRules: [],
          disclosureRules: []
        }
      },
      [otherCharacter.id]: otherCharacter
    },
    runtime: {
      facts: [
        {
          id: "fact-ledger-forged",
          statement: "The ledger was forged.",
          truth: "true",
          subjectEntityId: character.id,
          sourceEntityIds: [otherCharacter.id],
          sourceNotes: "Draft chapter 2",
          tags: [],
          notes: ""
        },
        {
          id: "fact-mara-lineage",
          statement: "Mara is tied to the old station family.",
          truth: "true",
          subjectEntityId: character.id,
          sourceEntityIds: [],
          sourceNotes: "",
          tags: [],
          notes: ""
        }
      ],
      evidence: [
        {
          id: "evidence-ink",
          label: "Moonlit ink",
          description: "The ink appears under cold light.",
          factIds: ["fact-ledger-forged"],
          reliability: "confirmed",
          playerVisibility: "discoverable",
          discoveredByCharacterIds: [],
          sourceEntityIds: [otherCharacter.id],
          sourceNotes: "Photo board note.",
          notes: ""
        }
      ],
      characterKnowledge: [
        normalizeStoryRuntimeCharacterKnowledge({
          id: "knowledge-mara-ledger",
          characterId: character.id,
          factId: "fact-ledger-forged",
          knowledge: "knows",
          belief: "believes_true",
          evidenceIds: ["evidence-ink"],
          notes: "Mara saw the ink."
        })
      ],
      contradictionRules: [
        {
          id: "contradiction-ledger",
          label: "Ledger conflict",
          factIds: ["fact-ledger-forged"],
          severity: "warning",
          resolution: "Only one ledger origin can be true.",
          notes: ""
        }
      ],
      theoryRules: [
        {
          id: "theory-ledger",
          label: "Forgery accusation",
          requiredEvidenceIds: ["evidence-ink"],
          supportingFactIds: ["fact-ledger-forged"],
          contradictingFactIds: [],
          conclusion: "Mara can accuse the forger.",
          playerVisibility: "hidden",
          notes: ""
        }
      ]
    }
  };
}

function renderRuntimeStage(project = createRuntimeProject(), overrides: Partial<Parameters<typeof RuntimeStage>[0]> = {}) {
  return render(
    <RuntimeStage
      project={project}
      selection={null}
      onBackToWorkspace={vi.fn()}
      onEntityChange={vi.fn()}
      onExportRuntime={vi.fn()}
      onProjectChange={vi.fn()}
      {...overrides}
    />
  );
}

describe("RuntimeStage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders runtime collections and keeps export runtime inside the stage", () => {
    const onExportRuntime = vi.fn();
    renderRuntimeStage(createRuntimeProject(), { onExportRuntime });

    expect(screen.getByRole("heading", { name: "Runtime Tools" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Facts" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("The ledger was forged.")).toBeInTheDocument();
    expect(screen.getByText("Sources: Orin Pike")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Draft chapter 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Export Preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Export Runtime" }));

    expect(onExportRuntime).toHaveBeenCalledTimes(1);
  });

  it("adds, edits, and deletes runtime facts", () => {
    const project = createRuntimeProject();
    const onProjectChange = vi.fn();

    renderRuntimeStage(project, { onProjectChange });

    fireEvent.click(screen.getByRole("button", { name: "Add Fact" }));
    const projectWithAddedFact = onProjectChange.mock.lastCall?.[0] as StoryProject;
    expect(projectWithAddedFact.runtime.facts[0]).toEqual(
      expect.objectContaining({ id: expect.stringMatching(/^fact-/), truth: "unknown" })
    );
    expect(projectWithAddedFact.runtime.facts[1]).toEqual(expect.objectContaining({ id: "fact-ledger-forged" }));

    const card = screen.getByDisplayValue("The ledger was forged.").closest(".runtime-list-card") as HTMLElement;
    fireEvent.change(within(card).getByLabelText("Fact statement"), { target: { value: "The ledger was altered." } });
    expect(onProjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          facts: expect.arrayContaining([
            expect.objectContaining({ id: "fact-ledger-forged", statement: "The ledger was altered." })
          ])
        })
      })
    );

    fireEvent.change(within(card).getByLabelText("Source notes"), { target: { value: "Annotated scene outline." } });
    expect(onProjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          facts: expect.arrayContaining([
            expect.objectContaining({ id: "fact-ledger-forged", sourceNotes: "Annotated scene outline." })
          ])
        })
      })
    );

    fireEvent.click(within(card).getByRole("button", { name: "Delete fact" }));
    expect(onProjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          facts: [expect.objectContaining({ id: "fact-mara-lineage" })],
          evidence: [expect.objectContaining({ factIds: [] })],
          characterKnowledge: []
        })
      })
    );
  });

  it("adds, edits, and deletes runtime evidence", () => {
    const project = createRuntimeProject();
    const onProjectChange = vi.fn();

    renderRuntimeStage(project, { onProjectChange });
    fireEvent.click(screen.getByRole("button", { name: "Evidence" }));

    expect(screen.getByDisplayValue("Photo board note.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Evidence" }));
    const projectWithAddedEvidence = onProjectChange.mock.lastCall?.[0] as StoryProject;
    expect(projectWithAddedEvidence.runtime.evidence[0]).toEqual(
      expect.objectContaining({ id: expect.stringMatching(/^evidence-/) })
    );
    expect(projectWithAddedEvidence.runtime.evidence[1]).toEqual(expect.objectContaining({ id: "evidence-ink" }));

    const card = screen.getByDisplayValue("Moonlit ink").closest(".runtime-list-card") as HTMLElement;
    fireEvent.change(within(card).getByLabelText("Evidence label"), { target: { value: "Cold-light ink" } });
    expect(onProjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          evidence: expect.arrayContaining([expect.objectContaining({ id: "evidence-ink", label: "Cold-light ink" })])
        })
      })
    );

    fireEvent.click(within(card).getByRole("button", { name: "Delete evidence" }));
    expect(onProjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          evidence: [],
          characterKnowledge: [expect.objectContaining({ evidenceIds: [] })],
          theoryRules: [expect.objectContaining({ requiredEvidenceIds: [] })]
        })
      })
    );
  });

  it("adds and edits contradiction and theory rules", () => {
    const project = createRuntimeProject();
    const onProjectChange = vi.fn();

    renderRuntimeStage(project, { onProjectChange });
    fireEvent.click(screen.getByRole("button", { name: "Contradictions" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Rule" }));
    expect(onProjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          contradictionRules: expect.arrayContaining([expect.objectContaining({ id: expect.stringMatching(/^contradiction-/) })])
        })
      })
    );

    fireEvent.change(screen.getByDisplayValue("Ledger conflict"), { target: { value: "Ledger truth conflict" } });
    expect(onProjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          contradictionRules: expect.arrayContaining([
            expect.objectContaining({ id: "contradiction-ledger", label: "Ledger truth conflict" })
          ])
        })
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Theory Rules" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Rule" }));
    expect(onProjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          theoryRules: expect.arrayContaining([expect.objectContaining({ id: expect.stringMatching(/^theory-/) })])
        })
      })
    );

    fireEvent.change(screen.getByDisplayValue("Mara can accuse the forger."), {
      target: { value: "The player can confront Mara." }
    });
    expect(onProjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          theoryRules: expect.arrayContaining([
            expect.objectContaining({ id: "theory-ledger", conclusion: "The player can confront Mara." })
          ])
        })
      })
    );
  });

  it("renders character knowledge for the selected character", () => {
    const project = createRuntimeProject();
    const characterId = Object.values(project.entities).find((entity) => entity.title === "Mara Vale")?.id ?? "";

    renderRuntimeStage(project, { selection: { kind: "entity", id: characterId } });
    fireEvent.click(screen.getByRole("button", { name: "Character Knowledge" }));

    expect(screen.getByRole("combobox", { name: "Runtime character" })).toHaveValue(characterId);
    expect(screen.getByRole("heading", { name: "Character Knowledge & Belief" })).toBeInTheDocument();
    expect(screen.getByLabelText("Character goals")).toHaveValue("Find the ledger");
    expect(screen.getByDisplayValue("Mara saw the ink.")).toBeInTheDocument();
  });

  it("edits character runtime metadata through entity updates", () => {
    const project = createRuntimeProject();
    const characterId = Object.values(project.entities).find((entity) => entity.title === "Mara Vale")?.id ?? "";
    const onEntityChange = vi.fn();

    renderRuntimeStage(project, { selection: { kind: "entity", id: characterId }, onEntityChange });
    fireEvent.click(screen.getByRole("button", { name: "Character Knowledge" }));
    fireEvent.change(screen.getByLabelText("Character goals"), {
      target: { value: "Find the ledger\nProtect Orin" }
    });
    fireEvent.change(screen.getByLabelText("Communication style"), {
      target: { value: "Short, evasive answers." }
    });
    fireEvent.change(screen.getByLabelText("Character attitude"), { target: { value: "45" } });

    expect(onEntityChange).toHaveBeenCalledWith(
      characterId,
      expect.objectContaining({
        runtimeCharacter: expect.objectContaining({
          goals: ["Find the ledger", "Protect Orin"]
        })
      })
    );
    expect(onEntityChange).toHaveBeenCalledWith(
      characterId,
      expect.objectContaining({
        runtimeCharacter: expect.objectContaining({
          communicationStyle: "Short, evasive answers."
        })
      })
    );
    expect(onEntityChange).toHaveBeenCalledWith(
      characterId,
      expect.objectContaining({
        runtimeCharacter: expect.objectContaining({
          attitude: 45
        })
      })
    );
  });

  it("adds, edits, and removes runtime knowledge rows through project updates", () => {
    const project = createRuntimeProject();
    const characterId = Object.values(project.entities).find((entity) => entity.title === "Mara Vale")?.id ?? "";
    const onProjectChange = vi.fn();

    renderRuntimeStage(project, { selection: { kind: "entity", id: characterId }, onProjectChange });
    fireEvent.click(screen.getByRole("button", { name: "Character Knowledge" }));

    fireEvent.click(screen.getByRole("button", { name: "Knowledge" }));
    expect(onProjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          characterKnowledge: expect.arrayContaining([
            expect.objectContaining({ characterId, factId: "fact-ledger-forged" })
          ])
        })
      })
    );

    fireEvent.change(screen.getByLabelText("Knowledge notes"), { target: { value: "Mara admits this privately." } });
    expect(onProjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          characterKnowledge: expect.arrayContaining([
            expect.objectContaining({ id: "knowledge-mara-ledger", notes: "Mara admits this privately." })
          ])
        })
      })
    );

    const row = screen.getByDisplayValue("Mara saw the ink.").closest(".runtime-rule-card");
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "Delete knowledge row" }));
    expect(onProjectChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          characterKnowledge: []
        })
      })
    );
  });
});
