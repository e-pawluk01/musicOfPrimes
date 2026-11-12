'use client';

import type { PitchSource, RhythmMode, VolumeMode } from '../lib/audio/mapping';
import { SCALES } from '../lib/audio/scales';
import { TIMBRES, type TimbreId } from '../lib/audio/timbres';
import { TERMS_MAX, TERMS_MIN, type PlayerSettings } from '../lib/player';
import { PALETTES } from '../lib/render/color';
import { SETS, type RadiusScale } from '../lib/sets';
import type { CustomDef } from '../lib/sets/custom';
import { CustomEditor, type CustomDraft } from './CustomEditor';
import { Segmented, Toggle } from './Segmented';
import { Tex } from './Tex';

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

const PITCH: { value: PitchSource; label: string }[] = [
  { value: 'angle', label: 'Angle' },
  { value: 'size', label: 'Size' },
  { value: 'digits', label: 'Digit sum' },
];
const RHYTHM: { value: RhythmMode; label: string }[] = [
  { value: 'steady', label: 'Steady' },
  { value: 'gap', label: 'By gap' },
];
const VOLUME: { value: VolumeMode; label: string }[] = [
  { value: 'steady', label: 'Steady' },
  { value: 'gap', label: 'By gap' },
  { value: 'zoom', label: 'Fade with zoom' },
];
const RADIUS: { value: RadiusScale; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'sqrt', label: 'Square root' },
  { value: 'log', label: 'Log' },
];
const OCTAVES = [1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }));

const PITCH_HINT: Record<PitchSource, string> = {
  angle: 'Where a dot sits around the circle picks its note, so each ray has one note.',
  size: 'Bigger numbers play higher notes. At the top it starts again from the bottom.',
  digits: 'The digits of the number are added up, and the total picks the note.',
};

const format = new Intl.NumberFormat('en-GB');

interface Props {
  panelRef: React.Ref<HTMLElement>;
  open: boolean;
  onClose: () => void;
  settings: PlayerSettings;
  onSettings: (patch: Partial<PlayerSettings>) => void;
  /** The set picked in the list: a built-in id, or "custom". */
  choice: string;
  onChoice: (choice: string) => void;
  /** The rule of the set now playing, as TeX. */
  rule: string;
  /** How many terms the set has, if it is limited. */
  length: number | null;
  draft: CustomDraft;
  onDraft: (draft: CustomDraft) => void;
  onUseCustom: (def: CustomDef, tex: string) => void;
}

export function SettingsPanel(props: Props) {
  const { open, onClose, settings, onSettings, choice, onChoice, rule, length } = props;
  const endsEarly = length !== null && length < settings.maxTerms;

  return (
    <aside
      ref={props.panelRef}
      className={`panel${open ? ' is-open' : ''}`}
      aria-label="Settings"
      inert={!open}
    >
      <header className="panel-head">
        <h2>Settings</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close settings">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="panel-body">
        <section className="group">
          <h3>Number set</h3>
          <label className="field">
            <span className="field-label">Set</span>
            <select className="select" value={choice} onChange={(e) => onChoice(e.target.value)}>
              {SETS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
          </label>

          {choice === 'custom' ? (
            <CustomEditor draft={props.draft} onChange={props.onDraft} onUse={props.onUseCustom} />
          ) : (
            <div className="rule">
              <Tex tex={rule} />
            </div>
          )}

          <div className="field">
            <span className="field-label">Distance from the centre</span>
            <Segmented
              label="Distance from the centre"
              options={RADIUS}
              value={settings.radiusScale}
              onChange={(radiusScale) => onSettings({ radiusScale })}
            />
            <p className="hint">The angle always uses the true value.</p>
          </div>

          <label className="field">
            <span className="field-label">
              Terms to play <span className="field-value">{format.format(settings.maxTerms)}</span>
            </span>
            <input
              type="range"
              min={TERMS_MIN}
              max={TERMS_MAX}
              step={100}
              value={settings.maxTerms}
              onChange={(e) => onSettings({ maxTerms: Number(e.target.value) })}
            />
          </label>
          {endsEarly && (
            <p className="hint">
              This set ends after {format.format(length)} terms
              {choice === 'custom' ? '.' : ': after that the numbers are too large to place accurately.'}
            </p>
          )}
        </section>

        <section className="group">
          <h3>What the numbers control</h3>
          <div className="field">
            <span className="field-label">Pitch from</span>
            <Segmented
              label="Pitch from"
              options={PITCH}
              value={settings.pitchSource}
              onChange={(pitchSource) => onSettings({ pitchSource })}
            />
            <p className="hint">{PITCH_HINT[settings.pitchSource]}</p>
          </div>
          <div className="field">
            <span className="field-label">Rhythm</span>
            <Segmented
              label="Rhythm"
              options={RHYTHM}
              value={settings.rhythm}
              onChange={(rhythm) => onSettings({ rhythm })}
            />
            {settings.rhythm === 'gap' && (
              <p className="hint">A bigger jump to the next number means a longer wait.</p>
            )}
          </div>
          <div className="field">
            <span className="field-label">Volume</span>
            <Segmented
              label="Volume"
              options={VOLUME}
              value={settings.volume}
              onChange={(volume) => onSettings({ volume })}
            />
          </div>
          <Toggle
            label="Chords"
            hint="Also play a note for each prime factor of the number."
            checked={settings.chords}
            onChange={(chords) => onSettings({ chords })}
          />
        </section>

        <section className="group">
          <h3>Sound</h3>
          <div className="field-pair">
            <label className="field">
              <span className="field-label">Scale</span>
              <select
                className="select"
                value={settings.scaleId}
                onChange={(e) => onSettings({ scaleId: e.target.value })}
              >
                {SCALES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Root note</span>
              <select
                className="select"
                value={settings.root}
                onChange={(e) => onSettings({ root: Number(e.target.value) })}
              >
                {NOTE_NAMES.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="field">
            <span className="field-label">Octaves</span>
            <Segmented
              label="Octaves"
              options={OCTAVES}
              value={settings.octaves}
              onChange={(octaves) => onSettings({ octaves })}
            />
          </div>
          <div className="field">
            <span className="field-label">Instrument</span>
            <Segmented<TimbreId>
              label="Instrument"
              options={TIMBRES.map((t) => ({ value: t.id, label: t.name }))}
              value={settings.timbre}
              onChange={(timbre) => onSettings({ timbre })}
            />
          </div>
        </section>

        <section className="group">
          <h3>Look</h3>
          <div className="field">
            <span className="field-label">Colours</span>
            <Segmented
              label="Colours"
              options={PALETTES.map((p) => ({ value: p.id, label: p.name }))}
              value={settings.paletteId}
              onChange={(paletteId) => onSettings({ paletteId })}
            />
          </div>
          <Toggle
            label="Guide spiral"
            hint="A faint line through the points. It fades once its turns get too close to see."
            checked={settings.guide}
            onChange={(guide) => onSettings({ guide })}
          />
        </section>
      </div>
    </aside>
  );
}
