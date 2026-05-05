import { JSDOM } from 'jsdom';
import { Canvas, Image, ImageData } from 'canvas';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

global.window = dom.window as unknown as typeof window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.CanvasRenderingContext2D = dom.window.CanvasRenderingContext2D as unknown as typeof CanvasRenderingContext2D;
global.AudioContext = class AudioContext {
  sampleRate = 44100;
  state = 'closed';
  createGain() { return { gain: { value: 0.3 }, connect() {} }; }
  createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: 'lowpass', frequency: { value: 400 }, Q: { value: 1 }, connect() {} }; }
  createOscillator() { return { type: 'sine', frequency: { value: 440, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
  destination = null;
  currentTime = 0;
  resume() { this.state = 'running'; return Promise.resolve(); }
} as unknown as typeof AudioContext;
global.HTMLAudioElement = class HTMLAudioElement {
  loop = false;
  volume = 0.3;
  src = '';
  preload = '';
  addEventListener() {}
  play() { return Promise.resolve(); }
  pause() {}
  load() {}
} as unknown as typeof HTMLAudioElement;
global.performance = {
  now: () => Date.now(),
} as unknown as Performance;

global.HTMLCanvasElement = Canvas as unknown as typeof HTMLCanvasElement;
global.Image = Image as unknown as typeof Image;
global.ImageData = ImageData as unknown as typeof ImageData;

beforeEach(() => {
  document.body.innerHTML = '';
});
