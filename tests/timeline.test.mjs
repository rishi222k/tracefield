import test from "node:test";
import assert from "node:assert/strict";
import {
  videoPlan,
  exportSize,
  acquisitionAt,
  pulseAt,
  playbackAt,
} from "../public/timeline.js";

test("exports start at zero and cover exactly one cycle, including fractional speed", () => {
  for (const duration of [5, 12, 24])
    for (const speed of [0.25, 0.65, 1, 3])
      for (const fps of [24, 30, 60]) {
        const plan = videoPlan(duration, speed, fps),
          first = plan.frame(0),
          last = plan.frame(plan.count - 1);
        assert.equal(first.timestamp, 0);
        assert.equal(first.sceneTime, 0);
        assert.ok(last.sceneTime < duration);
        assert.ok(
          Math.abs(last.timestamp + last.duration - plan.seconds) < 1e-9,
        );
        assert.equal(plan.frameRate, fps);
        assert.ok(Math.abs(plan.count - plan.frameRate * plan.seconds) < 1e-9);
        assert.ok(
          plan.seconds >= duration / speed - 1e-9 &&
            plan.seconds - duration / speed < 1 / fps,
        );
        for (let i = 1; i < plan.count; i++) {
          const a = plan.frame(i - 1),
            b = plan.frame(i);
          assert.ok(Math.abs(a.timestamp + a.duration - b.timestamp) < 1e-9);
        }
      }
  assert.throws(() => videoPlan(0, 1));
  assert.throws(() => videoPlan(12, 0));
  assert.throws(() => videoPlan(12, 1, 120));
});
test("acquisition traces, holds and returns to the same clean seam", () => {
  for (const count of [1, 14, 250])
    for (let i = 0; i < count; i++) {
      assert.equal(acquisitionAt(0, i, count, 12), 0);
      assert.equal(acquisitionAt(6, i, count, 12), 1);
      assert.ok(acquisitionAt(12 - 1 / 30, i, count, 12) < 0.002);
      assert.equal(acquisitionAt(12, i, count, 12), 0);
    }
  assert.ok(acquisitionAt(1, 0, 14, 12) > acquisitionAt(1, 13, 14, 12));
});
test("pulse resets are invisible and playback follows elapsed time without a delta cap", () => {
  assert.equal(pulseAt(0, 0, 12).alpha, 0);
  assert.ok(pulseAt(6 - 1e-6, 0, 12).alpha < 1e-9);
  assert.deepEqual(pulseAt(12, 7, 12), pulseAt(0, 7, 12));
  assert.equal(playbackAt(5.5, 2, 12, 1), 7.5);
  assert.equal(playbackAt(5.5, 8, 12, 1), 1.5);
  assert.equal(playbackAt(0, 3, 12, 2), 6);
});
test("export sizing keeps landscapes and portraits bounded and codec dimensions even", () => {
  for (const [w, h] of [
    [1536, 1904],
    [1335, 1780],
    [4096, 500],
    [500, 4096],
    [1, 1],
  ]) {
    const size = exportSize(w, h, 1080);
    assert.ok(size.width <= 1080 && size.height <= 1080);
    assert.equal(size.width % 2, 0);
    assert.equal(size.height % 2, 0);
    assert.ok(size.width >= 2 && size.height >= 2);
  }
});

test("native video sizing keeps the photo's exact frame, including odd portrait and landscape dimensions",()=>{
  for(const [width,height] of [[1026,1533],[1126,1397],[1086,1448],[1533,1026],[4096,4096],[1,1]])
    assert.deepEqual(exportSize(width,height,'source'),{width,height});
  for(const [width,height] of [[0,10],[4097,10],[10,NaN],[10.5,10]])
    assert.throws(()=>exportSize(width,height,'source'));
});
