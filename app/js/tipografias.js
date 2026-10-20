/* Folio · tus propias tipografías (OTF, TTF o WOFF)
 * Revisa que tengan los caracteres del español y si su licencia permite incrustarlas en un PDF.
 */
(function () {
  'use strict';
  const { esc } = App;
  const NECESARIOS = 'ñÑáéíóúÁÉÍÓÚüÜ¿¡«»—–“”‘’…';

  async function aSfnt(buf) {
    const v = new DataView(buf), sig = v.getUint32(0);
    if (sig === 0x774F4646) { // WOFF 1: descomprimir tablas
      const n = v.getUint16(12), flavor = v.getUint32(4), tablas = [];
      for (let i = 0; i < n; i++) { const o = 44 + i * 20; tablas.push({ tag: v.getUint32(o), off: v.getUint32(o + 4), comp: v.getUint32(o + 8), orig: v.getUint32(o + 12), sum: v.getUint32(o + 16) }); }
      const datos = await Promise.all(tablas.map(async t => { const src = new Uint8Array(buf, t.off, t.comp); if (t.comp === t.orig) return src; const ds = new DecompressionStream('deflate'); return new Uint8Array(await new Response(new Blob([src]).stream().pipeThrough(ds)).arrayBuffer()); }));
      let tam = 12 + 16 * n; const offs = datos.map(d => { const o = tam; tam += (d.length + 3) & ~3; return o; });
      const out = new ArrayBuffer(tam), w = new DataView(out), u8 = new Uint8Array(out);
      w.setUint32(0, flavor); w.setUint16(4, n);
      tablas.forEach((t, i) => { const o = 12 + i * 16; w.setUint32(o, t.tag); w.setUint32(o + 4, t.sum); w.setUint32(o + 8, offs[i]); w.setUint32(o + 12, datos[i].length); u8.set(datos[i], offs[i]); });
      return out;
    }
    if (sig === 0x774F4632) throw new Error('Es WOFF2: conviértela a OTF o TTF (por ejemplo con FontForge) y vuelve a cargarla.');
    if (sig !== 0x00010000 && sig !== 0x4F54544F && sig !== 0x74727565) throw new Error('No reconozco el formato de la tipografía.');
    return buf;
  }
  function tablas(buf) { const v = new DataView(buf), n = v.getUint16(4), t = {}; for (let i = 0; i < n; i++) { const o = 12 + i * 16; t[String.fromCharCode(...[0, 1, 2, 3].map(k => v.getUint8(o + k)))] = { off: v.getUint32(o + 8), len: v.getUint32(o + 12) }; } return t; }
  function cmap(buf, t) {
    const v = new DataView(buf), base = t.cmap.off, n = v.getUint16(base + 2); const cps = new Set();
    let elegido = null;
    for (let i = 0; i < n; i++) { const pid = v.getUint16(base + 4 + i * 8), eid = v.getUint16(base + 6 + i * 8), off = v.getUint32(base + 8 + i * 8); const fmt = v.getUint16(base + off); if ((pid === 3 && (eid === 10 || eid === 1)) || pid === 0) { if (!elegido || fmt === 12) elegido = { off: base + off, fmt }; } }
    if (!elegido) return cps;
    const o = elegido.off;
    if (elegido.fmt === 4) { const seg = v.getUint16(o + 6) / 2; for (let s = 0; s < seg; s++) { const fin = v.getUint16(o + 14 + s * 2), ini = v.getUint16(o + 16 + seg * 2 + s * 2); for (let c = ini; c <= fin && c < 0xFFFF; c++) cps.add(c); } }
    if (elegido.fmt === 12) { const ng = v.getUint32(o + 12); for (let g = 0; g < ng; g++) { const ini = v.getUint32(o + 16 + g * 12), fin = v.getUint32(o + 20 + g * 12); for (let c = ini; c <= fin && c < 0x30000; c++) cps.add(c); } }
    return cps;
  }
  function nombre(buf, t, id) {
    if (!t.name) return ''; const v = new DataView(buf), b = t.name.off, n = v.getUint16(b + 2), st = b + v.getUint16(b + 4);
    for (let i = 0; i < n; i++) { const r = b + 6 + i * 12; const pid = v.getUint16(r), nid = v.getUint16(r + 6), len = v.getUint16(r + 8), off = v.getUint16(r + 10); if (nid !== id) continue; if (pid === 3 || pid === 0) { let s = ''; for (let k = 0; k < len; k += 2) s += String.fromCharCode(v.getUint16(st + off + k)); return s; } }
    return '';
  }
  async function analizar(archivo) {
    const sf = await aSfnt(await archivo.arrayBuffer()), t = tablas(sf);
    const familia = nombre(sf, t, 16) || nombre(sf, t, 1) || archivo.name.replace(/\.[^.]+$/, ''), sub = (nombre(sf, t, 17) || nombre(sf, t, 2) || 'Regular');
    const cps = t.cmap ? cmap(sf, t) : new Set();
    const faltan = [...NECESARIOS].filter(c => !cps.has(c.codePointAt(0)));
    let fsType = 0; if (t['OS/2']) fsType = new DataView(sf).getUint16(t['OS/2'].off + 8);
    const avisos = [];
    if (faltan.length) avisos.push('Le faltan: ' + faltan.join(' '));
    if (fsType & 0x0002) avisos.push('Su licencia no permite incrustarla en documentos (restricción de uso). No la uses en un PDF que vayas a distribuir.');
    else if (fsType & 0x0200) avisos.push('Solo permite incrustar mapas de bits.');
    else if (fsType & 0x0004) avisos.push('Licencia «solo vista previa e impresión»: se puede usar para imprimir.');
    const estilo = /italic|oblique|cursiva/i.test(sub) ? 'italic' : 'normal', peso = /bold|negrita|black|heavy/i.test(sub) ? 700 : /semibold|demi/i.test(sub) ? 600 : /light|thin/i.test(sub) ? 300 : 400;
    const b64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(new Blob([sf])); });
    return { familia, sub, estilo, peso, faltan, fsType, avisos, datos: 'data:font/' + (new DataView(sf).getUint32(0) === 0x4F54544F ? 'otf' : 'ttf') + ';base64,' + b64 };
  }
  const clave = familia => 'U-' + familia.replace(/[^\p{L}\d]+/gu, '');
  function registrarCSS() {
    let st = document.getElementById('fuentes-propias'); if (!st) { st = document.createElement('style'); st.id = 'fuentes-propias'; document.head.appendChild(st); }
    st.textContent = (Perfil.datos.fuentes || []).map(f => `@font-face{font-family:"${clave(f.familia)}";src:url(${f.datos});font-style:${f.estilo};font-weight:${f.peso}}`).join('\n');
    for (const f of Perfil.datos.fuentes || []) Folio.FUENTES[clave(f.familia)] = f.familia + ' (tuya)';
  }
  async function cargar() {
    const archivos = await new Promise(res => { const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.otf,.ttf,.woff,.woff2'; inp.onchange = () => res([...inp.files]); inp.click(); });
    if (!archivos.length) return;
    const ok = [], informes = [];
    for (const a of archivos) { try { const f = await analizar(a); ok.push(f); informes.push(`<li class="${f.avisos.length ? 'mal' : ''}"><b>${esc(f.familia)}</b> ${esc(f.sub)} <span>${f.avisos.length ? esc(f.avisos.join(' ')) : 'completa ✓'}</span></li>`); } catch (e) { informes.push(`<li class="mal">${esc(a.name)} <span>${esc(e.message)}</span></li>`); } }
    const r = await App.modal({ titulo: 'Revisión de las tipografías', ancho: 680, cuerpo: `<ul class="lista">${informes.join('')}</ul><p class="nota">Se guardan en tu perfil y quedan disponibles para todos los libros. Al usarlas en un libro, viajan dentro del proyecto.</p>`, botones: [{ texto: 'Cancelar', valor: null }, ...(ok.length ? [{ texto: 'Agregarlas', taco: true, valor: 'ok' }] : [])] });
    if (r !== 'ok') return;
    Perfil.datos.fuentes = [...(Perfil.datos.fuentes || []).filter(x => !ok.some(o => o.familia === x.familia && o.estilo === x.estilo && o.peso === x.peso)), ...ok.map(({ familia, sub, estilo, peso, datos, avisos }) => ({ familia, sub, estilo, peso, datos, avisos }))];
    await Perfil.guardar(); registrarCSS(); App.aviso('Tipografías agregadas.'); App.refrescar();
  }
  // al elegir una tipografía propia en un libro, sus archivos se copian al proyecto
  function alProyecto(k) {
    if (!k || !k.startsWith('U-')) return;
    const fs = (Perfil.datos.fuentes || []).filter(f => clave(f.familia) === k);
    Folio.cambiar('ajuste:fuentes', p => { p.fuentesPropias = (p.fuentesPropias || []).filter(x => x.clave !== k); for (const f of fs) { const n = 'fuente-' + k + '-' + f.estilo + f.peso; Folio.recursos[n] = f.datos; p.fuentesPropias.push({ clave: k, familia: f.familia, recurso: n, estilo: f.estilo, peso: f.peso }); } }, { sinHistorial: true, silencioso: true });
  }
  window.Tipografias = { cargar, analizar, registrarCSS, alProyecto, clave };
})();
