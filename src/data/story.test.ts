import { describe, expect, it } from "vitest";
import {
  createBlankProject,
  createStoryEntity,
  deleteEmptyTimelineTrackFromProject,
  ensureEventTimeline,
  moveTimelineEventInProject
} from "./story";

describe("story timeline tracks", () => {
  it("renumbers event order from timeline moves across parallel tracks", () => {
    const project = createBlankProject("Parallel Timeline");
    const first = createStoryEntity("event", project.itemTypes, "First");
    const second = createStoryEntity("event", project.itemTypes, "Second");
    const third = createStoryEntity("event", project.itemTypes, "Third");
    first.timeline = { order: 1, effects: [] };
    second.timeline = { order: 2, effects: [] };
    third.timeline = { order: 3, effects: [] };

    const projectWithEvents = {
      ...project,
      entities: {
        [first.id]: first,
        [second.id]: second,
        [third.id]: third
      }
    };

    const movedToParallelTrack = moveTimelineEventInProject(projectWithEvents, third.id, 1, 0);

    expect(ensureEventTimeline(movedToParallelTrack.entities[third.id]).track).toBe(1);
    expect(ensureEventTimeline(movedToParallelTrack.entities[third.id]).order).toBe(1);
    expect(ensureEventTimeline(movedToParallelTrack.entities[first.id]).track).toBe(0);
    expect(ensureEventTimeline(movedToParallelTrack.entities[first.id]).order).toBe(1);
    expect(ensureEventTimeline(movedToParallelTrack.entities[second.id]).order).toBe(2);

    const reorderedSameTrack = moveTimelineEventInProject(movedToParallelTrack, second.id, 0, 0);

    expect(ensureEventTimeline(reorderedSameTrack.entities[second.id]).order).toBe(1);
    expect(ensureEventTimeline(reorderedSameTrack.entities[first.id]).order).toBe(2);
  });

  it("deletes only empty timeline tracks and collapses later tracks", () => {
    const project = createBlankProject("Parallel Timeline");
    const first = createStoryEntity("event", project.itemTypes, "First");
    const second = createStoryEntity("event", project.itemTypes, "Second");
    first.timeline = { order: 1, track: 0, effects: [] };
    second.timeline = { order: 1, track: 2, effects: [] };
    const projectWithGap = {
      ...project,
      entities: {
        [first.id]: first,
        [second.id]: second
      }
    };

    const unchanged = deleteEmptyTimelineTrackFromProject(projectWithGap, 0);
    const collapsed = deleteEmptyTimelineTrackFromProject(projectWithGap, 1);

    expect(unchanged).toBe(projectWithGap);
    expect(ensureEventTimeline(collapsed.entities[first.id]).track).toBe(0);
    expect(ensureEventTimeline(collapsed.entities[second.id]).track).toBe(1);
  });
});
