/* Folio · perfil de la editorial: se guarda una vez y vale para todos los libros */
(function () {
  'use strict';
  const BASE = { sello: '', ciudad: '', logo: null, derechos: 'Todos los derechos reservados.', colofon: '', correccion: '', diseno: '', imprenta: '', paletas: [], numeros: {}, fuentes: [], diccionario: [] };
  const Perfil = {
    datos: { ...BASE },
    async cargar() {
      let d = null;
      try { d = window.Escritorio ? await Escritorio.perfil() : JSON.parse(localStorage.getItem('folio-perfil') || 'null'); } catch (e) { console.error(e); }
      Perfil.datos = Object.assign({ ...BASE }, d || {});
      return Perfil.datos;
    },
    async guardar() {
      try { if (window.Escritorio) await Escritorio.guardarPerfil(Perfil.datos); else localStorage.setItem('folio-perfil', JSON.stringify(Perfil.datos)); } catch (e) { console.error(e); }
    },
    // número siguiente dentro de una colección (01, 02…)
    siguiente(col) { return String((Perfil.datos.numeros[col] || 0) + 1).padStart(2, '0'); },
    async registrarNumero(col, num) { const n = parseInt(num, 10); if (n > (Perfil.datos.numeros[col] || 0)) { Perfil.datos.numeros[col] = n; await Perfil.guardar(); } },
    // datos del perfil en un proyecto nuevo (solo llena lo que está vacío)
    aplicar(p) {
      const d = Perfil.datos;
      for (const k of ['sello', 'ciudad', 'derechos', 'correccion', 'diseno', 'imprenta']) if (!p[k] && d[k]) p[k] = d[k];
      if (!p.colofon && d.colofon) p.colofon = d.colofon;
      if (!p.numeroAsignado) { p.numero = Perfil.siguiente(p.coleccion); p.numeroAsignado = true; }
      return p;
    },
  };
  window.Perfil = Perfil;
})();
