// Folio · imposición y salidas de imprenta (pdf-lib, MIT)
// Encuadernaciones: caballete (cuadernillos cosidos), fresado (lomo pegado, cortar y apilar),
// fanzine (una hoja de 8 páginas), acordeón (tira continua), japonés (hojas dobladas por el borde, a una cara).
'use strict';
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');
const MM = 72 / 25.4;

const { plan } = require('./app/js/plan-imposicion.js');

async function imponer(bytes, { encuadernacion = 'caballete', pliego = 16, mmPagina }) {
  const src = await PDFDocument.load(bytes);
  const n = src.getPageCount();
  const [pw, ph] = [mmPagina[0] * MM, mmPagina[1] * MM];
  const out = await PDFDocument.create();
  const paginas = await out.embedPdf(src, src.getPageIndices());
  const P = plan(n, encuadernacion, pliego);
  const mapa = [];
  for (const h of P.hojas) {
    h.caras.forEach((cara, ci) => {
      const hoja = out.addPage([pw * h.cols, ph * h.filas]);
      cara.forEach((pos, j) => {
        const col = j % h.cols, fila = Math.floor(j / h.cols);
        const x = col * pw, y = (h.filas - 1 - fila) * ph;
        if (pos.p >= 1 && pos.p <= n) {
          if (pos.rot === 180) hoja.drawPage(paginas[pos.p - 1], { x: x + pw, y: y + ph, width: pw, height: ph, rotate: degrees(180) });
          else hoja.drawPage(paginas[pos.p - 1], { x, y, width: pw, height: ph });
        }
      });
      mapa.push({ etiqueta: h.etiqueta, cara: h.caras.length > 1 ? (ci ? 'dorso' : 'frente') : 'única', paginas: cara.map(x => (x.p >= 1 && x.p <= n ? x.p : null)), cuadernillo: h.cuadernillo, hoja: h.hoja, izquierda: cara[0] && cara[0].p <= n ? cara[0].p : null, derecha: cara[1] && cara[1].p <= n ? cara[1].p : null });
    });
  }
  return { bytes: await out.save(), mapa, blancas: P.total - n, instrucciones: P.instrucciones };
}

// numera ejemplares: repite el libro y estampa «Ejemplar n.º X de T» en la página indicada (por defecto, la última)
async function numerar(bytes, { desde = 1, hasta = 1, total, pagina = -1, texto = 'Ejemplar n.º {n} de {t}' }) {
  const src = await PDFDocument.load(bytes); const out = await PDFDocument.create();
  const fuente = await out.embedFont(StandardFonts.TimesRomanItalic);
  const n = src.getPageCount(), idx = pagina < 0 ? n + pagina : Math.min(n - 1, pagina);
  for (let e = desde; e <= hasta; e++) {
    const copia = await out.copyPages(src, src.getPageIndices());
    copia.forEach((pg, i) => {
      out.addPage(pg);
      if (i === idx) { const s = texto.replace('{n}', String(e).padStart(String(total || hasta).length, '0')).replace('{t}', total || hasta); const w = fuente.widthOfTextAtSize(s, 9); const { width } = pg.getSize(); pg.drawText(s, { x: (width - w) / 2, y: 22 * MM, size: 9, font: fuente, color: rgb(0, 0, 0) }); }
    });
  }
  return { bytes: await out.save(), ejemplares: hasta - desde + 1, paginasPorEjemplar: n };
}

// hoja de prueba para saber cómo meter el papel al imprimir a dos caras
async function pruebaDuplex(mmPagina) {
  const doc = await PDFDocument.create(); const f = await doc.embedFont(StandardFonts.HelveticaBold), fr = await doc.embedFont(StandardFonts.Helvetica);
  const W = mmPagina[0] * 2 * MM, H = mmPagina[1] * MM;
  const cara = (titulo, num, nota) => {
    const pg = doc.addPage([W, H]);
    pg.drawRectangle({ x: 10, y: 10, width: W - 20, height: H - 20, borderWidth: 1, borderColor: rgb(0, 0, 0) });
    pg.drawLine({ start: { x: W / 2, y: 10 }, end: { x: W / 2, y: H - 10 }, thickness: .5, dashArray: [4, 4] });
    pg.drawText(num, { x: W / 4 - 30, y: H / 2 - 30, size: 90, font: f });
    pg.drawText(num === '1' ? '2' : '1', { x: 3 * W / 4 - 30, y: H / 2 - 30, size: 90, font: f, color: rgb(.6, .6, .6) });
    pg.drawText(titulo, { x: 24, y: H - 40, size: 16, font: f });
    pg.drawText('^ ARRIBA', { x: W / 2 - 30, y: H - 30, size: 12, font: f });
    nota.forEach((l, i) => pg.drawText(l, { x: 24, y: 60 - i * 13, size: 9, font: fr }));
  };
  cara('CARA A (frente)', '1', ['Imprime esta hoja a dos caras con la misma configuracion que usaras para el libro.', 'Si al mirar el dorso a contraluz el 2 queda justo detras del 1 y la flecha ARRIBA coincide, la configuracion es correcta.']);
  cara('CARA B (dorso)', '2', ['Si el 2 quedo de cabeza: cambia "voltear por el lado largo" a "voltear por el lado corto" (o al reves).', 'Si quedo corrido de lado: tu impresora agrega margenes; imprime al 100 % y sin ajustar a la pagina.']);
  return { bytes: await doc.save() };
}

module.exports = { imponer, numerar, pruebaDuplex, plan };
