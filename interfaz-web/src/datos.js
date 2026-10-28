// Si cambian los resultados, edita solo este archivo (valores de resultados.csv y corridas.csv).
export const HUELLA = '0f17e564b2ee4430'
export const REPO = 'https://github.com/Diego-421/laboratorio-clusteres-grid'
export const ESC = [
  { l: ['Secuencial', '1 equipo'], nodos: 1, t: 7.40, sp: 1.00, ef: 100, c: '#0B2545', r: [7.49, 7.38, 7.33], nom: 'Secuencial (1 equipo)', dist: [1000] },
  { l: ['2 nodos', 'distribuido'], nodos: 2, t: 4.13, sp: 1.79, ef: 89.6, c: '#1F4E9C', r: [4.22, 4.10, 4.07], nom: 'Distribuido, 2 nodos', dist: [500, 500] },
  { l: ['4 nodos', 'distribuido'], nodos: 4, t: 2.24, sp: 3.31, ef: 82.7, c: '#2E75D6', r: [2.18, 2.33, 2.20], nom: 'Distribuido, 4 nodos', dist: [250, 250, 250, 250] },
  { l: ['4 nodos', 'con falla'], nodos: 4, t: 2.51, sp: 2.95, ef: 73.6, c: '#D9822B', r: [2.52, 2.51, 2.51], nom: '4 nodos con falla (nodo 3)', dist: [300, 300, 300, 100], fail: true },
]
export const f = (n, d = 2) => n.toFixed(d).replace('.', ',')
