/**
 * Z-Buffer für Sprite-Tiefentest.
 * Speichert die Wandtiefe pro Bildschirmspalte.
 */
export class ZBuffer {
  public buffer: Float32Array;

  constructor(width: number) {
    this.buffer = new Float32Array(width);
  }

  public set(x: number, value: number): void {
    this.buffer[x] = value;
  }

  public get(x: number): number {
    return this.buffer[x];
  }

  public clear(): void {
    this.buffer.fill(Infinity);
  }
}