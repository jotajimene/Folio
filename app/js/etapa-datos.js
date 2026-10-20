/* Folio · etapa III · Datos del libro (páginas preliminares, créditos, colofón, contracubierta) */
(function () {
  'use strict';
  const { esc, panel } = App;
  let pagina = 'portada';
  const PAGINAS = [
    { id: 'portada', nombre: 'Portadilla y portada', campos: [['titulo', 'Título', 1], ['subtitulo', 'Subtítulo'], ['autor', 'Autora o autor', 1], ['sello', 'Sello editorial'], ['ciudad', 'Ciudad'], ['anio', 'Año']] },
    { id: 'creditos', nombre: 'Créditos', campos: [['edicion', 'Edición'], ['isbn', 'ISBN, si ya está asignado (Folio no lo tramita)', 0, 'ancho'], ['derechos', 'Derechos o licencia', 0, 'ancho'], ['correccion', 'Corrección'], ['diseno', 'Diseño y diagramación'], ['impresion', 'Impresión', 0, 'ancho']] },
    { id: 'dedicatoria', nombre: 'Dedicatoria', campos: [['dedicatoria', 'Dedicatoria', 0, 'ancho area']] },
    { id: 'epigrafe', nombre: 'Epígrafe', campos: [['epigrafe', 'Epígrafe', 0, 'ancho area'], ['epigrafeAutor', 'De quién es', 0, 'ancho']] },
    { id: 'indice', nombre: 'Índice', campos: [] },
    { id: 'colofon', nombre: 'Colofón', campos: [['colofon', 'Colofón (si lo dejas vacío, Folio escribe uno con la tipografía y la fecha)', 0, 'ancho area']] },
    { id: 'contra', nombre: 'Contracubierta', campos: [['contracubierta', 'Texto de la contracubierta', 0, 'ancho area grande']] },
  ];
  function faltan(pg) {
    const p = Folio.p;
    if (pg.id === 'portada') return ['titulo', 'autor'].filter(k => !p[k].trim()).length;
    if (pg.id === 'creditos') return (p.isbn && isbnMal(p.isbn) ? 1 : 0);
    return 0;
  }
  function isbnMal(v) {
    const d = v.replace(/[^0-9Xx]/g, '');
    if (d.length === 13) { const s = [...d.slice(0, 12)].reduce((a, c, i) => a + (+c) * (i % 2 ? 3 : 1), 0); return (10 - s % 10) % 10 !== +d[12] ? 'El dígito de control no coincide.' : ''; }
    if (d.length === 10) return 'Es un ISBN de 10 dígitos: para el código de barras se necesita el de 13.';
    return 'Un ISBN tiene 13 dígitos.';
  }
  function estadoPagina(pg) {
    const p = Folio.p, f = faltan(pg);
    if (f) return `<span>falta${f > 1 ? 'n' : ''} ${f}</span>`;
    if (pg.id === 'dedicatoria' || pg.id === 'epigrafe') return `<span>${p[pg.id].trim() ? 'escrita' : 'opcional'}</span>`;
    if (pg.id === 'indice') return `<span>${p.indice ? (p.indicePos === 'inicio' ? 'al inicio' : 'al final') : 'sin índice'}</span>`;
    if (pg.id === 'colofon') return `<span>${p.colofon.trim() ? 'propio' : 'automático'}</span>`;
    if (pg.id === 'contra') return `<span>${p.contracubierta.trim() ? (p.contracubierta.trim().split(/\s+/).length + ' palabras') : 'vacía'}</span>`;
    return '<span>completa</span>';
  }

  function vista() {
    const p = Folio.p, c = Folio.coleccion();
    const [W, H] = Folio.formatoMm();
    const f = { texto: p.ajustes.fuenteTexto || c.texto, titulos: p.ajustes.fuenteTitulos || c.titulos };
    let interior = '';
    if (pagina === 'portada') interior = `<div class="hp-portada"><div>${esc(p.autor || 'Nombre de la autora o autor')}</div><h4 style="font-family:${f.titulos}">${esc(p.titulo || 'Título')}</h4>${p.subtitulo ? `<i>${esc(p.subtitulo)}</i>` : ''}<div class="hp-sello">${esc(p.sello || '')}<br><small>${esc(p.ciudad)}${p.ciudad && p.anio ? ', ' : ''}${esc(p.anio)}</small></div></div>`;
    else if (pagina === 'creditos') interior = `<div class="hp-creditos">${Libro.creditos(p)}</div>`;
    else if (pagina === 'dedicatoria') interior = `<div class="hp-dedicatoria">${esc(p.dedicatoria || 'Sin dedicatoria: la página no se imprime.').replace(/\n/g, '<br>')}</div>`;
    else if (pagina === 'epigrafe') interior = `<div class="hp-epigrafe"><i>${esc(p.epigrafe || 'Sin epígrafe: la página no se imprime.').replace(/\n/g, '<br>')}</i>${p.epigrafeAutor ? `<div>${esc(p.epigrafeAutor)}</div>` : ''}</div>`;
    else if (pagina === 'indice') { const caps = p.bloques.filter(b => b.tipo === 'h1'); interior = `<div class="hp-indice"><h4 style="font-family:${f.titulos}">Índice</h4>${caps.length > 1 && p.indice ? caps.map(b => `<div><span>${esc(b.texto)}</span><span>··</span></div>`).join('') : '<p><i>' + (p.indice ? 'Hace falta más de un capítulo para que haya índice.' : 'Sin índice.') + '</i></p>'}</div>`; }
    else if (pagina === 'colofon') interior = `<div class="hp-colofon">${esc(p.colofon || `Este libro se compuso en ${Folio.FUENTES[f.texto] || f.texto} con Folio${p.ciudad ? ', en ' + p.ciudad : ''}.`).replace(/\n/g, '<br>')}</div>`;
    else if (pagina === 'contra') interior = `<div class="hp-contra">${esc(p.contracubierta || 'Sin texto de contracubierta.').replace(/\n/g, '<br>')}</div>`;
    return `<div class="mesa-libro"><div class="hoja hoja-datos" style="aspect-ratio:${W}/${H};font-family:${f.texto}">${interior}</div></div><p class="nota" style="text-align:center">Aproximación con las tipografías de la colección ${esc(c.nombre)}. La página exacta se ve en Interior.</p>`;
  }
  function form() {
    const p = Folio.p, pg = PAGINAS.find(x => x.id === pagina);
    if (pagina === 'indice') return `<div class="campos"><label class="campo ancho chequeo"><input type="checkbox" data-k="indice" ${p.indice ? 'checked' : ''}> <span>Incluir índice (se arma solo con los capítulos)</span></label><label class="campo"><span>Dónde</span><select data-k="indicePos"><option value="final" ${p.indicePos !== 'inicio' ? 'selected' : ''}>Al final del libro</option><option value="inicio" ${p.indicePos === 'inicio' ? 'selected' : ''}>Al inicio, tras los preliminares</option></select></label></div><p class="nota">Capítulos detectados: ${p.bloques.filter(b => b.tipo === 'h1').length}. Para marcar un capítulo, en Manuscrito cambia la glosa del bloque a «capítulo».</p>`;
    return `<div class="campos">${pg.campos.map(([k, label, req, clase = '']) => {
      const area = clase.includes('area');
      const mal = (req && !String(p[k]).trim()) || (k === 'isbn' && p.isbn && isbnMal(p.isbn));
      return `<label class="campo ${clase.replace('area', '').replace('grande', '')} ${mal ? 'falta' : ''}"><span>${esc(label)}</span>${area ? `<textarea data-k="${k}" rows="${clase.includes('grande') ? 12 : 5}">${esc(p[k])}</textarea>` : `<input data-k="${k}" value="${esc(p[k])}">`}${k === 'isbn' && p.isbn && isbnMal(p.isbn) ? `<em class="error">${isbnMal(p.isbn)}</em>` : ''}</label>`;
    }).join('')}</div>${pagina === 'creditos' ? `<p class="nota">Las procedencias de los grabados que uses se agregan solas a esta página.</p>` : ''}`;
  }
  function render() {
    const lista = `<ul class="lista">${PAGINAS.map(pg => `<li class="${pg.id === pagina ? 'on' : ''} ${faltan(pg) ? 'mal' : ''}" data-pagina="${pg.id}"><a>${pg.nombre}</a> ${estadoPagina(pg)}</li>`).join('')}</ul>`;
    const pg = PAGINAS.find(x => x.id === pagina);
    return {
      cols: '236px 1fr 380px',
      html: panel('paginas', 'Páginas del libro', 'preliminares y finales', lista) +
        panel('form', pg.nombre, { portada: 'lo que va al comienzo del libro', creditos: 'la página legal, al reverso de la portada', dedicatoria: 'en página impar, sola', epigrafe: 'en página impar, sola', indice: 'se compone con los números reales', colofon: 'la última página', contra: 'texto para la cubierta trasera' }[pagina], form()) +
        panel('vista', 'Así queda', `${Folio.p.formato} a escala`, vista(), App.seguir(3, 'Componer el interior →')),
    };
  }
  function montar(m) {
    m.addEventListener('click', e => { const li = e.target.closest('[data-pagina]'); if (li) { pagina = li.dataset.pagina; App.refrescar(); } });
    const cambio = e => {
      const k = e.target.dataset.k; if (!k) return;
      const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      Folio.cambiar('dato:' + k, p => { p[k] = v; }, { agrupar: true });
    };
    m.addEventListener('input', cambio); m.addEventListener('change', e => { if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') cambio(e); });
  }
  App.registrar({
    indice: 2, n: 'III', nombre: 'Datos',
    estado: () => { const f = PAGINAS.reduce((a, pg) => a + faltan(pg), 0); return f ? `falta${f > 1 ? 'n' : ''} ${f} dato${f > 1 ? 's' : ''}` : 'completos'; },
    render, montar,
    alCambiar(motivo) {
      if (/^dato:/.test(motivo)) {
        // actualizar vista, lista y avisos sin rehacer el formulario (no se pierde el foco)
        const m = document.querySelector('.mesa');
        const v = m.querySelector('[data-zona="vista"] .cuerpo'); if (v) v.innerHTML = vista();
        const l = m.querySelector('[data-zona="paginas"] .cuerpo'); if (l) l.innerHTML = `<ul class="lista">${PAGINAS.map(pg => `<li class="${pg.id === pagina ? 'on' : ''} ${faltan(pg) ? 'mal' : ''}" data-pagina="${pg.id}"><a>${pg.nombre}</a> ${estadoPagina(pg)}</li>`).join('')}</ul>`;
        m.querySelectorAll('.campo input[data-k],.campo textarea[data-k]').forEach(i => { const k = i.dataset.k, req = (k === 'titulo' || k === 'autor'); i.closest('.campo').classList.toggle('falta', (req && !String(Folio.p[k]).trim()) || (k === 'isbn' && !!Folio.p.isbn && !!isbnMal(Folio.p.isbn))); });
        const err = m.querySelector('.campo .error'); const isbn = m.querySelector('[data-k="isbn"]');
        if (isbn) { const msg = Folio.p.isbn ? isbnMal(Folio.p.isbn) : ''; if (err) err.textContent = msg; else if (msg) isbn.insertAdjacentHTML('afterend', `<em class="error">${msg}</em>`); }
        return false;
      }
    },
  });
})();
