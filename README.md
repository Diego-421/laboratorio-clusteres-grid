# Laboratorio Grupo 7: procesamiento distribuido de archivos

Sistemas Distribuidos · Universidad Tecnológica de Pereira

Simulación en un único computador de un esquema coordinador–nodos: un coordinador reparte archivos entre varios nodos (procesos de Python con `multiprocessing`) y se mide cuánto se reduce el tiempo frente al procesamiento secuencial. **No es una Grid ni un clúster real.**

El laboratorio se maneja desde una interfaz web local: se eligen los parámetros, se ve el avance de cada nodo en vivo y al final se obtienen tablas de tiempos y gráficas.

## Qué hace

- Genera N archivos de datos con valores aleatorios reproducibles (semilla fija).
- La tarea sobre cada archivo es leerlo, ordenarlo y calcular su media, desviación estándar y mediana.
- Ejecuta siempre los mismos cuatro escenarios: **1 equipo (secuencial)**, **2 nodos**, **4 nodos** y **4 nodos con falla**.
- En el escenario con falla, el nodo 3 se cae de forma abrupta tras completar el 40 % de sus tareas. El coordinador detecta la caída y reasigna las tareas pendientes a los nodos que siguen vivos.
- Verifica que los cuatro escenarios producen exactamente los mismos resultados comparando una huella (hash) de los datos calculados.
- Calcula el speedup (tiempo secuencial / tiempo del escenario) y la eficiencia (speedup / número de nodos).

## Requisitos

- Python 3.9 o superior
- Un navegador web
- Espacio en disco para los datos generados (ver más abajo)

## Instalación y ejecución

```
pip install -r requirements.txt
python app.py
```

Después abre <http://127.0.0.1:5000> en el navegador.

## Cómo usar la interfaz

1. **Parámetros:** cantidad de archivos (8 a 2.000), valores por archivo (1.000 a 100.000) y repeticiones por escenario (1 a 5). La página muestra una estimación aproximada del tiempo total, calculada con una medición rápida de tu equipo.
2. **Ejecutar simulación:** la primera vez con un tamaño nuevo se generan los archivos de datos, lo que tarda más. Mientras corre, cada nodo muestra su propia barra de progreso y el nodo que cae se marca en rojo. Se puede cancelar en cualquier momento.
3. **Resultados:** tabla con el tiempo promedio, la desviación, el speedup, la eficiencia y la verificación de cada escenario; gráfica comparativa y tiempo de cada corrida.
4. **Referencia y ley de Amdahl:** la página incluye resultados de referencia de una ejecución oficial del laboratorio, que se comparan con los de tu simulación, y un simulador interactivo para ver cómo la parte no paralelizable del trabajo limita la aceleración.

## Cómo funciona

El coordinador crea una cola de tareas por nodo y reparte los archivos de forma circular. Los nodos procesan sus tareas y envían los resultados por una cola común. El coordinador recibe los resultados, detecta nodos caídos por su código de salida y reasigna a los nodos vivos las tareas que no se completaron.

La interfaz recibe el avance en tiempo real mediante *Server-Sent Events*, y la gráfica final se genera con matplotlib.

## Estructura del proyecto

```
app.py              Servidor web (Flask) y endpoints
nucleo.py           Lógica del laboratorio: datos, nodos, escenarios, ETA y gráfica
static/index.html   Interfaz web (HTML, CSS y JavaScript en un solo archivo)
requirements.txt    Dependencias de Python
```

## Notas

- Los archivos de datos se guardan en carpetas `datos_<valores por archivo>/`, que no se suben al repositorio. Cada valor ocupa unos 9 bytes: 1.000 archivos de 30.000 valores son unos 270 MB.
- Los tiempos dependen de tu equipo (núcleos, carga y energía), así que no coinciden con los de la referencia.
- Solo puede haber una simulación a la vez. Mientras corre, no abras la interfaz en otra pestaña.
- Con muy pocos valores por archivo, arrancar los nodos cuesta más de lo que se ahorra y el speedup puede quedar por debajo de 1. Se recomienda usar 30.000 valores o más.