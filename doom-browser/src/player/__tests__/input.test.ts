import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InputHandler } from '../input';

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  (canvas as any).requestPointerLock = vi.fn();
  return canvas;
}

describe('InputHandler - TAB weapon switching', () => {
  let input: InputHandler;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = createMockCanvas();
    input = new InputHandler(canvas);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TAB keydown sets tabPressedOnce', () => {
    const event = new KeyboardEvent('keydown', { code: 'Tab' });
    window.dispatchEvent(event);
    expect(input.getTabPressed()).toBe(true);
  });

  it('Tab consumed after reset', () => {
    const event = new KeyboardEvent('keydown', { code: 'Tab' });
    window.dispatchEvent(event);
    input.resetTabFlag();
    expect(input.getTabPressed()).toBe(false);
  });

  it('Tab preventDefault', () => {
    const event = new KeyboardEvent('keydown', { code: 'Tab' });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});

describe('InputHandler - wheel weapon switching', () => {
  let input: InputHandler;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = createMockCanvas();
    input = new InputHandler(canvas);
    // Simulate pointer lock so wheel events are processed
    (document as any).pointerLockElement = canvas;
    document.dispatchEvent(new Event('pointerlockchange'));
  });

  afterEach(() => {
    (document as any).pointerLockElement = null;
    vi.restoreAllMocks();
  });

  it('Wheel down sets wheelDownFlag', () => {
    const event = new WheelEvent('wheel', { deltaY: 1 });
    canvas.dispatchEvent(event);
    expect(input.getWheelDown()).toBe(true);
    expect(input.getWheelUp()).toBe(false);
  });

  it('Wheel up sets wheelUpFlag', () => {
    const event = new WheelEvent('wheel', { deltaY: -1 });
    canvas.dispatchEvent(event);
    expect(input.getWheelUp()).toBe(true);
    expect(input.getWheelDown()).toBe(false);
  });

  it('Wheel flags reset', () => {
    const eventDown = new WheelEvent('wheel', { deltaY: 1 });
    canvas.dispatchEvent(eventDown);
    const eventUp = new WheelEvent('wheel', { deltaY: -1 });
    canvas.dispatchEvent(eventUp);
    input.resetWheelFlags();
    expect(input.getWheelDown()).toBe(false);
    expect(input.getWheelUp()).toBe(false);
  });

  it('Wheel preventDefault', () => {
    const event = new WheelEvent('wheel', { deltaY: 1 });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    canvas.dispatchEvent(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});

describe('InputHandler - dispose (C2 fix)', () => {
  let input: InputHandler;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = createMockCanvas();
    (canvas as any).requestPointerLock = vi.fn();
    input = new InputHandler(canvas);
  });

  afterEach(() => {
    // Cleanup: remove all listeners to prevent test pollution
    input.dispose();
    (document as any).pointerLockElement = null;
    vi.restoreAllMocks();
  });

  it('dispose removes all event listeners - keydown no longer fires', () => {
    input.dispose();
    let triggered = false;
    // Register a fresh listener to detect if the disposed one still fires
    window.addEventListener('keydown', () => { triggered = true; }, true);
    const event = new KeyboardEvent('keydown', { code: 'Tab' });
    window.dispatchEvent(event);
    // The fresh listener fires, but input's disposed listener should not
    expect(input.getTabPressed()).toBe(false);
  });

  it('dispose is idempotent - calling twice does not throw', () => {
    expect(() => {
      input.dispose();
      input.dispose();
    }).not.toThrow();
  });

  it('dispose removes pointerlockchange listener', () => {
    // Simulate pointer lock before dispose
    (document as any).pointerLockElement = canvas;
    document.dispatchEvent(new Event('pointerlockchange'));
    expect(input.getPointerLocked()).toBe(true);

    input.dispose();

    // After dispose, pointerlockchange should not update isPointerLocked
    (document as any).pointerLockElement = null;
    document.dispatchEvent(new Event('pointerlockchange'));
    // isPointerLocked should still be true since listener was removed
    expect(input.getPointerLocked()).toBe(true);
  });

  it('dispose removes mousemove listener', () => {
    (document as any).pointerLockElement = canvas;
    document.dispatchEvent(new Event('pointerlockchange'));

    input.dispose();

    // Simulate mouse movement after dispose
    const mouseEvent = new MouseEvent('mousemove', { movementX: 10, movementY: 5 });
    document.dispatchEvent(mouseEvent);
    // Delta should remain 0 since listener was removed
    const delta = input.getMouseDelta();
    expect(delta.dx).toBe(0);
    expect(delta.dy).toBe(0);
  });

  it('dispose removes wheel listener', () => {
    (document as any).pointerLockElement = canvas;
    document.dispatchEvent(new Event('pointerlockchange'));

    input.dispose();

    const event = new WheelEvent('wheel', { deltaY: 1 });
    canvas.dispatchEvent(event);
    expect(input.getWheelDown()).toBe(false);
  });
});
