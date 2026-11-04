/**
 * Inicialización de la hoja de cálculo.
 *
 * Ejecuta setupTimeSheet() UNA VEZ desde el editor de Apps Script
 * (o desde el menú Ejecutar) después de pegar el proyecto. La función es
 * idempotente: crea lo que falta y no toca los datos existentes.
 */

function setupTimeSheet() {
  var result = withLock_(function () {
    var spreadsheet = getSpreadsheet_();

    Object.keys(SCHEMA).forEach(function (name) {
      getSheet_(name);
    });

    var typesAdded = seedActivityTypes_();
    var firstUser = seedFirstUser_();
    applySheetValidations_(spreadsheet);

    return {
      url: spreadsheet.getUrl(),
      id: spreadsheet.getId(),
      typesAdded: typesAdded,
      firstUser: firstUser
    };
  });

  var message =
    'Hoja de cálculo lista: ' + result.url +
    '\nTipos de actividad agregados: ' + result.typesAdded +
    '\nUsuario inicial: ' + (result.firstUser || 'no fue necesario (ya existían usuarios)');

  Logger.log(message);
  return message;
}

/** Muestra en el registro la URL de la hoja de cálculo en uso. */
function showSpreadsheetUrl() {
  var url = getSpreadsheet_().getUrl();
  Logger.log('Hoja de cálculo: ' + url);
  return url;
}

/** Copia los tipos de actividad por omisión si la hoja está vacía. */
function seedActivityTypes_() {
  var sheetName = CONFIG.SHEETS.TIPOS;
  if (readTable_(sheetName).length > 0) return 0;

  var values = DEFAULT_ACTIVITY_TYPES.map(function (tipo) {
    return [tipo];
  });
  if (!values.length) return 0;

  var sheet = getSheet_(sheetName);
  sheet.getRange(2, 1, values.length, 1).setValues(values);
  cacheRemove_(['types']);
  return values.length;
}

/**
 * Si la tabla de usuarios está vacía se crea un usuario inicial con el
 * correo del propietario del script, para no quedar bloqueado.
 */
function seedFirstUser_() {
  var sheetName = CONFIG.SHEETS.USUARIOS;
  if (readTable_(sheetName).length > 0) return null;

  var email = '';
  try {
    email = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  } catch (e) {
    email = '';
  }

  var data = {
    codigo: 'AD',
    email1: email,
    email2: '',
    email3: '',
    nombre: 'Administrador'
  };

  appendRow_(sheetName, data);
  cacheRemove_(['users']);
  return data.codigo + ' <' + (email || 'sin correo') + '>';
}

/**
 * Validaciones de lista en la hoja Tiempos para que la edición directa
 * use los mismos catálogos (proyectos y tipos de actividad).
 */
function applySheetValidations_(spreadsheet) {
  var timesSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.TIEMPOS);
  if (!timesSheet) return;

  var timesColumns = SCHEMA[CONFIG.SHEETS.TIEMPOS].columns;
  var rowsAvailable = Math.max(timesSheet.getMaxRows() - 1, 1);

  // Tipos de actividad (columna "Tipo de Actividad").
  var typesSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.TIPOS);
  var typeIndex = columnIndex_(timesColumns, 'tipoActividad');
  if (typesSheet && typeIndex > 0) {
    var lastTypeRow = Math.max(typesSheet.getLastRow() - 1, 1);
    var typeRule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(typesSheet.getRange(2, 1, lastTypeRow, 1), true)
      .setAllowInvalid(true)
      .build();
    timesSheet.getRange(2, typeIndex, rowsAvailable, 1).setDataValidation(typeRule);
  }

  // Proyectos (columna "Proyecto").
  var projectsSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.PROYECTOS);
  var projectIndex = columnIndex_(timesColumns, 'proyecto');
  if (projectsSheet && projectIndex > 0 && projectsSheet.getLastRow() > 1) {
    var projectRule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(projectsSheet.getRange(2, 1, projectsSheet.getLastRow() - 1, 1), true)
      .setAllowInvalid(true)
      .build();
    timesSheet.getRange(2, projectIndex, rowsAvailable, 1).setDataValidation(projectRule);
  }
}

/** Índice (1-based) de una columna del esquema, o 0 si no existe. */
function columnIndex_(columns, field) {
  for (var i = 0; i < columns.length; i++) {
    if (columns[i].field === field) return i + 1;
  }
  return 0;
}
