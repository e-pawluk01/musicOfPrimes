'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  Player,
  SPEED_MAX,
  SPEED_MIN,
  type PlayerState,
} from '../lib/player';
import { DEFAULT_SET_ID, getSet } from '../lib/sets';
import { Tex } from './Tex';

const format = new Intl.NumberFormat('en-GB');

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

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<Player | null>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const latestRef = useRef<HTMLSpanElement>(null);

  const [state, setState] = useState<PlayerState>('idle');
  const [speed, setSpeed] = useState(DEFAULT_SETTINGS.speed);
  const set = getSet(DEFAULT_SET_ID);

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
    });
    playerRef.current = player;
    const observer = new ResizeObserver(() => player.resize());
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      player.dispose();
      playerRef.current = null;
    };
  }, []);

  const toggle = useCallback(() => playerRef.current?.toggle(), []);
  const restart = useCallback(() => playerRef.current?.restart(), []);
  const changeSpeed = useCallback((value: number) => {
    setSpeed(value);
    playerRef.current?.setSpeed(value);
  }, []);

  const playing = state === 'playing';
  const idle = state === 'idle';

  return (
    <main className="stage">
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

      <div className={`intro${idle ? '' : ' is-hidden'}`} aria-hidden={!idle}>
        <h1 className="intro-title">{set.name}</h1>
        <Tex tex={set.rule} className="intro-rule" />
        <button className="intro-play" onClick={toggle} aria-label="Play" tabIndex={idle ? 0 : -1}>
          <PlayIcon />
        </button>
      </div>

      <div className="bar" role="toolbar" aria-label="Playback">
        <button className="icon-button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <PauseIcon /> : <PlayIcon />}
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
            value={speed}
            onChange={(e) => changeSpeed(Number(e.target.value))}
            aria-label="Notes per second"
          />
          <span className="speed-value">{speed}/s</span>
        </label>
        <span className="set-name">{set.name}</span>
      </div>
    </main>
  );
}
