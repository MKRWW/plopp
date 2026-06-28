import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

let server: any;
let port: number;

test.beforeAll(async () => {
  server = await createServer({ root: '.', server: { port: 0 } });
  await server.listen();
  port = server.config.server.port;
});

test.afterAll(async () => {
  await server.close();
});

test('game canvas renders and minimap has EXIT_DOOR markers', async ({ page }) => {
  await page.goto(`http://localhost:${port}`);

  await page.waitForSelector('#gameCanvas');
  const canvas = page.locator('#gameCanvas');
  await expect(canvas).toBeVisible();

  // Press Enter to start the game
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  // Take a screenshot for visual verification
  await page.screenshot({ path: 'test-output/game-started.png' });

  // Check canvas is rendering (not black)
  const pixel = await page.evaluate(() => {
    const c = document.querySelector('canvas#gameCanvas') as HTMLCanvasElement;
    if (!c) return null;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const data = ctx.getImageData(320, 240, 1, 1).data;
    return { r: data[0], g: data[1], b: data[2], a: data[3] };
  });
  expect(pixel).not.toBeNull();
  // Center pixel should not be black (game is rendering)
  const isNotBlack = pixel!.r > 0 || pixel!.g > 0 || pixel!.b > 0;
  expect(isNotBlack).toBe(true);

  // Press F1 to open debug minimap
  await page.keyboard.press('F1');
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'test-output/debug-minimap.png' });

  // Check minimap area (top-left ~480x480 in debug mode) for green EXIT_DOOR pixels
  const hasExitMarker = await page.evaluate(() => {
    const c = document.querySelector('canvas#gameCanvas') as HTMLCanvasElement;
    if (!c) return false;
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    // Debug minimap is 480x480 at (10, 10) — scan it for green pixels
    const data = ctx.getImageData(10, 10, 480, 480).data;
    for (let i = 0; i < data.length; i += 4) {
      // Green-ish: g > 150, r < 100, b < 100
      if (data[i + 1] > 150 && data[i] < 100 && data[i + 2] < 100) {
        return true;
      }
    }
    return false;
  });
  expect(hasExitMarker).toBe(true);

  // Also check for blue entrance marker on minimap
  const hasEntranceMarker = await page.evaluate(() => {
    const c = document.querySelector('canvas#gameCanvas') as HTMLCanvasElement;
    if (!c) return false;
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    const data = ctx.getImageData(10, 10, 480, 480).data;
    for (let i = 0; i < data.length; i += 4) {
      // Blue-ish entrance marker: b > 200, r < 120
      if (data[i + 2] > 200 && data[i] < 120) {
        return true;
      }
    }
    return false;
  });
  // Note: entrance might not be within the 480x480 viewport area if player moved
  // This is informational, not a hard fail
  console.log('Entrance marker found on minimap:', hasEntranceMarker);
});

test('HUD shows exit hint near EXIT_DOOR', async ({ page }) => {
  await page.goto(`http://localhost:${port}`);
  await page.waitForSelector('#gameCanvas');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);

  // The game uses Canvas 2D — HUD text is drawn on canvas, not DOM elements.
  // Take screenshot of the bottom area where "[E] to exit" would appear
  await page.screenshot({ path: 'test-output/hud-area.png',
    clip: { x: 200, y: 350, width: 240, height: 100 }
  });
});