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
- Use the brand colours from the brief and the fonts `brand-heading` and `brand-body` for any text drawn
  on the canvas.

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
