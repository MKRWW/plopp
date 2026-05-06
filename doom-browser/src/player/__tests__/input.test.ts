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
