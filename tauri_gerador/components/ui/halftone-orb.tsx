"use client"

// From chatcn, chat, voice and agent UI for shadcn: https://chatcn.dev

import * as React from "react"
import { forwardRef, createElement, type SVGAttributes, type ForwardRefExoticComponent, type RefAttributes } from "react"
import { cn } from "@/lib/utils"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

/** chatcn theme variables and utilities this file uses, light and dark. */
const CHATCN_CSS = ":root{--chatcn-accent:var(--chatcn-gray-1000);--chatcn-bg:oklch(1 0 0);--chatcn-ease-out:cubic-bezier(0.23, 1, 0.32, 1);--chatcn-fg:var(--chatcn-gray-1000);--chatcn-fg-faint:var(--chatcn-gray-700);--chatcn-fg-muted:var(--chatcn-gray-900);--chatcn-fg-subtle:var(--chatcn-gray-800);--chatcn-fill:var(--chatcn-gray-100);--chatcn-fill-active:var(--chatcn-gray-300);--chatcn-gray-100:oklch(0.970 0 0);--chatcn-gray-1000:oklch(0.145 0 0);--chatcn-gray-300:oklch(0.930 0 0);--chatcn-gray-700:oklch(0.700 0 0);--chatcn-gray-800:oklch(0.525 0 0);--chatcn-gray-900:oklch(0.440 0 0);--chatcn-press-scale-icon:0.94;--chatcn-radius-md:8px;--chatcn-radius-sm:6px;--chatcn-red:oklch(0.560 0.200 27);--chatcn-shadow-md:0 0 0 1px oklch(0 0 0 / 0.06), 0 2px 4px -1px oklch(0 0 0 / 0.06), 0 8px 16px -4px oklch(0 0 0 / 0.08);--chatcn-shadow-sm:0 0 0 1px oklch(0 0 0 / 0.06), 0 1px 2px -1px oklch(0 0 0 / 0.06), 0 2px 4px oklch(0 0 0 / 0.04);--chatcn-surface:oklch(1 0 0)}.dark{--chatcn-accent:var(--chatcn-gray-1000);--chatcn-bg:oklch(0.145 0 0);--chatcn-fg:var(--chatcn-gray-1000);--chatcn-fg-faint:var(--chatcn-gray-700);--chatcn-fg-muted:var(--chatcn-gray-900);--chatcn-fg-subtle:var(--chatcn-gray-800);--chatcn-fill:var(--chatcn-gray-100);--chatcn-fill-active:var(--chatcn-gray-300);--chatcn-gray-100:oklch(0.195 0 0);--chatcn-gray-1000:oklch(0.970 0 0);--chatcn-gray-300:oklch(0.255 0 0);--chatcn-gray-700:oklch(0.500 0 0);--chatcn-gray-800:oklch(0.620 0 0);--chatcn-gray-900:oklch(0.720 0 0);--chatcn-red:oklch(0.700 0.175 22);--chatcn-shadow-md:0 0 0 1px oklch(1 0 0 / 0.09), inset 0 1px 0 oklch(1 0 0 / 0.04), 0 8px 16px -4px oklch(0 0 0 / 0.5);--chatcn-shadow-sm:0 0 0 1px oklch(1 0 0 / 0.08), inset 0 1px 0 oklch(1 0 0 / 0.03), 0 2px 4px oklch(0 0 0 / 0.4);--chatcn-surface:oklch(0.205 0 0)}.chatcn-focus{}.chatcn-focus:focus-visible{outline: 2px solid var(--chatcn-accent); outline-offset: 2px;}"
if (typeof document !== "undefined" && !document.getElementById("chatcn-halftone-orb")) {
  const style = document.createElement("style")
  style.id = "chatcn-halftone-orb"
  style.textContent = CHATCN_CSS
  document.head.appendChild(style)
}

/**
 * chatcn Pro voice orbs: the form every effect orb (dither, halftone, ASCII) shares. One set of
 * form parameters per voice state, how the audio level bends them, and the sphere's tone at any
 * point, as GLSL for the shader orbs and as plain JS for the ASCII orb and the canvas fallbacks.
 * No React and no DOM.
 *
 * The form is a lit sphere. Every state is a target form; the driver eases the current form
 * toward it every frame (critically damped, never overshooting), so any state can follow any
 * other and the orb morphs instead of cutting.
 *
 * - idle: breathing slowly, the surface barely drifting.
 * - connecting: smaller, a band of light sweeping around it.
 * - listening: the surface stirs and the marks thicken with the user's voice.
 * - thinking: smaller, the light orbiting it like a moon's phases.
 * - speaking: the sphere swells with the agent's voice and its grain comes alive.
 * - interrupted: a quick contraction, pressed flat.
 * - muted: still and faint, with fewer marks.
 * - error: dim, broken along a crack, in the red token.
 */

type OrbState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "muted"
  | "error"

/* -------------------------------------------------------------------------------------------------
 * Level and band sources
 *
 * Voice components take audio levels as plain values or as getters. A number re-renders the
 * component on every change, which is fine at 20 updates a second. A getter is read once per
 * animation frame and never re-renders anything, which is what a 60 fps meter wants.
 * -----------------------------------------------------------------------------------------------*/

/** A level from 0 to 1, or a function that returns the current one. */
type ChatcnLevel = number | (() => number)

type OrbSize = "sm" | "md" | "lg" | "xl"

type EffectRenderer = "auto" | "webgl" | "2d"

/* -------------------------------------------------------------------------------------------------
 * Shared props and shell
 *
 * Every effect orb takes the free voice orb's props, so any of them swaps in for `VoiceOrb`
 * without touching the call site. The shell holds the accessible name, the state attribute,
 * the forced colors fallback and the pause control.
 * -----------------------------------------------------------------------------------------------*/

/** `canvas` and `svg` are the free orb's names; both mean the canvas 2D path here. */
type OrbRenderer = EffectRenderer | "canvas" | "svg"

interface EffectOrbProps extends Omit<React.ComponentProps<"div">, "children"> {
  state?: OrbState
  /**
   * Audio level from 0 to 1: the user's input while listening, the agent's output while speaking.
   * Pass a getter (`() => number`) to animate at the frame rate without re-rendering.
   */
  level?: ChatcnLevel
  /** Input level, when you meter both sides. Used while listening. Falls back to `level`. */
  inputLevel?: ChatcnLevel
  /** Output level, when you meter both sides. Used while speaking. Falls back to `level`. */
  outputLevel?: ChatcnLevel
  /** Drive listening and speaking with the built-in speech simulator where no level is passed. */
  simulate?: boolean
  /** 40, 72, 144 or 224 px, or any number of px. Default `lg`. */
  size?: OrbSize | number
  /** `auto` (default) prefers the shared WebGL2 context and falls back to canvas 2D. */
  renderer?: OrbRenderer
  /** Force reduced motion on or off. Defaults to the user's setting. */
  reducedMotion?: boolean
  /** Accessible name. Defaults to the state, for example "Voice: listening". */
  label?: string
  /** Marks. Any CSS color or token. Default `var(--chatcn-fg)`. */
  ink?: string
  /** Controlled pause of the loop. */
  paused?: boolean
  defaultPaused?: boolean
  onPausedChange?: (paused: boolean) => void
  /** Show the pause button (WCAG 2.2.2). Default on from 120 px, where it has room. */
  pauseControl?: boolean
}

/* -------------------------------------------------------------------------------------------------
 * HalftoneOrb
 * -----------------------------------------------------------------------------------------------*/

export interface HalftoneOrbProps extends EffectOrbProps {
  /** Dot rows from pole to pole. Default by size, about one row per 7 px. */
  rows?: number
}

/** Same steps as the free voice orb: 40, 72, 144 and 224 px. */
const ORB_SIZES: Record<OrbSize, number> = { sm: 40, md: 72, lg: 144, xl: 224 }

function orbPixels(size: OrbSize | number) {
  return typeof size === "number" ? size : ORB_SIZES[size]
}

type UniformValue =
  | number
  | boolean
  | readonly [number, number]
  | readonly [number, number, number]
  | readonly [number, number, number, number]

type UniformBag = Record<string, UniformValue>

/** Raw pixel data for a texture, for example the blue noise tile. */
interface EffectDataTexture {
  data: Uint8Array
  width: number
  height: number
  /** `r8` (one channel, read `.r`) or `rgba8`. Default `r8`. */
  format?: "r8" | "rgba8"
}

type EffectTextureSource =
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap
  | OffscreenCanvas
  | HTMLVideoElement
  | EffectDataTexture

interface EffectTextureOptions {
  /** `repeat` tiles (noise), `clamp` stops at the edge (images). Default `clamp`. */
  wrap?: "clamp" | "repeat"
  /** `nearest` keeps texels crisp (noise, pixel art), `linear` smooths (photos). Default `linear`. */
  filter?: "nearest" | "linear"
  /** Re-upload on every render, for video or a canvas you draw into. */
  dynamic?: boolean
  /**
   * Build mipmaps so `textureLod` can average many texels into one dither cell or halftone dot.
   * Default on for linear, static images; off for data and dynamic textures.
   */
  mipmap?: boolean
}

interface EffectHandle {
  /** `webgl` or `2d` once resized; `none` when neither path can draw. */
  readonly mode: "webgl" | "2d" | "none"
  /** Backing store size and the pixel ratio actually used. */
  readonly size: { width: number; height: number; dpr: number }
  /** Sizes the backing store for a CSS box. Returns true when the size changed. */
  resize(cssWidth: number, cssHeight: number): boolean
  setUniforms(values: UniformBag): void
  setTexture(name: string, source: EffectTextureSource | null, options?: EffectTextureOptions): void
  /** Draws one frame. `time` in seconds feeds `u_time`. */
  render(time?: number): void
  /** Called after the shared context comes back from a loss; re-render there. */
  onRestore(callback: () => void): () => void
  dispose(): void
}

/**
 * chatcn Pro effect runtime: one WebGL2 context for every effect on the page.
 *
 * Usage
 * ```ts
 * import { createEffect, GLSL } from "@/lib/chatcn-pro-effects"
 *
 * const effect = createEffect(canvas, {
 *   fragment: `${GLSL.luminance}${GLSL.bayer}
 *     uniform sampler2D u_image;
 *     uniform vec4 u_ink;
 *     uniform vec4 u_paper;
 *     void main() {
 *       float l = chatcnLuma(texture(u_image, v_uv).rgb);
 *       out_color = l > chatcnBayer(chatcnPx(), 4) ? u_paper : u_ink;
 *     }`,
 *   // Optional: the same picture in canvas 2D, used when WebGL2 is missing or lost.
 *   fallback: ({ ctx, width, height, uniforms, textures }) => { ... },
 * })
 * effect.resize(cssWidth, cssHeight)        // backing store: css px x DPR, under the pixel cap
 * effect.setUniforms({ u_ink: ink, u_paper: paper })
 * effect.setTexture("u_image", image)       // HTMLImageElement, canvas, ImageBitmap or data
 * effect.render()                           // draws one frame; loops call it from a frame clock
 * effect.dispose()
 * ```
 *
 * Fragment contract (GLSL ES 3.00; `#version`, precision and these declarations are added):
 * - `in vec2 v_uv` 0 to 1 with the origin at the top left, `out vec4 out_color` (straight alpha).
 * - `uniform vec2 u_resolution` backing store size in px, `uniform float u_time` seconds,
 *   `uniform float u_dpr` the effective pixel ratio after the cap.
 * - `vec2 chatcnPx()` the pixel coordinate with the origin at the top left.
 * - Snippets in `GLSL` are opt in: prepend the ones you use. `GLSL.blueNoise` expects the tile
 *   from `blueNoiseTexture()` in `@/lib/chatcn-pro-dither` bound as `u_blueNoise`.
 *
 * Why one context: browsers cap live WebGL contexts at about 16, and a feed of 40 dithered tiles
 * must not hit it. Every effect renders into one hidden WebGL2 canvas and is copied into its own
 * 2D canvas in the same task, so each tile stays a normal DOM element that scrolls and clips.
 *
 * Also here: a shared frame clock with an fps cap (`addFrameCallback`), one IntersectionObserver
 * for every effect (`observeVisibility`), page visibility, media query subscriptions, a cached
 * CORS-safe image loader (`loadEffectImage`) and `getEffectStats()` for the engine demo.
 */

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

/** A color as four 0 to 1 floats, straight alpha. */
type EffectRGBA = readonly [number, number, number, number]

type ThemeColorInput = string | EffectRGBA

interface EffectColorsInput {
  /** Marks: dots, dither pixels, glyphs. Default `var(--chatcn-fg)`. */
  ink?: ThemeColorInput
  /** The ground. Default `var(--chatcn-bg)`. Pass `transparent` to let the surface show. */
  paper?: ThemeColorInput
}

interface EffectColors {
  ink: EffectRGBA
  paper: EffectRGBA
  /** True under `prefers-contrast: more`, where the pair snaps to the text and canvas tokens. */
  contrastMore: boolean
  /** 0 until the first resolve, then bumps on every theme change. Redraw when it moves. */
  version: number
}

/** Subscribes to a media query. Returns the unsubscribe function. */
function subscribeMedia(query: string, callback: (matches: boolean) => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const list = window.matchMedia(query)
  const handler = () => callback(list.matches)
  list.addEventListener("change", handler)
  return () => list.removeEventListener("change", handler)
}

/** Current value of a media query; false on the server. */
function matchesMedia(query: string) {
  return typeof window !== "undefined" && window.matchMedia?.(query).matches === true
}

function useMedia(query: string) {
  return React.useSyncExternalStore(
    (onChange) => subscribeMedia(query, onChange),
    () => matchesMedia(query),
    () => false,
  )
}

const CONTRAST_MORE = "(prefers-contrast: more)"

/** True under `prefers-contrast: more`. */
function usePrefersContrastMore() {
  return useMedia(CONTRAST_MORE)
}

const BLACK: EffectRGBA = [0, 0, 0, 1]

const WHITE: EffectRGBA = [1, 1, 1, 1]

/* -------------------------------------------------------------------------------------------------
 * Hooks
 * -----------------------------------------------------------------------------------------------*/

const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

const byComputed = new Map<string, EffectRGBA>()

/* -------------------------------------------------------------------------------------------------
 * Resolution
 * -----------------------------------------------------------------------------------------------*/

let paintCtx: CanvasRenderingContext2D | null | undefined

function painter() {
  if (paintCtx !== undefined) return paintCtx
  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  paintCtx = canvas.getContext("2d", { willReadFrequently: true })
  return paintCtx
}

function paint(computed: string): EffectRGBA {
  const cached = byComputed.get(computed)
  if (cached) return cached
  const ctx = painter()
  if (!ctx) return BLACK
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = "#000"
  ctx.fillStyle = computed
  ctx.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0, b = 0, a = 255] = ctx.getImageData(0, 0, 1, 1).data
  const rgba: EffectRGBA = [r / 255, g / 255, b / 255, a / 255]
  if (byComputed.size > 256) byComputed.clear()
  byComputed.set(computed, rgba)
  return rgba
}

/**
 * Resolves any CSS color (`var(--chatcn-fg)`, `oklch(...)`, `currentColor`, a name) to RGBA in
 * the context of `scope`, so scoped variables and preview themes apply. Falls back to black.
 */
function resolveThemeColor(color: ThemeColorInput, scope?: Element | null): EffectRGBA {
  if (typeof color !== "string") return color
  if (typeof document === "undefined") return BLACK
  const host = scope?.isConnected ? scope : document.body
  if (!host) return BLACK
  const probe = document.createElement("span")
  probe.setAttribute("aria-hidden", "true")
  probe.style.display = "none"
  probe.style.color = color
  host.appendChild(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()
  return paint(computed)
}

/** Relative luminance of an RGBA color, for picking the darker of two. */
function colorLuminance([r, g, b]: EffectRGBA) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function same(a: EffectRGBA, b: EffectRGBA) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
}

/* -------------------------------------------------------------------------------------------------
 * Theme changes
 * -----------------------------------------------------------------------------------------------*/

const themeListeners = new Set<() => void>()

let teardown: (() => void) | null = null

let pending = 0

function notify() {
  if (pending) return
  // Batch: a theme switch flips several attributes at once; every effect re-resolves once.
  pending = requestAnimationFrame(() => {
    pending = 0
    for (const listener of themeListeners) listener()
  })
}

const FORCED_COLORS = "(forced-colors: active)"

function startWatching() {
  const observer = new MutationObserver(notify)
  observer.observe(document.documentElement, { attributes: true })
  if (document.body) observer.observe(document.body, { attributes: true })
  observer.observe(document.head, { childList: true })
  const media = ["(prefers-color-scheme: dark)", CONTRAST_MORE, FORCED_COLORS].map((query) =>
    subscribeMedia(query, notify),
  )
  return () => {
    observer.disconnect()
    for (const off of media) off()
    if (pending) cancelAnimationFrame(pending)
    pending = 0
  }
}

/**
 * Calls `callback` (batched to one frame) whenever the page theme may have changed. Returns the
 * unsubscribe function.
 */
function subscribeTheme(callback: () => void) {
  if (typeof document === "undefined") return () => {}
  themeListeners.add(callback)
  if (!teardown) teardown = startWatching()
  return () => {
    themeListeners.delete(callback)
    if (themeListeners.size === 0 && teardown) {
      teardown()
      teardown = null
    }
  }
}

/**
 * Ink and paper for an effect. Under `prefers-contrast: more` both snap to `--chatcn-fg` and
 * `--chatcn-bg` (whichever is nearer each one), so there are no mid tones; a transparent paper
 * stays transparent.
 */
function useEffectColors(
  { ink = "var(--chatcn-fg)", paper = "var(--chatcn-bg)" }: EffectColorsInput,
  ref?: React.RefObject<Element | null>,
): EffectColors {
  const contrastMore = usePrefersContrastMore()
  const [state, setState] = React.useState<EffectColors>(() => ({
    ink: typeof ink === "string" ? BLACK : ink,
    paper: typeof paper === "string" ? WHITE : paper,
    contrastMore,
    version: 0,
  }))
  const inkKey = typeof ink === "string" ? ink : ink.join(",")
  const paperKey = typeof paper === "string" ? paper : paper.join(",")

  useIsoLayoutEffect(() => {
    const resolve = () => {
      const scope = ref?.current ?? null
      let nextInk = resolveThemeColor(ink, scope)
      let nextPaper = resolveThemeColor(paper, scope)
      if (contrastMore) {
        const fg = resolveThemeColor("var(--chatcn-fg, CanvasText)", scope)
        const bg = resolveThemeColor("var(--chatcn-bg, Canvas)", scope)
        const fgL = colorLuminance(fg)
        const bgL = colorLuminance(bg)
        const nearest = (c: EffectRGBA) =>
          Math.abs(colorLuminance(c) - fgL) <= Math.abs(colorLuminance(c) - bgL) ? fg : bg
        const inkPure = nearest(nextInk)
        // Keep ink and paper apart even when both were nearer the same end.
        const paperPure = inkPure === fg ? bg : fg
        nextInk = inkPure
        nextPaper = nextPaper[3] === 0 ? nextPaper : paperPure
      }
      setState((prev) =>
        prev.version > 0 &&
        same(prev.ink, nextInk) &&
        same(prev.paper, nextPaper) &&
        prev.contrastMore === contrastMore
          ? prev
          : { ink: nextInk, paper: nextPaper, contrastMore, version: prev.version + 1 },
      )
    }
    resolve()
    return subscribeTheme(resolve)
  }, [inkKey, paperKey, contrastMore, ref])

  return state
}

/** One color, resolved where `ref` sits and kept in step with the theme. */
function useThemeColor(
  color: ThemeColorInput,
  ref?: React.RefObject<Element | null>,
): EffectRGBA {
  return useEffectColors({ ink: color, paper: color }, ref).ink
}

interface OrbForm {
  /** Sphere radius as a share of half the box. */
  scale: number
  /** Surface noise added to the tone. */
  noise: number
  /** Silhouette wobble. */
  edge: number
  /** How fast the surface noise moves. */
  stir: number
  /** Light orbit speed around the vertical axis, radians per second. */
  orbit: number
  /** Surface turn speed, radians per second. */
  turn: number
  /** Band sweep speed, radians per second. */
  sweep: number
  /** 0 none, 1 a full band of light sweeping around the sphere. */
  band: number
  /** 0 round, 1 flat. */
  squash: number
  /** 0 whole, 1 broken in two. */
  split: number
  /** Overall density. */
  ink: number
  /** Added to the tone: more or fewer marks. */
  bias: number
  /** Threshold jitter that moves every frame: the live grain of a voice. */
  grain: number
  /** 0 ink, 1 the alert color. */
  alert: number
  /** Breathing amplitude, as a share of the radius. */
  breathe: number
}

/** Phases the driver integrates, so a speed change never makes the orb jump. */
interface OrbPhases {
  /** Noise time. */
  t: number
  light: number
  turn: number
  sweep: number
}

/** Everything an orb needs to draw one frame. */
interface OrbFrame {
  form: OrbForm
  phases: OrbPhases
  /** Breathing offset added to `form.scale`. */
  breath: number
  /** Smoothed voice level, 0 to 1. */
  level: number
  /** Seconds since the orb started, paused time excluded. */
  time: number
}

/* -------------------------------------------------------------------------------------------------
 * Uniforms and GLSL
 * -----------------------------------------------------------------------------------------------*/

/** The uniform bag every orb shader reads. */
function orbUniforms(frame: OrbFrame) {
  const f = frame.form
  return {
    u_scale: Math.max(0.1, f.scale + frame.breath),
    u_noise: f.noise,
    u_edge: f.edge,
    u_t: frame.phases.t,
    u_light: frame.phases.light,
    u_turn: frame.phases.turn,
    u_sweep: frame.phases.sweep,
    u_band: f.band,
    u_squash: f.squash,
    u_split: f.split,
    u_ink: f.ink,
    u_bias: f.bias,
    u_grain: f.grain,
    u_alertMix: f.alert,
    u_level: frame.level,
  }
}

const TILT = 0.32

/** Packs an RGBA tuple for a canvas 2D fill without writing a color function by hand. */
function rgbaToCss([r, g, b, a]: EffectRGBA) {
  const to = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255)
  // design-lint-ignore-next-line raw-color: converts a resolved theme token for canvas 2D
  return `rgb(${to(r)} ${to(g)} ${to(b)} / ${Math.min(1, Math.max(0, a)).toFixed(3)})`
}

interface OrbDriverOptions {
  state: OrbState
  level?: ChatcnLevel
  inputLevel?: ChatcnLevel
  outputLevel?: ChatcnLevel
  simulate?: boolean
  /** Force reduced motion on or off. Defaults to the user's setting. */
  reducedMotion?: boolean
  paused?: boolean
  defaultPaused?: boolean
  onPausedChange?: (paused: boolean) => void
  /** Frame cap. Default 30. */
  fps?: number
}

interface OrbDriver {
  /** Draws the held frame again, after a color, size or renderer change. */
  redraw: () => void
  reducedMotion: boolean
  paused: boolean
  setPaused: (paused: boolean) => void
  /** True while the loop runs. */
  running: boolean
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"

/** True under `prefers-reduced-motion: reduce`. */
function useReducedMotion() {
  return React.useSyncExternalStore(
    (onChange) => subscribeMedia(REDUCED_MOTION, onChange),
    () => matchesMedia(REDUCED_MOTION),
    () => false,
  )
}

/* -------------------------------------------------------------------------------------------------
 * useEffectMotion
 * -----------------------------------------------------------------------------------------------*/

interface UseEffectMotionOptions {
  /** Controlled pause. */
  paused?: boolean
  /** Uncontrolled initial pause. Default false. */
  defaultPaused?: boolean
  onPausedChange?: (paused: boolean) => void
  /** Set false for effects that never loop; `running` then stays false. Default true. */
  loop?: boolean
}

interface EffectMotion {
  /** True when the loop may run: motion allowed, on screen, tab visible, not paused. */
  running: boolean
  reducedMotion: boolean
  /** On screen (with a 100 px margin). */
  visible: boolean
  pageVisible: boolean
  paused: boolean
  setPaused: (paused: boolean) => void
  togglePaused: () => void
}

/** True while the tab is visible. */
function isPageVisible() {
  return typeof document === "undefined" || document.visibilityState !== "hidden"
}

/** Calls back on `visibilitychange`. Returns the unsubscribe function. */
function onPageVisibility(callback: (visible: boolean) => void) {
  if (typeof document === "undefined") return () => {}
  const handler = () => callback(isPageVisible())
  document.addEventListener("visibilitychange", handler)
  return () => document.removeEventListener("visibilitychange", handler)
}

/** True while the tab is visible. */
function usePageVisible() {
  return React.useSyncExternalStore(
    (onChange) => onPageVisibility(onChange),
    isPageVisible,
    () => true,
  )
}

let intersection: IntersectionObserver | null = null

/* -------------------------------------------------------------------------------------------------
 * Visibility: one IntersectionObserver, page visibility and media queries
 * -----------------------------------------------------------------------------------------------*/

const visibilityCallbacks = new WeakMap<Element, Set<(visible: boolean) => void>>()

/**
 * Reports whether `element` is on screen (with a 100 px margin, so loops start just before they
 * scroll in). One observer serves every effect on the page. Returns the unsubscribe function.
 */
function observeVisibility(element: Element, callback: (visible: boolean) => void) {
  if (typeof IntersectionObserver === "undefined") {
    callback(true)
    return () => {}
  }
  if (!intersection) {
    intersection = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const set = visibilityCallbacks.get(entry.target)
          if (set) for (const cb of set) cb(entry.isIntersecting)
        }
      },
      { rootMargin: "100px" },
    )
  }
  let set = visibilityCallbacks.get(element)
  if (!set) {
    set = new Set()
    visibilityCallbacks.set(element, set)
    intersection.observe(element)
  }
  set.add(callback)
  return () => {
    const current = visibilityCallbacks.get(element)
    if (!current) return
    current.delete(callback)
    if (current.size === 0) {
      visibilityCallbacks.delete(element)
      intersection?.unobserve(element)
    }
  }
}

/** True while `ref` is on screen, through the shared IntersectionObserver. */
function useOnScreen(ref: React.RefObject<Element | null>) {
  const [visible, setVisible] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    return observeVisibility(el, setVisible)
  }, [ref])
  return visible
}

function useEffectMotion(
  ref: React.RefObject<Element | null>,
  {
    paused: pausedProp,
    defaultPaused = false,
    onPausedChange,
    loop = true,
  }: UseEffectMotionOptions = {},
): EffectMotion {
  const reducedMotion = useReducedMotion()
  const pageVisible = usePageVisible()
  const visible = useOnScreen(ref)
  const [inner, setInner] = React.useState(defaultPaused)
  const paused = pausedProp ?? inner
  const callback = React.useRef(onPausedChange)
  callback.current = onPausedChange

  const setPaused = React.useCallback(
    (next: boolean) => {
      if (pausedProp === undefined) setInner(next)
      callback.current?.(next)
    },
    [pausedProp],
  )
  const togglePaused = React.useCallback(() => setPaused(!paused), [paused, setPaused])

  return {
    running: loop && !reducedMotion && visible && pageVisible && !paused,
    reducedMotion,
    visible,
    pageVisible,
    paused,
    setPaused,
    togglePaused,
  }
}

interface ChatcnSpeechLevel {
  /** Current smoothed level from 0 to 1. Call it every frame. */
  getLevel: () => number
  /** `count` band levels from 0 to 1, lowest first, with two moving formant humps. */
  getBands: (count: number) => Float32Array
  setSpeaking: (speaking: boolean) => void
  isSpeaking: () => boolean
}

/* -------------------------------------------------------------------------------------------------
 * Simulated speech levels
 *
 * Demos, tests and design reviews need a voice without a microphone. A random walk reads as
 * noise; speech has syllables (about four a second), short gaps between words and a slower phrase
 * contour. This generator models those three layers so a meter driven by it looks like someone
 * talking.
 * -----------------------------------------------------------------------------------------------*/

interface ChatcnSpeechLevelOptions {
  /** Changes the rhythm, so two voices never move in lockstep. Default 1. */
  seed?: number
  /** Syllables per second. Default 4.2. */
  syllableRate?: number
  /** Peak level from 0 to 1. Default 0.8. */
  loudness?: number
  /** Level while silent, so a live meter never looks dead. Default 0.02. */
  floor?: number
}

const fract = (x: number) => x - Math.floor(x)

const hash = (n: number, seed: number) => fract(Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453)

/** A speech-like level source you start and stop. Framework free; see `useChatcnSimulatedLevel`. */
export function createChatcnSpeechLevel(options: ChatcnSpeechLevelOptions = {}): ChatcnSpeechLevel {
  const { seed = 1, syllableRate = 4.2, loudness = 0.8, floor = 0.02 } = options
  let speaking = false
  let envelope = floor
  let last = 0
  let phase = 0
  let syllable = 0

  const target = (t: number) => {
    if (!speaking) return floor + 0.01 * (0.5 + 0.5 * Math.sin(t * 7.3 + seed))
    const k = Math.floor(phase)
    const u = phase - k
    let amp = 0.45 + 0.55 * hash(k, seed)
    // Roughly one slot in six is the gap between words.
    if (hash(k * 1.7 + 3, seed) < 0.17) amp *= 0.08
    const shape = u < 0.22 ? (u / 0.22) ** 0.7 : (1 - (u - 0.22) / 0.78) ** 1.5
    const contour = 0.78 + 0.22 * Math.sin(t * 0.55 + seed * 2)
    return loudness * contour * (0.12 + 0.88 * amp * shape)
  }

  const getLevel = () => {
    const now = performance.now()
    if (now - last < 8) return envelope
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60
    last = now
    const t = now / 1000
    // Syllable length jitters by up to 40 percent, so the rhythm never ticks like a clock.
    const k = Math.floor(phase)
    phase += dt * syllableRate * (0.8 + 0.4 * hash(k * 3.1, seed))
    syllable = k
    const goal = target(t)
    const rate = goal > envelope ? 28 : 9
    envelope += (goal - envelope) * (1 - Math.exp(-rate * dt))
    return envelope
  }

  const getBands = (count: number) => {
    const level = getLevel()
    const out = new Float32Array(Math.max(0, count))
    const t = performance.now() / 1000
    // Formants move per syllable: vowels change where the energy sits.
    const f1 = 0.16 + 0.1 * hash(syllable * 2.3, seed)
    const f2 = 0.42 + 0.18 * hash(syllable * 5.9 + 1, seed)
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 0.5 : i / (count - 1)
      const bump = Math.exp(-(((x - f1) / 0.14) ** 2)) + 0.75 * Math.exp(-(((x - f2) / 0.2) ** 2))
      const air = 0.18 * (1 - x)
      const flicker = 0.85 + 0.15 * Math.sin(t * 23 + i * 1.9 + seed)
      out[i] = Math.min(1, level * (bump + air) * flicker * 1.15)
    }
    return out
  }

  return {
    getLevel,
    getBands,
    setSpeaking: (next) => {
      speaking = next
    },
    isSpeaking: () => speaking,
  }
}

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)

/** Reads a level source. Undefined reads as silence. */
function readLevel(level: ChatcnLevel | undefined): number {
  if (level === undefined) return 0
  return clamp01(typeof level === "function" ? level() : level)
}

/** Level used for still frames, so listening and speaking still read differently. */
const ORB_STILL_LEVEL = 0.4

/** The form with the voice level applied. Only listening and speaking listen to it. */
function orbWithLevel(base: OrbForm, state: OrbState, level: number): OrbForm {
  if (state === "listening") {
    return {
      ...base,
      noise: base.noise + 0.22 * level,
      edge: base.edge + 0.025 * level,
      stir: base.stir + 1.2 * level,
      bias: base.bias + 0.1 * level,
      scale: base.scale + 0.04 * level,
    }
  }
  if (state === "speaking") {
    return {
      ...base,
      scale: base.scale + 0.1 * level,
      noise: base.noise + 0.1 * level,
      edge: base.edge + 0.02 * level,
      grain: base.grain + 0.55 * level,
      bias: base.bias + 0.1 * level,
    }
  }
  return base
}

function form(partial: Partial<OrbForm>): OrbForm {
  return {
    scale: 0.86,
    noise: 0.05,
    edge: 0.008,
    stir: 0.25,
    orbit: 0,
    turn: 0.04,
    sweep: 0,
    band: 0,
    squash: 0,
    split: 0,
    ink: 1,
    bias: 0,
    grain: 0,
    alert: 0,
    breathe: 0,
    ...partial,
  }
}

const ORB_FORMS: Record<OrbState, OrbForm> = {
  idle: form({ breathe: 0.016 }),
  connecting: form({ scale: 0.78, noise: 0.03, stir: 0.3, turn: 0.1, sweep: 2.4, band: 1 }),
  listening: form({ scale: 0.88, noise: 0.08, edge: 0.01, stir: 0.55, turn: 0.06, breathe: 0.01 }),
  thinking: form({ scale: 0.8, noise: 0.07, stir: 0.8, orbit: 1.15, turn: 0.38, breathe: 0.018 }),
  speaking: form({ scale: 0.88, noise: 0.06, edge: 0.01, stir: 0.7, turn: 0.08 }),
  interrupted: form({ scale: 0.8, noise: 0.02, edge: 0, stir: 0.1, squash: 0.2, ink: 0.85 }),
  muted: form({ scale: 0.8, noise: 0, edge: 0, stir: 0, turn: 0, ink: 0.6, bias: -0.14 }),
  error: form({
    scale: 0.8,
    noise: 0.02,
    edge: 0,
    stir: 0.05,
    turn: 0,
    split: 1,
    ink: 0.72,
    alert: 1,
  }),
}

/** Phases for still frames: the light a little off center, the band on the front. */
const ORB_STILL_PHASES: OrbPhases = { t: 1.7, light: 0, turn: 0.6, sweep: 0.5 }

/** A frame for tests and server rendering: the state's still form. */
function stillOrbFrame(state: OrbState): OrbFrame {
  const level = state === "listening" || state === "speaking" ? ORB_STILL_LEVEL : 0
  return {
    form: orbWithLevel(ORB_FORMS[state], state, level),
    phases: ORB_STILL_PHASES,
    breath: 0,
    level,
    time: 0,
  }
}

/** Still frames per state: thinking shows the light partway round, a crescent. */
function stillFrame(state: OrbState): OrbFrame {
  const frame = stillOrbFrame(state)
  if (state === "thinking") return { ...frame, phases: { ...ORB_STILL_PHASES, light: 1.05 } }
  return frame
}

/* -------------------------------------------------------------------------------------------------
 * Frame clock: one requestAnimationFrame loop for every effect, each with its own fps cap
 * -----------------------------------------------------------------------------------------------*/

interface FrameSubscriber {
  callback: (timeMs: number) => void
  interval: number
  last: number
}

const subscribers = new Set<FrameSubscriber>()

let rafId = 0

function tick(now: number) {
  rafId = 0
  for (const sub of subscribers) {
    // Small slack so a 30 fps cap on a 60 Hz display lands on every second frame, not every third.
    if (now - sub.last >= sub.interval - 2) {
      sub.last = now
      sub.callback(now)
    }
  }
  if (subscribers.size > 0) rafId = requestAnimationFrame(tick)
}

/**
 * Calls `callback(timeMs)` at most `fps` times a second from a loop shared by every effect.
 * Returns the unsubscribe function. The loop stops by itself when nothing is subscribed.
 */
function addFrameCallback(callback: (timeMs: number) => void, fps = 30) {
  const sub: FrameSubscriber = { callback, interval: 1000 / Math.max(1, fps), last: -Infinity }
  subscribers.add(sub)
  if (!rafId && typeof requestAnimationFrame !== "undefined") rafId = requestAnimationFrame(tick)
  return () => {
    subscribers.delete(sub)
    if (subscribers.size === 0 && rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }
}

const approach = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt))

/** How fast the form follows a state change. Interrupted snaps; the rest settle. */
function orbEaseRate(state: OrbState) {
  return state === "interrupted" ? 16 : 5
}

const ORB_KEYS = Object.keys(ORB_FORMS.idle) as (keyof OrbForm)[]

/** Breathing period per state, in seconds. */
const ORB_BREATH: Partial<Record<OrbState, number>> = {
  idle: 4.6,
  listening: 3.4,
  thinking: 1.8,
}

function useOrbDriver(
  ref: React.RefObject<Element | null>,
  {
    state,
    level,
    inputLevel,
    outputLevel,
    simulate = false,
    reducedMotion: reducedProp,
    paused,
    defaultPaused,
    onPausedChange,
    fps = 30,
  }: OrbDriverOptions,
  draw: (frame: OrbFrame) => void,
): OrbDriver {
  const prefersReduced = useReducedMotion()
  const reducedMotion = reducedProp ?? prefersReduced
  const motion = useEffectMotion(ref, { paused, defaultPaused, onPausedChange })
  const running = !reducedMotion && motion.visible && motion.pageVisible && !motion.paused

  // Two simulated voices, made on first use, so a plain orb costs nothing extra.
  const sims = React.useRef<{ user: ChatcnSpeechLevel; agent: ChatcnSpeechLevel } | null>(null)
  if (simulate && !sims.current) {
    sims.current = {
      user: createChatcnSpeechLevel({ seed: 3 }),
      agent: createChatcnSpeechLevel({ seed: 7, loudness: 0.85 }),
    }
  }
  React.useEffect(() => {
    const s = sims.current
    if (!s) return
    s.user.setSpeaking(simulate && state === "listening")
    s.agent.setSpeaking(simulate && state === "speaking")
  }, [simulate, state])

  const sources = React.useRef({ level, inputLevel, outputLevel, state, simulate })
  sources.current = { level, inputLevel, outputLevel, state, simulate }
  const levelFor = React.useCallback(() => {
    const { level: l, inputLevel: i, outputLevel: o, state: st, simulate: sim } = sources.current
    const s = sim ? sims.current : null
    if (st === "listening") {
      const source = i ?? l
      return source === undefined && s ? s.user.getLevel() : readLevel(source)
    }
    if (st === "speaking") {
      const source = o ?? l
      return source === undefined && s ? s.agent.getLevel() : readLevel(source)
    }
    return 0
  }, [])

  const drawRef = React.useRef(draw)
  drawRef.current = draw
  const live = React.useRef<{
    form: OrbForm
    phases: OrbPhases
    level: number
    time: number
    frame: OrbFrame
  } | null>(null)
  if (!live.current) {
    const frame = stillFrame(state)
    live.current = {
      form: { ...ORB_FORMS[state] },
      phases: { ...ORB_STILL_PHASES },
      level: 0,
      time: 0,
      frame,
    }
  }

  const stateRef = React.useRef(state)
  stateRef.current = state
  const reducedRef = React.useRef(reducedMotion)
  reducedRef.current = reducedMotion

  const redraw = React.useCallback(() => {
    const st = live.current
    if (!st) return
    drawRef.current(reducedRef.current ? stillFrame(stateRef.current) : st.frame)
  }, [])

  // Reduced motion: one still per state. Paused or offscreen: the held frame.
  React.useEffect(() => {
    if (running) return
    redraw()
  }, [running, state, reducedMotion, redraw])

  React.useEffect(() => {
    if (!running) return
    let last = -1
    return addFrameCallback((now) => {
      const st = live.current
      if (!st) return
      const dt = last < 0 ? 1 / fps : Math.min(now - last, 100) / 1000
      last = now
      st.time += dt
      const current = stateRef.current
      const raw = levelFor()
      st.level = approach(st.level, raw, raw > st.level ? 16 : 5, dt)
      const target = orbWithLevel(ORB_FORMS[current], current, st.level)
      const rate = orbEaseRate(current)
      for (const key of ORB_KEYS) st.form[key] = approach(st.form[key], target[key], rate, dt)
      // Voice-driven fields follow the level directly; the state rate would smear syllables.
      if (current === "listening" || current === "speaking") {
        st.form.noise = approach(st.form.noise, target.noise, 14, dt)
        st.form.grain = approach(st.form.grain, target.grain, 14, dt)
        st.form.scale = approach(st.form.scale, target.scale, 12, dt)
      }
      st.phases.t += st.form.stir * dt
      st.phases.light += st.form.orbit * dt
      st.phases.turn += st.form.turn * dt
      st.phases.sweep += st.form.sweep * dt
      const period = ORB_BREATH[current] ?? 4.6
      const breath = Math.sin((st.time * Math.PI * 2) / period) * st.form.breathe
      st.frame = {
        form: { ...st.form },
        phases: { ...st.phases },
        breath,
        level: st.level,
        time: st.time,
      }
      drawRef.current(st.frame)
    }, fps)
  }, [running, fps, levelFor])

  return {
    redraw,
    reducedMotion,
    paused: motion.paused,
    setPaused: motion.setPaused,
    running,
  }
}

function toEffectRenderer(renderer: OrbRenderer): EffectRenderer {
  return renderer === "canvas" || renderer === "svg" ? "2d" : renderer
}

interface EffectFrame {
  ctx: CanvasRenderingContext2D
  /** Backing store size in px. */
  width: number
  height: number
  dpr: number
  time: number
  uniforms: Readonly<UniformBag>
  textures: ReadonlyMap<string, EffectTextureSource>
}

interface CreateEffectOptions {
  /** Fragment shader body. See the contract at the top of this file. */
  fragment: string
  /** Canvas 2D version of the same picture, used when WebGL2 is missing, failed or lost. */
  fallback?: (frame: EffectFrame) => void
  /** Most backing store pixels for this canvas. Default 1.5 MP; tiles should pass far less. */
  maxPixels?: number
  /** Highest pixel ratio used. Default 2. */
  maxDpr?: number
  /** Force a path. `auto` (default) prefers WebGL2. */
  renderer?: EffectRenderer
}

/* -------------------------------------------------------------------------------------------------
 * createEffect
 * -----------------------------------------------------------------------------------------------*/

interface TextureEntry {
  source: EffectTextureSource
  options: EffectTextureOptions
  uploaded: boolean
}

/* -------------------------------------------------------------------------------------------------
 * Sizing: pixel cap and DPR snapping
 * -----------------------------------------------------------------------------------------------*/

interface BackingSize {
  width: number
  height: number
  /** Backing px per CSS px. */
  dpr: number
}

const stats = { handles: 0, frames: 0, lastFrameMs: 0, totalMs: 0 }

let forced: EffectRenderer = "auto"

interface Program {
  program: WebGLProgram
  uniforms: Map<string, WebGLUniformLocation | null>
}

interface Runtime {
  gl: WebGL2RenderingContext
  canvas: HTMLCanvasElement
  vao: WebGLVertexArrayObject
  programs: Map<string, Program | null>
  textures: WeakMap<object, WebGLTexture>
  lost: boolean
  restore: Set<() => void>
}

let runtime: Runtime | null | undefined

let contextsCreated = 0

function getRuntime(): Runtime | null {
  if (runtime !== undefined) return runtime
  if (typeof document === "undefined") return null
  try {
    const canvas = document.createElement("canvas")
    canvas.width = 256
    canvas.height = 256
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    })
    if (!gl) {
      runtime = null
      return null
    }
    contextsCreated += 1
    const vao = gl.createVertexArray()
    if (!vao) {
      runtime = null
      return null
    }
    const rt: Runtime = {
      gl,
      canvas,
      vao,
      programs: new Map(),
      textures: new WeakMap(),
      lost: false,
      restore: new Set(),
    }
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault()
      rt.lost = true
    })
    canvas.addEventListener("webglcontextrestored", () => {
      rt.lost = false
      rt.programs.clear()
      rt.textures = new WeakMap()
      const fresh = gl.createVertexArray()
      if (fresh) rt.vao = fresh
      for (const callback of rt.restore) callback()
    })
    runtime = rt
    return rt
  } catch {
    runtime = null
    return null
  }
}

/** Shader logs in development only. Bundlers replace `process.env.NODE_ENV` statically. */
const DEV = typeof process !== "undefined" && process.env?.NODE_ENV !== "production"

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    if (DEV) {
      console.error(`chatcn effects: shader failed to compile
${gl.getShaderInfoLog(shader)}`)
    }
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/* -------------------------------------------------------------------------------------------------
 * The shared WebGL2 context
 * -----------------------------------------------------------------------------------------------*/

const VERTEX = `#version 300 es
const vec2 verts[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
out vec2 v_uv;
void main() {
  vec2 p = verts[gl_VertexID];
  v_uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`

const PRELUDE = `#version 300 es
precision highp float;
precision highp int;
in vec2 v_uv;
out vec4 out_color;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_dpr;
vec2 chatcnPx() { return vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y); }
`

function getProgram(rt: Runtime, fragment: string): Program | null {
  const cached = rt.programs.get(fragment)
  if (cached !== undefined) return cached
  const { gl } = rt
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fs = compile(gl, gl.FRAGMENT_SHADER, PRELUDE + fragment)
  let result: Program | null = null
  if (vs && fs) {
    const program = gl.createProgram()
    if (program) {
      gl.attachShader(program, vs)
      gl.attachShader(program, fs)
      gl.linkProgram(program)
      if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
        result = { program, uniforms: new Map() }
      } else if (DEV) {
        console.error(`chatcn effects: program failed to link
${gl.getProgramInfoLog(program)}`)
      }
    }
  }
  if (vs) gl.deleteShader(vs)
  if (fs) gl.deleteShader(fs)
  rt.programs.set(fragment, result)
  return result
}

/** Largest side of the shared canvas. Effects are capped well under it. */
const MAX_SIDE = 4096

function location(rt: Runtime, program: Program, name: string) {
  if (!program.uniforms.has(name)) {
    program.uniforms.set(name, rt.gl.getUniformLocation(program.program, name))
  }
  return program.uniforms.get(name) ?? null
}

function isData(source: EffectTextureSource): source is EffectDataTexture {
  return "data" in source && source.data instanceof Uint8Array
}

function upload(
  rt: Runtime,
  source: EffectTextureSource,
  options: EffectTextureOptions,
  force: boolean,
): WebGLTexture | null {
  const { gl } = rt
  const key = isData(source) ? source.data : source
  let texture = rt.textures.get(key)
  const fresh = !texture
  if (!texture) {
    texture = gl.createTexture() ?? undefined
    if (!texture) return null
    rt.textures.set(key, texture)
  }
  gl.bindTexture(gl.TEXTURE_2D, texture)
  if (fresh || force) {
    const wrap = options.wrap === "repeat" ? gl.REPEAT : gl.CLAMP_TO_EDGE
    const filter = options.filter === "nearest" ? gl.NEAREST : gl.LINEAR
    const mipmap = options.mipmap ?? (!isData(source) && filter === gl.LINEAR && !options.dynamic)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      mipmap ? gl.LINEAR_MIPMAP_LINEAR : filter,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    if (isData(source)) {
      const r8 = (source.format ?? "r8") === "r8"
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        r8 ? gl.R8 : gl.RGBA8,
        source.width,
        source.height,
        0,
        r8 ? gl.RED : gl.RGBA,
        gl.UNSIGNED_BYTE,
        source.data,
      )
    } else {
      // Throws a SecurityError for a cross-origin image without CORS. The caller handles it.
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource)
    }
    if (mipmap) gl.generateMipmap(gl.TEXTURE_2D)
  }
  return texture
}

/**
 * Backing store size for a CSS box. Uses the device pixel ratio up to `maxDpr`, then, when the
 * area passes `maxPixels`, divides the device ratio by the smallest whole number that fits. A
 * whole-number upscale keeps `image-rendering: pixelated` output even: every backing pixel
 * covers the same number of screen pixels, so dither cells never come out uneven.
 */
function fitBackingStore(
  cssWidth: number,
  cssHeight: number,
  { maxPixels = 1_500_000, maxDpr = 2 }: { maxPixels?: number; maxDpr?: number } = {},
): BackingSize {
  const device = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1
  const base = Math.min(device, maxDpr)
  const area = Math.max(1, cssWidth * cssHeight)
  let dpr = base
  if (area * base * base > maxPixels) {
    const fit = Math.sqrt(maxPixels / area)
    dpr = device / Math.ceil(device / fit)
  }
  return {
    width: Math.max(1, Math.round(cssWidth * dpr)),
    height: Math.max(1, Math.round(cssHeight * dpr)),
    dpr,
  }
}

/**
 * Mounts an effect on a canvas. The canvas gets a 2D context; the picture is drawn by the shared
 * WebGL2 context (or by `fallback`) and copied in. Call `resize` before the first `render`.
 */
function createEffect(
  target: HTMLCanvasElement,
  options: CreateEffectOptions,
): EffectHandle {
  const { fragment, fallback, maxPixels = 1_500_000, maxDpr = 2 } = options
  const uniforms: UniformBag = {}
  const textures = new Map<string, TextureEntry>()
  const restoreCallbacks = new Set<() => void>()
  let size: BackingSize = { width: 0, height: 0, dpr: 1 }
  let mode: EffectHandle["mode"] = "none"
  let ctx: CanvasRenderingContext2D | null = null
  let disposed = false
  stats.handles += 1

  const pick = (): EffectHandle["mode"] => {
    const wanted = forced !== "auto" ? forced : (options.renderer ?? "auto")
    if (wanted !== "2d") {
      const rt = getRuntime()
      if (rt && !rt.lost && getProgram(rt, fragment)) return "webgl"
    }
    return fallback ? "2d" : "none"
  }

  const onRestore = () => {
    for (const entry of textures.values()) entry.uploaded = false
    for (const callback of restoreCallbacks) callback()
  }
  getRuntime()?.restore.add(onRestore)

  const draw2d = (time: number) => {
    if (!ctx || !fallback) return
    ctx.save()
    ctx.clearRect(0, 0, size.width, size.height)
    const sources = new Map<string, EffectTextureSource>()
    for (const [name, entry] of textures) sources.set(name, entry.source)
    fallback({
      ctx,
      width: size.width,
      height: size.height,
      dpr: size.dpr,
      time,
      uniforms,
      textures: sources,
    })
    ctx.restore()
  }

  const drawGl = (time: number) => {
    const rt = getRuntime()
    if (!rt || rt.lost || !ctx) return false
    const program = getProgram(rt, fragment)
    if (!program) return false
    const { gl, canvas } = rt
    const { width, height } = size
    if (canvas.width < width || canvas.height < height) {
      canvas.width = Math.min(MAX_SIDE, Math.max(canvas.width, width))
      canvas.height = Math.min(MAX_SIDE, Math.max(canvas.height, height))
    }
    gl.viewport(0, 0, width, height)
    gl.disable(gl.BLEND)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(program.program)
    gl.bindVertexArray(rt.vao)
    gl.uniform2f(location(rt, program, "u_resolution"), width, height)
    gl.uniform1f(location(rt, program, "u_time"), time)
    gl.uniform1f(location(rt, program, "u_dpr"), size.dpr)
    for (const [name, value] of Object.entries(uniforms)) {
      const loc = location(rt, program, name)
      if (!loc) continue
      if (typeof value === "number") gl.uniform1f(loc, value)
      else if (typeof value === "boolean") gl.uniform1f(loc, value ? 1 : 0)
      else if (value.length === 2) gl.uniform2f(loc, value[0], value[1])
      else if (value.length === 3) gl.uniform3f(loc, value[0], value[1], value[2])
      else gl.uniform4f(loc, value[0], value[1], value[2], value[3])
    }
    let unit = 0
    for (const [name, entry] of textures) {
      gl.activeTexture(gl.TEXTURE0 + unit)
      const texture = upload(
        rt,
        entry.source,
        entry.options,
        !entry.uploaded || !!entry.options.dynamic,
      )
      entry.uploaded = true
      if (!texture) continue
      gl.uniform1i(location(rt, program, name), unit)
      unit += 1
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    ctx.clearRect(0, 0, width, height)
    // The viewport sits at the bottom left of the shared canvas; copy that corner.
    ctx.drawImage(canvas, 0, canvas.height - height, width, height, 0, 0, width, height)
    return true
  }

  return {
    get mode() {
      return mode
    },
    get size() {
      return size
    },
    resize(cssWidth, cssHeight) {
      const next = fitBackingStore(cssWidth, cssHeight, { maxPixels, maxDpr })
      mode = pick()
      if (!ctx) ctx = target.getContext("2d")
      if (next.width === size.width && next.height === size.height && next.dpr === size.dpr) {
        return false
      }
      size = next
      target.width = next.width
      target.height = next.height
      return true
    },
    setUniforms(values) {
      Object.assign(uniforms, values)
    },
    setTexture(name, source, textureOptions = {}) {
      if (!source) {
        textures.delete(name)
        return
      }
      const current = textures.get(name)
      if (current && current.source === source && !textureOptions.dynamic) return
      textures.set(name, { source, options: textureOptions, uploaded: false })
    },
    render(time = 0) {
      if (disposed || size.width === 0) return
      const start = performance.now()
      // A tainted image throws a SecurityError from drawGl. The caller shows its error state.
      if (mode === "webgl") {
        if (!drawGl(time)) {
          mode = fallback ? "2d" : "none"
          draw2d(time)
        }
      } else if (mode === "2d") {
        draw2d(time)
      }
      stats.frames += 1
      stats.lastFrameMs = performance.now() - start
      stats.totalMs += stats.lastFrameMs
    },
    onRestore(callback) {
      restoreCallbacks.add(callback)
      return () => restoreCallbacks.delete(callback)
    },
    dispose() {
      if (disposed) return
      disposed = true
      stats.handles -= 1
      getRuntime()?.restore.delete(onRestore)
      restoreCallbacks.clear()
      textures.clear()
    },
  }
}

/* -------------------------------------------------------------------------------------------------
 * GLSL snippets
 * -----------------------------------------------------------------------------------------------*/

/**
 * Shared GLSL. Each is a self-contained string to prepend to a fragment. The ordered dither
 * matrices match `bayerMatrix()` in `@/lib/chatcn-pro-dither` cell for cell.
 */
const GLSL = {
  /** `chatcnLuma(rgb)` Rec. 709 luminance of sRGB values; `chatcnTone(l, contrast, brightness)`. */
  luminance: /* glsl */ `
float chatcnLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float chatcnTone(float l, float contrast, float brightness) {
  return clamp((l - 0.5) * contrast + 0.5 + brightness, 0.0, 1.0);
}
`,
  /** `chatcnBayer(px, n)` threshold in (0, 1) for an n x n ordered matrix, n = 2, 4 or 8. */
  bayer: /* glsl */ `
float chatcnBayer(vec2 px, int n) {
  ivec2 p = ivec2(floor(px)) & (n - 1);
  int bits = n == 2 ? 1 : (n == 4 ? 2 : 3);
  int v = 0;
  for (int k = 0; k < 3; k++) {
    if (k >= bits) break;
    int xb = (p.x >> k) & 1;
    int yb = (p.y >> k) & 1;
    v |= (((xb ^ yb) << 1) | yb) << (2 * (bits - 1 - k));
  }
  return (float(v) + 0.5) / float(n * n);
}
`,
  /** `chatcnBlueNoise(px)` threshold from the 64 x 64 tile bound as `u_blueNoise`. */
  blueNoise: /* glsl */ `
uniform sampler2D u_blueNoise;
float chatcnBlueNoise(vec2 px) {
  ivec2 size = textureSize(u_blueNoise, 0);
  ivec2 p = ivec2(mod(floor(px), vec2(size)));
  return (texelFetch(u_blueNoise, p, 0).r * 255.0 + 0.5) / 256.0;
}
`,
  /**
   * Halftone helpers. `chatcnHalftoneCell(px, cell, angle)` returns the cell center in px (where
   * to sample the image) in `.xy` and the offset from it in cell units in `.zw`.
   * `chatcnHalftoneDot(offset, tone, shape, aa)` returns ink coverage 0 to 1: tone 0 is paper,
   * 1 is solid ink; shape 0 round, 1 square, 2 line; `aa` is the antialias half width in cell
   * units, about `0.75 / cellPx` (fwidth jumps at cell edges, so pass it analytically).
   */
  halftone: /* glsl */ `
vec4 chatcnHalftoneCell(vec2 px, float cell, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  mat2 rot = mat2(c, -s, s, c);
  vec2 q = rot * px / cell;
  vec2 id = floor(q) + 0.5;
  vec2 center = transpose(rot) * (id * cell);
  return vec4(center, q - id);
}
float chatcnHalftoneDot(vec2 offset, float tone, int shape, float aa) {
  float t = clamp(tone, 0.0, 1.0);
  if (t < 0.004) return 0.0;
  if (t > 0.996) return 1.0;
  // Squares and lines only close up at full tone; a little push lets shadows print solid.
  if (shape != 0) t = min(1.0, t * 1.06);
  if (shape == 2) {
    float half_w = 0.5 * t;
    return 1.0 - smoothstep(half_w - aa, half_w + aa, abs(offset.y));
  }
  if (shape == 1) {
    float half_s = 0.5 * sqrt(t);
    float d = max(abs(offset.x), abs(offset.y));
    return 1.0 - smoothstep(half_s - aa, half_s + aa, d);
  }
  // Round: the classic cosine spot function. Dots at light tones, a checkerboard at half,
  // paper dots at dark tones, and continuous across cell edges, so fwidth antialiases cleanly.
  float f = 0.5 * (cos(6.2831853 * offset.x) + cos(6.2831853 * offset.y));
  // Odd polynomial fit of the spot function's area curve, so ink coverage equals tone.
  float u = t - 0.5;
  float u2 = u * u;
  float tc = 0.5 + u * (0.50610 + u2 * (4.30702 + u2 * (-17.07103 + u2 * 31.55910)));
  // A small margin closes the corners just before full tone, so no specks outline solid areas.
  float c = 1.03 - 2.06 * tc;
  float w = max(fwidth(f) * 0.75, 1e-4);
  return smoothstep(c - w, c + w, f);
}
`,
  /** `chatcnHash(p)` cheap stable hash to 0..1. */
  hash: /* glsl */ `
float chatcnHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
`,
  /**
   * `chatcnSimplex(v)` 3D simplex noise in about -1 to 1.
   * After Ashima Arts and Stefan Gustavson, webgl-noise (MIT license).
   */
  simplex: /* glsl */ `
vec4 chatcnPermute(vec4 x) { return mod(((x * 34.0) + 10.0) * x, 289.0); }
vec4 chatcnTaylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float chatcnSimplex(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = chatcnPermute(chatcnPermute(chatcnPermute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = chatcnTaylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`,
  /** `chatcnCover(uv, boxAspect, imageAspect)` maps box UVs to image UVs like object-fit: cover. */
  cover: /* glsl */ `
vec2 chatcnCover(vec2 uv, float boxAspect, float imageAspect) {
  vec2 scale = boxAspect > imageAspect
    ? vec2(1.0, imageAspect / boxAspect)
    : vec2(boxAspect / imageAspect, 1.0);
  return (uv - 0.5) * scale + 0.5;
}
`,
} as const

/**
 * GLSL for the sphere. Needs `GLSL.simplex` before it. `chatcnOrbGeometry(q)` takes a point in
 * sphere units (radius 1, y down) and returns the view normal in `.xyz` and, in `.w`, 1 inside
 * the sphere and 0 outside. `chatcnOrbTone(n)` lights a normal and returns the mark density.
 */
const ORB_GLSL = /* glsl */ `
uniform float u_scale;
uniform float u_noise;
uniform float u_edge;
uniform float u_t;
uniform float u_light;
uniform float u_turn;
uniform float u_sweep;
uniform float u_band;
uniform float u_squash;
uniform float u_split;
uniform float u_ink;
uniform float u_bias;
uniform float u_grain;
uniform float u_alertMix;
uniform float u_level;
uniform vec4 u_inkColor;
uniform vec4 u_alertColor;

vec3 chatcnRotY(vec3 v, float a) {
  float s = sin(a);
  float c = cos(a);
  return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}
vec3 chatcnRotX(vec3 v, float a) {
  float s = sin(a);
  float c = cos(a);
  return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z);
}

vec4 chatcnOrbGeometry(vec2 q) {
  q.y /= max(0.2, 1.0 - u_squash);
  // The crack runs corner to corner; the halves part along its normal.
  vec2 crack = vec2(0.6, 0.8);
  float across = dot(q, crack);
  if (u_split > 0.001) {
    if (abs(across) < u_split * 0.07) return vec4(0.0);
    q -= crack * sign(across) * u_split * 0.07;
  }
  float d = length(q);
  vec2 dir = d > 0.0001 ? q / d : vec2(0.0, 1.0);
  float wob = u_edge * chatcnSimplex(vec3(dir * 1.6, u_t * 0.8));
  q /= 1.0 + wob;
  d = length(q);
  if (d >= 1.0) return vec4(0.0);
  return vec4(q, sqrt(1.0 - d * d), 1.0);
}

float chatcnOrbTone(vec3 n) {
  float phi = -0.62 + u_light;
  vec3 L = normalize(vec3(0.78 * sin(phi), -0.55, 0.78 * cos(phi)));
  float shade = smoothstep(-0.2, 1.0, dot(n, L));
  vec3 surf = chatcnRotY(n, u_turn);
  float s = chatcnSimplex(vec3(surf * 2.1 + vec3(0.0, 0.0, u_t * 0.35)));
  // The lit side tops out below solid, so the dither pattern still shows there.
  float tone = (0.04 + 0.7 * shade) * u_ink + s * u_noise + u_bias;
  if (u_band > 0.001) {
    float lon = atan(surf.x, surf.z) + u_sweep;
    float mask = 0.18 + 0.82 * smoothstep(0.25, 1.0, cos(lon));
    tone *= mix(1.0, mask, u_band);
  }
  return clamp(tone, 0.0, 1.0);
}

vec4 chatcnOrbInk() {
  return mix(u_inkColor, u_alertColor, clamp(u_alertMix, 0.0, 1.0));
}
`

/* -------------------------------------------------------------------------------------------------
 * Shader
 *
 * The dots sit on the sphere itself, on a latitude grid whose rows hold fewer dots toward the
 * poles, so every dot covers about the same area of surface. Each dot is sized by the light at
 * its center and by the voice level, then projected: dots near the edge flatten into ellipses,
 * which is what sells the volume. Thinking turns the sphere, and the dots travel with it.
 * -----------------------------------------------------------------------------------------------*/

const FRAGMENT = `${GLSL.simplex}${ORB_GLSL}
uniform float u_rows;
uniform float u_tilt;
const float PI = 3.14159265;
void main() {
  float radius = 0.5 * min(u_resolution.x, u_resolution.y) * u_scale;
  vec4 g = chatcnOrbGeometry((chatcnPx() - 0.5 * u_resolution) / radius);
  if (g.w < 0.5) { out_color = vec4(0.0); return; }
  vec3 s = chatcnRotX(chatcnRotY(g.xyz, u_turn), u_tilt);
  float lat = asin(clamp(-s.y, -1.0, 1.0));
  float lon = atan(s.x, s.z);
  float rowF = (lat / PI + 0.5) * u_rows;
  float row = floor(rowF);
  float latc = ((row + 0.5) / u_rows - 0.5) * PI;
  float count = max(1.0, floor(2.0 * u_rows * cos(latc) + 0.5));
  float colF = (lon / (2.0 * PI) + 0.5) * count;
  float col = floor(colF);
  float lonc = ((col + 0.5) / count - 0.5) * 2.0 * PI;
  float cellH = PI / u_rows;
  vec2 off = vec2((colF - col - 0.5) * (2.0 * PI / count) * cos(lat), (rowF - row - 0.5) * cellH);
  float dist = length(off) / cellH;
  vec3 sc = vec3(cos(latc) * sin(lonc), -sin(latc), cos(latc) * cos(lonc));
  vec3 nc = chatcnRotY(chatcnRotX(sc, -u_tilt), -u_turn);
  float tone = max(chatcnOrbTone(nc), 0.05 * u_ink);
  float r = min(0.5, 0.5 * sqrt(tone) * (0.94 + 0.5 * u_level));
  float aa = max(fwidth(dist) * 0.75, 0.002);
  float cover = 1.0 - smoothstep(r - aa, r + aa, dist);
  vec4 ink = chatcnOrbInk();
  out_color = vec4(ink.rgb, ink.a * cover);
}`

function rotY([x, y, z]: number[], a: number): [number, number, number] {
  const s = Math.sin(a)
  const c = Math.cos(a)
  return [c * (x ?? 0) + s * (z ?? 0), y ?? 0, -s * (x ?? 0) + c * (z ?? 0)]
}

function rotX([x, y, z]: number[], a: number): [number, number, number] {
  const s = Math.sin(a)
  const c = Math.cos(a)
  return [x ?? 0, c * (y ?? 0) - s * (z ?? 0), s * (y ?? 0) + c * (z ?? 0)]
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/* -------------------------------------------------------------------------------------------------
 * The same sphere in JS
 * -----------------------------------------------------------------------------------------------*/

function hash3(x: number, y: number, z: number) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return h - Math.floor(h)
}

/** Smooth value noise in about -1 to 1. Cheaper than simplex and close enough for 2D paths. */
function orbNoise(x: number, y: number, z: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const u = smooth(x - xi)
  const v = smooth(y - yi)
  const w = smooth(z - zi)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz)
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u)
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), u)
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u)
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), u)
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 2 - 1
}

/** Mark density 0 to 1 for a view normal. Mirrors `chatcnOrbTone`. */
function orbTone([nx, ny, nz]: [number, number, number], frame: OrbFrame) {
  const f = frame.form
  const phi = -0.62 + frame.phases.light
  let lx = 0.78 * Math.sin(phi)
  let ly = -0.55
  let lz = 0.78 * Math.cos(phi)
  const len = Math.hypot(lx, ly, lz)
  lx /= len
  ly /= len
  lz /= len
  const dot = nx * lx + ny * ly + nz * lz
  const k = Math.min(1, Math.max(0, (dot + 0.2) / 1.2))
  const shade = k * k * (3 - 2 * k)
  const a = frame.phases.turn
  const sx = Math.cos(a) * nx + Math.sin(a) * nz
  const sz = -Math.sin(a) * nx + Math.cos(a) * nz
  const s = orbNoise(sx * 2.1 + 9, ny * 2.1 + 9, sz * 2.1 + frame.phases.t * 0.35)
  let tone = (0.04 + 0.7 * shade) * f.ink + s * f.noise + f.bias
  if (f.band > 0.001) {
    const lon = Math.atan2(sx, sz) + frame.phases.sweep
    const c = Math.min(1, Math.max(0, (Math.cos(lon) - 0.25) / 0.75))
    const mask = 0.18 + 0.82 * c * c * (3 - 2 * c)
    tone *= 1 + (mask - 1) * f.band
  }
  return Math.min(1, Math.max(0, tone))
}

/** Canvas 2D version: the same dot grid drawn as circles. Squash applies; the crack does not. */
function drawFallback(ctx: CanvasRenderingContext2D, frame: OrbFrame, rows: number, fill: string) {
  const { width: W, height: H } = ctx.canvas
  const radius = 0.5 * Math.min(W, H) * Math.max(0.1, frame.form.scale + frame.breath)
  const cellPx = (Math.PI / rows) * radius
  ctx.fillStyle = fill
  for (let row = 0; row < rows; row++) {
    const latc = ((row + 0.5) / rows - 0.5) * Math.PI
    const count = Math.max(1, Math.floor(2 * rows * Math.cos(latc) + 0.5))
    for (let col = 0; col < count; col++) {
      const lonc = ((col + 0.5) / count - 0.5) * 2 * Math.PI
      const sc = [Math.cos(latc) * Math.sin(lonc), -Math.sin(latc), Math.cos(latc) * Math.cos(lonc)]
      const n = rotY(rotX(sc, -TILT), -frame.phases.turn)
      if (n[2] <= 0.02) continue
      const tone = Math.max(orbTone(n, frame), 0.05 * frame.form.ink)
      const r = Math.min(0.5, 0.5 * Math.sqrt(tone) * (0.94 + 0.5 * frame.level)) * cellPx
      ctx.beginPath()
      ctx.ellipse(
        W / 2 + n[0] * radius,
        H / 2 + n[1] * radius * (1 - frame.form.squash),
        r,
        r * Math.max(0.2, n[2] ** 0.5),
        0,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }
}

interface OrbShellProps extends Omit<React.ComponentProps<"div">, "children"> {
  slot: string
  rootRef: React.RefObject<HTMLDivElement | null>
  px: number
  state: OrbState
  label?: string
  renderer: string
  pauseControl: boolean
  paused: boolean
  onPausedChange: (paused: boolean) => void
  children: React.ReactNode
}

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export type VoiceOrbState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "muted"
  | "error"

export const voiceOrbStateLabels: Record<VoiceOrbState, string> = {
  idle: "Ready",
  connecting: "Connecting",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  interrupted: "Interrupted",
  muted: "Muted",
  error: "Disconnected",
}

type Corner = "top-start" | "top-end" | "bottom-start" | "bottom-end"

interface EffectPauseControlProps
  extends Omit<React.ComponentProps<"button">, "onClick" | "children"> {
  paused: boolean
  onPausedChange: (paused: boolean) => void
  /** Corner of the nearest positioned ancestor. Logical, so it mirrors in RTL. Default `bottom-end`. */
  corner?: Corner
  /**
   * `hover` (default) keeps the button quiet until the frame is hovered (add `group/effect` to the
   * frame) or the button has focus. It always shows on touch screens and while paused.
   * `always` keeps it on screen.
   */
  reveal?: "hover" | "always"
  /** Names the animation in the label, for example "noise field". */
  label?: string
}

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactElement
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  /** A shortcut hint shown after the label, for example `⌘C`. */
  shortcut?: React.ReactNode
}

function Tooltip({ content, children, side = "top", align = "center", shortcut }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} align={align} sideOffset={6} className="z-50">
          <TooltipPrimitive.Popup
            data-slot="tooltip"
            className={cn(
              "rounded-(--chatcn-radius-sm) bg-(color:--chatcn-fg) text-[0.75rem]/[1rem] text-(color:--chatcn-bg) shadow-(--chatcn-shadow-md) flex max-w-xs origin-(--transform-origin) items-center gap-2 px-2 py-1 font-medium text-pretty",
              "ease-(--chatcn-ease-out) transition-[opacity,scale] duration-125",
              "data-[ending-style]:scale-97 data-[ending-style]:opacity-0 data-[ending-style]:duration-100 data-[starting-style]:scale-97 data-[starting-style]:opacity-0",
              // Once one tooltip is open, the next appears without animation. Reduced motion keeps
              // only the fade.
              "data-[instant]:transition-none motion-reduce:transition-opacity motion-reduce:data-[ending-style]:scale-100 motion-reduce:data-[starting-style]:scale-100",
            )}
          >
            {content}
            {shortcut ? <span className="font-normal opacity-60">{shortcut}</span> : null}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

const corners: Record<Corner, string> = {
  "top-start": "top-2 start-2",
  "top-end": "top-2 end-2",
  "bottom-start": "bottom-2 start-2",
  "bottom-end": "bottom-2 end-2",
}

interface IconProps extends SVGAttributes<SVGSVGElement> {
  /** Width and height. Number means px. Default 24. */
  size?: number | string
  /** Stroke width in viewBox units (24 grid). Default 1.5. */
  strokeWidth?: number | string
  /** Keep the rendered stroke at `strokeWidth` px at any size. */
  absoluteStrokeWidth?: boolean
  /** Stroke color. Default currentColor. */
  color?: string
  /** Accessible name. Renders <title> and sets role="img"; without it the icon is aria-hidden. */
  title?: string
}

type Icon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>

/** Shape elements an icon may contain. */
type IconElement = "path" | "circle" | "rect" | "ellipse" | "line" | "polyline" | "polygon"

/** An icon's drawing: a flat list of [element, attributes] pairs, lucide compatible. */
type IconNode = ReadonlyArray<readonly [IconElement, Readonly<Record<string, string>>]>

const toPascal = (name: string): string =>
  name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")

/**
 * Builds a React icon component from an icon node.
 * `name` is the kebab-case icon name, used for the class `chatcn-icon-<name>` and displayName.
 */
function createIcon(name: string, iconNode: IconNode): Icon {
  // biome-ignore lint/correctness/noComponentHookFactories: runs once per icon at module load
  const Component = forwardRef<SVGSVGElement, IconProps>(function ChatcnIcon(
    {
      size = 24,
      strokeWidth = 1.5,
      absoluteStrokeWidth = false,
      color = "currentColor",
      title,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    const stroke = absoluteStrokeWidth
      ? (Number(strokeWidth) * 24) / Number.parseFloat(String(size))
      : strokeWidth
    const labelled = Boolean(title || rest["aria-label"] || rest["aria-labelledby"])
    return createElement(
      "svg",
      {
        ref,
        xmlns: "http://www.w3.org/2000/svg",
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: color,
        strokeWidth: stroke,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "data-slot": "icon",
        className: className
          ? `chatcn-icon chatcn-icon-${name} ${className}`
          : `chatcn-icon chatcn-icon-${name}`,
        ...(labelled ? { role: "img" } : { "aria-hidden": true }),
        ...rest,
      },
      title ? createElement("title", null, title) : null,
      ...iconNode.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs })),
      children,
    )
  })
  Component.displayName = `${toPascal(name)}Icon`
  return Component
}

const iconNode: IconNode = [
  ["path", {"d":"m9.51 5.75 7.4 4.31a2.25 2.25 0 0 1 0 3.88l-7.4 4.31a2 2 0 0 1-3.01-1.73V7.48a2 2 0 0 1 3.01-1.73"}],
]

const PlayIcon: Icon = /* @__PURE__ */ createIcon("play", iconNode)

const iconNode2: IconNode = [
  ["path", {"d":"M8.5 5v14"}],
  ["path", {"d":"M15.5 5v14"}],
]

const PauseIcon: Icon = /* @__PURE__ */ createIcon("pause", iconNode2)

/**
 * The pause and play button for any effect that loops longer than 5 s (WCAG 2.2.2). Sits in a
 * corner of the effect's frame, reachable by keyboard, with a 44 px hit area on touch screens.
 */
function EffectPauseControl({
  paused,
  onPausedChange,
  corner = "bottom-end",
  reveal = "hover",
  label = "animation",
  className,
  ...props
}: EffectPauseControlProps) {
  const text = `${paused ? "Play" : "Pause"} ${label}`
  return (
    <Tooltip content={text}>
      <button
        type="button"
        data-slot="effect-pause-control"
        data-paused={paused ? "" : undefined}
        aria-label={text}
        onClick={() => onPausedChange(!paused)}
        className={cn(
          "chatcn-focus rounded-(--chatcn-radius-sm) absolute z-10 grid size-7 place-items-center",
          "bg-(color:--chatcn-surface) text-(color:--chatcn-fg-muted) shadow-(--chatcn-shadow-sm) hover:text-(color:--chatcn-fg)",
          "ease-(--chatcn-ease-out) transition-[opacity,color,scale] duration-150",
          "active:scale-(--chatcn-press-scale-icon) active:duration-100 motion-reduce:active:scale-100",
          // A 44 px target on coarse pointers without a bigger button.
          "after:absolute after:-inset-2 after:content-[''] pointer-fine:after:inset-0",
          "[&_svg]:size-3.5",
          reveal === "hover" &&
            "opacity-0 group-hover/effect:opacity-100 focus-visible:opacity-100 data-[paused]:opacity-100 pointer-coarse:opacity-100",
          corners[corner],
          className,
        )}
        {...props}
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>
    </Tooltip>
  )
}

/** The frame every effect orb shares. */
function OrbShell({
  slot,
  rootRef,
  px,
  state,
  label,
  renderer,
  pauseControl,
  paused,
  onPausedChange,
  className,
  style,
  children,
  ...props
}: OrbShellProps) {
  return (
    <div
      ref={rootRef}
      data-slot={slot}
      data-voice-state={state}
      data-renderer={renderer}
      style={{ width: px, height: px, ...style }}
      className={cn("group/effect text-(color:--chatcn-fg) relative shrink-0 select-none", className)}
      {...props}
    >
      {/* The picture has the name; the pause control sits beside it, not inside an image. */}
      <div
        role="img"
        aria-label={label ?? `Voice: ${voiceOrbStateLabels[state].toLowerCase()}`}
        className="absolute inset-0"
      >
        {children}
      </div>
      {/* Forced colors: the effect hides and a plain outline keeps the orb's place and shape. */}
      <span
        aria-hidden
        className="absolute inset-[8%] hidden rounded-full border border-current forced-colors:block"
      />
      {pauseControl ? (
        <EffectPauseControl
          paused={paused}
          onPausedChange={onPausedChange}
          label="voice orb animation"
          corner="bottom-end"
          className="end-0 bottom-0"
        />
      ) : null}
    </div>
  )
}

/**
 * The voice presence as a sphere of halftone dots. Dot size follows the light and the voice
 * level; the sphere turns slowly while thinking. Takes the free voice orb's props, so it swaps
 * in for `VoiceOrb`.
 */
export function HalftoneOrb({
  state = "idle",
  level,
  inputLevel,
  outputLevel,
  simulate = false,
  size = "lg",
  renderer = "auto",
  reducedMotion,
  label,
  ink,
  paused,
  defaultPaused,
  onPausedChange,
  pauseControl,
  rows: rowsProp,
  ...props
}: HalftoneOrbProps) {
  const px = orbPixels(size)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const handleRef = React.useRef<EffectHandle | null>(null)
  const colors = useEffectColors({ ink, paper: "transparent" }, rootRef)
  const alert = useThemeColor("var(--chatcn-red)", rootRef)
  const rows = Math.max(6, Math.round(rowsProp ?? Math.min(32, px / 7)))
  const [mode, setMode] = React.useState("none")
  const fallbackState = React.useRef<{ frame: OrbFrame; fill: string } | null>(null)
  const latest = React.useRef({ ink: colors.ink, alert, rows })
  latest.current = { ink: colors.ink, alert, rows }

  const draw = React.useCallback((frame: OrbFrame) => {
    const handle = handleRef.current
    if (!handle) return
    const { ink: inkColor, alert: alertColor, rows: r } = latest.current
    const mixed = inkColor.map((v, i) => v + ((alertColor[i] ?? v) - v) * frame.form.alert) as [
      number,
      number,
      number,
      number,
    ]
    handle.setUniforms({
      ...orbUniforms(frame),
      u_inkColor: inkColor,
      u_alertColor: alertColor,
      u_rows: r,
      u_tilt: TILT,
    })
    fallbackState.current = { frame, fill: rgbaToCss(mixed) }
    handle.render(frame.time)
  }, [])

  const orb = useOrbDriver(
    rootRef,
    {
      state,
      level,
      inputLevel,
      outputLevel,
      simulate,
      reducedMotion,
      paused,
      defaultPaused,
      onPausedChange,
    },
    draw,
  )

  const effectRenderer = toEffectRenderer(renderer)
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handle = createEffect(canvas, {
      fragment: FRAGMENT,
      renderer: effectRenderer,
      maxPixels: Math.max(16_384, px * px * 4),
      fallback: ({ ctx }) => {
        const s = fallbackState.current
        if (s) drawFallback(ctx, s.frame, latest.current.rows, s.fill)
      },
    })
    handle.resize(px, px)
    handleRef.current = handle
    setMode(handle.mode)
    const off = handle.onRestore(() => orb.redraw())
    orb.redraw()
    return () => {
      off()
      handle.dispose()
      handleRef.current = null
    }
  }, [px, effectRenderer, orb.redraw])

  React.useEffect(() => {
    if (colors.version > 0) orb.redraw()
  }, [colors.version, alert, rows, orb.redraw])

  return (
    <OrbShell
      slot="halftone-orb"
      rootRef={rootRef}
      px={px}
      state={state}
      label={label}
      renderer={mode}
      pauseControl={pauseControl ?? px >= 120}
      paused={orb.paused}
      onPausedChange={orb.setPaused}
      {...props}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        data-slot="halftone-orb-canvas"
        className="absolute inset-0 size-full forced-colors:hidden"
      />
    </OrbShell>
  )
}

export default HalftoneOrb

