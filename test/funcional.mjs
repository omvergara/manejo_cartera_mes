// Prueba funcional: siembra un escenario realista (cartera desde junio 2026) y ejercita
// la cuenta de Mi mes, el formulario unico, cadena, prestamos, resumen, modulos, swipe y filas sugeridas,
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
// A = asercion: si falla cuenta como error (ERRS debe quedar en 0).
function A(label,cond,extra){if(cond)OUT.push('PASA: '+label);else ERRS.push('FALLA: '+label+(extra!==undefined?' -> '+extra:''));}
const H=id=>document.getElementById(id).innerHTML;
const gMes=(y,m)=>(JSON.parse(localStorage.getItem('app_'+y+'_'+m)||'{"gastos":[]}').gastos);
function clickRow(k,id){const el=document.querySelector('#s-mes .row[data-k="'+k+'"][data-id="'+id+'"]');if(!el)throw new Error('no hay fila '+k+'/'+id);el.click();}
function clickChk(k,id){const el=document.querySelector('#s-mes .row[data-k="'+k+'"][data-id="'+id+'"] .chk');if(!el)throw new Error('no hay check '+k+'/'+id);el.click();}

// ── MI MES: la cuenta cuadra ───────────────────────────────
// Junio 2026 (mes pasado: sin filas sugeridas). Entró 5.000.000 + 400.000.
// Pagado: arriendo 1.200.000 + cadena manual 300.000 + hormiga 14.000 = 1.514.000.
// Falta: servicios 250.000 + aportes de la cadena 450.000 (2x150.000 propio + 2x75.000 compartido) = 700.000.
T('mi mes junio',()=>{curY=2026;curM=5;curScreen='mes';renderAll();});
let M=mesModelo();
A('entro junio = 5.400.000',M.entro===5400000,M.entro);
A('ya pagaste junio = 1.514.000',M.pagado===1514000,M.pagado);
A('falta junio = 700.000 (incluye la cadena aunque no este marcada)',M.falta===700000,M.falta);
A('tienes hoy = entro - pagado',M.tienes===M.entro-M.pagado);
A('te queda = 3.186.000',M.queda===3186000,M.queda);
A('la tarjeta muestra el numero grande',H('s-mes').includes(fmt(3186000)));
A('mes pasado: sin filas sugeridas',!M.salen.some(r=>r.sug));
A('cadena aparece una sola vez como fila',(H('s-mes').split('Cadena · Cadena oficina').length-1)===1);
A('el saludo usa el nombre',H('s-mes').includes('Hola, Mau'));
A('el salario de junio dice que llego el 25 de mayo',H('s-mes').includes('Llegó el 25 de mayo'));
A('nomina del 25 de octubre = plata de noviembre',salarioOrigen(2026,10).indexOf('25 de octubre')>0,salarioOrigen(2026,10));
A('nomina de diciembre llega en noviembre (futuro)',salarioOrigen(2027,0).indexOf('25 de diciembre 2026')>0,salarioOrigen(2027,0));

// ── INGRESO BASE / RECURRENTES / HORMIGA ──
T('julio',()=>{curY=2026;curM=6;renderAll();});
A('julio muestra salario editado a mano',H('s-mes').includes('Editado a mano'));
A('julio entro = 3.200.000 (neto manual)',mesModelo().entro===3200000,mesModelo().entro);
T('openMesNeto desde la fila Salario',()=>{clickRow('neto','neto');});
A('modal de ingreso del mes trae 3.200.000',document.getElementById('mi-neto').value==='3200000');
T('cerrar',()=>closeOv('ov-mesing'));
A('boton para cargar recurrentes',H('s-mes').includes('Cargar 1 gasto'));
T('cargarRecurrentes+confirm',()=>{cargarRecurrentes();document.getElementById('cok').click();});
A('julio recupera Servicios',gMes(2026,6).some(g=>g.name==='Servicios'));
T('junio hormiga detalle',()=>{curY=2026;curM=5;renderAll();clickRow('g','g_hormiga');});
A('detalle hormiga abierto',document.getElementById('ov-hdet').classList.contains('open'));
A('detalle hormiga con fechas',H('hdet-body').includes('jun')&&H('hdet-body').includes('sin fecha'));
T('borrar item hormiga',()=>{hdelItem(0);document.getElementById('cok').click();});
A('hormiga resta el item',(gMes(2026,5).find(g=>g.id==='g_hormiga')||{}).amount===11000,(gMes(2026,5).find(g=>g.id==='g_hormiga')||{}).amount);
T('cerrar hdet',()=>closeOv('ov-hdet'));

// ── FORMULARIO UNICO (salio / entro) ──
T('nuevo gasto en efectivo',()=>{curY=2026;curM=5;renderAll();openAdd();document.getElementById('mv-nom').value='Cine';document.getElementById('mv-mnt').value='50000';mvCat('Entretenimiento');document.getElementById('mv-paid').checked=true;saveMov();});
let cine=gMes(2026,5).find(g=>g.name==='Cine');
A('gasto guardado pagado y con categoria',cine&&cine.paid&&cine.cat==='Entretenimiento'&&!cine.tarjeta);
A('suma a ya pagaste',mesModelo().pagado===1514000-3000+50000,mesModelo().pagado);
const deudaAntes=tcDeuda(gTcs()[0]);
T('compra con tarjeta',()=>{openAdd();document.getElementById('mv-nom').value='Zapatos';document.getElementById('mv-mnt').value='120000';mvCat('Otros');mvPay('tc1');saveMov();});
const zap=gMes(2026,5).find(g=>g.name==='Zapatos');
A('compra con tarjeta: marcada tarjeta y tcId',zap&&zap.tarjeta&&zap.tcId==='tc1'&&zap.paid);
A('compra con tarjeta: NO sale de la plata del mes',!mesModelo().salen.some(r=>r.id===zap.id)&&mesModelo().tarjeta.some(r=>r.id===zap.id));
A('compra con tarjeta: sube la deuda',tcDeuda(gTcs()[0])===deudaAntes+120000);
T('editar el gasto (cambia monto)',()=>{clickRow('g',cine.id);document.getElementById('mv-mnt').value='60000';saveMov();});
A('edicion guardada',gMes(2026,5).find(g=>g.id===cine.id).amount===60000);
T('eliminar desde el formulario',()=>{openEdit(cine.id);delMov();document.getElementById('cok').click();});
A('gasto eliminado',!gMes(2026,5).some(g=>g.id===cine.id));
T('nuevo ingreso',()=>{openMov('ent');document.getElementById('mv-nom').value='Venta bici';document.getElementById('mv-mnt').value='300000';mvCat('Otros');saveMov();});
A('ingreso suma a entro',mesModelo().entro===5700000,mesModelo().entro);
T('pago de tarjeta como categoria',()=>{openAdd();document.getElementById('mv-nom').value='Abono Visa';document.getElementById('mv-mnt').value='100000';mvCat('__abono');document.getElementById('mv-tcp').value='tc1';saveMov();});
const ab=gMes(2026,5).find(g=>g.name==='Abono Visa');
A('pago de tarjeta: abonoTc + baja deuda',ab&&ab.abonoTc&&ab.cat==='Deuda'&&tcDeuda(gTcs()[0])===deudaAntes+120000-100000);
// XSS: nombre con HTML y un id con comilla (como vendria de un respaldo manipulado)
T('gasto con html e id raro',()=>{const d=gD();d.gastos.push({id:"x'y\\"z",name:'<img src=x onerror=alert(1)>',amount:1000,cat:'Otros',paid:false});sD(d);renderAll();});
A('el nombre se escapa',H('s-mes').includes('&lt;img')&&!H('s-mes').includes('<img src=x'));
T('tocar la fila con id raro no rompe',()=>{const el=[...document.querySelectorAll('#s-mes .row[data-k="g"]')].find(r=>r.dataset.id.indexOf("x'y")===0);if(!el)throw new Error('fila no encontrada');el.querySelector('.chk').click();});
A('el check con id raro funciona',gMes(2026,5).find(g=>g.id.indexOf("x'y")===0).paid===true);
T('limpiar gasto raro',()=>{const d=gD();d.gastos=d.gastos.filter(g=>g.id.indexOf("x'y")!==0);sD(d);renderAll();});

// ── CADENA: pantalla, vigencia y prestamos ──
T('cadena jun',()=>{goTo('cadena');});
A('jun: 4 aportes marcables',getCPagos().length===4,getCPagos().length);
A('timeline muestra puestos del grupo',H('s-cadena').includes('puestos 1–2')&&H('s-cadena').includes('otro integrante'));
A('cadena tiene boton volver',H('s-cadena').includes('‹ Mi mes'));
T('may (fuera de rango)',()=>{curY=2026;curM=4;renderAll();});
A('mayo: 0 aportes y aviso',getCPagos().length===0&&H('s-cadena').includes('Arranca en'));
T('prestamos may',()=>{setCobTab('prestamos');});
A('prestamo oculto antes de existir',H('s-cadena').includes('todavía no existía'));
T('prestamos jun',()=>{curY=2026;curM=5;renderAll();});
A('cuota 1 este mes',H('s-cadena').includes('Este mes'));
T('config prestamo',()=>{openPrestConf();});
A('config prestamo pide mes',H('pr-body').includes('En qué mes prestaste'));
T('guardar prestamo',()=>{savePrestConf();});
A('prestamo legacy congela inicio',(gPrestamos().find(p=>p.id==='pr2')||{}).mesIni===5);
T('mi mes jun: por recibir',()=>{goTo('mes');});
A('jun muestra cuota por recibir',H('s-mes').includes('Por recibir')&&H('s-mes').includes('Hermano'));
const entAntes=mesModelo().entro;
T('marcar cuota recibida desde Mi mes',()=>{clickChk('prc','pr1|1');});
A('la cuota recibida entra a Entro',mesModelo().entro===entAntes+Math.round(cuotaPrestamo(1000000,5,1)),mesModelo().entro);
A('y sale de Por recibir',!mesModelo().recibir.some(r=>r.id==='pr1|1'));

// ── NAVEGACION ──
T('nav abajo tope',()=>{curY=2026;curM=5;renderAll();changeMonth(-1);});
A('no baja del mes de inicio',curY===2026&&curM===5,curY+'-'+curM);
T('nav futuro x3',()=>{const h=new Date();curY=h.getFullYear();curM=h.getMonth();changeMonth(1);changeMonth(1);changeMonth(1);});
const hh=new Date();const tope=(hh.getFullYear()*12+hh.getMonth()+2);
A('tope futuro = mes actual + 2',curY*12+curM===tope,curY+'-'+curM);
A('NETOm antes de inicio = 0',NETOm(2026,4)===0&&NETOm(2026,6)===3200000);

// ── RESUMEN ──
T('resumen jul',()=>{curY=2026;curM=6;goTo('resumen');});
A('resumen responde las 3 preguntas',H('s-resumen').includes('¿Voy mejor que el mes pasado?')&&H('s-resumen').includes('¿En qué se me va la plata?')&&H('s-resumen').includes('¿Cuándo quedo a paz'));
A('resumen sin meses antes del inicio',!H('s-resumen').includes('>Ene<')&&!H('s-resumen').includes('>May<'));
A('resumen compara con junio',H('s-resumen').includes('que en junio'));
A('el junio de Resumen es el mismo Te queda de Mi mes junio',H('s-resumen').includes(fmt(mesModeloDe(2026,5).queda)),fmt(mesModeloDe(2026,5).queda));
A('resumen muestra cuando quedas a paz con la Visa',H('s-resumen').includes('quedas a paz en'));

// ── AJUSTES Y MODULOS ──
T('ajustes',()=>goTo('ajustes'));
A('ajustes: perfil con fecha de inicio',H('s-ajustes').includes('desde Junio 2026'));
A('ajustes: 5 modulos con interruptor',document.querySelectorAll('#s-ajustes .swb').length===6);
A('modulos se prenden solos si hay datos',modOn('tc')&&modOn('metas')&&modOn('cadena')&&modOn('prest'));
T('apagar cadena',()=>{setMod('cadena',false);curY=2026;curM=5;goTo('mes');});
A('cadena apagada: ya no hay fila de cadena',!mesModelo().salen.some(r=>r.k==='cad'));
T('prender cadena',()=>{setMod('cadena',true);});
A('cadena prendida: vuelve la fila',mesModelo().salen.some(r=>r.k==='cad'));
T('config modal',()=>openCfgModal());
A('el modal ya no tiene modo de mes',!document.getElementById('cfg-m-ant'));
T('guardar cfg',()=>saveCfg());
A('guardar perfil conserva los modulos',gCfgApp().mods&&gCfgApp().mods.cadena===true,JSON.stringify(gCfgApp().mods));

// ── SWIPE ──
function swipe(dx,dy){
  const el=document.getElementById('s-mes');
  const mk=(type,x,y)=>{const t=new Touch({identifier:1,target:el,clientX:x,clientY:y});
    return new TouchEvent(type,{touches:type==='touchend'?[]:[t],changedTouches:[t],bubbles:true,cancelable:true});};
  el.dispatchEvent(mk('touchstart',200,300));
  el.dispatchEvent(mk('touchend',200+dx,300+dy));
}
T('swipe izq (mes+1)',()=>{curY=2026;curM=5;goTo('mes');swipe(-140,10);});
A('swipe izq avanza',curY===2026&&curM===6);
T('swipe der (mes-1)',()=>{swipe(140,5);});
A('swipe der retrocede',curY===2026&&curM===5);
T('swipe vertical',()=>{swipe(20,180);});
A('swipe vertical no cambia',curM===5);
T('swipe con modal',()=>{openOv('ov-mesing');swipe(-140,0);closeOv('ov-mesing');});
A('swipe con modal abierto no cambia',curM===5);
_swipeUntil=0;

// ── CADENA <-> CAJA ──
const gJun=()=>gMes(2026,5);
const iJun=()=>JSON.parse(localStorage.getItem('app_inc_2026_5')||'[]');
T('junio limpio',()=>{curY=2026;curM=5;curScreen='mes';renderAll();});
const k1=getCPagos()[0].key,k2=getCPagos()[1].key;
T('marcar aporte 1',()=>{tCadena(k1);});
A('aporte marcado crea gasto derivado',gJun().filter(g=>g.id.indexOf('g_cad_')===0).length===1);
A('aviso anti-duplicado',document.getElementById('ov-confirm').classList.contains('open')&&document.getElementById('cok').textContent==='Borrarlo');
T('aceptar borrar el manual',()=>{document.getElementById('cok').click();});
A('gasto manual "Cadena" borrado',!gJun().some(g=>g.id==='gman'));
const qAntes=mesModelo().queda;
T('marcar aporte 2',()=>{tCadena(k2);});
A('marcar un aporte NO cambia Te queda (ya estaba en Falta)',mesModelo().queda===qAntes,mesModelo().queda+' vs '+qAntes);
A('gasto derivado suma 300.000',gJun().find(g=>g.id==='g_cad_cadA').amount===300000);
T('desmarcar los dos',()=>{tCadena(k1);tCadena(k2);});
A('desmarcar todo borra el derivado',!gJun().some(g=>g.id.indexOf('g_cad_')===0));
T('marcar todo desde Mi mes',()=>{renderAll();clickChk('cad','cadA');if(document.getElementById('ov-confirm').classList.contains('open'))closeOv('ov-confirm');});
A('check de la fila marca los 4 aportes',getCPagos().every(r=>r.paid));
A('cadena completa pasa a Ya pagado',mesModelo().salen.find(r=>r.k==='cad').paid===true);
T('desmarcar todo desde Mi mes',()=>{clickChk('cad','cadA');});
A('check otra vez desmarca los 4',getCPagos().every(r=>!r.paid));
A('idempotencia: 3 renders no duplican',[1,2,3].map(()=>{renderAll();return gJun().filter(g=>g.id.indexOf('g_cad_')===0).length;}).join(',')==='0,0,0');
T('ir a agosto (turno propio)',()=>{curY=2026;curM=7;renderAll();});
const iAgo=()=>JSON.parse(localStorage.getItem('app_inc_2026_7')||'[]');
A('pozo de agosto entra como ingreso',iAgo().length===1&&iAgo()[0].cat==='Cadena');
T('render x3',()=>{renderAll();renderAll();renderAll();});
A('pozo no se duplica',iAgo().length===1);
T('mover turno a mes 4',()=>{const cs=getCadenas();cs[0].posiciones[0].turnoMes=4;aplicarCadenas(cs);});
A('el pozo se mueve a septiembre',iAgo().length===0&&JSON.parse(localStorage.getItem('app_inc_2026_8')||'[]').length===1);
T('borrar cadenas',()=>{aplicarCadenas([]);});
A('borrar cadena limpia pozo',iAgo().length===0);

// ── FILAS SUGERIDAS (mes actual real) ──
T('mes actual',()=>{const h=new Date();curY=h.getFullYear();curM=h.getMonth();renderAll();});
M=mesModelo();
const vtc=M.salen.find(r=>r.k==='vtc');
A('cuota de la Visa sugerida en Por pagar',vtc&&vtc.amt===Math.min(200000,tcDeuda(gTcs()[0])),vtc&&vtc.amt);
A('la cuota sugerida cuenta en Falta',M.falta>=200000);
const deuda0=tcDeuda(gTcs()[0]);
T('marcar la cuota sugerida',()=>{clickChk('vtc','tc1');});
A('cuota pagada: baja la deuda',tcDeuda(gTcs()[0])===deuda0-Math.min(200000,deuda0));
A('cuota pagada: ya no se sugiere',!mesModelo().salen.some(r=>r.k==='vtc'));
T('meta con ahorro mensual',()=>{const ms=gMetas();ms[0].aporte=300000;sMetas(ms);renderAll();});
A('ahorro de la meta sugerido',mesModelo().salen.some(r=>r.k==='vmeta'&&r.amt===300000));
const tot0=gMetas()[0].total;
T('tocar la fila abre el formulario lleno',()=>{clickRow('vmeta','mm');});
A('formulario prellenado con ahorro',document.getElementById('ov-mov').classList.contains('open')&&document.getElementById('mv-mnt').value==='300000');
T('guardar ahorro desde el formulario',()=>{saveMov();});
A('la meta sube 300.000',gMetas()[0].total===tot0+300000,gMetas()[0].total);
A('ahorro ya no se sugiere',!mesModelo().salen.some(r=>r.k==='vmeta'));

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
