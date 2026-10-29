// src/useSimulacion.jsx
// Alimenta el encabezado azul con los resultados REALES de la simulación, en vivo.
//
// Escucha los eventos que nucleo.py ya emite (generacion, corrida_inicio, corrida_fin, global,
// escenario_fin) enganchándose a la conexión que Laboratorio.jsx ya usa (EventSource, fetch o
// WebSocket), así que no hace falta tocar Laboratorio.jsx ni el backend.
// Si algún día no engancha, la alternativa limpia es llamar publicar(ev) en Laboratorio.jsx
// por cada evento que reciba.

import { useSyncExternalStore } from 'react'

const TIPOS = new Set(['generacion', 'corrida_inicio', 'corrida_fin', 'global', 'escenario_fin'])

// ------------------------------------------------------------------ estado compartido
const vacio = () => ({ archivos: null, generacion: null, activo: null, porcentaje: null, esc: {} })
// Se guarda en globalThis para que sobreviva a recargas en caliente de Vite
const G = (globalThis.__vivoStore ??= { estado: vacio(), subs: new Set() })
const emitir = (nuevo) => { G.estado = nuevo; G.subs.forEach((f) => f()) }
const ponerEsc = (esc, idx, cambios) => ({ ...esc, [idx]: { ts: [], fila: null, ...esc[idx], ...cambios } })

export function publicar(ev) {
  const s = G.estado
  switch (ev.tipo) {
    case 'generacion':   // el primer evento de cada ejecución trae hechas = 0: empieza de cero
      return emitir({ ...(ev.hechas === 0 ? vacio() : s), archivos: ev.total, generacion: { hechas: ev.hechas, total: ev.total } })
    case 'corrida_inicio':
      return emitir({
        ...s, generacion: null,
        activo: { nombre: ev.nombre, rep: ev.rep, totalRep: ev.total_rep },
        esc: ponerEsc(s.esc, ev.escenario, { nombre: ev.nombre, nodos: ev.nodos }),
      })
    case 'corrida_fin': {
      const ts = [...(s.esc[ev.escenario]?.ts ?? [])]
      ts[ev.rep - 1] = ev.t
      return emitir({ ...s, esc: ponerEsc(s.esc, ev.escenario, { ts }) })
    }
    case 'global':
      return emitir({ ...s, porcentaje: ev.porcentaje })
    case 'escenario_fin':   // fila = [nombre, nodos, t_med, t_sd, speedup, eficiencia, archivos, huella, ok]
      return emitir({ ...s, esc: ponerEsc(s.esc, ev.escenario, { nombre: ev.fila[0], nodos: ev.fila[1], fila: ev.fila }) })
    default:
  }
}

// ------------------------------------------------------------------ números del encabezado
const media = (a) => {
  const v = a.filter((x) => x != null)
  return v.length ? v.reduce((p, c) => p + c, 0) / v.length : null
}


export function resumen(s) {
  const lista = Object.entries(s.esc)
    .map(([i, e]) => ({
      idx: Number(i),
      nom: e.nombre,
      nodos: e.nodos,
      fail: /falla/i.test(e.nombre ?? ''),
      t: e.fila ? e.fila[2] : media(e.ts),
      r: e.ts.filter(x => x != null),
    }))
    .filter(e => e.t != null && e.nodos)
    .sort((a, b) => a.idx - b.idx)

  const b = lista.find(e => e.nodos === 1) ?? null

  const resultados = lista.map(e => {
    const sp = b && e.t > 0 ? b.t / e.t : null
    const ef = sp != null ? (sp / e.nodos) * 100 : null

    return {
      ...e,
      sp,
      ef,
      c: e.fail
        ? '#D9822B'
        : e.nodos === 1
          ? '#0B2545'
          : e.nodos === 2
            ? '#1F4E9C'
            : '#3478D4',
      l: e.nodos === 1
        ? ['Secuencial', '1 equipo']
        : [`${e.nodos} nodos`, e.fail ? 'con falla' : 'distribuido'],
    }
  })

  const m = resultados
    .filter(e => !e.fail && e.nodos > 1 && e.sp != null)
    .reduce((a, c) => !a || c.sp > a.sp ? c : a, null)

  const falla = resultados.find(e => e.fail) ?? null
  const sinFalla = falla
    ? resultados.find(e => !e.fail && e.nodos === falla.nodos)
    : null

  const costo = falla && sinFalla ? falla.t - sinFalla.t : null

  let texto = null

  if (s.generacion) {
    texto = `Generando archivos de datos… ${s.generacion.hechas} de ${s.generacion.total}`
  } else if (s.porcentaje != null && s.porcentaje >= 100) {
    texto = 'Ejecución completa: estos son los resultados de tu simulación.'
  } else if (s.activo) {
    texto =
      `● En vivo · ${s.activo.nombre} · corrida ${s.activo.rep}/${s.activo.totalRep}` +
      (s.porcentaje != null ? ` · ${Math.round(s.porcentaje)} % del total` : '')
  }

  return {
    b,
    m: b && m ? m : null,
    costo,
    archivos: s.archivos,
    texto,
    resultados,
  }
}


const suscribir = (f) => { G.subs.add(f); return () => G.subs.delete(f) }
export const useSimulacion = () => resumen(useSyncExternalStore(suscribir, () => G.estado))

// ------------------------------------------------------------------ enganche a la conexión existente
function extraer(x, tipoDefecto, salida, prof = 0) {
  if (!x || typeof x !== 'object' || prof > 4) return
  if (Array.isArray(x)) { x.forEach((y) => extraer(y, undefined, salida, prof + 1)); return }
  const tipo = x.tipo ?? tipoDefecto
  if (TIPOS.has(tipo)) { salida.push({ ...x, tipo }); return }
  Object.values(x).forEach((y) => extraer(y, undefined, salida, prof + 1))
}

function aplicarTexto(texto, tipoSSE) {
  let t = String(texto).trim()
  if (t.startsWith('data:')) t = t.slice(5).trim()
  if (!t || (t[0] !== '{' && t[0] !== '[')) return 0
  try {
    const salida = []
    extraer(JSON.parse(t), tipoSSE, salida)
    salida.forEach(publicar)
    return salida.length
  } catch {
    return 0
  }
}

async function espiar(resp) {
  const ct = resp.headers.get('content-type') || ''
  if (!resp.body || !/json|event-stream|text\/plain/i.test(ct)) return
  const lector = resp.body.getReader()
  const dec = new TextDecoder()
  let buf = '', todo = '', hubo = false, tipoSSE
  const linea = (l) => {
    l = l.trim()
    if (!l) { tipoSSE = undefined; return }
    if (l.startsWith('event:')) { tipoSSE = l.slice(6).trim(); return }
    if (aplicarTexto(l, tipoSSE)) hubo = true
  }
  for (;;) {
    const { done, value } = await lector.read()
    if (done) break
    const txt = dec.decode(value, { stream: true })
    if (todo.length < 2_000_000) todo += txt
    buf += txt
    const partes = buf.split('\n')
    buf = partes.pop()
    partes.forEach(linea)
  }
  linea(buf)
  if (!hubo && todo) aplicarTexto(todo)   // JSON de una sola pieza (consulta periódica)
}

function instalar() {
  if (typeof window === 'undefined' || window.__vivoInstalado) return
  window.__vivoInstalado = true

  if (window.fetch) {
    const original = window.fetch.bind(window)
    window.fetch = (...args) => original(...args).then((r) => {
      try { espiar(r.clone()).catch(() => {}) } catch { /* no se puede leer: se ignora */ }
      return r
    })
  }

  const ES = window.EventSource
  if (ES) {
    const Nuevo = function (...a) {
      const es = new ES(...a)
      es.addEventListener('message', (m) => aplicarTexto(m.data))
      const agregar = es.addEventListener.bind(es)
      es.addEventListener = (tipo, fn, op) => {       // eventos SSE con nombre (event: nodo, etc.)
        if (!['open', 'error', 'message'].includes(tipo)) agregar(tipo, (m) => aplicarTexto(m.data, tipo))
        return agregar(tipo, fn, op)
      }
      return es
    }
    Nuevo.prototype = ES.prototype
    ;['CONNECTING', 'OPEN', 'CLOSED'].forEach((k) => { Nuevo[k] = ES[k] })
    window.EventSource = Nuevo
  }

  const WS = window.WebSocket
  if (WS) {
    window.WebSocket = class extends WS {
      constructor(...a) {
        super(...a)
        this.addEventListener('message', (m) => { if (typeof m.data === 'string') aplicarTexto(m.data) })
      }
    }
  }
}

instalar()
