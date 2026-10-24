
   # Laboratorio Grupo 7: procesamiento distribuido de 1.000 archivos
   Sistemas Distribuidos - Universidad Tecnológica de Pereira

   Simulación en un único computador: un coordinador y cuatro nodos
   (procesos de Python con multiprocessing). No es una Grid ni un clúster real.

   ## Ejecución
   pip install matplotlib
   python laboratorio_distribuido.py

   ## Resultados (Windows 11, 12 núcleos lógicos)
   | Escenario | Nodos | Tiempo (s) | Speedup | Eficiencia |
   |---|---|---|---|---|
   | Secuencial | 1 | 7,40 | 1,00 | 100 % |
   | Distribuido | 2 | 4,13 | 1,79 | 89,6 % |
   | Distribuido | 4 | 2,24 | 3,31 | 82,7 % |
   | 4 nodos con falla | 4 | 2,51 | 2,94 | 73,6 % |

   Archivos: resultados.csv, corridas.csv, registro.txt, grafica_tiempos.png, capturas/