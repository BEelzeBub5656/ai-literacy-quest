// 图布局：力导向布局、层级（学习路径）布局、视图自适应。
// 参考《类 Obsidian 知识关系图谱设计方案》第 4.2 / 13 / 19 节。

import type { KnowledgeEdge, RelationType } from './contracts';

export type Point = { x: number; y: number };
export type Positions = Record<string, Point>;

const DEFAULT_SIZE = 1000;

/**
 * 力导向布局（Fruchterman-Reingold 风格）：
 * 节点间斥力 + 边弹簧引力 + 向心力，迭代收敛后停止。
 * 初始位置用确定性环形分布，保证每次打开布局稳定、不抖动。
 */
export type ForceParams = {
  /** 节点间排斥力强度（越大节点越分散）。 */
  repulse: number;
  /** 相连节点间弹簧吸引力（越大连线越短）。 */
  spring: number;
  /** 向心力（越大整体越紧凑居中）。 */
  gravity: number;
  /** 理想连线长度倍率（越大节点间距越大）。 */
  linkDistance: number;
};

export const DEFAULT_FORCE_PARAMS: ForceParams = {
  repulse: 7200,
  spring: 0.045,
  gravity: 0.02,
  linkDistance: 1,
};

export function forceLayout(
  nodeIds: string[],
  edges: { source: string; target: string }[],
  options?: { size?: number; iterations?: number; force?: Partial<ForceParams> },
): Positions {
  const n = nodeIds.length;
  const size = options?.size ?? DEFAULT_SIZE;
  const iterations = options?.iterations ?? 120;
  if (n === 0) return {};

  const fp = { ...DEFAULT_FORCE_PARAMS, ...options?.force };

  const pos: Positions = {};
  const vel: Positions = {};
  nodeIds.forEach((id, i) => {
    const angle = (i / n) * Math.PI * 2;
    const radius = size * 0.34;
    pos[id] = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    vel[id] = { x: 0, y: 0 };
  });

  const k = (size / Math.sqrt(Math.max(n, 1))) * fp.linkDistance;
  const repulse = fp.repulse;
  const spring = fp.spring;
  const gravity = fp.gravity;
  const damping = 0.86;

  for (let it = 0; it < iterations; it++) {
    // 温度冷却：前 60% 迭代用全力度，后 40% 逐步降温以收敛。
    const temp = it < iterations * 0.6 ? 1 : (iterations - it) / (iterations * 0.4);
    const force: Positions = {};
    nodeIds.forEach((id) => (force[id] = { x: 0, y: 0 }));

    // 节点间斥力
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodeIds[i];
        const b = nodeIds[j];
        let dx = pos[a].x - pos[b].x;
        let dy = pos[a].y - pos[b].y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = repulse / (dist * dist);
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        force[a].x += fx;
        force[a].y += fy;
        force[b].x -= fx;
        force[b].y -= fy;
      }
    }

    // 边的弹簧引力
    for (const e of edges) {
      const a = pos[e.source];
      const b = pos[e.target];
      if (!a || !b) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = spring * (dist - k);
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;
      force[e.source].x += fx;
      force[e.source].y += fy;
      force[e.target].x -= fx;
      force[e.target].y -= fy;
    }

    // 向心力 + 积分
    nodeIds.forEach((id) => {
      const p = pos[id];
      const v = vel[id];
      const fr = force[id];
      fr.x += -p.x * gravity;
      fr.y += -p.y * gravity;
      v.x = (v.x + fr.x * temp) * damping;
      v.y = (v.y + fr.y * temp) * damping;
      p.x += v.x;
      p.y += v.y;
    });
  }

  // 居中到原点
  let cx = 0;
  let cy = 0;
  nodeIds.forEach((id) => {
    cx += pos[id].x;
    cy += pos[id].y;
  });
  cx /= n;
  cy /= n;
  nodeIds.forEach((id) => {
    pos[id].x -= cx;
    pos[id].y -= cy;
  });

  return pos;
}

/**
 * 层级布局（学习路径）：仅使用前置 / 包含关系，按最长路径分配层级，
 * 自上而下分层排列。
 */
export function layeredLayout(
  nodeIds: string[],
  edges: KnowledgeEdge[],
  hierarchyRelations: RelationType[],
): Positions {
  const hierarchy = edges.filter((e) => hierarchyRelations.includes(e.relation));
  const indeg = new Map<string, number>();
  const children = new Map<string, string[]>();
  nodeIds.forEach((id) => {
    indeg.set(id, 0);
    children.set(id, []);
  });
  for (const e of hierarchy) {
    if (!children.has(e.source) || !children.has(e.target)) continue;
    children.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }

  // 拓扑排序 + 最长路径层级
  const level = new Map<string, number>();
  const queue: string[] = [];
  nodeIds.forEach((id) => {
    if ((indeg.get(id) ?? 0) === 0) {
      level.set(id, 0);
      queue.push(id);
    }
  });
  while (queue.length) {
    const u = queue.shift()!;
    const lu = level.get(u) ?? 0;
    for (const v of children.get(u) ?? []) {
      level.set(v, Math.max(level.get(v) ?? 0, lu + 1));
      indeg.set(v, (indeg.get(v) ?? 0) - 1);
      if ((indeg.get(v) ?? 0) === 0) queue.push(v);
    }
  }
  nodeIds.forEach((id) => {
    if (!level.has(id)) level.set(id, 0);
  });

  // 按层分组并分配坐标
  const byLevel = new Map<number, string[]>();
  nodeIds.forEach((id) => {
    const l = level.get(id) ?? 0;
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l)!.push(id);
  });

  const colGap = 280;
  const rowGap = 160;
  const positions: Positions = {};
  const levels = Array.from(byLevel.keys()).sort((a, b) => a - b);
  for (const l of levels) {
    const arr = byLevel.get(l)!;
    arr.forEach((id, i) => {
      positions[id] = {
        x: l * colGap,
        y: (i - (arr.length - 1) / 2) * rowGap,
      };
    });
  }
  return positions;
}

export type ViewSize = { width: number; height: number };
export type Transform = { scale: number; tx: number; ty: number };

/** 计算把所有节点装进画布的初始变换（居中 + 等比缩放 + 留白）。 */
export function fitTransform(
  positions: Positions,
  size: ViewSize,
  padding = 64,
  maxScale = 1.4,
): Transform | null {
  const pts = Object.values(positions);
  if (!pts.length || !size.width || !size.height) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const gw = maxX - minX || 1;
  const gh = maxY - minY || 1;
  const scale = Math.max(
    0.2,
    Math.min((size.width - 2 * padding) / gw, (size.height - 2 * padding) / gh, maxScale),
  );
  const tx = (size.width - gw * scale) / 2 - minX * scale;
  const ty = (size.height - gh * scale) / 2 - minY * scale;
  return { scale, tx, ty };
}

/** 把某个节点居中到画布中心（搜索 / 聚焦时使用）。 */
export function centerOnNode(
  positions: Positions,
  size: ViewSize,
  nodeId: string,
  current: Transform,
  targetScale = 1.15,
): Transform | null {
  const p = positions[nodeId];
  if (!p || !size.width) return null;
  const scale = Math.max(current.scale, targetScale);
  return {
    scale,
    tx: size.width / 2 - p.x * scale,
    ty: size.height / 2 - p.y * scale,
  };
}

/** 点到线段的距离（用于边命中测试）。 */
export function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
