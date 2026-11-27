// Motion presets for Arrumo canvas layers: ready-made pieces an animation can use as they are,
// restyle through options, combine, or ignore in favour of its own code.
//
//   import { typewriter, combine } from "motion";
//   window.render = typewriter(document.body, { text: arrumo.values.title, size: 0.08 });
//
// Every preset takes the element to draw into (usually document.body) and options, and answers
// `render(t)`, which draws the moment t seconds after the layer starts from t alone. Sizes are
// fractions of the layer's height; times are seconds. Common options: color, accent, font
// ("brand-heading", "brand-body" or any CSS family), size, start (when the preset begins) and
// speed (a multiplier on its own timing). Colours default to the video's theme (see `theme`), so
// presets follow the brand; pass colours only to depart from it.

const { width: W, height: H } = window.arrumo ?? { width: 1280, height: 720 };

export const clamp = (x, low = 0, high = 1) => Math.min(high, Math.max(low, x));
export const lerp = (a, b, x) => a + (b - a) * x;

function channels(hex) {
  let digits = String(hex ?? "").replace("#", "");
  if (digits.length <= 4) digits = [...digits].map((digit) => digit + digit).join("");
  const value = parseInt(digits.slice(0, 6), 16) || 0;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** How light a colour looks, from 0 (black) to 1 (white). */
export function lightness(hex) {
  const [r, g, b] = channels(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Black or white, whichever reads better on `hex`. */
export function readable(hex) {
  return lightness(hex) > 0.4 ? "#101114" : "#ffffff";
}

/** A colour `x` of the way from `a` to `b`. */
export function mix(a, b, x) {
  const from = channels(a), to = channels(b);
  return `#${from.map((channel, i) => Math.round(lerp(channel, to[i], x)).toString(16).padStart(2, "0")).join("")}`;
}

// The video's colours: its brand palette, background, text and accent, as Arrumo resolved them
// for this video. Every preset defaults to them, so a preset looks like the brand it is used for.
const given = window.arrumo?.theme ?? {};
const full = (hex) => mix(hex, hex, 0);
const background = full(given.background ?? "#0b1d3a");
const palette = (given.colors?.length ? given.colors : ["#2a6df4", "#7fd4ff", "#f5b82e"]).map(full);
const distinct = palette.filter((color) => Math.abs(lightness(color) - lightness(background)) > 0.08);
const accent = full(given.accent ?? distinct[0] ?? palette[0]);
const others = distinct.filter((color) => color.toLowerCase() !== accent.toLowerCase());

/** The theme presets use by default: colors (the brand palette), background, text, accent, and
 * primary and secondary (brand colours other than the accent that show on the background). */
export const theme = {
  colors: palette,
  background,
  text: given.text ? full(given.text) : readable(background),
  accent,
  primary: others[0] ?? accent,
  secondary: others[1] ?? others[0] ?? mix(accent, readable(background), 0.45),
};

const isDark = (options) => (options.theme ? options.theme !== "light" : lightness(theme.background) < 0.4);

/** Easing curves taking and answering 0..1. */
export const ease = {
  linear: (x) => x,
  in: (x) => x * x * x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  expo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  back: (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
};

/** How far through a step that starts at `start` and lasts `duration` the moment t is, eased. */
export function progress(t, start, duration, curve = ease.out) {
  return curve(clamp((t - start) / Math.max(duration, 1e-6)));
}

/** A spring from 0 to 1, released at time 0; answers its position at t seconds. */
export function spring(t, { stiffness = 170, damping = 18, mass = 1 } = {}) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}

/** Runs several presets as one layer. */
export function combine(...renders) {
  return async (t) => {
    for (const render of renders) await render(t);
  };
}

// A stable pseudo-random number in 0..1 for an integer seed, so frames repeat exactly.
export function random(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function family(font) {
  return font === "brand-heading" || font === "brand-body" || !font
    ? `"${font ?? "brand-heading"}", "Inter", "Helvetica Neue", Arial, sans-serif`
    : font;
}

const MONO = `"JetBrains Mono", "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace`;

function style(element, css) {
  Object.assign(element.style, css);
  return element;
}

function make(tag, parent, css = {}, text) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  style(element, css);
  parent?.appendChild(element);
  return element;
}

// A full-size, transparent stage inside the target, centring its content.
function stage(target, options, extra = {}) {
  const root = make("div", target ?? document.body, {
    position: "absolute",
    inset: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: options.align === "left" ? "flex-start" : options.align === "right" ? "flex-end" : "center",
    padding: `0 ${(options.margin ?? 0.06) * W}px`,
    boxSizing: "border-box",
    fontFamily: family(options.font),
    color: options.color ?? theme.text,
    fontSize: `${(options.size ?? 0.08) * H}px`,
    fontWeight: String(options.weight ?? 700),
    lineHeight: "1.1",
    textAlign: options.align ?? "center",
    letterSpacing: options.tracking ?? "-0.02em",
    ...extra,
  });
  return root;
}

const timing = (options) => ({ start: options.start ?? 0, speed: options.speed ?? 1 });
const local = (t, options) => (t - (options.start ?? 0)) * (options.speed ?? 1);

// Splits "Make *this* stand out" into words, remembering which were marked with asterisks.
function words(text) {
  return String(text ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ text: word.replace(/\*/g, ""), marked: /^\*.*\*[.,!?;:]?$/.test(word) || /^\*/.test(word) }));
}

// ---------------------------------------------------------------------------------------------
// Text

/** Types text a character at a time with a blinking cursor. Options: text, cps (characters a
 * second, 18), cursor (true). */
export function typewriter(target, options = {}) {
  const root = stage(target, options);
  const line = make("div", root, { whiteSpace: "pre-wrap", maxWidth: "100%" });
  const typed = make("span", line);
  const rest = make("span", line, { opacity: "0" });
  const caret = make("span", line, {
    display: "inline-block", width: "0.06em", height: "1em", marginLeft: "0.04em",
    background: options.accent ?? options.color ?? theme.text, verticalAlign: "-0.12em",
  });
  const text = String(options.text ?? "");
  const cps = options.cps ?? 18;
  return (t) => {
    const s = local(t, options);
    const count = clamp(Math.floor(s * cps), 0, text.length);
    typed.textContent = text.slice(0, count);
    rest.textContent = text.slice(count);
    const typing = count < text.length && s > 0;
    caret.style.opacity = options.cursor === false ? "0" : typing || Math.floor(s * 2) % 2 === 0 ? "1" : "0";
  };
}

/** Words rise into place one after another, sharpening as they land. Mark words with
 * *asterisks* to colour them in accent. Options: text, stagger (0.08), duration (0.6). */
export function wordRise(target, options = {}) {
  const root = stage(target, options);
  const line = make("div", root, { display: "flex", flexWrap: "wrap", gap: "0 0.28em",
    justifyContent: root.style.justifyContent });
  const items = words(options.text).map((word) => make("span", line, {
    display: "inline-block", color: word.marked ? options.accent ?? theme.accent : "inherit", willChange: "transform",
  }, word.text));
  const stagger = options.stagger ?? 0.08, duration = options.duration ?? 0.6;
  return (t) => {
    const s = local(t, options);
    items.forEach((item, index) => {
      const p = progress(s, index * stagger, duration);
      item.style.opacity = String(clamp(p * 1.6));
      item.style.transform = `translateY(${(1 - p) * 0.55}em)`;
      item.style.filter = `blur(${(1 - p) * 10}px)`;
    });
  };
}

/** A title that opens on its first word, large and centred, which then settles into the line
 * while the other words slide in beside it. Options: text, zoom (2.4), hold (0.5). */
export function focusTitle(target, options = {}) {
  const root = stage(target, options);
  const line = make("div", root, { display: "flex", flexWrap: "nowrap", gap: "0 0.26em", whiteSpace: "nowrap" });
  const list = words(options.text);
  const items = list.map((word) => make("span", line, {
    display: "inline-block", color: word.marked ? options.accent ?? theme.accent : "inherit", transformOrigin: "50% 60%",
  }, word.text));
  const zoom = options.zoom ?? 2.4, hold = options.hold ?? 0.5;
  let offset;
  return (t) => {
    const s = local(t, options);
    if (offset === undefined) {
      const box = root.getBoundingClientRect(), first = items[0].getBoundingClientRect();
      offset = box.left + box.width / 2 - (first.left + first.width / 2);
    }
    const settle = progress(s, hold, 0.7, ease.inOut);
    const arrive = progress(s, 0, 0.35);
    items[0].style.opacity = String(arrive);
    items[0].style.transform = `translateX(${offset * (1 - settle)}px) scale(${lerp(zoom * lerp(0.92, 1, arrive), 1, settle)})`;
    items.slice(1).forEach((item, index) => {
      const p = progress(s, hold + 0.35 + index * 0.06, 0.5);
      item.style.opacity = String(p);
      item.style.transform = `translateX(${(1 - p) * 0.6}em)`;
    });
  };
}

/** Characters decode from shuffling symbols into the text, left to right. Options: text,
 * stagger (0.035 per character), settle (0.4), glyphs. */
export function scramble(target, options = {}) {
  const root = stage(target, { tracking: "0", ...options });
  const line = make("div", root, { whiteSpace: "pre-wrap", fontVariantNumeric: "tabular-nums" });
  const text = String(options.text ?? "");
  const glyphs = options.glyphs ?? "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+<>/";
  const cells = [...text].map((char) => make("span", line, {}, char));
  const stagger = options.stagger ?? 0.035, settle = options.settle ?? 0.4;
  return (t) => {
    const s = local(t, options);
    const tick = Math.floor(s * 20);
    cells.forEach((cell, index) => {
      const char = text[index];
      const at = index * stagger;
      if (char === " " || s >= at + settle) {
        cell.textContent = char;
        cell.style.opacity = "1";
        cell.style.color = "";
      } else {
        cell.textContent = glyphs[Math.floor(random(index * 31 + tick) * glyphs.length)];
        cell.style.opacity = s < at ? "0" : "0.75";
        cell.style.color = options.accent ?? theme.accent;
      }
    });
  };
}

/** A marker sweeps behind the *marked* words, one after another. Options: text, accent (the
 * marker), markedColor (text on the marker), at (when the first sweep starts, 0.4). */
export function highlight(target, options = {}) {
  const root = stage(target, options);
  const line = make("div", root, { display: "flex", flexWrap: "wrap", gap: "0.1em 0.26em",
    justifyContent: root.style.justifyContent });
  const marks = [];
  for (const word of words(options.text)) {
    const span = make("span", line, { position: "relative", display: "inline-block", padding: "0 0.08em" });
    if (word.marked) {
      const bar = make("span", span, { position: "absolute", left: "0", right: "0", top: "0.08em", bottom: "0.02em",
        background: options.accent ?? theme.accent, borderRadius: "0.1em", transformOrigin: "0 50%", transform: "scaleX(0)" });
      const label = make("span", span, { position: "relative" }, word.text);
      marks.push({ bar, label });
    } else {
      make("span", span, {}, word.text);
    }
  }
  const at = options.at ?? 0.4;
  return (t) => {
    const s = local(t, options);
    marks.forEach(({ bar, label }, index) => {
      const p = progress(s, at + index * 0.35, 0.45, ease.inOut);
      bar.style.transform = `scaleX(${p})`;
      label.style.color = p > 0.5 ? options.markedColor ?? readable(options.accent ?? theme.accent) : "";
    });
  };
}

/** A fixed lead-in with a word that rolls through a list. Options: prefix ("Made for"), words
 * (["creators", "teams"]), hold (1.2 s per word), suffix. */
export function wordSwap(target, options = {}) {
  const root = stage(target, options);
  const line = make("div", root, { display: "flex", alignItems: "baseline", gap: "0.26em", whiteSpace: "nowrap" });
  if (options.prefix) make("span", line, {}, options.prefix);
  const slot = make("span", line, { position: "relative", display: "inline-block", height: "1.15em", overflow: "hidden",
    verticalAlign: "bottom", color: options.accent ?? theme.accent });
  const list = options.words ?? ["creators", "teams", "everyone"];
  const items = list.map((word) => make("span", slot, { position: "absolute", left: "0", top: "0", whiteSpace: "nowrap" }, word));
  if (options.suffix) make("span", line, {}, options.suffix);
  const hold = options.hold ?? 1.2;
  let widths;
  return (t) => {
    const s = Math.max(0, local(t, options));
    widths ??= items.map((item) => item.getBoundingClientRect().width);
    const index = Math.floor(s / hold), within = s - index * hold;
    const turn = index === 0 ? 1 : progress(within, 0, 0.45, ease.inOut);
    const current = index % list.length, previous = (index - 1 + list.length) % list.length;
    slot.style.width = `${lerp(widths[previous], widths[current], turn)}px`;
    items.forEach((item, i) => {
      const y = i === current ? (1 - turn) * 1.1 : i === previous && index > 0 ? -turn * 1.1 : 2;
      item.style.transform = `translateY(${y}em)`;
    });
  };
}

/** A number that counts to its value with rolling digits. Options: to, from (0), decimals (0),
 * prefix, suffix, duration (1.6), separator (","). */
export function counter(target, options = {}) {
  const root = stage(target, { tracking: "-0.01em", ...options });
  const line = make("div", root, { display: "flex", alignItems: "baseline", fontVariantNumeric: "tabular-nums" });
  const to = options.to ?? 100, from = options.from ?? 0, decimals = options.decimals ?? 0;
  const format = (value) => value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, options.separator ?? ",");
  if (options.prefix) make("span", line, {}, options.prefix);
  const digits = [];
  const layout = format(Math.max(Math.abs(to), Math.abs(from)));
  for (const char of layout) {
    if (!/\d/.test(char)) { make("span", line, {}, char); continue; }
    const window_ = make("span", line, { display: "inline-block", height: "1.1em", overflow: "hidden", lineHeight: "1.1em" });
    const strip = make("span", window_, { display: "flex", flexDirection: "column" });
    for (let d = 0; d <= 10; d++) make("span", strip, { height: "1.1em" }, String(d % 10));
    digits.push({ window_, strip });
  }
  if (options.suffix) make("span", line, { color: options.accent ?? "inherit" }, options.suffix);
  const scale = Math.pow(10, decimals);
  return (t) => {
    const value = lerp(from, to, progress(local(t, options), 0, options.duration ?? 1.6, ease.expo)) * scale;
    const leading = digits.length - String(Math.floor(Math.abs(value))).length;
    digits.forEach(({ window_, strip }, index) => {
      const place = Math.pow(10, digits.length - 1 - index);
      const column = (Math.abs(value) / place) % 10;
      const whole = Math.floor(Math.abs(value) / place);
      const next = Math.floor(column), fraction = column - next;
      const roll = (Math.abs(value) % place) / place > 0.9 || place === 1 ? fraction : 0;
      strip.style.transform = `translateY(${-(next + roll) * 1.1}em)`;
      window_.style.opacity = index < leading && whole === 0 && index < digits.length - 1 - decimals ? "0.25" : "1";
    });
  };
}

/** One word at a time, each slamming in big at the centre. Options: text, per (0.32 s a word),
 * or timed words [{text, start, end}]. */
export function slam(target, options = {}) {
  const root = stage(target, { size: 0.16, weight: 900, ...options });
  const list = options.words ?? words(options.text).map((word, index) => ({
    text: word.text, marked: word.marked, start: index * (options.per ?? 0.32), end: (index + 1) * (options.per ?? 0.32),
  }));
  const item = make("div", root, { textTransform: options.uppercase === false ? "none" : "uppercase", whiteSpace: "nowrap" });
  return (t) => {
    const s = local(t, options);
    const index = list.findIndex((word) => s >= word.start && s < word.end);
    const word = list[index] ?? (s >= (list.at(-1)?.end ?? 0) ? list.at(-1) : undefined);
    if (!word) { item.style.opacity = "0"; return; }
    const at = s - word.start;
    const p = spring(at, { stiffness: 420, damping: 20 });
    item.textContent = word.text.replace(/\*/g, "");
    item.style.color = word.marked || /^\*/.test(word.text) ? options.accent ?? theme.accent : "";
    item.style.opacity = String(clamp(at * 12));
    const tilt = (index % 3 - 1) * 3;
    item.style.transform = `scale(${lerp(1.7, 1, p)}) rotate(${tilt * (1 - p)}deg)`;
  };
}

// ---------------------------------------------------------------------------------------------
// Captions

/** Captions from timed words. words: [{text, start, end}] in seconds. style: "highlight" (a box
 * behind the spoken word), "pill" (words darken in a light pill as they're said), "pop" (the
 * spoken word grows in accent) or "fill" (a colour sweep through each word). Options: perLine (4),
 * y (0.8, the line's centre as a fraction of the height), uppercase. */
export function captions(target, options = {}) {
  const root = stage(target, { size: 0.065, weight: 800, ...options }, { alignItems: "flex-start" });
  const box = make("div", root, { position: "absolute", left: "0", right: "0", top: `${(options.y ?? 0.8) * 100}%`,
    transform: "translateY(-50%)", display: "flex", justifyContent: "center", padding: `0 ${0.07 * W}px` });
  const kind = options.style ?? "highlight";
  const accent = options.accent ?? theme.accent;
  const pill = options.pill ?? theme.text;
  const list = (options.words ?? []).map((word) => ({ ...word, text: String(word.text) }));
  const groups = [];
  for (const word of list) {
    const group = groups.at(-1);
    const breaks = !group || group.length >= (options.perLine ?? 4) || /[.!?]$/.test(group.at(-1).text)
      || word.start - group.at(-1).end > 0.4;
    breaks ? groups.push([word]) : group.push(word);
  }
  const line = make("div", box, {
    display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.08em 0.24em",
    textTransform: options.uppercase === false ? "none" : kind === "pill" ? "none" : "uppercase",
    padding: kind === "pill" ? "0.28em 0.65em" : "0", borderRadius: "0.4em",
    background: kind === "pill" ? pill : "transparent",
    boxShadow: kind === "pill" ? "0 0.08em 0.3em rgba(0,0,0,0.18)" : "none",
    textShadow: kind === "pill" ? "none" : "0 0.06em 0.25em rgba(0,0,0,0.45)",
  });
  let shown = -1, spans = [];
  return (t) => {
    const s = local(t, options);
    let index = groups.findIndex((group, i) => s >= group[0].start - 0.05 && s < (groups[i + 1]?.[0].start ?? group.at(-1).end + 0.4));
    if (index !== shown) {
      line.replaceChildren();
      spans = (groups[index] ?? []).map((word) => {
        const span = make("span", line, { position: "relative", display: "inline-block", padding: "0 0.08em" });
        const back = make("span", span, { position: "absolute", inset: "0.02em -0.02em", borderRadius: "0.14em",
          background: accent, transform: "scaleX(0)", transformOrigin: "0 50%" });
        const label = make("span", span, { position: "relative" }, word.text);
        return { word, span, back, label };
      });
      shown = index;
    }
    if (index < 0) { line.style.opacity = "0"; return; }
    const group = groups[index];
    line.style.opacity = String(clamp((s - group[0].start + 0.05) / 0.1) * clamp((group.at(-1).end + 0.4 - s) / 0.12));
    for (const { word, span, back, label } of spans) {
      const said = clamp((s - word.start) / Math.max(0.08, Math.min(0.15, word.end - word.start)));
      const active = s >= word.start && s < word.end + 0.05;
      if (kind === "highlight") {
        back.style.transform = `scaleX(${active ? ease.out(said) : 0})`;
        label.style.color = active ? options.activeColor ?? readable(accent) : options.color ?? theme.text;
      } else if (kind === "pill") {
        back.style.display = "none";
        label.style.color = said > 0 ? options.activeColor ?? readable(pill) : options.dimColor ?? mix(pill, readable(pill), 0.38);
      } else if (kind === "pop") {
        back.style.display = "none";
        label.style.color = active ? accent : options.color ?? theme.text;
        span.style.transform = `scale(${active ? 1 + 0.18 * (1 - spring(s - word.start, { stiffness: 380, damping: 16 })) + 0.06 : 1})`;
      } else {
        back.style.display = "none";
        label.style.backgroundImage = `linear-gradient(90deg, ${accent} ${said * 100}%, ${options.color ?? theme.text} ${said * 100}%)`;
        label.style.webkitBackgroundClip = "text";
        label.style.color = "transparent";
      }
    }
  };
}

// ---------------------------------------------------------------------------------------------
// Screens

function windowFrame(parent, options, title) {
  const dark = isDark(options);
  const frame = make("div", parent, {
    width: `${(options.width ?? 0.82) * 100}%`, maxHeight: "88%", display: "flex", flexDirection: "column",
    background: options.background ?? (dark ? "#0f1218" : "#ffffff"), color: dark ? "#e6e8ee" : "#1b1f27",
    borderRadius: `${0.022 * H}px`, overflow: "hidden",
    boxShadow: `0 ${0.03 * H}px ${0.08 * H}px rgba(0,0,0,0.35), 0 0 0 1px ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
  });
  const bar = make("div", frame, { display: "flex", alignItems: "center", gap: `${0.012 * H}px`,
    padding: `${0.018 * H}px ${0.022 * H}px`, background: dark ? "#171b23" : "#f2f3f5",
    fontSize: `${0.024 * H}px`, color: dark ? "#8a93a6" : "#69707d", fontFamily: family("brand-body"), letterSpacing: "0" });
  for (const color of ["#ff5f57", "#febc2e", "#28c840"]) make("span", bar, { width: `${0.016 * H}px`, height: `${0.016 * H}px`, borderRadius: "50%", background: color });
  make("span", bar, { marginLeft: `${0.012 * H}px` }, title ?? "");
  return frame;
}

/** A terminal window running commands. lines: [{text, type}], where type is "command" (typed
 * after the prompt), "output", "success", "error" or "dim". Options: title, cps (28), prompt
 * ("$"), theme ("dark" or "light"), width (0.82 of the layer). */
export function terminal(target, options = {}) {
  const root = stage(target, { size: 0.034, weight: 500, tracking: "0", ...options }, { fontFamily: MONO });
  const frame = windowFrame(root, options, options.title ?? "Terminal");
  const body = make("div", frame, { position: "relative", padding: `${0.03 * H}px ${0.035 * H}px`, overflow: "hidden",
    minHeight: `${0.3 * H}px`, textAlign: "left", lineHeight: "1.55" });
  const scroller = make("div", body);
  const colors = isDark(options)
    ? { output: "#c9cfdb", success: "#3ddc84", error: "#ff6b6b", dim: "#6e7789" }
    : { output: "#3d4452", success: "#12873f", error: "#c62828", dim: "#8a909c" };
  const cps = options.cps ?? 28;
  let clock = 0.3;
  const lines = (options.lines ?? []).map((line) => {
    const row = make("div", scroller, { whiteSpace: "pre-wrap", opacity: "0", color: colors[line.type] ?? (isDark(options) ? "#f3f5f9" : "#1b1f27") });
    const item = { ...line, row, at: clock };
    if (line.type === "command") {
      make("span", row, { color: options.accent ?? theme.accent }, `${options.prompt ?? "$"} `);
      item.typed = make("span", row);
      item.caret = make("span", row, { display: "inline-block", width: "0.55em", height: "1.1em", verticalAlign: "-0.2em", background: "currentColor" });
      clock += String(line.text).length / cps + 0.35;
    } else {
      row.textContent = line.text;
      clock += line.type === "dim" ? 0.08 : 0.16;
    }
    return item;
  });
  return (t) => {
    const s = local(t, options);
    let last = null;
    for (const line of lines) {
      const visible = s >= line.at;
      line.row.style.opacity = visible ? "1" : "0";
      if (visible) last = line;
      if (line.typed) {
        const count = clamp(Math.floor((s - line.at) * cps), 0, line.text.length);
        line.typed.textContent = line.text.slice(0, count);
        line.caret.style.display = "none";
      }
    }
    if (last?.caret) last.caret.style.display = Math.floor(s * 2.2) % 2 === 0 || last.typed.textContent.length < last.text.length ? "inline-block" : "none";
    if (last) {
      const overflow = last.row.offsetTop + last.row.offsetHeight - (body.clientHeight - 0.06 * H);
      scroller.style.transform = `translateY(${-Math.max(0, overflow)}px)`;
    }
  };
}

/** An assistant prompt: the question is typed into an input, sent, and the answer streams in.
 * Options: prompt, answer, placeholder, accent, theme ("light" or "dark"), cps (24), wps (answer
 * words a second, 9). */
export function chatPrompt(target, options = {}) {
  const dark = isDark(options);
  const root = stage(target, { size: 0.036, weight: 500, tracking: "-0.01em", ...options }, { flexDirection: "column", gap: `${0.03 * H}px` });
  const ink = dark ? "#eef0f5" : "#15181f", muted = dark ? "#7d8496" : "#8b909b";
  const answer = make("div", root, { width: "78%", textAlign: "left", color: ink, fontWeight: "450", lineHeight: "1.45", minHeight: "0" });
  const input = make("div", root, {
    width: "78%", display: "flex", alignItems: "center", gap: `${0.02 * H}px`, padding: `${0.026 * H}px ${0.03 * H}px`,
    borderRadius: `${0.04 * H}px`, background: dark ? "#1a1e27" : "#ffffff", color: ink,
    boxShadow: `0 ${0.02 * H}px ${0.06 * H}px rgba(0,0,0,${dark ? 0.4 : 0.16}), 0 0 0 1px ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}`,
  });
  const field = make("div", input, { flex: "1", textAlign: "left", minHeight: "1.3em" });
  const placeholder = make("span", field, { color: muted }, options.placeholder ?? "Ask anything");
  const typed = make("span", field);
  const caret = make("span", field, { display: "inline-block", width: "0.07em", height: "1.1em", background: options.accent ?? theme.accent, verticalAlign: "-0.18em", marginLeft: "0.03em" });
  const send = make("div", input, { width: `${0.06 * H}px`, height: `${0.06 * H}px`, borderRadius: "50%", flex: "none",
    display: "grid", placeItems: "center", background: muted, color: "#fff", fontSize: `${0.032 * H}px` }, "↑");
  const prompt = String(options.prompt ?? ""), reply = String(options.answer ?? "").split(/\s+/).filter(Boolean);
  const cps = options.cps ?? 24, wps = options.wps ?? 9;
  const typedAt = 0.4, sentAt = typedAt + prompt.length / cps + 0.3, answerAt = sentAt + 0.7;
  const spans = reply.map((word) => make("span", answer, { opacity: "0" }, `${word} `));
  const dots = make("div", answer, { display: "none", gap: "0.2em" });
  const dotList = [0, 1, 2].map(() => make("span", dots, { width: "0.35em", height: "0.35em", borderRadius: "50%", background: muted, display: "inline-block" }));
  return (t) => {
    const s = local(t, options);
    const count = clamp(Math.floor((s - typedAt) * cps), 0, prompt.length);
    const sent = s >= sentAt;
    typed.textContent = sent ? "" : prompt.slice(0, count);
    placeholder.style.display = count > 0 && !sent ? "none" : "inline";
    caret.style.opacity = !sent && (count < prompt.length || Math.floor(s * 2) % 2 === 0) ? "1" : "0";
    const ready = count === prompt.length && !sent;
    send.style.background = ready || (sent && s < sentAt + 0.25) ? options.accent ?? theme.accent : muted;
    send.style.transform = `scale(${1 - 0.12 * Math.sin(Math.PI * clamp((s - sentAt + 0.15) / 0.3))})`;
    if (sent) {
      if (!answer.dataset.asked) {
        answer.dataset.asked = "1";
        const question = make("div", answer, { alignSelf: "flex-end", marginLeft: "auto", width: "fit-content", maxWidth: "80%",
          padding: "0.4em 0.8em", borderRadius: "1em", background: dark ? "#262b36" : "#eef0f3", marginBottom: "0.6em", textAlign: "left" }, prompt);
        answer.prepend(question);
        answer.dataset.question = "1";
      }
    }
    const question = answer.firstElementChild?.textContent === prompt && answer.dataset.question ? answer.firstElementChild : null;
    if (question) {
      question.style.display = sent ? "block" : "none";
      const p = progress(s, sentAt, 0.4);
      question.style.opacity = String(p);
      question.style.transform = `translateY(${(1 - p) * 0.6}em)`;
    }
    dots.style.display = sent && s < answerAt ? "flex" : "none";
    dotList.forEach((dot, i) => { dot.style.opacity = String(0.35 + 0.65 * Math.max(0, Math.sin((s * 6) - i * 0.9))); });
    spans.forEach((span, i) => { span.style.opacity = String(clamp((s - answerAt - i / wps) * 6)); });
  };
}

/** An arrow pointer that glides between points and clicks. path: [{x, y, at, click}] with x and
 * y as fractions of the layer and at in seconds. Options: color ("#ffffff"), size (0.05). */
export function cursor(target, options = {}) {
  const root = stage(target, options, { display: "block", padding: "0" });
  const ripple = make("div", root, { position: "absolute", borderRadius: "50%", border: `${0.004 * H}px solid ${options.accent ?? theme.accent}`, opacity: "0" });
  const size = (options.size ?? 0.05) * H;
  const pointer = make("div", root, { position: "absolute", width: `${size}px`, height: `${size}px`, transformOrigin: "10% 10%", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))" });
  pointer.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.6 L11 13.3 L17.5 13.3 Z" fill="${options.color ?? "#ffffff"}" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
  const path = (options.path ?? [{ x: 0.3, y: 0.6, at: 0 }, { x: 0.6, y: 0.45, at: 1, click: true }]).slice().sort((a, b) => a.at - b.at);
  return (t) => {
    const s = local(t, options);
    let x = path[0].x, y = path[0].y;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      if (s >= a.at) { const p = progress(s, a.at, Math.max(0.2, b.at - a.at), ease.inOut); x = lerp(a.x, b.x, p); y = lerp(a.y, b.y, p); }
    }
    const click = path.filter((point) => point.click && s >= point.at).at(-1);
    const since = click ? s - click.at : 9;
    pointer.style.transform = `translate(${x * W}px, ${y * H}px) scale(${since < 0.25 ? 1 - 0.15 * Math.sin(Math.PI * since / 0.25) : 1})`;
    const r = progress(since, 0, 0.5) * 0.06 * H;
    style(ripple, { left: `${(click?.x ?? x) * W - r}px`, top: `${(click?.y ?? y) * H - r}px`, width: `${2 * r}px`, height: `${2 * r}px`, opacity: String(since < 0.5 ? 1 - since / 0.5 : 0) });
  };
}

/** Notifications that drop in and stack, newest on top. items: [{title, body, at, icon}], icon
 * being a short text or emoji-free letter. Options: theme, accent, width (0.5). */
export function notifications(target, options = {}) {
  const dark = isDark(options);
  const root = stage(target, { size: 0.028, weight: 500, tracking: "-0.005em", ...options }, { alignItems: "flex-start", paddingTop: `${0.08 * H}px` });
  const column = make("div", root, { position: "relative", width: `${(options.width ?? 0.5) * W}px` });
  const items = (options.items ?? []).map((item, index) => {
    const card = make("div", column, { position: "absolute", left: "0", right: "0", top: "0", display: "flex", gap: "0.7em", alignItems: "center",
      padding: "0.8em 1em", borderRadius: "1em", textAlign: "left", background: dark ? "rgba(30,34,44,0.92)" : "rgba(255,255,255,0.94)",
      color: dark ? "#eef0f5" : "#15181f", boxShadow: "0 0.5em 1.5em rgba(0,0,0,0.18)" });
    make("div", card, { width: "2.2em", height: "2.2em", borderRadius: "0.6em", flex: "none", display: "grid", placeItems: "center",
      background: options.accent ?? theme.accent, color: "#fff", fontWeight: "800" }, item.icon ?? String(item.title ?? "").slice(0, 1));
    const text = make("div", card, { minWidth: "0" });
    make("div", text, { fontWeight: "700" }, item.title ?? "");
    make("div", text, { opacity: "0.7", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, item.body ?? "");
    return { card, at: item.at ?? index * 0.7 };
  });
  return (t) => {
    const s = local(t, options);
    items.forEach(({ card, at }, index) => {
      const newer = items.filter((other, j) => j > index && s >= other.at).length;
      const p = spring(s - at, { stiffness: 260, damping: 22 });
      const depth = newer;
      card.style.opacity = s < at ? "0" : String(clamp(1 - depth * 0.28));
      card.style.transform = `translateY(${(1 - p) * -1.2 + depth * 0.55}em) scale(${1 - depth * 0.05})`;
      card.style.zIndex = String(100 - depth);
    });
  };
}

// ---------------------------------------------------------------------------------------------
// Data

function svg(parent) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  element.setAttribute("viewBox", `0 0 ${W} ${H}`);
  style(element, { position: "absolute", inset: "0", width: "100%", height: "100%", overflow: "visible" });
  parent.appendChild(element);
  return element;
}

function shape(parent, tag, attributes) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  parent.appendChild(element);
  return element;
}

const number = (value, decimals = 0) => value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Bars that grow one after another, with labels and counting values. Options: values, labels,
 * color, accent (the highlighted bar, by highlight index), highlight, suffix, decimals, stagger (0.1). */
export function barChart(target, options = {}) {
  const root = stage(target, { size: 0.032, weight: 600, ...options }, { display: "block", padding: "0" });
  const canvas = svg(root);
  const values = options.values ?? [3, 5, 4, 8];
  const max = options.max ?? Math.max(...values);
  const left = 0.08 * W, right = 0.92 * W, top = 0.14 * H, bottom = 0.84 * H;
  const band = (right - left) / values.length, barWidth = band * 0.62;
  shape(canvas, "line", { x1: left, x2: right, y1: bottom, y2: bottom, stroke: options.color ?? theme.text, "stroke-opacity": 0.25, "stroke-width": 0.003 * H });
  const bars = values.map((value, index) => {
    const x = left + band * index + (band - barWidth) / 2;
    const fill = index === options.highlight ? options.accent ?? theme.accent : options.barColor ?? theme.primary;
    const rect = shape(canvas, "rect", { x, width: barWidth, rx: Math.min(barWidth * 0.12, 0.02 * H), fill });
    const label = shape(canvas, "text", { x: x + barWidth / 2, y: bottom + 0.06 * H, "text-anchor": "middle", fill: options.color ?? theme.text, "fill-opacity": 0.75, "font-size": 0.032 * H });
    label.textContent = options.labels?.[index] ?? "";
    const figure = shape(canvas, "text", { x: x + barWidth / 2, "text-anchor": "middle", fill: options.color ?? theme.text, "font-size": 0.038 * H, "font-weight": 800 });
    return { rect, figure, value };
  });
  return (t) => {
    const s = local(t, options);
    bars.forEach(({ rect, figure, value }, index) => {
      const p = progress(s, index * (options.stagger ?? 0.1), 0.9, ease.out);
      const height = (bottom - top) * (value / max) * p;
      rect.setAttribute("y", bottom - height);
      rect.setAttribute("height", Math.max(0, height));
      figure.setAttribute("y", bottom - height - 0.025 * H);
      figure.setAttribute("opacity", clamp(p * 2));
      figure.textContent = number(value * p, options.decimals ?? 0) + (options.suffix ?? "");
    });
  };
}

/** A line that draws itself across the frame, with a soft area under it and its last value.
 * Options: values, color, accent, fill (true), duration (1.4), suffix. */
export function lineChart(target, options = {}) {
  const root = stage(target, { size: 0.04, weight: 800, ...options }, { display: "block", padding: "0" });
  const canvas = svg(root);
  const values = options.values ?? [2, 3, 2.6, 4.2, 3.8, 5.6, 7];
  const min = options.min ?? Math.min(...values) * 0.9, max = options.max ?? Math.max(...values) * 1.05;
  const left = 0.07 * W, right = 0.86 * W, top = 0.15 * H, bottom = 0.85 * H;
  const points = values.map((value, i) => [left + (right - left) * (i / (values.length - 1)), bottom - (bottom - top) * ((value - min) / (max - min))]);
  const d = points.map(([x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = points[i - 1], mx = (px + x) / 2;
    return `C${mx},${py} ${mx},${y} ${x},${y}`;
  }).join(" ");
  const accent = options.accent ?? theme.accent;
  const gradient = shape(shape(canvas, "defs", {}), "linearGradient", { id: "arrumo-area", x1: 0, x2: 0, y1: 0, y2: 1 });
  shape(gradient, "stop", { offset: "0", "stop-color": accent, "stop-opacity": 0.35 });
  shape(gradient, "stop", { offset: "1", "stop-color": accent, "stop-opacity": 0 });
  const clip = shape(shape(canvas, "defs", {}), "clipPath", { id: "arrumo-reveal" });
  const reveal = shape(clip, "rect", { x: 0, y: 0, height: H, width: 0 });
  const area = options.fill === false ? null : shape(canvas, "path", { d: `${d} L${right},${bottom} L${left},${bottom} Z`, fill: "url(#arrumo-area)", "clip-path": "url(#arrumo-reveal)" });
  const line = shape(canvas, "path", { d, fill: "none", stroke: accent, "stroke-width": 0.008 * H, "stroke-linecap": "round", "stroke-linejoin": "round" });
  const dot = shape(canvas, "circle", { r: 0.014 * H, fill: options.color ?? theme.text, stroke: accent, "stroke-width": 0.006 * H });
  const label = shape(canvas, "text", { fill: options.color ?? theme.text, "font-size": options.size ? options.size * H : 0.05 * H, "font-weight": 800 });
  let length;
  return (t) => {
    length ??= line.getTotalLength();
    const p = progress(local(t, options), 0, options.duration ?? 1.4, ease.inOut);
    line.setAttribute("stroke-dasharray", `${length} ${length}`);
    line.setAttribute("stroke-dashoffset", length * (1 - p));
    const at = line.getPointAtLength(length * p);
    reveal.setAttribute("width", at.x);
    dot.setAttribute("cx", at.x); dot.setAttribute("cy", at.y);
    dot.setAttribute("opacity", p > 0 ? 1 : 0);
    const index = (values.length - 1) * clamp((at.x - left) / (right - left));
    const value = lerp(values[Math.floor(index)], values[Math.min(values.length - 1, Math.floor(index) + 1)], index % 1);
    label.setAttribute("x", at.x + 0.025 * H); label.setAttribute("y", at.y - 0.025 * H);
    label.setAttribute("opacity", p > 0 ? 1 : 0);
    label.textContent = number(value, options.decimals ?? 0) + (options.suffix ?? "");
    area?.setAttribute("opacity", 1);
  };
}

/** A ring that fills to a share, with the figure counting in its centre and a label below.
 * Options: value (0..100), label, color, accent, track, duration (1.4), suffix ("%"). */
export function ring(target, options = {}) {
  const root = stage(target, { size: 0.12, weight: 800, ...options }, { display: "block", padding: "0" });
  const canvas = svg(root);
  const r = 0.3 * Math.min(W, H), cx = W / 2, cy = H / 2 - (options.label ? 0.04 * H : 0), stroke = r * 0.16;
  shape(canvas, "circle", { cx, cy, r, fill: "none", stroke: options.track ?? "rgba(255,255,255,0.14)", "stroke-width": stroke });
  const arc = shape(canvas, "circle", { cx, cy, r, fill: "none", stroke: options.accent ?? theme.accent, "stroke-width": stroke, "stroke-linecap": "round", transform: `rotate(-90 ${cx} ${cy})` });
  const figure = shape(canvas, "text", { x: cx, y: cy + r * 0.18, "text-anchor": "middle", fill: options.color ?? theme.text, "font-size": r * 0.52, "font-weight": 800 });
  const label = shape(canvas, "text", { x: cx, y: cy + r + stroke + 0.07 * H, "text-anchor": "middle", fill: options.color ?? theme.text, "fill-opacity": 0.75, "font-size": 0.045 * H, "font-weight": 600 });
  label.textContent = options.label ?? "";
  const circumference = 2 * Math.PI * r, value = options.value ?? 72;
  return (t) => {
    const p = progress(local(t, options), 0, options.duration ?? 1.4, ease.expo);
    arc.setAttribute("stroke-dasharray", `${circumference * (value / 100) * p} ${circumference}`);
    figure.textContent = `${Math.round(value * p)}${options.suffix ?? "%"}`;
  };
}

// ---------------------------------------------------------------------------------------------
// Brand

/** A wordmark whose letters fly in from scattered places and lock together, then an accent
 * line sweeps under it and an optional tagline fades in. Options: text, tagline, accent. */
export function logoSting(target, options = {}) {
  const root = stage(target, { size: 0.14, weight: 900, tracking: "-0.04em", ...options }, { flexDirection: "column", gap: "0.12em" });
  const mark = make("div", root, { position: "relative", display: "flex", whiteSpace: "pre" });
  const letters = [...String(options.text ?? "Arrumo")].map((char) => make("span", mark, { display: "inline-block" }, char));
  const underline = make("div", mark, { position: "absolute", left: "0", right: "0", bottom: "-0.12em", height: "0.07em",
    background: options.accent ?? theme.accent, borderRadius: "0.04em", transformOrigin: "0 50%", transform: "scaleX(0)" });
  const tagline = options.tagline ? make("div", root, { fontSize: "0.28em", fontWeight: "500", letterSpacing: "0.02em", opacity: "0" }, options.tagline) : null;
  return (t) => {
    const s = local(t, options);
    letters.forEach((letter, i) => {
      const p = spring(s - i * 0.045, { stiffness: 210, damping: 19 });
      const dx = (random(i * 7 + 1) - 0.5) * 6, dy = (random(i * 7 + 2) - 0.5) * 4, turn = (random(i * 7 + 3) - 0.5) * 90;
      letter.style.opacity = String(clamp((s - i * 0.045) * 5));
      letter.style.transform = `translate(${dx * (1 - p)}em, ${dy * (1 - p)}em) rotate(${turn * (1 - p)}deg) scale(${lerp(0.4, 1, p)})`;
    });
    const settled = 0.5 + letters.length * 0.045;
    underline.style.transform = `scaleX(${progress(s, settled, 0.5, ease.inOut)})`;
    if (tagline) {
      const p = progress(s, settled + 0.35, 0.6);
      tagline.style.opacity = String(p);
      tagline.style.transform = `translateY(${(1 - p) * 0.5}em)`;
    }
  };
}

// ---------------------------------------------------------------------------------------------
// Transitions

function canvas2d(target) {
  const element = make("canvas", target ?? document.body, { position: "absolute", inset: "0", width: "100%", height: "100%" });
  element.width = W; element.height = H;
  return element.getContext("2d");
}

/** A circle of colour grows from a point to cover the frame, then opens from the centre to show
 * what's next. Options: color, origin ([0.5, 0.5]), duration (1.2), mode ("through", "cover" or
 * "reveal"), dots (a ring of small dots leading the edge, true). */
export function bloom(target, options = {}) {
  const context = canvas2d(target);
  const [ox, oy] = options.origin ?? [0.5, 0.5];
  const reach = Math.hypot(Math.max(ox, 1 - ox) * W, Math.max(oy, 1 - oy) * H) * 1.02;
  const duration = options.duration ?? 1.2, mode = options.mode ?? "through";
  return (t) => {
    const s = local(t, options) / duration;
    context.clearRect(0, 0, W, H);
    context.fillStyle = options.color ?? theme.accent;
    const grow = mode === "reveal" ? 1 : progress(s, 0, mode === "through" ? 0.5 : 1, ease.inOut);
    const open = mode === "cover" ? 0 : progress(s, mode === "through" ? 0.5 : 0, mode === "through" ? 0.5 : 1, ease.inOut);
    context.beginPath();
    context.arc(ox * W, oy * H, grow * reach, 0, Math.PI * 2);
    if (open > 0) context.arc(ox * W, oy * H, open * reach, 0, Math.PI * 2, true);
    context.fill("evenodd");
    if (options.dots !== false && grow < 1) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2, r = grow * reach * 1.08 + 0.02 * H;
        context.beginPath();
        context.arc(ox * W + Math.cos(a) * r, oy * H + Math.sin(a) * r, 0.008 * H * (1 - grow), 0, Math.PI * 2);
        context.fill();
      }
    }
  };
}

/** Panels slide across in a stagger to cover the frame and slide on to uncover it. Options:
 * colors (one per panel, cycling), panels (4), direction ("left", "right", "up", "down"),
 * duration (1.1). */
export function panels(target, options = {}) {
  const context = canvas2d(target);
  const count = options.panels ?? 4, colors = options.colors ?? theme.colors;
  const vertical = options.direction === "up" || options.direction === "down";
  const sign = options.direction === "right" || options.direction === "down" ? -1 : 1;
  const duration = options.duration ?? 1.1;
  return (t) => {
    const s = local(t, options) / duration;
    context.clearRect(0, 0, W, H);
    for (let i = 0; i < count; i++) {
      const delay = i * 0.08;
      const inP = progress(s, delay, 0.45, ease.inOut), outP = progress(s, 0.5 + delay, 0.45, ease.inOut);
      const position = sign * (1 - inP - outP); // 1 = off one side, 0 = covering, -1 = off the other
      context.fillStyle = colors[i % colors.length];
      if (vertical) {
        const w = W / count;
        context.fillRect(i * w, position * H, w + 1, H);
      } else {
        const h = H / count;
        context.fillRect(position * W, i * h, W, h + 1);
      }
    }
  };
}

// ---------------------------------------------------------------------------------------------
// Maps

/** A dotted globe turning slowly, with arcs rising between places and pulsing markers. Options:
 * arcs ([[lat, lon, lat, lon], ...]), places ([[lat, lon], ...]), color (dots), accent (arcs),
 * spin (degrees a second, 12), tilt (degrees, 18), center (starting longitude), size (0.42 of
 * the shorter side, as the radius). */
export function globe(target, options = {}) {
  const context = canvas2d(target);
  const radius = (options.size ?? 0.42) * Math.min(W, H);
  const dots = [];
  const count = options.dots ?? 2600;
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    dots.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  const toVector = (lat, lon) => {
    const phi = (lat * Math.PI) / 180, lambda = (lon * Math.PI) / 180;
    return [Math.cos(phi) * Math.sin(lambda), Math.sin(phi), Math.cos(phi) * Math.cos(lambda)];
  };
  const arcs = (options.arcs ?? [[38.7, -9.1, 40.7, -74], [38.7, -9.1, -23.5, -46.6], [38.7, -9.1, 51.5, -0.1]]);
  const places = options.places ?? [...new Map(arcs.flatMap(([a, b, c, d]) => [[`${a},${b}`, [a, b]], [`${c},${d}`, [c, d]]])).values()];
  const accent = options.accent ?? theme.accent, color = options.color ?? theme.secondary;
  return (t) => {
    const s = local(t, options);
    const spin = (((options.center ?? 20) + s * (options.spin ?? 12)) * Math.PI) / 180;
    const tilt = ((options.tilt ?? 18) * Math.PI) / 180;
    const project = ([x, y, z]) => {
      const x1 = x * Math.cos(spin) - z * Math.sin(spin), z1 = x * Math.sin(spin) + z * Math.cos(spin);
      const y2 = y * Math.cos(tilt) - z1 * Math.sin(tilt), z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt);
      return [W / 2 + x1 * radius, H / 2 - y2 * radius, z2];
    };
    context.clearRect(0, 0, W, H);
    const glow = context.createRadialGradient(W / 2, H / 2, radius * 0.7, W / 2, H / 2, radius * 1.15);
    glow.addColorStop(0, "rgba(0,0,0,0)"); glow.addColorStop(0.6, `${color}22`); glow.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = glow; context.fillRect(0, 0, W, H);
    context.fillStyle = color;
    for (const dot of dots) {
      const [x, y, z] = project(dot);
      if (z < 0) continue;
      context.globalAlpha = 0.15 + 0.75 * z;
      context.fillRect(x - 0.9, y - 0.9, 1.8 + z, 1.8 + z);
    }
    context.globalAlpha = 1;
    arcs.forEach(([la1, lo1, la2, lo2], index) => {
      const a = toVector(la1, lo1), b = toVector(la2, lo2);
      const p = progress(s, 0.4 + index * 0.35, 1.2, ease.inOut);
      if (p <= 0) return;
      const angle = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
      context.strokeStyle = accent; context.lineWidth = Math.max(2, radius * 0.008); context.lineCap = "round";
      context.beginPath();
      const steps = 48;
      for (let k = 0; k <= steps * p; k++) {
        const f = k / steps, sa = Math.sin((1 - f) * angle) / Math.sin(angle), sb = Math.sin(f * angle) / Math.sin(angle);
        const lift = 1 + 0.25 * Math.sin(Math.PI * f) * angle / Math.PI;
        const point = project([(a[0] * sa + b[0] * sb) * lift, (a[1] * sa + b[1] * sb) * lift, (a[2] * sa + b[2] * sb) * lift]);
        k === 0 ? context.moveTo(point[0], point[1]) : context.lineTo(point[0], point[1]);
      }
      context.stroke();
    });
    places.forEach(([lat, lon], index) => {
      const [x, y, z] = project(toVector(lat, lon));
      if (z < 0) return;
      const pulse = (s * 0.8 + index * 0.3) % 1;
      context.fillStyle = accent;
      context.globalAlpha = 1;
      context.beginPath(); context.arc(x, y, radius * 0.018, 0, Math.PI * 2); context.fill();
      context.globalAlpha = 1 - pulse;
      context.strokeStyle = accent; context.lineWidth = 2;
      context.beginPath(); context.arc(x, y, radius * (0.02 + pulse * 0.06), 0, Math.PI * 2); context.stroke();
      context.globalAlpha = 1;
    });
  };
}
