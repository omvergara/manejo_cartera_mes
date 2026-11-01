// Prueba del asistente de configuracion (6 pasos) y de la tarjeta de pendientes de Mi mes,
// arrancando con localStorage VACIO (usuario nuevo).
//
// Uso:  node test/onboarding.mjs
// Requiere: Node 18+ y Chrome/Edge. Imprime OUT (aserciones legibles) y ERRS (debe ser 0).
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

const harness = `<script>
const ERRS=[];const OUT=[];const ALERTS=[];
window.onerror=(m,s,l)=>ERRS.push('onerror: '+m+' @'+l);
window.addEventListener('unhandledrejection',e=>ERRS.push('rejection: '+e.reason));
const _ce=console.error;console.error=(...a)=>{ERRS.push('console.error: '+a.join(' '));_ce(...a);};
window.alert=(m)=>ALERTS.push(m);
function A(l,c){if(c)OUT.push('PASA: '+l);else ERRS.push('FALLA: '+l);}
function T(l,fn){try{fn();OUT.push('ok: '+l);}catch(e){ERRS.push('THROW en '+l+': '+e.message);}}
const V=(id,v)=>{document.getElementById(id).value=v;};
const abierto=()=>document.getElementById('onboarding').classList.contains('open');
const paso=()=>document.getElementById('onb-paso').textContent;
const visible=n=>document.getElementById('onb-s'+n).style.display!=='none';

OUT.push('1) asistente abierto desde cero: '+abierto()+' · '+paso()+' · barra='+document.getElementById('onb-bar').style.width);
OUT.push('   boton next="'+document.getElementById('onb-next').textContent+'" · skip oculto en paso 1='+(document.getElementById('onb-skip').style.display==='none')+' · atras oculto='+(document.getElementById('onb-atras').style.visibility==='hidden'));

T('avanzar sin salario (debe frenar)',()=>{onbIr(1);});
OUT.push('2) freno sin salario: alert="'+(ALERTS[0]||'')+'" · sigue en '+paso()+' · cfg='+localStorage.getItem('app_cfg'));

T('paso 1: llenar perfil',()=>{V('onb-nombre','Mauricio');V('onb-neto','5000000');onbSetTipo('mensual');V('onb-dia','25');onbIr(1);});
OUT.push('3) tras paso 1: '+paso()+' · visible2='+visible(2)+' · cfg='+localStorage.getItem('app_cfg'));

T('paso 2: mes inicio',()=>{V('onb-ini-mes','5');V('onb-ini-anio','2026');onbIr(1);});
OUT.push('4) tras paso 2: '+paso()+' · cfg='+localStorage.getItem('app_cfg'));
OUT.push('   mes visible tras elegir inicio: '+curY+'-'+curM);

T('volver atras y regresar (no debe perder nada)',()=>{onbIr(-1);onbIr(1);});
OUT.push('5) ida y vuelta: '+paso()+' · inicioY='+gCfgApp().inicioY+' · inicioM='+gCfgApp().inicioM);

T('paso 3: gastos fijos + uno propio',()=>{onbGfAdd();onbGfRender();V('onb-gf-0','1200000');V('onb-gf-1','250000');V('onb-gfn-5','Gimnasio');V('onb-gf-5','90000');onbIr(1);});
const mesKey='app_2026_5';
OUT.push('6) gastos creados: '+JSON.parse(localStorage.getItem(mesKey)||'{"gastos":[]}').gastos.map(g=>g.name+'='+g.amount+(g.recurrente?'(rec)':'')).join(' | '));
OUT.push('   '+paso());

T('paso 4: tarjeta',()=>{V('onb-tc-nom','Visa');V('onb-tc-base','1500000');V('onb-tc-cuota','300000');V('onb-tc-tasa','2.3');onbIr(1);});
OUT.push('7) tarjetas: '+localStorage.getItem('app_tcs')+' · '+paso());

T('paso 5: saltar meta con Despues',()=>{onbIr(1,true);});
OUT.push('8) metas tras saltar: '+localStorage.getItem('app_metas')+' · '+paso());
OUT.push('   resumen visible: '+(document.getElementById('onb-resumen').innerHTML.length>0)+' · next="'+document.getElementById('onb-next').textContent+'"');
OUT.push('   resumen dice: '+document.getElementById('onb-resumen').textContent.replace(/\\s+/g,' ').slice(0,200));

T('terminar',()=>{onbIr(1);});
OUT.push('9) asistente cerrado: '+!abierto()+' · pantalla='+curScreen+' · mi mes pintado='+(document.getElementById('s-mes').innerHTML.length>0));
A('asistente cerrado y Mi mes pintado',!abierto()&&curScreen==='mes'&&document.getElementById('s-mes').innerHTML.length>0);

// ── TARJETA DE PENDIENTES ──
const ck=()=>document.getElementById('s-mes').innerHTML;
OUT.push('10) tarjeta pendientes visible: '+ck().includes('Termina de configurar'));
const cont=(s)=>ck().includes(s);
OUT.push('    lo ya hecho no ocupa espacio (perfil/inicio/gastos/tc ocultos): '+['Tu perfil y salario','Desde qué mes','Tus gastos del mes','Tarjetas de crédito'].map(t=>!cont(t)).join(','));
A('tarjeta de pendientes visible',ck().includes('Termina de configurar'));
A('lo hecho no se lista',['Tu perfil y salario','Tus gastos del mes','Tarjetas de crédito'].every(t=>!cont(t)));
OUT.push('    contador: '+((ck().match(new RegExp('>[0-9]/[0-9]<'))||[''])[0]));
T('no me aplica: cadena',()=>{onbSkipItem('cadena');});
OUT.push('11) tras "no me aplica" cadena: contador='+((ck().match(new RegExp('>[0-9]/[0-9]<'))||[''])[0])+' · sigue mostrando Cadena='+cont('Cadena / san')+' · app_onb='+localStorage.getItem('app_onb'));
T('completar metas desde la tarjeta',()=>{sMetas([{id:'m1',nombre:'Casa',icono:'🏡',total:0,meta:5000000}]);renderAll();});
OUT.push('12) metas ahora en verde: contador='+((ck().match(new RegExp('>[0-9]/[0-9]<'))||[''])[0]));
T('ocultar la tarjeta',()=>{onbHide();document.getElementById('cok').click();});
A('ocultar la tarjeta funciona',!ck().includes('Termina de configurar'));
OUT.push('13) tras ocultar: visible='+ck().includes('Termina de configurar')+' · app_onb='+localStorage.getItem('app_onb'));
T('reset hide y completar todo',()=>{sOnb({hide:false,skip:['cadena','prest','seg']});renderAll();});
OUT.push('14) con todo completo la tarjeta desaparece sola: '+!ck().includes('Termina de configurar'));
A('con todo completo desaparece',!ck().includes('Termina de configurar'));
A('el paso 2 ya no pregunta el modo de mes',!document.getElementById('onb-m-ant'));

const d=document.createElement('pre');d.id='TESTOUT';
d.textContent='=== OUT ===\\n'+OUT.join('\\n')+'\\n=== ALERTS ===\\n'+ALERTS.join(' | ')+'\\n=== ERRS ('+ERRS.length+') ===\\n'+ERRS.join('\\n');
document.body.appendChild(d);
</script>`;

try { new vm.Script(harness.replace(/^<script>/,'').replace(/<\/script>\s*$/,'')); }
catch(e){ console.log('HARNESS SYNTAX ERROR: '+e.message); process.exit(1); }

const dir = mkdtempSync(join(tmpdir(), 'cartera-onb-'));
const f = join(dir, 'onb.html');
writeFileSync(f, html.replace('</body>', harness + '</body>'), 'utf8');
const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!browser) { console.log('sin navegador'); process.exit(1); }
try {
  const dom = execFileSync(browser, ['--headless','--disable-gpu','--no-sandbox','--no-first-run',`--user-data-dir=${join(dir,'p')}`,'--virtual-time-budget=8000','--dump-dom','file:///'+f.replace(/\\/g,'/')], { encoding:'utf8', stdio:['ignore','pipe','ignore'], timeout:60000 });
  const m = dom.match(/<pre id="TESTOUT">([\s\S]*?)<\/pre>/);
  console.log(m ? m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'") : 'NO SE EJECUTO EL HARNESS');
} finally { rmSync(dir, {recursive:true, force:true}); }
