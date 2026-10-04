export type AudioPreferences = { effects: boolean; music: boolean };
export type MusicScene = "lobby" | "table";
export const AUDIO_STORAGE_KEY = "pokerchip.audio";
export const DEFAULT_AUDIO: AudioPreferences = { effects: true, music: true };

export function readAudioPreferences(value: string | null): AudioPreferences {
  try {
    const parsed = JSON.parse(value ?? "null");
    return {
      effects: typeof parsed?.effects === "boolean" ? parsed.effects : DEFAULT_AUDIO.effects,
      music: typeof parsed?.music === "boolean" ? parsed.music : DEFAULT_AUDIO.music
    };
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

// Original, locally synthesized sounds: no downloads or third-party recordings.
export function createClickSamples(sampleRate: number): Float32Array {
  const samples = new Float32Array(Math.ceil(sampleRate * 0.075));
  let seed = 7;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    seed = (seed * 16807) % 2147483647;
    const noise = (seed / 2147483647 - 0.5) * Math.exp(-t * 180);
    const ring = Math.sin(2 * Math.PI * 1450 * t) * Math.exp(-t * 95);
    samples[i] = (noise * 0.3 + ring * 0.16) * Math.min(t / 0.0015, 1);
  }
  return samples;
}

export function createMusicSamples(sampleRate: number, scene: MusicScene = "lobby"): Float32Array {
  const table = scene === "table";
  const beat = 60 / (table ? 112 : 96);
  const samples = new Float32Array(Math.round(sampleRate * beat * 32));
  function note(midi: number, start: number, duration: number, volume: number, bass = false) {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const first = Math.round(start * sampleRate);
    const count = Math.round(duration * sampleRate);
    for (let i = 0; i < count; i++) {
      const t = i / sampleRate;
      const phase = 2 * Math.PI * frequency * t;
      const tone = Math.sin(phase) + Math.sin(phase * 2) * (bass ? 0.12 : 0.3) + Math.sin(phase * 3) * 0.07;
      const envelope = Math.min(t / 0.012, 1) * Math.exp(-t * (bass ? 5 : 3)) * Math.min((duration - t) / 0.08, 1);
      samples[(first + i) % samples.length] += tone * envelope * volume;
    }
  }
  const chords = table
    ? [[50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 58], [45, 49, 52, 55]]
    : [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]];
  const melody = table
    ? [69, 65, 62, 64, 65, 69, 72, 69, 67, 64, 62, 60, 61, 64, 67, 64]
    : [76, 72, 71, 67, 69, 72, 76, 74, 71, 74, 72, 67, 71, 67, 64, 67];
  for (let bar = 0; bar < 8; bar++) {
    const chord = chords[Math.floor(bar / 2)];
    const start = bar * beat * 4;
    chord.forEach((pitch, index) => note(pitch, start + index * 0.025, beat * 3.2, 0.018));
    note(chord[0] - 12, start, beat * 1.6, 0.06, true);
    note(chord[0] - 5, start + beat * 2, beat * 1.4, 0.045, true);
    note(melody[bar * 2], start + beat, beat * 0.8, 0.032);
    note(melody[bar * 2 + 1], start + beat * 2.5, beat * 1.2, 0.028);
    if (table) {
      // A restrained bass pulse and offbeat arpeggio distinguish play from the lounge.
      for (let pulse = 0; pulse < 4; pulse++) {
        note(chord[pulse % chord.length] + 12, start + beat * (pulse + 0.5), beat * 0.4, 0.018);
        note(chord[0] - 12, start + beat * pulse, beat * 0.45, 0.025, true);
      }
    }
  }
  return samples;
}

export class PokerAudio {
  private context: AudioContext | null = null;
  private effectsGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffers: Partial<Record<MusicScene, AudioBuffer>> = {};
  private scene: MusicScene = "lobby";
  private clickBuffer: AudioBuffer | null = null;
  private preferences = { ...DEFAULT_AUDIO };
  private visible = true;
  private lastClick = -Infinity;

  constructor(private readonly createContext: () => AudioContext = () => new AudioContext()) {}

  configure(preferences: AudioPreferences) {
    this.preferences = preferences;
    this.sync();
  }

  setScene(scene: MusicScene) {
    if (scene === this.scene) return;
    this.scene = scene;
    if (this.musicSource) {
      this.musicSource.stop();
      this.musicSource.disconnect();
      this.musicSource = null;
    }
    this.sync();
  }

  // Only called in response to a user gesture; restoring preferences cannot autoplay.
  unlock() {
    if (!this.visible || (!this.preferences.effects && !this.preferences.music)) return;
    try {
      if (!this.context) {
        this.context = this.createContext();
        this.effectsGain = this.context.createGain();
        this.musicGain = this.context.createGain();
        this.effectsGain.connect(this.context.destination);
        this.musicGain.connect(this.context.destination);
      }
      this.sync();
    } catch {
      // Unsupported/restricted audio must never interrupt a poker action.
    }
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.sync();
  }

  playClick() {
    this.unlock();
    const context = this.context;
    if (!context || !this.preferences.effects || !this.visible || context.currentTime - this.lastClick < 0.05) return;
    this.lastClick = context.currentTime;
    this.clickBuffer ??= this.buffer(createClickSamples(context.sampleRate));
    const source = context.createBufferSource();
    source.buffer = this.clickBuffer;
    source.connect(this.effectsGain!);
    source.onended = () => source.disconnect();
    source.start();
  }

  private buffer(samples: Float32Array) {
    const buffer = this.context!.createBuffer(1, samples.length, this.context!.sampleRate);
    buffer.getChannelData(0).set(samples);
    return buffer;
  }

  private sync() {
    const context = this.context;
    if (!context) return;
    this.effectsGain!.gain.value = this.preferences.effects ? 0.6 : 0;
    this.musicGain!.gain.value = this.preferences.music ? 0.45 : 0;
    if (!this.preferences.music && this.musicSource) {
      this.musicSource.stop();
      this.musicSource.disconnect();
      this.musicSource = null;
    } else if (this.preferences.music && !this.musicSource) {
      this.musicBuffers[this.scene] ??= this.buffer(createMusicSamples(context.sampleRate, this.scene));
      this.musicSource = context.createBufferSource();
      this.musicSource.buffer = this.musicBuffers[this.scene]!;
      this.musicSource.loop = true;
      this.musicSource.connect(this.musicGain!);
      this.musicSource.start();
    }
    const shouldPlay = this.visible && (this.preferences.music || this.preferences.effects);
    if (shouldPlay && context.state !== "running") void context.resume().catch(() => {});
    if (!shouldPlay && context.state === "running") void context.suspend().catch(() => {});
  }

  dispose() {
    this.musicSource?.stop();
    this.musicSource?.disconnect();
    this.musicSource = null;
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }
}
