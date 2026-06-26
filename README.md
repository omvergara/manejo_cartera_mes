# 💰 Cartera

> Finanzas personales del mes, en **un solo archivo HTML**. Sin servidores, sin base de datos, sin frameworks, sin cuentas. Tus datos viven en tu navegador y, si quieres, en *tu* Google Drive.

![Tipo](https://img.shields.io/badge/tipo-PWA-blueviolet)
![Stack](https://img.shields.io/badge/stack-HTML%20%2B%20CSS%20%2B%20JS%20vanilla-f7df1e)
![Dependencias](https://img.shields.io/badge/dependencias-0-success)
![Plataforma](https://img.shields.io/badge/mobile--first-iOS%20%2F%20Safari-black)
[![Deploy](https://img.shields.io/badge/deploy-Cloudflare%20Pages-F38020)](https://cartera-mes.pages.dev)

### 🔗 En vivo → **[cartera-mes.pages.dev](https://cartera-mes.pages.dev)**

Aplicación web progresiva (PWA) de **cartera mensual personal**, pensada para usarse desde el iPhone. Pensada para el contexto financiero colombiano: prima semestral, cadenas de ahorro, FNA, quincenas y nómina.

---

## Tabla de contenidos

- [Características](#características)
- [Capturas](#capturas)
- [Cómo se usa](#cómo-se-usa)
- [Arquitectura](#arquitectura)
- [Despliegue](#despliegue)
- [Google Drive sync (opcional)](#configurar-google-drive-sync-opcional)
- [Instalación como app en iOS](#instalación-como-app-en-ios)
- [Troubleshooting](#troubleshooting)
- [Modelo de datos del respaldo](#modelo-de-datos-del-respaldo)
- [Stack](#stack)
- [Licencia](#licencia)

---

## Características

- **Gastos mensuales** con checklist de pagado/pendiente, montos editables, categorías (incluida **Familia**) y **gastos recurrentes** que se arrastran solos a los meses siguientes
- **Convención de mes** clara: el mes que ves = el mes que el dinero **cubre** (lo pagas el día de nómina del mes anterior); se enseña en el onboarding
- **Inicio enfocado en lo importante**: el número grande es **lo Libre del mes**, con recordatorio antes de la nómina, botón "apartar para ahorro" y aviso anticipado de la prima
- **Ahorros planillados** separados de los gastos (FNA, cadenas de ahorro)
- **Cadenas de ahorro (san) rediseñadas**: **una o varias** cadenas, **varios puestos**, split configurable (no solo 50/50), pago **mensual o quincenal**, y el **cobro del pozo** de tu turno visible
- **Lista de mercado** por categorías colapsables, con **selector de categoría** al agregar y registro del gasto total al terminar
- **Prima semestral** (junio/diciembre, norma laboral colombiana) con asistente de distribución y **monto real editable**
- **Tracker de deuda** (tarjeta) con **interés real (% E.A.)** y meses para liquidar por amortización (avisa si la cuota no cubre ni los intereses)
- **Meta de ahorro** con barra de progreso, abonos extra y **racha de meses ahorrando**
- **Historial mensual** con gráfico comparativo y **desglose por categorías**; el histórico **no se distorsiona** si te suben el salario (se congela el sueldo de cada mes)
- **Bloqueo con PIN** (hash local, nunca viaja al respaldo) y **modo oscuro** (tema iOS)
- **Exportar**: respaldo JSON completo + histórico CSV para Excel
- **Importar / restaurar**: reemplazo **atómico** desde JSON o Google Drive (sin dejar datos viejos mezclados)
- **Google Drive sync** (opcional): respaldo automático en cada cambio + **restauración** desde la nube

---

## Capturas

| Inicio | Gastos | Cadena de ahorro |
|:---:|:---:|:---:|
| ![Inicio](docs/01-inicio.png) | ![Gastos](docs/02-gastos.png) | ![Cadena](docs/03-cadena.png) |

| Mercado | Ajustes |
|:---:|:---:|
| ![Mercado](docs/04-mercado.png) | ![Ajustes](docs/06-ajustes.png) |

---

## Cómo se usa

1. **Primer arranque** → un onboarding pide los datos básicos (salario neto, día de nómina). Nada viene precargado: la app es genérica y cada quien configura lo suyo.
2. **Pantalla Inicio** → resumen del mes: neto, días para nómina, totales de gastos/ahorros y metas.
3. **Gastos** → marca lo pagado, edita montos, separa lo que es ahorro.
4. **Cadena** → configura tu cadena de ahorro y marca los pagos quincenales.
5. **Mercado** → arma la lista por categorías y registra el gasto al terminar.
6. **Más / Ajustes** → análisis histórico, prima, deuda, meta de ahorro, exportar/importar y conectar Google Drive.

La app navega entre meses (del mes más antiguo con datos hasta el mes actual +1) y vuelve al mes actual con **"Hoy ↩"**.

---

## Arquitectura

**Separación absoluta código / datos:** el código (`index.html`) es 100 % genérico y nunca contiene datos personales. Los datos viven en el navegador del usuario.

```
index.html  ← TODO: HTML + CSS + JS vanilla en un solo archivo
│
├── localStorage (claves con prefijo "app_")
│   ├── app_cfg            → nombre, salario neto, tipo de nómina y día(s)
│   ├── app_{YYYY}_{M}     → gastos del mes (+ snapshot del salario de ese mes)
│   ├── app_inc_{YYYY}_{M} → ingresos extra del mes
│   ├── app_cd_{YYYY}_{M}  → estado de pagos de cadena del mes (v2)
│   ├── app_ccfg           → cadenas (v2: array con posiciones, splits, frecuencia)
│   ├── app_mrc            → lista de mercado
│   ├── app_tc             → tarjeta de crédito (saldo, cuota, tasa % E.A.)
│   ├── app_meta           → ahorro total y meta
│   ├── app_sav_{Y}_{M}    → ahorro registrado por mes (racha y ritmo)
│   ├── app_prima_{Y}_{M}  → distribución de la prima del semestre
│   ├── app_pin            → hash del PIN (excluido del respaldo)
│   ├── app_drive_cid      → Client ID de Google OAuth
│   └── app_drive_fid      → ID del archivo de respaldo en Drive
│
└── Google Drive API (opcional)
    └── cartera_backup.json ← respaldo automático con scope drive.file
```

**Principio de privacidad:** los datos viven solo en el navegador del usuario y, opcionalmente, en *su* Google Drive. El scope `drive.file` solo permite a la app tocar archivos que ella misma creó — nunca el resto del Drive.

---

## Despliegue

### Requisitos
- Repo en GitHub (público o privado)
- Cuenta gratuita de Cloudflare Pages (o cualquier hosting estático: Netlify, Vercel, GitHub Pages)

### Pasos
1. Asegúrate de que `index.html` esté en la raíz del repo.
2. En Cloudflare Pages: **Create application → Pages → Connect to Git →** selecciona este repo.
3. **No configures build** (es HTML puro): deja Build command vacío y Output directory en la raíz. → **Deploy**.
4. Opcional: configura un dominio o cambia el subdominio del proyecto.

> Cada `git push` a la rama `main` redespliega automáticamente (~30 s).

---

## Configurar Google Drive sync (opcional)

1. Entra a [console.cloud.google.com](https://console.cloud.google.com) con tu cuenta **personal** de Google (no corporativa).
2. Crea un proyecto nuevo.
3. **APIs y servicios → Biblioteca →** habilita **Google Drive API**.
4. **Pantalla de consentimiento OAuth →** tipo **Externo →** crear.
   - En *Usuarios de prueba* agrega tu propio correo (evita el proceso de verificación de Google).
5. **Credenciales → Crear → ID de cliente OAuth → Aplicación web**.
   - *Orígenes de JavaScript autorizados*: la URL exacta de la app (`https://cartera-mes.pages.dev`, **sin** barra final).
6. Copia el **Client ID**.
7. En la app: **Ajustes → Conectar Google Drive →** pega el Client ID → autoriza.

### Notas sobre el token
- El access token expira en ~1 hora (diseño de Google Identity Services).
- La app funciona 100 % offline/local sin token; solo se pausa el respaldo automático.
- En *Ajustes* aparece **"Renovar token"** cuando expira; un toque lo reactiva.

---

## Instalación como app en iOS

Safari → abre la URL → botón **Compartir** → **Agregar a pantalla de inicio**. Queda con ícono propio y sin la barra del navegador, como una app nativa.

---

## Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| `Error 400: redirect_uri_mismatch` | App corriendo desde `file://` o URL no registrada | Registra la URL exacta en *Orígenes de JavaScript autorizados* |
| `Error 403: org_internal` | Pantalla de consentimiento en modo "Interno" (proyecto de cuenta Workspace) | Crea el proyecto desde una cuenta personal con consentimiento "Externo" |
| `Error 403: access_denied` | El usuario no está en la lista de prueba | Agrega el correo en *Usuarios de prueba* de la pantalla de consentimiento |
| Los datos desaparecieron | Caché de Safari borrado | Restaura desde Drive o JSON: *Ajustes → Importar respaldo* |
| Drive no sincroniza | Token expirado | *Ajustes →* toca la fila de Drive → re-autoriza |
| La app pide onboarding de nuevo | `localStorage` purgado | Importa el último respaldo |

---

## Modelo de datos del respaldo

El JSON exportado/importado es un objeto plano `{ clave: valorString }` con todas las claves `app_*` del `localStorage` (el **PIN se excluye** a propósito: es un bloqueo local por dispositivo). Los valores son strings JSON serializados. El restaurar reemplaza de forma **atómica** (borra lo anterior antes de escribir). Para restaurar manualmente desde la consola del navegador:

```js
const backup = { /* contenido del JSON */ };
Object.entries(backup).forEach(([k, v]) => localStorage.setItem(k, v));
location.reload();
```

---

## Tests

Smoke test sin dependencias (requiere Node 18+ y Chrome/Edge):

```bash
node test/smoke.mjs
```

Verifica que el JavaScript embebido compile y que el nombre del usuario se escape correctamente (protección anti-XSS). Sale con código 0 si todo pasa, apto para CI.

## Stack

- **HTML + CSS + JavaScript vanilla** — cero dependencias de build
- **Google Identity Services** (`accounts.google.com/gsi/client`) — solo para OAuth
- **Google Drive API v3** — REST directo con `fetch`

---

## Licencia

Uso personal. Si la adaptas para otros: los datos por defecto del onboarding están vacíos — cada usuario configura los suyos.
