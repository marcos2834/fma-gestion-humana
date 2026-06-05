# Sitio web institucional · FMA Gestión Humana

Sitio multipágina de la consultora, pensado para vivir en la raíz `fmagestionhumana.com.ar`,
con las herramientas accesibles desde ahí.

## Páginas (este repo · proyecto Vercel `fma-gestion-humana`)

| Ruta | Archivo | Contenido |
|---|---|---|
| `/` | `index.html` | Home de la consultora |
| `/herramientas` | `herramientas.html` | Herramientas (personas + RRHH/empresas) |
| `/nosotros` | `nosotros.html` | Misión, visión, valores, sedes |
| `/contacto` | `contacto.html` | Email, LinkedIn, formulario (mailto) |
| `/mi-perfil-laboral` | `perfil.html` (rewrite ya existente) | Test de Perfil Laboral · **backend en este repo** |

Recursos compartidos en `/assets/`: `site.css`, `site.js`, `logo-badge.svg`, `favicon.svg`.
`analizador-cv.html` queda como **respaldo sin enlazar** (su backend `/api/analyze-cv` vive en el otro proyecto).

## Arquitectura de dominios (objetivo: todo bajo fmagestionhumana.com.ar)

Hoy el **Analizador de CV** es un proyecto Vercel aparte que ocupa la raíz, con sus propios
endpoints (`/api/analyze-cv`, `/api/rewrite-cv`, `/api/save-pdf`, `/api/create-payment`).
Para unificar bajo la marca **sin cambiar el código de ninguna app**, solo se reasignan dominios:

| Qué | Antes | Después |
|---|---|---|
| Consultora + Perfil (este repo) | `perfil.fmagestionhumana.com.ar` | **`fmagestionhumana.com.ar`** (raíz) + sigue el subdominio perfil |
| Analizador de CV (proyecto aparte) | `fmagestionhumana.com.ar` (raíz) | **`cv.fmagestionhumana.com.ar`** |

El sitio enlaza "Analizar mi CV" a `https://cv.fmagestionhumana.com.ar`.
(Si preferís otro subdominio, avisame y lo cambio en los 4 HTML.)

## Checklist de publicación (orden recomendado, sin downtime de código)

1. **Subir este repo**
   `git add . && git commit -m "Sitio institucional FMA + logo" && git push`
   Vercel redeploya el proyecto `fma-gestion-humana`. No requiere env vars nuevas.

2. **Dar nueva dirección al Analizador de CV** (proyecto Vercel del analizador):
   Settings → Domains → Add → `cv.fmagestionhumana.com.ar`.
   En Cloudflare: CNAME `cv` → `cname.vercel-dns.com`. Esperar verificación.
   (El analizador sigue funcionando igual; solo cambia su URL.)

3. **Mover la raíz a este proyecto** (proyecto `fma-gestion-humana`):
   - En el proyecto del **analizador**: Settings → Domains → quitar `fmagestionhumana.com.ar`.
   - En **este** proyecto: Settings → Domains → Add → `fmagestionhumana.com.ar` (y `www`).
   - Verificar DNS (Vercel indica los registros). Propagación: minutos.

4. **Verificar**:
   - `fmagestionhumana.com.ar` → home de la consultora ✓
   - `fmagestionhumana.com.ar/mi-perfil-laboral` → test de Perfil ✓
   - `cv.fmagestionhumana.com.ar` → Analizador de CV funcionando ✓
   - Botón "Analizar mi CV" del sitio → abre el analizador ✓

> Nada del código de las apps se modifica: el Perfil ya está en este repo y el Analizador
> queda intacto en su proyecto. Solo se reasignan dominios.

## Unificación total (opcional, "Fase 4")

Si querés que el Analizador también viva **dentro de este repo** (sin subdominio, en
`/analizador-cv`), pasame los archivos de ese proyecto (frontend + `api/analyze-cv`,
`rewrite-cv`, `save-pdf`, `create-payment`) y lo integro acá. Entonces todo queda en un
solo proyecto y los links vuelven a ser internos.

## Notas

- **LinkedIn**: ya apunta a `https://www.linkedin.com/company/fma-gesti%C3%B3n-humana/`.
- **Logo**: SVG vectorial reconstruido (`assets/logo-badge.svg` + `favicon.svg`). Si tenés
  el archivo original del diseñador, dejámelo en `assets/` y lo conecto.
