export const phaseAt = (time, duration) =>
  ((time % duration) + duration) % duration;
export const smooth = (v) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
export function acquisitionAt(time, index, count, duration) {
  const u = phaseAt(time, duration) / duration,
    rank = index / Math.max(1, count - 1);
  return Math.min(
    smooth((u - rank * 0.24) / 0.12),
    1 - smooth((u - (0.76 + (1 - rank) * 0.08)) / 0.15),
  );
}
export function pulseAt(time, index, duration) {
  const phase = ((phaseAt(time, duration) / duration) * 2 + index * 0.173) % 1;
  return {
    phase,
    alpha: Math.min(smooth(phase / 0.08), smooth((1 - phase) / 0.08)),
  };
}
export function playbackAt(startTime, elapsed, duration, speed) {
  return phaseAt(startTime + Math.max(0, elapsed) * speed, duration);
}
export function videoPlan(duration, speed, fps = 30) {
  if (
    !Number.isFinite(duration) ||
    duration < 5 ||
    duration > 24 ||
    !Number.isFinite(speed) ||
    speed < 0.25 ||
    speed > 3 ||
    ![24, 30, 60].includes(fps)
  )
    throw new Error("Invalid video timing.");
  const nominalSeconds = duration / speed,
    count = Math.ceil(nominalSeconds * fps),
    seconds = count / fps,
    frameDuration = 1 / fps;
  return {
    seconds,
    nominalSeconds,
    count,
    frameRate: fps,
    frameDuration,
    frame: (i) => {
      if (!Number.isInteger(i) || i < 0 || i >= count)
        throw new Error("Invalid frame.");
      return {
        timestamp: i * frameDuration,
        duration: frameDuration,
        sceneTime: (i * duration) / count,
      };
    },
  };
}
export function exportSize(width, height, maxSize = 1080) {
  if (
    ![width, height, maxSize].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    ![720, 1080].includes(maxSize)
  )
    throw new Error("Invalid export dimensions.");
  const scale = Math.min(1, maxSize / Math.max(width, height));
  return {
    width: Math.max(2, Math.round((width * scale) / 2) * 2),
    height: Math.max(2, Math.round((height * scale) / 2) * 2),
  };
}

