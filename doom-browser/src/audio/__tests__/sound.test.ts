import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SoundManager } from '../sound';

describe('SoundManager - init (C4 fix)', () => {
  let sound: SoundManager;

  beforeEach(() => {
    sound = new SoundManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('init is idempotent - calling twice does not throw', () => {
    expect(() => {
      sound.init();
      sound.init();
    }).not.toThrow();
  });

  it('init handles missing AudioContext gracefully without throwing', () => {
    // Mock window.AudioContext to be undefined to simulate unsupported environment
    const originalAudioContext = (window as any).AudioContext;
    (window as any).AudioContext = undefined;
    (window as any).webkitAudioContext = undefined;

    expect(() => {
      sound.init();
    }).not.toThrow();

    // Restore
    (window as any).AudioContext = originalAudioContext;
  });

  it('init succeeds when AudioContext is available', () => {
    // In jsdom, AudioContext should be available
    sound.init();
    // If init succeeded, the sound manager should be ready (no exception)
    expect(() => sound.play('shoot' as any)).not.toThrow();
  });
});
