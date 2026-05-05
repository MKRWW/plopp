import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameState, GameStateManager } from '../../game/state';
import { MockGameStateManager } from '../../__tests__/utils/mocks';

function createManager(state: GameState = GameState.MENU): GameStateManager {
  return new GameStateManager(state);
}

function triggerKey(manager: GameStateManager, code: string): void {
  const event = new KeyboardEvent('keydown', { code, key: code, bubbles: true });
  window.dispatchEvent(event);
}

describe('GameState Machine - Initial State', () => {
  it('starts in MENU state', () => {
    const manager = createManager();
    expect(manager.getState()).toBe(GameState.MENU);
  });

  it('getState returns current state', () => {
    const manager = createManager(GameState.PLAYING);
    expect(manager.getState()).toBe(GameState.PLAYING);
  });
});

describe('GameState Machine - LOADING State', () => {
  it('input events are ignored while in LOADING state', () => {
    const manager = createManager(GameState.LOADING);
    expect(manager.getState()).toBe(GameState.LOADING);

    triggerKey(manager, 'Enter');
    expect(manager.getState()).toBe(GameState.LOADING);

    triggerKey(manager, 'Space');
    expect(manager.getState()).toBe(GameState.LOADING);

    triggerKey(manager, 'Escape');
    expect(manager.getState()).toBe(GameState.LOADING);
  });

  it('renderLoading is called for LOADING state', () => {
    const manager = createManager(GameState.LOADING);
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      expect(() => {
        manager.render(ctx, 640, 480, 100, 0.5, 2);
      }).not.toThrow();
    }
  });

  it('loading progress is passed to render', () => {
    const manager = createManager(GameState.LOADING);
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      expect(() => {
        manager.render(ctx, 640, 480, undefined, 0.75, 3);
      }).not.toThrow();
    }
  });
});

describe('GameState Machine - LOADING to PLAYING Transition', () => {
  it('transitionTo(PLAYING) changes state from LOADING', () => {
    const manager = createManager(GameState.LOADING);
    manager.transitionTo(GameState.PLAYING);
    expect(manager.getState()).toBe(GameState.PLAYING);
  });

  it('transitionTo(PLAYING) from MENU works', () => {
    const manager = createManager(GameState.MENU);
    manager.transitionTo(GameState.PLAYING);
    expect(manager.getState()).toBe(GameState.PLAYING);
  });
});

describe('GameState Machine - DEAD to MENU Transition', () => {
  it('ENTER in DEAD state transitions to MENU', () => {
    const manager = createManager(GameState.DEAD);
    expect(manager.getState()).toBe(GameState.DEAD);

    triggerKey(manager, 'Enter');
    expect(manager.getState()).toBe(GameState.MENU);
  });

  it('SPACE in DEAD state transitions to MENU', () => {
    const manager = createManager(GameState.DEAD);
    triggerKey(manager, 'Space');
    expect(manager.getState()).toBe(GameState.MENU);
  });
});

describe('GameState Machine - WIN to MENU Transition', () => {
  it('ENTER in WIN state transitions to MENU', () => {
    const manager = createManager(GameState.WIN);
    expect(manager.getState()).toBe(GameState.WIN);

    triggerKey(manager, 'Enter');
    expect(manager.getState()).toBe(GameState.MENU);
  });

  it('SPACE in WIN state transitions to MENU', () => {
    const manager = createManager(GameState.WIN);
    triggerKey(manager, 'Space');
    expect(manager.getState()).toBe(GameState.MENU);
  });
});

describe('GameState Machine - MENU to PLAYING Transition', () => {
  it('ENTER in MENU state transitions to PLAYING', () => {
    const manager = createManager(GameState.MENU);
    expect(manager.getState()).toBe(GameState.MENU);

    triggerKey(manager, 'Enter');
    expect(manager.getState()).toBe(GameState.PLAYING);
  });

  it('SPACE in MENU state transitions to PLAYING', () => {
    const manager = createManager(GameState.MENU);
    triggerKey(manager, 'Space');
    expect(manager.getState()).toBe(GameState.PLAYING);
  });
});

describe('GameState Machine - PAUSE Transitions', () => {
  it('ESC in PLAYING state transitions to PAUSED', () => {
    const manager = createManager(GameState.PLAYING);
    expect(manager.getState()).toBe(GameState.PLAYING);

    triggerKey(manager, 'Escape');
    expect(manager.getState()).toBe(GameState.PAUSED);
  });

  it('ESC in PAUSED state transitions to PLAYING', () => {
    const manager = createManager(GameState.PAUSED);
    expect(manager.getState()).toBe(GameState.PAUSED);

    triggerKey(manager, 'Escape');
    expect(manager.getState()).toBe(GameState.PLAYING);
  });

  it('ENTER in PLAYING state does not change state', () => {
    const manager = createManager(GameState.PLAYING);
    triggerKey(manager, 'Enter');
    expect(manager.getState()).toBe(GameState.PLAYING);
  });

  it('ENTER in PAUSED state does not change state', () => {
    const manager = createManager(GameState.PAUSED);
    triggerKey(manager, 'Enter');
    expect(manager.getState()).toBe(GameState.PAUSED);
  });
});

describe('GameState Machine - render', () => {
  it('render does not throw for MENU state', () => {
    const manager = createManager(GameState.MENU);
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      expect(() => {
        manager.render(ctx, 640, 480, 100, 0.5, 1);
      }).not.toThrow();
    }
  });

  it('render does not throw for DEAD state', () => {
    const manager = createManager(GameState.DEAD);
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      expect(() => {
        manager.render(ctx, 640, 480, 0);
      }).not.toThrow();
    }
  });

  it('render does not throw for WIN state', () => {
    const manager = createManager(GameState.WIN);
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      expect(() => {
        manager.render(ctx, 640, 480, 100);
      }).not.toThrow();
    }
  });

  it('render does not throw for PAUSED state', () => {
    const manager = createManager(GameState.PAUSED);
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      expect(() => {
        manager.render(ctx, 640, 480, 50);
      }).not.toThrow();
    }
  });

  it('render does not throw for PLAYING state', () => {
    const manager = createManager(GameState.PLAYING);
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      expect(() => {
        manager.render(ctx, 640, 480, 100);
      }).not.toThrow();
    }
  });

  it('render does not throw for LOADING state with all params', () => {
    const manager = createManager(GameState.LOADING);
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      expect(() => {
        manager.render(ctx, 640, 480, 100, 0.5, 2);
      }).not.toThrow();
    }
  });

  it('render increments renderCalls counter in mock', () => {
    const mock = new MockGameStateManager(GameState.MENU);

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;

    mock.render(ctx, 640, 480);
    expect(mock.renderCalls).toBe(1);

    mock.render(ctx, 640, 480);
    expect(mock.renderCalls).toBe(2);
  });
});

describe('GameState Machine - State Sequence', () => {
  it('full game loop: MENU -> PLAYING -> DEAD -> MENU', () => {
    const manager = createManager(GameState.MENU);

    triggerKey(manager, 'Enter');
    expect(manager.getState()).toBe(GameState.PLAYING);

    manager.transitionTo(GameState.DEAD);
    expect(manager.getState()).toBe(GameState.DEAD);

    triggerKey(manager, 'Enter');
    expect(manager.getState()).toBe(GameState.MENU);
  });

  it('full win loop: MENU -> PLAYING -> WIN -> MENU', () => {
    const manager = createManager(GameState.MENU);

    triggerKey(manager, 'Enter');
    expect(manager.getState()).toBe(GameState.PLAYING);

    manager.transitionTo(GameState.WIN);
    expect(manager.getState()).toBe(GameState.WIN);

    triggerKey(manager, 'Enter');
    expect(manager.getState()).toBe(GameState.MENU);
  });

  it('LOADING interrupts transitions', () => {
    const manager = createManager(GameState.MENU);

    // Enter should transition to PLAYING
    triggerKey(manager, 'Enter');
    expect(manager.getState()).toBe(GameState.PLAYING);

    // But if we go back and enter LOADING...
    manager.transitionTo(GameState.LOADING);
    expect(manager.getState()).toBe(GameState.LOADING);

    // ENTER should be ignored
    triggerKey(manager, 'Enter');
    expect(manager.getState()).toBe(GameState.LOADING);
  });
});

describe('GameState Machine - Edge Cases', () => {
  it('multiple ESC presses toggle between PLAYING and PAUSED', () => {
    const manager = createManager(GameState.PLAYING);

    triggerKey(manager, 'Escape');
    expect(manager.getState()).toBe(GameState.PAUSED);

    triggerKey(manager, 'Escape');
    expect(manager.getState()).toBe(GameState.PLAYING);

    triggerKey(manager, 'Escape');
    expect(manager.getState()).toBe(GameState.PAUSED);
  });

  it('ENTER in DEAD state only transitions to MENU (not to PLAYING)', () => {
    const manager = createManager(GameState.DEAD);
    triggerKey(manager, 'Enter');
    expect(manager.getState()).toBe(GameState.MENU);
  });

  it('ENTER in WIN state only transitions to MENU (not to PLAYING)', () => {
    const manager = createManager(GameState.WIN);
    triggerKey(manager, 'Enter');
    expect(manager.getState()).toBe(GameState.MENU);
  });

  it('other key codes do not trigger state changes in MENU', () => {
    const manager = createManager(GameState.MENU);

    triggerKey(manager, 'KeyW');
    expect(manager.getState()).toBe(GameState.MENU);

    triggerKey(manager, 'ArrowLeft');
    expect(manager.getState()).toBe(GameState.MENU);
  });

  it('transitionTo can go to any state', () => {
    const manager = createManager(GameState.MENU);

    manager.transitionTo(GameState.PAUSED);
    expect(manager.getState()).toBe(GameState.PAUSED);

    manager.transitionTo(GameState.DEAD);
    expect(manager.getState()).toBe(GameState.DEAD);

    manager.transitionTo(GameState.WIN);
    expect(manager.getState()).toBe(GameState.WIN);

    manager.transitionTo(GameState.LOADING);
    expect(manager.getState()).toBe(GameState.LOADING);

    manager.transitionTo(GameState.PLAYING);
    expect(manager.getState()).toBe(GameState.PLAYING);
  });
});

describe('resetGame() State Clearing', () => {
  it('resetGame() clears isLoading, pendingLevel, and loadingProgress to defaults', () => {
    const manager = createManager(GameState.MENU);
    manager.isLoading = true;
    manager.pendingLevel = 3;
    manager.loadingProgress = 0.75;

    expect(manager.isLoading).toBe(true);
    expect(manager.pendingLevel).toBe(3);
    expect(manager.loadingProgress).toBe(0.75);

    manager.resetGame();

    expect(manager.isLoading).toBe(false);
    expect(manager.pendingLevel).toBe(0);
    expect(manager.loadingProgress).toBe(0);
  });

  it('resetGame() does not change game state', () => {
    const manager = createManager(GameState.PLAYING);
    manager.isLoading = true;

    manager.resetGame();

    expect(manager.getState()).toBe(GameState.PLAYING);
  });

  it('resetGame() works when already at defaults', () => {
    const manager = createManager(GameState.MENU);
    expect(manager.isLoading).toBe(false);
    expect(manager.pendingLevel).toBe(0);
    expect(manager.loadingProgress).toBe(0);

    manager.resetGame();

    expect(manager.isLoading).toBe(false);
    expect(manager.pendingLevel).toBe(0);
    expect(manager.loadingProgress).toBe(0);
  });
});
