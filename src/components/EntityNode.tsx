import { Handle, Node, NodeProps, Position } from "@xyflow/react";
import { CSSProperties } from "react";
import { iconForName } from "../data/icons";
import { typeSoftColor } from "../data/story";
import { ItemTypeDefinition, StoryEntity } from "../types";

export interface EntityNodeData extends Record<string, unknown> {
  entity: StoryEntity;
  itemType: ItemTypeDefinition;
  sourceHandles: EntityNodeHandle[];
  targetHandles: EntityNodeHandle[];
  isSelected: boolean;
  isConnectedToFocus: boolean;
  isFaded: boolean;
  isGameStart?: boolean;
  isGameEnding?: boolean;
  isGameCriticalPath?: boolean;
  isGameGated?: boolean;
  isGameDeadEnd?: boolean;
}

export interface EntityNodeHandle {
  id: string;
  offset: number;
}

export type EntityNodeType = Node<EntityNodeData, "storyEntity">;

export function EntityNode({ data }: NodeProps<EntityNodeType>) {
  const Icon = iconForName(data.itemType.icon);

  return (
    <article
      className={[
        "entity-node",
        data.isSelected ? "is-selected" : "",
        data.isConnectedToFocus ? "is-connected" : "",
        data.isFaded ? "is-faded" : "",
        data.isGameStart ? "is-game-start" : "",
        data.isGameEnding ? "is-game-ending" : "",
        data.isGameCriticalPath ? "is-game-critical" : "",
        data.isGameGated ? "is-game-gated" : "",
        data.isGameDeadEnd ? "is-game-dead-end" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        {
          "--node-accent": data.itemType.color,
          "--node-soft": typeSoftColor(data.itemType.color)
        } as CSSProperties
      }
    >
      <Handle className="node-handle" type="target" position={Position.Left} />
      {data.targetHandles.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          className="node-handle node-handle--parallel"
          type="target"
          position={Position.Left}
          isConnectable={false}
          style={{ top: `${50 + handle.offset}%` }}
        />
      ))}
      <div className="entity-node__header">
        <span className="entity-node__type">
          <Icon aria-hidden="true" />
          {data.itemType.label}
        </span>
        {data.entity.privateInfo.trim() ? <span className="entity-node__private">Private</span> : null}
      </div>
      <h3>{data.entity.title}</h3>
      <p>{data.entity.summary || "No summary yet."}</p>
      {data.isGameStart || data.isGameEnding || data.isGameCriticalPath || data.isGameGated || data.isGameDeadEnd ? (
        <div className="entity-node__game-badges">
          {data.isGameStart ? <span>Start</span> : null}
          {data.isGameEnding ? <span>Ending</span> : null}
          {data.isGameCriticalPath ? <span>Critical</span> : null}
          {data.isGameGated ? <span>Gated</span> : null}
          {data.isGameDeadEnd ? <span>Dead End</span> : null}
        </div>
      ) : null}
      {data.entity.tags.length ? (
        <div className="entity-node__tags">
          {data.entity.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      <Handle className="node-handle" type="source" position={Position.Right} />
      {data.sourceHandles.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          className="node-handle node-handle--parallel"
          type="source"
          position={Position.Right}
          isConnectable={false}
          style={{ top: `${50 + handle.offset}%` }}
        />
      ))}
    </article>
  );
}
