/**
 * Textur-Management für das Raycasting-Rendering.
 *
 * Generiert Texturen programmatisch per Canvas (kein externer PNG-Bedarf),
 * wodurch das Spiel sofort funktioniert ohne Asset-Server-Probleme.
 */

/**
 * Größe der Texturen (Potenz von 2 für optimale Performance).
 */
const TEXTURE_SIZE = 128;

/**
 * Interface für eine geladene Textur.
 */
export interface Texture {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  data: ImageData;
}

/**
 * Textur-Manager: Generiert und verwaltet alle Wand-Texturen.
 */
export class TextureManager {
  private textures: Map<number, Texture> = new Map();
  private floorTexture: Texture | null = null;
  private ceilingTexture: Texture | null = null;
  private initialized: boolean = false;

  /**
   * Initialisiert den Textur-Manager und generiert alle Texturen.
   * Wandtyp 1 = Dunkler Stein, Wandtyp 2 = Metall/Gitter,
   * Wandtyp 3 = Exit-Tür, Wandtyp 4 = Blue Key Door, Wandtyp 5 = Secret Wall.
   */
  public initialize(): void {
    if (this.initialized) return;

    this.textures.set(1, this.generateDarkStoneTexture());
    this.textures.set(2, this.generateMetalGrateTexture());
    this.textures.set(3, this.generateExitDoorTexture());
    this.textures.set(4, this.generateBlueKeyDoorTexture());
    this.textures.set(5, this.generateSecretWallTexture());
    this.floorTexture = this.generateFloorTileTexture();
    this.ceilingTexture = this.generateWoodPanelTexture();

    this.initialized = true;
  }

  /**
   * Gibt die Textur für den gegebenen Wandtyp zurück.
   * Falls keine Textur existiert, wird null zurückgegeben (Fallback zu farbigem Rendering).
   */
  public getTexture(wallType: number): Texture | null {
    return this.textures.get(wallType) ?? null;
  }

  /**
   * Gibt die Bodentextur zurueck.
   */
  public getFloorTexture(): Texture | null {
    return this.floorTexture;
  }

  /**
   * Gibt die Deckentextur zurueck.
   */
  public getCeilingTexture(): Texture | null {
    return this.ceilingTexture;
  }

  /**
   * Prüft, ob Textur-Rendering verfügbar ist.
   */
  public isReady(): boolean {
    return this.initialized;
  }

  /**
   * Generiert eine dunkle Stein-/Ziegel-Textur (Wandtyp 1).
   * Doom-Style: dunkle Steine mit Fugen und Riss-Details.
   */
  private generateDarkStoneTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Dunkler Hintergrund
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

    // Stein-Blöcke zeichnen (2 Reihen × 2 Spalten)
    const stoneW = TEXTURE_SIZE / 2;
    const stoneH = TEXTURE_SIZE / 2;
    const mortarW = 3;

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const x = col * stoneW + mortarW;
        const y = row * stoneH + mortarW;
        const w = stoneW - mortarW * 2;
        const h = stoneH - mortarW * 2;

        // Stein-Farbe mit Variation
        const base = 40 + Math.random() * 25;
        const r = base + Math.random() * 10;
        const g = base + Math.random() * 5;
        const b = base - Math.random() * 5;

        // Stein-Füllung
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, w, h);

        // Stein-Textur: feine Risse und Unebenheiten
        for (let i = 0; i < 15; i++) {
          const cx = x + Math.random() * w;
          const cy = y + Math.random() * h;
          const cw = 2 + Math.random() * 8;
          const ch = 1 + Math.random() * 3;
          const shade = (Math.random() - 0.5) * 20;
          ctx.fillStyle = `rgba(${shade > 0 ? 255 : 0},${shade > 0 ? 255 : 0},${shade > 0 ? 255 : 0},${Math.abs(shade) / 100})`;
          ctx.fillRect(cx, cy, cw, ch);
        }

        // Leichte Schatten an den Kanten (3D-Effekt)
        const shadowGrad = ctx.createLinearGradient(x, y, x + 4, y);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.3)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(x, y, 4, h);

        const highlightGrad = ctx.createLinearGradient(x + w, y, x + w - 4, y);
        highlightGrad.addColorStop(0, 'rgba(0,0,0,0.3)');
        highlightGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = highlightGrad;
        ctx.fillRect(x + w - 4, y, 4, h);
      }

      // Horizontale Fuge
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, (row + 1) * stoneH - 1, TEXTURE_SIZE, mortarW);
    }

    // Vertikale Fuge (Mitte)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(TEXTURE_SIZE / 2 - 1, 0, mortarW, TEXTURE_SIZE);

    // Gesamtes Rauschen für Realismus
    const imageData = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 15;
      imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
      imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
      imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    return {
      canvas,
      width: TEXTURE_SIZE,
      height: TEXTURE_SIZE,
      data: ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    };
  }

  /**
   * Generiert eine Metall-/Gitter-Textur (Wandtyp 2).
   * Doom-Style: rostiges Metall mit Nieten und Rillen.
   */
  private generateMetalGrateTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Metall-Basis
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

    // Horizontale Metall-Rillen
    for (let y = 0; y < TEXTURE_SIZE; y += 8) {
      const shade = 55 + Math.sin(y * 0.3) * 10 + Math.random() * 8;
      ctx.fillStyle = `rgb(${shade},${shade},${shade + 2})`;
      ctx.fillRect(0, y, TEXTURE_SIZE, 6);

      // Rille (dunkel)
      ctx.fillStyle = '#333';
      ctx.fillRect(0, y + 6, TEXTURE_SIZE, 2);
    }

    // Vertikale Nieten (4 × 4 Grid)
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const nx = 16 + col * 32;
        const ny = 16 + row * 32;

        // Niet-Schatten
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.arc(nx + 1, ny + 1, 5, 0, Math.PI * 2);
        ctx.fill();

        // Niet-Körper
        const rivetGrad = ctx.createRadialGradient(nx - 1, ny - 1, 0, nx, ny, 5);
        rivetGrad.addColorStop(0, '#888');
        rivetGrad.addColorStop(0.5, '#666');
        rivetGrad.addColorStop(1, '#444');
        ctx.fillStyle = rivetGrad;
        ctx.beginPath();
        ctx.arc(nx, ny, 5, 0, Math.PI * 2);
        ctx.fill();

        // Niet-Highlight
        ctx.fillStyle = 'rgba(200,200,200,0.3)';
        ctx.beginPath();
        ctx.arc(nx - 1, ny - 1, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Rost-Flecken
    for (let i = 0; i < 20; i++) {
      const rx = Math.random() * TEXTURE_SIZE;
      const ry = Math.random() * TEXTURE_SIZE;
      const rr = 2 + Math.random() * 8;
      const rustGrad = ctx.createRadialGradient(rx, ry, 0, rx, ry, rr);
      rustGrad.addColorStop(0, 'rgba(139, 69, 19, 0.4)');
      rustGrad.addColorStop(1, 'rgba(139, 69, 19, 0)');
      ctx.fillStyle = rustGrad;
      ctx.beginPath();
      ctx.arc(rx, ry, rr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Gesamtes Rauschen
    const imageData = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 12;
      imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
      imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
      imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    return {
      canvas,
      width: TEXTURE_SIZE,
      height: TEXTURE_SIZE,
      data: ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    };
  }

  /**
   * Generiert eine graue Fliesentextur fuer den Boden.
   * Klare Fugen und leichte Schmutzflecken helfen bei der Bewegung im Raum.
   */
  private generateFloorTileTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d')!;

    const tileSize = 32;
    const grout = 3;

    ctx.fillStyle = '#222426';
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

    for (let y = 0; y < TEXTURE_SIZE; y += tileSize) {
      for (let x = 0; x < TEXTURE_SIZE; x += tileSize) {
        const offset = ((x / tileSize + y / tileSize) % 2) * 8;
        const base = 76 + offset + Math.random() * 14;
        const tileGrad = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
        tileGrad.addColorStop(0, `rgb(${base + 16},${base + 15},${base + 12})`);
        tileGrad.addColorStop(0.55, `rgb(${base},${base},${base - 2})`);
        tileGrad.addColorStop(1, `rgb(${base - 18},${base - 17},${base - 15})`);

        ctx.fillStyle = tileGrad;
        ctx.fillRect(x + grout, y + grout, tileSize - grout * 2, tileSize - grout * 2);

        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeRect(x + grout + 1, y + grout + 1, tileSize - grout * 2 - 2, tileSize - grout * 2 - 2);

        ctx.strokeStyle = 'rgba(0,0,0,0.24)';
        ctx.strokeRect(x + grout, y + grout, tileSize - grout * 2, tileSize - grout * 2);

        for (let i = 0; i < 7; i++) {
          const speckX = x + grout + Math.random() * (tileSize - grout * 2);
          const speckY = y + grout + Math.random() * (tileSize - grout * 2);
          const speckSize = 1 + Math.random() * 2;
          const alpha = 0.08 + Math.random() * 0.16;
          ctx.fillStyle = Math.random() > 0.5
            ? `rgba(255,255,255,${alpha})`
            : `rgba(0,0,0,${alpha})`;
          ctx.fillRect(speckX, speckY, speckSize, speckSize);
        }
      }
    }

    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    for (let i = 0; i <= TEXTURE_SIZE; i += tileSize) {
      ctx.fillRect(i - 1, 0, grout, TEXTURE_SIZE);
      ctx.fillRect(0, i - 1, TEXTURE_SIZE, grout);
    }

    const imageData = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 10;
      imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
      imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
      imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    return {
      canvas,
      width: TEXTURE_SIZE,
      height: TEXTURE_SIZE,
      data: ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    };
  }

  /**
   * Generiert eine dunkle Holzpaneeltextur fuer die Decke.
   * Schmale Bretter mit Maserung und Stoessen geben der Decke Richtung.
   */
  private generateWoodPanelTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

    const panelH = 16;
    for (let y = 0; y < TEXTURE_SIZE; y += panelH) {
      const baseR = 70 + Math.random() * 22;
      const baseG = 42 + Math.random() * 12;
      const baseB = 22 + Math.random() * 8;

      const panelGrad = ctx.createLinearGradient(0, y, 0, y + panelH);
      panelGrad.addColorStop(0, `rgb(${baseR + 20},${baseG + 14},${baseB + 8})`);
      panelGrad.addColorStop(0.45, `rgb(${baseR},${baseG},${baseB})`);
      panelGrad.addColorStop(1, `rgb(${baseR - 18},${baseG - 12},${baseB - 7})`);
      ctx.fillStyle = panelGrad;
      ctx.fillRect(0, y + 1, TEXTURE_SIZE, panelH - 2);

      ctx.fillStyle = 'rgba(0,0,0,0.46)';
      ctx.fillRect(0, y, TEXTURE_SIZE, 2);

      ctx.fillStyle = 'rgba(255,220,160,0.10)';
      ctx.fillRect(0, y + 2, TEXTURE_SIZE, 1);

      for (let grain = 0; grain < 8; grain++) {
        const gy = y + 3 + Math.random() * (panelH - 6);
        const amp = 1 + Math.random() * 2;
        ctx.strokeStyle = grain % 3 === 0
          ? 'rgba(255,210,145,0.13)'
          : 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        for (let x = 0; x <= TEXTURE_SIZE; x += 8) {
          ctx.lineTo(x, gy + Math.sin((x + y * 3 + grain * 17) * 0.09) * amp);
        }
        ctx.stroke();
      }

      for (let joint = 32; joint < TEXTURE_SIZE; joint += 32) {
        const stagger = (y / panelH) % 2 === 0 ? 0 : 16;
        const jointX = (joint + stagger) % TEXTURE_SIZE;
        ctx.fillStyle = 'rgba(0,0,0,0.26)';
        ctx.fillRect(jointX, y + 2, 2, panelH - 4);
      }
    }

    for (let i = 0; i < 18; i++) {
      const knotX = Math.random() * TEXTURE_SIZE;
      const knotY = Math.random() * TEXTURE_SIZE;
      const knotW = 4 + Math.random() * 8;
      const knotH = 2 + Math.random() * 4;
      const knotGrad = ctx.createRadialGradient(knotX, knotY, 0, knotX, knotY, knotW);
      knotGrad.addColorStop(0, 'rgba(36,18,8,0.50)');
      knotGrad.addColorStop(1, 'rgba(36,18,8,0)');
      ctx.fillStyle = knotGrad;
      ctx.beginPath();
      ctx.ellipse(knotX, knotY, knotW, knotH, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const imageData = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 9;
      imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
      imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
      imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    return {
      canvas,
      width: TEXTURE_SIZE,
      height: TEXTURE_SIZE,
      data: ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    };
  }

  /**
   * Generiert eine Exit-Tür-Textur (Wandtyp 3).
   * Sci-Fi Metalltür mit gelben Warnstreifen und "EXIT"-Markierung.
   */
  private generateExitDoorTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Metall-Basis (dunkelgrau)
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

    // Tür-Rahmen (heller)
    ctx.fillStyle = '#555';
    ctx.fillRect(4, 4, TEXTURE_SIZE - 8, TEXTURE_SIZE - 8);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(8, 8, TEXTURE_SIZE - 16, TEXTURE_SIZE - 16);

    // Gelbe Warnstreifen (diagonal)
    ctx.fillStyle = '#cc0';
    for (let i = -4; i < 5; i++) {
      const offset = i * 20;
      ctx.save();
      ctx.beginPath();
      ctx.rect(8, 8, TEXTURE_SIZE - 16, TEXTURE_SIZE - 16);
      ctx.clip();
      ctx.translate(offset, 0);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#cc0';
      ctx.fillRect(-TEXTURE_SIZE, TEXTURE_SIZE / 2 - 6, TEXTURE_SIZE * 2, 4);
      ctx.restore();
    }

    // "EXIT" Text in der Mitte
    ctx.fillStyle = '#f00';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#f00';
    ctx.shadowBlur = 10;
    ctx.fillText('EXIT', TEXTURE_SIZE / 2, TEXTURE_SIZE / 2);
    ctx.shadowBlur = 0;

    // Roter Rahmen um EXIT
    ctx.strokeStyle = '#f00';
    ctx.lineWidth = 2;
    ctx.strokeRect(TEXTURE_SIZE / 2 - 48, TEXTURE_SIZE / 2 - 20, 96, 40);

    // Noise
    const imageData = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 10;
      imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
      imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
      imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    return {
      canvas,
      width: TEXTURE_SIZE,
      height: TEXTURE_SIZE,
      data: ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    };
  }

  /**
   * Generiert eine Blue Key Door Textur (Wandtyp 4).
   * Sci-Fi Metalltür mit blauem Leuchten und Keycard-Symbol.
   */
  private generateBlueKeyDoorTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Dunkler Metall-Basis
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

    // Tür-Rahmen
    ctx.fillStyle = '#4a4a5a';
    ctx.fillRect(4, 4, TEXTURE_SIZE - 8, TEXTURE_SIZE - 8);
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(8, 8, TEXTURE_SIZE - 16, TEXTURE_SIZE - 16);

    // Blaues Leuchten (Keycard-Erkennung)
    const glowGrad = ctx.createRadialGradient(
      TEXTURE_SIZE / 2, TEXTURE_SIZE / 2, 4,
      TEXTURE_SIZE / 2, TEXTURE_SIZE / 2, 40
    );
    glowGrad.addColorStop(0, 'rgba(50, 100, 255, 0.5)');
    glowGrad.addColorStop(0.5, 'rgba(50, 100, 255, 0.2)');
    glowGrad.addColorStop(1, 'rgba(50, 100, 255, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(8, 8, TEXTURE_SIZE - 16, TEXTURE_SIZE - 16);

    // Keycard-Slot (kleiner Schlitz)
    ctx.fillStyle = '#111';
    ctx.fillRect(TEXTURE_SIZE / 2 - 12, TEXTURE_SIZE / 2 + 10, 24, 6);
    ctx.fillStyle = '#33f';
    ctx.fillRect(TEXTURE_SIZE / 2 - 10, TEXTURE_SIZE / 2 + 11, 20, 4);

    // "KEY" Text
    ctx.fillStyle = '#5af';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#5af';
    ctx.shadowBlur = 8;
    ctx.fillText('KEY', TEXTURE_SIZE / 2, TEXTURE_SIZE / 2 - 10);
    ctx.shadowBlur = 0;

    // Rauschen
    const imageData = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 10;
      imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
      imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
      imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    return {
      canvas,
      width: TEXTURE_SIZE,
      height: TEXTURE_SIZE,
      data: ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    };
  }

  /**
   * Generiert eine Secret Wall Textur (Wandtyp 5).
   * Sieht aus wie normale Steinwand (Typ 1), aber mit subtiler dunklerer Textur
   * und kaum sichtbaren Rissen — nur beim genau Hinschauen erkennbar.
   */
  private generateSecretWallTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Dunklerer Stein-Hintergrund (leicht anders als Typ 1)
    ctx.fillStyle = '#252525';
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

    // Stein-Blöcke (ähnlich wie Typ 1, aber dunkler)
    const stoneW = TEXTURE_SIZE / 2;
    const stoneH = TEXTURE_SIZE / 2;
    const mortarW = 3;

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const x = col * stoneW + mortarW;
        const y = row * stoneH + mortarW;
        const w = stoneW - mortarW * 2;
        const h = stoneH - mortarW * 2;

        // Etwas dunkler als normale Steinwand
        const base = 30 + Math.random() * 15;
        const r = base + Math.random() * 8;
        const g = base + Math.random() * 5;
        const b = base - Math.random() * 3;

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, w, h);

        // Feine Risse
        for (let i = 0; i < 10; i++) {
          const cx = x + Math.random() * w;
          const cy = y + Math.random() * h;
          const cw = 2 + Math.random() * 6;
          const ch = 1 + Math.random() * 2;
          const shade = (Math.random() - 0.5) * 15;
          ctx.fillStyle = `rgba(${shade > 0 ? 255 : 0},${shade > 0 ? 255 : 0},${shade > 0 ? 255 : 0},${Math.abs(shade) / 100})`;
          ctx.fillRect(cx, cy, cw, ch);
        }

        // Schatten an Kanten
        const shadowGrad = ctx.createLinearGradient(x, y, x + 4, y);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.35)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(x, y, 4, h);

        const highlightGrad = ctx.createLinearGradient(x + w, y, x + w - 4, y);
        highlightGrad.addColorStop(0, 'rgba(0,0,0,0.35)');
        highlightGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = highlightGrad;
        ctx.fillRect(x + w - 4, y, 4, h);
      }
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, (row + 1) * stoneH - 1, TEXTURE_SIZE, mortarW);
    }
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(TEXTURE_SIZE / 2 - 1, 0, mortarW, TEXTURE_SIZE);

    // Subtile "geheime" Markierung: kaum sichtbare Kreise
    ctx.fillStyle = 'rgba(40, 60, 40, 0.08)';
    ctx.beginPath();
    ctx.arc(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2, 20, 0, Math.PI * 2);
    ctx.fill();

    // Rauschen
    const imageData = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 12;
      imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
      imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
      imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    return {
      canvas,
      width: TEXTURE_SIZE,
      height: TEXTURE_SIZE,
      data: ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    };
  }
}
