/**
 * Utilidades: fechas, horas, texto, bloqueos y caché.
 * Las fechas se manejan SIEMPRE como texto "AAAA-MM-DD" y
 * las horas como texto "HH:MM" (nunca como objetos Date en las hojas).
 */

var DATE_PATTERN = 'yyyy-MM-dd';
var TIME_PATTERN = 'HH:mm';

/** Zona horaria efectiva del script. */
function getTimeZone_() {
  try {
    return Session.getScriptTimeZone() || CONFIG.TIME_ZONE;
  } catch (e) {
    return CONFIG.TIME_ZONE;
  }
}

/** Fecha de hoy en formato AAAA-MM-DD. */
function todayIso_() {
  return Utilities.formatDate(new Date(), getTimeZone_(), DATE_PATTERN);
}

/** Convierte un Date a texto con el patrón indicado. */
function formatDate_(date, pattern) {
  return Utilities.formatDate(date, getTimeZone_(), pattern || DATE_PATTERN);
}

/** Valida el formato y la existencia real de una fecha AAAA-MM-DD. */
function isValidIsoDate_(value) {
  var text = String(value == null ? '' : value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  var parts = text.split('-');
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var day = Number(parts[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  var date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Convierte una fecha AAAA-MM-DD en objeto Date (hora local del script). */
function parseIsoDate_(value) {
  var parts = String(value || '').split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

/** ¿Es una hora válida HH:MM? */
function isValidTime_(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value == null ? '' : value).trim());
}

/** HH:MM -> minutos desde medianoche. */
function timeToMinutes_(value) {
  var parts = String(value == null ? '' : value).split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

/** minutos desde medianoche -> HH:MM (con ajuste dentro del día). */
function minutesToTime_(minutes) {
  var total = Math.round(Number(minutes) || 0);
  total = ((total % 1440) + 1440) % 1440;
  return pad2_(Math.floor(total / 60)) + ':' + pad2_(total % 60);
}

function pad2_(value) {
  var num = Number(value) || 0;
  return (num < 10 ? '0' : '') + num;
}

/** Redondea minutos al múltiplo más cercano (por defecto 10). */
function roundMinutes_(minutes, step) {
  var size = Number(step) || CONFIG.ROUND_MINUTES;
  return Math.round(Number(minutes) / size) * size;
}

/** Redondea una hora HH:MM al múltiplo de 10 minutos más cercano. */
function roundTime_(value, step) {
  if (!isValidTime_(value)) return '';
  var size = Number(step) || CONFIG.ROUND_MINUTES;
  var rounded = roundMinutes_(timeToMinutes_(value), size);
  // 23:5x puede redondear a 24:00 -> se limita a 23:50 para no cambiar de día.
  if (rounded >= 1440) rounded = 1440 - size;
  return minutesToTime_(rounded);
}

/** Hora actual redondeada a 10 minutos (texto HH:MM). */
function currentRoundedTime_(step) {
  return roundTime_(Utilities.formatDate(new Date(), getTimeZone_(), TIME_PATTERN), step);
}

/** Diferencia en minutos entre dos horas HH:MM (puede ser negativa). */
function minutesBetween_(start, end) {
  return timeToMinutes_(end) - timeToMinutes_(start);
}

/** Texto normalizado para búsquedas: minúsculas, sin acentos, espacios simples. */
function normalizeText_(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Comparación natural (2 < 10) para números de proyecto / cliente. */
function naturalCompare_(a, b) {
  return String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), 'es', {
    numeric: true,
    sensitivity: 'base'
  });
}

/** Lanza un error con mensaje legible si la condición es falsa. */
function assert_(condition, message) {
  if (!condition) {
    throw new Error(message || 'Datos inválidos.');
  }
}

/** Ejecuta una función bajo bloqueo exclusivo de script (evita escrituras cruzadas). */
function withLock_(fn, timeoutMs) {
  var lock = LockService.getScriptLock();
  lock.waitLock(timeoutMs || 25000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Caché                                                               */
/* ------------------------------------------------------------------ */

function cacheGet_(key) {
  try {
    var raw = CacheService.getScriptCache().get(CONFIG.CACHE.PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function cachePut_(key, value, seconds) {
  try {
    var json = JSON.stringify(value);
    if (json && json.length < 95000) {
      CacheService.getScriptCache().put(CONFIG.CACHE.PREFIX + key, json, seconds || CONFIG.CACHE.SECONDS);
    }
  } catch (e) {
    // La caché es opcional: si falla, se sigue leyendo la hoja.
  }
}

function cacheRemove_(keys) {
  try {
    CacheService.getScriptCache().remove((keys || []).map(function (key) {
      return CONFIG.CACHE.PREFIX + key;
    }));
  } catch (e) {
    // Sin acción.
  }
}
