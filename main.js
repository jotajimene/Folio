// Folio · proceso principal (Electron)
// Ventana sin red: todo se sirve desde folio://app/ y los manuscritos nunca salen del equipo.
'use strict';
const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell, session, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { pathToFileURL } = require('url');
const JSZip = require('jszip');
const { PDFDocument } = require('pdf-lib');

const RAIZ = path.join(__dirname, 'app');
const MM = 72 / 25.4;

protocol.registerSchemesAsPrivileged([
  { scheme: 'folio', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

let ventana = null;
const autoguardado = () => path.join(app.getPath('userData'), 'autoguardado.folio.json');
const copias = () => path.join(app.getPath('userData'), 'copias');

function crearVentana() {
  ventana = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    backgroundColor: '#efe6d2', title: 'Folio', show: false,
    icon: path.join(__dirname, 'build', 'icono.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  });
  ventana.once('ready-to-show', () => ventana.show());
  ventana.loadURL('folio://app/index.html');
  ventana.webContents.setWindowOpenHandler(({ url }) => { abrirFuera(url); return { action: 'deny' }; });
  ventana.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('folio://')) { e.preventDefault(); abrirFuera(url); } });
}

function abrirFuera(url) {
  // Solo enlaces de atribución de las fuentes del archivo
  if (/^https:\/\/(commons\.wikimedia\.org|archive\.org|www\.biodiversitylibrary\.org|creativecommons\.org)\//.test(url)) shell.openExternal(url);
}

app.whenReady().then(() => {
  protocol.handle('folio', req => {
    const u = new URL(req.url);
    const ruta = path.normalize(path.join(RAIZ, decodeURIComponent(u.pathname)));
    if (!ruta.startsWith(RAIZ)) return new Response('No', { status: 403 });
    return net.fetch(pathToFileURL(ruta).toString());
  });
  // Sin red: cualquier petición fuera de folio://, data: o blob: se cancela.
  session.defaultSession.webRequest.onBeforeRequest((d, cb) => {
    const ok = /^(folio|data|blob|devtools|chrome-extension):/.test(d.url);
    cb({ cancel: !ok });
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Archivo', submenu: [
      { label: 'Proyecto nuevo', accelerator: 'CmdOrCtrl+N', click: () => ventana.webContents.send('menu', 'nuevo') },
      { label: 'Abrir proyecto…', accelerator: 'CmdOrCtrl+O', click: () => ventana.webContents.send('menu', 'abrir') },
      { label: 'Guardar', accelerator: 'CmdOrCtrl+S', click: () => ventana.webContents.send('menu', 'guardar') },
      { label: 'Guardar como…', accelerator: 'CmdOrCtrl+Shift+S', click: () => ventana.webContents.send('menu', 'guardar-como') },
      { type: 'separator' }, { label: 'Archivo de grabados', click: () => ventana.webContents.send('menu', 'archivo-grabados') },
      { type: 'separator' }, { role: 'quit', label: 'Salir' }] },
    { label: 'Editar', submenu: [{ label: 'Deshacer', accelerator: 'CmdOrCtrl+Z', click: () => ventana.webContents.send('menu', 'deshacer') }, { label: 'Rehacer', accelerator: 'CmdOrCtrl+Y', click: () => ventana.webContents.send('menu', 'rehacer') }, { type: 'separator' }, { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' }] },
    { label: 'Ver', submenu: [{ role: 'reload', label: 'Recargar' }, { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }, { type: 'separator' }, { role: 'resetZoom', label: 'Tamaño real' }, { role: 'zoomIn', label: 'Acercar' }, { role: 'zoomOut', label: 'Alejar' }, { role: 'togglefullscreen', label: 'Pantalla completa' }] },
  ]));
  crearVentana();
});
app.on('window-all-closed', () => app.quit());

// ---------------- proyecto ----------------
// Un .folio es un ZIP: proyecto.json + recursos/ (imágenes y fuentes propias) + original/ (archivos importados)
async function empaquetar(datos) {
  const zip = new JSZip();
  const { proyecto, recursos = {}, originales = {} } = datos;
  zip.file('proyecto.json', JSON.stringify(proyecto, null, 1));
  for (const [nombre, b64] of Object.entries(recursos)) zip.file('recursos/' + nombre, b64, { base64: true });
  for (const [nombre, b64] of Object.entries(originales)) zip.file('original/' + nombre, b64, { base64: true });
  zip.file('LEEME.txt', 'Proyecto de Folio. Ábrelo con Folio. Contiene el texto del libro, sus imágenes y los archivos originales importados.');
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
async function desempaquetar(buf) {
  const zip = await JSZip.loadAsync(buf);
  const proyecto = JSON.parse(await zip.file('proyecto.json').async('string'));
  const recursos = {}, originales = {};
  for (const f of Object.values(zip.files)) {
    if (f.dir) continue;
    if (f.name.startsWith('recursos/')) recursos[f.name.slice(9)] = await f.async('base64');
    if (f.name.startsWith('original/')) originales[f.name.slice(9)] = await f.async('base64');
  }
  return { proyecto, recursos, originales };
}
ipcMain.handle('proyecto:guardar', async (_e, { ruta, datos, como }) => {
  if (!ruta || como) {
    const r = await dialog.showSaveDialog(ventana, { title: 'Guardar proyecto de Folio', defaultPath: (datos.proyecto.titulo || 'libro').replace(/[\\/:*?"<>|]/g, '') + '.folio', filters: [{ name: 'Proyecto de Folio', extensions: ['folio'] }] });
    if (r.canceled) return { cancelado: true };
    ruta = r.filePath;
  }
  const buf = await empaquetar(datos);
  // escritura segura: archivo temporal y renombre; se guarda la versión anterior como .bak
  const tmp = ruta + '.tmp';
  await fsp.writeFile(tmp, buf);
  if (fs.existsSync(ruta)) await fsp.copyFile(ruta, ruta + '.bak').catch(() => {});
  await fsp.rename(tmp, ruta);
  return { ruta, bytes: buf.length, fecha: new Date().toISOString() };
});
ipcMain.handle('proyecto:abrir', async (_e, ruta) => {
  if (!ruta) {
    const r = await dialog.showOpenDialog(ventana, { title: 'Abrir proyecto de Folio', filters: [{ name: 'Proyecto de Folio', extensions: ['folio', 'json'] }], properties: ['openFile'] });
    if (r.canceled) return { cancelado: true };
    ruta = r.filePaths[0];
  }
  const buf = await fsp.readFile(ruta);
  if (ruta.endsWith('.json')) return { ruta: null, datos: { proyecto: JSON.parse(buf.toString('utf8')), recursos: {}, originales: {} }, heredado: true };
  return { ruta, datos: await desempaquetar(buf) };
});
ipcMain.handle('proyecto:autoguardar', async (_e, datos) => {
  await fsp.mkdir(path.dirname(autoguardado()), { recursive: true });
  const tmp = autoguardado() + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(datos));
  await fsp.rename(tmp, autoguardado());
  // copia diaria rotativa (7 días)
  await fsp.mkdir(copias(), { recursive: true });
  const hoy = new Date().toISOString().slice(0, 10), dest = path.join(copias(), hoy + '.folio.json');
  await fsp.copyFile(autoguardado(), dest).catch(() => {});
  const lista = (await fsp.readdir(copias())).sort();
  for (const f of lista.slice(0, Math.max(0, lista.length - 7))) await fsp.unlink(path.join(copias(), f)).catch(() => {});
  return true;
});
ipcMain.handle('proyecto:recuperar', async () => {
  try { return JSON.parse(await fsp.readFile(autoguardado(), 'utf8')); } catch { return null; }
});
ipcMain.handle('archivo:guardar', async (_e, { nombre, b64, filtros }) => {
  const r = await dialog.showSaveDialog(ventana, { defaultPath: nombre, filters: filtros || [] });
  if (r.canceled) return { cancelado: true };
  await fsp.writeFile(r.filePath, Buffer.from(b64, 'base64'));
  return { ruta: r.filePath };
});
ipcMain.handle('externo', (_e, url) => abrirFuera(url));
ipcMain.handle('mostrar-en-carpeta', (_e, ruta) => shell.showItemInFolder(ruta));

// ---------------- PDF ----------------
// Se compone el documento en una ventana oculta (Paged.js para el libro) y se imprime a PDF
// sin el diálogo de Chrome: tamaño exacto, sin márgenes añadidos, fuentes incrustadas.
async function componerPDF(trabajo) {
  const w = new BrowserWindow({ show: false, width: 1200, height: 1600, webPreferences: { preload: path.join(__dirname, 'preload-imprimir.js'), contextIsolation: true, sandbox: true } });
  try {
    const listo = new Promise((res, rej) => {
      const t = setTimeout(() => { delete pendientes[w.webContents.id]; rej(new Error('La composición tardó demasiado.')); }, 180000);
      pendientes[w.webContents.id] = info => { clearTimeout(t); delete pendientes[w.webContents.id]; res(info); };
    });
    await w.loadURL('folio://app/imprimir.html');
    w.webContents.send('imprimir:trabajo', trabajo);
    const info = await listo;
    if (info && info.error) throw new Error(info.error);
    const pdf = await w.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { marginType: 'none' }, displayHeaderFooter: false });
    return { pdf, info };
  } finally { w.destroy(); }
}
const pendientes = {};
ipcMain.on('imprimir:listo', (e, info) => { const f = pendientes[e.sender.id]; if (f) f(info); });

// Imposición en cuadernillos plegados (cosido a caballete por cuadernillo).
async function imponer(bytes, { pliego = 16, mmPagina }) {
  const src = await PDFDocument.load(bytes);
  const n = src.getPageCount();
  const [pw, ph] = [mmPagina[0] * MM, mmPagina[1] * MM];
  const out = await PDFDocument.create();
  const paginas = await out.embedPdf(src, src.getPageIndices());
  const tam = pliego === 0 ? Math.ceil(n / 4) * 4 : pliego;
  const grupos = [];
  for (let i = 0; i < n; i += tam) {
    const resto = Math.min(tam, n - i), t = Math.ceil(resto / 4) * 4;
    grupos.push({ inicio: i, t });
  }
  const mapa = [];
  for (const [gi, g] of grupos.entries()) {
    for (let k = 0; k < g.t / 4; k++) {
      const caras = [[g.t - 2 * k, 1 + 2 * k], [2 + 2 * k, g.t - 1 - 2 * k]];
      for (const [ci, [a, b]] of caras.entries()) {
        const hoja = out.addPage([pw * 2, ph]);
        for (const [lado, num] of [[0, a], [1, b]]) {
          const idx = g.inicio + num - 1;
          if (idx < n && num <= g.t && idx < g.inicio + tam) hoja.drawPage(paginas[idx], { x: lado * pw, y: 0, width: pw, height: ph });
        }
        mapa.push({ cuadernillo: gi + 1, hoja: k + 1, cara: ci ? 'dorso' : 'frente', izquierda: g.inicio + a <= n ? g.inicio + a : null, derecha: g.inicio + b <= n ? g.inicio + b : null });
      }
    }
  }
  return { bytes: await out.save(), mapa, blancas: grupos.reduce((s, g) => s + g.t, 0) - n };
}

ipcMain.handle('pdf:generar', async (_e, { trabajo, nombre, guardar = true }) => {
  const { pdf, info } = await componerPDF(trabajo);
  let bytes = pdf, extra = {};
  if (trabajo.tipo === 'pliegos') { const r = await imponer(pdf, trabajo.imposicion); bytes = Buffer.from(r.bytes); extra = { mapa: r.mapa, blancas: r.blancas }; }
  const doc = await PDFDocument.load(bytes);
  const p0 = doc.getPage(0).getSize();
  const resultado = { paginas: doc.getPageCount(), mm: [Math.round(p0.width / MM * 10) / 10, Math.round(p0.height / MM * 10) / 10], info, ...extra };
  if (!guardar) return { ...resultado, b64: Buffer.from(bytes).toString('base64') };
  const r = await dialog.showSaveDialog(ventana, { title: 'Guardar PDF', defaultPath: nombre, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled) return { cancelado: true };
  await fsp.writeFile(r.filePath, bytes);
  return { ...resultado, ruta: r.filePath };
});

// Para pruebas automáticas: generar sin diálogo a una ruta dada.
ipcMain.handle('pdf:generar-a', async (_e, { trabajo, ruta }) => {
  const { pdf, info } = await componerPDF(trabajo);
  let bytes = pdf, extra = {};
  if (trabajo.tipo === 'pliegos') { const r = await imponer(pdf, trabajo.imposicion); bytes = Buffer.from(r.bytes); extra = { mapa: r.mapa, blancas: r.blancas }; }
  await fsp.writeFile(ruta, bytes);
  const doc = await PDFDocument.load(bytes); const p0 = doc.getPage(0).getSize();
  return { ruta, paginas: doc.getPageCount(), mm: [p0.width / MM, p0.height / MM], info, ...extra };
});
module.exports = { imponer };
