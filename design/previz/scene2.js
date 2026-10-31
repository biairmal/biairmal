// Storyboard previz, draft 03: armoured samurai, rippled reflective water, ground fog, dust,
// moon light shafts, depth of field. One shot per URL hash (#s01 …).
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
import { buildSamurai, makeMaterials, pose, katana, place } from './samurai.js';

const W = 1600, H = 900;
const [shot, dbg = ''] = (location.hash || '#s01').slice(1).split('~');
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

const BLOOD = ['s08b', 's09'].includes(shot);
const ECLIPSE = shot === 's08a';
const seamCol = BLOOD ? 0xff6a5a : 0xeaf2ff;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').prepend(renderer.domElement);

const scene = new THREE.Scene();
const dustScene = new THREE.Scene();
const fogCol = new THREE.Color(BLOOD ? 0x1a0807 : 0x0b0d12);
scene.fog = new THREE.FogExp2(fogCol, 0.03);

// ---------------- sky
{
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(BLOOD ? 0x0e0303 : 0x04050a) }, hor: { value: new THREE.Color(BLOOD ? 0x2a0b09 : 0x12151c) } },
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 p; uniform vec3 top; uniform vec3 hor;
      float h(vec3 q){ return fract(sin(dot(q, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ vec3 n = normalize(p); float t = smoothstep(-0.02, 0.45, n.y);
        vec3 c = mix(hor, top, t);
        vec3 q = floor(n*520.); float s = step(0.998, h(q)) * smoothstep(0.08, 0.5, n.y) * (0.4 + 0.6*h(q+1.));
        gl_FragColor = vec4(c + s*0.5, 1.); }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), m));
}

// ---------------- moon
const MOON_POS = V(66, 38, -170);
const moonMat = new THREE.ShaderMaterial({
  fog: false,
  uniforms: { L: { value: V(0, 0, 1) }, col: { value: new THREE.Color(BLOOD ? 0xd8483a : 0xf1ece2) }, glow: { value: BLOOD ? 0.25 : 0 } },
  vertexShader: 'varying vec3 n; varying vec3 p; void main(){ n = normalize(mat3(modelMatrix)*normal); p = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `varying vec3 n; varying vec3 p; uniform vec3 L; uniform vec3 col; uniform float glow;
    float hash(vec3 q){ return fract(sin(dot(q, vec3(127.1,311.7,74.7)))*43758.5453); }
    float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
    float fbm(vec3 q){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*noise(q); q*=2.1; a*=.5; } return s; }
    void main(){
      vec3 q = normalize(p);
      float m = fbm(q*2.5);
      float maria = smoothstep(.4,.8, fbm(q*0.9+3.));
      float crater = smoothstep(.66,.74, noise(q*22.)) * .12;
      float d = smoothstep(-0.05, 0.22, dot(n, normalize(L)));
      vec3 c = col * (0.82 + 0.18*m - crater) * (1. - .26*maria);
      gl_FragColor = vec4(c*(d*0.9 + 0.03) + col*glow*0.3, 1.);
    }`,
});
const moon = new THREE.Mesh(new THREE.SphereGeometry(30, 128, 64), moonMat);
moon.position.copy(MOON_POS); scene.add(moon);
function glowTex(r, g, b, soft = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.2 * soft, `rgba(${r},${g},${b},.35)`);
  gr.addColorStop(0.55, `rgba(${r},${g},${b},.07)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
}
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: BLOOD ? glowTex(230, 70, 55) : glowTex(225, 230, 240), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: BLOOD ? 0.6 : 0.35 }));
halo.scale.setScalar(BLOOD ? 260 : 220); halo.position.copy(MOON_POS); scene.add(halo);

// ---------------- environment for reflections
{
  const pm = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide,
    uniforms: { a: { value: new THREE.Color(BLOOD ? 0x2a0a08 : 0x1a1e28) }, b: { value: new THREE.Color(0x020203) } },
    vertexShader: 'varying vec3 p; void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 p; uniform vec3 a; uniform vec3 b; void main(){ float t = normalize(p).y; gl_FragColor = vec4(mix(b, a, smoothstep(-0.2, 0.15, t)) * (1. + 2.*exp(-abs(t)*12.)), 1.); }' })));
  const spot = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 8), new THREE.MeshBasicMaterial({ color: BLOOD ? 0xff5040 : 0xffffff }));
  spot.position.copy(MOON_POS).normalize().multiplyScalar(40); es.add(spot);
  scene.environment = pm.fromScene(es, 0.03).texture;
}

// ---------------- lights
const key = new THREE.DirectionalLight(BLOOD ? 0xff5a48 : 0xd6e0ff, BLOOD ? 3.6 : (['s06', 's07'].includes(shot) ? 1.2 : 3.0));
key.position.copy(MOON_POS).normalize().multiplyScalar(30);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
scene.add(key); scene.add(key.target);
const fill = new THREE.DirectionalLight(BLOOD ? 0x5a2422 : 0x7d8cab, 0.45); fill.position.set(-8, 5, 20); scene.add(fill);
scene.add(new THREE.HemisphereLight(BLOOD ? 0x3a1210 : 0x1d2230, 0x000000, 0.7));
function shadowAround(p, r = 4) {
  key.target.position.copy(p); key.position.copy(p).add(MOON_POS.clone().sub(p).normalize().multiplyScalar(30));
  const c = key.shadow.camera; c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.near = 1; c.far = 80; c.updateProjectionMatrix();
}

// ---------------- water: mirror with rippled normals and distance blur
const loader = new THREE.TextureLoader();
const wn1 = await loader.loadAsync('assets/Water_1_M_Normal.jpg'); const wn2 = await loader.loadAsync('assets/Water_2_M_Normal.jpg');
for (const t of [wn1, wn2]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
const waterShader = {
  uniforms: {
    color: { value: new THREE.Color(BLOOD ? 0x3a1412 : 0x2a3038) }, tDiffuse: { value: null }, textureMatrix: { value: null },
    n1: { value: wn1 }, n2: { value: wn2 }, time: { value: 3.7 }, deep: { value: new THREE.Color(BLOOD ? 0x080202 : 0x030407) },
    fogC: { value: fogCol }, ripple: { value: new THREE.Vector2(2.6, 0) },
  },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    void main(){ vUv = textureMatrix * vec4(position, 1.); vW = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform sampler2D n1; uniform sampler2D n2; uniform float time; uniform vec3 deep; uniform vec3 fogC; uniform vec2 ripple;
    varying vec4 vUv; varying vec3 vW;
    #include <tonemapping_pars_fragment>
    void main(){
      vec2 p = vW.xz;
      vec3 a = texture2D(n1, p*0.045 + vec2(time*0.01, time*0.006)).rgb*2.-1.;
      vec3 b = texture2D(n2, p*0.11 - vec2(time*0.008, -time*0.011)).rgb*2.-1.;
      vec2 n = (a.rg + b.rg) * 0.5;
      // rings spreading from where he stands
      float d = length(p - ripple);
      n += normalize(p - ripple + 1e-4) * sin(d*7. - time*2.) * 0.25 * exp(-d*0.35) * smoothstep(0.6, 1.4, d);
      float dist = length(cameraPosition - vW);
      vec4 uv = vUv; uv.xy += n * (0.018 + dist*0.0009) * uv.w;
      vec3 r = vec3(0.);
      float bl = 0.002 + dist*0.00012;
      for (int i=0;i<5;i++){ vec2 o = vec2(float(i)-2., float(i*3%5)-2.)*bl*uv.w; r += texture2DProj(tDiffuse, vec4(uv.xy+o, uv.zw)).rgb; }
      r /= 5.;
      vec3 v = normalize(cameraPosition - vW);
      float fres = 0.08 + 0.92*pow(1. - max(v.y, 0.), 4.);
      vec3 c = mix(deep, r * color * 2.2, clamp(fres*1.25, 0., 1.));
      float f = 1. - exp(-pow(0.03*dist, 2.));
      c = mix(c, fogC, f*0.85);
      gl_FragColor = vec4(c, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};
const water = new Reflector(new THREE.PlaneGeometry(1500, 1500), { textureWidth: 1600, textureHeight: 900, clipBias: 0.002, shader: waterShader, multisample: 4 });
water.rotation.x = -Math.PI / 2; scene.add(water);

// ---------------- materials for the sets
const M = makeMaterials(seamCol);
const stoneTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  const img = x.createImageData(512, 512);
  for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
    const v = 110 + 40 * Math.sin(i * 0.05 + Math.sin(j * 0.03) * 3) * Math.sin(j * 0.04) + (Math.random() - 0.5) * 70;
    const k = (j * 512 + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})();
const woodTex = (() => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#5a4e40'; x.fillRect(0, 0, 1024, 128);
  for (let j = 0; j < 128; j += 2) { x.fillStyle = `rgba(20,14,8,${0.15 + Math.random() * 0.3})`; x.fillRect(0, j + Math.sin(j) * 2, 1024, 1); }
  for (let i = 0; i < 30; i++) { x.strokeStyle = 'rgba(15,10,6,.4)'; x.beginPath(); x.ellipse(Math.random() * 1024, Math.random() * 128, 20 + Math.random() * 30, 4, 0, 0, 7); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const stone = new THREE.MeshStandardMaterial({ color: 0x3a3b3e, roughness: 0.82, roughnessMap: stoneTex, bumpMap: stoneTex, bumpScale: 3, map: stoneTex, envMapIntensity: 0.5 });
stone.map.colorSpace = THREE.NoColorSpace;
const stoneDark = stone.clone(); stoneDark.color = new THREE.Color(0x1e1f22);
const wood = new THREE.MeshStandardMaterial({ map: woodTex, color: 0x6a6a6a, roughness: 0.75, bumpMap: woodTex, bumpScale: 2, envMapIntensity: 0.4 });

// ---------------- sets
const SETS = {};
const group = (name) => (SETS[name] = new THREE.Group(), scene.add(SETS[name]), SETS[name]);
// hero slab
{
  const g = group('slab');
  const slab = new THREE.Mesh(new RoundedBoxGeometry(5, 0.4, 3.2, 4, 0.06), stone); slab.position.set(2, 0.16, 0); slab.receiveShadow = slab.castShadow = true; g.add(slab);
  const s2 = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.26, 2.2, 4, 0.06), stoneDark); s2.position.set(-1.2, 0.08, 1.3); s2.rotation.y = 0.22; s2.receiveShadow = true; g.add(s2);
  const s3 = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.2, 1.1, 3, 0.05), stoneDark); s3.position.set(5.4, 0.04, -1.4); s3.rotation.y = -0.4; s3.receiveShadow = true; g.add(s3);
}
// the path: walkway + four stone lanterns
const lanternGlow = [];
{
  const g = group('path');
  for (let i = 0; i < 80; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.3), wood); p.position.set(-4 + (rand() - 0.5) * 0.04, 0.34, -28 - i * 0.34); p.rotation.y = (rand() - 0.5) * 0.02; p.receiveShadow = p.castShadow = true; g.add(p);
  }
  for (const x of [-0.93, 0.93]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 27.2), wood); rail.position.set(-4 + x, 0.26, -41.5); g.add(rail); }
  for (let i = 0; i < 10; i++) for (const x of [-0.95, 0.95]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 10), wood); post.position.set(-4 + x, 0.2, -28 - i * 3); post.castShadow = true; g.add(post); }
  const guide = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.003, 27), new THREE.MeshBasicMaterial({ color: seamCol, transparent: true, opacity: 0.45, toneMapped: false })); guide.position.set(-4, 0.377, -41.5); g.add(guide);
  const lanternLathe = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 6);
  [[-2.5, -33], [-5.5, -39], [-2.5, -45], [-5.5, -51]].forEach(([x, z], i) => {
    const L = new THREE.Group();
    const parts = [
      [lanternLathe([[0.001, 0], [0.42, 0], [0.42, 0.12], [0.3, 0.2], [0.001, 0.2]]), 0],
      [new THREE.CylinderGeometry(0.11, 0.13, 0.9, 12), 0.65],
      [lanternLathe([[0.001, 0], [0.22, 0], [0.36, 0.1], [0.36, 0.16], [0.001, 0.16]]), 1.1],
      [lanternLathe([[0.001, 0], [0.55, 0], [0.5, 0.06], [0.12, 0.3], [0.06, 0.36], [0.001, 0.36]]), 1.67],
      [new THREE.SphereGeometry(0.075, 12, 8), 2.08],
    ];
    parts.forEach(([geo, y]) => { const m = new THREE.Mesh(geo, stone); m.position.y = y; m.castShadow = true; L.add(m); });
    const lit = shot === 's05' ? i < 2 : true;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.42), stone); box.position.y = 1.47; L.add(box);
    for (const r of [0, Math.PI / 2]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.2, 0.18), new THREE.MeshBasicMaterial({ color: lit ? 0xffe6c4 : 0x101010, toneMapped: !lit }));
      win.position.y = 1.47; win.rotation.y = r; L.add(win);
    }
    if (lit) {
      const pl = new THREE.PointLight(0xffd9a8, 6, 10, 1.6); pl.position.y = 1.47; L.add(pl);
      const gs = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(255, 220, 170), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 }));
      gs.position.y = 1.47; gs.scale.setScalar(2.4); L.add(gs);
    }
    L.position.set(x, 0.36, z); g.add(L);
  });
}
// the sword rack
{
  const g = group('rack');
  const rg = new THREE.Group(); g.add(rg);
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.7, 1.1, 3, 0.04), stoneDark); plinth.position.y = 0.35; plinth.receiveShadow = true; rg.add(plinth);
  const base = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.07, 0.36, 2, 0.02), M.lacquer); base.position.y = 0.735; rg.add(base);
  for (const x of [-0.5, 0.5]) {
    const sh = new THREE.Shape(); sh.moveTo(-0.04, 0); sh.lineTo(0.04, 0); sh.lineTo(0.03, 0.72); sh.quadraticCurveTo(0, 0.78, -0.03, 0.72); sh.closePath();
    for (let i = 0; i < 4; i++) { const h = new THREE.Path(); h.absellipse(0, 0.2 + i * 0.16, 0.02, 0.022, 0, 7, true); sh.holes.push(h); }
    const arm = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }), M.lacquer);
    arm.position.set(x, 0.77, -0.11); arm.rotation.y = 0; arm.castShadow = true; rg.add(arm);
  }
  for (let i = 0; i < 4; i++) {
    const y = 0.97 + i * 0.16, drawn = shot === 's06' ? [0, 0, 0.05, 0.38][i] : 0;
    const sw = katana(M, { saya: true });
    place(sw.userData.saya, V(-0.72, y, 0.0), V(1, 0.012, 0), V(0, 1, 0)); rg.add(sw.userData.saya);
    place(sw, V(-0.72 - drawn, y, 0.0), V(1, 0.012, 0), V(0, 1, 0)); rg.add(sw);
    if (i === 3 && shot === 's06') sw.userData.saya.children[1].material = new THREE.MeshBasicMaterial({ color: 0xc4453f });
  }
  rg.position.set(14, 0, -40); rg.rotation.y = -0.3; SETS.rackG = rg;
}
// the tsuba ring
{
  const g = group('tsuba');
  const tg = (() => {
    const s = new THREE.Shape(); const N = 96;
    for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2; const r = 0.5 * (1 + 0.05 * Math.cos(4 * a)); const p = [Math.cos(a) * r * 0.93, Math.sin(a) * r]; i ? s.lineTo(...p) : s.moveTo(...p); }
    const hole = (cx, cy, rx, ry) => { const h = new THREE.Path(); h.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, true); s.holes.push(h); };
    hole(0, 0, 0.05, 0.15); hole(-0.22, 0, 0.055, 0.1); hole(0.22, 0, 0.055, 0.1);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.3; hole(Math.cos(a) * 0.37, Math.sin(a) * 0.39, 0.026, 0.03); }
    return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 12 });
  })();
  const ironB = new THREE.MeshStandardMaterial({ color: 0x3a3a3f, roughness: 0.45, metalness: 0.45, bumpMap: stoneTex, bumpScale: 1.5, envMapIntensity: 1.3 });
  const ring = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + 0.5;
    const t = new THREE.Mesh(tg, ironB); t.scale.setScalar(1.4); t.castShadow = true;
    t.position.set(Math.cos(a) * 2.6, Math.sin(i * 1.7) * 0.3, Math.sin(a) * 2.6); t.rotation.set(0.3 * Math.sin(i), a + 0.9, 0.2 * Math.cos(i * 2)); ring.add(t);
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.0025, 6, 128), new THREE.MeshBasicMaterial({ color: seamCol, transparent: true, opacity: i === 0 ? 0.9 : 0.2, toneMapped: false }));
    r.position.copy(t.position); r.rotation.copy(t.rotation); ring.add(r);
  }
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.003, 6, 200), new THREE.MeshBasicMaterial({ color: seamCol, transparent: true, opacity: 0.3, toneMapped: false })); orbit.rotation.x = Math.PI / 2; ring.add(orbit);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), M.steel); ring.add(core);
  ring.position.set(30, 7, -64); ring.rotation.set(0.25, 0, 0.08); g.add(ring);
}

// ---------------- atmosphere: ground fog slices + dust motes
function fogLayers(center, size, n = 9, top = 1.4, density = 1) {
  const g = new THREE.Group();
  const mat = (y, seed) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { col: { value: BLOOD ? new THREE.Color(0x4a1c18) : new THREE.Color(0x3c4250) }, seed: { value: seed }, a: { value: 0.085 * density * (1 - y / (top * 1.15)) }, cen: { value: center.clone() }, R: { value: size / 2 } },
    vertexShader: 'varying vec3 w; varying vec4 sp; void main(){ w = (modelMatrix*vec4(position,1.)).xyz; sp = projectionMatrix*viewMatrix*vec4(w,1.); gl_Position = sp; }',
    fragmentShader: `varying vec3 w; uniform vec3 col; uniform float seed; uniform float a; uniform vec3 cen; uniform float R;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))+seed)*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      float fbm(vec2 p){ float s=0., k=.5; for(int i=0;i<5;i++){ s+=k*n(p); p*=2.03; k*=.5; } return s; }
      void main(){
        float d = fbm(w.xz*0.22 + seed) ; d = smoothstep(0.38, 0.85, d);
        float edge = 1. - smoothstep(R*0.55, R, length(w.xz - cen.xz));
        float cam = smoothstep(0.8, 4.0, length(cameraPosition - w));
        gl_FragColor = vec4(col, d*a*edge*cam);
      }`,
  });
  for (let i = 0; i < n; i++) {
    const y = 0.04 + (i / (n - 1)) ** 1.6 * top;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat(y, i * 1.37 + 0.5)); p.rotation.x = -Math.PI / 2; p.position.set(center.x, y, center.z); p.renderOrder = 2; g.add(p);
  }
  scene.add(g); return g;
}
function dust(center, size, count = 2200, hgt = 4) {
  const pos = new Float32Array(count * 3), sz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = center.x + (rand() - 0.5) * size; pos[i * 3 + 1] = rand() ** 1.5 * hgt + 0.1; pos[i * 3 + 2] = center.z + (rand() - 0.5) * size;
    sz[i] = 0.6 + rand() ** 3 * 3.2;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { col: { value: new THREE.Color(BLOOD ? 0xff7a66 : 0xdfe6f2) }, moon: { value: MOON_POS } },
    vertexShader: `attribute float sz; varying float vA; uniform vec3 moon;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv;
        float d = -mv.z; float near = smoothstep(2.5, 0.6, d); gl_PointSize = min(sz * 14. / d * (1. + near*5.), 70.);
        vec3 toCam = normalize(cameraPosition - position); vec3 toMoon = normalize(moon - position);
        float fwd = pow(max(dot(-toCam, toMoon), 0.), 6.);
        vA = (0.22 + 1.6*fwd) * smoothstep(0.9, 1.8, d) * (1. - smoothstep(20., 45., d)) / (1. + near*12.); }`,
    fragmentShader: 'uniform vec3 col; varying float vA; void main(){ vec2 c = gl_PointCoord-.5; float r = length(c); float a = 1. - smoothstep(0., .5, r); gl_FragColor = vec4(col, a*a*vA); }',
  });
  const pts = new THREE.Points(geo, m); dustScene.add(pts); return pts;
}

// ---------------- samurai
const gltf = await new GLTFLoader().loadAsync('assets/Xbot.glb');
let S = null;
const needsHero = !['s00', 's06', 's07'].includes(shot);
if (needsHero) {
  S = buildSamurai(gltf, M);
  scene.add(S.root);
  S.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
}
const STANCE = { lean: 0.08, drop: 0.05, feet: { R: V(0.3, 0.05, 0.14), L: V(-0.28, 0.05, -0.12) } };

// ---------------- shots
const cam = new THREE.PerspectiveCamera(35, W / H, 0.05, 2000);
const mm = (f) => 2 * Math.atan(12 / f) * 180 / Math.PI;
const setCam = (p, t, f, roll = 0) => { cam.position.copy(p); cam.fov = mm(f); cam.lookAt(t); cam.rotateZ(roll); cam.updateProjectionMatrix(); };
let phase = 0, focus = 8, aperture = 0.0006, maxblur = 0.006, ui = '', rays = 1.0;
const SHOW = { s00: [], s01: ['slab'], s02a: ['slab'], s02b: ['slab'], s03: ['slab'], s04: ['path'], s05: ['path'], s06: ['rack'], s07: ['tsuba'], s08a: ['slab'], s08b: ['slab'], s09: ['slab'] }[shot] || [];
for (const k of ['slab', 'path', 'rack', 'tsuba']) SETS[k].visible = SHOW.includes(k);
const HERO = V(2.6, 0.36, 0);

const NAV = `<div class="nav"><span style="display:flex;gap:14px;align-items:center"><span class="jp" style="font-size:22px;font-weight:600">侍</span><span style="opacity:.2">|</span><span class="mono" style="font-size:18px">biairmal<span style="display:inline-block;width:8px;height:18px;background:#ededed;margin-left:3px;vertical-align:-3px"></span></span></span><span style="display:flex;gap:36px;align-items:center;color:#c8c8c8">Home<span>Contacts</span><span>Blogs</span><span style="border:1px solid #444;padding:14px 22px;color:#ededed">Let's talk</span></span></div>`;
const note = (t, c = '#8b8b8b') => `<div class="mono" style="position:absolute;left:60px;bottom:50px;font-size:12px;letter-spacing:.2em;color:${c}">${t}</div>`;

switch (shot) {
  case 's00': {
    const sw = katana(M); place(sw, V(-0.25, 6, 3.5), V(1, 0.04, 0), V(0, 1, 0)); scene.add(sw);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(0.003, 0.034), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); band.position.set(0.2, 6.02, 3.51); band.rotation.z = -0.5; scene.add(band);
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.07), new THREE.MeshBasicMaterial({ map: glowTex(255, 255, 255), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); bg.position.set(0.2, 6.02, 3.512); bg.rotation.z = -0.5; scene.add(bg);
    moon.visible = halo.visible = water.visible = false; scene.fog = null; rays = 0;
    const kl = new THREE.PointLight(0xffffff, 3, 2, 1); kl.position.set(0.2, 6.2, 3.7); scene.add(kl);
    dust(V(0.1, 0, 3.6), 1.2, 600, 7).position.y = 0;
    setCam(V(0.05, 6.07, 4.05), V(0.1, 6.01, 3.5), 55, -0.35);
    focus = 0.56; aperture = 0.004; maxblur = 0.01;
    ui = `<div style="position:absolute;left:50%;top:70%;transform:translateX(-50%);text-align:center" class="mono"><div style="font-size:13px;letter-spacing:.3em;color:#8b8b8b">064 / 100 · SHARPENING</div></div><div class="jp" style="position:absolute;left:50%;top:22%;transform:translateX(-50%);font-size:30px;font-weight:600">侍</div>`;
    break;
  }
  case 's01': {
    S.root.position.copy(HERO); S.root.rotation.y = 0.25; pose(S, STANCE);
    setCam(V(-0.6, 1.05, 8.6), V(2.0, 2.7, 0), 35);
    phase = 8; focus = 8.9; aperture = 0.0004;
    ui = NAV + `<div style="position:absolute;left:160px;top:250px;width:640px">
      <div class="lbl"><span style="width:7px;height:7px;background:#c4453f"></span>Available for freelance work</div>
      <div style="font-size:72px;font-weight:500;letter-spacing:-.045em;line-height:1.04;margin:30px 0 26px">Every line of code,<br>a deliberate cut.</div>
      <div class="muted" style="font-size:18px;line-height:1.65;max-width:480px">I'm Bandana, a software engineer who owns the whole path — from the first plan to a stable production release.</div>
      <div style="display:flex;gap:12px;margin-top:34px"><span class="btn" style="background:#ededed;color:#0a0a0a">Start a project →</span><span class="btn" style="border:1px solid #555">See recent work</span></div></div>
      <div style="position:absolute;left:50%;bottom:34px;transform:translateX(-50%);text-align:center" class="mono"><div style="font-size:10px;letter-spacing:.2em;color:#888">SCROLL TO DRAW</div></div>`;
    break;
  }
  case 's02a': {
    S.root.position.copy(HERO); S.root.rotation.y = 0.25;
    pose(S, { sword: 'koiguchi', lean: 0.16, drop: 0.09, headTilt: -0.18, kasaTilt: -0.2, feet: { R: V(0.34, 0.05, 0.14), L: V(-0.3, 0.05, -0.12) } });
    setCam(V(1.75, 0.62, 2.7), V(2.75, 1.75, 0), 45, 0.05);
    phase = 8; focus = 2.8; aperture = 0.0015; maxblur = 0.008;
    ui = note('KOIGUCHI O KIRU · THE THUMB BREAKS THE SEAL');
    break;
  }
  case 's02b': {
    S.root.position.copy(HERO); S.root.rotation.y = 0.25;
    pose(S, { lean: 0.22, drop: 0.17, kasaTilt: -0.18, sword: { grip: V(0.62, 1.42, 0.14), dir: V(0.6, 0.76, 0.2), edge: V(0.3, -0.3, 1) }, feet: { R: V(0.64, 0.05, 0.16), L: V(-0.45, 0.05, -0.14) }, poleR: V(0, 1.0, 1.2) });
    S.root.updateMatrixWorld(true);
    const pts = [V(-0.6, 0.62, -0.1), V(0.1, 0.5, 0.35), V(0.75, 0.78, 0.45), V(1.15, 1.4, 0.4), V(1.22, 2.0, 0.32)].map((p) => p.applyMatrix4(S.root.matrixWorld));
    const curve = new THREE.CatmullRomCurve3(pts);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 0.005, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 0.06, 10), new THREE.MeshBasicMaterial({ color: 0xbfd2ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false })));
    setCam(V(0.3, 1.3, 5.6), V(2.8, 1.75, 0), 40, 0.07);
    phase = 8; focus = 5.7; aperture = 0.0012;
    ui = 'SLICE';
    break;
  }
  case 's03': {
    S.root.position.copy(HERO); S.root.rotation.y = 0.25; pose(S, STANCE);
    setCam(V(-3, 6.5, 8), V(14, 8.5, -40), 18, -0.02);
    phase = 128; focus = 30; aperture = 0.0002;
    ui = note('CRANE UP · THE MOON WANES AS YOU RISE');
    break;
  }
  case 's04': { // three-quarter full-length at the head of the path, lanterns behind
    S.root.position.set(-4.1, 0.38, -29.4); S.root.rotation.y = -0.85; pose(S, { ...STANCE, headTurn: 0.2, headTilt: -0.04 });
    setCam(V(-3.0, 1.0, -25.4), V(-4.1, 1.35, -29.4), 40);
    cam.rotateY(0.24);
    phase = 135; focus = 4.2; aperture = 0.0018;
    ui = NAV + `<div style="position:absolute;left:160px;top:230px;width:640px">
      <div class="lbl"><span class="k">人</span>About</div>
      <div style="font-size:54px;font-weight:500;letter-spacing:-.04em;line-height:1.08;margin:22px 0 30px">Backend by trade,<br>full-stack when it counts.</div>
      <div class="muted" style="font-size:17px;line-height:1.65;max-width:520px">I'm Bandana Irmal Abdillah, a software engineer based in Jakarta, Indonesia, with 4+ years of experience building digital products.</div>
      <div style="margin-top:34px;width:460px;border-bottom:1px solid #2a2a2a">${[['Based in', 'Jakarta · UTC+7'], ['Experience', '4+ years, since 2022'], ['Focus', 'Backend, full-stack']].map(([k, v]) => `<div style="display:flex;justify-content:space-between;border-top:1px solid #2a2a2a;padding:16px 0"><span class="mono" style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.06em">${k}</span><span>${v}</span></div>`).join('')}</div></div>`;
    break;
  }
  case 's05': {
    S.root.position.set(-4, 0.38, -41); S.root.rotation.y = Math.PI / 2 + Math.PI / 2; pose(S, { lean: 0.03, feet: { R: V(0.28, 0.05, 0.13), L: V(-0.22, 0.05, -0.12) } });
    setCam(V(-4.6, 1.5, -29.5), V(-3.9, 1.25, -50), 30);
    phase = 140; focus = 11.5; aperture = 0.0008;
    ui = NAV + `<div style="position:absolute;left:160px;top:150px"><div class="lbl"><span class="k">道</span>Approach</div>
      <div style="font-size:46px;font-weight:500;letter-spacing:-.04em;line-height:1.08;margin-top:20px">One clean path<br>from plan to production.</div></div>
      <div style="position:absolute;left:160px;top:560px;width:280px"><div class="mono" style="font-size:12px;color:#888">01</div><div style="font-size:26px;font-weight:500;margin:10px 0">Plan</div><div class="muted" style="font-size:15px;line-height:1.6">Requirements, architecture and risks mapped before any code.</div></div>
      <div style="position:absolute;right:300px;top:430px;width:220px;opacity:.85"><div class="mono" style="font-size:12px;color:#888">02</div><div style="font-size:22px;font-weight:500;margin:8px 0">Build</div></div>
      <div style="position:absolute;left:160px;right:160px;bottom:56px;height:1px;background:#2a2a2a"><div style="width:30%;height:1px;background:#ededed"></div></div>
      <div class="mono" style="position:absolute;right:160px;bottom:70px;font-size:11px;color:#888;letter-spacing:.1em">01 / 04</div>`;
    break;
  }
  case 's06': {
    SETS.rackG.updateMatrixWorld(true); const mw = SETS.rackG.matrixWorld;
    setCam(V(-0.2, 1.4, 2.2).applyMatrix4(mw), V(-1.05, 1.2, 0).applyMatrix4(mw), 35);
    moon.visible = halo.visible = false; rays = 0;
    focus = 2.25; aperture = 0.0022;
    const spot = new THREE.SpotLight(0xdfe6ff, 5, 8, 0.3, 0.9, 1.5); spot.position.copy(V(0.3, 3.0, -1.6).applyMatrix4(mw)); spot.target.position.copy(V(-0.3, 1.25, 0).applyMatrix4(mw)); spot.castShadow = true; scene.add(spot, spot.target);
    ui = NAV + `<div style="position:absolute;left:160px;top:150px"><div class="lbl"><span class="k">戦</span>Recent work</div>
      <div style="font-size:46px;font-weight:500;letter-spacing:-.04em;margin-top:20px">Shipped in production.</div></div>
      <div style="position:absolute;left:160px;top:330px;width:560px">${['Mobile banking backend rewrite', 'Event-driven data sync', 'Standing order platform', 'Official travel order system'].map((t, i) => `<div style="display:flex;gap:26px;align-items:baseline;border-top:1px solid #2a2a2a;padding:22px 0;${i === 0 ? '' : 'opacity:.55'}"><span class="mono" style="font-size:13px;color:${i === 0 ? '#c4453f' : '#888'}">0${i + 1}</span><span style="font-size:${i === 0 ? 28 : 22}px;font-weight:500;letter-spacing:-.02em">${t}${i === 0 ? '<div class=mono style="font-size:11px;color:#888;letter-spacing:.1em;margin-top:18px">THE RESULT</div><div style="font-size:19px;margin-top:6px">~7.6k lines of Go · 80–90% less code</div>' : ''}</span></div>`).join('')}<div style="border-top:1px solid #2a2a2a"></div></div>`;
    break;
  }
  case 's07': {
    setCam(V(31.5, 4.2, -56.5), V(29.2, 6.7, -64), 30);
    moon.visible = halo.visible = false; rays = 0;
    focus = 8.2; aperture = 0.0012;
    for (const [p, c, i] of [[V(26, 11, -60), 0xdfe6ff, 40], [V(34, 4, -67), 0x9fb0d0, 25], [V(30, 7, -60.5), 0xffffff, 6]]) { const l = new THREE.PointLight(c, i, 14, 1.4); l.position.copy(p); scene.add(l); }
    ui = NAV + `<div style="position:absolute;left:160px;top:150px"><div class="lbl"><span class="k">武</span>Toolkit</div>
      <div style="font-size:46px;font-weight:500;letter-spacing:-.04em;margin-top:20px">Tools I trust in production.</div></div>
      <div style="position:absolute;left:160px;right:160px;bottom:70px;display:grid;grid-template-columns:repeat(4,1fr);gap:40px">${[['Backend', '.NET Core · Spring Boot · Go · Node.js'], ['Frontend', 'React · Next.js · Blazor · Tailwind'], ['Database', 'PostgreSQL · SQL Server · Oracle · Cosmos · Redis'], ['DevOps & cloud', 'Docker · CI/CD · Azure · AWS']].map(([k, v], i) => `<div style="${i ? 'opacity:.5' : ''}"><div class="mono" style="font-size:12px;color:${i ? '#888' : '#ededed'};text-transform:uppercase;letter-spacing:.06em;border-top:1px solid ${i ? '#333' : '#ededed'};padding-top:14px">${k}</div><div style="font-size:16px;margin-top:10px;line-height:1.6">${v}</div></div>`).join('')}</div>`;
    break;
  }
  case 's08a': case 's08b': {
    S.root.position.copy(HERO); S.root.rotation.y = 0.25; pose(S, STANCE);
    setCam(V(-1, 3, 14), MOON_POS.clone().add(V(0, ECLIPSE ? -6 : -12, 0)), ECLIPSE ? 70 : 55);
    phase = ECLIPSE ? 180 : 0; focus = 180; aperture = 0.0001;
    if (ECLIPSE) {
      const cor = new THREE.Mesh(new THREE.RingGeometry(30.15, 31.2, 160), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
      cor.position.copy(MOON_POS); cor.lookAt(cam.position); scene.add(cor);
      const cor2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(230, 236, 255, 2.2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55, fog: false }));
      cor2.position.copy(MOON_POS).sub(cam.position.clone().sub(MOON_POS).normalize().multiplyScalar(31)); cor2.scale.setScalar(150); cor2.material.opacity = 0.9; scene.add(cor2);
      halo.visible = false;
    }
    ui = note(ECLIPSE ? '蝕 · TOTALITY · THE WORLD HOLDS ITS BREATH' : 'BLOOD MOON · THE GRADE TURNS RED', ECLIPSE ? '#8b8b8b' : '#a07070');
    break;
  }
  case 's09': {
    S.root.position.set(1.1, 0.36, 0.2); S.root.rotation.y = -1.94; pose(S, { restHand: true, lean: 0.0, kasaTilt: -0.04, feet: { R: V(0.1, 0.05, 0.15), L: V(-0.08, 0.05, -0.14) } });
    setCam(V(-2.5, 1.35, 9.5), V(-2.33, 2.05, -0.5), 24);
    phase = 0; focus = 9.8; aperture = 0.0005;
    ui = NAV + `<div style="position:absolute;left:160px;top:200px;width:900px">
      <div class="lbl"><span class="k">連</span>Contact</div>
      <div style="font-size:96px;font-weight:500;letter-spacing:-.055em;line-height:1;margin:26px 0 34px">Have something<br>that needs to ship?</div>
      <div class="muted" style="font-size:17px;line-height:1.65;max-width:500px">Tell me what you're building — or just say hello.</div>
      <div style="margin-top:40px;font-size:36px;font-weight:500;letter-spacing:-.03em;display:inline-block;border-bottom:1px solid #555;padding-bottom:8px">bandanairmal@gmail.com ↗</div></div>`;
    break;
  }
}

// atmosphere per shot, around what the camera looks at
{
  const look = new THREE.Vector3(); cam.getWorldDirection(look);
  const c = cam.position.clone().add(look.clone().setY(0).normalize().multiplyScalar(14));
  if (shot !== 's00') {
    const dens = { s03: 1.4, s08a: 0.8, s08b: 1.0, s05: 1.25, s06: 0.6, s07: 0.8 }[shot] ?? 1.15;
    fogLayers(c, 70, 10, Math.min(shot === 's03' ? 2.2 : 1.5, cam.position.y - 0.3), dens);
    dust(cam.position.clone().add(look.clone().multiplyScalar(6)), 14, 2600, Math.max(4, cam.position.y + 3));
  }
  if (S) water.material.uniforms.ripple.value.set(S.root.position.x, S.root.position.z);
  if (S) shadowAround(S.root.position.clone().setY(0), 5);
}

// moon phase
{
  const toCam = cam.position.clone().sub(MOON_POS).normalize();
  const side = V(-1, 0.25, 0).sub(toCam.clone().multiplyScalar(toCam.dot(V(-1, 0.25, 0)))).normalize();
  const a = phase * Math.PI / 180;
  moonMat.uniforms.L.value = ECLIPSE ? toCam.clone().negate() : toCam.multiplyScalar(Math.cos(a)).add(side.multiplyScalar(Math.sin(a)));
}

// ---------------- post: DOF → bloom → god rays → grade
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, cam));
if (!dbg.includes('b')) composer.addPass(new BokehPass(scene, cam, { focus, aperture: aperture * 0.6, maxblur: Math.min(maxblur, 0.0035) }));
{ const dp = new RenderPass(dustScene, cam); dp.clear = false; dp.clearDepth = true; composer.addPass(dp); }
if (!dbg.includes('u')) composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), shot === 's06' ? 0.12 : 0.35, 0.6, 0.9));
const mp = MOON_POS.clone().project(cam);
const occRT = new THREE.WebGLRenderTarget(800, 450);
{
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const moonScene = new THREE.Scene(); const mc = new THREE.Mesh(moon.geometry, moonMat); mc.position.copy(moon.position); moonScene.add(mc);
  const wv = water.visible; water.visible = false; scene.overrideMaterial = black; const fg = scene.fog; scene.fog = null;
  renderer.setRenderTarget(occRT); renderer.setClearColor(0x000000, 1); renderer.clear();
  renderer.render(scene, cam);
  renderer.autoClear = false; if (moon.visible) renderer.render(moonScene, cam); renderer.autoClear = true;
  renderer.setRenderTarget(null); scene.overrideMaterial = null; water.visible = wv; scene.fog = fg;
}
const rayPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, occ: { value: occRT.texture }, rad: { value: (() => { const e = MOON_POS.clone().add(V(0, 30, 0)).project(cam); return Math.abs(e.y - mp.y) / 2; })() }, sun: { value: new THREE.Vector2((mp.x + 1) / 2, (mp.y + 1) / 2) }, k: { value: (mp.z < 1 && moon.visible) ? rays : 0 }, tint: { value: new THREE.Color(BLOOD ? 0xff6a50 : 0xdfe6ff) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D occ; uniform vec2 sun; uniform float rad; uniform float k; uniform vec3 tint; varying vec2 vUv;
    void main(){ vec4 base = texture2D(tDiffuse, vUv);
      if (k <= 0.) { gl_FragColor = base; return; }
      vec2 d = (vUv - sun) / 90.; vec2 uv = vUv; float w = 1.; vec3 acc = vec3(0.);
      for (int i = 0; i < 90; i++) { uv -= d; vec3 s = texture2D(occ, uv).rgb; float l = dot(s, vec3(.3,.5,.2)); acc += s * l * w; w *= 0.975; }
      gl_FragColor = vec4(base.rgb + acc * tint * 0.022 * k, 1.); }`,
});
if (!dbg.includes('r')) composer.addPass(rayPass);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, red: { value: BLOOD ? 1 : 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float red; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec2 c = vUv - .5;
      vec4 col = texture2D(tDiffuse, vUv);
      col.rgb *= mix(.5, 1., smoothstep(.95, .3, length(c)*1.2));
      col.rgb += (h(vUv*vec2(1600.,900.)) - .5) * .05;
      col.rgb = mix(col.rgb, col.rgb*vec3(1.12,.86,.82), red*.5);
      col.rgb = mix(col.rgb, col.rgb*vec3(.96,1.,1.05), (1.-red)*.6);
      gl_FragColor = col; }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

await document.fonts.load('600 100px "Noto Serif JP"', '侍人道戦武連蝕');
await document.fonts.load('500 40px Geist'); await document.fonts.load('400 12px "Geist Mono"');
composer.render();

const uiEl = document.getElementById('ui');
if (ui === 'SLICE') {
  const url = renderer.domElement.toDataURL('image/png');
  const top = 'polygon(0 0,100% 0,100% 18%,0 74%)', bot = 'polygon(0 74%,100% 18%,100% 100%,0 100%)';
  uiEl.innerHTML = `<div style="position:absolute;inset:0;background:#000"></div>
    <img src="${url}" style="position:absolute;inset:0;clip-path:${top};transform:translate(-14px,-10px)">
    <img src="${url}" style="position:absolute;inset:0;clip-path:${bot};transform:translate(14px,10px);filter:brightness(.8)">
    <svg width="1600" height="900" style="position:absolute;inset:0"><line x1="-20" y1="670" x2="1620" y2="158" stroke="#fff" stroke-width="2.5"/>
    <line x1="-20" y1="670" x2="1620" y2="158" stroke="#fff" stroke-opacity=".18" stroke-width="14"/>
    <line x1="-20" y1="673" x2="1620" y2="161" stroke="#ff4a3a" stroke-opacity=".75" stroke-width="1.2"/>
    <line x1="-20" y1="667" x2="1620" y2="155" stroke="#4ad0ff" stroke-opacity=".6" stroke-width="1.2"/></svg>` + note('TIME ×0.25 · THE PAGE IS CUT ALONG THE BLADE', '#9b9b9b');
} else uiEl.innerHTML = ui;
window.__ready = true;
