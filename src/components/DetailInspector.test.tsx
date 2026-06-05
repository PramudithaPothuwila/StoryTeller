import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createStarterProject } from "../data/story";
import { DetailInspector } from "./DetailInspector";

describe("DetailInspector", () => {
  it("keeps private character information collapsed until the author reveals it", () => {
    const project = createStarterProject();
    const character = Object.values(project.entities).find((entity) => entity.type === "character")!;

    render(
      <DetailInspector
        project={project}
        selection={{ kind: "entity", id: character.id }}
        onEntityChange={vi.fn()}
        onRelationshipChange={vi.fn()}
        onDeleteEntity={vi.fn()}
        onDeleteRelationship={vi.fn()}
      />
    );

    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.queryByLabelText("Private information")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Show private information"));

    expect(screen.getByLabelText("Private information")).toHaveValue(character.privateInfo);
  });
});
