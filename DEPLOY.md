# Despliegue con clasp (`Control de Tiempo`)

Este archivo NO se sube a Apps Script (`.claspignore` excluye `*.md`).

## Vinculación actual

| Dato | Valor |
|---|---|
| Proyecto de Apps Script | `TimeSheet` |
| Script ID | `1aYlN8DaaBzpc2Q0zQNRuwoxirfgNGg_KOtPFVV0Q6kDEA3ziFZ4P-7_0` |
| Credencial de clasp | usuario nombrado **`hrosas`** (hrosas@gmail.com) |
| `.clasp.json` | `rootDir: "."`, `scriptExtensions: ["gs"]`, `filePushOrder` (Config → Utils → Auth → Data → Api → Setup → Code) |

El archivo `~/.clasprc.json` guarda dos credenciales: `default` (systembi@iesa.edu.ve)
y `hrosas` (hrosas@gmail.com). **Siempre usa `-u hrosas`** para este proyecto:

```powershell
clasp -u hrosas show-authorized-user   # confirma con qué cuenta se publica
clasp -u hrosas status                 # archivos que se subirían (tests/ queda fuera)
clasp -u hrosas push -f                # sube .gs, .html y appsscript.json
clasp -u hrosas pull -f                # trae el proyecto remoto (sobrescribe local)
```

Si alguna vez hay que reautenticar: `clasp login --user hrosas`.

## Archivos que se publican (15)

`appsscript.json`, `Code.gs`, `Api.gs`, `Auth.gs`, `Config.gs`, `Data.gs`,
`Setup.gs`, `Utils.gs`, `Index.html`, `Styles.html`, `ClientApp.html`,
`ClientBulk.html`, `ClientCore.html`, `ClientTables.html`, `ClientTime.html`.

Quedan fuera: `tests/**`, `*.md`, `.clasp.json`, `.claspignore`.

## Verificar que el push subió TODO (evita versiones mezcladas)

`clasp push` puede quedar a medias (o alguien puede pegar solo un archivo en el
editor de Apps Script). Si `ClientTime.html` llega nuevo pero `Index.html` sigue
viejo, el cliente busca `#btnCancelEdit` y el arranque falla con:

```
No se pudo iniciar la aplicación
Cannot read properties of null (reading 'addEventListener')
```

Algo parecido ocurre con la pestaña **Carga múltiple**: si `ClientCore.html` ya
muestra la pestaña pero `Index.html` no trae la sección `#page-batch`, la pantalla
sale vacía (el cliente no engancha nada para no romper el arranque).

Antes de avisar que el cambio está listo, comparar el proyecto remoto con el
local (solo lectura, en una carpeta temporal):

```powershell
$d = Join-Path $env:TEMP 'remote_src'
Remove-Item -LiteralPath $d -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $d | Out-Null
Copy-Item .clasp.json, .claspignore $d
cd $d; clasp -u hrosas pull -f
cd c:\GAS\TimeSheet
foreach ($f in 'Index.html','Styles.html','ClientApp.html','ClientCore.html',
               'ClientBulk.html','ClientTables.html','ClientTime.html','Code.gs','Api.gs') {
  $a = Join-Path $d $f
  $norm = { param($p) ([IO.File]::ReadAllText($p)).Replace("`r`n","`n").TrimEnd() }
  "$f -> $(if ((& $norm $a) -eq (& $norm (Join-Path (Get-Location) $f))) { 'IGUAL' } else { 'DIFERENTE' })"
}
```

Todo debe salir `IGUAL`. Si alguno sale `DIFERENTE`, repetir
`clasp -u hrosas push -f` y volver a comparar antes de publicar la versión.

## Pasos posteriores al push (una sola vez)

1. **Inicializar la hoja**: en el editor de Apps Script
   (https://script.google.com/home/projects/1aYlN8DaaBzpc2Q0zQNRuwoxirfgNGg_KOtPFVV0Q6kDEA3ziFZ4P-7_0/edit)
   elegir la función `setupTimeSheet` → **Ejecutar** y autorizar los permisos.
   Crea la hoja `Control de Tiempo` con las 5 tablas, siembra los tipos de
   actividad y guarda el `SPREADSHEET_ID` en las propiedades del script.
   La URL de la hoja queda en el registro de ejecución (o ejecutar
   `showSpreadsheetUrl`).
2. **Desplegar**: *Implementar → Nueva implementación → Aplicación web*
   - Ejecutar como: **Yo (hrosas@gmail.com)**
   - Quién tiene acceso: **Cualquier usuario con cuenta de Google**
3. Compartir la hoja de cálculo con las personas que vayan a registrar horas
   (el script escribe en la hoja con la cuenta que lo ejecuta; con
   `executeAs: USER_DEPLOYING` solo esa cuenta necesita acceso a la hoja).
4. Probar en la URL `/exec`: identificar usuario, guardar y borrar registros de
   tiempo, y alta/edición de las tablas desde el enlace del nombre. El borrado
   de filas de las tablas (proyectos, clientes, usuarios, tipos) se retiró de la
   interfaz para no romper la integridad referencial de los tiempos; el servidor
   (`apiDeleteTableRow`) sigue existiendo y valida las referencias.
   La tabla de Proyectos muestra, calculadas desde la hoja `Tiempos`, las horas
   dedicadas en el mes, en el mes anterior y en el año en curso.
5. Probar el **drill down**: en *Proyectos*, la flecha **▾** junto al número abre
   el detalle del proyecto con esas tres cifras, los registros agrupados por mes
   (del actual hacia el pasado) y la paginación de 100 en 100. Si la flecha no
   aparece, el `Index.html`/`ClientTables.html` del despliegue está desactualizado.

## Publicar cambios en la URL `/exec`

`clasp push` solo actualiza el proyecto y la implementación de prueba (`/dev`).
La URL operativa `/exec` sigue apuntando a la **versión** que se le asignó a esa
implementación, así que después de cada push hay que crear una versión nueva y
reasignarla:

```powershell
clasp -u hrosas create-version "Descripcion del cambio"   # devuelve el numero de version
clasp -u hrosas list-deployments                          # ubicar el ID de la implementacion operativa
clasp -u hrosas update-deployment <ID> --versionNumber <N> -d "Operacional"
```

También se puede hacer desde el editor: *Implementar → Gestionar
implementaciones →* editar la implementación operativa *→ Versión: Nueva
versión → Implementar*.

## Favicon (icono de la pestaña)

El icono se define en `Index.html` con dos `<link rel="icon">` en **data URI**
(SVG para navegadores modernos + PNG 32x32 como respaldo). La fuente editable es
`assets/favicon.svg` (excluida del push por `.claspignore`).

**Limitación:** una aplicación web de Apps Script se sirve dentro de un iframe
(`*.googleusercontent.com`), así que el `<link rel="icon">` del HTML solo afecta
al documento interno y la pestaña sigue mostrando el icono de Apps Script. El
único mecanismo soportado para el icono de la pestaña es
`HtmlOutput.setFaviconUrl(url)`, que **solo acepta URLs http(s)** (nunca un data
URI). Para cambiar el icono de la pestaña hay que publicar el icono en una URL
https (GitHub Pages, jsDelivr sobre un repo, etc.) y volver a llamar en `Code.gs`
a `output.setFaviconUrl('https://…/favicon.svg')`.

Antes `doGet` llamaba a `HtmlOutput.setFaviconUrl('https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico')`,
y por eso la pestaña mostraba el icono de **Google Sheets** (ahora esa llamada ya
no está en `Code.gs`).

Para editar el icono interno: modificar `assets/favicon.svg` y regenerar el base64:

```powershell
$raw = ([System.IO.File]::ReadAllText('assets\favicon.svg') -replace "`r`n", "`n")
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($raw))
```

y reemplazar el `href` del `<link type="image/svg+xml">` en `Index.html`.

## Pruebas locales antes de cada push

```powershell
node tests/client.smoke.js   # 135 comprobaciones del cliente (debe salir EXIT=0)
```
