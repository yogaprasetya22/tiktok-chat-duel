'use client';

// ============================================================
// PROFILER HUD — Minimal, non-blocking overlay
// Shows: recording status, frame count, avg FPS, stutter count
// Press Ctrl+X to download full JSON report
// Press Ctrl+Shift+R to start/stop recording
// ============================================================

import React, { useEffect, useRef, useState } from 'react';

interface ProfilerHUDProps {
  isRecordingRef: React.RefObject<boolean>;
  getSnapshot: () => ReturnType<any>;
}

export const ProfilerHUD = React.memo(({ isRecordingRef, getSnapshot }: ProfilerHUDProps) => {
  const [snap, setSnap] = useState<any>(null);
  const [isRec, setIsRec] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    // Update HUD every 2 seconds — extremely cheap
    timerRef.current = setInterval(() => {
      setIsRec(!!isRecordingRef.current);
      try {
        const s = getSnapshot();
        if (s && s.totalFrames > 0) setSnap(s);
      } catch (_) {}
    }, 2000);

    return () => clearInterval(timerRef.current);
  }, [isRecordingRef, getSnapshot]);

  return (
    <div
      id="profiler-hud"
      style={{
        position: 'fixed',
        bottom: '12px',
        left: '12px',
        zIndex: 9999,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${isRec ? '#22c55e' : '#6b7280'}`,
        borderRadius: '8px',
        padding: '7px 12px',
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#e5e7eb',
        lineHeight: '1.6',
        pointerEvents: 'none',
        userSelect: 'none',
        minWidth: '180px',
      }}
    >
      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
        <span style={{
          display: 'inline-block',
          width: '7px', height: '7px',
          borderRadius: '50%',
          background: isRec ? '#22c55e' : '#6b7280',
          boxShadow: isRec ? '0 0 6px #22c55e' : 'none',
          animation: isRec ? 'profiler-blink 1.5s infinite' : 'none',
        }} />
        <span style={{ fontWeight: 700, color: isRec ? '#4ade80' : '#9ca3af' }}>
          {isRec ? 'RECORDING' : 'PAUSED'}
        </span>
        <span style={{ color: '#6b7280', fontSize: '10px' }}>PROFILER</span>
      </div>

      {snap && (
        <>
          <Row label="FPS" value={`${snap.avgFps.toFixed(1)}  1%▼${snap.p1Fps.toFixed(1)}`} color="#93c5fd" />
          <Row label="P99 dt" value={`${snap.p99Dt.toFixed(1)}ms  max:${snap.maxDt.toFixed(1)}ms`} color={snap.maxDt > 100 ? '#f87171' : snap.maxDt > 50 ? '#fb923c' : '#86efac'} />
          <Row label="Units" value={`avg:${snap.avgActiveUnits}  peak:${snap.peakActiveUnits}`} color="#c4b5fd" />
          <Row
            label="Stutter"
            value={`${snap.stutterCount} (${snap.stutterRate})`}
            color={snap.stutterCount > 50 ? '#f87171' : snap.stutterCount > 10 ? '#fb923c' : '#86efac'}
          />
          {snap.peakHeapMB > 0 && (
            <Row label="Heap" value={`${snap.avgHeapMB.toFixed(0)}MB / peak ${snap.peakHeapMB.toFixed(0)}MB`} color="#fde68a" />
          )}
          <Row label="Frames" value={`${snap.totalFrames.toLocaleString()}`} color="#d1d5db" />
        </>
      )}

      {/* Hotkey hints */}
      <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px', color: '#6b7280', fontSize: '10px' }}>
        <span style={{ color: '#facc15' }}>Ctrl+X</span> Download · <span style={{ color: '#facc15' }}>Ctrl⇧R</span> Rec
      </div>

      <style>{`
        @keyframes profiler-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
});

ProfilerHUD.displayName = 'ProfilerHUD';

const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
    <span style={{ color: '#9ca3af' }}>{label}</span>
    <span style={{ color: color ?? '#e5e7eb', fontWeight: 600 }}>{value}</span>
  </div>
);
