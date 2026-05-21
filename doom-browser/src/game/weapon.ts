/**
 * Waffe-Animaton-State für Doom-Browser-Clone.
 * Handled nur Animation: Bobbing, Recoil, Muzzle Flash.
 * Munition und Gesundheit werden über WeaponInventory / Player verwaltet.
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
 * Weapon animation state holder. No health/ammo — those are in Player/WeaponInventory.
 */
export class Weapon {
  public state: WeaponState = WeaponState.IDLE;

  // Animation
  private bobPhase: number = 0;        // Für Walking-Bobbing
  private fireTimer: number = 0;       // Feuer-Animation-Timer
  private bobSpeed: number = 8.0;      // Bobbing-Frequenz

  // Recoil
  private recoilY: number = 0;         // Nach oben zucken
  private recoilX: number = 0;         // Leichte seitliche Abweichung
  private recoilRecovering: boolean = false;
  public targetRecoilY: number = -25;
  public recoilXSpread: number = 5;

  // Muzzle Flash Randomness
  public flashOffsetX: number = 0;
  public flashOffsetY: number = 0;
  public flashScale: number = 1.0;

  // Hit-Counter
  public hitCount: number = 0;

  /**
   * Trigger the weapon animation state for a shot.
   * Called by renderer after checking inventory canFire.
   */
  public triggerFire(fireDuration: number, recoilY: number, recoilXSpread: number): void {
    this.state = WeaponState.FIRING;
    this.fireTimer = fireDuration;

    this.targetRecoilY = recoilY;
    this.recoilY = recoilY;
    this.recoilX = (Math.random() - 0.5) * recoilXSpread;
    this.recoilXSpread = recoilXSpread;
    this.recoilRecovering = true;

    this.flashOffsetX = (Math.random() - 0.5) * 12;
    this.flashOffsetY = (Math.random() - 0.5) * 8;
    this.flashScale = 1.0 + Math.random() * 0.6;
  }

  /**
   * Update der Waffe mit Delta-Time.
   */
  public update(deltaTime: number, isMoving: boolean): void {
    if (isMoving) {
      this.bobPhase += deltaTime * this.bobSpeed;
    } else {
      this.bobPhase *= 0.9;
    }

    if (this.state === WeaponState.FIRING) {
      this.fireTimer -= deltaTime;
      if (this.fireTimer <= 0) {
        this.state = WeaponState.IDLE;
        this.fireTimer = 0;
      }
    }

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
  }

  public getBobOffset(): number {
    return Math.sin(this.bobPhase) * 5;
  }

  public getBobXOffset(): number {
    return Math.cos(this.bobPhase * 0.5) * 3;
  }

  public getRecoilY(): number {
    return this.recoilY;
  }

  public getRecoilX(): number {
    return this.recoilX;
  }

  /**
   * Reset animation state only.
   */
  public reset(): void {
    this.state = WeaponState.IDLE;
    this.bobPhase = 0;
    this.fireTimer = 0;
    this.recoilY = 0;
    this.recoilX = 0;
    this.recoilRecovering = false;
    this.flashOffsetX = 0;
    this.flashOffsetY = 0;
    this.flashScale = 1.0;
  }
}