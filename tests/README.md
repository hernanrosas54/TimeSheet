# Pruebas del cliente

`client.smoke.js` ejecuta los parciales `ClientCore.html`, `ClientTime.html`,
`ClientTables.html` y `ClientApp.html` en Node con un DOM simulado y un
`google.script.run` falso (sin dependencias externas).

```powershell
node tests/client.smoke.js
```

Comprueba, entre otras cosas:

- Coherencia entre los `id` que usa el JavaScript y el marcado de `Index.html`.
- Arranque, identificación por correo, badge de usuario y pestañas.
- Carga del día, totales, vista previa de duración y guardado de registros
  (incluidos los payloads enviados al servidor y las validaciones).
- Panel de registros del día ordenado por hora de inicio descendente y botón
  **Copiar** que rellena proyecto, tipo de actividad y actividad en el formulario
  sin modificar la fecha ni las horas.
- Botón **Ahora** junto a la hora de inicio: rellena la hora actual redondeada al
  paso configurado.
- Listado de tablas con el nombre como enlace de edición (sin botones de alta
  baja), columnas calculadas de horas por proyecto y alta de registros desde el
  diálogo con validación de campos obligatorios.
- Orden de las columnas calculadas de Proyectos: primer clic descendente, segundo
  ascendente y tercero quita el orden.
- Listado de registros de tiempo con filtros y cambio de usuario.

Salida esperada: `Todas las comprobaciones pasaron.` (68 comprobaciones) y código
de salida 0.
