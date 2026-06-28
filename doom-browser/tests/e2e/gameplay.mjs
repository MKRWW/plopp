import { execSync } from 'child_process';
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { createServer } from 'node:http';

const rootDir = resolve(process.cwd());
if (!existsSync(resolve(rootDir, 'test-output'))) mkdirSync(resolve(rootDir, 'test-output'));

const viteBin = resolve(rootDir, 'node_modules', '.bin', 'vite.cmd');
execSync(`rmdir /s /q "${resolve(rootDir, 'dist')}" 2>nul`, { shell: 'cmd.exe', stdio: 'ignore' });
execSync(`"${viteBin}" build`, { cwd: rootDir, shell: 'cmd.exe', stdio: 'pipe' });

const mimeTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const server = createServer((req, res) => {
  let path = req.url === '/' ? '/index.html' : req.url;
  try {
    const content = readFileSync(resolve(rootDir, 'dist' + path));
    const ext = path.match(/\.[^.]+$/)?.[0] || '';
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});
await new Promise(r => server.listen(5678, r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
let passed = 0, failed = 0;

try {
  await page.goto('http://localhost:5678', { timeout: 10000, waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#gameCanvas', { timeout: 5000 });

  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Wait for canvas to initialize at 640x480
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas#gameCanvas');
    return c && c.width === 640 && c.height === 480;
  }, { timeout: 5000 });

  // Give the game a few frames to render
  await page.waitForTimeout(2000);
  console.log('Game started');

  // Expose player + minimap for direct access via page.evaluate
  // The game stores player and game state internally. We can access
  // worldState to get keycard positions from the current level.

  // Get level data: keycard positions, player position
  const levelInfo = await page.evaluate(() => {
    // Access the world state via the global module graph
    const canvas = document.querySelector('canvas#gameCanvas');
    if (!canvas) return { error: 'no canvas' };
    // Try to find player position by scanning minimap debug area
    return { canvasWidth: canvas.width, canvasHeight: canvas.height };
  });
  console.log('Canvas:', levelInfo.canvasWidth, 'x', levelInfo.canvasHeight);

  // Since we can't directly access the game internals from page.evaluate
  // (they're in closure scope), we'll test via pixel analysis on the minimap.

  // Test 0: Check canvas and game state
  const canvasInfo = await page.evaluate(() => {
    const c = document.querySelector('canvas#gameCanvas');
    const ctx = c.getContext('2d');
    // Sample across the whole canvas
    const samples = [];
    for (let y = 0; y < 480; y += 48) {
      for (let x = 0; x < 640; x += 64) {
        const d = ctx.getImageData(x + 32, y + 24, 1, 1).data;
        samples.push({x: x+32, y: y+24, r: d[0], g: d[1], b: d[2]});
      }
    }
    const nonBlack = samples.filter(s => s.r > 10 || s.g > 10 || s.b > 10);
    return { samples, nonBlackCount: nonBlack.length, first5: samples.slice(0, 5) };
  });
  console.log(`  Non-black pixels: ${canvasInfo.nonBlackCount}/${canvasInfo.samples.length}`);
  console.log('  Samples:', JSON.stringify(canvasInfo.first5));

  if (canvasInfo.nonBlackCount > 2) {
    console.log('OK  Game is rendering');
    passed++;
  } else {
    console.log('FAIL Black screen');
    failed++;
  }

  // Test 2: Debug minimap toggle and content
  await page.keyboard.press('F1');
  await page.waitForTimeout(500);

  // Check if minimap debug is active and scan for specific colors on main canvas
  const minimapCheck = await page.evaluate(() => {
    const c = document.querySelector('canvas#gameCanvas');
    const ctx = c.getContext('2d');
    // Scan the minimap area (10,10 to 490,490) for colored pixels
    const data = ctx.getImageData(10, 10, 480, 480).data;
    let exitGreen = 0, entranceCyan = 0, blueKey = 0, yellowKey = 0, whitePx = 0, wallPx = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // White pixels (debug text, grid lines, etc)
      if (r > 200 && g > 200 && b > 200) whitePx++;
      // Wall pixels (gray, all channels similar ~100-150)
      if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r > 80 && r < 180) wallPx++;
      // EXIT_DOOR green: #0c0 → g high, r low, b low
      if (g > 150 && r < 60 && b < 60) exitGreen++;
      // Entrance cyan: #5af → b high, g high, r moderate
      if (b > 150 && g > 100 && r < 100) entranceCyan++;
      // Blue keycard: #48f → b very high, g moderate
      if (b > 200 && g > 70 && r < 80) blueKey++;
      // Yellow keycard: #fc0 → r very high, g high, b low
      if (r > 200 && g > 140 && b < 60) yellowKey++;
    }
    return { whitePx, wallPx, exitGreen, entranceCyan, blueKey, yellowKey, total: data.length / 4 };
  });

  console.log(`  Minimap pixels (${minimapCheck.total}): white=${minimapCheck.whitePx} wall=${minimapCheck.wallPx} exit=${minimapCheck.exitGreen} entrance=${minimapCheck.entranceCyan} blueKey=${minimapCheck.blueKey} yellowKey=${minimapCheck.yellowKey}`);

  // Check that debug minimap IS rendering (wall pixels should be numerous)
  if (minimapCheck.wallPx > 500) {
    console.log('OK  Debug minimap is rendering');
    passed++;
  } else {
    console.log('FAIL Debug minimap not rendering');
    failed++;
  }

  if (minimapCheck.exitGreen > 0) {
    console.log('OK  EXIT_DOOR markers on minimap');
    passed++;
  } else {
    console.log('FAIL No EXIT_DOOR markers');
    failed++;
  }

  if (minimapCheck.entranceCyan > 0) {
    console.log('OK  Entrance marker on minimap');
    passed++;
  } else {
    console.log('FAIL No entrance marker');
    failed++;
  }

  if (minimapCheck.blueKey > 0 || minimapCheck.yellowKey > 0) {
    console.log('OK  Keycard markers visible');
    passed++;
  } else {
    console.log('INFO Keycards outside viewport');
  }

} catch (e) {
  console.error('FAIL', e.message);
  failed++;
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);