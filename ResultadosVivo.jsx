// src/ResultadosVivo.jsx
// Panel del encabezado: lanza la simulacion real (servidor.py) y muestra su avance en vivo.
import { useState } from 'react'
import { f } from './datos.js'
import { useSimulacion } from './useSimulacion.jsx'
import './ResultadosVivo.css'

const fx = (n, d = 2) => (n == null ? '—' : f(n, d))

function duracion(s) {
  const total = Math.round(s)
  return total >= 60 ? `${Math.floor(total / 60)} min ${total % 60} s` : `${f(s, 1)} s`
}

function Fila({ e }) {
  const listo = e.estado === 'listo'
  const activo = e.estado === 'corriendo'
  const pct = listo ? 100 : e.total ? (e.hechas / e.total) * 100 : 0
  const nodos = Array.from({ length: e.nodos }, (_, i) => i)
  const conteo = (i) => (listo ? e.dist[i] : e.porNodo[i]) ?? 0
  const tope = Math.max(Math.ceil(e.total / e.nodos), ...nodos.map(conteo))

  return (
    <div className={`vivo-fila ${e.estado} ${e.fail ? 'falla' : ''}`}>
      <div className="vivo-cab">
        <strong>{e.nom}</strong>
        <span>
          {listo
            ? `${fx(e.t)} s · ${fx(e.sp)}× · ${fx(e.ef, 1)} %`
            : activo
              ? `corrida ${e.rep}/${e.reps} · ${e.hechas}/${e.total} tareas`
              : 'en espera'}
        </span>
      </div>
      <div className="vivo-barra"><i style={{ width: `${pct}%` }} /></div>

      {e.nodos > 1 && e.estado !== 'espera' && (
        <div className="vivo-nodos">
          {nodos.map((i) => {
            const caido = e.caidos.includes(i)
            return (
              <div key={i} className={`vivo-nodo ${caido ? 'caido' : ''}`}>
                <span>Nodo {i}</span>
                <div className="vivo-barra"><i style={{ width: `${(conteo(i) / tope) * 100}%` }} /></div>
                <em>{conteo(i)}{caido ? ' · caído' : ''}</em>
              </div>
            )
          })}
        </div>
      )}

      {e.eventos.map((ev, k) => (
        <p key={k} className="vivo-evento">
          t = {fx(ev.t)} s · nodo {ev.nodo} caído · {ev.reasignadas} tareas reasignadas a los nodos {ev.vivos.join(', ')}
        </p>
      ))}
    </div>
  )
}

export default function ResultadosVivo() {
  const { estado, fase, escenarios, completos, totalS, error, ejecutar, cancelar } = useSimulacion()
  const [cfg, setCfg] = useState({ archivos: 1000, lineas: 30000, rep: 3 })
  const corriendo = estado === 'corriendo'
  const cambia = (k) => (ev) => setCfg({ ...cfg, [k]: Number(ev.target.value) })
  const verificados = completos.length > 0 && completos.every((e) => e.ok)

  return (
    <div className="vivo">
      <div className="vivo-ctl">
        <label>Archivos
          <input type="number" min="1" max="5000" value={cfg.archivos}
                 onChange={cambia('archivos')} disabled={corriendo} />
        </label>
        <label>Valores por archivo
          <input type="number" min="100" max="200000" value={cfg.lineas}
                 onChange={cambia('lineas')} disabled={corriendo} />
        </label>
        <label>Repeticiones
          <input type="number" min="1" max="10" value={cfg.rep}
                 onChange={cambia('rep')} disabled={corriendo} />
        </label>
        {corriendo
          ? <button className="cancelar" onClick={cancelar}>Cancelar</button>
          : <button onClick={() => ejecutar(cfg)}>{estado === 'idle' ? 'Ejecutar simulación' : 'Ejecutar de nuevo'}</button>}
      </div>

      {corriendo && fase === 'generando' && (
        <p className="vivo-nota">Generando los archivos de datos (solo tarda así la primera vez con estos parámetros)…</p>
      )}
      {estado === 'listo' && (
        <p className="vivo-ok">
          Simulación completada en {duracion(totalS)}
          {verificados && ' · misma huella de verificación en todos los escenarios'}
        </p>
      )}
      {estado === 'cancelado' && <p className="vivo-nota">Simulación cancelada.</p>}
      {estado === 'error' && <p className="vivo-error">{error}</p>}

      {escenarios.length > 0 && (
        <div className="vivo-lista">
          {escenarios.map((e) => <Fila key={e.idx} e={e} />)}
        </div>
      )}
    </div>
  )
}
