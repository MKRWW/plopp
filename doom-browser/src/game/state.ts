/**
 * Game State Machine für Plopp.
 * Zustände: MENU → PLAYING → DEAD → WIN → (Rückkehr nach MENU)
 */

/**
 * Mögliche Spielzustände.
 */
export enum GameState {
  MENU = 'menu',
  PLAYING = 'playing',
  PAUSED = 'paused',
  LOADING = 'loading',
  DEAD = 'dead',
  WIN = 'win'
}

/**
 * Game State Manager: Steuert Zustandstransitionen und rendert entsprechende Screens.
 */
export class GameStateManager {
  private state: GameState;
  public isLoading: boolean = false;
  public pendingLevel: number = 0;
  public loadingProgress: number = 0;
  private pointerlockListener: () => void;

  constructor(initialState: GameState = GameState.MENU) {
    this.state = initialState;
    // Enter-Taste: Menu starten / Neustart
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.state === GameState.LOADING) return;
      if (e.code === 'Enter' || e.code === 'Space') {
        if (this.state === GameState.MENU) {
          this.transitionTo(GameState.PLAYING);
        } else if (this.state === GameState.DEAD || this.state === GameState.WIN) {
          this.transitionTo(GameState.MENU);
        }
      }
      // Escape: Pause
      if (e.code === 'Escape' && this.state === GameState.PLAYING) {
        this.transitionTo(GameState.PAUSED);
      } else if (e.code === 'Escape' && this.state === GameState.PAUSED) {
        this.transitionTo(GameState.PLAYING);
      }
    });
    // Pointer lock regained while PAUSED → resume to PLAYING
    this.pointerlockListener = () => {
      if (this.state === GameState.PAUSED && document.pointerLockElement) {
        this.transitionTo(GameState.PLAYING);
      }
    };
    document.addEventListener('pointerlockchange', this.pointerlockListener);
  }

  public getState(): GameState {
    return this.state;
  }

  public transitionTo(newState: GameState): void {
    this.state = newState;
  }

  public resetGame(): void {
    this.isLoading = false;
    this.pendingLevel = 0;
    this.loadingProgress = 0;
    document.removeEventListener('pointerlockchange', this.pointerlockListener);
  }

 /**
    * Render des aktuellen State-Screens.
    */
  public render(ctx: CanvasRenderingContext2D, width: number, height: number, _playerHealth?: number, _loadingProgress?: number, _loadingStage?: number): void {
    switch (this.state) {
      case GameState.MENU:
        this.renderMenu(ctx, width, height);
        break;
      case GameState.DEAD:
        this.renderDead(ctx, width, height);
        break;
      case GameState.WIN:
        this.renderWin(ctx, width, height);
        break;
      case GameState.PAUSED:
        this.renderPaused(ctx, width, height);
        break;
      case GameState.LOADING:
        this.renderLoading(ctx, width, height, _loadingProgress ?? 0, _loadingStage ?? 0);
        break;
      // PLAYING → nichts rendern (Spieler sieht die Welt)
    }
  }

  private renderMenu(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Dunkler Hintergrund
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, w, h);

    // Titel
    ctx.fillStyle = '#cc0000';
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 20;
    ctx.fillText('PLOPP', w / 2, h / 2 - 80);
    ctx.shadowBlur = 0;

    // Blinkender Start-Text
    const blink = Math.floor(Date.now() / 500) % 2;
    if (blink) {
      ctx.fillStyle = '#fff';
      ctx.font = '20px monospace';
      ctx.fillText('Drücke ENTER oder SPACE zum Starten', w / 2, h / 2 + 30);
    }

    // Controls
    ctx.fillStyle = '#777';
    ctx.font = '14px monospace';
    ctx.fillText('WASD = Bewegen  |  Maus = Umschauen  |  SHIFT = Sprint', w / 2, h / 2 + 80);
    ctx.fillText('LINKSKlick = Schießen  |  ESC = Pause', w / 2, h / 2 + 100);
    ctx.fillText('Items einsammeln  |  Töte alle Gegner  |  Finde den Ausgang', w / 2, h / 2 + 120);

    ctx.textAlign = 'left';
  }

  private renderDead(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Roter Overlay
    ctx.fillStyle = 'rgba(120, 0, 0, 0.8)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 56px monospace';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 15;
    ctx.fillText('GEFALLEN', w / 2, h / 2 - 40);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ccc';
    ctx.font = '20px monospace';
    ctx.fillText('Du wurdest von einem Gegner getötet.', w / 2, h / 2 + 10);

    const blink = Math.floor(Date.now() / 500) % 2;
    if (blink) {
      ctx.fillStyle = '#fff';
      ctx.font = '18px monospace';
      ctx.fillText('ENTER für Hauptmenü', w / 2, h / 2 + 60);
    }
    ctx.textAlign = 'left';
  }

  private renderWin(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Grüner Overlay
    ctx.fillStyle = 'rgba(0, 60, 0, 0.8)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#00cc00';
    ctx.font = 'bold 56px monospace';
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 15;
    ctx.fillText('GEWONNEN!', w / 2, h / 2 - 40);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ccc';
    ctx.font = '20px monospace';
    ctx.fillText('Keycard eingesammelt — Exit gefunden!', w / 2, h / 2 + 10);

    const blink = Math.floor(Date.now() / 500) % 2;
    if (blink) {
      ctx.fillStyle = '#fff';
      ctx.font = '18px monospace';
      ctx.fillText('ENTER für Hauptmenü', w / 2, h / 2 + 60);
    }
    ctx.textAlign = 'left';
  }

  private renderPaused(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Halb-transparenter Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px monospace';
    ctx.fillText('PAUSE', w / 2, h / 2 - 20);

    ctx.fillStyle = '#aaa';
    ctx.font = '18px monospace';
    ctx.fillText('ESC zum Fortsetzen', w / 2, h / 2 + 20);
    ctx.textAlign = 'left';
  }

  private renderLoading(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number, stage: number): void {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px monospace';
    ctx.fillText(`STAGE ${stage}`, w / 2, h / 2 - 70);

    const t = (Date.now() / 300) % (Math.PI * 2);
    const spinnerCx = w / 2;
    const spinnerCy = h / 2;
    const spinnerRadius = 32;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(spinnerCx, spinnerCy, spinnerRadius, t, t + 1.8 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = '#aaa';
    ctx.font = '18px monospace';
    const pct = Math.floor(progress * 100);
    ctx.fillText(`Loading… ${pct}%`, w / 2, h / 2 + 60);

    const barW = 220;
    const barH = 10;
    const barX = (w - barW) / 2;
    const barY = h / 2 + 90;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(barX + 1, barY + 1, Math.max(0, (barW - 2) * progress), barH - 2);

    ctx.textAlign = 'left';
  }
}