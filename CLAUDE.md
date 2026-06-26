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
app_cfg              {nombre, neto, tipoNomina:'mensual'|'quincenal', nominaDia | q1,q2}
app_{YYYY}_{M}       {gastos:[{id,name,amount,cat,paid,ahorro?,anticipado?,recurrente?,tarjeta?,metaId?,_tcAmt?,_metaApplied?}], neto?}  ← M 0-indexado
                     · tarjeta? = pagado con tarjeta: suma a app_tc.saldo (reconcileGasto) y NO entra a la caja del mes (calcT lo salta)
                     · ahorro?+metaId? = al marcar pagado suma a esa meta de app_metas (reconcileGasto)
                     · _tcAmt/_metaApplied = marcas internas de idempotencia (no tocar)
                     · neto? = snapshot del salario de ese mes (se congela al cambiar el sueldo; ver NETOm)
                     · recurrente? = el gasto se arrastra a meses nuevos (ver seedGastos)
app_inc_{YYYY}_{M}   ingresos extra del mes [{id,desc,monto}]
app_cd_{YYYY}_{M}    estado cadena del mes (v2): {v:2, paid:{'<cadId>|<posId>|d<dia>':true}, cobros:{}}
                     · NO congela montos: las filas se derivan de app_ccfg cada vez (getCPagos)
app_ccfg             cadenas (v2): {v:2, cadenas:[{id,nombre,valorCuota,frecuencia,dias:[],diaPago,
                     puestosGrupo,salenPorPeriodo,mesInicio,anioInicio,
                     posiciones:[{id,tipo:'propio'|'compartido',miSplit,conQuien,turnoMes,montoPozo}]}]}
                     · formato viejo {puestos,valor,d1,d2,dPago,t1,t2} se migra solo (migrarCadena)
app_mrc              lista mercado [{id,name,icon,cat,on}] · gM() hace merge no-destructivo con DM
app_tc               {saldo, cuota, tasa}  ← tasa = % MENSUAL (no E.A.) para amortización (deudaInfo/tasaMensualDe)
app_metas            metas de ahorro v2: [{id,nombre,icono,total,meta}] (migra de app_meta {total,metaCasa})
app_sav_{Y}_{M}      ahorro registrado por mes (racha de ahorro y ritmo)
app_prima_{Y}_{M}    distribución de prima {real, tc, fna, libre, fecha}
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
5. Mantener español colombiano en toda la UI. Formato moneda: `toLocaleString('es-CO')` con prefijo `$`.
6. Mobile-first: la app se usa en iPhone vía Safari/PWA. Probar mentalmente a 390px de ancho.
7. Confirmación antes de cualquier acción destructiva (ya existe `showConfirm()` — usarla).

## Convenciones del código
- Funciones de render por pantalla: `rInicio()`, `rGastos()`, `rCadena()`, `rMercado()`, `rMas()` (análisis), `rAjustes()`
- `renderAll()` redibuja la pantalla activa y los badges; llamarla tras cualquier mutación de estado
- Getters/setters de storage: `gD()/sD()` (mes actual), `gM()/sM()` (mercado), `gTc()/sTc()`, `gMeta()/sMeta()`, `getCadenas()/setCadenas()` (cadenas v2), `gInc()/sInc()` (ingresos extra), `gCfgApp()/sCfgApp()` (config usuario). Helpers cadena: `getCPagos()` (filas derivadas del mes), `cobrosMes()` (pozos del mes), `cadDuracion/cadIdxMes/cadPozo`. Salario por mes: `NETOm(y,m)`. Deuda: `deudaInfo()/tasaMensualDe()` (tasa MENSUAL). Metas: `gMetas()/sMetas()/totalAhorrado()/ensureMeta()`. Ahorro por mes: `addAhorroMes()/savMes()/rachaAhorro()`. La edición de tarjeta y metas vive en **Ajustes** (rAjustes); `rMas` (Análisis) es solo lectura.
- Modales: overlays con ids `ov-*`, abrir/cerrar con `openOv(id)/closeOv(id)`
- Botones flotantes (FAB): se crean dinámicamente en cada render y se destruyen en `renderAll()` — son circulares minimalistas (54px, solo icono)
- Navegación de meses: limitada entre el mes más antiguo con datos (`earliestDataMonth()`) y mes actual+1; `goToday()` vuelve al actual

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
