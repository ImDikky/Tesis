# =============================================================================
# SVIBVA - Bot de Alertas por Telegram
# Objetivo específico: Protocolo de notificaciones ligeras para red móvil inestable
# =============================================================================
import io
import asyncio
import threading
import time
import cv2
import numpy as np
from datetime import datetime
from config import (
    TELEGRAM_ENABLED, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID,
    ALERT_COOLDOWN_SECONDS, ALERT_ON_CLASSES
)
from logger import log_system

# Importar telegram solo si está habilitado (no bloquear arranque si no está instalado)
_telegram_available = False
if TELEGRAM_ENABLED:
    try:
        import telegram
        _telegram_available = True
    except ImportError:
        log_system(
            "⚠ python-telegram-bot no instalado. Alertas Telegram deshabilitadas. "
            "Ejecuta: pip install python-telegram-bot",
            "warning"
        )


class AlertBot:
    """
    Bot de alertas de Telegram para SVIBVA.

    Características:
    - Envía una foto anotada con las detecciones al chat configurado
    - Respeta el cooldown por cámara para evitar spam de mensajes
    - Opera en un hilo secundario para no bloquear el streaming de video
    - Si Telegram no está disponible, registra el evento en log local
    """

    def __init__(self):
        self.enabled = TELEGRAM_ENABLED and _telegram_available
        self._last_alert: dict[str, float] = {}  # camera_id -> timestamp último envío

        if self.enabled:
            log_system("✅ Módulo de Telegram habilitado.")
        else:
            log_system(
                "ℹ Bot de Telegram deshabilitado. "
                "Configura TELEGRAM_ENABLED=True en config.py para activarlo."
            )

    @property
    def status(self) -> str:
        """Estado del bot para mostrar en el dashboard."""
        if not TELEGRAM_ENABLED:
            return "disabled"
        return "online" if self.enabled else "error"

    def should_alert(self, camera_id: str, detections: list) -> bool:
        """
        Determina si se debe enviar una alerta.
        
        Condiciones:
        1. El bot está habilitado
        2. Alguna detección pertenece a las clases configuradas en ALERT_ON_CLASSES
        3. Han pasado al menos ALERT_COOLDOWN_SECONDS desde la última alerta de esta cámara
        """
        if not self.enabled:
            return False

        # ¿Hay detecciones de clases que requieren alerta?
        alert_detections = [
            d for d in detections
            if d.get("class_id") in ALERT_ON_CLASSES and d.get("alert", True)
        ]
        if not alert_detections:
            return False

        # ¿Ha pasado el tiempo de cooldown?
        last = self._last_alert.get(camera_id, 0)
        return (time.time() - last) >= ALERT_COOLDOWN_SECONDS

    def send_alert(self, camera_id: str, camera_name: str, frame: np.ndarray, detections: list):
        """
        Envía una alerta de Telegram en un hilo separado (no bloquea el streaming).
        
        Args:
            camera_id:    ID interno de la cámara
            camera_name:  Nombre legible de la cámara
            frame:        Frame BGR anotado con bounding boxes
            detections:   Lista de detecciones del frame
        """
        if not self.should_alert(camera_id, detections):
            return

        # Marcar timestamp ANTES de lanzar el hilo para evitar envíos duplicados
        self._last_alert[camera_id] = time.time()

        # Ejecutar envío en hilo para no bloquear el generador de video
        thread = threading.Thread(
            target=self._send_async,
            args=(camera_id, camera_name, frame.copy(), detections),
            daemon=True
        )
        thread.start()

    def _send_async(self, camera_id: str, camera_name: str, frame: np.ndarray, detections: list):
        """Envío real a Telegram (ejecutado en hilo separado)."""
        try:
            # Construir mensaje de texto
            timestamp = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            det_text = "\n".join(
                f"  • {d['class_name']}: {d['confidence']:.0%}" for d in detections
            )
            message = (
                f"🚨 *ALERTA SVIBVA*\n"
                f"📷 Cámara: *{camera_name}*\n"
                f"🕐 Hora: {timestamp}\n"
                f"🎯 Detectado:\n{det_text}"
            )

            # Codificar frame como JPEG en memoria
            _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            photo_bytes = buffer.tobytes()

            async def _send():
                bot = telegram.Bot(token=TELEGRAM_TOKEN)
                # python-telegram-bot v20+ permite async context manager para limpiar sesiones
                try:
                    async with bot:
                        await bot.send_photo(
                            chat_id=TELEGRAM_CHAT_ID,
                            photo=photo_bytes,
                            caption=message,
                            parse_mode="Markdown"
                        )
                except AttributeError:
                    # Fallback para versiones antiguas (v13 o inferior)
                    if asyncio.iscoroutinefunction(bot.send_photo):
                        await bot.send_photo(chat_id=TELEGRAM_CHAT_ID, photo=photo_bytes, caption=message, parse_mode="Markdown")
                    else:
                        bot.send_photo(chat_id=TELEGRAM_CHAT_ID, photo=photo_bytes, caption=message, parse_mode="Markdown")

            # Ejecutar de forma síncrona dentro de este hilo
            try:
                loop = asyncio.get_running_loop()
                asyncio.run_coroutine_threadsafe(_send(), loop)
            except RuntimeError:
                asyncio.run(_send())

            log_system(f"📤 Alerta Telegram enviada — Cám: {camera_name}")

        except Exception as e:
            log_system(f"ERROR al enviar alerta Telegram: {e}", "error")


# Instancia global única del bot de alertas
alert_bot = AlertBot()
