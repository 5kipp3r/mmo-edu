
/* =====================================================
   MMO EDUKASI 2D — ENGINE CORE
   Tahap 0.2
   - Registry dan validasi modul
   - Pemuatan peta dan NPC
   - Gerakan keyboard dan joystick
   - Tabrakan objek
   - Interaksi NPC dan dialog
   ===================================================== */

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const logList = document.querySelector("#logList");
const moduleList = document.querySelector("#moduleList");

const player = {
  x: 480,
  y: 340,
  width: 20,
  height: 22,
  speed: 190,
  nickname: "Murid"
};

const keys = new Set();
const moduleRegistry = new Map();
const npcs = [];

let mapData = null;
let lastFrame = 0;
let joystickVector = { x: 0, y: 0 };
let dialogElement = null;

// =====================================================
// UTILITAS
// =====================================================

function log(message) {
  if (!logList) return;

  const item = document.createElement("li");
  item.textContent = message;
  logList.prepend(item);

  while (logList.children.length > 6) {
    logList.lastElementChild.remove();
  }
}

function setStatus(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

async function loadJson(path) {
  const response = await fetch(path, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Gagal memuat ${path}: HTTP ${response.status}`
    );
  }

  return response.json();
}

function validText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// =====================================================
// REGISTRY DAN VALIDASI MODUL
// =====================================================

function validateManifest(manifest) {
  if (
    !manifest ||
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.modules)
  ) {
    throw new Error(
      "Manifest tidak valid: schemaVersion atau modules."
    );
  }

  const ids = new Set();

  for (const module of manifest.modules) {
    if (
      !validText(module.id) ||
      !validText(module.type) ||
      !validText(module.path)
    ) {
      throw new Error(
        "Modul harus mempunyai id, type, dan path."
      );
    }

    if (ids.has(module.id)) {
      throw new Error(
        `ID modul duplikat: ${module.id}`
      );
    }

    if (
      module.path.startsWith("/") ||
      module.path.includes("..")
    ) {
      throw new Error(
        `Path modul tidak diizinkan: ${module.path}`
      );
    }

    ids.add(module.id);
  }
}

function registerModule(definition, data) {
  if (!definition.enabled) {
    log(`Modul nonaktif dilewati: ${definition.id}`);
    return;
  }

  if (moduleRegistry.has(definition.id)) {
    throw new Error(
      `Modul sudah terdaftar: ${definition.id}`
    );
  }

  moduleRegistry.set(definition.id, {
    definition,
    data
  });
}

function renderModuleList() {
  if (!moduleList) return;

  moduleList.replaceChildren();

  for (const [id, entry] of moduleRegistry) {
    const chip = document.createElement("span");

    chip.className = "module-chip";
    chip.textContent =
      `${entry.definition.type}: ${id}`;

    moduleList.append(chip);
  }
}

// =====================================================
// MEMUAT KONTEN
// =====================================================

async function boot() {
  setStatus("clientStatus", "Aktif");

  try {
    const manifest = await loadJson(
      "./content/manifest.json"
    );

    validateManifest(manifest);

    for (const definition of manifest.modules) {
      if (definition.enabled === false) continue;

      const data = await loadJson(
        `./content/${definition.path}`
      );

      if (data.id !== definition.id) {
        throw new Error(
          `ID data tidak cocok dengan manifest: ${definition.id}`
        );
      }

      registerModule(definition, data);
    }

    const mapEntry = moduleRegistry.get(
      manifest.startMap
    );

    if (
      !mapEntry ||
      mapEntry.definition.type !== "map"
    ) {
      throw new Error(
        "Peta awal tidak ditemukan atau tipenya salah."
      );
    }

    mapData = mapEntry.data;

    if (
      !Array.isArray(mapData.objects) ||
      !mapData.size ||
      !Number.isFinite(mapData.size.width) ||
      !Number.isFinite(mapData.size.height)
    ) {
      throw new Error(
        "Struktur data peta tidak valid."
      );
    }

    canvas.width = mapData.size.width;
    canvas.height = mapData.size.height;

    player.x = mapData.spawn?.x ?? canvas.width / 2;
    player.y = mapData.spawn?.y ?? canvas.height / 2;

    // Daftarkan NPC dari modul
    for (const [id, entry] of moduleRegistry) {
      if (entry.definition.type !== "npc") continue;

      const npc = entry.data;

      if (
        !Number.isFinite(npc.x) ||
        !Number.isFinite(npc.y) ||
        !validText(npc.name)
      ) {
        throw new Error(
          `Data NPC tidak valid: ${id}`
        );
      }

      npcs.push(npc);
    }

    setStatus(
      "manifestStatus",
      `Valid (${moduleRegistry.size} modul)`
    );

    setStatus(
      "mapStatus",
      mapData.name || mapData.id
    );

    const mapLabel = document.querySelector("#mapLabel");

    if (mapLabel) {
      mapLabel.textContent =
        mapData.name || mapData.id;
    }

    renderModuleList();

    log(`Engine siap: ${moduleRegistry.size} modul.`);
    log(`Peta aktif: ${mapData.name}.`);
    log(`NPC tersedia: ${npcs.length}.`);

  } catch (error) {
    setStatus("manifestStatus", "Gagal");
    setStatus("mapStatus", "Tidak tersedia");

    log(error.message);
    console.error(error);
  }

  requestAnimationFrame(frame);
}

// =====================================================
// SISTEM GAMBAR PETA
// =====================================================

function drawGround() {
  ctx.fillStyle = "#78a96f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tile = 48;

  for (let y = 0; y < canvas.height; y += tile) {
    for (let x = 0; x < canvas.width; x += tile) {
      ctx.fillStyle =
        ((x / tile + y / tile) % 2 === 0)
          ? "#7eaf75"
          : "#76a56d";

      ctx.fillRect(x, y, tile, tile);
    }
  }
}

function drawObject(object) {
  const x = object.x ?? 0;
  const y = object.y ?? 0;

  if (object.kind === "path") {
    ctx.fillStyle = object.color || "#d8c69b";

    ctx.fillRect(
      x, y,
      object.width || 120,
      object.height || 36
    );
  }

  if (object.kind === "tree") {
    ctx.fillStyle = "#654b35";
    ctx.fillRect(x - 5, y + 12, 10, 24);

    ctx.fillStyle = "#2c7049";
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#3d8a55";
    ctx.beginPath();
    ctx.arc(x - 8, y - 7, 15, 0, Math.PI * 2);
    ctx.fill();
  }

  if (object.kind === "building") {
    const w = object.width || 150;
    const h = object.height || 90;

    ctx.fillStyle = "#e4d9b8";
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = "#a65c4d";
    ctx.fillRect(x - 8, y - 12, w + 16, 20);

    ctx.fillStyle = "#5b756d";
    ctx.fillRect(x + 18, y + 28, 24, 28);
    ctx.fillRect(x + 62, y + 28, 24, 28);

    ctx.fillStyle = "#384d47";
    ctx.fillRect(x + w - 35, y + 45, 22, h - 45);

    ctx.fillStyle = "#273d34";
    ctx.font = "bold 13px system-ui";
    ctx.fillText(object.label || "GEDUNG", x + 12, y + 15);
  }

  if (object.kind === "bench") {
    ctx.fillStyle = "#815535";
    ctx.fillRect(x, y, 64, 12);
    ctx.fillRect(x + 5, y + 12, 6, 13);
    ctx.fillRect(x + 52, y + 12, 6, 13);
  }
}

// =====================================================
// NPC
// =====================================================

function drawNPC(npc) {
  const x = npc.x;
  const y = npc.y;

  // Badan
  ctx.fillStyle = npc.color || "#7c4aa5";
  ctx.fillRect(x - 10, y - 3, 20, 23);

  // Kepala
  ctx.fillStyle = "#efc5a0";
  ctx.beginPath();
  ctx.arc(x, y - 12, 10, 0, Math.PI * 2);
  ctx.fill();

  // Tanda NPC
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(npc.name, x, y - 31);

  ctx.fillStyle = "#ffe08a";
  ctx.font = "bold 14px system-ui";
  ctx.fillText("!", x + 15, y - 22);

  ctx.textAlign = "start";
}

function drawPlayer() {
  ctx.fillStyle = "#00000030";
  ctx.beginPath();
  ctx.ellipse(
    player.x,
    player.y + 10,
    14,
    5,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = "#173c70";
  ctx.fillRect(
    player.x - 10,
    player.y - 4,
    20,
    22
  );

  ctx.fillStyle = "#f0c7a2";
  ctx.beginPath();
  ctx.arc(
    player.x,
    player.y - 12,
    10,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = "#27342d";
  ctx.fillRect(
    player.x - 10,
    player.y - 23,
    20,
    6
  );

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(
    player.nickname,
    player.x,
    player.y - 31
  );

  ctx.textAlign = "start";
}

// =====================================================
// TABRAKAN
// =====================================================

function getPlayerBox(x, y) {
  return {
    left: x - player.width / 2,
    right: x + player.width / 2,
    top: y - player.height / 2,
    bottom: y + player.height / 2
  };
}

function overlaps(a, b) {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  );
}

function isBlocked(x, y) {
  const box = getPlayerBox(x, y);

  // Batas dunia
  if (
    box.left < 0 ||
    box.top < 0 ||
    box.right > canvas.width ||
    box.bottom > canvas.height
  ) {
    return true;
  }

  for (const object of mapData.objects) {
    if (object.solid !== true) continue;

    let obstacle;

    if (object.kind === "tree") {
      obstacle = {
        left: object.x - 18,
        right: object.x + 18,
        top: object.y - 18,
        bottom: object.y + 25
      };
    } else {
      obstacle = {
        left: object.x,
        right: object.x + (object.width || 30),
        top: object.y,
        bottom: object.y + (object.height || 30)
      };
    }

    if (overlaps(box, obstacle)) {
      return true;
    }
  }

  return false;
}

function update(dt) {
  if (dialogElement) return;

  let dx = joystickVector.x;
  let dy = joystickVector.y;

  if (keys.has("ArrowLeft") || keys.has("a")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("w")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("s")) dy += 1;

  const length = Math.hypot(dx, dy);

  if (length > 1) {
    dx /= length;
    dy /= length;
  }

  const nextX = player.x + dx * player.speed * dt;
  const nextY = player.y + dy * player.speed * dt;

  // Uji sumbu terpisah agar bisa bergeser di sisi penghalang
  if (!isBlocked(nextX, player.y)) {
    player.x = nextX;
  }

  if (!isBlocked(player.x, nextY)) {
    player.y = nextY;
  }
}

// =====================================================
// DIALOG NPC
// =====================================================

function closeDialog() {
  if (dialogElement) {
    dialogElement.remove();
    dialogElement = null;
  }
}

function showDialog(npc) {
  if (dialogElement) {
    closeDialog();
    return;
  }

  const overlay = document.createElement("div");

  overlay.style.cssText = `
    position:fixed;
    inset:0;
    z-index:1000;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:20px;
    background:rgba(0,0,0,.65);
    font-family:system-ui,sans-serif;
  `;

  const panel = document.createElement("div");

  panel.style.cssText = `
    width:min(420px,100%);
    padding:22px;
    color:#edf7f1;
    background:#142526;
    border:1px solid #4a7066;
    border-radius:16px;
    box-shadow:0 10px 40px #0008;
  `;

  const title = document.createElement("h2");
  title.textContent = npc.name;
  title.style.marginTop = "0";

  const message = document.createElement("p");
  message.textContent =
    npc.dialogue?.default ||
    "Halo! Senang bertemu denganmu.";

  message.style.lineHeight = "1.6";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Tutup dialog";
  close.style.cssText = `
    padding:12px 16px;
    border:0;
    border-radius:9px;
    background:#8be0b0;
    color:#17352b;
    font-weight:700;
    cursor:pointer;
  `;

  close.addEventListener("click", closeDialog);

  panel.append(title, message, close);
  overlay.append(panel);
  document.body.append(overlay);

  dialogElement = overlay;
  close.focus();

  log(`Berbicara dengan ${npc.name}.`);
}

function findNearestNPC(maxDistance = 65) {
  let nearest = null;
  let nearestDistance = maxDistance;

  for (const npc of npcs) {
    const distance = Math.hypot(
      player.x - npc.x,
      player.y - npc.y
    );

    if (distance < nearestDistance) {
      nearest = npc;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function performAction() {
  const npc = findNearestNPC();

  if (npc) {
    showDialog(npc);
    return;
  }

  log("Tidak ada NPC di dekatmu.");
}

// =====================================================
// INPUT KEYBOARD
// =====================================================

window.addEventListener("keydown", event => {
  const key =
    event.key.length === 1
      ? event.key.toLowerCase()
      : event.key;

  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]
      .includes(key)
  ) {
    event.preventDefault();
  }

  if (
    key === " " &&
    !event.repeat
  ) {
    performAction();
  }

  if (key === "Escape") {
    closeDialog();
  }

  keys.add(key);
});

window.addEventListener("keyup", event => {
  const key =
    event.key.length === 1
      ? event.key.toLowerCase()
      : event.key;

  keys.delete(key);
});

window.addEventListener("blur", () => keys.clear());

// =====================================================
// JOYSTICK
// =====================================================

const joystick = document.querySelector("#joystick");
const stick = document.querySelector("#stick");

let pointerId = null;

function moveStick(event) {
  const rect = joystick.getBoundingClientRect();

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  let dx = event.clientX - centerX;
  let dy = event.clientY - centerY;

  const max = rect.width * 0.29;
  const length = Math.hypot(dx, dy);

  if (length > max) {
    dx = (dx / length) * max;
    dy = (dy / length) * max;
  }

  joystickVector = {
    x: dx / max,
    y: dy / max
  };

  stick.style.transform =
    `translate(${dx}px, ${dy}px)`;
}

function resetStick() {
  pointerId = null;
  joystickVector = { x: 0, y: 0 };
  stick.style.transform = "translate(0, 0)";
}

if (joystick && stick) {
  joystick.addEventListener("pointerdown", event => {
    pointerId = event.pointerId;
    joystick.setPointerCapture(pointerId);
    moveStick(event);
  });

  joystick.addEventListener("pointermove", event => {
    if (event.pointerId === pointerId) {
      moveStick(event);
    }
  });

  joystick.addEventListener("pointerup", resetStick);
  joystick.addEventListener("pointercancel", resetStick);
}

// =====================================================
// TOMBOL AKSI
// =====================================================

const actionButton = document.querySelector("#actionButton");

if (actionButton) {
  actionButton.addEventListener("click", performAction);
}

// =====================================================
// LOOP UTAMA
// =====================================================

function frame(timestamp) {
  const dt = Math.min(
    (timestamp - (lastFrame || timestamp)) / 1000,
    0.04
  );

  lastFrame = timestamp;

  if (mapData) {
    update(dt);
    drawGround();

    for (const object of mapData.objects) {
      drawObject(object);
    }

    for (const npc of npcs) {
      drawNPC(npc);
    }

    drawPlayer();
  }

  requestAnimationFrame(frame);
}

boot();
