# CLAUDE.md — Contexto del proyecto Cartera

## Qué es esto
PWA de finanzas personales en UN SOLO archivo (`index.html`). HTML + CSS + JS vanilla, cero build, cero dependencias npm. Desplegada en **Cloudflare Pages** desde este repo (auto-deploy en push a main).

- **En vivo:** https://cartera-mes.pages.dev
- **Repo:** https://github.com/omvergara/manejo_cartera_mes (público)
- **Capturas:** carpeta `docs/` (ver sección "Capturas" del README)

## Arquitectura crítica — leer antes de tocar código

**Separación absoluta código/datos:**
- El código (`index.html`) es 100% genérico — NUNCA debe contener datos personales del usuario (nombres, montos, salarios)
- Los datos viven en `localStorage` del navegador del usuario con prefijo `app_`
- Respaldo opcional del usuario en SU Google Drive vía OAuth (scope `drive.file`)

**Mapa de claves localStorage (NO cambiar nombres ni estructura sin migración):**
```
app_cfg              {nombre, neto, tipoNomina:'mensual'|'quincenal', nominaDia | q1,q2, inicioY, inicioM, mods?, modoMes?}
                     · mods? = {tc,metas,cadena,prest,mercado: bool} — módulos prendidos/apagados en Ajustes (modOn()).
                       Si una llave falta, el módulo se prende solo cuando ya tiene datos (modDefault()).
                     · modoMes? = LEGADO (v9). Ya no se muestra ni se lee; se conserva en usuarios viejos. saveCfg()
                       parte de la cfg guardada para no borrar campos que el modal no edita (mods, modoMes).
                     · inicioY/inicioM = mes en que ARRANCA la operación de la cartera (inicioOp()).
                       Antes de ese mes: NETOm()=0, no se puede navegar (navFloor) y no entra al histórico de Análisis.
                       Default si falta (usuarios viejos): earliestRealDataMonth() (mes más antiguo con gastos>0 o ingresos).
app_{YYYY}_{M}       {gastos:[{id,name,amount,cat,paid,ahorro?,recurrente?,tarjeta?,metaId?,_tcAmt?,_metaApplied?}], neto?}  ← M 0-indexado
                     · TIPO excluyente (ogSetTipo): efectivo | ahorro (→meta) | tarjeta (compra: SUBE deuda, no toca caja) | abono (pago: BAJA deuda de g.tcId y SÍ cuenta como gasto/caja). Flags: ahorro/tarjeta/abonoTc + tcId/metaId. Marcas idempotentes _tcApplied/_abonoApplied/_metaApplied
                     · tarjeta? = pagado con tarjeta: suma a app_tc.saldo (reconcileGasto) y NO entra a la caja del mes (calcT lo salta)
                     · ahorro?+metaId? = al marcar pagado suma a esa meta de app_metas (reconcileGasto)
                     · _tcAmt/_metaApplied = marcas internas de idempotencia (no tocar)
                     · neto? = salario de ese mes: snapshot al cambiar el sueldo o EDITADO A MANO (netoManual:true).
                       Se edita tocando el bloque "💵 Ingresos" en Gastos (openMesNeto) y admite netoNota (texto libre).
                     · recurrente? = el gasto se arrastra a meses nuevos (ver seedGastos). Si el usuario los borró,
                       el botón discreto al final de Gastos los recupera (recurrentesDisponibles/cargarRecurrentes)
                     · hormiga? = gasto único "Gastos hormiga" del mes; hitems:[{id,desc,monto,fecha}] con el detalle
                       por día (modal ov-hdet). amount/hcount se llevan incrementalmente, nunca se recalculan a ciegas
                     · gasto DERIVADO de cadena: id `g_cad_<cadId>` + cadId, cat 'Ahorro', paid:true. Es la suma de
                       TUS aportes ya marcados en Cobros (app_cd_). No se edita ni se borra en la UI (lleva a Cobros):
                       lo recalcula syncCadenaGastos/syncCadenaGastosEn y se borra solo al desmarcar o al borrar la cadena
app_inc_{YYYY}_{M}   ingresos extra del mes [{id,desc,monto,cat}]  ← cat: Trabajo adicional/Prima/Bono empresa/Obsequio/Cadena/Otros
                     · ingreso DERIVADO del pozo: id `inc_cad_<cadId>_<posId>`, cat 'Cadena'. Aparece solo en el mes
                       del turno de esa posición (respeta miSplit) vía syncPozoIngresos; tampoco se edita a mano.
                       Para corregir el monto real se usa posicion.montoPozo en la config de la cadena
app_cd_{YYYY}_{M}    estado cadena del mes (v2): {v:2, paid:{'<cadId>|<posId>|d<dia>':true}, cobros:{}}
                     · NO congela montos: las filas se derivan de app_ccfg cada vez (getCPagos)
app_ccfg             cadenas (v2): {v:2, cadenas:[{id,nombre,valorCuota,frecuencia,dias:[],diaPago,modoPago,
                     puestosGrupo,salenPorPeriodo,mesInicio,anioInicio,
                     posiciones:[{id,tipo:'propio'|'compartido',miSplit,conQuien,turnoMes,montoPozo}]}]}
                     · formato viejo {puestos,valor,d1,d2,dPago,t1,t2} se migra solo (migrarCadena)
                     · modoPago (cadModo/cadMesCobro) — LEGADO: ya no se configura en la UI (v10). Si existe:
                       'anticipado' | 'curso' (default si falta) | 'vencido' —
                       en qué mes CAEN los días de cobro respecto al mes que cubren (−1 / 0 / +1). Cambia el chip de
                       fecha de cada aporte y la frase del encabezado; NO mueve el mes del gasto derivado ni del pozo
                       (siguen en el mes de la cadena, según la convención de mes de la app). diaPago quedó solo como
                       referencia de "día en que tú entregas tu cuota".
                     · POZO estimado (cadPozo) = cuota × puestos × aportes/mes (1 mensual, 2 quincenal) ÷ salen por mes × miSplit,
                       salvo que la posición tenga montoPozo.
                     · VIGENCIA: la cadena solo corre entre mesInicio/anioInicio y cadFin() (= inicio + cadDuracion − 1).
                       Fuera de ese rango getCPagos() no devuelve filas (no se puede marcar nada) y cadenaBody explica por qué.
                       El timeline muestra qué puestos del GRUPO cobran cada mes (cadPuestosDeMes), no solo los del usuario.
app_prestamos        préstamos que YO hago: [{id,persona,capital,meses,interes,mesIni,anioIni,cuotas:{n:{paid,y,m,incId,monto}}}]
                     · mesIni/anioIni = mes del préstamo; la cuota n se espera en inicio+(n−1) (prestamoCuotaMes).
                       Solo se puede chulear una cuota exigible (su mes ≤ mes visible); antes del inicio el préstamo no se muestra.
                       Legacy sin mesIni: se deduce de la cuota pagada más antigua (prestamoInicio) y se congela al guardar.
app_mrc              lista mercado [{id,name,icon,cat,on,price?}] · gM() merge no-destructivo con DM. Al guardar (💾) crea un gasto "Mercado" con el total de precios y pregunta efectivo/tarjeta (saveMrcGasto → reconcileGasto)
app_tcs              tarjetas MÚLTIPLES: [{id,nombre,base,cuota,tasa}] (migra de app_tc; saldo viejo→base). tasa = % MENSUAL.
                     · DEUDA DERIVADA (tcDeuda): base + compras − abonos de gastos (no se muta ni se pisa al editar). gasto.tcId elige tarjeta.
                     · La app NO ve intereses ni cuota de manejo: el usuario escribe la "Deuda hoy" del extracto
                       (updTc(id,'deuda',v)) y se recalcula base = deuda − compras + pagos registrados (base puede ser negativa).
                       NUNCA pedir el saldo del extracto como base: contaría doble las compras ya cargadas.
                     · deudaInfo() = amortización real mes a mes (último pago parcial); interés correcto.
app_tc               (LEGACY) tarjeta única antigua — se migra a app_tcs
app_metas            metas de ahorro v2: [{id,nombre,icono,total,meta,aporte?,plazoMeses?}] · aporte = ahorro mensual que
                     se sugiere en Mi mes (metaAporte(): aporte, o lo que falta/plazoMeses si solo hay plazo) (migra de app_meta {total,metaCasa}). Se configuran en modal (ov-metas); el total sube SOLO desde gastos tipo ahorro
app_sav_{Y}_{M}      (LEGACY) contador viejo de ahorro/mes — ya no se usa; savMes() se calcula de los gastos ahorro pagados del mes
app_prima_{Y}_{M}    (LEGACY) ya no se escribe — el planificador de prima se eliminó; la prima se registra como Ingreso extra cat 'Prima'
app_onb              estado de la tarjeta de pendientes: {hide:bool, skip:[ids]} (ver ckCard/ckItems)
app_pin              hash del PIN (sha256:… ó plain:…). EXCLUIDO del backup (getAllData lo omite)
app_drive_cid        Client ID OAuth
app_drive_fid        file ID del respaldo en Drive
cartera_prerestore   (sin prefijo app_) snapshot de seguridad antes de un restore atómico
```

**Convención de mes:** el mes mostrado = el mes que el dinero CUBRE, no el que se paga. Lo que se paga el día de nómina (p.ej. 25) cubre el mes siguiente; se registra bajo ese mes. La cadena se paga el `diaPago` del mes anterior al que cubre.

**Escritura segura:** usar `safeSet(k,v)` (captura QuotaExceededError) en vez de `localStorage.setItem` directo; los setters (`sD/sCfgApp/sM/sTc/sMeta/sInc`) ya lo hacen y llaman `autoSync()`. `replaceAllData(obj)` hace restore ATÓMICO (borra claves app_ excepto el PIN, valida y escribe) — usado por import y restore de Drive.

## Configuración guiada (usuario nuevo)
- **Asistente de 6 pasos** en el overlay `#onboarding` (perfil → mes de inicio → gastos fijos → tarjeta → meta → resumen). Pasos estáticos `#onb-s1..s6` que se muestran/ocultan; lógica en `onbIniciar/onbPintar/onbIr/onbGuardarPaso`.
  - El paso 1 **guarda el perfil al avanzar**: si el usuario abandona a medias no queda un estado roto (y `checkOnboarding()` ya no vuelve a abrirlo).
  - "Después" (`onbIr(1,true)`) salta el paso sin guardar. El paso 1 no se puede saltar (salario obligatorio).
  - La plantilla de gastos fijos del paso 3 es `DG` (única fuente). Por eso `seedGastos()` devuelve **vacío** cuando no hay ningún mes previo: si no, el usuario nuevo arrancaba con 5 filas en $0.
- **Tarjeta "Termina de configurar"** en Mi mes (`ckCard()/ckItems()`): lista SOLO lo que falta (lo hecho no ocupa espacio), cada fila abre su configuración, "No aplica" la descarta y la tarjeta desaparece al completarse. Un módulo apagado en Ajustes no se pide. Estado en `app_onb` = `{hide, skip:[ids]}`.

## Reglas de oro
1. **NUNCA** cambiar el prefijo `app_` ni renombrar claves existentes — rompería los datos de usuarios activos. Si una migración es inevitable, escribir código que lea la clave vieja y escriba la nueva.
2. **NUNCA** hardcodear datos personales. Todo lo configurable va al onboarding o a Ajustes.
3. **Un solo archivo.** No fragmentar en módulos/archivos JS separados salvo decisión explícita del dueño.
4. Todo cambio que escriba en localStorage debe llamar `autoSync()` después (sube respaldo a Drive si hay token).
4b. **Derivados de la cadena** (gasto del aporte + ingreso del pozo): `renderAll()` llama `syncPozoIngresos(curY,curM)`
   y `syncCadenaGastos()`. Ambos son idempotentes y **solo escriben si algo cambió** — si tocas esa lógica, mantén
   esa guarda o cada render dispara escritura + `autoSync()`. `aplicarCadenas(cads)` (no `setCadenas` directo) es
   la puerta para guardar cadenas: barre pozos en el rango viejo+nuevo y gastos derivados en todos los meses con datos.
5. Mantener español colombiano en toda la UI. Formato moneda: `toLocaleString('es-CO')` con prefijo `$`.
6. Mobile-first: la app se usa en iPhone vía Safari/PWA. Probar mentalmente a 390px de ancho.
7. Confirmación antes de cualquier acción destructiva (ya existe `showConfirm()` — usarla).

## Convenciones del código
- **Pantallas (v10):** 3 pestañas — `mes` (`rMes()`), `resumen` (`rResumen()`), `ajustes` (`rAjustes()`) — y 2 sub-pantallas con botón ‹ — `cadena` (`rCadena()`: cadena y préstamos) y `mercado` (`rMercado()`). `goTo()` acepta los nombres viejos como alias (inicio/gastos→mes, mas→resumen).
- **Una sola cuenta:** `mesModelo()` arma TODO lo del mes visible y es la única fuente de los números: gastos reales + aportes de cadena (una fila por cadena; el gasto derivado `g_cad_` no se lista aparte) + **filas sugeridas** (cuota de cada tarjeta y ahorro de cada meta, solo en el mes actual y futuros, y solo si no hay ya un pago/ahorro de esa tarjeta/meta en el mes). Cuadre: Entró − Ya pagaste = Tienes hoy; − Falta por pagar = **Te queda**. Las compras con tarjeta NO salen del mes (van en su sección). Las cuotas de préstamos van en "Por recibir" y no suman hasta marcarlas. `mesModeloDe(y,m)` da la misma cuenta para otro mes (lo usa Resumen, así ambos números coinciden).
- Marcar una fila sugerida (`pagarSugerido`) la vuelve un gasto real pagado (Pago TC o Ahorro con meta); tocarla (`abrirSugerido`) abre el formulario prellenado para ajustar el monto.
- **Formulario único `ov-mov`** (`openMov(kind,id,pre)` / `saveMov()` / `delMov()`): "Salió" o "Entró". Los 4 tipos viejos se expresan así: categoría normal + efectivo = efectivo; categoría normal + una tarjeta = compra TC; categoría "Ahorro" = ahorro (meta opcional); categoría "Pago de tarjeta" (`__abono`) = Pago TC. Los flags guardados (`ahorro/tarjeta/abonoTc/tcId/metaId`) son los mismos de siempre. `openAdd/openEdit/openAddIngreso/openEditIngreso` son atajos.
- **Seguridad:** las filas de Mi mes y los chips del formulario llevan el id/valor en `data-*` y un solo listener los resuelve; NO metas ids o datos del usuario dentro de `onclick="...('${id}')"` (un respaldo importado manipulado podría inyectar JS: `esc()` no protege ese contexto). Tampoco uses `new Function`/`eval`: la CSP no permite `unsafe-eval`.
- `renderAll()` redibuja la pantalla activa; llamarla tras cualquier mutación de estado
- Getters/setters de storage: `gD()/sD()` (mes actual), `gM()/sM()` (mercado), `gTc()/sTc()`, `gMeta()/sMeta()`, `getCadenas()/setCadenas()` (cadenas v2), `gInc()/sInc()` (ingresos extra), `gCfgApp()/sCfgApp()` (config usuario). Helpers cadena: `getCPagos()` (filas derivadas del mes), `cobrosMes()` (pozos del mes), `cadDuracion/cadIdxMes/cadPozo`. Salario por mes: `NETOm(y,m)`. Deuda: `deudaInfo()/tasaMensualDe()` (tasa MENSUAL). Metas: `gMetas()/sMetas()/totalAhorrado()/ensureMeta()`. Ahorro por mes: `addAhorroMes()/savMes()/rachaAhorro()`. La edición de tarjeta y metas vive en modales que se abren desde **Ajustes** (rAjustes); `rResumen` es solo lectura.
- Modales: overlays con ids `ov-*`, abrir/cerrar con `openOv(id)/closeOv(id)`
- Botones flotantes (FAB): se crean dinámicamente en cada render y se destruyen en `renderAll()` — 58px, solo icono SVG: el + de Mi mes abre `ov-mov`; el ✓ verde de Mercado guarda la lista como gasto
- Navegación de meses: limitada entre el mes de inicio de operación (`navFloor()` ← `inicioOp()`) y **mes actual+2**; `goToday()` vuelve al actual. Además de los botones ‹ › se puede **deslizar horizontalmente** (initSwipeMes: solo en mes/resumen/cadena, ignora modales y gestos que arranquen sobre un control)
- `showConfirm(t,s,cb,okLabel)`: sin `okLabel` el botón dice "Eliminar" en rojo; con `okLabel` es un botón azul de acción normal

## Dominio del negocio (contexto colombiano)
- **Prima semestral**: por ley, junio y diciembre, ≈15 días de salario (NETO/2 como estimación)
- **Cadena de ahorro**: grupo informal; N puestos, cada puesto aporta cuota quincenal, cada mes cobran 2 puestos. El usuario puede tener un puesto propio y/o uno compartido 50/50
- **FNA**: Fondo Nacional del Ahorro — ahorro para vivienda, junto con cesantías
- "Quedar a paz" = liquidar una deuda

## Testing manual mínimo tras cualquier cambio
1. Abrir en navegador → el asistente aparece solo si no hay `app_cfg` (probar en incógnito para no borrar datos reales)
2. Marcar/desmarcar un gasto → la cuenta de Mi mes cuadra (Entró − Ya pagaste − Falta = Te queda)
3. Cambiar de mes y volver con "Volver a <mes>"
4. Exportar JSON → importarlo → datos intactos
5. Verificar que no haya errores en consola

## Tests automatizados
Requieren Node 18+ y Chrome/Edge instalado. Los tres corren en headless sobre el `index.html` real.
- `node test/smoke.mjs` — el JS embebido compila y el nombre del usuario se escapa (anti-XSS). Sale con código 0/1 (apto para CI).
- `node test/funcional.mjs` — siembra un escenario (cartera desde junio 2026, cadena, préstamos, hormigas) y verifica con aserciones `A()` (una falla cuenta en ERRS) la cuenta de Mi mes, el formulario único, compras/pagos con tarjeta, XSS por ids raros, cadena↔caja, préstamos, Resumen = Mi mes, módulos, swipe y filas sugeridas. **ERRS debe ser 0**. Las filas sugeridas se prueban en el mes actual REAL del reloj.
- `node test/onboarding.mjs` — arranca con localStorage vacío y recorre el asistente de 6 pasos + la tarjeta de pendientes. Mismo formato: `ERRS` debe ser 0.

⚠️ Al escribir estos tests, el harness va dentro de un template literal de JS: **no uses expresiones regulares con `\`** (`\d`, `\w`, `\/` pierden la barra al interpolarse). Usa `new RegExp('...')` con clases explícitas (`[0-9]`, `[A-Za-z]`) o `.includes()`.

## Deploy
`git push` a main → Cloudflare Pages redespliega (~30s). No hay pipeline de build.

## Backlog conocido
- Recordatorios in-app (nómina, cadena) — NO push del sistema: la app es serverless y el push real exige un backend con VAPID/web-push
- Versión multi-usuario pública
- **Modo de mes retirado (v10).** Solo cambiaba etiquetas y confundía. Manda la convención mes-que-cubre. Si alguna vez se pide que la plata se descuente de verdad del mes anterior, es un cambio profundo: decidirlo explícitamente.
- Los modales de tarjetas, metas, cadena, préstamos y mercado todavía arman `onclick` con ids dentro (patrón viejo). Migrarlos a `data-*` como Mi mes.
- Las capturas de `docs/` y el README son de la versión anterior (v9): regenerarlas.
- Ampliar cobertura: los 3 tests cubren los flujos principales, pero no mercado→gasto, Drive/import-export ni PIN.
