import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject, createStoryEntity } from "../data/story";
import { TimelinePanel } from "./TimelinePanel";

describe("TimelinePanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("moves events by dropping them onto another timeline track", () => {
    const project = createBlankProject("Timeline Panel Test");
    const first = createStoryEntity("event", project.itemTypes, "Market Fire");
    const second = createStoryEntity("event", project.itemTypes, "Archive Bargain");
    first.timeline = { order: 1, effects: [] };
    second.timeline = { order: 2, effects: [] };
    const onMoveEvent = vi.fn();
    const { container } = render(
      <TimelinePanel
        project={{
          ...project,
          entities: {
            [first.id]: first,
            [second.id]: second
          }
        }}
        selectedEventId={null}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        onMoveEvent={onMoveEvent}
        onDeleteEmptyTrack={vi.fn()}
        onSelectEvent={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add timeline track" }));

    const dataTransfer = createDataTransfer();
    const firstCard = container.querySelector(".timeline-event-card");
    const tracks = container.querySelectorAll(".timeline-track");

    expect(firstCard).not.toBeNull();
    expect(tracks).toHaveLength(2);

    fireEvent.dragStart(firstCard!, { dataTransfer });
    fireEvent.dragOver(tracks[1], { dataTransfer });
    fireEvent.drop(tracks[1], { dataTransfer });

    expect(onMoveEvent).toHaveBeenCalledWith(first.id, 1, 0);
  });

  it("deletes an empty timeline track from the panel", () => {
    const project = createBlankProject("Timeline Panel Test");
    const event = createStoryEntity("event", project.itemTypes, "Market Fire");
    event.timeline = { order: 1, effects: [] };
    const onDeleteEmptyTrack = vi.fn();

    render(
      <TimelinePanel
        project={{
          ...project,
          entities: {
            [event.id]: event
          }
        }}
        selectedEventId={null}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        onMoveEvent={vi.fn()}
        onDeleteEmptyTrack={onDeleteEmptyTrack}
        onSelectEvent={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add timeline track" }));

    expect(screen.getByRole("button", { name: "Delete empty track 2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete empty track 2" }));

    expect(onDeleteEmptyTrack).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("button", { name: "Delete empty track 2" })).not.toBeInTheDocument();
  });
});

function createDataTransfer() {
  const data = new Map<string, string>();

  return {
    dropEffect: "move",
    effectAllowed: "move",
    getData: vi.fn((type: string) => data.get(type) ?? ""),
    setData: vi.fn((type: string, value: string) => {
      data.set(type, value);
    })
  };
}
