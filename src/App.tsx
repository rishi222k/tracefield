import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  memo,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDownToLine,
  Blend,
  Crosshair,
  ArrowUpRight,
  Check,
  ChevronDown,
  PanelLeft,
  Image as ImageIcon,
  FileJson,
  FolderOpen,
  Film,
  Pause,
  Play,
  SkipBack,
  Target,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { studio, download, type Settings } from "@/lib/studio";
import type { exportVideo } from "@/lib/export-video";
import { ranges, RENDERER_VERSION } from "../public/settings.js";
import { acquisitionAt } from "../public/timeline.js";
import { loadLibraryIndex } from "../public/library-index.js";
import { cn } from "@/lib/utils";

const looks = [
  ["original", "Original"],
  ["bw", "Mono"],
  ["xray", "X-ray"],
  ["darkfield", "Dark X-ray"],
  ["blueprint", "Blueprint"],
] as const;
const markerStyles = [
  ["balanced", "Mixed"],
  ["brackets", "Brackets"],
  ["frames", "Frames"],
  ["dots", "Dots"],
  ["rings", "Rings"],
  ["crosshairs", "Cross"],
  ["diamonds", "Diamond"],
] as const;

const usePresentation = () =>
  useSyncExternalStore(studio.subscribe, studio.getPresentationSnapshot);
const range = (field: keyof Settings) => ranges.find((r) => r[0] === field)!;

// A settings-bound scrub slider; limits come from the shared ranges table.
function SettingScrub({
  field,
  label,
  format,
}: {
  field: keyof Settings;
  label: string;
  format?: (v: number) => string;
}) {
  const { settings } = usePresentation();
  const [, , min, max, step, unit] = range(field);
  return (
    <ScrubSlider
      label={label}
      value={settings[field] as number}
      min={Number(min)}
      max={Number(max)}
      step={Number(step)}
      format={format ?? ((v) => `${Number(v.toFixed(2))}${unit}`)}
      onChange={(v) => studio.set(field, v)}
    />
  );
}

// Marker glyphs drawn like the renderer draws them.
function MarkerGlyph({ style }: { style: string }) {
  const s = 18,
    c = s / 2;
  const bracket = (
    <path
      d="M3 7V3h4M11 3h4v4M15 11v4h-4M7 15H3v-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    />
  );
  const frame = (
    <rect x="3.5" y="3.5" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.3" />
  );
  const dot = <circle cx={c} cy={c} r="2.2" fill="currentColor" />;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden>
      {style === "brackets" && bracket}
      {style === "frames" && frame}
      {style === "rings" && <circle cx={c} cy={c} r="6" fill="none" stroke="currentColor" strokeWidth="1.3" />}
      {style === "crosshairs" && (
        <path d="M9 2v4.5M9 11.5V16M2 9h4.5M11.5 9H16" fill="none" stroke="currentColor" strokeWidth="1.3" />
      )}
      {style === "diamonds" && (
        <path d="M9 2.5 15.5 9 9 15.5 2.5 9Z" fill="none" stroke="currentColor" strokeWidth="1.3" />
      )}
      {style === "balanced" && (
        <>
          <path d="M2 5V2h3M13 16h3v-3" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <rect x="6" y="6" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </>
      )}
      {dot}
    </svg>
  );
}

// Canvas sized to the image's own aspect so the picture sits alone on the
// workspace, with a shadow, instead of inside a letterboxed frame.
const Canvas = memo(function Canvas() {
  const stage = useRef<HTMLDivElement>(null),
    ref = useRef<HTMLCanvasElement>(null);
  const { scene } = usePresentation();
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => studio.attach(ref.current!), []);
  useLayoutEffect(() => {
    const el = stage.current!;
    const fit = () => {
      const r = el.getBoundingClientRect();
      if (!scene) return setBox({ w: 0, h: 0 });
      const k = Math.min(r.width / scene.image.width, r.height / scene.image.height);
      setBox({ w: Math.floor(scene.image.width * k), h: Math.floor(scene.image.height * k) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scene]);
  return (
    <div className="stage" ref={stage}>
      <canvas
        ref={ref}
        id="studio-canvas"
        tabIndex={0}
        style={{ width: box.w, height: box.h, opacity: box.w ? 1 : 0 }}
        aria-label="Animated node network. Click a marker to inspect it; use left and right arrows to select anchors."
        onClick={(e) => studio.selectAt(e.clientX, e.clientY)}
        onKeyDown={(e) => {
          if (["ArrowRight", "ArrowLeft", "Escape"].includes(e.key)) {
            e.preventDefault();
            studio.selectNext(e.key === "Escape" ? 0 : e.key === "ArrowRight" ? 1 : -1);
          }
        }}
      />
    </div>
  );
});

// Timeline dock: transport, a scrubbable track that shows how much of the
// network is visible across the loop, and the loop's duration and speed.
function Timeline() {
  const state = useSyncExternalStore(studio.subscribe, studio.getSnapshot),
    s = state.settings;
  const track = useRef<HTMLDivElement>(null);
  const curve = useMemo(() => {
    const n = 24,
      pts: string[] = [];
    for (let k = 0; k <= 160; k++) {
      const t = (k / 160) * s.duration;
      let sum = 0;
      for (let i = 0; i < n; i++) sum += acquisitionAt(t, i, n, s.duration);
      const v = s.motion === "acquire" ? sum / n : 1;
      pts.push(`${(k / 160) * 100},${36 - v * 30}`);
    }
    return `M0,36 L${pts.join(" L")} L100,36 Z`;
  }, [s.duration, s.motion]);
  const seekFrom = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    studio.seek(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * s.duration);
  };
  const p = (state.time / s.duration) * 100;
  return (
    <div className="timeline-dock">
      <div className="transport">
        <Button
          size="icon"
          className="play"
          onClick={() => studio.toggle()}
          disabled={state.loading || !state.scene}
          aria-label={state.playing ? "Pause animation" : "Play animation"}
        >
          {state.playing ? <Pause /> : <Play />}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => studio.restart()}
          disabled={state.loading || !state.scene}
          aria-label="Play from beginning"
        >
          <SkipBack />
        </Button>
        <span className="timecode">
          <b>{state.time.toFixed(1).padStart(4, "0")}</b>
          <span>{s.duration.toFixed(1)}</span>
        </span>
      </div>
      <div
        className="track"
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Animation timeline"
        aria-valuemin={0}
        aria-valuemax={s.duration}
        aria-valuenow={Number(state.time.toFixed(2))}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          seekFrom(e.clientX);
        }}
        onPointerMove={(e) => e.buttons & 1 && seekFrom(e.clientX)}
        onKeyDown={(e) => {
          const d = e.key === "ArrowRight" ? 0.1 : e.key === "ArrowLeft" ? -0.1 : 0;
          if (d) {
            e.preventDefault();
            studio.seek(Math.min(s.duration, Math.max(0, state.time + d)));
          }
        }}
      >
        <svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden>
          <path d={curve} className="track-curve" />
          <rect x="0" y="0" width={p} height="36" className="track-played" />
        </svg>
        <div className="ticks" aria-hidden>
          {Array.from({ length: Math.floor(s.duration) + 1 }, (_, i) => (
            <i key={i} style={{ left: `${(i / s.duration) * 100}%` }} />
          ))}
        </div>
        <div className="playhead" style={{ left: `${p}%` }} aria-hidden />
      </div>
      <div className="loop-settings">
        <SettingScrub field="duration" label="Loop" format={(v) => `${v}s`} />
        <SettingScrub field="speed" label="Speed" format={(v) => `${Number(v.toFixed(2))}×`} />
      </div>
    </div>
  );
}

// One inspector: look, network and markers. Everything else keeps its default.
const Inspector = memo(function Inspector() {
  const { settings: s, scene } = usePresentation();
  const thumb = scene?.image.src;
  const processed = ["xray", "darkfield", "blueprint"].includes(s.imageStyle);
  return (
    <aside className="inspector">
      <section>
        <h3>
          <Blend />
          Blend
        </h3>
        <div className="look-grid" role="radiogroup">
          {looks.map(([id, label]) => (
            <button
              key={id}
              role="radio"
              aria-checked={s.imageStyle === id}
              className={cn("look", s.imageStyle === id && "active")}
              onClick={() => studio.set("imageStyle", id)}
            >
              <span className={cn("look-swatch", id)}>
                {thumb && <img src={thumb} alt="" />}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        {processed ? (
          <SettingScrub field="xrayContrast" label="Intensity" format={(v) => `${Math.round(v)}%`} />
        ) : (
          <SettingScrub field="exposure" label="Brightness" format={(v) => `${Math.round(v)}%`} />
        )}
        {s.imageStyle === "darkfield" && (
          <SettingScrub field="surfaceTone" label="Surface" format={(v) => `${Math.round(v)}%`} />
        )}
      </section>
      <section>
        <h3>
          <Crosshair />
          Markers
        </h3>
        <div className="marker-grid" role="radiogroup">
          {markerStyles.map(([id, label]) => (
            <button
              key={id}
              role="radio"
              aria-checked={s.shape === id}
              aria-label={label}
              className={cn("marker", s.shape === id && "active")}
              onClick={() => studio.set("shape", id)}
            >
              <MarkerGlyph style={id} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <SettingScrub field="markerSize" label="Size" format={(v) => `${Math.round(v)}px`} />
        <SettingScrub field="highlight" label="Accent" format={(v) => `${Math.round(v)}%`} />
        <SettingScrub field="labels" label="Labels" format={(v) => `${Math.round(v)}%`} />
      </section>
    </aside>
  );
});

const LoopExport = memo(function LoopExport({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const snapshot = useSyncExternalStore(
    studio.subscribe,
    studio.getPresentationSnapshot,
  );
  const [fps, setFps] = useState("30"),
    [size, setSize] = useState("1080"),
    [progress, setProgress] = useState<number | null>(null),
    [error, setError] = useState(""),
    [result, setResult] = useState<Awaited<
      ReturnType<typeof exportVideo>
    > | null>(null),
    [url, setUrl] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!result) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(result.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [result]);
  async function encode() {
    setError("");
    setResult(null);
    setProgress(0);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const snapshot = studio.capture();
      const { exportVideo } = await import("@/lib/export-video");
      const r = await exportVideo({
        snapshot,
        fps: Number(fps),
        size: Number(size),
        signal: controller.signal,
        onProgress: (done, total) => setProgress((done / total) * 100),
      });
      setResult(r);
      (window as any).__lastVideo = r;
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setProgress(null);
      abort.current = null;
    }
  }
  function changeOpen(v: boolean) {
    if (!v) abort.current?.abort();
    setOpen(v);
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="export-dialog">
        <DialogHeader>
          <DialogTitle>Export a complete loop</DialogTitle>
          <DialogDescription>
            Starts at 0:00. Your preview position won’t change the video.
          </DialogDescription>
        </DialogHeader>
        <div className="export-preview">
          {url ? (
            <video
              src={url}
              controls
              loop
              muted
              playsInline
              data-export-preview
            />
          ) : (
            <div className="export-placeholder">
              <Film />
              <span>
                {progress !== null
                  ? "Rendering every frame…"
                  : "Your loop preview appears here"}
              </span>
            </div>
          )}
        </div>
        <div className="export-settings">
          <div>
            <label htmlFor="export-size">Resolution</label>
            <Select
              value={size}
              onValueChange={setSize}
              disabled={progress !== null}
            >
              <SelectTrigger id="export-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1080">1080 px</SelectItem>
                <SelectItem value="720">720 px</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="export-fps">Frame rate</label>
            <Select
              value={fps}
              onValueChange={setFps}
              disabled={progress !== null}
            >
              <SelectTrigger id="export-fps">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 fps</SelectItem>
                <SelectItem value="30">30 fps</SelectItem>
                <SelectItem value="60">60 fps</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {progress !== null && (
          <div className="export-progress">
            <Progress value={progress} />
            <span>{Math.round(progress)}%</span>
          </div>
        )}
        {result && (
          <div className="export-meta">
            <Check />
            {result.frames} frames · {result.seconds.toFixed(2)}s ·{" "}
            {result.width} × {result.height} ·{" "}
            {result.name.endsWith(".mp4") ? "MP4" : "WebM"}
          </div>
        )}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="export-actions">
          <span>
            {snapshot.settings.motion === "still" &&
            snapshot.settings.labelMotion === "anchored" &&
            !snapshot.settings.drift
              ? "Still composition"
              : `${(snapshot.settings.duration / snapshot.settings.speed).toFixed(1)}s at ${snapshot.settings.speed}×`}
          </span>
          {progress !== null ? (
            <Button variant="outline" onClick={() => abort.current?.abort()}>
              Cancel
            </Button>
          ) : (
            <>
              <Button
                variant={result ? "outline" : "default"}
                onClick={encode}
                data-action="render-video"
              >
                {result ? "Render again" : "Render loop"}
              </Button>
              {result && (
                <Button
                  onClick={() => download(result.blob, result.name)}
                  data-action="download-video"
                >
                  <ArrowDownToLine />
                  Download
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

type LibraryEntry = { id: string; title: string; scene: string; thumb: string };
function App() {
  const state = useSyncExternalStore(studio.subscribe, studio.getSnapshot),
    [libraryOpen, setLibraryOpen] = useState(() => window.innerWidth > 900),
    [exportOpen, setExportOpen] = useState(false),
    [entries, setEntries] = useState<LibraryEntry[]>([]),
    reduced = useReducedMotion();
  useEffect(() => {
    Promise.all([
      document.fonts.load('10px "Lab Mono"'),
      document.fonts.load('10px "Lab Serif Mono"'),
      document.fonts.load('13px "Geist Variable"'),
    ])
      .then(() => loadLibraryIndex())
      .then((list: LibraryEntry[]) => {
        setEntries(list);
        const requested = new URLSearchParams(location.search).get("scene");
        const entry = list.find((item) => item.id === requested) ?? list[0];
        if (entry) return studio.loadScene(entry.scene);
      })
      .catch((e) => studio.fail(e));
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.code === "Space" &&
        !target.closest(
          "button,input,textarea,select,[role=slider],[role=combobox],[contenteditable=true]",
        )
      ) {
        e.preventDefault();
        studio.toggle();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    (window as any).__nodeStudio = {
      getState: studio.getSnapshot,
      pack: () => studio.pack(),
      applyPack: (p: unknown) => studio.restore(p),
      renderAt: (t: number) => studio.seek(t),
      exportVideo: async (options: any) => {
        const snapshot = studio.capture();
        return (await import("@/lib/export-video")).exportVideo({
          ...options,
          snapshot,
        });
      },
      studio,
    };
  }, []);
  const selected = state.scene?.nodes.find((n) => n.id === state.selected);
  const projectInput = useRef<HTMLInputElement>(null);
  return (
    <div className="studio">
      <input ref={projectInput} type="file" accept=".json,application/json" hidden
        aria-label="Open saved project" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) studio.open(file).catch((error) => studio.fail(error));
          event.target.value = "";
        }} />
      <header className="topbar">
        <div className="topbar-left">
          {state.scene && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={libraryOpen ? "Hide images" : "Show images"}
              aria-pressed={libraryOpen}
              onClick={() => setLibraryOpen(!libraryOpen)}
            >
              <PanelLeft />
            </Button>
          )}
        </div>
        <div className="topbar-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={state.loading}>
                <ArrowDownToLine />
                Export
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={!state.scene} onClick={() => studio.exportStill()}>
                <ImageIcon />
                Image
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!state.scene} onClick={() => setExportOpen(true)}>
                <Film />
                Loop
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!state.scene} onClick={() => studio.exportProject()}>
                <FileJson /> Project
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => projectInput.current?.click()}>
                <FolderOpen /> Open project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <LoopExport open={exportOpen} setOpen={setExportOpen} />
        </div>
      </header>
      <nav
        className={cn("library", (!libraryOpen || !entries.length) && "collapsed")}
        aria-label="Images"
      >
        {entries.map((entry) => (
          <button
            key={entry.id}
            className={cn("library-item", state.scene?.id === entry.id && "active")}
            disabled={state.loading}
            onClick={() => {
              studio.loadScene(entry.scene).catch((e) => studio.fail(e));
            }}
          >
            <img src={entry.thumb} alt="" />
            <span>{entry.title}</span>
          </button>
        ))}
      </nav>
      <main className="workspace">
        <Canvas />
        {state.scene && (
          <div className="view-toggle" role="radiogroup" aria-label="View">
            {(
              [
                [true, "Original"],
                [false, "Network"],
              ] as const
            ).map(([original, label]) => (
              <button
                key={label}
                role="radio"
                aria-checked={state.original === original}
                className={cn(state.original === original && "active")}
                onClick={() => state.original !== original && studio.compare()}
              >
                {state.original === original && (
                  <motion.span
                    layoutId="view"
                    className="segmented-thumb"
                    transition={{ type: "spring", stiffness: 520, damping: 38 }}
                  />
                )}
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
        {!state.scene && !state.loading && !entries.length && (
          <p className="empty-state">No images yet. Add one with the skill.</p>
        )}
        {state.loading && <div className="stage-loading"><span /></div>}
        <AnimatePresence>
          {selected && (
            <motion.div
              className="anchor-detail"
              initial={{ opacity: 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : 8 }}
            >
              <div>
                <Target />
                <b>{selected.label}</b>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close anchor detail"
                  onClick={() => studio.selectNext(0)}
                >
                  <X />
                </Button>
              </div>
              <p>{selected.reason}</p>
            </motion.div>
          )}
        </AnimatePresence>
        {state.rendererVersion !== RENDERER_VERSION && (
          <div className="legacy-notice">
            <span>Saved with an older motion.</span>
            <Button size="sm" variant="ghost" onClick={() => studio.upgrade()}>
              Use current
              <ArrowUpRight />
            </Button>
          </div>
        )}
        {state.error && (
          <p role="alert" className="error-text workspace-error">
            {state.error}
          </p>
        )}
      </main>
      <Timeline />
      <Inspector />
    </div>
  );
}
export default App;
