/* Folio · etapa VI · Impresión: PDF de lectura o para imprenta, pliegos según la encuadernación, cubierta, libro digital */
(function () {
  'use strict';
  const { esc, panel } = App;
  let salida = 'pliegos', trabajando = false, ultimo = null;
  const ENC = () => PlanImposicion.ENCUADERNACIONES;

  function paginas() { return (Folio.p.composicion && Folio.p.composicion.paginas) || 0; }
  function im() { const p = Folio.p; p.impresion.encuadernacion = p.impresion.encuadernacion || 'caballete'; return p.impresion; }
  function vistaPliegos(n) {
    const i = im(), P = PlanImposicion.plan(n, i.encuadernacion, i.pliego);
    const pos = (x, rot) => `<b class="${x > n ? 'blanca' : ''}${rot ? ' giro' : ''}">${x > n ? '—' : x}</b>`;
    const hojas = P.hojas.slice(0, i.encuadernacion === 'caballete' ? 8 : 6);
    return `${hojas.map(h => `<div class="pliego-grupo"><div class="sub">${esc(h.etiqueta)}</div><div class="pliegos">${h.caras.map((cara, ci) => `<div class="pliego"><div class="rejilla-pliego" style="grid-template-columns:repeat(${h.cols},auto)">${cara.map(c => pos(c.p, c.rot === 180)).join('')}</div>${h.caras.length > 1 ? (ci ? 'dorso' : 'frente') : 'una cara'}</div>`).join('')}</div></div>`).join('')}
      ${P.hojas.length > hojas.length ? `<p class="nota">y ${P.hojas.length - hojas.length} hojas más con el mismo orden.</p>` : ''}
      <p class="nota instrucciones">${esc(P.instrucciones)}</p>`;
  }
  function render() {
    const p = Folio.p, n = paginas(), [W, H] = Folio.formatoMm(), i = im();
    if (!Folio.tieneContenido(p)) return { cols: '1fr', html: panel('vacio', 'Impresión', 'sin texto', `<div class="vacio"><h2>No hay libro que imprimir</h2><button class="boton taco" data-ir="0">← Ir al manuscrito</button></div>`) };
    const P = n ? PlanImposicion.plan(n, i.encuadernacion, i.pliego) : null;
    const hojaMm = i.encuadernacion === 'fanzine' ? [W * 4, H * 2] : [W * 2, H];
    const salidas = [
      ['lectura', 'Lectura o imprenta', `${n || '¿?'} págs ${p.formato} en orden`],
      ['pliegos', 'Pliegos', P ? `${P.hojas.length} hojas de ${hojaMm.join('×')} mm` : 'según la encuadernación'],
      ['cubierta', 'Cubierta', 'frente, o extendida con lomo'],
      ['digital', 'Libro digital', 'EPUB para lectores y teléfonos'],
    ];
    const numer = i.numerada ? `<div class="campos" style="grid-template-columns:1fr 1fr 1fr"><label class="campo"><span>Desde el ejemplar</span><input data-num="desde" value="${i.numDesde || 1}"></label><label class="campo"><span>Hasta</span><input data-num="hasta" value="${i.numHasta || p.costo.tirada || 50}"></label><label class="campo"><span>De un total de</span><input data-num="total" value="${i.numTotal || p.costo.tirada || 50}"></label></div><p class="nota">Cada ejemplar sale con «Ejemplar n.º X de ${i.numTotal || p.costo.tirada || 50}» al pie de la última página.</p>` : '';
    let centro = '';
    if (salida === 'pliegos') {
      centro = `<div class="campos" style="grid-template-columns:1fr 1fr"><label class="campo"><span>Encuadernación</span><select data-enc>${Object.entries(ENC()).map(([k, v]) => `<option value="${k}" ${i.encuadernacion === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        ${i.encuadernacion === 'caballete' ? `<label class="campo"><span>Páginas por cuadernillo</span><select data-pliego><option value="16" ${i.pliego === 16 ? 'selected' : ''}>16 (4 hojas)</option><option value="32" ${i.pliego === 32 ? 'selected' : ''}>32 (8 hojas)</option><option value="8" ${i.pliego === 8 ? 'selected' : ''}>8 (2 hojas)</option><option value="0" ${i.pliego === 0 ? 'selected' : ''}>Uno solo con todo</option></select></label>` : '<span></span>'}
        <label class="campo"><span>Grosor de cada hoja (mm), para el lomo</span><input data-grosor value="${i.grosorHoja}"></label></div>
        ${i.encuadernacion === 'fanzine' && n > 8 ? `<p class="nota mal">El fanzine de una hoja tiene 8 páginas; este libro tiene ${n}, así que saldrán ${Math.ceil(n / 8)} fanzines.</p>` : ''}
        <label class="chequeo"><input type="checkbox" data-numerada ${i.numerada ? 'checked' : ''}> Ejemplares numerados</label>${numer}
        ${n ? vistaPliegos(n) : '<p class="nota">Compón el interior primero para saber cuántas páginas tiene.</p>'}`;
    } else if (salida === 'lectura') {
      centro = `<p>Un PDF con las ${n || ''} páginas en orden de lectura, al tamaño exacto ${W}×${H} mm.</p>
        <label class="chequeo"><input type="checkbox" data-imprenta ${i.imprenta ? 'checked' : ''}> Para imprenta: 3 mm de sangrado y marcas de corte</label>
        ${i.imprenta ? `<label class="chequeo"><input type="checkbox" data-pdfx ${i.pdfx ? 'checked' : ''}> PDF/X-3 en CMYK (lo que piden las imprentas offset)</label>` : ''}
        <p class="nota">Con esta opción la página crece 3 mm por lado y lleva las cruces de corte, que es lo que piden las imprentas profesionales. Sin ella sirve para revisar en pantalla o imprimir en casa.</p>
        <label class="chequeo"><input type="checkbox" data-numerada ${i.numerada ? 'checked' : ''}> Ejemplares numerados</label>${numer}`;
    } else if (salida === 'cubierta') {
      centro = `<div class="fila-botones"><button class="boton ${i.cubiertaModo !== 'extendida' ? 'taco' : ''}" data-cmodo="frente">Solo el frente</button><button class="boton ${i.cubiertaModo === 'extendida' ? 'taco' : ''}" data-cmodo="extendida">Extendida (contra, lomo y frente)</button></div>
        <label class="chequeo"><input type="checkbox" data-pdfx ${i.pdfx ? 'checked' : ''}> PDF/X-3 en CMYK para imprenta</label>
        <p class="nota">La extendida lleva 3 mm de sangrado por lado y el lomo calculado con ${n || '¿?'} páginas × ${String(i.grosorHoja).replace('.', ',')} mm por hoja${i.encuadernacion === 'fresado' ? '' : ' (en cuadernillos cosidos el lomo real puede variar un poco)'}. La imagen va a 300 ppp; los textos quedan como texto.</p>`;
    } else {
      centro = `<p>Un EPUB 3 con el texto, las notas al pie enlazadas, los grabados, el índice y la portada de la colección. Se lee en lectores electrónicos, en teléfonos y en Apple Libros o Google Play Libros.</p><p class="nota">La sinopsis del libro digital sale de Datos → Contracubierta y sinopsis.</p>`;
    }
    const avisosInt = p.composicion ? p.composicion.avisos : null;
    const der = `<ul class="lista">
      <li class="${n ? '' : 'mal'}">Interior compuesto <span>${n ? n + ' págs' : 'falta →'}</span></li>
      ${salida === 'pliegos' ? `<li>Tamaño de hoja <span>${hojaMm.join(' × ')} mm</span></li><li>Blancas añadidas <span>${P ? P.total - n : '—'}</span></li>` : salida === 'lectura' ? `<li>Tamaño de página <span>${i.imprenta ? `${W + 6} × ${H + 6}` : `${W} × ${H}`} mm</span></li>` : ''}
      <li>Tipografías <span>incorporadas</span></li>
      <li class="${avisosInt ? 'mal' : ''}">Avisos del interior <span>${avisosInt == null ? '—' : avisosInt}</span></li>
      <li class="${p.titulo && p.autor ? '' : 'mal'}">Título y autoría <span>${p.titulo && p.autor ? 'listos' : 'faltan'}</span></li></ul>
      <div class="sub">Antes de imprimir en casa</div><p class="nota">Una hoja de prueba te dice cómo configurar tu impresora para que el dorso calce con el frente.</p><button class="boton chico" data-r="prueba">Hoja de prueba a dos caras</button>
      ${p.guardas && p.guardas.modo === 'aparte' ? '<div class="sub">Guardas</div><p class="nota">Dos páginas con el patrón, para imprimir en papel de color y pegar a la tapa.</p><button class="boton chico" data-r="guardas">PDF de las guardas</button>' : ''}
      <div class="sub">Revisar como lector</div><button class="boton chico" data-r="hojear" ${n ? '' : 'disabled'}>Hojear el libro</button>
      ${ultimo ? `<div class="sub">Último archivo</div><p class="nota">${esc(ultimo.ruta.split(/[\\/]/).pop())}${ultimo.paginas ? ` · ${ultimo.paginas} pág.` : ''}${ultimo.pdfx ? ' · PDF/X-3 CMYK' : ''}</p>${ultimo.tinta ? `<p class="nota ${ultimo.tinta.maxima > 300 ? 'mal' : ''}">Tinta: cobertura media ${Math.round(ultimo.tinta.media)} % por página; carga máxima en un punto ${Math.round(ultimo.tinta.maxima)} %${ultimo.tinta.peor ? ` (página ${ultimo.tinta.peor})` : ''}. ${ultimo.tinta.maxima > 300 ? 'Pasa del 300 % que suele aceptar el offset en papel estucado: consúltalo con la imprenta o aclara esa imagen.' : 'Dentro de lo que acepta el offset (hasta 300 %).'}</p>` : ''}<button class="boton chico" data-r="mostrar">Mostrar en la carpeta</button>` : ''}`;
    const textoBoton = { lectura: 'Guardar el PDF', pliegos: 'Guardar el PDF de pliegos', cubierta: 'Guardar el PDF de la cubierta', digital: 'Guardar el libro digital' }[salida];
    return {
      cols: '1fr 320px',
      html: panel('pliegos', { lectura: 'PDF de lectura o imprenta', pliegos: 'Pliegos para encuadernar', cubierta: 'Cubierta', digital: 'Libro digital' }[salida], 'elige qué preparar', `<div class="salidas cuatro">${salidas.map(([k, t, s]) => `<button class="${salida === k ? 'on' : ''}" data-salida="${k}"><b>${t}</b><small>${s}</small></button>`).join('')}</div>${centro}`) +
        panel('previa', 'Comprobación previa', 'antes de imprimir', der, `<button class="boton taco" data-r="pdf" ${trabajando || (!n && !['cubierta', 'digital'].includes(salida)) ? 'disabled' : ''}>${trabajando ? 'Preparando…' : textoBoton}</button>${!n && !['cubierta', 'digital'].includes(salida) ? '<button class="boton" data-ir="3" style="margin-top:6px;width:100%">Componer el interior</button>' : ''}`),
    };
  }
  function trabajoBase(tipo) {
    const p = Folio.p, i = im();
    const t = { tipo, proyecto: JSON.parse(JSON.stringify(p)), recursos: Folio.recursos, modo: i.cubiertaModo || 'frente', paginas: paginas() || 48, imposicion: { encuadernacion: i.encuadernacion, pliego: i.pliego, mmPagina: Folio.formatoMm() }, logo: Perfil.datos.logo, vectores: App.vectores, opciones: { imprenta: tipo === 'lectura' && !!i.imprenta, pdfx: (tipo === 'lectura' && !!i.imprenta && !!i.pdfx) || (tipo === 'cubierta' && !!i.pdfx), vectores: App.vectores } };
    if (i.numerada && tipo !== 'cubierta') t.numeracion = { desde: +i.numDesde || 1, hasta: +i.numHasta || +p.costo.tirada || 1, total: +i.numTotal || +p.costo.tirada || 1 };
    return t;
  }
  async function hacer(tipo) {
    if (tipo === 'digital') { trabajando = true; App.refrescar(); try { await Epub.exportar(); } catch (e) { App.aviso('No se pudo armar el libro digital: ' + e.message, { tipo: 'mal' }); } trabajando = false; return App.refrescar(); }
    if (!window.Escritorio) { App.aviso('Los PDF se generan en la aplicación de escritorio.'); return; }
    const p = Folio.p;
    const nombre = `${(p.titulo || 'libro').replace(/[\\/:*?"<>|]/g, '')} · ${{ lectura: im().imprenta ? 'imprenta' : 'lectura', pliegos: 'pliegos', cubierta: 'cubierta', prueba: 'prueba de impresión', guardas: 'guardas' }[tipo]}.pdf`;
    trabajando = true; App.refrescar();
    try {
      const r = await Escritorio.pdf(trabajoBase(tipo), nombre);
      if (r && !r.cancelado) { ultimo = r; App.aviso(`PDF guardado: ${r.paginas} páginas${r.ejemplares ? ', ' + r.ejemplares + ' ejemplares' : ''}.`); }
    } catch (e) { App.aviso('No se pudo generar el PDF: ' + e.message, { tipo: 'mal', ms: 9000 }); }
    trabajando = false; App.refrescar();
  }
  function montar(m) {
    m.addEventListener('click', e => {
      const s = e.target.closest('[data-salida]'); if (s) { salida = s.dataset.salida; return App.refrescar(); }
      const cm = e.target.closest('[data-cmodo]'); if (cm) return Folio.cambiar('impresion:cubierta', p => { p.impresion.cubiertaModo = cm.dataset.cmodo; });
      const r = e.target.closest('[data-r]'); if (!r) return;
      if (r.dataset.r === 'pdf') hacer(salida);
      if (r.dataset.r === 'prueba') hacer('prueba');
      if (r.dataset.r === 'guardas') (async () => { if (!Folio.recursos['guarda.png']) Folio.recursos['guarda.png'] = await Cubiertas.guarda(Folio.p, { k: 6, recursos: Folio.recursos }); hacer('guardas'); })();
      if (r.dataset.r === 'hojear') Hojear.abrir();
      if (r.dataset.r === 'mostrar' && ultimo) Escritorio.mostrar(ultimo.ruta);
    });
    m.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('[data-pliego]')) Folio.cambiar('impresion:pliego', p => { p.impresion.pliego = +t.value; });
      if (t.matches('[data-enc]')) Folio.cambiar('impresion:encuadernacion', p => { p.impresion.encuadernacion = t.value; });
      if (t.matches('[data-imprenta]')) Folio.cambiar('impresion:imprenta', p => { p.impresion.imprenta = t.checked; });
      if (t.matches('[data-pdfx]')) Folio.cambiar('impresion:pdfx', p => { p.impresion.pdfx = t.checked; });
      if (t.matches('[data-numerada]')) Folio.cambiar('impresion:numerada', p => { p.impresion.numerada = t.checked; });
      if (t.dataset.num) { const v = parseInt(t.value, 10); if (v > 0) Folio.cambiar('impresion:numeracion', p => { p.impresion['num' + t.dataset.num[0].toUpperCase() + t.dataset.num.slice(1)] = v; }); }
      if (t.matches('[data-grosor]')) { const v = parseFloat(String(t.value).replace(',', '.')); if (v > 0 && v < 1) Folio.cambiar('impresion:grosor', p => { p.impresion.grosorHoja = v; }); }
    });
  }
  App.registrar({ indice: 5, n: 'VI', nombre: 'Impresión', estado: () => paginas() ? `${PlanImposicion.plan(paginas(), im().encuadernacion, im().pliego).hojas.length} hojas` : 'por componer', render, montar, trabajoBase });
})();
