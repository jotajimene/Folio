/* Folio · librojuegos: secciones numeradas y remisiones del tipo «ve a la [[puerta]]» */
(function () {
  'use strict';
  const { esc } = App;
  function analizar(p = Folio.p) {
    const secs = [], porEt = new Map(); let actual = null;
    for (const b of p.bloques) {
      if (b.tipo === 'seccion') { actual = { et: b.texto.trim(), id: b.id, refs: [], texto: '' }; secs.push(actual); porEt.set(actual.et, actual); continue; }
      if (!actual) continue;
      actual.texto += ' ' + b.texto; for (const m of b.texto.matchAll(/\[\[([^\]]+)\]\]/g)) actual.refs.push(m[1].trim());
    }
    const finales = new Set((p.librojuego && p.librojuego.finales) || []);
    const faltan = [], llegan = new Set(), sinSalida = [];
    for (const s of secs) { for (const r of s.refs) { if (!porEt.has(r)) faltan.push({ desde: s.et, a: r }); else llegan.add(r); } if (!s.refs.length && !finales.has(s.et) && !/\bFIN\b/.test(s.texto)) sinSalida.push(s.et); }
    // alcanzables desde la primera
    const alc = new Set(); const pila = secs[0] ? [secs[0].et] : [];
    while (pila.length) { const e = pila.pop(); if (alc.has(e)) continue; alc.add(e); for (const r of (porEt.get(e) || { refs: [] }).refs) if (porEt.has(r)) pila.push(r); }
    const inalcanzables = secs.filter(s => !alc.has(s.et)).map(s => s.et);
    const repetidas = secs.map(s => s.et).filter((e, i, a) => a.indexOf(e) !== i);
    return { secs, faltan, sinSalida, inalcanzables, repetidas, numeros: Libro.numerarLJ(p) || new Map(), finales };
  }
  async function ventana() {
    const a = analizar(), lj = Folio.p.librojuego || {};
    const fila = s => `<li><span><b>${a.numeros.get(s.et) || '?'}</b> · ${esc(s.et)}</span><span>${s.refs.length ? '→ ' + s.refs.map(r => (a.numeros.get(r) || '¿' + esc(r) + '?')).join(', ') : `<label><input type="checkbox" data-final="${esc(s.et)}" ${a.finales.has(s.et) ? 'checked' : ''}> final</label>`}</span></li>`;
    const problemas = [...a.faltan.map(f => `En «${esc(f.desde)}» se remite a «${esc(f.a)}», que no existe.`), ...a.inalcanzables.map(e => `A «${esc(e)}» no se llega desde ninguna parte.`), ...a.sinSalida.map(e => `«${esc(e)}» no remite a ninguna otra: márcala como final o agrega una salida.`), ...a.repetidas.map(e => `La etiqueta «${esc(e)}» está repetida.`)];
    await App.modal({ titulo: 'Secciones del librojuego', ancho: 760, cuerpo: `<p class="nota">Marca el inicio de cada sección con un bloque de tipo «sección» cuyo texto es su etiqueta (por ejemplo: <i>puerta</i>). En el texto, remite con <b>[[puerta]]</b>: Folio pone el número que le toque. La primera sección es siempre la 1.</p>
      <label class="chequeo"><input type="checkbox" class="lj-barajar" ${lj.barajar ? 'checked' : ''}> Barajar los números (para que no se lea en orden)</label> <button class="boton chico lj-otra">↻ Otro orden</button>
      <div class="sub">${a.secs.length} secciones</div><ul class="lista">${a.secs.map(fila).join('') || '<li><i>Aún no hay secciones.</i></li>'}</ul>
      <div class="sub">Comprobación</div>${problemas.length ? `<ul class="lista">${problemas.map(x => `<li class="mal">${x}</li>`).join('')}</ul>` : '<p class="nota">Todos los caminos llevan a algún lado y a todas las secciones se llega.</p>'}`,
      botones: [{ texto: 'Cerrar', valor: null }],
      alAbrir: (m, ctx) => {
        m.addEventListener('change', e => {
          if (e.target.classList.contains('lj-barajar')) Folio.cambiar('librojuego', p => { p.librojuego = { ...(p.librojuego || {}), barajar: e.target.checked, semilla: (p.librojuego && p.librojuego.semilla) || 7 }; });
          if (e.target.dataset.final) Folio.cambiar('librojuego', p => { const f = new Set((p.librojuego && p.librojuego.finales) || []); e.target.checked ? f.add(e.target.dataset.final) : f.delete(e.target.dataset.final); p.librojuego = { ...(p.librojuego || {}), finales: [...f] }; });
          ctx.cerrar(null); ventana();
        });
        m.querySelector('.lj-otra').onclick = () => { Folio.cambiar('librojuego', p => { p.librojuego = { ...(p.librojuego || {}), barajar: true, semilla: Math.floor(Math.random() * 1e6) }; }); ctx.cerrar(null); ventana(); };
      },
    });
  }
  window.Librojuego = { analizar, ventana };
})();
