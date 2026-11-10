/*
 * math.js — every calculation in the simulator lives in this file.
 *
 * Nothing here knows about React or the screen: functions take plain numbers
 * and arrays and return plain numbers and arrays. That is why the file can be
 * tested on its own (see math.test.js).
 *
 * Conventions:
 *   - A 2D point is [x, y]. A 3D point is [x, y, z].
 *   - A matrix is a list of rows: [[a, b, c], [d, e, f], [g, h, i]].
 *   - 2D uses 3x3 matrices, 3D uses 4x4 matrices (homogeneous coordinates:
 *     every point gets an extra 1 at the end before it is multiplied).
 *   - Angles come from the sliders in degrees and are converted to radians here.
 */

// ---------------------------------------------------------------------------
// 1. Matrix helpers
// ---------------------------------------------------------------------------

/** n x n identity matrix. */
export function identity(n) {
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => (r === c ? 1 : 0)),
  );
}

/** Matrix product A · B (square matrices of the same size). */
export function multiply(A, B) {
  const n = A.length;
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += A[r][k] * B[k][c];
      return sum;
    }),
  );
}

/** multiplyAll(A, B, C) = A · B · C. The right-most matrix acts first. */
export function multiplyAll(...matrices) {
  return matrices.reduce((acc, m) => multiply(acc, m));
}

const toRad = (deg) => (deg * Math.PI) / 180;

// ---------------------------------------------------------------------------
// 2. Slider parameters
// ---------------------------------------------------------------------------
//
// "neutral" is the value that changes nothing (shift 0, angle 0, scale 1).
// The morph animation and the motion trail move every value from neutral
// to the value the user picked.

export const PARAMS = {
  tx: { label: 'Shift x', min: -10, max: 10, step: 0.1, neutral: 0 },
  ty: { label: 'Shift y', min: -10, max: 10, step: 0.1, neutral: 0 },
  tz: { label: 'Shift z', min: -10, max: 10, step: 0.1, neutral: 0 },
  angle: { label: 'Angle', unit: '°', min: -180, max: 180, step: 1, neutral: 0 },
  tilt: { label: 'Tilt', unit: '°', min: -90, max: 90, step: 1, neutral: 0 },
  scale: { label: 'Scale', min: 0.1, max: 3, step: 0.05, neutral: 1 },
  sx: { label: 'Stretch x', min: 0.1, max: 3, step: 0.05, neutral: 1 },
  sy: { label: 'Stretch y', min: 0.1, max: 3, step: 0.05, neutral: 1 },
  sz: { label: 'Stretch z', min: 0.1, max: 3, step: 0.05, neutral: 1 },
  shear: { label: 'Shear', min: -2, max: 2, step: 0.05, neutral: 0 },
  p1: { label: 'Perspective x', min: -0.2, max: 0.2, step: 0.01, neutral: 0 },
  p2: { label: 'Perspective y', min: -0.2, max: 0.2, step: 0.01, neutral: 0 },
  p3: { label: 'Perspective z', min: -0.2, max: 0.2, step: 0.01, neutral: 0 },
};

/** Every parameter at its neutral value. */
export function neutralParams() {
  const out = {};
  for (const key of Object.keys(PARAMS)) out[key] = PARAMS[key].neutral;
  return out;
}

// ---------------------------------------------------------------------------
// 3. The five transformation types
// ---------------------------------------------------------------------------
//
// sliders2D / sliders3D : which sliders are shown in each mode
// defaults              : values applied when the type is picked

export const TYPES = {
  translation: {
    name: 'Translation',
    meaning: 'Slides the shape. Nothing else changes.',
    sliders2D: ['tx', 'ty'],
    sliders3D: ['tx', 'ty', 'tz'],
    defaults: { tx: 3, ty: 2, tz: 1 },
  },
  euclidean: {
    name: 'Euclidean',
    meaning: 'Turns and slides it. Size and shape stay exactly the same.',
    sliders2D: ['angle', 'tx', 'ty'],
    sliders3D: ['angle', 'tilt', 'tx', 'ty', 'tz'],
    defaults: { angle: 30, tilt: 25, tx: 2, ty: 1, tz: 0.5 },
  },
  similarity: {
    name: 'Similarity',
    meaning: 'Turns, slides and resizes it evenly. Angles stay the same.',
    sliders2D: ['angle', 'scale', 'tx', 'ty'],
    sliders3D: ['angle', 'tilt', 'scale', 'tx', 'ty', 'tz'],
    defaults: { angle: 30, tilt: 25, scale: 1.5, tx: 1, ty: 1, tz: 0.5 },
  },
  affine: {
    name: 'Affine',
    meaning: 'Stretches and shears it. Parallel lines stay parallel.',
    sliders2D: ['angle', 'sx', 'sy', 'shear'],
    sliders3D: ['angle', 'tilt', 'sx', 'sy', 'sz', 'shear'],
    defaults: { angle: 15, tilt: 15, sx: 1.5, sy: 0.8, sz: 1.2, shear: 0.5 },
  },
  projective: {
    name: 'Projective',
    meaning: 'Adds perspective. Straight lines stay straight, parallel ones can meet.',
    sliders2D: ['angle', 'p1', 'p2'],
    sliders3D: ['angle', 'tilt', 'p1', 'p2', 'p3'],
    defaults: { angle: 0, tilt: 0, p1: 0.08, p2: 0.05, p3: 0.04 },
  },
};

export const TYPE_KEYS = Object.keys(TYPES);

/** Neutral values with the defaults of the chosen type on top. */
export function defaultParams(type) {
  return { ...neutralParams(), ...TYPES[type].defaults };
}

/** The slider keys for a type in a mode ('2d' or '3d'). */
export function sliderKeys(type, mode) {
  return mode === '3d' ? TYPES[type].sliders3D : TYPES[type].sliders2D;
}

/**
 * Part of the way from "nothing" to the chosen values.
 * t = 0 gives the neutral values, t = 1 the chosen values, t = 0.5 halfway
 * (a 60° turn becomes 30°, a scale of 2 becomes 1.5).
 */
export function lerpParams(params, t) {
  const out = {};
  for (const key of Object.keys(PARAMS)) {
    const from = PARAMS[key].neutral;
    const to = params[key] ?? from;
    out[key] = from + (to - from) * t;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. 2D building blocks (3x3)
// ---------------------------------------------------------------------------

export function translate2D(tx, ty) {
  return [
    [1, 0, tx],
    [0, 1, ty],
    [0, 0, 1],
  ];
}

export function rotate2D(deg) {
  const c = Math.cos(toRad(deg));
  const s = Math.sin(toRad(deg));
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

export function scale2D(sx, sy) {
  return [
    [sx, 0, 0],
    [0, sy, 0],
    [0, 0, 1],
  ];
}

/** Shear: x' = x + k·y, y stays. */
export function shear2D(k) {
  return [
    [1, k, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
}

/**
 * The 3x3 matrix for a type. Read each product right to left:
 * for affine, the shape is stretched, then sheared, then turned, then moved.
 */
export function buildMatrix2D(type, p) {
  const T = translate2D(p.tx, p.ty);
  const R = rotate2D(p.angle);
  switch (type) {
    case 'translation':
      return T;
    case 'euclidean':
      return multiplyAll(T, R);
    case 'similarity':
      return multiplyAll(T, R, scale2D(p.scale, p.scale));
    case 'affine':
      return multiplyAll(T, R, shear2D(p.shear), scale2D(p.sx, p.sy));
    case 'projective': {
      const H = multiplyAll(T, R, shear2D(p.shear), scale2D(p.sx, p.sy));
      H[2] = [p.p1, p.p2, 1]; // the perspective row
      return H;
    }
    default:
      throw new Error(`Unknown transformation type: ${type}`);
  }
}

// ---------------------------------------------------------------------------
// 5. 3D building blocks (4x4)
// ---------------------------------------------------------------------------

export function translate3D(tx, ty, tz) {
  return [
    [1, 0, 0, tx],
    [0, 1, 0, ty],
    [0, 0, 1, tz],
    [0, 0, 0, 1],
  ];
}

/** Turn about the X axis (we call it "tilt": it lifts the shape off the floor). */
export function rotateX3D(deg) {
  const c = Math.cos(toRad(deg));
  const s = Math.sin(toRad(deg));
  return [
    [1, 0, 0, 0],
    [0, c, -s, 0],
    [0, s, c, 0],
    [0, 0, 0, 1],
  ];
}

/** Turn about the Z axis (the same turn as the 2D angle). */
export function rotateZ3D(deg) {
  const c = Math.cos(toRad(deg));
  const s = Math.sin(toRad(deg));
  return [
    [c, -s, 0, 0],
    [s, c, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

export function scale3D(sx, sy, sz) {
  return [
    [sx, 0, 0, 0],
    [0, sy, 0, 0],
    [0, 0, sz, 0],
    [0, 0, 0, 1],
  ];
}

/** Shear: x' = x + k·y, y and z stay (same as in 2D). */
export function shear3D(k) {
  return [
    [1, k, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

/** The 4x4 matrix for a type. Rotation = tilt about X first, then angle about Z. */
export function buildMatrix3D(type, p) {
  const T = translate3D(p.tx, p.ty, p.tz);
  const R = multiply(rotateZ3D(p.angle), rotateX3D(p.tilt));
  switch (type) {
    case 'translation':
      return T;
    case 'euclidean':
      return multiplyAll(T, R);
    case 'similarity':
      return multiplyAll(T, R, scale3D(p.scale, p.scale, p.scale));
    case 'affine':
      return multiplyAll(T, R, shear3D(p.shear), scale3D(p.sx, p.sy, p.sz));
    case 'projective': {
      const H = multiplyAll(T, R, shear3D(p.shear), scale3D(p.sx, p.sy, p.sz));
      H[3] = [p.p1, p.p2, p.p3, 1]; // the perspective row
      return H;
    }
    default:
      throw new Error(`Unknown transformation type: ${type}`);
  }
}

/** The matrix for the current mode. */
export function buildMatrix(mode, type, params) {
  return mode === '3d' ? buildMatrix3D(type, params) : buildMatrix2D(type, params);
}

// ---------------------------------------------------------------------------
// 6. Applying a matrix to points
// ---------------------------------------------------------------------------

/** If w is this small (or negative) the point has gone "to infinity". */
export const W_EPSILON = 1e-6;

/**
 * Apply a 3x3 (2D) or 4x4 (3D) matrix to a list of points.
 *
 *   1. add a 1:            (x, y)   -> [x, y, 1]
 *   2. multiply:           [X, Y, w] = M · [x, y, 1]
 *   3. divide by w:        x' = X / w,  y' = Y / w
 *
 * w is always 1 except for projective matrices.
 * Returns { points, w, ok }; ok is false if any w <= 0 (cannot be drawn).
 */
export function applyMatrix(M, points) {
  const n = M.length;
  const out = [];
  const ws = [];
  for (const point of points) {
    const h = [...point, 1];
    const r = M.map((row) => row.reduce((sum, v, k) => sum + v * h[k], 0));
    const w = r[n - 1];
    ws.push(w);
    out.push(r.slice(0, n - 1).map((v) => v / w));
  }
  const ok = ws.every((w) => w > W_EPSILON) && out.every((p) => p.every(Number.isFinite));
  return { points: out, w: ws, ok };
}

// ---------------------------------------------------------------------------
// 7. From the 2D shape to a 3D prism
// ---------------------------------------------------------------------------

/** Signed area (shoelace formula). Positive when the points go anticlockwise. */
export function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function polygonArea(points) {
  return Math.abs(signedArea(points));
}

/**
 * Split a polygon (convex or not, edges not crossing) into triangles by
 * "ear clipping": keep cutting off a corner triangle that has no other point
 * inside it. Returns [i, j, k] index triples, all anticlockwise.
 */
export function triangulate(points) {
  let idx = Array.from({ length: points.length }, (_, i) => i);
  if (signedArea(points) < 0) idx.reverse();

  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const inside = (p, a, b, c) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;

  const triangles = [];
  while (idx.length > 3) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const prev = idx[(i - 1 + idx.length) % idx.length];
      const curr = idx[i];
      const next = idx[(i + 1) % idx.length];
      const [a, b, c] = [points[prev], points[curr], points[next]];
      if (cross(a, b, c) <= 1e-12) continue; // inward corner: not an ear
      const blocked = idx.some((j) => j !== prev && j !== curr && j !== next && inside(points[j], a, b, c));
      if (blocked) continue;
      triangles.push([prev, curr, next]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break; // only possible for an invalid polygon
  }
  if (idx.length === 3) triangles.push([idx[0], idx[1], idx[2]]);
  return triangles;
}

/**
 * Give the 2D shape a thickness.
 *   vertices 0..n-1  : bottom face (z = 0), same order as the shape
 *   vertices n..2n-1 : top face (z = depth)
 *   edges            : pairs of vertex numbers, for the outline
 *   triangles        : the faces, all facing outwards
 */
export function extrude(points, depth) {
  const n = points.length;
  const vertices = [...points.map(([x, y]) => [x, y, 0]), ...points.map(([x, y]) => [x, y, depth])];

  const edges = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    edges.push([i, j], [n + i, n + j], [i, n + i]); // bottom, top, upright
  }

  const order = Array.from({ length: n }, (_, i) => i);
  if (signedArea(points) < 0) order.reverse(); // walk the outline anticlockwise

  const triangles = [];
  for (const [a, b, c] of triangulate(points)) {
    triangles.push([n + a, n + b, n + c]); // top, facing up
    triangles.push([a, c, b]); // bottom, facing down
  }
  for (let k = 0; k < n; k++) {
    const i = order[k];
    const j = order[(k + 1) % n];
    triangles.push([i, j, n + j], [i, n + j, n + i]); // the side wall
  }
  return { vertices, edges, triangles };
}

// ---------------------------------------------------------------------------
// 8. Reading the user's points
// ---------------------------------------------------------------------------

export const MAX_POINTS = 50;

/** A, B, C … Z, A1, B1 … */
export function pointLabel(i) {
  const letter = String.fromCharCode(65 + (i % 26));
  const round = Math.floor(i / 26);
  return round === 0 ? letter : `${letter}${round}`;
}

/** Do segments p1–p2 and p3–p4 touch or cross? */
function segmentsTouch(p1, p2, p3, p4) {
  const orient = (a, b, c) => {
    const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    return Math.abs(v) < 1e-12 ? 0 : Math.sign(v);
  };
  const within = (a, b, c) =>
    Math.min(a[0], b[0]) - 1e-12 <= c[0] &&
    c[0] <= Math.max(a[0], b[0]) + 1e-12 &&
    Math.min(a[1], b[1]) - 1e-12 <= c[1] &&
    c[1] <= Math.max(a[1], b[1]) + 1e-12;

  const o1 = orient(p1, p2, p3);
  const o2 = orient(p1, p2, p4);
  const o3 = orient(p3, p4, p1);
  const o4 = orient(p3, p4, p2);
  if (o1 !== o2 && o3 !== o4) return true;
  return (
    (o1 === 0 && within(p1, p2, p3)) ||
    (o2 === 0 && within(p1, p2, p4)) ||
    (o3 === 0 && within(p3, p4, p1)) ||
    (o4 === 0 && within(p3, p4, p2))
  );
}

/** Check a list of [x, y] points. Returns { points } or { error }. */
export function validatePoints(input) {
  let points = input.map((p) => [p[0], p[1]]);

  if (points.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) {
    return { error: 'Every coordinate has to be a number.' };
  }
  if (points.length > 3) {
    const [first, last] = [points[0], points[points.length - 1]];
    if (first[0] === last[0] && first[1] === last[1]) points = points.slice(0, -1); // closing point
  }
  if (points.length < 3) return { error: 'A shape needs at least 3 points.' };
  if (points.length > MAX_POINTS) return { error: `Use ${MAX_POINTS} points or fewer.` };

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (points[i][0] === points[j][0] && points[i][1] === points[j][1]) {
        return { error: `Points ${pointLabel(i)} and ${pointLabel(j)} are the same.` };
      }
    }
  }

  const [p0, p1] = points;
  const onOneLine = points.every(
    (p) => Math.abs((p1[0] - p0[0]) * (p[1] - p0[1]) - (p1[1] - p0[1]) * (p[0] - p0[0])) < 1e-9,
  );
  if (onOneLine) return { error: 'All the points are on one line, so there is no shape.' };

  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // neighbouring edges share a corner
      if (segmentsTouch(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) {
        return { error: 'Two edges cross. List the points in order around the shape.' };
      }
    }
  }
  return { points };
}

/**
 * Read points typed as text. Accepted:
 *   [[0,0],[2,0],[2,2],[0,2]]        list of points (N x 2)
 *   0 0, 2 0, 2 2, 0 2  or one per line
 *   (0,0) (2,0) (2,2) (0,2)
 *   [[0,2,2,0],[0,0,2,2]]            2 x N: a row of x's and a row of y's
 *   [[0,0,1],[2,0,1],…]              homogeneous N x 3 (last column all 1)
 *   [[0,2,2,0],[0,0,2,2],[1,1,1,1]]  homogeneous 3 x N (last row all 1)
 * Returns { points } or { error }.
 */
export function parseShapeText(text) {
  const trimmed = text.trim();
  if (!trimmed) return { error: 'Type some points first, e.g. [[0,0],[3,0],[1,2]].' };

  let rows;
  if (trimmed.startsWith('[')) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { error: 'The brackets don’t match. Try [[0,0],[3,0],[1,2]].' };
    }
    if (!Array.isArray(parsed) || !parsed.every(Array.isArray)) {
      return { error: 'Write the points as a list of rows, like [[0,0],[3,0],[1,2]].' };
    }
    rows = parsed;
  } else {
    // Rows are separated by new lines or semicolons; values by spaces or commas.
    // (If everything ends up on one line it is read as x y x y … below.)
    rows = trimmed
      .replace(/[()[\]]/g, ' ')
      .split(/\n|;/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/[\s,]+/).filter(Boolean));
  }

  const numeric = [];
  for (const row of rows) {
    const nums = [];
    for (const v of row) {
      const num = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
      if (!Number.isFinite(num)) return { error: `“${v}” isn’t a number.` };
      nums.push(num);
    }
    numeric.push(nums);
  }

  // Everything on one line: read it as x y x y x y …
  if (numeric.length === 1 && numeric[0].length >= 6 && numeric[0].length % 2 === 0) {
    const flat = numeric[0];
    const pairs = [];
    for (let i = 0; i < flat.length; i += 2) pairs.push([flat[i], flat[i + 1]]);
    return validatePoints(pairs);
  }

  const R = numeric.length;
  const C = numeric[0]?.length ?? 0;
  if (C === 0) return { error: 'Type some points first, e.g. [[0,0],[3,0],[1,2]].' };
  if (!numeric.every((row) => row.length === C)) {
    return { error: 'Every row needs the same number of values.' };
  }

  let points;
  if (C === 2) points = numeric;
  else if (C === 3 && numeric.every((row) => row[2] === 1)) points = numeric.map(([x, y]) => [x, y]);
  else if (R === 2 && C >= 3) points = numeric[0].map((x, i) => [x, numeric[1][i]]);
  else if (R === 3 && C >= 3 && numeric[2].every((v) => v === 1)) points = numeric[0].map((x, i) => [x, numeric[1][i]]);
  else return { error: 'Each point needs an x and a y, e.g. [[0,0],[3,0],[1,2]].' };

  return validatePoints(points);
}

/** Points back to text for the input box. */
export function pointsToText(points) {
  return JSON.stringify(points.map(([x, y]) => [round(x), round(y)]));
}

// ---------------------------------------------------------------------------
// 9. Preset shapes and number formatting
// ---------------------------------------------------------------------------

function starPoints() {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 2 : 0.85;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([round(2 + r * Math.cos(a)), round(2 + r * Math.sin(a))]);
  }
  return pts;
}

export const PRESETS = {
  Square: [[0, 0], [2, 0], [2, 2], [0, 2]],
  Triangle: [[0, 0], [3, 0], [1, 2]],
  'L-shape': [[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]],
  House: [[0, 0], [2, 0], [2, 2], [1, 3], [0, 2]],
  Star: starPoints(),
};

export const DEFAULT_PRESET = 'L-shape';

/** Round for display, and turn -0 into 0. */
export function round(v, decimals = 3) {
  const f = 10 ** decimals;
  const r = Math.round(v * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

/** A number as short text: 0.866, 2, ∞. */
export function fmt(v, decimals = 3) {
  if (!Number.isFinite(v)) return '∞';
  return String(round(v, decimals));
}
