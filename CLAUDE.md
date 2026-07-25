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
app_cfg              {nombre, neto, tipoNomina:'mensual'|'quincenal', nominaDia | q1,q2, modoMes, inicioY, inicioM}
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
app_ccfg             cadenas (v2): {v:2, cadenas:[{id,nombre,valorCuota,frecuencia,dias:[],diaPago,
                     puestosGrupo,salenPorPeriodo,mesInicio,anioInicio,
                     posiciones:[{id,tipo:'propio'|'compartido',miSplit,conQuien,turnoMes,montoPozo}]}]}
                     · formato viejo {puestos,valor,d1,d2,dPago,t1,t2} se migra solo (migrarCadena)
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
                     · deudaInfo() = amortización real mes a mes (último pago parcial); interés correcto.
app_tc               (LEGACY) tarjeta única antigua — se migra a app_tcs
app_metas            metas de ahorro v2: [{id,nombre,icono,total,meta,plazoMeses?}] (migra de app_meta {total,metaCasa}). Se configuran en modal (ov-metas); el total sube SOLO desde gastos tipo ahorro
app_sav_{Y}_{M}      (LEGACY) contador viejo de ahorro/mes — ya no se usa; savMes() se calcula de los gastos ahorro pagados del mes
app_prima_{Y}_{M}    (LEGACY) ya no se escribe — el planificador de prima se eliminó; la prima se registra como Ingreso extra cat 'Prima'
app_pin              hash del PIN (sha256:… ó plain:…). EXCLUIDO del backup (getAllData lo omite)
app_drive_cid        Client ID OAuth
app_drive_fid        file ID del respaldo en Drive
cartera_prerestore   (sin prefijo app_) snapshot de seguridad antes de un restore atómico
```

**Convención de mes:** el mes mostrado = el mes que el dinero CUBRE, no el que se paga. Lo que se paga el día de nómina (p.ej. 25) cubre el mes siguiente; se registra bajo ese mes. La cadena se paga el `diaPago` del mes anterior al que cubre.

**Escritura segura:** usar `safeSet(k,v)` (captura QuotaExceededError) en vez de `localStorage.setItem` directo; los setters (`sD/sCfgApp/sM/sTc/sMeta/sInc`) ya lo hacen y llaman `autoSync()`. `replaceAllData(obj)` hace restore ATÓMICO (borra claves app_ excepto el PIN, valida y escribe) — usado por import y restore de Drive.

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
- Funciones de render por pantalla: `rInicio()`, `rGastos()`, `rCadena()`, `rMercado()`, `rMas()` (análisis), `rAjustes()`
- `renderAll()` redibuja la pantalla activa y los badges; llamarla tras cualquier mutación de estado
- Getters/setters de storage: `gD()/sD()` (mes actual), `gM()/sM()` (mercado), `gTc()/sTc()`, `gMeta()/sMeta()`, `getCadenas()/setCadenas()` (cadenas v2), `gInc()/sInc()` (ingresos extra), `gCfgApp()/sCfgApp()` (config usuario). Helpers cadena: `getCPagos()` (filas derivadas del mes), `cobrosMes()` (pozos del mes), `cadDuracion/cadIdxMes/cadPozo`. Salario por mes: `NETOm(y,m)`. Deuda: `deudaInfo()/tasaMensualDe()` (tasa MENSUAL). Metas: `gMetas()/sMetas()/totalAhorrado()/ensureMeta()`. Ahorro por mes: `addAhorroMes()/savMes()/rachaAhorro()`. La edición de tarjeta y metas vive en **Ajustes** (rAjustes); `rMas` (Análisis) es solo lectura.
- Modales: overlays con ids `ov-*`, abrir/cerrar con `openOv(id)/closeOv(id)`
- Botones flotantes (FAB): se crean dinámicamente en cada render y se destruyen en `renderAll()` — son circulares minimalistas (54px, solo icono)
- Navegación de meses: limitada entre el mes de inicio de operación (`navFloor()` ← `inicioOp()`) y **mes actual+2**; `goToday()` vuelve al actual. Además de los botones ‹ › se puede **deslizar horizontalmente** (initSwipeMes: solo en inicio/gastos/cadena, ignora modales y gestos que arranquen sobre un control)
- `showConfirm(t,s,cb,okLabel)`: sin `okLabel` el botón dice "Eliminar" en rojo; con `okLabel` es un botón azul de acción normal

## Dominio del negocio (contexto colombiano)
- **Prima semestral**: por ley, junio y diciembre, ≈15 días de salario (NETO/2 como estimación)
- **Cadena de ahorro**: grupo informal; N puestos, cada puesto aporta cuota quincenal, cada mes cobran 2 puestos. El usuario puede tener un puesto propio y/o uno compartido 50/50
- **FNA**: Fondo Nacional del Ahorro — ahorro para vivienda, junto con cesantías
- "Quedar a paz" = liquidar una deuda

## Testing manual mínimo tras cualquier cambio
1. Abrir en navegador → onboarding aparece solo si no hay `app_cfg`
2. Marcar/desmarcar un gasto → totales y badges se actualizan
3. Cambiar de mes y volver con "Hoy ↩"
4. Exportar JSON → importarlo → datos intactos
5. Verificar que no haya errores en consola

## Smoke test automatizado
`node test/smoke.mjs` — verifica que el JS embebido compile y que el nombre del usuario se escape (anti-XSS). Requiere Node 18+ y Chrome/Edge instalado. Sale con código 0 si pasa (apto para CI).

## Deploy
`git push` a main → Cloudflare Pages redespliega (~30s). No hay pipeline de build.

## Backlog conocido
- Recordatorios in-app (nómina, cadena) — NO push del sistema: la app es serverless y el push real exige un backend con VAPID/web-push
- Versión multi-usuario pública
- Ampliar cobertura de tests (hoy hay un smoke test básico)
