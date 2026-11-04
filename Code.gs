/**
 * Punto de entrada de la aplicación web.
 *
 * Se despliega como: Ejecutar como "yo" / Acceso "Cualquier usuario con
 * cuenta de Google" (ver appsscript.json).
 */

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  template.bootError = '';
  template.appTitle = CONFIG.APP_TITLE;
  template.roundMinutes = CONFIG.ROUND_MINUTES;

  return template
    .evaluate()
    .setTitle(CONFIG.APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=5')
    // El favicon se define en Index.html con un data URI (proyecto propio).
    // Antes se usaba setFaviconUrl(...) con el icono de Google Sheets.
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Permite incluir archivos HTML parciales desde las plantillas. */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Devuelve la URL de la aplicación web publicada (para compartir). */
function getWebAppUrl() {
  var url = ScriptApp.getService().getUrl();
  Logger.log('URL de la aplicación: ' + url);
  return url;
}
