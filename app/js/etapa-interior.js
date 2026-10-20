/* Folio · etapa IV · Interior
 * La vista es el libro real: Paged.js compone las páginas con las mismas reglas
 * que se usan para el PDF. Cada ajuste recompone el libro.
 */
(function () {
  'use strict';
  const { esc, panel } = App;
  let resultado = null, componiendo = false, tRecomp = null, zoom = 'ajustar', marco = null, pendienteMarco = null;
  const ETQ = { cuerpo: 'Cuerpo del texto', interlineado: 'Interlineado', margenInterior: 'Margen interior (lomo)', margenExterior: 'Margen exterior', margenSuperior: 'Margen superior', margenInferior: 'Margen inferior', sangria: 'Sangría', entreParrafos: 'Espacio entre párrafos', tituloCuerpo: 'Cuerpo de los capítulos', aireTitulo: 'Aire sobre el capítulo', espaciado: 'Espaciado de letras' };

  function controles() {
    const a = Folio.p.ajustes;
    return Object.entries(ETQ).map(([k, t]) => { const [mi, ma, paso, u] = Folio.LIMITES[k]; const v = a[k]; return `<label class="ajuste"><span>${t}</span><input type="range" min="${mi}" max="${ma}" step="${paso}" value="${v}" data-aj="${k}"><output>${String(+(+v).toFixed(3)).replace('.', ',')} ${u}</output></label>`; }).join('');
  }
  function columnaIzq() {
    const p = Folio.p, a = p.ajustes;
    const fuentes = Object.entries(Folio.FUENTES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    return `<div class="colecciones">${Folio.COLECCIONES.map((c, i) => `<button class="coleccion ${c.id === p.coleccion ? 'on' : ''}" data-col="${c.id}" title="${esc(c.descripcion)}"><span class="muestra" style="font-family:${c.titulos}">Aa</span><span><b>${String(i + 1).padStart(2, '0')} ${esc(c.nombre)}</b><small>${esc(c.lema)} · ${esc(Folio.FUENTES[c.texto])}</small></span></button>`).join('')}</div>
      <div class="sub">Formato</div><div class="fila-botones">${Object.keys(Folio.FORMATOS).map(f => `<button class="boton chico ${p.formato === f ? 'taco' : ''}" data-formato="${f}">${f}</button>`).join('')}</div>
      <div class="sub">Ajustes</div>${controles()}
      <label class="ajuste"><span>Alineación</span><select data-ajs="alineacion"><option value="justify" ${a.alineacion === 'justify' ? 'selected' : ''}>Justificado</option><option value="left" ${a.alineacion === 'left' ? 'selected' : ''}>En bandera</option></select></label>
      <label class="chequeo"><input type="checkbox" data-ajc="capituloDerecha" ${a.capituloDerecha ? 'checked' : ''}> Capítulos en página impar</label>
      <label class="chequeo"><input type="checkbox" data-ajc="cabeceras" ${a.cabeceras ? 'checked' : ''}> Cabeceras (título y capítulo)</label>
      <label class="chequeo"><input type="checkbox" data-ajc="guionado" ${a.guionado ? 'checked' : ''}> Partir palabras (guionado español)</label>
      <label class="chequeo"><input type="checkbox" data-ajc="capitular" ${a.capitular !== false ? 'checked' : ''}> Letra capitular al iniciar capítulo</label>
      <label class="ajuste"><span>Tipografía del texto</span><select data-ajs="fuenteTexto"><option value="">La de la colección</option>${fuentes}</select></label>
      <label class="ajuste"><span>Tipografía de los títulos</span><select data-ajs="fuenteTitulos"><option value="">La de la colección</option>${fuentes}</select></label>
      <button class="boton chico" data-r="restablecer" style="margin-top:8px">Volver a los ajustes del tipo de libro</button>`;
  }
  function columnaDer() {
    const p = Folio.p;
    let comp = '';
    if (!resultado) comp = `<p class="nota">${componiendo ? 'Componiendo…' : 'Esperando la composición.'}</p>`;
    else {
      const grupos = {}; for (const a of resultado.avisos) (grupos[a.msg] = grupos[a.msg] || []).push(a.pagina);
      comp = `<ul class="lista">${['Línea viuda al comienzo de la página', 'Línea huérfana al final de la página', 'Título solo al pie de la página', 'Contenido que se sale de la caja'].map(m => `<li class="${grupos[m] ? 'mal' : ''}">${m.replace(' de la página', '').replace(' al comienzo', '').replace(' al final', '')} <span>${grupos[m] ? grupos[m].map(n => `<button class="enlace" data-pag="${n}">p. ${n}</button>`).join(' ') : '0'}</span></li>`).join('')}
        ${Object.keys(grupos).filter(m => /ppp|cargar/.test(m)).map(m => `<li class="mal">${esc(m)} <span>${grupos[m].map(n => `<button class="enlace" data-pag="${n}">p. ${n}</button>`).join(' ')}</span></li>`).join('')}</ul>
        <p class="nota">${resultado.paginas} páginas${resultado.paginas % 4 ? ` · para pliegos se agregan ${4 - resultado.paginas % 4} en blanco` : ''}.</p>`;
    }
    const ilus = (p.ilustraciones || []).map((il, i) => {
      const b = p.bloques.find(x => x.id === il.despuesDe); const pag = resultado && resultado.secciones;
      return `<li class="il-item"><img src="${il.lamina ? ARCHIVO.mini(il.lamina) : ''}" alt=""><div><select data-il="${i}" data-campo="modo"><option value="pagina" ${il.modo === 'pagina' ? 'selected' : ''}>Página completa</option><option value="media" ${il.modo === 'media' ? 'selected' : ''}>Media página</option><option value="vineta" ${il.modo === 'vineta' ? 'selected' : ''}>Viñeta</option></select><input data-il="${i}" data-campo="pie" placeholder="Pie de imagen (opcional)" value="${esc(il.pie || '')}"><small>tras «${esc((b ? b.texto : '¿?').slice(0, 34))}…»</small><button class="enlace" data-quitar="${i}">quitar</button></div></li>`;
    }).join('');
    return `${comp}<div class="sub">Grabados en el interior</div>${ilus ? `<ul class="lista ilus">${ilus}</ul>` : '<p class="nota">Ninguno. Puedes poner grabados del archivo entre los bloques.</p>'}<button class="boton chico" data-r="grabado">Agregar un grabado del archivo</button>`;
  }
  function render() {
    const p = Folio.p;
    if (!p.bloques.length) return { cols: '1fr', html: panel('vacio', 'Interior', 'sin texto', `<div class="vacio"><h2>No hay texto que componer</h2><p>Primero trae el manuscrito.</p><button class="boton taco" data-ir="0">← Ir al manuscrito</button></div>`) };
    return {
      cols: '290px 1fr 290px',
      html: panel('coleccion', 'Colección', 'diez sistemas', columnaIzq()) +
        panel('doble', resultado ? `${resultado.paginas} páginas` : 'Componiendo…', 'la vista es el libro tal como se imprime', `<div class="herr-vista"><button class="boton chico" data-zoom="-1">−</button><button class="boton chico" data-zoom="1">+</button><span class="estado-comp">${componiendo ? 'componiendo…' : ''}</span></div><div class="marco-vista"></div>`, '', 'vista-panel') +
        panel('compr', 'Comprobaciones', resultado ? (resultado.avisos.length ? `${resultado.avisos.length} por revisar` : 'todo en orden') : '', columnaDer(), App.seguir(4, 'Diseñar la cubierta →')),
    };
  }
  function componer() {
    const cont = document.querySelector('.marco-vista'); if (!cont) return;
    componiendo = true; const st = document.querySelector('.estado-comp'); if (st) st.textContent = 'componiendo…';
    const f = document.createElement('iframe'); f.className = 'vista-libro cargando'; f.src = 'vista.html'; f.title = 'Vista del interior';
    if (pendienteMarco) pendienteMarco.remove(); pendienteMarco = f;
    cont.appendChild(f);
  }
  function programar(ms = 650) { clearTimeout(tRecomp); tRecomp = setTimeout(componer, ms); }
  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data) return;
    const src = e.source, d = e.data;
    if (!pendienteMarco && !marco) return;
    if (d.tipo === 'vista-lista' && pendienteMarco && src === pendienteMarco.contentWindow) {
      src.postMessage({ tipo: 'componer', proyecto: JSON.parse(JSON.stringify(Folio.p)), recursos: Folio.recursos, zoom }, location.origin);
    }
    if (d.tipo === 'compuesto' && pendienteMarco && src === pendienteMarco.contentWindow) {
      const y = marco && marco.contentWindow ? marco.contentWindow.scrollY : 0;
      if (marco) marco.remove(); marco = pendienteMarco; pendienteMarco = null; marco.classList.remove('cargando');
      try { marco.contentWindow.scrollTo(0, y); } catch (_) {}
      componiendo = false; resultado = d.resultado; zoom = d.zoom || zoom;
      Folio.cambiar('composicion', p => { p.composicion = { paginas: resultado.paginas, avisos: resultado.avisos.length, fecha: new Date().toISOString() }; }, { sinHistorial: true, silencioso: true });
      actualizarLados();
    }
    if (d.tipo === 'error' && pendienteMarco && src === pendienteMarco.contentWindow) { componiendo = false; App.aviso('No se pudo componer: ' + d.error, { tipo: 'mal', ms: 9000 }); }
  });
  function actualizarLados() {
    if (App.actual !== 3) return;
    const m = document.querySelector('.mesa');
    const der = m.querySelector('[data-zona="compr"]'); if (der) { der.querySelector('.cuerpo').innerHTML = columnaDer(); der.querySelector('.rotulo i').textContent = resultado ? (resultado.avisos.length ? `${resultado.avisos.length} por revisar` : 'todo en orden') : ''; }
    const cen = m.querySelector('[data-zona="doble"] .rotulo span'); if (cen && resultado) cen.textContent = `${resultado.paginas} páginas`;
    const st = m.querySelector('.estado-comp'); if (st) st.textContent = componiendo ? 'componiendo…' : '';
    App.camino();
  }
  function montar(m) {
    if (!Folio.p.bloques.length) return;
    // la vista vieja se reutiliza si existe (redibujar no obliga a recomponer)
    // un iframe movido en el DOM se recarga: siempre se compone en uno nuevo
    marco = null; pendienteMarco = null; componer();
    m.addEventListener('click', e => {
      const c = e.target.closest('[data-col]'); if (c) return Folio.cambiar('coleccion', p => { p.coleccion = c.dataset.col; p.cubierta.paleta = 0; });
      const fm = e.target.closest('[data-formato]'); if (fm) return Folio.cambiar('ajuste:formato', p => { p.formato = fm.dataset.formato; });
      const z = e.target.closest('[data-zoom]'); if (z) { zoom = Math.max(.3, Math.min(1.4, (+zoom || .6) + (+z.dataset.zoom) * .1)); if (marco) marco.contentWindow.postMessage({ tipo: 'zoom', k: zoom }, location.origin); return; }
      const pg = e.target.closest('[data-pag]'); if (pg && marco) return marco.contentWindow.postMessage({ tipo: 'ir', pagina: +pg.dataset.pag }, location.origin);
      const q = e.target.closest('[data-quitar]'); if (q) return Folio.cambiar('ajuste:ilustracion', p => { p.ilustraciones.splice(+q.dataset.quitar, 1); });
      const r = e.target.closest('[data-r]'); if (!r) return;
      if (r.dataset.r === 'grabado') Archivo.abrir({ modo: 'insertar' });
      if (r.dataset.r === 'restablecer') Folio.cambiar('ajuste:restablecer', p => { const t = Folio.TIPOS_LIBRO[p.tipo]; Object.assign(p.ajustes, Folio.normalizarAjustes ? {} : {}, { cuerpo: 11, interlineado: 1.45, margenInterior: 20, margenExterior: 16, margenSuperior: 18, margenInferior: 22, sangria: t.sangria, entreParrafos: t.entreParrafos, alineacion: t.alineacion, tituloCuerpo: 22, aireTitulo: 40, espaciado: 0, fuenteTexto: null, fuenteTitulos: null }); });
    });
    m.addEventListener('input', e => {
      const k = e.target.dataset.aj; if (!k) return;
      const v = Folio.limitar(k, e.target.value); const u = Folio.LIMITES[k][3];
      e.target.nextElementSibling.textContent = String(+v.toFixed(3)).replace('.', ',') + ' ' + u;
      Folio.cambiar('ajuste:' + k, p => { p.ajustes[k] = v; }, { agrupar: true });
    });
    m.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.ajs) Folio.cambiar('ajuste:' + t.dataset.ajs, p => { p.ajustes[t.dataset.ajs] = t.value || null; });
      if (t.dataset.ajc) Folio.cambiar('ajuste:' + t.dataset.ajc, p => { p.ajustes[t.dataset.ajc] = t.checked; });
      if (t.dataset.il) Folio.cambiar('ajuste:ilustracion', p => { p.ilustraciones[+t.dataset.il][t.dataset.campo] = t.value; });
    });
    const a = Folio.p.ajustes;
    m.querySelectorAll('select[data-ajs="fuenteTexto"]').forEach(s => s.value = a.fuenteTexto || '');
    m.querySelectorAll('select[data-ajs="fuenteTitulos"]').forEach(s => s.value = a.fuenteTitulos || '');
  }

  App.registrar({
    indice: 3, n: 'IV', nombre: 'Interior',
    estado: () => resultado ? `${resultado.paginas} págs${resultado.avisos.length ? ' · ' + resultado.avisos.length + ' aviso' + (resultado.avisos.length > 1 ? 's' : '') : ''}` : (Folio.p.composicion ? `${Folio.p.composicion.paginas} págs` : 'por componer'),
    render, montar,
    alCambiar(motivo) {
      if (motivo === 'composicion') return false;
      if (/^ajuste:/.test(motivo) && !/formato|ilustracion|restablecer/.test(motivo)) { programar(); return false; }
    },
    salir() { clearTimeout(tRecomp); },
    _resultado: () => resultado, _componiendo: () => componiendo,
  });
  // cualquier cambio del texto invalida la composición guardada
  Folio.al(m => { if (m !== 'composicion' && m !== 'autoguardado' && m !== 'guardado' && App.actual !== 3) { resultado = null; marco = null; } });
})();
