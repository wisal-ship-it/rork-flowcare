import demo from "@/data/demo_map.json";

export type NodeKind =
  | "entrance" | "clinic" | "service" | "elevator" | "stairs" | "ramp" | "junction" | "restroom" | "parking" | "kids";
export type NodeStatus = "open" | "maintenance" | "closed";
export type EdgeKind = "walk" | "ramp" | "stairs" | "elevator";
export type RouteType = "elderly" | "pregnant" | "urgent";
export type PlaceRole = "reception" | "triage" | "lab" | "cardiology" | "pharmacy" | "parking" | "kids" | "restroom";

export interface MapRect { x: number; y: number; w: number; h: number }
export interface MapFloor { id: string; level: number; code?: string; nameAr: string; nameEn: string; rooms?: MapRect[] }
export interface MapNode {
  id: string; kind: NodeKind; floor: string; x: number; y: number;
  nameAr?: string; nameEn?: string; code?: string; symbol?: string; searchable?: boolean; status?: NodeStatus; qr?: string;
}
export interface MapEdge { from: string; to: string; kind?: EdgeKind; meters?: number; accessible?: boolean; bidirectional?: boolean }
export interface MapDataset {
  schemaVersion?: number; id: string; version?: string; isDemo?: boolean; nameAr: string; nameEn: string;
  metersPerUnit?: number; defaultStart: string; roles?: Record<string, string>;
  floors: MapFloor[]; nodes: MapNode[]; edges: MapEdge[];
}

export const dataset = demo as MapDataset;

export const nodeAr = (n: MapNode) => n.nameAr ?? n.nameEn ?? n.id;
export const nodeEn = (n: MapNode) => n.nameEn ?? n.nameAr ?? n.id;
export const isOpen = (n: MapNode) => (n.status ?? "open") === "open";
export const isNamed = (n: MapNode) => n.kind !== "junction" && (n.nameAr != null || n.nameEn != null);
export const floorLabel = (f: MapFloor) => f.code ?? f.id;

export const scale = (d: MapDataset) => d.metersPerUnit ?? 140;
export const findNode = (d: MapDataset, id?: string | null) => (id ? d.nodes.find((n) => n.id === id) : undefined);
export const findFloor = (d: MapDataset, id?: string | null) => d.floors.find((f) => f.id === id);
export const nodeIDFor = (d: MapDataset, role: PlaceRole) => {
  const id = d.roles?.[role];
  return id && findNode(d, id) ? id : undefined;
};
export const floorsTopDown = (d: MapDataset) => [...d.floors].sort((a, b) => b.level - a.level);
export const destinations = (d: MapDataset) => d.nodes.filter((n) => n.searchable);
export const startPoints = (d: MapDataset) => d.nodes.filter((n) => n.kind === "entrance" || n.qr != null || n.searchable);
export const unavailableElevators = (d: MapDataset) => {
  const seen = new Set<string>();
  return d.nodes.filter((n) => n.kind === "elevator" && !isOpen(n)).filter((n) => {
    const k = n.code ?? n.id;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** Accepts `FC-START:<id>`, `flowcare://start/<id>`, a node's own `qr` value, or a bare node id. */
export function nodeForScannedCode(d: MapDataset, raw: string): MapNode | undefined {
  const code = raw.trim();
  const match = d.nodes.find((n) => n.qr === code);
  if (match) return match;
  for (const prefix of ["FC-START:", "flowcare://start/", "FLOWCARE-START:"]) {
    if (code.toLowerCase().startsWith(prefix.toLowerCase())) return findNode(d, code.slice(prefix.length));
  }
  return findNode(d, code);
}

// MARK: Routing

export interface RouteLeg { from: MapNode; to: MapNode; kind: EdgeKind; meters: number; vertical: boolean }
export type StepIcon =
  | "stairs" | "up" | "down" | "forward" | "roll" | "right" | "left" | "pin";
export interface RouteStep { id: number; ar: string; en: string; symbol: StepIcon; floor: string }
export interface MapRoute { nodes: MapNode[]; legs: RouteLeg[]; steps: RouteStep[]; meters: number }

const mkLeg = (from: MapNode, to: MapNode, kind: EdgeKind, meters: number): RouteLeg => ({
  from, to, kind, meters, vertical: from.floor !== to.floor || kind === "elevator" || kind === "stairs",
});

export const routeMinutes = (r: MapRoute) => Math.max(1, Math.ceil(r.meters / 60));
export function routeFloors(r: MapRoute) {
  const out: string[] = [];
  for (const n of r.nodes) if (out[out.length - 1] !== n.floor) out.push(n.floor);
  return out;
}
export function polylines(r: MapRoute, floor: string): { x: number; y: number }[][] {
  const lines: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const leg of r.legs) {
    if (!leg.vertical && leg.from.floor === floor) {
      if (current.length === 0) current.push({ x: leg.from.x, y: leg.from.y });
      current.push({ x: leg.to.x, y: leg.to.y });
    } else if (current.length) {
      lines.push(current);
      current = [];
    }
  }
  if (current.length) lines.push(current);
  if (!lines.length && r.nodes.length === 1 && r.nodes[0].floor === floor) lines.push([{ x: r.nodes[0].x, y: r.nodes[0].y }]);
  return lines;
}
export function transitions(r: MapRoute, floor: string): MapNode[] {
  const seen = new Set<string>();
  return r.legs.filter((l) => l.vertical).flatMap((l) => [l.from, l.to]).filter((n) => {
    if (n.floor !== floor || seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
}

export function route(d: MapDataset, startID: string, endID: string, type: RouteType): MapRoute | null {
  const start = findNode(d, startID), end = findNode(d, endID);
  if (!start || !end) return null;
  if (start.id === end.id) return { nodes: [start], legs: [], steps: buildSteps([start], [], d), meters: 0 };
  const index = new Map(d.nodes.map((n, i) => [n.id, i] as const));
  const adjacency: { to: number; kind: EdgeKind; meters: number; cost: number }[][] = d.nodes.map(() => []);
  const stepFree = type === "elderly" || type === "pregnant";
  const blocked = (n: MapNode) => !isOpen(n) && n.id !== start.id && n.id !== end.id;

  for (const e of d.edges) {
    const a = index.get(e.from), b = index.get(e.to);
    if (a == null || b == null) continue;
    const na = d.nodes[a], nb = d.nodes[b];
    const kind: EdgeKind = e.kind ?? (na.floor === nb.floor ? "walk" : "elevator");
    if (stepFree && (kind === "stairs" || e.accessible === false)) continue;
    if (blocked(na) || blocked(nb)) continue;
    const meters = e.meters ?? (na.floor === nb.floor ? Math.hypot(na.x - nb.x, na.y - nb.y) * scale(d) : 20);
    let cost = meters;
    if (type === "elderly" && kind === "ramp") cost *= 0.55;
    if (kind === "elevator") cost += 4;
    adjacency[a].push({ to: b, kind, meters, cost });
    if (e.bidirectional ?? true) adjacency[b].push({ to: a, kind, meters, cost });
  }

  const s = index.get(start.id)!, t = index.get(end.id)!;
  const dist = d.nodes.map(() => Infinity);
  const prev = d.nodes.map(() => ({ node: -1, kind: "walk" as EdgeKind, meters: 0 }));
  const done = d.nodes.map(() => false);
  dist[s] = 0;
  for (let k = 0; k < d.nodes.length; k++) {
    let u = -1;
    for (let i = 0; i < dist.length; i++) if (!done[i] && dist[i] < Infinity && (u === -1 || dist[i] < dist[u])) u = i;
    if (u === -1 || u === t) break;
    done[u] = true;
    for (const edge of adjacency[u]) {
      if (dist[u] + edge.cost < dist[edge.to]) {
        dist[edge.to] = dist[u] + edge.cost;
        prev[edge.to] = { node: u, kind: edge.kind, meters: edge.meters };
      }
    }
  }
  if (!(dist[t] < Infinity)) return null;

  const path = [t];
  const legs: RouteLeg[] = [];
  let cur = t;
  while (cur !== s) {
    const p = prev[cur];
    legs.unshift(mkLeg(d.nodes[p.node], d.nodes[cur], p.kind, p.meters));
    path.unshift(p.node);
    cur = p.node;
  }
  const nodes = path.map((i) => d.nodes[i]);
  const meters = Math.round(legs.reduce((sum, l) => sum + l.meters, 0));
  return { nodes, legs, steps: buildSteps(nodes, legs, d), meters };
}

const angle = (l: RouteLeg) => (Math.atan2(l.to.y - l.from.y, l.to.x - l.from.x) * 180) / Math.PI;
function turn(a: RouteLeg, b: RouteLeg) {
  let diff = angle(b) - angle(a);
  while (diff > 180) diff -= 360;
  while (diff <= -180) diff += 360;
  return diff;
}

export function buildSteps(nodes: MapNode[], legs: RouteLeg[], d: MapDataset): RouteStep[] {
  const start = nodes[0], end = nodes[nodes.length - 1];
  if (!start || !end) return [];
  const steps: Omit<RouteStep, "id">[] = [];
  let i = 0;
  while (i < legs.length) {
    const leg = legs[i];
    if (leg.vertical) {
      let j = i;
      while (j < legs.length && legs[j].vertical && legs[j].kind === leg.kind) j++;
      const target = legs[j - 1].to;
      const fl = findFloor(d, target.floor);
      const up = (fl?.level ?? 0) > (findFloor(d, leg.from.floor)?.level ?? 0);
      const fAr = fl?.nameAr ?? target.floor, fEn = fl?.nameEn ?? target.floor;
      if (leg.kind === "stairs") {
        steps.push({
          ar: up ? `اصعد الدرج إلى ${fAr}` : `انزل الدرج إلى ${fAr}`,
          en: up ? `Take the stairs up to the ${fEn}` : `Take the stairs down to the ${fEn}`,
          symbol: "stairs", floor: leg.from.floor,
        });
      } else {
        steps.push({
          ar: `اركب ${nodeAr(leg.from)} إلى ${fAr}`, en: `Take ${nodeEn(leg.from)} to the ${fEn}`,
          symbol: up ? "up" : "down", floor: leg.from.floor,
        });
      }
      i = j;
      continue;
    }
    let meters = leg.meters;
    let ramp = leg.kind === "ramp";
    let j = i + 1;
    while (j < legs.length && !legs[j].vertical && Math.abs(turn(legs[j - 1], legs[j])) < 25) {
      meters += legs[j].meters;
      ramp = ramp || legs[j].kind === "ramp";
      j++;
    }
    const m = Math.max(Math.round(meters), 3);
    const walkAr = ramp ? `اتبع ممر المنحدر ${m} متراً` : `امشِ للأمام ${m} متراً`;
    const walkEn = ramp ? `Follow the ramp corridor for ${m} meters` : `Walk forward ${m} meters`;
    const runEnd = legs[j - 1].to;
    let ar: string, en: string, symbol: StepIcon;
    if (j === legs.length) {
      ar = `${walkAr} حتى تصل إلى ${nodeAr(end)}`;
      en = `${walkEn} to reach ${nodeEn(end)}`;
      symbol = "forward";
    } else if (legs[j].vertical) {
      ar = `${walkAr} حتى ${nodeAr(runEnd)}`;
      en = `${walkEn} to ${nodeEn(runEnd)}`;
      symbol = ramp ? "roll" : "forward";
    } else {
      const right = turn(legs[j - 1], legs[j]) > 0;
      const at = isNamed(runEnd);
      ar = `${walkAr}، ثم اتجه ${right ? "يميناً" : "يساراً"}${at ? ` عند ${nodeAr(runEnd)}` : ""}`;
      en = `${walkEn}, then turn ${right ? "right" : "left"}${at ? ` at ${nodeEn(runEnd)}` : ""}`;
      symbol = right ? "right" : "left";
    }
    if (i === 0) {
      ar = `ابدأ من ${nodeAr(start)}. ` + ar;
      en = `Start at ${nodeEn(start)}. ` + en;
    }
    steps.push({ ar, en, symbol, floor: leg.from.floor });
    i = j;
  }
  const code = end.code ? ` ${end.code}` : "";
  steps.push({ ar: `لقد وصلت إلى ${nodeAr(end)}${code}`, en: `You have arrived at ${nodeEn(end)}${code}`, symbol: "pin", floor: end.floor });
  return steps.map((s, id) => ({ ...s, id }));
}
