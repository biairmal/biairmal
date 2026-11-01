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
const shot = (location.hash || '#b01').slice(1);
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
const FOG = new THREE.Color(0x160707);
scene.fog = new THREE.FogExp2(FOG, 0.012);

// ---------------- palette: cool moon, warm lamps, black timber, white paper
const WARM = new THREE.Color(0xffc985), PAPER = new THREE.Color(0xffe2b4), MOONC = new THREE.Color(0xff5a48), SEAM = 0xffd6cc;
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
    uniforms: { top: { value: new THREE.Color(0x0b0303) }, hor: { value: new THREE.Color(0x3a0e0a) } },
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 p; uniform vec3 top; uniform vec3 hor;
      float h(vec3 q){ return fract(sin(dot(q, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ vec3 n = normalize(p); float t = smoothstep(-0.02, 0.45, n.y); vec3 c = mix(hor, top, t);
        vec3 q = floor(n*520.); float s = step(0.998, h(q)) * smoothstep(0.08, 0.5, n.y) * (0.4 + 0.6*h(q+1.));
        gl_FragColor = vec4(c + s*0.5, 1.); }` });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), m));
}
const MOON_POS = V(15, 24, -320);
const moonMat = new THREE.ShaderMaterial({ fog: false, uniforms: { col: { value: new THREE.Color(0xe0503e) } },
  vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `varying vec3 p; uniform vec3 col;
    float hash(vec3 q){ return fract(sin(dot(q, vec3(127.1,311.7,74.7)))*43758.5453); }
    float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
    float fbm(vec3 q){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*noise(q); q*=2.1; a*=.5; } return s; }
    void main(){ vec3 q = normalize(p); float maria = smoothstep(.42,.8, fbm(q*0.9+3.)); float m = fbm(q*2.5);
      gl_FragColor = vec4(col*(0.85 + 0.15*m)*(1. - .2*maria)*0.95, 1.); }` });
const moon = new THREE.Mesh(new THREE.SphereGeometry(34, 64, 32), moonMat); moon.position.copy(MOON_POS); scene.add(moon);
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(230, 70, 50), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0.75 }));
halo.scale.setScalar(300); halo.position.copy(MOON_POS); scene.add(halo);

// ---------------- environment + lights
{
  const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: 0x180606, side: THREE.BackSide })));
  const spot = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 8), new THREE.MeshBasicMaterial({ color: 0xff6050 })); spot.position.copy(MOON_POS).normalize().multiplyScalar(40); es.add(spot);
  const warm = new THREE.Mesh(new THREE.PlaneGeometry(30, 6), new THREE.MeshBasicMaterial({ color: 0x8a6030, side: THREE.DoubleSide })); warm.position.set(0, 0, 40); es.add(warm);
  scene.environment = pm.fromScene(es, 0.03).texture;
}
const key = new THREE.DirectionalLight(MOONC, 1.4); key.position.copy(MOON_POS).normalize().multiplyScalar(40); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
const kc = key.shadow.camera; kc.left = -30; kc.right = 30; kc.top = 30; kc.bottom = -30; kc.near = 1; kc.far = 120; kc.updateProjectionMatrix();
key.castShadow = false;   // only the lamp inside casts shadows: his silhouette on the paper
key.target.position.set(0, 0, -8); scene.add(key, key.target);
scene.add(new THREE.HemisphereLight(0x2a100c, 0x050202, 0.35));

// ---------------- water
const loader = new THREE.TextureLoader();
const wn1 = await loader.loadAsync('assets/Water_1_M_Normal.jpg'); const wn2 = await loader.loadAsync('assets/Water_2_M_Normal.jpg');
for (const t of [wn1, wn2]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
const water = new Reflector(new THREE.PlaneGeometry(1500, 1500), { textureWidth: 1600, textureHeight: 900, clipBias: 0.002, multisample: 4, shader: {
  uniforms: { color: { value: new THREE.Color(0x3a2220) }, tDiffuse: { value: null }, textureMatrix: { value: null }, n1: { value: wn1 }, n2: { value: wn2 }, deep: { value: new THREE.Color(0x080202) }, fogC: { value: FOG } },
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

// ---------------- shared helpers from v5
const lathe = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 6);
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
          gl_FragColor = vec4(vec3(0.34,0.14,0.12), d*a*cam*edge); }` });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m); p.rotation.x = -Math.PI / 2; p.position.set(cx, y, cz); p.renderOrder = 2; scene.add(p);
  }
}

// ============================================================ v6 world: a lake under a blood moon
// layout (top view): near shore z > 18 · stepping stones · HIS STONE at z = 8 · lantern path across
// the water · far shore z < −30 with the house, the straw targets and the weapons · three mountain
// ridges and the moon beyond. Foreground reeds and a pine branch give every move parallax.
const sideOf = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

// ---------------- far layers: three ridges, lighter with distance (aerial perspective)
function ridge(z, height, color, seedR, width = 900) {
  const sh = new THREE.Shape(); const N = 120; sh.moveTo(-width / 2, -5);
  for (let i = 0; i <= N; i++) { const x = -width / 2 + (i / N) * width; const t = i / N;
    const y = height * (0.45 + 0.3 * Math.sin(t * 7 + seedR) + 0.18 * Math.sin(t * 19 + seedR * 2) + 0.07 * Math.sin(t * 53 + seedR * 3)); sh.lineTo(x, y); }
  sh.lineTo(width / 2, -5); sh.closePath();
  const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color, fog: false })); m.position.set(0, 0, z); scene.add(m); return m;
}
ridge(-300, 26, 0x2a0b09, 1.0, 1400);
ridge(-190, 20, 0x1c0706, 2.3, 1000);
ridge(-110, 13, 0x110404, 4.1, 700);

// ---------------- near shore (where the camera starts) and the far shore
box(80, 0.7, 30, M.stone, 0, 0.0, 34);
box(120, 0.8, 50, M.stone, 0, 0.0, -56);
// far shore beach strip, lighter
const sand = new THREE.Mesh(new THREE.PlaneGeometry(60, 6), new THREE.MeshStandardMaterial({ color: 0x3a3230, roughness: 1 })); sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.41, -33); scene.add(sand);

// ---------------- reeds: clusters at both shores and around the stones, and big foreground clumps
const reedGeo = new THREE.ConeGeometry(0.012, 1, 3); reedGeo.translate(0, 0.5, 0);
const reedMat = new THREE.MeshBasicMaterial({ color: 0x050202 });
function reeds(cx, cz, r, n, hMin = 0.7, hMax = 1.6) {
  const im = new THREE.InstancedMesh(reedGeo, reedMat, n); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r, h = hMin + rand() * (hMax - hMin);
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.35, 0, (rand() - 0.5) * 0.35)); sc.set(1 + rand(), h, 1 + rand());
    m4.compose(V(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d), q, sc); im.setMatrixAt(i, m4);
  }
  scene.add(im); return im;
}
reeds(-6, 19, 3, 260); reeds(7, 19.5, 2.5, 200); reeds(-2.4, 9.5, 0.9, 70, 0.4, 1.1); reeds(2.2, 6.8, 0.7, 50, 0.4, 1.0);
reeds(-14, -31, 4, 220); reeds(14, -31, 3.5, 200); reeds(-3.5, -29, 1.5, 90);
reeds(-1.9, 23.2, 0.9, 120, 1.0, 2.2); reeds(2.6, 22.6, 0.7, 90, 0.9, 1.8);   // foreground clumps

// ---------------- the pine on the near shore: its branch reaches into the top of the hero frame
const pine = new THREE.Group(); scene.add(pine);
{
  const bark = new THREE.MeshStandardMaterial({ color: 0x140c0a, roughness: 0.95 });
  const needles = new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 1 });
  const trunkPts = [V(-8, 0.3, 21), V(-7.5, 3, 20.5), V(-6.2, 5.6, 20.2), V(-4.5, 7.2, 20.6)];
  pine.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trunkPts), 30, 0.28, 10), bark));
  const branchPts = [V(-6.2, 5.6, 20.2), V(-3.5, 6.0, 19.6), V(-0.5, 5.6, 19.0), V(2.4, 5.9, 18.4)];
  pine.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(branchPts), 30, 0.11, 8), bark));
  // flat cloud-pads of needles, the classic pruned shape
  for (const [x, y, z, s] of [[-4.6, 7.6, 20.6, 1.8], [-3.0, 6.4, 19.6, 1.5], [-0.6, 6.0, 19.0, 1.7], [1.8, 6.3, 18.5, 1.4], [-6.8, 6.6, 20.4, 1.3]]) {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), needles); pad.scale.set(s, 0.32, s * 0.8); pad.position.set(x, y, z); pine.add(pad);
  }
}

// ---------------- stepping stones from the near shore to his stone; his stone sits just above the water
for (const [x, z, s] of [[0.3, 17.6, 0.7], [-0.4, 15.9, 0.65], [0.35, 14.2, 0.7], [-0.25, 12.4, 0.62], [0.2, 10.6, 0.68]]) {
  const st = new THREE.Mesh(new RoundedBoxGeometry(s * 1.4, 0.22, s * 1.1, 3, 0.08), M.stone); st.position.set(x, 0.06, z); st.rotation.y = rand(); st.receiveShadow = true; scene.add(st);
}
const HIS = V(0, 0.13, 8);
{
  const st = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.26, 1.1, 4, 0.1), M.stone); st.position.set(HIS.x, 0.0, HIS.z); st.receiveShadow = true; scene.add(st);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.065, 96), new THREE.MeshBasicMaterial({ color: SEAM, transparent: true, opacity: 0.25, toneMapped: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(HIS.x, 0.012, HIS.z); scene.add(ring);
}

// ---------------- the path across the water: planks from beyond his stone to the far shore, four lanterns
const PATH = { z0: 6.4, z1: -31, y: 0.32 };
{
  const n = Math.round((PATH.z0 - PATH.z1) / 0.34);
  const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.07, 0.3), M.plank, n); const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { m4.makeRotationY((rand() - 0.5) * 0.02).setPosition((rand() - 0.5) * 0.03, PATH.y, PATH.z0 - i * 0.34); planks.setMatrixAt(i, m4); }
  planks.receiveShadow = true; scene.add(planks);
  for (let z = PATH.z0; z > PATH.z1; z -= 2.6) for (const x of [-0.75, 0.75]) box(0.1, 0.75, 0.1, M.timberDark, x, -0.05, z).castShadow = false;
  box(0.012, 0.004, PATH.z0 - PATH.z1, M.seam, 0, PATH.y + 0.04, (PATH.z0 + PATH.z1) / 2).castShadow = false;
}
const LANTERNS6 = [[1.5, 1], [-1.5, -7], [1.5, -15], [-1.5, -23]];
for (const [x, z] of LANTERNS6) {
  box(1.0, 0.5, 1.0, M.stone, x * 1.05, 0.0, z);
  stoneLantern(x * 1.05, z, 0.95).position.y = 0.25;
  glow(x * 1.05, 1.66, z, 2.4, 0.6);
  pool(x * 0.55, PATH.y + 0.05, z, 2.1, 0.32);
  pool(x * 1.3, 0.02, z, 3.2, 0.2);
  const pl = new THREE.PointLight(WARM, 4, 8, 1.6); pl.position.set(x * 1.05, 1.7, z); scene.add(pl);
}

// ---------------- the far shore: house set back on land, facing the lake
const HOUSE6 = V(9, 0.4, -42);
{
  const h = new THREE.Group(); h.position.copy(HOUSE6); scene.add(h);
  const w = 9, d = 6, fl = 0.55, ev = 3.0;
  box(w + 1.6, 0.14, d + 1.6, M.plank, 0, fl, 0, h);
  for (let x = -w / 2; x <= w / 2 + 0.01; x += 1.5) for (const z of [-d / 2, d / 2]) box(0.18, ev - fl, 0.18, M.timber, x, (fl + ev) / 2, z, h);
  box(w + 0.3, 0.22, 0.22, M.timber, 0, ev, d / 2, h); box(w + 0.3, 0.22, 0.22, M.timber, 0, ev, -d / 2, h);
  for (let x = -w / 2 + 0.75; x < w / 2; x += 1.5) {
    const g = new THREE.Group(); g.position.set(x, (fl + ev) / 2 + 0.05, d / 2 - 0.05); h.add(g);
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(1.42, ev - fl - 0.3), Math.abs(x) < 1 ? M.paper : M.paperDim));
    for (let i = 0; i <= 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, ev - fl - 0.3, 0.03), M.lattice); b.position.x = -0.71 + i * 0.355; g.add(b); }
    for (let j = 0; j <= 7; j++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.02, 0.03), M.lattice); b.position.y = -(ev - fl - 0.3) / 2 + (j * (ev - fl - 0.3)) / 7; g.add(b); }
  }
  // hipped roof
  const ov = 1.3, rx0 = -w / 2 - ov, rx1 = w / 2 + ov, rz0 = d / 2 + ov, rz1 = -d / 2 - ov, ry0 = ev + 0.15, ry1 = ev + 2.3, inset = 2.4;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([rx0, ry0, rz0, rx1, ry0, rz0, rx1, ry0, rz1, rx0, ry0, rz1, rx0 + inset, ry1, 0, rx1 - inset, ry1, 0], 3));
  g.setIndex([0, 1, 5, 0, 5, 4, 2, 3, 4, 2, 4, 5, 1, 2, 5, 3, 0, 4]); g.computeVertexNormals();
  const roof = new THREE.Mesh(g, M.roof); roof.material.side = THREE.DoubleSide; roof.castShadow = true; h.add(roof);
  box(rx1 - rx0 - 2 * inset, 0.02, 0.02, M.seam, 0, ry1 + 0.02, 0, h).castShadow = false;
  glow(HOUSE6.x, HOUSE6.y + 1.8, HOUSE6.z + d / 2 + 0.6, 6, 0.35);
  pool(HOUSE6.x, HOUSE6.y + 0.7, HOUSE6.z + d / 2 + 0.9, 3.5, 0.3);
  const pl = new THREE.PointLight(WARM, 8, 14, 1.4); pl.position.set(HOUSE6.x, HOUSE6.y + 1.8, HOUSE6.z + d / 2 + 0.6); scene.add(pl);
}

// ---------------- WORK: four straw targets on the beach, each cut clean through on the diagonal
const TARGETS = V(-6.5, 0.41, -34);
const strawTex = canvasTex(64, 256, (x) => { x.fillStyle = '#7a6a48'; x.fillRect(0, 0, 64, 256); for (let j = 0; j < 256; j += 2) { x.fillStyle = `rgba(40,30,15,${0.2 + Math.random() * 0.3})`; x.fillRect(0, j, 64, 1); } }, true);
const straw = new THREE.MeshStandardMaterial({ map: strawTex, roughness: 0.95 });
const cutFace = new THREE.MeshStandardMaterial({ color: 0xb8a070, roughness: 0.8, emissive: 0x2a1408, side: THREE.DoubleSide });
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group(); g.position.set(TARGETS.x + i * 1.35, TARGETS.y, TARGETS.z - (i % 2) * 0.5); scene.add(g);
  box(0.5, 0.08, 0.5, M.timberDark, 0, 0.04, 0, g);
  box(0.05, 0.85, 0.05, M.timberDark, 0, 0.45, 0, g);
  const r = 0.11, hLow = 0.95 + (i % 2) * 0.1, tilt = 0.55 + i * 0.08;
  const low = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hLow, 20), straw); low.position.y = 0.3 + hLow / 2; g.add(low);
  // the cut face: an ellipse at the top, tilted on the diagonal of the cut
  const face = new THREE.Mesh(new THREE.CircleGeometry(r, 24), cutFace); face.scale.set(1, 1 / Math.cos(tilt), 1); face.rotation.set(-Math.PI / 2 + tilt, 0, 0); face.position.y = 0.3 + hLow; g.add(face);
  const seamRing = new THREE.Mesh(new THREE.TorusGeometry(r, 0.004, 4, 32), M.seam); seamRing.scale.set(1, 1 / Math.cos(tilt), 1); seamRing.rotation.copy(face.rotation); seamRing.position.copy(face.position); g.add(seamRing);
  // the severed top, lying on the sand
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.55, 20), straw); top.rotation.set(Math.PI / 2, 0, 0.5 + i * 0.7); top.position.set(0.35 * Math.cos(i * 1.7), r + 0.0, 0.35 + 0.15 * Math.sin(i)); g.add(top);
  sideOf(g);
}
{ // kagaribi: an iron fire basket on a tripod, lighting the targets
  const bx = TARGETS.x + 2.3, bz = TARGETS.z + 1.6, by = TARGETS.y;
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.25, 6), M.iron); leg.position.set(bx + Math.cos(a) * 0.18, by + 0.6, bz + Math.sin(a) * 0.18); leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); scene.add(leg); }
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.3, 10, 1, true), M.iron); basket.position.set(bx, by + 1.3, bz); basket.material = M.iron.clone(); basket.material.side = THREE.DoubleSide; scene.add(basket);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 8), new THREE.MeshBasicMaterial({ color: 0xffb060, toneMapped: false })); fire.position.set(bx, by + 1.55, bz); scene.add(fire);
  glow(bx, by + 1.55, bz, 3.2, 0.8); pool(bx - 1.2, by + 0.02, bz - 1.2, 3.6, 0.4);
  const pl = new THREE.PointLight(0xff9a50, 14, 9, 1.4); pl.position.set(bx, by + 1.7, bz); pl.castShadow = true; scene.add(pl);
}
glow(TARGETS.x + 2, 1.4, TARGETS.z - 1.2, 3.5, 0.15);

// ---------------- TOOLKIT: his weapons on the veranda, one per skill group
const ARMS = V(HOUSE6.x - 3.2, HOUSE6.y + 0.62, HOUSE6.z + 3.6);
function blade(L, w, curve) {
  const N = 40, cx = (t) => -curve * t * t, s = new THREE.Shape();
  s.moveTo(cx(0) + w / 2, 0); for (let i = 1; i <= N; i++) { const t = (i / N) * 0.93; s.lineTo(cx(t) + (w / 2) * (1 - 0.28 * t), t * L); }
  s.lineTo(cx(1) - w * 0.32, L); for (let i = N; i >= 0; i--) { const t = (i / N) * 0.97; s.lineTo(cx(t) - (w / 2) * (1 - 0.28 * t), t * L); }
  return new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.0035, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.004, bevelSegments: 2 }), M.steel);
}
function weapon(L, hilt, w, curve, drawn) {
  const g = new THREE.Group();
  const sw = new THREE.Group(); sw.add(blade(L, w, curve));
  const ts = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * (hilt > 0.2 ? 1.15 : 0.9), 0.035, 0.007, 8), M.iron); sw.add(ts);
  const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.015, hilt, 16), M.lacquer); tk.position.y = -hilt / 2; sw.add(tk);
  sw.rotation.z = -Math.PI / 2; sw.position.x = -drawn; g.add(sw);
  const saya = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.016, L + 0.04, 16), M.lacquer); saya.rotation.z = -Math.PI / 2; saya.position.x = (L + 0.04) / 2; saya.scale.set(1.3, 1, 0.75); g.add(saya);
  const koi = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0022, 6, 24), M.seam); koi.rotation.y = Math.PI / 2; g.add(koi);
  return g;
}
const arms = new THREE.Group(); arms.position.copy(ARMS); scene.add(arms);
{
  // a low lacquer stand for the three blades, the bow and quiver leaning on the post beside it
  box(1.5, 0.06, 0.4, M.lacquer, 0, 0.03, 0, arms);
  for (const x of [-0.55, 0.55]) box(0.06, 0.62, 0.24, M.lacquer, x, 0.34, 0, arms);
  const kat = weapon(0.72, 0.27, 0.031, 0.032, shot === 'b05' ? 0.18 : 0); kat.position.set(-0.5, 0.58, 0.03); arms.add(kat);
  const wak = weapon(0.5, 0.18, 0.028, 0.025, 0); wak.position.set(-0.38, 0.4, 0.03); arms.add(wak);
  const tan = weapon(0.27, 0.12, 0.026, 0.0, 0); tan.position.set(-0.2, 0.2, 0.03); arms.add(tan);
  // yumi: the tall asymmetric bow, bowstring, and a quiver of arrows
  const bowCurve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.12, 0.5, 0), V(0.05, 1.0, 0), V(0.12, 1.6, 0), V(0, 2.1, 0)]);
  const bow = new THREE.Mesh(new THREE.TubeGeometry(bowCurve, 60, 0.016, 8), M.lacquer); bow.position.set(1.1, 0.0, -0.1); bow.rotation.z = 0.12; arms.add(bow);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 2.1, 4), M.seam); string.position.set(1.1 - 0.13, 1.05, -0.1); string.rotation.z = 0.12; arms.add(string);
  const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.75, 16), M.lacquer); quiver.position.set(1.45, 0.38, 0.05); quiver.rotation.z = -0.1; arms.add(quiver);
  for (let i = 0; i < 6; i++) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 4), M.timber); a.position.set(1.45 - 0.04 + (i % 3) * 0.03 - 0.05, 0.95, 0.05 + (i < 3 ? -0.02 : 0.02)); a.rotation.z = -0.1; arms.add(a);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.09), new THREE.MeshStandardMaterial({ color: 0xd8d2c6, side: THREE.DoubleSide })); f.position.set(a.position.x - 0.025, 1.17, a.position.z); arms.add(f); }
  sideOf(arms);
}
pool(ARMS.x + 0.3, ARMS.y + 0.01, ARMS.z + 0.3, 1.8, 0.35);
glow(ARMS.x - 2.2, ARMS.y + 0.6, ARMS.z - 0.2, 2.2, 0.55);
{ const shade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.3), new THREE.MeshBasicMaterial({ color: 0xffd8a0, toneMapped: false })); shade.position.set(ARMS.x - 2.2, ARMS.y + 0.35, ARMS.z - 0.2); scene.add(shade);
  const pl = new THREE.PointLight(WARM, 4, 6, 1.4); pl.position.set(ARMS.x - 1.4, ARMS.y + 0.8, ARMS.z - 0.2); scene.add(pl); }

// ---------------- the samurai: on his stone in the water, facing the shore (and you), the moon behind him
const gltf = await new GLTFLoader().loadAsync('assets/ronin_rig.glb');
const sam = gltf.scene; sam.position.copy(HIS); scene.add(sam);
const charMat = { def: new THREE.MeshStandardMaterial({ color: 0x0c0a0a, roughness: 0.85 }), lacquer: new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.32, clearcoat: 1 }),
  silk: new THREE.MeshStandardMaterial({ color: 0xbdb9b1, roughness: 0.6 }), steel: new THREE.MeshStandardMaterial({ color: 0x9a9ca0, roughness: 0.4, metalness: 1 }), seam: new THREE.MeshBasicMaterial({ color: SEAM, toneMapped: false }) };
sam.traverse((o) => { if (o.isMesh) { const n = o.material.name; o.material = n.includes('blade') ? charMat.steel : n.includes('seam') ? charMat.seam : n.includes('silk') || n.includes('hair') || n.includes('bead_light') ? charMat.silk : n.includes('lacquer') || n.includes('kasa') ? charMat.lacquer : charMat.def; o.castShadow = true; o.frustumCulled = false; } });
const mixer = new THREE.AnimationMixer(sam);
{ const a = mixer.clipAction(gltf.animations.find((c) => c.name === 'idle')); a.play(); a.paused = true; a.time = 0.5; mixer.update(0); }
// a red rim from the moon behind him, and a faint warm fill from the shore lantern
const rim = new THREE.SpotLight(0xff4a3a, 14, 30, 0.35, 0.6, 1.2);
const fillLamp = new THREE.PointLight(0xffb070, 6, 8, 1.5); fillLamp.position.set(HIS.x + 1.8, 1.5, HIS.z + 3); scene.add(fillLamp); rim.position.set(HIS.x + 1.5, 6, HIS.z - 9); rim.target.position.set(HIS.x, 1.2, HIS.z); scene.add(rim, rim.target);
const shoreLamp = V(4.2, 0.35, 19.5);
stoneLantern(shoreLamp.x, shoreLamp.z, 0.8).position.y = 0.35; glow(shoreLamp.x, 1.55, shoreLamp.z, 2.0, 0.55); pool(shoreLamp.x, 0.4, shoreLamp.z, 2.4, 0.3);
{ const pl = new THREE.PointLight(WARM, 4, 12, 1.4); pl.position.set(shoreLamp.x, 1.6, shoreLamp.z); scene.add(pl); }

// ---------------- mist + dust
mist(0, -6, 110, 9, 1.3, 0.07);
{
  const count = 2400, pos = new Float32Array(count * 3), sz = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos[i * 3] = (rand() - 0.5) * 40; pos[i * 3 + 1] = rand() * 9; pos[i * 3 + 2] = 26 - rand() * 64; sz[i] = 0.6 + rand() ** 3 * 3; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { moon: { value: MOON_POS } },
    vertexShader: `attribute float sz; varying float vA; uniform vec3 moon; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv;
      float d = -mv.z; float near = smoothstep(2.5, 0.6, d); gl_PointSize = min(sz * 14. / d * (1. + near*5.), 70.);
      float fwd = pow(max(dot(-normalize(cameraPosition - position), normalize(moon - position)), 0.), 6.);
      vA = (0.2 + 1.4*fwd) * smoothstep(0.9, 1.8, d) * (1. - smoothstep(25., 55., d)) / (1. + near*12.); }`,
    fragmentShader: 'varying float vA; void main(){ float r = length(gl_PointCoord-.5); float a = 1. - smoothstep(0., .5, r); gl_FragColor = vec4(vec3(1.0,0.62,0.55), a*a*vA); }' });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; dustScene.add(pts);
}

// ============================================================ shots
const cam = new THREE.PerspectiveCamera(35, W / H, 0.05, 3000);
const mm = (f) => (2 * Math.atan(12 / f) * 180) / Math.PI;
const setCam = (p, t, f, roll = 0) => { cam.position.copy(p); cam.fov = mm(f); cam.lookAt(t); cam.rotateZ(roll); cam.updateProjectionMatrix(); };
let focus = 15, aperture = 0.0004, ui = '';
const NAV = `<div class="nav"><span style="display:flex;gap:14px;align-items:center"><span class="jp" style="font-size:22px;font-weight:600">侍</span><span style="opacity:.2">|</span><span class="mono" style="font-size:18px">biairmal<span style="display:inline-block;width:8px;height:18px;background:#ededed;margin-left:3px;vertical-align:-3px"></span></span></span><span style="display:flex;gap:36px;align-items:center;color:#c8c8c8">Home<span>Contacts</span><span>Blogs</span><span style="border:1px solid #444;padding:14px 22px;color:#ededed">Let's talk</span></span></div>`;
const head = HIS.clone().add(V(0, 1.55, 0));
switch (shot) {
  case 'b01': case 'b01p': { // hero: from the shore, through the reeds, him on the water under the blood moon
    const dx = shot === 'b01p' ? 2.4 : 0;
    setCam(V(-0.6 + dx, 0.95, 21.5), V(-2.2 + dx * 0.1, 3.4, -20), 48);
    focus = 13.5; aperture = 0.0007;
    ui = NAV + `<div style="position:absolute;left:160px;top:270px;width:560px">
      <div class="lbl"><span style="width:7px;height:7px;background:#c4453f"></span>Available for freelance work</div>
      <div style="font-size:66px;font-weight:500;letter-spacing:-.045em;line-height:1.04;margin:28px 0 24px">Every line of code,<br>a deliberate cut.</div>
      <div class="muted" style="font-size:18px;line-height:1.65;max-width:470px">I'm Bandana, a software engineer who owns the whole path — from the first plan to a stable production release.</div></div>`;
    if (shot === 'b01p') ui = `<div class="mono" style="position:absolute;left:60px;bottom:46px;font-size:12px;letter-spacing:.2em;color:#a07070">PARALLAX · SAME SHOT, CAMERA 2.4 M TO THE RIGHT</div>`;
    break;
  }
  case 'b02': { // about: him, close, with his reflection
    setCam(V(1.4, 0.32, 13.4), HIS.clone().add(V(-0.75, 0.75, 0)), 32);
    focus = cam.position.distanceTo(head); aperture = 0.0022;
    ui = NAV + `<div style="position:absolute;left:160px;top:230px;width:600px"><div class="lbl"><span class="k">人</span>About</div>
      <div style="font-size:52px;font-weight:500;letter-spacing:-.04em;line-height:1.08;margin:22px 0 28px">Backend by trade,<br>full-stack when it counts.</div>
      <div class="muted" style="font-size:17px;line-height:1.65;max-width:500px">I'm Bandana Irmal Abdillah, a software engineer based in Jakarta, Indonesia, with 4+ years of experience building digital products.</div></div>`;
    break;
  }
  case 'b03': { // approach: past him, down the lantern path toward the far shore
    setCam(V(0.75, 1.45, 5.2), V(0.1, 1.5, -32), 30);
    focus = 6; aperture = 0.0006;
    ui = NAV + `<div style="position:absolute;left:160px;top:150px"><div class="lbl"><span class="k">道</span>Approach</div><div style="font-size:44px;font-weight:500;letter-spacing:-.04em;line-height:1.08;margin-top:18px">One clean path<br>from plan to production.</div></div>
      <div style="position:absolute;left:160px;right:160px;bottom:56px;height:1px;background:#2a2a2a"><div style="width:25%;height:1px;background:#ededed"></div></div>
      <div class="mono" style="position:absolute;right:160px;bottom:70px;font-size:11px;color:#888;letter-spacing:.1em">01 PLAN / 04</div>`;
    break;
  }
  case 'b04': { // work: the cut targets on the beach
    setCam(V(TARGETS.x + 5.4, 1.4, TARGETS.z + 5.2), V(TARGETS.x + 1.2, 0.9, TARGETS.z - 0.3), 36);
    focus = 5.2; aperture = 0.0018;
    ui = NAV + `<div style="position:absolute;left:160px;top:150px"><div class="lbl"><span class="k">戦</span>Recent work</div><div style="font-size:44px;font-weight:500;letter-spacing:-.04em;margin-top:18px">Shipped in production.</div></div>
      <div style="position:absolute;left:160px;top:320px;width:520px">${['Mobile banking backend rewrite', 'Event-driven data sync', 'Standing order platform', 'Official travel order system'].map((t, i) => `<div style="display:flex;gap:24px;align-items:baseline;border-top:1px solid #2a2a2a;padding:20px 0;${i === 0 ? '' : 'opacity:.55'}"><span class="mono" style="font-size:13px;color:${i === 0 ? '#c4453f' : '#888'}">0${i + 1}</span><span style="font-size:${i === 0 ? 26 : 21}px;font-weight:500;letter-spacing:-.02em">${t}</span></div>`).join('')}</div>`;
    break;
  }
  case 'b05': { // toolkit: his weapons, one per skill group
    setCam(V(ARMS.x + 0.2, ARMS.y + 0.95, ARMS.z + 3.1), V(ARMS.x + 0.3, ARMS.y + 0.8, ARMS.z), 32);
    M.paper.emissiveIntensity = 0.32;
    focus = 3.1; aperture = 0.0016;
    const groups = [['Backend', 'Katana', '.NET · Spring · Go · Node'], ['Frontend', 'Wakizashi', 'React · Next.js · Blazor · Tailwind'], ['Database', 'Tantō', 'PostgreSQL · SQL Server · Oracle · Redis'], ['DevOps & cloud', 'Yumi', 'Docker · CI/CD · Azure · AWS']];
    ui = NAV + `<div style="position:absolute;left:160px;top:150px"><div class="lbl"><span class="k">武</span>Toolkit</div><div style="font-size:44px;font-weight:500;letter-spacing:-.04em;margin-top:18px">Tools I trust in production.</div></div>
      <div style="position:absolute;left:160px;right:160px;bottom:64px;display:grid;grid-template-columns:repeat(4,1fr);gap:32px">${groups.map(([g, w, t], i) => `<div style="${i ? 'opacity:.55' : ''}"><div class="mono" style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;border-top:1px solid ${i ? '#555' : '#ededed'};padding-top:10px">${g} <span style="color:#c4453f">· ${w}</span></div><div style="font-size:14px;margin-top:8px;color:#bbb">${t}</div></div>`).join('')}</div>`;
    break;
  }
  case 'b06': { // contact: crane up and back over the near shore: the whole lake
    setCam(V(-2.5, 3.6, 33), V(1.5, 2.6, -25), 30);
    focus = 40; aperture = 0.0001;
    ui = NAV + `<div style="position:absolute;left:160px;top:210px;width:820px"><div class="lbl"><span class="k">連</span>Contact</div>
      <div style="font-size:84px;font-weight:500;letter-spacing:-.055em;line-height:1;margin:24px 0 30px">Have something<br>that needs to ship?</div>
      <div style="margin-top:34px;font-size:32px;font-weight:500;letter-spacing:-.03em;display:inline-block;border-bottom:1px solid #555;padding-bottom:8px">bandanairmal@gmail.com ↗</div></div>`;
    break;
  }
  case 'map': {
    const o = new THREE.OrthographicCamera(-46, 46, 25.9, -25.9, 0.1, 400); o.position.set(0, 120, -8); o.up.set(1, 0, 0); o.lookAt(0, 0, -8); window.__ortho = o;
    scene.fog = null; aperture = 0; break;
  }
}

// ---------------- post
const activeCam = window.__ortho || cam;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, activeCam));
if (aperture > 0) composer.addPass(new BokehPass(scene, cam, { focus, aperture: aperture * 0.6, maxblur: 0.0035 }));
{ const dp = new RenderPass(dustScene, activeCam); dp.clear = false; dp.clearDepth = true; composer.addPass(dp); }
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.5, 0.65, 0.78));
composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); c.rgb *= mix(.5, 1., smoothstep(.95, .3, length(vUv-.5)*1.2)); c.rgb += (h(vUv*vec2(1600.,900.))-.5)*.04; gl_FragColor = c; }` }));
composer.addPass(new OutputPass());
await document.fonts.load('600 100px "Noto Serif JP"', '侍人道戦武連'); await document.fonts.load('500 40px Geist'); await document.fonts.load('400 12px "Geist Mono"');
composer.render();
const uiEl = document.getElementById('ui');
if (shot === 'map') {
  const o = window.__ortho; const proj = (v) => { const p = v.clone().project(o); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]; };
  const path = [[-1.4, 25.5, '01'], [1.9, 12.4, '02'], [0.75, 5.2, '03'], [TARGETS.x + 3.6, TARGETS.z + 4.4, '04'], [ARMS.x + 0.9, ARMS.z + 2.6, '05'], [-10, 40, '06']];
  const pts = path.map(([x, z]) => proj(V(x, 0, z)));
  let svg = `<svg width="1600" height="900" style="position:absolute;inset:0"><polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#ff6a5a" stroke-width="2" stroke-dasharray="7 6"/>`;
  pts.forEach(([x, y], i) => { svg += `<circle cx="${x}" cy="${y}" r="14" fill="#0a0a0a" stroke="#ededed"/><text x="${x}" y="${y + 4}" fill="#ededed" font-family="Geist Mono" font-size="11" text-anchor="middle">${path[i][2]}</text>`; });
  const lab = [['NEAR SHORE · PINE · REEDS', V(-6, 0, 24)], ['HIS STONE', V(4.2, 0, 8)], ['LANTERN PATH', V(4.5, 0, -10)], ['TARGETS', V(-6, 0, -38)], ['HOUSE · WEAPONS', V(9, 0, -47)], ['MOON + RIDGES →', V(0, 0, -46)]];
  lab.forEach(([t, p]) => { const [x, y] = proj(p); svg += `<text x="${x}" y="${y}" fill="#e0c8c4" font-family="Geist Mono" font-size="12" letter-spacing="1.5" text-anchor="middle">${t}</text>`; });
  uiEl.innerHTML = svg + `</svg><div class="mono" style="position:absolute;left:40px;top:30px;font-size:12px;letter-spacing:.2em;color:#a08080">WORLD PLAN · TOP VIEW · RED = CAMERA PATH</div>`;
} else uiEl.innerHTML = ui;
window.__ready = true;
