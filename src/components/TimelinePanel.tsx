import { ChevronDown, ChevronUp, Clock3, GripVertical, ListRestart, Plus, Trash2 } from "lucide-react";
import {
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { getTimelineEvents, getTimelineLaneNames } from "../data/story";
import { StoryEntity, StoryProject } from "../types";

interface TimelinePanelProps {
  project: StoryProject;
  selectedEventId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onAddTrack: () => void;
  onMoveEvent: (eventId: string, track: number, index: number) => void;
  onDeleteEmptyTrack: (track: number) => void;
  onRenameTrack: (track: number, name: string) => void;
  onScrubTimelineOrder: (order: number) => void;
  onSelectEvent: (eventId: string | null) => void;
}

const TIMELINE_EVENT_DRAG_TYPE = "application/x-storyteller-event";
const TIMELINE_EVENT_PILL_WIDTH = 142;
const TIMELINE_EVENT_GAP = 6;
const TIMELINE_TRACK_EVENTS_PADDING = 12;
const MIN_TIMELINE_EVENTS_WIDTH = 420;

export function TimelinePanel({
  project,
  selectedEventId,
  collapsed,
  onToggleCollapsed,
  onAddTrack,
  onMoveEvent,
  onDeleteEmptyTrack,
  onRenameTrack,
  onScrubTimelineOrder,
  onSelectEvent
}: TimelinePanelProps) {
  const events = getTimelineEvents(project);
  const laneNames = getTimelineLaneNames(project);
  const [laneNameDrafts, setLaneNameDrafts] = useState<Record<number, string>>({});
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const timelineScrollerRef = useRef<HTMLDivElement>(null);
  const timelineOrderRefs = useRef(new Map<number, HTMLButtonElement>());
  const trackCount = Math.max(1, laneNames.length, maxTimelineTrack(events) + 1);
  const tracks = useMemo(() => buildTimelineTracks(events, trackCount), [events, trackCount]);
  const selectedEvent = selectedEventId ? events.find((event) => event.id === selectedEventId) : null;
  const selectedTimelineOrder = selectedEvent?.timeline?.order ?? null;
  const maxTimelineOrder = Math.max(1, ...events.map((event) => event.timeline?.order ?? 1));
  const displayedTimelineOrder = selectedTimelineOrder ?? maxTimelineOrder;
  const maxTrackEventCount = Math.max(1, ...tracks.map((trackEvents) => trackEvents.length));
  const timelineEventsWidth = Math.max(
    MIN_TIMELINE_EVENTS_WIDTH,
    maxTrackEventCount * TIMELINE_EVENT_PILL_WIDTH +
      Math.max(0, maxTrackEventCount - 1) * TIMELINE_EVENT_GAP +
      TIMELINE_TRACK_EVENTS_PADDING
  );
  const timelineBoardStyle = {
    "--timeline-events-width": `${timelineEventsWidth}px`
  } as CSSProperties;

  useEffect(() => {
    setLaneNameDrafts({});
  }, [project.timelineLaneNames]);

  useEffect(() => {
    if (selectedTimelineOrder === null) {
      return;
    }

    const currentTimeElement = timelineOrderRefs.current.get(selectedTimelineOrder);

    if (typeof currentTimeElement?.scrollIntoView !== "function") {
      return;
    }

    currentTimeElement.scrollIntoView({
      block: "nearest",
      inline: "center"
    });
  }, [selectedTimelineOrder]);

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

  function handleTimelineSliderChange(event: ChangeEvent<HTMLInputElement>) {
    const nextOrder = Number(event.target.value) || 1;

    onScrubTimelineOrder(nextOrder);
  }

  function handleTimelineSliderWheel(event: WheelEvent<HTMLInputElement>) {
    if (!events.length) {
      return;
    }

    event.preventDefault();

    const wheelDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;

    if (wheelDelta === 0) {
      return;
    }

    const direction = wheelDelta > 0 ? 1 : -1;
    const nextOrder = Math.min(maxTimelineOrder, Math.max(1, displayedTimelineOrder + direction));

    if (nextOrder !== displayedTimelineOrder) {
      onScrubTimelineOrder(nextOrder);
    }
  }

  function handleDeleteEmptyTrack(track: number) {
    if (tracks[track]?.length || trackCount <= 1) {
      return;
    }

    onDeleteEmptyTrack(track);
  }

  function handleLaneNameChange(track: number, name: string) {
    setLaneNameDrafts((drafts) => ({
      ...drafts,
      [track]: name
    }));
  }

  function handleLaneNameBlur(track: number) {
    if (!(track in laneNameDrafts)) {
      return;
    }

    const name = laneNameDrafts[track];
    setLaneNameDrafts(({ [track]: _removed, ...drafts }) => drafts);
    onRenameTrack(track, name);
  }

  function handleLaneNameKeyDown(event: KeyboardEvent<HTMLInputElement>, track: number) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Escape") {
      setLaneNameDrafts(({ [track]: _removed, ...drafts }) => drafts);
      event.currentTarget.blur();
    }
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
            aria-keyshortcuts="Shift+T"
            title="Add timeline track (Shift+T)"
            onClick={onAddTrack}
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
            aria-keyshortcuts="T"
            title={collapsed ? "Expand timeline (T)" : "Collapse timeline (T)"}
            onClick={onToggleCollapsed}
          >
            {collapsed ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </button>
        </div>
      </header>

      {!collapsed ? (
        <>
          <label className="timeline-scroll-control">
            <span>{events.length ? (selectedTimelineOrder === null ? "Full graph" : `Time ${selectedTimelineOrder}`) : "No events"}</span>
            <input
              aria-label="Timeline time"
              type="range"
              min={1}
              max={maxTimelineOrder}
              step={1}
              value={displayedTimelineOrder}
              disabled={!events.length}
              onChange={handleTimelineSliderChange}
              onWheel={handleTimelineSliderWheel}
            />
          </label>

          <div className="timeline-board" ref={timelineScrollerRef}>
            <div className="timeline-board__content" style={timelineBoardStyle}>
              {tracks.map((trackEvents, track) => {
                const laneName = laneNameDrafts[track] ?? laneNames[track] ?? `Track ${track + 1}`;

                return (
                  <div
                    key={track}
                    className={`timeline-track ${draggedEventId ? "is-drop-target" : ""}`}
                    onDragOver={handleDragOver}
                    onDrop={(event) => handleTrackDrop(event, track, trackEvents.length)}
                  >
                    <div className="timeline-track__label">
                      <input
                        aria-label={`Timeline lane ${track + 1} name`}
                        className="timeline-track__name"
                        value={laneName}
                        onChange={(event) => handleLaneNameChange(track, event.target.value)}
                        onBlur={() => handleLaneNameBlur(track)}
                        onKeyDown={(event) => handleLaneNameKeyDown(event, track)}
                      />
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
                          const changeLabel = effectCount === 1 ? "change" : "changes";
                          const eventOrder = event.timeline?.order ?? 1;
                          const isCurrentTime = selectedTimelineOrder === eventOrder;

                          return (
                            <button
                              key={event.id}
                              type="button"
                              draggable
                              ref={(element) => {
                                if (!element) {
                                  if (timelineOrderRefs.current.get(eventOrder)?.dataset.eventId === event.id) {
                                    timelineOrderRefs.current.delete(eventOrder);
                                  }
                                  return;
                                }

                                if (!timelineOrderRefs.current.has(eventOrder)) {
                                  timelineOrderRefs.current.set(eventOrder, element);
                                }
                              }}
                              data-event-id={event.id}
                              className={`timeline-event-card ${selectedEventId === event.id ? "is-selected" : ""} ${
                                isCurrentTime ? "is-current-time" : ""
                              } ${
                                draggedEventId === event.id ? "is-dragging" : ""
                              }`}
                              title={`${event.title} - ${effectCount} ${changeLabel} - Drag to reorder`}
                              onClick={() => onSelectEvent(event.id)}
                              onDragStart={(dragEvent) => handleDragStart(dragEvent, event.id)}
                              onDragEnd={() => setDraggedEventId(null)}
                              onDragOver={handleDragOver}
                              onDrop={(dragEvent) => handleEventDrop(dragEvent, track, index)}
                            >
                              <GripVertical aria-hidden="true" className="timeline-event-card__grip" />
                              <span>{event.timeline?.order ?? 0}</span>
                              <strong>{event.title}</strong>
                            </button>
                          );
                        })
                      ) : (
                        <p>Empty</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
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
