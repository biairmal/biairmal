// Previz for the biairmal v4 storyboard: one 3D world, one camera setup per shot.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1600, H = 900;
const shot = (location.hash || '#s01').slice(1);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
document.getElementById('stage').prepend(renderer.domElement);

const scene = new THREE.Scene();
const BLOOD = ['s08b', 's09'].includes(shot);
const ECLIPSE = shot === 's08a';
const skyTop = BLOOD ? 0x120404 : 0x05060a, skyBot = BLOOD ? 0x1a0606 : 0x0b0c10;
scene.fog = new THREE.FogExp2(BLOOD ? 0x140505 : 0x07080b, 0.022);

// ---------- sky dome
{
  const g = new THREE.SphereGeometry(900, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(skyTop) }, bot: { value: new THREE.Color(skyBot) } },
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 p; uniform vec3 top; uniform vec3 bot;
      float h(vec3 q){ return fract(sin(dot(q, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ vec3 n = normalize(p); float t = smoothstep(-0.05, 0.6, n.y);
        vec3 c = mix(bot, top, t);
        vec3 q = floor(n*420.); float s = step(0.9975, h(q)) * smoothstep(0.05, 0.4, n.y);
        gl_FragColor = vec4(c + s*0.35, 1.); }`,
  });
  scene.add(new THREE.Mesh(g, m));
}

// ---------- moon
const MOON_POS = V(66, 38, -170);
const moonMat = new THREE.ShaderMaterial({
  fog: false,
  uniforms: { L: { value: V(0, 0, 1) }, col: { value: new THREE.Color(BLOOD ? 0xd2453a : 0xefe9de) }, glow: { value: BLOOD ? 0.25 : 0.0 } },
  vertexShader: 'varying vec3 n; varying vec3 p; void main(){ n = normalize(mat3(modelMatrix)*normal); p = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `varying vec3 n; varying vec3 p; uniform vec3 L; uniform vec3 col; uniform float glow;
    float hash(vec3 q){ return fract(sin(dot(q, vec3(127.1,311.7,74.7)))*43758.5453); }
    float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
    void main(){
      vec3 q = normalize(p)*3.;
      float m = noise(q)*.5 + noise(q*2.3)*.3 + noise(q*6.1)*.2;
      float maria = smoothstep(.45,.7, noise(q*.8+3.));
      float d = smoothstep(-0.06, 0.18, dot(n, normalize(L)));
      vec3 c = col * (0.78 + 0.22*m) * (1. - .28*maria);
      gl_FragColor = vec4(c*(d*1.05 + 0.035) + col*glow*0.35, 1.);
    }`,
});
const moon = new THREE.Mesh(new THREE.SphereGeometry(30, 96, 48), moonMat);
moon.position.copy(MOON_POS);
scene.add(moon);

function glowTex(r, g, b) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.25, `rgba(${r},${g},${b},.35)`);
  gr.addColorStop(0.6, `rgba(${r},${g},${b},.08)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: BLOOD ? glowTex(220, 60, 50) : glowTex(235, 230, 220), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: BLOOD ? 0.7 : 0.4 }));
halo.scale.setScalar(BLOOD ? 230 : 190);
halo.position.copy(MOON_POS);
scene.add(halo);

// ---------- environment map (for metal)
{
  const pm = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: BLOOD ? 0x180606 : 0x0d0e12, side: THREE.BackSide })));
  const spot = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 8), new THREE.MeshBasicMaterial({ color: BLOOD ? 0xff6050 : 0xffffff }));
  spot.position.copy(MOON_POS).normalize().multiplyScalar(40); es.add(spot);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(80, 4), new THREE.MeshBasicMaterial({ color: 0x777777, side: THREE.DoubleSide }));
  strip.position.set(0, 18, 20); strip.lookAt(0, 0, 0); es.add(strip);
  scene.environment = pm.fromScene(es, 0.02).texture;
}

// ---------- lights
const moonCol = BLOOD ? 0xff5040 : 0xdfe6ff;
const key = new THREE.DirectionalLight(moonCol, BLOOD ? 3.2 : 2.6);
key.position.copy(MOON_POS).normalize().multiplyScalar(50);
scene.add(key);
const fill = new THREE.DirectionalLight(BLOOD ? 0x552222 : 0x8090b0, 0.35);
fill.position.set(-10, 6, 30); scene.add(fill);
scene.add(new THREE.HemisphereLight(BLOOD ? 0x401010 : 0x202634, 0x000000, 0.6));

// ---------- water
const water = new Reflector(new THREE.PlaneGeometry(1200, 1200), { textureWidth: 1024, textureHeight: 576, color: BLOOD ? 0x6a3a38 : 0x5a5f68, clipBias: 0.003 });
water.rotation.x = -Math.PI / 2;
scene.add(water);
// dark veil over the mirror so it reads as black water, with faint ripple rings
{
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { c: { value: new THREE.Color(BLOOD ? 0x0c0303 : 0x040507) } },
    vertexShader: 'varying vec3 wp; void main(){ wp = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(wp,1.); }',
    fragmentShader: `varying vec3 wp; uniform vec3 c;
      void main(){ float d = length(wp.xz - vec2(2.,0.));
        float ring = smoothstep(.06,0.,abs(fract(d*.55)-.5)-.44) * exp(-d*.12) * .35;
        float a = mix(.5, .9, smoothstep(10., 120., length(wp.xz)));
        gl_FragColor = vec4(c + ring*.04, a - ring*.25); }`,
  });
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), m);
  veil.rotation.x = -Math.PI / 2; veil.position.y = 0.005; scene.add(veil);
}

// ---------- materials
const std = (color, rough = 0.85, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: 0.35, ...extra });
const M = {
  kimono: std(0x2c2c33, 0.9), hakama: std(0x17171c, 0.92), kata: std(0x0e0e11, 0.6, 0.1),
  straw: std(0x4a4234, 0.95), skin: std(0x5e4e42, 0.8), obi: std(0x3a3a40, 0.7),
  lacquer: std(0x050506, 0.22, 0.2, { envMapIntensity: 1.2 }), tsuka: std(0x1b1b1f, 0.8),
  steel: std(0xe4e6ea, 0.14, 1, { envMapIntensity: 1.8 }), iron: std(0x2a2a2e, 0.45, 0.9, { envMapIntensity: 1.0 }),
  stone: std(0x1c1c1e, 0.95), stoneDark: std(0x161618, 0.9), wood: std(0x1c1814, 0.85),
  seam: new THREE.MeshBasicMaterial({ color: BLOOD ? 0xff5a4a : 0xeaf2ff, fog: false }),
  red: new THREE.MeshBasicMaterial({ color: 0xc4453f }),
};

function bone(a, b, r1, r2, mat, seg = 12) {
  const d = b.clone().sub(a), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, seg), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return m;
}
function ik(sh, hand, pole, l1, l2) {
  const d = hand.clone().sub(sh); let len = d.length();
  len = Math.min(len, l1 + l2 - 1e-3);
  const dir = d.normalize();
  const a = (l1 * l1 - l2 * l2 + len * len) / (2 * len), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const p = pole.clone().sub(sh); p.sub(dir.clone().multiplyScalar(p.dot(dir))).normalize();
  const elbow = sh.clone().add(dir.clone().multiplyScalar(a)).add(p.multiplyScalar(h));
  const hnd = sh.clone().add(dir.clone().multiplyScalar(len));
  return [elbow, hnd];
}

// katana: tsuba at origin, blade along +Y, edge toward +X
function katana({ trail = false } = {}) {
  const g = new THREE.Group();
  const L = 0.72, w = 0.032, N = 40;
  const s = new THREE.Shape();
  const cx = (t) => -0.035 * t * t;
  s.moveTo(cx(0) + w / 2, 0);
  for (let i = 1; i <= N; i++) { const t = i / N * 0.92; s.lineTo(cx(t) + w / 2 * (1 - 0.3 * t), t * L); }
  s.lineTo(cx(1) - w * 0.25, L);
  for (let i = N; i >= 0; i--) { const t = i / N * 0.95; s.lineTo(cx(t) - w / 2 * (1 - 0.3 * t), t * L); }
  const bg = new THREE.ExtrudeGeometry(s, { depth: 0.007, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
  bg.translate(0, 0, -0.0035);
  g.add(new THREE.Mesh(bg, M.steel));
  // hamon glint line along the edge
  const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30 * 0.93; pts.push(V(cx(t) + w / 2 * (1 - 0.3 * t) - 0.001, t * L, 0)); }
  const edge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0016, 4), M.seam);
  edge.material = M.seam.clone(); edge.material.transparent = true; edge.material.opacity = 0.85;
  g.add(edge);
  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.009, 24), M.iron); g.add(tsuba);
  const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.016, 0.27, 12), M.tsuka); tsuka.position.y = -0.14; g.add(tsuka);
  // diamond wrap highlights on the tsuka
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.0172, 0.0018, 4, 16), M.obi); r.rotation.x = Math.PI / 2; r.position.y = -0.03 - i * 0.04; g.add(r); }
  const kashira = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.015, 12), M.iron); kashira.position.y = -0.28; g.add(kashira);
  g.userData.bladeLen = L;
  return g;
}
function place(obj, origin, Y, X) {
  Y = Y.clone().normalize(); X = X.clone().sub(Y.clone().multiplyScalar(X.dot(Y))).normalize();
  const Z = X.clone().cross(Y);
  obj.matrixAutoUpdate = true;
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  obj.position.copy(origin);
}

// ---------- samurai: faces +X, right side = +Z
function samurai(pose) {
  const root = new THREE.Group();
  const P = Object.assign({ lean: 0.05, twist: 0, headTilt: 0, front: V(0.24, 0, 0.13), back: V(-0.3, 0, -0.1), drop: 0, sword: 'sheathed', draw: 0, hatTilt: -0.12 }, pose);
  const hipY = 0.98 - P.drop;
  // legs / hakama
  const hips = [V(0.04, hipY, 0.09), V(-0.04, hipY, -0.09)];
  const feet = [P.front, P.back];
  for (let i = 0; i < 2; i++) {
    const f = feet[i].clone(); f.y = 0.02;
    root.add(bone(hips[i], f, 0.15, 0.27, M.hakama, 18));
    // seam light down the pleat
    const s = bone(hips[i].clone().add(V(0.14, -0.05, 0)), f.clone().add(V(0.26, 0.02, 0)), 0.003, 0.003, M.seam, 4);
    s.material = M.seam.clone(); s.material.transparent = true; s.material.opacity = 0.35; root.add(s);
  }
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.3, 0.5, 20, 1, true), M.hakama);
  skirt.position.y = hipY - 0.22; skirt.material.side = THREE.DoubleSide; root.add(skirt);

  // upper body pivots at the hips
  const chest = new THREE.Group(); chest.position.y = hipY; root.add(chest);
  chest.rotation.set(0, P.twist, -P.lean);
  const yo = -0.98;
  const lp = [V(0.15, 0.98 + yo, 0), V(0.18, 1.15 + yo, 0), V(0.21, 1.38 + yo, 0), V(0.12, 1.5 + yo, 0), V(0.06, 1.54 + yo, 0)];
  const torso = new THREE.Mesh(new THREE.LatheGeometry(lp.map((p) => new THREE.Vector2(p.x, p.y)), 24), M.kimono);
  torso.scale.set(0.85, 1, 1.05); chest.add(torso);
  const obi = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.1, 24), M.obi); obi.position.y = 0.99 + yo; obi.scale.set(0.9, 1, 1.05); chest.add(obi);
  // kataginu: stiff shoulder wings — the silhouette
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.86), M.kata); wing.position.y = 1.47 + yo; chest.add(wing);
  const wl = new THREE.Mesh(new THREE.BoxGeometry(0.202, 0.004, 0.862), M.seam); wl.position.y = 1.484 + yo; wl.material = M.seam.clone(); wl.material.transparent = true; wl.material.opacity = 0.55; chest.add(wl);
  for (const z of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.42, 0.13), M.kata); panel.position.set(0.16, 1.25 + yo, 0.08 * z); panel.rotation.x = 0.12 * z; chest.add(panel);
  }
  // neck, head, kasa
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 12), M.skin); neck.position.y = 1.56 + yo; chest.add(neck);
  const headG = new THREE.Group(); headG.position.y = 1.62 + yo; headG.rotation.z = P.headTilt; chest.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), M.skin); head.scale.set(1, 1.15, 0.9); head.position.y = 0.04; headG.add(head);
  const kasa = new THREE.Group(); kasa.position.y = 0.14; kasa.rotation.z = P.hatTilt; headG.add(kasa);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.43, 0.17, 40, 1, true), M.straw); cone.material.side = THREE.DoubleSide; kasa.add(cone);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.0035, 6, 64), M.seam); rim.rotation.x = Math.PI / 2; rim.position.y = -0.085; kasa.add(rim);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), M.seam); knob.position.y = 0.085; kasa.add(knob);

  root.updateMatrixWorld(true);
  const toRoot = (v) => v.clone().applyMatrix4(chest.matrix);
  const shR = toRoot(V(0.0, 1.43 + yo, 0.2)), shL = toRoot(V(0.0, 1.43 + yo, -0.2));

  // saya at the left hip
  const S = V(-0.93, -0.36, -0.06).normalize();
  const mouth = V(0.14, hipY + 0.02, -0.17);
  const saya = bone(mouth, mouth.clone().add(S.clone().multiplyScalar(0.8)), 0.022, 0.018, M.lacquer, 10);
  root.add(saya);
  const koi = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 6, 16), M.seam); koi.position.copy(mouth); koi.quaternion.setFromUnitVectors(V(0, 0, 1), S); root.add(koi);

  // sword + hands
  const sw = katana(); root.add(sw);
  let hR, hL, poleR = V(0.1, 1.0, 0.9), poleL = V(0.1, 1.0, -0.9);
  if (P.sword === 'sheathed' || P.sword === 'koiguchi' || P.sword === 'rest') {
    const out = P.sword === 'koiguchi' ? 0.2 : 0.0;
    const ts = mouth.clone().sub(S.clone().multiplyScalar(0.015 + out));
    place(sw, ts, S, V(0, 1, 0));
    const grip = ts.clone().sub(S.clone().multiplyScalar(0.09));
    hR = P.sword === 'rest' ? V(0.05, hipY - 0.28, 0.27) : grip.clone().add(V(0, 0.015, 0.02));
    hL = mouth.clone().add(S.clone().multiplyScalar(0.06)).add(V(0.01, 0.0, -0.01));
    if (P.sword === 'rest') poleR = V(-0.4, 1.0, 0.6);
  } else { // drawn: blade raised after the rising cut
    const grip = P.grip || V(0.62, 1.52, 0.12);
    const D = (P.bladeDir || V(0.55, 0.8, 0.12)).clone().normalize();
    place(sw, grip.clone().add(D.clone().multiplyScalar(0.08)), D, P.edge || V(0.3, -0.2, 1));
    hR = grip.clone();
    hL = P.handL || mouth.clone().add(S.clone().multiplyScalar(0.08)).add(V(-0.04, 0, 0));
  }
  for (const [sh, hand, pole] of [[shR, hR, poleR], [shL, hL, poleL]]) {
    const [el, hp] = ik(sh, hand, pole, 0.3, 0.29);
    root.add(bone(sh, el, 0.052, 0.046, M.kimono));
    root.add(bone(el, hp, 0.042, 0.034, M.kimono));
    // wide sleeve hanging from the upper arm
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.06), M.kimono);
    sleeve.position.copy(sh.clone().lerp(el, 0.55)).add(V(0, -0.12, 0));
    sleeve.lookAt(sleeve.position.clone().add(el.clone().sub(sh).setY(0).normalize().applyAxisAngle(V(0, 1, 0), Math.PI / 2)));
    root.add(sleeve);
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), M.skin); hm.position.copy(hp); root.add(hm);
  }
  root.userData.sword = sw;
  return root;
}

// ---------- world set pieces
const world = new THREE.Group(); scene.add(world);
// hero platform: a low stone slab at the water's edge
{
  const slab = new THREE.Mesh(new THREE.BoxGeometry(5, 0.35, 3.2), M.stone); slab.position.set(2, 0.175, 0); world.add(slab);
  const slab2 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.22, 2.4), M.stoneDark); slab2.position.set(-1.4, 0.11, 1.2); slab2.rotation.y = 0.2; world.add(slab2);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(5.01, 0.004, 0.004), M.seam); edge.position.set(2, 0.352, 1.6); edge.material = M.seam.clone(); edge.material.transparent = true; edge.material.opacity = 0.25; world.add(edge);
}
function kanjiTex(ch, color = '#f2efe8', size = 1024, weight = 600) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `${weight} ${size * 0.8}px "Noto Serif JP"`;
  x.shadowColor = color; x.shadowBlur = size * 0.02;
  x.fillText(ch, size / 2, size * 0.53);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// monolith with a carved, lit kanji
function monolith(ch, pos, rotY, h = 5.2, lit = 1, parent = world) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, h, 0.7), M.stoneDark); m.position.y = h / 2; g.add(m);
  const k = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), new THREE.MeshBasicMaterial({ map: kanjiTex(ch, BLOOD ? '#ff7060' : '#f5f1ea'), transparent: true, opacity: lit, fog: false, blending: THREE.AdditiveBlending, depthWrite: false }));
  k.position.set(0, h * 0.6, 0.352); g.add(k);
  for (const y of [0.002, h]) { const e = new THREE.Mesh(new THREE.BoxGeometry(2.402, 0.006, 0.702), M.seam); e.position.y = y; e.material = M.seam.clone(); e.material.transparent = true; e.material.opacity = 0.4; g.add(e); }
  g.position.copy(pos); g.rotation.y = rotY; parent.add(g);
  return g;
}
const SETS = {};
SETS.ren = monolith('人', V(-14, 0, -22), 0.5);
// path of the 道: a walkway over the water with four stone lanterns
const lanterns = [];
SETS.path = new THREE.Group(); world.add(SETS.path);
{
  const world = SETS.path;
  for (let i = 0; i < 70; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.32), M.wood); p.position.set(-4, 0.32, -30 - i * 0.36); world.add(p);
  }
  for (let i = 0; i < 9; i++) for (const x of [-0.9, 0.9]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), M.wood); post.position.set(-4 + x, 0.3, -30 - i * 3); world.add(post);
  }
  const guide = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 25), M.seam); guide.position.set(-4, 0.365, -42.5); guide.material = M.seam.clone(); guide.material.transparent = true; guide.material.opacity = 0.5; world.add(guide);
  [[-2.4, -34], [-5.6, -40], [-2.4, -46], [-5.6, -52]].forEach(([x, z], i) => {
    const g = new THREE.Group();
    const parts = [
      [new THREE.CylinderGeometry(0.34, 0.4, 0.18, 6), 0.09], [new THREE.CylinderGeometry(0.1, 0.12, 0.9, 8), 0.63],
      [new THREE.CylinderGeometry(0.34, 0.26, 0.14, 6), 1.15], [new THREE.BoxGeometry(0.42, 0.36, 0.42), 1.4],
      [new THREE.ConeGeometry(0.55, 0.32, 6), 1.74], [new THREE.SphereGeometry(0.07, 10, 8), 1.95],
    ];
    parts.forEach(([geo, y]) => { const m = new THREE.Mesh(geo, M.stone); m.position.y = y; g.add(m); });
    const lit = (shot === 's05' && i < 2);
    const fire = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: lit ? 0xfff0d8 : 0x1a1a1a })); fire.position.y = 1.42; g.add(fire);
    const fire2 = fire.clone(); fire2.rotation.y = Math.PI / 2; g.add(fire2);
    if (lit) { const pl = new THREE.PointLight(0xffe2b8, 4, 9, 1.6); pl.position.y = 1.42; g.add(pl); }
    g.position.set(x, 0.36, z); world.add(g); lanterns.push(g);
  });
  monolith('道', V(-4, 0, -64), 0, 6.5, 0.9, world);
}
// katana rack (katanakake) on a low plinth
let rackSwords = [];
SETS.rack = new THREE.Group(); world.add(SETS.rack);
{
  const world = SETS.rack;
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 1.2), std(0x0c0c0d, 0.95)); plinth.position.y = 0.35; g.add(plinth);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.34), std(0x060607, 0.6)); base.position.y = 0.73; g.add(base);
  for (const x of [-0.5, 0.5]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.26), std(0x0a0a0b, 0.5, 0, { envMapIntensity: 0.8 })); arm.position.set(x, 1.08, 0); g.add(arm);
  }
  for (let i = 0; i < 4; i++) {
    const y = 0.98 + i * 0.16;
    const drawn = shot === 's06' && i === 3 ? 0.42 : (shot === 's06' && i === 2 ? 0.06 : 0);
    const saya = bone(V(-0.78, y, 0.16), V(0.62, y + 0.02, 0.16), 0.021, 0.019, M.lacquer, 10); g.add(saya);
    const sw = katana(); place(sw, V(-0.78 - drawn, y, 0.16), V(1, 0.015, 0), V(0, 1, 0)); g.add(sw);
    const num = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 6, 16), i === 3 && shot === 's06' ? M.red : M.seam); num.position.set(-0.78, y, 0.16); num.rotation.y = Math.PI / 2; g.add(num);
    rackSwords.push(sw);
  }
  g.position.set(14, 0, -40); g.rotation.y = -0.3; world.add(g); SETS.rackG = g;
  
}
// tsuba ring: four iron sword guards floating in orbit
const tsubas = new THREE.Group();
SETS.tsuba = new THREE.Group(); world.add(SETS.tsuba);
{
  const world = SETS.tsuba;
  function tsubaGeo() {
    const s = new THREE.Shape(); const N = 64;
    for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2; const r = 0.5 * (1 + 0.06 * Math.cos(4 * a)); const p = [Math.cos(a) * r * 0.92, Math.sin(a) * r]; i ? s.lineTo(...p) : s.moveTo(...p); }
    const hole = (cx, cy, rx, ry) => { const h = new THREE.Path(); h.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, true); s.holes.push(h); };
    hole(0, 0, 0.06, 0.16); hole(-0.24, 0, 0.06, 0.1); hole(0.24, 0, 0.06, 0.1);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.4; hole(Math.cos(a) * 0.36, Math.sin(a) * 0.38, 0.025, 0.025); }
    return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
  }
  const tg = tsubaGeo();
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + 0.5;
    const t = new THREE.Mesh(tg, M.iron); t.scale.setScalar(1.4);
    t.position.set(Math.cos(a) * 2.6, Math.sin(i * 1.7) * 0.3, Math.sin(a) * 2.6);
    t.rotation.set(0.3 * Math.sin(i), a + 0.9, 0.2 * Math.cos(i * 2));
    tsubas.add(t);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.003, 6, 96), M.seam); ring.position.copy(t.position); ring.rotation.copy(t.rotation); ring.material = M.seam.clone(); ring.material.transparent = true; ring.material.opacity = i === 0 ? 0.9 : 0.25; tsubas.add(ring);
  }
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.004, 6, 160), M.seam); orbit.rotation.x = Math.PI / 2; orbit.material = M.seam.clone(); orbit.material.transparent = true; orbit.material.opacity = 0.3; tsubas.add(orbit);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), M.steel); tsubas.add(core);
  tsubas.position.set(30, 7, -64); tsubas.rotation.set(0.25, 0, 0.08); world.add(tsubas);
  
}

const SHOW = { s00: [], s01: [], s02a: [], s02b: [], s03: [], s04: ['ren'], s05: ['path'], s06: ['rack'], s07: ['tsuba'], s08a: [], s08b: [], s09: [], map: ['ren', 'path', 'rack', 'tsuba'] }[shot] || [];
for (const k of ['ren', 'path', 'rack', 'tsuba']) SETS[k].visible = SHOW.includes(k);
// ---------- shots
const cam = new THREE.PerspectiveCamera(35, W / H, 0.05, 2000);
const mm = (f) => 2 * Math.atan(12 / f) * 180 / Math.PI; // vertical FOV from a 35mm-equivalent focal length
let ui = '';
let hero = null;
let phase = 0; // moon light angle from the camera direction, degrees: 0 full, 180 new
const setCam = (p, t, f, roll = 0) => { cam.position.copy(p); cam.fov = mm(f); cam.lookAt(t); cam.rotateZ(roll); cam.updateProjectionMatrix(); };

const NAV = `<div class="nav"><span style="display:flex;gap:14px;align-items:center"><span class="jp" style="font-size:22px;font-weight:600">侍</span><span style="opacity:.2">|</span><span class="mono" style="font-size:18px">biairmal<span style="display:inline-block;width:8px;height:18px;background:#ededed;margin-left:3px;vertical-align:-3px"></span></span></span><span style="display:flex;gap:36px;align-items:center;color:#c8c8c8">Home<span>Contacts</span><span>Blogs</span><span style="border:1px solid #444;padding:14px 22px;color:#ededed">Let's talk</span></span></div>`;

switch (shot) {
  case 's00': { // blade macro
    world.visible = false;
    const sw = katana(); place(sw, V(-0.25, 6, 3.5), V(1, 0.04, 0), V(0, 1, 0)); scene.add(sw);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(0.003, 0.034), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    band.position.set(0.2, 6.02, 3.51); band.rotation.z = -0.5; scene.add(band);
    const bandG = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.07), new THREE.MeshBasicMaterial({ map: glowTex(255, 255, 255), transparent: true, blending: THREE.AdditiveBlending, fog: false, depthWrite: false }));
    bandG.position.set(0.2, 6.02, 3.512); bandG.rotation.z = -0.5; scene.add(bandG);
    moon.visible = halo.visible = false; scene.fog = null;
    setCam(V(0.05, 6.07, 4.05), V(0.1, 6.01, 3.5), 55, -0.35);
    const kl = new THREE.PointLight(0xffffff, 3, 2, 1); kl.position.set(0.2, 6.2, 3.7); scene.add(kl);
    phase = 30;
    ui = `<div style="position:absolute;left:50%;top:70%;transform:translateX(-50%);text-align:center" class="mono"><div style="font-size:13px;letter-spacing:.3em;color:#8b8b8b">064 / 100 · SHARPENING</div></div>
      <div class="jp" style="position:absolute;left:50%;top:22%;transform:translateX(-50%);font-size:30px;font-weight:600">侍</div>`;
    break;
  }
  case 's01': {
    hero = samurai({}); hero.position.set(2.6, 0.35, 0); hero.rotation.y = 0.25; world.add(hero);
    setCam(V(-0.6, 1.05, 8.6), V(2.0, 2.7, 0), 35);
    phase = 8;
    ui = NAV + `<div style="position:absolute;left:160px;top:250px;width:640px">
      <div class="lbl"><span style="width:7px;height:7px;background:#c4453f"></span>Available for freelance work</div>
      <div style="font-size:72px;font-weight:500;letter-spacing:-.045em;line-height:1.04;margin:30px 0 26px">Every line of code,<br>a deliberate cut.</div>
      <div class="muted" style="font-size:18px;line-height:1.65;max-width:480px">I'm Bandana, a software engineer who owns the whole path — from the first plan to a stable production release.</div>
      <div style="display:flex;gap:12px;margin-top:34px"><span class="btn" style="background:#ededed;color:#0a0a0a">Start a project →</span><span class="btn" style="border:1px solid #555">See recent work</span></div></div>
      <div style="position:absolute;right:56px;top:260px;writing-mode:vertical-rl;display:flex;gap:16px;align-items:center"><span class="jp muted" style="letter-spacing:.6em;font-size:16px">一刀両断</span><span class="mono" style="font-size:10px;letter-spacing:.2em;color:#777">ONE STROKE, DECISIVE</span></div>
      <div style="position:absolute;left:50%;bottom:34px;transform:translateX(-50%);text-align:center" class="mono"><div style="font-size:10px;letter-spacing:.2em;color:#888">SCROLL TO DRAW</div></div>`;
    break;
  }
  case 's02a': {
    hero = samurai({ sword: 'koiguchi', lean: 0.12, drop: 0.04, headTilt: -0.12, hatTilt: -0.25 }); hero.position.set(2.6, 0.35, 0); hero.rotation.y = 0.25; world.add(hero);
    hero.updateMatrixWorld(true);
    setCam(V(1.75, 0.62, 2.7), V(2.75, 1.75, 0), 45, 0.05);
    phase = 8;
    ui = `<div class="mono" style="position:absolute;left:60px;bottom:50px;font-size:12px;letter-spacing:.2em;color:#8b8b8b">KOIGUCHI O KIRU · THE THUMB BREAKS THE SEAL</div>`;
    break;
  }
  case 's02b': {
    hero = samurai({ sword: 'drawn', lean: 0.2, drop: 0.12, front: V(0.62, 0, 0.16), back: V(-0.42, 0, -0.12), headTilt: -0.05, hatTilt: -0.2,
      grip: V(0.72, 1.36, 0.16), bladeDir: V(0.65, 0.72, 0.18), edge: V(0.3, -0.3, 1) });
    hero.position.set(2.6, 0.35, 0); hero.rotation.y = 0.25; world.add(hero); hero.updateMatrixWorld(true);
    // light trail of the rising cut
    const pts = [V(-0.55, 0.62, -0.2), V(0.1, 0.5, 0.3), V(0.75, 0.75, 0.45), V(1.15, 1.35, 0.4), V(1.2, 1.95, 0.32)].map((p) => p.applyMatrix4(hero.matrixWorld));
    const curve = new THREE.CatmullRomCurve3(pts);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.006, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.05, 8), new THREE.MeshBasicMaterial({ color: 0xbfd2ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    setCam(V(0.3, 1.3, 5.6), V(2.8, 1.75, 0), 40, 0.07);
    phase = 8;
    ui = 'SLICE';
    break;
  }
  case 's03': {
    hero = samurai({ sword: 'sheathed', lean: 0.04 }); hero.position.set(2.6, 0.35, 0); hero.rotation.y = 0.25; world.add(hero);
    setCam(V(-3, 6.5, 8), V(14, 8.5, -40), 18, -0.02);
    phase = 128;
    ui = `<div class="mono" style="position:absolute;left:60px;bottom:50px;font-size:12px;letter-spacing:.2em;color:#8b8b8b">CRANE UP · THE MOON WANES AS YOU RISE</div>`;
    break;
  }
  case 's04': {
    hero = samurai({ sword: 'sheathed', lean: 0.02, front: V(0.32, 0, 0.12), back: V(-0.32, 0, -0.1) }); hero.position.set(-12, 0, -19.5); hero.rotation.y = 2.24; world.add(hero);
    setCam(V(-4.5, 1.6, -11.5), V(-17.7, 3.2, -18.7), 32);
    phase = 135;
    ui = NAV + `<div style="position:absolute;left:160px;top:230px;width:640px">
      <div class="lbl"><span class="k">人</span>About</div>
      <div style="font-size:54px;font-weight:500;letter-spacing:-.04em;line-height:1.08;margin:22px 0 30px">Backend by trade,<br>full-stack when it counts.</div>
      <div class="muted" style="font-size:17px;line-height:1.65;max-width:520px">I'm Bandana Irmal Abdillah, a software engineer based in Jakarta, Indonesia, with 4+ years of experience building digital products.</div>
      <div style="margin-top:34px;width:460px;border-bottom:1px solid #2a2a2a">${[['Based in', 'Jakarta · UTC+7'], ['Experience', '4+ years, since 2022'], ['Focus', 'Backend, full-stack']].map(([k, v]) => `<div style="display:flex;justify-content:space-between;border-top:1px solid #2a2a2a;padding:16px 0"><span class="mono" style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.06em">${k}</span><span>${v}</span></div>`).join('')}</div></div>`;
    break;
  }
  case 's05': {
    hero = samurai({ sword: 'sheathed', lean: 0.06, front: V(0.35, 0, 0.1), back: V(-0.3, 0, -0.1) }); hero.position.set(-4, 0.36, -43); hero.rotation.y = Math.PI / 2; world.add(hero);
    setCam(V(-4.6, 1.5, -30.5), V(-3.9, 1.3, -50), 30);
    phase = 140;
    ui = NAV + `<div style="position:absolute;left:160px;top:150px"><div class="lbl"><span class="k">道</span>Approach</div>
      <div style="font-size:46px;font-weight:500;letter-spacing:-.04em;line-height:1.08;margin-top:20px">One clean path<br>from plan to production.</div></div>
      <div style="position:absolute;left:420px;top:600px;width:260px"><div class="mono" style="font-size:12px;color:#888">01</div><div style="font-size:26px;font-weight:500;margin:10px 0">Plan</div><div class="muted" style="font-size:15px;line-height:1.6">Requirements, architecture and risks mapped before any code.</div></div>
      <div style="position:absolute;right:420px;top:450px;width:220px;opacity:.85"><div class="mono" style="font-size:12px;color:#888">02</div><div style="font-size:22px;font-weight:500;margin:8px 0">Build</div></div>
      <div style="position:absolute;left:160px;right:160px;bottom:56px;height:1px;background:#2a2a2a"><div style="width:30%;height:1px;background:#ededed"></div></div>
      <div class="mono" style="position:absolute;right:160px;bottom:70px;font-size:11px;color:#888;letter-spacing:.1em">01 / 04</div>`;
    break;
  }
  case 's06': {
    SETS.rackG.updateMatrixWorld(true);
    const mw = SETS.rackG.matrixWorld;
    setCam(V(-0.2, 1.4, 2.2).applyMatrix4(mw), V(-1.05, 1.2, 0).applyMatrix4(mw), 35, 0);
    moon.visible = halo.visible = false;
    phase = 145;
    ui = NAV + `<div style="position:absolute;left:160px;top:150px"><div class="lbl"><span class="k">戦</span>Recent work</div>
      <div style="font-size:46px;font-weight:500;letter-spacing:-.04em;margin-top:20px">Shipped in production.</div></div>
      <div style="position:absolute;left:160px;top:330px;width:560px">${['Mobile banking backend rewrite', 'Event-driven data sync', 'Standing order platform', 'Official travel order system'].map((t, i) => `<div style="display:flex;gap:26px;align-items:baseline;border-top:1px solid #2a2a2a;padding:22px 0;${i === 0 ? '' : 'opacity:.55'}"><span class="mono" style="font-size:13px;color:${i === 0 ? '#c4453f' : '#888'}">0${i + 1}</span><span style="font-size:${i === 0 ? 28 : 22}px;font-weight:500;letter-spacing:-.02em">${t}${i === 0 ? '<div class=mono style="font-size:11px;color:#888;letter-spacing:.1em;margin-top:18px">THE RESULT</div><div style="font-size:19px;margin-top:6px">~7.6k lines of Go · 80–90% less code</div>' : ''}</span></div>`).join('')}
      <div style="border-top:1px solid #2a2a2a"></div></div>`;
    break;
  }
  case 's07': {
    setCam(V(31.5, 4.2, -56.5), V(29.2, 6.7, -64), 30);
    moon.visible = halo.visible = false;
    phase = 150;
    ui = NAV + `<div style="position:absolute;left:160px;top:150px"><div class="lbl"><span class="k">武</span>Toolkit</div>
      <div style="font-size:46px;font-weight:500;letter-spacing:-.04em;margin-top:20px">Tools I trust in production.</div></div>
      <div style="position:absolute;left:160px;right:160px;bottom:70px;display:grid;grid-template-columns:repeat(4,1fr);gap:40px">${[['Backend', '.NET Core · Spring Boot · Go · Node.js'], ['Frontend', 'React · Next.js · Blazor · Tailwind'], ['Database', 'PostgreSQL · SQL Server · Oracle · Cosmos · Redis'], ['DevOps & cloud', 'Docker · CI/CD · Azure · AWS']].map(([k, v], i) => `<div style="${i ? 'opacity:.5' : ''}"><div class="mono" style="font-size:12px;color:${i ? '#888' : '#ededed'};text-transform:uppercase;letter-spacing:.06em;border-top:1px solid ${i ? '#333' : '#ededed'};padding-top:14px">${k}</div><div style="font-size:16px;margin-top:10px;line-height:1.6">${v}</div></div>`).join('')}</div>`;
    break;
  }
  case 's08a': {
    hero = samurai({ sword: 'sheathed' }); hero.position.set(2.6, 0.35, 0); hero.rotation.y = 0.25; world.add(hero);
    setCam(V(-1, 3, 14), MOON_POS.clone().add(V(0, -6, 0)), 70);
    phase = 180;
    // corona: a thin bright ring hugging the dark disc
    const cor = new THREE.Mesh(new THREE.RingGeometry(30.2, 31.6, 128), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false, blending: THREE.AdditiveBlending }));
    cor.position.copy(MOON_POS); cor.lookAt(cam.position); scene.add(cor);
    halo.material.opacity = 0.35; halo.scale.setScalar(120);
    // diamond-ring flare at the last point of light
    const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(255, 255, 255), blending: THREE.AdditiveBlending, transparent: true, fog: false, depthWrite: false }));
    const dir = cam.position.clone().sub(MOON_POS).normalize();
    const side = V(-0.6, 0.8, 0).sub(dir.clone().multiplyScalar(dir.dot(V(-0.6, 0.8, 0)))).normalize();
    flare.position.copy(MOON_POS).add(side.multiplyScalar(30.6)).add(dir.multiplyScalar(2)); flare.scale.setScalar(26); scene.add(flare);
    ui = `<div class="mono" style="position:absolute;left:60px;bottom:50px;font-size:12px;letter-spacing:.2em;color:#8b8b8b">蝕 · TOTALITY · THE WORLD HOLDS ITS BREATH</div>`;
    break;
  }
  case 's08b': {
    hero = samurai({ sword: 'sheathed' }); hero.position.set(2.6, 0.35, 0); hero.rotation.y = 0.25; world.add(hero);
    setCam(V(-1, 3, 14), MOON_POS.clone().add(V(0, -12, 0)), 55);
    phase = 0;
    ui = `<div class="mono" style="position:absolute;left:60px;bottom:50px;font-size:12px;letter-spacing:.2em;color:#a07070">BLOOD MOON · THE GRADE TURNS RED</div>`;
    break;
  }
  case 's09': {
    hero = samurai({ sword: 'rest', lean: 0.0, front: V(0.18, 0, 0.18), back: V(-0.18, 0, -0.16), hatTilt: -0.05 });
    hero.position.set(1.1, 0.35, 0.2); hero.rotation.y = -1.94; world.add(hero); hero.updateMatrixWorld(true);
    setCam(V(-2.5, 1.35, 9.5), V(-2.33, 2.05, -0.5), 24);
    phase = 0;
    // god rays from the moon toward the viewer
    for (let i = 0; i < 7; i++) {
      const end = V(-6 + i * 3.2, -2 + (i % 3), 12);
      const r = bone(MOON_POS, end, 7, 0.4 + (i % 2) * 0.6, new THREE.MeshBasicMaterial({ color: 0xff4030, transparent: true, opacity: 0.028, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }), 16);
      scene.add(r);
    }
    ui = NAV + `<div style="position:absolute;left:160px;top:200px;width:900px">
      <div class="lbl"><span class="k">連</span>Contact</div>
      <div style="font-size:96px;font-weight:500;letter-spacing:-.055em;line-height:1;margin:26px 0 34px">Have something<br>that needs to ship?</div>
      <div class="muted" style="font-size:17px;line-height:1.65;max-width:500px">Tell me what you're building — or just say hello.</div>
      <div style="margin-top:40px;font-size:36px;font-weight:500;letter-spacing:-.03em;display:inline-block;border-bottom:1px solid #555;padding-bottom:8px">bandanairmal@gmail.com ↗</div></div>`;
    break;
  }
  case 'map': {
    hero = samurai({}); hero.position.set(2.6, 0.35, 0); world.add(hero);
    scene.fog = null;
    const o = new THREE.OrthographicCamera(-48, 48, 27, -27, 0.1, 1000);
    o.position.set(9, 200, -34); o.up.set(0, 0, -1); o.lookAt(9, 0, -34);
    window.__ortho = o;
    phase = 0;
    break;
  }
}

// moon phase: light direction relative to the camera → moon direction
{
  const toCam = cam.position.clone().sub(MOON_POS).normalize();
  const side = V(-1, 0.25, 0).sub(toCam.clone().multiplyScalar(toCam.dot(V(-1, 0.25, 0)))).normalize();
  const a = phase * Math.PI / 180;
  moonMat.uniforms.L.value = toCam.multiplyScalar(Math.cos(a)).add(side.multiplyScalar(Math.sin(a)));
  if (ECLIPSE) { moonMat.uniforms.L.value = V(0, 0, 0).sub(cam.position.clone().sub(MOON_POS).normalize()); }
}

// ---------- post
const activeCam = window.__ortho || cam;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, activeCam));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), shot === 's00' ? 0.5 : 0.45, 0.6, 0.85));
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, red: { value: BLOOD ? 1 : 0 }, seed: { value: 3.7 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float red; uniform float seed; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))+seed)*43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      float v = smoothstep(1.05, .35, length(vUv-.5)*1.25);
      c.rgb *= mix(.55, 1., v);
      c.rgb += (h(vUv*vec2(1600.,900.)) - .5) * .045;
      c.rgb = mix(c.rgb, c.rgb*vec3(1.15,.82,.8), red*.5);
      gl_FragColor = c; }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

await document.fonts.load('600 100px "Noto Serif JP"', '侍人道戦武連蝕一刀両断');
await document.fonts.load('500 40px Geist'); await document.fonts.load('400 12px "Geist Mono"');
// redraw kanji textures now the font is ready
rebuildKanji();
function rebuildKanji() {
  const chars = [['人', V(-14, 0, -22)], ['道', V(-4, 0, -64)], ['戦', V(16.5, 0, -44.5)], ['武', V(30, 0, -71)]];
  world.traverse((g) => {
    if (!g.isGroup) return;
    const hit = chars.find(([, p]) => g.position.distanceTo(p) < 0.01);
    if (!hit) return;
    g.children.forEach((c) => { if (c.isMesh && c.geometry.type === 'PlaneGeometry') { c.material.map = kanjiTex(hit[0], BLOOD ? '#ff7060' : '#f5f1ea'); c.material.needsUpdate = true; } });
  });
}

composer.render();

// ---------- overlays
const uiEl = document.getElementById('ui');
if (ui === 'SLICE') {
  // the page itself is cut along the blade's diagonal: two halves of the frame, offset
  const url = renderer.domElement.toDataURL('image/png');
  const top = 'polygon(0 0,100% 0,100% 18%,0 74%)', bot = 'polygon(0 74%,100% 18%,100% 100%,0 100%)';
  uiEl.innerHTML = `<div style="position:absolute;inset:0;background:#000"></div>
    <img src="${url}" style="position:absolute;inset:0;clip-path:${top};transform:translate(-14px,-10px)">
    <img src="${url}" style="position:absolute;inset:0;clip-path:${bot};transform:translate(14px,10px);filter:brightness(.8)">
    <svg width="1600" height="900" style="position:absolute;inset:0"><line x1="-20" y1="${900 * 0.74 + 4}" x2="1620" y2="${900 * 0.18 - 4}" stroke="#fff" stroke-width="2.5"/>
    <line x1="-20" y1="${900 * 0.74 + 4}" x2="1620" y2="${900 * 0.18 - 4}" stroke="#fff" stroke-opacity=".18" stroke-width="14"/>
    <line x1="-20" y1="${900 * 0.74 + 7}" x2="1620" y2="${900 * 0.18 - 1}" stroke="#ff4a3a" stroke-opacity=".75" stroke-width="1.2"/>
    <line x1="-20" y1="${900 * 0.74 + 1}" x2="1620" y2="${900 * 0.18 - 7}" stroke="#4ad0ff" stroke-opacity=".6" stroke-width="1.2"/></svg>
    <div class="mono" style="position:absolute;left:60px;bottom:50px;font-size:12px;letter-spacing:.2em;color:#9b9b9b">TIME ×0.25 · THE PAGE IS CUT ALONG THE BLADE</div>`;
} else if (shot === 'map') {
  // camera positions per shot, projected onto the top-down view
  const marks = [['01', V(-0.6, 0, 8.6), V(2.0, 0, 0)], ['02', V(0.3, 0, 5.6), V(2.8, 0, 0)], ['03', V(-3.5, 0, 9), V(10, 0, -60)], ['04', V(-4.5, 0, -11.5), V(-13.2, 0, -21.5)], ['05', V(-4.6, 0, -30.5), V(-3.9, 0, -50)], ['06', V(12.1, 0, -37.4), V(14.3, 0, -40.6)], ['07', V(31.5, 0, -56.5), V(30, 0, -64)], ['08', V(-1, 0, 14), V(18, 0, -170)], ['09', V(-2.5, 0, 9.5), V(3.5, 0, 0)]];
  const proj = (v) => { const p = v.clone().project(window.__ortho); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]; };
  const path = marks.map(([, p]) => proj(p));
  let svg = `<svg width="1600" height="900" style="position:absolute;inset:0"><polyline points="${path.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#c4453f" stroke-width="1.5" stroke-dasharray="6 6"/>`;
  marks.forEach(([n, p, t]) => {
    const [x, y] = proj(p), d = t.clone().sub(p).normalize();
    const a = Math.atan2(-d.z, d.x);
    const s = 34, w = 0.36;
    svg += `<path d="M${x} ${y} L${x + Math.cos(a - w) * s} ${y - Math.sin(a - w) * s} L${x + Math.cos(a + w) * s} ${y - Math.sin(a + w) * s} Z" fill="#ededed" fill-opacity=".14" stroke="#ededed" stroke-opacity=".6"/>
      <circle cx="${x}" cy="${y}" r="13" fill="#0a0a0a" stroke="#ededed"/><text x="${x}" y="${y + 4}" fill="#ededed" font-family="Geist Mono" font-size="11" text-anchor="middle">${n}</text>`;
  });
  const lab = [['STONE SLAB · HERO', V(2, 0, 2.6)], ['人 MONOLITH', V(-14, 0, -19.5)], ['道 WALKWAY + LANTERNS', V(-0.5, 0, -45)], ['戦 SWORD RACK', V(14, 0, -36.8)], ['武 TSUBA RING', V(30, 0, -60)], ['→ MOON (170 m)', V(17, 0, -58)]];
  lab.forEach(([t, p]) => { const [x, y] = proj(p); svg += `<text x="${x}" y="${y}" fill="#8b8b8b" font-family="Geist Mono" font-size="12" letter-spacing="1.5" text-anchor="middle">${t}</text>`; });
  svg += `</svg><div class="mono" style="position:absolute;left:40px;top:34px;font-size:12px;letter-spacing:.2em;color:#8b8b8b">WORLD PLAN · TOP VIEW · ONE CONTINUOUS SET</div>`;
  uiEl.innerHTML = svg;
} else {
  uiEl.innerHTML = ui;
}
window.__ready = true;
