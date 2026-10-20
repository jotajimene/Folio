// Folio · prueba de la carpeta de trabajo con dos computadores simulados (cada fase es un arranque de Folio)
//   FASE=a   «ESCRITORIO» elige la carpeta, guarda un libro y queda con el libro abierto
//   FASE=b   «NOTEBOOK» elige la misma carpeta: hereda el perfil, ve el libro abierto allá, guarda; luego aparece un guardado del otro y pregunta
//   FASE=c   «NOTEBOOK» vuelve a abrir Folio: el libro cambió en el otro equipo y se abre esa versión
//   FASE=d   instalación nueva, sin carpeta: nada de lo anterior aparece
'use strict';
const { app, dialog } = require('electron');
const path = require('path'), fs = require('fs');
const BASE = process.env.FOLIO_SALIDA || '/tmp/folio-e2e4', FASE = process.env.FASE;
const CARPETA = path.join(BASE, 'Drive', 'Mi unidad', 'Folio');
const equipo = { a: 'ESCRITORIO', b: 'NOTEBOOK', c: 'NOTEBOOK', d: 'AJENO' }[FASE];
process.env.FOLIO_EQUIPO = equipo;
if (FASE === 'a') { fs.rmSync(BASE, { recursive: true, force: true }); fs.mkdirSync(CARPETA, { recursive: true }); }
app.setPath('userData', path.join(BASE, 'datos-' + equipo));
// las ventanas de elegir carpeta y guardar responden solas
dialog.showOpenDialog = async (_w, o) => ({ canceled: false, filePaths: [o && o.properties && o.properties.includes('openDirectory') ? CARPETA : path.join(CARPETA, 'Proyectos', 'Bestiario de la casa.folio')] });
dialog.showSaveDialog = async (_w, o) => ({ canceled: false, filePath: o.defaultPath });
require('../main.js');
const JSZip = require('jszip');
const resultados = [];
const esperar = ms => new Promise(r => setTimeout(r, ms));
let empezado = false;
app.on('browser-window-created', (_e, w) => { if (empezado) return; empezado = true; w.webContents.once('did-finish-load', () => correr(w).catch(e => { resultados.push({ paso: 'FALLO GENERAL ' + FASE, ok: false, detalle: String(e.stack || e) }); fin(); })); });
function fin() { console.log(resultados.map(r => `${r.ok ? 'OK  ' : 'FALLA'} [${equipo}] ${r.paso} ${r.detalle ? '· ' + JSON.stringify(r.detalle).slice(0, 300) : ''}`).join('\n')); app.exit(0); }
async function correr(w) {
  const js = code => w.webContents.executeJavaScript(`(async()=>{${code}})()`);
  const paso = async (nombre, f) => { try { const d = await f(); resultados.push({ paso: nombre, ok: d && d.ok !== false, detalle: d }); } catch (e) { resultados.push({ paso: nombre, ok: false, detalle: String(e.stack || e) }); } };
  const hasta = async (cond, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(`return !!(${cond})`)) return true; await esperar(250); } return false; };
  await hasta(`document.documentElement.dataset.listo==='1'`);
  const LIBRO = path.join(CARPETA, 'Proyectos', 'Bestiario de la casa.folio');
  const B64 = fs.readFileSync(path.join(__dirname, 'insumos', 'prueba.docx')).toString('base64');

  if (FASE === 'a') {
    await paso('Elegir la carpeta de trabajo lleva el perfil y el archivo ampliado', async () => {
      await js(`Perfil.datos.sello = 'Sol de Lata'; Perfil.datos.respaldo = ${JSON.stringify(path.join(BASE, 'respaldo-escritorio'))}; await Perfil.guardar();`);
      fs.mkdirSync(path.join(BASE, 'respaldo-escritorio'), { recursive: true });
      const r = await js(`return await Escritorio.trabajo.elegir()`);
      const compartido = JSON.parse(fs.readFileSync(path.join(CARPETA, 'perfil.json'), 'utf8'));
      return { ok: r.carpeta === CARPETA && !r.usoPerfilExistente && compartido.sello === 'Sol de Lata' && !('respaldo' in compartido) && fs.existsSync(path.join(CARPETA, 'Proyectos')), ...r, respaldoFueraDelCompartido: !('respaldo' in compartido) };
    });
    await paso('Guardar un libro nuevo: va a Proyectos, con nota de abierto y ruta relativa en la estantería', async () => {
      await js(`Folio.nuevoProyecto(); await App.etapas[0].importar([new File([Uint8Array.from(atob(${JSON.stringify(B64)}),c=>c.charCodeAt(0))], 'prueba.docx')]); Folio.cambiar('dato:titulo', p => { p.titulo = 'Bestiario de la casa'; }); await App.guardar(false);`);
      await esperar(800);
      const nota = JSON.parse(fs.readFileSync(LIBRO + '.abierto', 'utf8'));
      const compartido = JSON.parse(fs.readFileSync(path.join(CARPETA, 'perfil.json'), 'utf8'));
      const z = await JSZip.loadAsync(fs.readFileSync(LIBRO)); const meta = JSON.parse(await z.file('guardado.json').async('string'));
      return { ok: fs.existsSync(LIBRO) && nota.equipo === 'ESCRITORIO' && meta.equipo === 'ESCRITORIO' && compartido.recientes[0].ruta === '@trabajo/Proyectos/Bestiario de la casa.folio' && fs.readdirSync(path.join(BASE, 'respaldo-escritorio')).length === 1, nota, estanteria: compartido.recientes[0].ruta };
    });
  }
  if (FASE === 'b') {
    await paso('Instalación del segundo computador: parte sin carpeta', async () => js(`const e = await Escritorio.trabajo.estado(); return { ok: !e.carpeta && !e.elegida && !Perfil.datos.sello, ...e }`));
    await paso('Elegir la misma carpeta: usa el perfil del otro computador, sin su respaldo', async () => {
      const r = await js(`const r = await Escritorio.trabajo.elegir(); await Perfil.cargar(); return { ...r, sello: Perfil.datos.sello, respaldo: Perfil.datos.respaldo || null, estante: (Perfil.datos.recientes || []).map(x => x.ruta) }`);
      return { ok: r.usoPerfilExistente && r.sello === 'Sol de Lata' && !r.respaldo && r.estante[0] === LIBRO, ...r };
    });
    await paso('Abrir desde la estantería avisa que está abierto en el otro computador', async () => {
      const r = await js(`return await Escritorio.abrirProyecto(Perfil.datos.recientes[0].ruta).then(r => ({ enUso: r.enUso, titulo: r.datos.proyecto.titulo, guardado: r.guardado }))`);
      await js(`const r = await Escritorio.abrirProyecto(${JSON.stringify(LIBRO)}); Folio.cargar(r.datos.proyecto, r.ruta, Folio.conPrefijo(r.datos.recursos), r.datos.originales);`);
      return { ok: r.enUso && r.enUso.equipo === 'ESCRITORIO' && r.titulo === 'Bestiario de la casa' && r.guardado.equipo === 'ESCRITORIO', ...r };
    });
    await paso('Guardar sin cambios del otro lado: guarda normal', async () => {
      const r = await js(`Folio.cambiar('dato:autor', p => { p.autor = 'Jota desde el notebook'; }); return await Folio.guardar(false)`);
      return { ok: !r.conflicto && !r.cancelado && r.ruta === LIBRO, ruta: r.ruta };
    });
    await paso('Si el otro computador guardó después, pregunta antes de pisar', async () => {
      await esperar(1600);
      const z = await JSZip.loadAsync(fs.readFileSync(LIBRO)); const p = JSON.parse(await z.file('proyecto.json').async('string')); p.titulo = 'Bestiario de la casa (corregido en el escritorio)';
      z.file('proyecto.json', JSON.stringify(p)); z.file('guardado.json', JSON.stringify({ equipo: 'ESCRITORIO', fecha: new Date().toISOString() }));
      fs.writeFileSync(LIBRO, await z.generateAsync({ type: 'nodebuffer' }));
      const r = await js(`return await Escritorio.guardarProyecto(Folio.ruta, { proyecto: Folio.p, recursos: {}, originales: {} }, false)`);
      // la ventana de Folio: se elige «Guardar como copia»
      await js(`setTimeout(() => { const b = [...document.querySelectorAll('.modal .modal-botones button')].find(x => /copia/.test(x.textContent)); b && b.click(); }, 500); window.__r = await Folio.guardar(false);`);
      const r2 = await js(`return window.__r`);
      const z2 = await JSZip.loadAsync(fs.readFileSync(LIBRO)); const sigue = JSON.parse(await z2.file('proyecto.json').async('string')).titulo;
      return { ok: r.conflicto && r.conflicto.equipo === 'ESCRITORIO' && !r.conflicto.mismo && sigue === 'Bestiario de la casa (corregido en el escritorio)' && r2.ruta !== LIBRO && fs.existsSync(r2.ruta), conflicto: r.conflicto, copia: path.basename(r2.ruta || ''), laDelOtroIntacta: sigue };
    });
    await paso('Volver al libro original y dejar la copia automática atrasada', async () => {
      await js(`const r = await Escritorio.abrirProyecto(${JSON.stringify(LIBRO)}); Folio.cargar(r.datos.proyecto, r.ruta, Folio.conPrefijo(r.datos.recursos), r.datos.originales); Folio.cambiar('dato:edicion', p => { p.edicion = 'Primera'; });`);
      await esperar(2500);
      const z = await JSZip.loadAsync(fs.readFileSync(LIBRO)); const p = JSON.parse(await z.file('proyecto.json').async('string')); p.titulo = 'Bestiario de la casa (versión final del escritorio)';
      z.file('proyecto.json', JSON.stringify(p)); z.file('guardado.json', JSON.stringify({ equipo: 'ESCRITORIO', fecha: new Date().toISOString() }));
      await esperar(2500); fs.writeFileSync(LIBRO, await z.generateAsync({ type: 'nodebuffer' }));
      return { ok: true };
    });
  }
  if (FASE === 'c') {
    await paso('Al abrir Folio, si el libro es más nuevo en la carpeta, se abre esa versión', async () => {
      await esperar(1500);
      return js(`return { ok: Folio.p.titulo === 'Bestiario de la casa (versión final del escritorio)' && Folio.ruta === ${JSON.stringify(LIBRO)}, titulo: Folio.p.titulo, aviso: [...document.querySelectorAll('.aviso, .avisos *')].map(x => x.textContent).join(' ').slice(0, 200) }`);
    });
  }
  if (FASE === 'd') {
    await paso('Instalación nueva de otra persona: sin carpeta, sin perfil, sin estantería, sin láminas traídas', async () => js(`const e = await Escritorio.trabajo.estado(); return { ok: !e.carpeta && !e.elegida && !Perfil.datos.sello && !(Perfil.datos.recientes || []).length && ARCHIVO.extra.length === 0 && !Folio.p.bloques.length, ...e }`));
  }
  fin();
}
