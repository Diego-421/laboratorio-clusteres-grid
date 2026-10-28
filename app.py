import io
import json
import multiprocessing as mp
import queue
import threading
from pathlib import Path

from flask import Flask, Response, abort, jsonify, request, send_file, send_from_directory

import nucleo

BASE = Path(__file__).resolve().parent
DIST = BASE / "interfaz-web" / "dist"          # resultado de: cd interfaz-web && npm run build
CARPETA = DIST if (DIST / "index.html").exists() else BASE / "static"   # si no hay build, se usa static/index.html

app = Flask(__name__, static_folder=str(CARPETA), static_url_path="")
cola_eventos = queue.Queue()
estado = {"corriendo": False, "cancelar": threading.Event(), "filas": None, "corridas": None}


def emitir(ev):
    cola_eventos.put(ev)


def validar(d):
    try:
        archivos, lineas, rep = int(d["archivos"]), int(d["lineas"]), int(d.get("rep", 3))
    except (KeyError, TypeError, ValueError):
        return None
    if not (8 <= archivos <= 2000 and 1000 <= lineas <= 100_000 and 1 <= rep <= 5):
        return None
    return {"archivos": archivos, "lineas": lineas, "rep": rep}


def trabajo(config):
    try:
        filas, corridas = nucleo.ejecutar_escenarios(
            config,
            on_log=lambda m: emitir({"tipo": "log", "mensaje": m}),
            on_progreso=emitir,
            cancelar=estado["cancelar"])
        estado["filas"], estado["corridas"] = filas, corridas
        emitir({"tipo": "fin", "filas": filas, "corridas": corridas})
    except nucleo.Cancelado:
        emitir({"tipo": "cancelado"})
    except Exception as e:
        emitir({"tipo": "error", "mensaje": str(e)})
    finally:
        estado["corriendo"] = False


@app.get("/")
def inicio():
    try:
        return send_from_directory(CARPETA, "index.html")
    except Exception:
        return "Servidor activo. Falta la interfaz: ejecuta 'npm run build' en interfaz-web."


@app.get("/api/eta")
def eta():
    config = validar(request.args)
    if config is None:
        return jsonify(error="Parámetros fuera de rango"), 400
    return jsonify(nucleo.estimar_eta(config["archivos"], config["lineas"], config["rep"]))


@app.post("/api/iniciar")
def iniciar():
    if estado["corriendo"]:
        return jsonify(error="Ya hay una simulación en curso"), 409
    config = validar(request.get_json(silent=True) or {})
    if config is None:
        return jsonify(error="Parámetros fuera de rango"), 400
    while not cola_eventos.empty():          # descartar eventos de corridas anteriores
        cola_eventos.get_nowait()
    estado.update(corriendo=True, filas=None, corridas=None)
    estado["cancelar"].clear()
    threading.Thread(target=trabajo, args=(config,), daemon=True).start()
    return jsonify(ok=True)


@app.post("/api/cancelar")
def cancelar():
    estado["cancelar"].set()
    return jsonify(ok=True)


@app.get("/api/eventos")
def eventos():
    def flujo():
        while True:
            try:
                ev = cola_eventos.get(timeout=15)
                yield f"data: {json.dumps(ev)}\n\n"
            except queue.Empty:
                yield ": ping\n\n"           # mantiene viva la conexión
    return Response(flujo(), mimetype="text/event-stream")


@app.get("/api/grafica.png")
def grafica():
    if not estado["filas"]:
        abort(404)
    fig = nucleo.crear_figura(estado["filas"])
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=120, bbox_inches="tight")
    buf.seek(0)
    return send_file(buf, mimetype="image/png")


if __name__ == "__main__":
    mp.freeze_support()
    app.run(host="127.0.0.1", port=5000, debug=False)