'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  Player,
  SPEED_MAX,
  SPEED_MIN,
  type PlayerSettings,
  type PlayerState,
} from '../lib/player';
import { DEFAULT_SET_ID, getSet, SETS } from '../lib/sets';
import type { CustomDef } from '../lib/sets/custom';
import { DEFAULT_DRAFT, type CustomDraft } from './CustomEditor';
import { SettingsPanel } from './SettingsPanel';
import { Tex } from './Tex';

const format = new Intl.NumberFormat('en-GB');
/** Controls fade out after this long without any movement. */
const IDLE_MS = 3000;

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z" fill="currentColor" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 12a7 7 0 1 0 2.2-5.1M5 4.5v3.6h3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 8h9M17 8h3M4 16h3M11 16h9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="15" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="16" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** What is playing now: its name and its rule as TeX. */
interface Playing {
  id: string;
  name: string;
  rule: string;
}

const firstSet = getSet(DEFAULT_SET_ID);

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<Player | null>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const latestRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const [state, setState] = useState<PlayerState>('idle');
  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS);
  const [playing, setPlaying] = useState<Playing>({
    id: firstSet.id,
    name: firstSet.name,
    rule: firstSet.rule,
  });
  const [choice, setChoice] = useState<string>(firstSet.id);
  const [draft, setDraft] = useState<CustomDraft>(DEFAULT_DRAFT);
  const [length, setLength] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [awake, setAwake] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const player = new Player(canvas, {
      onState: setState,
      // Written straight to the page: it changes too often to go through React.
      onProgress: (count, latest) => {
        if (countRef.current) countRef.current.textContent = format.format(count);
        if (latestRef.current) latestRef.current.textContent = count ? format.format(latest) : '–';
      },
      onLength: setLength,
    });
    playerRef.current = player;
    const observer = new ResizeObserver(() => player.resize());
    observer.observe(canvas);

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyMotion = () => player.setReducedMotion(motion.matches);
    applyMotion();
    motion.addEventListener('change', applyMotion);

    return () => {
      motion.removeEventListener('change', applyMotion);
      observer.disconnect();
      player.dispose();
      playerRef.current = null;
    };
  }, []);

  const toggle = useCallback(() => playerRef.current?.toggle(), []);
  const restart = useCallback(() => playerRef.current?.restart(), []);

  const changeSettings = useCallback((patch: Partial<PlayerSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    playerRef.current?.update(patch);
  }, []);

  const chooseSet = useCallback((id: string) => {
    setChoice(id);
    if (id === 'custom') {
      // Nothing changes until "Use this set" is pressed in the editor.
      setPanelOpen(true);
      return;
    }
    const set = getSet(id);
    setPlaying({ id: set.id, name: set.name, rule: set.rule });
    setSettings((s) => ({ ...s, radiusScale: set.radiusScale }));
    playerRef.current?.setSource({ type: 'builtin', id: set.id }, set.radiusScale);
  }, []);

  const applyCustom = useCallback((def: CustomDef, tex: string) => {
    setPlaying({ id: 'custom', name: 'Custom', rule: tex });
    setSettings((s) => ({ ...s, radiusScale: 'linear' }));
    playerRef.current?.setSource({ type: 'custom', def }, 'linear');
  }, []);

  // Keep the picture clear of the settings panel: beside it on wide screens, above it on phones.
  useEffect(() => {
    const apply = () => {
      const panel = panelRef.current;
      const player = playerRef.current;
      if (!panel || !player) return;
      if (!panelOpen) player.setInset(0, 0);
      else if (window.matchMedia('(max-width: 640px)').matches) player.setInset(0, panel.offsetHeight + 62); // 62: room for the control bar above the panel
      else player.setInset(panel.offsetWidth, 0);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [panelOpen]);

  // Keyboard: Space plays or pauses, R restarts. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const typing =
        el !== null &&
        (el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'range') ||
          el.isContentEditable);
      if (typing) return;
      if (e.code === 'Space') {
        e.preventDefault();
        // Stop a focused button from also acting on the same key press.
        if (el instanceof HTMLButtonElement) el.blur();
        playerRef.current?.toggle();
      } else if (e.key === 'r' || e.key === 'R') {
        playerRef.current?.restart();
      } else if (e.key === 'Escape') {
        setPanelOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Controls fade out after a few seconds without movement, and return on any tap or move.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      setAwake(true);
      clearTimeout(timer);
      timer = setTimeout(() => setAwake(false), IDLE_MS);
    };
    wake();
    const events = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'] as const;
    for (const name of events) window.addEventListener(name, wake, { passive: true });
    return () => {
      clearTimeout(timer);
      for (const name of events) window.removeEventListener(name, wake);
    };
  }, []);

  const isPlaying = state === 'playing';
  const idle = state === 'idle';
  // Only hide controls while music is playing and nothing is open.
  const faded = !awake && isPlaying && !panelOpen;
  const barHidden = idle || faded;

  return (
    <main className={`stage${faded ? ' is-quiet' : ''}${panelOpen ? ' has-panel' : ''}`}>
      <canvas ref={canvasRef} className="plot" />

      <div className={`counter${idle ? ' is-hidden' : ''}`} aria-live="off">
        <span className="counter-count" ref={countRef}>
          0
        </span>
        <span className="counter-label">terms</span>
        <span className="counter-latest">
          latest <span ref={latestRef}>–</span>
        </span>
      </div>

      <div className={`intro${idle ? '' : ' is-hidden'}`} inert={!idle}>
        <h1 className="intro-title">{playing.name}</h1>
        <Tex tex={playing.rule} className="intro-rule" />
        <button className="intro-play" onClick={toggle} aria-label="Play">
          <PlayIcon />
        </button>
        <div className="intro-tools">
          <select
            className="select"
            aria-label="Number set"
            value={choice}
            onChange={(e) => chooseSet(e.target.value)}
          >
            {SETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="custom">Custom…</option>
          </select>
          <button className="icon-button" onClick={() => setPanelOpen(true)} aria-label="Settings">
            <SettingsIcon />
          </button>
        </div>
      </div>

      <div
        className={`bar${barHidden ? ' is-hidden' : ''}`}
        role="toolbar"
        aria-label="Playback"
        inert={barHidden}
      >
        <button className="icon-button" onClick={toggle} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button className="icon-button" onClick={restart} aria-label="Restart">
          <RestartIcon />
        </button>
        <label className="speed">
          <span className="speed-label">Speed</span>
          <input
            type="range"
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={1}
            value={settings.speed}
            onChange={(e) => changeSettings({ speed: Number(e.target.value) })}
            aria-label="Notes per second"
          />
          <span className="speed-value">{settings.speed}/s</span>
        </label>
        <select
          className="select bar-select"
          aria-label="Number set"
          value={choice}
          onChange={(e) => chooseSet(e.target.value)}
        >
          {SETS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
        <button className="icon-button" onClick={() => setPanelOpen((o) => !o)} aria-label="Settings">
          <SettingsIcon />
        </button>
      </div>

      <SettingsPanel
        panelRef={panelRef}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        settings={settings}
        onSettings={changeSettings}
        choice={choice}
        onChoice={chooseSet}
        rule={playing.rule}
        length={length}
        draft={draft}
        onDraft={setDraft}
        onUseCustom={applyCustom}
      />
    </main>
  );
}
