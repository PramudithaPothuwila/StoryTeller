import { ChevronDown, ChevronUp, Clock3, GripVertical, ListRestart, Plus, Trash2 } from "lucide-react";
import { type DragEvent, useMemo, useState } from "react";
import { getTimelineEvents } from "../data/story";
import { StoryEntity, StoryProject } from "../types";

interface TimelinePanelProps {
  project: StoryProject;
  selectedEventId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onMoveEvent: (eventId: string, track: number, index: number) => void;
  onDeleteEmptyTrack: (track: number) => void;
  onSelectEvent: (eventId: string | null) => void;
}

const TIMELINE_EVENT_DRAG_TYPE = "application/x-storyteller-event";

export function TimelinePanel({
  project,
  selectedEventId,
  collapsed,
  onToggleCollapsed,
  onMoveEvent,
  onDeleteEmptyTrack,
  onSelectEvent
}: TimelinePanelProps) {
  const events = getTimelineEvents(project);
  const [visibleTrackCount, setVisibleTrackCount] = useState(1);
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const trackCount = Math.max(1, visibleTrackCount, maxTimelineTrack(events) + 1);
  const tracks = useMemo(() => buildTimelineTracks(events, trackCount), [events, trackCount]);

  function handleDragStart(event: DragEvent<HTMLButtonElement>, eventId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(TIMELINE_EVENT_DRAG_TYPE, eventId);
    event.dataTransfer.setData("text/plain", eventId);
    setDraggedEventId(eventId);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!draggedEventId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleTrackDrop(event: DragEvent<HTMLElement>, track: number, index: number) {
    event.preventDefault();
    event.stopPropagation();

    const eventId = event.dataTransfer.getData(TIMELINE_EVENT_DRAG_TYPE) || event.dataTransfer.getData("text/plain") || draggedEventId;

    if (!eventId) {
      return;
    }

    onMoveEvent(eventId, track, index);
    setDraggedEventId(null);
  }

  function handleEventDrop(event: DragEvent<HTMLButtonElement>, track: number, index: number) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const insertAfter = bounds.width > 0 && event.clientX > bounds.left + bounds.width / 2;

    handleTrackDrop(event, track, index + (insertAfter ? 1 : 0));
  }

  function handleDeleteEmptyTrack(track: number) {
    if (tracks[track]?.length || trackCount <= 1) {
      return;
    }

    onDeleteEmptyTrack(track);
    setVisibleTrackCount((count) => Math.max(1, count - 1));
  }

  return (
    <section className={`timeline-panel ${collapsed ? "is-collapsed" : ""}`} aria-label="Event timeline">
      <header className="timeline-panel__header">
        <div>
          <Clock3 aria-hidden="true" />
          <h2>Timeline</h2>
          <span>
            {events.length} events / {trackCount} {trackCount === 1 ? "track" : "tracks"}
          </span>
        </div>
        <div className="timeline-panel__actions">
          <button
            type="button"
            className="icon-button"
            aria-label="Add timeline track"
            title="Add timeline track"
            onClick={() => setVisibleTrackCount(trackCount + 1)}
          >
            <Plus aria-hidden="true" />
          </button>
          <button type="button" className="icon-button" aria-label="Show full graph state" onClick={() => onSelectEvent(null)}>
            <ListRestart aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={collapsed ? "Expand timeline" : "Collapse timeline"}
            onClick={onToggleCollapsed}
          >
            {collapsed ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </button>
        </div>
      </header>

      {!collapsed ? (
        <div className="timeline-board">
          {events.length ? (
            tracks.map((trackEvents, track) => (
              <div
                key={track}
                className={`timeline-track ${draggedEventId ? "is-drop-target" : ""}`}
                onDragOver={handleDragOver}
                onDrop={(event) => handleTrackDrop(event, track, trackEvents.length)}
              >
                <div className="timeline-track__label">
                  <span>Track {track + 1}</span>
                  <small>{trackEvents.length}</small>
                  {!trackEvents.length && trackCount > 1 ? (
                    <button
                      type="button"
                      className="timeline-track__delete icon-button danger"
                      aria-label={`Delete empty track ${track + 1}`}
                      title="Delete empty track"
                      onClick={() => handleDeleteEmptyTrack(track)}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <div className="timeline-track__events">
                  {trackEvents.length ? (
                    trackEvents.map((event, index) => {
                      const effectCount = event.timeline?.effects.length ?? 0;

                      return (
                        <button
                          key={event.id}
                          type="button"
                          draggable
                          className={`timeline-event-card ${selectedEventId === event.id ? "is-selected" : ""} ${
                            draggedEventId === event.id ? "is-dragging" : ""
                          }`}
                          title="Drag to reorder"
                          onClick={() => onSelectEvent(event.id)}
                          onDragStart={(dragEvent) => handleDragStart(dragEvent, event.id)}
                          onDragEnd={() => setDraggedEventId(null)}
                          onDragOver={handleDragOver}
                          onDrop={(dragEvent) => handleEventDrop(dragEvent, track, index)}
                        >
                          <GripVertical aria-hidden="true" className="timeline-event-card__grip" />
                          <span>{event.timeline?.order ?? 0}</span>
                          <strong>{event.title}</strong>
                          <small>
                            {effectCount} {effectCount === 1 ? "change" : "changes"}
                          </small>
                        </button>
                      );
                    })
                  ) : (
                    <p>Empty</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="timeline-empty">No events yet</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function buildTimelineTracks(events: StoryEntity[], trackCount: number): StoryEntity[][] {
  const tracks = Array.from({ length: trackCount }, () => [] as StoryEntity[]);

  for (const event of events) {
    const track = timelineTrack(event);
    tracks[track] ??= [];
    tracks[track].push(event);
  }

  for (const trackEvents of tracks) {
    trackEvents.sort((a, b) => {
      const aOrder = a.timeline?.order ?? 0;
      const bOrder = b.timeline?.order ?? 0;

      return aOrder === bOrder ? a.title.localeCompare(b.title) : aOrder - bOrder;
    });
  }

  return tracks;
}

function maxTimelineTrack(events: StoryEntity[]): number {
  return events.reduce((maxTrack, event) => Math.max(maxTrack, timelineTrack(event)), 0);
}

function timelineTrack(event: StoryEntity): number {
  const track = event.timeline?.track;

  return typeof track === "number" && Number.isFinite(track) ? Math.max(0, Math.floor(track)) : 0;
}
