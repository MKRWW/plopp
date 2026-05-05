/**
 * Waffe-System für Doom-Browser-Clone.
 * Handled Waffe-Rendering, Animation (Bobbing, Schuss), und Munitions-Verwaltung.
 */

/**
 * Waffe-States.
 */
export enum WeaponState {
  IDLE = 'idle',           // Ruhend
  FIRING = 'firing',       // Schießend (Muzzle Flash)
  RELOADING = 'reloading'  // Nachladen
}

/**
 * Waffe-Konfiguration.
 */
export class Weapon {
  public state: WeaponState = WeaponState.IDLE;
  public ammo: number = 50;
  public maxAmmo: number = 200;
  public health: number = 100;
  public maxHealth: number = 100;
  
  // Animation
  private bobPhase: number = 0;        // Für Walking-Bobbing
  private fireTimer: number = 0;       // Feuer-Animation-Timer
  private fireDuration: number = 0.15; // 150ms Muzzle Flash
  private bobSpeed: number = 8.0;      // Bobbing-Frequenz

  // Recoil
  private recoilY: number = 0;         // Nach oben zucken
  private recoilX: number = 0;         // Leichte seitliche Abweichung
  private recoilRecovering: boolean = false;

  // Muzzle Flash Randomness
  public flashOffsetX: number = 0;
  public flashOffsetY: number = 0;
  public flashScale: number = 1.0;

  // Hit-Counter (für Damage-Anzeige)
  public hitCount: number = 0;
  public killCount: number = 0;

  // Nächster Schuss möglich?
  private canFire: boolean = true;
  private fireCooldown: number = 0;
  private fireCooldownDuration: number = 0.2; // 200ms zwischen Schüssen

  /**
   * Feuert die Waffe.
   * @returns true wenn Schuss erfolgreich, false wenn keine Munition oder Cooldown
   */
  public fire(): boolean {
    if (this.ammo <= 0 || !this.canFire) {
      return false;
    }

    this.ammo--;
    this.state = WeaponState.FIRING;
    this.fireTimer = this.fireDuration;
    this.canFire = false;
    this.fireCooldown = this.fireCooldownDuration;

    // Recoil: Waffe nach oben/hinten zucken
    this.recoilY = -25;
    this.recoilX = (Math.random() - 0.5) * 10;
    this.recoilRecovering = true;

    // Muzzle Flash: zufällige Variation pro Schuss
    this.flashOffsetX = (Math.random() - 0.5) * 12;
    this.flashOffsetY = (Math.random() - 0.5) * 8;
    this.flashScale = 1.0 + Math.random() * 0.6; // 1.0 - 1.6x

    return true;
  }

  /**
   * Fügt Munition hinzu (Item-Pickup).
   */
  public addAmmo(amount: number): void {
    this.ammo = Math.min(this.maxAmmo, this.ammo + amount);
  }

  /**
   * Heilt den Spieler (Item-Pickup).
   */
  public addHealth(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  /**
   * Fügt Schaden zu.
   */
  public takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.hitCount++;
  }

  /**
   * Update der Waffe mit Delta-Time.
   */
  public update(deltaTime: number, isMoving: boolean): void {
    // Bobbing-Animation während Bewegung
    if (isMoving) {
      this.bobPhase += deltaTime * this.bobSpeed;
    } else {
      // Langsam zurück zum neutralen Zustand
      this.bobPhase *= 0.9;
    }

    // Feuer-Animation Timer
    if (this.state === WeaponState.FIRING) {
      this.fireTimer -= deltaTime;
      if (this.fireTimer <= 0) {
        this.state = WeaponState.IDLE;
        this.fireTimer = 0;
      }
    }

    // Recoil: smooth zurück zum Ursprung
    if (this.recoilRecovering) {
      const recoilSpeed = 12.0;
      this.recoilY += (0 - this.recoilY) * Math.min(1, deltaTime * recoilSpeed);
      this.recoilX += (0 - this.recoilX) * Math.min(1, deltaTime * recoilSpeed);
      if (Math.abs(this.recoilY) < 0.5 && Math.abs(this.recoilX) < 0.5) {
        this.recoilY = 0;
        this.recoilX = 0;
        this.recoilRecovering = false;
      }
    }

    // Cooldown für nächsten Schuss
    if (!this.canFire) {
      this.fireCooldown -= deltaTime;
      if (this.fireCooldown <= 0) {
        this.canFire = true;
        this.fireCooldown = 0;
      }
    }
  }

  /**
   * Gibt die Bobbing-Y-Position für die Waffe zurück.
   */
  public getBobOffset(): number {
    return Math.sin(this.bobPhase) * 5;
  }

  /**
   * Gibt die Bobbing-X-Position für die Waffe zurück.
   */
  public getBobXOffset(): number {
    return Math.cos(this.bobPhase * 0.5) * 3;
  }

  /**
   * Gibt den Recoil-Offset (Y) zurück.
   */
  public getRecoilY(): number {
    return this.recoilY;
  }

  /**
   * Gibt den Recoil-Offset (X) zurück.
   */
  public getRecoilX(): number {
    return this.recoilX;
  }

  /**
   * Überprüft ob der Spieler tot ist.
   */
  public isDead(): boolean {
    return this.health <= 0;
  }

  /**
   * Reset der Waffe auf Start-Werte (für Respawn/Neustart).
   */
  public reset(): void {
    this.health = this.maxHealth;
    this.ammo = 50;
    this.killCount = 0;
    this.hitCount = 0;
    this.state = WeaponState.IDLE;
    this.bobPhase = 0;
    this.fireTimer = 0;
    this.canFire = true;
    this.fireCooldown = 0;
    this.recoilY = 0;
    this.recoilX = 0;
    this.recoilRecovering = false;
    this.flashOffsetX = 0;
    this.flashOffsetY = 0;
    this.flashScale = 1.0;
  }
}