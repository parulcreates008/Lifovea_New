import React, { useState } from 'react';
import {
  AlertTriangle,
  Box,
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  EyeOff,
  Move,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import {
  OBSTACLE_TEMPLATES,
  PRESET_SCENARIOS,
} from '../lib/syntheticObstacles';
import { HazardInfo, SyntheticObstacle } from '../types/lifovea';

interface Props {
  obstacles: SyntheticObstacle[];
  setObstacles: React.Dispatch<React.SetStateAction<SyntheticObstacle[]>>;
  activePresetId: string;
  onSelectPreset: (presetId: string) => void;
  masterEnabled: boolean;
  setMasterEnabled: (enabled: boolean) => void;
  shadowsEnabled: boolean;
  setShadowsEnabled: (enabled: boolean) => void;
  simPhysicsRunning: boolean;
  setSimPhysicsRunning: (running: boolean) => void;
  placementMode: string | null; // null or template key
  setPlacementMode: (mode: string | null) => void;
  hazardInfo: HazardInfo;
  syntheticPointsCount: number;
  selectedObstacleId: string | null;
  setSelectedObstacleId: (id: string | null) => void;
}

export const SyntheticObstaclePanel: React.FC<Props> = ({
  obstacles,
  setObstacles,
  activePresetId,
  onSelectPreset,
  masterEnabled,
  setMasterEnabled,
  shadowsEnabled,
  setShadowsEnabled,
  simPhysicsRunning,
  setSimPhysicsRunning,
  placementMode,
  setPlacementMode,
  hazardInfo,
  syntheticPointsCount,
  selectedObstacleId,
  setSelectedObstacleId,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const toggleObstacle = (id: string) => {
    setObstacles((prev) =>
      prev.map((o) => (o.id === id ? { ...o, enabled: !o.enabled } : o))
    );
  };

  const removeObstacle = (id: string) => {
    setObstacles((prev) => prev.filter((o) => o.id !== id));
    if (selectedObstacleId === id) setSelectedObstacleId(null);
    if (expandedId === id) setExpandedId(null);
  };

  const updateObstacle = (id: string, patch: Partial<SyntheticObstacle>) => {
    setObstacles((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...patch } : o))
    );
  };

  const addNewObstacle = (templateKey: string) => {
    const tmpl = OBSTACLE_TEMPLATES[templateKey];
    if (!tmpl) return;
    const newId = `obs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newObs: SyntheticObstacle = {
      ...tmpl,
      id: newId,
      name: `${tmpl.name} #${obstacles.length + 1}`,
      x: 8.0,
      y: (Math.random() - 0.5) * 4.0,
      initialX: 8.0,
      initialY: 0.0,
    };
    setObstacles((prev) => [...prev, newObs]);
    setExpandedId(newId);
    setSelectedObstacleId(newId);
    setShowAddMenu(false);
  };

  return (
    <div className="space-y-3">
      {/* Header and Master Switch */}
      <div className="panel !p-3">
        <div className="flex items-center justify-between border-b border-[var(--rule-2)] pb-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--oxide)] animate-pulse" />
            <p className="ptitle !mb-0 text-[12px] text-[var(--ink)] font-bold">
              Synthetic Obstacles <span>SIMULATOR</span>
            </p>
          </div>
          <button
            onClick={() => setMasterEnabled(!masterEnabled)}
            className={`px-2.5 py-1 text-xs font-mono font-semibold rounded border transition-colors ${
              masterEnabled
                ? 'bg-[var(--oxide)] border-[var(--oxide)] text-white'
                : 'border-[var(--rule)] text-[var(--ink-3)] bg-transparent'
            }`}
          >
            {masterEnabled ? 'ACTIVE' : 'BYPASSED'}
          </button>
        </div>

        {/* Hazard alert pill in obstacle panel */}
        {hazardInfo.level !== 'clear' && (
          <div
            className={`mb-3 p-2 rounded text-xs font-mono flex items-center justify-between border ${
              hazardInfo.level === 'critical'
                ? 'bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                <strong>{hazardInfo.level.toUpperCase()}</strong>: {hazardInfo.obstacleName || 'Obstacle'} @ {hazardInfo.distance.toFixed(1)}m
              </span>
            </div>
            {hazardInfo.source === 'synthetic' && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[var(--oxide)] text-white">
                SYNTHETIC
              </span>
            )}
          </div>
        )}

        {/* Live Metrics */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-[var(--paper-2)] p-2 rounded mb-3 border border-[var(--rule)]">
          <div>
            <div className="text-[var(--ink-3)] text-[10px] uppercase">Active</div>
            <div className="font-bold text-[var(--ink)] text-sm">
              {obstacles.filter((o) => o.enabled).length}/{obstacles.length}
            </div>
          </div>
          <div>
            <div className="text-[var(--ink-3)] text-[10px] uppercase">Syn Points</div>
            <div className="font-bold text-[var(--blue)] text-sm">
              {syntheticPointsCount.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[var(--ink-3)] text-[10px] uppercase">Nearest</div>
            <div className="font-bold text-[var(--oxide)] text-sm">
              {isFinite(hazardInfo.distance)
                ? `${hazardInfo.distance.toFixed(1)}m`
                : '—'}
            </div>
          </div>
        </div>

        {/* Preset Scenarios */}
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-[var(--ink-3)] uppercase tracking-wider block mb-1.5">
            Test Scenarios & Presets
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESET_SCENARIOS.map((ps) => {
              const isSelected = activePresetId === ps.id;
              return (
                <button
                  key={ps.id}
                  onClick={() => onSelectPreset(ps.id)}
                  className={`text-left p-1.5 rounded text-[11px] border transition-all ${
                    isSelected
                      ? 'border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue)] font-semibold shadow-xs'
                      : 'border-[var(--rule)] hover:border-[var(--blue)] text-[var(--ink-2)] bg-transparent'
                  }`}
                  title={ps.description}
                >
                  <div className="truncate font-sans">{ps.name}</div>
                  <div className="text-[9px] font-mono text-[var(--ink-3)] tracking-tight">
                    {ps.badge}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Placement & Simulation Controls */}
        <div className="space-y-2 border-t border-[var(--rule-2)] pt-2.5">
          <div className="flex gap-2">
            <button
              onClick={() => setSimPhysicsRunning(!simPhysicsRunning)}
              className={`flex-1 py-1 px-2 rounded text-xs font-mono font-medium border flex items-center justify-center gap-1.5 transition-colors ${
                simPhysicsRunning
                  ? 'border-emerald-600 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-[var(--rule)] text-[var(--ink-2)] hover:border-[var(--blue)]'
              }`}
            >
              {simPhysicsRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Physics Running
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Start Dynamic Physics
                </>
              )}
            </button>

            <button
              onClick={() => setShadowsEnabled(!shadowsEnabled)}
              className={`py-1 px-2 rounded text-xs font-mono border flex items-center gap-1 transition-colors ${
                shadowsEnabled
                  ? 'border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue)]'
                  : 'border-[var(--rule)] text-[var(--ink-3)]'
              }`}
              title="Absorbs background LiDAR returns behind solid synthetic obstacles"
            >
              Shadows: {shadowsEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Click to Drop Mode */}
          <div className="p-2 rounded bg-[var(--paper)] border border-[var(--rule)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-[var(--ink-2)] flex items-center gap-1">
                <Move className="w-3 h-3 text-[var(--blue)]" />
                Click-to-Place on Map
              </span>
              {placementMode && (
                <button
                  onClick={() => setPlacementMode(null)}
                  className="text-[10px] text-red-500 hover:underline"
                >
                  Cancel
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[
                { key: 'car', label: '🚗 Car' },
                { key: 'pedestrian', label: '🚶 Walker' },
                { key: 'barrier', label: '🚧 Barrier' },
                { key: 'cone', label: '🔺 Cone' },
                { key: 'fallen_log', label: '🪵 Log' },
                { key: 'boulder', label: '🪨 Rock' },
                { key: 'wildlife', label: '🦌 Deer' },
                { key: 'debris', label: '📦 Crate' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() =>
                    setPlacementMode(placementMode === item.key ? null : item.key)
                  }
                  className={`text-[10px] py-1 px-1.5 rounded font-mono border text-center transition-colors ${
                    placementMode === item.key
                      ? 'bg-[var(--blue)] text-white border-[var(--blue)] font-bold'
                      : 'border-[var(--rule)] text-[var(--ink-2)] hover:border-[var(--blue)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {placementMode && (
              <p className="text-[10px] text-[var(--blue)] font-mono mt-1 text-center animate-pulse">
                Click anywhere on the LiDAR plot to place {placementMode}!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Obstacles List and Properties */}
      <div className="panel !p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="ptitle !mb-0 text-[11px]">
            Obstacle Inventory ({obstacles.length})
          </p>
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="ghost !py-1 !px-2 text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-[var(--blue)]" /> Add Obstacle
            </button>
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-[var(--panel)] border border-[var(--rule)] shadow-lg rounded z-20 py-1 font-sans text-xs">
                {Object.entries(OBSTACLE_TEMPLATES).map(([k, t]) => (
                  <button
                    key={k}
                    onClick={() => addNewObstacle(k)}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--paper-2)] text-[var(--ink)] flex items-center justify-between"
                  >
                    <span>{t.name}</span>
                    <span className="text-[9px] font-mono text-[var(--ink-3)]">
                      {t.dynamic ? 'DYN' : 'STAT'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {obstacles.length === 0 ? (
          <div className="text-center py-6 text-xs text-[var(--ink-3)] font-mono">
            No synthetic obstacles in scene.
            <br />
            Select a preset above or click &ldquo;Add Obstacle&rdquo;.
          </div>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {obstacles.map((obs) => {
              const isExpanded = expandedId === obs.id;
              const isSelected = selectedObstacleId === obs.id;
              const dist = Math.hypot(obs.x, obs.y);
              const inLane =
                obs.x >= 0 && obs.x <= 24 && Math.abs(obs.y) <= 2.2;

              return (
                <div
                  key={obs.id}
                  className={`border rounded p-2 text-xs transition-all ${
                    isSelected
                      ? 'border-[var(--oxide)] bg-[var(--paper-2)]'
                      : 'border-[var(--rule)] bg-[var(--paper)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <button
                        onClick={() => toggleObstacle(obs.id)}
                        className={`p-1 rounded text-[11px] ${
                          obs.enabled
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-[var(--ink-3)]'
                        }`}
                        title={obs.enabled ? 'Enabled' : 'Disabled'}
                      >
                        {obs.enabled ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setSelectedObstacleId(isSelected ? null : obs.id);
                          setExpandedId(isExpanded ? null : obs.id);
                        }}
                        className="font-medium text-[var(--ink)] truncate text-left flex-1"
                      >
                        {obs.name}
                      </button>

                      <span
                        className={`text-[9px] font-mono px-1 py-0.5 rounded font-semibold shrink-0 ${
                          obs.semanticClass === 3
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {obs.semanticClass === 3 ? 'DYNAMIC' : 'STATIC'}
                      </span>

                      {inLane && (
                        <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-red-600 text-white font-bold shrink-0">
                          IN LANE
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 font-mono text-[11px] text-[var(--ink-3)]">
                      <span>{dist.toFixed(1)}m</span>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : obs.id)}
                        className="p-1 hover:text-[var(--ink)]"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Edit Drawer */}
                  {isExpanded && (
                    <div className="mt-2.5 pt-2 border-t border-[var(--rule-2)] space-y-2 font-mono text-[11px]">
                      {/* Name edit */}
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[var(--ink-3)]">Label</label>
                        <input
                          type="text"
                          value={obs.name}
                          onChange={(e) =>
                            updateObstacle(obs.id, { name: e.target.value })
                          }
                          className="px-1.5 py-0.5 border border-[var(--rule)] rounded bg-[var(--panel)] text-[var(--ink)] text-xs font-sans w-36"
                        />
                      </div>

                      {/* X forward position */}
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[var(--ink-3)]">
                          Forward X: <strong className="text-[var(--ink)]">{obs.x.toFixed(1)} m</strong>
                        </label>
                        <input
                          type="range"
                          min="0.5"
                          max="50"
                          step="0.2"
                          value={obs.x}
                          onChange={(e) =>
                            updateObstacle(obs.id, { x: parseFloat(e.target.value) })
                          }
                          className="w-28 accent-[var(--blue)]"
                        />
                      </div>

                      {/* Y lateral position */}
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[var(--ink-3)]">
                          Lateral Y: <strong className="text-[var(--ink)]">{obs.y.toFixed(1)} m</strong>
                        </label>
                        <input
                          type="range"
                          min="-10"
                          max="10"
                          step="0.2"
                          value={obs.y}
                          onChange={(e) =>
                            updateObstacle(obs.id, { y: parseFloat(e.target.value) })
                          }
                          className="w-28 accent-[var(--blue)]"
                        />
                      </div>

                      {/* Heading Yaw */}
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[var(--ink-3)]">
                          Heading Yaw: <strong className="text-[var(--ink)]">{((obs.yaw * 180) / Math.PI).toFixed(0)}°</strong>
                        </label>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          step="5"
                          value={(obs.yaw * 180) / Math.PI}
                          onChange={(e) =>
                            updateObstacle(obs.id, {
                              yaw: (parseFloat(e.target.value) * Math.PI) / 180,
                            })
                          }
                          className="w-28 accent-[var(--blue)]"
                        />
                      </div>

                      {/* Dynamic Trajectory Controls */}
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[var(--ink-3)]">Dynamic Motion</label>
                        <button
                          onClick={() =>
                            updateObstacle(obs.id, {
                              dynamic: !obs.dynamic,
                              semanticClass: !obs.dynamic ? 3 : 2,
                            })
                          }
                          className={`px-2 py-0.5 rounded text-[10px] border ${
                            obs.dynamic
                              ? 'border-rose-500 bg-rose-500/10 text-rose-600 font-bold'
                              : 'border-[var(--rule)] text-[var(--ink-3)]'
                          }`}
                        >
                          {obs.dynamic ? 'MOVING' : 'STATIC'}
                        </button>
                      </div>

                      {obs.dynamic && (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-[var(--ink-3)]">Trajectory Pattern</label>
                            <select
                              value={obs.trajectory}
                              onChange={(e) =>
                                updateObstacle(obs.id, {
                                  trajectory: e.target.value as any,
                                })
                              }
                              className="px-1 py-0.5 border border-[var(--rule)] rounded bg-[var(--panel)] text-[var(--ink)] text-[10px]"
                            >
                              <option value="cross_lane">Cross-Lane Jaywalk</option>
                              <option value="head_on">Head-On Approach</option>
                              <option value="cut_in">Cut-In Swerve</option>
                              <option value="patrol">Patrol Wander</option>
                            </select>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-[var(--ink-3)]">
                              Speed: <strong className="text-[var(--ink)]">{Math.hypot(obs.velocity.vx, obs.velocity.vy).toFixed(1)} m/s</strong>
                            </label>
                            <input
                              type="range"
                              min="0.2"
                              max="6.0"
                              step="0.2"
                              value={Math.hypot(obs.velocity.vx, obs.velocity.vy)}
                              onChange={(e) => {
                                const spd = parseFloat(e.target.value);
                                const currentDir = Math.atan2(
                                  obs.velocity.vy,
                                  obs.velocity.vx || 1e-4
                                );
                                updateObstacle(obs.id, {
                                  velocity: {
                                    vx: Math.cos(currentDir) * spd,
                                    vy: Math.sin(currentDir) * spd,
                                  },
                                });
                              }}
                              className="w-28 accent-[var(--blue)]"
                            />
                          </div>
                        </>
                      )}

                      {/* Actions */}
                      <div className="flex justify-between items-center pt-1 border-t border-[var(--rule-2)]">
                        <button
                          onClick={() =>
                            updateObstacle(obs.id, {
                              x: 6.5,
                              y: 0.0,
                            })
                          }
                          className="text-[10px] text-[var(--oxide)] hover:underline"
                        >
                          Snap to Forward Lane
                        </button>
                        <button
                          onClick={() => removeObstacle(obs.id)}
                          className="text-[10px] text-red-600 hover:text-red-700 flex items-center gap-1 font-semibold"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {obstacles.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[var(--rule-2)] flex justify-between">
            <button
              onClick={() => {
                setObstacles((prev) =>
                  prev.map((o) => ({
                    ...o,
                    x: (o.initialX ?? o.x),
                    y: (o.initialY ?? o.y),
                  }))
                );
              }}
              className="text-[10px] font-mono text-[var(--ink-3)] hover:text-[var(--ink)] flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Reset Positions
            </button>
            <button
              onClick={() => setObstacles([])}
              className="text-[10px] font-mono text-red-500 hover:text-red-700"
            >
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
