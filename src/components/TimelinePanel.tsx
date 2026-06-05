import { ChevronDown, ChevronUp, Clock3, ListRestart } from "lucide-react";
import { getTimelineEvents } from "../data/story";
import { StoryProject } from "../types";

interface TimelinePanelProps {
  project: StoryProject;
  selectedEventId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelectEvent: (eventId: string | null) => void;
}

export function TimelinePanel({
  project,
  selectedEventId,
  collapsed,
  onToggleCollapsed,
  onSelectEvent
}: TimelinePanelProps) {
  const events = getTimelineEvents(project);

  return (
    <section className={`timeline-panel ${collapsed ? "is-collapsed" : ""}`} aria-label="Event timeline">
      <header className="timeline-panel__header">
        <div>
          <Clock3 aria-hidden="true" />
          <h2>Timeline</h2>
          <span>{events.length} events</span>
        </div>
        <div className="timeline-panel__actions">
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
        <div className="timeline-track">
          {events.length ? (
            events.map((event) => (
              <button
                key={event.id}
                type="button"
                className={selectedEventId === event.id ? "is-selected" : ""}
                onClick={() => onSelectEvent(event.id)}
              >
                <span>{event.timeline?.order ?? 0}</span>
                <strong>{event.title}</strong>
                <small>{event.timeline?.effects.length ?? 0} changes</small>
              </button>
            ))
          ) : (
            <p>No events yet</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
