/**
 * Esquema de las tablas (hojas) y acceso genérico a los datos.
 *
 * Cada hoja tiene una fila 1 con los encabezados y las filas siguientes
 * con los datos. Las columnas de fecha/hora usan formato de celda TEXTO
 * para garantizar que se guarden como "AAAA-MM-DD" y "HH:MM".
 */

var SCHEMA = {
  Clientes: {
    key: 'numero',
    autoKey: true,
    // Columna que la aplicación muestra como enlace para editar la fila.
    labelField: 'nombre',
    columns: [
      { field: 'numero', label: 'Número', type: 'text', input: 'text', required: true, readOnlyOnEdit: true, width: 90 },
      { field: 'nombre', label: 'Nombre', type: 'text', input: 'text', required: true, width: 220 },
      { field: 'rif', label: 'RIF', type: 'text', input: 'text', width: 140 },
      { field: 'razonSocial', label: 'Razón Social', type: 'text', input: 'text', width: 220 },
      { field: 'direccionFiscal', label: 'Dirección Fiscal', type: 'text', input: 'textarea', width: 260 },
      { field: 'ciudad', label: 'Ciudad', type: 'text', input: 'text', width: 140 },
      { field: 'responsable', label: 'Responsable', type: 'text', input: 'text', width: 180 },
      { field: 'telefonoResponsable', label: 'Teléfono Responsable', type: 'text', input: 'text', width: 160 },
      { field: 'administracion', label: 'Administración', type: 'text', input: 'text', width: 180 },
      { field: 'telefonoAdministrador', label: 'Teléfono Administrador', type: 'text', input: 'text', width: 180 }
    ]
  },

  Proyectos: {
    key: 'numero',
    autoKey: true,
    // Columna que la aplicación muestra como enlace para editar la fila.
    labelField: 'nombre',
    columns: [
      { field: 'numero', label: 'Número', type: 'text', input: 'text', required: true, readOnlyOnEdit: true, width: 100 },
      { field: 'nombre', label: 'Nombre', type: 'text', input: 'text', required: true, width: 280 },
      { field: 'numeroCliente', label: 'Número Cliente', type: 'text', input: 'select', options: 'clients', width: 150 },
      { field: 'activo', label: 'Activo', type: 'boolean', input: 'checkbox', width: 90 },
      { field: 'fechaCreacion', label: 'Fecha Creación', type: 'text', input: 'date', width: 130 }
    ]
  },

  Tiempos: {
    key: null,
    columns: [
      { field: 'codigoUsuario', label: 'Código Usuario', type: 'text', width: 120 },
      { field: 'proyecto', label: 'Proyecto', type: 'text', width: 110 },
      { field: 'tipoActividad', label: 'Tipo de Actividad', type: 'text', width: 180 },
      { field: 'actividad', label: 'Actividad', type: 'text', width: 300 },
      { field: 'observaciones', label: 'Observaciones', type: 'text', width: 280 },
      { field: 'fecha', label: 'Fecha', type: 'text', width: 110 },
      { field: 'horaInicio', label: 'Hora Inicio', type: 'text', width: 100 },
      { field: 'horaFin', label: 'Hora Fin', type: 'text', width: 100 },
      { field: 'minutos', label: 'Minutos', type: 'number', width: 90 }
    ]
  },

  Usuarios: {
    key: 'codigo',
    // Columna que la aplicación muestra como enlace para editar la fila.
    labelField: 'nombre',
    columns: [
      { field: 'codigo', label: 'Código', type: 'text', input: 'text', required: true, readOnlyOnEdit: true, width: 90, hint: '2 letras' },
      { field: 'email1', label: 'Email 1', type: 'text', input: 'email', required: true, width: 230 },
      { field: 'email2', label: 'Email 2', type: 'text', input: 'email', width: 230 },
      { field: 'email3', label: 'Email 3', type: 'text', input: 'email', width: 230 },
      { field: 'nombre', label: 'Nombre Usuario', type: 'text', input: 'text', required: true, width: 200 }
    ]
  },

  TiposActividad: {
    key: 'tipo',
    columns: [
      { field: 'tipo', label: 'Tipo de Actividad', type: 'text', input: 'text', required: true, width: 280 }
    ]
  }
};

/**
 * Columnas calculadas que la aplicación agrega al mostrar una tabla.
 *
 * No existen en la hoja: se calculan al vuelo, solo se muestran y nunca se
 * envían al guardar (el cliente las excluye del formulario). En la hoja
 * Tiempos la columna "proyecto" guarda el número del proyecto.
 */
var COMPUTED_COLUMNS = {
  Proyectos: [
    { field: 'minutosMes', label: 'Horas dedicadas en el mes', type: 'number', width: 160 },
    { field: 'minutosMesAnterior', label: 'Horas dedicadas en el mes anterior', type: 'number', width: 190 },
    { field: 'minutosAnio', label: 'Horas dedicadas en el año', type: 'number', width: 160 }
  ]
};

/* ------------------------------------------------------------------ */
/* Hoja de cálculo                                                     */
/* ------------------------------------------------------------------ */

/** Devuelve la hoja de cálculo configurada; la crea si no existe. */
function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(CONFIG.PROP.SPREADSHEET_ID);

  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      // El id guardado ya no es válido: se crea una hoja nueva más abajo.
    }
  }

  var spreadsheet = SpreadsheetApp.create(CONFIG.APP_TITLE);
  props.setProperty(CONFIG.PROP.SPREADSHEET_ID, spreadsheet.getId());
  return spreadsheet;
}

/** Devuelve la hoja con el nombre indicado, creándola con su estructura si falta. */
function getSheet_(name) {
  assert_(SCHEMA[name], 'Tabla desconocida: ' + name);
  var spreadsheet = getSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = createSheet_(spreadsheet, name);
  }
  return sheet;
}

/** Crea una hoja con encabezados, formatos de texto y anchos de columna. */
function createSheet_(spreadsheet, name) {
  var def = SCHEMA[name];
  var sheet = spreadsheet.insertSheet(name);
  var labels = def.columns.map(function (column) {
    return column.label;
  });

  var header = sheet.getRange(1, 1, 1, labels.length);
  header.setValues([labels]);
  header.setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  header.setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 34);

  def.columns.forEach(function (column, index) {
    var format = column.type === 'number' ? '0' : (column.type === 'boolean' ? 'BOOLEAN' : '@');
    sheet.getRange(2, index + 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat(format);
    sheet.setColumnWidth(index + 1, Math.min(Math.max(column.width || 160, 60), 400));
  });

  var extraColumns = sheet.getMaxColumns() - labels.length;
  if (extraColumns > 0) {
    sheet.deleteColumns(labels.length + 1, extraColumns);
  }

  return sheet;
}


/* ------------------------------------------------------------------ */
/* Lectura / escritura genérica                                        */
/* ------------------------------------------------------------------ */

/**
 * Lee una tabla completa y devuelve un arreglo de objetos.
 * Cada objeto incluye la propiedad "_row" con el número de fila real.
 */
function readTable_(name) {
  var def = SCHEMA[name];
  var sheet = getSheet_(name);
  var lastRow = sheet.getLastRow();
  var width = def.columns.length;
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  var rows = [];

  values.forEach(function (rowValues, index) {
    var item = { _row: index + 2 };
    var hasData = false;

    def.columns.forEach(function (column, columnIndex) {
      var value = coerceValue_(rowValues[columnIndex], column.type);
      item[column.field] = value;
      if (!isBlank_(value)) hasData = true;
    });

    if (hasData) rows.push(item);
  });

  return rows;
}

function isBlank_(value) {
  return value === '' || value === null || value === undefined;
}

/** Normaliza el valor leído de la hoja según el tipo de columna. */
function coerceValue_(raw, type) {
  if (raw === null || raw === undefined) return '';

  if (type === 'number') {
    if (raw === '') return '';
    var num = Number(raw);
    return isNaN(num) ? '' : num;
  }

  if (type === 'boolean') {
    if (raw === true) return true;
    var text = normalizeText_(raw);
    return text === 'true' || text === 'verdadero' || text === 'si' || text === '1' || text === 'x';
  }

  // Texto: si Sheets interpretó la celda como fecha/hora, se reformatea como texto.
  if (raw instanceof Date) {
    var hours = raw.getHours();
    var minutes = raw.getMinutes();
    var seconds = raw.getSeconds();
    if (hours === 0 && minutes === 0 && seconds === 0) {
      return Utilities.formatDate(raw, getTimeZone_(), DATE_PATTERN);
    }
    return Utilities.formatDate(raw, getTimeZone_(), TIME_PATTERN);
  }

  return String(raw).trim();
}

/** Convierte un valor de la aplicación al valor que se escribe en la hoja. */
function encodeValue_(value, type) {
  if (type === 'number') {
    if (isBlank_(value)) return '';
    var num = Number(value);
    return isNaN(num) ? '' : num;
  }
  if (type === 'boolean') return value === true;
  return String(value == null ? '' : value).trim();
}

/** Agrega una fila con los datos del objeto. Devuelve el número de fila. */
function appendRow_(name, data) {
  var def = SCHEMA[name];
  var sheet = getSheet_(name);
  var values = def.columns.map(function (column) {
    return encodeValue_(data[column.field], column.type);
  });
  sheet.appendRow(values);
  return sheet.getLastRow();
}

/** Actualiza una fila existente combinando los datos actuales con los nuevos. */
function updateRow_(name, rowNumber, data) {
  var def = SCHEMA[name];
  var sheet = getSheet_(name);
  assert_(rowNumber >= 2, 'Fila inválida para actualizar: ' + rowNumber);

  var range = sheet.getRange(rowNumber, 1, 1, def.columns.length);
  var current = range.getValues()[0];

  var values = def.columns.map(function (column, index) {
    if (Object.prototype.hasOwnProperty.call(data, column.field) && data[column.field] !== undefined) {
      return encodeValue_(data[column.field], column.type);
    }
    return current[index];
  });

  range.setValues([values]);
  return rowNumber;
}

/** Elimina una fila física. */
function deleteRow_(name, rowNumber) {
  var sheet = getSheet_(name);
  assert_(rowNumber >= 2 && rowNumber <= sheet.getLastRow(), 'Fila inválida para eliminar: ' + rowNumber);
  sheet.deleteRow(rowNumber);
  return true;
}

/** Busca la primera fila cuya clave coincida (comparación normalizada). */
function findRowByKey_(name, keyValue) {
  var def = SCHEMA[name];
  var target = normalizeText_(keyValue);
  var rows = readTable_(name);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeText_(rows[i][def.key]) === target) return rows[i];
  }
  return null;
}

/** Siguiente número secuencial para tablas con clave numérica automática. */
function nextSequentialKey_(name) {
  var def = SCHEMA[name];
  var max = 0;
  readTable_(name).forEach(function (row) {
    var num = Number(String(row[def.key] == null ? '' : row[def.key]).replace(/[^\d.-]/g, ''));
    if (!isNaN(num) && num > max) max = num;
  });
  return String(max + 1);
}

