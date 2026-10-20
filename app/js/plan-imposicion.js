/* Folio · plan de imposición, compartido por la interfaz (vista de pliegos) y el proceso que arma el PDF */
(function (raiz) {
  'use strict';
// devuelve las hojas: cada una con su tamaño (en "páginas" de ancho y alto) y sus caras con posiciones
  function plan(n, enc, pliego) {
    const hojas = [];
    if (enc === 'fresado') { // 2 por cara; se corta la pila por la mitad y se pone la derecha bajo la izquierda
      const S = Math.ceil(n / 4);
      for (let k = 0; k < S; k++) hojas.push({ cols: 2, filas: 1, caras: [[2 * k + 1, 2 * S + 2 * k + 1], [2 * S + 2 * k + 2, 2 * k + 2]].map(c => c.map(p => ({ p }))), etiqueta: `Hoja ${k + 1}` });
      return { hojas, total: 4 * S, instrucciones: 'Imprime a dos caras volteando por el lado corto. Corta la pila entera por la mitad, pon la mitad derecha debajo de la izquierda, encola el lomo y pega la tapa.' };
    }
    if (enc === 'fanzine') { // 8 páginas por hoja; la fila de arriba va de cabeza
      const H = Math.ceil(n / 8);
      for (let h = 0; h < H; h++) { const b = h * 8; hojas.push({ cols: 4, filas: 2, caras: [[{ p: b + 5, rot: 180 }, { p: b + 4, rot: 180 }, { p: b + 3, rot: 180 }, { p: b + 2, rot: 180 }, { p: b + 6 }, { p: b + 7 }, { p: b + 8 }, { p: b + 1 }]], etiqueta: `Fanzine ${h + 1}` }); }
      return { hojas, total: 8 * H, instrucciones: 'Imprime a una cara. Dobla la hoja a lo largo, luego en cuatro; corta por el centro del pliegue largo, entre las dos páginas del medio, y dobla formando el librito.' };
    }
    if (enc === 'acordeon') { // tira continua: páginas seguidas, a una cara; se pegan las hojas por el borde
      const S = Math.ceil(n / 2);
      for (let k = 0; k < S; k++) hojas.push({ cols: 2, filas: 1, caras: [[{ p: 2 * k + 1 }, { p: 2 * k + 2 }]], etiqueta: `Tramo ${k + 1}` });
      return { hojas, total: 2 * S, instrucciones: 'Imprime a una cara. Une los tramos por el borde con cinta o cola en orden y pliega en zigzag por la línea entre páginas.' };
    }
    if (enc === 'japones') { // cada hoja se dobla por el borde exterior; se imprime a una cara
      const S = Math.ceil(n / 2);
      for (let k = 0; k < S; k++) hojas.push({ cols: 2, filas: 1, caras: [[{ p: 2 * k + 1 }, { p: 2 * k + 2 }]], etiqueta: `Hoja ${k + 1}` });
      return { hojas, total: 2 * S, instrucciones: 'Imprime a una cara. Dobla cada hoja por la mitad con lo impreso hacia afuera (el pliegue queda en el borde exterior), apila en orden y cose el lomo con puntadas a la japonesa.' };
    }
    // caballete por cuadernillos
    const t0 = pliego === 0 ? Math.ceil(n / 4) * 4 : pliego;
    for (let i = 0, g = 0; i < n; i += t0, g++) {
      const t = Math.ceil(Math.min(t0, n - i) / 4) * 4;
      for (let k = 0; k < t / 4; k++) hojas.push({ cols: 2, filas: 1, caras: [[i + t - 2 * k, i + 1 + 2 * k], [i + 2 + 2 * k, i + t - 1 - 2 * k]].map(c => c.map(p => ({ p }))), etiqueta: `Cuadernillo ${g + 1} · hoja ${k + 1}`, cuadernillo: g + 1, hoja: k + 1 });
    }
    const total = hojas.length * 4;
    return { hojas, total, instrucciones: 'Imprime a dos caras volteando por el lado corto. Dobla cada hoja por la mitad, anida las hojas de cada cuadernillo en orden y cose por el pliegue.' };
  }
  
  
  const ENCUADERNACIONES = { caballete: 'Cuadernillos cosidos (caballete)', fresado: 'Lomo pegado (cortar y apilar)', fanzine: 'Fanzine de una hoja (8 páginas)', acordeon: 'Acordeón', japones: 'Cosido japonés (a una cara)' };
  const api = { plan, ENCUADERNACIONES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.PlanImposicion = api;
})(typeof window !== 'undefined' ? window : globalThis);
