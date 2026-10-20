// Folio · lo que pertenece a este computador y la carpeta de trabajo compartida
// La carpeta de trabajo es opcional y la elige cada persona en su propio equipo. Su ruta se guarda en
// equipo.json, dentro de la carpeta de datos de Folio de este computador: nunca va en el programa ni en
// los proyectos, así que una instalación nueva parte sin carpeta y guarda todo localmente.
// Con carpeta de trabajo, ahí viven el perfil de la editorial (con sus tipografías), el archivo ampliado
// y los proyectos (en Proyectos/). Los modelos, las herramientas y la copia automática siguen en cada equipo.
'use strict';
const { app } = require('electron');
const path = require('path'), fs = require('fs'), fsp = fs.promises, os = require('os');

const datosLocales = () => app.getPath('userData');
const rutaConfig = () => path.join(datosLocales(), 'equipo.json');
let config = null;
function leerConfig() {
  if (config) return config;
  try { config = JSON.parse(fs.readFileSync(rutaConfig(), 'utf8')); } catch { config = {}; }
  return config;
}
async function guardarConfig(c) { config = c; await fsp.mkdir(datosLocales(), { recursive: true }); const tmp = rutaConfig() + '.tmp'; await fsp.writeFile(tmp, JSON.stringify(c, null, 1)); await fsp.rename(tmp, rutaConfig()); }
const nombreEquipo = () => process.env.FOLIO_EQUIPO || os.hostname() || 'este computador';

// la carpeta de trabajo solo cuenta si existe en este momento (Drive puede no estar montado)
function carpeta() { const c = leerConfig().carpetaTrabajo; return c && fs.existsSync(c) ? c : null; }
const carpetaElegida = () => leerConfig().carpetaTrabajo || null;
const base = () => carpeta() || datosLocales();
const rutaPerfil = () => path.join(base(), 'perfil.json');
const rutaPerfilLocal = () => path.join(datosLocales(), 'perfil.json');
const carpetaExtra = () => path.join(base(), 'archivo-extra');
const carpetaProyectos = () => carpeta() ? path.join(carpeta(), 'Proyectos') : null;

// datos del perfil que son de cada computador: no viajan a la carpeta compartida
const DEL_EQUIPO = ['respaldo', 'vozPiper'];
// rutas de la estantería: dentro de la carpeta de trabajo se guardan relativas, para que sirvan en los dos equipos
const MARCA = '@trabajo/';
function aCompartido(perfil) {
  const c = carpeta(), out = { ...perfil };
  for (const k of DEL_EQUIPO) delete out[k];
  if (c && Array.isArray(out.recientes)) out.recientes = out.recientes.map(r => r && r.ruta && path.resolve(r.ruta).startsWith(path.resolve(c) + path.sep) ? { ...r, ruta: MARCA + path.relative(c, r.ruta).split(path.sep).join('/') } : r);
  return out;
}
function deCompartido(perfil) {
  const c = carpeta(), out = { ...(perfil || {}) }, cfg = leerConfig();
  // sin carpeta de trabajo, un perfil antiguo puede traer estos datos: se respetan hasta que se guarden en equipo.json
  for (const k of DEL_EQUIPO) if (cfg[k] != null) out[k] = cfg[k]; else if (c) delete out[k];
  if (Array.isArray(out.recientes)) out.recientes = out.recientes.filter(r => r && r.ruta && (!r.ruta.startsWith(MARCA) || c)).map(r => r.ruta.startsWith(MARCA) ? { ...r, ruta: path.join(c, ...r.ruta.slice(MARCA.length).split('/')) } : r);
  return out;
}
async function leerPerfil() {
  try { return deCompartido(JSON.parse(await fsp.readFile(rutaPerfil(), 'utf8'))); } catch { return carpeta() ? deCompartido({}) : null; }
}
async function guardarPerfil(datos) {
  const cfg = { ...leerConfig() }; let cambio = false;
  for (const k of DEL_EQUIPO) if (k in (datos || {}) && cfg[k] !== datos[k]) { cfg[k] = datos[k]; cambio = true; }
  if (cambio) await guardarConfig(cfg);
  const destino = rutaPerfil(); await fsp.mkdir(path.dirname(destino), { recursive: true });
  const tmp = destino + '.' + process.pid + '.tmp'; await fsp.writeFile(tmp, JSON.stringify(aCompartido(datos), null, 1)); await fsp.rename(tmp, destino);
  return true;
}

async function copiarCarpeta(de, a) {
  if (!fs.existsSync(de)) return 0; let n = 0;
  await fsp.mkdir(a, { recursive: true });
  for (const f of await fsp.readdir(de, { withFileTypes: true })) {
    const x = path.join(de, f.name), y = path.join(a, f.name);
    if (f.isDirectory()) n += await copiarCarpeta(x, y); else if (!fs.existsSync(y)) { await fsp.copyFile(x, y); n++; }
  }
  return n;
}
// elegir (o dejar) la carpeta de trabajo. Si la carpeta ya tiene un perfil (el otro computador la preparó), se usa ese;
// si no, se lleva el perfil y el archivo ampliado de este equipo.
async function usarCarpeta(dir) {
  const cfg = { ...leerConfig() };
  if (!dir) {
    // al dejarla, este equipo se queda con una copia del perfil y del archivo ampliado, para seguir igual
    const c = carpeta();
    if (c) {
      try { const p = JSON.parse(await fsp.readFile(path.join(c, 'perfil.json'), 'utf8')); delete cfg.carpetaTrabajo; config = cfg; await fsp.writeFile(rutaPerfilLocal(), JSON.stringify({ ...deCompartidoCon(p, c), ...Object.fromEntries(DEL_EQUIPO.filter(k => cfg[k] != null).map(k => [k, cfg[k]])) }, null, 1)); } catch {}
      await copiarCarpeta(path.join(c, 'archivo-extra'), path.join(datosLocales(), 'archivo-extra'));
    }
    delete cfg.carpetaTrabajo; await guardarConfig(cfg);
    return { carpeta: null };
  }
  const yaTenia = fs.existsSync(path.join(dir, 'perfil.json'));
  let perfilLocal = null; try { perfilLocal = JSON.parse(await fsp.readFile(rutaPerfilLocal(), 'utf8')); } catch {}
  cfg.carpetaTrabajo = dir; await guardarConfig(cfg);
  await fsp.mkdir(path.join(dir, 'Proyectos'), { recursive: true });
  if (!yaTenia && perfilLocal) await guardarPerfil(perfilLocal);
  const extras = fs.existsSync(path.join(dir, 'archivo-extra', 'extra.json')) ? 0 : await copiarCarpeta(path.join(datosLocales(), 'archivo-extra'), path.join(dir, 'archivo-extra'));
  return { carpeta: dir, usoPerfilExistente: yaTenia, extrasCopiados: extras };
}
function deCompartidoCon(p, c) { // como deCompartido, pero con una carpeta que está por dejar de usarse
  const out = { ...p };
  if (Array.isArray(out.recientes)) out.recientes = out.recientes.map(r => r.ruta && r.ruta.startsWith(MARCA) ? { ...r, ruta: path.join(c, ...r.ruta.slice(MARCA.length).split('/')) } : r);
  return out;
}

// ---------------- libros abiertos en dos equipos ----------------
// Junto a cada libro de la carpeta de trabajo queda una nota «.abierto» con el equipo que lo tiene abierto.
const notaDe = ruta => ruta + '.abierto';
const enCarpeta = ruta => { const c = carpeta(); return !!(c && ruta && path.resolve(ruta).startsWith(path.resolve(c) + path.sep)); };
const mios = new Set();
async function marcarAbierto(ruta) {
  if (!enCarpeta(ruta)) return null;
  let otro = null;
  try { const n = JSON.parse(await fsp.readFile(notaDe(ruta), 'utf8')); if (n.equipo !== nombreEquipo() && Date.now() - Date.parse(n.desde) < 24 * 3600e3) otro = n; } catch {}
  try { await fsp.writeFile(notaDe(ruta), JSON.stringify({ equipo: nombreEquipo(), desde: new Date().toISOString() })); mios.add(ruta); } catch {}
  return otro;
}
async function soltar(ruta) {
  if (!ruta || !mios.has(ruta)) return;
  mios.delete(ruta);
  try { const n = JSON.parse(await fsp.readFile(notaDe(ruta), 'utf8')); if (n.equipo === nombreEquipo()) await fsp.unlink(notaDe(ruta)); } catch {}
}
function soltarTodo() { for (const r of mios) { try { const n = JSON.parse(fs.readFileSync(notaDe(r), 'utf8')); if (n.equipo === nombreEquipo()) fs.unlinkSync(notaDe(r)); } catch {} } mios.clear(); }

module.exports = { leerConfig, carpeta, carpetaElegida, carpetaExtra, carpetaProyectos, rutaPerfil, leerPerfil, guardarPerfil, usarCarpeta, nombreEquipo, marcarAbierto, soltar, soltarTodo, enCarpeta, datosLocales };
