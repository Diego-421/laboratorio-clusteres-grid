# Laboratorio Grupo 7: procesamiento distribuido de 1.000 archivos

Sistemas Distribuidos - Universidad Tecnológica de Pereira

Simulación en un único computador: un coordinador y cuatro nodos
(procesos de Python con multiprocessing). No es una Grid ni un clúster real.

## Ejecución

```
pip install matplotlib
python laboratorio_distribuido.py
```

El script genera los 1.000 archivos de datos la primera vez (unos 270 MB, que no se
suben al repositorio) y crea los archivos de resultados.

## Interfaz web (simulación en vivo + resultados)

La interfaz está hecha en React (`interfaz-web/`) y se comunica con el servidor Flask (`app.py`),
que ejecuta la simulación real de `nucleo.py` y envía el progreso en vivo.

**Uso normal** (un solo servidor, http://127.0.0.1:5000):

```
pip install flask matplotlib
cd interfaz-web && npm install && npm run build && cd ..
python app.py
```

**Desarrollo** (recarga automática; el proxy de Vite reenvía `/api` a Flask):

```
python app.py            # terminal 1
cd interfaz-web
npm run dev              # terminal 2 -> http://localhost:5173
```

Si se publica solo el frontend (GitHub Pages, etc.) no hay servidor Flask: la interfaz lo detecta
y muestra la animación ilustrativa en lugar de la simulación real.

## Resultados (Windows 11, 12 núcleos lógicos)

| Escenario | Nodos | Tiempo (s) | Speedup | Eficiencia |
|---|---|---|---|---|
| Secuencial | 1 | 7,40 | 1,00 | 100 % |
| Distribuido | 2 | 4,13 | 1,79 | 89,6 % |
| Distribuido | 4 | 2,24 | 3,31 | 82,7 % |
| 4 nodos con falla | 4 | 2,51 | 2,95 | 73,6 % |

## Archivos

- `laboratorio_distribuido.py`: código del laboratorio
- `resultados.csv`: resumen por escenario
- `corridas.csv`: tiempo de cada corrida
- `registro.txt`: registro completo de la ejecución
- `grafica_tiempos.png`: gráfica comparativa
- `Capturas/`: evidencias de la ejecución