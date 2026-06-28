import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).HTMLElement = dom.window.HTMLElement;
(global as any).CanvasRenderingContext2D = dom.window.CanvasRenderingContext2D;
(global as any).AudioContext = class {
  sampleRate = 44100; state = 'closed';
  createGain() { return { gain: { value: 0.3 }, connect() {} }; }
  createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: 'lowpass', frequency: { value: 400 }, Q: { value: 1 }, connect() {} }; }
  createOscillator() { return { type: 'sine', frequency: { value: 440, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
  destination = null; currentTime = 0;
  resume() { this.state = 'running'; return Promise.resolve(); }
};
(global as any).HTMLAudioElement = class {
  loop = false; volume = 0.3; src = ''; preload = '';
  addEventListener() {}; play() { return Promise.resolve(); }; pause() {}; load() {};
};
(global as any).performance = { now: () => Date.now() };

class MockCtx {
  canvas: any;
  fillStyle: any = '';
  strokeStyle: any = '';
  lineWidth = 1;
  lineCap = 'butt';
  font = '';
  textAlign = 'start';
  shadowColor = '';
  shadowBlur = 0;
  globalAlpha = 1;

  constructor(canvas: any) { this.canvas = canvas; }
  clearRect(..._args: any[]) { }
  fillRect(..._args: any[]) { }
  beginPath() { }
  moveTo(..._args: any[]) { }
  lineTo(..._args: any[]) { }
  arc(..._args: any[]) { }
  closePath() { }
  fill() { }
  stroke() { }
  strokeRect(..._args: any[]) { }
  fillText(..._args: any[]) { }
  save() { }
  restore() { }
  translate(..._args: any[]) { }
  rotate(..._args: any[]) { }
  scale(..._args: any[]) { }
  measureText(t: string) { return { width: t.length * 8 }; }
  getImageData(..._args: any[]) { return { data: new Uint8ClampedArray(64 * 64 * 4), width: 64, height: 64 } as any; }
  createImageData(w: number, h: number) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h } as any; }
  putImageData(..._args: any[]) { }
  drawImage(..._args: any[]) { }
  createLinearGradient(..._args: any[]) { return { addColorStop() {} } as any; }
  createRadialGradient(..._args: any[]) { return { addColorStop() {} } as any; }
  setTransform(..._args: any[]) { }
}

const origGetContext = dom.window.HTMLCanvasElement.prototype.getContext;
(dom.window.HTMLCanvasElement.prototype as any).getContext = function(type: string) {
  if (type === '2d') return new MockCtx(this) as any;
  return origGetContext.call(this, type);
};

// Add any missing CanvasRenderingContext2D methods
const proto = MockCtx.prototype as any;
proto.ellipse = function(..._args: any[]) { };
proto.quadraticCurveTo = function(..._args: any[]) { };
proto.bezierCurveTo = function(..._args: any[]) { };
proto.clip = function(..._args: any[]) { };
proto.setLineDash = function(..._args: any[]) { };
proto.createPattern = function(..._args: any[]) { return {} as any; };
proto.drawFocusIfNeeded = function(..._args: any[]) { };
proto.isPointInPath = function(..._args: any[]) { return false; };
proto.isPointInStroke = function(..._args: any[]) { return false; };
proto.resetTransform = function(..._args: any[]) { };
proto.transform = function(..._args: any[]) { };