# SVIBVA - Sistema de Videovigilancia Inteligente Basado en Visión Artificial 

Proyecto de tesis desarrollado para la seguridad en entornos de baja conectividad a internet, aplicando técnicas de **Edge Computing** y modelos de detección de objetos (**YOLOv8**).

**Institución:** Instituto Universitario de Tecnología de Administración Industrial (bodrioIUTA)  
**Autores:** Andres Morales y Johan Fernández  

---

##  Características Principales (Prototipo Actual)
- **Servidor Asíncrono:** Desarrollado con FastAPI para un procesamiento fluido y de baja latencia.
- **Interfaz SaaS Local:** Dashboard responsivo con Modo Oscuro/Claro, diseñado con HTML, CSS y JS puro.
- **Grid Dinámico:** Soporte multivista con "Focus Mode" para maximizar la señal de cámaras individuales.
- **Edge Computing:** Optimizado para ejecutarse en hardware de gama media/baja (ej. Core i5 de 4ta Generación).

---

## Guía de Instalación Local

Sigue estos pasos para levantar el entorno de desarrollo en tu máquina.

### 1. Clonar el repositorio
Abre tu terminal y clona este proyecto en tu computadora:
```bash
git clone <URL_DEL_REPOSITORIO>
cd Tesis

Tienes toda la razón y te pido disculpas. Hubo un error con el formato de las comillas en mi respuesta anterior que hizo que el texto se cortara en tu pantalla justo después de la estructura del proyecto.

Aquí tienes el documento completo y corregido de principio a fin, con la guía de instalación y todos los pasos intactos. Copia todo este bloque y pégalo en tu archivo README.md:

Markdown
# 🛡️ SVIBVA - Sistema de Videovigilancia Inteligente Basado en Visión Artificial

![Estado](https://img.shields.io/badge/Estado-En_Desarrollo-yellow)
![Versión](https://img.shields.io/badge/Versi%C3%B3n-1.0.0_Prototipo-blue)

**Institución:** Instituto Universitario de Tecnología de Administración Industrial (IUTA), Sede Caracas.  
**Especialidad:** Informática.  
**Autores:** Johan Fernández y Andrés Morales.  
**Fecha:** Marzo 2026.

---

## 📖 Descripción del Proyecto

SVIBVA es un sistema de seguridad residencial diseñado específicamente para operar en entornos con baja conectividad de internet. Utilizando el paradigma de **Edge Computing**, el software procesa imágenes y detecta amenazas localmente sin depender de servidores en la nube, resolviendo el problema de las fallas de red y la ineficiencia de los sistemas reactivos tradicionales.

### 🎯 Objetivos Principales
1. **Red Local Independiente:** Visualización de transmisiones de video en la red local sin requerir acceso a internet.
2. **Filtrado Lógico con IA:** Discriminación precisa entre seres humanos, vehículos y mascotas para evitar falsas alarmas.
3. **Hardware Reutilizado:** Capacidad de ejecutar redes neuronales complejas en hardware de gama media/baja (ej. procesadores Core i5 de 4ta Generación).
4. **Notificaciones Ligeras:** Integración de alertas a través de Telegram para funcionar en redes inestables.

---

## 🛠️ Stack Tecnológico

- **Motor de Backend:** Python 3 + FastAPI (Servidor asíncrono de alto rendimiento).
- **Inteligencia Artificial:** Modelo YOLOv8 (Red Neuronal Convolucional).
- **Frontend (Dashboard):** HTML5, CSS3 (Variables nativas) y JavaScript puro.
- **Servidor Web:** Uvicorn (ASGI).

---

## 📂 Estructura del Proyecto

```text
Tesis/
│
├── main.py                  # Servidor principal asíncrono (FastAPI).
├── requirements.txt         # Lista de dependencias de Python.
├── README.md                # Documentación oficial del proyecto.
│
├── templates/               
│   └── dashboard.html       # Estructura de la interfaz de usuario y Grid de cámaras.
│
└── static/
    ├── css/
    │   └── styles.css       # Diseño y Modo Oscuro/Claro.
    └── js/
        └── main.js          # Lógica interactiva (Toggle Theme, Focus Mode).
```

---

## Guía de Instalación y Configuración (Para Johan y Evaluadores)

Sigue estos pasos para levantar el entorno de desarrollo en tu computadora.

### 1. Clonar el repositorio
Abre tu terminal y clona este proyecto:
```bash
git clone <URL_DEL_REPOSITORIO>
cd Tesis
```

### 2. Crear el entorno virtual
Para aislar las librerías del proyecto y evitar conflictos, ejecuta:
```bash
python -m venv venv
```

### 3. Activar el entorno virtual
Debes activar el entorno antes de instalar cualquier dependencia:

- **En Windows (PowerShell/CMD):**
  ```powershell
  .\venv\Scripts\activate
  ```
- **En Mac / Linux:**
  ```bash
  source venv/bin/activate
  ```
*(Sabrás que el entorno está activo porque aparecerá un `(venv)` verde al inicio de tu línea de comandos).*

### 4. Instalar las dependencias
Instala FastAPI, Uvicorn, Jinja2 y demás herramientas necesarias ejecutando:
```bash
pip install -r requirements.txt
```

---

## Ejecución del Servidor SVIBVA

Con el entorno virtual activado y las dependencias instaladas, arranca el motor principal con el siguiente comando:

```bash
python main.py
```

En la consola aparecerá un mensaje confirmando que `Uvicorn` está corriendo.

### Acceso al Dashboard
Abre tu navegador web (Chrome, Edge, Firefox, etc.) e ingresa a la siguiente dirección:
**`http://localhost:5050`**

---

## Hoja de Ruta (Roadmap)

- [x] **Fase 1:** Diseño de la arquitectura base y servidor asíncrono (FastAPI).
- [x] **Fase 2:** Prototipado del Dashboard de monitoreo con Modo Oscuro y Focus Mode.
- [ ] **Fase 3:** Integración de OpenCV para captura de cámaras web y cámaras IP por RTSP.
- [ ] **Fase 4:** Implementación de la Red Neuronal YOLOv8.
- [ ] **Fase 5:** Creación del bot de Telegram para notificaciones.
- [ ] **Fase 6:** Empaquetado comercial (ejecutable `.exe`).

---
*Documentación generada para la defensa de grado y control de versiones del equipo