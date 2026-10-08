import {
  DecodedFrameData,
  GridCell,
  HazardInfo,
  LifoveaDataset,
  LidarFrame,
  LidarMeta,
  NavTile,
  SyntheticObstacle,
} from '../types/lifovea';
import {
  applyOcclusionShadows,
  synthesizeObstaclePoints,
} from './syntheticObstacles';

export function decodeTypedArray<T extends Int16Array | Int8Array>(
  b64: string,
  Ctor: new (buffer: ArrayBuffer) => T
): T {
  const bin = atob(b64);
  const n = bin.length;
  const u8 = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8[i] = bin.charCodeAt(i);
  }
  return new Ctor(u8.buffer);
}

const DECODE_CACHE = new Map<number, DecodedFrameData>();

export function getFrameData(i: number, frames: LidarFrame[]): DecodedFrameData {
  if (DECODE_CACHE.has(i)) return DECODE_CACHE.get(i)!;
  const f = frames[i];
  const d: DecodedFrameData = {
    x: typeof f.x === 'string' ? decodeTypedArray(f.x, Int16Array) : f.x,
    y: typeof f.y === 'string' ? decodeTypedArray(f.y, Int16Array) : f.y,
    z: typeof f.z === 'string' ? decodeTypedArray(f.z, Int16Array) : f.z,
    label: typeof f.label === 'string' ? decodeTypedArray(f.label, Int8Array) : f.label,
    meta: f,
  };
  DECODE_CACHE.set(i, d);
  return d;
}

const XCACHE = new Map<string, DecodedFrameData>();

export function pointsIn(
  i: number,
  ref: number,
  frames: LidarFrame[]
): DecodedFrameData {
  if (i === ref) return getFrameData(i, frames);
  const k = i + ':' + ref;
  if (XCACHE.has(k)) return XCACHE.get(k)!;

  const f = frames[i];
  const c = frames[ref];
  const d = getFrameData(i, frames);

  const cf = Math.cos(f.yaw);
  const sf = Math.sin(f.yaw);
  const cc = Math.cos(-c.yaw);
  const sc = Math.sin(-c.yaw);
  const ox = f.sensor[0] - c.sensor[0];
  const oy = f.sensor[1] - c.sensor[1];
  const oz = f.sensor[2] - c.sensor[2];

  const n = d.x.length;
  const X = new Int16Array(n);
  const Y = new Int16Array(n);
  const Z = new Int16Array(n);

  for (let t = 0; t < n; t++) {
    const px = d.x[t] / 100;
    const py = d.y[t] / 100;
    const wx = cf * px - sf * py + ox;
    const wy = sf * px + cf * py + oy;
    X[t] = Math.round((cc * wx - sc * wy) * 100);
    Y[t] = Math.round((sc * wx + cc * wy) * 100);
    Z[t] = d.z[t] + Math.round(oz * 100);
  }

  const out: DecodedFrameData = {
    x: X,
    y: Y,
    z: Z,
    label: d.label,
    meta: f,
  };
  XCACHE.set(k, out);
  return out;
}

/**
 * Merges synthetic obstacle points with sensor scan points.
 * Optionally applies LiDAR occlusion shadows behind solid obstacles.
 */
export function injectSyntheticObstacles(
  scan: DecodedFrameData,
  obstacles: SyntheticObstacle[],
  enableShadows: boolean
): {
  x: Int16Array;
  y: Int16Array;
  z: Int16Array;
  label: Int8Array;
  meta: LidarFrame;
  syntheticCount: number;
} {
  const activeObs = obstacles.filter((o) => o.enabled);
  if (activeObs.length === 0) {
    return { ...scan, syntheticCount: 0 };
  }

  let basePoints = {
    x: scan.x,
    y: scan.y,
    z: scan.z,
    label: scan.label,
  };

  if (enableShadows) {
    basePoints = applyOcclusionShadows(basePoints, activeObs);
  }

  // Synthesize points for all active obstacles
  const allSynX: number[] = [];
  const allSynY: number[] = [];
  const allSynZ: number[] = [];
  const allSynL: number[] = [];

  for (const obs of activeObs) {
    const syn = synthesizeObstaclePoints(obs);
    for (let k = 0; k < syn.x.length; k++) {
      allSynX.push(syn.x[k]);
      allSynY.push(syn.y[k]);
      allSynZ.push(syn.z[k]);
      allSynL.push(syn.label[k]);
    }
  }

  const totalN = basePoints.x.length + allSynX.length;
  const mergedX = new Int16Array(totalN);
  const mergedY = new Int16Array(totalN);
  const mergedZ = new Int16Array(totalN);
  const mergedL = new Int8Array(totalN);

  mergedX.set(basePoints.x, 0);
  mergedY.set(basePoints.y, 0);
  mergedZ.set(basePoints.z, 0);
  mergedL.set(basePoints.label, 0);

  const offset = basePoints.x.length;
  for (let k = 0; k < allSynX.length; k++) {
    mergedX[offset + k] = allSynX[k];
    mergedY[offset + k] = allSynY[k];
    mergedZ[offset + k] = allSynZ[k];
    mergedL[offset + k] = allSynL[k];
  }

  return {
    x: mergedX,
    y: mergedY,
    z: mergedZ,
    label: mergedL,
    meta: scan.meta,
    syntheticCount: allSynX.length,
  };
}

export function leafLevel(
  x: number,
  y: number,
  base: number,
  rings: number[],
  nLevels: number
): number {
  for (let L = nLevels - 1; L >= 1; L--) {
    const r = base * (1 << L);
    const x0 = Math.floor(x / r) * r;
    const y0 = Math.floor(y / r) * r;
    const dx = Math.max(x0, -(x0 + r), 0);
    const dy = Math.max(y0, -(y0 + r), 0);
    if (Math.sqrt(dx * dx + dy * dy) >= rings[L]) return L;
  }
  return 0;
}

export function buildGrid(
  scans: Array<{ x: Int16Array; y: Int16Array; z: Int16Array; label: Int8Array }>,
  base: number,
  rings: number[],
  meta: LidarMeta
): {
  cells: GridCell[];
  perLevel: Int32Array;
  map: Map<number, GridCell>;
  points: number;
} {
  const nL = meta.n_levels;
  const maxR = meta.max_range;
  const cells = new Map<number, GridCell>();
  const perLevel = new Int32Array(nL);
  let total = 0;

  for (const fd of scans) {
    const { x, y, z, label } = fd;
    const n = x.length;
    total += n;
    for (let i = 0; i < n; i++) {
      const px = x[i] / 100;
      const py = y[i] / 100;
      const pz = z[i] / 100;
      if (Math.abs(px) > maxR || Math.abs(py) > maxR) continue;

      const L = leafLevel(px, py, base, rings, nL);
      const r = base * (1 << L);
      const ix = Math.floor(px / r);
      const iy = Math.floor(py / r);
      const key = L * 4398046511104 + (ix + 65536) * 2097152 + (iy + 65536);

      let c = cells.get(key);
      if (c === undefined) {
        c = {
          L: L,
          r: r,
          cx: (ix + 0.5) * r,
          cy: (iy + 0.5) * r,
          n: 0,
          zs: 0,
          zmin: Infinity,
          zmax: -Infinity,
          k: [0, 0, 0, 0],
          g: 0,
          gz: 0,
          z: 0,
          cls: 0,
          relief: 0,
        };
        cells.set(key, c);
        perLevel[L]++;
      }

      const cl = label[i];
      c.n++;
      if (cl >= 0 && cl <= 3) {
        c.k[cl]++;
      }
      if (pz < c.zmin) c.zmin = pz;
      if (pz > c.zmax) c.zmax = pz;
      if (cl <= 1) {
        c.g++;
        c.gz += pz;
      }
      c.zs += pz;
    }
  }

  const arr = new Array<GridCell>(cells.size);
  let i = 0;
  for (const c of cells.values()) {
    c.z = c.g > 0 ? c.gz / c.g : c.zs / c.n;
    let best = 0;
    for (let k = 1; k < 4; k++) {
      if (c.k[k] > c.k[best]) best = k;
    }
    c.cls = best;
    c.relief = c.g > 0 ? c.zmax - c.zmin : 0;
    arr[i++] = c;
  }

  return { cells: arr, perLevel, map: cells, points: total };
}

export function buildNav(
  cells: GridCell[],
  meta: LidarMeta
): {
  list: NavTile[];
  index: Map<number, number>;
  key: (ix: number, iy: number) => number;
} {
  const t = meta.nav_cell;
  const maxStep = meta.max_step_height;
  const tiles = new Map<number, NavTile>();
  const tkey = (ix: number, iy: number) => (ix + 65536) * 2097152 + (iy + 65536);

  for (const c of cells) {
    const solid = c.cls >= 2;
    const ground = !solid && c.relief <= maxStep;
    const f = Math.max(1, Math.round(c.r / t));
    const ix0 = Math.floor((c.cx - c.r / 2 + 1e-6) / t);
    const iy0 = Math.floor((c.cy - c.r / 2 + 1e-6) / t);

    for (let a = 0; a < f; a++) {
      for (let b = 0; b < f; b++) {
        const ix = f === 1 ? Math.floor(c.cx / t) : ix0 + a;
        const iy = f === 1 ? Math.floor(c.cy / t) : iy0 + b;
        const k = tkey(ix, iy);
        let q = tiles.get(k);
        if (q === undefined) {
          q = {
            ix: ix,
            iy: iy,
            cx: (ix + 0.5) * t,
            cy: (iy + 0.5) * t,
            zmin: Infinity,
            zmax: -Infinity,
            zs: 0,
            ng: 0,
            blocked: false,
            z: NaN,
            relief: 0,
            passable: false,
            nb: [-1, -1, -1, -1],
            nd: [0, 0, 0, 0],
            slope: 0,
            reach: false,
          };
          tiles.set(k, q);
        }
        if (solid) q.blocked = true;
        if (ground) {
          q.ng++;
          q.zs += c.z;
          if (c.z < q.zmin) q.zmin = c.z;
          if (c.z > q.zmax) q.zmax = c.z;
        }
      }
    }
  }

  const list = Array.from(tiles.values());
  const index = new Map<number, number>();
  list.forEach((q, i) => {
    index.set(tkey(q.ix, q.iy), i);
    q.z = q.ng ? q.zs / q.ng : NaN;
    q.relief = q.ng ? q.zmax - q.zmin : 0;
    q.passable = q.ng > 0 && !q.blocked && q.relief <= maxStep;
  });

  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const maxSlope = meta.max_slope_deg;
  const maxStep2 = maxStep;

  list.forEach((q) => {
    q.nb = [-1, -1, -1, -1];
    q.nd = [0, 0, 0, 0];
    q.slope = 0;
    for (let d = 0; d < 4; d++) {
      for (let s = 1; s <= 10; s++) {
        const j = index.get(tkey(q.ix + DIRS[d][0] * s, q.iy + DIRS[d][1] * s));
        if (j !== undefined) {
          q.nb[d] = j;
          q.nd[d] = s * meta.nav_cell;
          break;
        }
      }
    }
  });

  list.forEach((q) => {
    for (let d = 0; d < 4; d++) {
      const j = q.nb[d];
      if (j < 0) continue;
      const o = list[j];
      if (!(q.ng > 0 && o.ng > 0)) continue;
      const dz = Math.abs(q.z - o.z);
      q.slope = Math.max(
        q.slope,
        (Math.atan2(dz, Math.max(q.nd[d], 1e-3)) * 180) / Math.PI
      );
    }
    q.passable = q.passable && q.slope <= maxSlope;
  });

  // Reachability: Dominant connected component
  const comp = new Int32Array(list.length).fill(-1);
  let nc = 0;
  const maxLink = 2 * meta.nav_cell + 1e-6;

  for (let i = 0; i < list.length; i++) {
    if (comp[i] >= 0 || !list[i].passable) continue;
    const stack = [i];
    comp[i] = nc;
    while (stack.length) {
      const a = stack.pop()!;
      const q = list[a];
      for (let d = 0; d < 4; d++) {
        const j = q.nb[d];
        if (j < 0 || comp[j] >= 0) continue;
        const o = list[j];
        if (!o.passable || q.nd[d] > maxLink) continue;
        if (Math.abs(o.z - q.z) > maxStep2) continue;
        comp[j] = nc;
        stack.push(j);
      }
    }
    nc++;
  }

  const votes = new Int32Array(nc);
  list.forEach((q, i) => {
    if (comp[i] >= 0 && Math.hypot(q.cx, q.cy) < 14.0) {
      votes[comp[i]]++;
    }
  });

  let win = -1;
  let bestv = 0;
  for (let c = 0; c < nc; c++) {
    if (votes[c] > bestv) {
      bestv = votes[c];
      win = c;
    }
  }

  list.forEach((q, i) => {
    q.reach = comp[i] === win && q.passable;
  });

  return { list, index, key: tkey };
}

export function planRoute(
  nav: { list: NavTile[]; index: Map<number, number> },
  goal: [number, number],
  meta: LidarMeta
): NavTile[] | null {
  const list = nav.list;
  const usable = (i: number) => list[i].passable && list[i].reach;

  let start = -1;
  let best = Infinity;
  let gi = -1;
  let gbest = Infinity;

  list.forEach((q, i) => {
    if (!usable(i)) return;
    const d0 = q.cx * q.cx + q.cy * q.cy;
    if (d0 < best) {
      best = d0;
      start = i;
    }
    const dg = (q.cx - goal[0]) ** 2 + (q.cy - goal[1]) ** 2;
    if (dg < gbest) {
      gbest = dg;
      gi = i;
    }
  });

  if (start < 0 || gi < 0) return null;

  const N = list.length;
  const g = new Float64Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const done = new Uint8Array(N);

  g[start] = 0;
  const open: Array<[number, number]> = [[0, start]];
  const maxStep = meta.max_step_height;
  const maxSlope = meta.max_slope_deg;

  while (open.length) {
    open.sort((a, b) => b[0] - a[0]);
    const [, cur] = open.pop()!;
    if (done[cur]) continue;
    done[cur] = 1;
    if (cur === gi) break;

    const q = list[cur];
    for (let d = 0; d < 4; d++) {
      const j = q.nb[d];
      if (j < 0 || done[j] || !usable(j)) continue;
      const o = list[j];
      const dz = Math.abs(o.z - q.z);
      if (dz > maxStep) continue;

      const rough = Math.min(1, o.slope / maxSlope);
      const cost = q.nd[d] * (1 + 2.5 * rough) + 6 * dz;
      if (g[cur] + cost < g[j]) {
        g[j] = g[cur] + cost;
        came[j] = cur;
        open.push([g[j] + Math.hypot(o.cx - goal[0], o.cy - goal[1]), j]);
      }
    }
  }

  if (!isFinite(g[gi])) return null;

  const path: NavTile[] = [];
  for (let k = gi; k >= 0; k = came[k]) {
    path.push(list[k]);
  }
  path.reverse();
  return path;
}

export function evaluateHazard(
  currentPoints: { x: Int16Array; y: Int16Array; label: Int8Array },
  prevDistance: number,
  obstacles: SyntheticObstacle[],
  meta: LidarMeta
): HazardInfo {
  const maxForward = 24.0;
  const laneHalfWidth = 2.2;
  let nearest = Infinity;
  let label = -1;
  let isSynthetic = false;
  let closestObsName: string | undefined;

  // Check real & merged points
  const n = currentPoints.x.length;
  for (let p = 0; p < n; p++) {
    const x = currentPoints.x[p] / 100;
    const y = currentPoints.y[p] / 100;
    if (
      currentPoints.label[p] < 2 ||
      x < 0 ||
      x > maxForward ||
      Math.abs(y) > laneHalfWidth
    ) {
      continue;
    }
    const dist = Math.hypot(x, y);
    if (dist < nearest) {
      nearest = dist;
      label = currentPoints.label[p];
    }
  }

  // Specifically check active synthetic obstacles in lane
  for (const obs of obstacles) {
    if (!obs.enabled) continue;
    if (
      obs.x >= 0 &&
      obs.x <= maxForward &&
      Math.abs(obs.y) <= laneHalfWidth + obs.width / 2
    ) {
      const dist = Math.hypot(obs.x, obs.y) - obs.length / 2;
      if (dist < nearest) {
        nearest = Math.max(0.1, dist);
        label = obs.semanticClass;
        isSynthetic = true;
        closestObsName = obs.name;
      }
    }
  }

  let level: 'clear' | 'warning' | 'critical' = 'clear';
  if (nearest <= 4.0) {
    level = 'critical';
  } else if (nearest <= 8.0) {
    level = 'warning';
  }

  const closing = prevDistance - nearest > 0.05;
  const relativeSpeed = closing ? prevDistance - nearest : 0;
  const ttcSeconds =
    relativeSpeed > 0 && isFinite(nearest) ? nearest / (relativeSpeed * 10) : undefined;

  return {
    level,
    distance: nearest,
    label: label >= 0 ? label : 2,
    source: isSynthetic ? 'synthetic' : 'real',
    obstacleName: closestObsName,
    ttcSeconds,
    closing,
  };
}

export const HYPSO_STOPS: Array<[number, [number, number, number]]> = [
  [0, [31, 68, 92]],
  [0.22, [44, 118, 110]],
  [0.45, [133, 161, 106]],
  [0.68, [208, 183, 125]],
  [0.86, [199, 138, 79]],
  [1, [243, 239, 230]],
];

export const TRAV_STOPS: Array<[number, [number, number, number]]> = [
  [0, [176, 62, 45]],
  [0.5, [199, 138, 43]],
  [1, [46, 125, 107]],
];

export const LODC_COLORS: Array<[number, number, number]> = [
  [46, 92, 140],
  [63, 130, 160],
  [120, 160, 150],
  [190, 170, 120],
  [200, 130, 90],
];

export function rampColor(
  t: number,
  stops: Array<[number, [number, number, number]]>
): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1];
      const b = stops[i];
      const u = (t - a[0]) / Math.max(b[0] - a[0], 1e-6);
      return [0, 1, 2].map((k) =>
        Math.round(a[1][k] + u * (b[1][k] - a[1][k]))
      ) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

export function rgbString(c: [number, number, number]): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
