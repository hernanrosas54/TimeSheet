# Control de Tiempo (Google Apps Script)

Aplicación web de registro de horas construida sobre Google Sheets + Apps Script.
Permite identificar al usuario por su correo, registrar tiempos contra proyectos y
tipos de actividad, y administrar las tablas maestras (Proyectos, Clientes,
Usuarios y Tipos de Actividad).

## Características

- **Registro de horas** por día, con vista previa de duración, totales y filtros.
  El botón **Ahora** junto a *Hora inicio* (y a *Hora fin*) rellena la hora actual
  redondeada al paso configurado.
- **Panel de registros del día** ordenado de la hora más reciente a la más antigua.
  Cada registro tiene un botón **⧉ Copiar** que lleva al formulario su proyecto,
  tipo de actividad y actividad, para retomar un trabajo ya iniciado sin volver a
  escribirlo.
- **Corrección de registros**: el botón **✎ Editar** de cada registro del día
  carga el formulario completo (proyecto, tipo, actividad, observaciones, fecha y
  horas); al guardar se actualiza esa fila de `Tiempos` en lugar de crear otra.
  Una banda ámbar avisa de que se está editando y permite cancelar.
- **Proyectos** con las horas dedicadas en el mes, en el mes anterior y en el año,
  calculadas desde la hoja `Tiempos` (no se almacenan). Los encabezados
  **Horas Mes**, **Horas Mes Anterior** y **Horas Año** se ordenan al hacer clic:
  primer clic de mayor a menor, segundo de menor a mayor y tercero quita el orden.
- **Edición de tablas** mediante el enlace del nombre; las columnas calculadas
  nunca se envían al servidor.
- **Datos en Google Sheets**: el script crea la hoja `Control de Tiempo` con las
  cinco tablas y guarda el `SPREADSHEET_ID` en las propiedades del script.
- **Sin dependencias externas** en el cliente ni en las pruebas (DOM simulado).

## Estructura

| Archivo | Contenido |
|---|---|
| `Code.gs` | `doGet`, inclusión de parciales HTML. |
| `Config.gs` | Constantes, hojas, esquema (`SCHEMA`) y columnas calculadas. |
| `Utils.gs` | Utilidades de fechas, texto y minutos. |
| `Auth.gs` | Identificación del usuario por correo. |
| `Data.gs` | Lectura/escritura de hojas y saneamiento de filas. |
| `Api.gs` | API expuesta a `google.script.run` (listados, guardado, totales). |
| `Setup.gs` | Siembra inicial de la hoja y validaciones. |
| `Index.html` | Marcado principal y favicon (data URI). |
| `Styles.html` | Estilos (Tailwind + clases propias como `.link-cell`). |
| `ClientCore.html` | Estado, utilidades y mensajes del cliente. |
| `ClientApp.html` | Arranque, identificación, pestañas y catálogos. |
| `ClientTime.html` | Registro de horas del día. |
| `ClientTables.html` | Listado y edición de las tablas maestras. |
| `tests/` | Pruebas del cliente en Node (`node tests/client.smoke.js`). |
| `assets/favicon.svg` | Fuente editable del icono (no se sube a Apps Script). |
| `DEPLOY.md` | Vinculación con clasp, despliegue y notas de favicon. |

## Puesta en marcha

```powershell
clasp -u hrosas push -f                         # sube los 14 archivos del proyecto
node tests/client.smoke.js                      # 91 comprobaciones del cliente
```

Tras el push, ejecutar `setupTimeSheet` una vez en el editor de Apps Script y
publicar la aplicación web (*Implementar → Nueva implementación → Aplicación web*).
Los detalles (script ID, cuenta autorizada, permisos, favicon) están en
[DEPLOY.md](DEPLOY.md).

## Pruebas

```powershell
node tests/client.smoke.js
```

Ejecuta los parciales HTML en Node con un DOM simulado y un `google.script.run`
falso. Salida esperada: `Todas las comprobaciones pasaron.` y código 0.
