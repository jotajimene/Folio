// Folio · prueba de la versión 2.2: edición facsimilar, tipografía fina, guardas y portadillas, imprenta (vectores, PDF/X, tinta),
// herramientas de escritura, archivo ampliado, respaldo y búsqueda de actualizaciones.
'use strict';
const { app } = require('electron');
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const SALIDA = process.env.FOLIO_SALIDA || '/tmp/folio-e2e3';
fs.rmSync(SALIDA, { recursive: true, force: true }); fs.mkdirSync(SALIDA, { recursive: true });
app.setPath('userData', path.join(SALIDA, 'datos'));
require(process.env.FOLIO_MAIN || '../main.js');
const resultados = [];
const esperar = ms => new Promise(r => setTimeout(r, ms));
let empezado = false;
app.on('browser-window-created', (_e, w) => {
  if (empezado) return; empezado = true;
  w.webContents.on('console-message', (_e, nivel, msg) => { if (nivel >= 2) fs.appendFileSync(path.join(SALIDA, 'consola.txt'), msg + '\n'); });
  w.webContents.once('did-finish-load', () => correr(w).catch(e => { resultados.push({ paso: 'FALLO GENERAL', ok: false, detalle: String(e.stack || e) }); fin(); }));
});
function fin() {
  fs.writeFileSync(path.join(SALIDA, 'resultados.json'), JSON.stringify(resultados, null, 1));
  console.log(resultados.map(r => `${r.ok ? 'OK  ' : 'FALLA'} ${r.paso} ${r.detalle ? '· ' + (typeof r.detalle === 'string' ? r.detalle : JSON.stringify(r.detalle)).slice(0, 300) : ''}`).join('\n'));
  app.exit(0);
}
async function correr(w) {
  const js = code => w.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const foto = async nombre => { await esperar(500); const im = await w.webContents.capturePage(); fs.writeFileSync(path.join(SALIDA, nombre + '.png'), im.toPNG()); };
  const paso = async (nombre, f) => { try { const d = await f(); resultados.push({ paso: nombre, ok: d && d.ok !== false, detalle: d }); } catch (e) { resultados.push({ paso: nombre, ok: false, detalle: String(e.stack || e) }); } };
  const hasta = async (cond, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(`return !!(${cond})`)) return true; await esperar(250); } return false; };
  const b64 = f => fs.readFileSync(path.join(__dirname, 'insumos', f)).toString('base64');
  const archivo = (f, tipo) => `new File([Uint8Array.from(atob(${JSON.stringify(b64(f))}),c=>c.charCodeAt(0))], ${JSON.stringify(f)}, {type:${JSON.stringify(tipo)}})`;
  const componer = async () => { await js(`App.ir(3, { sinPrensa: true, forzar: true })`); await hasta(`App.etapas[3]._componiendo()`, 10000); await hasta(`!App.etapas[3]._componiendo() && document.querySelector('.vista-libro:not(.cargando)')`, 180000); await esperar(800); return js(`return App.etapas[3]._resultado()`); };
  const vistaDoc = `document.querySelector('.vista-libro:not(.cargando)').contentDocument`;
  const pdf = async (nombre, extra, tipo = 'lectura') => { const ruta = path.join(SALIDA, nombre); const r = await js(`const t = App.etapas[5].trabajoBase('${tipo}'); ${extra}; return await Escritorio.pdfA(t, ${JSON.stringify(ruta)});`); return { ...r, ruta, bytes: fs.statSync(ruta).size }; };
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  await hasta(`document.documentElement.dataset.listo==='1'`);

  // ---------------- edición facsimilar ----------------
  const GUIAS = [0.1471, 0.2382, 0.3294, 0.4224, 0.51, 0.5976, 0.6829, 0.7676];
  const TRANS = ['En el nombre de Dios, amén. Sepan q{ua}ntos', 'esta carta vieren como yo, Juan de Medina,', 'vecino d{e}sta ciudad, otorgo e conozco que', 'vendo a vos, Martín de Olmos, una casa con', 'su huerta que es en la collación de San', 'Andrés, que ha por linderos casas de Pero', 'Gómez e la calle real, por precio de mill', 'maravedís, los [-quales-] de vos [?rescebí?].{{Firma ilegible al pie.}}'];
  await paso('Facsímil: importar un folio, transcribir con marcas y marcar renglones', async () => {
    await js(`Folio.nuevoProyecto(); Folio.cambiar('facsimil:vista', p => { p.tipo = 'facsimil'; p.titulo = 'Carta de venta'; p.facsimil = { folios: [], modo: 'paleografica', numerarCada: 5 }; }); await Facsimil.importar([${archivo('folio-manuscrito.jpg', 'image/jpeg')}]);`);
    await js(`Folio.cambiar('facsimil:texto', p => { const f = p.facsimil.folios[0]; f.transcripcion = ${JSON.stringify(TRANS.join('\n'))}; f.guias = ${JSON.stringify(GUIAS)}; f.etiqueta = '1r'; })`);
    await js(`App.ir(0, { sinPrensa: true, forzar: true })`); await esperar(800); await foto('01-facsimil-editor');
    return js(`const f = Folio.p.facsimil.folios[0]; return { ok: Facsimil.activo() && !!Folio.recursos[f.recurso] && f.guias.length === 8 && !!document.querySelector('.fx-area'), lineasEditor: document.querySelector('.fx-numeros').textContent.split('\\n').length, w: f.w, h: f.h }`);
  });
  await paso('Facsímil compuesto: imagen a la izquierda, transcripción a la derecha, renglón a renglón', async () => {
    const r = await componer(); await esperar(400); await foto('02-facsimil-libro');
    return js(`const d = ${vistaDoc};
      const fig = d.querySelector('figure.fac-img'), txt = d.querySelector('.fac-txt');
      const pgI = fig.closest('.pagedjs_page'), pgD = txt.closest('.pagedjs_page');
      const img = fig.querySelector('img').getBoundingClientRect(), cI = pgI.querySelector('.pagedjs_page_content').getBoundingClientRect(), cD = pgD.querySelector('.pagedjs_page_content').getBoundingClientRect();
      const zoom = parseFloat(d.querySelector('.pagedjs_pages').style.zoom || 1);
      const mm = px => px / zoom / 96 * 25.4;
      const lineas = [...txt.querySelectorAll('.l')];
      // posición vertical de cada guía en la página izquierda frente a la línea base aproximada de su línea en la derecha
      const dif = ${JSON.stringify(GUIAS)}.map((g, i) => { const y1 = img.top + g * img.height - cI.top, s = lineas[i].getBoundingClientRect(), fs = parseFloat(getComputedStyle(lineas[i]).fontSize) * zoom; const y2 = s.top + fs * 0.85 - cD.top; return +mm(y2 - y1).toFixed(2); });
      const izqPar = +pgI.dataset.pageNumber % 2 === 0, derImpar = +pgD.dataset.pageNumber % 2 === 1;
      const html = txt.innerHTML;
      return { ok: izqPar && derImpar && +pgD.dataset.pageNumber === +pgI.dataset.pageNumber + 1 && lineas.length === 8 && Math.max(...dif.map(Math.abs)) < 2.5 && /<del/.test(html) && /quales/.test(html) && /class="[^"]*abrev|<i|<em/.test(html) && txt.classList.contains('alineado'),
        paginas: ${r.paginas}, izquierda: pgI.dataset.pageNumber, derecha: pgD.dataset.pageNumber, lineas: lineas.length, desfaseMm: dif, numeradas: [...txt.querySelectorAll('[data-n]')].map(x => x.dataset.n), muestra: lineas[7].innerHTML.slice(0, 220) }`);
  });
  await paso('Facsímil en modo de lectura: el texto queda limpio', async () => {
    await js(`Folio.cambiar('ajuste:facsimil', p => { p.facsimil.modo = 'lectura'; })`);
    await componer();
    return js(`const t = ${vistaDoc}.querySelector('.fac-txt'); const l = [...t.querySelectorAll('.l')].map(x => x.textContent); return { ok: !/quales/.test(l[7]) && /quantos/.test(l[0]) && !/\\[|\\{/.test(l.join('')), l0: l[0], l7: l[7] }`);
  });
  await paso('Facsímil en PDF', async () => { const r = await pdf('facsimil.pdf', ''); const txt = execSync(`pdftotext ${JSON.stringify(r.ruta)} -`).toString(); return { ok: r.paginas >= 2 && /Medina/.test(txt), paginas: r.paginas, mm: r.mm }; });

  // ---------------- tipografía fina, guardas y portadillas ----------------
  await paso('Novela: justificación Knuth-Plass medida con la fuente real', async () => {
    await js(`Folio.nuevoProyecto(); await App.etapas[0].importar([${archivo('prueba.docx', DOCX)}])`); await hasta(`Folio.p.bloques.length > 50`, 30000);
    const r = await componer();
    const m = await js(`const d = ${vistaDoc}; const ps = [...d.querySelectorAll('.pagedjs_page_content p.fina')].filter(p => p.querySelector('br'));
      const ancho = ps[0] ? ps[0].getBoundingClientRect().width : 0; let lineas = 0, malas = 0;
      for (const p of ps.slice(0, 12)) { const spans = [...p.querySelectorAll(':scope > span:not(.sangria-fina)')]; spans.slice(0, -1).forEach(s => { lineas++; const r = s.getBoundingClientRect(); const pr = p.getBoundingClientRect(); if (Math.abs(r.right - pr.right) > 2.5) malas++; }); }
      return { finos: ps.length, lineas, malas, ancho }`);
    await js(`Folio.cambiar('ajuste:cuerpo', p => { p.ajustes.cuerpo = 13; })`); await hasta(`App.etapas[3]._componiendo()`, 5000); await hasta(`!App.etapas[3]._componiendo()`, 180000); await esperar(600);
    const r2 = await js(`return App.etapas[3]._resultado()`);
    await js(`Folio.cambiar('ajuste:cuerpo', p => { p.ajustes.cuerpo = 11; })`); await hasta(`!App.etapas[3]._componiendo()`, 180000);
    await foto('03-justificacion');
    return { ok: m.finos > 5 && m.lineas > 20 && m.malas <= Math.ceil(m.lineas * 0.05) && r2.paginas > r.paginas, paginas11: r.paginas, paginas13: r2.paginas, ...m, viudasArregladas: r.arreglosFinos, parrafosAjustados: r.ajustados };
  });
  await paso('Viudas y huérfanas: avisos que quedan tras el arreglo automático', async () => {
    const r = await componer();
    const v = r.avisos.filter(a => a.tipo === 'viuda' || a.tipo === 'huerfana');
    await js(`Folio.cambiar('ajuste:viudasAuto', p => { p.ajustes.viudasAuto = false; })`); const s = await componer();
    const v2 = s.avisos.filter(a => a.tipo === 'viuda' || a.tipo === 'huerfana');
    await js(`Folio.cambiar('ajuste:viudasAuto', p => { p.ajustes.viudasAuto = true; })`);
    return { ok: v.length <= v2.length, conArreglo: v.length, sinArreglo: v2.length, ajustados: r.ajustados };
  });
  await paso('Guardas ilustradas y portadillas con grabado', async () => {
    await js(`Folio.cambiar('ajuste:guardas', p => { p.guardas = { modo: 'libro', estilo: 'patron' }; p.ajustes.portadillas = 'pagina'; })`);
    const r = await componer(); await foto('04-guardas-portadillas');
    return js(`const d = ${vistaDoc}; return { ok: d.querySelectorAll('.guarda').length >= 2 && d.querySelectorAll('.portadilla-ilus img').length >= 3 && !!Folio.recursos['guarda.png'], guardas: d.querySelectorAll('.guarda').length, portadillas: d.querySelectorAll('.portadilla-ilus').length, paginas: ${r.paginas} }`);
  });
  await paso('Cifras antiguas y versalitas de la fuente', async () => js(`const d = ${vistaDoc}; const h = getComputedStyle(d.documentElement); const p = d.querySelector('p.primero'); return { ok: /oldstyle/.test(h.fontVariantNumeric) && !!p, numeros: h.fontVariantNumeric, fuente: h.fontFamily.split(',')[0] }`));
  await paso('Interlineado de registro', async () => {
    await js(`Folio.cambiar('ajuste:registro', p => { p.ajustes.registro = true; })`); await componer();
    const r = await js(`const d = ${vistaDoc}; const pg = [...d.querySelectorAll('.pagedjs_page')].find(x => x.querySelectorAll('p').length > 6); const ps = [...pg.querySelectorAll('.pagedjs_page_content p')]; const lh = parseFloat(getComputedStyle(ps[0]).lineHeight) * parseFloat(d.querySelector('.pagedjs_pages').style.zoom || 1); const top0 = pg.querySelector('.pagedjs_page_content').getBoundingClientRect().top; const fuera = ps.map(p => ((p.getBoundingClientRect().top - top0) / lh) % 1).map(x => Math.min(x, 1 - x)); return { max: Math.max(...fuera), n: ps.length }`);
    await js(`Folio.cambiar('ajuste:registro', p => { p.ajustes.registro = false; })`);
    return { ok: r.max < 0.08, ...r };
  });

  // ---------------- imprenta ----------------
  await paso('Vectorizar grabados con Potrace', async () => {
    const r = await js(`const ids = ['L0000', 'L0010']; await App.asegurarVectores(ids); const svg = await (await fetch('folio://datos/vectores/L0000.svg')).text(); return { ids: App.vectores.filter(x => ids.includes(x)), largo: svg.length, paths: (svg.match(/<path/g) || []).length }`);
    return { ok: r.ids.length === 2 && r.largo > 500 && r.paths > 0, ...r };
  });
  await paso('PDF/X-3 en CMYK con FOGRA39 y medición de tinta', async () => {
    const r = await pdf('imprenta-pdfx.pdf', `t.opciones.imprenta = true; t.opciones.pdfx = true;`);
    const crudo = fs.readFileSync(r.ruta).toString('latin1');
    const info = execSync(`pdfinfo ${JSON.stringify(r.ruta)}`).toString();
    return { ok: r.pdfx && /GTS_PDFX/.test(crudo) && /OutputIntent/.test(crudo) && /FOGRA39/.test(crudo) && r.tinta && r.tinta.maxima > 0 && r.tinta.maxima <= 400, tinta: r.tinta, paginas: r.paginas, productor: (info.match(/Producer:\s*(.*)/) || [])[1] };
  });
  await paso('Cubierta en PDF/X', async () => { const r = await pdf('cubierta-pdfx.pdf', `t.opciones = { ...(t.opciones || {}), pdfx: true }`, 'cubierta'); const crudo = fs.readFileSync(r.ruta).toString('latin1'); return { ok: r.pdfx && /GTS_PDFX/.test(crudo), tinta: r.tinta, mm: r.mm }; });

  // ---------------- escritura ----------------
  await paso('Nombres: encuentra variantes y unifica con permiso', async () => {
    const texto = ['# Uno', 'Martín llegó tarde. Le esperaba Elvira en la puerta con la carta de Martín.', 'Después Elvira le dijo a Martin que no volviera. El perro de Martín ladró.', '# Dos', 'Martín y Elvria caminaron hasta el puerto de Valparaíso, donde Elvira tenía una casa.', 'Martín pensó en Valparaíso toda la noche. Juan y Juana no dijeron nada.'].join('\n\n');
    await js(`Folio.nuevoProyecto(); const nuevos = FolioImport.textBlocks(${JSON.stringify(texto)}); Folio.cambiar('importar', p => { p.bloques = nuevos.map(b => ({ id: Folio.uid(), tipo: b.kind === 'heading' ? 'h1' : 'p', texto: b.text, runs: null })); p.original = p.bloques.map(b => ({ ...b })); });`);
    const r = await js(`const L = Escritura.nombres(Folio.p); const G = Escritura.variantes(L); return { nombres: L.map(x => x.nombre + ':' + x.n), grupos: G.map(g => g.map(x => x.nombre).join('/')) }`);
    await js(`Escritura.ventanaNombres()`); await esperar(500); await foto('05-nombres');
    const n = await js(`document.querySelector('.modal .cerrar').click(); return Escritura.unificar('Martin', 'Martín')`);
    const t = await js(`return Folio.p.bloques.map(b => b.texto).join(' ')`);
    await js(`Folio.deshacerUltimo()`);
    const t2 = await js(`return Folio.p.bloques.map(b => b.texto).join(' ')`);
    return { ok: r.grupos.some(g => /Martín\/Martin/.test(g)) && r.grupos.some(g => /Elvira\/Elvria/.test(g)) && !r.grupos.some(g => /Juan\/Juana/.test(g)) && n === 1 && !/Martin\b/.test(t) && /Martin\b/.test(t2), ...r, cambiados: n };
  });
  await paso('Radiografía del texto', async () => {
    await js(`Folio.nuevoProyecto(); await App.etapas[0].importar([${archivo('prueba.docx', DOCX)}])`); await hasta(`Folio.p.bloques.length > 50`, 30000);
    const r = await js(`const r = Escritura.radiografia(Folio.p); return { total: r.total, oraciones: r.ors, capitulos: r.porCap.length, media: +r.media.toFixed(1), legibilidad: Math.round(r.legibilidad), variedad: +r.variedad.toFixed(2), dialogo: +r.dialogo.toFixed(2), frecuentes: r.frecuentes.slice(0, 5).map(x => x[0]), silabas: ['casa', 'murciélago', 'poeta', 'oía', 'guitarra', 'aéreo'].map(Escritura.silabas) }`);
    await js(`Escritura.ventanaRadiografia()`); await esperar(500); await foto('06-radiografia');
    const g = await js(`const n = document.querySelectorAll('.modal .rx-graf').length; document.querySelector('.modal .cerrar').click(); return n`);
    return { ok: r.total > 500 && r.capitulos >= 5 && r.legibilidad > 20 && r.legibilidad < 120 && g >= 4 && r.silabas.join() === '2,4,3,3,3,4', graficos: g, ...r };
  });
  await paso('Dictado: el audio se convierte a WAV de 16 kHz para whisper', async () => js(`
    const off = new OfflineAudioContext(1, 44100, 44100); const o = off.createOscillator(); o.frequency.value = 440; o.connect(off.destination); o.start(); const buf = await off.startRendering();
    const ch = buf.getChannelData(0), dv = new DataView(new ArrayBuffer(44 + ch.length * 2)); const w = (p, s) => [...s].forEach((c, i) => dv.setUint8(p + i, c.charCodeAt(0)));
    w(0,'RIFF'); dv.setUint32(4, 36 + ch.length*2, true); w(8,'WAVEfmt '); dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,1,true); dv.setUint32(24,44100,true); dv.setUint32(28,88200,true); dv.setUint16(32,2,true); dv.setUint16(34,16,true); w(36,'data'); dv.setUint32(40, ch.length*2, true);
    for (let i = 0; i < ch.length; i++) dv.setInt16(44 + i*2, ch[i]*30000, true);
    const b64 = await HerrLocal._aWav16k(dv.buffer); const bin = atob(b64); const v = new DataView(Uint8Array.from(bin, c => c.charCodeAt(0)).buffer);
    const limpio = HerrLocal._limpiarDictado('hola coma qué tal punto y aparte nueva idea punto');
    return { ok: v.getUint32(24, true) === 16000 && v.getUint16(22, true) === 1 && Math.abs(v.getUint32(40, true) / 2 - 16000) < 10 && limpio === 'hola, qué tal.\\n\\nnueva idea.', hz: v.getUint32(24, true), muestras: v.getUint32(40, true) / 2, limpio };`));
  await paso('Herramientas: estado y ventana', async () => {
    const e = await js(`const e = await Escritorio.herr.estado(); await HerrLocal.ventana(); return e`); await esperar(400); await foto('07-herramientas');
    await js(`document.querySelector('.modal .cerrar').click()`);
    return { ok: e.ghostscript && e.opcionales.length === 4 && e.opcionales.every(o => !o.instalada), ghostscript: e.ghostscript, opcionales: e.opcionales.map(o => o.id), windows: e.windows };
  });
  await paso('Herramienta opcional sin instalar: se ofrece, no se impone', async () => {
    const r = await js(`setTimeout(() => { const b = [...document.querySelectorAll('.modal .modal-botones button')][0]; b && b.click(); }, 400); const ok = await HerrLocal.pedirInstalar('languagetool', 'Prueba'); return { ok: ok === false }`);
    return r;
  });

  // ---------------- archivo ampliado ----------------
  await paso('Archivo ampliado: una lámina traída queda en tu carpeta, en el libro y en los créditos', async () => {
    const id = await js(`const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 600, 800); g.fillStyle = '#000'; g.beginPath(); g.arc(300, 400, 220, 0, 6.3); g.fill();
      const lam = c.toDataURL('image/png').split(',')[1]; const mini = lam;
      return await Escritorio.herr.extraGuardar({ ficha: { titulo: 'Prueba.png', pagina: 'https://commons.wikimedia.org/wiki/File:Prueba.png', licencia: 'Public domain', autor: 'Grabador anónimo', fecha: '1520', obra: 'Libro de las esferas', credito: '', tipo: 'figura', w: 600, h: 800, pw: 600, ph: 800 }, laminaB64: lam, miniB64: mini, paginaB64: c.toDataURL('image/jpeg').split(',')[1] });`);
    await js(`await ARCHIVO.cargarExtra()`);
    const r = await js(`const ok = await new Promise(r => { const i = new Image(); i.onload = () => r(i.naturalWidth); i.onerror = () => r(0); i.src = ARCHIVO.src('${id}'); });
      const azarIgual = ARCHIVO.laminas.every(l => !/^X/.test(l.id));
      const B = Folio.p.bloques; Folio.cambiar('ajuste:ilustracion', p => { p.ilustraciones.push({ id: Folio.uid(), lamina: '${id}', despuesDe: B[3].id, modo: 'media', pie: '' }); });
      return { ancho: ok, azarIgual, credito: Libro.procedencias(Folio.p) }`);
    const c = await componer();
    const enLibro = await js(`return [...${vistaDoc}.querySelectorAll('img')].some(i => i.src.includes('${id}') && i.naturalWidth > 0)`);
    await js(`Archivo.abrir({ ficha: '${id}' })`); await esperar(500); await foto('08-archivo-traida'); await js(`Archivo.cerrar()`);
    return { ok: /^X\d{4}$/.test(id) && r.ancho === 600 && r.azarIgual && enLibro && r.credito.some(x => /Libro de las esferas, Grabador anónimo \(Public domain, Wikimedia Commons\)/.test(x)), id, ...r, enLibro, paginas: c.paginas };
  });
  await paso('Búsqueda en Commons sin conexión: falla con un aviso, sin romper nada', async () => js(`try { const r = await Escritorio.herr.buscarCommons('dragon', true); return { ok: Array.isArray(r), resultados: r.length, nota: 'hubo conexión' }; } catch (e) { return { ok: true, error: e.message.slice(0, 120) }; }`));

  // ---------------- respaldo y actualizaciones ----------------
  await paso('Copia de respaldo en una segunda carpeta (se quedan las últimas cinco)', async () => {
    const dir = path.join(SALIDA, 'respaldo'); fs.mkdirSync(dir, { recursive: true });
    const ruta = path.join(SALIDA, 'radiografia.folio');
    const r = await js(`Perfil.datos.respaldo = ${JSON.stringify(dir)}; await Perfil.guardar(); let r; for (let i = 0; i < 7; i++) { r = await Escritorio.guardarProyecto(${JSON.stringify(ruta)}, { proyecto: Folio.p, recursos: {}, originales: {} }, false); await new Promise(x => setTimeout(x, 1100)); } return r`);
    const copias = fs.readdirSync(dir);
    return { ok: !!(r.respaldo && r.respaldo.ruta) && copias.length >= 1 && copias.length <= 5 && copias.every(f => f.startsWith('radiografia · ')), copias };
  });
  await paso('Buscar actualizaciones: responde aunque el repositorio sea privado', async () => js(`const r = await Escritorio.herr.actualizar(); return { ok: !!r.actual && (r.error === 'privado' || r.error === 'red' || typeof r.hay === 'boolean'), ...r, notas: undefined }`));
  await paso('Sin red en la ventana: Commons y GitHub solo desde el proceso principal', async () => js(`let bloqueado = false; try { await fetch('https://commons.wikimedia.org/w/api.php'); } catch { bloqueado = true; } return { ok: bloqueado }`));
  fin();
}
