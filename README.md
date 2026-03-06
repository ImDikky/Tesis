# SVIBVA — Guía de Instalación y Uso

**Sistema de Videovigilancia Inteligente Basado en Visión Artificial**  
Instituto Universitario de Tecnología de Administración Industrial (IUTA) — Caracas

---

## Requisitos del Sistema

| Componente     | Mínimo                | Recomendado            |
| -------------- | --------------------- | ---------------------- |
| CPU            | Intel Core i5 4ta gen | Intel Core i5 6ta gen+ |
| RAM            | 4 GB                  | 8 GB                   |
| Almacenamiento | 5 GB libres           | 10 GB                  |
| SO             | Windows 10 64-bit     | Windows 10/11 64-bit   |
| Python         | 3.9                   | 3.11                   |
| Cámara         | 1 webcam USB          | 1-4 cámaras mixtas     |

> [!NOTE]  
> El sistema opera completamente en **red local** sin necesidad de internet (excepto la descarga inicial del modelo YOLO la primera vez que se ejecuta).

---

## Instalación

### 1. Clonar o descargar el proyecto

```powershell
git clone <URL_DEL_REPOSITORIO>
cd Tesis
```

### 2. Crear el entorno virtual Python

```powershell
python -m venv venv
```

### 3. Activar el entorno virtual

```powershell
.\venv\Scripts\activate
```

> Debes ver `(venv)` al inicio de la línea de comandos.

### 4. Instalar todas las dependencias

```powershell
pip install -r requirements.txt
```

> La primera ejecución descargará automáticamente el modelo **YOLOv8n** (~6 MB). Solo necesita internet esta vez.

---

## Ejecutar el Sistema

```powershell
# Asegúrate de tener el entorno virtual activo
.\venv\Scripts\activate

# Arrancar el servidor
python main.py
```

El servidor arranca en `http://0.0.0.0:5050`.

**Abrir en Brave/Chrome/Firefox:**

```
http://localhost:5050
```

Para detener el servidor: `Ctrl + C`

---

## Conectar Cámaras

### Webcam USB (la más simple)

En `config.py`, la cámara viene pre-configurada con índice `0` (primera webcam):

```python
DEFAULT_CAMERAS = [
    {"id": "cam_0", "name": "Entrada Principal", "source": 0, "enabled": True},
]
```

Si tienes más webcams USB, agrega índices `1`, `2`, etc.

También puedes agregarlas **desde el dashboard** con el botón **`+`** en el sidebar.

---

### Câmara IP de Seguridad (RTSP)

La mayoría de cámaras IP (Dahua, Hikvision, TP-Link, Reolink, etc.) usan protocolo **RTSP**:

```python
{"id": "cam_1", "name": "Patio", "source": "rtsp://admin:1234@192.168.1.10:554/stream1"}
```

**Formato general:** `rtsp://USUARIO:CONTRASEÑA@IP_CAMARA:554/ruta_stream`

| Marca        | URL RTSP típica                                                         |
| ------------ | ----------------------------------------------------------------------- |
| Dahua        | `rtsp://admin:pass@192.168.1.x:554/cam/realmonitor?channel=1&subtype=0` |
| Hikvision    | `rtsp://admin:pass@192.168.1.x:554/Streaming/Channels/101`              |
| TP-Link Tapo | `rtsp://usuario:pass@192.168.1.x:554/stream1`                           |
| Reolink      | `rtsp://admin:pass@192.168.1.x:554/h264Preview_01_main`                 |
| Genérica     | `rtsp://admin:admin@192.168.1.x:554/`                                   |

> [!TIP]  
> Si no sabes la URL de tu cámara, búscala en [ipcamtalk.com/wiki](https://ipcamtalk.com/wiki/ip-cam-talk-stream-url-list) con el nombre de tu marca.

---

### Celular Android como Cámara IP

#### Opción A: **IP Webcam** (gratis, recomendada)

1. Instalar app **IP Webcam** desde Play Store
2. Abrir la app → "Iniciar servidor"
3. Anota la URL que muestra (ej: `http://192.168.1.25:8080`)
4. En SVIBVA, agregar cámara con fuente:
   ```
   http://192.168.1.25:8080/video
   ```

#### Opción B: **DroidCam** (alta calidad, baja latencia)

1. Instalar **DroidCam** en el celular y **DroidCam Client** NO es necesario
2. En DroidCam, ir a menú → "Dispositivo como servidor"
3. Usar la URL: `http://IP_CELULAR:4747/video`

#### Opción C: **Alfred / WardenCam** (celulares reutilizados como cámaras fijas)

Estas apps generan un URL RTSP interno que puedes usar de la misma forma.

---

### Câmara IP genérica vía HTTP (MJPEG)

Muchas cámaras IP antigas o módulos ESP32-CAM transmiten en formato MJPEG:

```
http://192.168.1.x:80/stream
http://192.168.1.x:81/stream    # ESP32-CAM por defecto
```

---

## Controles del Dashboard

| Control              | Función                                       |
| -------------------- | --------------------------------------------- |
| **`+`** en sidebar   | Agregar nueva cámara en tiempo real           |
| **⏸/▶** en tarjeta   | Pausar/reanudar cámara (**apaga la luz LED**) |
| **🗑** en sidebar    | Eliminar cámara (libera hardware)             |
| **Clic en el video** | Expandir cámara a pantalla completa           |
| **▣ / ⊞ / ⊟** topbar | Cambiar layout del grid                       |
| **☀ / 🌙** sidebar   | Cambiar tema claro/oscuro                     |

> [!IMPORTANT]  
> Al **pausar** una cámara USB, el hardware se libera inmediatamente y la **luz LED de la webcam se apaga**. Al reanudar, vuelve a encenderse.

---

## Configurar Alertas de Telegram

1. Crear un bot con **@BotFather** en Telegram → copiar el `TOKEN`
2. Escribirle al bot y visitar `https://api.telegram.org/bot<TOKEN>/getUpdates` → copiar el `chat_id`
3. Editar `config.py`:

```python
TELEGRAM_ENABLED = True
TELEGRAM_TOKEN   = "7123456789:AAExxxxxxxxxxxxxx"
TELEGRAM_CHAT_ID = "123456789"
ALERT_COOLDOWN_SECONDS = 30   # mínimo 30s entre alertas por cámara
ALERT_ON_CLASSES = [0]        # 0 = Persona. Agrega 2 para Autos, 16 para Perros
```

---

## Ajustar el Rendimiento (CPU/RAM)

Si el sistema consume demasiada CPU, editar en `config.py`:

```python
# Más agresivo = menos CPU pero menos detecciones por segundo
FRAME_SKIP = 4           # 1 inferencia cada 5 frames (valor actual)
FRAME_SKIP = 9           # 1 inferencia cada 10 frames (bajo consumo)

MJPEG_TARGET_FPS = 12    # FPS enviados al navegador
MJPEG_TARGET_FPS = 8     # Menos FPS = menos CPU

DETECTION_INPUT_SIZE = 480   # Tamaño de imagen para YOLO (actual)
DETECTION_INPUT_SIZE = 320   # Más pequeño = más rápido, menos preciso

YOLO_MAX_THREADS = 2     # Hilos de CPU para PyTorch
YOLO_MAX_THREADS = 1     # Mínimo consumo
```

---

## Acceso desde Otros Dispositivos (Red Local)

El servidor escucha en `0.0.0.0:5050`, lo que significa que cualquier dispositivo en la **misma red WiFi** puede acceder:

1. Ver la IP del servidor en el sidebar del dashboard ("Acceso Red Local")  
   O ejecutar en PowerShell: `ipconfig` → buscar "Dirección IPv4"
2. En el otro dispositivo, abrir el navegador y escribir:
   ```
   http://192.168.1.X:5050
   ```
   (reemplaza con la IP de tu PC)

> **No se necesita internet.** Solo que ambos dispositivos estén en la misma red WiFi.

---

## Estructura del Proyecto

```
Tesis/
├── main.py              ← Servidor FastAPI (API REST + WebSocket + MJPEG)
├── config.py            ← ⚙️ CONFIGURACIÓN PRINCIPAL (edita aquí)
├── detector.py          ← Motor de detección YOLOv8
├── camera_manager.py    ← Gestor multi-cámara con hilos independientes
├── alert_bot.py         ← Bot de Telegram para alertas
├── logger.py            ← Sistema de logs (logs/events.log)
├── requirements.txt     ← Dependencias Python
├── templates/
│   └── dashboard.html   ← Interfaz del panel de control
├── static/
│   ├── css/styles.css   ← Estilos del dashboard
│   └── js/main.js       ← Lógica del frontend
└── logs/
    └── events.log       ← Registro automático de detecciones
```

---

## Solución de Problemas

| Problema                            | Solución                                                                |
| ----------------------------------- | ----------------------------------------------------------------------- |
| "No se pudo conectar a la cámara"   | Verificar que el índice USB o URL RTSP sea correcto                     |
| CPU al 100%                         | Aumentar `FRAME_SKIP` y reducir `MJPEG_TARGET_FPS` en `config.py`       |
| La luz de la webcam sigue encendida | Usar el botón ⏸ en el dashboard para pausar/liberar la cámara           |
| Error de módulo al iniciar          | Ejecutar `pip install -r requirements.txt` con el venv activo           |
| Dashboard no carga en el celular    | Verificar que PC y celular estén en la misma red WiFi                   |
| Telegram no envía alertas           | Verificar `TELEGRAM_TOKEN` y `TELEGRAM_CHAT_ID` en `config.py`          |
| RTSP no conecta                     | Probar la URL en VLC primero. Verificar usuario/contraseña de la cámara |
