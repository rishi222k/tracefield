import { defaults, presets, validateScene } from "../../public/scene.js";
import {
  normalizeSettings,
  RENDERER_VERSION,
  START_FRAME,
} from "../../public/settings.js";
import { EFFECT_VERSION, PROCESSED_STYLES } from "../../public/image-effects.js";
import { validateProject, validateImageHeader } from "../../public/project.js";
import { render, makeXray } from "../../public/render.js";
import { render as renderV2 } from "../../public/render-v2.js";
import { render as renderV4 } from "../../public/render-v4.js";
import { phaseAt, playbackAt } from "../../public/timeline.js";
export type Settings = {
  -readonly [K in keyof typeof defaults]: (typeof defaults)[K] extends string
    ? string
    : (typeof defaults)[K] extends number
      ? number
      : boolean;
};
export type Scene = {
  version: number;
  id: string;
  title: string;
  subtitle: string;
  image: { src: string; width: number; height: number };
  nodes: Array<{
    id: string;
    label: string;
    reason: string;
    kind: string;
    x: number;
    y: number;
    labelOffset?: number[];
  }>;
  networks: Record<
    string,
    {
      title: string;
      meaning: string;
      edges: Array<{ a: string; b: string; reason: string; weight?: number }>;
    }
  >;
  focus?: string[];
};
export type Project = {
  version: 2;
  rendererVersion: string;
  effectVersion: string;
  scene: Scene;
  settings: Settings;
  time: number;
};
export type Snapshot = {
  scene: Scene | null;
  settings: Settings;
  time: number;
  playing: boolean;
  loading: boolean;
  original: boolean;
  selected: string | null;
  rendererVersion: string;
  error: string;
  notice: string;
};
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export class Studio {
  private listeners = new Set<() => void>();
  private state: Snapshot = {
    scene: null,
    settings: { ...defaults },
    time: START_FRAME,
    playing: false,
    loading: false,
    original: false,
    selected: null,
    rendererVersion: RENDERER_VERSION,
    error: "",
    notice: "",
  };
  private presentation: Snapshot = this.state;
  getPresentationSnapshot = () => this.presentation;
  private image: HTMLImageElement | null = null;
  private portableImage = "";
  private processed: HTMLCanvasElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private observer: ResizeObserver | null = null;
  private raf = 0;
  private origin = 0;
  private originTime = 0;
  private lastPublish = 0;
  private frame: any = null;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.state;
  private publish(next: Partial<Snapshot>) {
    this.state = { ...this.state, ...next };
    if (Object.keys(next).some((k) => !["time", "playing"].includes(k)))
      this.presentation = this.state;
    for (const fn of this.listeners) fn();
  }
  setNotice(notice: string) {
    this.publish({ notice, error: "" });
  }
  fail(error: unknown) {
    this.publish({
      error: error instanceof Error ? error.message : String(error),
      notice: "",
    });
  }
  private renderer() {
    const version = this.state.rendererVersion;
    return version === "node-network-renderer-v2"
      ? renderV2
      : version === "node-network-renderer-v4"
        ? renderV4
        : render;
  }
  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resize();
    return () => {
      this.pause();
      this.observer?.disconnect();
      document.removeEventListener("visibilitychange", this.onVisibility);
      this.canvas = null;
    };
  }
  private onVisibility = () => {
    if (document.hidden && this.state.playing) this.pause();
  };
  private resize() {
    if (!this.canvas) return;
    const box = this.canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(box.width * dpr));
    this.canvas.height = Math.max(1, Math.round(box.height * dpr));
    this.draw();
  }
  draw() {
    if (!this.canvas || !this.image || !this.state.scene) return;
    const { settings, scene, time, original, selected } = this.state,
      c = this.canvas;
    this.frame = this.renderer()(
      c.getContext("2d"),
      this.image,
      scene,
      original
        ? { ...settings, imageStyle: "original", exposure: 100 }
        : settings,
      time,
      c.width,
      c.height,
      {
        unit:
          (Math.min(c.width / this.image.width, c.height / this.image.height) *
            this.image.width) /
          560,
        overlay: !original,
        selected: original ? null : selected,
        xray: this.processed,
      },
    );
  }
  private effect() {
    if (!this.image) return;
    const s = this.state.settings;
    this.processed = PROCESSED_STYLES.includes(s.imageStyle)
      ? makeXray(this.image, s.xrayContrast, s.imageStyle, s.surfaceTone)
      : null;
  }
  set(key: keyof Settings, value: Settings[keyof Settings]) {
    const wasPlaying = this.state.playing;
    this.pause();
    const next = normalizeSettings({ ...this.state.settings, [key]: value });
    this.publish({
      settings: next,
      time: phaseAt(this.state.time, next.duration),
      rendererVersion:
        key === "motion" ? RENDERER_VERSION : this.state.rendererVersion,
      error: "",
    });
    if (["imageStyle", "xrayContrast", "surfaceTone"].includes(key))
      this.effect();
    this.draw();
    if (wasPlaying) this.play();
  }
  applyLook(name: keyof typeof presets) {
    this.pause();
    const next = normalizeSettings({
      ...this.state.settings,
      ...presets[name],
      preset: name,
      imageStyle: name === "natural" ? "original" : "bw",
      primary: name === "blueprint" ? "#c8eeee" : "#f2f0e7",
      shape: name === "signal" ? "dots" : "balanced",
    });
    this.publish({ settings: next });
    this.effect();
    this.draw();
  }
  reset() {
    this.pause();
    this.publish({
      settings: { ...defaults },
      time: 0,
      original: false,
      selected: null,
      rendererVersion: RENDERER_VERSION,
      error: "",
      notice: "",
    });
    this.effect();
    this.draw();
  }
  upgrade() {
    this.pause();
    this.publish({
      rendererVersion: RENDERER_VERSION,
      time: 0,
      notice: "Updated to the latest motion engine.",
    });
    this.draw();
  }
  compare() {
    this.publish({ original: !this.state.original });
    this.draw();
  }
  seek(time: number) {
    this.pause();
    this.publish({
      time: Math.max(
        0,
        Math.min(this.state.settings.duration - 0.000001, time),
      ),
    });
    this.draw();
  }
  restart() {
    this.pause();
    this.publish({ time: 0 });
    this.draw();
    this.play();
  }
  play() {
    if (!this.image || this.state.loading || this.state.playing) return;
    this.origin = performance.now();
    this.originTime = this.state.time;
    this.publish({ playing: true });
    this.raf = requestAnimationFrame(this.tick);
  }
  pause() {
    cancelAnimationFrame(this.raf);
    if (this.state.playing) {
      const { settings } = this.state;
      this.publish({
        time: playbackAt(
          this.originTime,
          (performance.now() - this.origin) / 1000,
          settings.duration,
          settings.speed,
        ),
        playing: false,
      });
      this.draw();
    }
  }
  toggle() {
    this.state.playing ? this.pause() : this.play();
  }
  private tick = (now: number) => {
    if (!this.state.playing) return;
    const s = this.state.settings;
    this.state = {
      ...this.state,
      time: playbackAt(
        this.originTime,
        (now - this.origin) / 1000,
        s.duration,
        s.speed,
      ),
    };
    this.draw();
    if (now - this.lastPublish > 50) {
      this.lastPublish = now;
      for (const fn of this.listeners) fn();
    }
    this.raf = requestAnimationFrame(this.tick);
  };
  selectAt(clientX: number, clientY: number) {
    if (!this.canvas || this.state.original || !this.frame) return;
    const b = this.canvas.getBoundingClientRect(),
      scale = this.canvas.width / b.width;
    const x = (clientX - b.left) * scale,
      y = (clientY - b.top) * scale;
    const targets = this.frame.hitTargets
      .map((n: any) => ({ ...n, d: Math.hypot(n.x - x, n.y - y) }))
      .sort((a: any, b: any) => a.d - b.d);
    this.publish({
      selected: targets[0]?.d < targets[0]?.r ? targets[0].id : null,
    });
    this.draw();
  }
  selectNext(direction: number) {
    const ids = this.frame?.hitTargets.map((n: any) => n.id) || [];
    if (!ids.length) return;
    const i = ids.indexOf(this.state.selected);
    this.publish({
      selected:
        direction === 0 ? null : ids[(i + direction + ids.length) % ids.length],
    });
    this.draw();
  }
  private async locked(action: () => Promise<void>) {
    if (this.state.loading)
      throw new Error("Wait for the current image to finish loading.");
    this.pause();
    this.publish({ loading: true, error: "", selected: null });
    try {
      await action();
    } finally {
      this.publish({ loading: false });
    }
  }
  private async commit(
    scene: Scene,
    settings: Settings,
    time: number,
    rendererVersion = RENDERER_VERSION,
  ) {
    validateImageHeader(scene.image);
    const img = new Image();
    img.src = scene.image.src;
    await img.decode();
    if (img.width !== scene.image.width || img.height !== scene.image.height)
      throw new Error("Image dimensions do not match the project.");
    const processed = PROCESSED_STYLES.includes(settings.imageStyle)
      ? makeXray(
          img,
          settings.xrayContrast,
          settings.imageStyle,
          settings.surfaceTone,
        )
      : null;
    const portable = document.createElement("canvas");
    portable.width = img.width;
    portable.height = img.height;
    const context = portable.getContext("2d")!;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, portable.width, portable.height);
    context.drawImage(img, 0, 0);
    const portableImage = portable.toDataURL("image/png");
    this.image = img;
    this.portableImage = portableImage;
    this.processed = processed;
    this.publish({
      scene,
      settings,
      time,
      rendererVersion,
      original: false,
      selected: null,
    });
    this.draw();
  }
  // Library scenes are added by the agent (npm run add-image), never uploaded here.
  async loadScene(path: string) {
    if (!/^\/(scenes\/[a-z]+|library\/[a-z0-9-]{1,60}\/scene)\.json$/.test(path))
      throw new Error("Unknown library scene.");
    await this.locked(async () => {
      const r = await fetch(path);
      if (!r.ok) throw new Error("Scene could not be loaded.");
      const scene = validateScene(await r.json());
      await this.commit(scene, this.state.settings, 0);
    });
  }
  async restore(data: unknown) {
    await this.locked(async () => {
      const project = validateProject(data);
      let scene = project.scene;
      if (!scene) {
        throw new Error("This legacy variation needs private sample assets. Export a full project from the original lab instead.");
      }
      await this.commit(
        scene,
        project.settings,
        project.time,
        project.rendererVersion || "node-network-renderer-v2",
      );
      this.setNotice("Project restored at its saved frame.");
    });
  }
  async open(file: File) {
    if (file.size > 32_000_000)
      throw new Error("Project is larger than 32 MB.");
    await this.restore(JSON.parse(await file.text()));
  }
  pack(): Project {
    if (!this.state.scene || !this.image) throw new Error("Load an image first.");
    // A project must survive moving to another machine or removing the library.
    // Canonical white compositing matches the image-effects pipeline.
    const scene = structuredClone(this.state.scene);
    scene.image.src = this.portableImage;
    return {
      version: 2,
      rendererVersion: this.state.rendererVersion,
      effectVersion: EFFECT_VERSION,
      scene,
      settings: { ...this.state.settings },
      time: phaseAt(this.state.time, this.state.settings.duration),
    };
  }
  capture() {
    if (!this.image || !this.state.scene)
      throw new Error("Load an image first.");
    return {
      project: this.pack(),
      image: this.image,
      effect: this.processed,
      renderer: this.renderer(),
    };
  }
  exportProject() {
    const bytes = new Blob([JSON.stringify(this.pack(), null, 2)], {
      type: "application/json",
    });
    if (bytes.size > 32_000_000) {
      this.fail("Project exceeds 32 MB. Use a smaller source image to share it.");
      return;
    }
    download(
      bytes,
      this.state.scene!.id + "-project.json",
    );
    this.setNotice("Project saved.");
  }
  exportStill() {
    const { project, image, effect, renderer } = this.capture(),
      c = document.createElement("canvas");
    c.width = image.width;
    c.height = image.height;
    renderer(
      c.getContext("2d"),
      image,
      project.scene,
      project.settings,
      project.time,
      c.width,
      c.height,
      { unit: c.width / 560, xray: effect },
    );
    c.toBlob((blob) => {
      if (blob) {
        download(
          blob,
          project.scene.id + "-" + project.settings.imageStyle + ".png",
        );
        this.setNotice("Source-resolution image exported.");
      } else this.fail("Image export failed.");
    }, "image/png");
  }
}
export const studio = new Studio();
