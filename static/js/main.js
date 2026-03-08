// =============================================================================
// SVIBVA — Lógica Principal del Dashboard
// Sistema de Videovigilancia Inteligente Basado en Visión Artificial
// =============================================================================

"use strict";

// =============================================================================
// ESTADO DE LA APLICACIÓN
// =============================================================================
const State = {
  cameras: [], // Lista de cámaras obtenida del API
  alertCount: 0, // Cantidad total de alertas recibidas
  wsRetries: 0, // Intentos de reconexión WebSocket
  ws: null, // Instancia WebSocket activa
  columns: 2, // Columnas del grid (layout)
};

// =============================================================================
// REFERENCIAS A ELEMENTOS DEL DOM
// =============================================================================
const dom = {
  body: document.body,
  themeToggle: document.getElementById("themeToggle"),
  themeIconSvg: document.getElementById("themeIconSvg"),

  // Main Counters
  statPersons: document.getElementById("statPersons"),
  statVehicles: document.getElementById("statVehicles"),
  statPets: document.getElementById("statPets"),

  // Main Camera
  activeCamName: document.getElementById("activeCamName"),
  mainCameraStage: document.getElementById("mainCameraStage"),
  cameraGrid: document.getElementById("cameraGrid"),
  noCamerasMsg: document.getElementById("noCamerasMsg"),
  systemClock: document.getElementById("systemClock"),
  tickerText: document.getElementById("tickerText"),

  // Detecciones Recientes
  recentDetectionsList: document.getElementById("recentDetectionsList"),

  // Resource Monitor
  cpuBar: document.getElementById("cpuBar"),
  cpuVal: document.getElementById("cpuVal"),
  ramBar: document.getElementById("ramBar"),
  ramVal: document.getElementById("ramVal"),
  fpsBar: document.getElementById("fpsBar"),
  fpsVal: document.getElementById("fpsVal"),

  // Camera List
  activeCamCountText: document.getElementById("activeCamCountText"),
  cameraList: document.getElementById("cameraList"),
  btnAddCamera: document.getElementById("btnAddCamera"),

  // Alert Registry
  alertsList: document.getElementById("alertsList"),

  // Charts
  barChartHourly: document.getElementById("barChartHourly"),
  donutChartTypes: document.getElementById("donutChartTypes"),
  lineChartWeekly: document.getElementById("lineChartWeekly"),

  // Modals
  modalOverlay: document.getElementById("modalOverlay"),
  modalClose: document.getElementById("modalClose"),
  btnModalCancel: document.getElementById("btnModalCancel"),
  btnModalAdd: document.getElementById("btnModalAdd"),
  camName: document.getElementById("camName"),
  camSource: document.getElementById("camSource"),

  btnSettings: document.getElementById("btnSettings"),
  settingsModalOverlay: document.getElementById("settingsModalOverlay"),
  settingsModalClose: document.getElementById("settingsModalClose"),
  btnSettingsCancel: document.getElementById("btnSettingsCancel"),
  btnSettingsSave: document.getElementById("btnSettingsSave"),
  confThreshold: document.getElementById("confThreshold"),
  confValue: document.getElementById("confValue"),
  frameSkip: document.getElementById("frameSkip"),
  telegramEnabled: document.getElementById("telegramEnabled"),
  alertCooldown: document.getElementById("alertCooldown")
};

// Instancias de ChartJS
const charts = {
  hourly: null,
  types: null,
  weekly: null
};

// Historial Mock para estadísticas del Top (en un escenario real vendría de BD)
const DailyStats = {
  persons: 0,
  vehicles: 0,
  pets: 0
};

// =============================================================================
// TEMA CLARO / OSCURO
// =============================================================================
function initTheme() {
  const saved = localStorage.getItem("svibva_theme") || "dark";
  applyTheme(saved);
}

function applyTheme(theme) {
  dom.body.setAttribute("data-theme", theme);
  localStorage.setItem("svibva_theme", theme);
  if (theme === "dark") {
    dom.themeIconSvg.innerHTML = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
  } else {
    dom.themeIconSvg.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
  }
}

dom.themeToggle.addEventListener("click", () => {
  const current = dom.body.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

// Reloj continuo
setInterval(() => {
  const d = new Date();
  dom.systemClock.textContent = d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}, 1000);

// =============================================================================
// RENDERIZADO DE CÁMARAS — Grid y Sidebar
// =============================================================================
function renderCameras(cameras) {
  State.cameras = cameras;
  const onlineCount = cameras.filter((c) => c.online).length;
  dom.activeCamCountText.textContent = `${onlineCount}/${cameras.length} activas`;

  // ── Panel inferior: Lista de cámaras ──────────────────────────────────────────
  dom.cameraList.innerHTML = "";
  cameras.forEach((cam) => {
    const li = document.createElement("div");
    li.className = "cam-row";
    li.dataset.camId = cam.id;
    const dotClass = cam.paused ? "paused" : (cam.online ? "online" : "offline");

    // Icono dependiendo de si es RTSP o USB
    const isUsb = cam.source.toString().length < 3;
    const iconPath = isUsb
      ? '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>'
      : '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line>';

    li.innerHTML = `
        <div class="cam-row-info">
            <div class="cam-row-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${iconPath}</svg>
            </div>
            <div class="cam-row-text">
                <h4>${escapeHtml(cam.name)} <span>${cam.id.toUpperCase()}</span></h4>
                <p>${isUsb ? 'USB' : 'IP'} • ${cam.online ? cam.fps + 'fps' : 'Sin señal'} • ${cam.source}</p>
            </div>
        </div>
        <div class="cam-status">
            <i class="${dotClass}" title="${dotClass}"></i>
        </div>
        `;
    li.style.cursor = "pointer";
    li.addEventListener("click", () => focusCameraCard(cam.id));
    dom.cameraList.appendChild(li);
  });

  // ── Grid Secundario: cards de video ────────────────────────────────────
  const multiCameraGrid = document.getElementById("multiCameraGrid");
  if (multiCameraGrid) {
    if (cameras.length === 0) {
      multiCameraGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No hay cámaras configuradas</div>`;
    } else {
      // Solo agregar cards para cámaras nuevas
      const existingCards = new Set([...multiCameraGrid.querySelectorAll(".secondary-feed")].map(c => c.dataset.camId));
      const currentIds = new Set(cameras.map(c => c.id));

      multiCameraGrid.querySelectorAll(".secondary-feed").forEach(card => {
        if (!currentIds.has(card.dataset.camId)) card.remove();
      });

      cameras.forEach(cam => {
        if (!existingCards.has(cam.id)) {
          const card = document.createElement("div");
          card.className = "secondary-feed";
          card.dataset.camId = cam.id;
          const dotClass = cam.paused ? "paused" : (cam.online ? "online" : "offline");
          card.innerHTML = `
                    <div class="secondary-header">
                        <div class="cam-title-sec"><i class="dot ${dotClass}" id="sec-dot-${cam.id}"></i> ${escapeHtml(cam.name)}</div>
                        <div class="cam-wifi-sec">
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
                                <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
                                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                                <path d="M12 20h.01"></path>
                            </svg>
                        </div>
                    </div>
                    <div class="secondary-stage">
                        <img src="/video_feed/${cam.id}" alt="Feed de ${escapeHtml(cam.name)}" id="sec-feed-${cam.id}" loading="lazy" onerror="showOfflineFeed(this)">
                    </div>
                 `;
          card.addEventListener("click", () => focusCameraCard(cam.id));
          multiCameraGrid.appendChild(card);

          // Seleccionar la primera cámara por defecto en el panel principal si no hay ninguna
          if (!dom.mainCameraStage.querySelector(`[data-cam-id="${cam.id}"]`) && currentIds.size === 1) {
            focusCameraCard(cam.id);
          }
        } else {
          // Update dot status
          const dot = document.getElementById(`sec-dot-${cam.id}`);
          if (dot) dot.className = `dot ${cam.paused ? "paused" : (cam.online ? "online" : "offline")}`;
        }
      });
    }
  }
}

function createCameraCard(cam) {
  const card = document.createElement("div");
  card.className = "camera-card";
  card.dataset.camId = cam.id;
  card.style.display = 'none'; // oculto por defecto
  card.style.width = '100%';
  card.style.height = '100%';
  card.innerHTML = `
        <img 
            src="/video_feed/${cam.id}" 
            alt="Feed de ${escapeHtml(cam.name)}"
            id="feed-${cam.id}"
            loading="lazy"
            onerror="showOfflineFeed(this)"
            style="width: 100%; height: 100%; object-fit: contain;"
        >
    `;
  return card;
}

function updateCameraCardHeader(cam) {
  // Lógica principal unificada globalmente ahora en renderCameras.
  // Solo aplicamos recarga silenciosa en img si se pauso y reactivo
  const feedImg = document.getElementById(`feed-${cam.id}`);
  const secFeedImg = document.getElementById(`sec-feed-${cam.id}`);

  if (!cam.paused) {
    if (feedImg) {
      const overlay = feedImg.parentElement?.querySelector(".offline-overlay");
      if (overlay) overlay.remove();
      feedImg.style.display = "";
      // feedImg.src = `/video_feed/${cam.id}?t=${Date.now()}`; /* Evitar parpadeos indeseados */
    }
    if (secFeedImg) {
      const overlay = secFeedImg.parentElement?.querySelector(".offline-overlay");
      if (overlay) overlay.remove();
      secFeedImg.style.display = "";
    }
  } else {
    if (feedImg) showOfflineFeed(feedImg, "Pausada ⏸");
    if (secFeedImg) showOfflineFeed(secFeedImg, "Pausada ⏸");
  }
}

function showOfflineFeed(img, message = "Sin señal") {
  img.style.display = "none";
  const feed = img.parentElement;
  if (!feed.querySelector(".offline-overlay")) {
    const overlay = document.createElement("div");
    overlay.className = "offline-overlay";
    const icon = message.includes("Pausada") ? `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>` : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`;
    overlay.innerHTML = `<div class="offline-icon">${icon}</div><span>${message}</span>`;
    feed.appendChild(overlay);
  }
}

function focusCameraCard(camId) {
  // 1. Asegurar clon principal
  let card = dom.cameraGrid.querySelector(`[data-cam-id="${camId}"]`);
  if (!card) {
    const cam = State.cameras.find(c => c.id === camId);
    if (cam) {
      card = createCameraCard(cam);
      dom.cameraGrid.appendChild(card);
    }
  }

  if (card) {
    dom.cameraGrid.querySelectorAll(".camera-card").forEach(c => c.style.display = 'none');
    card.style.display = 'flex';
    card.classList.add('focused');
    const cam = State.cameras.find(c => c.id === camId);
    if (cam) dom.activeCamName.innerHTML = `${escapeHtml(cam.name)} <span class="badge">IP</span>`;
    dom.noCamerasMsg.style.display = 'none';
  }
}

window.toggleFocusCard = function (card) {
  if (State.cameras.length <= 1) return;

  // Si ya está focuseado, volver a mostrar todas
  if (card.classList.contains("focused")) {
    card.classList.remove("focused");
    dom.cameraGrid.querySelectorAll(".camera-card").forEach(c => c.style.display = 'flex');
    dom.activeCamName.innerHTML = `Vista General <span class="badge">${State.cameras.length} Feeds</span>`;
  } else {
    // Enfocar a esta
    dom.cameraGrid.querySelectorAll(".camera-card").forEach(c => c.style.display = 'none');
    card.style.display = 'flex';
    card.classList.add("focused");
    const cam = State.cameras.find(c => c.id === card.dataset.camId);
    if (cam) dom.activeCamName.innerHTML = `${escapeHtml(cam.name)} <span class="badge">IP</span>`;
  }
};

// =============================================================================
// GESTIÓN DE CÁMARAS — Agregar y Eliminar
// =============================================================================
function openModal() {
  dom.modalOverlay.classList.add("open");
  dom.camName.focus();
}

function closeModal() {
  dom.modalOverlay.classList.remove("open");
  dom.camName.value = "";
  dom.camSource.value = "";
}

dom.btnAddCamera.addEventListener("click", openModal);
dom.modalClose.addEventListener("click", closeModal);
dom.btnModalCancel.addEventListener("click", closeModal);
dom.modalOverlay.addEventListener("click", (e) => {
  if (e.target === dom.modalOverlay) closeModal();
});

dom.btnModalAdd.addEventListener("click", async () => {
  const name = dom.camName.value.trim();
  const source = dom.camSource.value.trim();
  if (!name || !source) {
    alert("Por favor completa todos los campos.");
    return;
  }

  dom.btnModalAdd.textContent = "Agregando...";
  dom.btnModalAdd.disabled = true;

  try {
    const res = await fetch("/api/cameras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: `cam_${Date.now()}`,
        name: name,
        source: source,
      }),
    });
    if (res.ok) {
      closeModal();
      await refreshCameras();
    } else {
      alert("Error al agregar la cámara. Verifica los datos.");
    }
  } catch (err) {
    alert("Error de conexión: " + err.message);
  } finally {
    dom.btnModalAdd.textContent = "Agregar";
    dom.btnModalAdd.disabled = false;
  }
});

async function removeCamera(camId, camName) {
  if (!confirm(`¿Eliminar la cámara "${camName}"?`)) return;
  try {
    const res = await fetch(`/api/cameras/${camId}`, { method: "DELETE" });
    if (res.ok) await refreshCameras();
    else alert("Error al eliminar la cámara.");
  } catch (err) {
    alert("Error de conexión: " + err.message);
  }
}

async function toggleCameraPause(camId) {
  try {
    const res = await fetch(`/api/cameras/${camId}/toggle`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      // Actualizar la UI inmediatamente sin esperar el polling de stats
      updateCameraCardHeader(data);
      // Si pasó a pausada: mostrar overlay
      if (data.paused) {
        const img = document.getElementById(`feed-${camId}`);
        if (img) showOfflineFeed(img, "Pausada ⏸");
      }
    }
  } catch (err) {
    console.error("Error al pausar/reanudar cámara:", err);
  }
}


// Atajo de teclado: Enter en el modal
dom.camSource.addEventListener("keydown", (e) => {
  if (e.key === "Enter") dom.btnModalAdd.click();
});
dom.camName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") dom.camSource.focus();
});

// =============================================================================
// POLLING DE RECURSOS Y ESTADÍSTICAS (cada 3 segundos)
// =============================================================================
async function fetchStats() {
  try {
    const res = await fetch("/api/stats");
    const data = await res.json();

    // CPU
    const cpu = data.cpu_percent;
    dom.cpuBar.style.width = `${cpu}%`;
    dom.cpuVal.textContent = `${Math.round(cpu)}%`;
    setBarClass(dom.cpuBar, cpu);

    // RAM
    const ram = data.ram_percent;
    dom.ramBar.style.width = `${ram}%`;
    dom.ramVal.textContent = `${(ram / 100 * 8).toFixed(1)}GB`;
    setBarClass(dom.ramBar, ram);

    // FPS (Promedio de las cámaras)
    let totalFps = 0;
    let fpsCount = 0;
    if (data.cameras && data.cameras.length > 0) {
      data.cameras.forEach(c => {
        if (c.online && !c.paused) { totalFps += c.fps; fpsCount++; }
      });
    }
    const avgFps = fpsCount > 0 ? Math.round(totalFps / fpsCount) : 0;
    dom.fpsBar.style.width = `${Math.min((avgFps / 30) * 100, 100)}%`;
    dom.fpsVal.textContent = `${avgFps}fps`;
    setBarClass(dom.fpsBar, avgFps > 20 ? 0 : 80); // Invertir logica para fps (bajo es malo)

    // Cámaras
    if (data.cameras) renderCameras(data.cameras);

  } catch (err) {
    console.warn("Error al obtener stats:", err);
  }
}

function setBarClass(bar, percent) {
  const fill = bar; // En la nueva UI el ID pertenece al fill directamente
  fill.classList.remove("warn", "crit");
  // Si no queremos sobreescribir colores existentes, simplemente cambiamos opacity o dejamos igual
}

async function refreshCameras() {
  try {
    const res = await fetch("/api/cameras");
    const data = await res.json();
    renderCameras(data);
  } catch (err) {
    console.warn("Error al obtener cámaras:", err);
  }
}

// =============================================================================
// INFO DE RED LOCAL (LAN) - (Omitido visualmente en la nueva UI, mantenemos por compatibilidad de API si se desea)
// =============================================================================
async function fetchNetworkInfo() {
  // Omitido
}

// =============================================================================
// WEBSOCKET — Push de alertas en tiempo real
// =============================================================================
function connectWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${location.host}/ws/events`;

  const ws = new WebSocket(url);
  State.ws = ws;

  ws.onopen = () => {
    State.wsRetries = 0;
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "detection") {
        addAlertCard(data.event);
      }
    } catch (e) {
      console.warn("Error al parsear evento WebSocket:", e);
    }
  };

  ws.onclose = () => {
    State.wsRetries++;
    const delay = Math.min(2000 * State.wsRetries, 10000);
    setTimeout(connectWebSocket, delay);
  };

  ws.onerror = (err) => {
    ws.close();
  };
}

// =============================================================================
// LOG DE ALERTAS — Detecciones y Registro
// =============================================================================
function addAlertCard(event) {
  State.alertCount++;
  dom.tickerText.textContent = `${State.alertCount} detecciones recientes`;

  const classes = event.detections.map((d) => d.class_name.toLowerCase());
  let cardType = "";
  let iconHtml = "";
  let typeName = "";

  if (classes.some((c) => c === "persona")) {
    cardType = "person"; typeName = "Persona";
    iconHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    DailyStats.persons++;
  } else if (classes.some((c) => ["automóvil", "moto", "autobus", "camión"].includes(c))) {
    cardType = "vehicle"; typeName = "Vehículo";
    iconHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`;
    DailyStats.vehicles++;
  } else {
    cardType = "pet"; typeName = "Mascota";
    iconHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6z"></path></svg>`;
    DailyStats.pets++;
  }

  // Actualizar top counters (Mock behavior)
  dom.statPersons.textContent = DailyStats.persons;
  dom.statVehicles.textContent = DailyStats.vehicles;
  dom.statPets.textContent = DailyStats.pets;

  // 1. Agregar a "Detecciones Recientes"
  const emptySide = dom.recentDetectionsList.querySelector(".empty-state");
  if (emptySide) emptySide.remove();

  const maxConf = Math.round(Math.max(...event.detections.map(d => d.confidence)) * 100);

  const sideCard = document.createElement("div");
  sideCard.className = `detection-card ${cardType}`;
  sideCard.innerHTML = `
    <div class="det-header">
        <div class="det-name">${iconHtml} ${typeName}</div>
        <div class="det-score">${maxConf}%</div>
    </div>
    <div class="det-meta">
        <span>${escapeHtml(event.camera_name.split(" ")[0])}</span> • 
        <span>${formatTime(event.timestamp)}</span>
    </div>
  `;
  dom.recentDetectionsList.insertBefore(sideCard, dom.recentDetectionsList.firstChild);

  // 2. Agregar a "Registro de Alertas" (Timeline en el Grid inferir)
  const emptyTim = dom.alertsList.querySelector(".alert-empty");
  if (emptyTim) emptyTim.remove();

  const tlItem = document.createElement("div");
  tlItem.className = `timeline-item ${cardType}`;
  tlItem.innerHTML = `
    <div class="timeline-text">${typeName} detectado(a) — ${escapeHtml(event.summary)}</div>
    <div class="timeline-meta">${formatTime(event.timestamp)} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00e676" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
  `;
  dom.alertsList.insertBefore(tlItem, dom.alertsList.firstChild);

  // Limpiar excesos
  if (dom.recentDetectionsList.children.length > 20) dom.recentDetectionsList.lastChild.remove();
  if (dom.alertsList.children.length > 30) dom.alertsList.lastChild.remove();

  // Refrescar charts silents
  renderCharts();
}

// Cargar alertas previas al iniciar
async function loadPastAlerts() {
  try {
    const res = await fetch("/api/alerts?limit=25");
    const events = await res.json();
    events.reverse().forEach((e) => addAlertCard(e));
  } catch (err) {
    console.warn("Error cargando alertas previas:", err);
  }
}

// =============================================================================
// UTILIDADES
// =============================================================================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("es-VE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoString;
  }
}

// =============================================================================
// MODAL DE CONFIGURACIÓN
// =============================================================================
async function openSettingsModal() {
  dom.settingsModalOverlay.style.display = "flex";
  // Fetch current settings
  try {
    dom.btnSettingsSave.textContent = "Cargando...";
    dom.btnSettingsSave.disabled = true;
    const res = await fetch("/api/settings");
    const data = await res.json();

    dom.confThreshold.value = Math.round(data.confidence_threshold * 100);
    dom.confValue.textContent = dom.confThreshold.value + "%";
    dom.frameSkip.value = data.frame_skip;
    dom.telegramEnabled.checked = data.telegram_enabled;
    dom.alertCooldown.value = data.alert_cooldown_seconds;
  } catch (e) {
    console.warn("Error loading settings:", e);
  } finally {
    dom.btnSettingsSave.textContent = "Guardar Cambios";
    dom.btnSettingsSave.disabled = false;
  }
}

function closeSettingsModal() {
  dom.settingsModalOverlay.style.display = "none";
}

dom.confThreshold.addEventListener("input", (e) => {
  dom.confValue.textContent = e.target.value + "%";
});

dom.btnSettings.addEventListener("click", openSettingsModal);
dom.settingsModalClose.addEventListener("click", closeSettingsModal);
dom.btnSettingsCancel.addEventListener("click", closeSettingsModal);
dom.settingsModalOverlay.addEventListener("click", (e) => {
  if (e.target === dom.settingsModalOverlay) closeSettingsModal();
});

dom.btnSettingsSave.addEventListener("click", async () => {
  dom.btnSettingsSave.textContent = "Guardando...";
  dom.btnSettingsSave.disabled = true;
  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confidence_threshold: parseInt(dom.confThreshold.value) / 100.0,
        frame_skip: parseInt(dom.frameSkip.value),
        telegram_enabled: dom.telegramEnabled.checked,
        alert_cooldown_seconds: parseInt(dom.alertCooldown.value)
      })
    });
    if (res.ok) {
      closeSettingsModal();
    } else {
      alert("Error al guardar la configuración.");
    }
  } catch (e) {
    alert("Error de conexión: " + e.message);
  } finally {
    dom.btnSettingsSave.textContent = "Guardar Cambios";
    dom.btnSettingsSave.disabled = false;
  }
});

// =============================================================================
// CHARTS (Chart.js Integrations para el Panel Premium)
// =============================================================================
async function renderCharts() {
  if (!window.Chart) return;

  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = "'Roboto', sans-serif";
  Chart.defaults.plugins.tooltip.backgroundColor = '#161e27';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;

  try {
    const res = await fetch("/api/alerts?limit=200");
    const events = await res.json();

    // 1. Detecciones por Hora (Bar Chart)
    const countsHour = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60000 * 60); // ultimas 12 horas
      countsHour[d.getHours() + ':00'] = 0;
    }

    let typeCounts = { persons: 0, vehicles: 0, pets: 0 };

    events.forEach(e => {
      const dt = new Date(e.timestamp);
      const lh = dt.getHours() + ':00';
      if (countsHour[lh] !== undefined) countsHour[lh]++;

      e.detections.forEach(det => {
        const lbl = det.class_name.toLowerCase();
        if (lbl === 'persona') typeCounts.persons++;
        else if (['automóvil', 'moto', 'camión'].includes(lbl)) typeCounts.vehicles++;
        else typeCounts.pets++;
      });
    });

    /* Bar Chart */
    const labelsHour = Object.keys(countsHour);
    const dataHour = labelsHour.map(k => countsHour[k]);

    if (charts.hourly) {
      charts.hourly.data.labels = labelsHour;
      charts.hourly.data.datasets[0].data = dataHour;
      charts.hourly.update("none");
    } else {
      charts.hourly = new Chart(dom.barChartHourly.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labelsHour,
          datasets: [{
            label: 'Alertas',
            data: dataHour,
            backgroundColor: 'rgba(0, 212, 255, 0.8)',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 },
              grid: { color: 'rgba(255,255,255,0.05)' },
              border: { display: false }
            }
          }
        }
      });
    }

    /* Donut Chart */
    if (charts.types) {
      charts.types.data.datasets[0].data = [typeCounts.persons, typeCounts.vehicles, typeCounts.pets];
      charts.types.update("none");
    } else {
      charts.types = new Chart(dom.donutChartTypes.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Personas', 'Vehículos', 'Mascotas'],
          datasets: [{
            data: [typeCounts.persons, typeCounts.vehicles, typeCounts.pets],
            backgroundColor: ['#ff3d5c', '#ffb800', '#00e676'],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: '75%',
          plugins: { legend: { display: false } }
        }
      });
    }

    /* Weekly Line Chart (Mock Data using current trend shape) */
    if (!charts.weekly) {
      charts.weekly = new Chart(dom.lineChartWeekly.getContext('2d'), {
        type: 'line',
        data: {
          labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
          datasets: [{
            label: 'Detecciones',
            data: [42, 65, 38, Math.max(typeCounts.persons + typeCounts.vehicles, 55), 78, 41, 30],
            borderColor: '#00e676',
            backgroundColor: 'rgba(0, 230, 118, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#111820',
            pointBorderColor: '#00e676',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { grid: { display: false } }
          }
        }
      });
    }

  } catch (e) { console.warn("Chart render err:", e); }
}

// =============================================================================
// ARRANQUE
// =============================================================================
async function init() {
  initTheme();
  await refreshCameras();
  await loadPastAlerts();
  renderCharts();
  connectWebSocket();

  // Polling de stats cada 3 segundos
  fetchStats();
  setInterval(fetchStats, 3000);
}

// Iniciar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", init);
