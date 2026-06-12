// Smoke test sin dependencias para la PWA Cartera.
// Verifica: (1) que el JS embebido compila, (2) que los datos del usuario
// se escapan (no hay XSS almacenado) al renderizarse.
//
// Uso:  node test/smoke.mjs
// Requiere: Node 18+ y Google Chrome / Microsoft Edge instalado.
//
// Sale con codigo 0 si todo pasa, 1 si algo falla (apto para CI).

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'index.html');
let failures = 0;
const ok = (m) => console.log('  ✓ ' + m);
const fail = (m) => { console.log('  ✗ ' + m); failures++; };

const html = readFileSync(INDEX, 'utf8');

// ── Test 1: el script embebido compila (syntax check) ──────────────
(() => {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) { fail('No se encontro el <script> principal'); return; }
  try { new vm.Script(m[1]); ok('El JS embebido compila sin errores de sintaxis'); }
  catch (e) { fail('Error de sintaxis en el JS embebido: ' + e.message); }
})();

// ── Localizar un navegador Chromium ────────────────────────────────
function findBrowser() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return candidates.find(existsSync);
}

// ── Test 2: el nombre del usuario se escapa (anti-XSS) ─────────────
(() => {
  const browser = findBrowser();
  if (!browser) { console.log('  ~ (omitido) No se encontro Chrome/Edge para el test de render'); return; }

  const seed = `<script>try{localStorage.setItem('app_cfg',JSON.stringify({nombre:'<b>XSS</b>',neto:3500000,tipoNomina:'mensual',nominaDia:25}));}catch(e){}</script>`;
  const injected = html.replace('<script>', seed + '<script>');
  const dir = mkdtempSync(join(tmpdir(), 'cartera-smoke-'));
  const testFile = join(dir, 'seeded.html');
  writeFileSync(testFile, injected, 'utf8');

  try {
    const dom = execFileSync(browser, [
      '--headless', '--disable-gpu', '--no-sandbox', '--no-first-run',
      `--user-data-dir=${join(dir, 'profile')}`,
      '--virtual-time-budget=5000', '--dump-dom',
      'file:///' + testFile.replace(/\\/g, '/'),
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 });

    if (dom.includes('&lt;b&gt;XSS&lt;/b&gt;')) {
      ok('El nombre del usuario se escapa correctamente (anti-XSS)');
    } else if (/<div class="hero-lbl">Hola, <b><b>XSS<\/b>/.test(dom)) {
      fail('VULNERABLE: el nombre se inyecta como HTML vivo (XSS no escapado)');
    } else {
      fail('No se pudo confirmar el escape (revisar render). ¿Cambio el saludo de Inicio?');
    }
  } catch (e) {
    fail('No se pudo renderizar en el navegador: ' + e.message);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
})();

console.log(failures === 0 ? '\nOK: todos los smoke tests pasaron.' : `\nFALLO: ${failures} test(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
