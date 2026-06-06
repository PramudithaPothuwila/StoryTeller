import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createBlankProject, createStoryEntity } from "../data/story";
import { DetailInspector } from "./DetailInspector";

describe("DetailInspector", () => {
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
        onEntityChange={vi.fn()}
        onRelationshipChange={vi.fn()}
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
        onEntityChange={vi.fn()}
        onRelationshipChange={vi.fn()}
        onTimelineEffect={vi.fn()}
        onDeleteEntity={vi.fn()}
        onDeleteRelationship={vi.fn()}
      />
    );

    expect(screen.queryByText("Timeline Order")).not.toBeInTheDocument();
    expect(screen.getByText("Relationship Change")).toBeInTheDocument();
  });
});
