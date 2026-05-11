// ============================================================
// PERFORMANCE PROFILER — Zero-impact, Passive Sampling
// ============================================================
// Collects exhaustive frame, memory, and event telemetry
// WITHOUT touching the game loop. All recording is done via
// requestAnimationFrame observer sitting on top of R3F.
//
// Ctrl+X  ──> Downloads full JSON report instantly.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FrameSample {
  t: number;           // elapsed ms since recording started
  dt: number;          // raw delta ms for this frame
  fps: number;         // instantaneous FPS
  avgFps: number;      // 1-second rolling average FPS
  p99Dt: number;       // 99th-percentile delta in trailing 300 samples
  isStutter: boolean;  // dt > 50ms (< 20 FPS equivalent)
  isDropped: boolean;  // dt > 100ms (severe drop / tab suspend)
  heap: number;        // JS heap used (MB) — 0 if unavailable
  heapLimit: number;   // JS heap limit (MB) — 0 if unavailable
  activeUnits: number; // snapshot of active unit count
  spawnQueueLen: number;
  damageQueueLen: number;
}

export interface StutterEvent {
  t: number;
  dt: number;
  severity: 'minor' | 'major' | 'critical'; // <50ms | <100ms | >=100ms
  heapAtEvent: number;
  activeUnitsAtEvent: number;
  framesSinceLastStutter: number;
}

export interface MemoryPressureEvent {
  t: number;
  heapMB: number;
  limitMB: number;
  usageRatio: number;
}

export interface ProfilerSummary {
  recordingDurationMs: number;
  totalFrames: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  medianFps: number;
  p1Fps: number;          // 1% low FPS (worst 1% of frames)
  p5Fps: number;          // 5% low FPS
  p50Dt: number;          // median frame time ms
  p95Dt: number;          // 95th pct frame time ms
  p99Dt: number;          // 99th pct frame time ms
  maxDt: number;          // absolute worst frame time ms
  stutterCount: number;
  droppedFrameCount: number;
  stutterRate: string;    // "x.xx%"
  avgActiveUnits: number;
  peakActiveUnits: number;
  avgHeapMB: number;
  peakHeapMB: number;
  memoryPressureEvents: number;
  frameDropClusters: Array<{ startT: number; endT: number; count: number }>;
}

export interface ProfilerReport {
  meta: {
    capturedAt: string;
    userAgent: string;
    deviceMemoryGB: number | null;
    hardwareConcurrency: number;
    screenResolution: string;
    pixelRatio: number;
    gameVersion: string;
  };
  summary: ProfilerSummary;
  stutterEvents: StutterEvent[];
  memoryPressureEvents: MemoryPressureEvent[];
  // Downsampled frame series — every 10th sample to keep file size sane
  // while preserving full resolution around stutter events
  frameSeries: FrameSample[];
  rawConfig: {
    stutterThresholdMs: number;
    dropThresholdMs: number;
    memPressureRatio: number;
    sampleWindowFrames: number;
  };
}

// ── Config ─────────────────────────────────────────────────────────────────

const STUTTER_THRESHOLD_MS    = 50;   // > 50ms = stutter (< 20 FPS)
const DROP_THRESHOLD_MS       = 100;  // > 100ms = severe drop
const MEM_PRESSURE_RATIO      = 0.85; // heap / limit > 85% = memory pressure
const ROLLING_WINDOW_FRAMES   = 60;   // ~1s at 60 FPS for rolling avg
const SAMPLE_WINDOW_FRAMES    = 300;  // buffer for p99 computation
const MAX_STORED_FRAMES       = 18000; // 5 min at 60 FPS — store every frame

// ── Hook ───────────────────────────────────────────────────────────────────

interface ProfilerOptions {
  /** ref to unitDataPool so we can read activeUnits count non-intrusively */
  unitDataPoolRef?: React.RefObject<any[]>;
  /** ref to spawnQueue length */
  spawnQueueRef?: React.RefObject<any[]>;
  /** ref to damageQueue length */
  damageQueueRef?: React.RefObject<any[]>;
  /** Fired when Ctrl+X is pressed outside of an input */
  onDownload?: () => void;
}

export function usePerformanceProfiler(opts: ProfilerOptions = {}) {
  const { unitDataPoolRef, spawnQueueRef, damageQueueRef } = opts;

  // ── Internal state (all refs to avoid re-renders) ──────────────────────
  const isRecordingRef      = useRef(false);
  const startTimeRef        = useRef(0);
  const lastFrameTimeRef    = useRef(0);
  const frameCountRef       = useRef(0);
  const frameStoreRef       = useRef<FrameSample[]>([]);
  const stutterEventsRef    = useRef<StutterEvent[]>([]);
  const memEventRef         = useRef<MemoryPressureEvent[]>([]);
  const rollingDtsRef       = useRef<number[]>([]);  // circular for avg
  const sampleWindowRef     = useRef<number[]>([]);  // for p99
  const lastStutterFrameRef = useRef(0);
  const rafHandleRef        = useRef<number>(0);

  // ── Helpers ────────────────────────────────────────────────────────────

  const getHeap = useCallback((): { used: number; limit: number } => {
    const perf = (performance as any);
    if (perf?.memory) {
      return {
        used:  perf.memory.usedJSHeapSize  / 1048576,
        limit: perf.memory.jsHeapSizeLimit / 1048576,
      };
    }
    return { used: 0, limit: 0 };
  }, []);

  const getActiveUnits = useCallback((): number => {
    const pool = unitDataPoolRef?.current;
    if (!pool) return 0;
    let n = 0;
    for (let i = 0; i < pool.length; i++) {
      if (pool[i]?.isActive) n++;
    }
    return n;
  }, [unitDataPoolRef]);

  const percentile = useCallback((sorted: number[], p: number): number => {
    if (sorted.length === 0) return 0;
    const idx = Math.floor((p / 100) * (sorted.length - 1));
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
  }, []);

  // ── Frame observer tick ────────────────────────────────────────────────

  const tick = useCallback((now: number) => {
    if (!isRecordingRef.current) return;

    const elapsed = now - startTimeRef.current;
    const dt      = lastFrameTimeRef.current === 0
      ? 16.67
      : now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    frameCountRef.current++;

    const frameIdx = frameCountRef.current;

    // Rolling average FPS (1-second window)
    rollingDtsRef.current.push(dt);
    if (rollingDtsRef.current.length > ROLLING_WINDOW_FRAMES) {
      rollingDtsRef.current.shift();
    }
    const avgDt    = rollingDtsRef.current.reduce((a, b) => a + b, 0) / rollingDtsRef.current.length;
    const avgFps   = 1000 / Math.max(avgDt, 0.1);
    const instFps  = 1000 / Math.max(dt, 0.1);

    // p99 window
    sampleWindowRef.current.push(dt);
    if (sampleWindowRef.current.length > SAMPLE_WINDOW_FRAMES) {
      sampleWindowRef.current.shift();
    }
    const sortedWindow = [...sampleWindowRef.current].sort((a, b) => a - b);
    const p99Dt        = percentile(sortedWindow, 99);

    // Memory
    const { used: heap, limit: heapLimit } = getHeap();

    // Active units
    const activeUnits   = getActiveUnits();
    const spawnQueueLen = spawnQueueRef?.current?.length ?? 0;
    const dmgQueueLen   = damageQueueRef?.current?.length ?? 0;

    const isStutter  = dt > STUTTER_THRESHOLD_MS;
    const isDropped  = dt > DROP_THRESHOLD_MS;

    // ── Store frame sample (every frame up to MAX_STORED_FRAMES) ──────────
    if (frameStoreRef.current.length < MAX_STORED_FRAMES) {
      frameStoreRef.current.push({
        t: elapsed,
        dt,
        fps: instFps,
        avgFps,
        p99Dt,
        isStutter,
        isDropped,
        heap,
        heapLimit,
        activeUnits,
        spawnQueueLen,
        damageQueueLen: dmgQueueLen,
      });
    }

    // ── Stutter event ─────────────────────────────────────────────────────
    if (isStutter) {
      const framesSince = frameIdx - lastStutterFrameRef.current;
      lastStutterFrameRef.current = frameIdx;
      stutterEventsRef.current.push({
        t: elapsed,
        dt,
        severity: isDropped ? (dt > 200 ? 'critical' : 'major') : 'minor',
        heapAtEvent: heap,
        activeUnitsAtEvent: activeUnits,
        framesSinceLastStutter: framesSince,
      });
    }

    // ── Memory pressure event ─────────────────────────────────────────────
    if (heapLimit > 0 && heap / heapLimit > MEM_PRESSURE_RATIO) {
      const last = memEventRef.current[memEventRef.current.length - 1];
      // Deduplicate: only record if >500ms since last
      if (!last || elapsed - last.t > 500) {
        memEventRef.current.push({
          t: elapsed,
          heapMB: heap,
          limitMB: heapLimit,
          usageRatio: heap / heapLimit,
        });
      }
    }

    rafHandleRef.current = requestAnimationFrame(tick);
  }, [getHeap, getActiveUnits, percentile, spawnQueueRef, damageQueueRef]);

  // ── Start / Stop ───────────────────────────────────────────────────────

  const startRecording = useCallback(() => {
    if (isRecordingRef.current) return;
    isRecordingRef.current       = true;
    startTimeRef.current         = performance.now();
    lastFrameTimeRef.current     = 0;
    frameCountRef.current        = 0;
    frameStoreRef.current        = [];
    stutterEventsRef.current     = [];
    memEventRef.current          = [];
    rollingDtsRef.current        = [];
    sampleWindowRef.current      = [];
    lastStutterFrameRef.current  = 0;
    rafHandleRef.current         = requestAnimationFrame(tick);
    console.info('[Profiler] Recording started');
  }, [tick]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    cancelAnimationFrame(rafHandleRef.current);
    console.info('[Profiler] Recording stopped. Frames captured:', frameCountRef.current);
  }, []);

  // ── Build summary ──────────────────────────────────────────────────────

  const buildSummary = useCallback((): ProfilerSummary => {
    const frames = frameStoreRef.current;
    if (frames.length === 0) {
      return {
        recordingDurationMs: 0, totalFrames: 0, avgFps: 0, minFps: 0,
        maxFps: 0, medianFps: 0, p1Fps: 0, p5Fps: 0, p50Dt: 0, p95Dt: 0,
        p99Dt: 0, maxDt: 0, stutterCount: 0, droppedFrameCount: 0,
        stutterRate: '0.00%', avgActiveUnits: 0, peakActiveUnits: 0,
        avgHeapMB: 0, peakHeapMB: 0, memoryPressureEvents: 0,
        frameDropClusters: [],
      };
    }

    const allFps    = frames.map(f => f.fps);
    const allDts    = frames.map(f => f.dt);
    const sortedFps = [...allFps].sort((a, b) => a - b);
    const sortedDts = [...allDts].sort((a, b) => a - b);

    const totalFrames     = frames.length;
    const recDurationMs   = frames[frames.length - 1].t;
    const stutterCount    = frames.filter(f => f.isStutter).length;
    const droppedCount    = frames.filter(f => f.isDropped).length;
    const peakUnits       = frames.reduce((m, f) => Math.max(m, f.activeUnits), 0);
    const avgUnits        = Math.round(frames.reduce((s, f) => s + f.activeUnits, 0) / totalFrames);
    const heapFrames      = frames.filter(f => f.heap > 0);
    const avgHeap         = heapFrames.length > 0
      ? heapFrames.reduce((s, f) => s + f.heap, 0) / heapFrames.length : 0;
    const peakHeap        = heapFrames.reduce((m, f) => Math.max(m, f.heap), 0);

    // Frame drop clusters: consecutive dropped frames grouped together
    const clusters: Array<{ startT: number; endT: number; count: number }> = [];
    let inCluster = false;
    let clusterStart = 0;
    let clusterCount = 0;
    for (let i = 0; i < frames.length; i++) {
      if (frames[i].isStutter) {
        if (!inCluster) {
          inCluster    = true;
          clusterStart = frames[i].t;
          clusterCount = 1;
        } else {
          clusterCount++;
        }
      } else if (inCluster) {
        clusters.push({ startT: clusterStart, endT: frames[i - 1].t, count: clusterCount });
        inCluster = false;
        clusterCount = 0;
      }
    }
    if (inCluster) {
      clusters.push({ startT: clusterStart, endT: frames[frames.length - 1].t, count: clusterCount });
    }

    return {
      recordingDurationMs: recDurationMs,
      totalFrames,
      avgFps:        parseFloat((allFps.reduce((a, b) => a + b, 0) / totalFrames).toFixed(2)),
      minFps:        parseFloat(sortedFps[0].toFixed(2)),
      maxFps:        parseFloat(sortedFps[sortedFps.length - 1].toFixed(2)),
      medianFps:     parseFloat(percentile(sortedFps, 50).toFixed(2)),
      p1Fps:         parseFloat(percentile(sortedFps, 1).toFixed(2)),
      p5Fps:         parseFloat(percentile(sortedFps, 5).toFixed(2)),
      p50Dt:         parseFloat(percentile(sortedDts, 50).toFixed(3)),
      p95Dt:         parseFloat(percentile(sortedDts, 95).toFixed(3)),
      p99Dt:         parseFloat(percentile(sortedDts, 99).toFixed(3)),
      maxDt:         parseFloat(sortedDts[sortedDts.length - 1].toFixed(3)),
      stutterCount,
      droppedFrameCount: droppedCount,
      stutterRate:   `${((stutterCount / totalFrames) * 100).toFixed(2)}%`,
      avgActiveUnits: avgUnits,
      peakActiveUnits: peakUnits,
      avgHeapMB:     parseFloat(avgHeap.toFixed(2)),
      peakHeapMB:    parseFloat(peakHeap.toFixed(2)),
      memoryPressureEvents: memEventRef.current.length,
      frameDropClusters: clusters,
    };
  }, [percentile]);

  // ── Build & Download report ────────────────────────────────────────────

  const downloadReport = useCallback(() => {
    const wasRecording = isRecordingRef.current;
    if (wasRecording) stopRecording();

    const frames = frameStoreRef.current;
    if (frames.length < 10) {
      console.warn('[Profiler] Not enough data to generate report (< 10 frames).');
      if (wasRecording) startRecording();
      return;
    }

    // Smart downsampling: keep every 10th frame BUT keep all stutter frames at full resolution
    const downsampled: FrameSample[] = [];
    for (let i = 0; i < frames.length; i++) {
      if (i % 10 === 0 || frames[i].isStutter) {
        downsampled.push(frames[i]);
      }
    }

    const report: ProfilerReport = {
      meta: {
        capturedAt:          new Date().toISOString(),
        userAgent:           navigator.userAgent,
        deviceMemoryGB:      (navigator as any).deviceMemory ?? null,
        hardwareConcurrency: navigator.hardwareConcurrency,
        screenResolution:    `${screen.width}x${screen.height}@${window.devicePixelRatio}x`,
        pixelRatio:          window.devicePixelRatio,
        gameVersion:         'tiktok-battle-v1',
      },
      summary:               buildSummary(),
      stutterEvents:         stutterEventsRef.current,
      memoryPressureEvents:  memEventRef.current,
      frameSeries:           downsampled,
      rawConfig: {
        stutterThresholdMs:  STUTTER_THRESHOLD_MS,
        dropThresholdMs:     DROP_THRESHOLD_MS,
        memPressureRatio:    MEM_PRESSURE_RATIO,
        sampleWindowFrames:  SAMPLE_WINDOW_FRAMES,
      },
    };

    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href     = url;
    a.download = `battle-perf-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const s = report.summary;
    console.group('[Profiler] Report Downloaded');
    console.log(`Duration:      ${(s.recordingDurationMs / 1000).toFixed(1)}s`);
    console.log(`Total Frames:  ${s.totalFrames}`);
    console.log(`Avg FPS:       ${s.avgFps}`);
    console.log(`1% Low FPS:    ${s.p1Fps}  (worst 1% of frames)`);
    console.log(`P99 Frame-dt:  ${s.p99Dt}ms`);
    console.log(`Max Frame-dt:  ${s.maxDt}ms`);
    console.log(`Stutters:      ${s.stutterCount} (${s.stutterRate})`);
    console.log(`Dropped:       ${s.droppedFrameCount}`);
    console.log(`Peak Units:    ${s.peakActiveUnits}`);
    console.log(`Peak Heap:     ${s.peakHeapMB}MB`);
    console.log(`Drop Clusters: ${s.frameDropClusters.length}`);
    console.groupEnd();

    // Resume if was recording
    if (wasRecording) startRecording();
  }, [buildSummary, stopRecording, startRecording]);

  // ── Keyboard shortcut: Ctrl+X = download ──────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input / textarea / contenteditable
      const target = e.target as HTMLElement;
      const isEditing = (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (isEditing) return;

      if (e.ctrlKey && e.key === 'x') {
        e.preventDefault();
        downloadReport();
      }

      // Ctrl+Shift+R = start recording
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        if (isRecordingRef.current) {
          stopRecording();
        } else {
          startRecording();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [downloadReport, startRecording, stopRecording]);

  // ── Auto-start on mount ────────────────────────────────────────────────

  useEffect(() => {
    startRecording();
    return () => {
      stopRecording();
    };
  }, [startRecording, stopRecording]);

  // ── Expose public API ──────────────────────────────────────────────────

  return {
    startRecording,
    stopRecording,
    downloadReport,
    isRecording: isRecordingRef,
    getSnapshot: buildSummary,
  };
}
