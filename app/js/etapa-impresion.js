/* Folio · etapa VI · Impresión: PDF de lectura, pliegos imponibles y cubierta */
(function () {
  'use strict';
  const { esc, panel } = App;
  let salida = 'pliegos', trabajando = false, ultimo = null;

  function paginas() { return (Folio.p.composicion && Folio.p.composicion.paginas) || 0; }
  // mismo cálculo que hace el proceso principal al imponer (cosido a caballete por cuadernillo)
  function mapa(n, tam) {
    const t0 = tam === 0 ? Math.ceil(n / 4) * 4 : tam, out = [];
    for (let i = 0, g = 0; i < n; i += t0, g++) {
      const t = Math.ceil(Math.min(t0, n - i) / 4) * 4, hojas = [];
      for (let k = 0; k < t / 4; k++) hojas.push({ frente: [t - 2 * k, 1 + 2 * k].map(x => i + x), dorso: [2 + 2 * k, t - 1 - 2 * k].map(x => i + x) });
      out.push({ n: g + 1, desde: i + 1, hasta: i + t, hojas });
    }
    return out;
  }
  function render() {
    const p = Folio.p, n = paginas(), [W, H] = Folio.formatoMm(), pl = p.impresion.pliego;
    if (!p.bloques.length) return { cols: '1fr', html: panel('vacio', 'Impresión', 'sin texto', `<div class="vacio"><h2>No hay libro que imprimir</h2><button class="boton taco" data-ir="0">← Ir al manuscrito</button></div>`) };
    const cuad = n ? mapa(n, pl) : [];
    const blancas = cuad.reduce((a, c) => a + (c.hasta - c.desde + 1), 0) - n;
    const salidas = [
      ['lectura', 'Lectura', `${n || '¿?'} págs ${p.formato} en orden`],
      ['pliegos', 'Pliegos', `${Math.ceil(n / 4) || '¿?'} hojas de ${W * 2}×${H} mm, a dos caras`],
      ['cubierta', 'Cubierta', 'frente, o extendida con lomo y sangrado'],
    ];
    let centro = '';
    if (salida === 'pliegos') {
      centro = `<div class="campos" style="grid-template-columns:1fr 1fr"><label class="campo"><span>Páginas por cuadernillo</span><select data-pliego><option value="16" ${pl === 16 ? 'selected' : ''}>16 (4 hojas dobladas)</option><option value="32" ${pl === 32 ? 'selected' : ''}>32 (8 hojas)</option><option value="8" ${pl === 8 ? 'selected' : ''}>8 (2 hojas)</option><option value="0" ${pl === 0 ? 'selected' : ''}>Uno solo con todo el libro</option></select></label><label class="campo"><span>Grosor de cada hoja (mm), para el lomo</span><input data-grosor value="${p.impresion.grosorHoja}"></label></div>
        ${n ? cuad.slice(0, 3).map(c => `<div class="sub">Cuadernillo ${c.n} · páginas ${c.desde} a ${c.hasta}</div><div class="pliegos">${c.hojas.map((h, k) => `<div class="pliego"><div><b class="${h.frente[0] > n ? 'blanca' : ''}">${h.frente[0] > n ? '—' : h.frente[0]}</b><b class="${h.frente[1] > n ? 'blanca' : ''}">${h.frente[1] > n ? '—' : h.frente[1]}</b></div>Hoja ${k + 1} · frente</div><div class="pliego"><div><b class="${h.dorso[0] > n ? 'blanca' : ''}">${h.dorso[0] > n ? '—' : h.dorso[0]}</b><b class="${h.dorso[1] > n ? 'blanca' : ''}">${h.dorso[1] > n ? '—' : h.dorso[1]}</b></div>Hoja ${k + 1} · dorso</div>`).join('')}</div>`).join('') + (cuad.length > 3 ? `<p class="nota">y ${cuad.length - 3} cuadernillos más con el mismo orden.</p>` : '') : '<p class="nota">Compón el interior primero para saber cuántas páginas tiene.</p>'}
        <p class="nota">Imprime a dos caras volteando por el lado corto. Dobla cada hoja por la mitad, anida las hojas de un cuadernillo en orden y cose por el pliegue.</p>`;
    } else if (salida === 'lectura') {
      centro = `<p>Un PDF con las ${n || ''} páginas en orden de lectura, al tamaño exacto ${W}×${H} mm, sin marcas. Sirve para revisar en pantalla, enviar a una imprenta que impone sola o imprimir página por página.</p>`;
    } else {
      centro = `<div class="fila-botones"><button class="boton ${p.impresion.cubiertaModo !== 'extendida' ? 'taco' : ''}" data-cmodo="frente">Solo el frente</button><button class="boton ${p.impresion.cubiertaModo === 'extendida' ? 'taco' : ''}" data-cmodo="extendida">Extendida (contra, lomo y frente)</button></div>
        <p class="nota">La extendida lleva 3 mm de sangrado por lado y el lomo calculado con ${n || '¿?'} páginas × ${String(p.impresion.grosorHoja).replace('.', ',')} mm por hoja. La imagen va a 300 ppp; los textos quedan como texto (vectoriales).</p>`;
    }
    const avisosInt = p.composicion ? p.composicion.avisos : null;
    const der = `<ul class="lista">
      <li class="${n ? '' : 'mal'}">Interior compuesto <span>${n ? n + ' págs' : 'falta →'}</span></li>
      <li>Tamaño de hoja <span>${salida === 'pliegos' ? `${W * 2} × ${H} mm` : `${W} × ${H} mm`}</span></li>
      ${salida === 'pliegos' ? `<li>Blancas añadidas al final <span>${n ? blancas : '—'}</span></li>` : ''}
      <li>Tipografías <span>incorporadas en el PDF</span></li>
      <li class="${avisosInt ? 'mal' : ''}">Avisos del interior <span>${avisosInt == null ? '—' : avisosInt}</span></li>
      <li class="${p.titulo && p.autor ? '' : 'mal'}">Título y autoría <span>${p.titulo && p.autor ? 'listos' : 'faltan'}</span></li></ul>
      ${ultimo ? `<div class="sub">Último PDF</div><p class="nota">${esc(ultimo.ruta.split(/[\\/]/).pop())} · ${ultimo.paginas} pág. de ${ultimo.mm.map(x => Math.round(x)).join('×')} mm</p><button class="boton chico" data-r="mostrar">Mostrar en la carpeta</button>` : ''}`;
    return {
      cols: '1fr 320px',
      html: panel('pliegos', { lectura: 'PDF de lectura', pliegos: 'Pliegos para encuadernar', cubierta: 'Cubierta' }[salida], 'elige qué preparar', `<div class="salidas">${salidas.map(([k, t, s]) => `<button class="${salida === k ? 'on' : ''}" data-salida="${k}"><b>${t}</b><small>${s}</small></button>`).join('')}</div>${centro}`) +
        panel('previa', 'Comprobación previa', 'antes de imprimir', der, `<button class="boton taco" data-r="pdf" ${trabajando || (!n && salida !== 'cubierta') ? 'disabled' : ''}>${trabajando ? 'Preparando el PDF…' : 'Guardar el PDF de ' + { lectura: 'lectura', pliegos: 'pliegos', cubierta: 'cubierta' }[salida]}</button>${!n && salida !== 'cubierta' ? '<button class="boton" data-ir="3" style="margin-top:6px;width:100%">Componer el interior</button>' : ''}`),
    };
  }
  async function pdf() {
    if (!window.Escritorio) { App.aviso('Los PDF se generan en la aplicación de escritorio.'); return; }
    const p = Folio.p, n = paginas();
    const trabajo = { tipo: salida, proyecto: JSON.parse(JSON.stringify(p)), recursos: Folio.recursos, modo: p.impresion.cubiertaModo || 'frente', paginas: n || 48, imposicion: { pliego: p.impresion.pliego, mmPagina: Folio.formatoMm() } };
    const nombre = `${(p.titulo || 'libro').replace(/[\\/:*?"<>|]/g, '')} · ${{ lectura: 'lectura', pliegos: 'pliegos', cubierta: 'cubierta' }[salida]}.pdf`;
    trabajando = true; App.refrescar();
    try {
      const r = await Escritorio.pdf(trabajo, nombre);
      if (r && !r.cancelado) { ultimo = r; App.aviso(`PDF guardado: ${r.paginas} páginas.`); }
    } catch (e) { App.aviso('No se pudo generar el PDF: ' + e.message, { tipo: 'mal', ms: 9000 }); }
    trabajando = false; App.refrescar();
  }
  function montar(m) {
    m.addEventListener('click', e => {
      const s = e.target.closest('[data-salida]'); if (s) { salida = s.dataset.salida; return App.refrescar(); }
      const cm = e.target.closest('[data-cmodo]'); if (cm) return Folio.cambiar('impresion:cubierta', p => { p.impresion.cubiertaModo = cm.dataset.cmodo; });
      const r = e.target.closest('[data-r]'); if (!r) return;
      if (r.dataset.r === 'pdf') pdf();
      if (r.dataset.r === 'mostrar' && ultimo) Escritorio.mostrar(ultimo.ruta);
    });
    m.addEventListener('change', e => {
      if (e.target.matches('[data-pliego]')) Folio.cambiar('impresion:pliego', p => { p.impresion.pliego = +e.target.value; });
      if (e.target.matches('[data-grosor]')) { const v = parseFloat(String(e.target.value).replace(',', '.')); if (v > 0 && v < 1) Folio.cambiar('impresion:grosor', p => { p.impresion.grosorHoja = v; }); }
    });
  }
  App.registrar({ indice: 5, n: 'VI', nombre: 'Impresión', estado: () => paginas() ? `${Math.ceil(paginas() / 4)} hojas` : 'por componer', render, montar, mapa });
})();
