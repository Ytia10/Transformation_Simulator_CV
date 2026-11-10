/*
 * View2D.jsx — the 2D graph paper.
 *
 * Draws the grid, the original shape (dashed pencil), the motion trail
 * (faint pencil outlines) and the transformed shape (ink). Hovering a corner
 * of the ink shape shows a small note with its numbers.
 *
 * The SVG fills the whole area. One maths unit is the same number of pixels
 * horizontally and vertically, and the window is chosen so the origin, the
 * original, the trail and the result all fit. SVG's y axis points down while
 * maths' y axis points up, so every y is drawn as -y.
 */
import { useEffect, useRef, useState } from 'react';
import { pointLabel, fmt } from './math.js';

/** 1, 2 or 5 times a power of ten, at least `rough`. */
function niceStep(rough) {
  const power = 10 ** Math.floor(Math.log10(rough));
  const f = rough / power;
  if (f <= 1) return power;
  if (f <= 2) return 2 * power;
  if (f <= 5) return 5 * power;
  return 10 * power;
}

/** Keep track of an element's size in pixels. */
function useSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** Push each label a little away from the middle of the shape. */
function labelSpots(points, distance) {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  return points.map(([x, y]) => {
    const d = Math.hypot(x - cx, y - cy) || 1;
    return [x + ((x - cx) / d) * distance, y + ((y - cy) / d) * distance];
  });
}

const toSvg = (points) => points.map(([x, y]) => `${x},${-y}`).join(' ');

export default function View2D({ original, transformed, trail, fitTo, finalResult }) {
  const boxRef = useRef(null);
  const { width, height } = useSize(boxRef);
  const [hovered, setHovered] = useState(null);

  // ---- the visible window ----
  const all = [[0, 0], ...original, ...fitTo.flat()];
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  // units per pixel: the content takes up about 70% of the space
  const u = Math.max((maxX - minX + 1) / (w * 0.7), (maxY - minY + 1) / (h * 0.7));
  const view = { x: cx - (w * u) / 2, y: -cy - (h * u) / 2, w: w * u, h: h * u };
  const left = view.x;
  const right = view.x + view.w;
  const top = -view.y; // largest maths y on screen
  const bottom = top - view.h;

  // ---- grid: a fine grid, and a darker line every 5 squares ----
  const minor = niceStep(u * 22);
  const lines = (from, to) => {
    const out = [];
    for (let k = Math.ceil(from / minor); k <= Math.floor(to / minor); k++) out.push(k);
    return out;
  };
  const value = (k) => Number((k * minor).toPrecision(12));
  // number every 1st, 2nd, 5th or 10th line, so numbers are at least ~55 px apart
  const labelEvery = [1, 2, 5, 10].find((k) => (k * minor) / u >= 55) ?? 10;

  const px = (n) => n * u; // pixels → maths units (for sizes)
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  // Axis numbers sit next to the axes, but stay on screen when an axis is off to one side.
  const xTickY = clamp(px(16), -top + px(14), -bottom - px(6));
  const yTickX = clamp(px(5), left + px(4), right - px(30));
  const toScreen = ([x, y]) => [(x - view.x) / u, (-y - view.y) / u];

  const hoveredInfo =
    hovered !== null && transformed && finalResult.ok && transformed[hovered]
      ? {
          spot: toScreen(transformed[hovered]),
          label: pointLabel(hovered),
          from: original[hovered],
          to: finalResult.points[hovered],
          w: finalResult.w[hovered],
        }
      : null;

  return (
    <div className="view" ref={boxRef}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          role="img"
          aria-label="Graph of the original shape and the transformed shape"
        >
          <g className="grid-minor">
            {lines(left, right).map((k) => (
              <line key={`x${k}`} x1={value(k)} x2={value(k)} y1={view.y} y2={view.y + view.h} className={k % 5 === 0 ? 'major' : ''} />
            ))}
            {lines(bottom, top).map((k) => (
              <line key={`y${k}`} y1={-value(k)} y2={-value(k)} x1={view.x} x2={view.x + view.w} className={k % 5 === 0 ? 'major' : ''} />
            ))}
          </g>

          <g className="axes">
            <line x1={view.x} x2={view.x + view.w} y1={0} y2={0} />
            <line y1={view.y} y2={view.y + view.h} x1={0} x2={0} />
          </g>

          <g className="ticks" fontSize={px(11)}>
            {lines(left, right)
              .filter((k) => k !== 0 && k % labelEvery === 0)
              .map((k) => (
                <text key={`tx${k}`} x={value(k)} y={xTickY} textAnchor="middle">
                  {value(k)}
                </text>
              ))}
            {lines(bottom, top)
              .filter((k) => k !== 0 && k % labelEvery === 0)
              .map((k) => (
                <text key={`ty${k}`} x={yTickX} y={-value(k) + px(4)}>
                  {value(k)}
                </text>
              ))}
          </g>

          <polygon className="original" points={toSvg(original)} />
          <g className="letters original-letters" fontSize={px(14)}>
            {labelSpots(original, px(13)).map(([x, y], i) => (
              <text key={i} x={x} y={-y + px(5)} textAnchor="middle">
                {pointLabel(i)}
              </text>
            ))}
          </g>

          {trail.map((ghost, i) => (
            <polygon
              key={i}
              className="ghost"
              points={toSvg(ghost)}
              style={{ opacity: 0.25 + (0.35 * (i + 1)) / trail.length }}
            />
          ))}

          {transformed && (
            <>
              <polygon className="ink" points={toSvg(transformed)} data-testid="ink-shape" />
              <g className="letters ink-letters" fontSize={px(14)}>
                {labelSpots(transformed, px(13)).map(([x, y], i) => (
                  <text key={i} x={x} y={-y + px(5)} textAnchor="middle">
                    {pointLabel(i)}′
                  </text>
                ))}
              </g>
              {transformed.map(([x, y], i) => (
                <g key={i}>
                  <circle className="corner" cx={x} cy={-y} r={px(hovered === i ? 5 : 3.2)} />
                  <circle
                    className="corner-target"
                    cx={x}
                    cy={-y}
                    r={px(12)}
                    data-testid={`corner-${i}`}
                    onPointerEnter={() => setHovered(i)}
                    onPointerLeave={() => setHovered(null)}
                  />
                </g>
              ))}
            </>
          )}
        </svg>
      )}

      {hoveredInfo && (
        <div
          className="corner-note"
          role="status"
          style={{
            left: hoveredInfo.spot[0],
            top: hoveredInfo.spot[1],
            transform: `translate(${hoveredInfo.spot[0] > width - 260 ? 'calc(-100% - 14px)' : '14px'}, ${
              hoveredInfo.spot[1] < 70 ? '14px' : 'calc(-100% - 10px)'
            })`,
          }}
        >
          <strong>{hoveredInfo.label}</strong> ({hoveredInfo.from.map((v) => fmt(v, 2)).join(', ')}) → (
          {hoveredInfo.to.map((v) => fmt(v, 2)).join(', ')})
          {Math.abs(hoveredInfo.w - 1) > 1e-9 && <span className="w">divided by w = {fmt(hoveredInfo.w, 2)}</span>}
        </div>
      )}
    </div>
  );
}
