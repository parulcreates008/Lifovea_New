import { SyntheticObstacle, CityObject } from '../types/lifovea';

export const OBSTACLE_TEMPLATES: Record<string, Omit<SyntheticObstacle, 'id' | 'x' | 'y'>> = {
  car: {
    name: 'Stalled Sedan',
    type: 'car',
    z: -1.7,
    length: 4.4,
    width: 1.9,
    height: 1.5,
    yaw: 0,
    semanticClass: 2,
    dynamic: false,
    velocity: { vx: 0, vy: 0 },
    trajectory: 'stationary',
    pointDensity: 280,
    reflectivity: 0.95,
    enabled: true,
    castsShadow: true,
    color: '#8C9CB8',
  },
  pedestrian: {
    name: 'Pedestrian',
    type: 'pedestrian',
    z: -1.7,
    length: 0.5,
    width: 0.5,
    height: 1.75,
    yaw: 0,
    semanticClass: 3,
    dynamic: true,
    velocity: { vx: 0, vy: -1.2 },
    trajectory: 'cross_lane',
    pointDensity: 120,
    reflectivity: 0.85,
    enabled: true,
    castsShadow: true,
    color: '#E06A5B',
  },
  barrier: {
    name: 'Concrete Barrier (K-Rail)',
    type: 'barrier',
    z: -1.7,
    length: 3.2,
    width: 0.65,
    height: 0.95,
    yaw: 0.1,
    semanticClass: 2,
    dynamic: false,
    velocity: { vx: 0, vy: 0 },
    trajectory: 'stationary',
    pointDensity: 200,
    reflectivity: 0.9,
    enabled: true,
    castsShadow: true,
    color: '#C78A2B',
  },
  cone: {
    name: 'Traffic Cone',
    type: 'cone',
    z: -1.7,
    length: 0.4,
    width: 0.4,
    height: 0.8,
    yaw: 0,
    semanticClass: 2,
    dynamic: false,
    velocity: { vx: 0, vy: 0 },
    trajectory: 'stationary',
    pointDensity: 65,
    reflectivity: 0.98,
    enabled: true,
    castsShadow: false,
    color: '#D9714F',
  },
  debris: {
    name: 'Fallen Cargo Crate',
    type: 'debris',
    z: -1.7,
    length: 1.1,
    width: 1.1,
    height: 0.5,
    yaw: 0.3,
    semanticClass: 2,
    dynamic: false,
    velocity: { vx: 0, vy: 0 },
    trajectory: 'stationary',
    pointDensity: 90,
    reflectivity: 0.88,
    enabled: true,
    castsShadow: true,
    color: '#A07040',
  },
  cyclist: {
    name: 'Urban Cyclist',
    type: 'cyclist',
    z: -1.7,
    length: 1.8,
    width: 0.6,
    height: 1.55,
    yaw: 0,
    semanticClass: 3,
    dynamic: true,
    velocity: { vx: -2.5, vy: 0.2 },
    trajectory: 'head_on',
    pointDensity: 140,
    reflectivity: 0.9,
    enabled: true,
    castsShadow: true,
    color: '#E0AC4F',
  },
  fallen_log: {
    name: 'Fallen Pine Trunk',
    type: 'barrier',
    z: -1.7,
    length: 5.2,
    width: 0.75,
    height: 0.55,
    yaw: 0.35,
    semanticClass: 2,
    dynamic: false,
    velocity: { vx: 0, vy: 0 },
    trajectory: 'stationary',
    pointDensity: 240,
    reflectivity: 0.88,
    enabled: true,
    castsShadow: true,
    color: '#8A5D3B',
  },
  boulder: {
    name: 'Granite Boulder',
    type: 'debris',
    z: -1.7,
    length: 1.8,
    width: 1.6,
    height: 1.2,
    yaw: 0.1,
    semanticClass: 2,
    dynamic: false,
    velocity: { vx: 0, vy: 0 },
    trajectory: 'stationary',
    pointDensity: 210,
    reflectivity: 0.92,
    enabled: true,
    castsShadow: true,
    color: '#707880',
  },
  wildlife: {
    name: 'Forest Deer',
    type: 'pedestrian',
    z: -1.7,
    length: 1.4,
    width: 0.5,
    height: 1.4,
    yaw: -Math.PI / 2,
    semanticClass: 3,
    dynamic: true,
    velocity: { vx: 0, vy: -1.8 },
    trajectory: 'cross_lane',
    pointDensity: 150,
    reflectivity: 0.85,
    enabled: true,
    castsShadow: true,
    color: '#C77A38',
  },
};

export const PRESET_SCENARIOS: Array<{
  id: string;
  name: string;
  badge: string;
  description: string;
  obstacles: SyntheticObstacle[];
}> = [
  {
    id: 'forest_fallen_trunk',
    name: 'Fallen Log Across Trail',
    badge: 'FOREST HAZARD',
    description: 'A 5.2 m fallen pine tree trunk blocking the woodland path, demonstrating in-cell relief curb detection and autonomous detour routing.',
    obstacles: [
      {
        id: 'obs_forest_log',
        name: 'Fallen Pine Trunk',
        type: 'barrier',
        x: 8.5,
        y: 0.2,
        z: -1.7,
        length: 5.2,
        width: 0.75,
        height: 0.55,
        yaw: 0.32,
        semanticClass: 2,
        dynamic: false,
        velocity: { vx: 0, vy: 0 },
        trajectory: 'stationary',
        pointDensity: 260,
        reflectivity: 0.88,
        enabled: true,
        castsShadow: true,
        color: '#8A5D3B',
        initialX: 8.5,
        initialY: 0.2,
      },
    ],
  },
  {
    id: 'forest_wildlife',
    name: 'Forest Wildlife Crossing',
    badge: 'DYNAMIC ANIMAL',
    description: 'A wild deer crossing from the left tree line across the vehicle trail at 1.8 m/s, triggering dynamic obstacle tracking.',
    obstacles: [
      {
        id: 'obs_deer_1',
        name: 'Crossing Deer',
        type: 'pedestrian',
        x: 9.0,
        y: 3.5,
        z: -1.7,
        length: 1.4,
        width: 0.5,
        height: 1.4,
        yaw: -Math.PI / 2,
        semanticClass: 3,
        dynamic: true,
        velocity: { vx: 0, vy: -1.8 },
        trajectory: 'cross_lane',
        pointDensity: 160,
        reflectivity: 0.85,
        enabled: true,
        castsShadow: true,
        color: '#C77A38',
        initialX: 9.0,
        initialY: 3.5,
      },
    ],
  },
  {
    id: 'hazard_intrusion',
    name: 'Forward Lane Hazard',
    badge: 'CRITICAL ALERT',
    description: 'A stalled vehicle situated directly in the forward driving corridor 6.5 m ahead, triggering critical hazard proximity.',
    obstacles: [
      {
        id: 'obs_hazard_car',
        name: 'Stalled Sedan (Ego-Lane)',
        type: 'car',
        x: 6.8,
        y: 0.1,
        z: -1.7,
        length: 4.4,
        width: 1.9,
        height: 1.45,
        yaw: 0.05,
        semanticClass: 2,
        dynamic: false,
        velocity: { vx: 0, vy: 0 },
        trajectory: 'stationary',
        pointDensity: 320,
        reflectivity: 0.95,
        enabled: true,
        castsShadow: true,
        color: '#E06A5B',
        initialX: 6.8,
        initialY: 0.1,
      },
    ],
  },
  {
    id: 'pedestrian_crossing',
    name: 'Pedestrian Cross-Walk',
    badge: 'DYNAMIC TRACKING',
    description: 'Dynamic pedestrian jaywalking laterally across the vehicle path at 1.3 m/s, demonstrating real-time moving obstacle classification.',
    obstacles: [
      {
        id: 'obs_ped_1',
        name: 'Crossing Pedestrian',
        type: 'pedestrian',
        x: 7.5,
        y: 3.2,
        z: -1.7,
        length: 0.55,
        width: 0.55,
        height: 1.78,
        yaw: -Math.PI / 2,
        semanticClass: 3,
        dynamic: true,
        velocity: { vx: 0, vy: -1.3 },
        trajectory: 'cross_lane',
        pointDensity: 160,
        reflectivity: 0.9,
        enabled: true,
        castsShadow: true,
        color: '#E06A5B',
        initialX: 7.5,
        initialY: 3.2,
      },
    ],
  },
  {
    id: 'construction_zone',
    name: 'Construction Zone & Cones',
    badge: 'WORKZONE DETOUR',
    description: 'A line of traffic cones and concrete K-rail barricade closing off the right lane, challenging the A* path planner to steer left.',
    obstacles: [
      {
        id: 'obs_barr_1',
        name: 'Concrete Barrier North',
        type: 'barrier',
        x: 10.5,
        y: 1.2,
        z: -1.7,
        length: 3.6,
        width: 0.7,
        height: 1.0,
        yaw: 0.15,
        semanticClass: 2,
        dynamic: false,
        velocity: { vx: 0, vy: 0 },
        trajectory: 'stationary',
        pointDensity: 240,
        reflectivity: 0.9,
        enabled: true,
        castsShadow: true,
        color: '#C78A2B',
        initialX: 10.5,
        initialY: 1.2,
      },
      {
        id: 'obs_cone_1',
        name: 'T-Cone Entry',
        type: 'cone',
        x: 6.0,
        y: 0.6,
        z: -1.7,
        length: 0.4,
        width: 0.4,
        height: 0.8,
        yaw: 0,
        semanticClass: 2,
        dynamic: false,
        velocity: { vx: 0, vy: 0 },
        trajectory: 'stationary',
        pointDensity: 70,
        reflectivity: 0.95,
        enabled: true,
        castsShadow: false,
        color: '#D9714F',
        initialX: 6.0,
        initialY: 0.6,
      },
      {
        id: 'obs_cone_2',
        name: 'T-Cone Mid',
        type: 'cone',
        x: 7.8,
        y: 0.9,
        z: -1.7,
        length: 0.4,
        width: 0.4,
        height: 0.8,
        yaw: 0,
        semanticClass: 2,
        dynamic: false,
        velocity: { vx: 0, vy: 0 },
        trajectory: 'stationary',
        pointDensity: 70,
        reflectivity: 0.95,
        enabled: true,
        castsShadow: false,
        color: '#D9714F',
        initialX: 7.8,
        initialY: 0.9,
      },
      {
        id: 'obs_cone_3',
        name: 'T-Cone Far',
        type: 'cone',
        x: 9.6,
        y: 1.2,
        z: -1.7,
        length: 0.4,
        width: 0.4,
        height: 0.8,
        yaw: 0,
        semanticClass: 2,
        dynamic: false,
        velocity: { vx: 0, vy: 0 },
        trajectory: 'stationary',
        pointDensity: 70,
        reflectivity: 0.95,
        enabled: true,
        castsShadow: false,
        color: '#D9714F',
        initialX: 9.6,
        initialY: 1.2,
      },
    ],
  },
  {
    id: 'slalom_agility',
    name: 'Multi-Obstacle Slalom',
    badge: 'A* PLANNER TEST',
    description: 'Alternating barriers and obstacles testing vehicle traversability, step relief, and autonomous navigation routing.',
    obstacles: [
      {
        id: 'obs_sla_1',
        name: 'Chicane Barrier Left',
        type: 'barrier',
        x: 7.0,
        y: 1.2,
        z: -1.7,
        length: 2.8,
        width: 0.65,
        height: 0.9,
        yaw: 0,
        semanticClass: 2,
        dynamic: false,
        velocity: { vx: 0, vy: 0 },
        trajectory: 'stationary',
        pointDensity: 200,
        reflectivity: 0.9,
        enabled: true,
        castsShadow: true,
        color: '#C78A2B',
        initialX: 7.0,
        initialY: 1.2,
      },
      {
        id: 'obs_sla_2',
        name: 'Chicane Barrier Right',
        type: 'barrier',
        x: 13.0,
        y: -1.4,
        z: -1.7,
        length: 2.8,
        width: 0.65,
        height: 0.9,
        yaw: 0,
        semanticClass: 2,
        dynamic: false,
        velocity: { vx: 0, vy: 0 },
        trajectory: 'stationary',
        pointDensity: 200,
        reflectivity: 0.9,
        enabled: true,
        castsShadow: true,
        color: '#C78A2B',
        initialX: 13.0,
        initialY: -1.4,
      },
      {
        id: 'obs_sla_3',
        name: 'Mid Crate Debris',
        type: 'debris',
        x: 19.0,
        y: 0.6,
        z: -1.7,
        length: 1.2,
        width: 1.2,
        height: 0.6,
        yaw: 0.2,
        semanticClass: 2,
        dynamic: false,
        velocity: { vx: 0, vy: 0 },
        trajectory: 'stationary',
        pointDensity: 120,
        reflectivity: 0.88,
        enabled: true,
        castsShadow: true,
        color: '#A07040',
        initialX: 19.0,
        initialY: 0.6,
      },
    ],
  },
  {
    id: 'fovea_lod_test',
    name: 'Fovea Multi-Ring Benchmark',
    badge: 'LOD BENCHMARK',
    description: 'Identical obstacles placed at 5 m (Fovea Level 0), 15 m (Level 1), 28 m (Level 2), and 48 m (Level 3) to test resolution degradation.',
    obstacles: [
      {
        id: 'obs_lod_near',
        name: 'Target (Near Fovea <10m)',
        type: 'car',
        x: 5.5,
        y: -2.8,
        z: -1.7,
        length: 3.5,
        width: 1.8,
        height: 1.4,
        yaw: 0,
        semanticClass: 2,
        dynamic: false,
        velocity: { vx: 0, vy: 0 },
        trajectory: 'stationary',
        pointDensity: 300,
        reflectivity: 0.95,
        enabled: true,
        castsShadow: true,
        color: '#2E7D6B',
        initialX: 5.5,
        initialY: -2.8,
      },
      {
        id: 'obs_lod_mid1',
        name: 'Target (Ring 1 10-20m)',
        type: 'car',
        x: 15.0,
        y: -3.5,
        z: -1.7,
        length: 3.5,
        width: 1.8,
        height: 1.4,
        yaw: 0,
        semanticClass: 2,
        dynamic: false,
        velocity: { vx: 0, vy: 0 },
        trajectory: 'stationary',
        pointDensity: 300,
        reflectivity: 0.95,
        enabled: true,
        castsShadow: true,
        color: '#6BA9D8',
        initialX: 15.0,
        initialY: -3.5,
      },
      {
        id: 'obs_lod_mid2',
        name: 'Target (Ring 2 20-40m)',
        type: 'car',
        x: 28.0,
        y: -4.0,
        z: -1.7,
        length: 3.5,
        width: 1.8,
        height: 1.4,
        yaw: 0,
        semanticClass: 2,
        dynamic: false,
        velocity: { vx: 0, vy: 0 },
        trajectory: 'stationary',
        pointDensity: 300,
        reflectivity: 0.95,
        enabled: true,
        castsShadow: true,
        color: '#C78A2B',
        initialX: 28.0,
        initialY: -4.0,
      },
    ],
  },
  {
    id: 'empty_sandbox',
    name: 'Clean Sandbox (Custom)',
    badge: 'INTERACTIVE',
    description: 'Empty testing field. Use the "Place Obstacle" tool to drop and configure custom obstacles anywhere in the LiDAR space.',
    obstacles: [],
  },
];

/**
 * Generates synthetic 3D LiDAR point returns for an obstacle.
 * Respects sensor perspective: LiDAR beams only hit exterior visible surfaces facing origin (0, 0, 0).
 */
export function synthesizeObstaclePoints(obs: SyntheticObstacle): {
  x: number[];
  y: number[];
  z: number[];
  label: number[];
} {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const labels: number[] = [];

  const cx = obs.x;
  const cy = obs.y;
  const cz = obs.z + obs.height / 2; // center z
  const dist = Math.hypot(cx, cy);
  if (dist < 0.2 || dist > 95) {
    return { x: xs, y: ys, z: zs, label: labels };
  }

  // Sensor mounting height is ~1.8m above ground, sensor origin is at z = 0.
  // Ground is at approximately z = -1.75m.
  const zBase = obs.z;
  const zTop = obs.z + obs.height;

  // Surface sampling density adjusted by distance (further away receives naturally sparser beam coverage)
  const angularResolutionFactor = Math.min(1.0, 12.0 / Math.max(4.0, dist));
  const effectivePoints = Math.max(16, Math.round(obs.pointDensity * angularResolutionFactor));

  const cosY = Math.cos(obs.yaw);
  const sinY = Math.sin(obs.yaw);

  // Helper to rotate local box coords to sensor frame
  const toSensorFrame = (lx: number, ly: number, lz: number): [number, number, number] => {
    const rx = cosY * lx - sinY * ly;
    const ry = sinY * lx + cosY * ly;
    return [cx + rx, cy + ry, lz];
  };

  const halfL = obs.length / 2;
  const halfW = obs.width / 2;

  // Generate points on visible faces
  // Face 1: Front facing sensor (approx lx = -halfL or toward origin)
  // Determine which faces are visible
  const localSensorX = -(cosY * cx + sinY * cy);
  const localSensorY = -(-sinY * cx + cosY * cy);

  // Surface point jitter (LiDAR sensor Gaussian ranging noise)
  const jitter = () => (Math.random() - 0.5) * 0.022;

  // 1. Visible X-face
  const visibleXSign = localSensorX >= 0 ? 1 : -1;
  const nx = Math.max(3, Math.round(Math.sqrt(effectivePoints * 0.4)));
  const nz = Math.max(3, Math.round(Math.sqrt(effectivePoints * 0.6)));

  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      if (Math.random() > obs.reflectivity) continue;
      const ly = (ix / (nx - 1) - 0.5) * obs.width;
      const lz = zBase + (iz / (nz - 1)) * obs.height;
      const lx = visibleXSign * halfL;
      const [px, py, pz] = toSensorFrame(lx, ly, lz);
      xs.push(Math.round((px + jitter()) * 100));
      ys.push(Math.round((py + jitter()) * 100));
      zs.push(Math.round((pz + jitter()) * 100));
      labels.push(obs.semanticClass);
    }
  }

  // 2. Visible Y-face
  const visibleYSign = localSensorY >= 0 ? 1 : -1;
  const ny = Math.max(2, Math.round(nx * (obs.length / Math.max(0.2, obs.width))));
  for (let iy = 0; iy < ny; iy++) {
    for (let iz = 0; iz < nz; iz++) {
      if (Math.random() > obs.reflectivity) continue;
      const lx = (iy / (ny - 1) - 0.5) * obs.length;
      const lz = zBase + (iz / (nz - 1)) * obs.height;
      const ly = visibleYSign * halfW;
      const [px, py, pz] = toSensorFrame(lx, ly, lz);
      xs.push(Math.round((px + jitter()) * 100));
      ys.push(Math.round((py + jitter()) * 100));
      zs.push(Math.round((pz + jitter()) * 100));
      labels.push(obs.semanticClass);
    }
  }

  // 3. Top face (visible if sensor z = 0 is higher than object top)
  if (zTop < 0.2) {
    const nTopX = Math.max(2, Math.round(nx * 0.8));
    const nTopY = Math.max(2, Math.round(ny * 0.8));
    for (let tx = 0; tx < nTopX; tx++) {
      for (let ty = 0; ty < nTopY; ty++) {
        if (Math.random() > obs.reflectivity) continue;
        const lx = (tx / (nTopX - 1) - 0.5) * obs.length;
        const ly = (ty / (nTopY - 1) - 0.5) * obs.width;
        const [px, py, pz] = toSensorFrame(lx, ly, zTop);
        xs.push(Math.round((px + jitter()) * 100));
        ys.push(Math.round((py + jitter()) * 100));
        zs.push(Math.round((pz + jitter()) * 100));
        labels.push(obs.semanticClass);
      }
    }
  }

  return { x: xs, y: ys, z: zs, label: labels };
}

/**
 * Convert synthetic obstacles into 3D city objects for perspective City View rendering.
 */
export function obstaclesToCityObjects(obstacles: SyntheticObstacle[]): CityObject[] {
  return obstacles
    .filter((o) => o.enabled)
    .map((o) => {
      const halfL = o.length / 2;
      const halfW = o.width / 2;
      const zMin = o.z;
      const zMax = o.z + o.height;

      // Axis-aligned bounding bounding in sensor frame or rotated
      return {
        kind: 0, // 3D box
        params: [
          o.x - halfL,
          o.y - halfW,
          zMin,
          o.x + halfL,
          o.y + halfW,
          zMax,
        ],
        label: o.semanticClass,
      };
    });
}

/**
 * Filter out real LiDAR points that are occluded behind synthetic obstacles.
 * Uses angular ray-casting shadow cone.
 */
export function applyOcclusionShadows(
  points: { x: Int16Array; y: Int16Array; z: Int16Array; label: Int8Array },
  obstacles: SyntheticObstacle[]
): { x: Int16Array; y: Int16Array; z: Int16Array; label: Int8Array } {
  const activeObs = obstacles.filter((o) => o.enabled && o.castsShadow);
  if (activeObs.length === 0) return points;

  // Precompute obstacle bounding angular cones
  const cones = activeObs.map((o) => {
    const dist = Math.hypot(o.x, o.y);
    const radius = Math.hypot(o.length, o.width) / 2;
    const centerAzimuth = Math.atan2(o.y, o.x);
    const halfAngularWidth = Math.asin(Math.min(0.95, radius / Math.max(radius + 0.1, dist)));
    const zMin = o.z;
    const zMax = o.z + o.height;
    return {
      minDist: dist + 0.2,
      azimuthMin: centerAzimuth - halfAngularWidth,
      azimuthMax: centerAzimuth + halfAngularWidth,
      zMin,
      zMax,
    };
  });

  const n = points.x.length;
  const keep = new Uint8Array(n);
  let keptCount = 0;

  for (let i = 0; i < n; i++) {
    const px = points.x[i] / 100;
    const py = points.y[i] / 100;
    const pz = points.z[i] / 100;
    const pDist = Math.hypot(px, py);
    const az = Math.atan2(py, px);

    let occluded = false;
    for (let c = 0; c < cones.length; c++) {
      const cone = cones[c];
      if (pDist > cone.minDist && az >= cone.azimuthMin && az <= cone.azimuthMax) {
        if (pz >= cone.zMin && pz <= cone.zMax + 0.5) {
          occluded = true;
          break;
        }
      }
    }

    if (!occluded) {
      keep[i] = 1;
      keptCount++;
    }
  }

  const ox = new Int16Array(keptCount);
  const oy = new Int16Array(keptCount);
  const oz = new Int16Array(keptCount);
  const ol = new Int8Array(keptCount);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    if (keep[i]) {
      ox[idx] = points.x[i];
      oy[idx] = points.y[i];
      oz[idx] = points.z[i];
      ol[idx] = points.label[i];
      idx++;
    }
  }

  return { x: ox, y: oy, z: oz, label: ol };
}

/**
 * Updates dynamic obstacles position for physics/trajectory simulation.
 */
export function updateObstaclePhysics(
  obstacles: SyntheticObstacle[],
  dtSeconds: number
): SyntheticObstacle[] {
  return obstacles.map((obs) => {
    if (!obs.enabled || !obs.dynamic) return obs;

    let nx = obs.x;
    let ny = obs.y;
    let nvx = obs.velocity.vx;
    let nvy = obs.velocity.vy;

    const initX = obs.initialX ?? obs.x;
    const initY = obs.initialY ?? obs.y;

    switch (obs.trajectory) {
      case 'cross_lane': {
        // Walks laterally between y = +3.8 and y = -3.8
        ny += nvy * dtSeconds;
        if (ny < -3.8) {
          ny = -3.8;
          nvy = Math.abs(nvy);
        } else if (ny > 3.8) {
          ny = 3.8;
          nvy = -Math.abs(nvy);
        }
        break;
      }
      case 'head_on': {
        // Approaches towards sensor, resets once too close
        nx += nvx * dtSeconds;
        if (nx < 4.0) {
          nx = 24.0;
        }
        break;
      }
      case 'cut_in': {
        // Cuts in from adjacent lane
        nx += nvx * dtSeconds;
        ny += nvy * dtSeconds;
        if (nx < 5.0 || Math.abs(ny) < 0.2) {
          nx = initX;
          ny = initY;
        }
        break;
      }
      case 'patrol': {
        // Oscillates within a bounding box
        nx += nvx * dtSeconds;
        ny += nvy * dtSeconds;
        if (Math.hypot(nx - initX, ny - initY) > 4.5) {
          nvx = -nvx;
          nvy = -nvy;
        }
        break;
      }
      default: {
        nx += nvx * dtSeconds;
        ny += nvy * dtSeconds;
      }
    }

    return {
      ...obs,
      x: nx,
      y: ny,
      velocity: { vx: nvx, vy: nvy },
    };
  });
}
