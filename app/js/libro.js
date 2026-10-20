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

  // tramos con formato → HTML. Las notas al pie van marcadas en el texto con U+E000.
  function tramos(b) { return b.runs && b.runs.length ? b.runs : [{ text: b.texto }]; }
  // contexto de composición (librojuego e índice analítico); lo fija componer()
  let CTX = { lj: null, ia: null };
  function numerarLJ(p) {
    const secs = p.bloques.filter(b => b.tipo === 'seccion').map(b => b.texto.trim());
    if (!secs.length) return null;
    let orden = secs.slice();
    if (p.librojuego && p.librojuego.barajar) {
      let s = (p.librojuego.semilla || 1) >>> 0; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      const resto = orden.slice(1); for (let i = resto.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [resto[i], resto[j]] = [resto[j], resto[i]]; }
      orden = [orden[0], ...resto];
    }
    return new Map(orden.map((e, i) => [e, i + 1]));
  }
  const idSec = e => 'sec-' + e.toLowerCase().replace(/[^\p{L}\d]+/gu, '-');
  function trozo(t, conGuion) {
    // remisiones del librojuego: [[etiqueta]] → número
    let out = '', i = 0; const re = /\[\[([^\]]+)\]\]/g; let m;
    const normal = x => conGuion ? guionar(x) : x;
    if (CTX.lj) while ((m = re.exec(t))) { out += marcarIA(normal(t.slice(i, m.index))); const n = CTX.lj.get(m[1].trim()); out += n ? `<a class="ref-sec" href="#${idSec(m[1].trim())}">${n}</a>` : `<span class="ref-falta">¿${esc(m[1])}?</span>`; i = m.index + m[0].length; }
    return out + marcarIA(normal(t.slice(i)));
  }
  // términos del índice analítico: se envuelven para ubicar sus páginas después de componer
  function marcarIA(t) {
    if (!CTX.ia) return esc(t);
    let out = '', i = 0, m; CTX.ia.re.lastIndex = 0;
    const limpio = t.replace(/\u00AD/g, '');
    if (limpio.length !== t.length) { // con guiones blandos: buscar sobre el texto limpio y mapear posiciones
      const mapa = []; for (let k = 0; k < t.length; k++) if (t[k] !== '\u00AD') mapa.push(k); mapa.push(t.length);
      while ((m = CTX.ia.re.exec(limpio))) { const a = mapa[m.index], z = mapa[m.index + m[0].length]; out += esc(t.slice(i, a)) + `<span class="ia" data-ia="${CTX.ia.indice(m[0])}">${esc(t.slice(a, z))}</span>`; i = z; }
      return out + esc(t.slice(i));
    }
    while ((m = CTX.ia.re.exec(t))) { out += esc(t.slice(i, m.index)) + `<span class="ia" data-ia="${CTX.ia.indice(m[0])}">${esc(m[0])}</span>`; i = m.index + m[0].length; }
    return out + esc(t.slice(i));
  }
  function enLinea(b, conGuion, estado = { n: 0 }) {
    const notas = b.notas || [];
    const g = t => trozo(t, conGuion).replace(/\n/g, '<br>').replace(/\uE000/g, () => { const n = notas[estado.n++]; return n ? `<span class="nota-pie">${esc(n)}</span>` : ''; });
    return tramos(b).map(r => { let h = g(r.text); if (r.italic) h = `<i>${h}</i>`; if (r.bold) h = `<b>${h}</b>`; return h; }).join('');
  }
  // versos: cada línea en su caja, conservando cursivas y notas
  function versos(b) {
    const lineas = [[]], estado = { n: 0 };
    for (const r of tramos(b)) r.text.split('\n').forEach((t, i) => { if (i) lineas.push([]); if (t) lineas[lineas.length - 1].push({ ...r, text: t }); });
    return lineas.map(l => `<span class="v">${l.length ? enLinea({ runs: l, notas: b.notas }, false, estado) : '&nbsp;'}</span>`).join('');
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
    const resp = [['Corrección', p.correccion], ['Diseño y diagramación', p.diseno], ['Impresión', typeof p.imprenta === 'string' ? p.imprenta : '']].filter(x => x[1]);
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
    for (const id of ids) { const f = cat.ficha(id); if (f) fuentes.add(f.pagina.o ? `${f.pagina.o}, ${f.pagina.a || 'autor desconocido'} (${f.pagina.l || 'dominio público'}, Wikimedia Commons)` : `${f.fuente.obra || f.fuente.nombre} (${f.pagina.l || 'dominio público'})`); }
    return [...fuentes];
  }

  // ---- cuerpo ----
  function cuerpo(p, opt) {
    const ilus = {};
    for (const il of p.ilustraciones || []) (ilus[il.despuesDe] = ilus[il.despuesDe] || []).push(il);
    const out = []; let abierta = false, primero = true, nCap = 0;
    const port = p.ajustes.portadillas || 'no';
    const laminaCap = k => { const l = (opt.vinetas || [])[k % Math.max(1, (opt.vinetas || []).length)]; return l ? srcLamina(l, opt) : ''; };
    const abrir = (titulo, esCap) => {
      if (abierta) out.push('</section>');
      if (esCap && port === 'pagina' && laminaCap(nCap)) out.push(`<figure class="portadilla-ilus"><img src="${laminaCap(nCap)}" alt=""></figure>`);
      out.push(`<section class="capitulo${nCap === 0 ? ' inicio' : ''}${esCap && port === 'pagina' ? ' tras-ilus' : ''}">`);
      if (esCap && port === 'vineta' && laminaCap(nCap)) out.push(`<figure class="vineta-cap"><img src="${laminaCap(nCap)}" alt=""></figure>`);
      abierta = true; nCap++;
    };
    const finaActiva = p.ajustes.justificacionFina !== false && p.ajustes.alineacion === 'justify' && p.tipo !== 'poesia';
    const conGuion = p.ajustes.guionado && p.tipo !== 'poesia' && !finaActiva;
    for (const b of p.bloques) {
      if (b.tipo === 'h1' || !abierta) abrir(b.texto, b.tipo === 'h1');
      const id = 'b-' + b.id;
      const extra = (opt.finos && opt.finos[b.id] ? ' ' + opt.finos[b.id] : '') + (finaActiva && b.tipo === 'p' ? ' fina' : '') + (b.saltoAntes ? ' salto' : '') + (b.pegado ? ' pegado' : '') + (b.entero ? ' entero' : '');
      switch (b.tipo) {
        case 'h1': out.push(`<h1 class="titulo-cap${extra}" id="${id}" data-b="${b.id}">${enLinea(b, false)}</h1>`); primero = true; break;
        case 'h2': out.push(`<h2 class="${extra}" id="${id}" data-b="${b.id}">${enLinea(b, false)}</h2>`); primero = true; break;
        case 'verso': out.push(`<div class="estrofa${extra}" id="${id}" data-b="${b.id}">${versos(b)}</div>`); primero = false; break;
        case 'cita': out.push(`<blockquote class="${extra}" id="${id}" data-b="${b.id}">${enLinea(b, conGuion)}</blockquote>`); primero = true; break;
        case 'seccion': { const e = b.texto.trim(), n = CTX.lj ? CTX.lj.get(e) : '?'; out.push(`<h2 class="seccion-n${extra}" id="${idSec(e)}" data-b="${b.id}">${n}</h2>`); primero = true; break; }
        case 'separador': out.push(`<p class="sep" id="${id}" data-b="${b.id}">${esc(opt.estilo.sep)}</p>`); primero = true; break;
        default: out.push(`<p id="${id}" data-b="${b.id}" class="${primero ? 'primero' : ''}${primero && opt.estilo.capitular && p.ajustes.capitular !== false && p.tipo !== 'poesia' ? ' capitular' : ''}${extra}">${enLinea(b, conGuion)}</p>`); primero = false;
      }
      for (const il of ilus[b.id] || []) out.push(figura(il, opt));
    }
    if (abierta) out.push('</section>');
    return out.join('');
  }
  const srcLamina = (id, opt) => (opt.vectores && opt.vectores.includes(id) ? 'folio://datos/vectores/' + id + '.svg' : (/^X\d+$/.test(id) ? 'folio://datos/archivo/laminas/' : 'archivo/laminas/') + id + '.png');
  function figura(il, opt) {
    const src = il.lamina ? srcLamina(il.lamina, opt) : (opt.recursos && opt.recursos[il.recurso]) || '';
    if (il.modo === 'doble') return `<figure class="il il-doble izq" data-il="${il.id || ''}"><img src="${src}" alt=""></figure><figure class="il il-doble der" data-il="${il.id || ''}"><img src="${src}" alt=""></figure>`;
    if (il.modo === 'blanca') return `<div class="il il-blanca" data-il="${il.id || ''}"></div>`;
    return `<figure class="il il-${il.modo || 'media'}" data-il="${il.id || ''}"><img src="${src}" alt=""${il.lamina ? ` data-lamina="${il.lamina}"` : ''}>${il.pie ? `<figcaption>${esc(il.pie)}</figcaption>` : ''}</figure>`;
  }

  function prepararIA(p) {
    const ia = p.indiceAnalitico; if (!ia || ia.activo === false || !(ia.terminos || []).length) return null;
    const ts = ia.terminos.map(x => x.t).filter(Boolean).sort((a, b) => b.length - a.length);
    const escRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?<![\\p{L}\\d])(' + ts.map(escRe).join('|') + ')(?![\\p{L}\\d])', 'giu');
    const idx = new Map(ia.terminos.map((x, i) => [x.t.toLowerCase(), i]));
    return { re, indice: m => idx.get(m.toLowerCase()) ?? 0 };
  }
  function indiceAnalitico(p) {
    const ia = p.indiceAnalitico; if (!ia || ia.activo === false || !(ia.terminos || []).length) return '';
    // los números se completan después de componer (Paginar.completarIA); se reserva el espacio con ceros
    const cuenta = ia.terminos.map(() => 0);
    if (CTX.ia) for (const b of p.bloques) { CTX.ia.re.lastIndex = 0; let m; while ((m = CTX.ia.re.exec(b.texto))) cuenta[CTX.ia.indice(m[0])]++; }
    const orden = ia.terminos.map((x, i) => ({ ...x, i })).sort((a, b) => a.t.localeCompare(b.t, 'es'));
    return `<section class="pre ia-indice"><h2 class="t-indice">Índice analítico</h2><ul>${orden.map(x => `<li data-ia-entrada="${x.i}"><span class="t">${esc(x.t)}</span>, <span class="pags">${Array(Math.min(12, Math.max(1, cuenta[x.i]))).fill('000').join(', ')}</span></li>`).join('')}</ul></section>`;
  }
  // ---- edición facsimilar: el original a la izquierda, la transcripción enfrentada a la derecha ----
  function facsimil(p, opt) {
    const fx = p.facsimil; if (!fx || !(fx.folios || []).length) return '';
    const a = p.ajustes, [W, H] = Folio.FORMATOS[p.formato] || Folio.FORMATOS.A5;
    const caja = { w: W - a.margenInterior - a.margenExterior, h: H - a.margenSuperior - a.margenInferior - 7 }; // 7 mm para la signatura
    const lh = a.cuerpo * a.interlineado * 0.3528; // mm por línea
    const modo = fx.modo || 'paleografica', cada = fx.numerarCada || 5;
    return fx.folios.map((f, k) => {
      const src = (opt.recursos || {})[f.recurso] || '';
      const lineas = String(f.transcripcion || '').replace(/\r/g, '').split('\n');
      const notas = [];
      // escala de la imagen dentro de la caja (para alinear renglones con las guías)
      const esc2 = Math.min(caja.w / (f.w || 1000), caja.h / (f.h || 1400)), altoImg = (f.h || 1400) * esc2, arriba = (caja.h - altoImg) / 2;
      const guias = (f.guias || []).slice().sort((x, y) => x - y);
      const alineado = fx.alinear !== false && guias.length >= Math.min(lineas.length, 2) && guias.length >= lineas.length;
      let cuerpoT = 0, html = '';
      if (alineado) {
        const sep = Math.min(...guias.slice(1).map((g, i) => (g - guias[i]) * altoImg).filter(x => x > 0), 99);
        cuerpoT = Math.max(5.5, Math.min(a.cuerpo, sep / (0.3528 * 1.15)));
        html = lineas.map((l, i) => `<span class="l abs" style="top:${(arriba + guias[i] * altoImg - cuerpoT * 0.3528 * 0.85).toFixed(2)}mm"${(i + 1) % cada === 0 ? ` data-n="${i + 1}"` : ''}>${FacsimilMarcas.linea(l, modo, notas) || '&nbsp;'}</span>`).join('');
      } else {
        const caben = Math.floor(caja.h / lh);
        cuerpoT = lineas.length > caben ? Math.max(6, a.cuerpo * caben / lineas.length) : a.cuerpo;
        html = lineas.map((l, i) => `<span class="l"${(i + 1) % cada === 0 ? ` data-n="${i + 1}"` : ''}>${FacsimilMarcas.linea(l, modo, notas) || '&nbsp;'}</span>`).join('');
      }
      // que la línea más larga quepa a lo ancho (las líneas no se cortan: respetan el original)
      const larga = Math.max(1, ...lineas.map(l => FacsimilMarcas.plano(l).length));
      cuerpoT = Math.min(cuerpoT, (caja.w - 2) / (larga * 0.5 * 0.3528));
      if (cuerpoT < 6) cuerpoT = 6;
      const etq = esc(f.etiqueta || String(k + 1));
      return `<figure class="fac-img" data-fol="${f.id}"><div class="fac-caja"><img src="${src}" alt="Facsímil, folio ${etq}"></div><figcaption>${etq}</figcaption></figure>
        <div class="fac-txt${alineado ? ' alineado' : ''}" data-fol="${f.id}" style="font-size:${cuerpoT.toFixed(2)}pt"><div class="fac-lineas" style="height:${caja.h}mm">${html}</div><div class="fac-sig">${etq}</div></div>`;
    }).join('');
  }
  function indice(p) {
    const caps = p.bloques.filter(b => b.tipo === 'h1');
    if (!p.indice || caps.length < 2) return '';
    return `<section class="pre indice"><h2 class="t-indice">Índice</h2><ol>${caps.map(b => `<li><a href="#b-${b.id}">${esc(b.texto)}</a></li>`).join('')}</ol></section>`;
  }
  function colofon(p, f) {
    if (p.colofonActivo === false) return '';
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const d = new Date();
    const txt = p.colofon.trim() || `Este libro se compuso en ${Folio.FUENTES[f.texto] || f.texto} con Folio${p.ciudad ? ', en ' + p.ciudad : ''}, en ${meses[d.getMonth()]} de ${d.getFullYear()}.`;
    return `<section class="pre colofon"><p>${esc(txt).replace(/\n/g, '<br>')}</p></section>`;
  }

  const cssCadena = t => String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
  function css(p, f, est) {
    const saltoCap = p.ajustes.saltoCapitulo || (p.ajustes.capituloDerecha === false ? 'pagina' : 'derecha');
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
@page sangre{margin:0;@bottom-center{content:none}@top-center{content:none}}
html{font-family:${f.texto},serif;font-size:${a.cuerpo}pt;line-height:${a.interlineado};color:#000;font-kerning:normal;font-variant-ligatures:${a.ligaduras === false ? 'no-common-ligatures' : 'common-ligatures'};font-variant-numeric:${a.cifrasAntiguas !== false && (Folio.RASGOS[f.texto] || {}).onum ? 'oldstyle-nums proportional-nums' : 'normal'};--lh:${(a.cuerpo * a.interlineado).toFixed(3)}pt}
${a.versalitasInicio !== false && (Folio.RASGOS[f.texto] || {}).smcp && p.tipo !== 'poesia' ? 'p.primero::first-line{font-variant-caps:small-caps;letter-spacing:.03em}' : ''}
p.fina{text-align:left;text-align-last:left}
.apretar{letter-spacing:-.012em;word-spacing:-.04em}
.aflojar{letter-spacing:.012em;word-spacing:.05em}
.vineta-cap{margin:${Math.max(4, a.aireTitulo * .3)}mm auto 0;text-align:center;break-after:avoid}
.vineta-cap img{max-width:48%;max-height:${Math.round((H - a.margenSuperior - a.margenInferior) * .28)}mm}
.vineta-cap + .titulo-cap{margin-top:6mm}
.portadilla-ilus{page:lamina;break-before:left;height:calc(${H}mm - ${a.margenSuperior + a.margenInferior}mm - 2mm);margin:0;display:flex;align-items:center;justify-content:center}
.portadilla-ilus img{max-width:100%;max-height:100%;object-fit:contain}
.capitulo.tras-ilus{break-before:right}
section.guarda{page:sangre;break-before:page;width:${W}mm;height:${H}mm;margin:0;overflow:hidden}
section.guarda img{width:100%;height:100%;object-fit:cover;display:block}
${a.registro ? `.titulo-cap{line-height:calc(var(--lh) * 2) !important;margin:calc(var(--lh) * ${Math.max(2, Math.round(a.aireTitulo / (a.cuerpo * a.interlineado * .3528)))}) 0 calc(var(--lh) * 2) !important;padding:0 !important;border:0 !important}
h2{line-height:var(--lh) !important;margin:var(--lh) 0 !important}
p{margin:0 !important}
blockquote,.estrofa,.sep,figure.il{margin-top:var(--lh) !important;margin-bottom:var(--lh) !important;line-height:var(--lh)}
blockquote{font-size:1em !important}` : ''}
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
.capitulo{page:capitulo;break-before:${saltoCap === 'continuo' ? 'auto' : saltoCap === 'pagina' ? 'page' : 'right'}}
.capitulo.inicio{break-before:right}
.salto{break-before:page}
.pegado{break-after:avoid}
.entero{break-inside:avoid}
.nota-pie{float:footnote;font-size:.78em;line-height:1.3;text-indent:0;text-align:left;hyphens:manual;font-style:normal;font-weight:400}
::footnote-call{content:counter(footnote);font-size:.65em;vertical-align:super;line-height:0;margin-left:.05em}
::footnote-marker{content:counter(footnote) ". ";}
@page{@footnote{float:bottom;border-top:.5pt solid #000;padding-top:1.5mm;margin-top:3mm}}
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
figure.il-doble{page:sangre;break-after:page;width:${W}mm;height:${H}mm;margin:0;overflow:hidden;position:relative}
figure.il-doble.izq{break-before:left}
figure.il-doble img{position:absolute;top:0;height:100%;width:${2 * W}mm;object-fit:cover;max-width:none}
figure.il-doble.izq img{left:0}
figure.il-doble.der img{left:-${W}mm}
.il-blanca{page:lamina;break-before:page;break-after:page;height:10mm}
figure.il-sangre{page:sangre;break-before:page;break-after:page;width:${W}mm;height:${H}mm;margin:0;overflow:hidden}
.il-sangre img{width:100%;height:100%;object-fit:cover;display:block}
.il-sangre figcaption{display:none}
figcaption{font-size:.8em;font-style:italic;margin-top:.5em;text-align:center}
.indice{break-before:right}
.t-indice{font-family:${f.titulos};font-weight:400;text-align:center;margin:${a.aireTitulo}mm 0 1.5em}
.indice ol{list-style:none;margin:0;padding:0}
.indice li{display:flex;align-items:baseline;margin:0 0 .45em}
.indice li{gap:.4em}
.indice a{color:inherit;text-decoration:none;flex:1;display:flex;align-items:baseline}
.indice a::before{content:'';order:2;flex:1;border-bottom:.6pt dotted #000;margin:0 .3em;transform:translateY(-.25em)}
.indice a::after{content:target-counter(attr(href), page);order:3}
@page fac{@top-center{content:none}}
.facsimiles{page:fac}
.fac-img{break-before:left;margin:0;height:calc(${H}mm - ${a.margenSuperior + a.margenInferior}mm - 1mm);display:flex;flex-direction:column}
.fac-caja{flex:1;display:flex;align-items:center;justify-content:center;min-height:0}
.fac-caja img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.fac-img figcaption{text-align:center;font-size:7.5pt;font-style:italic;height:7mm;padding-top:2mm}
.fac-txt{break-before:right;break-after:page;font-family:${f.texto};text-align:left;hyphens:none;line-height:${a.interlineado}}
.fac-lineas{position:relative;overflow:hidden}
.fac-txt .l{display:block;position:relative;white-space:nowrap}
.fac-txt .l.abs{position:absolute;left:0;right:0}
.fac-txt .l[data-n]::before{content:attr(data-n);position:absolute;left:-7mm;width:5mm;text-align:right;font-size:.7em;color:#555;top:.15em}
.fac-sig{text-align:center;font-size:7.5pt;font-style:italic;height:7mm;padding-top:2mm}
.fx-del{text-decoration:line-through}
.fx-add{font-size:.82em;vertical-align:.35em}
.fx-dud{font-size:.75em;margin-left:.1em}
.fx-il{font-style:italic;font-size:.9em}
.fx-abr{font-style:italic}
.seccion-n{font-family:${f.titulos};font-weight:400;font-size:${Math.max(18, a.tituloCuerpo)}pt;text-align:center;margin:1.6em 0 .6em;break-after:avoid}
.ref-sec{color:inherit;text-decoration:none;font-weight:700}
.ref-falta{color:#a3321e}
.ia-indice{break-before:right;font-size:.9em}
.ia-indice ul{list-style:none;margin:0;padding:0;columns:2;column-gap:6mm}
.ia-indice li{margin:0 0 .3em;padding-left:1em;text-indent:-1em;break-inside:avoid}
.colofon{break-before:page;padding-top:55%;text-align:center;font-size:.82em;font-style:italic}
`;
  }

  // láminas para las portadillas de capítulo: las elegidas o sorteadas entre las limpias (hierbas si es Herbario)
  function vinetas(p) {
    if (!p.ajustes.portadillas || p.ajustes.portadillas === 'no' || !window.ARCHIVO || !ARCHIVO.listo) return [];
    if (p.portadillasLaminas && p.portadillasLaminas.length) return p.portadillasLaminas;
    const n = p.bloques.filter(b => b.tipo === 'h1').length || 1;
    const filtro = p.coleccion === 'herbario' ? (l => l.hb) : (l => l.q && l.tipo === 'figura' && l.w > 260);
    return ARCHIVO.elegir(filtro, (p.cubierta.semilla || 1) * 131 + 17, n).map(l => l.id);
  }
  function componer(p, opt = {}) {
    const c = Folio.COLECCIONES.find(x => x.id === p.coleccion) || Folio.COLECCIONES[0];
    const kT = p.ajustes.fuenteTexto || c.texto, kTi = p.ajustes.fuenteTitulos || c.titulos;
    const f = { texto: NOMBRE_FUENTE[kT] || kT, titulos: NOMBRE_FUENTE[kTi] || kTi };
    const caras = (p.fuentesPropias || []).filter(x => (opt.recursos || {})[x.recurso]).map(x => `@font-face{font-family:${x.clave};src:url(${opt.recursos[x.recurso]});font-style:${x.estilo};font-weight:${x.peso}}`).join('\n');
    const estilo = INTERIOR[c.id] || INTERIOR.bestiario;
    const o = { estilo, recursos: opt.recursos || {}, finos: opt.finos || null, vinetas: vinetas(p), vectores: p.ajustes.vectorizar === false ? null : (opt.vectores || null) };
    const final = p.indicePos === 'inicio';
    CTX = { lj: p.tipo === 'librojuego' || p.bloques.some(b => b.tipo === 'seccion') ? numerarLJ(p) : null, ia: prepararIA(p) };
    const cuerpoHTML = cuerpo(p, o) + (p.facsimil && (p.facsimil.folios || []).length ? `<section class="facsimiles">${facsimil(p, o)}</section>` : '');
    const guarda = p.guardas && p.guardas.modo === 'libro' && (opt.recursos || {})['guarda.png'] ? `<section class="guarda"><img src="${opt.recursos['guarda.png']}" alt=""></section><section class="guarda"><img src="${opt.recursos['guarda.png']}" alt=""></section>` : '';
    const html = guarda + preliminares(p) + (final ? indice(p) : '') + cuerpoHTML + (!final ? indice(p) : '') + indiceAnalitico(p) + colofon(p, f) + guarda.replace(/class="guarda"/g, 'class="guarda final"');
    CTX = { lj: null, ia: null };
    return { html, css: caras + '\n' + css(p, f, estilo) + (opt.imprenta ? '\n@page{bleed:3mm;marks:crop}' : ''), fuentes: f };
  }

  // Revisión de la paginación ya compuesta (lo que Paged.js entregó)
  function comprobar(doc, p) {
    const avisos = [], secciones = {}, blancas = [], paginas = [...doc.querySelectorAll('.pagedjs_page')];
    const lh = p.ajustes.cuerpo * p.ajustes.interlineado * 96 / 72;
    paginas.forEach((pg, i) => {
      const n = i + 1, contenido = pg.querySelector('.pagedjs_page_content');
      const hijos = contenido ? [...contenido.querySelectorAll('section > *, .pagedjs_page_content > div > *')].filter(e => e.offsetHeight > 0 && !e.matches('section')) : [];
      for (const h of pg.querySelectorAll('h1.titulo-cap')) if (!h.dataset.splitFrom) secciones[h.id] = n;
      if (pg.classList.contains('pagedjs_blank_page')) { blancas.push(n); return; }
      if (pg.classList.contains('pagedjs_pre_page')) return;
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
    return { paginas: paginas.length, avisos, secciones, blancas };
  }

  window.Libro = { vinetas, numerarLJ, idSec, componer, comprobar, procedencias, creditos, preliminares, INTERIOR, esc, guionar };
})();
