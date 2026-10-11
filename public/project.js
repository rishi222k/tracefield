import { validateScene } from "./scene.js";
import {
  normalizeSettings,
  RENDERER_VERSION,
  START_FRAME,
} from "./settings.js";
import { EFFECT_VERSION } from "./image-effects.js";

export function validateProject(data) {
  if (!data || ![1, 2].includes(data.version))
    throw new Error("Not a saved Node Network project.");
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
  return {
    scene: validateScene(structuredClone(data.scene)),
    settings,
    time,
    rendererVersion: data.rendererVersion,
  };
}
