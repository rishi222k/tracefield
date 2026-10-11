import { validateScene } from "./scene.js";
import {
  normalizeSettings,
  RENDERER_VERSION,
  START_FRAME,
} from "./settings.js";
import { EFFECT_VERSION } from "./image-effects.js";

// Read only the PNG header before a browser decoder can allocate the image.
// Scene dimensions alone cannot bound an imported image's actual allocation.
export function validateImageHeader(image) {
  if (!image.src.startsWith("data:image/png;base64,")) return;
  const encoded = image.src.slice("data:image/png;base64,".length, "data:image/png;base64,".length + 44);
  let bytes;
  try { bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)); }
  catch { throw new Error("Invalid embedded PNG header."); }
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || signature.some((v, i) => bytes[i] !== v) ||
      String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR")
    throw new Error("Invalid embedded PNG header.");
  const view = new DataView(bytes.buffer);
  const width = view.getUint32(16), height = view.getUint32(20);
  if (!width || !height || width > 4096 || height > 4096 ||
      width !== image.width || height !== image.height)
    throw new Error("Embedded image dimensions do not match the bounded scene.");
}

export function validateProject(data) {
  if (!data || ![1, 2].includes(data.version))
    throw new Error("Not a saved Tracefield project.");
  const settings = normalizeSettings(data.settings);
  const time =
    data.time === undefined
      ? Math.min(START_FRAME, settings.duration - 0.01)
      : data.time;
  if (!Number.isFinite(time) || time < 0 || time >= settings.duration)
    throw new Error("Saved frame must be inside the loop.");
  if (data.version === 1) {
    if (!["orange", "purple"].includes(data.sceneId))
      throw new Error("Legacy settings only support the bundled samples.");
    return { sceneId: data.sceneId, settings, time };
  }
  if (
    ![
      "node-network-renderer-v2",
      "node-network-renderer-v4",
      RENDERER_VERSION,
    ].includes(
      data.rendererVersion,
    ) ||
    data.effectVersion !== EFFECT_VERSION
  )
    throw new Error(
      "This project requires a different renderer/effect version.",
    );
  const scene = validateScene(structuredClone(data.scene));
  validateImageHeader(scene.image);
  return {
    scene,
    settings,
    time,
    rendererVersion: data.rendererVersion,
  };
}
