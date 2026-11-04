/* Prueba de humo (temporal) del cliente: se ejecuta con `node tests/client.smoke.js`. */
const env = require('./client-harness.js');

const { context, get, calls, check, failures, tick } = env;

(async function run() {
  // 0) Coherencia estatica: todo id usado por el JS debe existir en Index.html
  //    (los demas se crean dinamicamente en dialogos o al reintentar el arranque).
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..');
  const dynamic = new Set(['bootRetry', 'rowForm', 'rowError', 'rowSave', 'modalRoot', 'toasts']);
  const used = new Set();
  ['ClientCore.html', 'ClientTime.html', 'ClientTables.html', 'ClientApp.html'].forEach((file) => {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const re = /(?:el|getElementById)\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g;
    let match;
    while ((match = re.exec(text))) used.add(match[1]);
  });
  const index = fs.readFileSync(path.join(root, 'Index.html'), 'utf8');
  const unresolved = Array.from(used).filter((id) => !dynamic.has(id) && index.indexOf('id="' + id + '"') === -1);
  check('ids del JS presentes en Index.html', unresolved.length === 0, unresolved.join(', '));

  // 1) Arranque: identificacion por correo y pantalla principal.
  await tick(120);
  check('boot oculta #bootScreen', get('bootScreen').classList.contains('hidden'));
  check('boot muestra #appShell', !get('appShell').classList.contains('hidden'), get('appShell').classList.value);
  check('usuario en badge', /JP/.test(get('userBadge').textContent) && /Juan/.test(get('userBadge').textContent), get('userBadge').textContent);
  check('enlace a la hoja', get('sheetLink').href === 'https://docs.google.com/spreadsheets/d/x', String(get('sheetLink').href));
  check('tabs renderizados', /data-page="time"/.test(get('tabs').innerHTML) && /data-page="entries"/.test(get('tabs').innerHTML), get('tabs').innerHTML.slice(0, 120));

  // 2) Carga del dia y totales.
  check('apiDayEntries llamado', calls.some((c) => c[0] === 'apiDayEntries'));
  check('total del dia formateado', get('dayTotal').textContent === '1 h 30 min', get('dayTotal').textContent);
  check('lista del dia con filas', /Maquetado/.test(get('dayList').innerHTML), get('dayList').innerHTML.slice(0, 160));
  check('fecha por defecto', get('entryDate').value === '2026-11-04', get('entryDate').value);
  check('hora inicio por defecto', get('startTime').value === '09:30', get('startTime').value);
  check('hint de tipos', /2 tipos disponibles/.test(get('typeHint').textContent), get('typeHint').textContent);

  // 3) Vista previa de duracion.
  get('startTime').value = '08:00';
  get('endTime').value = '09:35';
  get('endTime').dispatch('input');
  get('endTime').dispatch('change');
  check('preview de duracion', /1 h 35 min/.test(get('durationPreview').textContent), get('durationPreview').textContent);

  // 3b) Boton "Ahora" junto a la hora de inicio (redondeada al paso de 10 min).
  const expectedNow = env.evalIn('Core.currentRoundedTime(10)');
  get('startTime').value = '';
  get('btnStartNow').dispatch('click');
  check('boton Ahora rellena la hora de inicio', get('startTime').value === expectedNow, get('startTime').value + ' != ' + expectedNow);
  check('hora del boton redondeada a 10 min', /^([01]\d|2[0-3]):[0-5]0$/.test(get('startTime').value), get('startTime').value);

  // 4) Guardado correcto.
  const before = calls.length;
  get('projectInput').value = '15';
  get('typeInput').value = 'programacion';
  get('activity').value = 'Maquetado home';
  get('startTime').value = '08:00';
  get('endTime').value = '09:00';
  context.TimePage.save();
  await tick(120);
  const savedCall = calls.slice(before).find((c) => c[0] === 'apiSaveTimeEntry');
  check('apiSaveTimeEntry llamado', !!savedCall);
  if (savedCall) {
    const payload = savedCall[1][0];
    check('payload.proyecto', payload.proyecto === '15', JSON.stringify(payload));
    check('payload.tipoActividad', payload.tipoActividad === 'Programacion', payload.tipoActividad);
    check('payload.fecha', payload.fecha === '2026-11-04', payload.fecha);
    check('payload.horas', payload.horaInicio === '08:00' && payload.horaFin === '09:00', payload.horaInicio + '-' + payload.horaFin);
    check('payload.actividad', payload.actividad === 'Maquetado home', payload.actividad);
  }
  check('hora inicio avanza al fin', get('startTime').value === '09:00', get('startTime').value);
  check('actividad limpiada', get('activity').value === '', get('activity').value);
  check('sin error en formulario', get('formError').classList.contains('hidden'), get('formError').textContent);

  // 5) Validaciones del formulario.
  get('projectInput').value = '15';
  get('typeInput').value = 'Programacion';
  get('activity').value = 'X';
  get('startTime').value = '09:00';
  get('endTime').value = '08:00';
  const beforeInvalid = calls.length;
  context.TimePage.save();
  await tick(80);
  check('no guarda con rango invalido', !calls.slice(beforeInvalid).some((c) => c[0] === 'apiSaveTimeEntry'));
  check('muestra error de rango', /finalizaci/i.test(get('formError').textContent), get('formError').textContent);

  get('projectInput').value = '';
  get('endTime').value = '10:00';
  get('activity').value = '';
  const beforeEmpty = calls.length;
  context.TimePage.save();
  await tick(80);
  check('no guarda sin proyecto', !calls.slice(beforeEmpty).some((c) => c[0] === 'apiSaveTimeEntry'));
  check('muestra error de proyecto', /proyecto/i.test(get('formError').textContent), get('formError').textContent);

  get('projectInput').value = '15';
  const beforeNoActivity = calls.length;
  context.TimePage.save();
  await tick(80);
  check('no guarda sin actividad', !calls.slice(beforeNoActivity).some((c) => c[0] === 'apiSaveTimeEntry'));
  check('muestra error de actividad', /actividad/i.test(get('formError').textContent), get('formError').textContent);

  // 6) Tablas: listado.
  env.evalIn('Core.navigate("table:Proyectos")');
  await tick(120);
  check('apiListTable llamado', calls.some((c) => c[0] === 'apiListTable' && c[1][0] === 'Proyectos'));
  check('tabla con filas', /Sitio web/.test(get('tableHost').innerHTML), get('tableHost').innerHTML.slice(0, 200));
  const tableHtml = get('tableHost').innerHTML;
  check('nombre enlazado para editar', /class="link-cell"[^>]*data-action="edit"[^>]*>Sitio web</.test(tableHtml), tableHtml.slice(0, 300));
  check('sin botones de accion', !/data-action="delete"/.test(tableHtml) && !/btn-sm/.test(tableHtml), tableHtml.slice(0, 300));
  check('horas del mes', /1 h 30 min/.test(tableHtml), tableHtml.slice(0, 400));
  check('horas del mes anterior sin datos', /—/.test(tableHtml), tableHtml.slice(0, 400));
  check('horas del año', /5 h</.test(tableHtml), tableHtml.slice(0, 400));
  check('contador de filas', /3 de 3/.test(get('tableCount').textContent), get('tableCount').textContent);

  // 6b) Encabezados ordenables de las columnas de horas.
  const sortButtons = (tableHtml.match(/data-action="sort"/g) || []).length;
  check('tres encabezados ordenables', sortButtons === 3, String(sortButtons));
  check('etiquetas cortas de horas', /Horas Mes</.test(tableHtml) && /Horas Mes Anterior</.test(tableHtml) && /Horas Año</.test(tableHtml), tableHtml.slice(0, 500));
  check('flecha neutra antes de ordenar', /th-sort-arrow">⇅</.test(tableHtml) && !/is-active/.test(tableHtml), tableHtml.slice(0, 500));

  context.TablesPage.sortBy('minutosMes');
  let sortedHtml = get('tableHost').innerHTML;
  check('primer clic ordena descendente', /th-sort is-active"[^>]*data-field="minutosMes"/.test(sortedHtml) && /th-sort-arrow">▼</.test(sortedHtml), sortedHtml.slice(0, 600));
  check('mayor tiempo primero', sortedHtml.indexOf('App móvil') < sortedHtml.indexOf('Sitio web') && sortedHtml.indexOf('Sitio web') < sortedHtml.indexOf('Soporte'), sortedHtml.slice(0, 800));

  context.TablesPage.sortBy('minutosMes');
  sortedHtml = get('tableHost').innerHTML;
  check('segundo clic ordena ascendente', /th-sort-arrow">▲</.test(sortedHtml) && sortedHtml.indexOf('Soporte') < sortedHtml.indexOf('Sitio web') && sortedHtml.indexOf('Sitio web') < sortedHtml.indexOf('App móvil'), sortedHtml.slice(0, 800));

  context.TablesPage.sortBy('minutosMes');
  sortedHtml = get('tableHost').innerHTML;
  check('tercer clic quita el orden', /th-sort-arrow">⇅</.test(sortedHtml) && !/is-active/.test(sortedHtml) && sortedHtml.indexOf('Sitio web') < sortedHtml.indexOf('App móvil'), sortedHtml.slice(0, 800));

  context.TablesPage.sortBy('minutosAnio');
  sortedHtml = get('tableHost').innerHTML;
  check('el boton activo es Horas Año', /th-sort is-active"[^>]*data-field="minutosAnio"/.test(sortedHtml) && /th-sort-arrow">▼</.test(sortedHtml), sortedHtml.slice(0, 700));
  check('año: mayor tiempo primero', sortedHtml.indexOf('App móvil') < sortedHtml.indexOf('Sitio web') && sortedHtml.indexOf('Sitio web') < sortedHtml.indexOf('Soporte'), sortedHtml.slice(0, 800));
  context.TablesPage.sortBy('minutosAnio');
  context.TablesPage.sortBy('minutosAnio');

  // 7) Entradas: filtros y listado.
  env.evalIn('Core.navigate("entries")');
  await tick(120);
  check('apiListEntries llamado', calls.some((c) => c[0] === 'apiListEntries'));
  check('entradas renderizadas', /Maquetado/.test(get('entriesHost').innerHTML), get('entriesHost').innerHTML.slice(0, 200));
  check('resumen de entradas', /1 h 30 min/.test(get('entriesSummary').textContent), get('entriesSummary').textContent);

  // 8) Editor de tablas: alta de un registro.
  context.TablesPage.openEditor(null);
  const panel = get('modalRoot').querySelector('.modal-panel');
  const field = (name) => panel.querySelector('#f_' + name);
  field('nombre').value = 'Proyecto nuevo';
  field('numeroCliente').value = '1';
  field('activo').checked = true;
  field('fechaCreacion').value = '2026-11-04';
  const beforeSave = calls.length;
  panel.querySelector('#rowForm').dispatch('submit');
  await tick(160);
  const savedRow = calls.slice(beforeSave).find((c) => c[0] === 'apiSaveTableRow');
  check('apiSaveTableRow llamado', !!savedRow);
  if (savedRow) {
    check('guarda tabla correcta', savedRow[1][0] === 'Proyectos', String(savedRow[1][0]));
    check('payload.nombre', savedRow[1][1].nombre === 'Proyecto nuevo', JSON.stringify(savedRow[1][1]));
    check('payload.activo booleano', savedRow[1][1].activo === true, String(savedRow[1][1].activo));
    check('payload sin _row al crear', savedRow[1][1]._row === 0, String(savedRow[1][1]._row));
    check('payload sin columnas calculadas', savedRow[1][1].minutosMes === undefined && savedRow[1][1].minutosAnio === undefined, JSON.stringify(savedRow[1][1]));
  }
  check('modal cerrado tras guardar', get('modalRoot').innerHTML === '', get('modalRoot').innerHTML.slice(0, 60));

  // 9) Editor de tablas: validacion de obligatorios.
  context.TablesPage.openEditor(null);
  const panel2 = get('modalRoot').querySelector('.modal-panel');
  panel2.querySelector('#f_nombre').value = '';
  const beforeInvalidRow = calls.length;
  panel2.querySelector('#rowForm').dispatch('submit');
  await tick(80);
  check('no guarda sin nombre', !calls.slice(beforeInvalidRow).some((c) => c[0] === 'apiSaveTableRow'));
  check('error de campo obligatorio', /obligatorio/.test(panel2.querySelector('#rowError').textContent), panel2.querySelector('#rowError').textContent);
  env.evalIn('Core.closeModal()');

  // 10) Cambio de usuario (dialogo de confirmacion).
  const beforeSwitch = calls.length;
  const switching = context.App.switchUser();
  await tick(30);
  get('modalRoot').querySelector('.modal-panel').querySelector('[data-action="ok"]').dispatch('click');
  await switching;
  await tick(120);
  check('apiForgetIdentity llamado', calls.slice(beforeSwitch).some((c) => c[0] === 'apiForgetIdentity'));
  check('vuelve a pantalla de identificacion', !get('page-identity').classList.contains('hidden'), get('page-identity').classList.value);

  console.log('');
  if (failures.length) {
    console.log('FALLOS: ' + failures.length);
    failures.forEach((f) => console.log(' - ' + f));
    process.exitCode = 1;
  } else {
    console.log('Todas las comprobaciones pasaron.');
  }
})().catch((error) => {
  console.error('ERROR NO CONTROLADO', error);
  process.exitCode = 1;
});
