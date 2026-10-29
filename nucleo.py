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
def generar_archivos(n, lineas, on_archivo=None, cancelar=None):
    directorio = Path(f"datos_{lineas}")
    directorio.mkdir(exist_ok=True)
    rutas = []
    for i in range(n):
        if cancelar is not None and cancelar.is_set():
            raise Cancelado()
        ruta = directorio / f"datos_{i:04d}.txt"
        if not ruta.exists():
            rng = random.Random(SEMILLA + i)
            valores = (f"{rng.gauss(50, 15):.6f}" for _ in range(lineas))
            ruta.write_text("\n".join(valores), encoding="ascii")
        rutas.append(str(ruta))
        if on_archivo and ((i + 1) % 10 == 0 or i + 1 == n):
            on_archivo(i + 1, n)
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
def ejecutar_secuencial(rutas, cancelar=None, on_nodo=None):
    t0 = time.perf_counter()
    res = []
    for i, r in enumerate(rutas):
        if cancelar is not None and cancelar.is_set():
            raise Cancelado()
        res.append(procesar_archivo(r))
        if on_nodo and ((i + 1) % 10 == 0 or i + 1 == len(rutas)):
            on_nodo(0, i + 1, len(rutas), False)
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


def ejecutar_distribuido(rutas, n_nodos=4, nodo_falla=None, falla_tras=None,
                         on_evento=None, on_nodo=None, cancelar=None):
    ctx = mp.get_context("spawn")
    colas = [ctx.Queue() for _ in range(n_nodos)]
    cola_res = ctx.Queue()
    pendientes = {i: set() for i in range(n_nodos)}
    for i, r in enumerate(rutas):
        colas[i % n_nodos].put(r)
        pendientes[i % n_nodos].add(r)
    asignadas = {i: len(pendientes[i]) for i in range(n_nodos)}
    hechas = {i: 0 for i in range(n_nodos)}

    procs = [ctx.Process(target=nodo_trabajador,
                         args=(i, colas[i], cola_res, falla_tras if i == nodo_falla else None))
             for i in range(n_nodos)]

    t0 = time.perf_counter()
    for p in procs:
        p.start()
    if on_nodo:
        for i in range(n_nodos):
            on_nodo(i, 0, asignadas[i], False)

    resultados, caidos, eventos = {}, set(), []
    try:
        while len(resultados) < len(rutas):
            if cancelar is not None and cancelar.is_set():
                raise Cancelado()
            try:
                res = cola_res.get(timeout=0.2)
                if res["archivo"] not in resultados:
                    resultados[res["archivo"]] = res
                    n = res["nodo"]
                    hechas[n] += 1
                    if on_nodo:
                        on_nodo(n, hechas[n], asignadas[n], n in caidos)
                pendientes[res["nodo"]].discard(res["archivo"])
            except queue.Empty:
                pass

            for i, p in enumerate(procs):
                if i not in caidos and p.exitcode not in (None, 0):
                    caidos.add(i)
                    vivos = [j for j in range(n_nodos) if j not in caidos]
                    if not vivos:
                        raise RuntimeError("Todos los nodos cayeron")
                    huerfanas = [r for r in pendientes[i] if r not in resultados]
                    for k, r in enumerate(huerfanas):
                        d = vivos[k % len(vivos)]
                        colas[d].put(r)
                        pendientes[d].add(r)
                        asignadas[d] += 1
                    pendientes[i] = set()
                    asignadas[i] = hechas[i]
                    msg = (f"t={time.perf_counter() - t0:.2f}s | nodo {i} CAIDO | "
                           f"{len(huerfanas)} tareas reasignadas a nodos {vivos}")
                    eventos.append(msg)
                    if on_evento:
                        on_evento("  " + msg)
                    if on_nodo:
                        on_nodo(i, hechas[i], asignadas[i], True)
                        for d in vivos:
                            on_nodo(d, hechas[d], asignadas[d], False)

        tiempo = time.perf_counter() - t0
        for i in range(n_nodos):
            if i not in caidos:
                colas[i].put(None)
        for p in procs:
            p.join(timeout=5)
    finally:
        for p in procs:
            if p.is_alive():
                p.terminate()
                p.join(timeout=2)
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

ESCENARIOS = [
    ("Secuencial (1 equipo)", 1, False),
    ("Distribuido 2 nodos", 2, False),
    ("Distribuido 4 nodos", 4, False),
    ("4 nodos con falla (nodo 3)", 4, True),
]


def ejecutar_escenarios(config, on_log=print, on_progreso=None, cancelar=None):
    emitir = on_progreso or (lambda ev: None)
    emitir({"tipo": "generacion", "hechas": 0, "total": config["archivos"]})
    rutas = generar_archivos(
        config["archivos"], config["lineas"],
        on_archivo=lambda h, t: emitir({"tipo": "generacion", "hechas": h, "total": t}),
        cancelar=cancelar)

    total = len(ESCENARIOS) * config["rep"]
    terminadas = 0
    filas, corridas, t1, huella_ref = [], [], None, None

    for idx, (nombre, nodos, con_falla) in enumerate(ESCENARIOS):
        on_log(f"== {nombre} ==")
        extra = {}
        if con_falla:   # el nodo 3 cae tras completar el 40 % de sus tareas
            extra = {"nodo_falla": NODO_FALLA,
                     "falla_tras": max(1, int(0.4 * len(rutas) / nodos))}
        tiempos, huellas = [], set()

        for rep in range(1, config["rep"] + 1):
            emitir({"tipo": "corrida_inicio", "escenario": idx, "nombre": nombre,
                    "nodos": nodos, "rep": rep, "total_rep": config["rep"]})

            def on_nodo(i, h, t, caido, idx=idx):
                emitir({"tipo": "nodo", "escenario": idx, "nodo": i,
                        "hechas": h, "total": t, "caido": caido})

            if nodos == 1:
                res, t = ejecutar_secuencial(rutas, cancelar, on_nodo)
            else:
                res, t, _ = ejecutar_distribuido(
                    rutas, n_nodos=nodos, on_evento=on_log,
                    on_nodo=on_nodo, cancelar=cancelar, **extra)

            tiempos.append(t)
            huellas.add(huella(res))
            corridas.append([nombre, rep, round(t, 4)])
            terminadas += 1
            on_log(f"  corrida {rep}/{config['rep']}: {t:.2f} s")
            emitir({"tipo": "global", "porcentaje": terminadas / total * 100})

        t_med = statistics.mean(tiempos)
        t_sd = statistics.stdev(tiempos) if len(tiempos) > 1 else 0.0
        if t1 is None:
            t1, huella_ref = t_med, next(iter(huellas))
        speedup = t1 / t_med
        ok = huellas == {huella_ref}
        filas.append([nombre, nodos, round(t_med, 4), round(t_sd, 4),
                      round(speedup, 4), round(speedup / nodos, 4),
                      len(rutas), next(iter(huellas)), "OK" if ok else "DIFERENTE"])
        emitir({"tipo": "escenario_fin", "escenario": idx, "fila": filas[-1]})

    return filas, corridas

#--------------------------------------------------

def crear_figura(filas):
    """Devuelve una Figure con tiempos y speedup. No guarda ni muestra nada."""
    from matplotlib.figure import Figure

    fig = Figure(figsize=(12, 4.5))
    ax = fig.subplots(1, 2)

    etiquetas = [f[0] for f in filas]
    barras = ax[0].bar(etiquetas, [f[2] for f in filas],
                       yerr=[f[3] for f in filas], capsize=4, color="#4a7ebb")
    ax[0].bar_label(barras, fmt="%.1f s", padding=3)
    ax[0].set_ylabel("Tiempo (s)")
    ax[0].set_title(f"Tiempo de procesamiento ({filas[0][6]:,} archivos)".replace(",", "."))
    ax[0].tick_params(axis="x", rotation=20)
    for lbl in ax[0].get_xticklabels():
        lbl.set_ha("right")

    ps = [f[1] for f in filas[:3]]
    ax[1].plot(ps, [f[4] for f in filas[:3]], "o-", label="Speedup medido")
    ax[1].plot(ps, ps, "--", label="Ideal")
    ax[1].set_xticks(ps)
    ax[1].set_xlabel("Nodos")
    ax[1].set_ylabel("Speedup")
    ax[1].set_title("Aceleracion frente al ideal")
    ax[1].legend()

    fig.tight_layout()
    return fig

#----------------------------------------------

def estimar_eta(archivos, lineas, rep, muestra=5):
    import tempfile

    def medir(rutas):
        for r in rutas:                      # calentamiento
            procesar_archivo(r)
        t0 = time.perf_counter()
        for r in rutas:
            procesar_archivo(r)
        return (time.perf_counter() - t0) / len(rutas)

    directorio = Path(f"datos_{lineas}")
    existentes = [str(directorio / f"datos_{i:04d}.txt") for i in range(archivos)
                  if (directorio / f"datos_{i:04d}.txt").exists()]
    faltantes = archivos - len(existentes)
    reales = existentes[:muestra]

    t_gen = 0.0
    if faltantes > 0 or len(reales) < muestra:
        with tempfile.TemporaryDirectory() as tmp:
            rutas = []
            t0 = time.perf_counter()
            for i in range(muestra):
                ruta = Path(tmp) / f"m{i}.txt"
                rng = random.Random(SEMILLA + i)
                ruta.write_text("\n".join(f"{rng.gauss(50, 15):.6f}" for _ in range(lineas)),
                                encoding="ascii")
                rutas.append(str(ruta))
            t_gen = (time.perf_counter() - t0) / muestra
            t_proc = medir(reales if len(reales) >= muestra else rutas)
    else:
        t_proc = medir(reales)

    nucleos = os.cpu_count() or 1
    secuencial = archivos * t_proc

    # (nodos, eficiencia típica, sobrecosto de arranque en s)
    modelo = [(1, 1.00, 0.0), (2, 0.90, 0.6), (4, 0.83, 0.8), (4, 0.74, 1.3)]
    por_escenario = [secuencial / (min(n, nucleos) * ef) + extra for n, ef, extra in modelo]
    generacion = faltantes * t_gen

    return {
        "t_archivo_s": round(t_proc, 5),
        "faltantes": faltantes,
        "generacion_s": round(generacion, 1),
        "por_escenario_s": [round(x, 1) for x in por_escenario],
        "total_s": round(generacion + rep * sum(por_escenario), 1),
        "disco_mb": round(archivos * lineas * 9 / 1e6),
    }