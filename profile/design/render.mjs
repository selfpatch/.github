#!/usr/bin/env node
// Renders every [data-asset] in each sheet below with headless Chrome over
// the DevTools protocol. No npm install needed: Node 22+ ships a WebSocket
// client.
//
//   node profile/design/render.mjs              every sheet
//   node profile/design/render.mjs ros2_medkit  one sheet, by name
//
// CHROME=/path/to/chrome overrides the browser.

import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// assets.html draws the org profile; ros2_medkit.html the images the
// ros2_medkit README links to, so that repository carries no binaries
const SHEETS = [
  { name: 'profile', page: 'assets.html', out: join(here, '..', 'assets') },
  { name: 'ros2_medkit', page: 'ros2_medkit.html', out: join(here, '..', 'assets', 'ros2_medkit') },
];
const only = process.argv[2];
const sheets = SHEETS.filter((sheet) => !only || sheet.name === only);
if (!sheets.length) throw new Error(`No sheet named ${only}, try one of: ${SHEETS.map((sheet) => sheet.name).join(', ')}`);
const SCALE = 2;
const TIMEOUT_MS = 60_000;

if (typeof WebSocket === 'undefined') {
  throw new Error(`Node ${process.versions.node} has no WebSocket client, use Node 22 or newer`);
}

const CHROME = process.env.CHROME ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(existsSync);
if (!CHROME) throw new Error('No Chrome found, set CHROME=/path/to/chrome');

// A throwaway profile per run, removed at the end
const profile = await mkdtemp(join(tmpdir(), 'selfpatch-render-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  '--remote-debugging-port=0',
  '--hide-scrollbars',
  '--no-first-run',
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

// A stuck page fails the run instead of hanging it
const timer = setTimeout(() => {
  console.error(`Rendering took longer than ${TIMEOUT_MS / 1000}s, giving up`);
  chrome.kill();
  process.exit(1);
}, TIMEOUT_MS);

let ws;
try {
  const browserUrl = await new Promise((resolve, reject) => {
    let log = '';
    chrome.stderr.on('data', (d) => {
      log += d;
      const m = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve(m[1]);
    });
    chrome.on('error', reject);
    chrome.on('exit', () => reject(new Error(`Chrome exited:\n${log}`)));
  });

  // Minimal CDP client: one socket, sessions flattened onto it
  ws = new WebSocket(browserUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('Could not connect to Chrome')), { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else {
      listeners.forEach((fn) => fn(msg));
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const once = (method, sessionId) => new Promise((resolve) => {
    const fn = (msg) => {
      if (msg.method === method && msg.sessionId === sessionId) {
        listeners.delete(fn);
        resolve(msg.params);
      }
    };
    listeners.add(fn);
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, s);
  await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 2000, deviceScaleFactor: SCALE, mobile: false }, s);
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } }, s);

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, s);
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };

  const written = [];
  for (const { page, out } of sheets) {
    await mkdir(out, { recursive: true });
    for (const theme of ['light', 'dark']) {
      const loaded = once('Page.loadEventFired', s);
      await send('Page.navigate', { url: `${pathToFileURL(join(here, page)).href}?theme=${theme}` }, s);
      await loaded;
      // Rejects when a font or an image did not load, so nothing renders with a fallback
      await evaluate('window.ready');

      // Every asset to whole pixels, top to bottom, so a text-sized button keeps
      // its right border and nothing below a fractional block lands between pixels
      await evaluate(`document.querySelectorAll('[data-asset]').forEach((el) => {
        const r = el.getBoundingClientRect();
        el.style.width = Math.ceil(r.width) + 'px';
        el.style.height = Math.ceil(r.height) + 'px';
      }); true`);

      const assets = await evaluate(`[...document.querySelectorAll('[data-asset]')].map((el) => {
        const r = el.getBoundingClientRect();
        return { name: el.dataset.asset, only: el.dataset.themes ?? null, format: el.dataset.format ?? 'png', x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
      })`);

      for (const a of assets) {
        // Theme-independent assets render once, from their own theme's pass
        if (a.only && a.only !== theme) continue;
        const file = a.only ? `${a.name}.${a.format}` : `${a.name}-${theme}.${a.format}`;
        // Snapped out to whole pixels, in case a box is still fractional
        const x = Math.floor(a.x);
        const y = Math.floor(a.y);
        const width = Math.ceil(a.x + a.width) - x;
        const height = Math.ceil(a.y + a.height) - y;
        const { data } = await send('Page.captureScreenshot', {
          format: a.format,
          ...(a.format === 'webp' && { quality: 90 }),
          captureBeyondViewport: true,
          clip: { x, y, width, height, scale: 1 },
        }, s);
        await writeFile(join(out, file), Buffer.from(data, 'base64'));
        written.push(`${join(out, file).slice(join(here, '..').length + 1)}  ${width}x${height}`);
      }
    }
  }
  console.log(written.join('\n'));
} finally {
  clearTimeout(timer);
  ws?.close();
  chrome.kill();
  await new Promise((r) => (chrome.exitCode !== null ? r() : chrome.once('exit', r)));
  await rm(profile, { recursive: true, force: true });
}
