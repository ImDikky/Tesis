# =============================================================================
# SVIBVA - Gestor de Cámaras Múltiples
# Objetivo específico: Arquitectura de red local para visualización de video
#                      desde múltiples fuentes sin requerir internet
# =============================================================================
import cv2
import time
import threading
import numpy as np
from typing import Optional
from config import DEFAULT_CAMERAS, MJPEG_TARGET_FPS, CAPTURE_RESOLUTION
from logger import log_system


class CameraStream:
    """
    Hilo de captura de video para una sola cámara.

    Características:
    - Opera en un hilo de fondo independiente (no bloquea el servidor)
    - Compatible con: webcam USB (índice), RTSP, HTTP (IP Webcam, DroidCam)
    - Reconexión automática si la cámara se desconecta
    - Expone el último frame capturado de forma thread-safe
    """

    RECONNECT_DELAY = 5   # segundos entre intentos de reconexión
    READ_TIMEOUT    = 10  # segundos sin frames antes de declarar offline

    def __init__(self, cam_id: str, name: str, source):
        self.id      = cam_id
        self.name    = name
        self.source  = source  # int (USB) o str (URL)
        self.enabled = True

        # Estado
        self.online   = False
        self.paused   = False   # True = hardware liberado (luz apagada)
        self.fps      = 0.0
        self._cap: Optional[cv2.VideoCapture] = None
        self._frame: Optional[np.ndarray]     = None
        self._lock     = threading.Lock()
        self._stop_ev  = threading.Event()
        self._pause_ev = threading.Event()  # set = pausado

        # Hilo de captura
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        log_system(f"Cámara '{self.name}' iniciada — fuente: {self.source}")

    # ── API pública ───────────────────────────────────────────────────────────

    @property
    def last_frame(self) -> Optional[np.ndarray]:
        """Retorna una copia del último frame capturado (thread-safe)."""
        if self.paused:
            return None
        with self._lock:
            return self._frame.copy() if self._frame is not None else None

    @property
    def info(self) -> dict:
        """Información de la cámara serializable a JSON."""
        return {
            "id":      self.id,
            "name":    self.name,
            "source":  str(self.source),
            "online":  self.online,
            "paused":  self.paused,
            "fps":     round(self.fps, 1),
            "enabled": self.enabled,
        }

    def pause(self):
        """
        Pausa la cámara: libera el hardware físico INMEDIATAMENTE.
        La luz LED de la webcam se apaga. El frame queda en negro.
        """
        if self.paused:
            return
        self.paused = True
        self.online = False
        self._pause_ev.set()
        # Limpiar el último frame para que el stream muestre "Sin señal"
        with self._lock:
            self._frame = None
        log_system(f"⏸ Cámara '{self.name}' pausada — hardware liberado en hilo receptor.")

    def resume(self):
        """Reactiva la cámara y vuelve a encender el hardware."""
        if not self.paused:
            return
        self.paused = False
        self._pause_ev.clear()
        log_system(f"▶ Cámara '{self.name}' reanudada.")

    def stop(self):
        """
        Detiene permanentemente el hilo de captura y libera el hardware.
        Llamar esto garantiza que la luz de la webcam se apague.
        """
        # Primero señalizar parada para que el hilo salga del bucle
        self._stop_ev.set()
        self._pause_ev.clear()  # Desbloquear si estaba pausado
        # Esperar brevemente a que el hilo libere el cap por sí mismo
        self._thread.join(timeout=2.0)
        # Liberar de forma segura si el hilo no pudo hacerlo
        if self._cap and self._cap.isOpened():
            try:
                self._cap.release()
            except Exception:
                pass
            self._cap = None
        self.online = False
        log_system(f"🛑 Cámara '{self.name}' detenida — hardware liberado.")

    # ── Lógica interna ────────────────────────────────────────────────────────

    def _open_capture(self) -> bool:
        """Intenta abrir la fuente de video. Retorna True si tiene éxito."""
        if self._cap:
            self._cap.release()

        # Para RTSP, usar el backend FFMPEG explícitamente (mejor compatibilidad)
        backend = cv2.CAP_FFMPEG if isinstance(self.source, str) and self.source.startswith("rtsp") else cv2.CAP_ANY
        self._cap = cv2.VideoCapture(self.source, backend)

        if not self._cap.isOpened():
            return False

        # ── Optimizaciones de rendimiento ──────────────────────────────────
        # Buffer mínimo para evitar frames atrasados
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        # Forzar resolución de captura (reduce ancho de banda y CPU de lectura)
        if CAPTURE_RESOLUTION and isinstance(self.source, int):
            w, h = CAPTURE_RESOLUTION
            self._cap.set(cv2.CAP_PROP_FRAME_WIDTH,  w)
            self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, h)

        # Limitar FPS de captura al target (evita leer más rápido de lo necesario)
        if MJPEG_TARGET_FPS:
            self._cap.set(cv2.CAP_PROP_FPS, MJPEG_TARGET_FPS)

        return True

    def _capture_loop(self):
        """Bucle principal de captura — corre en hilo de fondo."""
        fps_counter    = 0
        fps_timer      = time.time()
        frame_interval = 1.0 / MJPEG_TARGET_FPS if MJPEG_TARGET_FPS else 0
        last_read      = 0.0

        while not self._stop_ev.is_set():

            # ── Si está pausado: liberar hardware y esperar ───────────────────
            if self.paused:
                # El hardware ya fue liberado en pause(), solo esperar
                if self._cap and self._cap.isOpened():
                    self._cap.release()
                    self._cap = None
                time.sleep(0.5)
                continue

            # ── Conexión ──────────────────────────────────────────────────────
            if not self._cap or not self._cap.isOpened():
                self.online = False
                log_system(f"Conectando a cámara '{self.name}'...")
                if not self._open_capture():
                    log_system(f"⚠ No se pudo conectar a '{self.name}'. Reintentando en {self.RECONNECT_DELAY}s...", "warning")
                    time.sleep(self.RECONNECT_DELAY)
                    continue
                self.online = True
                log_system(f"✅ Cámara '{self.name}' conectada.")

            # ── FPS cap ───────────────────────────────────────────────────────
            now = time.monotonic()
            elapsed_since_read = now - last_read
            if elapsed_since_read < frame_interval:
                time.sleep(frame_interval - elapsed_since_read)

            # ── Lectura de frame ──────────────────────────────────────────────
            last_read = time.monotonic()
            ok, frame = self._cap.read()
            if not ok or frame is None:
                log_system(f"⚠ Pérdida de señal en '{self.name}'. Reconectando...", "warning")
                self.online = False
                self._cap.release()
                self._cap = None
                time.sleep(self.RECONNECT_DELAY)
                continue

            # Guardar frame thread-safe
            with self._lock:
                self._frame = frame

            # ── Cálculo de FPS real ───────────────────────────────────────────
            fps_counter += 1
            elapsed = time.time() - fps_timer
            if elapsed >= 2.0:
                self.fps    = fps_counter / elapsed
                fps_counter = 0
                fps_timer   = time.time()

        # ── Salida del bucle: limpiar hardware ────────────────────────────────
        if self._cap and self._cap.isOpened():
            self._cap.release()
            self._cap = None


# =============================================================================
# Gestor global de todas las cámaras del sistema
# =============================================================================
class CameraManager:
    """
    Administra múltiples instancias de CameraStream.
    
    Permite agregar, eliminar y listar cámaras en tiempo de ejecución.
    Las cámaras se inician desde DEFAULT_CAMERAS en config.py.
    """

    def __init__(self):
        self._cameras: dict[str, CameraStream] = {}
        self._load_defaults()

    def _load_defaults(self):
        """Carga las cámaras definidas en config.DEFAULT_CAMERAS al arranque."""
        for cam_cfg in DEFAULT_CAMERAS:
            if cam_cfg.get("enabled", True):
                self.add_camera(cam_cfg["id"], cam_cfg["name"], cam_cfg["source"])

    def add_camera(self, cam_id: str, name: str, source) -> CameraStream:
        """Agrega y arranca una nueva cámara al sistema."""
        if cam_id in self._cameras:
            self._cameras[cam_id].stop()

        # Convertir source a int si es un número en string (ej. "0" -> 0)
        if isinstance(source, str) and source.isdigit():
            source = int(source)

        stream = CameraStream(cam_id, name, source)
        self._cameras[cam_id] = stream
        return stream

    def remove_camera(self, cam_id: str) -> bool:
        """Detiene y elimina una cámara del sistema."""
        if cam_id in self._cameras:
            self._cameras[cam_id].stop()
            del self._cameras[cam_id]
            return True
        return False

    def get_camera(self, cam_id: str) -> Optional[CameraStream]:
        """Retorna la instancia de una cámara por su ID."""
        return self._cameras.get(cam_id)

    def list_cameras(self) -> list[dict]:
        """Retorna la información de todas las cámaras activas."""
        return [cam.info for cam in self._cameras.values()]

    def stop_all(self):
        """Detiene todas las cámaras (llamado al apagar el servidor)."""
        for cam in self._cameras.values():
            cam.stop()
        self._cameras.clear()


# Instancia global del gestor de cámaras
camera_manager = CameraManager()
