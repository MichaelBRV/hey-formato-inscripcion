# Hey! Higher Education Years — Formato de inscripción

El **formato de inscripción** oficial de Hey! convertido en un formulario web de 4 pasos.
Sin build ni dependencias: HTML + CSS + JS.

## Archivos

```
index.html                    El formulario (encabezado de marca + 4 pasos + pie)
styles.css                    Estilos con la paleta exacta del PDF oficial
app.js                        Pasos, validación, autoguardado, firma y envío
assets/                       Logos extraídos del PDF + el PDF original
landing-completa.html.bak     Versión anterior con secciones informativas (respaldo)
```

## Marca

Colores tomados directamente del PDF `HEY-Higher-Inscripción_EC e.pdf`:

| Color | Hex | Uso |
|---|---|---|
| Morado | `#5C2483` | Primario, acentos, botones |
| Morado oscuro | `#341853` | Bloque del título, franjas diagonales |
| Gris de marca | `#575756` | Logotipo |
| Lima | `#C2D940` | Acento y botón de envío |

Tipografías: **Poppins** (titulares, eco del lettering del formato),
**Inter** (interfaz) y **EB Garamond** (notas, eco del serif del PDF).

### Logos

Extraídos en vectorial del PDF y rasterizados a PNG con transparencia:

- `assets/logo-hey.png` — logotipo completo en gris (versión original)
- `assets/logo-hey-white.png` / `logo-hey-purple.png` — variantes de color
- `assets/mark-gray.png` / `mark-white.png` / `mark-purple.png` — solo el "Hey!"
- `assets/favicon.png`, `favicon-64.png` — icono morado con el wordmark

## Campos

Réplica completa del formato impreso:

1. **Programa** — tipo de programa, destino (12 países), fecha de inicio, nombre del programa.
2. **Datos personales** — nombre de pasaporte, nacimiento, sexo, tutor y su e-mail
   (correo de contacto), e-mail propio, dirección (calle, colonia, C.P., ciudad), teléfonos.
3. **Universidad** — universidad, promedio, nivel de idioma y "¿cómo te enteraste?".
4. **Confirmación** — resumen de lo capturado, firma dibujada en canvas,
   aceptación de condiciones generales y de tratamiento de datos, costo de $280 USD.

Extras: validación por paso con mensajes en español, aviso automático cuando la
persona es menor de edad, autoguardado en `localStorage` y copia descargable en texto.

## Conectar un backend

Abre `app.js` y edita el bloque `CONFIG` (arriba del archivo):

```js
var CONFIG = {
  ENDPOINT: 'https://formspree.io/f/xxxxxxx',   // tu endpoint POST (JSON)
  EMAIL_DESTINO: 'inscripciones@myhey.co',
  STORAGE_KEY: 'hey-inscripcion-v1'
};
```

El formulario envía un `POST` con `Content-Type: application/json` y un objeto plano
con todos los campos, más `firma_imagen` (PNG en base64), `costo_inscripcion` y `enviado_en`.

Si `ENDPOINT` queda vacío, la página sigue funcionando: valida, muestra la pantalla de
éxito y ofrece **Descargar mi copia** y **Enviar por correo** (abre el cliente de correo
con todos los datos ya redactados).

## Ver en local

```bash
python -m http.server 5173
```

Luego abre <http://localhost:5173>.

## Publicar

Es un sitio estático: sube la carpeta tal cual a Netlify, Vercel, GitHub Pages,
Cloudflare Pages o cualquier hosting. No requiere compilación.
