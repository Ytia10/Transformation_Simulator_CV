/*
 * ShapePicker.jsx — choose a shape: tap a preset, or type your own points.
 * The box always shows the points of the current shape, so it doubles as a
 * reminder of the format. In 3D there is also a thickness slider.
 */
import { useState } from 'react';
import { PRESETS, parseShapeText, pointsToText } from './math.js';

/** A tiny drawing of a preset, scaled to fit a 24×24 box. */
function PresetIcon({ points }) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const size = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
  const s = 20 / size;
  const offX = 2 + (20 - (Math.max(...xs) - minX) * s) / 2;
  const offY = 2 + (20 - (Math.max(...ys) - minY) * s) / 2;
  const d = points.map(([x, y]) => `${offX + (x - minX) * s},${24 - offY - (y - minY) * s}`).join(' ');
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <polygon points={d} />
    </svg>
  );
}

export default function ShapePicker({ shape, presetName, onShapeChange, mode, depth, onDepthChange }) {
  const [text, setText] = useState(() => pointsToText(shape));
  const [error, setError] = useState('');

  const pickPreset = (name) => {
    setText(pointsToText(PRESETS[name]));
    setError('');
    onShapeChange(PRESETS[name], name);
  };

  const drawTyped = (event) => {
    event.preventDefault();
    const parsed = parseShapeText(text);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setError('');
    onShapeChange(parsed.points, '');
  };

  return (
    <section className="block">
      <h2>Shape</h2>
      <div className="presets" role="group" aria-label="Preset shapes">
        {Object.entries(PRESETS).map(([name, points]) => (
          <button
            key={name}
            className="preset"
            aria-pressed={presetName === name}
            aria-label={name}
            title={name}
            onClick={() => pickPreset(name)}
          >
            <PresetIcon points={points} />
          </button>
        ))}
      </div>

      <form className="typed" onSubmit={drawTyped}>
        <label htmlFor="points">Or type your own points</label>
        <div className="typed-row">
          <input
            id="points"
            value={text}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'points-error' : undefined}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit">Draw</button>
        </div>
        {error && (
          <p id="points-error" className="error" role="alert">
            {error}
          </p>
        )}
      </form>

      {mode === '3d' && (
        <div className="slider">
          <label htmlFor="depth">Thickness</label>
          <input
            id="depth"
            type="range"
            min={0.2}
            max={5}
            step={0.1}
            value={depth}
            onChange={(e) => onDepthChange(Number(e.target.value))}
          />
          <output htmlFor="depth">{depth.toFixed(1)}</output>
        </div>
      )}
    </section>
  );
}
