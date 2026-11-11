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
  ['ClientCore.html', 'ClientTime.html', 'ClientBulk.html', 'ClientTables.html', 'ClientApp.html'].forEach((file) => {
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
  check('total del dia formateado', get('dayTotal').textContent === '2 h', get('dayTotal').textContent);
  check('lista del dia con filas', /Maquetado/.test(get('dayList').innerHTML), get('dayList').innerHTML.slice(0, 160));
  const dayHtml = get('dayList').innerHTML;
  check('registros del dia por hora descendente',
    dayHtml.indexOf('08:00') !== -1 && dayHtml.indexOf('07:00') !== -1 && dayHtml.indexOf('08:00') < dayHtml.indexOf('07:00'),
    dayHtml.slice(0, 320));
  check('boton copiar en cada registro', (dayHtml.match(/data-copy-entry=/g) || []).length === 2, dayHtml.slice(0, 320));
  check('acciones del dia solo con icono',
    /btn-icon/.test(dayHtml) && /⧉/.test(dayHtml) && /✎/.test(dayHtml) && !/Copiar</.test(dayHtml) && !/Editar</.test(dayHtml),
    dayHtml.slice(0, 260));
  check('registro del dia a todo el ancho',
    /whitespace-nowrap/.test(dayHtml) && !/truncate/.test(dayHtml),
    dayHtml.slice(0, 260));
  check('fecha por defecto', get('entryDate').value === '2026-11-04', get('entryDate').value);
  check('hora inicio por defecto', get('startTime').value === '09:30', get('startTime').value);
  check('hint de tipos', /2 tipos disponibles/.test(get('typeHint').textContent), get('typeHint').textContent);

  // 2b) Boton de copiar de un registro del dia al formulario.
  const clickCopy = (index) => get('dayList').dispatch('click', {
    target: {
      closest: (selector) => (selector === '[data-copy-entry]' ? { dataset: { copyEntry: String(index) } } : null)
    }
  });

  get('entryDate').value = '2026-11-04';
  get('startTime').value = '09:30';
  clickCopy(0);
  check('copiar rellena el proyecto', get('projectInput').value === '15 · Sitio web', get('projectInput').value);
  check('copiar rellena el tipo de actividad', get('typeInput').value === 'Programacion', get('typeInput').value);
  check('copiar rellena la actividad', get('activity').value === 'Maquetado', get('activity').value);
  check('copiar no toca las horas', get('startTime').value === '09:30' && get('endTime').value === '',
    get('startTime').value + ' / ' + get('endTime').value);

  clickCopy(1);
  check('copiar el segundo registro', get('typeInput').value === 'Analisis' && get('activity').value === 'Revisión de backlog',
    get('typeInput').value + ' / ' + get('activity').value);

  // 2c) Boton editar: carga el registro completo en el formulario.
  const clickEdit = (index) => get('dayList').dispatch('click', {
    target: {
      closest: (selector) => (selector === '[data-edit-entry]' ? { dataset: { editEntry: String(index) } } : null)
    }
  });

  check('boton editar en cada registro', (dayHtml.match(/data-edit-entry=/g) || []).length === 2, dayHtml.slice(0, 320));
  check('sin modo edicion al inicio',
    context.TimePage.state.editing === null && !/^Editando/.test(get('editBannerText').textContent),
    JSON.stringify(context.TimePage.state.editing) + ' / ' + get('editBannerText').textContent);

  get('notes').value = 'algo escrito';
  clickEdit(0);
  check('editar rellena el proyecto', get('projectInput').value === '15 · Sitio web', get('projectInput').value);
  check('editar rellena el tipo de actividad', get('typeInput').value === 'Programacion', get('typeInput').value);
  check('editar rellena actividad y observaciones',
    get('activity').value === 'Maquetado' && get('notes').value === '', get('activity').value + ' / ' + get('notes').value);
  check('editar rellena fecha y horas',
    get('entryDate').value === '2026-11-04' && get('startTime').value === '08:00' && get('endTime').value === '09:30',
    get('entryDate').value + ' ' + get('startTime').value + '-' + get('endTime').value);
  check('banner de edicion visible',
    !get('editBanner').classList.contains('hidden') && /08:00/.test(get('editBannerText').textContent),
    get('editBannerText').textContent);
  check('boton guardar en modo edicion', get('btnSave').textContent === 'Guardar cambios', get('btnSave').textContent);
  check('registro en edicion resaltado', /border-amber-300/.test(get('dayList').innerHTML), get('dayList').innerHTML.slice(0, 200));

  // 2c-bis) Copiar mientras se edita: se vuelve al modo alta.
  clickCopy(0);
  check('copiar cancela el modo edicion',
    context.TimePage.state.editing === null && get('btnSave').textContent === 'Guardar registro',
    JSON.stringify(context.TimePage.state.editing) + ' / ' + get('btnSave').textContent);
  clickEdit(0);

  // 2d) Cancelar la edicion: no se guarda nada y el formulario queda limpio.
  const beforeCancel = calls.length;
  get('btnCancelEdit').dispatch('click');
  await tick(120);
  check('cancelar oculta el banner', get('editBanner').classList.contains('hidden'), get('editBanner').classList.value);
  check('cancelar restaura el boton', get('btnSave').textContent === 'Guardar registro', get('btnSave').textContent);
  check('cancelar limpia el formulario',
    get('activity').value === '' && get('projectInput').value === '' && get('endTime').value === '',
    get('activity').value + ' / ' + get('projectInput').value + ' / ' + get('endTime').value);
  check('cancelar no guarda', !calls.slice(beforeCancel).some((c) => c[0] === 'apiSaveTimeEntry'),
    JSON.stringify(calls.slice(beforeCancel).map((c) => c[0])));

  // 2e) Guardar en modo edicion: actualiza esa fila, no crea otra.
  clickEdit(1);
  check('editar el segundo registro',
    get('startTime').value === '07:00' && get('endTime').value === '07:30' && get('typeInput').value === 'Analisis',
    get('startTime').value + '-' + get('endTime').value + ' ' + get('typeInput').value);
  get('activity').value = 'Revisión de backlog corregida';
  get('endTime').value = '07:40';
  const beforeUpdate = calls.length;
  context.TimePage.save();
  await tick(140);
  const updateCall = calls.slice(beforeUpdate).find((c) => c[0] === 'apiSaveTimeEntry');
  check('modo edicion llama apiSaveTimeEntry', !!updateCall);
  if (updateCall) {
    const updatePayload = updateCall[1][0];
    check('payload._row de la fila editada', updatePayload._row === 9, JSON.stringify(updatePayload));
    check('payload.actividad corregida', updatePayload.actividad === 'Revisión de backlog corregida', updatePayload.actividad);
    check('payload conserva fecha y proyecto', updatePayload.fecha === '2026-11-04' && updatePayload.proyecto === '15',
      updatePayload.fecha + ' / ' + updatePayload.proyecto);
    check('payload.horas corregidas', updatePayload.horaInicio === '07:00' && updatePayload.horaFin === '07:40',
      updatePayload.horaInicio + '-' + updatePayload.horaFin);
  }
  check('termina el modo edicion',
    get('editBanner').classList.contains('hidden') && get('btnSave').textContent === 'Guardar registro',
    get('editBanner').classList.value + ' / ' + get('btnSave').textContent);
  check('hora inicio avanza al fin editado', get('startTime').value === '07:40', get('startTime').value);

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
    check('payload sin _row al crear', payload._row === undefined, String(payload._row));
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

  // 5b) Carga múltiple: seis líneas, fecha en el encabezado y encadenado de horas.
  env.evalIn('Core.navigate("batch")');
  await tick(60);
  const batch = context.BulkPage;
  check('pestaña de carga múltiple', /data-page="batch"/.test(get('tabs').innerHTML), get('tabs').innerHTML.slice(0, 180));
  check('pantalla de carga múltiple visible', !get('page-batch').classList.contains('hidden'));
  check('registrar tiempo oculto en carga múltiple', get('page-time').classList.contains('hidden'));
  check('seis líneas de captura', batch.state.rows.length === 6, String(batch.state.rows.length));
  check('fecha del encabezado por defecto', get('batchDate').value === '2026-11-04', get('batchDate').value);
  check('resumen inicial vacío', /^0 líneas completas$/.test(get('batchSummary').textContent), get('batchSummary').textContent);

  const batchRows = batch.state.rows;
  check('cada línea tiene sus campos',
    batchRows.every((row) => row.startEl && row.endEl && row.projectEl && row.typeEl && row.activityEl && row.notesEl));

  batchRows[0].startEl.value = '08:00';
  batchRows[0].endEl.value = '09:35';
  batchRows[0].endEl.dispatch('change');
  check('la hora fin se redondea', batchRows[0].endEl.value === '09:40', batchRows[0].endEl.value);
  check('la hora fin inicializa la línea siguiente', batchRows[1].startEl.value === '09:40', batchRows[1].startEl.value);
  check('resumen de líneas completas', /1 línea completa · 1 h 40 min/.test(get('batchSummary').textContent), get('batchSummary').textContent);

  batchRows[1].startEl.value = '10:00';
  batchRows[0].endEl.value = '09:20';
  batchRows[0].endEl.dispatch('change');
  check('no pisa la hora inicio ya escrita', batchRows[1].startEl.value === '10:00', batchRows[1].startEl.value);

  batchRows[5].endEl.value = '18:00';
  batchRows[5].endEl.dispatch('change');
  batch.addRow();
  check('agregar línea', batch.state.rows.length === 7, String(batch.state.rows.length));
  check('la línea nueva arranca en la hora fin anterior',
    batch.state.rows[6].startEl.value === '18:00', batch.state.rows[6].startEl.value);
  batch.clearAll();
  check('vaciar líneas vuelve a seis', batch.state.rows.length === 6, String(batch.state.rows.length));

  const freshRows = batch.state.rows;
  // El DOM simulado reutiliza los mismos nodos al reconstruir las líneas, así que
  // se limpian las horas que hubieran quedado de las pruebas anteriores.
  freshRows.forEach(function (row) {
    row.startEl.value = '';
    row.endEl.value = '';
  });
  get('batchDate').value = '2026-11-03';
  freshRows[0].startEl.value = '11:00';
  freshRows[0].endEl.value = '12:00';
  freshRows[0].projectEl.value = '16';
  freshRows[0].typeEl.value = 'Programacion';
  freshRows[0].activityEl.value = 'Soporte';
  freshRows[0].notesEl.value = 'Cierre de mes';

  const beforeBatchInvalid = calls.length;
  batch.save();
  await tick(100);
  check('no guarda líneas con proyecto inactivo',
    !calls.slice(beforeBatchInvalid).some((c) => c[0] === 'apiSaveTimeEntry'));
  check('marca la línea con error', /inactivo/.test(freshRows[0].errorEl.textContent), freshRows[0].errorEl.textContent);

  freshRows[0].projectEl.value = '15';
  freshRows[1].startEl.value = '11:30';
  freshRows[1].endEl.value = '12:30';
  freshRows[1].projectEl.value = '15';
  freshRows[1].typeEl.value = 'Analisis';
  freshRows[1].activityEl.value = 'Solape';

  const beforeOverlap = calls.length;
  batch.save();
  await tick(100);
  check('no guarda líneas solapadas', !calls.slice(beforeOverlap).some((c) => c[0] === 'apiSaveTimeEntry'));
  check('avisa del solapamiento', /solapa/.test(freshRows[1].errorEl.textContent), freshRows[1].errorEl.textContent);

  freshRows[1].startEl.value = '12:00';
  freshRows[1].endEl.value = '13:30';
  const toastsBeforeBatch = get('toasts').children.length;
  const beforeBatchSave = calls.length;
  batch.save();
  await tick(200);
  const batchCalls = calls.slice(beforeBatchSave).filter((c) => c[0] === 'apiSaveTimeEntry');
  check('guarda todas las líneas completas', batchCalls.length === 2, String(batchCalls.length));

  const firstBatchPayload = batchCalls[0] && batchCalls[0][1][0];
  const secondBatchPayload = batchCalls[1] && batchCalls[1][1][0];
  check('la carga múltiple usa la fecha del encabezado',
    !!firstBatchPayload && firstBatchPayload.fecha === '2026-11-03' &&
      firstBatchPayload.horaInicio === '11:00' && firstBatchPayload.horaFin === '12:00',
    JSON.stringify(firstBatchPayload));
  check('la línea lleva sus observaciones',
    !!firstBatchPayload && firstBatchPayload.observaciones === 'Cierre de mes' &&
      firstBatchPayload.actividad === 'Soporte',
    JSON.stringify(firstBatchPayload));
  check('payload de la segunda línea',
    !!secondBatchPayload && secondBatchPayload.horaInicio === '12:00' &&
      secondBatchPayload.horaFin === '13:30' && secondBatchPayload.tipoActividad === 'Analisis' &&
      secondBatchPayload.observaciones === '',
    JSON.stringify(secondBatchPayload));
  check('las líneas guardadas se vacían',
    freshRows[0].projectEl.value === '' && freshRows[1].activityEl.value === '' &&
      freshRows[0].notesEl.value === '',
    freshRows[0].projectEl.value + ' / ' + freshRows[1].activityEl.value + ' / ' + freshRows[0].notesEl.value);
  check('la línea siguiente continúa en la hora fin', freshRows[2].startEl.value === '13:30', freshRows[2].startEl.value);
  check('sin error en la carga múltiple', get('batchFormError').classList.contains('hidden'), get('batchFormError').textContent);

  const batchToasts = get('toasts').children.slice(toastsBeforeBatch).map((item) => item.innerHTML).join(' | ');
  check('aviso de líneas guardadas', /Guardados 2 registros del 03\/11\/2026/.test(batchToasts), batchToasts.slice(0, 180));

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

  // 6c) Drill down: la flecha junto al numero abre el detalle del proyecto.
  const drillHtml = get('tableHost').innerHTML;
  check('flecha de detalle junto al numero',
    /data-action="detail"[^>]*data-project="15"/.test(drillHtml) && /▾/.test(drillHtml) && /btn-icon/.test(drillHtml),
    drillHtml.slice(0, 360));

  const beforeDetail = calls.length;
  await context.TablesPage.openProjectDetail('15', 1);
  const detailPanel = get('modalRoot').querySelector('.modal-panel');
  const detailHost = detailPanel.querySelector('#detailHost');
  let detailHtml = detailHost.innerHTML;
  const detailCall = calls.slice(beforeDetail).find((c) => c[0] === 'apiProjectDetail');

  check('detalle pide el proyecto al servidor',
    !!detailCall && detailCall[1][0] === '15' && detailCall[1][1] === 1,
    detailCall ? JSON.stringify(detailCall[1]) : 'sin llamada');
  check('panel ancho para el detalle', detailPanel.classList.contains('modal-wide'));
  check('encabezado con los cuatro totales y el detalle',
    /Proyecto</.test(detailHtml) && /Horas en el mes</.test(detailHtml) &&
    /Horas en el mes anterior</.test(detailHtml) && /Horas en el año</.test(detailHtml) &&
    /Detalle</.test(detailHtml),
    detailHtml.slice(0, 420));
  check('proyecto con numero, nombre y periodo',
    /15 · Sitio web/.test(detailHtml) && /noviembre 2026/.test(detailHtml) &&
    /1 h 30 min/.test(detailHtml) && /5 h</.test(detailHtml),
    detailHtml.slice(0, 520));
  check('detalle agrupa por mes empezando por el actual',
    /Noviembre 2026/.test(detailHtml) && detailHtml.indexOf('Noviembre 2026') < detailHtml.indexOf('Primera del mes'),
    detailHtml.slice(0, 760));
  check('filas del detalle del dia 1 en adelante',
    detailHtml.indexOf('<td class="whitespace-nowrap">01/11/2026</td>') !== -1 &&
    detailHtml.indexOf('<td class="whitespace-nowrap">01/11/2026</td>') <
      detailHtml.indexOf('<td class="whitespace-nowrap">02/11/2026</td>') &&
    /Hora inicio</.test(detailHtml) && /Hora fin</.test(detailHtml) && /Observaciones</.test(detailHtml),
    detailHtml.slice(-700));
  check('detalle paginado de 100 en 100',
    /Página 1 de 2/.test(detailHtml) && /100 por página/.test(detailHtml) &&
    /data-detail-page="2"/.test(detailHtml) && /data-detail-page="0" disabled>‹ Anterior</.test(detailHtml),
    detailHtml.slice(-420));

  await context.TablesPage.loadProjectDetail(detailPanel, '15', 2);
  detailHtml = detailHost.innerHTML;
  check('detalle pide la pagina siguiente',
    calls.slice(beforeDetail).some((c) => c[0] === 'apiProjectDetail' && c[1][1] === 2),
    JSON.stringify(calls.slice(beforeDetail).map((c) => c[1])));
  check('segunda pagina del detalle',
    /Octubre 2026/.test(detailHtml) && /Página 2 de 2/.test(detailHtml) &&
    /De octubre/.test(detailHtml) && /05\/10\/2026/.test(detailHtml),
    detailHtml.slice(0, 620));
  env.evalIn('Core.closeModal()');

  await context.TablesPage.openProjectDetail('9', 1);
  const vacioHost = get('modalRoot').querySelector('.modal-panel').querySelector('#detailHost');
  check('detalle sin registros muestra aviso',
    /todavía no tiene registros/.test(vacioHost.innerHTML),
    vacioHost.innerHTML.slice(0, 320));
  env.evalIn('Core.closeModal()');
  await tick(40);

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

  // 10b) Api.gs desactualizado: el cliente envia "_row" pero el servidor responde
  //      como un alta (sin "updated"). Debe avisarse en vez de dar por corregido.
  const fakeEntry = {
    _row: 9, proyecto: '15', tipoActividad: 'Programacion', actividad: 'Maquetado',
    observaciones: '', fecha: '2026-11-04', horaInicio: '07:00', horaFin: '07:40', minutos: 40
  };
  const originalSave = env.backend.apiSaveTimeEntry;
  env.backend.apiSaveTimeEntry = function (payload) {
    calls.push(['apiSaveTimeEntry', [payload]]);
    const saved = Object.assign({ proyectoNombre: 'Sitio web', cliente: 'Acme', minutos: 60 }, payload, { _row: 45 });
    return { ok: true, data: { entry: saved, dayEntries: { fecha: payload.fecha, entries: [saved], totalMinutos: 60, count: 1 } } };
  };
  const toastsBefore = get('toasts').children.length;
  context.TimePage.editEntryToForm(fakeEntry);
  await tick(20);
  context.TimePage.save();
  await tick(160);
  env.backend.apiSaveTimeEntry = originalSave;
  const avisos = get('toasts').children.slice(toastsBefore)
    .map((item) => item.innerHTML).join(' | ');
  check('detecta servidor sin soporte de _row', /Api\.gs/.test(avisos), avisos.slice(0, 120));
  check('payload de la edicion llevaba _row', calls.slice(-1)[0][1][0]._row === 9, JSON.stringify(calls.slice(-1)[0][1][0]));

  // 11) HTML de otra version: si el aviso de edicion no existe, nada debe fallar.
  //     (Ese fue el error real: ClientTime nuevo + Index.html viejo => al arrancar
  //     se hacia addEventListener sobre un elemento nulo.)
  env.setMissing(['editBanner', 'editBannerText', 'btnCancelEdit']);
  let errorSinAviso = '';
  try {
    context.TimePage.state.bound = false;
    context.TimePage.init();
    context.TimePage.editEntryToForm(fakeEntry);
    context.TimePage.cancelEdit();
  } catch (error) {
    errorSinAviso = error.message;
  }
  env.setMissing([]);
  check('HTML sin aviso de edicion no rompe el arranque', errorSinAviso === '', errorSinAviso);

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
