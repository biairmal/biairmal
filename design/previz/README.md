# Storyboard previz

Throwaway three.js scene used to render the storyboard frames in `../storyboard-v4/frames/`.
Everything is built from primitives as a stand-in for the real art: the samurai, sword, moon, lanterns, sword rack and tsuba.

```bash
npm i three@0.170.0 @fontsource/noto-serif-jp @fontsource/geist @fontsource/geist-mono playwright
python3 -m http.server 8765 &      # ES modules need http://, not file://
node render.js s00 s01 s02a s02b s03 s04 s05 s06 s07 s08a s08b s09   # → out/<shot>.png
```

Each shot id maps to a `case` in `scene.js` that sets the camera, the samurai's pose and the UI overlay.
