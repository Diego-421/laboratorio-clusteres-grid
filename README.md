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