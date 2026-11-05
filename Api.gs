/**
 * API pública usada por el front-end a través de google.script.run.
 *
 * Todas las funciones devuelven { ok: true, data: ... } o { ok: false, error: "..." }.
 */

function api_(fn) {
  try {
    return { ok: true, data: fn() };
  } catch (error) {
    var message = error && error.message ? error.message : String(error);
    try {
      console.error(error && error.stack ? error.stack : message);
    } catch (ignored) {
      // Sin registro disponible.
    }
    return { ok: false, error: message };
  }
}

function getEditableTables_() {
  return [
    CONFIG.SHEETS.CLIENTES,
    CONFIG.SHEETS.PROYECTOS,
    CONFIG.SHEETS.USUARIOS,
    CONFIG.SHEETS.TIPOS
  ];
}

/** Invalida los catálogos en caché. */
function bustReferenceCache_() {
  cacheRemove_(['clients', 'projects', 'types', 'users']);
}

/* ------------------------------------------------------------------ */
/* Catálogos                                                           */
/* ------------------------------------------------------------------ */

function getClients_(force) {
  if (!force) {
    var cached = cacheGet_('clients');
    if (cached) return cached;
  }

  var rows = readTable_(CONFIG.SHEETS.CLIENTES)
    .map(function (row) {
      return {
        numero: String(row.numero == null ? '' : row.numero).trim(),
        nombre: String(row.nombre == null ? '' : row.nombre).trim(),
        rif: String(row.rif == null ? '' : row.rif).trim(),
        ciudad: String(row.ciudad == null ? '' : row.ciudad).trim()
      };
    })
    .filter(function (client) {
      return !!client.numero;
    });

  rows.sort(function (a, b) {
    return naturalCompare_(a.numero, b.numero);
  });

  cachePut_('clients', rows);
  return rows;
}

function getProjects_(force) {
  if (!force) {
    var cached = cacheGet_('projects');
    if (cached) return cached;
  }

  var clientNames = {};
  getClients_(force).forEach(function (client) {
    clientNames[client.numero] = client.nombre;
  });

  var rows = readTable_(CONFIG.SHEETS.PROYECTOS)
    .map(function (row) {
      var numero = String(row.numero == null ? '' : row.numero).trim();
      var numeroCliente = String(row.numeroCliente == null ? '' : row.numeroCliente).trim() || '0';
      return {
        numero: numero,
        nombre: String(row.nombre == null ? '' : row.nombre).trim(),
        numeroCliente: numeroCliente,
        cliente: numeroCliente === '0' ? '' : (clientNames[numeroCliente] || ''),
        activo: row.activo === true,
        fechaCreacion: String(row.fechaCreacion == null ? '' : row.fechaCreacion).trim()
      };
    })
    .filter(function (project) {
      return !!project.numero;
    });

  rows.sort(function (a, b) {
    return naturalCompare_(a.numero, b.numero);
  });

  cachePut_('projects', rows);
  return rows;
}

function getActivityTypes_(force) {
  if (!force) {
    var cached = cacheGet_('types');
    if (cached) return cached;
  }

  var seen = {};
  var list = [];
  readTable_(CONFIG.SHEETS.TIPOS).forEach(function (row) {
    var tipo = String(row.tipo == null ? '' : row.tipo).trim();
    var key = normalizeText_(tipo);
    if (tipo && !seen[key]) {
      seen[key] = true;
      list.push(tipo);
    }
  });

  cachePut_('types', list);
  return list;
}

/** Última hora de finalización registrada por el usuario. */
function getLastEndTime_(codigo) {
  var code = String(codigo || '').toUpperCase();
  var bestKey = '';
  var bestTime = '';

  readTable_(CONFIG.SHEETS.TIEMPOS).forEach(function (row) {
    if (String(row.codigoUsuario || '').toUpperCase() !== code) return;
    var fecha = String(row.fecha || '');
    var horaFin = String(row.horaFin || '');
    if (!isValidIsoDate_(fecha) || !isValidTime_(horaFin)) return;
    var key = fecha + ' ' + horaFin;
    if (key > bestKey) {
      bestKey = key;
      bestTime = horaFin;
    }
  });

  return isValidTime_(bestTime) ? bestTime : currentRoundedTime_();
}

/** Busca un proyecto por número, nombre o combinación "número nombre". */
function findProject_(value) {
  var target = normalizeText_(value);
  if (!target) return null;
  var compactTarget = compactKey_(value);
  var projects = getProjects_();
  var i;

  for (i = 0; i < projects.length; i++) {
    if (normalizeText_(projects[i].numero) === target) return projects[i];
  }
  for (i = 0; i < projects.length; i++) {
    if (compactKey_(projects[i].numero + ' ' + projects[i].nombre) === compactTarget) return projects[i];
  }
  for (i = 0; i < projects.length; i++) {
    if (normalizeText_(projects[i].nombre) === target) return projects[i];
  }

  return null;
}

function compactKey_(value) {
  return normalizeText_(value).replace(/[^a-z0-9]/g, '');
}

/* ------------------------------------------------------------------ */
/* Arranque e identificación                                           */
/* ------------------------------------------------------------------ */

/** Datos iniciales de la aplicación (identidad, catálogos, esquemas, valores por omisión). */
function apiBootstrap() {
  return api_(function () {
    var identity = getIdentity_();
    var spreadsheet = getSpreadsheet_();

    var payload = {
      app: {
        title: CONFIG.APP_TITLE,
        today: todayIso_(),
        roundMinutes: CONFIG.ROUND_MINUTES,
        timeZone: getTimeZone_(),
        spreadsheetUrl: spreadsheet.getUrl()
      },
      identity: identity,
      schemas: buildClientSchemas_()
    };

    if (identity.user) {
      payload.clients = getClients_();
      payload.projects = getProjects_();
      payload.activityTypes = getActivityTypes_();
      payload.users = listUsers_().map(function (user) {
        return { codigo: user.codigo, nombre: user.nombre };
      });
      payload.defaults = {
        fecha: todayIso_(),
        horaInicio: getLastEndTime_(identity.user.codigo)
      };
    }

    return payload;
  });
}

/** Identifica al visitante con su código de usuario. */
function apiIdentifyUser(codigo) {
  return api_(function () {
    claimIdentity_(codigo);
    return apiBootstrap().data;
  });
}

/** Olvida la identificación guardada en este navegador. */
function apiForgetIdentity() {
  return api_(function () {
    forgetIdentity_();
    return apiBootstrap().data;
  });
}

/** Nombres de los meses en español para las etiquetas de periodo. */
var MONTH_NAMES_ES_ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Periodo actual, anterior y anual usados por las columnas calculadas.
 * Devuelve los textos para los encabezados y los prefijos "AAAA-MM"/"AAAA-"
 * con los que se filtran las fechas de la hoja Tiempos.
 */
function comparisonPeriods_() {
  var zone = getTimeZone_();
  var now = new Date();
  var year = Number(Utilities.formatDate(now, zone, 'yyyy'));
  var month = Number(Utilities.formatDate(now, zone, 'MM'));
  var previousYear = month === 1 ? year - 1 : year;
  var previousMonth = month === 1 ? 12 : month - 1;

  return {
    monthLabel: MONTH_NAMES_ES_[month - 1] + ' ' + year,
    previousMonthLabel: MONTH_NAMES_ES_[previousMonth - 1] + ' ' + previousYear,
    yearLabel: 'año ' + year,
    monthPrefix: year + '-' + pad2_(month),
    previousMonthPrefix: previousYear + '-' + pad2_(previousMonth),
    yearPrefix: String(year) + '-'
  };
}

/** Texto de ayuda (tooltip) de cada columna calculada. */
function computedColumnTitle_(field, periods) {
  if (field === 'minutosMes') return 'Horas dedicadas en ' + periods.monthLabel;
  if (field === 'minutosMesAnterior') return 'Horas dedicadas en ' + periods.previousMonthLabel;
  if (field === 'minutosAnio') return 'Horas dedicadas en el ' + periods.yearLabel;
  return '';
}

/**
 * Minutos registrados por proyecto en el mes en curso, el mes anterior y el
 * año en curso. Recorre la hoja Tiempos una sola vez.
 */
function getProjectMinutesSummary_() {
  var periods = comparisonPeriods_();
  var summary = { periods: periods, mes: {}, mesAnterior: {}, anio: {} };

  readTable_(CONFIG.SHEETS.TIEMPOS).forEach(function (row) {
    var fecha = String(row.fecha || '');
    if (!isValidIsoDate_(fecha)) return;

    var numero = String(row.proyecto == null ? '' : row.proyecto).trim();
    if (!numero) return;

    var minutos = Number(row.minutos) || 0;
    if (minutos <= 0) return;

    var monthKey = fecha.slice(0, 7);
    if (monthKey === periods.monthPrefix) summary.mes[numero] = (summary.mes[numero] || 0) + minutos;
    if (monthKey === periods.previousMonthPrefix) {
      summary.mesAnterior[numero] = (summary.mesAnterior[numero] || 0) + minutos;
    }
    if (fecha.indexOf(periods.yearPrefix) === 0) summary.anio[numero] = (summary.anio[numero] || 0) + minutos;
  });

  return summary;
}

/** Esquema de las tablas tal como lo consume el cliente (incluye columnas calculadas). */
/** Esquemas simplificados para construir formularios y tablas en el cliente. */
function buildClientSchemas_() {
  var result = {};
  var periods = comparisonPeriods_();

  Object.keys(SCHEMA).forEach(function (name) {
    var def = SCHEMA[name];

    var columns = def.columns.map(function (column) {
      return {
        field: column.field,
        label: column.label,
        type: column.type,
        input: column.input || 'text',
        options: column.options || '',
        required: !!column.required,
        readOnlyOnEdit: !!column.readOnlyOnEdit,
        computed: false,
        sortable: false,
        title: column.label,
        hint: column.hint || ''
      };
    });

    var computed = COMPUTED_COLUMNS[name] || [];
    computed.forEach(function (column) {
      columns.push({
        field: column.field,
        label: column.label,
        type: column.type,
        input: 'none',
        options: '',
        required: false,
        readOnlyOnEdit: true,
        computed: true,
        sortable: true,
        title: computedColumnTitle_(column.field, periods),
        hint: ''
      });
    });

    result[name] = {
      name: name,
      key: def.key,
      autoKey: !!def.autoKey,
      labelField: def.labelField || def.key || '',
      computedFields: computed.map(function (column) {
        return column.field;
      }),
      columns: columns
    };
  });

  return result;
}


/* ------------------------------------------------------------------ */
/* Registro de tiempos                                                 */
/* ------------------------------------------------------------------ */

/** Mapa número de proyecto -> proyecto. */
function getProjectMap_() {
  var map = {};
  getProjects_().forEach(function (project) {
    map[project.numero] = project;
  });
  return map;
}

/** Agrega el nombre del proyecto y del cliente a un registro de tiempo. */
function decorateEntry_(row, projects) {
  var project = projects[String(row.proyecto || '')] || null;
  return {
    _row: row._row,
    codigoUsuario: String(row.codigoUsuario || '').trim().toUpperCase(),
    proyecto: String(row.proyecto || '').trim(),
    proyectoNombre: project ? project.nombre : '',
    cliente: project ? project.cliente : '',
    tipoActividad: String(row.tipoActividad || ''),
    actividad: String(row.actividad || ''),
    observaciones: String(row.observaciones || ''),
    fecha: String(row.fecha || ''),
    horaInicio: String(row.horaInicio || ''),
    horaFin: String(row.horaFin || ''),
    minutos: Number(row.minutos) || 0
  };
}

/** Registros de un usuario en una fecha, con totales. */
function getDayEntries_(codigo, fecha) {
  var projects = getProjectMap_();
  var code = String(codigo || '').toUpperCase();

  var entries = readTable_(CONFIG.SHEETS.TIEMPOS)
    .filter(function (row) {
      return String(row.codigoUsuario || '').toUpperCase() === code && String(row.fecha || '') === String(fecha);
    })
    .map(function (row) {
      return decorateEntry_(row, projects);
    });

  entries.sort(function (a, b) {
    if (a.horaInicio === b.horaInicio) return a._row - b._row;
    return a.horaInicio < b.horaInicio ? -1 : 1;
  });

  var total = entries.reduce(function (sum, entry) {
    return sum + (Number(entry.minutos) || 0);
  }, 0);

  return { fecha: String(fecha), entries: entries, totalMinutos: total, count: entries.length };
}

/** Registros del usuario identificado para una fecha. */
function apiDayEntries(fecha) {
  return api_(function () {
    var user = requireUser_();
    var day = isValidIsoDate_(fecha) ? String(fecha) : todayIso_();
    return getDayEntries_(user.codigo, day);
  });
}


/**
 * Guarda un registro de tiempo del usuario identificado.
 * Si el payload trae "_row" se corrige esa fila; si no, se agrega una nueva.
 */
function apiSaveTimeEntry(payload) {
  return api_(function () {
    var user = requireUser_();
    var data = payload || {};

    var rowNumber = Number(data._row) || 0;
    var current = null;

    if (rowNumber) {
      current = readTable_(CONFIG.SHEETS.TIEMPOS).filter(function (item) {
        return item._row === rowNumber;
      })[0];
      assert_(current, 'El registro ' + rowNumber + ' ya no existe. Recarga los registros del día.');
      assert_(String(current.codigoUsuario || '').toUpperCase() === String(user.codigo || '').toUpperCase(),
        'El registro ' + rowNumber + ' no pertenece a tu usuario: no puedes corregirlo.');
    }

    var project = findProject_(data.proyecto);
    assert_(project, 'Selecciona un proyecto válido de la lista.');
    var mismoProyecto = !!current && String(current.proyecto || '') === String(project.numero);
    assert_(project.activo !== false || mismoProyecto, 'El proyecto ' + project.numero + ' está inactivo. Selecciona un proyecto activo.');

    var tipo = String(data.tipoActividad == null ? '' : data.tipoActividad).trim();
    assert_(tipo, 'Selecciona el tipo de actividad.');
    var tipos = getActivityTypes_();
    assert_(tipos.indexOf(tipo) !== -1, 'El tipo de actividad "' + tipo + '" no está en la tabla de Tipos de Actividad.');

    var fecha = String(data.fecha == null ? '' : data.fecha).trim();
    assert_(isValidIsoDate_(fecha), 'La fecha no es válida. Usa el formato AAAA-MM-DD.');

    var horaInicio = roundTime_(String(data.horaInicio == null ? '' : data.horaInicio).trim());
    assert_(isValidTime_(horaInicio), 'La hora de inicio no es válida (HH:MM).');

    var horaFinRaw = String(data.horaFin == null ? '' : data.horaFin).trim();
    var horaFin = horaFinRaw ? roundTime_(horaFinRaw) : currentRoundedTime_();
    assert_(isValidTime_(horaFin), 'La hora de finalización no es válida (HH:MM).');

    var minutos = minutesBetween_(horaInicio, horaFin);
    assert_(minutos > 0, 'La hora de finalización (' + horaFin + ') debe ser mayor que la hora de inicio (' + horaInicio + ').');

    var actividad = String(data.actividad == null ? '' : data.actividad).trim();
    assert_(actividad, 'Escribe la actividad realizada.');
    var observaciones = String(data.observaciones == null ? '' : data.observaciones).trim();

    var entry = {
      codigoUsuario: user.codigo,
      proyecto: project.numero,
      tipoActividad: tipo,
      actividad: actividad,
      observaciones: observaciones,
      fecha: fecha,
      horaInicio: horaInicio,
      horaFin: horaFin,
      minutos: minutos
    };

    if (current) {
      withLock_(function () {
        updateRow_(CONFIG.SHEETS.TIEMPOS, rowNumber, entry);
      });
      entry._row = rowNumber;
    } else {
      var newRow = 0;
      withLock_(function () {
        newRow = appendRow_(CONFIG.SHEETS.TIEMPOS, entry);
      });
      entry._row = newRow;
    }

    var projectMap = {};
    projectMap[project.numero] = project;

    return {
      entry: decorateEntry_(entry, projectMap),
      dayEntries: getDayEntries_(user.codigo, fecha),
      updated: !!current
    };
  });
}

/** Listado de registros con filtros (usado por la pestaña "Registros"). */
function apiListEntries(filters) {
  return api_(function () {
    requireUser_();
    var options = filters || {};

    var hasta = isValidIsoDate_(options.hasta) ? String(options.hasta) : todayIso_();
    var desde = isValidIsoDate_(options.desde) ? String(options.desde) : hasta;
    assert_(desde <= hasta, 'La fecha "desde" no puede ser posterior a la fecha "hasta".');

    var codigo = String(options.codigoUsuario || '').trim().toUpperCase();
    var projectFilter = normalizeText_(options.proyecto || '');

    var userNames = {};
    listUsers_().forEach(function (user) {
      userNames[user.codigo] = user.nombre;
    });
    var projects = getProjectMap_();

    var rows = readTable_(CONFIG.SHEETS.TIEMPOS)
      .filter(function (row) {
        var fecha = String(row.fecha || '');
        if (fecha < desde || fecha > hasta) return false;
        if (codigo && String(row.codigoUsuario || '').toUpperCase() !== codigo) return false;
        if (projectFilter) {
          var project = projects[String(row.proyecto || '')] || null;
          var haystack = normalizeText_(
            String(row.proyecto || '') + ' ' + (project ? project.nombre + ' ' + project.cliente : '')
          );
          if (haystack.indexOf(projectFilter) === -1) return false;
        }
        return true;
      })
      .map(function (row) {
        var entry = decorateEntry_(row, projects);
        entry.usuarioNombre = userNames[entry.codigoUsuario] || entry.codigoUsuario;
        return entry;
      });

    rows.sort(function (a, b) {
      var left = a.fecha + ' ' + a.horaInicio;
      var right = b.fecha + ' ' + b.horaInicio;
      if (left === right) return b._row - a._row;
      return left < right ? 1 : -1;
    });

    var total = rows.reduce(function (sum, entry) {
      return sum + (Number(entry.minutos) || 0);
    }, 0);

    var limit = Math.min(Number(options.limit) || CONFIG.LIMITS.ENTRIES, 1000);

    return {
      desde: desde,
      hasta: hasta,
      entries: rows.slice(0, limit),
      totalMinutos: total,
      count: rows.length,
      truncated: rows.length > limit
    };
  });
}

/* ------------------------------------------------------------------ */
/* Detalle de un proyecto (drill down)                                 */
/* ------------------------------------------------------------------ */

/** Etiqueta legible de un mes "AAAA-MM" (por ejemplo "Noviembre 2026"). */
function monthLabel_(monthKey) {
  var parts = String(monthKey || '').split('-');
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  if (!year || !month || month < 1 || month > 12) return String(monthKey || '');
  var name = MONTH_NAMES_ES_[month - 1];
  return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + year;
}

/**
 * Detalle de un proyecto para el drill down del listado de Proyectos.
 *
 * Devuelve los totales del mes en curso, del mes anterior y del año, y los
 * registros agrupados por mes empezando por el actual y siguiendo hacia el
 * pasado; dentro de cada mes las filas van del día 1 en adelante. La lista se
 * entrega paginada en bloques de CONFIG.LIMITS.DETAIL_PAGE registros, así que
 * un mes puede quedar repartido entre dos páginas (la cabecera del mes avisa
 * cuántos registros tiene en total y cuántos van en la página).
 */
function apiProjectDetail(numero, page) {
  return api_(function () {
    requireUser_();

    var target = String(numero == null ? '' : numero).trim();
    assert_(target, 'Proyecto inválido.');

    var projects = getProjectMap_();
    var project = projects[target] || null;
    assert_(project, 'El proyecto "' + target + '" no existe o fue eliminado.');

    var periods = comparisonPeriods_();

    var entries = readTable_(CONFIG.SHEETS.TIEMPOS)
      .filter(function (row) {
        return String(row.proyecto == null ? '' : row.proyecto).trim() === target;
      })
      .map(function (row) {
        return decorateEntry_(row, projects);
      })
      .filter(function (entry) {
        return isValidIsoDate_(entry.fecha);
      });

    // Totales del mes en curso, del mes anterior, del año y de toda la historia.
    var minutosMes = 0;
    var minutosMesAnterior = 0;
    var minutosAnio = 0;
    var totalMinutos = 0;
    var fechaMin = '';
    var fechaMax = '';
    var monthTotals = {};

    entries.forEach(function (entry) {
      var minutos = Number(entry.minutos) || 0;
      var monthKey = entry.fecha.slice(0, 7);

      totalMinutos += minutos;
      if (monthKey === periods.monthPrefix) minutosMes += minutos;
      if (monthKey === periods.previousMonthPrefix) minutosMesAnterior += minutos;
      if (entry.fecha.indexOf(periods.yearPrefix) === 0) minutosAnio += minutos;

      if (!fechaMin || entry.fecha < fechaMin) fechaMin = entry.fecha;
      if (!fechaMax || entry.fecha > fechaMax) fechaMax = entry.fecha;

      if (!monthTotals[monthKey]) monthTotals[monthKey] = { count: 0, minutos: 0 };
      monthTotals[monthKey].count += 1;
      monthTotals[monthKey].minutos += minutos;
    });

    // Mes más reciente primero; dentro del mes, del día 1 en adelante.
    entries.sort(function (a, b) {
      var monthA = a.fecha.slice(0, 7);
      var monthB = b.fecha.slice(0, 7);
      if (monthA !== monthB) return monthA < monthB ? 1 : -1;
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
      if (a.horaInicio !== b.horaInicio) return a.horaInicio < b.horaInicio ? -1 : 1;
      return a._row - b._row;
    });

    // Paginación sobre la lista completa (100 registros por página).
    var pageSize = Math.max(1, Number(CONFIG.LIMITS.DETAIL_PAGE) || 100);
    var pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
    var current = Math.min(Math.max(1, Number(page) || 1), pageCount);
    var slice = entries.slice((current - 1) * pageSize, current * pageSize);

    // Agrupación por mes solo de la página pedida.
    var months = [];
    var byMonth = {};

    slice.forEach(function (entry) {
      var monthKey = entry.fecha.slice(0, 7);
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = {
          monthKey: monthKey,
          label: monthLabel_(monthKey),
          entries: [],
          count: 0,
          totalMinutos: 0,
          monthCount: (monthTotals[monthKey] || {}).count || 0,
          monthMinutos: (monthTotals[monthKey] || {}).minutos || 0
        };
        months.push(byMonth[monthKey]);
      }

      var group = byMonth[monthKey];
      group.entries.push(entry);
      group.count += 1;
      group.totalMinutos += Number(entry.minutos) || 0;
    });

    return {
      proyecto: {
        numero: project.numero,
        nombre: project.nombre,
        cliente: project.cliente || '',
        activo: project.activo === true,
        fechaCreacion: project.fechaCreacion || ''
      },
      periods: {
        monthLabel: periods.monthLabel,
        previousMonthLabel: periods.previousMonthLabel,
        yearLabel: periods.yearLabel
      },
      totals: {
        minutosMes: minutosMes,
        minutosMesAnterior: minutosMesAnterior,
        minutosAnio: minutosAnio,
        totalMinutos: totalMinutos,
        count: entries.length
      },
      rango: { desde: fechaMin, hasta: fechaMax },
      page: current,
      pageSize: pageSize,
      pageCount: pageCount,
      months: months
    };
  });
}


/** Elimina un registro de tiempo por número de fila. */
function apiDeleteTimeEntry(rowNumber) {
  return api_(function () {
    var user = requireUser_();
    var target = Number(rowNumber);
    assert_(target >= 2, 'Registro inválido.');

    withLock_(function () {
      var row = readTable_(CONFIG.SHEETS.TIEMPOS).filter(function (item) {
        return item._row === target;
      })[0];
      assert_(row, 'El registro ya no existe. Recarga la lista.');
      deleteRow_(CONFIG.SHEETS.TIEMPOS, target);
    });

    return { deleted: true, row: target, codigoUsuario: user.codigo };
  });
}


/* ------------------------------------------------------------------ */
/* Mantenimiento de tablas                                             */
/* ------------------------------------------------------------------ */

function assertTable_(table, allowTimes) {
  var name = String(table || '').trim();
  var allowed = getEditableTables_();
  if (allowTimes) allowed = allowed.concat([CONFIG.SHEETS.TIEMPOS]);
  assert_(SCHEMA[name], 'Tabla desconocida: ' + name);
  assert_(allowed.indexOf(name) !== -1, 'La tabla "' + name + '" no se puede modificar desde la aplicación.');
  return name;
}

/** Filas de una tabla lista para mostrar en el cliente. */
function apiListTable(table) {
  return api_(function () {
    requireUser_();
    var name = assertTable_(table, true);
    var rows;

    if (name === CONFIG.SHEETS.PROYECTOS) {
      var clientNames = {};
      getClients_(true).forEach(function (client) {
        clientNames[client.numero] = client.nombre;
      });
      // Horas por proyecto (mes en curso, mes anterior y año) desde la hoja Tiempos.
      var minutes = getProjectMinutesSummary_();
      rows = readTable_(name).map(function (row) {
        var numeroCliente = String(row.numeroCliente || '').trim() || '0';
        var numero = String(row.numero == null ? '' : row.numero).trim();
        row.numeroCliente = numeroCliente;
        row.clienteNombre = numeroCliente === '0' ? '' : (clientNames[numeroCliente] || '');
        row.minutosMes = minutes.mes[numero] || 0;
        row.minutosMesAnterior = minutes.mesAnterior[numero] || 0;
        row.minutosAnio = minutes.anio[numero] || 0;
        return row;
      });
      rows.sort(function (a, b) {
        return naturalCompare_(a.numero, b.numero);
      });
    } else if (name === CONFIG.SHEETS.TIEMPOS) {
      var projects = getProjectMap_();
      rows = readTable_(name)
        .map(function (row) {
          return decorateEntry_(row, projects);
        })
        .sort(function (a, b) {
          var left = a.fecha + ' ' + a.horaInicio;
          var right = b.fecha + ' ' + b.horaInicio;
          if (left === right) return b._row - a._row;
          return left < right ? 1 : -1;
        })
        .slice(0, CONFIG.LIMITS.ENTRIES);
    } else {
      var def = SCHEMA[name];
      rows = readTable_(name);
      if (def.key) {
        rows.sort(function (a, b) {
          return naturalCompare_(a[def.key], b[def.key]);
        });
      }
    }

    return {
      table: name,
      rows: rows,
      schema: buildClientSchemas_()[name],
      clients: name === CONFIG.SHEETS.PROYECTOS ? getClients_(true) : []
    };
  });
}

/** Normaliza y valida los datos enviados para una fila de tabla. */
function sanitizeTableRow_(name, row, isCreate) {
  var def = SCHEMA[name];
  var data = {};

  def.columns.forEach(function (column) {
    var hasValue = Object.prototype.hasOwnProperty.call(row, column.field);
    if (!hasValue) {
      if (isCreate && column.type === 'boolean') data[column.field] = false;
      return;
    }

    var raw = row[column.field];

    if (column.type === 'boolean') {
      data[column.field] = raw === true || normalizeText_(raw) === 'true';
      return;
    }

    var text = String(raw == null ? '' : raw).trim();

    if (column.field === 'fechaCreacion' || column.field === 'fecha') {
      assert_(!text || isValidIsoDate_(text), 'La fecha "' + text + '" no es válida (formato AAAA-MM-DD).');
    }
    if (/^email\d$/i.test(column.field)) {
      assert_(!text || EMAIL_REGEX.test(text.toLowerCase()), 'El correo "' + text + '" no es válido.');
      text = text.toLowerCase();
    }
    if (column.field === 'codigo') {
      text = text.toUpperCase();
    }

    data[column.field] = text;
  });

  if (isCreate) {
    def.columns.forEach(function (column) {
      if (!column.required) return;
      if (def.autoKey && column.field === def.key) return;
      var value = data[column.field];
      assert_(String(value == null ? '' : value).trim() !== '', 'El campo "' + column.label + '" es obligatorio.');
    });
  } else {
    def.columns.forEach(function (column) {
      if (!column.required || column.readOnlyOnEdit) return;
      if (!Object.prototype.hasOwnProperty.call(data, column.field)) return;
      assert_(String(data[column.field] == null ? '' : data[column.field]).trim() !== '',
        'El campo "' + column.label + '" no puede quedar vacío.');
    });
  }

  validateSpecificRow_(name, data);
  return data;
}

/** Validaciones propias de cada tabla. */
function validateSpecificRow_(name, data) {
  if (name === CONFIG.SHEETS.USUARIOS) {
    if (data.codigo) {
      assert_(/^[A-Z]{2}$/.test(data.codigo), 'El código de usuario debe tener exactamente 2 letras (por ejemplo: JP).');
    }
    if (!data.email1 && !data.email2 && !data.email3) {
      throw new Error('Registra al menos un correo para el usuario.');
    }
  }

  if (name === CONFIG.SHEETS.PROYECTOS) {
    if (data.numeroCliente && data.numeroCliente !== '0') {
      var exists = getClients_(true).filter(function (client) {
        return normalizeText_(client.numero) === normalizeText_(data.numeroCliente);
      })[0];
      assert_(exists, 'El cliente ' + data.numeroCliente + ' no existe en la tabla de Clientes.');
    }
  }

  if (name === CONFIG.SHEETS.TIPOS && data.tipo) {
    assert_(data.tipo.length >= 2, 'El tipo de actividad debe tener al menos 2 caracteres.');
  }
}


/** Crea o actualiza una fila de una tabla mantenible. */
function apiSaveTableRow(table, row) {
  return api_(function () {
    requireUser_();
    var name = assertTable_(table, false);
    var def = SCHEMA[name];
    assert_(row && typeof row === 'object', 'Datos inválidos.');

    var rowNumber = Number(row._row) || 0;
    var isCreate = rowNumber < 2;
    var data = sanitizeTableRow_(name, row, isCreate);
    var result = {};

    withLock_(function () {
      if (isCreate) {
        if (def.key) {
          if (!data[def.key] && def.autoKey) {
            data[def.key] = nextSequentialKey_(name);
          }
          assert_(data[def.key], 'El campo "' + (def.columns[0].label) + '" es obligatorio.');
          assert_(!findRowByKey_(name, data[def.key]),
            'Ya existe un registro con ' + def.columns[0].label + ' = ' + data[def.key] + '.');
        }
        if (name === CONFIG.SHEETS.PROYECTOS && !data.fechaCreacion) {
          data.fechaCreacion = todayIso_();
        }
        if (name === CONFIG.SHEETS.PROYECTOS && !data.numeroCliente) {
          data.numeroCliente = '0';
        }
        result.row = appendRow_(name, data);
        result.created = true;
      } else {
        var rows = readTable_(name);
        var current = rows.filter(function (item) {
          return item._row === rowNumber;
        })[0];
        assert_(current, 'El registro que intentas editar ya no existe. Recarga la lista.');

        if (def.key) {
          data[def.key] = data[def.key] || String(current[def.key] == null ? '' : current[def.key]);
          var duplicate = rows.filter(function (item) {
            return item._row !== rowNumber && normalizeText_(item[def.key]) === normalizeText_(data[def.key]);
          })[0];
          assert_(!duplicate, 'Ya existe otro registro con ' + def.columns[0].label + ' = ' + data[def.key] + '.');
        }

        updateRow_(name, rowNumber, data);
        result.row = rowNumber;
        result.created = false;
      }
    });

    bustReferenceCache_();

    if (name === CONFIG.SHEETS.PROYECTOS || name === CONFIG.SHEETS.TIPOS) {
      try {
        applySheetValidations_(getSpreadsheet_());
      } catch (e) {
        // Las validaciones de la hoja son una ayuda: si fallan no se interrumpe el guardado.
      }
    }

    var saved = readTable_(name).filter(function (item) {
      return item._row === result.row;
    })[0] || {};

    if (name === CONFIG.SHEETS.PROYECTOS) {
      var clientNames = {};
      getClients_(true).forEach(function (client) {
        clientNames[client.numero] = client.nombre;
      });
      saved.clienteNombre = clientNames[String(saved.numeroCliente || '')] || '';
    }

    result.saved = saved;
    return result;
  });
}

/** Elimina una fila verificando que no tenga referencias en otras tablas. */
function apiDeleteTableRow(table, key) {
  return api_(function () {
    requireUser_();
    var name = assertTable_(table, false);
    var def = SCHEMA[name];
    var target = String(key == null ? '' : key).trim();
    assert_(target, 'Indica el registro a eliminar.');

    var result = {};

    withLock_(function () {
      var found = findRowByKey_(name, target);
      assert_(found, 'No se encontró el registro con clave "' + target + '".');

      if (name === CONFIG.SHEETS.CLIENTES) {
        var project = readTable_(CONFIG.SHEETS.PROYECTOS).filter(function (item) {
          return normalizeText_(item.numeroCliente) === normalizeText_(target);
        })[0];
        assert_(!project, 'No se puede eliminar el cliente: está asociado al proyecto ' + project.numero + '.');
      }

      if (name === CONFIG.SHEETS.PROYECTOS) {
        var timeEntry = readTable_(CONFIG.SHEETS.TIEMPOS).filter(function (item) {
          return normalizeText_(item.proyecto) === normalizeText_(target);
        })[0];
        assert_(!timeEntry, 'No se puede eliminar el proyecto: tiene tiempos registrados. Márcalo como inactivo.');
      }

      if (name === CONFIG.SHEETS.USUARIOS) {
        var userEntry = readTable_(CONFIG.SHEETS.TIEMPOS).filter(function (item) {
          return normalizeText_(item.codigoUsuario) === normalizeText_(target);
        })[0];
        assert_(!userEntry, 'No se puede eliminar el usuario: tiene tiempos registrados.');
      }

      if (name === CONFIG.SHEETS.TIPOS) {
        var typeEntry = readTable_(CONFIG.SHEETS.TIEMPOS).filter(function (item) {
          return normalizeText_(item.tipoActividad) === normalizeText_(target);
        })[0];
        assert_(!typeEntry, 'No se puede eliminar el tipo de actividad: tiene tiempos registrados.');
      }

      deleteRow_(name, found._row);
      result.deleted = true;
      result.row = found._row;
    });

    bustReferenceCache_();

    if (name === CONFIG.SHEETS.PROYECTOS || name === CONFIG.SHEETS.TIPOS) {
      try {
        applySheetValidations_(getSpreadsheet_());
      } catch (e) {
        // Sin acción.
      }
    }

    return result;
  });
}

