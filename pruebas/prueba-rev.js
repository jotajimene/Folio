const fs=require('fs');
global.importScripts=()=>{}; global.Herramientas={NSpell:require('../node_modules/nspell')};
global.fetch=async u=>({text:async()=>fs.readFileSync('app/vendor/'+u.split('/').pop(),'utf8')});
let out; global.postMessage=m=>out=m;
eval(fs.readFileSync('app/js/revision-trabajador.js','utf8'));
(async()=>{
 const t0=Date.now();
 await onmessage({data:{id:1,bloques:[
  {id:'a',tipo:'p',texto:'Esto  tiene espacios dobles y y una repeticion sin tilde. que pasa ahora... "Hola" dijo Inés en Valdivia.'},
  {id:'b',tipo:'p',texto:'- Aquí falta algo - dijo. Como estas?  El 50% de los perros , ladran.'},
 ],opciones:{}}});
 console.log(Date.now()-t0,'ms'); for(const o of out.obs) console.log(o.cat,'|',JSON.stringify(o.antes),'→',JSON.stringify(o.despues),o.alternativas||'');
})();
