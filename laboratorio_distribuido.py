# laboratorio_distribuido.py
# Laboratorio Grupo 7 - Clusteres y computacion Grid
# Simulacion de procesamiento distribuido de 1.000 archivos:
# un coordinador + N nodos (procesos de Python) en UN SOLO computador.
#
# Uso:
#   python laboratorio_distribuido.py                 (1.000 archivos, 30.000 valores, 3 repeticiones)
#   python laboratorio_distribuido.py --rep 1         (una sola corrida por escenario)
#   python laboratorio_distribuido.py --lineas 60000  (mas carga por archivo)

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
ARCHIVO_LOG = "registro.txt"


def log(msg=""):
    """Imprime en consola y guarda en registro.txt (evidencia)."""
    print(msg, flush=True)
    with open(ARCHIVO_LOG, "a", encoding="utf-8") as f:
        f.write(msg + "\n")


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
def ejecutar_secuencial(rutas):
    t0 = time.perf_counter()
    res = [procesar_archivo(r) for r in rutas]
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


def ejecutar_distribuido(rutas, n_nodos=4, nodo_falla=None, falla_tras=None):
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
                log("   " + msg)
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


def entorno():
    log("== Entorno de ejecucion ==")
    log(f"Python: {sys.version.split()[0]}")
    log(f"Sistema: {platform.system()} {platform.release()} ({platform.machine()})")
    log(f"Procesador: {platform.processor() or 'no disponible'}")
    log(f"Nucleos logicos (os.cpu_count): {os.cpu_count()}")
    try:
        import matplotlib
        log(f"Matplotlib: {matplotlib.__version__}")
    except ImportError:
        log("Matplotlib: no instalado")
    log()


# ---------------------------------------------------------------- principal
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--archivos", type=int, default=N_ARCHIVOS)
    ap.add_argument("--lineas", type=int, default=LINEAS_POR_ARCHIVO)
    ap.add_argument("--rep", type=int, default=3, help="repeticiones por escenario")
    args = ap.parse_args()

    open(ARCHIVO_LOG, "w").close()                         # registro nuevo
    entorno()

    log(f"Generando/ubicando {args.archivos} archivos de {args.lineas:,} valores...")
    rutas = generar_archivos(args.archivos, args.lineas)
    log(f"Archivos listos: {len(rutas)}\n")

    escenarios = [
        ("Secuencial (1 equipo)", 1, {}),
        ("Distribuido 2 nodos", 2, {}),
        ("Distribuido 4 nodos", 4, {}),
        ("4 nodos con falla (nodo 3)", 4, {"nodo_falla": NODO_FALLA, "falla_tras": FALLA_TRAS}),
    ]

    filas, corridas = [], []
    t1 = None
    huella_ref = None

    for nombre, nodos, extra in escenarios:
        log(f"== {nombre} ==")
        tiempos, huellas, por_nodo = [], set(), None
        for rep in range(1, args.rep + 1):
            if nodos == 1:
                res, t = ejecutar_secuencial(rutas)
            else:
                res, t, _ = ejecutar_distribuido(rutas, n_nodos=nodos, **extra)
            assert len(res) == len(rutas), "Faltan resultados"
            tiempos.append(t)
            huellas.add(huella(res))
            corridas.append([nombre, rep, round(t, 4)])
            por_nodo = dict(sorted(Counter(r.get("nodo", 0) for r in res).items()))
            log(f"   corrida {rep}/{args.rep}: {t:.2f} s")
        t_med = statistics.mean(tiempos)
        t_sd = statistics.stdev(tiempos) if len(tiempos) > 1 else 0.0
        if t1 is None:
            t1, huella_ref = t_med, next(iter(huellas))
        speedup = t1 / t_med
        efic = speedup / nodos
        ok = huellas == {huella_ref}
        log(f"   promedio: {t_med:.2f} s (+/- {t_sd:.2f}) | speedup {speedup:.2f} | "
            f"eficiencia {efic:.1%}")
        if nodos > 1:
            log(f"   tareas completadas por nodo (ultima corrida): {por_nodo}")
        log(f"   huella {next(iter(huellas))} | coincide con la secuencial: {'SI' if ok else 'NO'}\n")
        filas.append([nombre, nodos, round(t_med, 4), round(t_sd, 4), round(speedup, 4),
                      round(efic, 4), len(rutas), next(iter(huellas)), "OK" if ok else "DIFERENTE"])

    log("== Resumen ==")
    log(f"{'Escenario':32}{'Nodos':>6}{'Tiempo(s)':>11}{'Speedup':>9}{'Efic.':>8}  Verif.")
    for f in filas:
        log(f"{f[0]:32}{f[1]:>6}{f[2]:>11.2f}{f[4]:>9.2f}{f[5]:>8.1%}  {f[8]}")

    with open("resultados.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["escenario", "nodos", "tiempo_s", "desv_tiempo_s", "speedup",
                    "eficiencia", "archivos", "huella", "verificacion"])
        w.writerows(filas)
    with open("corridas.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["escenario", "corrida", "tiempo_s"])
        w.writerows(corridas)

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots(1, 2, figsize=(12, 4.5))
        etiquetas = [f[0] for f in filas]
        barras = ax[0].bar(etiquetas, [f[2] for f in filas],
                           yerr=[f[3] for f in filas], capsize=4, color="#4a7ebb")
        ax[0].bar_label(barras, fmt="%.1f s", padding=3)
        ax[0].set_ylabel("Tiempo (s)")
        ax[0].set_title("Tiempo de procesamiento (1.000 archivos)")
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
        plt.tight_layout()
        plt.savefig("grafica_tiempos.png", dpi=150, bbox_inches="tight")
        log("\nArchivos generados: resultados.csv, corridas.csv, grafica_tiempos.png, registro.txt")
    except ImportError:
        log("\nNo se pudo generar la grafica (matplotlib no instalado). Ejecuta: pip install matplotlib")


if __name__ == "__main__":
    mp.freeze_support()
    main()
