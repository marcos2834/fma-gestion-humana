# Deployment · Mi Perfil Laboral

Guía paso a paso para poner online el test en `fmagestionhumana.com.ar/mi-perfil-laboral`.

## Archivos que ya están listos

| Archivo | Función | Estado |
|---|---|---|
| `perfil.html` | Frontend del test (12 escenarios + resultado + paywall) | ✅ Listo, integra con backend real |
| `informe-sample.html` | Sample del informe premium (referencia visual) | ✅ Listo |
| `index.html` | Sitio principal, ya tiene link al test en navbar | ✅ Actualizado |
| `backend-perfil.js` | Endpoints Node.js para Mercado Pago + IA + email | ⚠️ Drop-in, requiere agregarlo a tu server |
| `template-informe.html` | Template HTML del informe con placeholders | ❌ Hay que crearlo (basado en informe-sample.html) |

---

## Lo que falta hacer antes del launch

### 1. Subir los archivos al servidor

Tu hosting ya tiene `index.html` funcionando. Subí:
- `perfil.html` → carpeta raíz del sitio
- (Opcional) `informe-sample.html` si querés tenerlo accesible para mostrar a clientes corporativos

Configurá una **regla en el servidor** para que la URL `/mi-perfil-laboral` sirva el archivo `perfil.html`. Dependiendo de tu hosting:

**Nginx:**
```nginx
location = /mi-perfil-laboral {
    try_files /perfil.html =404;
}
```

**Apache (.htaccess):**
```apache
RewriteEngine On
RewriteRule ^mi-perfil-laboral/?$ /perfil.html [L]
```

**Node.js + Express (si servís el sitio desde Express):**
```js
app.get('/mi-perfil-laboral', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'perfil.html'));
});
```

### 2. Cuentas y servicios a crear

Necesitás 3 cuentas externas:

#### Mercado Pago — pasarela de pago

Si ya tenés Mercado Pago integrado para el analizador de CV, podés reusar la misma cuenta y access token. Si no:

1. Crear cuenta en https://www.mercadopago.com.ar
2. Ir a https://www.mercadopago.com.ar/developers → **Credenciales**
3. Copiar el **Access Token de Producción** (empieza con `APP_USR-...`)
4. Guardarlo en `MP_ACCESS_TOKEN` en tu `.env`
5. Configurar webhook en MP: https://www.mercadopago.com.ar/developers/panel/notifications/webhooks
   - URL: `https://fmagestionhumana.com.ar/api/mercadopago-webhook-perfil`
   - Eventos: marcar **Pagos**

#### Anthropic (Claude API) — genera los informes

1. Crear cuenta en https://console.anthropic.com
2. Cargar saldo (mínimo USD 5 alcanza para ~150 informes)
3. Ir a **API Keys** → Create Key
4. Guardar en `ANTHROPIC_API_KEY` en tu `.env`
5. Costo estimado por informe: USD 0.03–0.05. Margen sobre $4.990 ARS (~USD 5) es enorme.

#### Resend — envío de email

Resend tiene un free tier generoso (3.000 emails/mes gratis, suficiente para arrancar):

1. Crear cuenta en https://resend.com
2. Ir a **Domains** → Add Domain → `fmagestionhumana.com.ar`
3. Agregar los registros DNS que te indique Resend (SPF, DKIM, DMARC) en tu proveedor de dominio
4. Esperar verificación (puede tardar de minutos a horas)
5. Ir a **API Keys** → Create API Key (permisos: Sending access)
6. Guardar en `RESEND_API_KEY` en tu `.env`

> **Alternativa si ya usás otro proveedor (SendGrid, Mailgun, SMTP propio):** adaptá la función `sendReportEmail()` en `backend-perfil.js`.

### 3. Variables de entorno

Agregá a tu archivo `.env` (al lado del existente, no lo pises):

```env
MP_ACCESS_TOKEN=APP_USR-1234567890123456-xxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_API_KEY=re_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxx
APP_BASE_URL=https://fmagestionhumana.com.ar
REPORTS_DIR=/var/www/fma/reports
```

Asegurate de que la carpeta `REPORTS_DIR` exista y el proceso Node tenga permisos de escritura.

### 4. Instalar dependencias en el backend

En el servidor donde corre tu Node.js:

```bash
npm install mercadopago @anthropic-ai/sdk resend express
```

### 5. Integrar los endpoints al servidor Express existente

Copiar `backend-perfil.js` al servidor, y en tu archivo principal (ej. `server.js` o `app.js`):

```js
const perfilRouter = require('./backend-perfil');
app.use(perfilRouter);
```

Esto agrega los 3 endpoints nuevos: `POST /api/create-perfil-payment`, `POST /api/mercadopago-webhook-perfil`, `GET /informe/:id`.

### 6. Crear `template-informe.html`

El archivo `informe-sample.html` es el sample con contenido ejemplo de Marcos / El Mentor. Necesitás convertirlo en un template con placeholders.

**Lo más rápido:** copiá `informe-sample.html` como `template-informe.html` y reemplazá los textos hardcodeados por placeholders:

- "Marcos Arce" → `{{USER_NAME}}`
- "El Mentor" → `{{PROFILE_NAME}}`
- "🧭" → `{{PROFILE_EMOJI}}`
- "Su éxito se mide por el de su equipo" → `{{PROFILE_LEMA}}`
- Las fechas → `{{DATE}}`
- "70%", "75%", "45%", "80%" en los porcentajes → `{{SCORE_FOCO}}%`, etc.
- Los `style="width: 70%"` en las barras → `style="width: {{SCORE_FOCO}}%"`
- Cada párrafo descriptivo → su placeholder correspondiente (`{{INTRO_P1}}`, `{{INTRO_P2}}`, etc.)

> **Recomendación práctica:** abrí `informe-sample.html` y `backend-perfil.js` lado a lado, y por cada placeholder que ves en la función `renderReportTemplate()` reemplazás el contenido hardcodeado equivalente en el HTML.

Subí `template-informe.html` al servidor en la misma carpeta que `backend-perfil.js`.

### 7. Imagen Open Graph

Cuando alguien comparta el link del test en WhatsApp/LinkedIn/Twitter, se va a previsualizar la imagen `og-perfil.png`. Creá una de 1200×630px con: logo FMA + título "Mi Perfil Laboral · Test gratuito" + algo visual del perfil (por ejemplo el radar chart o el emoji 🧭). Subila a la raíz del sitio.

---

## Pre-launch checklist (verificá uno por uno)

- [ ] `perfil.html` accesible en `https://fmagestionhumana.com.ar/mi-perfil-laboral`
- [ ] El test se puede completar de punta a punta sin errores en la consola
- [ ] Los 3 mini-desafíos (drag, allocation 100pts, time allocation) funcionan
- [ ] El resultado muestra el perfil, el radar, las dimensiones y los tags
- [ ] El botón "Compartir mi perfil" descarga una imagen PNG
- [ ] El navbar de `index.html` tiene el link "🧭 Mi Perfil Laboral"
- [ ] **Test de pago end-to-end:** completar test → click premium → pagar con tarjeta de prueba MP → verificar redirect a pantalla de éxito
- [ ] **Test de webhook:** verificar en logs del servidor que llega la notificación de MP y se procesa
- [ ] **Test de generación de informe:** verificar que el archivo HTML se crea en `REPORTS_DIR`
- [ ] **Test de email:** verificar que llega el mail (revisar también spam)
- [ ] **Test del link del email:** clickear y ver que el informe se renderiza correctamente
- [ ] Probar en mobile (responsive funciona)
- [ ] Probar en Safari (algunas APIs como Canvas pueden tener quirks)
- [ ] Imagen og-perfil.png subida y previsualizable al compartir el link

---

## Tarjetas de prueba de Mercado Pago

Para testear sin gastar plata real, en modo producción usá estas tarjetas (https://www.mercadopago.com.ar/developers/es/docs/checkout-api/integration-test/test-cards):

- **Mastercard aprobada:** 5031 7557 3453 0604, CVV 123, vencimiento cualquier fecha futura
- **Visa rechazada:** 4509 9535 6623 3704

Nombre del titular: usar `APRO` para aprobar el pago, `OTHE` para que sea rechazado.

---

## Costos operativos esperados (orden de magnitud)

Asumiendo 100 informes vendidos por mes:

| Concepto | Costo mensual aprox |
|---|---|
| Anthropic Claude API (generación de informes) | ~USD 4 |
| Resend (email) | $0 (dentro del free tier) |
| Mercado Pago (~3% del ingreso) | ~$15.000 ARS |
| Hosting (si Node está en lo mismo que el sitio) | $0 marginal |
| **Total costo variable** | **~USD 19 + comisión MP** |
| Ingreso bruto (100 × $4.990) | $499.000 ARS (~USD 500) |
| **Margen bruto estimado** | **>90%** |

A medida que crezca el volumen, los costos escalan linealmente pero el margen se mantiene.

---

## Post-launch · Métricas a trackear

Si no lo tenés ya, te recomiendo agregar Google Analytics 4 o Plausible para medir:

- Visitas a `/mi-perfil-laboral`
- Tasa de finalización del test (cuántos llegan al resultado)
- Tasa de conversión a premium (cuántos pagan)
- Origen del tráfico (dónde funciona mejor el test)

Esto te va a permitir ajustar el funnel después.

---

## Si algo sale mal

- **El usuario pagó pero no llega el informe:** revisar logs del servidor → ver si llegó el webhook → ver si la IA respondió OK → ver si el email se envió.
- **El webhook no llega:** verificar configuración en MP → puede tardar de unos minutos a una hora la primera vez después de configurarlo.
- **La IA falla a veces:** el código tiene un fallback que envía un informe base. No es lo ideal pero el cliente recibe algo. Iterar el prompt si los outputs no son buenos.

---

## Siguientes pasos sugeridos post-launch

Una vez que esté online y validado:

1. **A/B test del precio** ($3.990 vs $4.990 vs $6.990) — pequeños ajustes pueden tener mucho impacto
2. **Versión B2B (HR)**: permitir que una empresa envíe el test a varios candidatos vía link único y reciba un dashboard comparativo. Reusa todo el motor.
3. **Email follow-up**: a las personas que hicieron el test gratis pero no pagaron, mandarles un mail a las 48hs con un descuento del 30%.
4. **Compartir resultado por LinkedIn/Insta**: el botón ya genera imagen, después de los primeros 200 usuarios pedirles que la posteen como gancho viral.
