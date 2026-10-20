const fs=require('fs');
global.importScripts=()=>{}; global.Herramientas={NSpell:require('../node_modules/nspell')};
global.fetch=async u=>({text:async()=>fs.readFileSync('app/vendor/'+u.split('/').pop(),'utf8')});
let out; global.postMessage=m=>out=m;
eval(fs.readFileSync('app/js/revision-trabajador.js','utf8'));
(async()=>{
 const t0=Date.now();
 const txt=['Pienso de que vendrá. Me alegro que estés. Sólo éste fué el día. Habían muchos perros detrás mío. La dije que no. Es más mejor así. En base a eso, subió arriba.',
 'Fue escrito por ella el 3 de Marzo. Tenía 3 perros y un nº 5. El show fue online. ¡¡Qué!! “Hola” dijo.',
 'Rápidamente y lentamente se fue. La ventana estaba abierta y la ventana miraba al mar. En realidad sí. En realidad no. En realidad tal vez. En realidad nunca.'];
 await onmessage({data:{id:1,bloques:txt.map((t,i)=>({id:'b'+i,tipo:'p',texto:t})),opciones:{}}});
 console.log(Date.now()-t0,'ms', out.error||'');
 for(const o of out.obs) console.log(o.capa,'|',o.regla,'|',JSON.stringify(o.antes),'→',JSON.stringify(o.despues));
})();
