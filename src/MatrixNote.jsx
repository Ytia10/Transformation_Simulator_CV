/*
 * MatrixNote.jsx — the current matrix, written in the corner of the graph.
 * Read-only: it changes as the sliders move.
 */
import { fmt } from './math.js';

export default function MatrixNote({ matrix }) {
  return (
    <figure className="matrix-note" aria-label="Transformation matrix">
      <figcaption>M =</figcaption>
      <div className="matrix" style={{ gridTemplateColumns: `repeat(${matrix.length}, auto)` }}>
        {matrix.flat().map((value, i) => (
          <span key={i}>{fmt(value, 2)}</span>
        ))}
      </div>
    </figure>
  );
}
