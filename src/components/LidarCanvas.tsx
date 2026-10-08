import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  GridCell,
  HazardInfo,
  LifoveaDataset,
  LidarFrame,
  LidarMeta,
  NavTile,
  SyntheticObstacle,
} from '../types/lifovea';
import {
  HYPSO_STOPS,
  leafLevel,
  LODC_COLORS,
  rampColor,
  rgbString,
  TRAV_STOPS,
} from '../lib/lifoveaEngine';
import { obstaclesToCityObjects } from '../lib/syntheticObstacles';

interface Props {
  dataset: LifoveaDataset;
  currentFrameIdx: number;
  grid: { cells: GridCell[]; perLevel: Int32Array; map: Map<number, GridCell> } | null;
  nav: { list: NavTile[]; index: Map<number, number> } | null;
  plannedPath: NavTile[] | null;
  currentScanPoints: { x: Int16Array; y: Int16Array; z: Int16Array; label: Int8Array } | null;
  syntheticObstacles: SyntheticObstacle[];
  onUpdateObstaclePos: (id: string, x: number, y: number) => void;
  onAddObstacleAt: (x: number, y: number) => void;
  onDropGoal: (goal: [number, number]) => void;
  extent: number;
  baseCell: number;
  rings: number[];
  activeLayer: string;
  viewMode: 'bev' | 'city';
  showRings: boolean;
  showEdges: boolean;
  showReturns: boolean;
  showZones: boolean;
  nearView: boolean;
  hazardInfo: HazardInfo;
  placementMode: string | null;
  selectedObstacleId: string | null;
  setSelectedObstacleId: (id: string | null) => void;
}

export const LidarCanvas: React.FC<Props> = ({
  dataset,
  currentFrameIdx,
  grid,
  nav,
  plannedPath,
  currentScanPoints,
  syntheticObstacles,
  onUpdateObstaclePos,
  onAddObstacleAt,
  onDropGoal,
  extent,
  baseCell,
  rings,
  activeLayer,
  viewMode,
  showRings,
  showEdges,
  showReturns,
  showZones,
  nearView,
  hazardInfo,
  placementMode,
  selectedObstacleId,
  setSelectedObstacleId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    html: string;
  } | null>(null);

  const [draggingObsId, setDraggingObsId] = useState<string | null>(null);
  const [scalebarInfo, setScalebarInfo] = useState<{
    lo: string;
    hi: string;
    name: string;
    gradient: string;
  }>({
    lo: '—',
    hi: '—',
    name: '',
    gradient: '',
  });

  const getCssVar = (name: string, fallback: string): string => {
    if (typeof window === 'undefined') return fallback;
    const val = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return val || fallback;
  };

  const project = useCallback(
    (x: number, y: number, viewSize: number): [number, number] => {
      const s = viewSize / (2 * extent);
      return [viewSize / 2 + x * s, viewSize / 2 - y * s];
    },
    [extent]
  );

  const unproject = useCallback(
    (px: number, py: number, viewSize: number): [number, number] => {
      const s = viewSize / (2 * extent);
      return [(px - viewSize / 2) / s, (viewSize / 2 - py) / s];
    },
    [extent]
  );

  const cellColour = useCallback(
    (c: GridCell, zlo: number, zhi: number, classColors: string[]) => {
      switch (activeLayer) {
        case 'class':
          return classColors[c.cls] || classColors[0];
        case 'lod':
          return rgbString(LODC_COLORS[c.L] || LODC_COLORS[0]);
        case 'relief':
          return rgbString(
            rampColor(Math.min(1, c.relief / 0.35), HYPSO_STOPS)
          );
        case 'trav': {
          if (c.cls >= 2) return 'rgb(150,60,48)';
          const t = c.tile;
          if (!t || !t.passable) return 'rgb(176,62,45)';
          if (!t.reach) return 'rgb(150,130,90)';
          return rgbString(
            rampColor(
              1 - Math.min(1, t.slope / dataset.meta.max_slope_deg),
              TRAV_STOPS
            )
          );
        }
        default:
          return rgbString(
            rampColor(
              (c.z - zlo) / Math.max(zhi - zlo, 1e-3),
              HYPSO_STOPS
            )
          );
      }
    },
    [activeLayer, dataset.meta.max_slope_deg]
  );

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    const w = container ? container.clientWidth : 800;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.max(340, Math.round(w));

    canvas.style.height = `${px}px`;
    canvas.width = Math.round(px * dpr);
    canvas.height = Math.round(px * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const size = px;
    const s = size / (2 * extent);

    const paperColor = getCssVar('--paper', '#F6F3EC');
    const paper2Color = getCssVar('--paper-2', '#EFEADF');
    const panelColor = getCssVar('--panel', '#FDFBF6');
    const inkColor = getCssVar('--ink', '#191F28');
    const ink2Color = getCssVar('--ink-2', '#4A5462');
    const ink3Color = getCssVar('--ink-3', '#7C8592');
    const blueColor = getCssVar('--blue', '#1F5C8C');
    const blueSoft = getCssVar('--blue-soft', '#DCE8F1');
    const gridInk = getCssVar('--grid-ink', '#B9AF9B');
    const oxideColor = getCssVar('--oxide', '#B3492D');
    const classColors = [
      getCssVar('--c0', '#2E7D6B'),
      getCssVar('--c1', '#C78A2B'),
      getCssVar('--c2', '#5B6B86'),
      getCssVar('--c3', '#C0392B'),
    ];

    // ==========================================
    // 1. CITY VIEW (3D FORWARD PERSPECTIVE)
    // ==========================================
    if (viewMode === 'city') {
      const horizon = size * 0.37;
      const raw = currentScanPoints;
      const viewRange = nearView ? dataset.meta.near_zone_radius : dataset.meta.max_range;
      const focal = size * 0.78;

      ctx.fillStyle = panelColor;
      ctx.fillRect(0, 0, size, size);

      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, blueSoft);
      sky.addColorStop(1, panelColor);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, size, horizon);

      ctx.fillStyle = paper2Color;
      ctx.fillRect(0, horizon, size, size - horizon);

      const current = dataset.frames[currentFrameIdx];
      const cityObjects = [
        ...(current.city || []),
        ...obstaclesToCityObjects(syntheticObstacles),
      ];
      const yaw = current.yaw;
      const cy = Math.cos(-yaw);
      const sy = Math.sin(-yaw);
      const ox = current.sensor[0];
      const oy = current.sensor[1];
      const oz = current.sensor[2];

      const cityProject = (x: number, y: number, z: number): [number, number] | null => {
        const dx = x - ox;
        const dy = y - oy;
        const forward = cy * dx - sy * dy;
        const lateral = sy * dx + cy * dy;
        if (forward < 0.5 || forward > viewRange) return null;
        const scale = focal / forward;
        return [size / 2 - lateral * scale, horizon - (z - oz) * scale];
      };

      // Draw city 3D boxes
      for (const object of cityObjects) {
        const p = object.params;
        const corners: Array<[number, number] | null> = [];
        if (object.kind === 0) {
          for (const x of [p[0], p[3]]) {
            for (const y of [p[1], p[4]]) {
              for (const z of [p[2], p[5]]) {
                corners.push(cityProject(x, y, z));
              }
            }
          }
        }
        const visible = corners.filter((v): v is [number, number] => v !== null);
        if (!visible.length) continue;

        const xs = visible.map((v) => v[0]);
        const ys = visible.map((v) => v[1]);
        const left = Math.min(...xs);
        const right = Math.max(...xs);
        const top = Math.min(...ys);
        const bottom = Math.max(...ys);

        const color = classColors[object.label] || ink3Color;
        ctx.fillStyle = color;
        ctx.globalAlpha = object.label >= 3 ? 0.6 : 0.3;
        ctx.fillRect(left, top, Math.max(2, right - left), Math.max(2, bottom - top));
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(left, top, Math.max(2, right - left), Math.max(2, bottom - top));
      }
      ctx.globalAlpha = 1;

      // Project forward LiDAR points
      if (raw) {
        for (let i = 0; i < raw.x.length; i++) {
          const x = raw.x[i] / 100;
          const y = raw.y[i] / 100;
          const z = raw.z[i] / 100;
          if (x < 1.0 || x > viewRange || Math.abs(y) > viewRange) continue;
          const scale = focal / x;
          const pxPoint = size / 2 - y * scale;
          const pyPoint = horizon - z * scale;
          if (pxPoint < 0 || pxPoint > size || pyPoint < 0 || pyPoint > size) continue;

          ctx.globalAlpha = Math.max(0.16, 1 - x / (viewRange * 1.15));
          ctx.fillStyle = classColors[raw.label[i]] || ink3Color;
          const pointSize = Math.max(1, Math.min(4, scale * 0.018));
          ctx.fillRect(pxPoint, pyPoint, pointSize, pointSize);
        }
      }
      ctx.globalAlpha = 1;

      // Horizon line
      ctx.strokeStyle = gridInk;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(size, horizon);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = ink2Color;
      ctx.font = '600 12px IBM Plex Mono, monospace';
      ctx.fillText(
        (nearView ? 'NEAR ZONE · ' : 'CITY VIEW · ') + 'FORWARD PERSPECTIVE',
        14,
        22
      );
      ctx.font = '500 11px IBM Plex Mono, monospace';
      ctx.fillText(
        `synthetic objects active · range ${viewRange.toFixed(0)} m · ${(raw ? raw.x.length : 0).toLocaleString()} returns`,
        14,
        40
      );

      setScalebarInfo({
        lo: 'near',
        hi: `${viewRange.toFixed(0)} m`,
        name: 'perspective forward projection',
        gradient: `linear-gradient(90deg, ${blueColor}, ${oxideColor})`,
      });
      return;
    }

    // ==========================================
    // 2. BIRD'S EYE VIEW (ADAPTIVE FOVEATED GRID)
    // ==========================================
    ctx.fillStyle = panelColor;
    ctx.fillRect(0, 0, size, size);

    // Forward hazard lane corridor highlight (0m to 24m, +/- 2.2m)
    const [cLeft, cTop] = project(24, 2.2, size);
    const [cRight, cBottom] = project(0, -2.2, size);
    ctx.save();
    ctx.fillStyle =
      hazardInfo.level !== 'clear'
        ? 'rgba(224, 106, 91, 0.08)'
        : 'rgba(31, 92, 140, 0.04)';
    ctx.fillRect(
      Math.min(cLeft, cRight),
      Math.min(cTop, cBottom),
      Math.abs(cRight - cLeft),
      Math.abs(cBottom - cTop)
    );
    ctx.strokeStyle =
      hazardInfo.level !== 'clear'
        ? 'rgba(224, 106, 91, 0.35)'
        : 'rgba(31, 92, 140, 0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(
      Math.min(cLeft, cRight),
      Math.min(cTop, cBottom),
      Math.abs(cRight - cLeft),
      Math.abs(cBottom - cTop)
    );
    ctx.restore();

    // Elevation range for hypsometric ramp
    const zvals: number[] = [];
    for (const c of grid.cells) {
      if (Math.abs(c.cx) > extent || Math.abs(c.cy) > extent) continue;
      if (c.cls <= 1) zvals.push(c.z);
    }
    let zlo = -2;
    let zhi = 2;
    if (zvals.length > 8) {
      zvals.sort((a, b) => a - b);
      zlo = zvals[Math.floor(zvals.length * 0.02)];
      zhi = zvals[Math.floor(zvals.length * 0.98)];
      if (zhi - zlo < 0.25) {
        const m = (zhi + zlo) / 2;
        zlo = m - 0.125;
        zhi = m + 0.125;
      }
    }

    // Draw Raw Returns
    if (showReturns && currentScanPoints) {
      ctx.save();
      ctx.globalAlpha = 0.34;
      for (let i = 0; i < currentScanPoints.x.length; i++) {
        const [pxPt, pyPt] = project(
          currentScanPoints.x[i] / 100,
          currentScanPoints.y[i] / 100,
          size
        );
        if (pxPt < 0 || pxPt > size || pyPt < 0 || pyPt > size) continue;
        ctx.fillStyle = classColors[currentScanPoints.label[i]] || ink3Color;
        ctx.fillRect(pxPt, pyPt, 1.7, 1.7);
      }
      ctx.restore();
    }

    // Draw Grid Cells
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = getCssVar('--rule-2', '#EAE3D5');
    for (const c of grid.cells) {
      const half = c.r / 2;
      if (
        c.cx + half < -extent ||
        c.cx - half > extent ||
        c.cy + half < -extent ||
        c.cy - half > extent
      ) {
        continue;
      }
      const [sx, sy] = project(c.cx - half, c.cy + half, size);
      const cellW = Math.max(c.r * s, 1);
      ctx.fillStyle = cellColour(c, zlo, zhi, classColors);
      ctx.fillRect(sx, sy, cellW, cellW);
      if (showEdges && cellW > 3) {
        ctx.strokeRect(sx, sy, cellW, cellW);
      }
    }

    // Range rings
    if (showRings) {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1;
      for (let L = 1; L < dataset.meta.n_levels; L++) {
        const r = rings[L];
        if (r <= 0 || r > extent * 1.45) continue;
        ctx.strokeStyle = gridInk;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, r * s, 0, Math.PI * 2);
        ctx.stroke();

        const [, ly] = project(0, r, size);
        ctx.setLineDash([]);
        ctx.font = '500 10px IBM Plex Mono, monospace';
        ctx.fillStyle = ink3Color;
        ctx.fillText(`${r} m`, size / 2 + 4, ly - 3);
        ctx.setLineDash([5, 4]);
      }
      ctx.restore();
    }

    // Three-zone view overlay
    if (showZones) {
      ctx.save();
      const zones = [
        { r: dataset.meta.near_zone_radius, color: classColors[0], label: 'Near <15m' },
        { r: dataset.meta.transition_zone_radius, color: classColors[1], label: 'Transition 15-30m' },
        { r: dataset.meta.max_range, color: classColors[2], label: 'Far >30m' },
      ];
      ctx.lineWidth = 2;
      for (const z of zones) {
        ctx.strokeStyle = z.color;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, z.r * s, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ==========================================
    // SYNTHETIC OBSTACLE OVERLAYS
    // ==========================================
    for (const obs of syntheticObstacles) {
      if (!obs.enabled) continue;
      const [ox, oy] = project(obs.x, obs.y, size);
      const isSelected = selectedObstacleId === obs.id;
      const isDragging = draggingObsId === obs.id;

      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(-obs.yaw); // rotate to obstacle heading

      const wPix = Math.max(6, obs.width * s);
      const lPix = Math.max(6, obs.length * s);

      // Shadow / footprint
      ctx.fillStyle =
        obs.semanticClass === 3
          ? 'rgba(219, 84, 97, 0.45)'
          : 'rgba(199, 138, 43, 0.45)';
      ctx.fillRect(-lPix / 2, -wPix / 2, lPix, wPix);

      // Stroke
      ctx.strokeStyle = isSelected || isDragging ? oxideColor : (obs.semanticClass === 3 ? '#E06A5B' : '#E0AC4F');
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.strokeRect(-lPix / 2, -wPix / 2, lPix, wPix);

      // Heading arrow forward
      ctx.beginPath();
      ctx.moveTo(lPix / 2, 0);
      ctx.lineTo(lPix / 2 + 6, 0);
      ctx.strokeStyle = oxideColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      // Velocity vector for dynamic obstacles
      if (obs.dynamic && (Math.abs(obs.velocity.vx) > 0.05 || Math.abs(obs.velocity.vy) > 0.05)) {
        const arrowLen = Math.hypot(obs.velocity.vx, obs.velocity.vy) * s * 1.5;
        const arrowAngle = Math.atan2(-obs.velocity.vy, obs.velocity.vx); // canvas y is inverted
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(arrowAngle);
        ctx.strokeStyle = '#E06A5B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(arrowLen, 0);
        ctx.lineTo(arrowLen - 4, -3);
        ctx.moveTo(arrowLen, 0);
        ctx.lineTo(arrowLen - 4, 3);
        ctx.stroke();
        ctx.restore();
      }

      // Selection ring
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = oxideColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(ox, oy, Math.max(lPix, wPix) / 2 + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Text badge next to obstacle
      ctx.save();
      ctx.font = '600 10px IBM Plex Mono, monospace';
      ctx.fillStyle = inkColor;
      ctx.fillText(
        `${obs.name} (${Math.hypot(obs.x, obs.y).toFixed(1)}m)`,
        ox + lPix / 2 + 5,
        oy + 3
      );
      ctx.restore();
    }

    // Planned Route
    if (plannedPath && plannedPath.length > 1) {
      ctx.save();
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = oxideColor;
      ctx.beginPath();
      plannedPath.forEach((q, i) => {
        const [pxPath, pyPath] = project(q.cx, q.cy, size);
        i ? ctx.lineTo(pxPath, pyPath) : ctx.moveTo(pxPath, pyPath);
      });
      ctx.stroke();

      const lastTile = plannedPath[plannedPath.length - 1];
      const [gx, gy] = project(lastTile.cx, lastTile.cy, size);
      ctx.fillStyle = oxideColor;
      ctx.beginPath();
      ctx.arc(gx, gy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Sensor Blind Cone (64-beam mounted at ~1.8m cannot see ground closer than ~3.7m)
    const blind = 3.7 * s;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.beginPath();
    ctx.arc(0, 0, blind, 0, Math.PI * 2);
    ctx.fillStyle = paper2Color;
    ctx.fill();
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = gridInk;
    ctx.stroke();
    ctx.setLineDash([]);

    // Ego Vehicle footprint (4.4m x 1.9m)
    const L = 4.4 * s;
    const W = 1.9 * s;
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = blueColor;
    ctx.strokeStyle = panelColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const rr = Math.min(3, W / 3);
    ctx.moveTo(-L / 2 + rr, -W / 2);
    ctx.lineTo(L / 2 - rr, -W / 2);
    ctx.quadraticCurveTo(L / 2, -W / 2, L / 2, -W / 2 + rr);
    ctx.lineTo(L / 2, W / 2 - rr);
    ctx.quadraticCurveTo(L / 2, W / 2, L / 2 - rr, W / 2);
    ctx.lineTo(-L / 2 + rr, W / 2);
    ctx.quadraticCurveTo(-L / 2, W / 2, -L / 2, W / 2 - rr);
    ctx.lineTo(-L / 2, -W / 2 + rr);
    ctx.quadraticCurveTo(-L / 2, -W / 2, -L / 2 + rr, -W / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (blind > 26) {
      ctx.font = '500 10px IBM Plex Mono, monospace';
      ctx.fillStyle = ink3Color;
      ctx.textAlign = 'center';
      ctx.fillText('blind cone', 0, blind - 6);
    }
    ctx.restore();

    // Spinning LiDAR FOV pulse
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = blueColor;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -W / 2 - 8);
    ctx.lineTo(0, -Math.min(blind + 16, size / 2 - 8));
    ctx.stroke();

    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(
      0,
      0,
      Math.min(size / 2, 15 * s),
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI / 3
    );
    ctx.closePath();
    ctx.fillStyle = blueColor;
    ctx.fill();
    ctx.restore();

    // Vehicle Motion Breadcrumb Trail
    if (currentFrameIdx > 0) {
      ctx.save();
      ctx.strokeStyle = oxideColor;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const first = Math.max(0, currentFrameIdx - 5);
      for (let i = first; i <= currentFrameIdx; i++) {
        const f0 = dataset.frames[i];
        const fc = dataset.frames[currentFrameIdx];
        const dx = f0.sensor[0] - fc.sensor[0];
        const dy = f0.sensor[1] - fc.sensor[1];
        const cyM = Math.cos(-fc.yaw);
        const syM = Math.sin(-fc.yaw);
        const [tx, ty] = project(cyM * dx - syM * dy, syM * dx + cyM * dy, size);
        i === first ? ctx.moveTo(tx, ty) : ctx.lineTo(tx, ty);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Update Scalebar
    let gStr = '';
    let aStr = `${zlo.toFixed(2)} m`;
    let bStr = `${zhi.toFixed(2)} m`;
    let nameStr = 'elevation (sensor frame)';

    if (activeLayer === 'trav') {
      aStr = 'impassable';
      bStr = 'clear';
      nameStr = 'traversability';
      gStr = 'linear-gradient(90deg, rgb(176,62,45), rgb(199,138,43), rgb(46,125,107))';
    } else if (activeLayer === 'class') {
      aStr = '';
      bStr = '';
      nameStr = 'semantic class (drivable / rough / static / dynamic)';
      gStr = `linear-gradient(90deg, ${classColors.join(',')})`;
    } else if (activeLayer === 'lod') {
      aStr = `${(baseCell * 100).toFixed(0)} cm`;
      bStr = `${(baseCell * (1 << (dataset.meta.n_levels - 1)) * 100).toFixed(0)} cm`;
      nameStr = 'cell size';
      gStr = `linear-gradient(90deg, ${LODC_COLORS.map(rgbString).join(',')})`;
    } else if (activeLayer === 'relief') {
      aStr = '0 m';
      bStr = '0.35 m';
      nameStr = 'in-cell relief (curb detector)';
      gStr = 'linear-gradient(90deg, rgb(31,68,92), rgb(44,118,110), rgb(133,161,106), rgb(208,183,125), rgb(199,138,79), rgb(243,239,230))';
    } else {
      gStr = 'linear-gradient(90deg, rgb(31,68,92), rgb(44,118,110), rgb(133,161,106), rgb(208,183,125), rgb(199,138,79), rgb(243,239,230))';
    }

    setScalebarInfo({
      lo: aStr,
      hi: bStr,
      name: nameStr,
      gradient: gStr,
    });
  }, [
    dataset,
    currentFrameIdx,
    grid,
    nav,
    plannedPath,
    currentScanPoints,
    syntheticObstacles,
    extent,
    baseCell,
    rings,
    activeLayer,
    viewMode,
    showRings,
    showEdges,
    showReturns,
    showZones,
    nearView,
    hazardInfo,
    selectedObstacleId,
    draggingObsId,
    project,
    cellColour,
  ]);

  // Pointer interactions (Hover tooltip, click to place obstacle, click to drop goal, drag obstacle)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const viewSize = canvas.clientWidth;
    const [wx, wy] = unproject(px, py, viewSize);

    // If placement mode is active, place obstacle
    if (placementMode) {
      onAddObstacleAt(wx, wy);
      return;
    }

    // Check if clicked on a synthetic obstacle to start dragging
    for (const obs of syntheticObstacles) {
      if (!obs.enabled) continue;
      const d = Math.hypot(wx - obs.x, wy - obs.y);
      if (d <= Math.max(obs.length, obs.width) / 1.5 + 0.6) {
        setDraggingObsId(obs.id);
        setSelectedObstacleId(obs.id);
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }

    // Otherwise drop navigation goal
    onDropGoal([wx, wy]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const viewSize = canvas.clientWidth;
    const [wx, wy] = unproject(px, py, viewSize);

    // If dragging obstacle
    if (draggingObsId) {
      onUpdateObstaclePos(draggingObsId, wx, wy);
      return;
    }

    // Check for synthetic obstacle hover
    let hoveredObs: SyntheticObstacle | null = null;
    for (const obs of syntheticObstacles) {
      if (!obs.enabled) continue;
      const d = Math.hypot(wx - obs.x, wy - obs.y);
      if (d <= Math.max(obs.length, obs.width) / 1.5 + 0.6) {
        hoveredObs = obs;
        break;
      }
    }

    if (hoveredObs) {
      setTooltip({
        x: Math.min(px + 14, viewSize - 230),
        y: py + 14,
        html: `<b>${hoveredObs.name}</b> · SYNTHETIC<br>
          range: ${Math.hypot(hoveredObs.x, hoveredObs.y).toFixed(1)} m<br>
          class: ${hoveredObs.semanticClass === 3 ? 'dynamic_object' : 'static_obstacle'}<br>
          position: [${hoveredObs.x.toFixed(1)}m, ${hoveredObs.y.toFixed(1)}m]<br>
          drag to move or click to select`,
      });
      return;
    }

    // Check grid cell hover
    const L = leafLevel(wx, wy, baseCell, rings, dataset.meta.n_levels);
    const r = baseCell * (1 << L);
    const key =
      L * 4398046511104 +
      (Math.floor(wx / r) + 65536) * 2097152 +
      (Math.floor(wy / r) + 65536);
    const c = grid.map.get(key);

    if (!c) {
      setTooltip(null);
      return;
    }

    const t = c.tile;
    const className = dataset.meta.class_names[c.cls]?.replace(/_/g, ' ') || 'unknown';
    const slopeStr = t
      ? `<br>slope ${t.slope.toFixed(1)}° · ${
          t.reach
            ? '<span style="color:var(--c0)">reachable</span>'
            : '<span style="color:var(--c3)">not reachable</span>'
        }`
      : '';

    setTooltip({
      x: Math.min(px + 14, viewSize - 230),
      y: py + 14,
      html: `<b>${(c.r * 100).toFixed(0)} cm cell</b> · level ${c.L}<br>
        range ${Math.hypot(c.cx, c.cy).toFixed(1)} m<br>
        elevation ${c.z.toFixed(3)} m<br>
        relief ${c.relief.toFixed(3)} m · ${c.n} returns<br>
        class ${className}${slopeStr}`,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingObsId) {
      setDraggingObsId(null);
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="plotwrap" ref={containerRef}>
      <canvas
        ref={canvasRef}
        id="plot"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          setTooltip(null);
          if (draggingObsId) setDraggingObsId(null);
        }}
        className={placementMode ? 'cursor-crosshair' : 'cursor-default'}
      />

      {/* Scalebar at canvas bottom */}
      <div className="scalebar">
        <span>{scalebarInfo.lo}</span>
        <div
          className="ramp"
          style={{ background: scalebarInfo.gradient }}
        />
        <span>{scalebarInfo.hi}</span>
        <span style={{ color: 'var(--ink-2)' }}>{scalebarInfo.name}</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="tip"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
          dangerouslySetInnerHTML={{ __html: tooltip.html }}
        />
      )}
    </div>
  );
};
