// Prueba funcional: siembra un escenario realista (cartera desde junio 2026) y ejercita
// pantallas, modales, navegacion, swipe y los derivados de la cadena en Chrome headless,
// capturando cualquier error de JS.
//
// Uso:  node test/funcional.mjs
// Requiere: Node 18+ y Chrome/Edge. Imprime OUT (aserciones legibles) y ERRS (debe ser 0).
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

const seed = `<script>
try{
 const S=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
 S('app_cfg',{nombre:'Mau',neto:5000000,tipoNomina:'mensual',nominaDia:25,modoMes:'anticipado',inicioY:2026,inicioM:5});
 // mes fantasma anterior al inicio (enero) -> debe quedar oculto/en 0
 S('app_2026_0',{gastos:[]});
 S('app_2026_5',{gastos:[
   {id:'g1',name:'Arriendo',amount:1200000,cat:'Vivienda',paid:true,recurrente:true},
   {id:'g2',name:'Servicios',amount:250000,cat:'Servicios',paid:false,recurrente:true},
   {id:'gman',name:'Cadena',amount:300000,cat:'Ahorro',paid:true},
   {id:'g_hormiga',name:'Gastos hormiga',amount:14000,cat:'Otros',paid:true,hormiga:true,hcount:3,hitems:[{desc:'Tinto',monto:3000,fecha:'2026-06-02'},{desc:'Bus',monto:6000,fecha:'2026-06-02'},{desc:'Empanada',monto:5000}]}
 ]});
 S('app_2026_6',{gastos:[{id:'g3',name:'Arriendo',amount:1200000,cat:'Vivienda',paid:false,recurrente:true}],neto:3200000,netoManual:true,netoNota:'Entre el 10, mes incompleto'});
 S('app_inc_2026_5',[{id:'i1',desc:'Freelance',monto:400000,cat:'Trabajo adicional'}]);
 S('app_ccfg',{v:2,cadenas:[{id:'cadA',nombre:'Cadena oficina',valorCuota:150000,frecuencia:'quincenal',dias:[5,20],diaPago:25,puestosGrupo:12,salenPorPeriodo:2,mesInicio:5,anioInicio:2026,posiciones:[{id:'pA',tipo:'propio',miSplit:1,conQuien:'',turnoMes:3,montoPozo:0},{id:'pB',tipo:'compartido',miSplit:0.5,conQuien:'Ana',turnoMes:5,montoPozo:0}]}]});
 S('app_prestamos',[{id:'pr1',persona:'Hermano',capital:1000000,meses:5,interes:1,mesIni:5,anioIni:2026,cuotas:{}},{id:'pr2',persona:'Legacy',capital:600000,meses:3,interes:0,cuotas:{'1':{paid:true,y:2026,m:5,incId:'x1',monto:200000}}}]);
 S('app_metas',[{id:'mm',nombre:'Casa',icono:'🏡',total:500000,meta:20000000}]);
 S('app_tcs',[{id:'tc1',nombre:'Visa',base:800000,cuota:200000,tasa:2.2}]);
}catch(e){}
</script>`;

const harness = `<script>
const ERRS=[];const OUT=[];
window.onerror=(m,s,l,c,e)=>{ERRS.push('onerror: '+m+' @'+l);};
window.addEventListener('unhandledrejection',e=>ERRS.push('rejection: '+e.reason));
const _ce=console.error;console.error=(...a)=>{ERRS.push('console.error: '+a.join(' '));_ce(...a);};
window.alert=(m)=>OUT.push('ALERT: '+m);
function T(label,fn){try{fn();OUT.push('ok: '+label);}catch(e){ERRS.push('THROW en '+label+': '+e.message);}}
function has(id){const el=document.getElementById(id);return el&&el.innerHTML.length>0;}

// Mes visible = julio 2026 (mes "actual" simulado por la app es la fecha real del sistema,
// asi que forzamos curY/curM y renderizamos a mano).
T('inicio jul',()=>{curY=2026;curM=6;curScreen='inicio';renderAll();});
T('gastos jul',()=>{goTo('gastos');});
OUT.push('gastos tiene boton recurrentes: '+/Cargar \\d+ gasto/.test(document.getElementById('s-gastos').innerHTML));
OUT.push('gastos muestra nota manual: '+document.getElementById('s-gastos').innerHTML.includes('Ingreso base editado'));
T('openMesNeto',()=>{openMesNeto();});
OUT.push('mi-neto value='+document.getElementById('mi-neto').value);
T('closeMesNeto',()=>closeOv('ov-mesing'));
T('cargarRecurrentes+confirm',()=>{cargarRecurrentes();document.getElementById('cok').click();});
OUT.push('julio gastos ahora: '+JSON.parse(localStorage.getItem('app_2026_6')).gastos.map(g=>g.name).join('|'));
T('junio hormiga detalle',()=>{curY=2026;curM=5;renderAll();openHormigaDet();});
OUT.push('hdet sub='+document.getElementById('hdet-sub').textContent);
OUT.push('hdet body tiene fechas: '+document.getElementById('hdet-body').innerHTML.includes('jun'));
OUT.push('hdet body tiene sin fecha: '+document.getElementById('hdet-body').innerHTML.includes('sin fecha'));
T('borrar item hormiga',()=>{hdelItem(0);document.getElementById('cok').click();});
OUT.push('hormiga tras borrar: '+JSON.stringify((JSON.parse(localStorage.getItem('app_2026_5')).gastos.find(g=>g.id==='g_hormiga')||{}).amount));
T('cerrar hdet',()=>closeOv('ov-hdet'));

// CADENA: junio 2026 = mes 1 (vigente), mayo 2026 = fuera de rango
T('cobros jun',()=>{goTo('cadena');});
OUT.push('jun cadena filas marcables: '+getCPagos().length);
OUT.push('jun timeline puestos: '+/puestos 1–2/.test(document.getElementById('s-cadena').innerHTML));
OUT.push('jun otro integrante: '+document.getElementById('s-cadena').innerHTML.includes('otro integrante'));
T('cobros may (fuera de rango)',()=>{curY=2026;curM=4;renderAll();});
OUT.push('may cadena filas marcables: '+getCPagos().length+' (debe ser 0)');
OUT.push('may muestra aviso arranque: '+document.getElementById('s-cadena').innerHTML.includes('Arranca en'));
T('prestamos may',()=>{setCobTab('prestamos');});
OUT.push('may prestamo oculto: '+document.getElementById('s-cadena').innerHTML.includes('todavía no existía'));
T('prestamos jun',()=>{curY=2026;curM=5;renderAll();});
const pj=document.getElementById('s-cadena').innerHTML;
OUT.push('jun prestamo cuota1 este mes: '+pj.includes('Este mes'));
OUT.push('jun cuotas futuras bloqueadas: '+(pj.match(/cursor:default/g)||[]).length);
T('config prestamo',()=>{openPrestConf();});
OUT.push('pr-body tiene mes prestado: '+document.getElementById('pr-body').innerHTML.includes('En qué mes prestaste'));
T('guardar prestamo',()=>{savePrestConf();});
OUT.push('pr2 legacy inicio: '+JSON.stringify((gPrestamos().find(p=>p.id==='pr2')||{})));

// NAVEGACION: piso = junio 2026
T('nav abajo tope',()=>{curY=2026;curM=5;curScreen='inicio';renderAll();changeMonth(-1);});
OUT.push('tras retroceder desde junio: '+curY+'-'+curM+' (debe ser 2026-5)');
T('nav futuro x3',()=>{curY=2026;curM=6;changeMonth(1);changeMonth(1);changeMonth(1);});
OUT.push('tope futuro alcanzado: '+curY+'-'+curM);
T('NETOm antes de inicio',()=>{});
OUT.push('NETOm may 2026 = '+NETOm(2026,4)+' (debe 0) · NETOm jul = '+NETOm(2026,6));
T('analisis',()=>{curY=2026;curM=6;goTo('mas');});
OUT.push('analisis sin enero: '+!/Ene/.test(document.getElementById('s-mas').innerHTML));
T('ajustes',()=>goTo('ajustes'));
OUT.push('ajustes muestra desde: '+/desde Junio 2026/.test(document.getElementById('s-ajustes').innerHTML));
T('config modal',()=>openCfgModal());
OUT.push('cfg ini mes select='+document.getElementById('cfg-ini-mes').value+' anio='+document.getElementById('cfg-ini-anio').value);
T('guardar cfg',()=>saveCfg());
OUT.push('cfg guardada: '+localStorage.getItem('app_cfg'));

// SWIPE: simula un arrastre horizontal y uno vertical sobre la pantalla de gastos
function swipe(dx,dy){
  const el=document.getElementById('s-gastos');
  const mk=(type,x,y)=>{const t=new Touch({identifier:1,target:el,clientX:x,clientY:y});
    return new TouchEvent(type,{touches:type==='touchend'?[]:[t],changedTouches:[t],bubbles:true,cancelable:true});};
  el.dispatchEvent(mk('touchstart',200,300));
  el.dispatchEvent(mk('touchend',200+dx,300+dy));
}
T('swipe izq (mes+1)',()=>{curY=2026;curM=5;goTo('gastos');swipe(-140,10);});
OUT.push('tras swipe izq: '+curY+'-'+curM+' (esperado 2026-6)');
T('swipe der (mes-1)',()=>{swipe(140,5);});
OUT.push('tras swipe der: '+curY+'-'+curM+' (esperado 2026-5)');
T('swipe vertical (no cambia)',()=>{swipe(20,180);});
OUT.push('tras swipe vertical: '+curY+'-'+curM+' (esperado 2026-5)');
T('swipe con modal abierto (no cambia)',()=>{openOv('ov-mesing');swipe(-140,0);closeOv('ov-mesing');});
OUT.push('tras swipe con modal: '+curY+'-'+curM+' (esperado 2026-5)');

// ── CADENA <-> CAJA ────────────────────────────────────────
_swipeUntil=0;// los tests de swipe corren antes: sin esto, el guardian se come el primer click de aqui
const gJun=()=>JSON.parse(localStorage.getItem('app_2026_5')).gastos;
const iJun=()=>JSON.parse(localStorage.getItem('app_inc_2026_5')||'[]');
T('junio limpio',()=>{curY=2026;curM=5;curScreen='gastos';renderAll();});
OUT.push('A) gasto cadena antes de marcar: '+JSON.stringify(gJun().filter(g=>g.id.indexOf('g_cad_')===0)));
const k1=getCPagos()[0].key,k2=getCPagos()[1].key;
T('marcar aporte 1',()=>{tCadena(k1);});
OUT.push('B) tras marcar 1: '+JSON.stringify(gJun().filter(g=>g.id.indexOf('g_cad_')===0).map(g=>[g.name,g.amount,g.paid,g.cat])));
OUT.push('B2) aviso anti-duplicado abierto: '+document.getElementById('ov-confirm').classList.contains('open')+' · texto="'+document.getElementById('ct').textContent+'" · boton="'+document.getElementById('cok').textContent+'"');
T('aceptar borrar el gasto manual',()=>{document.getElementById('cok').click();});
OUT.push('B3) gastos de junio tras aceptar: '+gJun().map(g=>g.name+'='+g.amount).join(' | '));
T('marcar aporte 2',()=>{tCadena(k2);});
OUT.push('C) tras marcar 2 (debe sumar): '+JSON.stringify(gJun().filter(g=>g.id.indexOf('g_cad_')===0).map(g=>[g.name,g.amount])));
OUT.push('   calcT comprometido='+calcT().tc+' pagado='+calcT().paid);
OUT.push('   fila no editable (lleva a Cobros): '+document.getElementById('s-gastos').innerHTML.includes("goTo(&quot;cadena&quot;)")+'/'+document.getElementById('s-gastos').innerHTML.includes("goTo('cadena')"));
T('desmarcar los dos',()=>{tCadena(k1);tCadena(k2);});
OUT.push('D) tras desmarcar todo (debe desaparecer): '+JSON.stringify(gJun().filter(g=>g.id.indexOf('g_cad_')===0)));
T('re-marcar 1',()=>{tCadena(k1);if(document.getElementById('ov-confirm').classList.contains('open'))closeOv('ov-confirm');});
OUT.push('E) idempotencia (3 renders seguidos): '+[1,2,3].map(()=>{renderAll();return gJun().filter(g=>g.id.indexOf('g_cad_')===0).length;}).join(','));

// POZO: turnoMes 3 de cadA => mes 3 = agosto 2026 (inicio junio)
T('ir a agosto (turno propio)',()=>{curY=2026;curM=7;renderAll();});
const iAgo=()=>JSON.parse(localStorage.getItem('app_inc_2026_7')||'[]');
OUT.push('F) ingreso pozo agosto: '+JSON.stringify(iAgo().map(i=>[i.id,i.desc,i.monto,i.cat])));
OUT.push('   totalIngresos agosto='+totalIngresos());
T('render x3 no duplica',()=>{renderAll();renderAll();renderAll();});
OUT.push('G) ingresos agosto tras 3 renders (debe ser 1): '+iAgo().length);
OUT.push('   pozo no borrable a mano: '+!/data-id="inc_cad_/.test(document.getElementById('s-gastos').innerHTML));
T('mover turno propio a mes 4 y guardar',()=>{const cs=getCadenas();cs[0].posiciones[0].turnoMes=4;aplicarCadenas(cs);});
OUT.push('H) agosto tras mover turno (debe quedar 0): '+iAgo().length+' · septiembre: '+JSON.parse(localStorage.getItem('app_inc_2026_8')||'[]').length);
T('borrar cadenas',()=>{aplicarCadenas([]);});
OUT.push('I) tras borrar cadena -> ingresos ago='+iAgo().length+' · gasto cadena jun='+gJun().filter(g=>g.id.indexOf('g_cad_')===0).length+' (curM='+curM+')');
T('junio tras borrar cadena',()=>{curY=2026;curM=5;renderAll();});
OUT.push('J) gasto huerfano limpiado en junio: '+gJun().filter(g=>g.id.indexOf('g_cad_')===0).length+' (debe 0)');

// ── MODOS DE MES ───────────────────────────────────────────
// el bloque anterior borro las cadenas: se vuelve a sembrar una para probar los modos
T('resembrar cadena',()=>{setCadenas([{id:'cadA',nombre:'Cadena oficina',valorCuota:150000,frecuencia:'quincenal',dias:[5,20],diaPago:25,puestosGrupo:12,salenPorPeriodo:2,mesInicio:5,anioInicio:2026,posiciones:[{id:'pA',tipo:'propio',miSplit:1,conQuien:'',turnoMes:3,montoPozo:0}]}]);});
T('modos de cadena',()=>{curY=2026;curM=7;curScreen='cadena';_cobTab='cadena';renderAll();});
['curso','anticipado','vencido'].forEach(mo=>{
  const cs=getCadenas();cs[0].modoPago=mo;aplicarCadenas(cs);
  renderAll();
  const h=document.getElementById('s-cadena').innerHTML;
  const RX=(s,f)=>new RegExp(s,f);
  const chips=(h.match(RX('<div class="pmes">([a-zA-Z]{3})</div>','g'))||[]).map(x=>x.replace(RX('<[^>]*>','g'),''));
  const frase=(h.match(RX('los aportes de Agosto se pagan en [A-Za-z]+'))||(h.match(RX('Mes en curso[^<]*'))||['']))[0];
  OUT.push('K) cadena modo '+mo+': chips=['+chips.join(',')+'] · "'+frase+'"');
});
T('modo curso: aviso de arranque',()=>{const cs=getCadenas();cs[0].modoPago='anticipado';aplicarCadenas(cs);curY=2026;curM=4;renderAll();});
OUT.push('L) mayo (fuera de rango, anticipado): '+((document.getElementById('s-cadena').innerHTML.match(new RegExp('el primer aporte se paga el [0-9]+ de [A-Za-z]+ [0-9]+'))||[''])[0]));

['anticipado','curso','vencido'].forEach(mo=>{
  const c=gCfgApp();c.modoMes=mo;sCfgApp(c);
  curY=2026;curM=8;curScreen='gastos';renderAll();// septiembre = futuro
  const h=document.getElementById('s-gastos').innerHTML;
  OUT.push('M) gastos modo '+mo+': "'+((h.match(new RegExp('Estos gastos se pagan en [A-Za-z ]+'))||[''])[0])+'" · mesPago='+JSON.stringify(mesPago(2026,8)));
});
T('config modal 3 modos',()=>{const c=gCfgApp();c.modoMes='curso';sCfgApp(c);openCfgModal();});
OUT.push('N) toggle activo: ant='+document.getElementById('cfg-m-ant').classList.contains('on')+' cur='+document.getElementById('cfg-m-cur').classList.contains('on')+' ven='+document.getElementById('cfg-m-ven').classList.contains('on'));
OUT.push('   tip="'+document.getElementById('cfg-modo-tip').textContent.slice(0,60)+'..."');
T('guardar cfg con curso',()=>{saveCfg();});
OUT.push('O) modoMes guardado: '+gCfgApp().modoMes);
T('config cadena: modo visible',()=>{openCadConf();});
OUT.push('P) ov-cc tiene los 3 botones: '+['⏮️ Anticipado','📅 En curso','⏭️ Vencido'].every(t=>document.getElementById('cc-body').innerHTML.includes(t))+' · ayuda="'+document.getElementById('cc-body').innerHTML.includes('los entregas en')+'"');
T('cerrar cc',()=>closeOv('ov-cc'));

const d=document.createElement('pre');d.id='TESTOUT';
d.textContent='=== OUT ===\\n'+OUT.join('\\n')+'\\n=== ERRS ('+ERRS.length+') ===\\n'+ERRS.join('\\n');
document.body.appendChild(d);
</script>`;

import vm from 'node:vm';
try{ new vm.Script(harness.replace(/^<script>/,'').replace(/<\/script>\s*$/,'')); }
catch(e){ console.log('HARNESS SYNTAX ERROR: '+e.message); process.exit(1); }

let injected = html.replace('<script>', seed + '<script>');
injected = injected.replace('</body>', harness + '</body>');

const dir = mkdtempSync(join(tmpdir(), 'cartera-func-'));
const f = join(dir, 'func.html');
writeFileSync(f, injected, 'utf8');
const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!browser) { console.log('sin navegador'); process.exit(1); }
try {
  const dom = execFileSync(browser, ['--headless','--disable-gpu','--no-sandbox','--no-first-run',`--user-data-dir=${join(dir,'p')}`,'--virtual-time-budget=8000','--dump-dom','file:///'+f.replace(/\\/g,'/')], { encoding:'utf8', stdio:['ignore','pipe','ignore'], timeout:60000 });
  const m = dom.match(/<pre id="TESTOUT">([\s\S]*?)<\/pre>/);
  console.log(m ? m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"') : 'NO SE EJECUTO EL HARNESS');
} finally { rmSync(dir, {recursive:true, force:true}); }
