/* Folio · etapa IV · Interior
 * La vista es el libro real: Paged.js compone las páginas con las mismas reglas
 * que se usan para el PDF. Cada ajuste recompone el libro.
 */
(function () {
  'use strict';
  const { esc, panel } = App;
  let elegido = null; // { tipo: 'bloque'|'grabado', id, pagina }
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
      <label class="ajuste"><span>Cada capítulo o poema empieza</span><select data-ajs="saltoCapitulo"><option value="derecha" ${(a.saltoCapitulo || 'derecha') === 'derecha' ? 'selected' : ''}>En página impar (puede dejar una en blanco)</option><option value="pagina" ${a.saltoCapitulo === 'pagina' ? 'selected' : ''}>En la página siguiente</option><option value="continuo" ${a.saltoCapitulo === 'continuo' ? 'selected' : ''}>Seguido, sin saltar de página</option></select></label>
      <label class="chequeo"><input type="checkbox" data-ajc="cabeceras" ${a.cabeceras ? 'checked' : ''}> Cabeceras (título y capítulo)</label>
      <label class="chequeo"><input type="checkbox" data-ajc="guionado" ${a.guionado ? 'checked' : ''}> Partir palabras (guionado español)</label>
      <label class="chequeo"><input type="checkbox" data-ajc="capitular" ${a.capitular !== false ? 'checked' : ''}> Letra capitular al iniciar capítulo</label>
      <label class="ajuste"><span>Tipografía del texto</span><select data-ajs="fuenteTexto"><option value="">La de la colección</option>${fuentes}</select></label>
      <label class="ajuste"><span>Tipografía de los títulos</span><select data-ajs="fuenteTitulos"><option value="">La de la colección</option>${fuentes}</select></label>
      <button class="boton chico" data-r="tipografia" style="margin-top:8px">Cargar una tipografía tuya…</button>
      <button class="boton chico" data-r="restablecer" style="margin-top:8px">Volver a los ajustes del tipo de libro</button>`;
  }
  const M = () => App.etapas[0];
  function editorBloque() {
    const p = Folio.p, b = p.bloques.find(x => x.id === elegido.id); if (!b) { elegido = null; return ''; }
    const TIP = { h1: 'Capítulo o poema', h2: 'Subtítulo', p: 'Párrafo', verso: 'Verso o estrofa', cita: 'Cita', separador: 'Separador', seccion: 'Sección de librojuego' };
    return `<div class="editor-pagina"><p class="nota">Bloque de la página ${elegido.pagina}. Edita aquí; el libro se vuelve a componer al guardar.</p>
      <div class="contenido editable-int" contenteditable="true">${M().htmlBloque(b)}</div>
      <p class="nota">Ctrl+I cursiva · Ctrl+B negrita</p>
      <label class="ajuste"><span>Función</span><select data-eb="tipo">${Object.entries(TIP).map(([k, v]) => `<option value="${k}" ${b.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="chequeo"><input type="checkbox" data-eb="saltoAntes" ${b.saltoAntes ? 'checked' : ''}> Empezar en página nueva</label>
      <label class="chequeo"><input type="checkbox" data-eb="pegado" ${b.pegado ? 'checked' : ''}> Mantener junto al bloque siguiente</label>
      <label class="chequeo"><input type="checkbox" data-eb="entero" ${b.entero ? 'checked' : ''}> No partirlo entre dos páginas</label>
      <div class="fila-botones"><button class="boton taco" data-r="eb-guardar">Guardar y recomponer</button><button class="boton" data-r="eb-cerrar">Cerrar</button></div>
      <div class="fila-botones" style="margin-top:8px"><button class="boton chico" data-r="eb-grabado">Poner un grabado después</button><button class="boton chico" data-r="eb-unir">Unir con el siguiente</button></div></div>`;
  }
  function editorGrabado() {
    const p = Folio.p, i = (p.ilustraciones || []).findIndex(x => x.id === elegido.id); if (i < 0) { elegido = null; return ''; }
    const il = p.ilustraciones[i];
    return `<div class="editor-pagina"><img src="${App.miniIl(il)}" alt="" style="max-width:100%;max-height:150px;display:block;margin:0 auto 8px">
      <label class="ajuste"><span>Tamaño</span><select data-il="${i}" data-campo="modo">${Object.entries(App.MODOS_IL).map(([k, v]) => `<option value="${k}" ${il.modo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="ajuste"><span>Pie</span><input data-il="${i}" data-campo="pie" value="${esc(il.pie || '')}" style="grid-column:1/-1"></label>
      <div class="fila-botones"><button class="boton chico" data-mover="-1" data-i="${i}">↑ Antes</button><button class="boton chico" data-mover="1" data-i="${i}">↓ Después</button><button class="boton chico" data-quitar="${i}">Quitar</button><button class="boton" data-r="eb-cerrar">Cerrar</button></div></div>`;
  }
  // la secuencia de imágenes del libro, para ordenar arrastrando y elegir cómo va cada una
  async function secuencia() {
    const p = Folio.p, orden = p.bloques.map(b => b.id);
    const lista = [...p.ilustraciones].sort((a, b) => orden.indexOf(a.despuesDe) - orden.indexOf(b.despuesDe) || p.ilustraciones.indexOf(a) - p.ilustraciones.indexOf(b));
    const r = await App.modal({ titulo: 'Secuencia de imágenes', ancho: 980, cuerpo: `<p class="nota">Arrastra para cambiar el orden. Cada imagen queda después del mismo bloque de texto que la imagen que ocupa su lugar.</p><div class="secuencia">${lista.map((il, k) => `<div class="sec-item" draggable="true" data-k="${k}"><img src="${App.miniIl(il)}" alt=""><select data-modo>${Object.entries(App.MODOS_IL).map(([m, v]) => `<option value="${m}" ${il.modo === m ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`).join('')}</div>`,
      botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Aplicar', taco: true, valor: c => [...c.querySelectorAll('.sec-item')].map(el => ({ k: +el.dataset.k, modo: el.querySelector('select').value })) }],
      alAbrir: m => { let arr = null; m.addEventListener('dragstart', e => { arr = e.target.closest('.sec-item'); }); m.addEventListener('dragover', e => { e.preventDefault(); const t = e.target.closest('.sec-item'); if (t && arr && t !== arr) { const box = t.getBoundingClientRect(); t.parentNode.insertBefore(arr, e.clientX < box.left + box.width / 2 ? t : t.nextSibling); } }); },
    });
    if (!r) return;
    const anclas = lista.map(il => il.despuesDe); // el ancla de cada posición se conserva
    Folio.cambiar('ajuste:ilustracion', p => { p.ilustraciones = r.map((x, pos) => ({ ...lista[x.k], modo: x.modo, despuesDe: anclas[pos] })); });
  }
  function pintarDer() {
    const der = document.querySelector('.mesa [data-zona="compr"]'); if (!der) return;
    der.querySelector('.cuerpo').innerHTML = columnaDer();
    der.querySelector('.rotulo span').textContent = elegido ? (elegido.tipo === 'grabado' ? 'Grabado elegido' : 'Bloque elegido') : 'Comprobaciones';
  }
  function columnaDer() {
    const p = Folio.p;
    if (elegido) { const h = elegido.tipo === 'grabado' ? editorGrabado() : editorBloque(); if (h) return h; }
    let comp = '';
    if (!resultado) comp = `<p class="nota">${componiendo ? 'Componiendo…' : 'Esperando la composición.'}</p>`;
    else {
      const grupos = {}; for (const a of resultado.avisos) (grupos[a.msg] = grupos[a.msg] || []).push(a.pagina);
      comp = `<ul class="lista">${['Línea viuda al comienzo de la página', 'Línea huérfana al final de la página', 'Título solo al pie de la página', 'Contenido que se sale de la caja'].map(m => `<li class="${grupos[m] ? 'mal' : ''}">${m.replace(' de la página', '').replace(' al comienzo', '').replace(' al final', '')} <span>${grupos[m] ? grupos[m].map(n => `<button class="enlace" data-pag="${n}">p. ${n}</button>`).join(' ') : '0'}</span></li>`).join('')}
        ${Object.keys(grupos).filter(m => /ppp|cargar/.test(m)).map(m => `<li class="mal">${esc(m)} <span>${grupos[m].map(n => `<button class="enlace" data-pag="${n}">p. ${n}</button>`).join(' ')}</span></li>`).join('')}</ul>
        ${resultado.blancas && resultado.blancas.length ? `<p class="nota">Páginas en blanco: ${resultado.blancas.map(n => `<button class="enlace" data-pag="${n}">${n}</button>`).join(', ')}. Están ahí para que lo que sigue empiece en página impar; si no las quieres, cambia «Cada capítulo empieza» a la izquierda.</p>` : ''}
        <p class="nota">${resultado.paginas} páginas${resultado.paginas % 4 ? ` · para pliegos se agregan ${4 - resultado.paginas % 4} en blanco` : ''}.</p>`;
    }
    const ilus = (p.ilustraciones || []).map((il, i) => {
      const b = p.bloques.find(x => x.id === il.despuesDe); const pag = resultado && resultado.secciones;
      return `<li class="il-item"><img src="${App.miniIl(il)}" alt=""><div><select data-il="${i}" data-campo="modo">${Object.entries(App.MODOS_IL).map(([k, v]) => `<option value="${k}" ${il.modo === k ? 'selected' : ''}>${v}</option>`).join('')}</select><input data-il="${i}" data-campo="pie" placeholder="Pie de imagen (opcional)" value="${esc(il.pie || '')}"><small>tras «${esc((b ? b.texto : '¿?').slice(0, 34))}…»</small><button class="enlace" data-quitar="${i}">quitar</button></div></li>`;
    }).join('');
    return `${comp}<div class="sub">Grabados en el interior</div>${ilus ? `<ul class="lista ilus">${ilus}</ul>` : '<p class="nota">Ninguno. Puedes poner grabados del archivo entre los bloques.</p>'}<div class="fila-botones"><button class="boton chico" data-r="grabado">Grabado del archivo</button><button class="boton chico" data-r="imagen">Una imagen tuya</button><button class="boton chico" data-r="fotos">Varias fotos (fotolibro)</button>${(p.ilustraciones || []).length > 1 ? '<button class="boton chico" data-r="secuencia">Ordenar la secuencia</button>' : ''}</div>`;
  }
  function render() {
    const p = Folio.p;
    if (!p.bloques.length) return { cols: '1fr', html: panel('vacio', 'Interior', 'sin texto', `<div class="vacio"><h2>No hay texto que componer</h2><p>Primero trae el manuscrito.</p><button class="boton taco" data-ir="0">← Ir al manuscrito</button></div>`) };
    return {
      cols: '290px 1fr 290px',
      html: panel('coleccion', 'Colección', 'líneas de la editorial', columnaIzq()) +
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
      if (elegido && elegido.tipo === 'bloque') marco.contentWindow.postMessage({ tipo: 'marcar', id: elegido.id }, location.origin);
      Folio.cambiar('composicion', p => { p.composicion = { paginas: resultado.paginas, avisos: resultado.avisos.length, fecha: new Date().toISOString() }; }, { sinHistorial: true, silencioso: true });
      actualizarLados();
    }
    if ((d.tipo === 'bloque' || d.tipo === 'grabado') && marco && src === marco.contentWindow) { elegido = { tipo: d.tipo, id: d.id, pagina: d.pagina }; pintarDer(); return; }
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
      const mv = e.target.closest('[data-mover]'); if (mv) return Folio.cambiar('ajuste:ilustracion', p => { const i = +mv.dataset.i, il = p.ilustraciones[i], k = p.bloques.findIndex(b => b.id === il.despuesDe), nk = Math.max(0, Math.min(p.bloques.length - 1, k + (+mv.dataset.mover))); il.despuesDe = p.bloques[nk].id; });
      const r = e.target.closest('[data-r]'); if (!r) return;
      if (r.dataset.r === 'eb-cerrar') { elegido = null; pintarDer(); return; }
      if (r.dataset.r === 'eb-grabado') return Archivo.abrir({ modo: 'insertar', despuesDe: elegido.id });
      if (r.dataset.r === 'eb-unir') { const i = Folio.p.bloques.findIndex(b => b.id === elegido.id); if (i >= 0 && i < Folio.p.bloques.length - 1) Folio.cambiar('texto:unir', p => Folio.texto.unir(p, i)); return; }
      if (r.dataset.r === 'eb-guardar') {
        const ed = m.querySelector('.editable-int'), id = elegido.id;
        const runs = M().leerRuns(ed), texto = runs.map(x => x.text).join(''), conFormato = runs.some(x => x.italic || x.bold);
        const quedan = [...ed.querySelectorAll('sup[data-nota]')].map(x => +x.dataset.nota);
        const val = k => { const c = m.querySelector(`[data-eb="${k}"]`); return c.type === 'checkbox' ? c.checked : c.value; };
        Folio.cambiar('texto:editar', p => { const b = p.bloques.find(x => x.id === id); if (texto !== b.texto || conFormato) { b.texto = texto; b.runs = conFormato ? runs : null; if (b.notas) { b.notas = quedan.map(k => b.notas[k]).filter(x => x != null); if (!b.notas.length) delete b.notas; } } b.tipo = val('tipo'); for (const k of ['saltoAntes', 'pegado', 'entero']) { if (val(k)) b[k] = true; else delete b[k]; } });
        App.aviso('Bloque guardado; recomponiendo.', { ms: 2000 });
        return;
      }
      if (r.dataset.r === 'grabado') Archivo.abrir({ modo: 'insertar' });
      if (r.dataset.r === 'tipografia') Tipografias.cargar();
      if (r.dataset.r === 'imagen') { (async () => { const im = await Imagenes.agregar({ titulo: 'Agregar una imagen al libro' }); if (!im) return; const tras = (elegido && elegido.tipo === 'bloque' && elegido.id) || Folio.p.bloques[Folio.p.bloques.length - 1].id; Folio.cambiar('ajuste:ilustracion', p => { p.ilustraciones.push({ id: Folio.uid(), recurso: im.nombre, despuesDe: tras, modo: 'pagina', pie: '' }); }); })(); }
      if (r.dataset.r === 'fotos') { (async () => { const lista = await Imagenes.agregarVarias(); if (!lista.length) return; const tras = (elegido && elegido.tipo === 'bloque' && elegido.id) || Folio.p.bloques[Folio.p.bloques.length - 1].id; Folio.cambiar('ajuste:ilustracion', p => { for (const im of lista) p.ilustraciones.push({ id: Folio.uid(), recurso: im.nombre, despuesDe: tras, modo: 'sangre', pie: '' }); }); App.aviso(`${lista.length} imágenes agregadas a página completa a sangre. Ordénalas en «Ordenar la secuencia».`); })(); }
      if (r.dataset.r === 'secuencia') secuencia();
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
      if (t.dataset.ajs) { if (/^fuente/.test(t.dataset.ajs)) Tipografias.alProyecto(t.value); Folio.cambiar('ajuste:' + t.dataset.ajs, p => { p.ajustes[t.dataset.ajs] = t.value || null; }); }
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
