// Folio · proceso principal (Electron)
// Ventana sin red: todo se sirve desde folio://app/ y los manuscritos nunca salen del equipo.
'use strict';
const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell, session, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { pathToFileURL } = require('url');
const JSZip = require('jszip');
const Equipo = require('./equipo');
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
  if (/^https:\/\/(commons\.wikimedia\.org|archive\.org|www\.biodiversitylibrary\.org|creativecommons\.org|github\.com\/jotajimene\/Folio\/releases)\//.test(url) || url === 'https://github.com/jotajimene/Folio/releases') shell.openExternal(url);
}

app.whenReady().then(() => {
  require('./modelo-local').registrar();
  Externas.registrar(RAIZ);
  protocol.handle('folio', req => {
    const u = new URL(req.url);
    if (u.host === 'datos') { // solo lo generado o traído en este equipo: vectores y archivo ampliado
      const pn = decodeURIComponent(u.pathname), extra = pn.startsWith('/archivo/');
      const base = extra ? Externas.carpetaExtra() : Externas.carpetaVect(), ruta = path.normalize(path.join(base, pn.replace(/^\/(vectores|archivo)\//, '')));
      if (!ruta.startsWith(base)) return new Response('No', { status: 403 });
      if (!fs.existsSync(ruta)) return new Response('', { status: 404 });
      return net.fetch(pathToFileURL(ruta).toString());
    }
    const ruta = path.normalize(path.join(RAIZ, decodeURIComponent(u.pathname)));
    if (!ruta.startsWith(RAIZ)) return new Response('No', { status: 403 });
    return net.fetch(pathToFileURL(ruta).toString());
  });
  // micrófono para el dictado (solo la ventana de Folio); nada más
  session.defaultSession.setPermissionRequestHandler((wc, permiso, cb, d) => cb(permiso === 'media' && /^folio:/.test((d && d.requestingUrl) || wc.getURL()) && !(d && d.mediaTypes || []).includes('video')));
  session.defaultSession.setPermissionCheckHandler((wc, permiso, origen) => permiso === 'media' && /^folio:/.test(origen || ''));
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
      { type: 'separator' }, { label: 'Modelo de texto local…', click: () => ventana.webContents.send('menu', 'modelo') }, { label: 'Archivo de grabados', click: () => ventana.webContents.send('menu', 'archivo-grabados') }, { label: 'Herramientas de Folio…', click: () => ventana.webContents.send('menu', 'herramientas') }, { label: 'Carpeta de trabajo…', click: () => ventana.webContents.send('menu', 'carpeta-trabajo') },
      { type: 'separator' }, { label: 'Buscar actualizaciones…', click: () => ventana.webContents.send('menu', 'actualizar') },
      { type: 'separator' }, { role: 'quit', label: 'Salir' }] },
    { label: 'Editar', submenu: [{ label: 'Deshacer', accelerator: 'CmdOrCtrl+Z', click: () => ventana.webContents.send('menu', 'deshacer') }, { label: 'Rehacer', accelerator: 'CmdOrCtrl+Y', click: () => ventana.webContents.send('menu', 'rehacer') }, { type: 'separator' }, { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' }] },
    { label: 'Ver', submenu: [{ role: 'reload', label: 'Recargar' }, { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }, { type: 'separator' }, { role: 'resetZoom', label: 'Tamaño real' }, { role: 'zoomIn', label: 'Acercar' }, { role: 'zoomOut', label: 'Alejar' }, { role: 'togglefullscreen', label: 'Pantalla completa' }] },
  ]));
  crearVentana();
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => Equipo.soltarTodo());

// ---------------- proyecto ----------------
// Un .folio es un ZIP: proyecto.json + recursos/ (imágenes y fuentes propias) + original/ (archivos importados)
async function empaquetar(datos) {
  const zip = new JSZip();
  const { proyecto, recursos = {}, originales = {} } = datos;
  zip.file('proyecto.json', JSON.stringify(proyecto, null, 1));
  for (const [nombre, b64] of Object.entries(recursos)) zip.file('recursos/' + nombre, b64, { base64: true });
  for (const [nombre, b64] of Object.entries(originales)) zip.file('original/' + nombre, b64, { base64: true });
  zip.file('guardado.json', JSON.stringify({ equipo: Equipo.nombreEquipo(), fecha: new Date().toISOString(), version: require('./package.json').version }));
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
// cuándo se leyó o guardó cada libro en este equipo: si en el disco aparece una versión posterior (el otro computador
// la guardó en la carpeta compartida), Folio pregunta antes de pisarla
const vistos = new Map();
let rutaActual = null;
async function quienGuardo(ruta) { try { const z = await JSZip.loadAsync(await fsp.readFile(ruta)); const f = z.file('guardado.json'); return f ? JSON.parse(await f.async('string')) : null; } catch { return null; } }
async function tomar(ruta) { if (rutaActual && rutaActual !== ruta) await Equipo.soltar(rutaActual); rutaActual = ruta; return ruta ? Equipo.marcarAbierto(ruta) : null; }
ipcMain.handle('proyecto:guardar', async (_e, { ruta, datos, como, forzar, sugerido }) => {
  if (!ruta || como) {
    const dir = Equipo.carpetaProyectos(); if (dir) await fsp.mkdir(dir, { recursive: true }).catch(() => {});
    const nombre = (sugerido || datos.proyecto.titulo || 'libro').replace(/[\\/:*?"<>|]/g, '') + '.folio';
    const r = await dialog.showSaveDialog(ventana, { title: 'Guardar proyecto de Folio', defaultPath: dir ? path.join(dir, nombre) : nombre, filters: [{ name: 'Proyecto de Folio', extensions: ['folio'] }] });
    if (r.canceled) return { cancelado: true };
    ruta = r.filePath;
  } else if (!forzar && fs.existsSync(ruta) && vistos.has(ruta)) {
    const m = (await fsp.stat(ruta)).mtimeMs;
    if (m > vistos.get(ruta) + 1500) { const q = await quienGuardo(ruta); return { conflicto: { equipo: q && q.equipo || 'otro computador', fecha: q && q.fecha || new Date(m).toISOString(), mismo: !!(q && q.equipo === Equipo.nombreEquipo()) }, ruta }; }
  }
  const buf = await empaquetar(datos);
  // escritura segura: archivo temporal y renombre; se guarda la versión anterior como .bak
  const tmp = ruta + '.tmp';
  await fsp.writeFile(tmp, buf);
  if (fs.existsSync(ruta)) await fsp.copyFile(ruta, ruta + '.bak').catch(() => {});
  await fsp.rename(tmp, ruta);
  vistos.set(ruta, (await fsp.stat(ruta)).mtimeMs);
  if (rutaActual !== ruta) await tomar(ruta);
  const respaldo = await respaldar(ruta).catch(e => ({ error: e.message }));
  return { ruta, bytes: buf.length, fecha: new Date().toISOString(), respaldo };
});
// copia en una segunda carpeta (un pendrive, Dropbox, otro disco): las últimas 5 de cada libro
async function respaldar(ruta) {
  const perfil = await Equipo.leerPerfil().catch(() => null);
  const dir = perfil && perfil.respaldo; if (!dir) return null;
  if (!fs.existsSync(dir)) return { error: 'La carpeta de respaldo no está disponible: ' + dir };
  const base = path.basename(ruta, '.folio'), sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const dest = path.join(dir, `${base} · ${sello}.folio`);
  await fsp.copyFile(ruta, dest);
  const mias = (await fsp.readdir(dir)).filter(f => f.startsWith(base + ' · ') && f.endsWith('.folio')).sort();
  for (const f of mias.slice(0, Math.max(0, mias.length - 5))) await fsp.unlink(path.join(dir, f)).catch(() => {});
  return { ruta: dest };
}
ipcMain.handle('carpeta:elegir', async (_e, titulo) => { const r = await dialog.showOpenDialog(ventana, { title: titulo || 'Elegir carpeta', properties: ['openDirectory', 'createDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
ipcMain.handle('proyecto:abrir', async (_e, ruta) => {
  if (!ruta) {
    const dir = Equipo.carpetaProyectos();
    const r = await dialog.showOpenDialog(ventana, { title: 'Abrir proyecto de Folio', defaultPath: dir || undefined, filters: [{ name: 'Proyecto de Folio', extensions: ['folio', 'json'] }], properties: ['openFile'] });
    if (r.canceled) return { cancelado: true };
    ruta = r.filePaths[0];
  }
  const buf = await fsp.readFile(ruta);
  if (ruta.endsWith('.json')) return { ruta: null, datos: { proyecto: JSON.parse(buf.toString('utf8')), recursos: {}, originales: {} }, heredado: true };
  const datos = await desempaquetar(buf);
  vistos.set(ruta, (await fsp.stat(ruta)).mtimeMs);
  const enUso = await tomar(ruta);
  return { ruta, datos, enUso, guardado: await quienGuardo(ruta) };
});
ipcMain.handle('proyecto:soltar', () => tomar(null));
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
  let d; try { d = JSON.parse(await fsp.readFile(autoguardado(), 'utf8')); } catch { return null; }
  // si el libro se guardó después en otro computador (carpeta compartida), la copia de este equipo quedó atrasada
  try {
    if (d && d.ruta && fs.existsSync(d.ruta)) {
      const disco = (await fsp.stat(d.ruta)).mtimeMs, copia = (await fsp.stat(autoguardado())).mtimeMs;
      if (disco > copia + 2000) { const q = await quienGuardo(d.ruta); if (!q || q.equipo !== Equipo.nombreEquipo()) d.discoMasNuevo = { equipo: q && q.equipo || 'otro computador', fecha: q && q.fecha || new Date(disco).toISOString() }; }
      if (!d.discoMasNuevo) { vistos.set(d.ruta, disco); d.enUso = await tomar(d.ruta); }
    }
  } catch {}
  return d;
});
ipcMain.handle('archivo:guardar', async (_e, { nombre, b64, filtros }) => {
  const r = await dialog.showSaveDialog(ventana, { defaultPath: nombre, filters: filtros || [] });
  if (r.canceled) return { cancelado: true };
  await fsp.writeFile(r.filePath, Buffer.from(b64, 'base64'));
  return { ruta: r.filePath };
});
// perfil de la editorial: datos que valen para todos los libros (sello, logo, paletas propias, numeración, tipografías)
// con carpeta de trabajo, el perfil vive ahí (ver equipo.js)
ipcMain.handle('perfil:leer', () => Equipo.leerPerfil());
ipcMain.handle('perfil:guardar', (_e, datos) => Equipo.guardarPerfil(datos));
// carpeta de trabajo: la elige cada persona en su computador
ipcMain.handle('trabajo:estado', () => ({ carpeta: Equipo.carpeta(), elegida: Equipo.carpetaElegida(), equipo: Equipo.nombreEquipo() }));
ipcMain.handle('trabajo:elegir', async () => {
  const r = await dialog.showOpenDialog(ventana, { title: 'Carpeta de trabajo de Folio (por ejemplo, una carpeta de Google Drive)', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled) return { cancelado: true };
  return Equipo.usarCarpeta(r.filePaths[0]);
});
ipcMain.handle('trabajo:dejar', () => Equipo.usarCarpeta(null));
// abrir archivos sueltos (tipografías, imágenes, Word de vuelta del corrector) sin pasar por un input
ipcMain.handle('archivo:elegir', async (_e, { titulo, filtros, multiple }) => {
  const r = await dialog.showOpenDialog(ventana, { title: titulo, filters: filtros || [], properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'] });
  if (r.canceled) return [];
  return Promise.all(r.filePaths.map(async f => ({ nombre: path.basename(f), b64: (await fsp.readFile(f)).toString('base64') })));
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

const Impresion = require('./impresion');
const Externas = require('./herramientas-externas');
// tapa como imagen PNG (para el libro digital): se compone en una ventana oculta y se fotografía
async function tapaPNG(trabajo, k = 2) {
  const mm = trabajo.mm; const ancho = Math.round(mm[0] * 96 / 25.4), alto = Math.round(mm[1] * 96 / 25.4);
  const w = new BrowserWindow({ show: false, width: ancho, height: alto, useContentSize: true, webPreferences: { preload: path.join(__dirname, 'preload-imprimir.js'), contextIsolation: true, sandbox: true, zoomFactor: 1, offscreen: false } });
  try {
    const listo = new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('La tapa tardó demasiado.')), 60000); pendientes[w.webContents.id] = info => { clearTimeout(t); delete pendientes[w.webContents.id]; res(info); }; });
    await w.loadURL('folio://app/imprimir.html');
    w.webContents.send('imprimir:trabajo', { ...trabajo, tipo: 'cubierta' });
    await listo;
    await new Promise(r => setTimeout(r, 400)); // que termine de pintar
    const img = await w.webContents.capturePage({ x: 0, y: 0, width: ancho, height: alto });
    return img.resize({ width: Math.round(ancho * k), quality: 'best' }).toPNG();
  } finally { w.destroy(); }
}
ipcMain.handle('cubierta:png', async (_e, trabajo) => (await tapaPNG(trabajo, trabajo.escala || 2)).toString('base64'));
// componer + (numerar) + (imponer): devuelve los bytes finales y un resumen
async function procesar(trabajo) {
  if (trabajo.tipo === 'prueba') { const r = await Impresion.pruebaDuplex(trabajo.imposicion.mmPagina); return { bytes: Buffer.from(r.bytes), extra: {}, info: null }; }
  const { pdf, info } = await componerPDF(trabajo);
  let bytes = pdf, extra = {};
  const num = trabajo.numeracion;
  if (num && num.hasta >= num.desde && trabajo.tipo !== 'cubierta') {
    // cada ejemplar se impone por separado para que los pliegos de uno no se mezclen con los del siguiente
    if (trabajo.tipo === 'pliegos') {
      const final = await PDFDocument.create(); let mapa = null, blancas = 0, instrucciones = '';
      for (let e = num.desde; e <= num.hasta; e++) {
        const una = await Impresion.numerar(pdf, { desde: e, hasta: e, total: num.total, texto: num.texto });
        const imp = await Impresion.imponer(una.bytes, trabajo.imposicion); mapa = mapa || imp.mapa; blancas = imp.blancas; instrucciones = imp.instrucciones;
        const d = await PDFDocument.load(imp.bytes); (await final.copyPages(d, d.getPageIndices())).forEach(p => final.addPage(p));
      }
      bytes = Buffer.from(await final.save()); extra = { mapa, blancas, instrucciones, ejemplares: num.hasta - num.desde + 1 };
    } else { const r = await Impresion.numerar(pdf, { ...num }); bytes = Buffer.from(r.bytes); extra = { ejemplares: r.ejemplares }; }
  } else if (trabajo.tipo === 'pliegos') { const r = await Impresion.imponer(pdf, trabajo.imposicion); bytes = Buffer.from(r.bytes); extra = { mapa: r.mapa, blancas: r.blancas, instrucciones: r.instrucciones }; }
  if (trabajo.opciones && trabajo.opciones.pdfx && (trabajo.tipo === 'lectura' || trabajo.tipo === 'cubierta')) {
    const tmp = path.join(require('os').tmpdir(), 'folio-' + Date.now()), ent = tmp + '-rgb.pdf', sal = tmp + '-x.pdf';
    await fsp.writeFile(ent, bytes);
    try {
      await Externas.aPDFX(ent, sal, { titulo: (trabajo.proyecto && trabajo.proyecto.titulo) || 'Folio' });
      bytes = await fsp.readFile(sal);
      const t = await Externas.tinta(sal).catch(() => null);
      if (t && t.length) extra.tinta = { maxima: Math.max(...t.map(x => x.tac ?? x.total)), media: t.reduce((a, x) => a + x.total, 0) / t.length, paginas: t.length, peor: t.findIndex(x => (x.tac ?? x.total) === Math.max(...t.map(y => y.tac ?? y.total))) + 1 };
      extra.pdfx = true;
    } finally { fsp.unlink(ent).catch(() => {}); fsp.unlink(sal).catch(() => {}); }
  }
  return { bytes, extra, info };
}
async function resumen(bytes) { const doc = await PDFDocument.load(bytes); const p0 = doc.getPage(0).getSize(); return { paginas: doc.getPageCount(), mm: [Math.round(p0.width / MM * 10) / 10, Math.round(p0.height / MM * 10) / 10] }; }

ipcMain.handle('pdf:generar', async (_e, { trabajo, nombre, guardar = true }) => {
  const { bytes, extra, info } = await procesar(trabajo);
  const resultado = { ...(await resumen(bytes)), info, ...extra };
  if (!guardar) return { ...resultado, b64: Buffer.from(bytes).toString('base64') };
  const r = await dialog.showSaveDialog(ventana, { title: 'Guardar PDF', defaultPath: nombre, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled) return { cancelado: true };
  await fsp.writeFile(r.filePath, bytes);
  return { ...resultado, ruta: r.filePath };
});

// Para pruebas automáticas: generar sin diálogo a una ruta dada.
ipcMain.handle('pdf:generar-a', async (_e, { trabajo, ruta }) => {
  const { bytes, extra, info } = await procesar(trabajo);
  await fsp.writeFile(ruta, bytes);
  return { ruta, ...(await resumen(bytes)), info, ...extra };
});
module.exports = { procesar };
