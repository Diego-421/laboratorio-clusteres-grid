import { useCallback, useEffect, useRef, useState } from 'react'
import Simulacion from './Simulacion.jsx'

// Escenarios que ejecuta el backend (nucleo.py). El orden debe coincidir con el índice "escenario" de los eventos.
const ESCENARIOS = [
  { nombre: 'Secuencial (1 equipo)', nodos: 1 },
  { nombre: 'Distribuido 2 nodos', nodos: 2 },
  { nombre: 'Distribuido 4 nodos', nodos: 4 },
  { nombre: '4 nodos con falla (nodo 3)', nodos: 4 },
]
const LIMITES = {
  archivos: { min: 8, max: 2000, etiqueta: 'Cantidad de archivos' },
  lineas: { min: 1000, max: 100000, etiqueta: 'Valores por archivo' },
  rep: { min: 1, max: 5, etiqueta: 'Repeticiones por escenario' },
}

const tarjetasIniciales = () =>
  ESCENARIOS.map(e => ({ estado: 'espera', sub: 'En espera', nodos: Array.from({ length: e.nodos }, () => ({ hechas: 0, total: 0, caido: false })) }))

const fmtTiempo = s => { s = Math.round(s); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s` }
const num = (x, d = 2) => Number(x).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })

function leerConfig(c) {
  const v = {}
  for (const k of Object.keys(LIMITES)) {
    const n = Number(c[k])
    if (c[k] === '' || !Number.isInteger(n) || n < LIMITES[k].min || n > LIMITES[k].max) return null
    v[k] = n
  }
  return v
}

export default function Laboratorio() {
  const [servidor, setServidor] = useState('comprobando') // 'comprobando' | 'ok' | 'caido'
  const [cfg, setCfg] = useState({ archivos: '1000', lineas: '30000', rep: '3' })
  const [eta, setEta] = useState(null)
  const [etaMsg, setEtaMsg] = useState('Calculando estimación…')
  const [corriendo, setCorriendo] = useState(false)
  const [estado, setEstado] = useState('En espera.')
  const [pct, setPct] = useState(0)
  const [seg, setSeg] = useState(0)
  const [tarjetas, setTarjetas] = useState(tarjetasIniciales)
  const [filas, setFilas] = useState([])
  const [corridas, setCorridas] = useState([])
  const [grafica, setGrafica] = useState(null)
  const [log, setLog] = useState([])
  const [error, setError] = useState('')

  const fuente = useRef(null)
  const reloj = useRef(null)
  const inicio = useRef(0)
  const buffer = useRef(new Map()) // eventos "nodo" pendientes de pintar (se vuelcan cada 100 ms)
  const flushTimer = useRef(null)
  const versionEta = useRef(0)

  const config = leerConfig(cfg)

  // ¿Está el backend Flask disponible?
  useEffect(() => {
    fetch('/api/eta?archivos=8&lineas=1000&rep=1')
      .then(r => setServidor((r.ok || r.status === 400) && (r.headers.get('content-type') || '').includes('json') ? 'ok' : 'caido'))
      .catch(() => setServidor('caido'))
  }, [])

  // Estimación de tiempo (con espera de 400 ms al escribir)
  useEffect(() => {
    if (servidor !== 'ok') return
    if (!config) { setEta(null); setEtaMsg('Revisa los valores: archivos 8–2000, valores 1000–100000, repeticiones 1–5.'); return }
    setEta(null); setEtaMsg('Calculando estimación…')
    const v = ++versionEta.current
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/eta?archivos=${config.archivos}&lineas=${config.lineas}&rep=${config.rep}`)
        const d = await r.json()
        if (v !== versionEta.current) return
        if (!r.ok) { setEtaMsg(d.error || 'No se pudo estimar.'); return }
        setEta(d)
      } catch { if (v === versionEta.current) setEtaMsg('No se pudo conectar con el servidor.') }
    }, 400)
    return () => clearTimeout(t)
  }, [cfg.archivos, cfg.lineas, cfg.rep, servidor]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { fuente.current?.close(); clearInterval(reloj.current); clearInterval(flushTimer.current) }, [])

  const volcarNodos = useCallback(() => {
    if (buffer.current.size === 0) return
    const evs = [...buffer.current.values()]
    buffer.current.clear()
    setTarjetas(prev => {
      const sig = prev.map(t => ({ ...t, nodos: t.nodos.map(n => ({ ...n })) }))
      evs.forEach(ev => {
        const n = sig[ev.escenario]?.nodos[ev.nodo]
        if (n) { n.hechas = ev.hechas; n.total = ev.total; n.caido = !!ev.caido }
      })
      return sig
    })
  }, [])

  const terminar = useCallback(msg => {
    fuente.current?.close(); fuente.current = null
    clearInterval(reloj.current); clearInterval(flushTimer.current)
    volcarNodos()
    setCorriendo(false); setEstado(msg)
  }, [volcarNodos])

  const manejar = useCallback(ev => {
    if (ev.tipo === 'nodo') { buffer.current.set(`${ev.escenario}-${ev.nodo}`, ev); return }
    volcarNodos() // conserva el orden entre eventos
    switch (ev.tipo) {
      case 'generacion':
        setEstado(`Generando archivos de datos: ${ev.hechas} / ${ev.total}`); break
      case 'log':
        setLog(l => [...l, ev.mensaje]); break
      case 'corrida_inicio':
        setTarjetas(prev => prev.map((t, i) => i === ev.escenario
          ? { estado: 'activo', sub: `Repetición ${ev.rep} de ${ev.total_rep}`, nodos: t.nodos.map(() => ({ hechas: 0, total: 0, caido: false })) }
          : t.estado === 'activo' ? { ...t, estado: 'espera' } : t))
        setEstado(`Escenario ${ev.escenario + 1} de 4 · ${ev.nombre} · repetición ${ev.rep} de ${ev.total_rep}`)
        break
      case 'global':
        setPct(ev.porcentaje); break
      case 'escenario_fin':
        setTarjetas(prev => prev.map((t, i) => i === ev.escenario ? { ...t, estado: 'hecho', sub: `Completado · ${num(ev.fila[2])} s (promedio)` } : t))
        setFilas(fs => [...fs.filter(f => f[0] !== ev.fila[0]), ev.fila])
        break
      case 'fin':
        setFilas(ev.filas); setCorridas(ev.corridas); setPct(100)
        setGrafica(`/api/grafica.png?t=${Date.now()}`)
        terminar(`Simulación completada en ${fmtTiempo((Date.now() - inicio.current) / 1000)}.`)
        break
      case 'cancelado': terminar('Simulación cancelada.'); break
      case 'error': setError(ev.mensaje); terminar('La simulación terminó con un error.'); break
      default: break
    }
  }, [volcarNodos, terminar])

  async function ejecutar() {
    if (!config) { setError('Revisa los valores antes de ejecutar.'); return }
    setError(''); setLog([]); setPct(0); setSeg(0); setFilas([]); setCorridas([]); setGrafica(null)
    setTarjetas(tarjetasIniciales()); buffer.current.clear()
    try {
      const r = await fetch('/api/iniciar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'No se pudo iniciar.'); return }
    } catch { setError('No se pudo conectar con el servidor.'); return }
    setCorriendo(true); setEstado('Iniciando…')
    inicio.current = Date.now()
    reloj.current = setInterval(() => setSeg((Date.now() - inicio.current) / 1000), 500)
    flushTimer.current = setInterval(volcarNodos, 100)
    fuente.current = new EventSource('/api/eventos')
    fuente.current.onmessage = e => manejar(JSON.parse(e.data))
  }

  function cancelar() { setEstado('Cancelando…'); fetch('/api/cancelar', { method: 'POST' }) }

  // Sin backend (por ejemplo en GitHub Pages): se muestra la animación ilustrativa de siempre.
  if (servidor === 'caido') {
    return (
      <>
        <p className="note aviso">
          No se detectó el servidor de la simulación, así que se muestra la animación ilustrativa.
          Para ejecutar la simulación real, lanza <code>python app.py</code>.
        </p>
        <Simulacion />
      </>
    )
  }

  const campo = (k, paso = 1) => (
    <div key={k}>
      <label className="fld" htmlFor={k}>{LIMITES[k].etiqueta} ({LIMITES[k].min.toLocaleString('es-CO')} – {LIMITES[k].max.toLocaleString('es-CO')})</label>
      <input id={k} className="txt" type="number" min={LIMITES[k].min} max={LIMITES[k].max} step={paso} value={cfg[k]} disabled={corriendo}
        aria-invalid={cfg[k] !== '' && !leerConfig({ ...cfg, [k]: cfg[k] }) ? 'true' : undefined}
        onChange={e => setCfg(c => ({ ...c, [k]: e.target.value }))} />
    </div>
  )

  const hayResultados = filas.length > 0
  return (
    <div className="lab">
      <div className="panel">
        <h3 className="mini first">1. Parámetros</h3>
        <div className="campos">{campo('archivos')}{campo('lineas', 1000)}{campo('rep')}</div>
        <div className="eta">
          {eta ? (
            <>
              Tiempo estimado: <b>entre {fmtTiempo(eta.total_s * 0.8)} y {fmtTiempo(eta.total_s * 1.4)}</b>
              <small>
                Datos en disco: ≈ {eta.disco_mb} MB.
                {eta.faltantes > 0 && ` Se generarán ${eta.faltantes} archivos nuevos (≈ ${fmtTiempo(eta.generacion_s)}).`}
                {' '}Es una aproximación basada en una medición rápida de tu equipo.
              </small>
            </>
          ) : etaMsg}
        </div>
        <div className="controls acciones">
          <button onClick={ejecutar} disabled={corriendo || !config || servidor !== 'ok'}>Ejecutar simulación</button>
          <button className="ghost" onClick={cancelar} disabled={!corriendo}>Cancelar</button>
          {error && <span className="error" role="alert">{error}</span>}
        </div>
      </div>

      <div className="panel">
        <h3 className="mini first">2. Ejecución en vivo</h3>
        <div className="coord"><strong>Coordinador</strong><span>{estado}</span></div>
        <div className="gbar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin="0" aria-valuemax="100"><div style={{ width: `${pct}%` }} /></div>
        <div className="meta"><span>{Math.round(pct)} %</span><span>Transcurrido: {fmtTiempo(seg)}</span></div>
        <div className="esc-grid">
          {ESCENARIOS.map((e, i) => {
            const t = tarjetas[i]
            return (
              <div key={e.nombre} className={'node esc' + (t.estado === 'hecho' ? ' done' : t.estado === 'activo' ? ' active' : '')}>
                <h3>{e.nombre}</h3>
                <div className="sub-esc">{t.sub}</div>
                {t.nodos.map((n, k) => (
                  <div className={'nrow' + (n.caido ? ' down' : '')} key={k}>
                    <span>{e.nodos === 1 ? 'Equipo único' : `Nodo ${k}`}{n.caido && ' ✕ caído'}</span>
                    <div className="track"><div className="fill" style={{ width: `${n.total > 0 ? Math.min(100, (n.hechas / n.total) * 100) : 0}%` }} /></div>
                    <span className="cnt">{n.hechas} / {n.total}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        <details className="reg">
          <summary>Registro de la ejecución</summary>
          <pre className="logbox">{log.join('\n')}</pre>
        </details>
      </div>

      {hayResultados && (
        <div className="panel tw">
          <h3 className="mini first">3. Resultados de tu ejecución</h3>
          <table>
            <thead><tr><th>Escenario</th><th>Nodos</th><th>Tiempo (s)</th><th>± Desv. (s)</th><th>Speedup</th><th>Eficiencia</th><th>Verificación</th></tr></thead>
            <tbody>
              {filas.map(f => (
                <tr key={f[0]} className={f[0].includes('falla') ? 'fail' : ''}>
                  <td><strong>{f[0]}</strong></td><td>{f[1]}</td><td>{num(f[2])}</td><td>{num(f[3])}</td><td>{num(f[4])}×</td>
                  <td>{num(f[5] * 100, 1)} %</td><td className={f[8] === 'OK' ? 'okc' : 'malc'}>{f[8]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {grafica && <img className="gimg" src={grafica} alt="Gráfica de tiempos y speedup de la ejecución" />}
          {corridas.length > 0 && (
            <>
              <h3 className="mini">Tiempo de cada corrida</h3>
              <table>
                <thead><tr><th>Escenario</th><th>Corrida</th><th>Tiempo (s)</th></tr></thead>
                <tbody>{corridas.map((c, i) => <tr key={i}><td>{c[0]}</td><td>{c[1]}</td><td>{num(c[2])}</td></tr>)}</tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  )
}
