// Folio · prueba de las funciones nuevas (poemarios, notas, corrector, librojuego, encuadernaciones, modelo local…)
'use strict';
const { app, session } = require('electron');
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const SALIDA = process.env.FOLIO_SALIDA || '/tmp/folio-e2e2';
fs.rmSync(SALIDA, { recursive: true, force: true }); fs.mkdirSync(SALIDA, { recursive: true });
app.setPath('userData', path.join(SALIDA, 'datos'));
process.env.FOLIO_MODELOS = process.env.FOLIO_MODELOS || '/tmp/claude-0/modelos';
require(process.env.FOLIO_MAIN || '../main.js');
const JSZip = require('jszip');
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
  console.log(resultados.map(r => `${r.ok ? 'OK  ' : 'FALLA'} ${r.paso} ${r.detalle ? '· ' + (typeof r.detalle === 'string' ? r.detalle : JSON.stringify(r.detalle)).slice(0, 260) : ''}`).join('\n'));
  app.exit(0);
}
async function correr(w) {
  const js = code => w.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const foto = async nombre => { await esperar(500); const im = await w.webContents.capturePage(); fs.writeFileSync(path.join(SALIDA, nombre + '.png'), im.toPNG()); };
  const paso = async (nombre, f) => { try { const d = await f(); resultados.push({ paso: nombre, ok: d && d.ok !== false, detalle: d }); } catch (e) { resultados.push({ paso: nombre, ok: false, detalle: String(e.stack || e) }); } };
  const hasta = async (cond, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(`return !!(${cond})`)) return true; await esperar(250); } return false; };
  const b64 = f => fs.readFileSync(path.join(__dirname, 'insumos', f)).toString('base64');
  const archivo = (f, tipo, datos) => `new File([Uint8Array.from(atob(${JSON.stringify(datos || b64(f))}),c=>c.charCodeAt(0))], ${JSON.stringify(f)}, {type:${JSON.stringify(tipo)}})`;
  const componer = async () => { await js(`App.ir(3, { sinPrensa: true, forzar: true })`); await hasta(`App.etapas[3]._componiendo()`, 10000); await hasta(`!App.etapas[3]._componiendo() && document.querySelector('.vista-libro:not(.cargando)')`, 120000); await hasta(`App.etapas[3]._resultado() && !App.etapas[3]._componiendo()`, 120000); await esperar(600); return js(`return App.etapas[3]._resultado()`); };
  const vistaDoc = `document.querySelector('.vista-libro:not(.cargando)').contentDocument`;
  const pdf = async (nombre, extra) => { const ruta = path.join(SALIDA, nombre); const r = await js(`const t = App.etapas[5].trabajoBase('lectura'); ${extra}; return await Escritorio.pdfA(t, ${JSON.stringify(ruta)});`); return { ...r, ruta, bytes: fs.statSync(ruta).size }; };
  await hasta(`document.documentElement.dataset.listo==='1'`);

  await paso('Perfil de la editorial se aplica a un libro nuevo', async () => {
    await js(`Perfil.datos.sello = 'Sol de prueba'; Perfil.datos.ciudad = 'Valparaíso'; await Perfil.guardar(); Folio.nuevoProyecto();`);
    return js(`return { ok: Folio.p.sello === 'Sol de prueba' && Folio.p.ciudad === 'Valparaíso' && Folio.p.numero === '01', sello: Folio.p.sello, numero: Folio.p.numero }`);
  });

  await paso('Poemario: estrofas y títulos de poemas', async () => {
    await js(`await App.etapas[0].importar([${archivo('poemario.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}])`);
    await hasta(`Folio.p.bloques.length > 0`, 30000);
    return js(`const B = Folio.p.bloques; return { ok: Folio.p.tipo === 'poesia' && B.filter(b=>b.tipo==='h1').length === 3 && B.filter(b=>b.tipo==='verso').length === 7 && B[1].texto.split('\\n').length === 3, tipos: B.map(b=>b.tipo).join(','), primera: B[1].texto }`);
  });
  await paso('Poemario compuesto: versos en líneas, estrofas separadas', async () => {
    const r = await componer(); await foto('01-poemario');
    return js(`const d = ${vistaDoc}; return { ok: d.querySelectorAll('.estrofa').length >= 7 && d.querySelectorAll('.estrofa .v').length >= 17, paginas: ${r.paginas}, estrofas: d.querySelectorAll('.estrofa').length, lineas: d.querySelectorAll('.estrofa .v').length }`);
  });
  await paso('Editar sobre el libro compuesto (clic en un bloque)', async () => {
    await js(`const d = ${vistaDoc}; const el = d.querySelector('.estrofa'); el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));`);
    await hasta(`document.querySelector('.editable-int')`, 5000);
    await foto('02-editor-en-pagina');
    const antes = await js(`return Folio.p.bloques.find(b=>b.tipo==='verso').texto`);
    await js(`const ed = document.querySelector('.editable-int'); ed.insertAdjacentText('beforeend', ' (corregido)'); document.querySelector('[data-eb="saltoAntes"]').checked = true; document.querySelector('[data-r="eb-guardar"]').click();`);
    await esperar(400);
    const r = await js(`const b = Folio.p.bloques.find(b=>b.tipo==='verso'); return { texto: b.texto, salto: !!b.saltoAntes }`);
    await js(`Folio.deshacerUltimo()`);
    return { ok: r.texto.endsWith('(corregido)') && r.salto && r.texto.startsWith(antes.slice(0, 10)), ...r };
  });

  await paso('Notas al pie desde Word, al pie de su página', async () => {
    await js(`Folio.nuevoProyecto(); await App.etapas[0].importar([${archivo('notas.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}])`);
    await hasta(`Folio.p.bloques.length > 0`, 30000);
    const m = await js(`const b = Folio.p.bloques.find(b=>b.notas); return { marcas: b ? (b.texto.match(/\\uE000/g)||[]).length : 0, notas: b ? b.notas : null }`);
    await componer(); await foto('03-notas');
    const v = await js(`const d = ${vistaDoc}; return { area: [...d.querySelectorAll('.pagedjs_footnote_area')].map(x=>x.textContent.trim()).filter(Boolean).join(' | '), llamadas: d.querySelectorAll('[data-footnote-call]').length }`);
    const p = await pdf('notas.pdf'); const txt = execSync(`pdftotext ${JSON.stringify(p.ruta)} -`).toString();
    return { ok: m.marcas === 2 && m.notas.length === 2 && /Peirce/.test(v.area) && /Peirce/.test(txt), ...m, ...v };
  });

  await paso('Revisión exhaustiva por capas', async () => {
    await js(`Folio.cambiar('texto:editar', p => { p.bloques.push({ id: Folio.uid(), tipo: 'p', texto: 'Pienso de que habían muchos perros detrás mío. Sólo fué el 3 de Marzo, y subió arriba en base a eso. El show fue online.', runs: null }); })`);
    await js(`App.ir(1, { sinPrensa: true, forzar: true })`); await hasta(`App.etapas[1]._estado()==='listo'`, 60000);
    await foto('04-revision');
    return js(`const o = App.etapas[1]._obs(); const r = new Set(o.map(x=>x.regla)); const quiero = ['dequeismo','haber-impersonal','adverbio-posesivo','tilde-diacritica-obsoleta','monosilabo','meses','pleonasmo','en-base-a','extranjerismo']; return { ok: quiero.every(x=>r.has(x)), faltan: quiero.filter(x=>!r.has(x)), total: o.length }`);
  });
  await paso('Extranjerismo: aceptar lo pone en cursiva sin cambiar letras', async () => js(`
    const o = App.etapas[1]._obs().find(x=>x.regla==='extranjerismo'); const b0 = Folio.p.bloques.find(b=>b.id===o.bloque).texto;
    await App.etapas[1].aceptar(o); const b = Folio.p.bloques.find(b=>b.id===o.bloque);
    return { ok: b.texto === b0 && b.runs && b.runs.some(r=>r.italic && r.text.toLowerCase()===o.antes.toLowerCase()), runs: b.runs && b.runs.filter(r=>r.italic) }`));

  await paso('Ida y vuelta con un corrector (Word con control de cambios)', async () => {
    const docx = await js(`return await Corrector.generar(Folio.p)`);
    const z = await JSZip.loadAsync(Buffer.from(docx, 'base64'));
    let x = await z.file('word/document.xml').async('string');
    // en el segundo párrafo del cuerpo: borrar «bastante» e insertar «muy»; y un comentario
    x = x.replace(/<w:r><w:t xml:space="preserve">Segundo párrafo sin notas, bastante largo/, '<w:r><w:t xml:space="preserve">Segundo párrafo sin notas, </w:t></w:r><w:del w:id="9" w:author="Correctora"><w:r><w:delText>bastante</w:delText></w:r></w:del><w:ins w:id="10" w:author="Correctora"><w:r><w:t>muy</w:t></w:r></w:ins><w:commentRangeStart w:id="0"/><w:r><w:t xml:space="preserve"> largo');
    x = x.replace(/ y se pueda ver la nota al pie de la página\.<\/w:t><\/w:r>/, ' y se pueda ver la nota al pie de la página.</w:t></w:r><w:commentRangeEnd w:id="0"/>');
    z.file('word/document.xml', x);
    z.file('word/comments.xml', '<?xml version="1.0" encoding="UTF-8"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0" w:author="Correctora"><w:p><w:r><w:t>¿Hace falta este párrafo?</w:t></w:r></w:p></w:comment></w:comments>');
    const corr = (await z.generateAsync({ type: 'nodebuffer' })).toString('base64');
    await js(`await Corrector.importar(${archivo('corregido.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', corr)})`);
    await hasta(`App.actual === 1 && App.etapas[1]._estado()==='listo'`, 60000);
    const r = await js(`const ex = Folio.p.revision.externas || []; return { n: ex.length, tipos: ex.map(e=>e.regla+':'+JSON.stringify(e.antes)+'→'+JSON.stringify(e.despues)), autor: ex[0] && ex[0].cat }`);
    const ac = await js(`const o = App.etapas[1]._obs().find(x=>x.regla==='corrector'); await App.etapas[1].aceptar(o); return Folio.p.bloques.some(b=>/notas, muy largo/.test(b.texto))`);
    await foto('05-corrector');
    return { ok: r.n === 2 && ac, ...r, aceptado: ac };
  });

  await paso('Versiones: guardar, comparar y volver', async () => js(`
    Versiones.guardar('Antes de cortar'); const v = Folio.p.versiones[Folio.p.versiones.length-1];
    Folio.cambiar('texto:editar', p => { p.bloques[1].texto = 'Texto cambiado del todo.'; });
    const c = Versiones.comparar(v);
    Folio.cambiar('versiones:volver', p => { p.bloques = JSON.parse(JSON.stringify(v.bloques)); });
    return { ok: c.length === 1 && c[0].tipo === 'cambiado' && Folio.p.bloques[1].texto !== 'Texto cambiado del todo.', cambios: c.length }`));

  await paso('Librojuego: numeración, remisiones y comprobación de caminos', async () => {
    await js(`Folio.nuevoProyecto(); Folio.cambiar('importar', p => { const u = Folio.uid; p.tipo = 'librojuego'; p.titulo = 'La casa'; p.bloques = [
      { id: u(), tipo: 'seccion', texto: 'inicio' }, { id: u(), tipo: 'p', texto: 'Estás frente a la casa. Si entras, ve a la [[puerta]]; si bajas, ve al [[sotano]].' },
      { id: u(), tipo: 'seccion', texto: 'puerta' }, { id: u(), tipo: 'p', texto: 'La puerta se cierra detrás de ti. FIN' },
      { id: u(), tipo: 'seccion', texto: 'sotano' }, { id: u(), tipo: 'p', texto: 'Está oscuro. Vuelve al [[inicio]].' },
      { id: u(), tipo: 'seccion', texto: 'perdida' }, { id: u(), tipo: 'p', texto: 'Nadie llega aquí.' }]; p.original = p.bloques.map(b => ({ ...b })); });`);
    const a = await js(`const a = Librojuego.analizar(); return { inal: a.inalcanzables, sin: a.sinSalida, n: [...a.numeros] }`);
    await componer(); await foto('06-librojuego');
    const dbg = await js(`return { actual: App.actual, ocupado: App.ocupado, res: !!App.etapas[3]._resultado(), comp: App.etapas[3]._componiendo(), iframes: [...document.querySelectorAll('iframe')].map(f=>f.className), avisos: [...document.querySelectorAll('.flotante')].map(x=>x.textContent) }`);
    if (!dbg.iframes.includes('vista-libro')) return { ok: false, dbg };
    const v = await js(`const d = ${vistaDoc}; return { refs: [...d.querySelectorAll('.ref-sec')].map(x=>x.textContent), secciones: [...d.querySelectorAll('.seccion-n')].map(x=>x.textContent) }`);
    return { ok: a.inal.join() === 'perdida' && a.sin.join() === 'perdida' && v.refs.join() === '2,3,1' && v.secciones.join() === '1,2,3,4', ...a, ...v };
  });

  await paso('Índice analítico con páginas reales', async () => {
    await js(`Folio.cambiar('indice-analitico', p => { p.indiceAnalitico = { activo: true, terminos: [{ t: 'casa' }, { t: 'puerta' }] }; })`);
    await componer();
    return js(`const d = ${vistaDoc}; const li = [...d.querySelectorAll('[data-ia-entrada]')].map(x=>x.textContent); return { ok: li.length === 2 && li.every(t => /\\d/.test(t) && !/000/.test(t)), li }`);
  });

  await paso('Tipografía propia: revisión y uso en el PDF', async () => {
    const f = await js(`const r = await Tipografias.analizar(${archivo('tipografia.ttf', 'font/ttf')}); Perfil.datos.fuentes = [{ familia: r.familia, sub: r.sub, estilo: r.estilo, peso: r.peso, datos: r.datos, avisos: r.avisos }]; Tipografias.registrarCSS(); const k = Tipografias.clave(r.familia); Tipografias.alProyecto(k); Folio.cambiar('ajuste:fuenteTexto', p => { p.ajustes.fuenteTexto = k; }); return { familia: r.familia, faltan: r.faltan, avisos: r.avisos, k }`);
    await componer();
    const p = await pdf('tipografia.pdf'); const fuentes = execSync(`pdffonts ${JSON.stringify(p.ruta)}`).toString();
    await js(`Folio.cambiar('ajuste:fuenteTexto', p => { p.ajustes.fuenteTexto = null; })`);
    return { ok: !f.faltan.length && /DejaVu/i.test(fuentes), ...f, fuentes: fuentes.split('\n').slice(2, 6).join(' / ') };
  });

  await paso('Imagen propia como grabado, y a doble página', async () => {
    const r = await js(`const img = new Image(); img.src = 'data:image/jpeg;base64,${b64('foto.jpg')}'; await img.decode(); const c = Imagenes.tratar(img, 'grabado', .5); const n = 'img-prueba.png'; Folio.recursos[n] = c.toDataURL('image/png'); const k = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let negros=0; for (let i=0;i<k.length;i+=4) if (k[i]<128) negros++; Folio.cambiar('ajuste:ilustracion', p => { p.ilustraciones.push({ id: Folio.uid(), recurso: n, despuesDe: p.bloques[1].id, modo: 'doble', pie: '' }); }); return { negros: negros / (k.length/4) }`);
    await componer(); await foto('07-doble');
    const v = await js(`const d = ${vistaDoc}; const f = [...d.querySelectorAll('figure.il-doble')]; return { n: f.length, izq: f[0] && +f[0].closest('.pagedjs_page').dataset.pageNumber % 2 === 0 }`);
    return { ok: r.negros > .05 && r.negros < .8 && v.n === 2 && v.izq, ...r, ...v };
  });

  await paso('Libro digital EPUB', async () => {
    const r = await js(`const b = await Epub.generar(Folio.p, { recursos: Folio.recursos }); return b`);
    const ruta = path.join(SALIDA, 'libro.epub'); fs.writeFileSync(ruta, Buffer.from(r, 'base64'));
    const z = await JSZip.loadAsync(fs.readFileSync(ruta)); const nombres = Object.keys(z.files);
    const opf = await z.file('OEBPS/content.opf').async('string');
    return { ok: nombres[0] === 'mimetype' && nombres.includes('OEBPS/nav.xhtml') && nombres.includes('OEBPS/portada.png') && /<dc:title>La casa<\/dc:title>/.test(opf), archivos: nombres.length, bytes: fs.statSync(ruta).size };
  });

  for (const [enc, esperado] of [['fresado', null], ['fanzine', 8], ['acordeon', null], ['japones', null]]) {
    await paso(`Pliegos: ${enc}`, async () => {
      const ruta = path.join(SALIDA, `pliegos-${enc}.pdf`);
      const r = await js(`const t = App.etapas[5].trabajoBase('pliegos'); t.imposicion.encuadernacion = '${enc}'; return await Escritorio.pdfA(t, ${JSON.stringify(ruta)});`);
      return { ok: fs.existsSync(ruta) && r.paginas > 0, caras: r.paginas, mm: r.mm.map(Math.round), instrucciones: (r.instrucciones || '').slice(0, 60) };
    });
  }
  await paso('PDF para imprenta: sangrado y marcas de corte', async () => {
    const r = await pdf('imprenta.pdf', `t.opciones.imprenta = true`);
    return { ok: Math.round(r.mm[0]) > 148 + 5, mm: r.mm };
  });
  await paso('Ejemplares numerados', async () => {
    const r = await pdf('numerados.pdf', `t.numeracion = { desde: 1, hasta: 3, total: 50 }`);
    const txt = execSync(`pdftotext ${JSON.stringify(r.ruta)} -`).toString();
    return { ok: /Ejemplar n\.º 03 de 50/.test(txt) && r.ejemplares === 3, ejemplares: r.ejemplares, paginas: r.paginas };
  });
  await paso('Hoja de prueba a dos caras', async () => {
    const ruta = path.join(SALIDA, 'prueba-duplex.pdf');
    const r = await js(`const t = App.etapas[5].trabajoBase('prueba'); return await Escritorio.pdfA(t, ${JSON.stringify(ruta)});`);
    return { ok: r.paginas === 2, mm: r.mm.map(Math.round) };
  });

  await paso('Cubiertas: paleta propia, Umbral y Fragmento con encuadre', async () => {
    await js(`App.ir(4, { sinPrensa: true, forzar: true })`); await esperar(800);
    await js(`Folio.cambiar('coleccion', p => { p.coleccion = 'umbral'; p.cubierta.colores = ['#f4a3b4', '#2a2a72', '#ffd23f']; p.cubierta.semilla = 5; })`); await esperar(400); await js(`await App.etapas[4].dibujar()`); await foto('08-umbral');
    const u = await js(`const u = App.etapas[4]._ultimo(); return u.paleta.join()`);
    await js(`Folio.cambiar('coleccion', p => { p.coleccion = 'fragmento'; p.cubierta.colores = null; p.cubierta.recorte = { x: .5, y: .4, z: 2 }; })`); await esperar(400); await js(`await App.etapas[4].dibujar()`); await foto('09-fragmento');
    const f = await js(`const u = App.etapas[4]._ultimo(); return { recorte: u.recorte, encuadre: !!document.querySelector('.marco-encuadre') }`);
    await js(`Folio.cambiar('coleccion', p => { p.coleccion = 'teselario'; p.cubierta.recorte = null; })`); await esperar(400); await js(`await App.etapas[4].dibujar()`); await foto('10-teselario');
    await js(`Folio.cambiar('coleccion', p => { p.coleccion = 'archivo'; })`); await esperar(300); await js(`App.etapas[4]._modo('extendida'); await App.etapas[4].dibujar()`); await foto('11-archivo-extendida');
    await js(`App.etapas[4]._modo('frente')`);
    return { ok: u === '#f4a3b4,#2a2a72,#ffd23f' && f.recorte && f.recorte.z === 2 && f.encuadre, paleta: u, ...f };
  });

  await paso('Modelo de texto local (motor con un modelo diminuto)', async () => {
    const e = await js(`const e = await Escritorio.modelo.estado(); return e.modelos.map(m => m.id + ':' + m.instalado)`);
    const r = await js(`let trozos = 0; const r = await Asistente.pedir({ sistema: 'Eres editor.', mensaje: 'Hola', maxTokens: 16, alTrozo: () => trozos++ }); return { largo: r.texto.length, trozos, modelo: r.modelo }`);
    return { ok: r.largo > 0 && r.trozos > 0, estado: e, ...r };
  });

  await paso('Bestiario: acciones variadas', async () => {
    await js(`App.ir(0, { sinPrensa: true, forzar: true })`); await esperar(9000);
    return js(`const v = Bestiario.vivos(); const acc = v.filter(x => x.accion || x.proxima).length; return { ok: v.length > 3 && acc > 0, vivos: v.length, conAcciones: acc, ahora: v.filter(x=>x.accion).map(x=>x.accion.a) }`);
  });
  await paso('Estantería y hojear', async () => {
    const ruta = path.join(SALIDA, 'librojuego.folio');
    await js(`const r = await Escritorio.guardarProyecto(${JSON.stringify(ruta)}, { proyecto: Folio.p, recursos: {}, originales: {} }, false); Folio.ruta = r.ruta; Folio.avisar('guardado');`); await esperar(500);
    await js(`Estanteria.abrir()`); await esperar(600); await foto('12-estanteria');
    const n = await js(`const n = document.querySelectorAll('.modal .lomo-libro').length; document.querySelector('.modal .cerrar').click(); return n`);
    await js(`Hojear.abrir()`); await hasta(`document.querySelector('.hojear-n') && /doble/.test(document.querySelector('.hojear-n').textContent)`, 60000); await foto('13-hojear');
    await js(`Hojear.cerrar()`);
    return { ok: n >= 1, lomos: n };
  });
  fin();
}
