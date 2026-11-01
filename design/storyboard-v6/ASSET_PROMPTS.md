# Storyboard v6 · "The Blood Moon Lake" · asset generation prompts

Prompts and specs for every asset the `/experimental` v6 scene needs. Generate them with your tool of choice, export with the specs in section 1, and drop the files into the paths in section 6. The engine already handles lighting, water, mist, dust, fog and glow, so **don't bake lighting, a red tint or the moon into any asset**.

Reference frames: `design/storyboard-v7/frames/` (c01–c06, map; the current layout) and `design/storyboard-v6/frames/`. Attach them as image references wherever your tool allows.

---

## 0. Shared style block (prepend to every prompt)

> Stylised-realistic Japanese Edo-period aesthetic, cinematic and restrained. Physically based materials with neutral, un-tinted albedo. A monochrome palette: black lacquer, charcoal timber, grey stone, off-white paper and silk. Subtle wear and age: worn edges, faint dust, fine surface detail in the normal maps rather than the geometry. Clean, game-ready topology. No text, logos or signatures. No baked lighting, no ambient occlusion in the albedo, no coloured light. Neutral studio presentation on a plain grey background.

**Shared negative prompt** (for tools that accept one):

> cartoon, chibi, anime, toy, plastic, low-poly faceted look, oversaturated, neon, sci-fi, fantasy armour, gold, dragons, ornate filigree, baked shadows, coloured lighting, red tint, text, watermark, logo, blurry texture, noisy topology, floating geometry, non-manifold mesh

---

## 1. Technical spec (all assets)

| Item | Requirement |
|---|---|
| Format | glTF 2.0 binary (`.glb`). PBR metallic-roughness. One file per asset. |
| Units / axes | 1 unit = 1 metre. Y up, the asset's front faces **+Z**. |
| Pivot | At the base centre, on the ground (y = 0), unless a note says otherwise. |
| Scale | Real-world size (sizes given per asset). |
| Textures | Base colour (sRGB), normal (OpenGL / +Y), packed ORM (R = AO, G = roughness, B = metalness). Emissive only where noted. Power-of-two sizes. |
| Texture size | Hero assets 2048 px, props 1024 px, small items 512 px. |
| Material names | Use the names given per asset. The engine swaps or tweaks materials **by name** (for example, for emissive windows or light seams). |
| Two levels of detail | **LOD0 (desktop)** at the triangle budget given. **LOD1 (phone)** at about 25–30% of it, with the same UVs and materials, exported as `name-mobile.glb`. |
| Transparency | Avoid it except for paper and the reed cards. Use alpha-clip (mask), not blend. |
| Clean-up | Apply transforms, no hidden or duplicate geometry, no n-gons, merged by material where possible. |

---

## 2. Character

### 2.1 The ronin: `ronin.glb` · rigged and animated

**Budget:** 45k triangles LOD0 / 12k LOD1 · 4 × 2048 texture sets (body cloth, gear, head, weapons)

**Prompt**

> Full-body 3D character of a lone Japanese ronin swordsman, 1.75 m tall, standing in a relaxed, ready A-pose. No armour. He wears layered, worn clothing, all in black and charcoal:
> - A long sleeveless outer coat (haori-style vest) to mid-shin, with a ragged, frayed hem, side slits, and a soft rolled hood collar around the neck.
> - A dark kimono with wide sleeves underneath, with a slightly lighter grey under-collar crossing left over right at the chest.
> - Loose dark hakama-style trousers gathered at the shin into spiral cloth leg wraps (kyahan), dark tabi socks and straw waraji sandals.
> - Wrapped forearms and dark fingerless gloves.
> - At the waist, a dark obi with a thick twisted grey rope belt tied in a hanging knot at the front left, a loop of prayer beads (juzu: mostly black, with every ninth bead off-white), and a small cloth pouch at the right hip.
> - A katana and a wakizashi thrust through the belt at the left hip, hilts forward and angled down-back. Black lacquer scabbards, black iron tsuba, hilts wrapped in dark silk cord, and white sageo cords with small tassels.
> - On his head: a wide, shallow, ribbed conical straw hat (kasa) lacquered black, with a slightly drooping brim and thin chin cords. Under it, a black lacquered menpō face mask covering nose, cheeks and chin, with a stern down-turned mouth, a white horsehair moustache and a red-lacquered interior. A dark hood covers the head under the hat, so no skin is visible.
>
> Fabric with fine weave, frayed edges, dusty worn patches and realistic fold detail in the normal maps. Matte cloth contrasted with glossy lacquer.

**Rig and animation**
- Humanoid skeleton, Mixamo / Unreal-compatible bone naming (hips, spine ×3, neck, head, arms with fingers, legs with toes).
- Extra bones:
  - `katana` and `saya`, so the sword can be drawn from the scabbard. The katana needs a **full steel blade** hidden inside the saya.
  - Cloth chains: `coat_0`…`coat_5`, six chains of four bones each, hanging around the coat skirt. `sleeve_L`/`sleeve_R`, two-bone chains under each sleeve. The engine simulates these live.
- Skin weights clean at the shoulders, hips and knees, with the cloth weighted to the chains.
- **Animations** (30 fps, in place, no root motion):
  - `idle` (required): a 4–6 s loop. Calm breathing, a subtle weight shift, the left hand resting on the scabbard by the tsuba.
  - `iai` (required): ~6 s. The thumb breaks the scabbard seal, a step forward as he draws, a **rising diagonal cut from the left hip to above the right shoulder**, a hold, a blade flick, then a slow re-sheathe. Mocap preferred.

**Materials** (names): `cloth_vest`, `cloth_kimono`, `cloth_under`, `cloth_trousers`, `cloth_wraps`, `cloth_obi`, `rope`, `bead_dark`, `bead_light`, `kasa_lacquer`, `lacquer_black`, `lacquer_red` (mask interior), `horsehair`, `silk`, `ito_wrap`, `iron`, `blade_steel`, `seam_light`.

**Light seams:** add thin emissive strips (material `seam_light`, white, emissive 1.0) along:
- the kasa rim
- the front edges of the coat
- the mask's mouth slit
- the scabbard mouths (koiguchi)

They should be hairline-thin, about 1–2 mm.

---

## 3. Environment props

### 3.1 Stone lantern (tōrō): `lantern.glb`
**Budget:** 3k / 800 · 1024 px

> A traditional Japanese stone lantern (kasuga-dōrō style), 2.1 m tall. A hexagonal base, a slender round post, a platform, a square light box (hibukuro) with open windows on all four sides, a wide hexagonal roof with gently upturned corners, and a jewel finial. Weathered grey granite with moss in the crevices, chipped edges and water staining near the base.

Pivot at the base. Name the inside faces of the light box `lantern_window` (it will be emissive warm light). Add an empty or node named `light_anchor` at the centre of the light box.

### 3.2 Lantern footing: `lantern_base.glb`
**Budget:** 600 / 200 · 512 px

> A low square block of rough-cut dark granite, 1.0 × 0.5 × 1.0 m, standing in water. Wet-looking lower third (darker, glossier), algae line at the waterline, rough chiselled top.

### 3.3 Stepping stones: `stepping_stones.glb` (5 variants in one file)
**Budget:** 400 each / 120 · 1024 px shared

> Five flat natural river stones for crossing water, each about 0.8–1.0 m across and 0.2 m thick. Irregular rounded shapes, smooth worn tops, rougher wet sides, dark grey granite with subtle lighter flecks.

Name them `step_0` to `step_4`.

### 3.4 His stone: `his_stone.glb`
**Budget:** 800 / 250 · 1024 px

> One larger flat standing stone emerging just above still water, 1.3 × 0.26 × 1.1 m. A smooth, slightly concave top where a person stands, worn soft by time, and darker wet sides. Dark granite.

Pivot at the waterline, with the top surface at y = 0.13.

### 3.5 Lantern walkway: `walkway_segment.glb`
**Budget:** 2k / 600 · 1024 px

> A 5.2 m long segment of a low wooden walkway over water: weathered cedar planks 1.5 m wide laid across two beams, on four round wooden posts going down into the water. Grey, sun-bleached, slightly warped planks with nail heads and gaps between boards. Dark, wet posts with an algae line.

The segment must **tile end-to-end along Z**. Add a hairline groove down the centre of the planks. Name its faces `seam_light`.

### 3.6 House on the far shore: `house.glb`
**Budget:** 25k / 6k · 2048 px

> A small, simple traditional Japanese wooden house (minka / teahouse), 9 m wide, 6 m deep, set on low stone footings with an engawa veranda along the front. Dark charred timber posts and beams (yakisugi). A front wall of six sliding shōji panels with a black wooden lattice and off-white paper. A hipped roof with deep eaves, dark grey ceramic tiles and a ridge. Two stone steps up to the veranda. Restrained, rustic, weathered.

Name the shōji paper `paper` (it will be emissive). Name the lattice `lattice`. Name the two centre panels `door_L` and `door_R` as separate objects. The interior can be an empty dark box. Name the ridge line `seam_light`.

### 3.7 Weapon stand with weapons: `weapons.glb`
**Budget:** 12k / 3k · 2048 px

> A low black-lacquered wooden sword stand (katanakake) with three horizontal tiers, 1.5 m wide. Resting on it, from top to bottom:
> - a **katana** (blade length 0.72 m) in a black lacquer scabbard
> - a **wakizashi** (0.50 m)
> - a **tantō** (0.27 m)
>
> Each has a black iron tsuba, a hilt wrapped in dark silk cord over white rayskin, and a thin silver ring at the scabbard mouth. Leaning on the right of the stand: a **yumi**, the tall asymmetric Japanese longbow (2.1 m), black lacquered bamboo with a taut white string. Beside it, a black lacquer quiver (yebira) holding six arrows with white fletching.

Make each weapon a separate object: `katana`, `wakizashi`, `tanto`, `yumi`, `quiver`. Each blade must exist **inside its scabbard as a separate mesh** (`*_blade`), so it can slide out. Pivot the stand at its base centre.

### 3.8 Tameshigiri targets: `targets.glb`
**Budget:** 1.5k each / 400 · 1024 px shared

> A test-cutting target for Japanese swordsmanship (tameshigiri): a tightly rolled straw tatami-omote mat, 0.22 m in diameter, standing upright on a simple wooden stand with a square base and a vertical spike. The mat has been **cut cleanly through on a steep diagonal**. The lower part stands on the stand, showing a crisp, pale cut face with visible straw layers. The severed upper section lies on the sand beside it.

Provide four variations with different cut heights and angles, and the fallen tops at different rotations: `target_0` to `target_3`. Name the cut faces `cut_face`.

### 3.9 Kagaribi (fire basket): `brazier.glb`
**Budget:** 2k / 600 · 1024 px

> A traditional Japanese iron fire basket (kagaribi): an open cage basket of forged iron straps on top of a tall tripod of three iron legs, 1.6 m tall in total. Charcoal and split wood inside. Blackened, rusted, heat-discoloured iron.

Leave the flames out. The engine adds the fire. Add a node named `fire_anchor` at the top of the fuel.

### 3.10 Pine tree: `pine.glb`
**Budget:** 15k / 4k · 2048 px (bark) + 1024 px (needle cards)

> A windswept Japanese black pine (kuromatsu) growing on a lakeshore, 8–16 m tall. A thick, twisted, leaning trunk with deeply fissured dark bark. Foliage pruned into flat, layered cloud-pads (niwaki style), made of alpha-clipped needle cards.

Make 3–4 variants with different heights and leans (pine_0 … pine_3). They stand in a line on the far shore, silhouetted against the blood moon in the Contact shot, so the outline matters most.

### 3.11 Reed clumps: `reeds.glb` (3 variants)
**Budget:** 1.5k each / 500 · 1024 px (alpha-clipped cards)

> Clumps of tall wetland reeds (ashi / common reed) growing from shallow water. Thin vertical stalks 0.7–2.2 m tall, some bent, some with feathery seed heads at the top. Dark and dry, almost black-brown.

Name them `reeds_small`, `reeds_medium` and `reeds_tall`. Pivot at the water level. They render mostly as silhouettes, so the outline matters more than the texture.

---

## 4. Backdrops and textures (2D)

### 4.1 Mountain ridges: `ridge_near.png`, `ridge_mid.png`, `ridge_far.png`
4096 × 1024, transparent PNG, silhouette only.

> A horizontal panoramic silhouette of forested Japanese mountain ridges at night, flat solid shape only, with a soft irregular top edge, a few pine-tree bumps and gentle saddles. Pure black on a transparent background, no detail inside the shape, no sky, no moon, tileable horizontally.

Generate three with different profiles: near = taller and jagged, mid = rolling, far = low and smooth. The engine tints them for aerial perspective.

### 4.2 Moon surface: `moon_albedo.jpg`
2048 × 1024, equirectangular.

> An equirectangular texture map of the full moon's surface: maria, craters and highlands, in neutral grey tones, evenly lit with no shadows or terminator. Seamless at the left and right edges.

Keep it grey. The engine colours it blood red.

### 4.3 Water normals: `water_normal_1.jpg`, `water_normal_2.jpg`
1024 × 1024, tileable.

> A seamless tileable normal map of a calm lake surface with gentle wind ripples, OpenGL format.

Make 1 broad and soft, and 2 finer and more choppy.

### 4.4 Ground: `sand_*.jpg`, `shore_rock_*.jpg`
1024, tileable PBR sets (albedo, normal, ORM).

> Damp dark lakeshore sand with small pebbles and footprints washed smooth.

> Wet dark granite shoreline rock, rough, with water staining.

---

## 5. Optional: audio

All of these are loopable or one-shot, 48 kHz, mono except where noted.

- **Ambient bed:** night lake ambience, still water lapping softly, distant wind through reeds, occasional insects. Loop, 60 s, stereo.
- **Fire:** a crackling wood fire in an iron brazier, close. Loop, 20 s.
- **Sword draw:** a katana drawn from a lacquered wooden scabbard, a soft metallic hiss. One-shot.
- **Cut:** a sharp blade cutting through rolled straw, a single clean swish and thud. One-shot.
- **Re-sheathe:** a sword slowly slid home into its scabbard, ending in a soft click. One-shot.

---

## 6. Delivery: where the files go

Put the generated files in the website repo, under `public/experimental/v6/`:

```
public/experimental/v6/
  ronin.glb              ronin-mobile.glb
  lantern.glb            lantern-mobile.glb
  lantern_base.glb
  stepping_stones.glb
  his_stone.glb
  walkway_segment.glb
  house.glb              house-mobile.glb
  weapons.glb            weapons-mobile.glb
  targets.glb
  brazier.glb
  pine.glb (3–4 variants)  pine-mobile.glb
  reeds.glb
  ridge_near.png  ridge_mid.png  ridge_far.png
  moon_albedo.jpg
  water_normal_1.jpg  water_normal_2.jpg
  audio/ (optional)
```

**Total download budget:** ≤ 6 MB on desktop and ≤ 2.5 MB on phones after compression. Before committing I'll run every model through `gltf-transform` (weld, simplify, quantize, meshopt, and KTX2 textures), so export uncompressed if your tool gives you the choice.

### Checklist before handing over
- [ ] Every model is a real-world size in metres, Y-up, faces +Z, with its pivot at the base.
- [ ] The material and object names match this document (the engine looks them up by name).
- [ ] No baked lighting, red tint or moon colour in any texture.
- [ ] The ronin: the `idle` clip loops cleanly, the `iai` clip is included, `katana_blade` exists inside the scabbard, and the cloth chain bones are present.
- [ ] The `-mobile` versions exist for ronin, lantern, house, weapons and pine.
- [ ] The walkway segment tiles seamlessly along Z.
