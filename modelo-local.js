// Folio · modelo de texto local (llama.cpp vía node-llama-cpp, MIT).
// El modelo se descarga una sola vez a la carpeta de datos de Folio y después funciona sin internet.
// Nunca escribe sobre el manuscrito: solo devuelve texto que la interfaz muestra como sugerencia.
'use strict';
const { app, ipcMain } = require('electron');
const path = require('path'), fs = require('fs'), fsp = fs.promises, os = require('os'), https = require('https');

// Modelos libres (Apache 2.0). Cuantizados a 4 bits: buen equilibrio entre calidad y velocidad.
const CATALOGO = [
  { id: 'qwen3-4b', nombre: 'Qwen3 4B Instruct', detalle: 'Recomendado: escribe y corrige en español con soltura.', archivo: 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf',
    url: 'https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf', bytes: 2497281632, ramMin: 8, licencia: 'Apache 2.0 · Qwen (Alibaba)' },
  { id: 'qwen3-1.7b', nombre: 'Qwen3 1.7B', detalle: 'Liviano, para computadores con poca memoria. Más simple en sus respuestas.', archivo: 'Qwen3-1.7B-Q4_K_M.gguf',
    url: 'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf', bytes: 1107409376, ramMin: 4, licencia: 'Apache 2.0 · Qwen (Alibaba)', sinPensar: true },
];
const carpeta = () => process.env.FOLIO_MODELOS || path.join(app.getPath('userData'), 'modelos');
let llama = null, cargado = null, descarga = null; const pedidos = new Map();

async function estado() {
  await fsp.mkdir(carpeta(), { recursive: true });
  const ram = Math.round(os.totalmem() / 1024 ** 3);
  const modelos = await Promise.all(CATALOGO.map(async m => {
    let instalado = false, bytes = 0;
    try { const s = await fsp.stat(path.join(carpeta(), m.archivo)); instalado = s.size > 1e6; bytes = s.size; } catch {}
    return { ...m, instalado, bytesEnDisco: bytes };
  }));
  // modelos propios: cualquier .gguf que pongas en la carpeta
  const extra = (await fsp.readdir(carpeta())).filter(f => f.endsWith('.gguf') && !CATALOGO.some(m => m.archivo === f)).map(f => ({ id: 'propio:' + f, nombre: f, detalle: 'Modelo agregado a mano a la carpeta.', archivo: f, instalado: true, propio: true }));
  return { ram, recomendado: ram >= 12 ? 'qwen3-4b' : 'qwen3-1.7b', carpeta: carpeta(), modelos: [...modelos, ...extra], cargado: cargado && cargado.id, descargando: descarga && { id: descarga.id, recibidos: descarga.recibidos, total: descarga.total } };
}

function bajar(url, destino, desde, alAvance, señal, saltos = 0) {
  return new Promise((res, rej) => {
    const req = https.get(url, { headers: desde ? { Range: `bytes=${desde}-` } : {}, signal: señal }, r => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location && saltos < 8) { r.resume(); return res(bajar(new URL(r.headers.location, url).toString(), destino, desde, alAvance, señal, saltos + 1)); }
      if (r.statusCode !== 200 && r.statusCode !== 206) { r.resume(); return rej(new Error('El servidor respondió ' + r.statusCode)); }
      const total = desde + Number(r.headers['content-length'] || 0); let recibidos = r.statusCode === 206 ? desde : 0;
      const out = fs.createWriteStream(destino, { flags: r.statusCode === 206 ? 'a' : 'w' });
      r.on('data', c => { recibidos += c.length; alAvance(recibidos, total); });
      r.pipe(out); out.on('finish', () => res()); r.on('error', rej); out.on('error', rej);
    });
    req.on('error', rej);
  });
}
async function descargar(e, id) {
  const m = CATALOGO.find(x => x.id === id); if (!m) throw new Error('Modelo desconocido.');
  if (descarga) throw new Error('Ya hay una descarga en curso.');
  await fsp.mkdir(carpeta(), { recursive: true });
  const final = path.join(carpeta(), m.archivo), parcial = final + '.parte';
  let desde = 0; try { desde = (await fsp.stat(parcial)).size; } catch {}
  const ctl = new AbortController(); descarga = { id, recibidos: desde, total: m.bytes, ctl };
  let ultimo = 0;
  try {
    await bajar(m.url, parcial, desde, (rec, tot) => { descarga.recibidos = rec; descarga.total = tot || m.bytes; const t = Date.now(); if (t - ultimo > 400) { ultimo = t; e.sender.send('modelo:progreso', { id, recibidos: rec, total: descarga.total }); } }, ctl.signal);
    await fsp.rename(parcial, final);
    e.sender.send('modelo:progreso', { id, recibidos: descarga.total, total: descarga.total, listo: true });
    return { ok: true };
  } finally { descarga = null; }
}

async function cargar(id) {
  const est = await estado(); const m = est.modelos.find(x => x.id === id && x.instalado) || est.modelos.find(x => x.instalado && x.id === est.recomendado) || est.modelos.find(x => x.instalado);
  if (!m) throw new Error('No hay ningún modelo instalado.');
  if (cargado && cargado.id === m.id) return cargado;
  if (cargado) { try { await cargado.contexto.dispose(); await cargado.modelo.dispose(); } catch {} cargado = null; }
  const { getLlama, LlamaChatSession } = await import('node-llama-cpp');
  if (!llama) llama = await getLlama({ gpu: 'auto', build: 'never' }).catch(() => getLlama({ gpu: false, build: 'never' }));
  const modelo = await llama.loadModel({ modelPath: path.join(carpeta(), m.archivo) });
  const contexto = await modelo.createContext({ contextSize: { max: 8192 } });
  cargado = { id: m.id, sinPensar: !!m.sinPensar, modelo, contexto, LlamaChatSession, gpu: llama.gpu };
  return cargado;
}

async function generar(e, { pedido, sistema, mensaje, maxTokens = 700, temperatura = 0.6, id }) {
  const c = await cargar(id);
  const ctl = new AbortController(); pedidos.set(pedido, ctl);
  const secuencia = c.contexto.getSequence();
  try {
    const sesion = new c.LlamaChatSession({ contextSequence: secuencia, systemPrompt: sistema });
    let dentroPensar = false;
    const texto = await sesion.prompt((c.sinPensar ? '/no_think\n' : '') + mensaje, {
      maxTokens, temperature: temperatura, topP: 0.9, signal: ctl.signal, stopOnAbortSignal: true,
      onTextChunk: t => { if (/<think>/.test(t)) dentroPensar = true; if (!dentroPensar) e.sender.send('modelo:trozo', { pedido, t }); if (/<\/think>/.test(t)) dentroPensar = false; },
    });
    return { texto: texto.replace(/<think>[\s\S]*?<\/think>/g, '').trim(), modelo: c.id, gpu: c.gpu };
  } finally { pedidos.delete(pedido); secuencia.dispose(); }
}

function registrar() {
  ipcMain.handle('modelo:estado', () => estado());
  ipcMain.handle('modelo:descargar', (e, id) => descargar(e, id));
  ipcMain.handle('modelo:cancelar-descarga', () => { if (descarga) descarga.ctl.abort(); return true; });
  ipcMain.handle('modelo:borrar', async (_e, id) => { const m = (await estado()).modelos.find(x => x.id === id); if (!m) return false; if (cargado && cargado.id === id) { await cargado.contexto.dispose(); await cargado.modelo.dispose(); cargado = null; } await fsp.unlink(path.join(carpeta(), m.archivo)).catch(() => {}); return true; });
  ipcMain.handle('modelo:generar', (e, opts) => generar(e, opts));
  ipcMain.handle('modelo:detener', (_e, pedido) => { const c = pedidos.get(pedido); if (c) c.abort(); return true; });
  ipcMain.handle('modelo:carpeta', () => carpeta());
}
module.exports = { registrar, CATALOGO, estado, cargar, generar };
