import argparse
import csv
import hashlib
import json
import multiprocessing as mp
import os
import platform
import queue
import random
import statistics
import sys
import time
from collections import Counter
from pathlib import Path

N_ARCHIVOS = 1000
LINEAS_POR_ARCHIVO = 30_000
SEMILLA = 42
NODO_FALLA = 3          # nodo que se "cae" en el escenario de tolerancia a fallos
FALLA_TRAS = 100        # tareas que alcanza a completar antes de caerse


class Cancelado(Exception):
    pass
# ---------------------------------------------------------------- datos
def generar_archivos(n, lineas):
    """Crea n archivos con 'lineas' valores normales (media 50, desv. 15)."""
    directorio = Path(f"datos_{lineas}")
    directorio.mkdir(exist_ok=True)
    rutas = []
    for i in range(n):
        ruta = directorio / f"datos_{i:04d}.txt"
        if not ruta.exists():
            rng = random.Random(SEMILLA + i)          # cada archivo es reproducible
            valores = (f"{rng.gauss(50, 15):.6f}" for _ in range(lineas))
            ruta.write_text("\n".join(valores), encoding="ascii")
        rutas.append(str(ruta))
    return rutas


# ---------------------------------------------------------------- tarea
def procesar_archivo(ruta):
    """Tarea unitaria: leer, ordenar y calcular media, desviacion y mediana."""
    with open(ruta, "rb") as f:
        contenido = f.read()
    datos = [float(x) for x in contenido.split()]
    datos.sort()
    n = len(datos)
    media = sum(datos) / n
    varianza = sum((x - media) ** 2 for x in datos) / n      # poblacional
    if n % 2:
        mediana = datos[n // 2]
    else:
        mediana = (datos[n // 2 - 1] + datos[n // 2]) / 2
    return {
        "archivo": ruta,
        "n": n,
        "media": media,
        "desv": varianza ** 0.5,
        "mediana": mediana,
        "sha": hashlib.sha256(contenido).hexdigest()[:12],
    }


# ---------------------------------------------------------------- secuencial
def ejecutar_secuencial(rutas, cancelar=None):
    t0 = time.perf_counter()
    res = []
    for r in rutas:
        if cancelar is not None and cancelar.is_set():
            raise Cancelado()
        res.append(procesar_archivo(r))
    return res, time.perf_counter() - t0


# ---------------------------------------------------------------- distribuido
def nodo_trabajador(id_nodo, cola_tareas, cola_res, falla_tras=None):
    """Proceso que hace de nodo: toma tareas de su cola y envia resultados."""
    hechas = 0
    while True:
        ruta = cola_tareas.get()
        if ruta is None:                                   # senal de fin
            break
        if falla_tras is not None and hechas >= falla_tras:
            time.sleep(0.5)                                # deja vaciar la cola de resultados
            os._exit(1)                                    # caida abrupta del nodo
        r = procesar_archivo(ruta)
        r["nodo"] = id_nodo
        cola_res.put(r)
        hechas += 1


def ejecutar_distribuido(rutas, n_nodos=4, nodo_falla=None, falla_tras=None,on_evento=None, cancelar=None):
    ctx = mp.get_context("spawn")
    colas = [ctx.Queue() for _ in range(n_nodos)]          # una cola de tareas por nodo
    cola_res = ctx.Queue()                                 # cola comun de resultados
    pendientes = {i: set() for i in range(n_nodos)}

    for i, r in enumerate(rutas):                          # reparto circular inicial
        colas[i % n_nodos].put(r)
        pendientes[i % n_nodos].add(r)

    procs = [ctx.Process(target=nodo_trabajador,
                         args=(i, colas[i], cola_res, falla_tras if i == nodo_falla else None))
             for i in range(n_nodos)]

    t0 = time.perf_counter()
    for p in procs:
        p.start()

    resultados, caidos, eventos = {}, set(), []
    while len(resultados) < len(rutas):                    # recoleccion de resultados
        try:
            res = cola_res.get(timeout=0.2)
            resultados.setdefault(res["archivo"], res)     # evita contar dos veces un archivo
            pendientes[res["nodo"]].discard(res["archivo"])
        except queue.Empty:
            pass
        for i, p in enumerate(procs):                      # deteccion de fallos
            if i not in caidos and p.exitcode not in (None, 0):
                caidos.add(i)
                vivos = [j for j in range(n_nodos) if j not in caidos]
                if not vivos:
                    raise RuntimeError("Todos los nodos cayeron")
                huerfanas = [r for r in pendientes[i] if r not in resultados]
                for k, r in enumerate(huerfanas):          # reasignacion
                    d = vivos[k % len(vivos)]
                    colas[d].put(r)
                    pendientes[d].add(r)
                pendientes[i] = set()
                msg = (f"t={time.perf_counter() - t0:.2f}s | nodo {i} CAIDO | "
                       f"{len(huerfanas)} tareas reasignadas a nodos {vivos}")
                eventos.append(msg)
                if on_evento:
                    on_evento(""+msg)
    tiempo = time.perf_counter() - t0

    for i in range(n_nodos):
        if i not in caidos:
            colas[i].put(None)
    for p in procs:
        p.join(timeout=5)
    return list(resultados.values()), tiempo, eventos


# ---------------------------------------------------------------- verificacion
def huella(resultados):
    base = sorted((r["archivo"], round(r["media"], 6), round(r["desv"], 6), round(r["mediana"], 6))
                  for r in resultados)
    return hashlib.sha256(json.dumps(base).encode()).hexdigest()[:16]


def entorno(on_log=print):
    on_log("== Entorno de ejecucion ==")
    on_log(f"Python: {sys.version.split()[0]}")
    on_log(f"Sistema: {platform.system()} {platform.release()} ({platform.machine()})")
    on_log(f"Procesador: {platform.processor() or 'no disponible'}")
    on_log(f"Nucleos logicos (os.cpu_count): {os.cpu_count()}")
    try:
        import matplotlib
        on_log(f"Matplotlib: {matplotlib.__version__}")
    except ImportError:
        on_log("Matplotlib: no instalado")
        
#____________________________________

def ejecutar_escenarios(config, on_log=print, on_progreso=None, cancelar=None):
    rutas = generar_archivos(config["archivos"], config["lineas"])
    escenarios = [
        ("Secuencial (1 equipo)", 1, {}),
        ("Distribuido 2 nodos", 2, {}),
        ("Distribuido 4 nodos", 4, {}),
        ("4 nodos con falla (nodo 3)", 4,
         {"nodo_falla": NODO_FALLA, "falla_tras": FALLA_TRAS}),
    ]
    total = len(escenarios) * config["rep"]
    hechas = 0
    filas, corridas, t1, huella_ref = [], [], None, None

    for nombre, nodos, extra in escenarios:
        on_log(f"== {nombre} ==")
        tiempos, huellas = [], set()
        for rep in range(1, config["rep"] + 1):
            if nodos == 1:
                res, t = ejecutar_secuencial(rutas, cancelar)
            else:
                res, t, _ = ejecutar_distribuido(
                    rutas, n_nodos=nodos, on_evento=on_log, cancelar=cancelar, **extra)
            tiempos.append(t)
            huellas.add(huella(res))
            corridas.append([nombre, rep, round(t, 4)])
            hechas += 1
            on_log(f"  corrida {rep}/{config['rep']}: {t:.2f} s")
            if on_progreso:
                on_progreso(hechas / total * 100)

        t_med = statistics.mean(tiempos)
        t_sd = statistics.stdev(tiempos) if len(tiempos) > 1 else 0.0
        if t1 is None:
            t1, huella_ref = t_med, next(iter(huellas))
        speedup = t1 / t_med
        ok = huellas == {huella_ref}
        filas.append([nombre, nodos, round(t_med, 4), round(t_sd, 4),
                      round(speedup, 4), round(speedup / nodos, 4),
                      len(rutas), next(iter(huellas)), "OK" if ok else "DIFERENTE"])
    return filas, corridas