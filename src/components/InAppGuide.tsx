import { BookOpen, GitBranch, Keyboard, Map, Save, Search, Settings2, Timer, X } from "lucide-react";
import { useEffect } from "react";

interface InAppGuideProps {
  onClose: () => void;
}

const guideSections = [
  {
    title: "Create and Find Story Items",
    icon: Search,
    points: [
      "Use Add Item to create characters, locations, items, factions, events, notes, and world rules.",
      "Use the Items search to filter by title, summary, tags, notes, and rulebook fields.",
      "Select any item from the list or graph to open its editable details."
    ]
  },
  {
    title: "Use the Graph",
    icon: GitBranch,
    points: [
      "Drag items around the graph to shape the story map.",
      "Connect nodes to create relationships using the current default link type.",
      "Use the graph depth dropdown in the toolbar to choose how many relationship steps stay highlighted around the selected item.",
      "Select a relationship line to edit its label, notes, timing, and game-story branch metadata."
    ]
  },
  {
    title: "Edit Details",
    icon: BookOpen,
    points: [
      "Use the inspector to maintain titles, summaries, tags, public notes, private notes, and Markdown body notes.",
      "Event items expose timeline controls, while world rules and game-story items show their structured fields.",
      "Delete the selected item or relationship from the inspector when it no longer belongs in the project."
    ]
  },
  {
    title: "Work With Time",
    icon: Timer,
    points: [
      "Create event items to place story beats on the timeline.",
      "Use timeline lanes to group events and drag events between lanes.",
      "Scrub the timeline to preview which relationships are active at a specific story moment."
    ]
  },
  {
    title: "Build the Rulebook",
    icon: Map,
    points: [
      "Open Rulebook to manage canon worldbuilding rules in one focused panel.",
      "Group and filter rules by domain and status.",
      "Use Focus In Graph to jump from a rulebook entry back to its graph node."
    ]
  },
  {
    title: "Save and Configure",
    icon: Save,
    points: [
      "Use New, Open, Select Folder, and Save to manage local project files.",
      "Open Settings to rename the project, export a backup, switch Story or Game Story mode, and edit custom item or link types.",
      "In Game Story mode, use Branching RPG in the topbar to open the optional State, Preview, and Continuity tools."
    ]
  },
  {
    title: "Keyboard Shortcuts",
    icon: Keyboard,
    points: [
      "Use Ctrl/Cmd+S to save, Ctrl/Cmd+E to export a backup, Ctrl/Cmd+F to focus item search, and ? to open this guide.",
      "Use R to toggle Rulebook, A for AI Agent on cloud projects, and B for Branching RPG; W/G switch graph views and T toggles the timeline.",
      "Use C, N, L, E, I, F, U, S, Q, and D to create visible graph item types; 1-4 and 0 change graph focus depth.",
      "Use Alt+1, Alt+2, and Alt+3 for Game Story tabs. Shortcuts are ignored while typing, and deletion requires Ctrl/Cmd+Backspace or Ctrl/Cmd+Delete."
    ]
  }
];

export function InAppGuide({ onClose }: InAppGuideProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <header className="guide-dialog__header">
          <div>
            <p>StoryTeller</p>
            <h2 id="guide-title">Guide</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close guide" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="guide-dialog__body">
          {guideSections.map((section) => {
            const Icon = section.icon;

            return (
              <article key={section.title} className="guide-section">
                <div className="guide-section__heading">
                  <Icon aria-hidden="true" />
                  <h3>{section.title}</h3>
                </div>
                <ul>
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            );
          })}

          <section className="guide-note">
            <Settings2 aria-hidden="true" />
            <p>
              A strong project usually starts with a few central people, places, and conflicts, then grows through
              relationships, timeline events, and rulebook constraints.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
