const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('Impresion', {
  alTrabajo: f => ipcRenderer.on('imprimir:trabajo', (_e, t) => f(t)),
  listo: info => ipcRenderer.send('imprimir:listo', info),
});
