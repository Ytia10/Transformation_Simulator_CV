/*
 * Tests for math.js. Run with:  npm test
 * Every expected value was worked out by hand, so if a calculation in
 * math.js is changed by mistake, the matching test fails and says where.
 */
import { describe, it, expect } from 'vitest';
import {
  identity,
  multiply,
  buildMatrix2D,
  buildMatrix3D,
  buildMatrix,
  applyMatrix,
  neutralParams,
  defaultParams,
  lerpParams,
  sliderKeys,
  TYPES,
  TYPE_KEYS,
  PARAMS,
  PRESETS,
  DEFAULT_PRESET,
  extrude,
  triangulate,
  polygonArea,
  signedArea,
  parseShapeText,
  validatePoints,
  pointsToText,
  pointLabel,
  fmt,
  round,
} from './math.js';

const close = (a, b, digits = 9) => expect(a).toBeCloseTo(b, digits);
const closePoint = (p, q) => {
  expect(p).toHaveLength(q.length);
  p.forEach((v, i) => close(v, q[i]));
};
const closeMatrix = (A, B) => A.forEach((row, r) => row.forEach((v, c) => close(v, B[r][c])));
const p = (extra) => ({ ...neutralParams(), ...extra });
const move = (M, point) => applyMatrix(M, [point]).points[0];

const SQUARE = PRESETS.Square;
const L = PRESETS['L-shape'];

/** Volume of a closed triangle mesh, keeping the sign (positive = faces point out). */
function signedVolume(vertices, triangles) {
  let sum = 0;
  for (const [a, b, c] of triangles) {
    const [ax, ay, az] = vertices[a];
    const [bx, by, bz] = vertices[b];
    const [cx, cy, cz] = vertices[c];
    sum += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return sum / 6;
}

// ---------------------------------------------------------------------------
describe('matrix helpers', () => {
  it('identity', () => {
    expect(identity(3)).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });

  it('multiplying by the identity changes nothing', () => {
    const A = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 10],
    ];
    expect(multiply(A, identity(3))).toEqual(A);
    expect(multiply(identity(3), A)).toEqual(A);
  });

  it('a product worked out by hand', () => {
    const A = [
      [1, 2, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const B = [
      [3, 0, 1],
      [0, 2, 0],
      [0, 0, 1],
    ];
    expect(multiply(A, B)).toEqual([
      [3, 4, 1],
      [0, 2, 0],
      [0, 0, 1],
    ]);
  });
});

// ---------------------------------------------------------------------------
describe('sliders and types', () => {
  it('neutral values give the identity matrix for every type in both modes', () => {
    for (const type of TYPE_KEYS) {
      closeMatrix(buildMatrix2D(type, neutralParams()), identity(3));
      closeMatrix(buildMatrix3D(type, neutralParams()), identity(4));
    }
  });

  it('every slider exists, defaults sit inside the slider range, at most 6 sliders', () => {
    for (const type of TYPE_KEYS) {
      for (const mode of ['2d', '3d']) {
        const keys = sliderKeys(type, mode);
        expect(keys.length).toBeLessThanOrEqual(6);
        for (const key of keys) expect(PARAMS[key]).toBeDefined();
      }
      const d = defaultParams(type);
      for (const key of Object.keys(PARAMS)) {
        expect(d[key]).toBeGreaterThanOrEqual(PARAMS[key].min);
        expect(d[key]).toBeLessThanOrEqual(PARAMS[key].max);
      }
    }
  });

  it('every 2D slider is also there in 3D', () => {
    for (const type of TYPE_KEYS) {
      for (const key of TYPES[type].sliders2D) expect(TYPES[type].sliders3D).toContain(key);
    }
  });

  it('defaults actually change the shape (no type starts as "do nothing")', () => {
    for (const type of TYPE_KEYS) {
      expect(buildMatrix2D(type, defaultParams(type))).not.toEqual(identity(3));
      expect(buildMatrix3D(type, defaultParams(type))).not.toEqual(identity(4));
    }
  });

  it('lerpParams: 0 is neutral, 1 is the chosen value, 0.5 is halfway', () => {
    const chosen = p({ angle: 60, scale: 2, tx: 4 });
    expect(lerpParams(chosen, 0)).toEqual(neutralParams());
    expect(lerpParams(chosen, 1)).toEqual(chosen);
    const half = lerpParams(chosen, 0.5);
    close(half.angle, 30);
    close(half.scale, 1.5);
    close(half.tx, 2);
  });

  it('buildMatrix picks 3x3 or 4x4 by mode', () => {
    expect(buildMatrix('2d', 'affine', defaultParams('affine'))).toHaveLength(3);
    expect(buildMatrix('3d', 'affine', defaultParams('affine'))).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
describe('2D transformations', () => {
  it('translation: (1, 2) shifted by (3, 4) is (4, 6)', () => {
    closePoint(move(buildMatrix2D('translation', p({ tx: 3, ty: 4 })), [1, 2]), [4, 6]);
  });

  it('euclidean: turning (1, 0) by 90° gives (0, 1); then shifting by (1, 1) gives (1, 2)', () => {
    closePoint(move(buildMatrix2D('euclidean', p({ angle: 90 })), [1, 0]), [0, 1]);
    closePoint(move(buildMatrix2D('euclidean', p({ angle: 90, tx: 1, ty: 1 })), [1, 0]), [1, 2]);
  });

  it('similarity: scale 2 and turn 90° takes (1, 0) to (0, 2)', () => {
    closePoint(move(buildMatrix2D('similarity', p({ angle: 90, scale: 2 })), [1, 0]), [0, 2]);
  });

  it('affine: stretch first, then shear: (1, 1) with sx 2, sy 3, shear 0.5 is (3.5, 3)', () => {
    closePoint(move(buildMatrix2D('affine', p({ sx: 2, sy: 3, shear: 0.5 })), [1, 1]), [3.5, 3]);
  });

  it('affine keeps the bottom row 0 0 1, so w stays 1', () => {
    const M = buildMatrix2D('affine', defaultParams('affine'));
    expect(M[2]).toEqual([0, 0, 1]);
    applyMatrix(M, L).w.forEach((w) => expect(w).toBe(1));
  });

  it('projective: divides by w = p1·x + p2·y + 1', () => {
    const { points, w, ok } = applyMatrix(buildMatrix2D('projective', p({ p1: 0.5, p2: 0.25 })), [[2, 4]]);
    close(w[0], 3);
    closePoint(points[0], [2 / 3, 4 / 3]);
    expect(ok).toBe(true);
  });

  it('w = 0 or w < 0 is reported as not drawable', () => {
    expect(applyMatrix(buildMatrix2D('projective', p({ p1: -0.5 })), SQUARE).ok).toBe(false); // w = 0 at x = 2
    expect(applyMatrix(buildMatrix2D('projective', p({ p1: -0.2 })), [[0, 0], [10, 0], [0, 1]]).ok).toBe(false);
  });

  it('the values written in GUIDE.md (L-shape, default sliders)', () => {
    const at = (type) => applyMatrix(buildMatrix2D(type, defaultParams(type)), L);
    closePoint(at('translation').points[1], [6, 2]);
    expect(round(at('euclidean').points[1][0])).toBe(4.598);
    expect(round(at('euclidean').points[1][1])).toBe(2.5);
    expect(at('similarity').points[1].map((v) => round(v))).toEqual([4.897, 3.25]);
    expect(at('affine').points[1].map((v) => round(v))).toEqual([4.347, 1.165]);
    const proj = at('projective');
    expect(round(proj.w[1])).toBe(1.24);
    expect(proj.points[1].map((v) => round(v))).toEqual([2.419, 0]);
    expect(round(proj.w[2])).toBe(1.29);
    expect(proj.points[2].map((v) => round(v))).toEqual([2.326, 0.775]);
  });
});

// ---------------------------------------------------------------------------
describe('3D transformations', () => {
  it('translation', () => {
    closePoint(move(buildMatrix3D('translation', p({ tx: 1, ty: 2, tz: 3 })), [1, 1, 1]), [2, 3, 4]);
  });

  it('angle turns about Z, like in 2D', () => {
    closePoint(move(buildMatrix3D('euclidean', p({ angle: 90 })), [1, 0, 5]), [0, 1, 5]);
  });

  it('tilt turns about X: (0, 1, 0) goes to (0, 0, 1)', () => {
    closePoint(move(buildMatrix3D('euclidean', p({ tilt: 90 })), [0, 1, 0]), [0, 0, 1]);
  });

  it('tilt happens before the angle: (0, 1, 0) → tilt 90 → (0, 0, 1) → angle 90 → (0, 0, 1)', () => {
    closePoint(move(buildMatrix3D('euclidean', p({ tilt: 90, angle: 90 })), [0, 1, 0]), [0, 0, 1]);
    // and (1, 0, 0) → tilt leaves it → angle 90 → (0, 1, 0)
    closePoint(move(buildMatrix3D('euclidean', p({ tilt: 90, angle: 90 })), [1, 0, 0]), [0, 1, 0]);
  });

  it('similarity scales all three axes', () => {
    closePoint(move(buildMatrix3D('similarity', p({ scale: 2 })), [1, 2, 3]), [2, 4, 6]);
  });

  it('affine: stretch each axis, then shear x += k·y', () => {
    closePoint(move(buildMatrix3D('affine', p({ sx: 2, sy: 3, sz: 4, shear: 1 })), [1, 1, 1]), [5, 3, 4]);
  });

  it('projective: divides by w = p1·x + p2·y + p3·z + 1', () => {
    const { points, w } = applyMatrix(buildMatrix3D('projective', p({ p1: 0.1, p2: 0.2, p3: 0.3 })), [[1, 1, 1]]);
    close(w[0], 1.6);
    closePoint(points[0], [1 / 1.6, 1 / 1.6, 1 / 1.6]);
  });

  it('without tilt or z-changes, 3D matches 2D on the floor (z = 0)', () => {
    for (const type of TYPE_KEYS) {
      const params = { ...defaultParams(type), tilt: 0, tz: 0, sz: 1, p3: 0 };
      const flat = applyMatrix(buildMatrix2D(type, params), SQUARE).points;
      const solid = applyMatrix(buildMatrix3D(type, params), SQUARE.map(([x, y]) => [x, y, 0])).points;
      solid.forEach((q, i) => {
        closePoint([q[0], q[1]], flat[i]);
        close(q[2], 0);
      });
    }
  });

  it('GUIDE.md value: 3D translation moves "A top" (0, 0, 1.5) to (3, 2, 2.5)', () => {
    closePoint(move(buildMatrix3D('translation', defaultParams('translation')), [0, 0, 1.5]), [3, 2, 2.5]);
  });
});

// ---------------------------------------------------------------------------
describe('triangles and the 3D prism', () => {
  const triArea = (pts, [a, b, c]) => Math.abs(signedArea([pts[a], pts[b], pts[c]]));
  const coveredArea = (pts) => triangulate(pts).reduce((s, t) => s + triArea(pts, t), 0);

  it('triangles cover each preset exactly, in both point orders', () => {
    for (const pts of Object.values(PRESETS)) {
      for (const order of [pts, [...pts].reverse()]) {
        expect(triangulate(order)).toHaveLength(order.length - 2);
        close(coveredArea(order), polygonArea(order));
      }
    }
  });

  it('a point in the middle of an edge is fine', () => {
    close(coveredArea([[0, 0], [1, 0], [2, 0], [2, 2], [0, 2]]), 4);
  });

  it('200 random star-shaped polygons are covered exactly', () => {
    let seed = 42;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let tested = 0;
    for (let k = 0; k < 200; k++) {
      const n = 3 + Math.floor(rand() * 15);
      const angles = Array.from({ length: n }, () => rand() * 2 * Math.PI).sort((a, b) => a - b);
      const pts = angles.map((a) => {
        const r = 0.5 + rand() * 3;
        return [r * Math.cos(a), r * Math.sin(a)];
      });
      if (validatePoints(pts).error) continue;
      tested++;
      close(coveredArea(pts), polygonArea(pts), 7);
    }
    expect(tested).toBeGreaterThan(150);
  });

  it('a 2×2 square with thickness 1 has 8 corners, 12 edges and 12 triangles', () => {
    const prism = extrude(SQUARE, 1);
    expect(prism.vertices).toHaveLength(8);
    expect(prism.edges).toHaveLength(12);
    expect(prism.triangles).toHaveLength(12);
  });

  it('the prism is closed and faces outwards: signed volume = area × thickness', () => {
    for (const pts of Object.values(PRESETS)) {
      for (const order of [pts, [...pts].reverse()]) {
        const { vertices, triangles } = extrude(order, 2.5);
        close(signedVolume(vertices, triangles), polygonArea(order) * 2.5);
      }
    }
  });
});

// ---------------------------------------------------------------------------
describe('reading typed points', () => {
  const square = [[0, 0], [2, 0], [2, 2], [0, 2]];

  it('every accepted format gives the same square', () => {
    for (const text of [
      '[[0,0],[2,0],[2,2],[0,2]]',
      '0 0\n2 0\n2 2\n0 2',
      '0,0\n2,0\n2,2\n0,2',
      '0, 0; 2, 0; 2, 2; 0, 2',
      '(0,0) (2,0) (2,2) (0,2)',
      '0 0, 2 0, 2 2, 0 2',
      '[[0,2,2,0],[0,0,2,2]]',
      '0 2 2 0\n0 0 2 2',
      '[[0,0,1],[2,0,1],[2,2,1],[0,2,1]]',
      '[[0,2,2,0],[0,0,2,2],[1,1,1,1]]',
      '[[0,0],[2,0],[2,2],[0,2],[0,0]]',
      '  [[0, 0], [2, 0], [2, 2], [0, 2]]  ',
    ]) {
      expect(parseShapeText(text), text).toEqual({ points: square });
    }
  });

  it('decimals and negative numbers', () => {
    expect(parseShapeText('[[-1.5,0],[2.25,0],[0,3e0]]').points).toEqual([[-1.5, 0], [2.25, 0], [0, 3]]);
  });

  it('clear messages for bad input', () => {
    expect(parseShapeText('').error).toMatch(/Type some points/);
    expect(parseShapeText('[[0,0],[1,0]').error).toMatch(/brackets/);
    expect(parseShapeText('[1,2,3]').error).toMatch(/list of rows/);
    expect(parseShapeText('[[0,0],[1,0]]').error).toMatch(/at least 3/);
    expect(parseShapeText('0 0\n1 x\n2 2').error).toMatch(/“x” isn’t a number/);
    expect(parseShapeText('[[0,true],[1,0],[0,1]]').error).toMatch(/isn’t a number/);
    expect(parseShapeText('[[0,"2"],[1,0],[0,1]]').points).toEqual([[0, 2], [1, 0], [0, 1]]);
    expect(parseShapeText('[[0,0],[1,0],[1]]').error).toMatch(/same number/);
    expect(parseShapeText('[[0,0],[1,1],[2,2]]').error).toMatch(/one line/);
    expect(parseShapeText('[[0,0],[2,0],[0,0],[0,2]]').error).toMatch(/are the same/);
    expect(parseShapeText('[[0,0],[2,2],[2,0],[0,2]]').error).toMatch(/cross/);
    expect(parseShapeText('[[0,0,5],[1,0,5],[0,1,5],[1,1,5]]').error).toMatch(/x and a y/);
    const many = Array.from({ length: 51 }, (_, i) => [Math.cos(i / 8), Math.sin(i / 8)]);
    expect(validatePoints(many).error).toMatch(/50 points/);
  });

  it('every preset is a valid shape, and the default preset exists', () => {
    for (const pts of Object.values(PRESETS)) expect(validatePoints(pts).error).toBeUndefined();
    expect(PRESETS[DEFAULT_PRESET]).toBeDefined();
  });

  it('pointsToText can be read back', () => {
    for (const pts of Object.values(PRESETS)) expect(parseShapeText(pointsToText(pts)).points).toEqual(pts);
  });
});

// ---------------------------------------------------------------------------
describe('labels and number formatting', () => {
  it('pointLabel', () => {
    expect(pointLabel(0)).toBe('A');
    expect(pointLabel(25)).toBe('Z');
    expect(pointLabel(26)).toBe('A1');
  });

  it('round and fmt', () => {
    expect(round(0.86602540378)).toBe(0.866);
    expect(round(-0.0001)).toBe(0);
    expect(fmt(2)).toBe('2');
    expect(fmt(1.23456, 2)).toBe('1.23');
    expect(fmt(Infinity)).toBe('∞');
  });
});
