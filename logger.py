# =============================================================================
# SVIBVA - Sistema de Logging y Registro de Eventos
# =============================================================================
import os
import logging
import json
from datetime import datetime
from collections import deque
from config import LOG_DIR, LOG_FILE, MAX_EVENTS_MEMORY

# Crear directorio de logs si no existe
os.makedirs(LOG_DIR, exist_ok=True)

# ------------------------------------------------------------------------------
# Logger de consola y archivo (formato legible)
# ------------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
system_logger = logging.getLogger("SVIBVA")

# ------------------------------------------------------------------------------
# Cola en memoria de eventos de detección (para el endpoint /api/alerts)
# Soporta hasta MAX_EVENTS_MEMORY eventos sin usar base de datos
# ------------------------------------------------------------------------------
_events_queue: deque = deque(maxlen=MAX_EVENTS_MEMORY)


def log_detection_event(camera_id: str, camera_name: str, detections: list):
    """
    Registra un evento de detección en el log de archivo y en la cola de memoria.

    Args:
        camera_id:    ID interno de la cámara (ej. "cam_0")
        camera_name:  Nombre legible de la cámara (ej. "Entrada Principal")
        detections:   Lista de dicts [{class_name, confidence, bbox}]
    """
    if not detections:
        return

    timestamp = datetime.now()
    event = {
        "id":          f"{camera_id}_{int(timestamp.timestamp() * 1000)}",
        "timestamp":   timestamp.isoformat(),
        "camera_id":   camera_id,
        "camera_name": camera_name,
        "detections":  detections,
        "summary":     ", ".join(
            f"{d['class_name']} ({d['confidence']:.0%})" for d in detections
        ),
    }

    # Guardar en cola de memoria
    _events_queue.appendleft(event)

    # Guardar línea en archivo de log
    log_line = (
        f"[DETECCIÓN] Cám: {camera_name} | "
        f"{event['summary']} | "
        f"Objetos: {len(detections)}"
    )
    system_logger.info(log_line)


def get_recent_events(limit: int = 50) -> list:
    """Retorna los eventos más recientes de la cola de memoria."""
    return list(_events_queue)[:limit]


def log_system(msg: str, level: str = "info"):
    """Log de mensajes del sistema (arranque, errores, estado de cámaras)."""
    getattr(system_logger, level, system_logger.info)(msg)
