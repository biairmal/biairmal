// Storyboard v5 previz: "The House on the Water". One connected world: shore gate → lantern
// causeway → a house standing on the lake → its hall, sword alcove and polishing bench → the
// whole world from above. The samurai stands in one place in the hall for the entire film.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1600, H = 900;
const shot = (location.hash || '#v01').slice(1);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
let seed = 11; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
document.getElementById('stage').prepend(renderer.domElement);

const scene = new THREE.Scene();
const dustScene = new THREE.Scene();
const FOG = new THREE.Color(0x0a0c11);
scene.fog = new THREE.FogExp2(FOG, 0.018);

// ---------------- palette: cool moon, warm lamps, black timber, white paper
const WARM = new THREE.Color(0xffc985), PAPER = new THREE.Color(0xffe2b4), MOONC = new THREE.Color(0xd6e0ff), SEAM = 0xeaf2ff;
function glowTex(r, g, b, soft = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.2 * soft, `rgba(${r},${g},${b},.35)`);
  gr.addColorStop(0.55, `rgba(${r},${g},${b},.07)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
}
const WARM_GLOW = glowTex(255, 200, 140), COOL_GLOW = glowTex(225, 230, 240);

// ---------------- sky + moon (behind the house, seen from the shore)
{
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x04050a) }, hor: { value: new THREE.Color(0x141822) } },
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 p; uniform vec3 top; uniform vec3 hor;
      float h(vec3 q){ return fract(sin(dot(q, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ vec3 n = normalize(p); float t = smoothstep(-0.02, 0.45, n.y); vec3 c = mix(hor, top, t);
        vec3 q = floor(n*520.); float s = step(0.998, h(q)) * smoothstep(0.08, 0.5, n.y) * (0.4 + 0.6*h(q+1.));
        gl_FragColor = vec4(c + s*0.5, 1.); }` });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), m));
}
const MOON_POS = V(70, 55, -260);
const moonMat = new THREE.ShaderMaterial({ fog: false, uniforms: { col: { value: new THREE.Color(0xf1ece2) } },
  vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `varying vec3 p; uniform vec3 col;
    float hash(vec3 q){ return fract(sin(dot(q, vec3(127.1,311.7,74.7)))*43758.5453); }
    float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
    float fbm(vec3 q){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*noise(q); q*=2.1; a*=.5; } return s; }
    void main(){ vec3 q = normalize(p); float maria = smoothstep(.42,.8, fbm(q*0.9+3.)); float m = fbm(q*2.5);
      gl_FragColor = vec4(col*(0.85 + 0.15*m)*(1. - .2*maria)*0.95, 1.); }` });
const moon = new THREE.Mesh(new THREE.SphereGeometry(26, 64, 32), moonMat); moon.position.copy(MOON_POS); scene.add(moon);
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: COOL_GLOW, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0.4 }));
halo.scale.setScalar(200); halo.position.copy(MOON_POS); scene.add(halo);

// ---------------- environment + lights
{
  const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0b0d12, side: THREE.BackSide })));
  const spot = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); spot.position.copy(MOON_POS).normalize().multiplyScalar(40); es.add(spot);
  const warm = new THREE.Mesh(new THREE.PlaneGeometry(30, 6), new THREE.MeshBasicMaterial({ color: 0x8a6030, side: THREE.DoubleSide })); warm.position.set(0, 0, 40); es.add(warm);
  scene.environment = pm.fromScene(es, 0.03).texture;
}
const key = new THREE.DirectionalLight(MOONC, 1.6); key.position.copy(MOON_POS).normalize().multiplyScalar(40); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
const kc = key.shadow.camera; kc.left = -30; kc.right = 30; kc.top = 30; kc.bottom = -30; kc.near = 1; kc.far = 120; kc.updateProjectionMatrix();
key.castShadow = false;   // only the lamp inside casts shadows: his silhouette on the paper
key.target.position.set(0, 0, -8); scene.add(key, key.target);
scene.add(new THREE.HemisphereLight(0x1d2230, 0x050403, 0.55));

// ---------------- water
const loader = new THREE.TextureLoader();
const wn1 = await loader.loadAsync('assets/Water_1_M_Normal.jpg'); const wn2 = await loader.loadAsync('assets/Water_2_M_Normal.jpg');
for (const t of [wn1, wn2]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
const water = new Reflector(new THREE.PlaneGeometry(1500, 1500), { textureWidth: 1600, textureHeight: 900, clipBias: 0.002, multisample: 4, shader: {
  uniforms: { color: { value: new THREE.Color(0x2a3038) }, tDiffuse: { value: null }, textureMatrix: { value: null }, n1: { value: wn1 }, n2: { value: wn2 }, deep: { value: new THREE.Color(0x030407) }, fogC: { value: FOG } },
  vertexShader: 'uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW; void main(){ vUv = textureMatrix * vec4(position, 1.); vW = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform sampler2D n1; uniform sampler2D n2; uniform vec3 deep; uniform vec3 fogC; varying vec4 vUv; varying vec3 vW;
    void main(){ vec2 p = vW.xz; vec3 a = texture2D(n1, p*0.045+vec2(.03,.02)).rgb*2.-1.; vec3 b = texture2D(n2, p*0.11).rgb*2.-1.; vec2 n = (a.rg+b.rg)*0.5;
      float dist = length(cameraPosition - vW); vec4 uv = vUv; uv.xy += n*(0.016 + dist*0.0008)*uv.w;
      vec3 r = vec3(0.); float bl = 0.002 + dist*0.0001;
      for (int i=0;i<5;i++){ vec2 o = vec2(float(i)-2., float(i*3-(i*3/5)*5)-2.)*bl*uv.w; r += texture2DProj(tDiffuse, vec4(uv.xy+o, uv.zw)).rgb; } r /= 5.;
      vec3 v = normalize(cameraPosition - vW); float fres = 0.08 + 0.92*pow(1. - max(v.y, 0.), 4.);
      vec3 c = mix(deep, r*color*2.2, clamp(fres*1.25, 0., 1.)); float f = 1. - exp(-pow(0.022*dist, 2.)); c = mix(c, fogC, f*0.85);
      gl_FragColor = vec4(c, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` } });
water.rotation.x = -Math.PI / 2; scene.add(water);

// ---------------- materials
const canvasTex = (w, h, draw, srgb) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
const woodTex = canvasTex(1024, 128, (x) => { x.fillStyle = '#4a4038'; x.fillRect(0, 0, 1024, 128); for (let j = 0; j < 128; j += 2) { x.fillStyle = `rgba(10,8,6,${0.2 + Math.random() * 0.35})`; x.fillRect(0, j + Math.sin(j) * 2, 1024, 1); } }, true);
const stoneTex = canvasTex(512, 512, (x) => { const img = x.createImageData(512, 512); for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) { const v = 110 + 40 * Math.sin(i * 0.05 + Math.sin(j * 0.03) * 3) * Math.sin(j * 0.04) + (Math.random() - 0.5) * 70; const k = (j * 512 + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255; } x.putImageData(img, 0, 0); });
const tatamiTex = canvasTex(256, 512, (x) => { x.fillStyle = '#5c5a42'; x.fillRect(0, 0, 256, 512); for (let j = 0; j < 512; j += 3) { x.fillStyle = `rgba(30,28,18,${0.25 + Math.random() * 0.2})`; x.fillRect(0, j, 256, 1); } x.fillStyle = '#141412'; x.fillRect(0, 0, 10, 512); x.fillRect(246, 0, 10, 512); }, true);
const M = {
  timber: new THREE.MeshStandardMaterial({ map: woodTex, color: 0x6a625a, roughness: 0.78, bumpMap: woodTex, bumpScale: 1.5 }),
  timberDark: new THREE.MeshStandardMaterial({ map: woodTex, color: 0x2e2a26, roughness: 0.7 }),
  plank: new THREE.MeshStandardMaterial({ map: woodTex, color: 0x5a5450, roughness: 0.8, bumpMap: woodTex, bumpScale: 2 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x3a3b3e, roughness: 0.85, map: stoneTex, bumpMap: stoneTex, bumpScale: 3 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.55, metalness: 0.2, envMapIntensity: 0.6 }),
  tatami: new THREE.MeshStandardMaterial({ map: tatamiTex, roughness: 0.9 }),
  paper: new THREE.MeshStandardMaterial({ color: 0x3a3226, emissive: PAPER, emissiveIntensity: 0.55, roughness: 1, side: THREE.DoubleSide }),
  paperDim: new THREE.MeshStandardMaterial({ color: 0x2a2620, emissive: PAPER, emissiveIntensity: 0.18, roughness: 1, side: THREE.DoubleSide }),
  lattice: new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.8 }),
  lacquer: new THREE.MeshPhysicalMaterial({ color: 0x0c0c0d, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 }),
  steel: new THREE.MeshPhysicalMaterial({ color: 0xe6e8ec, roughness: 0.1, metalness: 1, envMapIntensity: 2 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x2a2a2d, roughness: 0.45, metalness: 0.85 }),
  seam: new THREE.MeshBasicMaterial({ color: SEAM, transparent: true, opacity: 0.6, toneMapped: false }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffe0b0, toneMapped: false }),
  red: new THREE.MeshBasicMaterial({ color: 0xc4453f }),
};
const box = (w, h, d, mat, x, y, z, parent = scene, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
// light pools: painted warm light on the planks and water, so lamps read as lit on any device
const pool = (x, y, z, r, k = 0.5) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: WARM_GLOW, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: k, toneMapped: true })); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.renderOrder = 3; scene.add(p); return p; };
const glow = (x, y, z, s, k = 0.6, map = WARM_GLOW) => { const g = new THREE.Sprite(new THREE.SpriteMaterial({ map, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: k })); g.position.set(x, y, z); g.scale.setScalar(s); scene.add(g); return g; };

// ============================================================ the world
// layout (top view): shore with the gate at z=+20 → causeway along x=0 → the house on the lake, z −10…−24
// ---------------- shore and gate
box(60, 0.6, 20, M.stone, 0, 0.1, 32);
{
  const gx = 0, gz = 21.5;
  for (const x of [-2.1, 2.1]) box(0.32, 4.4, 0.32, M.timberDark, gx + x, 2.4, gz);
  box(5.6, 0.32, 0.4, M.timberDark, gx, 4.55, gz);                // kasagi
  box(4.8, 0.22, 0.26, M.timberDark, gx, 3.9, gz);                // nuki
  const s = box(5.62, 0.012, 0.012, M.seam, gx, 4.72, gz + 0.2);   // light seam on the beam
  s.castShadow = false;
  for (const x of [-1.2, 1.2]) box(0.35, 0.12, 0.35, M.stone, gx + x, 0.45, gz - 1.2);
}
// ---------------- causeway: planks on posts, four lanterns = Plan, Build, Ship, Sustain
const CAUSE = { z0: 20.5, z1: -9.4, y: 0.42 };
{
  const n = Math.round((CAUSE.z0 - CAUSE.z1) / 0.34);
  const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.07, 0.3), M.plank, n); const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { m4.makeRotationY((rand() - 0.5) * 0.02).setPosition((rand() - 0.5) * 0.03, CAUSE.y, CAUSE.z0 - i * 0.34); planks.setMatrixAt(i, m4); }
  planks.receiveShadow = true; planks.castShadow = true; scene.add(planks);
  for (let z = CAUSE.z0; z > CAUSE.z1; z -= 2.6) for (const x of [-0.9, 0.9]) { const p = box(0.12, 0.9, 0.12, M.timberDark, x, 0.0, z); p.castShadow = false; }
  const guide = box(0.012, 0.004, CAUSE.z0 - CAUSE.z1, M.seam, 0, CAUSE.y + 0.04, (CAUSE.z0 + CAUSE.z1) / 2); guide.castShadow = false;
}
const lathe = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 6);
const LANTERNS = [[1.6, 15], [-1.6, 9], [1.6, 3], [-1.6, -3]];
function stoneLantern(x, z, s = 1, parent = scene) {
  const L = new THREE.Group();
  const parts = [[lathe([[0.001, 0], [0.42, 0], [0.42, 0.12], [0.3, 0.2], [0.001, 0.2]]), 0], [new THREE.CylinderGeometry(0.11, 0.13, 0.9, 12), 0.65],
    [lathe([[0.001, 0], [0.22, 0], [0.36, 0.1], [0.36, 0.16], [0.001, 0.16]]), 1.1], [lathe([[0.001, 0], [0.55, 0], [0.5, 0.06], [0.12, 0.3], [0.06, 0.36], [0.001, 0.36]]), 1.67],
    [new THREE.SphereGeometry(0.075, 12, 8), 2.08]];
  for (const [g, y] of parts) { const m = new THREE.Mesh(g, M.stone); m.position.y = y; m.castShadow = true; L.add(m); }
  const bx = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.42), M.stone); bx.position.y = 1.47; L.add(bx);
  for (const r of [0, Math.PI / 2]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.2, 0.18), M.flame); w.position.y = 1.47; w.rotation.y = r; L.add(w); }
  L.scale.setScalar(s); L.position.set(x, 0, z); parent.add(L);
  return L;
}
for (const [x, z] of LANTERNS) {
  // each lantern stands on a stone footing in the water beside the causeway
  box(1.1, 0.5, 1.1, M.stone, x * 1.05, 0.15, z);
  stoneLantern(x * 1.05, z, 1).position.y = 0.4;
  glow(x * 1.05, 1.87, z, 2.6, 0.65);
  pool(x * 0.6, CAUSE.y + 0.05, z, 2.4, 0.35);             // warm light on the planks
  pool(x * 1.3, 0.02, z, 3.4, 0.22);                        // and on the water
  const pl = new THREE.PointLight(WARM, 5, 9, 1.6); pl.position.set(x * 1.05, 1.9, z); scene.add(pl);   // desktop extra
}

// ---------------- the house on the water
const HOUSE = { x0: -7, x1: 7, z0: -10, z1: -24, floor: 0.9, eave: 3.9 };
const house = new THREE.Group(); scene.add(house);
{
  const { x0, x1, z0, z1, floor, eave } = HOUSE;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z0 - z1;
  // stilts and platform, with an engawa (veranda) all around
  for (let x = x0 - 1; x <= x1 + 1; x += 2) for (let z = z1 - 1; z <= z0 + 1; z += 2) box(0.22, floor, 0.22, M.timberDark, x, floor / 2 - 0.05, z, house);
  box(w + 2.4, 0.16, d + 2.4, M.plank, cx, floor, cz, house);
  // tatami floor inside
  const tat = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, d - 0.4), M.tatami); tat.rotation.x = -Math.PI / 2; tat.position.set(cx, floor + 0.085, cz); tat.receiveShadow = true;
  M.tatami.map.repeat.set(w / 1.8, d / 0.9); house.add(tat);
  // posts every 2 m on the walls
  for (let x = x0; x <= x1 + 0.01; x += 2) for (const z of [z0, z1]) box(0.2, eave - floor, 0.2, M.timber, x, (floor + eave) / 2, z, house);
  for (let z = z1; z <= z0 + 0.01; z += 2) for (const x of [x0, x1]) box(0.2, eave - floor, 0.2, M.timber, x, (floor + eave) / 2, z, house);
  // beams
  for (const z of [z0, z1]) box(w + 0.4, 0.26, 0.26, M.timber, cx, eave, z, house);
  for (const x of [x0, x1]) box(0.26, 0.26, d + 0.4, M.timber, x, eave, cz, house);
  // roof: a hipped roof with deep eaves, a light seam along the ridge
  {
    const ov = 1.6, rx0 = x0 - ov, rx1 = x1 + ov, rz0 = z0 + ov, rz1 = z1 - ov, ry0 = eave + 0.2, ry1 = eave + 3.0, inset = 3.2;
    const g = new THREE.BufferGeometry();
    const p = [rx0, ry0, rz0, rx1, ry0, rz0, rx1, ry0, rz1, rx0, ry0, rz1, rx0 + inset, ry1, cz, rx1 - inset, ry1, cz];
    const idx = [0, 1, 5, 0, 5, 4, 2, 3, 4, 2, 4, 5, 1, 2, 5, 3, 0, 4];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx); g.computeVertexNormals();
    const roof = new THREE.Mesh(g, M.roof); roof.material.side = THREE.DoubleSide; roof.castShadow = true; house.add(roof);
    const rs = box(rx1 - rx0 - 2 * inset, 0.02, 0.02, M.seam, cx, ry1 + 0.02, cz, house); rs.castShadow = false;
    for (const [ax, az] of [[rx0, rz0], [rx1, rz0], [rx1, rz1], [rx0, rz1]]) { // eave edge seams
    }
    const eaveEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(rx1 - rx0, 0.001, rz0 - rz1)), new THREE.LineBasicMaterial({ color: SEAM, transparent: true, opacity: 0.35 }));
    eaveEdge.position.set(cx, ry0, cz); house.add(eaveEdge);
  }
}
// shoji: paper panels with a black lattice. `paper` glows warm from inside on every device.
const shojiPanels = [];
function shoji(x, z, wdt, hgt, ry, mat = M.paper, parent = house, opts = {}) {
  const g = new THREE.Group(); g.position.set(x, HOUSE.floor + 0.08 + hgt / 2, z); g.rotation.y = ry; parent.add(g);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(wdt, hgt), opts.paperMat || mat); g.add(paper);
  const nx = Math.max(2, Math.round(wdt / 0.32)), ny = Math.round(hgt / 0.3);
  for (let i = 0; i <= nx; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.022, hgt, 0.03), M.lattice); b.position.x = -wdt / 2 + (i * wdt) / nx; g.add(b); }
  for (let j = 0; j <= ny; j++) { const b = new THREE.Mesh(new THREE.BoxGeometry(wdt, 0.022, 0.03), M.lattice); b.position.y = -hgt / 2 + (j * hgt) / ny; g.add(b); }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(wdt + 0.06, hgt + 0.06, 0.04), M.timber); frame.scale.set(1, 1, 0.5); frame.position.z = -0.01;
  const fr = new THREE.Group(); g.add(fr);
  for (const s of [-1, 1]) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.07, hgt + 0.07, 0.05), M.timber); v.position.x = (s * (wdt + 0.035)) / 2; fr.add(v); const h = new THREE.Mesh(new THREE.BoxGeometry(wdt + 0.07, 0.07, 0.05), M.timber); h.position.y = (s * (hgt + 0.035)) / 2; fr.add(h); }
  shojiPanels.push(g); return g;
}
const SH = HOUSE.eave - HOUSE.floor - 0.35;
{
  const { x0, x1, z0, z1 } = HOUSE;
  // front wall: four sliding panels at the centre (the entrance), side bays
  for (let x = x0 + 1; x < x1; x += 2) if (Math.abs(x) > 2) shoji(x, z0, 1.9, SH, 0);
  // side and back walls
  for (let z = z1 + 1; z < z0; z += 2) { shoji(x0, z, 1.9, SH, Math.PI / 2, M.paperDim); shoji(x1, z, 1.9, SH, Math.PI / 2, M.paperDim); }
  for (let x = x0 + 1; x < x1; x += 2) if (Math.abs(x) > 2) shoji(x, z1, 1.9, SH, 0, M.paperDim);
}
// front entrance panels (two), back panels (two): slide open in the film
const FRONT = [shoji(-1, HOUSE.z0, 1.98, SH, 0), shoji(1, HOUSE.z0, 1.98, SH, 0)];
const BACK = [shoji(-1, HOUSE.z1, 1.98, SH, 0, M.paperDim), shoji(1, HOUSE.z1, 1.98, SH, 0, M.paperDim)];
// interior light: andon lamps in the corners (emissive) + desktop point lights
const ANDON = [[-5.6, -11.5], [5.6, -11.5], [-5.6, -22.5], [5.6, -22.5]];
for (const [x, z] of ANDON) {
  const a = new THREE.Group(); a.position.set(x, HOUSE.floor + 0.08, z); house.add(a);
  const shade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.6, 0.34), new THREE.MeshBasicMaterial({ color: 0xffd8a0, toneMapped: false })); shade.position.y = 0.55; a.add(shade);
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.85, 0.03), M.timberDark); l.position.set(dx * 0.18, 0.42, dz * 0.18); a.add(l); }
  glow(x, HOUSE.floor + 0.7, z, 2.2, 0.5);
  const pl = new THREE.PointLight(WARM, 6, 10, 1.4); pl.position.set(x, HOUSE.floor + 0.9, z); scene.add(pl);
}
// tokonoma (alcove) on the back wall, left of the doors: the sword rack
const TOKO = V(-4.4, HOUSE.floor, -23.2);
{
  box(3.2, 0.25, 1.1, M.timberDark, TOKO.x, TOKO.y + 0.2, TOKO.z);
  const wall = box(3.4, SH, 0.1, new THREE.MeshStandardMaterial({ color: 0x3b3833, roughness: 0.95 }), TOKO.x, TOKO.y + SH / 2, TOKO.z - 0.55);
  // kakejiku (hanging scroll): blank paper with a single ink stroke
  const scroll = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.5), new THREE.MeshStandardMaterial({ color: 0xcfc9bb, roughness: 0.9 })); scroll.position.set(TOKO.x + 1.0, TOKO.y + 1.9, TOKO.z - 0.49); house.add(scroll);
  const stroke = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.9), new THREE.MeshBasicMaterial({ color: 0x111111 })); stroke.position.set(TOKO.x + 1.0, TOKO.y + 1.9, TOKO.z - 0.485); stroke.rotation.z = 0.15; house.add(stroke);
}
// the rack: four swords, one per project
function katana(drawnBy, red) {
  const g = new THREE.Group(); const L = 0.72, w = 0.031, N = 40; const cx = (t) => -0.032 * t * t; const s = new THREE.Shape();
  s.moveTo(cx(0) + w / 2, 0); for (let i = 1; i <= N; i++) { const t = (i / N) * 0.93; s.lineTo(cx(t) + (w / 2) * (1 - 0.28 * t), t * L); }
  s.lineTo(cx(1) - w * 0.32, L); for (let i = N; i >= 0; i--) { const t = (i / N) * 0.97; s.lineTo(cx(t) - (w / 2) * (1 - 0.28 * t), t * L); }
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.0035, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.004, bevelSegments: 2 }), M.steel);
  const sw = new THREE.Group(); sw.add(blade); const ts = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.007, 8), M.iron); sw.add(ts);
  const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0155, 0.27, 16), M.lacquer); tk.position.y = -0.14; sw.add(tk);
  sw.rotation.z = -Math.PI / 2; sw.position.x = -drawnBy; g.add(sw);
  const saya = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.016, 0.76, 16), M.lacquer); saya.rotation.z = -Math.PI / 2; saya.position.x = 0.38; saya.scale.set(1.3, 1, 0.75); g.add(saya);
  const koi = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0022, 6, 24), red ? M.red : M.seam); koi.rotation.y = Math.PI / 2; g.add(koi);
  return g;
}
{
  const rack = new THREE.Group(); rack.position.set(TOKO.x - 0.2, TOKO.y + 0.33, TOKO.z - 0.1); house.add(rack);
  box(1.5, 0.07, 0.34, M.lacquer, 0, 0.02, 0, rack);
  for (const x of [-0.5, 0.5]) box(0.07, 0.72, 0.22, M.lacquer, x, 0.38, 0, rack);
  [0, 0, 0.04, shot === 'v06' ? 0.34 : 0].forEach((dd, i) => { const k = katana(dd, i === 3); k.position.set(-0.72, 0.22 + i * 0.15, 0.04); rack.add(k); });
}
// the polishing bench along the right wall: where the swords are finished. Four whetstones, coarse → fine.
const BENCH = V(4.6, HOUSE.floor, -18);
const STONES = [];
{
  const b = new THREE.Group(); b.position.copy(BENCH); house.add(b);
  box(1.0, 0.36, 3.6, M.timber, 0, 0.18, 0, b);
  const greys = [0x4a4440, 0x6a625a, 0x8c857a, 0xb8b2a6];
  greys.forEach((c, i) => {
    const st = box(0.22, 0.07, 0.62, new THREE.MeshStandardMaterial({ color: c, roughness: i === 3 ? 0.35 : 0.8 }), -0.15, 0.4, -1.2 + i * 0.8, b);
    const wet = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.6), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, transmission: 0, clearcoat: 1, transparent: true, opacity: 0.35 })); wet.rotation.x = -Math.PI / 2; wet.position.set(-0.15, 0.436, -1.2 + i * 0.8); b.add(wet);
    STONES.push(st);
  });
  // a blade laid across the finest stone, a tsuba, a hammer, a water bucket
  const blade = katana(0, false); blade.rotation.y = Math.PI / 2; blade.position.set(0.25, 0.43, 0.9); blade.children[1].visible = false; blade.children[2].visible = false; b.add(blade);
  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 24), M.iron); tsuba.position.set(0.28, 0.37, -0.6); b.add(tsuba);
  box(0.06, 0.06, 0.32, M.timberDark, 0.3, 0.39, -1.4, b); box(0.09, 0.08, 0.14, M.iron, 0.3, 0.39, -1.6, b);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.3, 24), M.timberDark); bucket.position.set(-0.75, 0.15, 1.3); b.add(bucket);
  const seam = box(0.006, 0.004, 3.4, M.seam, 0.45, 0.365, 0, b); seam.castShadow = false;
}

{
  const bx = BENCH.x - 0.9, bz = BENCH.z - 1.9;
  const shade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.6, 0.34), new THREE.MeshBasicMaterial({ color: 0xffd8a0, toneMapped: false })); shade.position.set(bx, BENCH.y + 0.63, bz); house.add(shade);
  glow(bx, BENCH.y + 0.7, bz, 2.4, 0.55); pool(BENCH.x - 0.2, BENCH.y + 0.45, BENCH.z - 0.6, 1.6, 0.35);
  const pl = new THREE.PointLight(WARM, 5, 6, 1.4); pl.position.set(bx, BENCH.y + 1.0, bz); scene.add(pl);
}
// ---------------- the samurai: one place, one direction, the whole film
const SAM = V(0, HOUSE.floor + 0.08, -15.5);
const gltf = await new GLTFLoader().loadAsync('assets/ronin_rig.glb');
const sam = gltf.scene; sam.position.copy(SAM); sam.rotation.y = 0; scene.add(sam);
const charMat = {
  def: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.85 }),
  lacquer: new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.32, clearcoat: 1 }),
  silk: new THREE.MeshStandardMaterial({ color: 0xbdb9b1, roughness: 0.6 }),
  steel: M.steel, seam: new THREE.MeshBasicMaterial({ color: SEAM, toneMapped: false }),
};
sam.traverse((o) => { if (o.isMesh) { const n = o.material.name; o.material = n.includes('blade') ? charMat.steel : n.includes('seam') ? charMat.seam : n.includes('silk') || n.includes('hair') || n.includes('bead_light') ? charMat.silk : n.includes('lacquer') || n.includes('kasa') ? charMat.lacquer : charMat.def; o.castShadow = true; o.frustumCulled = false; } });
const mixer = new THREE.AnimationMixer(sam);
const clip = (name, t) => { const a = mixer.clipAction(gltf.animations.find((c) => c.name === name)); a.play(); a.paused = true; a.time = t; mixer.update(0); };

// ---------------- the shadow play: a lamp behind him throws his silhouette onto the front shoji
const shadowLamp = new THREE.SpotLight(0xffe0b0, 0, 14, 0.75, 0.35, 1.0);
shadowLamp.position.set(SAM.x + 0.3, SAM.y + 1.9, SAM.z - 3.2); shadowLamp.target.position.set(0, SAM.y + 1.2, HOUSE.z0);
shadowLamp.castShadow = true; shadowLamp.shadow.mapSize.set(2048, 2048); shadowLamp.shadow.bias = -0.0005; shadowLamp.shadow.radius = 3;
scene.add(shadowLamp, shadowLamp.target);
// the silhouette layer on the outside of the front paper: a ShadowMaterial that only shows the lamp's shadow
const silhouette = new THREE.Mesh(new THREE.PlaneGeometry(6, SH), new THREE.ShadowMaterial({ color: 0x0a0806, opacity: 0.92 }));
silhouette.position.set(0, HOUSE.floor + 0.08 + SH / 2, HOUSE.z0 + 0.03); silhouette.receiveShadow = true; scene.add(silhouette);

// ---------------- mist on the lake + dust
function mist(cx, cz, size, n, top, a0) {
  for (let i = 0; i < n; i++) {
    const y = 0.05 + (i / (n - 1)) ** 1.5 * top;
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
      uniforms: { seed: { value: i * 1.37 + 0.5 }, a: { value: a0 * (1 - y / (top * 1.15)) } },
      vertexShader: 'varying vec3 w; void main(){ w = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(w,1.); }',
      fragmentShader: `varying vec3 w; uniform float seed; uniform float a;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))+seed)*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        float fbm(vec2 p){ float s=0., k=.5; for(int i=0;i<5;i++){ s+=k*n(p); p*=2.03; k*=.5; } return s; }
        void main(){ float d = smoothstep(0.38, 0.85, fbm(w.xz*0.2 + seed)); float cam = smoothstep(0.8, 4.0, length(cameraPosition - w));
          float edge = 1. - smoothstep(${(size * 0.3).toFixed(1)}, ${(size * 0.5).toFixed(1)}, length(w.xz - vec2(${cx.toFixed(1)}, ${cz.toFixed(1)})));
          gl_FragColor = vec4(vec3(0.24,0.26,0.31), d*a*cam*edge); }` });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m); p.rotation.x = -Math.PI / 2; p.position.set(cx, y, cz); p.renderOrder = 2; scene.add(p);
  }
}
mist(0, -2, 90, 9, 1.4, 0.09);
{
  const count = 2400, pos = new Float32Array(count * 3), sz = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos[i * 3] = (rand() - 0.5) * 40; pos[i * 3 + 1] = rand() * 9; pos[i * 3 + 2] = 22 - rand() * 50; sz[i] = 0.6 + rand() ** 3 * 3; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { moon: { value: MOON_POS } },
    vertexShader: `attribute float sz; varying float vA; uniform vec3 moon; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv;
      float d = -mv.z; float near = smoothstep(2.5, 0.6, d); gl_PointSize = min(sz * 14. / d * (1. + near*5.), 70.);
      float fwd = pow(max(dot(-normalize(cameraPosition - position), normalize(moon - position)), 0.), 6.);
      vA = (0.2 + 1.4*fwd) * smoothstep(0.9, 1.8, d) * (1. - smoothstep(25., 55., d)) / (1. + near*12.); }`,
    fragmentShader: 'varying float vA; void main(){ float r = length(gl_PointCoord-.5); float a = 1. - smoothstep(0., .5, r); gl_FragColor = vec4(vec3(0.9,0.92,0.95), a*a*vA); }' });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; dustScene.add(pts);
}

// ============================================================ shots
const cam = new THREE.PerspectiveCamera(35, W / H, 0.05, 2000);
const mm = (f) => (2 * Math.atan(12 / f) * 180) / Math.PI;
const setCam = (p, t, f, roll = 0) => { cam.position.copy(p); cam.fov = mm(f); cam.lookAt(t); cam.rotateZ(roll); cam.updateProjectionMatrix(); };
let focus = 10, aperture = 0.0004, ui = '', bloomK = 0.45;
const NAV = `<div class="nav"><span style="display:flex;gap:14px;align-items:center"><span class="jp" style="font-size:22px;font-weight:600">侍</span><span style="opacity:.2">|</span><span class="mono" style="font-size:18px">biairmal<span style="display:inline-block;width:8px;height:18px;background:#ededed;margin-left:3px;vertical-align:-3px"></span></span></span><span style="display:flex;gap:36px;align-items:center;color:#c8c8c8">Home<span>Contacts</span><span>Blogs</span><span style="border:1px solid #444;padding:14px 22px;color:#ededed">Let's talk</span></span></div>`;
const note = (t) => `<div class="mono" style="position:absolute;left:60px;bottom:46px;font-size:12px;letter-spacing:.2em;color:#8b8b8b">${t}</div>`;
const slide = (panels, dir, amt) => panels.forEach((p, i) => { p.position.x += (i === 0 ? -1 : 1) * amt * dir; });

clip('idle', 0.5);
switch (shot) {
  case 'v00': { // prologue: one lantern flame
    shadowLamp.intensity = 40;
    setCam(V(3.3, 1.75, 19.4), V(1.6, 1.9, 15), 55, 0);
    focus = 4.7; aperture = 0.003;
    ui = `<div class="jp" style="position:absolute;left:50%;top:18%;transform:translateX(-50%);font-size:30px;font-weight:600">侍</div><div class="mono" style="position:absolute;left:50%;bottom:16%;transform:translateX(-50%);font-size:13px;letter-spacing:.3em;color:#8b8b8b">LIGHTING THE PATH · 064 / 100</div>`;
    break;
  }
  case 'v01': { // establishing: gate, causeway, house, moon — the whole world in one frame
    shadowLamp.intensity = 40; clip('idle', 0.5);
    setCam(V(-5.5, 2.4, 30), V(1.5, 3.2, -14), 30, 0);
    focus = 40; aperture = 0.0001;
    ui = NAV + `<div style="position:absolute;left:160px;top:250px;width:560px">
      <div class="lbl"><span style="width:7px;height:7px;background:#c4453f"></span>Available for freelance work</div>
      <div style="font-size:66px;font-weight:500;letter-spacing:-.045em;line-height:1.04;margin:28px 0 24px">Every line of code,<br>a deliberate cut.</div>
      <div class="muted" style="font-size:18px;line-height:1.65;max-width:470px">I'm Bandana, a software engineer who owns the whole path — from the first plan to a stable production release.</div></div>`;
    break;
  }
  case 'v02': { // the causeway: the four lanterns are the four stages
    shadowLamp.intensity = 40;
    setCam(V(0.35, 1.55, 17.5), V(-0.2, 1.6, -10), 32, 0);
    focus = 8; aperture = 0.0006;
    ui = NAV + `<div style="position:absolute;left:160px;top:150px"><div class="lbl"><span class="k">道</span>Approach</div><div style="font-size:44px;font-weight:500;letter-spacing:-.04em;line-height:1.08;margin-top:18px">One clean path<br>from plan to production.</div></div>
      <div style="position:absolute;left:1000px;top:420px" class="mono"><div style="font-size:11px;color:#c9a46a;letter-spacing:.12em">01 · PLAN</div></div>
      <div style="position:absolute;left:640px;top:432px" class="mono"><div style="font-size:10px;color:#9a8a70;letter-spacing:.12em">02 · BUILD</div></div>
      <div style="position:absolute;left:840px;top:430px" class="mono"><div style="font-size:9px;color:#7a6e5c;letter-spacing:.12em">03 · SHIP</div></div>
      <div style="position:absolute;left:160px;right:160px;bottom:56px;height:1px;background:#2a2a2a"><div style="width:25%;height:1px;background:#ededed"></div></div>`;
    break;
  }
  case 'v03': { // the threshold: his shadow draws on the paper
    shadowLamp.intensity = 55; clip('iai', 1.05);
    setCam(V(0.5, 2.1, -4.6), V(0.0, 2.25, -10), 32, 0);
    focus = 5.4; aperture = 0.0008;
    ui = note('THE SHADOW DRAWS · SCRUBBED BY SCROLL');
    break;
  }
  case 'v04': { // the cut opens the door: the paper is sliced along the blade, the panels part
    shadowLamp.intensity = 55; clip('iai', 1.34);
    slide(FRONT, 1, 0.55);
    setCam(V(0.0, 2.05, -6.2), V(0.0, 2.0, -12), 36, 0.04);
    focus = 4.5; aperture = 0.0008; bloomK = 0.7;
    ui = 'CUT';
    break;
  }
  case 'v05': { // about: inside, the person
    slide(FRONT, 1, 1.9); clip('idle', 0.5);
    const head = V(SAM.x, SAM.y + 1.62, SAM.z);
    setCam(V(2.4, 1.75, -11.4), head.clone().add(V(-0.7, -0.35, 0)), 40);
    focus = cam.position.distanceTo(head); aperture = 0.0018;
    ui = NAV + `<div style="position:absolute;left:160px;top:230px;width:600px"><div class="lbl"><span class="k">人</span>About</div>
      <div style="font-size:52px;font-weight:500;letter-spacing:-.04em;line-height:1.08;margin:22px 0 28px">Backend by trade,<br>full-stack when it counts.</div>
      <div class="muted" style="font-size:17px;line-height:1.65;max-width:500px">I'm Bandana Irmal Abdillah, a software engineer based in Jakarta, Indonesia, with 4+ years of experience building digital products.</div></div>`;
    break;
  }
  case 'v06': { // work: past his shoulder to the swords in the alcove
    slide(FRONT, 1, 1.9);
    setCam(V(-2.2, 1.75, -19.9), V(TOKO.x - 0.35, TOKO.y + 0.62, TOKO.z), 34);
    focus = cam.position.distanceTo(V(TOKO.x, TOKO.y + 0.7, TOKO.z)); aperture = 0.0025;
    ui = NAV + `<div style="position:absolute;left:160px;top:150px"><div class="lbl"><span class="k">戦</span>Recent work</div><div style="font-size:44px;font-weight:500;letter-spacing:-.04em;margin-top:18px">Shipped in production.</div></div>
      <div style="position:absolute;left:160px;top:320px;width:520px">${['Mobile banking backend rewrite', 'Event-driven data sync', 'Standing order platform', 'Official travel order system'].map((t, i) => `<div style="display:flex;gap:24px;align-items:baseline;border-top:1px solid #2a2a2a;padding:20px 0;${i === 3 ? '' : 'opacity:.55'}"><span class="mono" style="font-size:13px;color:${i === 3 ? '#c4453f' : '#888'}">0${4 - i}</span><span style="font-size:${i === 3 ? 26 : 21}px;font-weight:500;letter-spacing:-.02em">${t}</span></div>`).join('')}</div>`;
    break;
  }
  case 'v07': { // toolkit: overhead on the polishing bench
    slide(FRONT, 1, 1.9);
    setCam(V(BENCH.x - 1.9, BENCH.y + 1.55, BENCH.z + 2.3), V(BENCH.x - 0.1, BENCH.y + 0.38, BENCH.z - 0.2), 34);
    focus = cam.position.distanceTo(V(BENCH.x, BENCH.y + 0.4, BENCH.z)); aperture = 0.0018;
    const lbl = ['Backend', 'Frontend', 'Database', 'DevOps & cloud'], tools = ['.NET · Spring · Go · Node', 'React · Next.js · Blazor · Tailwind', 'PostgreSQL · SQL Server · Oracle · Redis', 'Docker · CI/CD · Azure · AWS'];
    ui = NAV + `<div style="position:absolute;left:160px;top:150px"><div class="lbl"><span class="k">武</span>Toolkit</div><div style="font-size:44px;font-weight:500;letter-spacing:-.04em;margin-top:18px">Tools I trust in production.</div></div>
      ${lbl.map((l, i) => `<div style="position:absolute;left:${560 + i * 230}px;top:${640}px;width:210px"><div class="mono" style="font-size:11px;letter-spacing:.1em;color:${i === 0 ? '#ededed' : '#888'};border-top:1px solid ${i === 0 ? '#ededed' : '#444'};padding-top:10px;text-transform:uppercase">0${i + 1} · ${l}</div><div style="font-size:14px;margin-top:8px;color:#bbb">${tools[i]}</div></div>`).join('')}`;
    break;
  }
  case 'v08': { // contact: the back opens onto the lake and the moon; we pull out and see everything at once
    slide(FRONT, 1, 1.9); slide(BACK, 1, 1.9); shadowLamp.intensity = 0;
    setCam(V(-15, 15, 46), V(3, 0.5, -8), 30);
    focus = 40; aperture = 0.0001;
    ui = NAV + `<div style="position:absolute;left:160px;top:210px;width:820px"><div class="lbl"><span class="k">連</span>Contact</div>
      <div style="font-size:84px;font-weight:500;letter-spacing:-.055em;line-height:1;margin:24px 0 30px">Have something<br>that needs to ship?</div>
      <div style="margin-top:34px;font-size:32px;font-weight:500;letter-spacing:-.03em;display:inline-block;border-bottom:1px solid #555;padding-bottom:8px">bandanairmal@gmail.com ↗</div></div>`;
    break;
  }
  case 'map': {
    shadowLamp.intensity = 40;
    const o = new THREE.OrthographicCamera(-35, 35, 19.7, -19.7, 0.1, 400); o.position.set(0, 120, -2); o.up.set(1, 0, 0); o.lookAt(0, 0, -2); window.__ortho = o;
    scene.fog = null; aperture = 0; break;
  }
}

// ---------------- post
const activeCam = window.__ortho || cam;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, activeCam));
if (aperture > 0) composer.addPass(new BokehPass(scene, cam, { focus, aperture: aperture * 0.6, maxblur: 0.0035 }));
{ const dp = new RenderPass(dustScene, activeCam); dp.clear = false; dp.clearDepth = true; composer.addPass(dp); }
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), bloomK, 0.65, 0.8));
composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); c.rgb *= mix(.5, 1., smoothstep(.95, .3, length(vUv-.5)*1.2)); c.rgb += (h(vUv*vec2(1600.,900.))-.5)*.04; gl_FragColor = c; }` }));
composer.addPass(new OutputPass());
await document.fonts.load('600 100px "Noto Serif JP"', '侍人道戦武連'); await document.fonts.load('500 40px Geist'); await document.fonts.load('400 12px "Geist Mono"');
composer.render();

const uiEl = document.getElementById('ui');
if (ui === 'CUT') {
  // the slit in the paper: a bright diagonal where the blade passed, light spilling out
  uiEl.innerHTML = `<svg width="1600" height="900" style="position:absolute;inset:0">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <line x1="420" y1="780" x2="1240" y2="120" stroke="#ffe7c0" stroke-opacity=".25" stroke-width="22"/>
    <line x1="420" y1="780" x2="1240" y2="120" stroke="url(#g)" stroke-width="3"/></svg>` + note('THE CUT OPENS THE DOOR · THE CAMERA PASSES THROUGH THE SLIT');
} else if (shot === 'map') {
  const o = window.__ortho; const proj = (v) => { const p = v.clone().project(o); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]; };
  const path = [[-5.5, 30], [0.35, 17.5], [0.2, 2], [0.5, -4.6], [0, -6.2], [2.4, -11.4], [-2.2, -19.9], [2.7, -15.7], [-15, 46]];
  const pts = path.map(([x, z]) => proj(V(x, 0, z)));
  let svg = `<svg width="1600" height="900" style="position:absolute;inset:0"><polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#c4453f" stroke-width="2" stroke-dasharray="7 6"/>`;
  const names = ['01', '02', '', '03', '04', '05', '06', '07', '08'];
  pts.forEach(([x, y], i) => { if (names[i]) svg += `<circle cx="${x}" cy="${y}" r="14" fill="#0a0a0a" stroke="#ededed"/><text x="${x}" y="${y + 4}" fill="#ededed" font-family="Geist Mono" font-size="11" text-anchor="middle">${names[i]}</text>`; });
  const lab = [['GATE', V(-4, 0, 21.5)], ['CAUSEWAY · 4 LANTERNS', V(-5, 0, 6)], ['HOUSE ON THE WATER', V(-11, 0, -17)], ['SWORD RACK', V(-4.4, 0, -26)], ['BENCH', V(7.8, 0, -18)], ['HIM', V(0, 0, -13.8)], ['← MOON', V(10, 0, -30)]];
  lab.forEach(([t, p]) => { const [x, y] = proj(p); svg += `<text x="${x}" y="${y}" fill="#cfcfcf" font-family="Geist Mono" font-size="12" letter-spacing="1.5" text-anchor="middle">${t}</text>`; });
  uiEl.innerHTML = svg + `</svg><div class="mono" style="position:absolute;left:40px;top:30px;font-size:12px;letter-spacing:.2em;color:#8b8b8b">WORLD PLAN · TOP VIEW · RED = THE CAMERA'S ONE CONTINUOUS PATH</div>`;
} else uiEl.innerHTML = ui;
window.__ready = true;
