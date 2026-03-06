# =============================================================================
# SVIBVA - Configuración Central del Sistema
# Sistema de Videovigilancia Inteligente Basado en Visión Artificial
# =============================================================================
# Edita este archivo para personalizar el comportamiento del sistema.
# NO compartas este archivo si contiene tokens de Telegram reales.

# ------------------------------------------------------------------------------
# CÁMARAS PREDETERMINADAS
# Cada cámara es un dict con: id, name, source, enabled
#   source: entero (índice webcam USB) o string (URL RTSP/HTTP)
#   Ejemplo RTSP:  "rtsp://admin:1234@192.168.1.10:554/stream"
#   Ejemplo IP:    "http://192.168.1.15:8080/video"  (DroidCam / IP Webcam)
#   Ejemplo USB:   0  (primera webcam conectada al PC)
# ------------------------------------------------------------------------------
DEFAULT_CAMERAS = [
    {
        "id": "cam_0",
        "name": "Entrada Principal",
        "source": 0,
        "enabled": True,
    },
    # Descomenta y edita para agregar más cámaras:
    # {
    #     "id": "cam_1",
    #     "name": "Patio Trasero",
    #     "source": "rtsp://admin:password@192.168.1.10:554/stream1",
    #     "enabled": True,
    # },
    {
        "id": "cam_2",
        "name": "cell onichan",
        "source": "http://192.168.9.102:8080/video",
        "enabled": True,
    },
]

# ------------------------------------------------------------------------------
# MODELO YOLO Y PARÁMETROS DE DETECCIÓN
# ------------------------------------------------------------------------------
# Modelo a usar: yolov8n (nano) es el más rápido y ligero para hardware modesto
YOLO_MODEL = "yolov8n.pt"

# Confianza mínima para considerar una detección válida (0.0 - 1.0)
CONFIDENCE_THRESHOLD = 0.50

# Clases de COCO que el sistema detectará y alertará
# YOLO COCO class IDs: 0=person, 2=car, 3=motorcycle, 5=bus, 7=truck, 15=cat, 16=dog
DETECTION_CLASSES = {
    0:  {"name": "Persona",    "alert": True,  "color": (0,   212, 255)},  # cyan
    2:  {"name": "Automóvil",  "alert": True,  "color": (0,   255, 128)},  # green
    3:  {"name": "Moto",       "alert": True,  "color": (255, 165, 0)  },  # orange
    5:  {"name": "Autobús",    "alert": False, "color": (255, 255, 0)  },  # yellow
    7:  {"name": "Camión",     "alert": False, "color": (255, 200, 0)  },  # gold
    15: {"name": "Gato",       "alert": False, "color": (200, 0,   255)},  # purple
    16: {"name": "Perro",      "alert": False, "color": (255, 0,   128)},  # pink
}

# Cuántos frames saltar entre inferencias YOLO (reduce carga de CPU)
# 0 = procesar cada frame
# 2 = procesar 1 de cada 3 frames  →  hardware alto
# 4 = procesar 1 de cada 5 frames  →  hardware medio (Core i5 4ta gen)
# 9 = procesar 1 de cada 10 frames →  hardware muy limitado
FRAME_SKIP = 4

# ------------------------------------------------------------------------------
# PERFORMANCE — Ajustes para hardware de gama media/baja
# Objetivo: mantener CPU < 70% con 1-2 cámaras activas
# ------------------------------------------------------------------------------
# Resolución máxima a la que se ejecuta YOLO (px en el lado más largo).
# El frame se escala SOLO para la inferencia; el stream al navegador
# sigue siendo la resolución original de la cámara.
# 320 = muy rápido (baja precisión)  |  480 = equilbrio  |  640 = alta precisión
DETECTION_INPUT_SIZE = 480

# FPS máximos que el generador MJPEG intentará enviar al navegador.
# Reducir esto alivia carga de codificación JPEG y ancho de banda WiFi.
# Recomendado: 10-15 fps para videovigilancia residencial
MJPEG_TARGET_FPS = 12

# Máximo de hilos de CPU que PyTorch puede usar para inferencia.
# None = automático (puede usar todos los cores y saturar la PC)
# 2 = recomendado para Core i5 con otras cámaras corriendo en paralelo
YOLO_MAX_THREADS = 2

# Resolución a la que se captura desde la cámara (reduce carga de lectura).
# None = resolución nativa de la cámara
# (640, 480) = resolución forzada (recomendado para webcams USB antiguas)
CAPTURE_RESOLUTION = (640, 480)

# ------------------------------------------------------------------------------
# TELEGRAM BOT — ALERTAS LIGERAS
# ------------------------------------------------------------------------------
# Para habilitar:
#   1. Crea un bot con @BotFather en Telegram y copia el token aquí
#   2. Inicia una conversación con tu bot y obtén el chat_id
#      (usa: https://api.telegram.org/bot<TOKEN>/getUpdates)
#   3. Establece TELEGRAM_ENABLED = True

TELEGRAM_ENABLED = False
TELEGRAM_TOKEN   = "TU_TOKEN_AQUI"     # Ej: "7123456789:AAE..."
TELEGRAM_CHAT_ID = "TU_CHAT_ID_AQUI"  # Ej: "123456789"

# Segundos mínimos entre alertas por cámara (evita spam)
ALERT_COOLDOWN_SECONDS = 30

# Solo enviar alerta si se detecta esta clase (deja vacío [] para todas)
ALERT_ON_CLASSES = [0]  # Por defecto solo alertar cuando detecta PERSONA

# ------------------------------------------------------------------------------
# SERVIDOR
# ------------------------------------------------------------------------------
SERVER_HOST = "0.0.0.0"   # Escucha en toda la red local
SERVER_PORT = 5050

# ------------------------------------------------------------------------------
# LOGS
# ------------------------------------------------------------------------------
LOG_DIR           = "logs"
LOG_FILE          = "logs/events.log"
MAX_EVENTS_MEMORY = 100  # Eventos en memoria para el endpoint /api/alerts
