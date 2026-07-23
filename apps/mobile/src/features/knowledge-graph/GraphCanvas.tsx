// 图谱画布：SVG 渲染节点 / 关系边，支持双指缩放、拖拽平移、点击命中与聚焦高亮。
// 性能优化：节点/边拆为 memo 化子组件，pan/zoom 时仅更新 <G transform> 字符串，
// memo 子组件不会重渲染（props 不变），避免了整个 SVG 树重建。

import React, { memo, useEffect, useRef, useState } from 'react';
import { View, type LayoutChangeEvent, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, G, Line, Polygon, Text } from 'react-native-svg';

import type { GraphMode, KnowledgeEdge, KnowledgeNode } from './contracts';
import {
  EDGE_COLOR,
  EDGE_HIGHLIGHT,
  categoryMeta,
  masteryMeta,
  nodeRadius,
  relationLabel,
} from './visualEncoding';
import {
  centerOnNode,
  fitTransform,
  pointToSegmentDistance,
  type Positions,
  type Transform,
  type ViewSize,
} from './layouts';

const BG = '#F5F6FB';
const INK = '#182033';
const MUTED = '#6D758A';
const FOCUS_RING = '#4E57C8';
const REVIEW_BADGE = '#D84C62';

const MIN_SCALE = 0.25;
const MAX_SCALE = 3;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export type FocusRequest = { nodeId: string; token: number };

type Props = {
  positions: Positions;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  nodeById: Map<string, KnowledgeNode>;
  neighbors: Set<string>;
  focusedNodeId: string | null;
  selectedNodeId: string | null;
  mode: GraphMode;
  resetToken: number;
  focusRequest: FocusRequest | null;
  onNodeTap: (id: string) => void;
  onEdgeTap: (id: string) => void;
  onBackgroundTap: () => void;
  onNodeDrag: (id: string, x: number, y: number) => void;
};

// ─── Memo 化的边组件 ───
type EdgeItemProps = {
  edge: KnowledgeEdge;
  a: { x: number; y: number };
  b: { x: number; y: number };
  src: KnowledgeNode;
  tgt: KnowledgeNode;
  focusedNodeId: string | null;
  showLabel: boolean;
};

const EdgeItem = memo(function EdgeItem({
  edge,
  a,
  b,
  src,
  tgt,
  focusedNodeId,
  showLabel,
}: EdgeItemProps) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const gap = 4;
  const tailX = a.x + ux * (nodeRadius(src.importance) + gap);
  const tailY = a.y + uy * (nodeRadius(src.importance) + gap);
  const tipX = b.x - ux * (nodeRadius(tgt.importance) + gap);
  const tipY = b.y - uy * (nodeRadius(tgt.importance) + gap);
  const connected =
    focusedNodeId !== null &&
    (edge.source === focusedNodeId || edge.target === focusedNodeId);
  const dim = focusedNodeId !== null && !connected;
  const color = connected ? EDGE_HIGHLIGHT : EDGE_COLOR;
  const strokeWidth = 0.8 + edge.weight * 0.35;
  const dashed = edge.confidence < 0.6;
  const opacity = dim ? 0.18 : 0.9;
  return (
    <G opacity={opacity}>
      <Line
        x1={tailX}
        y1={tailY}
        x2={tipX}
        y2={tipY}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dashed ? '6 5' : undefined}
      />
      {edge.directed && (
        <Polygon
          points={`${tipX},${tipY} ${tipX - ux * 9 - uy * 6},${tipY - uy * 9 + ux * 6} ${tipX - ux * 9 + uy * 6},${tipY - uy * 9 - ux * 6}`}
          fill={color}
        />
      )}
      {showLabel && (
        <Text
          x={(a.x + b.x) / 2}
          y={(a.y + b.y) / 2 - 6}
          fill={connected ? FOCUS_RING : MUTED}
          fontSize={12}
          textAnchor="middle"
          fontWeight="700">
          {relationLabel[edge.relation]}
        </Text>
      )}
    </G>
  );
}, (prev, next) =>
  prev.edge.id === next.edge.id &&
  prev.a.x === next.a.x &&
  prev.a.y === next.a.y &&
  prev.b.x === next.b.x &&
  prev.b.y === next.b.y &&
  prev.focusedNodeId === next.focusedNodeId &&
  prev.showLabel === next.showLabel);

// ─── Memo 化的节点组件 ───
type NodeItemProps = {
  node: KnowledgeNode;
  pos: { x: number; y: number };
  isFocused: boolean;
  isNeighbor: boolean;
  isSelected: boolean;
  isDragging: boolean;
  focusedNodeId: string | null;
};

const NodeItem = memo(function NodeItem({
  node,
  pos,
  isFocused,
  isNeighbor,
  isSelected,
  isDragging,
  focusedNodeId,
}: NodeItemProps) {
  const r = nodeRadius(node.importance);
  const meta = categoryMeta[node.category];
  const m = masteryMeta[node.mastery];
  const dim = focusedNodeId !== null && !isNeighbor;
  const showReview = node.review || node.mastery === 'review';
  return (
    <G
      opacity={dim ? 0.25 : 1}
      transform={`translate(${pos.x} ${pos.y})`}>
      {isSelected && (
        <Circle r={r + 8} fill="none" stroke={FOCUS_RING} strokeWidth={2} />
      )}
      {isDragging && (
        <Circle r={r + 6} fill="none" stroke={FOCUS_RING} strokeWidth={2.5} strokeDasharray="4 3" />
      )}
      <Circle
        r={r + 4}
        fill="none"
        stroke={m.ring}
        strokeWidth={3}
        strokeDasharray={m.dashed ? '5 4' : undefined}
      />
      <Circle r={r} fill={meta.color} />
      {isFocused && <Circle r={r} fill="#FFFFFF" fillOpacity={0.12} />}
      {showReview && (
        <>
          <Circle cx={r * 0.72} cy={-r * 0.72} r={8} fill={REVIEW_BADGE} />
          <Text
            x={r * 0.72}
            y={-r * 0.72 + 4}
            fill="#FFFFFF"
            fontSize={11}
            fontWeight="800"
            textAnchor="middle">
            !
          </Text>
        </>
      )}
      <Text
        x={0}
        y={r + 15}
        fill={INK}
        fontSize={12.5}
        fontWeight="700"
        textAnchor="middle">
        {node.title}
      </Text>
    </G>
  );
}, (prev, next) =>
  prev.node.id === next.node.id &&
  prev.pos.x === next.pos.x &&
  prev.pos.y === next.pos.y &&
  prev.isFocused === next.isFocused &&
  prev.isNeighbor === next.isNeighbor &&
  prev.isSelected === next.isSelected &&
  prev.isDragging === next.isDragging &&
  prev.focusedNodeId === next.focusedNodeId);

export function GraphCanvas(props: Props) {
  const {
    positions,
    nodes,
    edges,
    nodeById,
    neighbors,
    focusedNodeId,
    selectedNodeId,
    mode,
    resetToken,
    focusRequest,
    onNodeTap,
    onEdgeTap,
    onBackgroundTap,
    onNodeDrag,
  } = props;

  const [size, setSize] = useState<ViewSize>({ width: 0, height: 0 });
  // transform 用 React state，但 memo 子组件不会因此重渲染（props 不变）。
  // 只有 <G transform="..."> 字符串变化，SVG 引擎高效处理。
  const [transform, setTransform] = useState<Transform>({ scale: 1, tx: 0, ty: 0 });
  const transformRef = useRef(transform);

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const draggingId = useRef<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  const setT = (updater: Transform | ((prev: Transform) => Transform)) => {
    setTransform((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      transformRef.current = next;
      return next;
    });
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  // 首次获得尺寸或切换图谱时自适应铺满
  useEffect(() => {
    if (!size.width || !size.height) return;
    const fit = fitTransform(positions, size);
    if (fit) setT(fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, resetToken]);

  // 搜索 / 聚焦请求：把目标节点居中
  useEffect(() => {
    if (!focusRequest || !size.width) return;
    const next = centerOnNode(positions, size, focusRequest.nodeId, transformRef.current);
    if (next) setT(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.token]);

  // 命中检测
  const findNodeAt = (gx: number, gy: number): string | null => {
    const scale = transformRef.current.scale;
    const tolPx = 9;
    let bestNode: string | null = null;
    let bestNodeD = Infinity;
    for (const n of nodes) {
      const p = positions[n.id];
      if (!p) continue;
      const d = Math.hypot(gx - p.x, gy - p.y);
      const tapR = nodeRadius(n.importance) + tolPx / scale;
      if (d <= tapR && d < bestNodeD) {
        bestNodeD = d;
        bestNode = n.id;
      }
    }
    return bestNode;
  };

  const handleTap = (gx: number, gy: number) => {
    const scale = transformRef.current.scale;
    const tolPx = 9;
    const hitNode = findNodeAt(gx, gy);
    if (hitNode) {
      onNodeTap(hitNode);
      return;
    }
    const edgeTol = tolPx / scale;
    let bestEdge: string | null = null;
    let bestEdgeD = Infinity;
    for (const e of edges) {
      const a = positions[e.source];
      const b = positions[e.target];
      if (!a || !b) continue;
      const d = pointToSegmentDistance(gx, gy, a.x, a.y, b.x, b.y);
      if (d <= edgeTol && d < bestEdgeD) {
        bestEdgeD = d;
        bestEdge = e.id;
      }
    }
    if (bestEdge) {
      onEdgeTap(bestEdge);
      return;
    }
    onBackgroundTap();
  };

  // ─── 手势 ───
  const pinching = useRef(false);
  const pinchStartScale = useRef(1);
  const panStart = useRef({ tx: 0, ty: 0 });

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      panStart.current = { tx: transformRef.current.tx, ty: transformRef.current.ty };
      const t = transformRef.current;
      const gx = (e.x - t.tx) / t.scale;
      const gy = (e.y - t.ty) / t.scale;
      const hit = findNodeAt(gx, gy);
      if (hit) {
        draggingId.current = hit;
        setDraggingNodeId(hit);
        const p = positions[hit];
        dragStart.current = { x: p.x, y: p.y };
      } else {
        draggingId.current = null;
      }
    })
    .onUpdate((e) => {
      if (pinching.current) return;
      if (draggingId.current) {
        const s = transformRef.current.scale;
        onNodeDrag(
          draggingId.current,
          dragStart.current.x + e.translationX / s,
          dragStart.current.y + e.translationY / s,
        );
        return;
      }
      setT((t) => ({
        ...t,
        tx: panStart.current.tx + e.translationX,
        ty: panStart.current.ty + e.translationY,
      }));
    })
    .onEnd(() => {
      draggingId.current = null;
      setDraggingNodeId(null);
    });

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => {
      pinching.current = true;
      pinchStartScale.current = transformRef.current.scale;
    })
    .onUpdate((e) => {
      const next = clamp(pinchStartScale.current * e.scale, MIN_SCALE, MAX_SCALE);
      const cx = size.width / 2;
      const cy = size.height / 2;
      const t = transformRef.current;
      const gx = (cx - t.tx) / t.scale;
      const gy = (cy - t.ty) / t.scale;
      setT({ scale: next, tx: cx - gx * next, ty: cy - gy * next });
    })
    .onEnd(() => {
      pinching.current = false;
    });

  const tap = Gesture.Tap().runOnJS(true).onEnd((e) => {
    const t = transformRef.current;
    const gx = (e.x - t.tx) / t.scale;
    const gy = (e.y - t.ty) / t.scale;
    handleTap(gx, gy);
  });

  const gesture = Gesture.Simultaneous(pinch, pan, tap);

  const showEdgeLabel = (e: KnowledgeEdge) =>
    mode === 'path' ||
    (focusedNodeId !== null && (e.source === focusedNodeId || e.target === focusedNodeId));

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.canvas} onLayout={onLayout}>
        {size.width > 0 && (
          <Svg width={size.width} height={size.height} style={styles.svg}>
            {/* 只有 transform 字符串变化，memo 子组件不重渲染 */}
            <G transform={`translate(${transform.tx} ${transform.ty}) scale(${transform.scale})`}>
              {edges.map((e) => {
                const a = positions[e.source];
                const b = positions[e.target];
                if (!a || !b) return null;
                const src = nodeById.get(e.source);
                const tgt = nodeById.get(e.target);
                if (!src || !tgt) return null;
                return (
                  <EdgeItem
                    key={e.id}
                    edge={e}
                    a={a}
                    b={b}
                    src={src}
                    tgt={tgt}
                    focusedNodeId={focusedNodeId}
                    showLabel={showEdgeLabel(e)}
                  />
                );
              })}
              {nodes.map((n) => {
                const p = positions[n.id];
                if (!p) return null;
                return (
                  <NodeItem
                    key={n.id}
                    node={n}
                    pos={p}
                    isFocused={focusedNodeId === n.id}
                    isNeighbor={neighbors.has(n.id)}
                    isSelected={selectedNodeId === n.id}
                    isDragging={draggingNodeId === n.id}
                    focusedNodeId={focusedNodeId}
                  />
                );
              })}
            </G>
          </Svg>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: BG,
    overflow: 'hidden',
  },
  svg: {
    backgroundColor: BG,
  },
});
