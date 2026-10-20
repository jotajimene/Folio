/* Folio · composición del libro
 * Convierte el proyecto en HTML + CSS paginables con Paged.js.
 * Lo usan la vista previa (vista.html) y la impresión (imprimir.html): el mismo
 * código produce lo que ves y lo que se imprime.
 * Nunca modifica el texto del manuscrito: solo lo envuelve en marcado.
 */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NOMBRE_FUENTE = { FPalatino: 'FPalatino', FRoman: 'FRoman', FBookman: 'FBookman', FSchool: 'FSchool', FModern: 'FModern', FDeja: 'FDeja', FSans: 'FSans', FGothic: 'FGothic', FNarrow: 'FNarrow', FMono: 'FMono', Fell: 'Fell', Fraktur: 'Fraktur' };

  // guionado con patrones españoles (hyphen, licencia ISC/LPPL de los patrones): inserta guiones blandos
  let guionador = null;
  function guionar(t) {
    if (!guionador && window.Herramientas) guionador = Herramientas.createHyphenator(Herramientas.patronesES, { hyphenChar: '­', async: false, minWordLength: 6 });
    return guionador ? guionador(t) : t;
  }

  // estilo particular de cada colección para el interior
  const INTERIOR = {
    bestiario: { capitular: 'Fell', sep: '❦', cabeceras: 'versalitas', filete: false },
    teselario: { capitular: null, sep: '◆ ◆ ◆', cabeceras: 'versalitas', filete: true },
    archivo: { capitular: null, sep: '—', cabeceras: 'mono', filete: true },
    umbral: { capitular: null, sep: '*', cabeceras: 'versalitas', filete: false },
    friso: { capitular: 'FBookman', sep: '❧', cabeceras: 'versalitas', filete: true },
    inicial: { capitular: 'Fraktur', sep: '·', cabeceras: 'cursiva', filete: false },
    fragmento: { capitular: null, sep: '§', cabeceras: 'versalitas', filete: false },
    herbario: { capitular: 'FPalatino', sep: '✣', cabeceras: 'cursiva', filete: true },
    eco: { capitular: null, sep: '/ / /', cabeceras: 'mono', filete: false },
    constelacion: { capitular: null, sep: '· · ·', cabeceras: 'versalitas', filete: false },
  };

  function enLinea(b, conGuion) {
    const g = t => esc(conGuion ? guionar(t) : t).replace(/\n/g, '<br>');
    if (b.runs && b.runs.length) return b.runs.map(r => { let h = g(r.text); if (r.italic) h = `<i>${h}</i>`; if (r.bold) h = `<b>${h}</b>`; return h; }).join('');
    return g(b.texto);
  }

  // ---- páginas preliminares ----
  function preliminares(p) {
    const h = [];
    const anio = p.anio || '';
    h.push(`<section class="pre portadilla"><h1 class="t-portadilla">${esc(p.titulo || 'Sin título')}</h1></section>`);
    h.push(`<section class="pre portada"><div class="p-autor">${esc(p.autor)}</div><h1 class="t-portada">${esc(p.titulo || 'Sin título')}</h1>${p.subtitulo ? `<div class="p-sub">${esc(p.subtitulo)}</div>` : ''}<div class="p-sello">${esc(p.sello)}${p.ciudad ? `<br><small>${esc(p.ciudad)}${anio ? ', ' + esc(anio) : ''}</small>` : ''}</div></section>`);
    h.push(`<section class="pre creditos">${creditos(p)}</section>`);
    if (p.dedicatoria.trim()) h.push(`<section class="pre dedicatoria"><p>${esc(p.dedicatoria).replace(/\n/g, '<br>')}</p></section>`);
    if (p.epigrafe.trim()) h.push(`<section class="pre epigrafe"><blockquote>${esc(p.epigrafe).replace(/\n/g, '<br>')}${p.epigrafeAutor ? `<cite>${esc(p.epigrafeAutor)}</cite>` : ''}</blockquote></section>`);
    return h.join('');
  }
  function creditos(p) {
    const l = [];
    l.push(`<p><i>${esc(p.titulo || 'Sin título')}</i>${p.subtitulo ? '. ' + esc(p.subtitulo) : ''}</p>`);
    if (p.autor) l.push(`<p>© ${esc(p.anio)} ${esc(p.autor)}</p>`);
    if (p.sello || p.ciudad) l.push(`<p>${[p.sello, p.ciudad].filter(Boolean).map(esc).join(' · ')}${p.anio ? ', ' + esc(p.anio) : ''}</p>`);
    if (p.edicion) l.push(`<p>${esc(p.edicion)}</p>`);
    if (p.isbn) l.push(`<p>ISBN: ${esc(p.isbn)}</p>`);
    const resp = [['Corrección', p.correccion], ['Diseño y diagramación', p.diseno], ['Impresión', p.impresion]].filter(x => x[1]);
    if (resp.length) l.push(`<p>${resp.map(([a, b]) => `${a}: ${esc(b)}`).join('<br>')}</p>`);
    const imgs = procedencias(p);
    if (imgs.length) l.push(`<p class="proc">Grabados: ${imgs.map(esc).join('; ')}.</p>`);
    if (p.derechos) l.push(`<p>${esc(p.derechos)}</p>`);
    return `<div class="legal">${l.join('')}</div>`;
  }
  // fuentes de las imágenes del archivo usadas en el libro (interior y cubierta)
  function procedencias(p) {
    const cat = window.ARCHIVO; if (!cat) return [];
    const ids = new Set((p.ilustraciones || []).map(i => i.lamina).filter(Boolean));
    if (p.cubierta && p.cubierta.imagen) ids.add(p.cubierta.imagen);
    const fuentes = new Set();
    for (const id of ids) { const f = cat.ficha(id); if (f) fuentes.add(`${f.fuente.obra || f.fuente.nombre} (${f.pagina.l || 'dominio público'})`); }
    return [...fuentes];
  }

  // ---- cuerpo ----
  function cuerpo(p, opt) {
    const ilus = {};
    for (const il of p.ilustraciones || []) (ilus[il.despuesDe] = ilus[il.despuesDe] || []).push(il);
    const out = []; let abierta = false, primero = true, nCap = 0;
    const abrir = (titulo) => { if (abierta) out.push('</section>'); out.push(`<section class="capitulo${nCap === 0 ? ' inicio' : ''}">`); abierta = true; nCap++; };
    const conGuion = p.ajustes.guionado && p.tipo !== 'poesia';
    for (const b of p.bloques) {
      if (b.tipo === 'h1' || !abierta) abrir();
      const id = 'b-' + b.id;
      switch (b.tipo) {
        case 'h1': out.push(`<h1 class="titulo-cap" id="${id}">${enLinea(b, false)}</h1>`); primero = true; break;
        case 'h2': out.push(`<h2 id="${id}">${enLinea(b, false)}</h2>`); primero = true; break;
        case 'verso': out.push(`<div class="estrofa" id="${id}">${b.texto.split('\n').map(v => `<span class="v">${esc(v) || '&nbsp;'}</span>`).join('')}</div>`); primero = false; break;
        case 'cita': out.push(`<blockquote id="${id}">${enLinea(b, conGuion)}</blockquote>`); primero = true; break;
        case 'separador': out.push(`<p class="sep" id="${id}">${esc(opt.estilo.sep)}</p>`); primero = true; break;
        default: out.push(`<p id="${id}" class="${primero ? 'primero' : ''}${primero && opt.estilo.capitular && p.ajustes.capitular !== false ? ' capitular' : ''}">${enLinea(b, conGuion)}</p>`); primero = false;
      }
      for (const il of ilus[b.id] || []) out.push(figura(il, opt));
    }
    if (abierta) out.push('</section>');
    return out.join('');
  }
  function figura(il, opt) {
    const src = il.lamina ? 'archivo/laminas/' + il.lamina + '.png' : (opt.recursos && opt.recursos[il.recurso]) || '';
    return `<figure class="il il-${il.modo || 'media'}"><img src="${src}" alt=""${il.lamina ? ` data-lamina="${il.lamina}"` : ''}>${il.pie ? `<figcaption>${esc(il.pie)}</figcaption>` : ''}</figure>`;
  }

  function indice(p) {
    const caps = p.bloques.filter(b => b.tipo === 'h1');
    if (!p.indice || caps.length < 2) return '';
    return `<section class="pre indice"><h2 class="t-indice">Índice</h2><ol>${caps.map(b => `<li><a href="#b-${b.id}">${esc(b.texto)}</a></li>`).join('')}</ol></section>`;
  }
  function colofon(p, f) {
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const d = new Date();
    const txt = p.colofon.trim() || `Este libro se compuso en ${Folio.FUENTES[f.texto] || f.texto} con Folio${p.ciudad ? ', en ' + p.ciudad : ''}, en ${meses[d.getMonth()]} de ${d.getFullYear()}.`;
    return `<section class="pre colofon"><p>${esc(txt).replace(/\n/g, '<br>')}</p></section>`;
  }

  const cssCadena = t => String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
  function css(p, f, est) {
    const a = p.ajustes, [W, H] = Folio.FORMATOS[p.formato] || Folio.FORMATOS.A5;
    const tipo = Folio.TIPOS_LIBRO[p.tipo] || Folio.TIPOS_LIBRO.narrativa;
    const alin = p.tipo === 'poesia' ? 'left' : a.alineacion;
    const cab = a.cabeceras;
    const cabFuente = est.cabeceras === 'mono' ? 'FMono' : f.texto;
    const cabEstilo = est.cabeceras === 'versalitas' ? 'font-variant:small-caps;letter-spacing:.08em;' : est.cabeceras === 'cursiva' ? 'font-style:italic;' : 'font-size:7pt;letter-spacing:.04em;';
    return `
@page{size:${W}mm ${H}mm;margin:${a.margenSuperior}mm ${a.margenExterior}mm ${a.margenInferior}mm ${a.margenInterior}mm;
  @bottom-center{content:counter(page);font-family:${f.texto};font-size:${Math.max(7, a.cuerpo - 2)}pt;vertical-align:top;padding-top:4mm}}
@page :left{margin-left:${a.margenExterior}mm;margin-right:${a.margenInterior}mm;${cab ? `@top-center{content:"${cssCadena(p.titulo || '')}";font-family:${cabFuente};font-size:${Math.max(7, a.cuerpo - 2.5)}pt;${cabEstilo}vertical-align:bottom;padding-bottom:4mm}` : ''}}
@page :right{margin-left:${a.margenInterior}mm;margin-right:${a.margenExterior}mm;${cab ? `@top-center{content:string(capitulo);font-family:${cabFuente};font-size:${Math.max(7, a.cuerpo - 2.5)}pt;${cabEstilo}vertical-align:bottom;padding-bottom:4mm}` : ''}}
@page pre{@bottom-center{content:none}@top-center{content:none}}
@page capitulo:first{@top-center{content:none}}
@page :blank{@bottom-center{content:none}@top-center{content:none}}
@page lamina{@bottom-center{content:none}@top-center{content:none}}
html{font-family:${f.texto},serif;font-size:${a.cuerpo}pt;line-height:${a.interlineado};color:#000;font-kerning:normal;font-variant-ligatures:common-ligatures}
body{margin:0}
.pre{page:pre;break-before:right;position:relative}
.portadilla{display:flex;flex-direction:column;justify-content:flex-start;padding-top:28%}
.t-portadilla{font-family:${f.titulos};font-weight:400;font-size:${a.tituloCuerpo * .7}pt;text-align:center;margin:0;line-height:1.15}
.portada{break-before:right;height:calc(${H}mm - ${a.margenSuperior + a.margenInferior}mm);display:flex;flex-direction:column;text-align:center}
.p-autor{font-size:1.1em;margin-top:10%;letter-spacing:.04em}
.t-portada{font-family:${f.titulos};font-weight:400;font-size:${a.tituloCuerpo * 1.15}pt;line-height:1.1;margin:18% 0 .4em}
.p-sub{font-style:italic;font-size:1.05em}
.p-sello{margin-top:auto;font-variant:small-caps;letter-spacing:.08em}
.p-sello small{font-variant:normal;letter-spacing:0;font-size:.85em}
.creditos{break-before:left;height:calc(${H}mm - ${a.margenSuperior + a.margenInferior}mm);display:flex;flex-direction:column;justify-content:flex-end;font-size:.78em;line-height:1.4}
.legal p{margin:0 0 .6em;text-align:left;hyphens:manual}
.legal .proc{font-size:.92em}
.dedicatoria{padding-top:30%;text-align:right;font-style:italic}
.epigrafe{padding-top:30%}
.epigrafe blockquote{margin:0 0 0 28%;font-style:italic;font-size:.95em}
.epigrafe cite{display:block;font-style:normal;text-align:right;margin-top:.6em;font-size:.9em}
.capitulo{page:capitulo;break-before:${a.capituloDerecha ? 'right' : 'page'}}
.titulo-cap{font-family:${f.titulos};font-weight:400;font-size:${a.tituloCuerpo}pt;line-height:1.15;margin:${a.aireTitulo}mm 0 ${Math.max(6, a.tituloCuerpo * .9)}pt;text-align:${p.tipo === 'poesia' ? 'left' : 'center'};string-set:capitulo content(text);break-after:avoid;hyphens:none${est.filete ? `;padding-bottom:.4em;border-bottom:.5pt solid #000` : ''}}
h2{font-family:${f.titulos};font-weight:400;font-size:${Math.max(a.cuerpo + 1, a.tituloCuerpo * .62)}pt;line-height:1.2;margin:1.6em 0 .7em;break-after:avoid;text-align:${p.tipo === 'poesia' ? 'left' : 'center'};hyphens:none}
p{margin:0 0 ${a.entreParrafos}pt;text-align:${alin};text-indent:${a.sangria}em;widows:2;orphans:2;hyphens:manual;letter-spacing:${a.espaciado}em}
p.primero{text-indent:0}
p.capitular::first-letter{${est.capitular ? `font-family:${est.capitular};float:left;font-size:${(a.interlineado * 3).toFixed(2)}em;line-height:.82;margin:.06em .08em 0 0;padding:0` : ''}}
blockquote{margin:.8em 1.6em;font-size:.92em;hyphens:manual}
.estrofa{margin:0 0 ${Math.max(a.entreParrafos, a.cuerpo * a.interlineado)}pt;break-inside:${tipo.verso ? 'avoid' : 'auto'};text-align:left}
.estrofa .v{display:block;padding-left:1.5em;text-indent:-1.5em}
.sep{text-align:center;text-indent:0;margin:1em 0}
figure.il{margin:1em 0;text-align:center;break-inside:avoid}
figure.il img{max-width:100%;display:inline-block}
.il-media img{max-height:45vh;max-height:${(H - a.margenSuperior - a.margenInferior) * .45}mm}
.il-vineta img{width:36%}
.il-pagina{page:lamina;break-before:page;break-after:page;width:100%;height:calc(${H}mm - ${a.margenSuperior + a.margenInferior}mm - 2mm);display:flex;flex-direction:column;justify-content:center;align-items:center;margin:0;overflow:hidden}
.il-pagina img{min-width:0;min-height:0;max-width:100%;max-height:calc(100% - 3em);width:auto;height:auto;object-fit:contain;flex:0 1 auto}
figcaption{font-size:.8em;font-style:italic;margin-top:.5em;text-align:center}
.indice{break-before:right}
.t-indice{font-family:${f.titulos};font-weight:400;text-align:center;margin:${a.aireTitulo}mm 0 1.5em}
.indice ol{list-style:none;margin:0;padding:0}
.indice li{display:flex;align-items:baseline;margin:0 0 .45em}
.indice li{gap:.4em}
.indice a{color:inherit;text-decoration:none;flex:1;display:flex;align-items:baseline}
.indice a::before{content:'';order:2;flex:1;border-bottom:.6pt dotted #000;margin:0 .3em;transform:translateY(-.25em)}
.indice a::after{content:target-counter(attr(href), page);order:3}
.colofon{break-before:page;padding-top:55%;text-align:center;font-size:.82em;font-style:italic}
`;
  }

  function componer(p, opt = {}) {
    const c = Folio.COLECCIONES.find(x => x.id === p.coleccion) || Folio.COLECCIONES[0];
    const f = { texto: NOMBRE_FUENTE[p.ajustes.fuenteTexto || c.texto], titulos: NOMBRE_FUENTE[p.ajustes.fuenteTitulos || c.titulos] };
    const estilo = INTERIOR[c.id] || INTERIOR.bestiario;
    const o = { estilo, recursos: opt.recursos || {} };
    const final = p.indicePos === 'inicio';
    const html = preliminares(p) + (final ? indice(p) : '') + cuerpo(p, o) + (!final ? indice(p) : '') + colofon(p, f);
    return { html, css: css(p, f, estilo), fuentes: f };
  }

  // Revisión de la paginación ya compuesta (lo que Paged.js entregó)
  function comprobar(doc, p) {
    const avisos = [], secciones = {}, paginas = [...doc.querySelectorAll('.pagedjs_page')];
    const lh = p.ajustes.cuerpo * p.ajustes.interlineado * 96 / 72;
    paginas.forEach((pg, i) => {
      const n = i + 1, contenido = pg.querySelector('.pagedjs_page_content');
      const hijos = contenido ? [...contenido.querySelectorAll('section > *, .pagedjs_page_content > div > *')].filter(e => e.offsetHeight > 0 && !e.matches('section')) : [];
      for (const h of pg.querySelectorAll('h1.titulo-cap')) if (!h.dataset.splitFrom) secciones[h.id] = n;
      if (pg.classList.contains('pagedjs_blank_page') || pg.classList.contains('pagedjs_pre_page')) return;
      if (!hijos.length) return;
      const ultimo = hijos[hijos.length - 1], prim = hijos[0];
      if (/^H[12]$/.test(ultimo.tagName) && hijos.length > 1) avisos.push({ tipo: 'titulo', pagina: n, msg: 'Título solo al pie de la página' });
      if (prim.tagName === 'P' && prim.dataset.splitFrom && prim.offsetHeight < lh * 1.5) avisos.push({ tipo: 'viuda', pagina: n, msg: 'Línea viuda al comienzo de la página' });
      if (ultimo.tagName === 'P' && ultimo.dataset.splitTo && ultimo.offsetHeight < lh * 1.5) avisos.push({ tipo: 'huerfana', pagina: n, msg: 'Línea huérfana al final de la página' });
      for (const img of pg.querySelectorAll('figure.il img')) {
        const ancho = img.getBoundingClientRect().width / 96; // pulgadas
        if (img.naturalWidth && ancho > 0) { const ppp = img.naturalWidth / ancho; if (ppp < 150) avisos.push({ tipo: 'resolucion', pagina: n, msg: `Imagen a ${Math.round(ppp)} ppp (conviene 200 o más)` }); }
        if (!img.naturalWidth) avisos.push({ tipo: 'imagen', pagina: n, msg: 'Imagen que no se pudo cargar' });
      }
      const area = contenido.getBoundingClientRect();
      for (const e of hijos) { const r = e.getBoundingClientRect(); if (r.width > area.width + 2) { avisos.push({ tipo: 'desborde', pagina: n, msg: 'Contenido que se sale de la caja' }); break; } }
    });
    // páginas casi vacías al final de un capítulo
    return { paginas: paginas.length, avisos, secciones };
  }

  window.Libro = { componer, comprobar, procedencias, creditos, preliminares, INTERIOR, esc, guionar };
})();
