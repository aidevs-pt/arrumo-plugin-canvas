# Writing canvas layers

A canvas layer is worth its cost when it shows something the other layers can't: depth, many moving
parts, data that builds, or a designed vector animation. Keep titles, labels and cards in text and box
layers, which stay sharper and are cheaper to change.

## How a frame is made

- `window.render(t)` draws the frame `t` seconds after the layer starts. Compute everything from
  `t`: positions, rotations, how much of a line is drawn, which items have arrived. Never add to a value
  each frame, because frames are drawn in any order and the same frame may be drawn twice.
- Run setup once at the top level of the script: build scenes, load data, create elements. When setup
  waits for something, put that promise in `window.arrumoReady`.
- Read `arrumo.width` and `arrumo.height` for the size in pixels and lay everything out from them.
  The layer is drawn again for portrait, square and landscape videos and for small previews.
- The page background is transparent. Leave it clear so the animation sits on the design behind it,
  unless the layer is meant to cover its whole box.

## Motion that reads well

- Ease every movement. `const ease = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);` gives
  a smooth arrival; map a time window onto it, such as `ease((t - 0.4) / 0.8)` for a move that starts
  at 0.4 s and lasts 0.8 s.
- Stagger groups: start each item 0.05 to 0.12 s after the previous one.
- Let the main movement finish by the middle of the layer, then hold or drift slowly, so viewers have
  time to look.
- Prefer one focal object. Two or three supporting motions are plenty.
- Draw in the video's colours: `arrumo.theme` has `colors` (the brand palette), `background`, `text`
  and `accent`, also as the CSS variables `--arrumo-background`, `--arrumo-text`, `--arrumo-accent`
  and `--arrumo-color-1` onwards. Set text in the fonts `brand-heading` and `brand-body`.

## Presets and shader effects

Two libraries hold ready-made pieces drawn in the video's colours and fonts. Reach for one when it
is what the scene needs, and adapt it: change its options, combine several, or lay your own drawing
over it. They are a head start, not a menu. When none fits, or a bespoke piece would be stronger,
write your own code with any library or none.

`motion` presets each take an element and options and answer a `render(t)`:

```html
<script type="module">
import { terminal, chatPrompt, combine } from "motion";
window.render = combine(
  terminal(document.body, { lines: [{ text: "npm run build", type: "command" }, { text: "Done", type: "success" }] }),
);
</script>
```

Shared options: `color`, `accent`, `font`, `size` (a fraction of the height), `start` (seconds),
`speed`, `align`. Mark words with `*asterisks*` to colour them in the accent.

- Text: `typewriter` (`text`, `cps`), `wordRise` (words rise and sharpen in turn), `focusTitle` (the
  first word opens large, then settles into the line), `scramble` (decodes from symbols), `highlight`
  (a marker sweeps behind the marked words), `wordSwap` (`prefix`, `words`: a rolling word), `counter`
  (`to`, `prefix`, `suffix`, `decimals`: rolling digits), `slam` (one word at a time, big).
- Captions: `captions` with `words: [{text, start, end}]` and `style` `"highlight"`, `"pill"`,
  `"pop"` or `"fill"`; `perLine`, `y`.
- Screens: `terminal` (`lines` of type `command`, `output`, `success`, `error` or `dim`), `chatPrompt`
  (`prompt` typed, sent, `answer` streams in), `cursor` (`path: [{x, y, at, click}]`),
  `notifications` (`items: [{title, body, at}]`). Windows follow the background's lightness unless
  `theme: "light"` or `"dark"` is given.
- Data: `barChart` (`values`, `labels`, `highlight`), `lineChart` (`values`, `suffix`), `ring`
  (`value` out of 100, `label`).
- Brand and transitions: `logoSting` (`text`, `tagline`), `bloom` (a circle covers or reveals the
  frame; `mode`, `origin`), `panels` (staggered wipes), `globe` (`arcs: [[lat, lon, lat, lon]]`,
  `places`).
- Helpers to build your own: `theme`, `ease`, `progress(t, start, duration, curve)`, `spring(t)`,
  `lerp`, `clamp`, `mix`, `readable`, `random(seed)`, `combine`.

`shaders` draws a full-frame effect on a canvas: backgrounds, textures and atmosphere rather than
objects.

```html
<canvas id="fx"></canvas>
<script type="module">
import { shader, effects } from "shaders";
window.render = shader(document.getElementById("fx"), effects.aurora, { speed: 0.6 });
</script>
```

Effects: `liquid` (ink folding through water), `mesh` (soft drifting colour pools with grain),
`aurora`, `plasma`, `caustics` (light through water), `cells` (shifting Voronoi with glowing edges),
`rays` (beams from above), `stars` (drifting starfield), `waves` (flowing contour lines),
`halftone` (pulsing print dots), `grain` (film grain and vignette, transparent, to lay over a scene)
and `pixels` (an LED grid lit by drifting blobs). Options: `colors` (up to four; the first is the
base), `speed`, `scale`, `intensity`, `seed`, `values`. Write your own effect as GLSL defining
`vec4 effect(vec2 uv, vec2 px, float t)` with the helpers `noise`, `fbm`, `hash`, `palette`,
`rotate` and `aspect`.

## three.js

```html
<canvas id="scene"></canvas>
<script type="module">
import * as THREE from "three";
const { width, height } = arrumo;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("scene"), alpha: true,
  antialias: true, preserveDrawingBuffer: true });
renderer.setSize(width, height, false);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
camera.position.set(0, 0, 6);
scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.2));
const key = new THREE.DirectionalLight(0xffffff, 2.5);
key.position.set(3, 4, 5);
scene.add(key);
const shape = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1),
  new THREE.MeshStandardMaterial({ color: 0x2a6df4, roughness: 0.35, metalness: 0.2, flatShading: true }));
scene.add(shape);
window.render = (t) => {
  shape.rotation.set(t * 0.6, t * 0.9, 0);
  renderer.render(scene, camera);
};
</script>
```

Light every scene: standard materials are black without lights. Keep geometry modest (tens of
thousands of triangles at most), since frames are drawn without a graphics card.

## Lottie

Write the animation JSON inline, load it with `autoplay: false` and seek it in `window.render`:

```html
<div id="art" style="width:100%;height:100%"></div>
<script>
const animation = lottie.loadAnimation({ container: document.getElementById("art"), renderer: "svg",
  loop: false, autoplay: false, animationData: { /* Lottie JSON */ } });
window.arrumoReady = new Promise((done) => animation.addEventListener("DOMLoaded", done));
window.render = (t) => animation.goToAndStop(Math.min(t * 1000, animation.getDuration() * 1000), false);
</script>
```

## D3

Use D3 for scales, shapes and layout, and set attributes from `t` yourself. D3 transitions run on
their own timers, so leave them out.

```html
<svg id="chart"></svg>
<script>
const values = [12, 19, 7, 25];
const { width, height } = arrumo;
const x = d3.scaleBand().domain(values.map((_, i) => i)).range([0, width]).padding(0.25);
const y = d3.scaleLinear().domain([0, d3.max(values)]).range([0, height * 0.8]);
const bars = d3.select("#chart").attr("width", width).attr("height", height)
  .selectAll("rect").data(values).join("rect").attr("x", (_, i) => x(i)).attr("width", x.bandwidth())
  .attr("rx", 8).attr("fill", "#2a6df4");
window.render = (t) => bars.attr("height", (v, i) => y(v) * Math.min(Math.max((t - i * 0.1) / 0.8, 0), 1))
  .attr("y", (v, i) => height - y(v) * Math.min(Math.max((t - i * 0.1) / 0.8, 0), 1));
</script>
```

## Plain canvas, SVG and CSS

A 2D canvas suits particles, generative patterns and progress rings: clear it at the start of each
frame. CSS animations and SVG animate elements also follow the layer's clock, so they work without a
`render` function.

## Recipes

The code recipes each drew a frame in a few milliseconds without a graphics card. Adapt them; they
show the technique, not a finished design.

Particles such as confetti, snow, sparks or dust: give each particle fixed random values from
`random(index)`, then place it from `t` with a closed formula, never by stepping a simulation. Slow
travel with `(1 - Math.exp(-drag * t)) / drag`, add gravity as `0.5 * g * t * t`, flip a piece with
`Math.cos(spin * t)` on one axis, and fade the whole burst out once it has made its point.

```js
const travel = (1 - Math.exp(-1.6 * t)) / 1.6;
const x = width / 2 + Math.cos(p.angle) * p.speed * travel * height;
const y = height * 0.6 + Math.sin(p.angle) * p.speed * travel * height + 0.11 * t * t * height;
```

Flow along a connector: draw the line with `pathLength="1"`, `stroke-dasharray="1"` and a
`stroke-dashoffset` that eases from 1 to 0, then move a small dot with `getPointAtLength` to show
which way things travel. Bring each node in before the line that leaves it.

Isometric diagrams: use three.js with an `OrthographicCamera` at `(10, 10, 10)` looking at the
origin, simple boxes in the brand colours, an ambient light and one directional light from above so
the three visible faces differ in shade. Stack or slide the pieces in one at a time.

```js
const view = 6, aspect = width / height;
const camera = new THREE.OrthographicCamera(-view * aspect / 2, view * aspect / 2, view / 2, -view / 2, 0.1, 100);
camera.position.set(10, 10, 10);
camera.lookAt(0, 0, 0);
```

Routes and places on a globe: D3 projects a sphere with `d3.geoOrthographic()`, a grid of meridians
and parallels with `d3.geoGraticule10()`, and a great-circle route with `d3.geoInterpolate(from, to)`
drawn up to an eased fraction. No coastline or country shapes are bundled, so show routes, places
and the grid, never a land outline you would have to invent. The `globe` preset is the quick version
of the same idea.

```js
const projection = d3.geoOrthographic().fitExtent([[width * 0.2, height * 0.08], [width * 0.8, height * 0.92]], { type: "Sphere" });
const route = d3.select("#map").append("path").attr("fill", "none").attr("stroke", arrumo.theme.accent);
const path = d3.geoPath(projection), along = d3.geoInterpolate([-9.14, 38.72], [-74.0, 40.71]);
window.render = (t) => {
  const drawn = ease((t - 1) / 2);
  route.attr("d", path({ type: "LineString", coordinates: d3.range(0, drawn, 0.02).concat(drawn).map(along) }));
};
```

Equations and formulas: write each term as its own text element in one row and reveal the terms in
the order they are spoken, then highlight the term the narration is explaining in the accent colour.
