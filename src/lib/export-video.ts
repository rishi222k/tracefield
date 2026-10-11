import {
  Output,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  WebMOutputFormat,
  Quality,
  getFirstEncodableVideoCodec,
} from "mediabunny";
import { videoPlan, exportSize } from "../../public/timeline.js";
import { studio } from "./studio";
export async function exportVideo({
  fps = 30,
  size = 1080,
  signal,
  snapshot,
  onProgress = () => {},
}: {
  fps?: number;
  size?: number;
  signal?: AbortSignal;
  snapshot?: ReturnType<typeof studio.capture>;
  onProgress?: (done: number, total: number) => void;
} = {}) {
  // Capture once. The preview's frame, playback and later edits cannot affect it.
  const { project, image, effect, renderer } = snapshot ?? studio.capture();
  const plan = videoPlan(
      project.settings.duration,
      project.settings.speed,
      fps,
    ),
    dimensions = exportSize(image.width, image.height, size);
  const canvas = document.createElement("canvas");
  Object.assign(canvas, dimensions);
  const ctx = canvas.getContext("2d")!;
  const quality = new Quality({ bitrate: 8_000_000 });
  const codec = await getFirstEncodableVideoCodec(["avc", "vp9", "vp8"], {
    ...dimensions,
    quality,
    frameRate: plan.frameRate,
  });
  if (!codec)
    throw new Error(
      "This browser has no supported video encoder. Open the studio in a browser with WebCodecs video support.",
    );
  const target = new BufferTarget(),
    format =
      codec === "avc"
        ? new Mp4OutputFormat({ fastStart: "in-memory" })
        : new WebMOutputFormat();
  const output = new Output({ format, target }),
    source = new CanvasSource(canvas, { codec, quality, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: plan.frameRate });
  try {
    await output.start();
    for (let i = 0; i < plan.count; i++) {
      signal?.throwIfAborted();
      const frame = plan.frame(i);
      renderer(
        ctx,
        image,
        project.scene,
        project.settings,
        frame.sceneTime,
        canvas.width,
        canvas.height,
        { unit: canvas.width / 560, xray: effect },
      );
      await source.add(frame.timestamp, frame.duration, { keyFrame: i === 0 });
      onProgress(i + 1, plan.count);
      if (i % 8 === 0)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    signal?.throwIfAborted();
    source.close();
    await output.finalize();
    signal?.throwIfAborted();
    const extension = codec === "avc" ? "mp4" : "webm";
    return {
      blob: new Blob([target.buffer!], { type: "video/" + extension }),
      name:
        project.scene.id + "-" + project.settings.motion + "-loop." + extension,
      project,
      frames: plan.count,
      seconds: plan.seconds,
      codec,
      ...dimensions,
    };
  } catch (error) {
    await output.cancel();
    throw error;
  }
}
