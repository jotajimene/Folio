/* Folio · índice analítico: eliges nombres y conceptos; Folio arma el índice con las páginas reales */
(function () {
  'use strict';
  const { esc } = App;
  const ia = () => Folio.p.indiceAnalitico || { activo: true, terminos: [] };
  function contar(t) { const re = new RegExp('(?<![\\p{L}\\d])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\d])', 'giu'); return Folio.p.bloques.reduce((a, b) => a + (b.texto.match(re) || []).length, 0); }
  // sugerencias: nombres propios que se repiten (mayúscula que no abre oración)
  function sugerir() {
    const cuenta = new Map();
    for (const b of Folio.p.bloques) { if (b.tipo !== 'p' && b.tipo !== 'cita') continue; const re = /(?<=[\p{Ll},;:]\s+)(\p{Lu}\p{Ll}+(?:\s+(?:de\s+|del\s+)?\p{Lu}\p{Ll}+)*)/gu; let m; while ((m = re.exec(b.texto))) cuenta.set(m[1], (cuenta.get(m[1]) || 0) + 1); }
    const ya = new Set(ia().terminos.map(x => x.t.toLowerCase()));
    return [...cuenta].filter(([t, n]) => n >= 2 && !ya.has(t.toLowerCase())).sort((a, b) => b[1] - a[1]).slice(0, 30);
  }
  async function ventana() {
    const d = ia(), sug = sugerir();
    const r = await App.modal({ titulo: 'Índice analítico', ancho: 720, cuerpo: `<label class="chequeo"><input type="checkbox" class="ia-activo" ${d.activo !== false ? 'checked' : ''}> Incluir el índice analítico al final del libro</label>
      <div class="campos" style="grid-template-columns:1fr auto"><label class="campo"><span>Agregar un nombre o concepto</span><input class="ia-nuevo" placeholder="por ejemplo: Valdivia"></label><button class="boton chico ia-agregar" style="align-self:end;margin-bottom:8px">Agregar</button></div>
      <div class="sub">En el índice (${d.terminos.length})</div><ul class="lista ia-lista">${d.terminos.map((x, i) => `<li>${esc(x.t)} <span>${contar(x.t)} veces · <button class="enlace" data-quitar-ia="${i}">quitar</button></span></li>`).join('') || '<li><i>Ninguno todavía.</i></li>'}</ul>
      ${sug.length ? `<div class="sub">Nombres que se repiten en el texto</div><div class="fila-botones">${sug.map(([t, n]) => `<button class="boton chico" data-sug="${esc(t)}">${esc(t)} · ${n}</button>`).join('')}</div>` : ''}
      <p class="nota">Folio busca cada término en todo el libro (sin distinguir mayúsculas) y pone las páginas reales al componer.</p>`,
      botones: [{ texto: 'Listo', taco: true, valor: c => ({ activo: c.querySelector('.ia-activo').checked }) }],
      alAbrir: (m, ctx) => m.addEventListener('click', e => {
        const add = t => { t = t.trim(); if (!t) return; Folio.cambiar('indice-analitico', p => { p.indiceAnalitico = p.indiceAnalitico || { activo: true, terminos: [] }; if (!p.indiceAnalitico.terminos.some(x => x.t.toLowerCase() === t.toLowerCase())) p.indiceAnalitico.terminos.push({ t }); }); ctx.cerrar(null); ventana(); };
        if (e.target.closest('.ia-agregar')) add(m.querySelector('.ia-nuevo').value);
        const s = e.target.closest('[data-sug]'); if (s) add(s.dataset.sug);
        const q = e.target.closest('[data-quitar-ia]'); if (q) { Folio.cambiar('indice-analitico', p => { p.indiceAnalitico.terminos.splice(+q.dataset.quitarIa, 1); }); ctx.cerrar(null); ventana(); }
      }),
    });
    if (r) Folio.cambiar('indice-analitico', p => { p.indiceAnalitico = p.indiceAnalitico || { terminos: [] }; p.indiceAnalitico.activo = r.activo; });
  }
  // desde el editor: agregar lo seleccionado
  function agregarSeleccion() { const t = String(getSelection()).trim(); if (!t || t.length > 60) return App.aviso('Selecciona una palabra o un nombre en el texto.'); Folio.cambiar('indice-analitico', p => { p.indiceAnalitico = p.indiceAnalitico || { activo: true, terminos: [] }; if (!p.indiceAnalitico.terminos.some(x => x.t.toLowerCase() === t.toLowerCase())) p.indiceAnalitico.terminos.push({ t }); }); App.aviso(`«${t}» va al índice analítico (${contar(t)} apariciones).`); }
  window.IndiceAnalitico = { ventana, agregarSeleccion, contar };
})();
