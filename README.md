# Cartera — App de finanzas personales

PWA de cartera mensual personal. Sin servidores, sin base de datos externa, sin frameworks. Un solo archivo HTML con almacenamiento local y respaldo opcional a Google Drive.

## Características

- **Gastos mensuales** con checklist de pagado/pendiente, montos editables, iconos por categoría
- **Ahorros planillados** separados de gastos (FNA, cadenas de ahorro)
- **Cadena de ahorro** configurable: puestos, fechas quincenales, turnos de cobro, timeline completo
- **Lista de mercado** por categorías colapsables, con registro del gasto total al terminar
- **Prima semestral** (junio/diciembre, norma laboral colombiana) con asistente de distribución
- **Tracker de deuda** (tarjeta de crédito) con proyección de meses para liquidar
- **Meta de ahorro** con barra de progreso y abonos extra
- **Historial mensual** con gráfico comparativo
- **Días para nómina** en el header de todas las pantallas
- **Exportar**: respaldo JSON completo + histórico CSV para Excel
- **Importar**: restauración total desde JSON
- **Google Drive sync** (opcional): respaldo automático en cada cambio

## Arquitectura

```
index.html  ← TODO: HTML + CSS + JS vanilla en un archivo
│
├── localStorage (claves con prefijo "app_")
│   ├── app_cfg          → salario neto, día nómina, gasolina estimada
│   ├── app_{YYYY}_{M}   → gastos de cada mes (M = 0-11)
│   ├── app_cd_{YYYY}_{M}→ pagos de cadena del mes
│   ├── app_ccfg         → configuración de la cadena
│   ├── app_mrc          → lista de mercado
│   ├── app_tc           → tarjeta de crédito (saldo, cuota)
│   ├── app_meta         → ahorro total y meta
│   ├── app_prima_{Y}_{M}→ distribución de prima del semestre
│   ├── app_drive_cid    → Client ID de Google OAuth
│   └── app_drive_fid    → ID del archivo de respaldo en Drive
│
└── Google Drive API (opcional)
    └── cartera_backup.json ← respaldo automático con scope drive.file
```

**Principio de privacidad:** el código no contiene ningún dato personal. Los datos viven solo en el navegador del usuario y, opcionalmente, en SU Google Drive. El scope `drive.file` solo permite a la app tocar archivos que ella misma creó.

## Despliegue

### Requisitos
- Repo en GitHub (puede ser privado)
- Cuenta gratuita de Netlify (u otro hosting estático: Vercel, Cloudflare Pages)

### Pasos
1. Subir `index.html` al repo
2. En Netlify: Add new site → Import from GitHub → seleccionar repo → Deploy (sin build settings, es HTML puro)
3. Opcional: cambiar el nombre del sitio en Site settings

Cada `git push` a la rama principal redespliega automáticamente.

## Configurar Google Drive sync (opcional)

1. [console.cloud.google.com](https://console.cloud.google.com) con la cuenta **personal** de Google (no corporativa)
2. Crear proyecto nuevo
3. APIs y servicios → Biblioteca → habilitar **Google Drive API**
4. Pantalla de consentimiento OAuth → tipo **Externo** → crear
   - En "Usuarios de prueba" agregar el propio correo (evita el proceso de verificación de Google)
5. Credenciales → Crear → **ID de cliente OAuth** → Aplicación web
   - Orígenes de JavaScript autorizados: la URL exacta de la app (ej: `https://misitio.netlify.app`, sin barra final)
6. Copiar el Client ID
7. En la app: Ajustes → Conectar Google Drive → pegar Client ID → autorizar

### Notas sobre el token
- El access token expira ~1 hora (diseño de Google Identity Services)
- La app funciona 100% offline/local sin token; solo pausa el respaldo automático
- En Ajustes aparece "Renovar token" cuando expira; un toque lo reactiva

## Instalación como app en iOS

Safari → abrir la URL → botón Compartir → **Agregar a pantalla de inicio**. Queda con ícono propio y sin barra del navegador.

## Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| Error 400: redirect_uri_mismatch | App corriendo desde file:// o URL no registrada | Registrar la URL exacta en "Orígenes de JavaScript autorizados" |
| Error 403: org_internal | Pantalla de consentimiento en modo "Interno" (proyecto de cuenta Workspace) | Crear proyecto desde cuenta personal con consentimiento "Externo" |
| Error 403: access_denied | Usuario no está en lista de prueba | Agregar el correo en "Usuarios de prueba" de la pantalla de consentimiento |
| Datos desaparecieron | Caché de Safari borrado | Restaurar desde Drive o JSON: Ajustes → Importar respaldo |
| Drive no sincroniza | Token expirado | Ajustes → tocar fila de Drive → re-autorizar |
| La app pide onboarding de nuevo | localStorage purgado | Importar el último respaldo |

## Modelo de datos del respaldo

El JSON exportado/importado es un objeto plano `{ clave: valorString }` con todas las claves `app_*` del localStorage. Los valores son strings JSON serializados. Para restaurar manualmente desde consola del navegador:

```js
const backup = { /* contenido del JSON */ };
Object.entries(backup).forEach(([k,v]) => localStorage.setItem(k, v));
location.reload();
```

## Stack

- HTML + CSS + JavaScript vanilla (cero dependencias de build)
- Google Identity Services (`accounts.google.com/gsi/client`) solo para OAuth
- Google Drive API v3 (REST directo con fetch)

## Licencia

Uso personal. Si la adaptas para otros, los datos por defecto del onboarding están vacíos — cada usuario configura los suyos.
