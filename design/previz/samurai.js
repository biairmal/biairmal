// Armoured samurai for the storyboard previz: the three.js "Xbot" mannequin as a rigged body,
// dressed in procedural armour (dō, kusazuri, sode, kote, menpō, kasa) and pleated hakama.
// The character root faces +X; its right side is +Z.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function makeMaterials(seamColor = 0xeaf2ff) {
  const noiseTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const img = x.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 60; img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = 255; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t;
  })();
  const weave = (() => { // straw weave for the kasa
    const c = document.createElement('canvas'); c.width = 512; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#7d7d7d'; x.fillRect(0, 0, 512, 64);
    for (let i = 0; i < 512; i += 4) { x.fillStyle = `rgba(${i % 8 ? 200 : 40},${i % 8 ? 200 : 40},${i % 8 ? 200 : 40},.35)`; x.fillRect(i, 0, 2, 64); }
    for (let j = 0; j < 64; j += 8) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, j, 512, 1); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
  })();
  const ito = (() => { // diamond wrap of the tsuka
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#d8d4cc'; x.fillRect(0, 0, 64, 256);
    x.fillStyle = '#0c0c0c';
    for (let y = 0; y < 256; y += 32) { x.beginPath(); x.moveTo(32, y + 4); x.lineTo(54, y + 16); x.lineTo(32, y + 28); x.lineTo(10, y + 16); x.closePath(); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const laced = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#0b0b0c'; x.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 512; i += 12) {
      const g = x.createLinearGradient(i, 0, i + 8, 0);
      g.addColorStop(0, '#6f6c66'); g.addColorStop(0.5, '#e4e0d8'); g.addColorStop(1, '#6f6c66');
      x.fillStyle = g; x.fillRect(i + 2, 22, 8, 74);
      x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(i + 2, 46, 8, 3); x.fillRect(i + 2, 72, 8, 3);
    }
    x.fillStyle = '#1d1d20'; x.fillRect(0, 100, 512, 22);
    x.fillStyle = '#4a4a50'; x.fillRect(0, 120, 512, 3);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  const lacedMat = (rep) => { const t = laced.clone(); t.repeat.set(rep, 1); t.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.3, bumpMap: t, bumpScale: 1.2, envMapIntensity: 0.55 }); };
  return {
    lacedMat, laced: lacedMat(1),
    lacquer: new THREE.MeshPhysicalMaterial({ color: 0x141416, roughness: 0.4, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.28, envMapIntensity: 0.55 }),
    lacquerEdge: new THREE.MeshPhysicalMaterial({ color: 0x18181a, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.2 }),
    silk: new THREE.MeshStandardMaterial({ color: 0xd8d5ce, roughness: 0.65, envMapIntensity: 0.4 }),
    fabric: new THREE.MeshPhysicalMaterial({ color: 0x121214, roughness: 0.95, sheen: 0.6, sheenColor: new THREE.Color(0x40424a), sheenRoughness: 0.6, normalMap: noiseTex, normalScale: new THREE.Vector2(0.25, 0.25), envMapIntensity: 0.25 }),
    fabricGrey: new THREE.MeshPhysicalMaterial({ color: 0x2a2a2e, roughness: 0.9, sheen: 0.5, sheenColor: new THREE.Color(0x60626a), envMapIntensity: 0.25 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x1e1e20, roughness: 0.42, metalness: 0.9, envMapIntensity: 1.1 }),
    steel: new THREE.MeshPhysicalMaterial({ color: 0xe6e8ec, roughness: 0.12, metalness: 1, envMapIntensity: 2.0, clearcoat: 0.3 }),
    straw: new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.9, map: weave, bumpMap: weave, bumpScale: 2, envMapIntensity: 0.2 }),
    ito: new THREE.MeshStandardMaterial({ map: ito, roughness: 0.8, bumpMap: ito, bumpScale: 1.5 }),
    seam: new THREE.MeshBasicMaterial({ color: seamColor, transparent: true, opacity: 0.85, toneMapped: false }),
    seamSoft: new THREE.MeshBasicMaterial({ color: seamColor, transparent: true, opacity: 0.35, toneMapped: false }),
    void: new THREE.MeshBasicMaterial({ color: 0x000000 }),
  };
}

// ---------- geometry helpers
function bandGeo(r0, r1, h, a0, a1, seg = 48) { // open band (part of a cone) from angle a0..a1, x = forward
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, true, a0, a1 - a0);
  return g;
}
// curved lamellar plate: width w (arc), height h, bend radius R, slight outward flare at the bottom
function plateGeo(w, h, R, flare = 0.15, segW = 16) {
  const g = new THREE.BoxGeometry(w, h, 0.008, segW, 2, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = x / R; const rr = R + z + (0.5 - y / h) * flare * h;
    p.setXYZ(i, Math.sin(a) * rr, y, Math.cos(a) * rr - R);
  }
  g.computeVertexNormals();
  return g;
}
// a column of lames with white lacing between them, hanging downward from (0,0,0), facing +Z
function lamellar(M, { w, rows, lameH = 0.062, overlap = 0.012, R = 0.5, flare = 0.25, lace = true, seam = true }) {
  const g = new THREE.Group();
  const pg = plateGeo(w, lameH, R, flare);
  const laceGeo = new THREE.BoxGeometry(0.0035, overlap + 0.012, 0.002);
  const nLace = Math.max(4, Math.round(w / 0.011));
  const laceMesh = null; lace = false;
  let k = 0;
  const mtx = new THREE.Matrix4();
  for (let r = 0; r < rows; r++) {
    const y = -r * (lameH - overlap) - lameH / 2;
    const out = r * 0.006 * flare * 4;
    const lame = new THREE.Mesh(pg, M.laced);
    lame.position.set(0, y, out); lame.castShadow = true; g.add(lame);
    if (lace) for (let i = 0; i < nLace; i++) {
      const x = (i / (nLace - 1) - 0.5) * (w - 0.02);
      const a = x / R;
      mtx.makeRotationY(a).setPosition(Math.sin(a) * (R + 0.005), y + lameH / 2 - overlap / 2, Math.cos(a) * (R + 0.005) - R + out);
      laceMesh.setMatrixAt(k++, mtx);
    }
    if (seam && r === rows - 1) {
      const s = new THREE.Mesh(plateGeo(w, 0.0025, R, 0, 16), M.seamSoft); s.position.set(0, y - lameH / 2, out + 0.006); g.add(s);
    }
  }
  if (laceMesh) { laceMesh.count = k; g.add(laceMesh); }
  return g;
}

// pleated flared tube along -Y (for hakama legs)
function pleatedTube(r0, r1, len, pleats = 9, depth = 0.018, seg = 72) {
  const g = new THREE.CylinderGeometry(r0, r1, len, seg, 8, true);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x); const t = (len / 2 - y) / len; // 0 top → 1 bottom
    const k = 1 + (Math.abs(Math.sin(a * pleats)) - 0.5) * depth * (0.4 + t) / Math.max(0.05, Math.hypot(x, z)) ;
    p.setXYZ(i, x * k, y - len / 2, z * k);
  }
  g.computeVertexNormals();
  return g;
}

export function katana(M, { saya = false } = {}) {
  const g = new THREE.Group();
  const L = 0.72, w = 0.031, N = 50;
  const cx = (t) => -0.032 * t * t;
  const s = new THREE.Shape();
  s.moveTo(cx(0) + w / 2, 0);
  for (let i = 1; i <= N; i++) { const t = i / N * 0.93; s.lineTo(cx(t) + w / 2 * (1 - 0.28 * t), t * L); }
  s.quadraticCurveTo(cx(0.985) + w * 0.3, L * 0.985, cx(1) - w * 0.32, L);
  for (let i = N; i >= 0; i--) { const t = i / N * 0.97; s.lineTo(cx(t) - w / 2 * (1 - 0.28 * t), t * L); }
  const bg = new THREE.ExtrudeGeometry(s, { depth: 0.0035, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.004, bevelSegments: 2, curveSegments: 6 });
  bg.translate(0, 0, -0.00175);
  const blade = new THREE.Mesh(bg, M.steel); blade.castShadow = true; g.add(blade);
  const pts = []; for (let i = 0; i <= 40; i++) { const t = 0.03 + i / 40 * 0.9; pts.push(V(cx(t) + w / 2 * (1 - 0.28 * t) + 0.002, t * L, 0)); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.0011, 4), M.seam));
  const habaki = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.03, 0.014), M.iron); habaki.position.y = 0.02; g.add(habaki);
  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.007, 8), M.iron); tsuba.scale.set(1.1, 1, 1); g.add(tsuba);
  const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0155, 0.27, 16), M.ito); tsuka.position.y = -0.14; tsuka.scale.set(1, 1, 0.8); g.add(tsuka);
  M.ito.map.repeat.set(1, 1);
  const kashira = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.016, 0.018, 16), M.iron); kashira.position.y = -0.284; g.add(kashira);
  if (saya) {
    const sg = new THREE.Group();
    const sb = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.016, 0.76, 16), M.lacquer); sb.position.y = 0.38; sb.scale.set(1.3, 1, 0.75); sb.castShadow = true; sg.add(sb);
    const koi = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0022, 6, 24), M.seam); koi.rotation.x = Math.PI / 2; koi.scale.set(1.25, 0.75, 1); sg.add(koi);
    const kuri = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.003, 6, 12), M.silk); kuri.position.set(-0.024, 0.09, 0); sg.add(kuri);
    g.userData.saya = sg;
  }
  return g;
}

// orient obj so local +Y → Y and local +X → X, positioned at origin (world space)
export function place(obj, origin, Y, X) {
  Y = Y.clone().normalize(); X = X.clone().sub(Y.clone().multiplyScalar(X.dot(Y))).normalize();
  const Z = X.clone().cross(Y);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  obj.position.copy(origin);
}

// ---------- the character
export function buildSamurai(gltf, M) {
  const root = new THREE.Group();
  const body = gltf.scene; // Xbot faces +Z
  body.rotation.y = Math.PI / 2;
  root.add(body);
  body.traverse((o) => {
    if (o.isSkinnedMesh) { o.material = o.name.includes('Joints') || o.material.name.includes('Joints') ? M.fabric : M.fabric; o.castShadow = true; o.frustumCulled = false; }
  });
  const bone = {};
  body.traverse((o) => { if (o.isBone) bone[o.name.replace('mixamorig:', '').replace('mixamorig', '')] = o; });
  // base pose: first frame of "idle"
  const mixer = new THREE.AnimationMixer(body);
  const idle = gltf.animations.find((a) => a.name === 'idle');
  mixer.clipAction(idle).play(); mixer.setTime(0.4);
  root.updateMatrixWorld(true);
  bone.Head.scale.setScalar(0.62); root.updateMatrixWorld(true);
  const rest = {}; for (const k in bone) rest[k] = bone[k].quaternion.clone();
  const S = { root, body, bone, mixer, rest, M, parts: {}, hipsPos: bone.Hips.position.clone() };
  dress(S);
  return S;
}

function wp(b) { b.updateWorldMatrix(true, false); return b.getWorldPosition(V()); }

function dress(S) {
  const { bone: B, M, root } = S;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const P = (b) => wp(B[b]).applyMatrix4(inv); // root-space position
  const hips = P('Hips'), sp1 = P('Spine1'), sp2 = P('Spine2'), neck = P('Neck'), head = P('Head');
  const shL = P('LeftArm'), shR = P('RightArm');
  const add = (boneName, obj) => { root.add(obj); obj.updateMatrixWorld(true); B[boneName].attach(obj); return obj; };

  // ---- hakama: one pleated flared tube per leg
  for (const side of ['Left', 'Right']) {
    const up = P(side + 'UpLeg'), ank = P(side + 'Foot');
    const len = up.y - 0.02 + 0.06;
    const tube = new THREE.Mesh(pleatedTube(0.13, 0.25, len, 8, 0.03), M.fabric);
    tube.castShadow = true; tube.material.side = THREE.DoubleSide;
    tube.position.set(up.x + 0.01, up.y + 0.06, up.z * 1.15);
    add(side + 'UpLeg', tube);
    const pleatSeam = new THREE.Mesh(new THREE.BoxGeometry(0.002, len * 0.92, 0.002), M.seamSoft);
    pleatSeam.position.set(up.x + 0.2, up.y + 0.06 - len * 0.5, up.z * 1.15); pleatSeam.rotation.z = -0.1;
    add(side + 'UpLeg', pleatSeam);
  }
  // obi / waist wrap
  const obi = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.165, 0.13, 40, 1, false), M.fabricGrey);
  obi.scale.set(0.82, 1, 1.05); obi.position.copy(hips).add(V(0, 0.1, 0)); add('Hips', obi);

  // ---- kusazuri: six lamellar panels around the hips
  const kus = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const panel = lamellar(M, { w: 0.17, rows: 4, R: 0.4, flare: 0.5 });
    const r = 0.2;
    panel.position.set(Math.cos(a) * r * 0.85, 0, Math.sin(a) * r);
    panel.rotation.y = Math.PI / 2 - a;
    panel.rotation.x = 0.0;
    kus.add(panel);
  }
  kus.position.copy(hips).add(V(0, 0.04, 0)); add('Hips', kus);

  // ---- dō: horizontal lames around the torso, from the waist to the chest
  const dou = new THREE.Group();
  const rows = 6;
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const y = hips.y + 0.13 + t * (sp2.y - hips.y - 0.02);
    const rad = 0.2 + 0.055 * Math.sin(t * Math.PI * 0.85);
    const ring = new THREE.Mesh(bandGeo(rad + 0.012, rad, 0.072, -Math.PI * 0.92, Math.PI * 0.92), M.doMat || (M.doMat = M.lacedMat(5)));
    ring.position.y = y; ring.scale.set(0.78, 1, 1); ring.rotation.y = Math.PI / 2; ring.castShadow = true; dou.add(ring);
  }
  // muna-ita: chest plate at the top, with a seam edge
  const muna = new THREE.Mesh(plateGeo(0.26, 0.09, 0.22, -0.1), M.lacquerEdge); muna.position.set(0.17, sp2.y + 0.08, 0); muna.rotation.y = Math.PI / 2; dou.add(muna);
  const munaSeam = new THREE.Mesh(plateGeo(0.26, 0.002, 0.22, 0), M.seam); munaSeam.position.set(0.176, sp2.y + 0.125, 0); munaSeam.rotation.y = Math.PI / 2; dou.add(munaSeam);
  add('Spine1', dou);
  // collar of the kimono under the armour
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.025, 8, 24), M.fabricGrey); collar.position.copy(neck).add(V(0.0, -0.03, 0)); collar.rotation.x = Math.PI / 2; collar.scale.set(1.1, 1, 1); add('Spine2', collar);

  // ---- sode: large shoulder guards
  for (const [side, sh, sgn] of [['Left', shL, -1], ['Right', shR, 1]]) {
    const sode = lamellar(M, { w: 0.24, rows: 6, R: 0.32, flare: 0.3 });
    sode.position.set(sh.x - 0.0, sh.y + 0.07, sh.z + sgn * 0.075);
    sode.rotation.set(0, sgn > 0 ? 0 : Math.PI, sgn * -0.22);
    add(side + 'Shoulder', sode);
    // kote plates on the forearm
    const fa = P(side + 'ForeArm'), hd = P(side + 'Hand');
    const kote = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, fa.distanceTo(hd) * 0.8, 16, 1, true, 0, Math.PI * 1.1), M.lacquer);
    kote.position.copy(fa.clone().lerp(hd, 0.5));
    kote.quaternion.setFromUnitVectors(V(0, 1, 0), hd.clone().sub(fa).normalize());
    kote.rotateY(Math.PI * 0.9 * sgn);
    add(side + 'ForeArm', kote);
  }

  // ---- head: hood, menpō, throat guard, kasa
  const hg = new THREE.Group();
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.095, 32, 24), M.fabric); hood.scale.set(1.0, 1.18, 0.98); hood.position.set(-0.01, 0.085, 0); hg.add(hood);
  // menpō: lower-face mask
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.1, 48, 32, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.42, Math.PI * 0.42), M.lacquer);
  mask.scale.set(1.3, 1.3, 1.12); mask.position.set(0.02, 0.078, 0); mask.rotation.y = Math.PI / 2; mask.castShadow = true; hg.add(mask);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 16), M.lacquer); nose.position.set(0.142, 0.088, 0); nose.rotation.z = -0.25 - Math.PI; nose.scale.set(1, 1, 0.8); hg.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.006, 0.05), M.void); mouth.position.set(0.137, 0.045, 0); hg.add(mouth);
  const mouthSeam = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.0015, 0.056), M.seam); mouthSeam.position.set(0.14, 0.04, 0); hg.add(mouthSeam);
  for (const z of [-1, 1]) { // cheek ridges
    const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.004, 6, 24, Math.PI * 0.5), M.lacquerEdge);
    ridge.position.set(0.07, 0.06, 0.035 * z); ridge.rotation.set(0, z * 0.6, Math.PI * 1.05); hg.add(ridge);
  }
  for (const z of [-1, 1]) { const eye = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.003, 0.02), M.seam); eye.position.set(0.112, 0.122, 0.034 * z); eye.rotation.x = z * 0.15; hg.add(eye); }
  // yodare-kake: three lames under the chin
  const yk = lamellar(M, { w: 0.2, rows: 3, R: 0.1, flare: 0.6, lameH: 0.045, overlap: 0.01 });
  yk.position.set(0.04, 0.02, 0); yk.rotation.y = Math.PI / 2; hg.add(yk);
  // kasa
  const kasa = new THREE.Group();
  const prof = []; for (let i = 0; i <= 24; i++) { const t = i / 24; prof.push(new THREE.Vector2(0.002 + t * 0.44, 0.15 * (1 - t) - 0.03 * t * t)); }
  const kg = new THREE.LatheGeometry(prof, 96);
  const kasaMesh = new THREE.Mesh(kg, M.straw); kasaMesh.material.side = THREE.DoubleSide; kasaMesh.castShadow = true; kasa.add(kasaMesh);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.442, 0.0028, 6, 128), M.seam); rim.rotation.x = Math.PI / 2; rim.position.y = -0.03; kasa.add(rim);
  const rimDark = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.004, 6, 96), M.fabric); rimDark.rotation.x = Math.PI / 2; rimDark.position.y = -0.026; kasa.add(rimDark);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), M.iron); top.position.y = 0.152; kasa.add(top);
  for (const z of [-1, 1]) { // chin cords
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.2, 6), M.silk); cord.position.set(0.02, 0.0, 0.095 * z); cord.rotation.x = -z * 0.25; hg.add(cord);
  }
  kasa.position.y = 0.19; kasa.rotation.z = -0.1; hg.add(kasa);
  S.parts.kasa = kasa;
  hg.position.copy(head);
  add('Head', hg);
  S.parts.head = hg;

  // ---- sword and saya (not attached to bones: placed per pose)
  const sw = katana(M, { saya: true });
  root.add(sw); root.add(sw.userData.saya);
  S.parts.sword = sw; S.parts.saya = sw.userData.saya;
}

// ---------- posing
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
function aim(b, child, target) {
  b.updateWorldMatrix(true, true);
  const bp = wp(b), cp = wp(child);
  const cur = cp.sub(bp).normalize(), want = target.clone().sub(bp).normalize();
  _q.setFromUnitVectors(cur, want);
  const wq = b.getWorldQuaternion(new THREE.Quaternion());
  const nq = _q.multiply(wq);
  const pq = b.parent.getWorldQuaternion(_q2).invert();
  b.quaternion.copy(pq.multiply(nq));
  b.updateWorldMatrix(false, true);
}
function twoBone(a, b, c, target, pole) {
  const pa = wp(a), l1 = pa.distanceTo(wp(b)), l2 = wp(b).distanceTo(wp(c));
  const d = target.clone().sub(pa); let len = Math.min(d.length(), l1 + l2 - 1e-3); const dir = d.normalize();
  const x = (l1 * l1 - l2 * l2 + len * len) / (2 * len), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const p = pole.clone().sub(pa); p.sub(dir.clone().multiplyScalar(p.dot(dir))).normalize();
  const elbow = pa.clone().add(dir.clone().multiplyScalar(x)).add(p.multiplyScalar(h));
  aim(a, b, elbow); aim(b, c, target);
}
// pose spec (root space): lean, twist, drop, hands {R,L}, poles, feet, headTilt, sword: {grip, dir, edge} | 'sheathed'
export function pose(S, spec) {
  const { bone: B, root, rest } = S;
  for (const k in rest) B[k].quaternion.copy(rest[k]);
  B.Hips.position.copy(S.hipsPos);
  const T = (v) => v.clone().applyMatrix4(root.matrixWorld);
  root.updateMatrixWorld(true);
  const sp = Object.assign({ lean: 0.04, twist: 0, drop: 0, headTilt: 0, headTurn: 0, sword: 'sheathed', draw: 0, kasaTilt: -0.1 }, spec);
  B.Hips.position.y -= sp.drop * 100; // armature is in cm
  // lean forward (+X) by rotating the spine about root Z
  const leanAxis = V(0, 0, 1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
  for (const n of ['Spine', 'Spine1', 'Spine2']) {
    const b = B[n]; b.updateWorldMatrix(true, false);
    const wq = b.getWorldQuaternion(new THREE.Quaternion());
    const r = new THREE.Quaternion().setFromAxisAngle(leanAxis, -sp.lean / 3);
    const tw = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), sp.twist / 3);
    const nq = tw.multiply(r).multiply(wq);
    b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(nq));
    b.updateWorldMatrix(false, true);
  }
  // legs
  if (sp.feet) {
    for (const [side, f] of [['Right', sp.feet.R], ['Left', sp.feet.L]]) {
      if (!f) continue;
      twoBone(B[side + 'UpLeg'], B[side + 'Leg'], B[side + 'Foot'], T(f), T(f.clone().add(V(0.6, 0.5, 0))));
    }
  }
  // head
  {
    const b = B.Head; const wq = b.getWorldQuaternion(new THREE.Quaternion());
    const r = new THREE.Quaternion().setFromAxisAngle(leanAxis, sp.headTilt).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), sp.headTurn));
    b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(r.multiply(wq)));
    b.updateWorldMatrix(false, true);
  }
  S.parts.kasa.rotation.z = sp.kasaTilt;
  // saya at the left hip, mouth forward
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const hipsR = wp(B.Hips).applyMatrix4(inv);
  const sayaDir = V(-0.93, -0.33, -0.12).normalize();
  const mouth = hipsR.clone().add(V(0.15, 0.06, -0.19));
  place(S.parts.saya, mouth, sayaDir, V(0, 1, 0));
  // sword
  let hR, hL;
  if (sp.sword === 'sheathed' || sp.sword === 'koiguchi') {
    const out = sp.sword === 'koiguchi' ? 0.2 : 0;
    const ts = mouth.clone().sub(sayaDir.clone().multiplyScalar(0.012 + out));
    place(S.parts.sword, ts, sayaDir, V(0, 1, 0));
    hR = ts.clone().sub(sayaDir.clone().multiplyScalar(0.07));
    hL = mouth.clone().add(sayaDir.clone().multiplyScalar(0.05)).add(V(0, 0.02, -0.02));
    if (sp.restHand) hR = hipsR.clone().add(V(0.02, -0.05, 0.3));
  } else {
    const D = sp.sword.dir.clone().normalize();
    place(S.parts.sword, sp.sword.grip.clone().add(D.clone().multiplyScalar(0.07)), D, sp.sword.edge);
    hR = sp.sword.grip.clone();
    hL = sp.handL || mouth.clone().add(sayaDir.clone().multiplyScalar(0.12));
  }
  twoBone(B.RightArm, B.RightForeArm, B.RightHand, T(hR), T(sp.poleR || V(-0.3, 0.8, 0.9)));
  twoBone(B.LeftArm, B.LeftForeArm, B.LeftHand, T(hL), T(sp.poleL || V(-0.3, 0.8, -0.9)));
  // curl fingers into a grip
  for (const side of ['Left', 'Right']) for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) for (const j of [1, 2, 3]) {
    const b = B[`${side}Hand${f}${j}`]; if (b) b.rotateX(1.1);
  }
  root.updateMatrixWorld(true);
}
