import assert from "node:assert/strict";
import { test } from "node:test";
import { createClickSamples, createMusicSamples, PokerAudio, readAudioPreferences } from "../src/lib/audio";

class TestAudioContext {
  sampleRate = 4000;
  currentTime = 0;
  state = "suspended";
  gains: { gain: { value: number }; connect: () => void }[] = [];
  sources: { buffer: unknown; loop: boolean; stopped: boolean; start: () => void; stop: () => void; connect: () => void; disconnect: () => void }[] = [];
  destination = {};
  createGain() {
    const gain = { gain: { value: 1 }, connect() {} };
    this.gains.push(gain);
    return gain;
  }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    return { length, sampleRate, getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    const source = { buffer: null as unknown, loop: false, stopped: false, start() {}, stop() { this.stopped = true; }, connect() {}, disconnect() {} };
    this.sources.push(source);
    return source;
  }
  async resume() { this.state = "running"; }
  async suspend() { this.state = "suspended"; }
  async close() { this.state = "closed"; }
}

test("audio remains silent until a gesture, with independent controls and immediate mute", () => {
  const context = new TestAudioContext();
  let created = 0;
  const audio = new PokerAudio(() => { created++; return context as unknown as AudioContext; });
  audio.configure({ effects: true, music: true });
  assert.equal(created, 0, "restoring preferences must not autoplay");
  audio.unlock();
  assert.equal(created, 1);
  assert.equal(context.sources.filter((source) => source.loop).length, 1);
  audio.playClick();
  assert.equal(context.sources.length, 2);
  audio.configure({ effects: false, music: true });
  context.currentTime = 1;
  audio.playClick();
  assert.equal(context.sources.length, 2, "muting effects must prevent new clicks");
  assert.equal(context.gains[0].gain.value, 0, "mute must also silence sounds already playing");
  assert.equal(context.sources[0].stopped, false, "music continues when effects are off");
  audio.setVisible(false);
  assert.equal(context.state, "suspended");
  audio.setVisible(true);
  assert.equal(context.state, "running");
  assert.equal(context.sources.length, 2, "visibility changes must not duplicate the music loop");
  audio.configure({ effects: true, music: false });
  assert.equal(context.sources[0].stopped, true);
  audio.playClick();
  assert.equal(context.sources.length, 3, "effects remain usable without music");
  audio.configure({ effects: false, music: false });
  assert.equal(context.state, "suspended");
  audio.setVisible(false);
  audio.setVisible(true);
  assert.equal(context.state, "suspended", "visibility cannot override mute");
  audio.dispose();
  assert.equal(context.state, "closed");
});

test("default/invalid preferences and unsupported audio fail silently", () => {
  for (const input of [null, "bad json", "null", '{"effects":"true","music":1}']) {
    assert.deepEqual(readAudioPreferences(input), { effects: true, music: true });
  }
  assert.deepEqual(readAudioPreferences('{"effects":true,"music":false}'), { effects: true, music: false });
  assert.deepEqual(readAudioPreferences('{"effects":false,"music":false}'), { effects: false, music: false }, "a saved mute must survive the new defaults");
  const audio = new PokerAudio(() => { throw new Error("Audio unavailable"); });
  audio.configure({ effects: true, music: true });
  assert.doesNotThrow(() => audio.playClick());
  audio.dispose();
});

test("synthesized music and click are finite, audible, unclipped and free of loop-edge jumps", () => {
  const sampleRate = 22050;
  for (const samples of [createClickSamples(sampleRate), createMusicSamples(sampleRate), createMusicSamples(sampleRate, "table")]) {
    let peak = 0;
    let energy = 0;
    for (const sample of samples) {
      assert.ok(Number.isFinite(sample));
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
    }
    assert.ok(peak < 0.5 && peak > 0.05, `peak ${peak}`);
    assert.ok(Math.sqrt(energy / samples.length) > 0.005);
    assert.ok(Math.abs(samples[0] - samples[samples.length - 1]) < 0.001);
  }
});

test("entering/leaving play replaces the track once, reuses it and never overrides mute", () => {
  const context = new TestAudioContext();
  const audio = new PokerAudio(() => context as unknown as AudioContext);
  audio.unlock();
  const lobby = context.sources[0];
  audio.setScene("table");
  assert.equal(lobby.stopped, true);
  const table = context.sources[1];
  assert.notEqual(lobby.buffer, table.buffer);
  audio.setScene("table");
  assert.equal(context.sources.length, 2, "game updates must not restart music");
  audio.setScene("lobby");
  assert.equal(table.stopped, true);
  assert.equal(context.sources[2].buffer, lobby.buffer);
  audio.configure({ music: false, effects: true });
  audio.setScene("table");
  assert.equal(context.sources.length, 3, "scene changes cannot unmute music");
  audio.configure({ music: true, effects: true });
  assert.equal(context.sources[3].buffer, table.buffer);
  audio.dispose();
});
