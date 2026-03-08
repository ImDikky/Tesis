# =============================================================================
# SVIBVA - Backend Principal (FastAPI)
# Sistema de Videovigilancia Inteligente Basado en Visión Artificial
# =============================================================================
import cv2
import json
import time
import psutil
import asyncio
import numpy as np
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

import uvicorn
import sys
import os

# Ensure the app directory is in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Módulos SVIBVA
from config import SERVER_HOST, SERVER_PORT, MJPEG_TARGET_FPS
from camera_manager import camera_manager
from detector import detector
from alert_bot import alert_bot
from logger import log_system, log_detection_event, get_recent_events

# =============================================================================
# CICLO DE VIDA — Arranque y apagado del servidor
# =============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestor del ciclo de vida: inicializa recursos al arranque y los libera al apagado."""
    log_system("=" * 60)
    log_system("  SVIBVA v1.0 — Sistema de Videovigilancia Inteligente")
    log_system("  Desarrollado en IUTA — Caracas, Venezuela")
    log_system("=" * 60)
    log_system(f"🚀 Servidor iniciado en http://{SERVER_HOST}:{SERVER_PORT}")
    log_system("📷 Cámaras activas: " + str(len(camera_manager.list_cameras())))
    
    # Lanzar tarea de broadcast de eventos WebSocket en background
    task = asyncio.create_task(_broadcast_events())
    
    yield  # ← El servidor corre aquí
    
    # Apagado limpio
    task.cancel()
    camera_manager.stop_all()
    log_system("🛑 Servidor detenido. Cámaras liberadas.")


# =============================================================================
# INICIALIZACIÓN DE LA APP
# =============================================================================
app = FastAPI(
    title="SVIBVA — API de Seguridad",
    description="Backend asíncrono para detección de objetos con YOLOv8. "
                "Opera completamente en red local sin requerir internet.",
    version="1.0.0",
    lifespan=lifespan,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

# Gestor de conexiones WebSocket activas
_ws_clients: list[WebSocket] = []

# Cache del último evento enviado por WebSocket (para evitar duplicados)
_last_broadcast_event_id: Optional[str] = None


# =============================================================================
# WEBSOCKET — Push de eventos en tiempo real al dashboard
# =============================================================================
@app.websocket("/ws/events")
async def websocket_events(ws: WebSocket):
    """
    WebSocket endpoint. El dashboard se conecta aquí para recibir en tiempo real:
    - Eventos de detección YOLO
    - Actualizaciones de estado de cámaras
    """
    await ws.accept()
    _ws_clients.append(ws)
    log_system(f"📡 Cliente WebSocket conectado. Total activos: {len(_ws_clients)}")
    try:
        while True:
            # Mantener la conexión viva (el servidor hace el broadcast en _broadcast_events)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        _ws_clients.remove(ws)
        log_system(f"📡 Cliente WebSocket desconectado. Total activos: {len(_ws_clients)}")


async def _broadcast_events():
    """
    Tarea de fondo: revisa periódicamente si hay nuevos eventos y los envía
    a todos los clientes WebSocket conectados.
    """
    global _last_broadcast_event_id
    while True:
        try:
            if _ws_clients:
                events = get_recent_events(1)
                if events:
                    latest = events[0]
                    if latest["id"] != _last_broadcast_event_id:
                        _last_broadcast_event_id = latest["id"]
                        payload = json.dumps({"type": "detection", "event": latest})
                        dead_clients = []
                        for ws in _ws_clients:
                            try:
                                await ws.send_text(payload)
                            except Exception:
                                dead_clients.append(ws)
                        for ws in dead_clients:
                            _ws_clients.remove(ws)
        except Exception as e:
            log_system(f"Error en broadcast WebSocket: {e}", "error")
        await asyncio.sleep(0.5)


# =============================================================================
# GENERADOR DE STREAM MJPEG — Núcleo del sistema de videovigilancia
# =============================================================================
def _frame_generator(cam_id: str):
    """
    Generador de frames MJPEG con detecciones YOLO anotadas.

    Optimizaciones de rendimiento:
    - sleep entre frames para respetar MJPEG_TARGET_FPS y no saturar CPU
    - JPEG quality 75: buen equilibrio calidad/tamaño para red local
    """
    cam = camera_manager.get_camera(cam_id)
    if cam is None:
        return

    frame_interval = 1.0 / MJPEG_TARGET_FPS if MJPEG_TARGET_FPS else 0
    last_sent      = 0.0

    while True:
        frame = cam.last_frame

        # ── FPS throttle: no enviar más rápido de MJPEG_TARGET_FPS ────────────
        now = time.monotonic()
        elapsed = now - last_sent
        if elapsed < frame_interval:
            time.sleep(frame_interval - elapsed)
        last_sent = time.monotonic()

        # ── Si no hay frame ──────────────────────────────────────────────────
        if frame is None:
            placeholder = _build_offline_frame(cam.name)
            _, buf = cv2.imencode(".jpg", placeholder)
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                + buf.tobytes() + b"\r\n")
            time.sleep(0.2)
            continue

        # ── Detección YOLO ────────────────────────────────────────────────────
        annotated, detections = detector.process_frame(frame, cam_id)

        # ── Overlay de información en el frame ─────────────────────────────────
        annotated = _draw_overlay(annotated, cam)

        # ── Registro y alertas ─────────────────────────────────────────────────
        if detections:
            alert_detections = [d for d in detections if d.get("alert")]
            if alert_detections:
                log_detection_event(cam_id, cam.name, alert_detections)
                alert_bot.send_alert(cam_id, cam.name, annotated, alert_detections)

        # ── Codificar y emitir frame ───────────────────────────────────────────
        _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
        yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
            + buf.tobytes() + b"\r\n")


def _build_offline_frame(camera_name: str) -> np.ndarray:
    """Genera un frame negro con mensaje de 'Sin señal' para cámaras offline."""
    frame = np.zeros((360, 640, 3), dtype=np.uint8)
    cv2.putText(frame, "SIN SEÑAL", (220, 160),
                cv2.FONT_HERSHEY_DUPLEX, 1.5, (60, 60, 60), 2)
    cv2.putText(frame, camera_name, (10, 340),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (80, 80, 80), 1)
    return frame


def _draw_overlay(frame: np.ndarray, cam) -> np.ndarray:
    """Dibuja el overlay de información (nombre de cámara, FPS, timestamp) sobre el frame."""
    h, w = frame.shape[:2]
    
    # Barra semitransparente en la parte inferior
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, h - 30), (w, h), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)
    
    # Nombre de cámara + FPS
    label = f"{cam.name}  |  {cam.fps:.0f} FPS"
    cv2.putText(frame, label, (8, h - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1, cv2.LINE_AA)
    
    # Punto verde de "grabando"
    cv2.circle(frame, (w - 15, h - 15), 5, (0, 255, 100), -1)
    
    return frame


# =============================================================================
# RUTAS HTTP
# =============================================================================

@app.get("/", response_class=HTMLResponse)
async def read_dashboard(request: Request):
    """Ruta raíz: carga el Dashboard principal de SVIBVA."""
    return templates.TemplateResponse(request=request, name="dashboard.html")


@app.get("/video_feed/{cam_id}")
def video_feed(cam_id: str):
    """
    Stream MJPEG de una cámara con detecciones YOLO anotadas.
    El navegador lo consume con un simple tag <img src="/video_feed/cam_0">.
    """
    return StreamingResponse(
        _frame_generator(cam_id),
        media_type="multipart/x-mixed-replace;boundary=frame",
    )


@app.get("/api/cameras")
def api_list_cameras():
    """Lista todas las cámaras registradas con su estado (online/offline, FPS)."""
    return JSONResponse(camera_manager.list_cameras())


@app.post("/api/cameras")
async def api_add_camera(request: Request):
    """
    Agrega una nueva cámara al sistema en tiempo de ejecución.
    Body JSON: {"id": "cam_1", "name": "Patio", "source": "0"}
    """
    body = await request.json()
    cam_id = body.get("id", f"cam_{int(time.time())}")
    name   = body.get("name", "Nueva Cámara")
    source = body.get("source", 0)

    cam = camera_manager.add_camera(cam_id, name, source)
    log_system(f"➕ Cámara agregada vía API: {name} ({source})")
    return JSONResponse(cam.info, status_code=201)


@app.delete("/api/cameras/{cam_id}")
def api_remove_camera(cam_id: str):
    """Elimina y detiene una cámara del sistema. Libera el hardware físico."""
    removed = camera_manager.remove_camera(cam_id)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Cámara '{cam_id}' no encontrada.")
    log_system(f"🗑 Cámara eliminada y hardware liberado: {cam_id}")
    return JSONResponse({"status": "removed", "cam_id": cam_id})


@app.post("/api/cameras/{cam_id}/toggle")
def api_toggle_camera(cam_id: str):
    """
    Pausa o reanuda una cámara.
    - Al PAUSAR: libera el hardware físico INMEDIATAMENTE (luz LED se apaga).
    - Al REANUDAR: vuelve a abrir la fuente de video.
    """
    cam = camera_manager.get_camera(cam_id)
    if cam is None:
        raise HTTPException(status_code=404, detail=f"Cámara '{cam_id}' no encontrada.")

    if cam.paused:
        cam.resume()
        action = "resumed"
    else:
        cam.pause()
        action = "paused"

    log_system(f"{'⏸' if action == 'paused' else '▶'} Cámara {cam_id} → {action}")
    return JSONResponse({"status": action, "cam_id": cam_id, **cam.info})



@app.get("/api/alerts")
def api_alerts(limit: int = 50):
    """Retorna los últimos eventos de detección registrados en memoria."""
    return JSONResponse(get_recent_events(min(limit, 100)))

@app.get("/api/settings")
def api_get_settings():
    """Retorna la configuración actual relevante para el dashboard."""
    return JSONResponse({
        "confidence_threshold": detector.conf_threshold,
        "frame_skip": detector.frame_skip,
        "telegram_enabled": alert_bot.enabled,
        "alert_cooldown_seconds": alert_bot.alert_cooldown
    })

@app.post("/api/settings")
async def api_update_settings(request: Request):
    """Actualiza configuración en memoria y en el archivo de forma persistente."""
    body = await request.json()
    updates = {}
    
    if "confidence_threshold" in body:
        updates["CONFIDENCE_THRESHOLD"] = float(body["confidence_threshold"])
    if "frame_skip" in body:
        updates["FRAME_SKIP"] = int(body["frame_skip"])
    if "telegram_enabled" in body:
        updates["TELEGRAM_ENABLED"] = bool(body["telegram_enabled"])
    if "alert_cooldown_seconds" in body:
        updates["ALERT_COOLDOWN_SECONDS"] = int(body["alert_cooldown_seconds"])
        
    if updates:
        import config
        success = config.update_config_file(updates)
        
        # Actualizar instancias en memoria
        conf_thr = updates.get("CONFIDENCE_THRESHOLD")
        f_skip = updates.get("FRAME_SKIP")
        detector.update_settings(conf_threshold=conf_thr, frame_skip=f_skip)
        
        tel_en = updates.get("TELEGRAM_ENABLED")
        alert_cd = updates.get("ALERT_COOLDOWN_SECONDS")
        alert_bot.update_settings(telegram_enabled=tel_en, alert_cooldown=alert_cd)
        
        action = "actualizados y guardados" if success else "actualizados solo en memoria (error al guardar)"
        log_system(f"⚙ Parámetros de configuración {action}.")
        return JSONResponse({"status": "success", "saved": success})
    
    return JSONResponse({"status": "no_changes"})

@app.get("/api/stats")
def api_stats():
    """
    Retorna el consumo de recursos del servidor (CPU, RAM) y estadísticas de cámaras.
    El dashboard llama a este endpoint cada 3 segundos para actualizar el medidor de recursos.
    """
    cameras = camera_manager.list_cameras()
    return JSONResponse({
        "cpu_percent":  psutil.cpu_percent(interval=0.1),
        "ram_percent":  psutil.virtual_memory().percent,
        "ram_used_gb":  round(psutil.virtual_memory().used / (1024 ** 3), 1),
        "ram_total_gb": round(psutil.virtual_memory().total / (1024 ** 3), 1),
        "cameras":      cameras,
        "bot_status":   alert_bot.status,
    })


@app.get("/api/network")
def api_network():
    """Retorna la IP local del servidor para mostrarla en el dashboard (acceso LAN)."""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = "127.0.0.1"
    
    return JSONResponse({
        "ip":   ip,
        "port": SERVER_PORT,
        "url":  f"http://{ip}:{SERVER_PORT}",
    })


# =============================================================================
# PUNTO DE ARRANQUE
# =============================================================================
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=SERVER_HOST,
        port=SERVER_PORT,
        reload=False,   # reload=False en producción para estabilidad de hilos
        workers=1,      # 1 worker: necesario para compartir estado en memoria
    )