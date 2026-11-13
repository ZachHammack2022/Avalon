import test from 'node:test';
import assert from 'node:assert/strict';
import { Timeline } from '../public/tv/engine/timeline.js';
import { angleDelta, formationSlots, FORMATIONS, yawToward } from '../public/tv/engine/formation.js';
import { ease, len, shakeOffset, shotPose, sub } from '../public/tv/engine/camera.js';

test('timeline fires every beat once, in order, as time advances', () => {
  const beats = [{ t: 0, n: 'a' }, { t: 1, n: 'b' }, { t: 1, n: 'c' }, { t: 2.5, n: 'd' }];
  const tl = new Timeline(beats);
  const fired = [];
  tl.update(0, (b) => fired.push(b.n));
  assert.deepEqual(fired, ['a']);
  tl.update(0.9, (b) => fired.push(b.n));
  assert.deepEqual(fired, ['a']);
  tl.update(0.1, (b) => fired.push(b.n));
  assert.deepEqual(fired, ['a', 'b', 'c']);
  tl.update(10, (b) => fired.push(b.n));
  tl.update(10, (b) => fired.push(b.n));
  assert.deepEqual(fired, ['a', 'b', 'c', 'd']);
  tl.reset();
  assert.equal(tl.time, 0);
});

test('formations give distinct slots for team sizes 2-5 and stay centered', () => {
  for (const name of FORMATIONS) {
    for (let n = 2; n <= 5; n++) {
      const slots = formationSlots(name, n, { center: [3, -2], facing: 90, spacing: 1.6 });
      assert.equal(slots.length, n);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        assert.ok(Math.hypot(slots[i].x - slots[j].x, slots[i].z - slots[j].z) > 0.8, `${name} n=${n} overlap ${i},${j}`);
      }
      const cx = slots.reduce((s, p) => s + p.x, 0) / n; const cz = slots.reduce((s, p) => s + p.z, 0) / n;
      if (name !== 'arc') assert.ok(Math.hypot(cx - 3, cz + 2) < 1e-6, `${name} n=${n} centered`);
    }
  }
  assert.throws(() => formationSlots('zigzag', 3));
});

test('column puts the front actor furthest along the facing direction (facing +X)', () => {
  const s = formationSlots('column', 4, { facing: 90, spacing: 2 });
  for (let i = 1; i < 4; i++) assert.ok(s[i].x < s[i - 1].x);
  assert.ok(s.every((p) => Math.abs(p.z) < 1e-9));
});

test('huddle faces inward; angle helpers', () => {
  const s = formationSlots('huddle', 4, { center: [0, 0] });
  for (const p of s) assert.ok(Math.abs(angleDelta(p.yaw, yawToward([p.x, 0, p.z], [0, 0, 0]))) < 1e-6);
  assert.equal(angleDelta(350, 10), 20);
  assert.equal(angleDelta(10, 350), -20);
});

test('camera shots: pushIn dollies closer over time; lowAngle sits below the target; closeUp is close', () => {
  const ctx = { target: [0, 0, 0], center: [0, 0, 0], target2: [5, 0, 0] };
  const d = (k) => len(sub(shotPose({ shot: 'pushIn' }, ctx, k).pos, [0, 1.6, 0]));
  assert.ok(d(0) > d(0.5) && d(0.5) > d(1));
  assert.ok(d(1) < 4);
  assert.ok(shotPose({ shot: 'lowAngle' }, ctx).pos[1] < 1);
  assert.ok(len(sub(shotPose({ shot: 'closeUp' }, ctx).pos, [0, 1.6, 0])) < 4.5);
  const os = shotPose({ shot: 'overShoulder' }, ctx);
  assert.ok(os.pos[0] < 0, 'camera behind A looking toward B');
  for (const shot of ['wide', 'follow', 'orbit', 'crane']) {
    const p = shotPose({ shot }, ctx, 0.5);
    assert.ok(p.pos.every(Number.isFinite) && p.look.every(Number.isFinite), shot);
  }
  assert.throws(() => shotPose({ shot: 'nope' }, ctx));
});

test('ease and shake are bounded and deterministic', () => {
  for (const e of ['linear', 'in', 'out', 'inOut', 'bounce', 'back']) { assert.ok(Math.abs(ease(e, 0)) < 1e-9); assert.ok(Math.abs(ease(e, 1) - 1) < 1e-9, e); }
  assert.deepEqual(shakeOffset(0.5, 1.23), shakeOffset(0.5, 1.23));
  assert.ok(shakeOffset(1, 3).every((v) => Math.abs(v) <= 0.36));
  assert.ok(shakeOffset(0, 3).every((v) => v === 0));
});
