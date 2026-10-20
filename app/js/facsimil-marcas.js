/* Folio · marcas de transcripción facsimilar (compartido por el editor, la vista y la impresión)
 *   [-texto-]   tachado en el original
 *   [+texto+]   añadido entre líneas o al margen
 *   [...]       ilegible  (también [ilegible])
 *   [?texto?]   lectura dudosa
 *   q{ue}       abreviatura desarrollada (lo que va entre llaves no está escrito en el original)
 *   {{nota}}    nota del editor (al pie)
 * Modo «paleográfica»: muestra todas las marcas. Modo «lectura»: texto limpio y modernizable.
 */
(function (raiz) {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const RE = /\{\{(.+?)\}\}|\[-(.+?)-\]|\[\+(.+?)\+\]|\[(?:\.\.\.|…|ilegible)\]|\[\?(.+?)\?\]|\{([^{}]+)\}/gu;
  function linea(t, modo, notas) {
    let out = '', i = 0, m; RE.lastIndex = 0;
    while ((m = RE.exec(t))) {
      out += esc(t.slice(i, m.index)); i = m.index + m[0].length;
      if (m[1] != null) { notas.push(m[1]); out += `<span class="nota-pie">${esc(m[1])}</span>`; }
      else if (m[2] != null) out += modo === 'lectura' ? '' : `<del class="fx-del">${esc(m[2])}</del>`;
      else if (m[3] != null) out += modo === 'lectura' ? esc(m[3]) : `<span class="fx-add">⸌${esc(m[3])}⸍</span>`;
      else if (m[4] != null) out += modo === 'lectura' ? esc(m[4]) : `${esc(m[4])}<span class="fx-dud">(?)</span>`;
      else if (m[5] != null) out += modo === 'lectura' ? esc(m[5]) : `<i class="fx-abr">${esc(m[5])}</i>`;
      else out += modo === 'lectura' ? '[…]' : '<span class="fx-il">[ilegible]</span>';
    }
    out += esc(t.slice(i));
    return modo === 'lectura' ? out.replace(/ {2,}/g, ' ').replace(/ ([.,;:])/g, '$1') : out;
  }
  // texto sin marcas (para contar, buscar o exportar)
  const plano = t => String(t).replace(RE, (m, nota, del, add, dud, abr) => nota != null ? '' : del != null ? '' : add ?? dud ?? abr ?? '[…]');
  const api = { linea, plano, RE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.FacsimilMarcas = api;
})(typeof window !== 'undefined' ? window : globalThis);
