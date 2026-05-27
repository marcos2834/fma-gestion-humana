# FMA · Mi Perfil Laboral

Test gamificado de perfil laboral con informe premium generado con IA. Listo para desplegar en **Vercel + GitHub**.

---

## Lo que está en este repo

```
/api/                              ← Serverless functions
  create-perfil-payment.js          POST · crea preferencia Mercado Pago
  mercadopago-webhook-perfil.js     POST · recibe pago, genera informe, manda mail
  informe/[id].js                   GET  · sirve un informe específico

/lib/                              ← Lógica compartida (no son endpoints)
  profiles.js                       catálogo de 12 perfiles + helpers
  ai-report.js                      genera contenido con Claude API
  email-sender.js                   envía mail con link al informe
  render-report.js                  rellena el template HTML con los datos

/index.html                        ← Tu sitio actual (analizador de CV)
/perfil.html                       ← Test gamificado de 12 escenarios
/informe-sample.html               ← Sample visual del informe premium
/template-informe.html             ← Template con {{placeholders}} que la IA rellena

/vercel.json                       ← Config de routing y headers
/package.json                      ← Dependencias npm
/.gitignore                        ← Patrones para no commitear secretos
```

---

## Cómo desplegarlo (paso a paso)

### Paso 1 · Subir el código a GitHub

1. **Crear un repo** en https://github.com/new
   - Nombre sugerido: `fma-gestion-humana`
   - Privado (recomendado)
   - **NO inicialices con README/LICENSE/.gitignore** (ya están en el proyecto)

2. **Desde tu terminal** (en la carpeta del proyecto):
   ```bash
   cd "C:\Users\marco\OneDrive\Documentos\Claude\Projects\FMA"
   git init
   git add .
   git commit -m "Initial commit · Mi Perfil Laboral"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/fma-gestion-humana.git
   git push -u origin main
   ```
   Reemplazá `TU-USUARIO` por tu username de GitHub.

> **Si no tenés git instalado:** descargalo de https://git-scm.com/download/win. La instalación por defecto está bien.

### Paso 2 · Crear cuenta y proyecto en Vercel

1. Ir a https://vercel.com/signup y registrarte con tu cuenta de GitHub (es lo más rápido).
2. Ya logueado, click en **Add New... → Project**.
3. Vercel te lista los repos de tu GitHub. Buscá `fma-gestion-humana` y click **Import**.
4. En la pantalla de configuración:
   - **Framework Preset**: dejá "Other"
   - **Root Directory**: `./`
   - No agregues build command ni output directory — todo está como Vercel lo espera
5. **Antes de clickear Deploy**, agregá las Environment Variables (siguiente paso).

### Paso 3 · Configurar las variables de entorno en Vercel

Antes del primer deploy, abrí el panel **Environment Variables** en la pantalla de import (o después en Project Settings → Environment Variables) y agregá:

| Nombre | Cómo obtenerla |
|---|---|
| `MP_ACCESS_TOKEN` | Mercado Pago → Developers → Credenciales → Producción → Access Token (`APP_USR-...`) |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys → Create Key. Cargá USD 5+ de saldo. |
| `RESEND_API_KEY` | https://resend.com → API Keys → Create. (Plan free 3000/mes alcanza para arrancar) |
| `APP_BASE_URL` | `https://fmagestionhumana.com.ar` |
| `BLOB_READ_WRITE_TOKEN` | Se autogenera al activar Vercel Blob (paso 4) |

Marcalas todas como "Production". (Las podés dejar en "Preview" y "Development" también si querés que funcionen en deploys de prueba.)

### Paso 4 · Activar Vercel Blob (para guardar los informes generados)

1. En tu proyecto en Vercel, ir a la pestaña **Storage**.
2. **Create Database** → **Blob**.
3. Nombre: `fma-informes`. Región: `iad1` (US East, default).
4. Vercel agrega automáticamente la variable `BLOB_READ_WRITE_TOKEN` al proyecto.

> **Free tier:** 1 GB de storage, 100 GB de bandwidth/mes. Cada informe pesa ~50 KB → cabés ~20.000 informes en el free tier.

### Paso 5 · Primer deploy

Click **Deploy** en Vercel. En 1-2 minutos vas a tener una URL tipo `fma-gestion-humana.vercel.app`. Abrila para verificar que carga.

### Paso 6 · Conectar tu dominio fmagestionhumana.com.ar

1. En el proyecto en Vercel: **Settings → Domains → Add Domain**.
2. Escribí `fmagestionhumana.com.ar`. Vercel te va a mostrar los registros DNS que tenés que poner.
3. Andá al panel de control de tu proveedor de dominio (donde compraste fmagestionhumana.com.ar — ej. nic.ar, Namecheap, GoDaddy) y agregá los registros que indica Vercel:
   - Típicamente un `A` record apuntando a `76.76.21.21`
   - Y/o un `CNAME` para `www` apuntando a `cname.vercel-dns.com`
4. Esperá la propagación DNS (entre 1 minuto y unas horas, generalmente unos pocos minutos).
5. Una vez verificado, agregá también `www.fmagestionhumana.com.ar` para redirigir.

### Paso 7 · Configurar dominio y webhook en los servicios externos

**Resend** (envío de email):
- Ir a Resend → **Domains** → Add → `fmagestionhumana.com.ar`
- Agregar los registros DNS que muestra Resend en tu proveedor de dominio (SPF, DKIM, DMARC)
- Esperar verificación

**Mercado Pago** (webhook):
- Ir a https://www.mercadopago.com.ar/developers/panel/notifications/webhooks
- Agregar webhook URL: `https://fmagestionhumana.com.ar/api/mercadopago-webhook-perfil`
- Eventos: marcar **Pagos**
- Guardar

### Paso 8 · Test end-to-end

Con tarjeta de prueba de Mercado Pago (https://www.mercadopago.com.ar/developers/es/docs/checkout-api/integration-test/test-cards):

1. Abrir `https://fmagestionhumana.com.ar/mi-perfil-laboral`
2. Completar el test (12 escenarios)
3. Click "Quiero mi informe completo"
4. Pagar con tarjeta de prueba: `5031 7557 3453 0604` · CVV `123` · nombre `APRO`
5. Verificar:
   - [ ] Redirect a pantalla de éxito
   - [ ] Email llega al inbox del comprador en 2-3 min
   - [ ] Link del email abre un informe personalizado
   - [ ] El informe tiene el nombre del usuario, el perfil correcto, los 4 scores reales y texto personalizado por la IA
6. Revisar logs en Vercel (Project → Logs) para ver el procesamiento del webhook

---

## Plan de Vercel: importante

Tu webhook tiene `maxDuration: 60` segundos porque la generación con Claude puede tardar ~20-30 seg.

- **Vercel Hobby (free)**: solo permite hasta **10 segundos** de duración de función. **No alcanza** para el webhook.
- **Vercel Pro ($20/mes)**: permite hasta **60 segundos** ✓ Es lo que necesitás.

Recomendación: arrancá con Hobby para deployar todo. Cuando llegue el momento de testear el webhook, upgradeá a Pro. Te conviene tenerlo desde el día 1 si pensás monetizar.

---

## Costos operativos esperados

Asumiendo **100 informes vendidos por mes**:

| Concepto | Costo mensual |
|---|---|
| Vercel Pro | USD 20 |
| Anthropic Claude API (~USD 0.04/informe) | USD 4 |
| Resend (dentro del free tier) | $0 |
| Vercel Blob (dentro del free tier) | $0 |
| Mercado Pago (~3% comisión) | $15.000 ARS |
| **Costo variable total** | **~USD 24 + comisión MP** |
| Ingreso bruto (100 × $4.990) | $499.000 ARS (~USD 500) |
| **Margen bruto** | **>90%** |

A medida que crezca el volumen, los costos escalan linealmente pero el margen se mantiene alto.

---

## Iteración local con `vercel dev`

Si querés desarrollar localmente antes de cada push:

```bash
npm install -g vercel
cd "C:\Users\marco\OneDrive\Documentos\Claude\Projects\FMA"
npm install
vercel link    # primera vez: linkea con tu proyecto
vercel env pull .env.local   # baja las env vars de Vercel a tu máquina
vercel dev     # corre localmente en http://localhost:3000
```

> **IMPORTANTE:** `.env.local` está en `.gitignore`, nunca se sube a GitHub. Tus claves quedan seguras.

---

## Troubleshooting

**El webhook no llega:** verificar en Vercel logs si MP está llamando. Verificar URL en Mercado Pago panel.

**Email no llega:** verificar que Resend tenga el dominio verificado. Revisar spam. Ver logs de Resend.

**El informe llega vacío o roto:** revisar logs de la función `mercadopago-webhook-perfil`. Probablemente la respuesta de Claude no fue JSON válido. El código tiene un fallback que envía un informe base.

**Function timeout (504):** estás en plan Hobby. Pasate a Pro.

**Cambios en el template no se reflejan:** el módulo `render-report.js` cachea el template. Cada nuevo deploy recarga, pero localmente con `vercel dev` puede que necesites reiniciar.

---

## Roadmap post-launch

1. **A/B test de precio** ($3.990 vs $4.990 vs $6.990)
2. **Versión B2B (HR Dashboard)**: empresas mandan link a varios candidatos y reciben dashboard
3. **Email follow-up automático**: a quienes hicieron el test pero no pagaron, mail con descuento a las 48h
4. **Compartir resultado en redes**: ya está el botón, generar gancho viral después de los primeros 200 usuarios
5. **Más perfiles / más escenarios**: ampliar el pool a 20+ para más variedad

---

## Soporte

Dudas técnicas: revisar `DEPLOYMENT.md` (la versión anterior, para Express tradicional). Logs en Vercel dashboard.
