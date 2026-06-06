import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject, createStoryEntity, renameTimelineLaneInProject } from "../data/story";
import { StoryProject } from "../types";
import { TimelinePanel } from "./TimelinePanel";

describe("TimelinePanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a timeline scrubber with values based on event orders", () => {
    const project = createBlankProject("Timeline Panel Test");
    const first = createStoryEntity("event", project.itemTypes, "Market Fire");
    const second = createStoryEntity("event", project.itemTypes, "Archive Bargain");
    first.timeline = { order: 1, effects: [] };
    second.timeline = { order: 3, effects: [] };

    render(
      <TimelinePanel
        project={{
          ...project,
          timelineLaneNames: ["Track 1", "Track 2"],
          entities: {
            [first.id]: first,
            [second.id]: second
          }
        }}
        selectedEventId={second.id}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        onAddTrack={vi.fn()}
        onMoveEvent={vi.fn()}
        onDeleteEmptyTrack={vi.fn()}
        onRenameTrack={vi.fn()}
        onScrubTimelineOrder={vi.fn()}
        onSelectEvent={vi.fn()}
      />
    );

    const slider = screen.getByLabelText("Timeline time") as HTMLInputElement;
    expect(slider).toHaveAttribute("min", "1");
    expect(slider).toHaveAttribute("max", "3");
    expect(slider).toHaveValue("3");
    expect(screen.getByText("Time 3")).toBeInTheDocument();
  });

  it("scrubs to a timeline order without selecting an event", () => {
    const project = createBlankProject("Timeline Panel Test");
    const first = createStoryEntity("event", project.itemTypes, "Market Fire");
    const second = createStoryEntity("event", project.itemTypes, "Archive Bargain");
    first.timeline = { order: 1, effects: [] };
    second.timeline = { order: 2, effects: [] };
    const onScrubTimelineOrder = vi.fn();

    render(
      <TimelinePanel
        project={{
          ...project,
          timelineLaneNames: ["Track 1", "Track 2"],
          entities: {
            [first.id]: first,
            [second.id]: second
          }
        }}
        selectedEventId={null}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        onAddTrack={vi.fn()}
        onMoveEvent={vi.fn()}
        onDeleteEmptyTrack={vi.fn()}
        onRenameTrack={vi.fn()}
        onScrubTimelineOrder={onScrubTimelineOrder}
        onSelectEvent={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Timeline time"), { target: { value: "1" } });

    expect(onScrubTimelineOrder).toHaveBeenCalledWith(1);
  });

  it("steps timeline time with the mouse wheel over the scrubber", () => {
    const project = createBlankProject("Timeline Panel Test");
    const events = Array.from({ length: 3 }, (_, index) => {
      const event = createStoryEntity("event", project.itemTypes, `Event ${index + 1}`);
      event.timeline = { order: index + 1, effects: [] };
      return event;
    });
    const onScrubTimelineOrder = vi.fn();

    render(
      <TimelinePanel
        project={{
          ...project,
          entities: Object.fromEntries(events.map((event) => [event.id, event]))
        }}
        selectedEventId={events[1].id}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        onAddTrack={vi.fn()}
        onMoveEvent={vi.fn()}
        onDeleteEmptyTrack={vi.fn()}
        onRenameTrack={vi.fn()}
        onScrubTimelineOrder={onScrubTimelineOrder}
        onSelectEvent={vi.fn()}
      />
    );

    const slider = screen.getByLabelText("Timeline time");

    fireEvent.wheel(slider, { deltaY: 120 });
    fireEvent.wheel(slider, { deltaY: -120 });

    expect(onScrubTimelineOrder).toHaveBeenNthCalledWith(1, 3);
    expect(onScrubTimelineOrder).toHaveBeenNthCalledWith(2, 1);
  });

  it("disables the timeline scrubber when there are no events", () => {
    render(
      <TimelinePanel
        project={createBlankProject("Timeline Panel Test")}
        selectedEventId={null}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        onAddTrack={vi.fn()}
        onMoveEvent={vi.fn()}
        onDeleteEmptyTrack={vi.fn()}
        onRenameTrack={vi.fn()}
        onScrubTimelineOrder={vi.fn()}
        onSelectEvent={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Timeline time")).toBeDisabled();
    expect(screen.getByText("No events")).toBeInTheDocument();
  });

  it("highlights all event pills at the selected timeline order", () => {
    const project = createBlankProject("Timeline Panel Test");
    const first = createStoryEntity("event", project.itemTypes, "Market Fire");
    const parallel = createStoryEntity("event", project.itemTypes, "Alley Signal");
    const later = createStoryEntity("event", project.itemTypes, "Archive Bargain");
    first.timeline = { order: 1, track: 0, effects: [] };
    parallel.timeline = { order: 1, track: 1, effects: [] };
    later.timeline = { order: 2, track: 0, effects: [] };
    const { container } = render(
      <TimelinePanel
        project={{
          ...project,
          entities: {
            [first.id]: first,
            [parallel.id]: parallel,
            [later.id]: later
          }
        }}
        selectedEventId={first.id}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        onAddTrack={vi.fn()}
        onMoveEvent={vi.fn()}
        onDeleteEmptyTrack={vi.fn()}
        onRenameTrack={vi.fn()}
        onScrubTimelineOrder={vi.fn()}
        onSelectEvent={vi.fn()}
      />
    );

    expect(container.querySelectorAll(".timeline-event-card.is-current-time")).toHaveLength(2);
  });

  it("renders event blocks as minimal pills with change details in the tooltip", () => {
    const project = createBlankProject("Timeline Panel Test");
    const event = createStoryEntity("event", project.itemTypes, "Market Fire");
    event.timeline = {
      order: 1,
      effects: [{ id: "effect-1", action: "end", relationshipId: "link-1" }]
    };

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
        onAddTrack={vi.fn()}
        onMoveEvent={vi.fn()}
        onDeleteEmptyTrack={vi.fn()}
        onRenameTrack={vi.fn()}
        onScrubTimelineOrder={vi.fn()}
        onSelectEvent={vi.fn()}
      />
    );

    expect(screen.getByText("Market Fire")).toBeInTheDocument();
    expect(screen.queryByText("1 change")).not.toBeInTheDocument();
    expect(screen.getByTitle("Market Fire - 1 change - Drag to reorder")).toBeInTheDocument();
  });

  it("selects an event when its pill is clicked", () => {
    const project = createBlankProject("Timeline Panel Test");
    const event = createStoryEntity("event", project.itemTypes, "Market Fire");
    event.timeline = { order: 1, effects: [] };
    const onSelectEvent = vi.fn();

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
        onAddTrack={vi.fn()}
        onMoveEvent={vi.fn()}
        onDeleteEmptyTrack={vi.fn()}
        onRenameTrack={vi.fn()}
        onScrubTimelineOrder={vi.fn()}
        onSelectEvent={onSelectEvent}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Market Fire/ }));

    expect(onSelectEvent).toHaveBeenCalledWith(event.id);
  });

  it("requests a project-backed timeline track when the add button is clicked", () => {
    const onAddTrack = vi.fn();

    render(
      <TimelinePanel
        project={createBlankProject("Timeline Panel Test")}
        selectedEventId={null}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        onAddTrack={onAddTrack}
        onMoveEvent={vi.fn()}
        onDeleteEmptyTrack={vi.fn()}
        onRenameTrack={vi.fn()}
        onScrubTimelineOrder={vi.fn()}
        onSelectEvent={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add timeline track" }));

    expect(onAddTrack).toHaveBeenCalledTimes(1);
  });

  it("renders and edits custom timeline lane names", () => {
    const project = {
      ...createBlankProject("Timeline Panel Test"),
      timelineLaneNames: ["Main Plot", "Conspiracy"]
    };
    const onRenameTrack = vi.fn();

    render(
      <TimelinePanel
        project={project}
        selectedEventId={null}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        onAddTrack={vi.fn()}
        onMoveEvent={vi.fn()}
        onDeleteEmptyTrack={vi.fn()}
        onRenameTrack={onRenameTrack}
        onScrubTimelineOrder={vi.fn()}
        onSelectEvent={vi.fn()}
      />
    );

    const firstLaneName = screen.getByLabelText("Timeline lane 1 name") as HTMLInputElement;
    expect(firstLaneName).toHaveValue("Main Plot");
    expect(screen.getByLabelText("Timeline lane 2 name")).toHaveValue("Conspiracy");

    fireEvent.change(firstLaneName, { target: { value: "Court Thread" } });
    fireEvent.blur(firstLaneName);

    expect(onRenameTrack).toHaveBeenCalledWith(0, "Court Thread");
  });

  it("restores blank lane names to their fallback labels on blur", () => {
    function TimelineLaneHarness() {
      const [project, setProject] = useState<StoryProject>({
        ...createBlankProject("Timeline Panel Test"),
        timelineLaneNames: ["Main Plot"]
      });

      return (
        <TimelinePanel
          project={project}
          selectedEventId={null}
          collapsed={false}
          onToggleCollapsed={vi.fn()}
          onAddTrack={vi.fn()}
          onMoveEvent={vi.fn()}
          onDeleteEmptyTrack={vi.fn()}
          onRenameTrack={(track, name) => setProject((currentProject) => renameTimelineLaneInProject(currentProject, track, name))}
          onScrubTimelineOrder={vi.fn()}
          onSelectEvent={vi.fn()}
        />
      );
    }

    render(<TimelineLaneHarness />);

    const firstLaneName = screen.getByLabelText("Timeline lane 1 name") as HTMLInputElement;
    fireEvent.change(firstLaneName, { target: { value: "" } });
    fireEvent.blur(firstLaneName);

    expect(screen.getByLabelText("Timeline lane 1 name")).toHaveValue("Track 1");
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
          timelineLaneNames: ["Track 1", "Track 2"],
          entities: {
            [first.id]: first,
            [second.id]: second
          }
        }}
        selectedEventId={null}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        onAddTrack={vi.fn()}
        onMoveEvent={onMoveEvent}
        onDeleteEmptyTrack={vi.fn()}
        onRenameTrack={vi.fn()}
        onScrubTimelineOrder={vi.fn()}
        onSelectEvent={vi.fn()}
      />
    );

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
          timelineLaneNames: ["Track 1", "Track 2"],
          entities: {
            [event.id]: event
          }
        }}
        selectedEventId={null}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        onAddTrack={vi.fn()}
        onMoveEvent={vi.fn()}
        onDeleteEmptyTrack={onDeleteEmptyTrack}
        onRenameTrack={vi.fn()}
        onScrubTimelineOrder={vi.fn()}
        onSelectEvent={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Delete empty track 2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete empty track 2" }));

    expect(onDeleteEmptyTrack).toHaveBeenCalledWith(1);
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
