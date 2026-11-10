/*
 * TransformPanel.jsx — the dropdown, a one-line meaning, the sliders for the
 * chosen type (only those), and the Replay button.
 */
import { TYPES, TYPE_KEYS, PARAMS, sliderKeys, fmt } from './math.js';

export default function TransformPanel({ mode, type, onTypeChange, params, onParamChange, onReplay }) {
  return (
    <section className="block">
      <h2>
        <label htmlFor="type">Transformation</label>
      </h2>
      <select id="type" value={type} onChange={(e) => onTypeChange(e.target.value)}>
        {TYPE_KEYS.map((key) => (
          <option key={key} value={key}>
            {TYPES[key].name}
          </option>
        ))}
      </select>
     
      {sliderKeys(type, mode).map((key) => {
        const def = PARAMS[key];
        return (
          <div className="slider" key={key}>
            <label htmlFor={`p-${key}`}>{def.label}</label>
            <input
              id={`p-${key}`}
              type="range"
              min={def.min}
              max={def.max}
              step={def.step}
              value={params[key]}
              onChange={(e) => onParamChange(key, Number(e.target.value))}
            />
            <output htmlFor={`p-${key}`}>
              {fmt(params[key], 2)}
              {def.unit ?? ''}
            </output>
          </div>
        );
      })}

      <button className="replay" onClick={onReplay}>
        Replay
      </button>
    </section>
  );
}
