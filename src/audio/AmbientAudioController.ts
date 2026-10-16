export class AmbientAudioController {
  private audioContext: AudioContext | undefined;
  private masterGain: GainNode | undefined;
  private enabled = false;

  get isEnabled(): boolean {
    return this.enabled;
  }

  async toggle(): Promise<boolean> {
    if (!this.audioContext) {
      this.createAudioGraph();
    }

    const audioContext = this.audioContext;
    const masterGain = this.masterGain;
    if (!audioContext || !masterGain) {
      throw new Error('Ambient audio could not be initialized.');
    }

    await audioContext.resume();
    this.enabled = !this.enabled;
    const now = audioContext.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(this.enabled ? 0.035 : 0, now + 1.4);
    return this.enabled;
  }

  private createAudioGraph(): void {
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) {
      throw new Error('Ambient audio is not supported in this browser.');
    }

    const audioContext = new AudioContextConstructor();
    const masterGain = audioContext.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(audioContext.destination);

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
  }
}
