/* Connectome graph for the OHBM 26 workshop site.
   - 133 brain nodes loaded from data/coords.txt (MNI x/y/z)
   - Edges from data/connectivity.txt (133x133 streamline counts), top-percentile threshold
   - View-only: rotate by drag, zoom by wheel. No node-dragging, no layout switching.
   - SER perturbation propagates on click (no node wobble); reports packets transmitted.
   - Reacts to a "zoomProgress" prop driven by page scroll — at 1.0, a focal node
     has grown to fill the screen.
*/

const BRAIN = {
  coords: null,        // [[x,y,z], ...]
  conn:   null,        // 133x133 (Float32Array array of rows)
  edges:  null,        // [[i,j,weight], ...] thresholded
  loaded: false,
};

async function loadBrain() {
  if (BRAIN.loaded) return BRAIN;
  const [coordsTxt, connTxt] = await Promise.all([
    fetch('data/coords.txt').then(r => r.text()),
    fetch('data/connectivity.txt').then(r => r.text()),
  ]);
  // Parse coords — MNI mm. Scale up so the brain fills the viewport.
  // Reorient: MNI (x=R, y=A, z=S) → screen (x=A, y=S, z=R) so we see a sagittal view
  // with the top of the head up and the front of the brain facing right.
  const COORD_SCALE = 4.5;
  const rawCoords = coordsTxt.trim().split(/\r?\n/).map(line =>
    line.trim().split(/\s+/).map(Number)
  ).filter(r => r.length === 3 && r.every(v => Number.isFinite(v)));
  const coords = rawCoords.map(r => [r[1]*COORD_SCALE, r[2]*COORD_SCALE, r[0]*COORD_SCALE]);
  // Parse connectivity
  const conn = connTxt.trim().split(/\r?\n/).map(line =>
    line.trim().split(/\s+/).map(Number)
  );
  const N = coords.length;
  // Threshold: take top 8% of off-diagonal entries
  const vals = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const v = (conn[i] && conn[i][j]) || 0;
    if (v > 0) vals.push(v);
  }
  vals.sort((a, b) => b - a);
  const cut = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.06))] || 0;
  const edgesRaw = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const v = (conn[i] && conn[i][j]) || 0;
    if (v >= cut && v > 0) edgesRaw.push([i, j, v]);
  }
  // Drop nodes with no edges — remap to compact index.
  const used = new Set();
  for (const [i, j] of edgesRaw) { used.add(i); used.add(j); }
  const remap = new Map();
  const keepCoords = [];
  for (let i = 0; i < N; i++) {
    if (used.has(i)) {
      remap.set(i, keepCoords.length);
      keepCoords.push(coords[i]);
    }
  }
  const edges = edgesRaw.map(([i, j, v]) => [remap.get(i), remap.get(j), v]);
  BRAIN.coords = keepCoords;
  BRAIN.conn = conn;
  BRAIN.edges = edges;
  BRAIN.loaded = true;
  return BRAIN;
}

// ── Quaternion utilities ───────────────────────────────────────────
function qIdentity() { return [1, 0, 0, 0]; }
function qMul(a, b) {
  return [
    a[0]*b[0] - a[1]*b[1] - a[2]*b[2] - a[3]*b[3],
    a[0]*b[1] + a[1]*b[0] + a[2]*b[3] - a[3]*b[2],
    a[0]*b[2] - a[1]*b[3] + a[2]*b[0] + a[3]*b[1],
    a[0]*b[3] + a[1]*b[2] - a[2]*b[1] + a[3]*b[0],
  ];
}
function qFromAxisAngle(axis, angle) {
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), axis[0]*s, axis[1]*s, axis[2]*s];
}
function qNormalize(q) {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0]/n, q[1]/n, q[2]/n, q[3]/n];
}
function qApply(q, v) {
  const [x, y, z] = v;
  const [qw, qx, qy, qz] = q;
  const tx = 2*(qy*z - qz*y);
  const ty = 2*(qz*x - qx*z);
  const tz = 2*(qx*y - qy*x);
  return [
    x + qw*tx + (qy*tz - qz*ty),
    y + qw*ty + (qz*tx - qx*tz),
    z + qw*tz + (qx*ty - qy*tx),
  ];
}

// ── The component ──────────────────────────────────────────────────
function ConnectomeGraph({
  zoomProgress = 0,       // 0 = landing, 1 = focal node fills screen
  paused = false,         // freeze interactions (e.g. once timeline visible)
  onPerturbStats,         // (stats) => void — emits live activity
  focusNodeIdx = 64,      // which node to zoom into during scroll
}) {
  const mountRef = React.useRef(null);
  const threeRef = React.useRef(null);
  const stateRef = React.useRef({
    q: qIdentity(),
    rotating: false,
    lastX: 0, lastY: 0,
    velX: 0, velY: 0,
    zoom: 1.0,
    targetZoom: 1.0,
    lastInteract: performance.now(),
    coords: null,
    edges: null,
    centroid: [0, 0, 0],
    extent: 200,
    ser: [],
    serJustActivated: [],
    actBuffer: [],  // ring of recent active counts
    packets: 0,
    spikeBoost: [],  // visual brightness boost for recently spiking nodes
    pulseRings: [],  // {idx, t0} animated rings around fired nodes
    pointerDown: false,
    pointerStartX: 0, pointerStartY: 0,
    pointerMoved: false,
  });
  const [ready, setReady] = React.useState(false);

  // ── Load brain data ───────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false;
    loadBrain().then(b => {
      if (cancelled) return;
      const s = stateRef.current;
      s.coords = b.coords;
      s.edges = b.edges;
      // Compute centroid + extent
      let cx = 0, cy = 0, cz = 0;
      b.coords.forEach(c => { cx += c[0]; cy += c[1]; cz += c[2]; });
      cx /= b.coords.length; cy /= b.coords.length; cz /= b.coords.length;
      s.centroid = [cx, cy, cz];
      let maxR = 0;
      b.coords.forEach(c => {
        const dx = c[0]-cx, dy = c[1]-cy, dz = c[2]-cz;
        const r = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (r > maxR) maxR = r;
      });
      s.extent = maxR || 100;
      s.ser = new Array(b.coords.length).fill(0); // 0=S, 1=E, 2=R
      s.serJustActivated = new Array(b.coords.length).fill(0);
      s.spikeBoost = new Array(b.coords.length).fill(0);
      // Build neighbour list
      s.adj = Array.from({ length: b.coords.length }, () => []);
      for (const [i, j] of b.edges) {
        s.adj[i].push(j);
        s.adj[j].push(i);
      }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Three.js scene setup ──────────────────────────────────────
  React.useEffect(() => {
    if (!ready || !mountRef.current || !window.THREE) return;
    const container = mountRef.current;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0a0a, 1300, 2400);

    const camera = new THREE.PerspectiveCamera(
      45, container.clientWidth / container.clientHeight, 0.1, 5000
    );
    // Camera distance + fog adapt to viewport aspect so the connectome stays
    // framed in portrait. We back the camera off (and slide fog with it) when
    // the viewport gets narrower than square.
    const applyViewport = () => {
      const aspect = container.clientWidth / Math.max(1, container.clientHeight);
      const scale = aspect < 1 ? 1 / Math.max(aspect, 0.5) : 1;
      const camZ = 800 * scale;
      camera.position.z = camZ;
      const shift = camZ - 800;
      scene.fog.near = 1300 + shift;
      scene.fog.far  = 2400 + shift;
    };
    applyViewport();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Node sprite (round, soft-edge)
    const nodeGeom = new THREE.PlaneGeometry(1, 1);
    const nodeVert = `
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`;
    const nodeFrag = `
      uniform vec3 color;
      uniform float opacity;
      uniform float glow;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      void main() {
        float d = distance(vUv, vec2(0.5));
        if (d > 0.5) discard;
        float core = 1.0 - smoothstep(0.30, 0.48, d);
        float halo = (1.0 - smoothstep(0.30, 0.5, d)) * glow;
        float a = clamp(core + halo, 0.0, 1.0);
        gl_FragColor = vec4(color, a * opacity);
        #include <fog_fragment>
      }`;

    const coords = stateRef.current.coords;
    const centroid = stateRef.current.centroid;
    const sprites = coords.map(() => {
      const mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib['fog'],
          {
            color:   { value: new THREE.Color(0xffffff) },
            opacity: { value: 1.0 },
            glow:    { value: 0.0 },
          }
        ]),
        vertexShader: nodeVert,
        fragmentShader: nodeFrag,
        transparent: true,
        depthWrite: false,
        fog: true,
      });
      const m = new THREE.Mesh(nodeGeom, mat);
      m.renderOrder = 2;
      scene.add(m);
      return m;
    });

    // Edge tubes via InstancedMesh (cheap & cheerful)
    const edgeCount = stateRef.current.edges.length;
    const cylGeom = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
    cylGeom.translate(0, 0.5, 0);
    const opAttr = new THREE.InstancedBufferAttribute(
      new Float32Array(edgeCount).fill(1), 1
    );
    cylGeom.setAttribute('instanceOpacity', opAttr);

    const edgeVert = `
      attribute float instanceOpacity;
      varying float vOp;
      varying float vDepth;
      void main() {
        vOp = instanceOpacity;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vDepth = -mv.z;
      }`;
    const edgeFrag = `
      precision highp float;
      uniform vec3 color;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying float vOp;
      varying float vDepth;
      void main() {
        float fogF = smoothstep(fogNear, fogFar, vDepth);
        float a = vOp * 0.28;
        gl_FragColor = vec4(mix(color, fogColor, fogF), a);
      }`;

    const edgeMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib['fog'],
        { color: { value: new THREE.Color(0xffffff) } }
      ]),
      vertexShader: edgeVert,
      fragmentShader: edgeFrag,
      transparent: true,
      depthWrite: false,
      fog: true,
    });

    const edgeMesh = new THREE.InstancedMesh(cylGeom, edgeMat, edgeCount);
    edgeMesh.count = edgeCount;
    edgeMesh.renderOrder = 1;
    scene.add(edgeMesh);

    // Pulse-ring sprites
    const ringGeom = new THREE.PlaneGeometry(1, 1);
    const ringMat = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xF53A61) },
        opacity: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 color; uniform float opacity;
        varying vec2 vUv;
        void main() {
          float d = distance(vUv, vec2(0.5));
          float ring = smoothstep(0.42, 0.48, d) * (1.0 - smoothstep(0.48, 0.5, d));
          if (ring < 0.01) discard;
          gl_FragColor = vec4(color, ring * opacity);
        }`,
      transparent: true,
      depthWrite: false,
    });

    threeRef.current = {
      scene, camera, renderer, sprites, edgeMesh, edgeMat,
      cylGeom, opAttr, edgeCount, ringGeom, ringMat,
      ringMeshes: [],
    };

    // Resize
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      applyViewport();
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      ro.disconnect();
      try { container.removeChild(renderer.domElement); } catch (e) {}
      renderer.dispose();
    };
  }, [ready]);

  // ── Pointer events: rotate + click-to-perturb ─────────────────
  React.useEffect(() => {
    if (!ready) return;
    const el = mountRef.current;
    if (!el) return;
    const s = stateRef.current;

    const onPointerDown = (e) => {
      if (paused) return;
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      s.pointerDown = true;
      s.pointerStartX = e.clientX;
      s.pointerStartY = e.clientY;
      s.lastX = e.clientX; s.lastY = e.clientY;
      s.pointerMoved = false;
      s.rotating = true;
      s.velX = 0; s.velY = 0;
      s.lastInteract = performance.now();
    };
    const onPointerMove = (e) => {
      if (!s.pointerDown || paused) return;
      const dx = e.clientX - s.lastX;
      const dy = e.clientY - s.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) s.pointerMoved = true;
      s.lastX = e.clientX; s.lastY = e.clientY;
      const rot = 0.005;
      const dq = qMul(
        qFromAxisAngle([0, 1, 0],  dx * rot),
        qFromAxisAngle([1, 0, 0],  dy * rot)
      );
      s.q = qNormalize(qMul(dq, s.q));
      s.velX = dx * rot * 0.4;
      s.velY = dy * rot * 0.4;
      s.lastInteract = performance.now();
    };
    const onPointerUp = (e) => {
      if (!s.pointerDown) return;
      s.pointerDown = false;
      s.rotating = false;
      // Click without drag → no-op (view-only graph).
      if (!s.pointerMoved && !paused) {
        // intentionally empty — clicks no longer perturb the network.
      }
    };
    const onWheel = (e) => {
      if (paused) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      s.targetZoom = Math.max(0.5, Math.min(2.5, s.targetZoom * factor));
      s.lastInteract = performance.now();
    };
    // We don't want the wheel-zoom to block page scroll. Only zoom if pointer is OVER the canvas
    // AND user is holding shift OR ctrl. Default wheel → let page scroll.
    const onWheelGated = (e) => {
      if (paused) return;
      if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return; // let page scroll
      onWheel(e);
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheelGated, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheelGated);
    };
  }, [ready, paused]);

  // ── Helpers exposed to outside ────────────────────────────────
  React.useEffect(() => {
    window.__ohbmPerturb = () => {
      const s = stateRef.current;
      if (!s.coords) return;
      const i = Math.floor(Math.random() * s.coords.length);
      firePerturbation(s, i, performance.now());
    };
    window.__ohbmReset = () => {
      const s = stateRef.current;
      if (!s.ser) return;
      s.ser.fill(0);
      s.packets = 0;
      s.actBuffer = [];
      if (onPerturbStats) onPerturbStats({ packets: 0, history: [] });
    };
    return () => {
      delete window.__ohbmPerturb;
      delete window.__ohbmReset;
    };
  }, [onPerturbStats]);

  // ── Animation loop ────────────────────────────────────────────
  const zoomProgressRef = React.useRef(zoomProgress);
  React.useEffect(() => { zoomProgressRef.current = zoomProgress; }, [zoomProgress]);
  const focusNodeRef = React.useRef(focusNodeIdx);
  React.useEffect(() => { focusNodeRef.current = focusNodeIdx; }, [focusNodeIdx]);
  const pausedRef = React.useRef(paused);
  React.useEffect(() => { pausedRef.current = paused; }, [paused]);
  const cbRef = React.useRef(onPerturbStats);
  React.useEffect(() => { cbRef.current = onPerturbStats; }, [onPerturbStats]);

  React.useEffect(() => {
    if (!ready || !threeRef.current) return;
    const t = threeRef.current;
    const s = stateRef.current;
    let raf;
    let last = performance.now();
    let lastSER = 0;
    let lastReport = 0;

    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();

    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(50, now - last); last = now;

      // SER step every 220ms
      if (now - lastSER > 220) {
        lastSER = now;
        stepSER(s, now);
      }

      // Report stats every 80ms
      if (now - lastReport > 80) {
        lastReport = now;
        // count active
        let active = 0;
        for (let i = 0; i < s.ser.length; i++) if (s.ser[i] === 1) active++;
        s.actBuffer.push(active);
        if (s.actBuffer.length > 200) s.actBuffer.shift();
        if (cbRef.current) cbRef.current({
          packets: s.packets,
          history: s.actBuffer.slice(),
          active,
          total: s.ser.length,
        });
      }

      // Inertial rotation
      if (!s.rotating && !pausedRef.current) {
        if (Math.abs(s.velX) > 0.0001 || Math.abs(s.velY) > 0.0001) {
          const dq = qMul(
            qFromAxisAngle([0, 1, 0],  s.velX),
            qFromAxisAngle([1, 0, 0],  s.velY)
          );
          s.q = qNormalize(qMul(dq, s.q));
          s.velX *= 0.94; s.velY *= 0.94;
        } else if ((now - s.lastInteract) > 1200) {
          // Idle gentle spin
          const ang = 0.0006 * (dt / 16.67);
          const dq = qFromAxisAngle([0, 1, 0], ang);
          s.q = qNormalize(qMul(dq, s.q));
        }
      }

      // Smooth zoom
      s.zoom += (s.targetZoom - s.zoom) * 0.12;

      // Apply scroll zoom-in toward focus node
      const zp = zoomProgressRef.current;
      const focusIdx = focusNodeRef.current;
      // Compute focal world coord
      const c = s.coords[focusIdx] || [0, 0, 0];
      const fp = [c[0] - s.centroid[0], c[1] - s.centroid[1], c[2] - s.centroid[2]];
      // Scale entire model by (1 + zp * K) and translate so focal point stays at origin
      const scaleK = 1 + zp * 12.0; // dramatic blow-up
      // Effective camera zoom incorporates user zoom + scroll
      const effZoom = s.zoom * (1 + zp * 0.6);
      t.camera.fov = 45 / effZoom;
      t.camera.updateProjectionMatrix();

      // Project all nodes (rotated, scaled, translated)
      const N = s.coords.length;
      const positions = new Array(N);
      const rotFocal = qApply(s.q, fp);
      for (let i = 0; i < N; i++) {
        const cc = s.coords[i];
        const p = [cc[0] - s.centroid[0], cc[1] - s.centroid[1], cc[2] - s.centroid[2]];
        const r = qApply(s.q, p);
        // World coords: scale around centroid, then shift so focal point goes to origin during zoom
        const x = (r[0] - rotFocal[0] * zp) * scaleK;
        const y = (r[1] - rotFocal[1] * zp) * scaleK;
        const z = (r[2] - rotFocal[2] * zp) * scaleK;
        positions[i] = [x, y, z];
      }

      // Update node sprites
      for (let i = 0; i < N; i++) {
        const [x, y, z] = positions[i];
        const sp = t.sprites[i];
        sp.position.set(x, y, z);
        sp.quaternion.copy(t.camera.quaternion);
        const isFocus = (i === focusIdx);
        const baseR = isFocus ? 14 : 11;
        s.spikeBoost[i] *= 0.92;
        const ser = s.ser[i];
        const u = sp.material.uniforms;
        let activeScale = 1.0;
        if (ser === 1) { u.color.value.setHex(0xF53A61); u.glow.value = 1.0; activeScale = 1.9; }
        else if (ser === 2) { u.color.value.setHex(0xffffff); u.glow.value = 0.0; }
        else { u.color.value.setHex(isFocus ? 0xF53A61 : 0xffffff); u.glow.value = 0.0; }
        const focusGrow = isFocus ? (1 + zp * 18) : 1;
        const r = baseR * focusGrow * activeScale;
        sp.scale.set(r, r, 1);
        let op = 1.0;
        if (!isFocus) op = Math.max(0, 1 - Math.max(0, zp - 0.55) / 0.35);
        u.opacity.value = op;
      }

      // Update edges
      let ei = 0;
      const cap = t.edgeCount;
      const opArr = t.opAttr.array;
      const fadeEdges = Math.max(0, 1 - Math.max(0, zp - 0.4) / 0.45);
      for (let k = 0; k < s.edges.length && ei < cap; k++) {
        const [a, b, w] = s.edges[k];
        const pa = positions[a], pb = positions[b];
        const dx = pb[0]-pa[0], dy = pb[1]-pa[1], dz = pb[2]-pa[2];
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 0.001) continue;
        dummy.position.set(pa[0], pa[1], pa[2]);
        dir.set(dx/dist, dy/dist, dz/dist);
        dummy.quaternion.setFromUnitVectors(up, dir);
        const thick = 0.8 + Math.min(1.2, w / 5000);
        dummy.scale.set(thick, dist, thick);
        dummy.updateMatrix();
        t.edgeMesh.setMatrixAt(ei, dummy.matrix);
        opArr[ei] = fadeEdges;
        ei++;
      }
      t.edgeMesh.count = ei;
      t.edgeMesh.instanceMatrix.needsUpdate = true;
      t.opAttr.needsUpdate = true;

      t.renderer.render(t.scene, t.camera);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute', inset: 0,
        cursor: paused ? 'default' : 'grab',
        // pan-y lets vertical swipes scroll the page on touch devices while
        // still routing horizontal swipes to pointermove for rotation.
        touchAction: 'pan-y',
      }}
    />
  );
}

// ── SER perturbation model (no node-wobble) ────────────────────────
function firePerturbation(s, idx, now) {
  if (!s.ser) return;
  s.ser[idx] = 1; // Excited
  s.serJustActivated[idx] = now;
  s.spikeBoost[idx] = 1.2;
  s.packets += 1;
}
function stepSER(s, now) {
  const ser = s.ser;
  if (!ser.length) return;
  const next = ser.slice();
  // Capture E mask first (so propagation uses previous tick)
  const wasE = new Array(ser.length);
  for (let i = 0; i < ser.length; i++) wasE[i] = ser[i] === 1;
  for (let i = 0; i < ser.length; i++) {
    if (ser[i] === 1) {
      next[i] = 2; // E → R
    } else if (ser[i] === 2) {
      if (Math.random() < 0.35) next[i] = 0; // R → S
    } else {
      // S: get excited if a neighbour was E (probability per neighbour)
      const adj = s.adj[i] || [];
      let pHit = 0;
      for (const j of adj) if (wasE[j]) pHit += 0.18;
      if (pHit > 0 && Math.random() < Math.min(0.85, pHit)) {
        next[i] = 1;
        s.serJustActivated[i] = now;
        s.spikeBoost[i] = 1.2;
        s.packets += 1;
      }
    }
  }
  s.ser = next;
}

// ── Helper: project to screen pixels (uses three's camera projection) ─
function projectAll(s, camera, w, h) {
  const out = [];
  const focusIdx = (window.__ohbmFocusIdx ?? 64);
  const N = s.coords.length;
  const zp = 0; // for click hit-testing on the landing only
  const c = s.coords[focusIdx] || [0,0,0];
  const fp = [c[0]-s.centroid[0], c[1]-s.centroid[1], c[2]-s.centroid[2]];
  const rotFocal = qApply(s.q, fp);
  for (let i = 0; i < N; i++) {
    const cc = s.coords[i];
    const p = [cc[0]-s.centroid[0], cc[1]-s.centroid[1], cc[2]-s.centroid[2]];
    const r = qApply(s.q, p);
    const v = new THREE.Vector3(r[0], r[1], r[2]);
    v.project(camera);
    out.push({ x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h });
  }
  return out;
}

window.ConnectomeGraph = ConnectomeGraph;
