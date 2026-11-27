<p align="center">
  <img src="icon.svg" width="88" height="88" alt="">
</p>

<h1 align="center">Canvas layers for Arrumo AI Video Editor</h1>

<p align="center">3D, vector animation, charts and generative motion that the agent writes as small web pages.</p>

<p align="center">
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-2337B4"></a>
  <img alt="Bundled with Arrumo" src="https://img.shields.io/badge/bundled%20with-Arrumo-2337B4">
  <a href="https://www.aidevs.pt/tools/arrumo/docs/plugins/canvas"><img alt="Docs in English, Spanish and Portuguese" src="https://img.shields.io/badge/docs-EN%20%C2%B7%20ES%20%C2%B7%20PT-111"></a>
</p>

This plugin ships with [Arrumo AI Video Editor](https://github.com/aidevs-pt/arrumo-video-editor), the free, open-source desktop app where an AI agent writes, designs, voices and cuts your videos and you approve every step. It comes installed and on; turn it on or off in **Settings › Plugins**.

## What it adds

An animation layer can be a small web page. The agent writes it when a design needs something text, boxes and images can't show: a product turning in 3D, particles, a chart that builds itself, or a Lottie animation. Arrumo draws the page frame by frame, at every size the video needs, and composites it with the rest of the animation.

| Library | Version | License | Use |
| --- | --- | --- | --- |
| motion | 0.1.0 | AGPL-3.0 | Arrumo's own presets: text effects, timed captions, terminal, chat, cursor and notification shots, charts, a logo sting, transitions and a globe |
| shaders | 0.1.0 | AGPL-3.0 | Arrumo's own full-frame WebGL2 effects (liquid, mesh, aurora, plasma, caustics, cells, rays, stars, waves, halftone, grain, pixels), or the agent's own GLSL |
| three.js | 0.170.0 | MIT | 3D scenes with WebGL |
| lottie-web | 5.13.0 | MIT | Lottie vector animation |
| D3 | 7.9.2 | ISC | Charts, maps and diagrams |

Presets and effects draw in the video's colours and brand fonts by default: Arrumo passes each page the brand palette and the layer's background, text and accent colours. The agent uses a preset when it fits, adapts it, or writes its own page. WebGL, 2D canvas, SVG and CSS animation work without a library. [`guide.md`](guide.md) is what the agent reads before writing a page.

## How pages are drawn

- **Renderer.** `manifest.json` names Chrome for Testing's headless shell 158.0.8127.88 for Linux (x64 and Arm), macOS (Apple silicon and Intel) and Windows (x64), with each archive's size and SHA-256. While the plugin is on, Arrumo downloads the one for your computer in the background, checks its size and digest before unpacking, and keeps it next to its data. The plugin page shows its state and can remove or download it again.
- **Isolation.** Pages have no network, no files and no access to Arrumo: every request is answered from the libraries above or refused. On Linux the browser also runs inside Bubblewrap with no network. On macOS and Windows it keeps its own sandbox.
- **Timing.** Time moves only when Arrumo draws a frame, so the same page gives the same frames every time, including `requestAnimationFrame`, CSS and SVG animation.

## License

Copyright © DEVS.AI UNIPESSOAL LDA. Licensed under the [GNU Affero General Public License v3.0](LICENSE). The bundled libraries keep their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Chrome for Testing is downloaded from Google under its own terms and is not part of this package.

Need custom AI solutions for your business? Visit [aidevs.pt](https://aidevs.pt).
