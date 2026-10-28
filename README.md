# Laboratorio Grupo 7: Procesamiento distribuido de 1.000 archivos

**Sistemas Distribuidos - Universidad Tecnológica de Pereira**

Simulación en un único computador con un coordinador y cuatro nodos (procesos de Python con multiprocessing). No es una Grid ni un clúster físico real, sino un entorno de experimentación local diseñado para evaluar el procesamiento en paralelo, la aceleración (speedup), la eficiencia y la tolerancia a fallos ante la caída y reasignación de tareas de un nodo (Nodo 3).

---

## 1. Requisitos previos (Instalación desde cero)

Para ejecutar el proyecto completo (Backend en Python + Frontend en React) necesitas tener instalados **Python** y **Node.js**.

### Instalación de Node.js
1. Ingresa a https://nodejs.org/es/download
2. Descarga el instalador para Windows dando clic en **Windows Installer (.msi)**.
3. Abre el instalador descargado y dale a **"Next"** en todas las ventanas, dejando las opciones por defecto.
4. **Paso obligatorio:** Al terminar la instalación, **cierra VS Code por completo y vuélvelo a abrir** para que la terminal reconozca los comandos node y npm.

---

## 2. Preparación del repositorio e instalación de dependencias

Abre una terminal en VS Code (asegúrate de estar en la carpeta raíz del proyecto) y sigue estos pasos en orden:

### Paso 1: Bajar los cambios de la rama
    git checkout interfaz-final
    git pull

### Paso 2: Instalar las dependencias de Python (desde la raíz)
En la misma carpeta raíz del repositorio, instala Flask, CORS y Matplotlib:
    pip install flask flask-cors matplotlib

### Paso 3: Instalar las dependencias de la interfaz web
Entra a la carpeta interfaz-web e instala los paquetes de Node.js:
    cd interfaz-web
    npm install

---

## 3. Ejecución del proyecto (Simulación en vivo + Interfaz Web)

La aplicación conecta la interfaz gráfica en React (interfaz-web/) con el servidor backend en Flask (app.py), el cual ejecuta la lógica real de procesamiento distribuido (nucleo.py) y transmite el avance en vivo hacia el navegador.

Para ejecutar el sistema completo **debes abrir dos terminales diferentes** en VS Code:

### Terminal 1 — Servidor Backend (Python / Flask)
Ubicado en la **carpeta raíz del proyecto**, ejecuta:
    python app.py

* Verás en consola que el servidor queda escuchando en http://127.0.0.1:5000.
* **No cierres esta terminal** mientras uses la aplicación.

### Terminal 2 — Servidor Frontend (React / Vite)
Abre una segunda terminal, entra a la carpeta interfaz-web y levanta el servidor de desarrollo:
    cd interfaz-web
    npm run dev

* La terminal mostrará la dirección local activa.

### Paso final: Abrir en el navegador
Ingresa en tu navegador web a la siguiente dirección:
    http://localhost:5173/

---

## 4. Modos alternativos de ejecución

### Modo A: Servidor único compilado (Producción en puerto 5000)
Si deseas compilar la interfaz de React para que Flask la sirva directamente desde un solo proceso (sin usar dos terminales):
    cd interfaz-web
    npm install
    npm run build
    cd ..
    python app.py

Luego abre en el navegador http://127.0.0.1:5000.

### Modo B: Ejecución clásica solo por consola (Sin interfaz web)
Para correr el script original que genera los 1.000 archivos de datos (~270 MB la primera vez) y exporta los resultados directamente en archivos locales:
    python laboratorio_distribuido.py

> Nota sobre despliegues estáticos: Si se publica únicamente el frontend (por ejemplo, en GitHub Pages) sin el servidor Flask activo, la interfaz lo detecta automáticamente y muestra una animación ilustrativa como fallback en lugar de la simulación real.

---

## 5. Secciones y funcionalidades de la Interfaz Web

* **Simulación en vivo (Laboratorio.jsx):** Permite ajustar parámetros personalizados de la prueba —cantidad de archivos (8 a 2.000), valores por archivo (1.000 a 100.000) y repeticiones por escenario (1 a 5)—. Calcula el tiempo estimado (ETA) según el rendimiento del equipo, muestra barras de progreso en tiempo real por cada nodo vía SSE, simula la caída del Nodo 3 y genera al instante las tablas y gráficas de la ejecución.
* **Resultados de referencia (Graficas.jsx):** Presenta las gráficas oficiales del laboratorio (tiempos de procesamiento, curva de speedup frente al ideal y eficiencia porcentual por escenario).
* **Detalle de escenarios (Detalle.jsx):** Desglose interactivo de las 3 corridas individuales por cada configuración (Secuencial, 2 nodos, 4 nodos y 4 nodos con falla) y el reparto de archivos por nodo.
* **Ley de Amdahl (Calculadora.jsx):** Simulador teórico interactivo con controles deslizantes para analizar cómo el porcentaje paralelizable del trabajo limita la aceleración máxima.
* **Comparación y Evidencias (Comparacion.jsx):** Cuadros comparativos de arquitecturas y registro documental de la práctica.

---

## 6. Resultados de referencia (Windows 11, 12 núcleos lógicos)

| Escenario | Nodos | Tiempo promedio (s) | Speedup | Eficiencia |
|---|---|---|---|---|
| Secuencial (1 equipo) | 1 | 7,40 | 1,00x | 100 % |
| Distribuido (2 nodos) | 2 | 4,13 | 1,79x | 89,6 % |
| Distribuido (4 nodos) | 4 | 2,24 | 3,31x | 82,7 % |
| 4 nodos con falla (Nodo 3) | 4 | 2,51 | 2,95x | 73,6 % |

---

## 7. Estructura del repositorio

* app.py: Servidor backend en Flask (endpoints /api/eta, /api/iniciar, /api/eventos y /api/grafica.png).
* nucleo.py: Motor de simulación distribuida con multiprocessing, reparto de carga y tolerancia a fallos.
* laboratorio_distribuido.py: Script autónomo original del laboratorio.
* interfaz-web/: Proyecto frontend en React + Vite (src/App.jsx, src/Laboratorio.jsx, src/Simulacion.jsx, src/Graficas.jsx, src/Detalle.jsx, src/Calculadora.jsx, src/Comparacion.jsx).
* resultados.csv: Tabla resumen con los promedios, desviaciones, speedup y eficiencia por escenario.
* corridas.csv: Tiempos individuales registrados en cada corrida.
* registro.txt: Bitácora completa de la ejecución.
* grafica_tiempos.png: Gráfica comparativa generada por el script.
* Capturas/: Evidencias de la ejecución.