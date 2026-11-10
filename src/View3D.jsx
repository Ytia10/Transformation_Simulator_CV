/*
 * View3D.jsx — the 3D view, drawn with three.js through @react-three/fiber.
 *
 * Z points up: the 2D shape lies on the floor and its thickness rises from it.
 * Shown: the original prism (pencil grey), the motion trail (faint outlines)
 * and the transformed prism (ink blue). Hovering a corner of the ink prism
 * shows a note with its numbers. All maths happens in math.js.
 */
import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Vector3 } from 'three';
import { pointLabel, fmt } from './math.js';

const INK = '#23408e';
const PENCIL = '#8b8a84';
const FOV = 40;

/** Faces (flat, see-through) for a prism. */
function Faces({ vertices, triangles, color, opacity }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    // every triangle gets its own three corners so each face is lit evenly
    g.setAttribute('position', new Float32BufferAttribute(triangles.flatMap((tri) => tri.flatMap((i) => vertices[i])), 3));
    g.computeVertexNormals();
    return g;
  }, [vertices, triangles]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} transparent opacity={opacity} side={DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/** The outline (edges) of a prism. */
function Edges({ vertices, edges, color, opacity = 1 }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(edges.flatMap(([a, b]) => [...vertices[a], ...vertices[b]]), 3));
    return g;
  }, [vertices, edges]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </lineSegments>
  );
}

/**
 * Points the camera at the shapes. It only moves the camera when `fitKey`
 * changes (new shape, type or thickness, or a double-click), so dragging a
 * slider never makes the view jump.
 */
function AutoFrame({ center, radius, fitKey }) {
  const get = useThree((s) => s.get);
  const controls = useThree((s) => s.controls);
  const size = useThree((s) => s.size); // also re-frame when the window is resized

  const latest = useRef({ center, radius });
  useEffect(() => {
    latest.current = { center, radius };
  });

  useEffect(() => {
    const { camera } = get();
    const { center: c, radius: r } = latest.current;
    // far enough back to fit a ball of radius r; narrow screens need more room sideways
    const aspect = size.width / Math.max(size.height, 1);
    const distance = ((r / Math.sin(((FOV / 2) * Math.PI) / 180)) * 1.1) / Math.min(1, aspect);
    const dir = new Vector3(0.55, -0.95, 0.75).normalize();
    camera.position.set(c[0] + dir.x * distance, c[1] + dir.y * distance, c[2] + dir.z * distance);
    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.set(c[0], c[1], c[2]);
      controls.update();
    } else {
      camera.lookAt(c[0], c[1], c[2]);
    }
  }, [fitKey, controls, get, size.width, size.height]);

  return null;
}

/** If the browser cannot do 3D (WebGL), say so instead of showing a blank area. */
class NoWebGL extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="warning" role="alert">
          This browser couldn’t start 3D graphics (WebGL). Turn on hardware acceleration in the browser
          settings, or try another browser.
        </p>
      );
    }
    return this.props.children;
  }
}

export default function View3D({ prism, transformed, trail, fitTo, finalResult, fitKey }) {
  const [hover, setHover] = useState(null); // { index, x, y } in pixels

  // Frame the original prism and everything the transformation reaches.
  const all = [...prism.vertices, ...fitTo.flat()];
  const min = [0, 1, 2].map((k) => Math.min(...all.map((p) => p[k])));
  const max = [0, 1, 2].map((k) => Math.max(...all.map((p) => p[k])));
  const center = [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
  const radius = Math.max(1, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);

  const extent = Math.max(2, ...all.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1]))));
  const gridSize = 2 * Math.ceil(extent + 2);
  const divisions = gridSize <= 80 ? gridSize : 40;
  const dot = radius * 0.016;

  const n = prism.vertices.length / 2;
  const info =
    hover && transformed && finalResult.ok && transformed[hover.index]
      ? {
          label: `${pointLabel(hover.index % n)} ${hover.index < n ? 'bottom' : 'top'}`,
          from: prism.vertices[hover.index],
          to: finalResult.points[hover.index],
          w: finalResult.w[hover.index],
        }
      : null;

  return (
    <NoWebGL>
      <div className="view" data-testid="view3d" style={{ cursor: hover ? 'pointer' : 'grab' }}>
        <Canvas camera={{ position: [6, -9, 7], up: [0, 0, 1], fov: FOV }} gl={{ alpha: true, antialias: true }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[4, -6, 10]} intensity={1.1} />

          {/* graph-paper floor in the XY plane (gridHelper is built in XZ, so turn it) */}
          <gridHelper args={[gridSize, divisions, '#a9bdd4', '#d9e2ee']} rotation={[Math.PI / 2, 0, 0]} />
          <axesHelper args={[Math.max(2, Math.ceil(extent * 0.5))]} />

          <Faces vertices={prism.vertices} triangles={prism.triangles} color={PENCIL} opacity={0.12} />
          <Edges vertices={prism.vertices} edges={prism.edges} color={PENCIL} />

          {trail.map((ghost, i) => (
            <Edges key={i} vertices={ghost} edges={prism.edges} color={PENCIL} opacity={0.25 + (0.3 * (i + 1)) / trail.length} />
          ))}

          {transformed && (
            <>
              <Faces vertices={transformed} triangles={prism.triangles} color={INK} opacity={0.28} />
              <Edges vertices={transformed} edges={prism.edges} color={INK} />
              {transformed.map((v, i) => (
                <mesh
                  key={i}
                  position={v}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    setHover({ index: i, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
                  }}
                  onPointerOut={() => setHover(null)}
                >
                  <sphereGeometry args={[hover?.index === i ? dot * 1.6 : dot, 12, 12]} />
                  <meshBasicMaterial color={INK} />
                </mesh>
              ))}
            </>
          )}

          <OrbitControls makeDefault enableDamping={false} />
          <AutoFrame center={center} radius={radius} fitKey={fitKey} />
        </Canvas>

        {info && (
          <div className="corner-note" role="status" style={{ left: hover.x, top: hover.y, transform: 'translate(14px, calc(-100% - 10px))' }}>
            <strong>{info.label}</strong> ({info.from.map((v) => fmt(v, 2)).join(', ')}) → (
            {info.to.map((v) => fmt(v, 2)).join(', ')})
            {Math.abs(info.w - 1) > 1e-9 && <span className="w">divided by w = {fmt(info.w, 2)}</span>}
          </div>
        )}
      </div>
    </NoWebGL>
  );
}
