
import { f } from './datos.js'

function escala(maximo) {
  const paso = Math.pow(10, Math.floor(Math.log10(maximo || 1)))
  return Math.ceil(maximo / paso) * paso
}

export function Barras({ resultados = [] }) {
  const W = 560, H = 330, L = 48, T = 35, B = 75
  const ch = H - T - B
  const bw = Math.min(84, (W - L - 20) / Math.max(resultados.length * 1.5, 1))
  const gap = (W - L - 20 - bw * resultados.length) /
    Math.max(resultados.length, 1)
  const max = escala(Math.max(1, ...resultados.map(e => e.t)) * 1.15)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="Tiempo real de procesamiento por escenario">
      {[0, 0.25, 0.5, 0.75, 1].map(p => {
        const y = T + ch * (1 - p)
        return (
          <g key={p}>
            <line x1={L} x2={W - 8} y1={y} y2={y} stroke="#C9D3E3" />
            <text x={L - 8} y={y + 4} textAnchor="end"
              fontSize="12" fill="#7A8699">{f(max * p)}</text>
          </g>
        )
      })}

      {resultados.map((e, i) => {
        const x = L + gap * (i + 0.5) + bw * i
        const h = ch * e.t / max
        const y = T + ch - h
        const cx = x + bw / 2

        return (
          <g key={e.idx}>
            <title>
              {e.nom}: {f(e.t)} s.
              Corridas: {e.r.map(t => `${f(t)} s`).join(', ')}
            </title>
            <rect x={x} y={y} width={bw} height={h}
              rx="6" fill={e.c} />
            <text x={cx} y={y - 8} textAnchor="middle"
              fontWeight="700" fontSize="13" fill="#0B2545">
              {f(e.t)} s
            </text>
            <text x={cx} y={y + h / 2 + 5} textAnchor="middle"
              fontWeight="700" fontSize="13" fill="#fff">
              {e.sp == null ? '—' : `${f(e.sp)}×`}
            </text>
            <text x={cx} y={H - 43} textAnchor="middle"
              fontSize="12" fill="#44505F">
              {e.l[0]}
            </text>
            <text x={cx} y={H - 25} textAnchor="middle"
              fontSize="12" fill="#7A8699">
              {e.l[1]}
            </text>
          </g>
        )
      })}

      <text x={L} y="17" fontSize="13" fontWeight="600"
        fill="#0B2545">Tiempo de procesamiento (s)</text>
    </svg>
  )
}

export function Lineas({ resultados = [] }) {
  const datos = resultados.filter(e => e.sp != null && e.nodos > 0)
  const normales = datos.filter(e => !e.fail)
  const fallas = datos.filter(e => e.fail)

  const W = 560, H = 330, L = 45, R = 25, T = 35, B = 55
  const pw = W - L - R, ph = H - T - B
  const maxNodos = Math.max(2, ...datos.map(e => e.nodos))
  const maxSp = Math.max(maxNodos, ...datos.map(e => e.sp))
  const maxY = escala(maxSp * 1.1)

  const X = n => L + pw * (n - 1) / (maxNodos - 1)
  const Y = v => T + ph * (1 - v / maxY)

  const linea = normales
    .filter(e => e.nodos > 1)
    .map(e => `${X(e.nodos)},${Y(e.sp)}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="Speedup calculado a partir de los resultados actuales">
      {[0, 0.25, 0.5, 0.75, 1].map(p => {
        const y = T + ph * (1 - p)
        return (
          <g key={p}>
            <line x1={L} x2={W - R} y1={y} y2={y} stroke="#C9D3E3" />
            <text x={L - 8} y={y + 4} textAnchor="end"
              fontSize="12" fill="#7A8699">{f(maxY * p)}</text>
          </g>
        )
      })}

      {Array.from({ length: maxNodos }, (_, i) => i + 1).map(n => (
        <text key={n} x={X(n)} y={H - 30} textAnchor="middle"
          fontSize="12" fill="#44505F">{n}</text>
      ))}

      <text x={(L + W - R) / 2} y={H - 8}
        textAnchor="middle" fontSize="12" fill="#7A8699">
        Número de nodos
      </text>

      <line x1={X(1)} y1={Y(1)} x2={X(maxNodos)}
        y2={Y(maxNodos)} stroke="#7A8699"
        strokeWidth="2" strokeDasharray="6 5" />

      <text x={W - R} y={Y(maxNodos) - 8}
        textAnchor="end" fontSize="12" fill="#7A8699">
        Ideal ({maxNodos}×)
      </text>

      {linea && (
        <polyline fill="none" stroke="#1F4E9C"
          strokeWidth="3.5" points={linea} />
      )}

      {datos.map(e => {
        const x = X(e.nodos) + (e.fail ? 9 : 0)
        const y = Y(e.sp)

        return (
          <g key={e.idx}>
            <title>{e.nom}: speedup {f(e.sp)}×</title>
            <circle cx={x} cy={y} r="6" fill={e.c} />
            <text x={x} y={y - 12} textAnchor="middle"
              fontSize="12" fontWeight="700" fill={e.c}>
              {f(e.sp)}×
            </text>
          </g>
        )
      })}

      <text x={L} y="17" fontSize="13" fontWeight="600"
        fill="#0B2545">Aceleración (speedup) frente al ideal</text>
    </svg>
  )
}

export function Eficiencia({ resultados = [] }) {
  return (
    <div>
      <h3 className="mini">Eficiencia por escenario</h3>

      {resultados.map(e => (
        <div className="hbar" key={e.idx}>
          <span>{e.nom}</span>
          <div>
            <i style={{
              width: `${Math.max(0, Math.min(100, e.ef ?? 0))}%`,
              background: e.c
            }} />
          </div>
          <b>{e.ef == null ? '—' : `${f(e.ef, 1)} %`}</b>
        </div>
      ))}

      <p className="note">
        Eficiencia = speedup / número de nodos × 100.
        Se calcula con el tiempo secuencial y el tiempo medido
        de cada escenario.
      </p>
    </div>
  )
}
