# Flor de Caju — Sistema de gestión de reservas

Sistema web para administrar las 6 habitaciones de la Pousada Flor de Caju:
calendario de ocupación, alta/edición/baja de reservas, y control de pagos
(quién pagó, quién debe y cuánto). Usa tu Google Sheet como base de datos,
y se aloja gratis en GitHub Pages.

## Cómo funciona

```
GitHub Pages (sitio estático: HTML/CSS/JS)
        │  fetch()
        ▼
Google Apps Script (API)  ───►  Tu Google Sheet (Habitaciones / Reservas / Pagos)
```

No hay servidor propio que mantener: Google Apps Script actúa de API gratis
sobre tu planilla, y GitHub Pages sirve los archivos del sitio.

## Paso 1 — Preparar la planilla (Google Sheets)

1. Abrí tu Google Sheet: https://docs.google.com/spreadsheets/d/124Qa5xD67g_deYiHhiZlRy7kgFN1fsDnKBFyU9hOGTM
2. Menú **Extensiones → Apps Script**.
3. Se abre un editor de código. Borrá todo el contenido del archivo
   `Código.gs` y pegá **todo** el contenido del archivo
   [`apps-script/Code.gs`](apps-script/Code.gs) de este proyecto.
4. Guardá (ícono de disquete o Ctrl/Cmd+S).
5. En la barra de arriba del editor, donde dice el nombre de la función,
   elegí **setup** y tocá **Ejecutar (▶)**.
   - La primera vez te va a pedir autorización: elegí tu cuenta, tocá
     "Avanzado" y "Ir a (nombre del proyecto), no seguro" si aparece esa
     pantalla (es normal, es tu propio script).
6. Volvé a la planilla: ahora deberías ver 3 hojas nuevas: **Habitaciones**
   (con tus 6 habitaciones ya cargadas), **Reservas** y **Pagos**.

### Ajustar tus habitaciones

En la hoja **Habitaciones** ya están precargadas según lo que me contaste:

| id | nombre | capacidad | tiene_cocina |
|---|---|---|---|
| hab_1 | Departamento | 4 | NO |
| hab_2 | Kitnet | 2 | SI |
| hab_3 | Suite 3 | 2 | SI |
| hab_4 | Suite 4 | 2 | NO |
| hab_5 | Suite 5 | 2 | NO |
| hab_6 | Suite 6 | 2 | NO |

Podés renombrarlas directamente desde la web (pestaña "Habitaciones", el
nombre es editable con un clic) o a mano en la planilla.

## Paso 2 — Publicar la API

1. En el editor de Apps Script: **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Configuración:
   - **Ejecutar como:** Yo (tu cuenta de Google)
   - **Quién tiene acceso:** Cualquier usuario
4. Tocá **Implementar** y autorizá si te lo pide de nuevo.
5. Copiá la **URL de la aplicación web** que te muestra (termina en `/exec`).
   Guardala, la vas a necesitar en el Paso 4.

> **Importante:** cada vez que modifiques el código en `Code.gs` y quieras
> que el sitio use los cambios, tenés que hacer **Implementar → Gestionar
> implementaciones → ✎ (editar) → Nueva versión → Implementar**. Si solo
> guardás el archivo sin crear una nueva versión, el sitio va a seguir
> usando el código viejo.

## Paso 3 — Subir el sitio a GitHub

1. Creá un repositorio nuevo en GitHub (puede ser privado o público; en
   ambos casos la URL de GitHub Pages queda pública, pero nadie va a
   adivinarla sin que la compartas).
2. Subí **todos los archivos de este proyecto** excepto la carpeta
   `apps-script/` (esa es solo para pegar en el editor de Google, no
   hace falta subirla, aunque tampoco molesta si la subís).
3. En el repo: **Settings → Pages → Source: Deploy from a branch**, rama
   `main`, carpeta `/ (root)`. Guardá.
4. En un par de minutos tu sitio va a estar en
   `https://TU-USUARIO.github.io/TU-REPO/`.

## Paso 4 — Conectar el sitio con tu planilla

1. Abrí tu sitio (la URL de GitHub Pages).
2. Te va a pedir la URL de la aplicación web de Apps Script: pegá la que
   copiaste en el Paso 2 (la que termina en `/exec`).
3. Listo — ya podés cargar reservas, y todo se guarda directo en tu Google
   Sheet.

Esa URL se guarda solo en el navegador donde la cargaste (localStorage). Si
entrás desde otro celular o computadora, te la va a volver a pedir esa
primera vez.

## Qué incluye el sistema

- **Calendario mensual**: de un vistazo, qué días están libres, con
  ocupación parcial o completos (las 6 habitaciones ocupadas).
- **Reservas**: alta, edición y baja, con aviso automático si la habitación
  elegida ya tiene otra reserva superpuesta en esas fechas.
- **Pagos**: registro de cada pago (fecha, monto, método), con saldo
  pendiente calculado solo. La pestaña "Pagos" muestra de un vistazo quién
  pagó todo, quién pagó una parte y quién todavía debe todo.
- **Habitaciones**: nombres editables, capacidad y si tiene cocinita.
- Como los precios cambian según temporada y demanda, el precio se carga a
  mano en cada reserva (no hay una tarifa fija por habitación) — así tenés
  control total temporada a temporada.

## Sobre conectarlo a tu landing page (próximo paso)

Me contaste que más adelante querés que, si un día no queda ninguna
habitación libre, tu landing page bloquee esa fecha automáticamente. Ya
quedó la base para eso: la función `doGet` del Apps Script puede ampliarse
para devolver una lista simple de "fechas sin disponibilidad" (por ejemplo
`?action=fechasBloqueadas`), y tu landing page puede pedirle esa lista con
un `fetch()` para deshabilitar esos días en su propio calendario o
formulario de contacto. Avisame cuándo quieras encararlo y con qué está
hecha tu landing (WordPress, HTML simple, Wix, etc.) para darte el código
exacto según esa plataforma.

## Seguridad

Como elegiste no usar login (acceso solo por link privado), tené en cuenta:

- No compartas la URL de tu sitio ni la de Apps Script en redes ni con
  gente ajena a la gestión de la pousada.
- Cualquiera que tenga la URL de Apps Script puede leer y escribir en tu
  planilla de reservas. Si en algún momento querés sumar una contraseña
  simple (sin armar un sistema de login completo), avisame y lo agregamos.
