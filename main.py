from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn

# 1. INICIALIZACIÓN DE LA APP
# ------------------------------------------------------------------------------
app = FastAPI(
    title="SVIBVA - API de Seguridad",
    description="Backend asíncrono para detección de objetos con YOLOv8"
)

# 2. CONFIGURACIÓN DE ARCHIVOS Y RUTAS
# ------------------------------------------------------------------------------
# Enlazamos la carpeta 'static' para CSS y JS
app.mount("/static", StaticFiles(directory="static"), name="static")

# Enlazamos la carpeta 'templates' para el HTML
templates = Jinja2Templates(directory="templates")

# 3. RUTAS DEL SISTEMA
# ------------------------------------------------------------------------------
@app.get("/", response_class=HTMLResponse)
async def read_dashboard(request: Request):
    """
    Ruta raíz: Carga la interfaz del Dashboard.
    Se utiliza 'async' para optimizar el rendimiento en el hardware Core i5.
    """
    # CORRECCIÓN PARA VERSIONES NUEVAS DE FASTAPI:
    return templates.TemplateResponse(request=request, name="dashboard.html")

# 4. PUNTO DE ARRANQUE (BOOTSTRAP)
# ------------------------------------------------------------------------------
if __name__ == "__main__":
    # Ejecutamos en el puerto 5050 para evitar colisiones
    # 'reload=True' es vital durante el desarrollo para ver cambios al instante
    uvicorn.run("main:app", host="0.0.0.0", port=5050, reload=True)