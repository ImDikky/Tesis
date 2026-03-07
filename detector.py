# =============================================================================
# SVIBVA - Motor de Detección de Objetos con YOLOv8
# Objetivo específico: Incorporar modelo YOLO idóneo para hardware de gama media/baja
# =============================================================================
import cv2
import torch
import numpy as np
from ultralytics import YOLO
from config import (
    YOLO_MODEL, CONFIDENCE_THRESHOLD, DETECTION_CLASSES,
    FRAME_SKIP, DETECTION_INPUT_SIZE, YOLO_MAX_THREADS
)
from logger import log_system


# ── Limitar hilos de PyTorch ANTES de cargar el modelo ────────────────────────
# Esto es CRÍTICO para sistemas con 1 sola cámara en Core i5 4ta gen
# Evita que PyTorch consuma el 100% de los cores disponibles
if YOLO_MAX_THREADS:
    torch.set_num_threads(YOLO_MAX_THREADS)
    torch.set_num_interop_threads(1)
    log_system(f"⚙ PyTorch limitado a {YOLO_MAX_THREADS} hilo(s) de inferencia.")


class ObjectDetector:
    """
    Motor de detección de objetos basado en YOLOv8.
    
    Optimizaciones para hardware de gama media/baja (Core i5 4ta gen):
    ─────────────────────────────────────────────────────────────────
    1. Modelo nano (yolov8n.pt): menor tamaño, mayor velocidad
    2. Frame skip: ejecuta YOLO solo cada N frames (configurable)
    3. Resize antes de inferencia: escala el frame a DETECTION_INPUT_SIZE px
    antes de pasarlo a YOLO — el stream al navegador NO se ve afectado
    4. Torch thread cap: limita hilos de CPU para dejar recursos a otros procesos
    5. half=False: yolov8n ya es suficientemente ligero en float32 para CPU
    """

    def __init__(self):
        log_system(f"Cargando modelo YOLO: {YOLO_MODEL} ...")
        try:
            self.model = YOLO(YOLO_MODEL)
            log_system(f"Modelo {YOLO_MODEL} cargado exitosamente.")
        except Exception as e:
            log_system(f"ERROR al cargar modelo YOLO: {e}", "error")
            raise

        self.conf_threshold    = CONFIDENCE_THRESHOLD
        self.target_classes    = DETECTION_CLASSES
        self.target_class_ids  = list(self.target_classes.keys())
        self.det_input_size    = DETECTION_INPUT_SIZE
        self._frame_counters: dict[str, int] = {}

    # ─────────────────────────────────────────────────────────────────────────
    def process_frame(self, frame: np.ndarray, camera_id: str) -> tuple[np.ndarray, list]:
        """
        Procesa un frame: aplica frame_skip, redimensiona para YOLO,
        ejecuta inferencia y dibuja resultados sobre el frame ORIGINAL.

        Args:
            frame:      Frame BGR full-res de OpenCV
            camera_id:  ID de la cámara (para frame_skip por cámara)

        Returns:
            annotated_frame: Frame original con bounding boxes dibujados
            detections:      Lista de dicts [{class_id, class_name, confidence, bbox}]
        """
        if camera_id not in self._frame_counters:
            self._frame_counters[camera_id] = 0

        self._frame_counters[camera_id] += 1

        # ── Frame skip ────────────────────────────────────────────────────────
        if self._frame_counters[camera_id] % (FRAME_SKIP + 1) != 0:
            return frame, []

        # ── Escalar frame para inferencia YOLO (más rápido) ───────────────────
        h_orig, w_orig = frame.shape[:2]
        scale = min(self.det_input_size / max(h_orig, w_orig), 1.0)  # nunca ampliar
        if scale < 1.0:
            w_det = int(w_orig * scale)
            h_det = int(h_orig * scale)
            frame_det = cv2.resize(frame, (w_det, h_det), interpolation=cv2.INTER_LINEAR)
        else:
            frame_det  = frame
            w_det, h_det = w_orig, h_orig

        # ── Inferencia YOLO ───────────────────────────────────────────────────
        try:
            results = self.model.predict(
                source=frame_det,
                conf=self.conf_threshold,
                classes=self.target_class_ids,
                imgsz=self.det_input_size,   # tamaño interno de YOLO
                verbose=False,
                stream=False,
            )
        except Exception as e:
            log_system(f"Error en inferencia YOLO ({camera_id}): {e}", "error")
            return frame, []

        detections = []
        annotated  = frame.copy()

        if results and len(results) > 0:
            for box in results[0].boxes:
                class_id   = int(box.cls[0])
                confidence = float(box.conf[0])

                # ── Escalar coordenadas de detección → resolución original ────
                x1_d, y1_d, x2_d, y2_d = box.xyxy[0]
                if scale < 1.0:
                    inv = 1.0 / scale
                    x1 = int(x1_d * inv); y1 = int(y1_d * inv)
                    x2 = int(x2_d * inv); y2 = int(y2_d * inv)
                else:
                    x1, y1, x2, y2 = map(int, [x1_d, y1_d, x2_d, y2_d])

                if class_id not in self.target_classes:
                    continue

                class_info = self.target_classes[class_id]
                color      = class_info["color"]
                label      = f"{class_info['name']} {confidence:.0%}"

                # ── Bounding box ───────────────────────────────────────────────
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

                # ── Label con fondo ───────────────────────────────────────────
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
                label_y = y1 - 8 if y1 - 8 > th + 4 else y1 + th + 12
                cv2.rectangle(annotated,
                              (x1, label_y - th - 4), (x1 + tw + 6, label_y + 4),
                              color, -1)
                cv2.putText(annotated, label,
                            (x1 + 3, label_y),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55,
                            (0, 0, 0), 1, cv2.LINE_AA)

                detections.append({
                    "class_id":   class_id,
                    "class_name": class_info["name"],
                    "alert":      class_info["alert"],
                    "confidence": round(confidence, 3),
                    "bbox":       [x1, y1, x2, y2],
                })

        return annotated, detections

    @property
    def alert_class_ids(self) -> list:
        return [cid for cid, cfg in self.target_classes.items() if cfg["alert"]]


# Instancia global única del detector
detector = ObjectDetector()
