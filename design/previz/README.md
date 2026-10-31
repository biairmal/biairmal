# Storyboard previz

Throwaway three.js scenes used to render the storyboard frames.

- `scene2.*` + `samurai.js` → draft 03 frames (`../storyboard-v4/frames/`). The body is three.js's
  Xbot mannequin, a stand-in for the commissioned model; the armour, sets, fog, dust, light
  shafts and water are built in code.
- `scene.*` → draft 02 frames (`../storyboard-v4/frames-02/`), built from primitives only.
- `char.*` → neutral turnaround for checking the character (`#front,stance`, `#side,cut`, …).

```bash
npm i three@0.170.0 @fontsource/noto-serif-jp @fontsource/geist @fontsource/geist-mono playwright
mkdir -p assets out && for f in models/gltf/Xbot.glb textures/water/Water_1_M_Normal.jpg textures/water/Water_2_M_Normal.jpg; do
  curl -sL -o assets/$(basename $f) https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/$f; done
python3 -m http.server 8765 &      # ES modules need http://, not file://
node render.js s00 s01 s02a s02b s03 s04 s05 s06 s07 s08a s08b s09   # → out/<shot>.png
```

The assets are downloaded rather than committed: Xbot is a Mixamo character from the three.js examples and is only used for these previz renders.
