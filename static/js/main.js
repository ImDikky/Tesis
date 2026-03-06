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
  themeIcon: document.getElementById("themeIcon"),
  themeLabel: document.getElementById("themeLabel"),

  sidebarToggle: document.getElementById("sidebarToggle"),
  sidebar: document.getElementById("sidebar"),
  alertsPanel: document.getElementById("alertsPanel"),
  btnToggleAlerts: document.getElementById("btnToggleAlerts"),

  btnReopenSidebar: document.getElementById("btnReopenSidebar"),
  btnReopenAlerts: document.getElementById("btnReopenAlerts"),

  cameraList: document.getElementById("cameraList"),
  cameraGrid: document.getElementById("cameraGrid"),
  noCamerasMsg: document.getElementById("noCamerasMsg"),
  onlineBadge: document.getElementById("onlineBadge"),
  onlineCount: document.getElementById("onlineCount"),

  cpuBar: document.getElementById("cpuBar"),
  cpuVal: document.getElementById("cpuVal"),
  ramBar: document.getElementById("ramBar"),
  ramVal: document.getElementById("ramVal"),

  alertsList: document.getElementById("alertsList"),
  alertCount: document.getElementById("alertCount"),
  btnClearAlerts: document.getElementById("btnClearAlerts"),

  wsStatus: document.getElementById("wsStatus"),
  wsStatusText: document.getElementById("wsStatusText"),
  wsStatusDot: document.querySelector(".ws-dot"),

  telegramDot: document.getElementById("telegramDot"),
  telegramText: document.getElementById("telegramText"),
  lanUrl: document.getElementById("lanUrl"),

  btnAddCamera: document.getElementById("btnAddCamera"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalClose: document.getElementById("modalClose"),
  btnModalCancel: document.getElementById("btnModalCancel"),
  btnModalAdd: document.getElementById("btnModalAdd"),
  camName: document.getElementById("camName"),
  camSource: document.getElementById("camSource"),

  layoutBtns: document.querySelectorAll(".layout-btn"),
  filterChips: document.querySelectorAll(".chip"),
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
    dom.themeIcon.textContent = "☀";
    dom.themeLabel.textContent = "Modo Claro";
  } else {
    dom.themeIcon.textContent = "🌙";
    dom.themeLabel.textContent = "Modo Oscuro";
  }
}

dom.themeToggle.addEventListener("click", () => {
  const current = dom.body.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

// =============================================================================
// SIDEBAR Y PANEL DE ALERTAS — Colapsar / Expandir
// =============================================================================

function toggleSidebar() {
  const isCollapsed = dom.sidebar.classList.toggle("collapsed");
  dom.sidebarToggle.textContent = isCollapsed ? "›" : "‹";
  dom.btnReopenSidebar.style.display = isCollapsed ? "flex" : "none";
}

function toggleAlertsPanel() {
  const isCollapsed = dom.alertsPanel.classList.toggle("collapsed");
  dom.btnToggleAlerts.textContent = isCollapsed ? "‹" : "›";
  dom.btnReopenAlerts.style.display = isCollapsed ? "flex" : "none";
}

dom.sidebarToggle.addEventListener("click", toggleSidebar);
dom.btnReopenSidebar.addEventListener("click", toggleSidebar);

dom.btnToggleAlerts.addEventListener("click", toggleAlertsPanel);
dom.btnReopenAlerts.addEventListener("click", toggleAlertsPanel);

// =============================================================================
// SELECTOR DE LAYOUT
// =============================================================================
dom.layoutBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    dom.layoutBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const cols = parseInt(btn.dataset.cols);
    State.columns = cols;
    dom.cameraGrid.className = `camera-grid cols-${cols}`;
  });
});

// =============================================================================
// FILTROS DE DETECCIÓN (UI only — la lógica real está en config.py)
// =============================================================================
dom.filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chip.classList.toggle("active");
  });
});

// =============================================================================
// RENDERIZADO DE CÁMARAS — Grid y Sidebar
// =============================================================================
function renderCameras(cameras) {
  State.cameras = cameras;
  const onlineCount = cameras.filter((c) => c.online).length;
  dom.onlineCount.textContent = onlineCount;

  // ── Sidebar: lista de cámaras ──────────────────────────────────────────
  dom.cameraList.innerHTML = "";
  cameras.forEach((cam) => {
    const li = document.createElement("li");
    li.className = "cam-item";
    li.dataset.camId = cam.id;
    const dotClass = cam.paused ? "paused" : (cam.online ? "online" : "offline");
    const fpsText  = cam.paused ? "⏸ Pausada" : (cam.online ? cam.fps + " FPS" : "Sin señal");
    li.innerHTML = `
            <div class="cam-dot ${dotClass}"></div>
            <div class="cam-info">
                <div class="cam-name">${escapeHtml(cam.name)}</div>
                <div class="cam-fps">${fpsText}</div>
            </div>
            <button class="cam-remove" data-cam-id="${cam.id}" title="Eliminar cámara">🗑</button>
        `;
    li.querySelector(".cam-remove").addEventListener("click", (e) => {
      e.stopPropagation();
      removeCamera(cam.id, cam.name);
    });
    li.addEventListener("click", () => focusCameraCard(cam.id));
    dom.cameraList.appendChild(li);
  });

  // ── Grid principal: cards de video ────────────────────────────────────
  dom.noCamerasMsg.style.display = cameras.length === 0 ? "flex" : "none";

  // Solo agregar cards para cámaras nuevas (no re-renderizar streams existentes)
  const existingCards = new Set(
    [...dom.cameraGrid.querySelectorAll(".camera-card")].map(
      (c) => c.dataset.camId,
    ),
  );
  const currentIds = new Set(cameras.map((c) => c.id));

  // Eliminar cards de cámaras que ya no existen
  dom.cameraGrid.querySelectorAll(".camera-card").forEach((card) => {
    if (!currentIds.has(card.dataset.camId)) card.remove();
  });

  // Agregar cards para cámaras nuevas
  cameras.forEach((cam) => {
    if (!existingCards.has(cam.id)) {
      const card = createCameraCard(cam);
      dom.cameraGrid.appendChild(card);
    } else {
      // Actualizar estado del header (online/offline, FPS)
      updateCameraCardHeader(cam);
    }
  });
}

function createCameraCard(cam) {
  const card = document.createElement("div");
  card.className = "camera-card";
  card.dataset.camId = cam.id;
  const dotClass = cam.paused ? "paused" : (cam.online ? "online" : "offline");
  const fpsText  = cam.paused ? "Pausada" : (cam.online ? cam.fps + " FPS" : "Offline");
  card.innerHTML = `
        <div class="camera-card-header" id="header-${cam.id}">
            <span class="card-cam-name">${escapeHtml(cam.name)}</span>
            <span class="card-cam-stats">
                <div class="card-status-dot ${dotClass}" id="dot-${cam.id}"></div>
                <span id="fps-${cam.id}">${fpsText}</span>
                <button class="cam-pause-btn" id="pause-btn-${cam.id}"
                    onclick="event.stopPropagation(); toggleCameraPause('${cam.id}')"
                    title="${cam.paused ? 'Reanudar cámara' : 'Pausar — apaga la luz LED'}"
                >${cam.paused ? '▶' : '⏸'}</button>
            </span>
        </div>
        <div class="camera-feed" onclick="toggleFocusCard(this.closest('.camera-card'))">
            <img 
                src="/video_feed/${cam.id}" 
                alt="Feed de ${escapeHtml(cam.name)}"
                id="feed-${cam.id}"
                loading="lazy"
                onerror="showOfflineFeed(this)"
            >
            <button class="feed-expand-btn" onclick="event.stopPropagation(); toggleFocusCard(this.closest('.camera-card'))">⛶</button>
        </div>
    `;
  if (cam.paused) {
    // Mostrar overlay de pausada en el próximo tick
    setTimeout(() => {
      const img = document.getElementById(`feed-${cam.id}`);
      if (img) showOfflineFeed(img, "Pausada ⏸");
    }, 100);
  }
  return card;
}

function updateCameraCardHeader(cam) {
  const dot      = document.getElementById(`dot-${cam.id}`);
  const fps      = document.getElementById(`fps-${cam.id}`);
  const pauseBtn = document.getElementById(`pause-btn-${cam.id}`);
  const feedImg  = document.getElementById(`feed-${cam.id}`);

  const dotClass = cam.paused ? "paused" : (cam.online ? "online" : "offline");
  const fpsText  = cam.paused ? "Pausada" : (cam.online ? `${cam.fps} FPS` : "Offline");

  if (dot)      dot.className    = `card-status-dot ${dotClass}`;
  if (fps)      fps.textContent  = fpsText;
  if (pauseBtn) {
    pauseBtn.textContent = cam.paused ? "▶" : "⏸";
    pauseBtn.title = cam.paused ? "Reanudar cámara" : "Pausar — apaga la luz LED";
  }

  // Al reanudar: quitar overlay y recargar stream
  if (!cam.paused && feedImg) {
    const overlay = feedImg.parentElement?.querySelector(".offline-overlay");
    if (overlay) overlay.remove();
    feedImg.style.display = "";
    feedImg.src = `/video_feed/${cam.id}?t=${Date.now()}`;
  }
}

function showOfflineFeed(img, message = "Sin señal") {
  img.style.display = "none";
  const feed = img.parentElement;
  if (!feed.querySelector(".offline-overlay")) {
    const overlay = document.createElement("div");
    overlay.className = "offline-overlay";
    const icon = message.includes("Pausada") ? "⏸" : "📷";
    overlay.innerHTML = `<div class="offline-icon">${icon}</div><span>${message}</span>`;
    feed.appendChild(overlay);
  }
}

function focusCameraCard(camId) {
  const card = dom.cameraGrid.querySelector(`[data-cam-id="${camId}"]`);
  if (card) toggleFocusCard(card);
}

window.toggleFocusCard = function (card) {
  // Si ya está expandida, volver al grid normal
  if (card.classList.contains("focused")) {
    card.classList.remove("focused");
    dom.cameraGrid.classList.remove("cols-1");
    dom.cameraGrid.className = `camera-grid cols-${State.columns}`;
  } else {
    dom.cameraGrid
      .querySelectorAll(".camera-card")
      .forEach((c) => c.classList.remove("focused"));
    card.classList.add("focused");
    dom.cameraGrid.className = "camera-grid cols-1";
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
    const res  = await fetch(`/api/cameras/${camId}/toggle`, { method: "POST" });
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
    dom.ramVal.textContent = `${Math.round(ram)}%`;
    setBarClass(dom.ramBar, ram);

    // Cámaras
    if (data.cameras) renderCameras(data.cameras);

    // Bot de Telegram
    updateTelegramStatus(data.bot_status);
  } catch (err) {
    console.warn("Error al obtener stats:", err);
  }
}

function setBarClass(bar, percent) {
  bar.classList.remove("warn", "crit");
  if (percent > 85) bar.classList.add("crit");
  else if (percent > 65) bar.classList.add("warn");
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

function updateTelegramStatus(status) {
  const labels = {
    online: ["online", "Bot activo"],
    disabled: ["disabled", "No configurado"],
    error: ["error", "Error de conexión"],
  };
  const [cssClass, text] = labels[status] || ["disabled", "Desconocido"];
  dom.telegramDot.className = `status-indicator ${cssClass}`;
  dom.telegramText.textContent = text;
}

// =============================================================================
// INFO DE RED LOCAL (LAN)
// =============================================================================
async function fetchNetworkInfo() {
  try {
    const res = await fetch("/api/network");
    const data = await res.json();
    dom.lanUrl.textContent = data.url;
    dom.lanUrl.title = "Clic para copiar";
    dom.lanUrl.addEventListener("click", () => {
      navigator.clipboard.writeText(data.url).then(() => {
        dom.lanUrl.textContent = "✅ ¡Copiado!";
        setTimeout(() => {
          dom.lanUrl.textContent = data.url;
        }, 2000);
      });
    });
  } catch (err) {
    dom.lanUrl.textContent = "127.0.0.1:5050";
  }
}

// =============================================================================
// WEBSOCKET — Push de alertas en tiempo real
// =============================================================================
function connectWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${location.host}/ws/events`;

  setWsStatus("reconnecting", "Conectando...");

  const ws = new WebSocket(url);
  State.ws = ws;

  ws.onopen = () => {
    State.wsRetries = 0;
    setWsStatus("connected", "En línea");
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
    setWsStatus("disconnected", "Desconectado");
    State.wsRetries++;
    const delay = Math.min(2000 * State.wsRetries, 10000);
    console.log(`WebSocket cerrado. Reintentando en ${delay}ms...`);
    setTimeout(connectWebSocket, delay);
  };

  ws.onerror = (err) => {
    console.warn("WebSocket error:", err);
    ws.close();
  };
}

function setWsStatus(state, text) {
  dom.wsStatusDot.className = `ws-dot ${state}`;
  dom.wsStatusText.textContent = text;
}

// =============================================================================
// LOG DE ALERTAS — Agregar cards al panel
// =============================================================================
function addAlertCard(event) {
  // Quitar placeholder de "sin alertas"
  const empty = dom.alertsList.querySelector(".alert-empty");
  if (empty) empty.remove();

  State.alertCount++;
  dom.alertCount.textContent = State.alertCount;

  // Determinar tipo de alerta para el color del borde
  const classes = event.detections.map((d) => d.class_name.toLowerCase());
  let cardType = "";
  if (classes.some((c) => c === "persona")) cardType = "person";
  else if (
    classes.some((c) => ["automóvil", "moto", "autobus", "camión"].includes(c))
  )
    cardType = "vehicle";
  else cardType = "pet";

  // Crear tarjeta
  const card = document.createElement("div");
  card.className = `alert-card ${cardType}`;
  card.innerHTML = `
        <div class="alert-cam-name">📷 ${escapeHtml(event.camera_name)}</div>
        <div class="alert-summary">${escapeHtml(event.summary)}</div>
        <div class="alert-time">${formatTime(event.timestamp)}</div>
    `;

  // Insertar al principio
  dom.alertsList.insertBefore(card, dom.alertsList.firstChild);

  // Limitar a 50 cards visibles
  const allCards = dom.alertsList.querySelectorAll(".alert-card");
  if (allCards.length > 50) {
    allCards[allCards.length - 1].remove();
  }
}

dom.btnClearAlerts.addEventListener("click", () => {
  dom.alertsList.innerHTML =
    '<div class="alert-empty">Sin alertas recientes</div>';
  State.alertCount = 0;
  dom.alertCount.textContent = "0";
});

// Cargar alertas previas al iniciar
async function loadPastAlerts() {
  try {
    const res = await fetch("/api/alerts?limit=20");
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
// ARRANQUE
// =============================================================================
async function init() {
  initTheme();
  await refreshCameras();
  await fetchNetworkInfo();
  await loadPastAlerts();
  connectWebSocket();

  // Polling de stats cada 3 segundos
  fetchStats();
  setInterval(fetchStats, 3000);
}

// Iniciar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", init);
