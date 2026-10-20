/* Folio · bestiario vivo (segunda versión)
 *
 * Tres maneras de habitar la pantalla:
 *   mirones  · viven DETRÁS de los paneles y se asoman por su canto superior.
 *              Su cuerpo (y el suelo del grabado) queda oculto por el panel.
 *              Se giran hacia el cursor, inclinan la cabeza, se esconden si
 *              te acercas y vuelven a asomar en otro lugar.
 *   cabezas  · gigantes que suben desde el borde inferior de la ventana y te
 *              siguen con la mirada (pupilas que se mueven donde hay ojos).
 *   libres   · animales sin suelo que recorren la pantalla de lado a lado:
 *              reptan por el margen inferior, saltan sobre los paneles, nadan
 *              ondulando, una mariposa vuela por la franja alta.
 * Ninguno entra en las zonas de trabajo: los mirones quedan tapados por los
 * paneles y los libres circulan solo por la franja alta y el margen inferior.
 *
 * window.BESTIARIO = [{id, src, w, h, rol, mira:'L'|'R'|'F', mov, ojos, ojoR, ficha}]
 */
(function () {
  'use strict';
  const fondo = document.querySelector('.bestiario-fondo');
  const frente = document.querySelector('.bestiario');
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const R = el => el.getBoundingClientRect();
  const azar = (a, b) => a + Math.random() * (b - a);
  const baraja = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const suave = (a, b, k) => a + (b - a) * k;
  let vivos = [], raf = 0, cursor = { x: innerWidth / 2, y: innerHeight / 2, t: 0 }, generacion = 0;

  function geometria() {
    const paneles = [...document.querySelectorAll('[data-zona]')].filter(p => p.offsetParent).map(R);
    const cen = R(document.querySelector('.cenefa'));
    const techo = cen.bottom + 2;
    const tope = Math.min(...paneles.map(p => p.top));
    const fondoPan = Math.max(...paneles.map(p => p.bottom));
    const demo = document.querySelector('.demo');
    return { paneles, techo, franja: tope - techo, fondoPan, suelo: innerHeight - 6, demo: demo && demo.offsetParent ? R(demo) : null };
  }

  // ---------- elementos ----------
  function figura(fig, capa, h) {
    const el = document.createElement('div');
    el.className = 'criatura';
    const w = h * fig.w / fig.h;
    el.style.width = w + 'px'; el.style.height = h + 'px';
    const img = new Image(); img.src = fig.src; img.alt = ''; img.draggable = false; img.title = fig.ficha || '';
    el.appendChild(img);
    let pupilas = null;
    if (fig.ojos) {
      pupilas = fig.ojos.map(([x, y]) => {
        const r = fig.ojoR * w;
        const blanco = document.createElement('i'); blanco.className = 'ojo';
        blanco.style.cssText = `left:${x * w - r * 1.25}px;top:${y * h - r * 1.05}px;width:${r * 2.5}px;height:${r * 2.1}px`;
        const p = document.createElement('b'); p.style.width = p.style.height = r * 1.25 + 'px';
        blanco.appendChild(p); el.appendChild(blanco);
        return { p, cx: x * w, cy: y * h, r };
      });
    }
    capa.appendChild(el);
    return { el, img, w, h, pupilas };
  }

  // ---------- mirones ----------
  function crearMiron(fig, panel, x, h, g) {
    const f = figura(fig, fondo, h);
    const borde = panel.top + 2;                     // donde el panel lo tapa
    const asoma = Math.min(g.franja - 8, h * azar(0.45, 0.62));
    const v = { tipo: 'miron', fig, ...f, x, base: borde, asoma, oculto: h, sube: 0, dir: fig.mira === 'L' ? -1 : 1, mira: fig.mira, inc: 0, panel, espera: azar(0, 1.2), timidez: 0 };
    v.el.style.left = x + 'px';
    return v;
  }
  function crearCabeza(fig, x, w, g) {
    const h = w * fig.h / fig.w;
    const f = figura(fig, fondo, h);
    const asoma = Math.min(g.suelo - g.fondoPan + 30, h * azar(0.32, 0.42));
    const v = { tipo: 'cabeza', fig, ...f, x, base: innerHeight + 2, asoma, sube: 0, dir: fig.mira === 'L' ? -1 : 1, mira: fig.mira, inc: 0, espera: azar(0.6, 2.2), timidez: 0 };
    v.el.style.left = x + 'px';
    return v;
  }

  // ---------- libres ----------
  function crearLibre(fig, g, carril) {
    const h = carril.alto * azar(0.55, 1);
    const f = figura(fig, frente, h);
    const ida = Math.random() < .5 ? 1 : -1;
    const x = ida > 0 ? -f.w - azar(0, 400) : innerWidth + azar(0, 400);
    const vel = fig.mov === 'vuela' ? azar(1.2, 2) : fig.mov === 'salta' ? azar(1.4, 2.2) : fig.mov === 'nada' ? azar(0.5, 0.9) : azar(0.35, 0.8);
    return { tipo: 'libre', fig, ...f, x, y: carril.y - h, carril, ida, vel, fase: Math.random() * 6.3, pausa: 0, mira: fig.mira, dir: 1, huye: 0, gy: 0 };
  }

  function poblar() {
    cancelAnimationFrame(raf); generacion++;
    fondo.replaceChildren(); frente.replaceChildren(); vivos = [];
    const g = geometria(); if (!isFinite(g.franja)) return Promise.resolve({ vivos: 0 });
    const cat = window.BESTIARIO;
    const mirones = baraja(cat.filter(c => c.rol === 'miron'));
    const cabezas = baraja(cat.filter(c => c.rol === 'cabeza'));
    const libres = baraja(cat.filter(c => c.rol === 'libre'));
    // mirones: uno o dos por panel, alturas muy distintas
    for (const p of g.paneles) {
      const n = p.width > 500 ? (Math.random() < .5 ? 2 : 3) : (Math.random() < .7 ? 1 : 2);
      const usados = [];
      for (let i = 0; i < n && mirones.length; i++) {
        const fig = mirones.pop();
        const h = Math.min(g.franja * 2.6, azar(70, g.franja * 2.4)) * (Math.random() < .25 ? 0.55 : 1);
        const w = h * fig.w / fig.h;
        let x, ok = false;
        for (let t = 0; t < 20 && !ok; t++) { x = azar(p.left + 6, p.right - w - 6); ok = usados.every(u => x + w < u[0] - 10 || x > u[1] + 10); }
        if (!ok) continue;
        usados.push([x, x + w]);
        vivos.push(crearMiron(fig, p, x, h, g));
      }
    }
    // cabezas gigantes: una o dos desde el borde inferior
    const nc = Math.random() < .55 ? 1 : 2, puestas = [];
    for (let i = 0; i < nc && cabezas.length; i++) {
      const fig = cabezas.pop(); const w = azar(260, 480) * Math.min(1, innerWidth / 1400);
      let x, ok = false;
      for (let t = 0; t < 20 && !ok; t++) { x = azar(120, innerWidth - w - 40); ok = puestas.every(u => x + w < u[0] - 40 || x > u[1] + 40) && (!g.demo || x > g.demo.right + 20); }
      if (!ok) continue; puestas.push([x, x + w]);
      vivos.push(crearCabeza(fig, x, w, g));
    }
    // libres: carriles en la franja alta (sobre los paneles) y en el margen inferior
    const carriles = [
      { y: Math.min(...g.paneles.map(p => p.top)) + 3, alto: Math.min(54, g.franja * 0.62), nombre: 'alto' },
      { y: g.suelo, alto: Math.min(46, g.suelo - g.fondoPan - 10), nombre: 'bajo' },
    ];
    const nl = 3 + ((Math.random() * 3) | 0);
    for (let i = 0; i < nl && libres.length; i++) {
      const fig = libres.pop();
      const carril = fig.mov === 'vuela' || fig.mov === 'salta' ? carriles[0] : fig.mov === 'nada' ? carriles[1] : carriles[Math.random() < .5 ? 0 : 1];
      if (carril.alto < 18) continue;
      vivos.push(crearLibre(fig, g, carril));
    }
    const gen = generacion;
    return Promise.all(vivos.map(v => v.img.decode().catch(() => {}))).then(() => {
      if (gen !== generacion) return { vivos: 0 };
      vivos.forEach((v, i) => { if (v.tipo !== 'libre') v.espera += i * 0.12; });
      if (quieto) { vivos.forEach(v => { v.sube = 1; }); pintarTodo(); }
      else { let t0 = performance.now(); const paso = t => { raf = requestAnimationFrame(paso); const dt = Math.min(0.05, (t - t0) / 1000); t0 = t; tick(dt, t / 1000); }; raf = requestAnimationFrame(paso); }
      return { vivos: vivos.length };
    });
  }

  // ---------- comportamiento ----------
  function apuntar(v, cx, cy) {
    // hacia dónde mira la figura según el cursor
    const dx = cursor.x - cx, dy = cursor.y - cy, d = Math.hypot(dx, dy) || 1;
    return { dx, dy, d, ux: dx / d, uy: dy / d };
  }
  function ojos(v, cx0, cy0) {
    if (!v.pupilas) return;
    for (const o of v.pupilas) {
      const r = v.el.getBoundingClientRect ? null : null;
      const gx = v.x + (v.dir < 0 ? v.w - o.cx : o.cx), gy = (v.top || 0) + o.cy;
      const a = apuntar(v, gx, gy); const lim = o.r * 0.55;
      const k = Math.min(1, a.d / 220);
      let px = a.ux * lim * k, py = a.uy * lim * k * 0.7;
      if (v.dir < 0) px = -px;
      o.p.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px)) scaleY(${v.cierre ?? 1})`;
    }
  }
  // ---------- repertorio de acciones ----------
  // cada criatura sortea qué hacer y cuándo; ninguna acción entra en las zonas de trabajo
  const ACCIONES_MIRON = ['asomarse', 'mirar-alrededor', 'tiritar', 'estirarse', 'saludar', 'saltito', 'pasear', 'agacharse', 'inclinarse'];
  const ACCIONES_CABEZA = ['bostezo', 'mirar-alrededor', 'hundirse', 'inclinarse', 'asomarse'];
  function sortearAccion(v, t) {
    const lista = v.tipo === 'cabeza' ? ACCIONES_CABEZA : ACCIONES_MIRON;
    const a = lista[(Math.random() * lista.length) | 0];
    const dur = { asomarse: azar(2, 4), 'mirar-alrededor': 2.4, tiritar: 1, estirarse: 2.2, saludar: 1.4, saltito: .7, pasear: azar(2.5, 5), agacharse: 1.6, inclinarse: 2, bostezo: 2.4, hundirse: 3 }[a] || 2;
    v.accion = { a, t0: t, dur, dx: a === 'pasear' && v.panel ? azar(v.panel.left + 6, Math.max(v.panel.left + 6, v.panel.right - v.w - 6)) : 0, x0: v.x };
    v.proxima = t + dur + azar(2.5, 8);
  }
  const campana = u => Math.sin(Math.PI * Math.max(0, Math.min(1, u)));
  function efecto(v, t) {
    const out = { sube: 0, rot: 0, sy: 1, y: 0, flip: 0 };
    const ac = v.accion; if (!ac) return out;
    const u = (t - ac.t0) / ac.dur;
    if (u >= 1) { if (ac.a === 'pasear') v.x = ac.dx; v.accion = null; return out; }
    switch (ac.a) {
      case 'asomarse': out.sube = .35 * campana(u); break;
      case 'mirar-alrededor': out.flip = u < .3 ? 0 : u < .62 ? 1 : 0; break;
      case 'tiritar': out.rot = Math.sin(t * 60) * 2.2 * campana(u); break;
      case 'estirarse': out.sy = 1 + .12 * campana(u); break;
      case 'saludar': out.rot = Math.sin(u * Math.PI * 6) * 9 * campana(u); break;
      case 'saltito': out.y = -Math.sin(Math.PI * u) * 16; out.sy = 1 + (u < .15 ? -.1 : u > .85 ? -.08 : .05); break;
      case 'agacharse': out.sube = -.6 * campana(u * 1.4); break;
      case 'inclinarse': out.rot = 12 * campana(u) * (v.dir || 1); break;
      case 'bostezo': out.sy = 1 + .08 * campana(u); out.rot = -4 * campana(u); break;
      case 'hundirse': out.sube = -.75 * campana(u); break;
      case 'pasear': { const k = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; v.x = ac.x0 + (ac.dx - ac.x0) * k; v.el.style.left = v.x + 'px'; out.y = -Math.abs(Math.sin(t * 9)) * 3; v.dir = (ac.dx >= ac.x0 ? 1 : -1) * (v.mira === 'L' ? -1 : 1); break; }
    }
    return out;
  }
  let quietoDesde = performance.now() / 1000, sustos = [];
  addEventListener('pointerdown', e => {
    // un clic cerca asusta: los que están al lado saltan o se esconden
    for (const v of vivos) {
      const r = v.el.getBoundingClientRect(); const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      if (d < Math.max(140, r.width)) { v.susto = 1; if (v.tipo === 'libre') { v.huye = 2.2; v.ida = e.clientX < r.left + r.width / 2 ? 1 : -1; } }
    }
  }, { passive: true });

  function tick(dt, t) {
    const g = geometria(), cerca = Date.now() - cursor.t < 4000, dormido = (Date.now() - cursor.t) > 25000;
    for (const v of vivos) {
      v.susto = Math.max(0, (v.susto || 0) - dt * 1.6);
      if (v.tipo === 'miron' || v.tipo === 'cabeza') {
        v.espera -= dt;
        if (v.proxima == null) v.proxima = t + azar(1, 6);
        if (!v.accion && t > v.proxima && v.espera <= 0 && !dormido) sortearAccion(v, t);
        const ef = efecto(v, t);
        const cx = v.x + v.w / 2, cy = v.base - v.asoma * v.sube + v.h * 0.18;
        const a = apuntar(v, cx, cy);
        // curiosidad: si el cursor se queda quieto cerca, se asoma un poco más
        const curioso = cerca && a.d < 260 && (Date.now() - cursor.t) > 1200 ? .18 : 0;
        let objetivo = v.espera > 0 ? 0 : (a.d < Math.max(90, v.w * 0.55) && v.tipo === 'miron' && (Date.now() - cursor.t) < 900 ? 0.25 : 1);
        if (dormido) objetivo = v.tipo === 'cabeza' ? .7 : .55;
        if (v.susto > .2) objetivo = v.tipo === 'cabeza' ? .3 : 0;
        objetivo = Math.max(0, objetivo + ef.sube + (objetivo > .5 ? curioso : 0));
        v.sube = suave(v.sube, objetivo, Math.min(1, dt * (objetivo < v.sube ? 7 : 1.6)));
        if (v.mira !== 'F' && cerca && !(v.accion && v.accion.a === 'pasear')) {
          const quiere = (a.dx >= 0 ? 1 : -1) * (v.mira === 'L' ? -1 : 1);
          if (quiere !== v.dir) { v.giro = (v.giro || 0) + dt; if (v.giro > 0.6) { v.dir = -v.dir; v.giro = 0; v.salto = 1; } } else v.giro = 0;
        }
        const incl = dormido ? 7 * (v.dir || 1) : cerca ? Math.max(-6, Math.min(6, a.dx / 90)) * (v.tipo === 'cabeza' ? 0.6 : 1) : Math.sin(t * 0.6 + v.x) * 1.2;
        v.inc = suave(v.inc, incl, Math.min(1, dt * 3));
        v.salto = Math.max(0, (v.salto || 0) - dt * 4);
        const resp = Math.sin(t * (dormido ? .7 : 1.3) + v.x * 0.01) * (v.tipo === 'cabeza' ? 3 : 1.5);
        v.top = v.base - v.asoma * v.sube + resp - Math.sin(v.salto * Math.PI) * 6 + ef.y - (v.susto > .5 ? 10 * Math.sin(v.susto * Math.PI) : 0);
        v.el.style.top = v.top + 'px';
        const dir = ef.flip ? -v.dir : v.dir;
        v.el.style.transform = `scaleX(${dir}) rotate(${(v.inc + ef.rot) * dir}deg) scaleY(${ef.sy})`;
        ojos(v);
        parpadeo(v, t, dormido);
        if (v.tipo === 'miron' && !v.accion && v.espera < -azar(14, 40) && Math.random() < dt * 0.15) { v.espera = azar(1.2, 3); v.x = azar(v.panel.left + 6, Math.max(v.panel.left + 6, v.panel.right - v.w - 6)); setTimeout(() => { v.el.style.left = v.x + 'px'; }, 500); }
      } else {
        // libres: cruzan la pantalla, se detienen, se encuentran, huyen
        const c = v.carril;
        const a = apuntar(v, v.x + v.w / 2, v.y + v.h / 2);
        if (a.d < 110 && !v.huye) { v.huye = 1.4; v.ida = a.dx > 0 ? -1 : 1; }
        v.huye = Math.max(0, v.huye - dt);
        if (v.pausa > 0) v.pausa -= dt; else if (Math.random() < dt * 0.08 && v.fig.mov !== 'vuela') v.pausa = azar(1, 3);
        // encuentro con otro del mismo carril: se miran, saltan y se van cada uno por su lado
        if (!v.encuentro && !v.huye) for (const o of vivos) if (o !== v && o.tipo === 'libre' && o.carril === c && !o.encuentro && Math.abs((o.x + o.w / 2) - (v.x + v.w / 2)) < (o.w + v.w) / 2 + 6 && o.ida !== v.ida) { v.encuentro = o.encuentro = 1.6; v.mirarA = o; o.mirarA = v; }
        if (v.encuentro) { v.encuentro -= dt; if (v.encuentro <= 0) { v.encuentro = 0; v.ida = -v.ida; v.mirarA = null; } }
        const parado = (v.pausa > 0 || v.encuentro > 0) && !v.huye;
        if (dormido && v.fig.mov === 'repta') v.pausa = Math.max(v.pausa, .5);
        const vel = parado ? 0 : v.vel * (v.huye ? 3.2 : 1);
        v.x += vel * v.ida * 60 * dt; v.fase += vel * dt * 9;
        let haciaDonde = v.ida;
        if (v.encuentro && v.mirarA) haciaDonde = v.mirarA.x > v.x ? 1 : -1;
        else if (parado && cerca) haciaDonde = a.dx >= 0 ? 1 : -1;
        v.dir = haciaDonde * (v.mira === 'L' ? -1 : 1);
        let y = c.y - v.h, rot = 0, sy = 1;
        if (v.encuentro) { const u = 1.6 - v.encuentro; y -= Math.abs(Math.sin(u * 7)) * 8; }
        if (v.fig.mov === 'repta') { y -= Math.abs(Math.sin(v.fase)) * Math.min(3, v.h * .06) * (vel ? 1 : 0); rot = Math.sin(v.fase) * 2 * (vel ? 1 : 0); if (!vel) sy = 1 + Math.sin(t * 1.4 + v.x) * .02; }
        if (v.fig.mov === 'nada') { y -= 4 + Math.sin(v.fase * 0.6) * 5; rot = Math.cos(v.fase * 0.6) * 6; }
        if (v.fig.mov === 'salta') { const s = Math.abs(Math.sin(v.fase * 0.5)); y -= s * Math.min(g.franja - v.h - 4, 34); rot = (s - .5) * 8; sy = s < .08 ? .9 : 1; }
        if (v.fig.mov === 'vuela') {
          y = c.y - v.h - 8 - (Math.sin(v.fase * 0.3) * 0.5 + 0.5) * Math.max(0, g.franja - v.h - 20); rot = Math.sin(v.fase * 2.4) * 10; sy = 0.75 + 0.25 * Math.abs(Math.sin(v.fase * 3));
          // de vez en cuando, una vuelta en el aire
          if (!v.rizo && Math.random() < dt * .05) v.rizo = 1; if (v.rizo) { v.rizo = Math.max(0, v.rizo - dt * .9); rot += (1 - v.rizo) * 360; }
        }
        if (v.susto > .3) y -= Math.sin(v.susto * Math.PI) * 14;
        v.y = y;
        v.el.style.left = v.x + 'px'; v.el.style.top = y + 'px';
        v.el.style.transform = `scaleX(${v.dir}) rotate(${rot}deg) scaleY(${sy})`;
        if ((v.ida > 0 && v.x > innerWidth + 40) || (v.ida < 0 && v.x < -v.w - 40)) {
          v.ida = -v.ida; v.x = v.ida > 0 ? -v.w - azar(200, 900) : innerWidth + azar(200, 900);
        }
      }
    }
  }
  // parpadeo: las pupilas se cierran un instante (y casi del todo si duerme)
  function parpadeo(v, t, dormido) {
    if (!v.pupilas) return;
    if (v.parpado == null || t > v.parpado + 6) v.parpado = t + azar(2, 6);
    const u = t - v.parpado, cerrado = dormido ? .15 : (u > 0 && u < .16 ? Math.abs(Math.cos(u / .16 * Math.PI)) : 1);
    v.cierre = Math.max(.08, cerrado);
  }
  function pintarTodo() {
    for (const v of vivos) {
      if (v.tipo === 'libre') { v.x = azar(0, innerWidth - v.w); v.el.style.left = v.x + 'px'; v.el.style.top = (v.carril.y - v.h) + 'px'; v.el.style.transform = `scaleX(${v.mira === 'L' ? -1 : 1})`; }
      else { v.top = v.base - v.asoma; v.el.style.top = v.top + 'px'; v.el.style.transform = `scaleX(${v.dir})`; }
    }
  }

  addEventListener('pointermove', e => { cursor.x = e.clientX; cursor.y = e.clientY; cursor.t = Date.now(); }, { passive: true });
  let tr; addEventListener('resize', () => { clearTimeout(tr); tr = setTimeout(poblar, 250); });

  // comprobación: los libres (capa frontal) no pueden tocar zonas de trabajo
  function zonas() {
    return [...document.querySelectorAll('.mesa .bloque, .mesa button, .mesa input, .mesa li, .mesa p, .mesa h2, .rotulo, .camino, .cab .boton, .demo')]
      .filter(e => e.offsetParent).map(e => ({ e, r: R(e) }));
  }
  function choques(v, Z) {
    if (v.tipo !== 'libre') return 0;
    const r = { left: v.x, top: v.y, right: v.x + v.w, bottom: v.y + v.h };
    return Z.filter(z => r.left < z.r.right && r.right > z.r.left && r.top < z.r.bottom && r.bottom > z.r.top && !(z.e.classList && z.e.classList.contains('demo'))).length;
  }
  window.Bestiario = { poblar, vivos: () => vivos, zonas, choques };
})();
