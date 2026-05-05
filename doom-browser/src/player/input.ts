/**
 * Zentrale Input-Verwaltung für Keyboard, Mouse und Pointer Lock.
 * Trennt Input-Erfassung von Spiel-Logik.
 */

export class InputHandler {
  // Keyboard-Zustände
  private keysPressed: Set<string> = new Set();

  // Mouse-Delta (wird pro Frame zurückgesetzt)
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;

  // Pointer-Lock-Zustand
  private isPointerLocked = false;

  // Sensitivitäts-Einstellung
  public readonly mouseSensitivity: number;

  // Canvas-Referenz für Pointer Lock
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, sensitivity: number = 0.002) {
    this.canvas = canvas;
    this.mouseSensitivity = sensitivity;

    this.setupKeyboard();
    this.setupMouse();
    this.setupPointerLock();
  }

  /**
   * Keyboard-Event-Listener registrieren.
   */
  private setupKeyboard(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Verhindere Standardverhalten für Spieltasten (Scrollen etc.)
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      self.keysPressed.add(e.code);
    }, true); // capture = true

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      self.keysPressed.delete(e.code);
    }, true); // capture = true
  }

  /**
   * Mouse-Event-Listener für Pointer-Lock-Bewegung.
   */
  private setupMouse(): void {
    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.isPointerLocked) {
        // Nur X-Bewegung für Yaw (Horizontal-Rotation)
        this.mouseDeltaX += e.movementX;
        this.mouseDeltaY += e.movementY;
      }
    });
  }

  /**
   * Pointer-Lock-Status-Tracking.
   */
  private setupPointerLock(): void {
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });
  }

  /**
   * Pointer Lock anfordern (nur nach User-Interaktion).
   */
  public requestPointerLock(): void {
    this.canvas.requestPointerLock();
  }

  /**
   * Ob eine Taste gerade gedrückt ist.
   */
  public isKey(code: string): boolean {
    return this.keysPressed.has(code);
  }

  /**
   * Akkumuliertes Mouse-Delta seit dem letzten Reset abrufen.
   * Gibt den Wert in "Rotation-Radiant" umgerechnet zurück.
   */
  public getMouseDelta(): { dx: number; dy: number } {
    return {
      dx: this.mouseDeltaX * this.mouseSensitivity,
      dy: this.mouseDeltaY * this.mouseSensitivity
    };
  }

  /**
   * Mouse-Delta zurücksetzen (nach jedem Frame aufrufen).
   */
  public resetMouseDelta(): void {
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
  }

  /**
   * Pointer-Lock-Status abfragen.
   */
  public getPointerLocked(): boolean {
    return this.isPointerLocked;
  }

  /**
   * Sprint-Taste aktiv? (Shift)
   */
  public isSprinting(): boolean {
    return this.isKey('ShiftLeft') || this.isKey('ShiftRight');
  }

  /**
   * Vorwärts-Bewegung aktiv? (W / PfeilOben)
   */
  public isForward(): boolean {
    return this.isKey('KeyW') || this.isKey('ArrowUp');
  }

  /**
   * Rückwärts-Bewegung aktiv? (S / PfeilUnten)
   */
  public isBackward(): boolean {
    return this.isKey('KeyS') || this.isKey('ArrowDown');
  }

  /**
   * Links-Strafe aktiv? (A / PfeilLinks als Strafe)
   */
  public isStrafeLeft(): boolean {
    return this.isKey('KeyA');
  }

  /**
   * Rechts-Strafe aktiv? (D / PfeilRechts als Strafe)
   */
  public isStrafeRight(): boolean {
    return this.isKey('KeyD');
  }
}

/**
 * Touch-Input-Fallback für mobile Geräte.
 * Aktiviert sich automatisch, wenn Pointer Lock nicht verfügbar.
 */
export class TouchInputHandler {
  private active: boolean = false;
  private leftTouchId: number | null = null;  // Linke Joystick-Zone
  private rightTouchId: number | null = null; // Rechte Rotations-Zone

  // Touch-Start-Positionen für Delta-Berechnung
  private leftStartX = 0;
  private leftStartY = 0;
  private rightStartX = 0;


  // Aktuelle States
  public moveForward = 0;   // -1 bis 1
  public moveStrafe = 0;   // -1 bis 1
  public rotateDelta = 0;  // Radiant

  private sensitivity = 0.005;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setup();
  }

  private setup(): void {
    this.canvas.addEventListener('touchstart', (e: TouchEvent) => this.handleTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e: TouchEvent) => this.handleTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', (e: TouchEvent) => this.handleTouchEnd(e), { passive: false });
    this.canvas.addEventListener('touchcancel', (e: TouchEvent) => this.handleTouchEnd(e), { passive: false });
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    this.active = true;

    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      const x = touch.clientX;
      const halfWidth = this.canvas.clientWidth / 2;

      if (x < halfWidth && this.leftTouchId === null) {
        // Linke Seite: Bewegung
        this.leftTouchId = touch.identifier;
        this.leftStartX = touch.clientX;
        this.leftStartY = touch.clientY;
      } else if (x >= halfWidth && this.rightTouchId === null) {
        // Rechte Seite: Rotation
        this.rightTouchId = touch.identifier;
        this.rightStartX = touch.clientX;
      }
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();

    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];

      if (touch.identifier === this.leftTouchId) {
        // Bewegung: Y-Achse = Vorwärts/Rückwärts, X-Achse = Strafe
        const dy = touch.clientY - this.leftStartY;
        const dx = touch.clientX - this.leftStartX;
        const threshold = 20; // Tothzone

        if (Math.abs(dy) > threshold) {
          this.moveForward = -Math.min(Math.max(dy / 100, -1), 1);
        } else {
          this.moveForward = 0;
        }

        if (Math.abs(dx) > threshold) {
          this.moveStrafe = Math.min(Math.max(dx / 100, -1), 1);
        } else {
          this.moveStrafe = 0;
        }
      }

      if (touch.identifier === this.rightTouchId) {
        // Rotation
        const dx = touch.clientX - this.rightStartX;
        this.rotateDelta = dx * this.sensitivity;
        this.rightStartX = touch.clientX; // Reset für kontinuierliche Rotation
      }
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      if (touch.identifier === this.leftTouchId) {
        this.leftTouchId = null;
        this.moveForward = 0;
        this.moveStrafe = 0;
      }

      if (touch.identifier === this.rightTouchId) {
        this.rightTouchId = null;
        this.rotateDelta = 0;
      }
    }
  }

  public resetDelta(): void {
    // rotateDelta wird in handleTouchMove bereits pro Touch-Event berechnet,
    // hier nur auf 0 setzen falls kein Touch aktiv
    if (this.rightTouchId === null) {
      this.rotateDelta = 0;
    }
  }

  public isActive(): boolean {
    return this.active;
  }
}

/**
 * Feature-Detection: Pointer Lock unterstützt?
 */
export function pointerLockSupported(): boolean {
  return typeof document !== 'undefined' && 'pointerLockElement' in document;
}