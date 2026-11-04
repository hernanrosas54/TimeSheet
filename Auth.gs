/**
 * Identificación y autorización del usuario.
 *
 * La aplicación web se ejecuta como el propietario del script y acepta
 * únicamente usuarios con cuenta de Google. El usuario debe existir en la
 * tabla "Usuarios" (por cualquiera de sus 3 correos).
 *
 * Cuando Google no expone el correo del visitante (comportamiento habitual
 * en web apps ejecutadas como el propietario), se pide identificarse una sola
 * vez con el código de usuario; ese vínculo queda guardado por
 * Session.getTemporaryActiveUserKey() y se valida contra la misma tabla.
 */

var EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail_(value) {
  var text = String(value == null ? '' : value).trim().toLowerCase();
  return EMAIL_REGEX.test(text) ? text : '';
}

/** Correo del visitante (puede venir vacío según la configuración de Google). */
function getVisitorEmail_() {
  try {
    return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  } catch (e) {
    return '';
  }
}

/** Clave temporal estable por usuario + script (disponible aunque el correo no lo esté). */
function getActiveUserKey_() {
  try {
    return String(Session.getTemporaryActiveUserKey() || '');
  } catch (e) {
    return '';
  }
}

/** Mapa { claveTemporal: codigoUsuario } guardado en las propiedades del script. */
function getIdentityMap_() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(CONFIG.PROP.IDENTITY_MAP);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

/** Guarda (o borra, si codigo es vacío) el vínculo clave temporal -> código. */
function setIdentityClaim_(userKey, codigo) {
  if (!userKey) return;
  var map = getIdentityMap_();
  if (codigo) {
    map[userKey] = String(codigo).toUpperCase();
  } else {
    delete map[userKey];
  }
  // Se conservan sólo los últimos 300 vínculos para no exceder el límite de 9KB.
  var keys = Object.keys(map);
  if (keys.length > 300) {
    keys.slice(0, keys.length - 300).forEach(function (key) {
      delete map[key];
    });
  }
  PropertiesService.getScriptProperties().setProperty(CONFIG.PROP.IDENTITY_MAP, JSON.stringify(map));
}

/** Usuarios de la tabla Usuarios (sin los correos). */
function listUsers_() {
  return readTable_(CONFIG.SHEETS.USUARIOS)
    .map(function (row) {
      return {
        codigo: String(row.codigo || '').trim().toUpperCase(),
        nombre: String(row.nombre || '').trim(),
        emails: [row.email1, row.email2, row.email3]
          .map(cleanEmail_)
          .filter(function (email) {
            return !!email;
          })
      };
    })
    .filter(function (user) {
      return !!user.codigo;
    });
}

/**
 * Resuelve la identidad del visitante.
 * Devuelve { email, emailVisible, user, source, reason, availableUsers, hasUsers }.
 */
function getIdentity_() {
  var email = getVisitorEmail_();
  var userKey = getActiveUserKey_();
  var users = listUsers_();

  if (!users.length) {
    return {
      email: email,
      emailVisible: !!email,
      user: null,
      source: '',
      reason: 'NO_USERS',
      availableUsers: [],
      hasUsers: false
    };
  }

  var match = null;
  if (email) {
    match = users.filter(function (user) {
      return user.emails.indexOf(email) !== -1;
    })[0] || null;
  }

  var claimed = null;
  if (!match) {
    var map = getIdentityMap_();
    var claimedCode = userKey ? map[userKey] : '';
    if (claimedCode) {
      claimed = users.filter(function (user) {
        return user.codigo === String(claimedCode).toUpperCase();
      })[0] || null;
    }
  }

  var resolved = match || claimed;
  var publicUsers = users.map(function (user) {
    return { codigo: user.codigo, nombre: user.nombre };
  });

  return {
    email: email,
    emailVisible: !!email,
    user: resolved ? { codigo: resolved.codigo, nombre: resolved.nombre } : null,
    source: match ? 'email' : (claimed ? 'claim' : ''),
    reason: resolved ? '' : (email ? 'EMAIL_NOT_AUTHORIZED' : 'IDENTIFY'),
    availableUsers: resolved ? [] : publicUsers,
    hasUsers: true
  };
}

/** Devuelve el usuario identificado o lanza un error de autorización. */
function requireUser_() {
  var identity = getIdentity_();
  if (identity.reason === 'NO_USERS') {
    throw new Error('No hay usuarios registrados. Agrega al menos un usuario en la tabla Usuarios.');
  }
  if (!identity.user) {
    throw new Error('Usuario no autorizado. Debes pertenecer a la tabla de Usuarios para usar la aplicación.');
  }
  return identity.user;
}

/** Identifica al visitante con su código de usuario (sólo si no hay correo disponible). */
function claimIdentity_(codigo) {
  var code = String(codigo == null ? '' : codigo).trim().toUpperCase();
  assert_(code, 'Selecciona un usuario.');

  var email = getVisitorEmail_();
  var users = listUsers_();

  var user = users.filter(function (item) {
    return item.codigo === code;
  })[0] || null;
  assert_(user, 'El código de usuario "' + code + '" no existe en la tabla Usuarios.');

  if (email) {
    // Si Google expone el correo, el vínculo debe ser por correo: no se permite
    // identificarse como otro usuario.
    assert_(user.emails.indexOf(email) !== -1,
      'El correo ' + email + ' no está asociado al usuario ' + code + '. Contacta al administrador.');
  }

  var userKey = getActiveUserKey_();
  if (userKey) {
    setIdentityClaim_(userKey, code);
  }

  return getIdentity_();
}

/** Olvida la identificación guardada en este navegador. */
function forgetIdentity_() {
  setIdentityClaim_(getActiveUserKey_(), '');
  return getIdentity_();
}
