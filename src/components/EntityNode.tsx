import { Handle, Node, NodeProps, Position } from "@xyflow/react";
import { CSSProperties } from "react";
import { StoryEntity } from "../types";
import { entityTypeMeta } from "../data/story";

export interface EntityNodeData extends Record<string, unknown> {
  entity: StoryEntity;
  isSelected: boolean;
}

export type EntityNodeType = Node<EntityNodeData, "storyEntity">;

export function EntityNode({ data }: NodeProps<EntityNodeType>) {
  const meta = entityTypeMeta[data.entity.type];

  return (
    <article
      className={`entity-node ${data.isSelected ? "is-selected" : ""}`}
      style={{ "--node-accent": meta.accent, "--node-soft": meta.softAccent } as CSSProperties}
    >
      <Handle className="node-handle" type="target" position={Position.Left} />
      <div className="entity-node__header">
        <span className="entity-node__type">{meta.label}</span>
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
