/* Folio · etapa VII · Costo por ejemplar (cada cifra muestra de dónde sale) */
(function () {
  'use strict';
  const { esc, panel } = App;
  const CAMPOS = [['tirada', 'Ejemplares de la tirada', 'ancho'], ['papelHoja', 'Papel por hoja'], ['caraBN', 'Impresión por cara (B/N)'], ['cubierta', 'Cubierta impresa'], ['encuadernacion', 'Encuadernación por ejemplar'], ['preparacion', 'Gastos fijos de la tirada'], ['otros', 'Otros por ejemplar'], ['merma', 'Merma %'], ['margen', 'Margen sobre el precio %'], ['comision', 'Comisión de venta %']];

  function calcular(c, paginas, tirada = c.tirada) {
    const hojas = Math.ceil(paginas / 4), caras = hojas * 2, m = 1 + (c.merma || 0) / 100, t = Math.max(1, tirada);
    const partes = [
      ['Papel', `${hojas} hojas × ${App.dinero(c.papelHoja)} × ${t} × ${String(m).replace('.', ',')}`, hojas * c.papelHoja * t * m],
      ['Impresión', `${caras} caras × ${App.dinero(c.caraBN)} × ${t} × ${String(m).replace('.', ',')}`, caras * c.caraBN * t * m],
      ['Cubiertas', `${App.dinero(c.cubierta)} × ${t} × ${String(m).replace('.', ',')}`, c.cubierta * t * m],
      ['Encuadernación', `${App.dinero(c.encuadernacion)} × ${t}`, c.encuadernacion * t],
      ['Gastos fijos', 'una vez por tirada', +c.preparacion || 0],
      ['Otros', `${App.dinero(c.otros)} × ${t}`, (c.otros || 0) * t],
    ];
    const total = partes.reduce((a, x) => a + x[2], 0), unidad = total / t;
    const precio = unidad / Math.max(.05, 1 - (c.margen || 0) / 100 - (c.comision || 0) / 100);
    return { partes, total, unidad, precio, hojas, caras };
  }
  function curva(c, paginas) {
    const xs = [10, 20, 30, 50, 75, 100, 150, 200, 300, 500], W = 400, H = 260, x0 = 44, y0 = 228;
    const ys = xs.map(t => calcular(c, paginas, t).unidad), max = Math.max(...ys) * 1.05, min = 0;
    const X = t => x0 + (Math.log(t) - Math.log(10)) / (Math.log(500) - Math.log(10)) * (W - x0 - 14), Y = v => y0 - (v - min) / (max - min) * (y0 - 16);
    const d = xs.map((t, i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(ys[i]).toFixed(1)}`).join(' ');
    const actual = calcular(c, paginas);
    return `<svg viewBox="0 0 ${W} ${H}" class="curva" role="img" aria-label="Costo por ejemplar según la tirada">
      <path d="M${x0} ${y0} H${W - 6} M${x0} ${y0} V8" stroke="#1b1612" stroke-width="1.5" fill="none"/>
      <path d="${d}" stroke="#1b1612" stroke-width="3" fill="none"/>
      ${xs.map((t, i) => `<g class="pt" data-tirada="${t}"><circle cx="${X(t)}" cy="${Y(ys[i])}" r="9" fill="transparent"/><circle cx="${X(t)}" cy="${Y(ys[i])}" r="3" fill="#1b1612"/><text x="${X(t)}" y="${y0 + 16}" font-size="11" text-anchor="middle" font-family="Fell">${t}</text></g>`).join('')}
      <circle cx="${X(Math.min(500, Math.max(10, c.tirada)))}" cy="${Y(actual.unidad)}" r="6" fill="#a3321e"/>
      <text x="${Math.min(W - 120, X(Math.min(500, Math.max(10, c.tirada))) + 10)}" y="${Y(actual.unidad) - 10}" font-size="14" font-family="Fell">${c.tirada} ej. · ${App.dinero(actual.unidad)}</text>
      <text x="${x0 - 6}" y="16" font-size="11" text-anchor="end" font-family="Fell">${App.dinero(max)}</text></svg>`;
  }
  function render() {
    const p = Folio.p, c = p.costo, n = (p.composicion && p.composicion.paginas) || 0;
    const pags = n || 48, r = calcular(c, pags);
    return {
      cols: '300px 1fr 1fr',
      html: panel('supuestos', 'Supuestos', 'pesos chilenos', `<div class="campos">${CAMPOS.map(([k, t, cl]) => `<label class="campo ${cl || ''}"><span>${t}</span><input data-c="${k}" inputmode="decimal" value="${c[k]}"></label>`).join('')}</div><p class="nota">${n ? `Calculado con las ${n} páginas del interior compuesto.` : 'Aún no compones el interior: se calcula con 48 páginas de ejemplo.'} Pliegos de ${Folio.formatoMm()[0] * 2}×${Folio.formatoMm()[1]} mm.</p>`) +
        panel('resultado', 'Lo que cuesta', 'de dónde sale cada cifra', `<div class="cifras"><div class="grande"><span>Por ejemplar</span><b>${App.dinero(r.unidad)}</b></div><div><span>Tirada</span><b>${App.dinero(r.total)}</b></div><div><span>Precio orientativo</span><b>${App.dinero(r.precio)}</b></div></div><table class="cuentas">${r.partes.map(([a, s, v]) => `<tr><td>${a} <small>${esc(s)}</small></td><td>${App.dinero(v)}</td></tr>`).join('')}<tr class="total"><td>Total de la tirada</td><td>${App.dinero(r.total)}</td></tr></table><p class="nota">Precio orientativo = costo por ejemplar ÷ (1 − margen − comisión).</p>`) +
        panel('curva', 'Según la tirada', 'clic en un punto para fijarla', curva(c, pags), `<button class="boton" data-r="csv">Descargar la estimación (.csv)</button>`),
    };
  }
  function montar(m) {
    m.addEventListener('input', e => {
      const k = e.target.dataset.c; if (!k) return;
      const v = parseFloat(String(e.target.value).replace(/\./g, '').replace(',', '.'));
      if (!Number.isFinite(v) || v < 0) { e.target.classList.add('malo'); return; } e.target.classList.remove('malo');
      Folio.cambiar('costo:' + k, p => { p.costo[k] = k === 'tirada' ? Math.max(1, Math.round(v)) : v; }, { agrupar: true });
    });
    m.addEventListener('click', e => {
      const pt = e.target.closest('[data-tirada]'); if (pt) return Folio.cambiar('costo:curva', p => { p.costo.tirada = +pt.dataset.tirada; });
      const r = e.target.closest('[data-r="csv"]'); if (!r) return;
      const p = Folio.p, n = (p.composicion && p.composicion.paginas) || 48, x = calcular(p.costo, n);
      const filas = [['Concepto', 'Detalle', 'Monto'], ...x.partes.map(([a, s, v]) => [a, s, Math.round(v)]), ['Total tirada', '', Math.round(x.total)], ['Por ejemplar', '', Math.round(x.unidad)], ['Precio orientativo', '', Math.round(x.precio)]];
      App.descargar(`${p.titulo || 'libro'} · costo.csv`, '﻿' + filas.map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n'), 'text/csv');
    });
  }
  App.registrar({
    indice: 6, n: 'VII', nombre: 'Costo',
    estado: () => { const p = Folio.p; return App.dinero(calcular(p.costo, (p.composicion && p.composicion.paginas) || 48).unidad) + ' el ejemplar'; },
    render, montar, calcular,
    alCambiar(motivo) {
      if (/^costo:/.test(motivo) && motivo !== 'costo:curva') {
        const m = document.querySelector('.mesa'), viejo = document.activeElement && document.activeElement.dataset.c;
        const r = render(); const tmp = document.createElement('div'); tmp.innerHTML = r.html;
        for (const z of ['resultado', 'curva']) m.querySelector(`[data-zona="${z}"] .cuerpo`).innerHTML = tmp.querySelector(`[data-zona="${z}"] .cuerpo`).innerHTML;
        App.camino(); return false;
      }
    },
  });
})();
