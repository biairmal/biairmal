import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildSamurai, makeMaterials, pose } from './samurai.js';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const [view, pz] = (location.hash.slice(1) || 'front,stance').split(',');
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(1600, 900); r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true;
document.getElementById('stage').prepend(r.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x3a3d44);
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5;
const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(3, 5, 4); key.castShadow = true; scene.add(key);
const rim = new THREE.DirectionalLight(0xdde6ff, 3); rim.position.set(-4, 3, -4); scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x55585e })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const gltf = await new GLTFLoader().loadAsync('assets/Xbot.glb');
const M = makeMaterials();
const S = buildSamurai(gltf, M); scene.add(S.root);
const P = {
  stance: { lean: 0.08, drop: 0.05, feet: { R: V(0.3, 0.05, 0.14), L: V(-0.28, 0.05, -0.12) } },
  koiguchi: { sword: 'koiguchi', lean: 0.15, drop: 0.08, headTilt: -0.15, feet: { R: V(0.32, 0.05, 0.14), L: V(-0.3, 0.05, -0.12) } },
  cut: { lean: 0.22, drop: 0.16, sword: { grip: V(0.62, 1.42, 0.14), dir: V(0.6, 0.76, 0.2), edge: V(0.3, -0.3, 1) }, feet: { R: V(0.62, 0.05, 0.16), L: V(-0.45, 0.05, -0.14) }, poleR: V(0, 1.0, 1.2) },
  rest: { restHand: true, lean: 0.0, feet: { R: V(0.12, 0.05, 0.14), L: V(-0.1, 0.05, -0.14) } },
}[pz];
pose(S, P);
const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 100);
const vp = { front: [V(4.2, 1.3, 1.6), V(0, 1.05, 0)], side: [V(0.3, 1.2, 4.4), V(0, 1.05, 0)], back: [V(-3.5, 1.5, -2.5), V(0, 1.05, 0)], face: [V(1.05, 1.65, 0.35), V(0, 1.6, 0)] }[view];
cam.position.copy(vp[0]); cam.lookAt(vp[1]);
r.render(scene, cam);
{ const g = (n) => S.bone[n].getWorldPosition(new THREE.Vector3()); const h = g('Head'), e = g('LeftEye'), rh = g('RightHand'), ra = g('RightArm');
  console.log('eye-head', e.sub(h).toArray().map(v=>v.toFixed(3)).join(','), 'rightArm', ra.toArray().map(v=>v.toFixed(2)).join(',')); }
window.__ready = true;
