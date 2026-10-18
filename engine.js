
const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const logList = document.querySelector("#logList");
const moduleList = document.querySelector("#moduleList");

const player = {
  x: 480,
  y: 340,
  radius: 13,
  speed: 190
};

const keys = new Set();

let mapData = null;
let lastFrame = 0;

let joystickVector = {
  x: 0,
  y: 0
};

// ========================================
// UTILITAS
// ========================================

function log(message) {
  const item = document.createElement("li");
  item.textContent = message;

  logList.prepend(item);

  while (logList.children.length > 6) {
    logList.lastElementChild.remove();
  }
}

function setStatus(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
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

// ========================================
// VALIDASI MANIFEST MODUL
// ========================================

function validateManifest(manifest) {
  if (
    !manifest ||
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.modules)
  ) {
    throw new Error(
      "Manifest tidak valid: schemaVersion/modules tidak sesuai."
    );
  }

  const ids = new Set();

  for (const module of manifest.modules) {
    if (
      !module.id ||
      !module.type ||
      !module.path ||
      ids.has(module.id)
    ) {
      throw new Error(
        "Manifest tidak valid: setiap modul harus memiliki id, type, path unik."
      );
    }

    ids.add(module.id);
  }
}

// ========================================
// MEMULAI ENGINE
// ========================================

async function boot() {
  setStatus("clientStatus", "Aktif");

  try {
    const manifest = await loadJson(
      "./content/manifest.json"
    );

    validateManifest(manifest);

    setStatus(
      "manifestStatus",
      `Valid (${manifest.modules.length} modul)`
    );

    moduleList.replaceChildren();

    for (const module of manifest.modules) {
      const chip = document.createElement("span");

      chip.className = "module-chip";
      chip.textContent = `${module.type}: ${module.id}`;

      moduleList.append(chip);
    }

    const mapModule = manifest.modules.find(
      item =>
        item.type === "map" &&
        item.id === manifest.startMap
    );

    if (!mapModule) {
      throw new Error(
        "Peta awal tidak ditemukan dalam manifest."
      );
    }

    mapData = await loadJson(
      `./content/${mapModule.path}`
    );

    if (!Array.isArray(mapData.objects)) {
      throw new Error(
        "Data peta tidak memiliki daftar objects."
      );
    }

    // Posisi awal pemain mengikuti data peta
    if (mapData.spawn) {
      player.x = mapData.spawn.x ?? player.x;
      player.y = mapData.spawn.y ?? player.y;
    }

    document.querySelector("#mapLabel").textContent =
      mapData.name || mapData.id;

    setStatus(
      "mapStatus",
      mapData.name || mapData.id
    );

    log(
      `Manifest valid: ${manifest.modules.length} modul terdaftar.`
    );

    log(`Peta dimuat: ${mapData.name}.`);

    log(
      "Kontrol gerak siap. Multiplayer belum aktif."
    );

  } catch (error) {
    setStatus("manifestStatus", "Gagal");
    setStatus("mapStatus", "Tidak tersedia");

    log(error.message);
    console.error(error);
  }

  requestAnimationFrame(frame);
}

// ========================================
// GAMBAR LINGKUNGAN
// ========================================

function drawGround() {
  ctx.fillStyle = "#78a96f";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const tile = 48;

  for (let y = 0; y < canvas.height; y += tile) {
    for (let x = 0; x < canvas.width; x += tile) {
      const even =
        (x / tile + y / tile) % 2 === 0;

      ctx.fillStyle = even
        ? "#7eaf75"
        : "#76a56d";

      ctx.fillRect(x, y, tile, tile);
    }
  }
}

function drawObject(object) {
  const x = Number(object.x ?? 0);
  const y = Number(object.y ?? 0);

  // JALAN
  if (object.kind === "path") {
    ctx.fillStyle = object.color || "#d8c69b";

    ctx.fillRect(
      x,
      y,
      object.width || 120,
      object.height || 36
    );
  }

  // POHON
  else if (object.kind === "tree") {
    ctx.fillStyle = "#654b35";

    ctx.fillRect(
      x - 5,
      y + 12,
      10,
      24
    );

    ctx.fillStyle = "#2c7049";

    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#3d8a55";

    ctx.beginPath();
    ctx.arc(x - 8, y - 7, 15, 0, Math.PI * 2);
    ctx.fill();
  }

  // GEDUNG
  else if (object.kind === "building") {
    const width = object.width || 150;
    const height = object.height || 90;

    ctx.fillStyle = "#e4d9b8";
    ctx.fillRect(x, y, width, height);

    // Atap
    ctx.fillStyle = "#a65c4d";

    ctx.fillRect(
      x - 8,
      y - 12,
      width + 16,
      20
    );

    // Jendela
    ctx.fillStyle = "#5b756d";

    ctx.fillRect(x + 18, y + 28, 24, 28);
    ctx.fillRect(x + 62, y + 28, 24, 28);

    // Pintu
    ctx.fillStyle = "#384d47";

    ctx.fillRect(
      x + width - 35,
      y + 45,
      22,
      height - 45
    );

    // Nama gedung
    ctx.fillStyle = "#273d34";
    ctx.font = "bold 13px system-ui";

    ctx.fillText(
      object.label || "GEDUNG",
      x + 12,
      y + 15
    );
  }

  // BANGKU
  else if (object.kind === "bench") {
    ctx.fillStyle = "#815535";

    ctx.fillRect(x, y, 64, 12);
    ctx.fillRect(x + 5, y + 12, 6, 13);
    ctx.fillRect(x + 52, y + 12, 6, 13);
  }
}

// ========================================
// GAMBAR KARAKTER
// ========================================

function drawPlayer() {
  // Bayangan
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

  // Badan seragam
  ctx.fillStyle = "#173c70";

  ctx.fillRect(
    player.x - 10,
    player.y - 4,
    20,
    22
  );

  // Kepala
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

  // Rambut
  ctx.fillStyle = "#27342d";

  ctx.fillRect(
    player.x - 10,
    player.y - 23,
    20,
    6
  );

  // Nama sementara
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px system-ui";
  ctx.textAlign = "center";

  ctx.fillText(
    "Murid",
    player.x,
    player.y - 31
  );

  ctx.textAlign = "start";
}

// ========================================
// SISTEM GERAK
// ========================================

function update(dt) {
  let x = joystickVector.x;
  let y = joystickVector.y;

  // Keyboard
  if (keys.has("ArrowLeft") || keys.has("a")) {
    x -= 1;
  }

  if (keys.has("ArrowRight") || keys.has("d")) {
    x += 1;
  }

  if (keys.has("ArrowUp") || keys.has("w")) {
    y -= 1;
  }

  if (keys.has("ArrowDown") || keys.has("s")) {
    y += 1;
  }

  // Normalisasi supaya gerak diagonal tidak lebih cepat
  const magnitude = Math.hypot(x, y);

  if (magnitude > 1) {
    x /= magnitude;
    y /= magnitude;
  }

  player.x += x * player.speed * dt;
  player.y += y * player.speed * dt;

  // Batas peta sementara
  player.x = Math.max(
    20,
    Math.min(canvas.width - 20, player.x)
  );

  player.y = Math.max(
    35,
    Math.min(canvas.height - 15, player.y)
  );
}

// ========================================
// LOOP GAME
// ========================================

function frame(timestamp) {
  const dt = Math.min(
    (timestamp - (lastFrame || timestamp)) / 1000,
    0.04
  );

  lastFrame = timestamp;

  update(dt);
  drawGround();

  if (mapData) {
    for (const object of mapData.objects) {
      drawObject(object);
    }
  }

  drawPlayer();

  requestAnimationFrame(frame);
}

// ========================================
// INPUT KEYBOARD
// ========================================

window.addEventListener("keydown", event => {
  const key =
    event.key.length === 1
      ? event.key.toLowerCase()
      : event.key;

  if (
    [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      " "
    ].includes(key)
  ) {
    event.preventDefault();
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

window.addEventListener("blur", () => {
  keys.clear();
});

// ========================================
// JOYSTICK HP
// ========================================

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

  joystickVector = {
    x: 0,
    y: 0
  };

  stick.style.transform = "translate(0, 0)";
}

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

// ========================================
// TOMBOL AKSI SEMENTARA
// ========================================

document
  .querySelector("#actionButton")
  .addEventListener("click", () => {
    log(
      "Tombol AKSI ditekan. Sistem interaksi NPC dan objek akan ditambahkan sebagai modul."
    );
  });

// ========================================
// JALANKAN ENGINE
// ========================================

boot();
