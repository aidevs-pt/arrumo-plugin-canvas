// Full-frame shader effects for Arrumo canvas layers, drawn with WebGL2 on the layer's clock.
//
//   import { shader, effects } from "shaders";
//   window.render = shader(canvas, effects.liquid);  // in the video's colours
//   window.render = shader(canvas, effects.aurora, { colors: ["#050816", "#38f2a8", "#7a5cff"] });
//
// An effect is GLSL ES 3.00 that defines `vec4 effect(vec2 uv, vec2 px, float t)`: uv runs 0..1
// across the canvas with y up, px is the pixel position and t the time in seconds. It can read
// uResolution, uColors[4] (linear RGB), uColorCount, uSpeed, uScale, uIntensity, uSeed and
// uValues[4], and the helpers below (hash, noise, fbm, palette, rotate, aspect).

const PRELUDE = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColors[4];
uniform int uColorCount;
uniform float uSpeed;
uniform float uScale;
uniform float uIntensity;
uniform float uSeed;
uniform float uValues[4];
out vec4 outColor;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21) + uSeed); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 hash2(vec2 p) { float n = hash(p); return vec2(n, hash(p + n + 17.0)); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
mat2 rotate(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec2 aspect(vec2 uv) { return (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0); }
// Blends through the given colours as x runs from 0 to 1.
vec3 palette(float x) {
  x = clamp(x, 0.0, 1.0) * float(max(uColorCount - 1, 1));
  int i = int(floor(x));
  vec3 a = uColors[min(i, 3)], b = uColors[min(i + 1, uColorCount - 1)];
  return mix(a, b, smoothstep(0.0, 1.0, fract(x)));
}
`;

const MAIN = `
void main() {
  vec2 px = gl_FragCoord.xy;
  vec4 color = effect(px / uResolution, px, uTime * uSpeed);
  outColor = vec4(pow(max(color.rgb, 0.0), vec3(1.0 / 2.2)) * color.a, color.a);
}`;

/** The built-in effects. Each fills the frame; most use two to four colours. */
export const effects = {
  /** Slow liquid gradient: colours folding into each other like ink in water. */
  liquid: `vec4 effect(vec2 uv, vec2 px, float t) {
    vec2 p = aspect(uv) * 1.1 * uScale;
    vec2 q = vec2(fbm(p + t * 0.05), fbm(p + vec2(5.2, 1.3) - t * 0.04));
    vec2 r = vec2(fbm(p + 1.5 * q + vec2(1.7, 9.2) + t * 0.06), fbm(p + 1.5 * q + vec2(8.3, 2.8) - t * 0.05));
    float f = fbm(p + 1.4 * r * uIntensity);
    return vec4(palette(smoothstep(0.3, 0.72, f)), 1.0);
  }`,

  /** Soft mesh gradient: a few colour pools drifting slowly, with fine grain. */
  mesh: `vec4 effect(vec2 uv, vec2 px, float t) {
    vec2 p = aspect(uv) * uScale;
    vec3 sum = vec3(0.0); float weight = 0.0;
    for (int i = 0; i < 4; i++) {
      if (i >= uColorCount) break;
      float fi = float(i);
      vec2 c = 0.55 * vec2(sin(t * 0.21 + fi * 2.1 + uSeed), cos(t * 0.17 + fi * 1.7 + uSeed * 1.3));
      float w = 1.0 / pow(length(p - c) + 0.12, 3.2);
      sum += uColors[i] * w; weight += w;
    }
    vec3 color = sum / weight + (hash(px + floor(t * 24.0)) - 0.5) * 0.04 * uIntensity;
    return vec4(color, 1.0);
  }`,

  /** Northern lights: soft curtains of light waving over a dark sky (first colour is the sky). */
  aurora: `vec4 effect(vec2 uv, vec2 px, float t) {
    vec2 p = aspect(uv) * uScale;
    vec3 color = uColors[0] * (0.6 + 0.4 * uv.y);
    for (int i = 1; i < 4; i++) {
      if (i >= uColorCount) break;
      float fi = float(i);
      float wave = 0.15 * sin(p.x * (1.5 + fi * 0.7) + t * (0.3 + fi * 0.1)) + 0.1 * fbm(vec2(p.x * 2.0 + fi * 3.0, t * 0.15));
      float y = p.y - (0.05 * fi - 0.1) - wave;
      float band = exp(-y * y * 40.0) * (0.6 + 0.4 * fbm(vec2(p.x * 6.0, t * 0.3 + fi)));
      float rays = 0.6 + 0.4 * noise(vec2(p.x * 30.0 + fi * 10.0, t * 0.5));
      color += uColors[i] * band * rays * 0.9 * uIntensity;
    }
    return vec4(color, 1.0);
  }`,

  /** Plasma: smooth bands of colour rippling across the frame. */
  plasma: `vec4 effect(vec2 uv, vec2 px, float t) {
    vec2 p = aspect(uv) * 3.0 * uScale;
    float v = sin(p.x + t) + sin(0.8 * p.y - t * 0.7) + sin(0.6 * (p.x + p.y) + t * 0.9);
    v += sin(length(p + vec2(sin(t * 0.3), cos(t * 0.4)) * 2.0) * 1.5 - t);
    return vec4(palette(0.5 + 0.5 * sin(v * 0.9 * uIntensity + 0.5)), 1.0);
  }`,

  /** Caustics: light through moving water, a bright net over the first colour. */
  caustics: `vec4 effect(vec2 uv, vec2 px, float t) {
    vec2 p = aspect(uv) * 5.0 * uScale;
    float c = 0.0;
    vec2 q = p;
    for (int i = 0; i < 4; i++) {
      float fi = float(i) + 1.0;
      q += vec2(sin(q.y * 0.9 + t * 0.6 * fi * 0.4), cos(q.x * 0.9 - t * 0.5 * fi * 0.4)) / fi;
      c += abs(sin(q.x + q.y) * cos(q.x - q.y)) / fi;
    }
    float light = pow(1.0 - clamp(c * 0.55, 0.0, 1.0), 4.0) * 2.5 * uIntensity;
    vec3 base = mix(uColors[0], uColors[min(1, uColorCount - 1)], uv.y);
    return vec4(base + uColors[min(2, uColorCount - 1)] * light, 1.0);
  }`,

  /** Cells: a slowly shifting Voronoi pattern with glowing edges. */
  cells: `vec4 effect(vec2 uv, vec2 px, float t) {
    vec2 p = aspect(uv) * 6.0 * uScale;
    vec2 i = floor(p), f = fract(p);
    float first = 8.0, second = 8.0; vec2 id = vec2(0.0);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 n = vec2(x, y);
      vec2 o = 0.5 + 0.45 * sin(t * 0.6 + 6.2831 * hash2(i + n));
      float d = length(n + o - f);
      if (d < first) { second = first; first = d; id = i + n; } else if (d < second) second = d;
    }
    float edge = smoothstep(0.0, 0.08 * uIntensity, second - first);
    vec3 fill = palette(hash(id) * 0.8);
    return vec4(mix(uColors[uColorCount - 1] * 1.4, fill, edge), 1.0);
  }`,

  /** Rays: beams of light fanning down from above the frame. */
  rays: `vec4 effect(vec2 uv, vec2 px, float t) {
    vec2 p = aspect(uv); vec2 origin = vec2(0.15 * sin(t * 0.2), 0.75);
    vec2 d = p - origin; float angle = atan(d.x, -d.y);
    float beams = 0.5 * noise(vec2(angle * 9.0 * uScale, t * 0.25)) + 0.5 * noise(vec2(angle * 23.0 * uScale, -t * 0.3));
    float fade = exp(-length(d) * 1.3);
    vec3 color = uColors[0] + uColors[min(1, uColorCount - 1)] * pow(beams, 2.5) * fade * 2.2 * uIntensity;
    return vec4(color, 1.0);
  }`,

  /** Stars: a field of twinkling stars drifting past, in depth. */
  stars: `vec4 effect(vec2 uv, vec2 px, float t) {
    vec2 p = aspect(uv);
    vec3 color = uColors[0];
    for (int layer = 0; layer < 4; layer++) {
      float depth = 1.0 + float(layer);
      vec2 q = p * (12.0 + depth * 10.0) * uScale + vec2(t * 0.6 / depth, 0.0) + depth * 7.0;
      vec2 cell = floor(q), f = fract(q) - 0.5;
      float h = hash(cell + depth);
      if (h > 0.82) {
        vec2 o = (hash2(cell) - 0.5) * 0.6;
        float star = smoothstep(0.08, 0.0, length(f - o)) * (0.5 + 0.5 * sin(t * 3.0 + h * 40.0));
        color += mix(vec3(1.0), uColors[min(1 + layer % 3, uColorCount - 1)], 0.4) * star * uIntensity / depth * 2.0;
      }
    }
    return vec4(color, 1.0);
  }`,

  /** Waves: flowing parallel lines that bend like a sound wave or terrain contours. */
  waves: `vec4 effect(vec2 uv, vec2 px, float t) {
    vec2 p = aspect(uv) * uScale;
    float field = p.y * 14.0 + 2.5 * fbm(vec2(p.x * 1.5 + t * 0.2, t * 0.1)) * uIntensity + sin(p.x * 3.0 + t) * 0.8;
    float d = 0.5 - abs(fract(field) - 0.5);
    float line = 1.0 - smoothstep(0.03, 0.09, d);
    vec3 color = mix(uColors[0], palette(uv.x), line);
    return vec4(color, 1.0);
  }`,

  /** Halftone: a print-like dot screen whose dots swell with a moving pattern. */
  halftone: `vec4 effect(vec2 uv, vec2 px, float t) {
    float cell = 14.0 / uScale;
    vec2 grid = floor(px / cell), f = fract(px / cell) - 0.5;
    vec2 p = aspect((grid + 0.5) * cell / uResolution);
    float v = 0.5 + 0.5 * sin(length(p) * 9.0 - t * 1.5 + fbm(p * 3.0 + t * 0.1) * 3.0);
    float dot = smoothstep(0.02, 0.0, length(f) - 0.45 * v * uIntensity);
    return vec4(mix(uColors[0], palette(v), dot), 1.0);
  }`,

  /** Grain: film grain and a soft vignette, to lay over other layers (transparent elsewhere). */
  grain: `vec4 effect(vec2 uv, vec2 px, float t) {
    float g = hash(px + floor(t * 24.0) * 13.0) - 0.5;
    float grainAlpha = abs(g) * 0.3 * uIntensity;
    float vignette = smoothstep(0.45, 1.0, length(aspect(uv)) * 1.1) * 0.55 * uIntensity;
    float alpha = grainAlpha + vignette * (1.0 - grainAlpha);
    vec3 grainColor = g > 0.0 ? vec3(1.0) : vec3(0.0);
    return vec4(alpha > 0.0 ? grainColor * grainAlpha / alpha : vec3(0.0), alpha);
  }`,

  /** Pixels: a glowing LED grid lit by drifting blobs of colour. */
  pixels: `vec4 effect(vec2 uv, vec2 px, float t) {
    float cell = 18.0 / uScale;
    vec2 grid = floor(px / cell), f = fract(px / cell) - 0.5;
    vec2 p = aspect((grid + 0.5) * cell / uResolution);
    float v = fbm(p * 3.0 + vec2(t * 0.15, -t * 0.1));
    float lit = smoothstep(0.45, 0.7, v) * uIntensity;
    float tile = smoothstep(0.5, 0.38, max(abs(f.x), abs(f.y)));
    return vec4(mix(uColors[0], palette(v), lit * tile) + uColors[0] * 0.15 * tile, 1.0);
  }`,
};

// The video's background first, then its accent and other brand colours, so effects follow the
// brand unless colours are given.
function themeColors() {
  const theme = window.arrumo?.theme ?? {};
  const background = theme.background ?? "#0b1d3a";
  const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  const brand = [theme.accent, ...(theme.colors ?? [])].filter((color) => color && !same(color, background));
  const unique = brand.filter((color, index) => brand.findIndex((other) => same(other, color)) === index);
  return [background, ...(unique.length ? unique : ["#2a6df4", "#7fd4ff", "#f5b82e"])];
}

function linear(hex) {
  let digits = String(hex).replace("#", "");
  if (digits.length <= 4) digits = [...digits].map((digit) => digit + digit).join("");
  const value = parseInt(digits.slice(0, 6), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => Math.pow(channel / 255, 2.2));
}

/**
 * Draws `effect` (one of `effects`, or your own GLSL defining `vec4 effect(vec2 uv, vec2 px,
 * float t)`) on `canvas`, sized to the layer. Answers the `render(t)` function for the layer.
 * Options: colors (hex, up to four; the video's background then its brand colours by default),
 * speed (1), scale (1), intensity (1), seed (0), values
 * (up to four numbers as uValues).
 */
export function shader(canvas, effect, options = {}) {
  const { width, height } = window.arrumo;
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true });
  if (!gl) throw new Error("WebGL2 is unavailable");
  const compile = (type, source) => {
    const stage = gl.createShader(type);
    gl.shaderSource(stage, source);
    gl.compileShader(stage);
    if (!gl.getShaderParameter(stage, gl.COMPILE_STATUS)) throw new Error(`Shader error: ${gl.getShaderInfoLog(stage)}`);
    return stage;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, "#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0,1);}"));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, PRELUDE + effect + MAIN));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Shader error: ${gl.getProgramInfoLog(program)}`);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const at = (name) => gl.getUniformLocation(program, name);
  const colors = (options.colors ?? themeColors()).slice(0, 4);
  const padded = [...colors, ...Array(4 - colors.length).fill(colors[colors.length - 1])];
  gl.uniform3fv(at("uColors"), padded.flatMap(linear));
  gl.uniform1i(at("uColorCount"), colors.length);
  gl.uniform2f(at("uResolution"), width, height);
  gl.uniform1f(at("uSpeed"), options.speed ?? 1);
  gl.uniform1f(at("uScale"), options.scale ?? 1);
  gl.uniform1f(at("uIntensity"), options.intensity ?? 1);
  gl.uniform1f(at("uSeed"), options.seed ?? 0);
  gl.uniform1fv(at("uValues"), new Float32Array([...(options.values ?? []), 0, 0, 0, 0].slice(0, 4)));
  const time = at("uTime");
  gl.viewport(0, 0, width, height);
  return (t) => {
    gl.uniform1f(time, t);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}
