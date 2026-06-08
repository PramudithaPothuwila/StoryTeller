import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";

export interface RelationshipEdgeData extends Record<string, unknown> {
  labelOffset: number;
}

export type RelationshipEdgeType = Edge<RelationshipEdgeData, "relationship">;

export function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  data,
  style,
  markerEnd,
  markerStart,
  interactionWidth
}: EdgeProps<RelationshipEdgeType>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });
  const labelOffset = typeof data?.labelOffset === "number" ? data.labelOffset : 0;
  const { x: offsetLabelX, y: offsetLabelY } = offsetLabelPosition({
    labelOffset,
    labelX,
    labelY,
    sourceX,
    sourceY,
    targetX,
    targetY
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      labelX={offsetLabelX}
      labelY={offsetLabelY}
      label={label}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      style={style}
      markerEnd={markerEnd}
      markerStart={markerStart}
      interactionWidth={interactionWidth}
    />
  );
}

function offsetLabelPosition({
  labelOffset,
  labelX,
  labelY,
  sourceX,
  sourceY,
  targetX,
  targetY
}: {
  labelOffset: number;
  labelX: number;
  labelY: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}): { x: number; y: number } {
  if (!labelOffset) {
    return { x: labelX, y: labelY };
  }

  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const length = Math.hypot(deltaX, deltaY);

  if (!length) {
    return { x: labelX, y: labelY + labelOffset };
  }

  return {
    x: labelX + (-deltaY / length) * labelOffset,
    y: labelY + (deltaX / length) * labelOffset
  };
}
