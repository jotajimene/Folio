/* Folio · libro digital EPUB 3 (con JSZip, MIT). Sale del mismo proyecto: texto, notas, grabados, índice y portada. */
(function () {
  'use strict';
  const x = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function enLinea(b, notas, cap) {
    const runs = b.runs && b.runs.length ? b.runs : [{ text: b.texto }]; let k = 0;
    return runs.map(r => {
      let h = x(r.text).replace(/\n/g, '<br/>').replace(//g, () => { const t = (b.notas || [])[k++]; if (!t) return ''; notas.push(t); const n = notas.length; return `<a epub:type="noteref" id="ref${cap}-${n}" href="#nota${cap}-${n}" class="llamada">${n}</a>`; });
      if (r.italic) h = `<i>${h}</i>`; if (r.bold) h = `<b>${h}</b>`; return h;
    }).join('');
  }
  const pagina = (titulo, cuerpo) => `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="es" lang="es"><head><meta charset="utf-8"/><title>${x(titulo)}</title><link rel="stylesheet" href="estilo.css"/></head><body>${cuerpo}</body></html>`;
  async function aBytes(src) { const r = await fetch(src); return new Uint8Array(await r.arrayBuffer()); }

  async function generar(p, { recursos = {} } = {}) {
    await ARCHIVO.cargar();
    const z = new JSZip(), uid = 'urn:folio:' + (p.id || Date.now());
    z.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    z.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    const manifiesto = [], espina = [], toc = [];
    // portada: la tapa de la colección, fotografiada en una ventana oculta
    try {
      if (window.Escritorio && Escritorio.tapaPNG) {
        const M = Cubiertas.medidas(p, 'frente', 0, 0);
        const b64 = await Escritorio.tapaPNG({ proyecto: JSON.parse(JSON.stringify(p)), recursos, modo: 'frente', mm: M.total, escala: 2.4 });
        z.file('OEBPS/portada.png', b64, { base64: true });
        manifiesto.push('<item id="portada-img" href="portada.png" media-type="image/png" properties="cover-image"/>'); z.file('OEBPS/portada.xhtml', pagina('Portada', '<section epub:type="cover" class="portada"><img src="portada.png" alt="Portada"/></section>')); manifiesto.push('<item id="portada" href="portada.xhtml" media-type="application/xhtml+xml"/>'); espina.push('<itemref idref="portada"/>');
      }
    } catch (e) { console.error('portada epub', e); }
    // portadilla y créditos
    z.file('OEBPS/titulo.xhtml', pagina(p.titulo, `<section class="titulo"><p class="autor">${x(p.autor)}</p><h1>${x(p.titulo)}</h1>${p.subtitulo ? `<p class="sub">${x(p.subtitulo)}</p>` : ''}<p class="sello">${x(p.sello)}</p></section><section class="creditos">${Libro.creditos(p).replace(/<br>/g, '<br/>')}</section>${p.dedicatoria ? `<section class="dedicatoria"><p>${x(p.dedicatoria).replace(/\n/g, '<br/>')}</p></section>` : ''}${p.epigrafe ? `<section class="epigrafe"><blockquote><p>${x(p.epigrafe).replace(/\n/g, '<br/>')}</p>${p.epigrafeAutor ? `<p class="cita">${x(p.epigrafeAutor)}</p>` : ''}</blockquote></section>` : ''}`));
    manifiesto.push('<item id="titulo" href="titulo.xhtml" media-type="application/xhtml+xml"/>'); espina.push('<itemref idref="titulo"/>');
    // capítulos
    const caps = []; let actual = null;
    for (const b of p.bloques) { if (b.tipo === 'h1' || !actual) { actual = { titulo: b.tipo === 'h1' ? b.texto : p.titulo, bloques: [] }; caps.push(actual); } actual.bloques.push(b); }
    const ilus = {}; for (const il of p.ilustraciones || []) (ilus[il.despuesDe] = ilus[il.despuesDe] || []).push(il);
    const imagenes = new Set(), propias = new Map();
    caps.forEach((c, i) => {
      const notas = []; let h = '';
      for (const b of c.bloques) {
        if (b.tipo === 'h1') h += `<h1>${x(b.texto)}</h1>`;
        else if (b.tipo === 'h2') h += `<h2>${x(b.texto)}</h2>`;
        else if (b.tipo === 'verso') h += `<div class="estrofa">${enLinea(b, notas, i).split('<br/>').map(v => `<p class="v">${v || '&#160;'}</p>`).join('')}</div>`;
        else if (b.tipo === 'cita') h += `<blockquote><p>${enLinea(b, notas, i)}</p></blockquote>`;
        else if (b.tipo === 'separador') h += '<p class="sep">⁂</p>';
        else h += `<p>${enLinea(b, notas, i)}</p>`;
        for (const il of ilus[b.id] || []) {
          if (il.lamina) { imagenes.add(il.lamina); h += `<figure><img src="img/${il.lamina}.png" alt="${x(il.pie || 'Grabado')}"/>${il.pie ? `<figcaption>${x(il.pie)}</figcaption>` : ''}</figure>`; }
          else if (il.recurso && recursos[il.recurso]) { const ext = /^data:image\/png/.test(recursos[il.recurso]) ? 'png' : 'jpg'; propias.set(il.recurso, ext); h += `<figure><img src="img/${il.recurso.replace(/\.[^.]+$/, '')}.${ext}" alt="${x(il.pie || 'Imagen')}"/>${il.pie ? `<figcaption>${x(il.pie)}</figcaption>` : ''}</figure>`; }
        }
      }
      if (notas.length) h += `<section epub:type="footnotes" class="notas"><hr/>${notas.map((t, k) => `<aside epub:type="footnote" id="nota${i}-${k + 1}"><p><a href="#ref${i}-${k + 1}">${k + 1}.</a> ${x(t)}</p></aside>`).join('')}</section>`;
      const nombre = `cap${String(i + 1).padStart(3, '0')}.xhtml`;
      z.file('OEBPS/' + nombre, pagina(c.titulo, `<section epub:type="chapter">${h}</section>`));
      manifiesto.push(`<item id="c${i}" href="${nombre}" media-type="application/xhtml+xml"/>`); espina.push(`<itemref idref="c${i}"/>`); toc.push(`<li><a href="${nombre}">${x(c.titulo)}</a></li>`);
    });
    for (const [n, ext] of propias) { const id = n.replace(/\.[^.]+$/, ''); z.file(`OEBPS/img/${id}.${ext}`, recursos[n].split(',')[1], { base64: true }); manifiesto.push(`<item id="r${id.replace(/[^\w-]/g, '')}" href="img/${id}.${ext}" media-type="image/${ext === 'png' ? 'png' : 'jpeg'}"/>`); }
    for (const id of imagenes) { z.file(`OEBPS/img/${id}.png`, await aBytes(ARCHIVO.src(id))); manifiesto.push(`<item id="i${id}" href="img/${id}.png" media-type="image/png"/>`); }
    if (p.colofonActivo !== false) { const c = Libro.componer(p, {}); const m = c.html.match(/<section class="pre colofon">([\s\S]*?)<\/section>/); if (m) { z.file('OEBPS/colofon.xhtml', pagina('Colofón', `<section class="colofon">${m[1].replace(/<br>/g, '<br/>')}</section>`)); manifiesto.push('<item id="colofon" href="colofon.xhtml" media-type="application/xhtml+xml"/>'); espina.push('<itemref idref="colofon"/>'); } }
    z.file('OEBPS/nav.xhtml', pagina('Índice', `<nav epub:type="toc" id="toc"><h1>Índice</h1><ol>${toc.join('')}</ol></nav>`));
    manifiesto.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>', '<item id="css" href="estilo.css" media-type="text/css"/>');
    const poesia = p.tipo === 'poesia';
    z.file('OEBPS/estilo.css', `body{font-family:serif;line-height:1.5;margin:0 5%}h1{font-weight:normal;text-align:center;margin:2em 0 1.2em;font-size:1.6em}h2{font-weight:normal;text-align:center;font-size:1.2em}p{margin:0;text-indent:${poesia ? 0 : 1.2}em;text-align:${poesia ? 'left' : 'justify'}}h1+p,h2+p,.sep+p{text-indent:0}.estrofa{margin:0 0 1em}.v{text-indent:-1.5em;padding-left:1.5em;text-align:left}.sep{text-align:center;margin:1em 0;text-indent:0}blockquote{margin:1em 2em;font-size:.95em}figure{margin:1.2em 0;text-align:center}figure img{max-width:100%}figcaption{font-style:italic;font-size:.85em}.llamada{font-size:.7em;vertical-align:super;text-decoration:none}.notas{font-size:.85em;margin-top:2em}.notas p{text-indent:0}.titulo{text-align:center;margin-top:20%}.titulo .autor{text-indent:0;text-align:center}.titulo .sello{text-indent:0;text-align:center;margin-top:3em;font-variant:small-caps}.creditos{margin-top:30%;font-size:.8em}.creditos p{text-indent:0;text-align:left;margin:0 0 .5em}.dedicatoria,.colofon{margin-top:30%;text-align:right;font-style:italic}.colofon{text-align:center}.portada{text-align:center}.portada img{max-width:100%;max-height:100%}`);
    const fecha = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    z.file('OEBPS/content.opf', `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="es"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">${x(p.isbn ? 'urn:isbn:' + p.isbn.replace(/[^0-9X]/gi, '') : uid)}</dc:identifier><dc:title>${x(p.titulo || 'Sin título')}</dc:title><dc:creator>${x(p.autor)}</dc:creator><dc:language>es</dc:language>${p.sello ? `<dc:publisher>${x(p.sello)}</dc:publisher>` : ''}${p.sinopsis ? `<dc:description>${x(p.sinopsis)}</dc:description>` : ''}<dc:rights>${x(p.derechos)}</dc:rights><meta property="dcterms:modified">${fecha}</meta><meta name="cover" content="portada-img"/></metadata><manifest>${manifiesto.join('')}</manifest><spine>${espina.join('')}</spine></package>`);
    return z.generateAsync({ type: 'base64', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
  }
  async function exportar() {
    const p = Folio.p; if (!p.bloques.length) return App.aviso('No hay texto para el libro digital.');
    App.aviso('Armando el libro digital…', { ms: 2500 });
    const b64 = await generar(p, { recursos: Folio.recursos });
    const nombre = (p.titulo || 'libro').replace(/[\\/:*?"<>|]/g, '') + '.epub';
    if (window.Escritorio) { const r = await Escritorio.guardarArchivo(nombre, b64, [{ name: 'Libro digital EPUB', extensions: ['epub'] }]); if (r && !r.cancelado) App.aviso('Libro digital guardado.'); }
    else App.descargar(nombre, Uint8Array.from(atob(b64), c => c.charCodeAt(0)), 'application/epub+zip');
  }
  window.Epub = { generar, exportar };
})();
