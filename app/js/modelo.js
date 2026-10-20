/* Folio · modelo del proyecto, colecciones, historial y guardado */
(function () {
  'use strict';
  const uid = () => Math.random().toString(36).slice(2, 9);

  // ---- tipografías disponibles (todas incorporadas, licencias en fuentes/) ----
  const FUENTES = {
    FPalatino: 'P052 · Palatino', FRoman: 'Nimbus Roman', FBookman: 'URW Bookman', FSchool: 'C059 · Schoolbook',
    FModern: 'Latin Modern Roman', FDeja: 'DejaVu Serif', FSans: 'Nimbus Sans', FGothic: 'URW Gothic',
    FNarrow: 'Nimbus Sans Narrow', FMono: 'Nimbus Mono', Fell: 'IM Fell English', Fraktur: 'UnifrakturMaguntia',
  };

  // ---- colecciones: cada una es un sistema completo (interior + cubierta) ----
  // generador: cómo se construye la imagen de cubierta. paletas: [fondo, tinta, acento]
  const COLECCIONES = [
    { id: 'bestiario', nombre: 'Bestiario', lema: 'Tinta y criaturas', texto: 'Fell', titulos: 'Fell', generador: 'grabado',
      descripcion: 'Un grabado del archivo, centrado y grande, sobre papel, con doble filete. La línea clásica.', paletas: [['#efe6d2', '#1b1612', '#a3321e'], ['#e9dfc6', '#2b2118', '#6b5a2e'], ['#1b1612', '#efe6d2', '#c9a24a']] },
    { id: 'teselario', nombre: 'Teselario', lema: 'Patrones que se repiten', texto: 'FPalatino', titulos: 'FGothic', generador: 'teselacion',
      descripcion: 'Un fragmento de grabado hecho caleidoscopio: ocho espejos que lo vuelven tapiz. Título en una franja lisa.', paletas: [['#e7dcc4', '#2c3a4f', '#e7dcc4'], ['#d9c7a3', '#5a2a1e', '#f1e8d5'], ['#f2ece0', '#3d5a3a', '#f2ece0'], ['#c8d3c6', '#1c1c1c', '#f4efe6']] },
    { id: 'archivo', nombre: 'Archivo', lema: 'Memoria en semitono', texto: 'FRoman', titulos: 'FMono', generador: 'foto',
      descripcion: 'Una fotografía tuya (o un grabado) en semitono a dos tintas que corre por toda la tapa, con datos como ficha.', paletas: [['#e8e4da', '#1d1d1b', '#d2462a'], ['#f0ead8', '#1f3a5f', '#f0ead8'], ['#e3e0d6', '#3a2e2a', '#c79a2b']] },
    { id: 'umbral', nombre: 'Umbral', lema: 'Color plano y recorte', texto: 'FPalatino', titulos: 'FSans', generador: 'umbral',
      descripcion: 'Formas planas recortadas, pocos colores saturados y tipografía grande; a veces un grabado metido en una de las formas.', paletas: [['#f2c14e', '#1d3557', '#e63946'], ['#e9e3d5', '#e2532d', '#24345c'], ['#9ad1c7', '#1f2a44', '#f25c3b'], ['#f4a3b4', '#2a2a72', '#ffd23f'], ['#1f2a44', '#f2c14e', '#e2532d']] },
    { id: 'friso', nombre: 'Friso', lema: 'Ornamento en bandas', texto: 'FBookman', titulos: 'FBookman', generador: 'cenefas',
      descripcion: 'Una figura del archivo repetida en bandas arriba y abajo; el título en el centro, sereno.', paletas: [['#efe6d2', '#1b1612', '#7a1f12'], ['#e6ecea', '#1b2a33', '#1b2a33'], ['#f1e4d0', '#4a2c1a', '#a46a2a']] },
    { id: 'fragmento', nombre: 'Fragmento', lema: 'Lo mínimo, ampliado', texto: 'FModern', titulos: 'FNarrow', generador: 'detalle',
      descripcion: 'Un detalle de un grabado ampliado a sangre, como visto con lupa. Tú eliges el encuadre.', paletas: [['#f0e9db', '#1b1612', '#1b1612'], ['#dfe7e2', '#253a33', '#253a33'], ['#f1dfd0', '#5c1f14', '#5c1f14']] },
    { id: 'herbario', nombre: 'Herbario', lema: 'Láminas botánicas', texto: 'FSchool', titulos: 'FPalatino', generador: 'reticula',
      descripcion: 'Una retícula de nueve hierbas del archivo, como lámina de herbario.', paletas: [['#efe6d2', '#33402c', '#8a3b22'], ['#f2efe6', '#1b1612', '#2f5a7a'], ['#e7ddc8', '#3b2a1e', '#3b2a1e']] },
    { id: 'eco', nombre: 'Eco', lema: 'La palabra como textura', texto: 'FMono', titulos: 'FMono', generador: 'texto',
      descripcion: 'El título repetido hasta volverse textura. Puramente tipográfica.', paletas: [['#f1efe8', '#1b1612', '#e2532d'], ['#1b1612', '#d9d4c7', '#e2532d'], ['#e8f0e9', '#1d4d3a', '#1d4d3a']] },
    { id: 'constelacion', nombre: 'Constelación', lema: 'Mapas de letras', texto: 'FSans', titulos: 'FNarrow', generador: 'puntos',
      descripcion: 'Una constelación generada desde las letras del título: puntos y trazos.', paletas: [['#1c2433', '#efe6d2', '#f2c14e'], ['#f2ede3', '#1b1612', '#a3321e'], ['#24345c', '#f3eee4', '#e2532d']] },
  ];
  // biblioteca de paletas que sirve para cualquier colección: [fondo, tinta, acento]
  const PALETAS = [
    ['Papel y hollín', '#efe6d2', '#1b1612', '#a3321e'], ['Pergamino', '#e9dfc6', '#3b2a1e', '#8a3b22'], ['Noche y oro', '#1b1612', '#efe6d2', '#c9a24a'],
    ['Índigo', '#e7e4da', '#24345c', '#d2462a'], ['Prusia', '#f0ead8', '#1f3a5f', '#e2a33d'], ['Bosque', '#eef0e6', '#2f4a32', '#b5542e'],
    ['Musgo', '#d8dcc5', '#33402c', '#f2efe6'], ['Terracota', '#f1e4d0', '#5c1f14', '#d28a3c'], ['Ladrillo', '#e8d2c0', '#7a1f12', '#1b1612'],
    ['Mostaza', '#f2c14e', '#1d3557', '#e63946'], ['Tomate', '#e2532d', '#f3eee4', '#1f2a44'], ['Menta', '#9ad1c7', '#1f2a44', '#f25c3b'],
    ['Rosa chicle', '#f4a3b4', '#2a2a72', '#ffd23f'], ['Lavanda', '#d9d1ea', '#3c2a63', '#e2532d'], ['Cielo', '#cfe3ef', '#14324a', '#f2c14e'],
    ['Limón', '#f4ee8b', '#1b1612', '#2f6f5e'], ['Mar profundo', '#173f4f', '#e8f0e9', '#f2a541'], ['Ciruela', '#3d1f3a', '#f1e4d0', '#e8a33d'],
    ['Grafito', '#2b2b2b', '#e8e4da', '#d2462a'], ['Ceniza', '#d7d5cf', '#2b2b2b', '#2b2b2b'], ['Hueso', '#f4efe6', '#4a4036', '#4a4036'],
    ['Óxido', '#c8673a', '#1b1612', '#f1e4d0'], ['Turquesa', '#1d7874', '#f3eee4', '#f2c14e'], ['Arcilla', '#dcc7b0', '#4a2c1a', '#2c3a4f'],
  ];
  const TIPOS_LIBRO = {
    narrativa: { nombre: 'Narrativa', alineacion: 'justify', sangria: 1.2, entreParrafos: 0, verso: false },
    poesia: { nombre: 'Poesía', alineacion: 'left', sangria: 0, entreParrafos: 8, verso: true },
    ensayo: { nombre: 'Ensayo', alineacion: 'justify', sangria: 0, entreParrafos: 6, verso: false },
    ilustrado: { nombre: 'Ilustrado o fotolibro', alineacion: 'left', sangria: 0, entreParrafos: 6, verso: false },
    librojuego: { nombre: 'Librojuego', alineacion: 'justify', sangria: 1.2, entreParrafos: 0, verso: false },
  };
  const FORMATOS = { A5: [148, 210], A6: [105, 148], '13×20': [130, 200], '15×23': [150, 230], '17×24': [170, 240] };
  // límites únicos de cada ajuste: los usa la interfaz y la composición (nunca se normalizan en otro sitio)
  const LIMITES = {
    cuerpo: [8, 16, 0.5, 'pt'], interlineado: [1.1, 2, 0.05, ''], margenInterior: [10, 35, 1, 'mm'], margenExterior: [8, 30, 1, 'mm'],
    margenSuperior: [8, 30, 1, 'mm'], margenInferior: [10, 35, 1, 'mm'], sangria: [0, 3, 0.1, 'em'], entreParrafos: [0, 18, 1, 'pt'],
    tituloCuerpo: [14, 40, 1, 'pt'], aireTitulo: [0, 80, 2, 'mm'], espaciado: [-0.05, 0.1, 0.005, 'em'],
  };
  const limitar = (k, v) => { const l = LIMITES[k]; if (!l) return v; v = +v; if (Number.isNaN(v)) v = l[0]; return Math.min(l[1], Math.max(l[0], Math.round(v / l[2]) * l[2])); };

  function nuevo() {
    return {
      version: 2, id: uid(), creado: new Date().toISOString(),
      titulo: '', subtitulo: '', autor: '', sello: '', ciudad: '', anio: String(new Date().getFullYear()), edicion: 'Primera edición',
      isbn: '', derechos: 'Todos los derechos reservados.', correccion: '', diseno: '', imprenta: '', dedicatoria: '', epigrafe: '', epigrafeAutor: '', colofon: '',
      indice: true, indicePos: 'final', colofonActivo: true, contracubierta: '', sinopsis: '', composicion: null,
      bloques: [], original: [], origen: null,
      revision: { decididas: [], ignorar: [], diccionario: [] },
      coleccion: 'bestiario', numero: '01', tipo: 'narrativa', formato: 'A5',
      ajustes: { cuerpo: 11, interlineado: 1.45, margenInterior: 20, margenExterior: 16, margenSuperior: 18, margenInferior: 22, sangria: 1.2, entreParrafos: 0, alineacion: 'justify', tituloCuerpo: 22, aireTitulo: 40, espaciado: 0, capituloDerecha: true, saltoCapitulo: 'derecha', cabeceras: true, guionado: true, capitular: true, fuenteTexto: null, fuenteTitulos: null },
      ilustraciones: [],
      cubierta: { semilla: 1, paleta: 0, colores: null, imagen: null, foto: null, escalaTitulo: 1, solapas: false, recorte: null },
      impresion: { pliego: 16, papelGramaje: 80, grosorHoja: 0.1 },
      costo: { tirada: 50, papelHoja: 45, caraBN: 35, caraColor: 180, cubierta: 650, encuadernacion: 700, preparacion: 15000, otros: 0, merma: 8, margen: 40, comision: 0, recargo: 0 },
      historial: [],
    };
  }

  function normalizar(p) {
    const base = nuevo();
    p = Object.assign(base, p || {});
    p.ajustes = Object.assign(nuevo().ajustes, p.ajustes || {});
    for (const k of Object.keys(LIMITES)) if (k in p.ajustes) p.ajustes[k] = limitar(k, p.ajustes[k]);
    p.revision = Object.assign({ decididas: [], ignorar: [], diccionario: [] }, p.revision || {});
    p.cubierta = Object.assign(nuevo().cubierta, p.cubierta || {});
    p.impresion = Object.assign(nuevo().impresion, p.impresion || {});
    p.costo = Object.assign(nuevo().costo, p.costo || {});
    p.bloques = (p.bloques || []).map(b => { const { kind, text, ...resto } = b; return { ...resto, id: b.id || uid(), tipo: b.tipo || ({ h1: 'h1', h2: 'h2', poem: 'verso', p: 'p' }[kind] || 'p'), texto: b.texto ?? text ?? '', runs: b.runs || null }; });
    if (!p.original || !p.original.length) p.original = p.bloques.map(b => ({ ...b }));
    if (!COLECCIONES.find(c => c.id === p.coleccion)) p.coleccion = 'bestiario';
    return p;
  }

  // ---- estado global con historial ----
  const oyentes = new Set();
  const Folio = {
    COLECCIONES, PALETAS, FUENTES, TIPOS_LIBRO, FORMATOS, LIMITES, limitar, uid,
    p: normalizar(null), ruta: null, recursos: {}, originales: {}, guardadoDisco: null, guardadoAuto: null, sucio: false,
    deshacer: [], rehacer: [],
    al(f) { oyentes.add(f); return () => oyentes.delete(f); },
    avisar(motivo) { for (const f of oyentes) try { f(motivo); } catch (e) { console.error(e); } },
    coleccion() { return COLECCIONES.find(c => c.id === Folio.p.coleccion) || COLECCIONES[0]; },
    formatoMm() { return FORMATOS[Folio.p.formato] || FORMATOS.A5; },
    // todo cambio pasa por aquí: guarda una instantánea para deshacer
    cambiar(etiqueta, f, { silencioso = false, agrupar = false, sinHistorial = false } = {}) {
      const u = Folio.deshacer[Folio.deshacer.length - 1], ahora = Date.now();
      if (!sinHistorial && !(agrupar && u && u.etiqueta === etiqueta && ahora - u.t < 2500)) Folio.deshacer.push({ etiqueta, antes: JSON.stringify(Folio.p), t: ahora });
      else if (u && agrupar) u.t = ahora;
      if (Folio.deshacer.length > 80) Folio.deshacer.shift();
      if (!sinHistorial) Folio.rehacer = [];
      f(Folio.p);
      Folio.sucio = true; programarAutoguardado();
      if (!silencioso) Folio.avisar(etiqueta);
    },
    deshacerUltimo() {
      const u = Folio.deshacer.pop(); if (!u) return null;
      Folio.rehacer.push({ etiqueta: u.etiqueta, antes: JSON.stringify(Folio.p) });
      Folio.p = JSON.parse(u.antes); Folio.sucio = true; programarAutoguardado(); Folio.avisar('deshacer'); return u.etiqueta;
    },
    rehacerUltimo() {
      const u = Folio.rehacer.pop(); if (!u) return null;
      Folio.deshacer.push({ etiqueta: u.etiqueta, antes: JSON.stringify(Folio.p) });
      Folio.p = JSON.parse(u.antes); Folio.sucio = true; programarAutoguardado(); Folio.avisar('rehacer'); return u.etiqueta;
    },
    cargar(p, ruta = null, recursos = {}, originales = {}) { Folio.p = normalizar(p); Folio.ruta = ruta; Folio.recursos = recursos || {}; Folio.originales = originales || {}; Folio.deshacer = []; Folio.rehacer = []; Folio.sucio = false; Folio.avisar('cargar'); },
    nuevoProyecto() { const p = normalizar(null); if (window.Perfil) Perfil.aplicar(p); Folio.cargar(p); },
    async guardar(como = false) {
      if (!window.Escritorio) { descargarJSON(); return { ruta: 'descarga' }; }
      const r = await Escritorio.guardarProyecto(Folio.ruta, { proyecto: Folio.p, recursos: soloB64(Folio.recursos), originales: Folio.originales }, como);
      if (r && !r.cancelado) { Folio.ruta = r.ruta; Folio.guardadoDisco = new Date(); Folio.sucio = false; Folio.avisar('guardado'); }
      return r;
    },
    async abrir() {
      if (!window.Escritorio) return null;
      const r = await Escritorio.abrirProyecto();
      if (!r || r.cancelado) return r;
      Folio.cargar(r.datos.proyecto, r.ruta, conPrefijo(r.datos.recursos || {}), r.datos.originales || {}); Folio.guardadoDisco = new Date();
      return r;
    },
  };

  let tAuto = null;
  function programarAutoguardado() {
    clearTimeout(tAuto);
    tAuto = setTimeout(async () => {
      try {
        if (window.Escritorio) await Escritorio.autoguardar({ proyecto: Folio.p, ruta: Folio.ruta, recursos: Folio.recursos });
        else localStorage.setItem('folio-autoguardado', JSON.stringify({ proyecto: Folio.p }));
        Folio.guardadoAuto = new Date(); Folio.avisar('autoguardado');
      } catch (e) { Folio.avisar('autoguardado-error'); console.error(e); }
    }, 1200);
  }
  // los recursos viven en memoria como data URL; en el .folio se guardan como archivos
  function soloB64(r) { const o = {}; for (const [k, v] of Object.entries(r || {})) o[k] = String(v).replace(/^data:[^,]*,/, ''); return o; }
  function conPrefijo(r) { const o = {}; for (const [k, v] of Object.entries(r || {})) { const ext = k.split('.').pop().toLowerCase(); const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }[ext] || 'application/octet-stream'; o[k] = 'data:' + mime + ';base64,' + v; } return o; }
  Folio.programarAutoguardado = () => programarAutoguardado();
  function descargarJSON() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(Folio.p)], { type: 'application/json' }));
    a.download = (Folio.p.titulo || 'libro') + '.folio.json'; a.click();
  }

  // ---- edición de texto conservando cursivas y negritas ----
  Folio.texto = {
    // reemplaza [inicio, fin) del bloque por 'nuevo', respetando los tramos con formato
    reemplazar(b, inicio, fin, nuevo) {
      if (b.runs && b.runs.length) {
        let pos = 0; const runs = [];
        for (const r of b.runs) {
          const a = pos, z = pos + r.text.length; pos = z;
          if (z <= inicio || a >= fin) { runs.push({ ...r }); continue; }
          const izq = r.text.slice(0, Math.max(0, inicio - a)), der = r.text.slice(Math.max(0, fin - a));
          const insertar = a <= inicio && inicio <= z && !runs.some(x => x._ins) ? nuevo : '';
          runs.push({ ...r, text: izq + insertar + der, _ins: !!insertar || undefined });
        }
        b.runs = runs.map(({ _ins, ...r }) => r).filter(r => r.text);
        b.texto = b.runs.map(r => r.text).join('');
      } else b.texto = b.texto.slice(0, inicio) + nuevo + b.texto.slice(fin);
      return b;
    },
    dividir(p, idx, pos) {
      const b = p.bloques[idx], n = b.texto.length;
      const a = { ...b, texto: b.texto.slice(0, pos).replace(/\s+$/, ''), runs: b.runs ? cortarRuns(b.runs, 0, pos) : null };
      const c = { id: uid(), tipo: b.tipo, texto: b.texto.slice(pos).replace(/^\s+/, ''), runs: b.runs ? cortarRuns(b.runs, pos, n) : null };
      if (c.runs && c.runs.length) c.runs[0].text = c.runs[0].text.replace(/^\s+/, '');
      p.bloques.splice(idx, 1, a, c);
    },
    unir(p, idx) {
      const a = p.bloques[idx], b = p.bloques[idx + 1]; if (!b) return;
      const sep = /\s$/.test(a.texto) ? '' : ' ';
      if (a.runs || b.runs) a.runs = [...(a.runs || [{ text: a.texto }]), { text: sep }, ...(b.runs || [{ text: b.texto }])];
      a.texto = a.texto + sep + b.texto; p.bloques.splice(idx + 1, 1);
    },
  };
  function cortarRuns(runs, i0, i1) { let pos = 0; const out = []; for (const r of runs) { const a = pos, z = pos + r.text.length; pos = z; const s = Math.max(a, i0), e = Math.min(z, i1); if (e > s) out.push({ ...r, text: r.text.slice(s - a, e - a) }); } return out; }

  window.Folio = Folio;
})();
