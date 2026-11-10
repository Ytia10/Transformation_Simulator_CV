/*
 * App.jsx — holds the state and connects the pieces.
 *
 *   ShapePicker     the shape (presets or typed points) and the 3D thickness
 *   TransformPanel  the transformation type and its sliders
 *   math.js         builds the matrix and moves the points
 *   View2D / View3D draw the result, MatrixNote writes the matrix
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PRESETS,
  DEFAULT_PRESET,
  defaultParams,
  lerpParams,
  buildMatrix,
  applyMatrix,
  extrude,
} from './math.js';
import ShapePicker from './ShapePicker.jsx';
import TransformPanel from './TransformPanel.jsx';
import MatrixNote from './MatrixNote.jsx';
import View2D from './View2D.jsx';
import View3D from './View3D.jsx';

const MORPH_MS = 1100; // how long the morph animation takes
const TRAIL_STEPS = [0.2, 0.4, 0.6, 0.8]; // where the ghost outlines of the trail sit

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  // ---------------- state ----------------
  const [mode, setMode] = useState('2d'); // '2d' or '3d'
  const [shape, setShape] = useState(PRESETS[DEFAULT_PRESET]);
  const [presetName, setPresetName] = useState(DEFAULT_PRESET); // '' when the user typed points
  const [depth, setDepth] = useState(1.5); // 3D thickness
  const [type, setType] = useState('translation');
  const [params, setParams] = useState(() => defaultParams('translation'));
  const [t, setT] = useState(1); // morph progress: 0 = original, 1 = finished
  const [recentre, setRecentre] = useState(0); // bumped by a double-click in 3D

  // ---------------- morph animation ----------------
  const frameRef = useRef(null);

  const stopMorph = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setT(1);
  }, []);

  const playMorph = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (prefersReducedMotion()) {
      setT(1);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const x = Math.min(1, (now - start) / MORPH_MS);
      setT(x * x * (3 - 2 * x)); // smoothstep: eases in and out
      frameRef.current = x < 1 ? requestAnimationFrame(step) : null;
    };
    setT(0);
    frameRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  // ---------------- what the user can do ----------------
  const changeType = (newType) => {
    setType(newType);
    setParams(defaultParams(newType));
    playMorph();
  };

  const changeMode = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    playMorph();
  };

  const changeParam = (key, value) => {
    stopMorph();
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const changeShape = (points, name) => {
    setShape(points);
    setPresetName(name);
    playMorph();
  };

  // ---------------- calculations (all in math.js) ----------------
  const prism = useMemo(() => extrude(shape, depth), [shape, depth]);
  const points = mode === '2d' ? shape : prism.vertices;

  const matrix = useMemo(() => buildMatrix(mode, type, params), [mode, type, params]);
  const result = useMemo(() => applyMatrix(matrix, points), [matrix, points]);

  // The shape at the current moment of the morph.
  const frame = useMemo(
    () => (t === 1 ? result : applyMatrix(buildMatrix(mode, type, lerpParams(params, t)), points)),
    [t, result, mode, type, params, points],
  );

  // Ghost outlines between the original and the result.
  const trail = useMemo(
    () =>
      TRAIL_STEPS.map((step) => ({
        step,
        ...applyMatrix(buildMatrix(mode, type, lerpParams(params, step)), points),
      })).filter((g) => g.ok),
    [mode, type, params, points],
  );
  const visibleTrail = trail.filter((g) => g.step < t).map((g) => g.points);
  const allTrail = trail.map((g) => g.points);

  const drawable = result.ok && frame.ok;

  return (
    <div className="page">
      <header className="masthead">
        <h1>Transform</h1>
        <p className="tagline">Transformation.</p>
        <nav className="modes" aria-label="View">
          <button aria-pressed={mode === '2d'} onClick={() => changeMode('2d')}>
            2D
          </button>
          <button aria-pressed={mode === '3d'} onClick={() => changeMode('3d')}>
            3D
          </button>
        </nav>
      </header>

      <div className="sheet">
        <aside className="notes">
          <ShapePicker
            shape={shape}
            presetName={presetName}
            onShapeChange={changeShape}
            mode={mode}
            depth={depth}
            onDepthChange={setDepth}
          />
          <TransformPanel
            mode={mode}
            type={type}
            onTypeChange={changeType}
            params={params}
            onParamChange={changeParam}
            onReplay={playMorph}
          />
        </aside>

        <main
          className="graph"
          onDoubleClick={mode === '3d' ? () => setRecentre((n) => n + 1) : undefined}
        >
          {mode === '2d' ? (
            <View2D
              original={shape}
              transformed={drawable ? frame.points : null}
              trail={drawable ? visibleTrail : []}
              fitTo={drawable ? [result.points, ...allTrail] : []}
              finalResult={result}
            />
          ) : (
            <View3D
              prism={prism}
              transformed={drawable ? frame.points : null}
              trail={drawable ? visibleTrail : []}
              fitTo={drawable ? [result.points, ...allTrail] : []}
              finalResult={result}
              fitKey={`${type}|${presetName}|${JSON.stringify(shape)}|${depth}|${recentre}`}
            />
          )}

          <MatrixNote matrix={matrix} />

          {!result.ok && (
            <p className="warning" role="alert">
              Some corners went off to infinity (w ≤ 0), so the shape can’t be drawn. Ease off the
              perspective sliders.
            </p>
          )}
          
        </main>
      </div>
    </div>
  );
}
