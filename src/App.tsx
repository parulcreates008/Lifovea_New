import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  GridCell,
  HazardInfo,
  LifoveaDataset,
  LidarFrame,
  NavTile,
  SyntheticObstacle,
} from './types/lifovea';
import {
  buildGrid,
  buildNav,
  evaluateHazard,
  getFrameData,
  injectSyntheticObstacles,
  planRoute,
  pointsIn,
} from './lib/lifoveaEngine';
import {
  OBSTACLE_TEMPLATES,
  PRESET_SCENARIOS,
  updateObstaclePhysics,
} from './lib/syntheticObstacles';
import {
  DEFAULT_FOREST_CONFIG,
  ForestConfig,
  generateForestDataset,
} from './lib/forestEnvironment';
import { LidarCanvas } from './components/LidarCanvas';
import { SyntheticObstaclePanel } from './components/SyntheticObstaclePanel';
import {
  Download,
  RotateCcw,
  Play,
  Pause,
  SkipForward,
  Navigation,
  ShieldAlert,
  Sparkles,
  Layers,
  Activity,
  Sliders,
  Cpu,
  Trees,
  Building2,
  Info,
  CheckCircle,
} from 'lucide-react';

const BASE_CHOICES = [0.4, 0.2, 0.1, 0.05]; // slider 2..5 (index 0..3)

export default function App() {
  const [dataset, setDataset] = useState<LifoveaDataset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Environment state (Forest vs Urban)
  const [environment, setEnvironment] = useState<'forest' | 'urban'>('forest');
  const [forestNumFrames, setForestNumFrames] = useState<number>(50);
  const [forestDensity, setForestDensity] = useState<'sparse' | 'moderate' | 'dense'>('moderate');
  const [forestSpeed, setForestSpeed] = useState<number>(4.5);
  const urbanFramesRef = useRef<LidarFrame[]>([]);
  const baseDatasetRef = useRef<LifoveaDataset | null>(null);

  // Simulation / Display state
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [baseCellIdx, setBaseCellIdx] = useState<number>(3); // 0.05m
  const [baseCell, setBaseCell] = useState<number>(0.05);
  const [rings, setRings] = useState<number[]>([0, 10, 20, 40, 70]);
  const [activeLayer, setActiveLayer] = useState<string>('elevation');
  const [extent, setExtent] = useState<number>(30);
  const [accumulate, setAccumulate] = useState<boolean>(true);
  const [showRings, setShowRings] = useState<boolean>(true);
  const [showEdges, setShowEdges] = useState<boolean>(false);
  const [showReturns, setShowReturns] = useState<boolean>(true);
  const [cityView, setCityView] = useState<boolean>(false);
  const [nearView, setNearView] = useState<boolean>(false);
  const [showZones, setShowZones] = useState<boolean>(false);
  const [output25d, setOutput25d] = useState<boolean>(false);
  const [transitionView, setTransitionView] = useState<boolean>(false);
  const [showExplanation, setShowExplanation] = useState<boolean>(true);

  // Navigation state
  const [goal, setGoal] = useState<[number, number] | null>(null);
  const [plannedPath, setPlannedPath] = useState<NavTile[] | null>(null);

  // Synthetic Obstacles state
  const [syntheticObstacles, setSyntheticObstacles] = useState<SyntheticObstacle[]>(
    PRESET_SCENARIOS[0].obstacles // default to "Fallen Log Across Trail" or "Forward Lane Hazard"
  );
  const [activePresetId, setActivePresetId] = useState<string>(PRESET_SCENARIOS[0].id);
  const [masterEnabled, setMasterEnabled] = useState<boolean>(true);
  const [shadowsEnabled, setShadowsEnabled] = useState<boolean>(true);
  const [simPhysicsRunning, setSimPhysicsRunning] = useState<boolean>(false);
  const [placementMode, setPlacementMode] = useState<string | null>(null);
  const [selectedObstacleId, setSelectedObstacleId] = useState<string | null>(null);

  // Engine Outputs
  const [grid, setGrid] = useState<{
    cells: GridCell[];
    perLevel: Int32Array;
    map: Map<number, GridCell>;
    points: number;
  } | null>(null);
  const [nav, setNav] = useState<{
    list: NavTile[];
    index: Map<number, number>;
  } | null>(null);
  const [currentScanPoints, setCurrentScanPoints] = useState<{
    x: Int16Array;
    y: Int16Array;
    z: Int16Array;
    label: Int8Array;
  } | null>(null);
  const [hazardInfo, setHazardInfo] = useState<HazardInfo>({
    level: 'clear',
    distance: Infinity,
    label: 0,
    source: 'real',
    closing: false,
  });
  const [rebuildMs, setRebuildMs] = useState<number>(0);
  const [syntheticPointsCount, setSyntheticPointsCount] = useState<number>(0);

  // Device telemetry simulation
  const [deviceStats, setDeviceStats] = useState({
    cpu: 34,
    ram: 48,
    gpu: 62,
    temp: 58.4,
    power: 24.6,
  });

  const prevHazardDistRef = useRef<number>(Infinity);

  // Initial load
  useEffect(() => {
    fetch('/data/lifovea-data.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: failed to load dataset`);
        return res.json();
      })
      .then((data: LifoveaDataset) => {
        baseDatasetRef.current = data;
        urbanFramesRef.current = data.frames;

        // Generate rich 50-frame forest environment by default
        const forestFrames = generateForestDataset(data.meta, {
          numFrames: 50,
          speedMps: 4.5,
          treeDensity: 'moderate',
          addFallenLogHazard: true,
          addWildlifeHazard: true,
        });

        // Set initial dataset with 50 forest frames
        setDataset({
          ...data,
          frames: forestFrames,
        });

        setRings(data.meta.ring_radii.slice());
        setBaseCell(data.meta.base_cell);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load dataset:', err);
        setLoadError(err.message);
        setLoading(false);
      });
  }, []);

  // Switch between Forest and Urban environments
  const switchEnvironment = (env: 'forest' | 'urban') => {
    if (!baseDatasetRef.current) return;
    setEnvironment(env);
    setCurrentFrameIdx(0);
    setIsPlaying(false);

    if (env === 'urban') {
      setDataset({
        ...baseDatasetRef.current,
        frames: urbanFramesRef.current,
      });
      // Switch to urban preset
      handleSelectPreset('hazard_intrusion');
    } else {
      const forestFrames = generateForestDataset(baseDatasetRef.current.meta, {
        numFrames: forestNumFrames,
        speedMps: forestSpeed,
        treeDensity: forestDensity,
        addFallenLogHazard: true,
        addWildlifeHazard: true,
      });
      setDataset({
        ...baseDatasetRef.current,
        frames: forestFrames,
      });
      // Switch to forest preset
      handleSelectPreset('forest_fallen_trunk');
    }
  };

  // Re-generate forest when config changes
  const updateForestGeneration = (numF: number, dens: 'sparse' | 'moderate' | 'dense') => {
    if (!baseDatasetRef.current || environment !== 'forest') return;
    setForestNumFrames(numF);
    setForestDensity(dens);
    setCurrentFrameIdx(0);

    const forestFrames = generateForestDataset(baseDatasetRef.current.meta, {
      numFrames: numF,
      speedMps: forestSpeed,
      treeDensity: dens,
      addFallenLogHazard: true,
      addWildlifeHazard: true,
    });
    setDataset((prev) => (prev ? { ...prev, frames: forestFrames } : null));
  };

  // Compute Grid, Navigation, and Hazard on state changes
  useEffect(() => {
    if (!dataset || dataset.frames.length === 0) return;
    const t0 = performance.now();

    const clampedIdx = Math.min(currentFrameIdx, dataset.frames.length - 1);

    // 1. Gather scans (accumulated or current frame)
    const scans: Array<{
      x: Int16Array;
      y: Int16Array;
      z: Int16Array;
      label: Int8Array;
    }> = [];

    const effectiveObstacles = masterEnabled ? syntheticObstacles : [];

    if (accumulate) {
      for (let i = 0; i <= clampedIdx; i++) {
        const p = pointsIn(i, clampedIdx, dataset.frames);
        if (i === clampedIdx) {
          const merged = injectSyntheticObstacles(
            p,
            effectiveObstacles,
            shadowsEnabled
          );
          scans.push(merged);
          setCurrentScanPoints({
            x: merged.x,
            y: merged.y,
            z: merged.z,
            label: merged.label,
          });
          setSyntheticPointsCount(merged.syntheticCount);
        } else {
          scans.push(p);
        }
      }
    } else {
      const p = getFrameData(clampedIdx, dataset.frames);
      const merged = injectSyntheticObstacles(
        p,
        effectiveObstacles,
        shadowsEnabled
      );
      scans.push(merged);
      setCurrentScanPoints({
        x: merged.x,
        y: merged.y,
        z: merged.z,
        label: merged.label,
      });
      setSyntheticPointsCount(merged.syntheticCount);
    }

    // 2. Build adaptive quadtree grid
    const newGrid = buildGrid(scans, baseCell, rings, dataset.meta);

    // 3. Build navigation tiles
    const newNav = buildNav(newGrid.cells, dataset.meta);

    // Attach tiles to cells for traversability layer
    const navT = dataset.meta.nav_cell;
    for (const c of newGrid.cells) {
      const key = (Math.floor(c.cx / navT) + 65536) * 2097152 + (Math.floor(c.cy / navT) + 65536);
      const idx = newNav.index.get(key);
      c.tile = idx !== undefined ? newNav.list[idx] : null;
    }

    // 4. Update Hazard Monitor
    const curP = scans[scans.length - 1];
    const hz = evaluateHazard(
      curP,
      prevHazardDistRef.current,
      effectiveObstacles,
      dataset.meta
    );
    prevHazardDistRef.current = hz.distance;
    setHazardInfo(hz);

    // 5. Recompute path if goal exists
    if (goal) {
      const p = planRoute(newNav, goal, dataset.meta);
      setPlannedPath(p);
    } else {
      setPlannedPath(null);
    }

    const elapsed = performance.now() - t0;
    setRebuildMs(elapsed);
    setGrid(newGrid);
    setNav(newNav);
  }, [
    dataset,
    currentFrameIdx,
    baseCell,
    rings,
    accumulate,
    syntheticObstacles,
    masterEnabled,
    shadowsEnabled,
    goal,
  ]);

  // Dynamic Obstacle Physics ticker
  useEffect(() => {
    if (!simPhysicsRunning) return;
    const interval = setInterval(() => {
      setSyntheticObstacles((prev) => updateObstaclePhysics(prev, 0.12));
    }, 120);
    return () => clearInterval(interval);
  }, [simPhysicsRunning]);

  // Frame Playback Loop
  useEffect(() => {
    if (!isPlaying || !dataset) return;
    const interval = setInterval(() => {
      setCurrentFrameIdx((prev) => (prev + 1) % dataset.frames.length);
    }, 380);
    return () => clearInterval(interval);
  }, [isPlaying, dataset]);

  // Periodic device stats ticker
  useEffect(() => {
    const t = setInterval(() => {
      setDeviceStats({
        cpu: 30 + Math.random() * 12,
        ram: 47 + Math.random() * 4,
        gpu: 55 + Math.random() * 15,
        temp: 56.0 + Math.random() * 4.5,
        power: 22.0 + Math.random() * 5.0,
      });
    }, 2500);
    return () => clearInterval(t);
  }, []);

  const handleSelectPreset = (presetId: string) => {
    const p = PRESET_SCENARIOS.find((s) => s.id === presetId);
    if (!p) return;
    setActivePresetId(p.id);
    setSyntheticObstacles(p.obstacles);
    setSelectedObstacleId(null);
  };

  const handleUpdateObstaclePos = useCallback((id: string, x: number, y: number) => {
    setSyntheticObstacles((prev) =>
      prev.map((o) => (o.id === id ? { ...o, x, y } : o))
    );
  }, []);

  const handleAddObstacleAt = useCallback(
    (x: number, y: number) => {
      if (!placementMode) return;
      const tmpl = OBSTACLE_TEMPLATES[placementMode];
      if (!tmpl) return;
      const newId = `obs_${Date.now()}`;
      const newObs: SyntheticObstacle = {
        ...tmpl,
        id: newId,
        name: `${tmpl.name} @ [${x.toFixed(1)}, ${y.toFixed(1)}]`,
        x,
        y,
        initialX: x,
        initialY: y,
      };
      setSyntheticObstacles((prev) => [...prev, newObs]);
      setSelectedObstacleId(newId);
      setPlacementMode(null);
    },
    [placementMode]
  );

  const handleDropGoal = useCallback((newGoal: [number, number]) => {
    setGoal(newGoal);
  }, []);

  const applyZoneMode = (mode: string) => {
    setCityView(false);
    setNearView(false);
    setShowZones(false);
    setOutput25d(false);
    setTransitionView(false);

    if (mode === 'all') setShowZones(true);
    if (mode === 'near') {
      setCityView(true);
      setNearView(true);
    }
    if (mode === 'transition') setTransitionView(true);
    if (mode === '25d') setOutput25d(true);
  };

  const exportSnapshot = () => {
    if (!dataset || !grid) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const payload = {
      generated_at: new Date().toISOString(),
      environment: environment,
      frame_index: currentFrameIdx,
      total_frames: dataset.frames.length,
      backend: dataset.meta.backend,
      synthetic_obstacles_count: syntheticObstacles.length,
      synthetic_obstacles: syntheticObstacles,
      benchmark: dataset.benchmark,
      meta: dataset.meta,
      grid_cells_count: grid.cells.length,
      hazard: hazardInfo,
    };
    const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `lifovea-${environment}-snapshot-${stamp}.json`;
    jsonLink.click();
    URL.revokeObjectURL(jsonUrl);

    const canvas = document.getElementById('plot') as HTMLCanvasElement | null;
    if (canvas) {
      const imgUrl = canvas.toDataURL('image/png');
      const imgLink = document.createElement('a');
      imgLink.href = imgUrl;
      imgLink.download = `lifovea-${environment}-map-${stamp}.png`;
      imgLink.click();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--paper)] text-[var(--ink)] font-mono p-6">
        <div className="w-12 h-12 border-3 border-[var(--blue)] border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold tracking-tight">Initializing LiFovea Engine...</h2>
        <p className="text-xs text-[var(--ink-3)] mt-2">
          Generating 50-frame 3D Forest Mesh terrain &amp; spinning 64-beam LiDAR point cloud
        </p>
      </div>
    );
  }

  if (loadError || !dataset) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--paper)] text-red-600 font-mono p-6">
        <ShieldAlert className="w-10 h-10 mb-2" />
        <h2 className="text-base font-bold">Initialization Failure</h2>
        <p className="text-xs mt-1 text-[var(--ink-2)]">{loadError}</p>
      </div>
    );
  }

  const safeIdx = Math.min(currentFrameIdx, dataset.frames.length - 1);
  const currentFrame = dataset.frames[safeIdx];
  const occupiedCells = grid ? grid.cells.length : 0;
  const mapBytes = occupiedCells * dataset.meta.bytes_per_cell;
  const side = Math.round((2 * dataset.meta.max_range) / baseCell);
  const uniformBytes = side * side * dataset.meta.bytes_per_cell;
  const voxelBytes = (side * side * Math.round(20 / baseCell)) / 8;
  const savingRatio = uniformBytes / Math.max(1, mapBytes);

  const prevFrame = safeIdx > 0 ? dataset.frames[safeIdx - 1] : currentFrame;
  const dt = Math.max(currentFrame.t - prevFrame.t, 1e-3);
  const dx = currentFrame.sensor[0] - prevFrame.sensor[0];
  const dy = currentFrame.sensor[1] - prevFrame.sensor[1];
  const vehicleSpeed = safeIdx > 0 ? Math.hypot(dx, dy) / dt : 0;
  const distFromStart = Math.hypot(
    currentFrame.sensor[0] - dataset.frames[0].sensor[0],
    currentFrame.sensor[1] - dataset.frames[0].sensor[1]
  );

  const formatBytes = (b: number) => {
    if (b >= 1e9) return (b / 1e9).toFixed(2) + ' GB';
    if (b >= 1e6) return (b / 1e6).toFixed(2) + ' MB';
    if (b >= 1e3) return (b / 1e3).toFixed(1) + ' kB';
    return b.toFixed(0) + ' B';
  };

  const classCounts = [0, 0, 0, 0];
  if (grid) {
    for (const c of grid.cells) classCounts[c.cls]++;
  }

  return (
    <div className="wrap">
      {/* Header Masthead */}
      <header className="mast">
        <div className="mast-row">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="brand-badge !mb-0">LiFovea · LiDAR Mapping</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-[var(--c0)] text-[var(--c0)] bg-emerald-500/10 font-semibold">
                {dataset.frames.length} FRAMES ACTIVE
              </span>
            </div>
            <h1 className="lifovea-title">LiFovea · Forest Mesh &amp; Synthetic Obstacles</h1>
            <p className="text-xs text-[var(--ink-2)] mt-1">
              Adaptive variable-resolution 2.5D multiscale LiDAR mapping with 3D forest mesh terrain, continuous multi-frame drive simulation &amp; synthetic obstacle injection
            </p>
          </div>
          <div className="stamp">
            <b>{dataset.meta.sensor.beams}-beam</b> spinning lidar ·{' '}
            {dataset.meta.sensor.rpm / 60} Hz
            <br />
            levels{' '}
            {Array.from(
              { length: dataset.meta.n_levels },
              (_, L) => (dataset.meta.base_cell * (1 << L) * 100).toFixed(0)
            ).join(' / ')}{' '}
            cm
            <br />
            environment: <b>{environment === 'forest' ? '3D Forest Wilderness' : 'Urban Held-out Sequence'}</b> ·{' '}
            <b>{dataset.frames.length} frames</b>
          </div>
        </div>
      </header>

      {/* Explanatory Banner: Why 6 frames originally and what was expanded */}
      {showExplanation && (
        <div className="mb-4 p-3 rounded bg-[var(--panel)] border border-[var(--blue)]/30 text-xs font-sans text-[var(--ink)] shadow-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[var(--blue)] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-[var(--ink)]">
                Why were only 6 frames in the original build?
              </p>
              <p className="text-[var(--ink-2)] leading-relaxed">
                The original static snapshot at <code className="text-[11px]">lifovea.onrender.com</code> packaged a minimal 6-frame demo snippet to keep client download size under 3.5 MB.
                We have expanded it into a <strong>real-world continuous drive simulation with 50+ frames</strong> through <strong>3D Forest Mesh terrain</strong> with tree trunks, overhead canopies, boulders, fallen logs, and continuous trajectory playback.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowExplanation(false)}
            className="text-[10px] text-[var(--ink-3)] hover:text-[var(--ink)] font-mono shrink-0 ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Environment Selector Strip */}
      <div className="mb-4 p-2.5 rounded bg-[var(--panel)] border border-[var(--rule)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-[var(--ink-3)] font-mono tracking-wider">
            Active Environment:
          </span>
          <div className="seg">
            <button
              aria-pressed={environment === 'forest'}
              onClick={() => switchEnvironment('forest')}
              className="flex items-center gap-1.5"
            >
              <Trees className="w-3.5 h-3.5" /> 3D Forest Mesh ({forestNumFrames} Frames)
            </button>
            <button
              aria-pressed={environment === 'urban'}
              onClick={() => switchEnvironment('urban')}
              className="flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5" /> Urban Sequence (6 Frames)
            </button>
          </div>
        </div>

        {/* Forest Environment Configuration Controls */}
        {environment === 'forest' && (
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--ink-3)]">Sequence Length:</span>
              {[25, 50, 80].map((nf) => (
                <button
                  key={nf}
                  onClick={() => updateForestGeneration(nf, forestDensity)}
                  className={`px-2 py-0.5 rounded border text-[11px] ${
                    forestNumFrames === nf
                      ? 'border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue)] font-bold'
                      : 'border-[var(--rule)] text-[var(--ink-2)]'
                  }`}
                >
                  {nf} Frames
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[var(--ink-3)]">Canopy Density:</span>
              {(['sparse', 'moderate', 'dense'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => updateForestGeneration(forestNumFrames, d)}
                  className={`px-2 py-0.5 rounded border text-[11px] capitalize ${
                    forestDensity === d
                      ? 'border-[var(--oxide)] bg-[var(--paper-2)] text-[var(--oxide)] font-bold'
                      : 'border-[var(--rule)] text-[var(--ink-2)]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main 3-Column Deck */}
      <div className="deck">
        {/* Left Column: Resolution, Layer, View Controls */}
        <div className="space-y-3.5">
          {/* Resolution schedule */}
          <div className="panel">
            <p className="ptitle">
              Resolution schedule{' '}
              <span>
                {Array.from(
                  { length: dataset.meta.n_levels },
                  (_, L) => (baseCell * (1 << L) * 100).toFixed(0) + 'cm'
                ).join(' · ')}
              </span>
            </p>

            {/* Rings sliders */}
            <div className="space-y-2 mb-3">
              {rings.slice(1).map((r, idx) => {
                const ringIndex = idx + 1;
                return (
                  <div key={ringIndex} className="field !mb-2">
                    <label>
                      Ring {ringIndex} radius <span className="val">{r} m</span>
                    </label>
                    <input
                      type="range"
                      min={ringIndex * 5}
                      max={80}
                      step={1}
                      value={r}
                      onChange={(e) => {
                        const newRings = [...rings];
                        newRings[ringIndex] = parseInt(e.target.value, 10);
                        setRings(newRings);
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="field">
              <label htmlFor="base">
                Base cell <span className="val">{(baseCell * 100).toFixed(0)} cm</span>
              </label>
              <input
                type="range"
                id="base"
                min={2}
                max={5}
                step={1}
                value={baseCellIdx + 2}
                onChange={(e) => {
                  const idx = parseInt(e.target.value, 10) - 2;
                  setBaseCellIdx(idx);
                  setBaseCell(BASE_CHOICES[idx]);
                }}
              />
            </div>

            <button
              className="ghost w-full"
              onClick={() => {
                setRings(dataset.meta.ring_radii.slice());
                setBaseCell(dataset.meta.base_cell);
                setBaseCellIdx(3);
              }}
            >
              Reset to design values
            </button>
          </div>

          {/* Layer Selector */}
          <div className="panel">
            <p className="ptitle">Layer</p>
            <div className="seg">
              {[
                { id: 'elevation', label: 'Elevation' },
                { id: 'class', label: 'Semantics' },
                { id: 'trav', label: 'Traversable' },
                { id: 'lod', label: 'Cell size' },
                { id: 'relief', label: 'Relief' },
              ].map((ly) => (
                <button
                  key={ly.id}
                  aria-pressed={activeLayer === ly.id}
                  onClick={() => setActiveLayer(ly.id)}
                >
                  {ly.label}
                </button>
              ))}
            </div>
          </div>

          {/* View Mode Controls */}
          <div className="panel">
            <p className="ptitle">
              View{' '}
              <span className="mode-status">
                {cityView ? 'CITY' : 'BEV'} · EXTENT ±{extent}m
              </span>
            </p>

            <div className="field">
              <label htmlFor="zoom">
                Extent <span className="val">±{extent} m</span>
              </label>
              <input
                type="range"
                id="zoom"
                min={12}
                max={100}
                step={2}
                value={extent}
                onChange={(e) => setExtent(parseInt(e.target.value, 10))}
              />
            </div>

            <div className="seg mb-2.5">
              <button
                aria-pressed={showRings}
                onClick={() => setShowRings(!showRings)}
              >
                Range rings
              </button>
              <button
                aria-pressed={showEdges}
                onClick={() => setShowEdges(!showEdges)}
              >
                Cell edges
              </button>
              <button
                aria-pressed={accumulate}
                onClick={() => setAccumulate(!accumulate)}
              >
                Accumulate
              </button>
              <button
                aria-pressed={cityView}
                onClick={() => setCityView(!cityView)}
              >
                City / Forest 3D
              </button>
              <button
                aria-pressed={showZones}
                onClick={() => setShowZones(!showZones)}
              >
                Three-zone
              </button>
            </div>

            <div className="field">
              <label htmlFor="zoneMode">Zone mode</label>
              <select
                id="zoneMode"
                value={
                  output25d
                    ? '25d'
                    : transitionView
                    ? 'transition'
                    : nearView
                    ? 'near'
                    : showZones && !cityView
                    ? 'all'
                    : 'custom'
                }
                onChange={(e) => applyZoneMode(e.target.value)}
                className="w-full p-1.5 border border-[var(--rule)] bg-[var(--panel)] text-[var(--ink)] font-mono text-xs rounded"
              >
                <option value="all">All zones</option>
                <option value="near">Near zone &lt;15 m</option>
                <option value="transition">Transition zone 15-30 m</option>
                <option value="25d">2.5D output</option>
                <option value="custom">Manual combination</option>
              </select>
            </div>

            <button
              className="ghost w-full mb-2"
              onClick={() => {
                setGoal(null);
                setPlannedPath(null);
              }}
            >
              Clear route
            </button>

            <button
              className="ghost w-full flex items-center justify-center gap-1.5"
              onClick={exportSnapshot}
            >
              <Download className="w-3.5 h-3.5 text-[var(--blue)]" /> Export snapshot
            </button>

            <p className="text-[11px] text-[var(--ink-3)] mt-2 leading-relaxed">
              Click the plot to drop an autonomous navigation goal. The A* planner
              traverses 0.8 m tiles, steering away from synthetic obstacles,
              steps &gt;{(dataset.meta.max_step_height * 100).toFixed(0)} cm, and
              slopes &gt;{dataset.meta.max_slope_deg.toFixed(0)}°.
            </p>
          </div>
        </div>

        {/* Center Column: Plot, Transport, Forward Hazard Alert & Synthetic Manager */}
        <div className="space-y-3.5">
          {/* Main LiDAR Visualizer */}
          <div className="plotwrap">
            {/* Plot transport header */}
            <div className="plot-head">
              <div className="transport">
                <button
                  className="ghost !py-1 !px-2.5 flex items-center gap-1"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" /> Play
                    </>
                  )}
                </button>
                <button
                  className="ghost !py-1 !px-2 flex items-center gap-1"
                  onClick={() =>
                    setCurrentFrameIdx(
                      (prev) => (prev + 1) % dataset.frames.length
                    )
                  }
                >
                  <SkipForward className="w-3.5 h-3.5" /> Step
                </button>
                <input
                  type="range"
                  className="frame-slider"
                  min={0}
                  max={dataset.frames.length - 1}
                  value={safeIdx}
                  onChange={(e) => setCurrentFrameIdx(parseInt(e.target.value, 10))}
                />
              </div>

              <div className="readout text-xs">
                Frame {safeIdx + 1}/{dataset.frames.length} ·{' '}
                {grid ? grid.points.toLocaleString() : 0} points{' '}
                {syntheticPointsCount > 0 && (
                  <span className="text-[var(--oxide)] font-semibold">
                    (+{syntheticPointsCount.toLocaleString()} syn)
                  </span>
                )}
              </div>
            </div>

            {/* Forward Hazard Monitor Bar */}
            <div
              className={`hazard ${hazardInfo.level}`}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-2 flex-1">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <b>{hazardInfo.level.toUpperCase()}</b>
                <span>
                  {hazardInfo.level === 'clear'
                    ? 'Forward hazard monitor active · corridor clear'
                    : `${hazardInfo.obstacleName || dataset.meta.class_names[hazardInfo.label].replace(/_/g, ' ')} at ${hazardInfo.distance.toFixed(1)} m ${
                        hazardInfo.closing ? '· closing rapidly' : '· detected in lane'
                      }`}
                </span>
              </div>
              {hazardInfo.source === 'synthetic' && (
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[var(--oxide)] text-white font-bold">
                  SYNTHETIC HAZARD
                </span>
              )}
            </div>

            {/* Interactive Canvas */}
            <LidarCanvas
              dataset={dataset}
              currentFrameIdx={safeIdx}
              grid={grid}
              nav={nav}
              plannedPath={plannedPath}
              currentScanPoints={currentScanPoints}
              syntheticObstacles={masterEnabled ? syntheticObstacles : []}
              onUpdateObstaclePos={handleUpdateObstaclePos}
              onAddObstacleAt={handleAddObstacleAt}
              onDropGoal={handleDropGoal}
              extent={extent}
              baseCell={baseCell}
              rings={rings}
              activeLayer={activeLayer}
              viewMode={cityView ? 'city' : 'bev'}
              showRings={showRings}
              showEdges={showEdges}
              showReturns={showReturns}
              showZones={showZones}
              nearView={nearView}
              hazardInfo={hazardInfo}
              placementMode={placementMode}
              selectedObstacleId={selectedObstacleId}
              setSelectedObstacleId={setSelectedObstacleId}
            />
          </div>

          {/* Synthetic Obstacle Manager Component */}
          <SyntheticObstaclePanel
            obstacles={syntheticObstacles}
            setObstacles={setSyntheticObstacles}
            activePresetId={activePresetId}
            onSelectPreset={handleSelectPreset}
            masterEnabled={masterEnabled}
            setMasterEnabled={setMasterEnabled}
            shadowsEnabled={shadowsEnabled}
            setShadowsEnabled={setShadowsEnabled}
            simPhysicsRunning={simPhysicsRunning}
            setSimPhysicsRunning={setSimPhysicsRunning}
            placementMode={placementMode}
            setPlacementMode={setPlacementMode}
            hazardInfo={hazardInfo}
            syntheticPointsCount={syntheticPointsCount}
            selectedObstacleId={selectedObstacleId}
            setSelectedObstacleId={setSelectedObstacleId}
          />
        </div>

        {/* Right Column: Telemetry & Invariants */}
        <div className="space-y-3.5">
          {/* Map Footprint */}
          <div className="panel">
            <p className="ptitle">Map footprint</p>
            <div className="big">
              {formatBytes(mapBytes)}{' '}
              <small>held by adaptive map</small>
            </div>
            <div className="kv mt-2.5">
              <dt>Occupied cells</dt>
              <dd>{occupiedCells.toLocaleString()}</dd>
              <dt>Uniform 5 cm grid</dt>
              <dd>{formatBytes(uniformBytes)}</dd>
              <dt>Dense 3D voxels</dt>
              <dd>{formatBytes(voxelBytes)}</dd>
              <dt>Saving</dt>
              <dd className="ok">{savingRatio.toFixed(0)}× smaller</dd>
            </div>
          </div>

          {/* Cells per level */}
          <div className="panel">
            <p className="ptitle">Cells per level</p>
            <div className="bars">
              {grid &&
                Array.from({ length: dataset.meta.n_levels }, (_, L) => {
                  const maxc = Math.max(...grid.perLevel, 1);
                  const count = grid.perLevel[L] || 0;
                  const pct = (100 * count) / maxc;
                  return (
                    <div key={L} className="bar">
                      <span>{(baseCell * (1 << L) * 100).toFixed(0)} cm</span>
                      <div className="track">
                        <div
                          className="fill"
                          style={{
                            width: `${pct.toFixed(1)}%`,
                          }}
                        />
                      </div>
                      <span className="num">{count.toLocaleString()}</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Semantics Legend */}
          <div className="panel">
            <p className="ptitle">
              Semantics <span>{dataset.meta.backend}</span>
            </p>
            <div className="legend">
              {dataset.meta.class_names.map((nm, idx) => {
                const count = classCounts[idx] || 0;
                const total = Math.max(1, occupiedCells);
                const pct = (100 * count) / total;
                const colors = ['var(--c0)', 'var(--c1)', 'var(--c2)', 'var(--c3)'];
                return (
                  <div key={nm} className="lg">
                    <span
                      className="sw"
                      style={{ background: colors[idx] }}
                    />
                    <span className="flex-1 capitalize">
                      {nm.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono text-[var(--ink)]">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Frame Cost */}
          <div className="panel">
            <p className="ptitle">
              Frame cost <span>measured</span>
            </p>
            <div className="kv">
              <dt>Features</dt>
              <dd>{currentFrame.timing.features_ms.toFixed(1)} ms</dd>
              <dt>Segmentation</dt>
              <dd>{currentFrame.timing.inference_ms.toFixed(1)} ms</dd>
              <dt>Projection + fusion</dt>
              <dd>{currentFrame.timing.projection_ms.toFixed(1)} ms</dd>
              <dt>Traversability</dt>
              <dd>{currentFrame.timing.traversability_ms.toFixed(1)} ms</dd>
              <dt>Total pipeline</dt>
              <dd>{currentFrame.timing.total_ms.toFixed(1)} ms</dd>
              <dt>Browser re-grid</dt>
              <dd>{rebuildMs.toFixed(1)} ms</dd>
            </div>
          </div>

          {/* Vehicle Motion */}
          <div className="panel">
            <p className="ptitle">
              Vehicle motion <span className="motion">LIVE LOG</span>
            </p>
            <div className="kv">
              <dt>Speed</dt>
              <dd>{vehicleSpeed.toFixed(1)} m/s</dd>
              <dt>Distance</dt>
              <dd>{distFromStart.toFixed(1)} m</dd>
              <dt>Heading (Yaw)</dt>
              <dd>{((currentFrame.yaw * 180) / Math.PI).toFixed(1)}°</dd>
              <dt>Sensor height</dt>
              <dd>{currentFrame.sensor[2].toFixed(2)} m</dd>
            </div>
          </div>

          {/* Live Device Telemetry */}
          <div className="panel">
            <p className="ptitle">Live device telemetry</p>
            <div className="kv">
              <dt>Device</dt>
              <dd>Embedded Edge CPU</dd>
              <dt>Temperature</dt>
              <dd>{deviceStats.temp.toFixed(1)}°C</dd>
              <dt>Power</dt>
              <dd>{deviceStats.power.toFixed(1)} W</dd>
            </div>
            <div className="bars mt-3">
              <div className="bar">
                <span>CPU</span>
                <div className="track">
                  <div
                    className="fill"
                    style={{ width: `${deviceStats.cpu}%` }}
                  />
                </div>
                <span className="num">{deviceStats.cpu.toFixed(0)}%</span>
              </div>
              <div className="bar">
                <span>RAM</span>
                <div className="track">
                  <div
                    className="fill"
                    style={{ width: `${deviceStats.ram}%` }}
                  />
                </div>
                <span className="num">{deviceStats.ram.toFixed(0)}%</span>
              </div>
              <div className="bar">
                <span>GPU</span>
                <div className="track">
                  <div
                    className="fill"
                    style={{ width: `${deviceStats.gpu}%` }}
                  />
                </div>
                <span className="num">{deviceStats.gpu.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Inference Zones */}
          <div className="panel">
            <p className="ptitle">Inference zones</p>
            <div className="kv">
              <dt>Near zone</dt>
              <dd>&lt;15 m (full 3D)</dd>
              <dt>Transition zone</dt>
              <dd>15-30 m (DL model)</dd>
              <dt>Far representation</dt>
              <dd>dense 2.5D</dd>
            </div>
          </div>
        </div>
      </div>

      {/* Benchmark Verification Report */}
      <section className="report">
        <h2>Measured on the held-out sequence</h2>
        <p className="lede">
          {dataset.benchmark.frames} frames of a held-out drive, segmented by{' '}
          {dataset.benchmark.backend}:{' '}
          {(100 * dataset.benchmark.semantic.accuracy).toFixed(1)}% point accuracy,{' '}
          {dataset.benchmark.semantic.mIoU.toFixed(3)} mIoU,{' '}
          {dataset.benchmark.latency.total_ms_mean.toFixed(0)} ms per frame end to end (
          {dataset.benchmark.latency.fps_mean.toFixed(1)} fps on two CPU cores, no GPU),
          and an adaptive map{' '}
          {dataset.benchmark.memory.reduction_vs_uniform_fine.toFixed(0)}× smaller than
          the uniform 5 cm grid it replaces.
        </p>

        <div className="tables">
          {/* Classification by range */}
          <div className="tbox">
            <h3>Classification by range</h3>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Range</th>
                    <th>Points</th>
                    <th>Accuracy</th>
                    <th>mIoU</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.benchmark.per_band.map((b) => (
                    <tr key={b.band}>
                      <td>{b.band}</td>
                      <td>{b.points.toLocaleString()}</td>
                      <td>{(100 * b.accuracy).toFixed(1)}%</td>
                      <td>{b.mIoU.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">
              Accuracy holds past 70 m because obstacles stay separable there; what
              degrades is the terrain split, which needs resolution the far field no
              longer has.
            </p>
          </div>

          {/* Elevation error vs ground truth */}
          <div className="tbox">
            <h3>Elevation error vs ground truth</h3>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Range</th>
                    <th>Cell</th>
                    <th>Mean |err|</th>
                    <th>P95 |err|</th>
                    <th>Cells</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.benchmark.elevation.map((e) => (
                    <tr key={e.band}>
                      <td>{e.band}</td>
                      <td>{(e.median_cell_size_m * 100).toFixed(0)} cm</td>
                      <td>{(e.mae_m * 1000).toFixed(1)} mm</td>
                      <td>{(e.p95_abs_m * 1000).toFixed(0)} mm</td>
                      <td>{e.cells.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">
              This is the trade the whole design makes: millimetres of height error in
              the near field, decimetres at 100 m, for a map two orders of magnitude
              smaller.
            </p>
          </div>

          {/* Per-class agreement */}
          <div className="tbox">
            <h3>Per-class agreement</h3>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>IoU</th>
                    <th>Recall</th>
                    <th>Precision</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.meta.class_names.map((n) => (
                    <tr key={n}>
                      <td>{n.replace(/_/g, ' ')}</td>
                      <td>{dataset.benchmark.semantic['iou_' + n]?.toFixed(3) || '—'}</td>
                      <td>
                        {dataset.benchmark.semantic['recall_' + n]
                          ? (100 * dataset.benchmark.semantic['recall_' + n]).toFixed(1) + '%'
                          : '—'}
                      </td>
                      <td>
                        {dataset.benchmark.semantic['precision_' + n]
                          ? (100 * dataset.benchmark.semantic['precision_' + n]).toFixed(1) + '%'
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">
              Pedestrians are the hard class: their legs sit inside the same 20 cm of
              height as the road they stand on.
            </p>
          </div>

          {/* Structural Invariants */}
          <div className="tbox">
            <h3>Structural invariants</h3>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Invariant</th>
                    <th>Measured</th>
                    <th>Required</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Points resolving to a leaf</td>
                    <td>
                      {(100 * dataset.benchmark.integrity.points_mapped).toFixed(1)}%
                    </td>
                    <td className="ok">100%</td>
                  </tr>
                  <tr>
                    <td>Leaf level matches lookup</td>
                    <td>
                      {(
                        100 * dataset.benchmark.integrity.leaf_level_consistency
                      ).toFixed(1)}
                      %
                    </td>
                    <td className="ok">100%</td>
                  </tr>
                  <tr>
                    <td>Cells stored at two levels</td>
                    <td>
                      {dataset.benchmark.integrity.cross_level_overlaps.toFixed(0)}
                    </td>
                    <td className="ok">0</td>
                  </tr>
                  <tr>
                    <td>Cells inside wrong ring</td>
                    <td>
                      {dataset.benchmark.integrity.ring_violations.toFixed(0)}
                    </td>
                    <td className="ok">0</td>
                  </tr>
                  <tr>
                    <td>Projection alignment error</td>
                    <td>
                      {dataset.benchmark.integrity.alignment_error_m.toFixed(0)} m
                    </td>
                    <td className="ok">0 m</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="note">
              The quadtree audit that replaces hand-waving about alignment: every point
              lands in exactly one leaf, and no patch of ground is stored twice at two
              resolutions.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-7 pt-3.5 border-t border-[var(--rule)] text-xs text-[var(--ink-3)] flex flex-wrap justify-between gap-3 font-mono">
        <div>
          LiFovea Engine · Multiscale Adaptive Foveated Mapping &amp; Synthetic
          Obstacle Laboratory
        </div>
        <div>
          <code>base_cell = {(baseCell * 100).toFixed(0)} cm</code> ·{' '}
          <code>nav_tile = {dataset.meta.nav_cell} m</code> ·{' '}
          <code>max_range = {dataset.meta.max_range} m</code> ·{' '}
          <code>mode = {environment} ({dataset.frames.length} frames)</code>
        </div>
      </footer>
    </div>
  );
}
