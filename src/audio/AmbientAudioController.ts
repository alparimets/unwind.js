export class AmbientAudioController {
  private audioContext: AudioContext | undefined;
  private masterGain: GainNode | undefined;
  private interactionGain: GainNode | undefined;
  private enabled = false;
  private readonly pentatonicNotes = [523.25, 587.33, 659.25, 783.99, 880];

  get isEnabled(): boolean {
    return this.enabled;
  }

  async toggle(): Promise<boolean> {
    if (!this.audioContext) {
      this.createAudioGraph();
    }

    const audioContext = this.audioContext;
    const masterGain = this.masterGain;
    const interactionGain = this.interactionGain;
    if (!audioContext || !masterGain || !interactionGain) {
      throw new Error('Ambient audio could not be initialized.');
    }

    await audioContext.resume();
    this.enabled = !this.enabled;
    const now = audioContext.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(this.enabled ? 0.035 : 0, now + 1.4);
    interactionGain.gain.cancelScheduledValues(now);
    interactionGain.gain.setValueAtTime(interactionGain.gain.value, now);
    interactionGain.gain.linearRampToValueAtTime(
      this.enabled ? 0.12 : 0,
      now + 0.25,
    );
    return this.enabled;
  }

  async resumeFromGesture(): Promise<void> {
    if (this.enabled && this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async playParticleTone(noteIndex: number, pointerSpeed: number): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const audioContext = this.audioContext;
    const interactionGain = this.interactionGain;
    if (!audioContext || !interactionGain) {
      return;
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    if (!this.enabled || audioContext.state !== 'running') {
      return;
    }

    const speed = Math.min(Math.max(pointerSpeed, 0), 1);
    const frequency =
      this.pentatonicNotes[noteIndex % this.pentatonicNotes.length] *
      (1 + speed * 0.12);
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(
      0.16 + speed * 0.12,
      now + 0.025,
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
    oscillator.connect(envelope);
    envelope.connect(interactionGain);
    oscillator.addEventListener(
      'ended',
      () => {
        oscillator.disconnect();
        envelope.disconnect();
      },
      { once: true },
    );
    oscillator.start(now);
    oscillator.stop(now + 0.5);
  }

  private createAudioGraph(): void {
    const AudioContextConstructor = globalThis.AudioContext;
    if (!AudioContextConstructor) {
      throw new Error('Ambient audio is not supported in this browser.');
    }

    const audioContext = new AudioContextConstructor();
    const masterGain = audioContext.createGain();
    const interactionGain = audioContext.createGain();
    masterGain.gain.value = 0;
    interactionGain.gain.value = 0;
    masterGain.connect(audioContext.destination);
    interactionGain.connect(audioContext.destination);

    for (const [frequency, volume] of [
      [174.61, 0.55],
      [220, 0.32],
      [261.63, 0.16],
    ]) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = volume;
      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start();
    }

    this.audioContext = audioContext;
    this.masterGain = masterGain;
    this.interactionGain = interactionGain;
  }
}
