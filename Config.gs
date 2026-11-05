/**
 * Configuración global de la aplicación "Control de Tiempo".
 *
 * IMPORTANTE: los nombres de las hojas (SHEETS) no deben cambiarse una vez
 * creada la hoja de cálculo, porque el código los usa como identificadores.
 */
var CONFIG = {
  APP_TITLE: 'Control de Tiempo',

  // Zona horaria de respaldo (se usa Session.getScriptTimeZone() si está disponible).
  TIME_ZONE: 'America/Caracas',

  // Redondeo de horas en minutos (10).
  ROUND_MINUTES: 10,

  // Propiedades del script.
  PROP: {
    SPREADSHEET_ID: 'SPREADSHEET_ID',
    IDENTITY_MAP: 'IDENTITY_MAP'
  },

  // Caché de datos de referencia (proyectos, clientes, tipos de actividad).
  CACHE: {
    PREFIX: 'timesheet_v1_',
    SECONDS: 300
  },

  // Máximo de registros devueltos en los listados.
  LIMITS: {
    ENTRIES: 300,
    TABLE_ROWS: 2000,
    // Registros por página en el detalle de un proyecto (drill down).
    DETAIL_PAGE: 100
  },

  // Nombres de las hojas.
  SHEETS: {
    CLIENTES: 'Clientes',
    PROYECTOS: 'Proyectos',
    TIEMPOS: 'Tiempos',
    USUARIOS: 'Usuarios',
    TIPOS: 'TiposActividad'
  }
};

/**
 * Tipos de actividad iniciales.
 * La primera vez se copian a la hoja "TiposActividad"; después esa hoja
 * es la fuente de verdad y puede editarse directamente.
 */
var DEFAULT_ACTIVITY_TYPES = [
  'Administrativa',
  'Análisis',
  'Aprendiendo',
  'Asesoría',
  'Carga datos',
  'Comunicación',
  'Contenido Web',
  'Configuración',
  'Cursos - Preparación',
  'Datos - Análisis',
  'Datos - Limpieza',
  'Diseño',
  'Documentación',
  'Email',
  'Enseñando',
  'Escribir',
  'Esfuerzo ventas',
  'Fallas',
  'Gerencia',
  'Implementación',
  'Infraestructura',
  'Investigación',
  'Mantenimiento',
  'Mercadeo',
  'Migración',
  'Operación',
  'Otros',
  'Planificación',
  'Programación',
  'Pruebas',
  'Recursos Humanos',
  'Salud',
  'Seguimiento',
  'Soporte',
  'Supervisión',
  'Tutoría'
];
