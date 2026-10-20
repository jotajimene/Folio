/* Folio · ida y vuelta con un corrector humano
 * Exporta el manuscrito a Word con el control de cambios activado y marcas invisibles por párrafo.
 * Al traer el archivo corregido, cada cambio y cada comentario llega a Revisión como una propuesta.
 */
(function () {
  'use strict';
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const xe = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- exportar ----------
  function runs(b, notas) {
    const rs = b.runs && b.runs.length ? b.runs : [{ text: b.texto }]; let k = 0, out = '';
    for (const r of rs) {
      const pr = (r.italic ? '<w:i/>' : '') + (r.bold ? '<w:b/>' : '');
      const partes = r.text.split(/(\n|)/);
      for (const t of partes) {
        if (t === '\n') out += '<w:r><w:br/></w:r>';
        else if (t === '') { const n = (b.notas || [])[k++]; if (n != null) { notas.push(n); out += `<w:r><w:rPr><w:rStyle w:val="Llamada"/><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="${notas.length}"/></w:r>`; } }
        else if (t) out += `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${xe(t)}</w:t></w:r>`;
      }
    }
    return out;
  }
  async function exportar() {
    const p = Folio.p; if (!p.bloques.length) return App.aviso('No hay texto que enviar.');
    const b64 = await generar(p);
    const nombre = `${(p.titulo || 'manuscrito').replace(/[\\/:*?"<>|]/g, '')} · para corrección.docx`;
    if (window.Escritorio) { const r = await Escritorio.guardarArchivo(nombre, b64, [{ name: 'Word', extensions: ['docx'] }]); if (r && !r.cancelado) { Folio.cambiar('corrector:exportar', q => { q.correccionEnviada = { fecha: new Date().toISOString(), ruta: r.ruta }; }); App.aviso('Listo. El control de cambios va activado: lo que corrijan en Word vuelve como propuestas.', { ms: 7000 }); } }
    else App.descargar(nombre, Uint8Array.from(atob(b64), c => c.charCodeAt(0)), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }
  async function generar(p) {
    const notas = [];
    const estilo = { h1: 'Heading1', h2: 'Heading2', cita: 'Quote', verso: 'Verso' };
    const cuerpo = p.bloques.map((b, i) => `<w:p>${estilo[b.tipo] ? `<w:pPr><w:pStyle w:val="${estilo[b.tipo]}"/></w:pPr>` : ''}<w:bookmarkStart w:id="${i}" w:name="folio_${b.id}"/>${b.tipo === 'separador' ? '<w:r><w:t>⁂</w:t></w:r>' : runs(b, notas)}<w:bookmarkEnd w:id="${i}"/></w:p>`).join('');
    const z = new JSZip();
    z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/></Types>');
    z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    z.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/></Relationships>');
    z.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="${W}"><w:trackRevisions/><w:lang w:val="es-CL"/></w:settings>`);
    z.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/><w:lang w:val="es-CL"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:spacing w:before="480" w:after="240"/></w:pPr><w:rPr><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:i/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:pPr><w:ind w:left="720"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Verso"><w:name w:val="Verso"/><w:pPr><w:spacing w:after="240" w:line="276" w:lineRule="auto"/></w:pPr></w:style><w:style w:type="character" w:styleId="Llamada"><w:name w:val="Llamada de nota"/></w:style></w:styles>`);
    z.file('word/footnotes.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:footnotes xmlns:w="${W}"><w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>${notas.map((n, i) => `<w:footnote w:id="${i + 1}"><w:p><w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteRef/></w:r><w:r><w:t xml:space="preserve"> ${xe(n)}</w:t></w:r></w:p></w:footnote>`).join('')}</w:footnotes>`);
    z.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${cuerpo}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
    return z.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  }

  // ---------- importar ----------
  const hijos = (n, nombre) => [...n.childNodes].filter(c => c.localName === nombre);
  function leerParrafo(p, notasDoc) {
    // recorre en orden; devuelve texto original (sin inserciones), final (sin borrados), cambios y comentarios
    let orig = '', fin = '', cambios = [], abiertos = {}, rangos = [], marca = null;
    const deTexto = r => [...r.childNodes].map(c => c.localName === 't' || c.localName === 'delText' ? c.textContent : c.localName === 'tab' ? '\t' : c.localName === 'br' || c.localName === 'cr' ? '\n' : c.localName === 'footnoteReference' ? '' : '').join('');
    (function rec(n, modo, autor) {
      for (const c of n.childNodes) {
        const ln = c.localName;
        if (ln === 'bookmarkStart') { const nm = c.getAttributeNS(W, 'name') || ''; if (nm.startsWith('folio_')) marca = nm.slice(6); }
        else if (ln === 'ins') rec(c, 'ins', c.getAttributeNS(W, 'author'));
        else if (ln === 'del') rec(c, 'del', c.getAttributeNS(W, 'author'));
        else if (ln === 'commentRangeStart') abiertos[c.getAttributeNS(W, 'id')] = orig.length;
        else if (ln === 'commentRangeEnd') { const id = c.getAttributeNS(W, 'id'); if (id in abiertos) rangos.push({ id, ini: abiertos[id], fin: orig.length }); }
        else if (ln === 'r') {
          const t = deTexto(c); if (!t) continue;
          if (modo === 'ins') { cambios.push({ pos: orig.length, antes: '', despues: t, autor }); fin += t; }
          else if (modo === 'del') { cambios.push({ pos: orig.length, antes: t, despues: '', autor }); orig += t; }
          else { orig += t; fin += t; }
        } else if (ln === 'hyperlink' || ln === 'smartTag' || ln === 'sdt' || ln === 'sdtContent' || ln === 'fldSimple') rec(c, modo, autor);
      }
    })(p, null, null);
    // juntar borrado + inserción en el mismo punto = reemplazo
    const j = [];
    for (const c of cambios) { const u = j[j.length - 1]; if (u && u.despues === '' && c.antes === '' && c.pos === u.pos + u.antes.length) { u.despues = c.despues; } else if (u && u.pos + u.antes.length === c.pos && c.antes && !u.despues) { u.antes += c.antes; } else j.push({ ...c }); }
    return { marca, orig, fin, cambios: j, rangos };
  }
  function difSimple(a, b) {
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    let k = 0; while (k < a.length - i && k < b.length - i && a[a.length - 1 - k] === b[b.length - 1 - k]) k++;
    // extender a palabras completas para que la propuesta se lea bien
    while (i > 0 && /\p{L}/u.test(a[i - 1])) i--;
    while (k > 0 && /\p{L}/u.test(a[a.length - k])) k--;
    return { pos: i, antes: a.slice(i, a.length - k), despues: b.slice(i, b.length - k) };
  }
  async function importar(dado) {
    const archivo = dado || await new Promise(res => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.docx'; inp.onchange = () => res(inp.files[0] || null); inp.click(); });
    if (!archivo) return;
    const z = await JSZip.loadAsync(await archivo.arrayBuffer());
    const parse = async f => { const x = z.file(f); return x ? new DOMParser().parseFromString(await x.async('string'), 'application/xml') : null; };
    const doc = await parse('word/document.xml'); if (!doc) return App.aviso('Ese archivo no parece un Word.', { tipo: 'mal' });
    const comentarios = {}; const cx = await parse('word/comments.xml');
    if (cx) for (const c of cx.getElementsByTagNameNS(W, 'comment')) comentarios[c.getAttributeNS(W, 'id')] = { autor: c.getAttributeNS(W, 'author'), texto: [...c.getElementsByTagNameNS(W, 't')].map(t => t.textContent).join(' ').trim() };
    const B = Folio.p.bloques, porId = new Map(B.map(b => [b.id, b])), vistos = new Set();
    const ext = [], quien = new Set(); let previo = null, sinMarca = 0;
    const cuerpo = doc.getElementsByTagNameNS(W, 'body')[0];
    for (const p of hijos(cuerpo, 'p')) {
      const r = leerParrafo(p);
      const b = r.marca && porId.get(r.marca);
      if (!b) {
        // párrafo nuevo del corrector (o perdió la marca)
        const t = r.fin.trim(); if (t && previo) { sinMarca++; ext.push({ accion: 'nuevo-bloque', bloque: previo.id, inicio: previo.texto.length, fin: previo.texto.length, antes: '', despues: t, msg: 'El corrector agregó un párrafo nuevo después de este.', autor: (r.cambios[0] || {}).autor }); }
        continue;
      }
      vistos.add(b.id); previo = b;
      const base = b.texto;
      if (r.orig === base) {
        for (const c of r.cambios) { if (c.autor) quien.add(c.autor); ext.push({ bloque: b.id, inicio: c.pos, fin: c.pos + c.antes.length, antes: c.antes, despues: c.despues, msg: c.antes && c.despues ? 'Cambio del corrector.' : c.antes ? 'El corrector propone borrar.' : 'El corrector propone agregar.', autor: c.autor }); }
        // cambios hechos sin control de cambios
        const sinControl = r.cambios.length ? null : (r.fin !== base ? difSimple(base, r.fin) : null);
        if (sinControl && (sinControl.antes || sinControl.despues)) ext.push({ bloque: b.id, inicio: sinControl.pos, fin: sinControl.pos + sinControl.antes.length, antes: sinControl.antes, despues: sinControl.despues, msg: 'Cambio hecho sin control de cambios.' });
      } else if (r.fin !== base) {
        const d = difSimple(base, r.fin); ext.push({ bloque: b.id, inicio: d.pos, fin: d.pos + d.antes.length, antes: d.antes, despues: d.despues, msg: 'El texto cambió también aquí desde que lo enviaste: revisa con cuidado.' });
      }
      for (const g of r.rangos) { const c = comentarios[g.id]; if (!c) continue; if (c.autor) quien.add(c.autor); ext.push({ bloque: b.id, inicio: Math.min(g.ini, base.length), fin: Math.min(g.fin, base.length), antes: base.slice(g.ini, g.fin), despues: null, msg: c.texto || 'Comentario.', comentario: true, autor: c.autor }); }
    }
    for (const b of B) if (!vistos.has(b.id) && b.texto.trim()) ext.push({ accion: 'eliminar-bloque', bloque: b.id, inicio: 0, fin: Math.min(60, b.texto.length), antes: b.texto.slice(0, 60), despues: '', msg: 'El corrector quitó este párrafo.' });
    if (!ext.length) return App.aviso('No encontré cambios ni comentarios en ese archivo.');
    const etiqueta = 'Corrección' + (quien.size ? ' · ' + [...quien].join(', ') : '');
    Folio.cambiar('revision:externas', p => {
      p.revision.externas = [...(p.revision.externas || []), ...ext.map((o, k) => ({ ...o, id: 'ext:' + Date.now().toString(36) + ':' + k, clave: 'ext:' + Date.now().toString(36) + ':' + k, cat: etiqueta, capa: 'corrector', regla: o.comentario ? 'comentario' : 'corrector', nota: o.autor ? 'De ' + o.autor + '.' : '' }))];
    });
    App.aviso(`${ext.length} propuestas del corrector llegaron a Revisión.`, { ms: 6000 });
    App.ir(1, { forzar: true });
  }
  window.Corrector = { exportar, generar, importar, leerParrafo, difSimple };
})();
