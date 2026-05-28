/**
 * Sound-Manager via Web Audio API für Plopp.
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
  DOOR = 'door',
  ROCKET_SHOOT = 'rocketShoot',
  ROCKET_EXPLOSION = 'rocketExplosion',
  HEARTBEAT = 'heartbeat',
  AMMO_LOW = 'ammoLow',
  // Per-class procedural enemy voices
  HUSK_IDLE = 'huskIdle',
  HUSK_ALERT = 'huskAlert',
  SPITTER_IDLE = 'spitterIdle',
  SPITTER_ALERT = 'spitterAlert',
  LATCHER_IDLE = 'latcherIdle',
  LATCHER_ALERT = 'latcherAlert'
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
  private trackQueue: number[] = [];
  private musicVolume: number = 0.1;

  /**
   * Shuffles track indices using Fisher-Yates and fills the queue.
   */
  private shuffleQueue(): void {
    const arr: number[] = [];
    for (let i = 0; i < MUSIC_FILES.length; i++) arr.push(i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    this.trackQueue = arr;
  }

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
    this.musicAudio = new Audio();
    this.musicAudio.volume = this.musicVolume;
    this.musicAudio.preload = 'auto';

    this.shuffleQueue();
    this.currentTrackIndex = this.trackQueue.pop()!;

    // When track ends, queue the next random track (shuffle-based)
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
    if (this.trackQueue.length === 0) {
      this.shuffleQueue();
    }
    this.currentTrackIndex = this.trackQueue.pop()!;
    this.loadTrack(this.currentTrackIndex);

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
   * @param volume - Gain multiplier (default 1). Applied to all synth gain envelopes.
   */
  public play(soundType: SoundType, volume?: number): void {
    if (!this.enabled || !this.audioContext) return;

    // Wenn Context suspended ist (Browser-Policy), resümiere ihn
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const v = volume ?? 1;

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
      case SoundType.ROCKET_SHOOT:
        this.playRocketShoot();
        break;
      case SoundType.ROCKET_EXPLOSION:
        this.playRocketExplosion();
        break;
      case SoundType.HEARTBEAT:
        this.playHeartbeat();
        break;
      case SoundType.AMMO_LOW:
        this.playAmmoLow();
        break;
      case SoundType.HUSK_IDLE:
        this.playHuskIdle(v);
        break;
      case SoundType.HUSK_ALERT:
        this.playHuskAlert(v);
        break;
      case SoundType.SPITTER_IDLE:
        this.playSpitterIdle(v);
        break;
      case SoundType.SPITTER_ALERT:
        this.playSpitterAlert(v);
        break;
      case SoundType.LATCHER_IDLE:
        this.playLatcherIdle(v);
        break;
      case SoundType.LATCHER_ALERT:
        this.playLatcherAlert(v);
        break;
    }
  }

  /**
   * Distance-attenuated sound playback for enemy voices.
   * Falloff: 1 / (1 + d * 0.1875) so volume ~0.4 at 8 tile distance.
   * Cuts to silence past 12 tiles (AI_AWARENESS_RADIUS * 1.5).
   */
  public playAt(soundType: SoundType, distance: number): void {
    if (!this.enabled || !this.audioContext) return;
    if (distance > 12.0) return; // beyond effective range
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    const volume = 1 / (1 + distance * 0.1875);
    this.play(soundType, volume);
  }

  /**
   * Short high beep warning that the active weapon's ammo is running out.
   * Two short clicks at ~1.2 kHz so it stands out against the rest of the
   * audio bed without being annoying on every shot.
   */
  private playAmmoLow(): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;
    for (let i = 0; i < 2; i++) {
      const start = t + i * 0.09;
      const osc = this.audioContext.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, start);

      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.06);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.07);
    }
  }

  /**
   * Heartbeat thump for the low-health overlay. Single low sine pulse,
   * very brief (~120 ms), small gain so it sits under everything else.
   */
  private playHeartbeat(): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.12);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.13);
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
   * Tür-Öffnungs-Sound (mechanisches "Klick" + tiefer "Hum").
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

  /**
   * Rocket Launcher Schuss (tiefer Whoosh + Knall).
   */
  private playRocketShoot(): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;

    // Tiefer Knall
    const bufferSize = this.audioContext.sampleRate * 0.3;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.25);

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(1.0, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.3);

    // Tiefer Bass-Boom
    const osc = this.audioContext.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.2);

    const oscGain = this.audioContext.createGain();
    oscGain.gain.setValueAtTime(0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.25);

    // Whoosh-Ascender
    const osc2 = this.audioContext.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(80, t);
    osc2.frequency.exponentialRampToValueAtTime(600, t + 0.4);

    const osc2Gain = this.audioContext.createGain();
    osc2Gain.gain.setValueAtTime(0.2, t);
    osc2Gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    osc2.connect(osc2Gain);
    osc2Gain.connect(this.masterGain);
    osc2.start(t);
    osc2.stop(t + 0.5);
  }

  /**
   * Rocket Explosion (massiver Knall + tiefer Rumble).
   */
  private playRocketExplosion(): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;

    // Massiver Noise-Burst (Explosion)
    const bufferSize = this.audioContext.sampleRate * 0.8;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + 0.7);

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(1.2, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.8);

    // Tiefer Rumble
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.6);

    const oscGain = this.audioContext.createGain();
    oscGain.gain.setValueAtTime(0.8, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.7);
  }

  // ---- Per-class procedural enemy voices ----

  /**
   * Husk idle: low growl. Sawtooth 80-120 Hz, slow LFO wobble, ~250 ms.
   */
  private playHuskIdle(volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.linearRampToValueAtTime(80, t + 0.12);
    osc.frequency.linearRampToValueAtTime(110, t + 0.2);
    osc.frequency.linearRampToValueAtTime(85, t + 0.25);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35 * volume, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  /**
   * Husk alert: sharper rising tone, ~400 ms.
   */
  private playHuskAlert(volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.2);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.4);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4 * volume, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.42);
  }

  /**
   * Spitter idle: wet clicking. Short noise bursts, band-pass filtered.
   */
  private playSpitterIdle(volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;
    for (let i = 0; i < 4; i++) {
      const start = t + i * 0.07;
      const bufferSize = this.audioContext.sampleRate * 0.03;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufferSize * 0.2));
      }
      const noise = this.audioContext.createBufferSource();
      noise.buffer = buffer;

      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2000;
      filter.Q.value = 3;

      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(0.3 * volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.03);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(start);
      noise.stop(start + 0.04);
    }
  }

  /**
   * Spitter alert: high chirp + click tail.
   */
  private playSpitterAlert(volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;

    // High chirp
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.15);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3 * volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.16);

    // Click tail
    const bufferSize = this.audioContext.sampleRate * 0.04;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) {
      data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufferSize * 0.15));
    }
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3000;

    const nGain = this.audioContext.createGain();
    nGain.gain.setValueAtTime(0.25 * volume, t + 0.17);
    nGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(t + 0.17);
    noise.stop(t + 0.23);
  }

  /**
   * Latcher idle: skittering. Rapid noise bursts.
   */
  private playLatcherIdle(volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;
    for (let i = 0; i < 8; i++) {
      const start = t + i * 0.025;
      const bufferSize = this.audioContext.sampleRate * 0.015;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufferSize * 0.3));
      }
      const noise = this.audioContext.createBufferSource();
      noise.buffer = buffer;

      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1500 + Math.random() * 2000;

      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(0.15 * volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.015);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(start);
      noise.stop(start + 0.02);
    }
  }

  /**
   * Latcher alert: high-pitch screech, ~200 ms.
   */
  private playLatcherAlert(volume: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const t = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.2);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35 * volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }
}
