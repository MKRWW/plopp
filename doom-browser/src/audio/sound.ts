/**
 * Sound-Manager via Web Audio API für das Doom-Browser-Spiel.
 * Generiert alle Sound-Effekte prozedural (keine externen Dateien nötig).
 * Unterstützt auch Hintergrundmusik aus MP3-Dateien.
 */

/**
 * Sound-Typen die im Spiel vorkommen.
 */
export enum SoundType {
  SHOOT = 'shoot',
  HIT = 'hit',
  ENEMY_DEATH = 'enemyDeath',
  DAMAGE = 'damage',
  PICKUP = 'pickup',
  STEP = 'step',
  DOOR = 'door'
}

/**
 * Liste der verfügbaren Hintergrundmusik-Dateien.
 */
const MUSIC_FILES = [
  'amiroot.mp3',
  'backuptodevnull.mp3',
  'faxtonowhere.mp3',
  'fullduplex.mp3',
  'gimmeyourusernamepassword.mp3',
  'magnetizedtapelibrary.mp3',
  'maythelartbewithyou.mp3',
  'nobootmediumdrivea.mp3',
  'printeronfire.mp3',
  'steroids.mp3',
  'technicianaccident.mp3',
  'tenbaset.mp3'
];

/**
 * Sound-Manager: Erstellt und spielt Sound-Effekte via Web Audio API.
 * Unterstützt auch Hintergrundmusik aus MP3-Dateien.
 */
export class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;

  // Hintergrundmusik
  private musicAudio: HTMLAudioElement | null = null;
  private musicPlaying: boolean = false;
  private currentTrackIndex: number = 0;
  private musicVolume: number = 0.3;

  /**
   * Initialisiert den Audio-Context (muss nach User-Interaktion aufgerufen werden).
   */
  public init(): void {
    if (this.audioContext) return; // Bereits initialisiert

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.3; // Master-Lautstärke
    this.masterGain.connect(this.audioContext.destination);

    // Hintergrundmusik initialisieren
    this.initMusic();
  }

  /**
   * Initialisiert die Hintergrundmusik.
   */
  private initMusic(): void {
    // Zufälligen Track auswählen
    this.currentTrackIndex = Math.floor(Math.random() * MUSIC_FILES.length);

    this.musicAudio = new Audio();
    this.musicAudio.loop = true;
    this.musicAudio.volume = this.musicVolume;
    this.musicAudio.preload = 'auto';

    // Wenn Track zu Ende (sollte nicht passieren wegen loop, aber als Fallback)
    this.musicAudio.addEventListener('ended', () => {
      this.playNextTrack();
    });

    // Track laden
    this.loadTrack(this.currentTrackIndex);
  }

  /**
   * Lädt einen bestimmten Track.
   */
  private loadTrack(index: number): void {
    if (!this.musicAudio) return;
    const filename = MUSIC_FILES[index % MUSIC_FILES.length];
    this.musicAudio.src = `/resources/sound/${filename}`;
    this.musicAudio.load();
  }

  /**
   * Spielt den nächsten Track (zufällig, aber nicht denselben).
   */
  private playNextTrack(): void {
    let newIndex: number;
    do {
      newIndex = Math.floor(Math.random() * MUSIC_FILES.length);
    } while (newIndex === this.currentTrackIndex && MUSIC_FILES.length > 1);

    this.currentTrackIndex = newIndex;
    this.loadTrack(newIndex);

    if (this.musicPlaying) {
      this.musicAudio!.play().catch(() => {});
    }
  }

  /**
   * Startet die Hintergrundmusik.
   */
  public startMusic(): void {
    if (!this.musicAudio || this.musicPlaying) return;
    this.musicPlaying = true;
    this.musicAudio.play().catch(() => {
      // Browser blockiert Autoplay - passiert wenn init() nicht nach User-Interaktion aufgerufen wurde
    });
  }

  /**
   * Stoppt die Hintergrundmusik.
   */
  public stopMusic(): void {
    if (!this.musicAudio || !this.musicPlaying) return;
    this.musicPlaying = false;
    this.musicAudio.pause();
  }

  /**
   * Setzt die Musik-Lautstärke (0.0 - 1.0).
   */
  public setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicAudio) {
      this.musicAudio.volume = this.musicVolume;
    }
  }

  /**
   * Spielt einen Sound-Effekt ab.
   */
  public play(soundType: SoundType): void {
    if (!this.enabled || !this.audioContext) return;

    // Wenn Context suspended ist (Browser-Policy), resümiere ihn
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    switch (soundType) {
      case SoundType.SHOOT:
        this.playShoot();
        break;
      case SoundType.HIT:
        this.playHit();
        break;
      case SoundType.ENEMY_DEATH:
        this.playEnemyDeath();
        break;
      case SoundType.DAMAGE:
        this.playDamage();
        break;
      case SoundType.PICKUP:
        this.playPickup();
        break;
      case SoundType.STEP:
        this.playStep();
        break;
      case SoundType.DOOR:
        this.playDoor();
        break;
    }
  }

  /**
   * Schaltet Sound ein/aus.
   */
  public toggle(): void {
    this.enabled = !this.enabled;
  }

  /**
   * Gibt zurück ob Sound aktiviert ist.
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Prozeduraler Schuss-Sound (Pistole).
   * Kurzer Noise-Burst + tiefer Oszillator.
   */
  private playShoot(): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;

    // Noise-Burst (Schuss-Knall)
    const bufferSize = this.audioContext.sampleRate * 0.15; // 150ms
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    // Bandpass-Filter für Schuss-Charakter
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 0.5;

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.15);

    // Tiefer Oszillator (Bass des Schusses)
    const osc = this.audioContext.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);

    const oscGain = this.audioContext.createGain();
    oscGain.gain.setValueAtTime(0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /**
   * Treffer-Sound (kurzer "Platsch").
   */
  private playHit(): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;

    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.08);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /**
   * Gegner-Tod-Sound (tiefes Krächzen + Noise).
   */
  private playEnemyDeath(): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;

    // Tiefer Oszillator (Krächzen)
    const osc = this.audioContext.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.4);

    const oscGain = this.audioContext.createGain();
    oscGain.gain.setValueAtTime(0.4, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);

    // Noise (Zerfall)
    const bufferSize = this.audioContext.sampleRate * 0.3;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3)) * 0.3;
    }
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.3, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    noise.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.3);
  }

  /**
   * Damage-Sound (roter "Ouch"-Ton).
   */
  private playDamage(): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;

    const osc = this.audioContext.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.15);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /**
   * Item-Pickup-Sound (aufsteigender "Ding").
   */
  private playPickup(): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;

    // Zwei aufsteigende Töne
    const osc1 = this.audioContext.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523, t); // C5
    osc1.frequency.setValueAtTime(784, t + 0.08); // G5

    const gain1 = this.audioContext.createGain();
    gain1.gain.setValueAtTime(0.3, t);
    gain1.gain.setValueAtTime(0.3, t + 0.08);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(t);
    osc1.stop(t + 0.25);
  }

  /**
   * Schritt-Sound (kurzes leises Knistern).
   */
  private playStep(): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;

    // Kurzer Noise-Burst
    const bufferSize = this.audioContext.sampleRate * 0.05; // 50ms
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3)) * 0.15;
    }
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    // Lowpass für dumpfen Schritt-Sound
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.05);
  }

  /**
   * Tür-Öffnungs-Sound (mechanisches "Klick" + tiefes "Hum").
   */
  private playDoor(): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;

    // Mechanisches "Klick" (kurzer Burst)
    const bufferSize = this.audioContext.sampleRate * 0.08;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2)) * 0.4;
    }
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const bandpass = this.audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 800;
    bandpass.Q.value = 1.5;

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    noise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.08);

    // Tiefes "Hum" (Tür öffnet sich)
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.linearRampToValueAtTime(120, t + 0.3);

    const oscGain = this.audioContext.createGain();
    oscGain.gain.setValueAtTime(0.3, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }
}
