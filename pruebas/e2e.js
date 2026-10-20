// Folio · prueba de punta a punta dentro de Electron (se ejecuta con: electron pruebas/e2e.js)
// Importa, revisa, compone, genera PDF, guarda y reabre, comprueba que no haya red.
'use strict';
const { app, session } = require('electron');
const path = require('path'), fs = require('fs');
const SALIDA = process.env.FOLIO_SALIDA || '/tmp/folio-e2e';
fs.rmSync(SALIDA, { recursive: true, force: true }); fs.mkdirSync(SALIDA, { recursive: true });
app.setPath('userData', path.join(SALIDA, 'datos'));
require(process.env.FOLIO_MAIN || '../main.js');

const resultados = [], red = [];
const esperar = ms => new Promise(r => setTimeout(r, ms));
app.on('browser-window-created', (_e, w) => {
  if (resultados.started) return; resultados.started = true;
  w.webContents.on('console-message', (_e, nivel, msg) => { if (nivel >= 2) fs.appendFileSync(path.join(SALIDA, 'consola.txt'), msg + '\n'); });
  w.webContents.once('did-finish-load', () => correr(w).catch(e => { resultados.push({ paso: 'FALLO GENERAL', ok: false, detalle: String(e.stack || e) }); fin(); }));
});
app.whenReady().then(() => {
  session.defaultSession.webRequest.onCompleted(d => { if (!/^(folio|data|blob|devtools):/.test(d.url)) red.push(d.url); });
  session.defaultSession.webRequest.onErrorOccurred(d => { if (!/^(folio|data|blob|devtools):/.test(d.url)) red.push('BLOQUEADA ' + d.url); });
});
function fin() {
  fs.writeFileSync(path.join(SALIDA, 'resultados.json'), JSON.stringify(resultados, null, 1));
  console.log(resultados.map(r => `${r.ok ? 'OK  ' : 'FALLA'} ${r.paso} ${r.detalle ? '· ' + (typeof r.detalle === 'string' ? r.detalle : JSON.stringify(r.detalle)).slice(0, 300) : ''}`).join('\n'));
  app.exit(0);
}
async function correr(w) {
  const js = code => w.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const foto = async nombre => { await esperar(400); const im = await w.webContents.capturePage(); fs.writeFileSync(path.join(SALIDA, nombre + '.png'), im.toPNG()); };
  const paso = async (nombre, f) => { try { const d = await f(); resultados.push({ paso: nombre, ok: d && d.ok !== false, detalle: d }); } catch (e) { resultados.push({ paso: nombre, ok: false, detalle: String(e.stack || e) }); } };
  const hasta = async (cond, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(`return !!(${cond})`)) return true; await esperar(250); } return false; };
  const b64 = f => fs.readFileSync(path.join(__dirname, 'insumos', f)).toString('base64');
  const archivo = (f, tipo) => `new File([Uint8Array.from(atob(${JSON.stringify(b64(f))}),c=>c.charCodeAt(0))], ${JSON.stringify(f)}, {type:${JSON.stringify(tipo)}})`;

  await hasta(`document.documentElement.dataset.listo==='1'`);
  await paso('Arranque y bestiario', async () => { const r = await js(`return { vivos: Bestiario.vivos().length, laminas: ARCHIVO.laminas.length, paginas: Object.keys(ARCHIVO.paginas).length, etapa: App.actual }`); return { ok: r.vivos > 3 && r.laminas >= 1000, ...r }; });
  await foto('01-puerta');

  await paso('Importar Word (.docx) con cursivas', async () => {
    await js(`await App.etapas[0].importar([${archivo('prueba.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}])`);
    await hasta(`Folio.p.bloques.length > 0`, 30000);
    const r = await js(`return { bloques: Folio.p.bloques.length, capitulos: Folio.p.bloques.filter(b=>b.tipo==='h1').length, cursiva: Folio.p.bloques.some(b=>b.runs&&b.runs.some(r=>r.italic&&r.text==='nadie')), titulo: Folio.p.titulo, original: Object.keys(Folio.originales) }`);
    return { ok: r.bloques > 50 && r.capitulos === 6 && r.cursiva, ...r };
  });
  await esperar(800); await foto('02-manuscrito');

  await paso('Editar, dividir y unir bloques (con deshacer)', async () => {
    return js(`
      const n0 = Folio.p.bloques.length, id = Folio.p.bloques[2].id, t0 = Folio.p.bloques[2].texto;
      Folio.cambiar('texto:dividir', p => Folio.texto.dividir(p, 2, Folio.p.bloques[2].texto.indexOf(' ', 20)));
      const n1 = Folio.p.bloques.length;
      Folio.cambiar('texto:unir', p => Folio.texto.unir(p, 2));
      const igual = Folio.p.bloques[2].texto.replace(/\\s+/g,' ') === t0.replace(/\\s+/g,' ');
      Folio.deshacerUltimo(); Folio.deshacerUltimo();
      return { ok: n1 === n0 + 1 && igual && Folio.p.bloques[2].texto === t0 && Folio.p.bloques.length === n0, n0, n1, igual };`);
  });
  await paso('Edición directa en el bloque (contenteditable) conserva la cursiva', async () => {
    return js(`
      await new Promise(r => setTimeout(r, 400));
      const i = Folio.p.bloques.findIndex(b => b.runs && b.runs.some(r => r.italic));
      const id = Folio.p.bloques[i].id;
      const el = document.querySelector('.bloque[data-id="'+id+'"]');
      el.scrollIntoView(); el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));
      const c = el.querySelector('.contenido'); c.insertAdjacentText('beforeend', ' Añadido.');
      c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      const b = Folio.p.bloques[i];
      const ok = b.texto.endsWith('Añadido.') && b.runs.some(r => r.italic && r.text === 'nadie');
      if (Folio.deshacer[Folio.deshacer.length-1].etiqueta === 'texto:editar') Folio.deshacerUltimo();
      return { ok, final: b.texto.slice(-30) };`);
  });

  await paso('Importar PDF con texto (añadir al final)', async () => {
    const n0 = await js(`return Folio.p.bloques.length`);
    await js(`await App.etapas[0].importar([${archivo('prueba.pdf', 'application/pdf')}], { modo: 'anadir' })`);
    const n1 = await js(`return Folio.p.bloques.length`);
    const r = await js(`return { ok: Folio.p.bloques.length > ${n0}, nuevos: Folio.p.bloques.length - ${n0}, muestra: Folio.p.bloques[Folio.p.bloques.length-1].texto.slice(0,80) }`);
    await js(`Folio.deshacerUltimo()`);
    return r;
  });
  await paso('OCR local de una imagen escaneada', async () => {
    const n0 = await js(`return Folio.p.bloques.length`);
    await js(`await App.etapas[0].importar([${archivo('escaneo.png', 'image/png')}], { modo: 'anadir' })`);
    const r = await js(`const b = Folio.p.bloques.slice(${n0}); return { ok: b.some(x => /silla/.test(x.texto)), texto: b.map(x=>x.texto).join(' ').slice(0,160), informes: Folio.p.origen.informes.slice(-1) }`);
    await js(`Folio.deshacerUltimo()`);
    return r;
  });

  await paso('Revisión: detecta y propone sin cambiar el texto', async () => {
    await js(`App.ir(1, { sinPrensa: true })`);
    await hasta(`App.etapas[1]._estado()==='listo'`, 60000);
    return js(`
      const o = App.etapas[1]._obs();
      const reglas = [...new Set(o.map(x=>x.regla))];
      return { ok: o.length > 0 && reglas.includes('repeticion') && reglas.includes('comillas') && reglas.includes('puntos'), total: o.length, reglas, cambiosSinPermiso: Folio.p.revision.decididas.length };`);
  });
  await foto('03-revision');
  await paso('Revisión: aceptar cambia solo ese tramo y se puede revertir', async () => {
    return js(`
      const o = App.etapas[1]._obs().find(x => x.regla === 'repeticion');
      const b = Folio.p.bloques.find(x => x.id === o.bloque), antes = b.texto;
      await App.etapas[1].aceptar(o);
      const despues = Folio.p.bloques.find(x => x.id === o.bloque).texto;
      const ok1 = despues !== antes && !/error error/.test(despues) && despues.length === antes.length - (o.antes.length - o.despues.length);
      Folio.deshacerUltimo(); await new Promise(r=>setTimeout(r,50));
      const ok2 = Folio.p.bloques.find(x => x.id === o.bloque).texto === antes;
      return { ok: ok1 && ok2, antes: o.antes, despues: o.despues };`);
  });

  await paso('Datos del libro', async () => js(`
    Folio.cambiar('dato:autor', p => { p.autor = 'Joaquín Jiménez Salvador'; p.sello = 'Ediciones de prueba'; p.ciudad = 'Santiago'; p.isbn = '978-956-00-0000-2'; p.dedicatoria = 'Para quien guarda grabados.'; p.contracubierta = 'Una novela breve sobre una ciudad que guarda sus imágenes en cajas de cartón.'; p.epigrafe = 'Todo libro es una casa.'; });
    App.ir(2, { sinPrensa: true }); await new Promise(r=>setTimeout(r,500));
    return { ok: !!document.querySelector('[data-zona="vista"] .hoja'), estado: App.etapas[2].estado() };`));
  await foto('04-datos');

  await paso('Poner un grabado del archivo en el interior', async () => js(`
    const l = ARCHIVO.laminas.find(x => x.tipo === 'figura' && x.w > 500);
    const cap = Folio.p.bloques.filter(b => b.tipo==='h1')[1];
    const i = Folio.p.bloques.indexOf(cap);
    Folio.cambiar('ajuste:ilustracion', p => { p.ilustraciones.push({ id: Folio.uid(), lamina: l.id, despuesDe: p.bloques[i+2].id, modo: 'media', pie: 'Grabado del archivo' }); p.ilustraciones.push({ id: Folio.uid(), lamina: ARCHIVO.laminas.find(x=>x.tipo==='escena').id, despuesDe: p.bloques[i+6].id, modo: 'pagina', pie: '' }); });
    return { ok: Folio.p.ilustraciones.length === 2, procedencia: Libro.procedencias(Folio.p) };`));

  await paso('Interior compuesto con Paged.js', async () => {
    await js(`App.ir(3, { sinPrensa: true })`);
    const ok = await hasta(`App.etapas[3]._resultado()`, 120000);
    await esperar(1200);
    return js(`const r = App.etapas[3]._resultado(); return { ok: ${ok} && r && r.paginas > 10, paginas: r && r.paginas, avisos: r && r.avisos.slice(0,6), secciones: r && Object.keys(r.secciones).length }`);
  });
  await foto('05-interior');
  await paso('Cambiar un ajuste recompone', async () => {
    const antes = await js(`return App.etapas[3]._resultado().paginas`);
    await js(`Folio.cambiar('ajuste:cuerpo', p => { p.ajustes.cuerpo = 13; })`);
    await esperar(1500); await hasta(`!App.etapas[3]._componiendo()`, 60000); await esperar(500);
    const despues = await js(`return App.etapas[3]._resultado().paginas`);
    await js(`Folio.cambiar('ajuste:cuerpo', p => { p.ajustes.cuerpo = 11; })`); await esperar(1500); await hasta(`!App.etapas[3]._componiendo()`, 60000);
    return { ok: despues > antes, antes, despues };
  });

  const cols = await js(`return Folio.COLECCIONES.map(c=>c.id)`);
  await paso('Cubiertas de las diez colecciones', async () => {
    const out = {};
    await js(`App.ir(4, { sinPrensa: true })`); await esperar(800);
    for (const [i, c] of cols.entries()) {
      await js(`Folio.cambiar('coleccion', p => { p.coleccion = ${JSON.stringify(c)}; p.cubierta.paleta = 0; p.cubierta.semilla = ${11 + i * 3}; })`);
      await esperar(300); await js(`await App.etapas[4].dibujar()`); await esperar(500);
      out[c] = await js(`const u = App.etapas[4]._ultimo(); return u ? { laminas: u.laminas.length, avisos: u.avisos } : null`);
      await foto(`06-cubierta-${String(i + 1).padStart(2, '0')}-${c}`);
    }
    return { ok: Object.values(out).every(Boolean), out };
  });
  await paso('Cubierta extendida con lomo e ISBN', async () => {
    await js(`Folio.cambiar('coleccion', p => { p.coleccion = 'bestiario'; })`); await esperar(300);
    await js(`document.querySelector('[data-modo="extendida"]').click()`); await esperar(300); await js(`await App.etapas[4].dibujar()`); await esperar(600);
    await foto('07-cubierta-extendida');
    return js(`const u = App.etapas[4]._ultimo(); return { ok: u.medidas.lomo > 0 && u.html.includes('alt="ISBN') && !u.avisos.some(a=>/ISBN/.test(a)), lomo: u.medidas.lomo, mm: u.mm, avisos: u.avisos }`);
  });

  for (const [tipo, nombre, extra] of [['lectura', 'libro-lectura.pdf', ''], ['pliegos', 'libro-pliegos.pdf', ''], ['cubierta', 'cubierta-frente.pdf', `t.modo='frente';`], ['cubierta', 'cubierta-extendida.pdf', `t.modo='extendida';`]]) {
    await paso(`PDF: ${nombre}`, async () => {
      const ruta = path.join(SALIDA, nombre);
      const r = await js(`const t = { tipo: '${tipo}', proyecto: JSON.parse(JSON.stringify(Folio.p)), recursos: Folio.recursos, paginas: (Folio.p.composicion||{}).paginas || 48, imposicion: { pliego: 16, mmPagina: Folio.formatoMm() } }; ${extra} return await Escritorio.pdfA(t, ${JSON.stringify(ruta)});`);
      const existe = fs.existsSync(ruta), bytes = existe ? fs.statSync(ruta).size : 0;
      return { ok: existe && bytes > 5000 && r.paginas > 0, paginas: r.paginas, mm: r.mm.map(x => Math.round(x * 10) / 10), bytes, blancas: r.blancas, hojas0: r.mapa && r.mapa.slice(0, 4) };
    });
  }

  await paso('Guardar .folio, reabrir y comparar', async () => {
    const ruta = path.join(SALIDA, 'prueba.folio');
    const r1 = await js(`return await Escritorio.guardarProyecto(${JSON.stringify(ruta)}, { proyecto: Folio.p, recursos: {}, originales: Folio.originales }, false)`);
    const huella0 = await js(`return JSON.stringify({ b: Folio.p.bloques, d: [Folio.p.autor, Folio.p.isbn, Folio.p.coleccion], i: Folio.p.ilustraciones })`);
    await js(`Folio.nuevoProyecto()`);
    const vacio = await js(`return Folio.p.bloques.length`);
    const r2 = await js(`const r = await Escritorio.abrirProyecto(${JSON.stringify(ruta)}); Folio.cargar(r.datos.proyecto, r.ruta, {}, r.datos.originales); return { originales: Object.keys(r.datos.originales) }`);
    const huella1 = await js(`return JSON.stringify({ b: Folio.p.bloques, d: [Folio.p.autor, Folio.p.isbn, Folio.p.coleccion], i: Folio.p.ilustraciones })`);
    // segundo guardado: debe dejar copia .bak
    await js(`return await Escritorio.guardarProyecto(${JSON.stringify(ruta)}, { proyecto: Folio.p }, false)`);
    return { ok: huella0 === huella1 && vacio === 0 && fs.existsSync(ruta + '.bak'), bytes: r1.bytes, originales: r2.originales, bak: fs.existsSync(ruta + '.bak') };
  });
  await paso('Copia automática en disco', async () => {
    await js(`Folio.cambiar('dato:subtitulo', p => { p.subtitulo = 'novela'; })`); await esperar(2200);
    const f = path.join(SALIDA, 'datos', 'autoguardado.folio.json');
    const ok = fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8')).proyecto.subtitulo === 'novela';
    const copias = fs.existsSync(path.join(SALIDA, 'datos', 'copias')) ? fs.readdirSync(path.join(SALIDA, 'datos', 'copias')) : [];
    return { ok, copias };
  });

  await paso('Archivo de grabados con ficha y página original', async () => {
    await js(`Archivo.abrir({ ficha: ARCHIVO.laminas[40].id })`); await esperar(800);
    await foto('08-archivo');
    await js(`document.querySelector('[data-a="pagina"]').click()`); await esperar(800);
    await foto('09-archivo-pagina');
    const r = await js(`const t = document.querySelector('.ar-ficha').innerText; const minis = document.querySelectorAll('.ar-mini').length; Archivo.cerrar(); return { ok: /Licencia/.test(t) && minis >= 100, minis, ficha: t.slice(0,200) }`);
    return r;
  });
  await paso('Impresión y costo', async () => {
    await js(`App.ir(5, { sinPrensa: true })`); await esperar(700); await foto('10-impresion');
    await js(`App.ir(6, { sinPrensa: true })`); await esperar(700); await foto('11-costo');
    return js(`const c = App.etapas[6].calcular(Folio.p.costo, Folio.p.composicion.paginas); return { ok: c.unidad > 0, unidad: Math.round(c.unidad), hojas: c.hojas }`);
  });
  await paso('Sin red: los pedidos externos se bloquean', async () => {
    const r = await js(`try { await fetch('https://example.com/'); return 'llegó'; } catch (e) { return 'bloqueado'; }`);
    return { ok: r === 'bloqueado' && red.filter(u => !u.startsWith('BLOQUEADA')).length === 0, intento: r, pedidosExternos: red };
  });
  fin();
}
