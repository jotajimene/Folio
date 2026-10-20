// Folio · herramientas que corren en este computador
//  · Potrace (GPL): vectoriza los grabados para que se impriman nítidos a cualquier tamaño.
//  · Ghostscript (AGPL): convierte a CMYK / PDF/X para imprenta y mide la tinta.
//  · Opcionales, se descargan una sola vez con tu permiso: Real-ESRGAN (ampliar imágenes),
//    whisper.cpp (dictado y transcripción), Piper (voces), LanguageTool + Java (gramática).
// Nada de lo que procesan sale del equipo.
'use strict';
const { app, ipcMain } = require('electron');
const path = require('path'), fs = require('fs'), fsp = fs.promises, os = require('os'), https = require('https'), http = require('http');
const { spawn, execFile } = require('child_process');

const datos = () => app.getPath('userData');
const carpetaHerr = () => process.env.FOLIO_HERRAMIENTAS || path.join(datos(), 'herramientas');
const win = process.platform === 'win32';

// ---------------- Potrace ----------------
const carpetaVect = () => path.join(datos(), 'vectores');
async function vectorizar(ids, raizApp) {
  const potrace = require('potrace');
  await fsp.mkdir(carpetaVect(), { recursive: true });
  const hechos = [];
  for (const id of ids) {
    if (!/^L\d+$/.test(id)) continue;
    const dest = path.join(carpetaVect(), id + '.svg');
    if (fs.existsSync(dest)) { hechos.push(id); continue; }
    const src = path.join(raizApp, 'archivo', 'laminas', id + '.png');
    if (!fs.existsSync(src)) continue;
    const svg = await new Promise((res, rej) => potrace.trace(fs.readFileSync(src), { turdSize: 3, optTolerance: 0.35, threshold: 128, color: '#000000', background: 'transparent' }, (e, s) => e ? rej(e) : res(s)));
    await fsp.writeFile(dest, svg); hechos.push(id);
  }
  return hechos;
}
function vectoresExistentes() { try { return fs.readdirSync(carpetaVect()).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4)); } catch { return []; } }

// ---------------- Ghostscript ----------------
function rutaGS() {
  const cands = [
    path.join(process.resourcesPath || '', 'ghostscript', 'bin', win ? 'gswin64c.exe' : 'gs'),
    path.join(__dirname, 'build', 'ghostscript', 'bin', win ? 'gswin64c.exe' : 'gs'),
  ];
  for (const c of cands) if (fs.existsSync(c)) return c;
  return win ? null : '/usr/bin/gs';
}
function correr(exe, args, { timeout = 600000 } = {}) {
  // Ghostscript empaquetado: que encuentre sus propios recursos
  const base = path.dirname(path.dirname(exe)), env = { ...process.env };
  if (/ghostscript/i.test(exe) && fs.existsSync(path.join(base, 'lib'))) env.GS_LIB = [path.join(base, 'lib'), path.join(base, 'Resource', 'Init'), path.join(base, 'iccprofiles')].join(path.delimiter);
  return new Promise((res, rej) => execFile(exe, args, { maxBuffer: 64 * 1024 * 1024, timeout, windowsHide: true, env }, (e, so, se) => e ? rej(new Error((se || e.message).toString().slice(0, 600))) : res(String(so))));
}
// CMYK + PDF/X-3 con el perfil de salida de Ghostscript (o el que pongas en herramientas/icc)
async function aPDFX(entrada, salida, { titulo = 'Folio' } = {}) {
  const gs = rutaGS(); if (!gs || !fs.existsSync(gs)) throw new Error('Ghostscript no está disponible en esta instalación.');
  const iccPropio = path.join(carpetaHerr(), 'icc', 'perfil-cmyk.icc');
  const def = path.join(os.tmpdir(), 'folio-pdfx-' + Date.now() + '.ps');
  const iccFogra = path.join(__dirname, 'icc', 'FOGRA39L_coated.icc');
  const icc = fs.existsSync(iccPropio) ? iccPropio : fs.existsSync(iccFogra) ? iccFogra : null;
  await fsp.writeFile(def, `%!\n/ICCProfile (${icc ? icc.replace(/\\/g, '/') : 'default_cmyk.icc'}) def\n[/GTS_PDFXVersion (PDF/X-3:2002) /Title (${titulo.replace(/[()\\]/g, '')}) /Trapped /False /DOCINFO pdfmark\n[/_objdef {icc_PDFA} /type /stream /OBJ pdfmark\n[{icc_PDFA} <</N 4>> /PUT pdfmark\n[{icc_PDFA} ICCProfile (r) file /PUT pdfmark\n[/_objdef {OutputIntent_PDFX} /type /dict /OBJ pdfmark\n[{OutputIntent_PDFX} <</Type /OutputIntent /S /GTS_PDFX /OutputCondition (Offset, coated paper - FOGRA39) /Info (none) /OutputConditionIdentifier (FOGRA39) /RegistryName (http://www.color.org) /DestOutputProfile {icc_PDFA}>> /PUT pdfmark\n[{Catalog} <</OutputIntents [ {OutputIntent_PDFX} ]>> /PUT pdfmark\n`);
  try {
    await correr(gs, ['-dPDFX', '-dBATCH', '-dNOPAUSE', '-dNOOUTERSAVE', '-dSAFER', '--permit-file-read=' + path.dirname(def) + path.sep, ...(icc ? ['--permit-file-read=' + path.dirname(icc) + path.sep] : []), '-sDEVICE=pdfwrite', '-dPDFSETTINGS=/prepress', '-sColorConversionStrategy=CMYK', '-sProcessColorModel=DeviceCMYK', '-dEmbedAllFonts=true', '-dSubsetFonts=true', ...(icc ? ['-sOutputICCProfile=' + icc] : []), '-sOutputFile=' + salida, def, entrada]);
  } finally { fsp.unlink(def).catch(() => {}); }
}
// cobertura de tinta por página (promedio de C, M, Y, K)
async function tinta(pdf) {
  const gs = rutaGS(); if (!gs || !fs.existsSync(gs)) return null;
  // tinta media de cada página (en %) …
  const out = await correr(gs, ['-q', '-o', '-', '-sDEVICE=ink_cov', '-r72', pdf]);
  const pags = out.trim().split('\n').map(l => l.trim().split(/\s+/).slice(0, 4).map(Number)).filter(v => v.length === 4 && v.every(n => !isNaN(n))).map(([c, m, y, k]) => ({ c, m, y, k, total: c + m + y + k }));
  // … y la carga máxima de tinta en un punto (TAC), que es lo que mira la imprenta: se renderiza a CMYK y se busca el punto más cargado
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'folio-tac-'));
  try {
    const r = 24;
    await correr(gs, ['-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=bitcmyk', '-dGrayValues=256', '-r' + r, '-o', path.join(dir, 'p%04d.raw'), pdf]);
    const { PDFDocument } = require('pdf-lib'); const doc = await PDFDocument.load(await fsp.readFile(pdf), { updateMetadata: false });
    for (const [i, pg] of doc.getPages().entries()) {
      const f = path.join(dir, 'p' + String(i + 1).padStart(4, '0') + '.raw'); if (!fs.existsSync(f) || !pags[i]) continue;
      const b = await fsp.readFile(f), { width } = pg.getSize(), w = Math.round(width / 72 * r);
      const filas = Math.floor(b.length / 4 / w); let max = 0;
      // promedio de 2×2 puntos para no contar el borde suavizado de una letra
      for (let y = 0; y + 1 < filas; y += 2) for (let x = 0; x + 1 < w; x += 2) {
        let s = 0; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const o = ((y + dy) * w + x + dx) * 4; s += b[o] + b[o + 1] + b[o + 2] + b[o + 3]; }
        if (s > max) max = s;
      }
      pags[i].tac = Math.round(max / 4 / 255 * 100);
    }
  } catch (e) { /* si no se puede medir el punto, queda la media */ }
  finally { fsp.rm(dir, { recursive: true, force: true }).catch(() => {}); }
  return pags;
}

// ---------------- descargas opcionales ----------------
const CATALOGO = {
  realesrgan: { nombre: 'Real-ESRGAN', para: 'Ampliar imágenes para impresión', licencia: 'BSD-3', bytes: 45e6, partes: [{ url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip', zip: true, a: 'realesrgan' }], exe: 'realesrgan/realesrgan-ncnn-vulkan.exe' },
  whisper: { nombre: 'whisper.cpp + modelo «small»', para: 'Dictado y transcripción de audio en español', licencia: 'MIT', bytes: 520e6, partes: [{ url: 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.7.6/whisper-bin-x64.zip', zip: true, a: 'whisper' }, { url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin', a: 'whisper/ggml-small.bin' }], exe: 'whisper/Release/whisper-cli.exe' },
  piper: { nombre: 'Piper + voces en español', para: 'Escuchar el texto con voces naturales', licencia: 'MIT (voces: ver cada una)', bytes: 200e6, partes: [{ url: 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip', zip: true, a: 'piper' }, ...['es/es_MX/claude/high/es_MX-claude-high', 'es/es_AR/daniela/high/es_AR-daniela-high', 'es/es_ES/davefx/medium/es_ES-davefx-medium'].flatMap(v => [{ url: `https://huggingface.co/rhasspy/piper-voices/resolve/main/${v}.onnx`, a: 'piper/voces/' + v.split('/').pop() + '.onnx' }, { url: `https://huggingface.co/rhasspy/piper-voices/resolve/main/${v}.onnx.json`, a: 'piper/voces/' + v.split('/').pop() + '.onnx.json' }])], exe: 'piper/piper/piper.exe' },
  languagetool: { nombre: 'LanguageTool + Java', para: 'Revisión gramatical profunda en español', licencia: 'LGPL 2.1 / GPL+CE (Java)', bytes: 330e6, partes: [{ url: 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jre_x64_windows_hotspot_17.0.13_11.zip', zip: true, a: 'java' }, { url: 'https://languagetool.org/download/LanguageTool-stable.zip', zip: true, a: 'languagetool' }], exe: 'languagetool' },
};
let descarga = null;
function bajar(url, destino, alAvance, señal, saltos = 0) {
  return new Promise((res, rej) => {
    const m = url.startsWith('https') ? https : http;
    const req = m.get(url, { signal: señal, headers: { 'User-Agent': 'Folio' } }, r => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location && saltos < 10) { r.resume(); return res(bajar(new URL(r.headers.location, url).toString(), destino, alAvance, señal, saltos + 1)); }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error(`${url.split('/').pop()}: el servidor respondió ${r.statusCode}`)); }
      const total = Number(r.headers['content-length'] || 0); let rec = 0;
      const out = fs.createWriteStream(destino); r.on('data', c => { rec += c.length; alAvance(rec, total); }); r.pipe(out); out.on('finish', res); r.on('error', rej); out.on('error', rej);
    });
    req.on('error', rej);
  });
}
async function instalar(e, id) {
  const h = CATALOGO[id]; if (!h) throw new Error('Herramienta desconocida.');
  if (descarga) throw new Error('Ya hay una descarga en curso.');
  const base = carpetaHerr(); await fsp.mkdir(base, { recursive: true });
  const ctl = new AbortController(); descarga = { id, ctl };
  const extract = require('extract-zip');
  try {
    let hecho = 0;
    for (const [i, pt] of h.partes.entries()) {
      const destino = path.join(base, pt.a + (pt.zip ? '.zip' : ''));
      await fsp.mkdir(path.dirname(destino), { recursive: true });
      await bajar(pt.url, destino + '.parte', (rec, tot) => e.sender.send('herramienta:progreso', { id, parte: i + 1, partes: h.partes.length, rec, tot }), ctl.signal);
      await fsp.rename(destino + '.parte', destino);
      if (pt.zip) { await extract(destino, { dir: path.join(base, pt.a) }); await fsp.unlink(destino).catch(() => {}); }
      hecho++;
    }
    await fsp.writeFile(path.join(base, id + '.listo'), new Date().toISOString());
    e.sender.send('herramienta:progreso', { id, listo: true });
    return { ok: true };
  } finally { descarga = null; }
}
function instalada(id) { return fs.existsSync(path.join(carpetaHerr(), id + '.listo')); }
function buscar(dir, nombre) { // busca un archivo dentro de una carpeta extraída (los zip traen subcarpetas con versión)
  if (!fs.existsSync(dir)) return null;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isFile() && f.name.toLowerCase() === nombre.toLowerCase()) return p; if (f.isDirectory()) { const r = buscar(p, nombre); if (r) return r; } }
  return null;
}

// ---------------- usos ----------------
async function ampliar(entradaB64, factor = 4) {
  const exe = buscar(path.join(carpetaHerr(), 'realesrgan'), 'realesrgan-ncnn-vulkan.exe'); if (!exe) throw new Error('Real-ESRGAN no está instalado.');
  const tmp = path.join(os.tmpdir(), 'folio-ampliar-' + Date.now()), ent = tmp + '-in.png', sal = tmp + '-out.png';
  await fsp.writeFile(ent, Buffer.from(entradaB64, 'base64'));
  try { await correr(exe, ['-i', ent, '-o', sal, '-s', String(factor), '-n', 'realesrgan-x4plus'], { timeout: 900000 }); return (await fsp.readFile(sal)).toString('base64'); }
  finally { fsp.unlink(ent).catch(() => {}); fsp.unlink(sal).catch(() => {}); }
}
async function transcribir(wavB64) {
  const exe = buscar(path.join(carpetaHerr(), 'whisper'), 'whisper-cli.exe') || buscar(path.join(carpetaHerr(), 'whisper'), 'main.exe'); if (!exe) throw new Error('El dictado no está instalado.');
  const modelo = path.join(carpetaHerr(), 'whisper', 'ggml-small.bin');
  const tmp = path.join(os.tmpdir(), 'folio-dictado-' + Date.now()), ent = tmp + '.wav';
  await fsp.writeFile(ent, Buffer.from(wavB64, 'base64'));
  try { const out = await correr(exe, ['-m', modelo, '-l', 'es', '-nt', '-np', '-f', ent], { timeout: 1800000 }); return out.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).join('\n'); }
  finally { fsp.unlink(ent).catch(() => {}); }
}
function voces() { const d = path.join(carpetaHerr(), 'piper', 'voces'); try { return fs.readdirSync(d).filter(f => f.endsWith('.onnx')).map(f => f.replace(/\.onnx$/, '')); } catch { return []; } }
async function hablar(texto, voz, velocidad = 1) {
  const exe = buscar(path.join(carpetaHerr(), 'piper'), 'piper.exe'); if (!exe) throw new Error('Las voces no están instaladas.');
  const v = path.join(carpetaHerr(), 'piper', 'voces', (voz || voces()[0]) + '.onnx');
  const sal = path.join(os.tmpdir(), 'folio-voz-' + Date.now() + '.wav');
  await new Promise((res, rej) => { const p = spawn(exe, ['-m', v, '-f', sal, '--length_scale', String(1 / velocidad)], { windowsHide: true }); p.on('error', rej); p.on('close', c => c === 0 ? res() : rej(new Error('Piper terminó con código ' + c))); p.stdin.end(texto); });
  try { return (await fsp.readFile(sal)).toString('base64'); } finally { fsp.unlink(sal).catch(() => {}); }
}
// LanguageTool: servidor local en un puerto propio, solo para este equipo
let lt = null;
async function iniciarLT() {
  if (lt) return lt.puerto;
  const java = buscar(path.join(carpetaHerr(), 'java'), win ? 'java.exe' : 'java'), jar = buscar(path.join(carpetaHerr(), 'languagetool'), 'languagetool-server.jar');
  if (!java || !jar) throw new Error('LanguageTool no está instalado.');
  const puerto = 18081 + Math.floor(Math.random() * 500);
  const proc = spawn(java, ['-Xmx768m', '-cp', jar, 'org.languagetool.server.HTTPServer', '--port', String(puerto)], { cwd: path.dirname(jar), windowsHide: true });
  lt = { proc, puerto }; proc.on('close', () => { lt = null; });
  for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 500)); try { await consultarLT('Hola.', puerto); return puerto; } catch {} }
  throw new Error('LanguageTool no respondió.');
}
function consultarLT(texto, puerto) {
  return new Promise((res, rej) => {
    const cuerpo = new URLSearchParams({ text: texto, language: 'es', motherTongue: 'es' }).toString();
    const req = http.request({ host: '127.0.0.1', port: puerto, path: '/v2/check', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(cuerpo) } }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); });
    req.on('error', rej); req.end(cuerpo);
  });
}
async function revisarLT(textos) {
  const puerto = await iniciarLT();
  const out = [];
  for (const { id, texto } of textos) { const r = await consultarLT(texto, puerto); out.push({ id, matches: (r.matches || []).map(m => ({ offset: m.offset, length: m.length, mensaje: m.message, corto: m.shortMessage, reemplazos: (m.replacements || []).slice(0, 4).map(x => x.value), regla: m.rule && m.rule.id, categoria: m.rule && m.rule.category && m.rule.category.name })) }); }
  return out;
}
app.on('will-quit', () => { if (lt) try { lt.proc.kill(); } catch {} });

// ---------------- archivo ampliado: buscar en Wikimedia Commons (solo cuando tú lo pides) ----------------
// Se envía únicamente la palabra que buscas; nada del manuscrito. Lo que traes queda en tu carpeta de Folio.
const carpetaExtra = () => require('./equipo').carpetaExtra(); // en la carpeta de trabajo si hay una
function traer(url, { json = false, max = 40e6, saltos = 0 } = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    if (!/^(commons\.wikimedia\.org|upload\.wikimedia\.org|api\.github\.com)$/.test(u.hostname)) return rej(new Error('Dirección no permitida.'));
    https.get(url, { headers: { 'User-Agent': 'Folio/2 (editor de libros de escritorio)', Accept: json ? 'application/json' : '*/*' }, timeout: 30000 }, r => {
      if ([301, 302, 307, 308].includes(r.statusCode) && r.headers.location && saltos < 5) { r.resume(); return res(traer(new URL(r.headers.location, url).toString(), { json, max, saltos: saltos + 1 })); }
      if (r.statusCode !== 200) { r.resume(); const e = new Error('El servidor respondió ' + r.statusCode); e.codigo = r.statusCode; return rej(e); }
      const partes = []; let n = 0;
      r.on('data', c => { n += c.length; if (n > max) { r.destroy(); rej(new Error('Archivo demasiado grande.')); } else partes.push(c); });
      r.on('end', () => { const b = Buffer.concat(partes); try { res(json ? JSON.parse(b.toString('utf8')) : b); } catch (e) { rej(e); } });
      r.on('error', rej);
    }).on('error', rej).on('timeout', function () { this.destroy(new Error('Sin respuesta (¿hay internet?).')); });
  });
}
const libre = l => /public domain|^pd|dominio p|cc0|no restrictions|cc[- ]by(-sa)?/i.test(l || '');
const sinHTML = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
async function buscarCommons(q, soloGrabados = true) {
  const consulta = `${q} filetype:bitmap` + (soloGrabados ? ' (woodcut OR engraving OR etching OR xilografía OR grabado OR illustration)' : '');
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrsearch: consulta, gsrlimit: '40', prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '250', iiextmetadatafilter: 'LicenseShortName|Artist|DateTimeOriginal|ObjectName|Credit|ImageDescription' });
  const r = await traer(url, { json: true });
  const paginas = Object.values((r.query && r.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  const out = [];
  for (const pg of paginas) {
    const ii = (pg.imageinfo || [])[0]; if (!ii) continue; const m = ii.extmetadata || {}, v = k => sinHTML(m[k] && m[k].value);
    const lic = v('LicenseShortName'); if (!libre(lic)) continue;
    out.push({ titulo: pg.title.replace(/^File:/, ''), pagina: ii.descriptionurl, original: ii.url, mini: ii.thumburl, w: ii.width, h: ii.height, licencia: lic, autor: v('Artist') || 'Autor desconocido', fecha: v('DateTimeOriginal').slice(0, 40), obra: v('ObjectName') || pg.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''), credito: v('Credit').slice(0, 300) });
  }
  // miniaturas: las trae este proceso (la ventana no tiene red)
  let i = 0; await Promise.all(Array.from({ length: 6 }, async () => { while (i < out.length) { const x = out[i++]; try { x.miniB64 = 'data:image/jpeg;base64,' + (await traer(x.mini, { max: 2e6 })).toString('base64'); } catch {} } }));
  return out.filter(x => x.miniB64);
}
async function traerCommons(x) {
  // versión de hasta 1920 px (tamaño estándar de Commons) (o el original si es menor)
  const url = x.w > 1920 ? x.original.replace('/commons/', '/commons/thumb/') + '/1920px-' + path.basename(x.original) : x.original;
  let buf; try { buf = await traer(url); } catch { buf = await traer(x.original); }
  return buf.toString('base64');
}
async function extraLeer() { try { return JSON.parse(await fsp.readFile(path.join(carpetaExtra(), 'extra.json'), 'utf8')); } catch { return { laminas: [], paginas: [] }; } }
async function extraGuardar({ ficha, laminaB64, miniB64, paginaB64 }) {
  const base = carpetaExtra(); for (const d of ['laminas', 'mini', 'paginas']) await fsp.mkdir(path.join(base, d), { recursive: true });
  const cat = await extraLeer(); const n = cat.laminas.reduce((m, l) => Math.max(m, +l.id.slice(1) || 0), 0) + 1; const id = 'X' + String(n).padStart(4, '0');
  await fsp.writeFile(path.join(base, 'laminas', id + '.png'), Buffer.from(laminaB64, 'base64'));
  await fsp.writeFile(path.join(base, 'mini', id + '.png'), Buffer.from(miniB64, 'base64'));
  if (paginaB64) await fsp.writeFile(path.join(base, 'paginas', id + '.jpg'), Buffer.from(paginaB64, 'base64'));
  cat.laminas.push({ id, p: id, tipo: ficha.tipo || 'figura', w: ficha.w, h: ficha.h, b: ficha.b || null, extra: 1 });
  cat.paginas.push({ p: id, f: 'Traídas de Wikimedia Commons', t: ficha.titulo, u: ficha.pagina, l: ficha.licencia, a: ficha.autor, y: ficha.fecha, c: ficha.credito, w: ficha.pw, h: ficha.ph, o: ficha.obra });
  const tmp = path.join(base, 'extra.json.tmp'); await fsp.writeFile(tmp, JSON.stringify(cat)); await fsp.rename(tmp, path.join(base, 'extra.json'));
  return id;
}
async function extraQuitar(id) {
  const cat = await extraLeer(); cat.laminas = cat.laminas.filter(l => l.id !== id); cat.paginas = cat.paginas.filter(p => p.p !== id);
  await fsp.writeFile(path.join(carpetaExtra(), 'extra.json'), JSON.stringify(cat));
  for (const f of [['laminas', '.png'], ['mini', '.png'], ['paginas', '.jpg']]) await fsp.unlink(path.join(carpetaExtra(), f[0], id + f[1])).catch(() => {});
  return true;
}

// ---------------- actualizaciones (solo cuando tú lo pides) ----------------
const REPO = 'jotajimene/Folio';
const comparar = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
async function buscarActualizacion() {
  const actual = require('./package.json').version;
  let r; try { r = await traer(`https://api.github.com/repos/${REPO}/releases/latest`, { json: true }); }
  catch (e) { return { error: e.codigo === 404 ? 'privado' : 'red', actual, mensaje: e.message }; }
  const exe = (r.assets || []).map(a => a.name).find(n => /Folio-\d+\.\d+\.\d+-/.test(n)) || '';
  const version = (exe.match(/Folio-(\d+\.\d+\.\d+)-/) || [])[1] || actual;
  return { actual, version, hay: comparar(version, actual) > 0, pagina: r.html_url, fecha: r.published_at, notas: String(r.body || '').slice(0, 1500) };
}

function registrar(raizApp) {
  ipcMain.handle('vector:hacer', (_e, ids) => vectorizar(ids, raizApp));
  ipcMain.handle('vector:lista', () => vectoresExistentes());
  ipcMain.handle('herr:estado', () => ({ ghostscript: !!(rutaGS() && fs.existsSync(rutaGS())), opcionales: Object.entries(CATALOGO).map(([id, h]) => ({ id, nombre: h.nombre, para: h.para, licencia: h.licencia, bytes: h.bytes, instalada: instalada(id) })), windows: win, descargando: descarga && descarga.id, voces: voces() }));
  ipcMain.handle('herr:instalar', (e, id) => instalar(e, id));
  ipcMain.handle('herr:cancelar', () => { if (descarga) descarga.ctl.abort(); return true; });
  ipcMain.handle('herr:ampliar', (_e, { b64, factor }) => ampliar(b64, factor));
  ipcMain.handle('herr:transcribir', (_e, wav) => transcribir(wav));
  ipcMain.handle('herr:hablar', (_e, { texto, voz, velocidad }) => hablar(texto, voz, velocidad));
  ipcMain.handle('herr:lt', (_e, textos) => revisarLT(textos));
  ipcMain.handle('commons:buscar', (_e, { q, soloGrabados }) => buscarCommons(q, soloGrabados));
  ipcMain.handle('commons:traer', (_e, x) => traerCommons(x));
  ipcMain.handle('extra:leer', () => extraLeer());
  ipcMain.handle('extra:guardar', (_e, d) => extraGuardar(d));
  ipcMain.handle('extra:quitar', (_e, id) => extraQuitar(id));
  ipcMain.handle('actualizar:buscar', () => buscarActualizacion());
}
module.exports = { registrar, aPDFX, tinta, rutaGS, vectorizar, carpetaVect, carpetaExtra, buscarCommons, extraGuardar, extraLeer, comparar, _traer: f => { traer = f; } };
