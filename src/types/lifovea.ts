export interface LidarSensorMeta {
  beams: number;
  azimuth_steps: number;
  rpm: number;
}

export interface LidarMeta {
  generated: string;
  backend: string;
  checkpoint: string;
  base_cell: number;
  n_levels: number;
  ring_radii: number[];
  max_range: number;
  nav_cell: number;
  max_slope_deg: number;
  max_step_height: number;
  clearance_height: number;
  near_zone_radius: number;
  transition_zone_radius: number;
  transition_stride: number;
  far_stride: number;
  bytes_per_cell: number;
  class_names: string[];
  class_colors: number[][];
  sensor: LidarSensorMeta;
}

export interface CityObject {
  kind: number; // 0: box, 1: cylinder, etc.
  params: number[];
  label: number;
}

export interface LidarFrame {
  index: number;
  t: number;
  sensor: [number, number, number];
  yaw: number;
  n: number;
  x: string | Int16Array;
  y: string | Int16Array;
  z: string | Int16Array;
  label: string | Int8Array;
  timing: {
    features_ms: number;
    inference_ms: number;
    projection_ms: number;
    traversability_ms: number;
    total_ms: number;
  };
  cells: number;
  city?: CityObject[];
}

export interface BenchmarkData {
  config: Record<string, unknown>;
  backend: string;
  frames: number;
  semantic: {
    accuracy: number;
    mIoU: number;
    [key: string]: number;
  };
  semantic_raw: Record<string, number>;
  per_band: Array<{
    band: string;
    points: number;
    accuracy: number;
    mIoU: number;
  }>;
  elevation: Array<{
    band: string;
    median_cell_size_m: number;
    mae_m: number;
    p95_abs_m: number;
    cells: number;
  }>;
  latency: {
    total_ms_mean: number;
    fps_mean: number;
  };
  memory: {
    reduction_vs_uniform_fine: number;
    reduction_vs_dense_voxel: number;
  };
  integrity: {
    points_mapped: number;
    leaf_level_consistency: number;
    cross_level_overlaps: number;
    ring_violations: number;
    alignment_error_m: number;
  };
  level_histogram: number[];
  notes?: string[];
}

export interface LifoveaDataset {
  meta: LidarMeta;
  benchmark: BenchmarkData;
  frames: LidarFrame[];
}

export interface DecodedFrameData {
  x: Int16Array;
  y: Int16Array;
  z: Int16Array;
  label: Int8Array;
  meta: LidarFrame;
}

export interface GridCell {
  L: number;
  r: number;
  cx: number;
  cy: number;
  n: number;
  zs: number;
  zmin: number;
  zmax: number;
  k: [number, number, number, number];
  g: number;
  gz: number;
  z: number;
  cls: number;
  relief: number;
  tile?: NavTile | null;
  synthetic?: boolean;
}

export interface NavTile {
  ix: number;
  iy: number;
  cx: number;
  cy: number;
  zmin: number;
  zmax: number;
  zs: number;
  ng: number;
  blocked: boolean;
  z: number;
  relief: number;
  passable: boolean;
  nb: number[];
  nd: number[];
  slope: number;
  reach: boolean;
}

export interface SyntheticObstacle {
  id: string;
  name: string;
  type: 'car' | 'pedestrian' | 'barrier' | 'cone' | 'debris' | 'cyclist' | 'box';
  x: number; // forward position relative to sensor (m)
  y: number; // lateral position relative to sensor (m)
  z: number; // base z relative to sensor (m)
  width: number; // lateral dimension (m)
  length: number; // longitudinal dimension (m)
  height: number; // vertical height (m)
  yaw: number; // rotation in radians
  semanticClass: 2 | 3; // 2: static_obstacle, 3: dynamic_object
  dynamic: boolean;
  velocity: { vx: number; vy: number }; // m/s
  trajectory: 'stationary' | 'cross_lane' | 'head_on' | 'slalom_wander' | 'cut_in' | 'patrol';
  pointDensity: number; // target points density
  reflectivity: number;
  enabled: boolean;
  castsShadow: boolean;
  color?: string;
  initialX?: number;
  initialY?: number;
}

export interface HazardInfo {
  level: 'clear' | 'warning' | 'critical';
  distance: number;
  label: number;
  source: 'real' | 'synthetic';
  obstacleName?: string;
  ttcSeconds?: number;
  closing: boolean;
}
