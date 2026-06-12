# CLAUDE.md — Contexto del proyecto Cartera

## Qué es esto
PWA de finanzas personales en UN SOLO archivo (`index.html`). HTML + CSS + JS vanilla, cero build, cero dependencias npm. Desplegada en Netlify desde este repo (auto-deploy en push a main).

## Arquitectura crítica — leer antes de tocar código

**Separación absoluta código/datos:**
- El código (`index.html`) es 100% genérico — NUNCA debe contener datos personales del usuario (nombres, montos, salarios)
- Los datos viven en `localStorage` del navegador del usuario con prefijo `app_`
- Respaldo opcional del usuario en SU Google Drive vía OAuth (scope `drive.file`)

**Mapa de claves localStorage (NO cambiar nombres ni estructura sin migración):**
```
app_cfg              {neto, nominaDia, gasolina}
app_{YYYY}_{M}       {gastos:[{id,name,amount,cat,paid,ahorro?}]}  ← M es 0-indexado (0=enero)
app_cd_{YYYY}_{M}    pagos de cadena del mes [{id,q,desc,det,monto,tuyo,comp,paid}]
app_ccfg             config cadena {puestos,valor,mesInicio,anioInicio,d1,d2,dPago,t1,t2}
app_mrc              lista mercado [{id,name,icon,cat,on}]
app_tc               {saldo, cuota}
app_meta             {total, metaCasa}
app_prima_{Y}_{M}    distribución de prima
app_drive_cid        Client ID OAuth
app_drive_fid        file ID del respaldo en Drive
```

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
- Getters/setters de storage: `gD()/sD()` (mes actual), `gM()/sM()` (mercado), `gTc()/sTc()`, `gMeta()/sMeta()`, `gCfg()` (cadena), `gCfgApp()/sCfgApp()` (config usuario)
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

## Deploy
`git push` a main → Netlify redespliega (~30s). No hay pipeline de build ni tests automatizados (backlog).

## Backlog conocido
- Notificaciones push (service worker, iOS 16.4+)
- Restauración automática desde Drive al abrir
- Modo oscuro
- Gráfico por categorías
- Tests automatizados
- Versión multi-usuario pública
