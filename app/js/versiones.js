/* Folio · versiones del manuscrito: guardar un estado con nombre, comparar y volver */
(function () {
  'use strict';
  const { esc } = App;
  function guardar(nombre) {
    Folio.cambiar('versiones:guardar', p => {
      p.versiones = p.versiones || [];
      p.versiones.push({ id: Folio.uid(), nombre, fecha: new Date().toISOString(), bloques: JSON.parse(JSON.stringify(p.bloques)), ilustraciones: JSON.parse(JSON.stringify(p.ilustraciones || [])) });
    });
  }
  // diferencias por bloque: cambiado, nuevo o quitado (emparejados por id)
  function comparar(v) {
    const ahora = Folio.p.bloques, antes = v.bloques, idA = new Map(antes.map(b => [b.id, b])), idH = new Map(ahora.map(b => [b.id, b]));
    const cambios = [];
    for (const b of ahora) { const a = idA.get(b.id); if (!a) cambios.push({ tipo: 'nuevo', ahora: b }); else if (a.texto !== b.texto || a.tipo !== b.tipo) cambios.push({ tipo: 'cambiado', antes: a, ahora: b }); }
    for (const a of antes) if (!idH.has(a.id)) cambios.push({ tipo: 'quitado', antes: a });
    return cambios;
  }
  // marca las diferencias dentro de un párrafo (prefijo y sufijo comunes)
  function marcar(a, b) {
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    let j = 0; while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
    const ctx = s => esc(s.length > 140 ? '…' + s.slice(-140) : s), ctxF = s => esc(s.length > 140 ? s.slice(0, 140) + '…' : s);
    return { antes: ctx(a.slice(0, i)) + `<del>${esc(a.slice(i, a.length - j))}</del>` + ctxF(a.slice(a.length - j)), ahora: ctx(b.slice(0, i)) + `<ins>${esc(b.slice(i, b.length - j))}</ins>` + ctxF(b.slice(b.length - j)) };
  }
  async function ver(id) {
    const v = (Folio.p.versiones || []).find(x => x.id === id); if (!v) return;
    const c = comparar(v);
    const filas = c.slice(0, 200).map(x => x.tipo === 'cambiado' ? (m => `<div class="dif"><small>cambiado</small><p>${m.antes}</p><p>${m.ahora}</p></div>`)(marcar(x.antes.texto, x.ahora.texto)) : x.tipo === 'nuevo' ? `<div class="dif"><small>nuevo</small><p><ins>${esc(x.ahora.texto.slice(0, 300))}</ins></p></div>` : `<div class="dif"><small>quitado</small><p><del>${esc(x.antes.texto.slice(0, 300))}</del></p></div>`).join('');
    const r = await App.modal({ titulo: `«${esc(v.nombre)}» y el texto de ahora`, ancho: 860, cuerpo: `<p class="nota">Versión del ${new Date(v.fecha).toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' })}. ${c.length ? c.length + ' bloques distintos.' : 'Sin diferencias.'}</p><div class="difs">${filas}</div>`, botones: [{ texto: 'Cerrar', valor: null }, { texto: 'Borrar esta versión', valor: 'borrar' }, { texto: 'Volver a esta versión', valor: 'volver' }] });
    if (r === 'volver' && await App.confirmar('El texto vuelve a como estaba en esa versión. Puedes deshacerlo con Ctrl+Z, y conviene guardar antes el estado actual como versión.', 'Volver')) Folio.cambiar('versiones:volver', p => { p.bloques = JSON.parse(JSON.stringify(v.bloques)); p.ilustraciones = JSON.parse(JSON.stringify(v.ilustraciones || [])); });
    if (r === 'borrar') Folio.cambiar('versiones:borrar', p => { p.versiones = p.versiones.filter(x => x.id !== id); });
  }
  async function pedirNombre() {
    const n = await App.modal({ titulo: 'Guardar una versión', cuerpo: `<label class="campo"><span>Nombre</span><input class="nombre-version" value="Versión del ${new Date().toLocaleDateString('es-CL')}"></label><p class="nota">Queda dentro del proyecto. Sirve para comparar después o volver atrás.</p>`, botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Guardar', taco: true, valor: c => c.querySelector('.nombre-version').value.trim() }] });
    if (n) { guardar(n); App.aviso('Versión guardada.'); }
  }
  const lista = () => (Folio.p.versiones || []).slice().reverse();
  window.Versiones = { guardar, comparar, ver, pedirNombre, lista };
})();
