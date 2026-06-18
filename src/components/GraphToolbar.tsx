import { GitBranch, Map, Network } from "lucide-react";
import Select, { type SingleValue } from "react-select";
import { iconForName } from "../data/icons";
import { type GraphLayoutView, isGameStoryItemType } from "../data/story";
import { type ItemTypeId, type StoryProject } from "../types";

type GraphFocusDepth = 1 | 2 | 3 | 4 | "all";
type GraphDepthOption = { label: string; value: GraphFocusDepth };

interface GraphToolbarProps {
  graphFocusDepth: GraphFocusDepth;
  graphFocusDepthOptions: Array<{ label: string; value: GraphFocusDepth }>;
  graphView: GraphLayoutView;
  onCreateEntity: (type: ItemTypeId) => void;
  onGraphFocusDepthChange: (depth: GraphFocusDepth) => void;
  onGraphViewChange: (graphView: GraphLayoutView) => void;
  project: StoryProject;
}

export function GraphToolbar({
  graphFocusDepth,
  graphFocusDepthOptions,
  graphView,
  onCreateEntity,
  onGraphFocusDepthChange,
  onGraphViewChange,
  project
}: GraphToolbarProps) {
  const itemTypes =
    project.projectMode === "game_story"
      ? project.itemTypes.filter((type) =>
          graphView === "story_flow" ? isGameStoryItemType(type.id) : !isGameStoryItemType(type.id)
        )
      : project.itemTypes;
  const graphDepthOptions = graphFocusDepthOptions.map((option) => ({
    label: option.label,
    value: option.value
  }));
  const selectedGraphFocusDepth =
    graphDepthOptions.find((option) => option.value === graphFocusDepth) ?? graphDepthOptions[0];

  function handleGraphDepthChange(option: SingleValue<GraphDepthOption>) {
    if (option) {
      onGraphFocusDepthChange(option.value);
    }
  }

  return (
    <div className="graph-toolbar" role="toolbar" aria-label="Graph tools">
      <div className="graph-toolbar__group graph-toolbar__group--items" role="group" aria-label="Add items">
        {itemTypes.map((type) => {
          const Icon = iconForName(type.icon);

          return (
            <button
              key={type.id}
              type="button"
              className="graph-toolbar__button"
              aria-label={`Add ${type.label}`}
              title={`Add ${type.label}`}
              onClick={() => onCreateEntity(type.id)}
            >
              <Icon aria-hidden="true" style={{ color: type.color }} />
            </button>
          );
        })}
      </div>

      {project.projectMode === "game_story" ? (
        <div className="graph-toolbar__group" role="group" aria-label="Graph view">
          <button
            type="button"
            className={graphView === "world" ? "graph-toolbar__button is-active" : "graph-toolbar__button"}
            aria-label="Switch to World Building"
            title="World Building"
            aria-pressed={graphView === "world"}
            onClick={() => onGraphViewChange("world")}
          >
            <Map aria-hidden="true" />
          </button>
          <button
            type="button"
            className={graphView === "story_flow" ? "graph-toolbar__button is-active" : "graph-toolbar__button"}
            aria-label="Switch to Game Story"
            title="Game Story"
            aria-pressed={graphView === "story_flow"}
            onClick={() => onGraphViewChange("story_flow")}
          >
            <GitBranch aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="graph-toolbar__group" role="group" aria-label="Graph focus depth">
        <div className="graph-depth-select-wrap" title="Graph focus depth">
          <Network aria-hidden="true" />
          <Select<GraphDepthOption, false>
            aria-label="Graph focus depth"
            className="graph-depth-select"
            classNamePrefix="graph-depth-select"
            components={{ IndicatorSeparator: null }}
            isClearable={false}
            isSearchable={false}
            menuPortalTarget={typeof document === "undefined" ? undefined : document.body}
            menuPlacement="bottom"
            options={graphDepthOptions}
            styles={{
              menuPortal: (base) => ({ ...base, zIndex: 50 })
            }}
            value={selectedGraphFocusDepth}
            onChange={handleGraphDepthChange}
          />
        </div>
      </div>
    </div>
  );
}
