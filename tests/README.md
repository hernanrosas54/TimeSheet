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
- Listado de tablas con el nombre como enlace de edición (sin botones de alta
  baja), columnas calculadas de horas por proyecto y alta de registros desde el
  diálogo con validación de campos obligatorios.
- Listado de registros de tiempo con filtros y cambio de usuario.

Salida esperada: `Todas las comprobaciones pasaron.` (50 comprobaciones) y código
de salida 0.
