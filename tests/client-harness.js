/**
 * Prueba de humo del cliente (temporal): ejecuta los parciales HTML en Node
 * con un DOM simulado y un backend falso de google.script.run.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');

class FakeClassList {
  constructor() { this.set = new Set(); }
  add(...names) { names.forEach((n) => this.set.add(n)); }
  remove(...names) { names.forEach((n) => this.set.delete(n)); }
  contains(name) { return this.set.has(name); }
  toggle(name, force) {
    const on = force === undefined ? !this.set.has(name) : !!force;
    if (on) this.set.add(name); else this.set.delete(name);
    return on;
  }
}

class FakeElement {
  constructor(id, tag) {
    this.id = id || '';
    this.tagName = (tag || 'div').toUpperCase();
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.children = [];
    this.classList = new FakeClassList();
    this.listeners = {};
    this.disabled = false;
    this.checked = false;
  }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((item) => item !== fn);
  }
  dispatch(type, event) {
    (this.listeners[type] || []).forEach((fn) => fn(Object.assign({ preventDefault() {}, target: this }, event)));
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] === undefined ? null : this.attributes[name]; }
  appendChild(child) { this.children.push(child); return child; }
  remove() {}
  focus() {}
  blur() {}
  scrollIntoView() {}
  getBoundingClientRect() { return { top: 0, bottom: 0, left: 0, right: 0 }; }
  closest() { return null; }
  get firstElementChild() {
    if (!this._firstChild) this._firstChild = new FakeElement('', 'div');
    return this._firstChild;
  }
  querySelector(selector) {
    this._stubs = this._stubs || new Map();
    if (!this._stubs.has(selector)) this._stubs.set(selector, new FakeElement('', 'div'));
    return this._stubs.get(selector);
  }
  querySelectorAll() { return []; }
}

const elements = new Map();
// Ids que se simulan ausentes (HTML servido de otra versión).
const missing = new Set();

function makeDocument() {
  return {
    title: '',
    getElementById(id) {
      if (missing.has(id)) return null;
      if (!elements.has(id)) elements.set(id, new FakeElement(id));
      return elements.get(id);
    },
    createElement(tag) { return new FakeElement('', tag); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {}
  };
}

const document = makeDocument();

/* ---------------------------------------------------------- Backend falso */
const calls = [];

function entry(overrides) {
  return Object.assign({
    _row: 10, codigoUsuario: 'JP', proyecto: '15', proyectoNombre: 'Sitio web',
    cliente: 'Acme', tipoActividad: 'Programacion', actividad: 'Maquetado',
    observaciones: '', fecha: '2026-11-04', horaInicio: '08:00', horaFin: '09:30', minutos: 90
  }, overrides || {});
}

function bootstrapData() {
  return {
    app: { title: 'Control de Tiempo', today: '2026-11-04', roundMinutes: 10, spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/x' },
    identity: { email: 'jp@example.com', emailVisible: true, user: { codigo: 'JP', nombre: 'Juan Perez' }, source: 'email', reason: '', availableUsers: [], hasUsers: true },
    schemas: {
      Proyectos: {
        name: 'Proyectos', key: 'numero', autoKey: true, labelField: 'nombre',
        computedFields: ['minutosMes', 'minutosMesAnterior', 'minutosAnio'],
        columns: [
          { field: 'numero', label: 'Numero', type: 'text', input: 'text', required: true, readOnlyOnEdit: true, computed: false, sortable: false, hint: '' },
          { field: 'nombre', label: 'Nombre', type: 'text', input: 'text', required: true, readOnlyOnEdit: false, computed: false, sortable: false, hint: '' },
          { field: 'numeroCliente', label: 'Numero Cliente', type: 'text', input: 'select', options: 'clients', required: false, readOnlyOnEdit: false, computed: false, sortable: false, hint: '' },
          { field: 'activo', label: 'Activo', type: 'boolean', input: 'checkbox', required: false, readOnlyOnEdit: false, computed: false, sortable: false, hint: '' },
          { field: 'fechaCreacion', label: 'Fecha Creacion', type: 'text', input: 'date', required: false, readOnlyOnEdit: false, computed: false, sortable: false, hint: '' },
          { field: 'minutosMes', label: 'Horas Mes', type: 'number', input: 'none', computed: true, sortable: true, readOnlyOnEdit: true, title: 'Horas dedicadas en noviembre 2026' },
          { field: 'minutosMesAnterior', label: 'Horas Mes Anterior', type: 'number', input: 'none', computed: true, sortable: true, readOnlyOnEdit: true, title: 'Horas dedicadas en octubre 2026' },
          { field: 'minutosAnio', label: 'Horas Año', type: 'number', input: 'none', computed: true, sortable: true, readOnlyOnEdit: true, title: 'Horas dedicadas en el año 2026' }
        ]
      }
    },
    clients: [{ numero: '1', nombre: 'Acme' }],
    projects: [
      { numero: '15', nombre: 'Sitio web', cliente: 'Acme', activo: true },
      { numero: '16', nombre: 'Viejo', cliente: '', activo: false }
    ],
    activityTypes: ['Programacion', 'Analisis'],
    users: [{ codigo: 'JP', nombre: 'Juan Perez' }],
    defaults: { fecha: '2026-11-04', horaInicio: '09:30' }
  };
}


const backend = {
  apiBootstrap() {
    calls.push(['apiBootstrap', []]);
    return { ok: true, data: bootstrapData() };
  },
  apiDayEntries(fecha) {
    calls.push(['apiDayEntries', [fecha]]);
    return {
      ok: true,
      data: {
        fecha: fecha,
        // El servidor devuelve los registros de menor a mayor hora de inicio;
        // el panel del día debe mostrarlos al revés.
        entries: [
          entry({
            _row: 9, horaInicio: '07:00', horaFin: '07:30', minutos: 30,
            tipoActividad: 'Analisis', actividad: 'Revisión de backlog'
          }),
          entry()
        ],
        totalMinutos: 120,
        count: 2
      }
    };
  },
  apiSaveTimeEntry(payload) {
    calls.push(['apiSaveTimeEntry', [payload]]);
    const saved = entry({
      _row: Number(payload._row) || 11,
      proyecto: payload.proyecto,
      tipoActividad: payload.tipoActividad,
      actividad: payload.actividad,
      observaciones: payload.observaciones || '',
      horaInicio: payload.horaInicio,
      horaFin: payload.horaFin || '10:00',
      minutos: 60,
      fecha: payload.fecha
    });
    return {
      ok: true,
      data: {
        entry: saved,
        dayEntries: { fecha: payload.fecha, entries: [saved], totalMinutos: 60, count: 1 },
        // El servidor marca "updated" cuando el payload traia "_row".
        updated: !!payload._row
      }
    };
  },
  apiListTable(table) {
    calls.push(['apiListTable', [table]]);
    return {
      ok: true,
      data: {
        table: table,
        schema: bootstrapData().schemas.Proyectos,
        rows: [
          { _row: 2, numero: '15', nombre: 'Sitio web', numeroCliente: '1', clienteNombre: 'Acme', activo: true, fechaCreacion: '2026-01-05', minutosMes: 90, minutosMesAnterior: 0, minutosAnio: 300 },
          { _row: 3, numero: '7', nombre: 'App móvil', numeroCliente: '1', clienteNombre: 'Acme', activo: true, fechaCreacion: '2026-02-10', minutosMes: 240, minutosMesAnterior: 30, minutosAnio: 600 },
          { _row: 4, numero: '9', nombre: 'Soporte', numeroCliente: '0', clienteNombre: '', activo: false, fechaCreacion: '2026-03-01', minutosMes: 0, minutosMesAnterior: 15, minutosAnio: 45 }
        ],
        clients: [{ numero: '1', nombre: 'Acme' }]
      }
    };
  },
  apiListEntries(filters) {
    calls.push(['apiListEntries', [filters]]);
    return { ok: true, data: { desde: filters.desde, hasta: filters.hasta, entries: [entry()], totalMinutos: 90, count: 1, truncated: false } };
  },
  apiDeleteTimeEntry(row) {
    calls.push(['apiDeleteTimeEntry', [row]]);
    return { ok: true, data: { deleted: true, row: row } };
  },
  apiDeleteTableRow(table, key) {
    calls.push(['apiDeleteTableRow', [table, key]]);
    return { ok: true, data: { deleted: true, table: table, key: key } };
  },
  apiSaveTableRow(table, payload) {
    calls.push(['apiSaveTableRow', [table, payload]]);
    return { ok: true, data: { table: table, row: Object.assign({ _row: 7 }, payload), created: !payload._row } };
  },
  /**
   * Detalle de un proyecto (drill down). El proyecto 9 no tiene registros.
   * El mock no reproduce el orden ni la paginacion del servidor: entrega dos
   * paginas ya armadas para comprobar que el cliente las pide y las pinta.
   */
  apiProjectDetail(numero, page) {
    calls.push(['apiProjectDetail', [numero, page]]);
    const p = Math.max(1, Number(page) || 1);
    const vacio = String(numero) === '9';

    const octubre = {
      monthKey: '2026-10',
      label: 'Octubre 2026',
      count: 1,
      totalMinutos: 60,
      monthCount: 1,
      monthMinutos: 60,
      entries: [
        entry({
          _row: 13, fecha: '2026-10-05', horaInicio: '09:00', horaFin: '10:00', minutos: 60,
          tipoActividad: 'Analisis', actividad: 'De octubre', observaciones: 'Cierre del mes'
        })
      ]
    };

    const noviembre = {
      monthKey: '2026-11',
      label: 'Noviembre 2026',
      count: 2,
      totalMinutos: 90,
      monthCount: 2,
      monthMinutos: 90,
      entries: [
        entry({
          _row: 10, fecha: '2026-11-01', horaInicio: '08:00', horaFin: '09:00', minutos: 60,
          actividad: 'Primera del mes'
        }),
        entry({
          _row: 11, fecha: '2026-11-02', horaInicio: '08:00', horaFin: '08:30', minutos: 30,
          actividad: 'Segunda del mes'
        })
      ]
    };

    return {
      ok: true,
      data: {
        proyecto: {
          numero: String(numero), nombre: 'Sitio web', cliente: 'Acme',
          activo: true, fechaCreacion: '2026-01-05'
        },
        periods: {
          monthLabel: 'noviembre 2026', previousMonthLabel: 'octubre 2026', yearLabel: 'año 2026'
        },
        totals: vacio
          ? { minutosMes: 0, minutosMesAnterior: 0, minutosAnio: 0, totalMinutos: 0, count: 0 }
          : { minutosMes: 90, minutosMesAnterior: 60, minutosAnio: 300, totalMinutos: 150, count: 150 },
        rango: vacio ? { desde: '', hasta: '' } : { desde: '2026-10-05', hasta: '2026-11-02' },
        page: vacio ? 1 : p,
        pageSize: 100,
        pageCount: vacio ? 1 : 2,
        months: vacio ? [] : (p === 1 ? [noviembre] : [octubre])
      }
    };
  },
  apiIdentifyUser(codigo) {
    calls.push(['apiIdentifyUser', [codigo]]);
    return { ok: true, data: bootstrapData() };
  },
  apiForgetIdentity() {
    calls.push(['apiForgetIdentity', []]);
    return { ok: true, data: bootstrapData() };
  }
};

function runBuilder() {
  let onSuccess = null;
  let onFailure = null;
  const proxy = new Proxy({}, {
    get(target, prop) {
      if (prop === 'withSuccessHandler') return (fn) => { onSuccess = fn; return proxy; };
      if (prop === 'withFailureHandler') return (fn) => { onFailure = fn; return proxy; };
      return function (...args) {
        setTimeout(() => {
          try {
            const result = backend[prop](...args);
            if (onSuccess) onSuccess(JSON.parse(JSON.stringify(result)));
          } catch (error) {
            if (onFailure) onFailure(error);
          }
        }, 0);
      };
    }
  });
  return proxy;
}


/* ---------------------------------------------------------- Contexto */
const googleApi = {};
Object.defineProperty(googleApi, 'run', {
  // Cada acceso emula el objeto runner independiente de google.script.run.
  get() { return runBuilder(); }
});

const sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  document: document,
  google: { script: googleApi }
};
const context = vm.createContext(sandbox);
sandbox.window = context;
sandbox.location = { reload() {} };

function loadPartial(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  if (!match) throw new Error('No se encontro <script> en ' + file);
  vm.runInContext(match[1], context, { filename: file });
}

['ClientCore.html', 'ClientTime.html', 'ClientTables.html', 'ClientApp.html'].forEach(loadPartial);

const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms || 60));
const evalIn = (code) => vm.runInContext(code, context, { filename: 'eval' });
const get = (id) => document.getElementById(id);

/** Simula que el HTML no trae ciertos ids (por ejemplo, una versión anterior). */
function setMissing(ids) {
  missing.clear();
  (ids || []).forEach((id) => missing.add(id));
}

const failures = [];

function check(label, condition, detail) {
  if (condition) {
    console.log('OK   ' + label);
  } else {
    failures.push(label + (detail ? ' :: ' + detail : ''));
    console.log('FAIL ' + label + (detail ? ' :: ' + detail : ''));
  }
}

module.exports = { context, get, calls, check, failures, tick, sandbox, elements, backend, evalIn, setMissing };

