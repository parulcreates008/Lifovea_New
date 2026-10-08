import { CityObject, LidarFrame, LidarMeta } from '../types/lifovea';

export interface ForestConfig {
  numFrames: number;
  speedMps: number;
  treeDensity: 'sparse' | 'moderate' | 'dense';
  addFallenLogHazard: boolean;
  addWildlifeHazard: boolean;
}

export const DEFAULT_FOREST_CONFIG: ForestConfig = {
  numFrames: 50,
  speedMps: 4.5,
  treeDensity: 'moderate',
  addFallenLogHazard: true,
  addWildlifeHazard: true,
};

interface ForestTree {
  x: number;
  y: number;
  radius: number;
  height: number;
  canopyRadius: number;
}

interface ForestRock {
  x: number;
  y: number;
  width: number;
  length: number;
  height: number;
}

interface ForestLog {
  x: number;
  y: number;
  length: number;
  radius: number;
  angle: number;
}

/**
 * Procedural continuous forest trail definition.
 * Trail passes through an expansive 250m woodland corridor.
 */
function getTrailPos(s: number): { x: number; y: number; heading: number } {
  // s is distance along track
  const x = s * 0.95;
  const y =
    6.5 * Math.sin(s / 24) +
    3.5 * Math.cos(s / 42) -
    2.0 * Math.sin(s / 12);
  // Derivative for heading
  const dx = 0.95;
  const dy =
    (6.5 / 24) * Math.cos(s / 24) -
    (3.5 / 42) * Math.sin(s / 42) -
    (2.0 / 12) * Math.cos(s / 12);
  const heading = Math.atan2(dy, dx);
  return { x, y, heading };
}

/**
 * Forest terrain elevation function Z(x, y).
 * Features rolling hills, natural slopes, and a smoothed trail depression.
 */
function getForestElevation(x: number, y: number): number {
  const baseRoll =
    1.4 * Math.sin(x / 35) +
    1.1 * Math.cos(y / 28) +
    0.4 * Math.sin((x + y) / 16);
  // Natural slope gradient
  const slopeGrad = (x * 0.02) - (y * 0.015);
  return baseRoll + slopeGrad;
}

/**
 * Generate static forest objects (trees, rocks, fallen logs) across the forest world.
 */
function generateForestWorld(
  totalDistance: number,
  density: 'sparse' | 'moderate' | 'dense'
): {
  trees: ForestTree[];
  rocks: ForestRock[];
  logs: ForestLog[];
} {
  const trees: ForestTree[] = [];
  const rocks: ForestRock[] = [];
  const logs: ForestLog[] = [];

  const treeSpacing = density === 'dense' ? 3.5 : density === 'moderate' ? 5.5 : 8.0;

  // Populate along the trail corridor (s from -10 to totalDistance + 40)
  for (let s = -10; s <= totalDistance + 50; s += treeSpacing) {
    const trail = getTrailPos(s);
    const perpAngle = trail.heading + Math.PI / 2;

    // Place trees on both sides of trail, outside the 2.5m clearance
    const sideOffsets = [
      -(2.8 + Math.random() * 22),
      (2.8 + Math.random() * 22),
      -(8.0 + Math.random() * 25),
      (8.0 + Math.random() * 25),
    ];

    for (const offset of sideOffsets) {
      // Jitter
      const jitterS = (Math.random() - 0.5) * treeSpacing;
      const tPos = getTrailPos(s + jitterS);
      const tx = tPos.x + Math.cos(perpAngle) * offset;
      const ty = tPos.y + Math.sin(perpAngle) * offset;

      trees.push({
        x: tx,
        y: ty,
        radius: 0.35 + Math.random() * 0.45,
        height: 8.0 + Math.random() * 8.0,
        canopyRadius: 2.2 + Math.random() * 2.8,
      });
    }

    // Occasional boulders/rocks near trail borders
    if (Math.random() < 0.25) {
      const rockSide = Math.random() > 0.5 ? 1 : -1;
      const rockDist = 2.4 + Math.random() * 4.0;
      rocks.push({
        x: trail.x + Math.cos(perpAngle) * (rockDist * rockSide),
        y: trail.y + Math.sin(perpAngle) * (rockDist * rockSide),
        width: 1.1 + Math.random() * 1.4,
        length: 1.2 + Math.random() * 1.8,
        height: 0.6 + Math.random() * 0.9,
      });
    }

    // Occasional fallen logs beside path
    if (Math.random() < 0.12) {
      const logSide = Math.random() > 0.5 ? 1 : -1;
      const logDist = 2.6 + Math.random() * 5.0;
      logs.push({
        x: trail.x + Math.cos(perpAngle) * (logDist * logSide),
        y: trail.y + Math.sin(perpAngle) * (logDist * logSide),
        length: 4.5 + Math.random() * 3.5,
        radius: 0.3 + Math.random() * 0.25,
        angle: trail.heading + (Math.random() - 0.5) * 0.8,
      });
    }
  }

  return { trees, rocks, logs };
}

/**
 * Builds realistic 64-beam LiDAR point clouds and 3D forest mesh bounding boxes
 * for a sequence of consecutive frames along the woodland trail.
 */
export function generateForestDataset(
  meta: LidarMeta,
  config: ForestConfig = DEFAULT_FOREST_CONFIG
): LidarFrame[] {
  const dt = 0.1; // 10 Hz LiDAR
  const speed = config.speedMps;
  const ds = speed * dt;
  const totalDist = config.numFrames * ds + 30;

  const { trees, rocks, logs } = generateForestWorld(totalDist, config.treeDensity);

  // Specific fallen log hazard at ~28m along path (frame ~20)
  if (config.addFallenLogHazard) {
    const hazardS = 22.0;
    const hTrail = getTrailPos(hazardS);
    logs.push({
      x: hTrail.x + 0.3,
      y: hTrail.y + 0.2,
      length: 4.8,
      radius: 0.38,
      angle: hTrail.heading + Math.PI / 2 + 0.15, // crosses lane!
    });
  }

  const frames: LidarFrame[] = [];

  // Elevation beam angles for 64-beam sensor (-24 deg to +2 deg)
  const verticalAngles: number[] = [];
  for (let b = 0; b < meta.sensor.beams; b++) {
    const t = b / (meta.sensor.beams - 1);
    // Non-linear distribution: denser near ground/horizon
    const deg = -24.0 + Math.pow(t, 1.4) * 26.0;
    verticalAngles.push((deg * Math.PI) / 180);
  }

  const numAzimuth = 420; // azimuth rays per frame for smooth 360 coverage
  const azimuthStep = (Math.PI * 2) / numAzimuth;

  for (let frameIdx = 0; frameIdx < config.numFrames; frameIdx++) {
    const s = 4.0 + frameIdx * ds;
    const trail = getTrailPos(s);
    const yaw = trail.heading;
    const groundZ = getForestElevation(trail.x, trail.y);
    const sensorZ = groundZ + 1.82; // 1.82m above ground
    const sensorWorld: [number, number, number] = [trail.x, trail.y, sensorZ];

    // Candidate forest objects within max range
    const maxR = meta.max_range;
    const nearbyTrees = trees.filter(
      (tr) => Math.hypot(tr.x - trail.x, tr.y - trail.y) <= maxR
    );
    const nearbyRocks = rocks.filter(
      (rk) => Math.hypot(rk.x - trail.x, rk.y - trail.y) <= maxR
    );
    const nearbyLogs = logs.filter(
      (lg) => Math.hypot(lg.x - trail.x, lg.y - trail.y) <= maxR
    );

    // City objects for perspective forward camera view in this frame
    const cityObjects: CityObject[] = [];

    // Add trees as bounding boxes in world frame
    for (const tr of nearbyTrees) {
      if (Math.hypot(tr.x - trail.x, tr.y - trail.y) > 45) continue;
      const gz = getForestElevation(tr.x, tr.y);
      cityObjects.push({
        kind: 0,
        params: [
          tr.x - tr.radius,
          tr.y - tr.radius,
          gz,
          tr.x + tr.radius,
          tr.y + tr.radius,
          gz + tr.height,
        ],
        label: 2, // static_obstacle
      });
    }

    // Add rocks
    for (const rk of nearbyRocks) {
      if (Math.hypot(rk.x - trail.x, rk.y - trail.y) > 40) continue;
      const gz = getForestElevation(rk.x, rk.y);
      cityObjects.push({
        kind: 0,
        params: [
          rk.x - rk.length / 2,
          rk.y - rk.width / 2,
          gz,
          rk.x + rk.length / 2,
          rk.y + rk.width / 2,
          gz + rk.height,
        ],
        label: 2,
      });
    }

    // Add logs
    for (const lg of nearbyLogs) {
      if (Math.hypot(lg.x - trail.x, lg.y - trail.y) > 40) continue;
      const gz = getForestElevation(lg.x, lg.y);
      cityObjects.push({
        kind: 0,
        params: [
          lg.x - lg.length / 2,
          lg.y - lg.radius,
          gz,
          lg.x + lg.length / 2,
          lg.y + lg.radius,
          gz + lg.radius * 2,
        ],
        label: 2,
      });
    }

    // Dynamic Wildlife (e.g. deer crossing trail at frame 15..35)
    let wildlifeWorldPos: [number, number, number] | null = null;
    if (config.addWildlifeHazard && frameIdx >= 12 && frameIdx <= 38) {
      const deerS = 18.0;
      const dTrail = getTrailPos(deerS);
      const deerYOffset = 4.2 - (frameIdx - 12) * 0.32; // moves from left to right
      const perpAngle = dTrail.heading + Math.PI / 2;
      const deerX = dTrail.x + Math.cos(perpAngle) * deerYOffset;
      const deerY = dTrail.y + Math.sin(perpAngle) * deerYOffset;
      const deerZ = getForestElevation(deerX, deerY);
      wildlifeWorldPos = [deerX, deerY, deerZ];

      cityObjects.push({
        kind: 0,
        params: [
          deerX - 0.7,
          deerY - 0.35,
          deerZ,
          deerX + 0.7,
          deerY + 0.35,
          deerZ + 1.45,
        ],
        label: 3, // dynamic_object
      });
    }

    // Point cloud buffers
    const pX: number[] = [];
    const pY: number[] = [];
    const pZ: number[] = [];
    const pL: number[] = [];

    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);

    // Coordinate transform: World (wx, wy, wz) -> Sensor frame (sx, sy, sz) in meters
    const toSensorFrame = (wx: number, wy: number, wz: number): [number, number, number] => {
      const dx = wx - sensorWorld[0];
      const dy = wy - sensorWorld[1];
      const dz = wz - sensorWorld[2];
      const sx = cosYaw * dx + sinYaw * dy;
      const sy = -sinYaw * dx + cosYaw * dy;
      return [sx, sy, dz];
    };

    // 1. Ray-cast terrain and objects for each beam and azimuth
    for (let ai = 0; ai < numAzimuth; ai++) {
      const localAzimuth = ai * azimuthStep - Math.PI;
      const cosAz = Math.cos(localAzimuth);
      const sinAz = Math.sin(localAzimuth);

      // World direction of ray
      const worldAz = yaw + localAzimuth;
      const cosWAz = Math.cos(worldAz);
      const sinWAz = Math.sin(worldAz);

      for (let bi = 0; bi < verticalAngles.length; bi++) {
        const phi = verticalAngles[bi]; // elevation angle
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);

        // Ground intersection test
        // Height from ground is ~1.82m. If phi < -0.01, ray points down to ground
        if (phi < -0.015) {
          const approxDist = -1.82 / sinPhi;
          if (approxDist > 0.8 && approxDist < maxR) {
            const wx = sensorWorld[0] + cosWAz * cosPhi * approxDist;
            const wy = sensorWorld[1] + sinWAz * cosPhi * approxDist;
            const actualGroundZ = getForestElevation(wx, wy);

            // Refine intersection with terrain surface
            const trueDist = (actualGroundZ - sensorWorld[2]) / sinPhi;
            if (trueDist > 0.8 && trueDist < maxR) {
              const rwx = sensorWorld[0] + cosWAz * cosPhi * trueDist;
              const rwy = sensorWorld[1] + sinWAz * cosPhi * trueDist;
              const rwz = actualGroundZ;

              // Determine classification based on distance from trail centerline
              // Find closest point on trail
              const trailS = s + (cosYaw * (rwx - trail.x) + sinYaw * (rwy - trail.y));
              const tCenter = getTrailPos(trailS);
              const distFromTrail = Math.hypot(rwx - tCenter.x, rwy - tCenter.y);

              let label = 0; // drivable
              if (distFromTrail > 1.9 && distFromTrail <= 4.2) {
                label = 1; // rough_terrain shoulder
              } else if (distFromTrail > 4.2) {
                label = 1; // rough forest floor
              }

              // Transform to sensor frame
              const [sx, sy, sz] = toSensorFrame(rwx, rwy, rwz);

              // Jitter
              const jit = (Math.random() - 0.5) * 0.015;
              pX.push(Math.round((sx + jit) * 100));
              pY.push(Math.round((sy + jit) * 100));
              pZ.push(Math.round((sz + jit) * 100));
              pL.push(label);
            }
          }
        }
      }
    }

    // 2. Synthesize points on nearby tree trunks
    for (const tr of nearbyTrees) {
      const [tsx, tsy] = toSensorFrame(tr.x, tr.y, sensorWorld[2]);
      const trDist = Math.hypot(tsx, tsy);
      if (trDist > 55 || trDist < 1.0) continue;

      const gz = getForestElevation(tr.x, tr.y);
      const pointsPerTree = Math.max(12, Math.round(180 / Math.max(2, trDist)));
      for (let p = 0; p < pointsPerTree; p++) {
        const ang = Math.atan2(tsy, tsx) + Math.PI + (Math.random() - 0.5) * 1.5;
        const h = Math.random() * tr.height;
        const wx = tr.x + Math.cos(ang) * tr.radius;
        const wy = tr.y + Math.sin(ang) * tr.radius;
        const wz = gz + h;
        const [sx, sy, sz] = toSensorFrame(wx, wy, wz);
        pX.push(Math.round(sx * 100));
        pY.push(Math.round(sy * 100));
        pZ.push(Math.round(sz * 100));
        pL.push(2); // static_obstacle
      }

      // Canopy foliage returns
      if (trDist < 35) {
        const canopyPoints = Math.round(pointsPerTree * 0.6);
        for (let p = 0; p < canopyPoints; p++) {
          const cAng = Math.random() * Math.PI * 2;
          const cR = Math.random() * tr.canopyRadius;
          const cH = tr.height * 0.6 + Math.random() * (tr.height * 0.4);
          const wx = tr.x + Math.cos(cAng) * cR;
          const wy = tr.y + Math.sin(cAng) * cR;
          const wz = gz + cH;
          const [sx, sy, sz] = toSensorFrame(wx, wy, wz);
          pX.push(Math.round(sx * 100));
          pY.push(Math.round(sy * 100));
          pZ.push(Math.round(sz * 100));
          pL.push(2);
        }
      }
    }

    // 3. Synthesize points on fallen logs
    for (const lg of nearbyLogs) {
      const [lsx, lsy] = toSensorFrame(lg.x, lg.y, sensorWorld[2]);
      const logDist = Math.hypot(lsx, lsy);
      if (logDist > 45) continue;
      const gz = getForestElevation(lg.x, lg.y);
      const numLogPts = Math.max(16, Math.round(120 / Math.max(2, logDist)));
      const cosLA = Math.cos(lg.angle);
      const sinLA = Math.sin(lg.angle);
      for (let p = 0; p < numLogPts; p++) {
        const u = (Math.random() - 0.5) * lg.length;
        const v = (Math.random() - 0.5) * lg.radius * 2;
        const wx = lg.x + cosLA * u - sinLA * v;
        const wy = lg.y + sinLA * u + cosLA * v;
        const wz = gz + lg.radius + (Math.random() - 0.5) * lg.radius;
        const [sx, sy, sz] = toSensorFrame(wx, wy, wz);
        pX.push(Math.round(sx * 100));
        pY.push(Math.round(sy * 100));
        pZ.push(Math.round(sz * 100));
        pL.push(2); // static_obstacle
      }
    }

    // 4. Synthesize wildlife points if present
    if (wildlifeWorldPos) {
      const [wx, wy, wz] = wildlifeWorldPos;
      for (let p = 0; p < 80; p++) {
        const lx = (Math.random() - 0.5) * 1.2;
        const ly = (Math.random() - 0.5) * 0.6;
        const lz = Math.random() * 1.4;
        const [sx, sy, sz] = toSensorFrame(wx + lx, wy + ly, wz + lz);
        pX.push(Math.round(sx * 100));
        pY.push(Math.round(sy * 100));
        pZ.push(Math.round(sz * 100));
        pL.push(3); // dynamic_object
      }
    }

    const nPoints = pX.length;
    const typedX = new Int16Array(nPoints);
    const typedY = new Int16Array(nPoints);
    const typedZ = new Int16Array(nPoints);
    const typedLabel = new Int8Array(nPoints);

    typedX.set(pX);
    typedY.set(pY);
    typedZ.set(pZ);
    typedLabel.set(pL);

    frames.push({
      index: frameIdx,
      t: frameIdx * dt,
      sensor: sensorWorld,
      yaw: yaw,
      n: nPoints,
      x: typedX,
      y: typedY,
      z: typedZ,
      label: typedLabel,
      timing: {
        features_ms: 1.1 + Math.random() * 0.3,
        inference_ms: 3.8 + Math.random() * 0.6,
        projection_ms: 3.0 + Math.random() * 0.4,
        traversability_ms: 1.7 + Math.random() * 0.3,
        total_ms: 9.6 + Math.random() * 1.2,
      },
      cells: Math.round(nPoints * 0.28),
      city: cityObjects,
    });
  }

  return frames;
}
