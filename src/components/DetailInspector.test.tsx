import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BUILT_IN_WORLD_RULE_TYPE_ID } from "../types";
import { createBlankProject, createStoryEntity } from "../data/story";
import { DetailInspector } from "./DetailInspector";

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

    render(
      <DetailInspector
        project={projectWithCharacter}
        selection={{ kind: "entity", id: character.id }}
        onStartTriggerPick={vi.fn()}
        onEntityChange={vi.fn()}
        onRelationshipChange={vi.fn()}
        onSelectEntityInGraph={vi.fn()}
        onTimelineEffect={vi.fn()}
        onDeleteEntity={vi.fn()}
        onDeleteRelationship={vi.fn()}
      />
    );

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

    render(
      <DetailInspector
        project={projectWithEvent}
        selection={{ kind: "entity", id: event.id }}
        onStartTriggerPick={vi.fn()}
        onEntityChange={vi.fn()}
        onRelationshipChange={vi.fn()}
        onSelectEntityInGraph={vi.fn()}
        onTimelineEffect={vi.fn()}
        onDeleteEntity={vi.fn()}
        onDeleteRelationship={vi.fn()}
      />
    );

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

    render(
      <DetailInspector
        project={projectWithRule}
        selection={{ kind: "entity", id: rule.id }}
        onStartTriggerPick={vi.fn()}
        onEntityChange={onEntityChange}
        onRelationshipChange={vi.fn()}
        onSelectEntityInGraph={vi.fn()}
        onTimelineEffect={vi.fn()}
        onDeleteEntity={vi.fn()}
        onDeleteRelationship={vi.fn()}
      />
    );

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

    render(
      <DetailInspector
        project={projectWithCharacter}
        selection={{ kind: "entity", id: character.id }}
        onStartTriggerPick={vi.fn()}
        onEntityChange={vi.fn()}
        onRelationshipChange={vi.fn()}
        onSelectEntityInGraph={vi.fn()}
        onTimelineEffect={vi.fn()}
        onDeleteEntity={vi.fn()}
        onDeleteRelationship={vi.fn()}
      />
    );

    expect(screen.queryByText("Rule Fields")).not.toBeInTheDocument();
  });
});
