'use strict';
const { app } = require('electron'); const path=require('path'),fs=require('fs');
app.setPath('userData','/tmp/folio-dep'); require('../main.js');
let hecho=false;
app.on('browser-window-created',(_e,w)=>{ if(hecho)return; hecho=true; w.webContents.once('did-finish-load',async()=>{
  const js=c=>w.webContents.executeJavaScript(`(async()=>{${c}})()`);
  while(!(await js(`return document.documentElement.dataset.listo==='1'`))) await new Promise(r=>setTimeout(r,300));
  const code=fs.readFileSync(process.env.DEP,'utf8');
  try{ console.log('RESULTADO', JSON.stringify(await js(code),null,1)); }catch(e){console.log('ERR',e)}
  if(process.env.FOTO){const im=await w.webContents.capturePage(); fs.writeFileSync(process.env.FOTO,im.toPNG());}
  app.exit(0);
});});
