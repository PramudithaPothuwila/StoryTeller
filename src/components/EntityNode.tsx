import { Handle, Node, NodeProps, Position } from "@xyflow/react";
import { CSSProperties } from "react";
import { iconForName } from "../data/icons";
import { typeSoftColor } from "../data/story";
import { ItemTypeDefinition, StoryEntity } from "../types";

export interface EntityNodeData extends Record<string, unknown> {
  entity: StoryEntity;
  itemType: ItemTypeDefinition;
  isSelected: boolean;
  isConnectedToFocus: boolean;
  isFaded: boolean;
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
        data.isFaded ? "is-faded" : ""
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
      <div className="entity-node__header">
        <span className="entity-node__type">
          <Icon aria-hidden="true" />
          {data.itemType.label}
        </span>
        {data.entity.privateInfo.trim() ? <span className="entity-node__private">Private</span> : null}
      </div>
      <h3>{data.entity.title}</h3>
      <p>{data.entity.summary || "No summary yet."}</p>
      {data.entity.tags.length ? (
        <div className="entity-node__tags">
          {data.entity.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      <Handle className="node-handle" type="source" position={Position.Right} />
    </article>
  );
}
