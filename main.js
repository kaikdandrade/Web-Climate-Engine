const canvas = document.getElementById("climateCanvas");
const ctx = canvas.getContext("2d");

const flash = document.getElementById("flash");

const climateSelect = document.getElementById("climateOptions");
const intensityInput = document.getElementById("intensity");
const windPowerInput = document.getElementById("windPower");
const windDirectionInput = document.getElementById("windDirection");

const intensityValue = document.getElementById("intensityValue");
const windPowerValue = document.getElementById("windPowerValue");
const windDirectionName = document.getElementById("windDirectionName");
const badge = document.getElementById("badge");

const controlBtn = document.getElementById("controlBtn");

let width = 0;
let height = 0;
let dpr = Math.min(window.devicePixelRatio || 1, 2);

const SNOW_COL_W = 7;
const SNOW_EDGE_PADDING = 22;
const MAX_SPLASHES = 260;

const state = {
  climate: "sunny",
  intensity: 50,
  windPower: 30,
  windDirection: "right",
  time: "day",
  paused: false,
  particles: [],
  splashes: [],
  bolts: [],
  snowColumns: [],
  lastTime: 0,
  lightningCooldown: 0,
};

const ClimateLabels = {
  sunny: "Sunny",
  rain: "Rain",
  storm: "Storm",
  snow: "Snow",
  autumn: "Autumn Breeze",
  petals: "Gale of Petals",
};

const backgrounds = {
  night: `
radial-gradient(circle at 20% 20%, rgba(125, 211, 252, 0.12), transparent 28%),
radial-gradient(circle at 80% 10%, rgba(251, 191, 36, 0.06), transparent 30%),
linear-gradient(180deg, #08111f 0%, #111a2b 58%, #101722 100%)
`,
  day: `
radial-gradient(circle at 20% 18%, rgba(255,255,255,0.38), transparent 22%),
radial-gradient(circle at 70% 8%, rgba(125,211,252,0.36), transparent 28%),
linear-gradient(180deg, #5fa8d8, #9ed8f5 50%, #d7f4ff)
`,
  sunset: `
radial-gradient(circle at 75% 20%, rgba(255, 238, 186, 0.48), transparent 22%),
radial-gradient(circle at 35% 25%, rgba(251, 146, 60, 0.20), transparent 34%),
linear-gradient(180deg, #3b2d63, #c56a5a 52%, #f5c47a)
`,
  cold: `
radial-gradient(ellipse at 52% -8%, rgba(255,255,255,0.55), transparent 42%),
radial-gradient(circle at 16% 22%, rgba(215,235,247,0.52), transparent 35%),
radial-gradient(circle at 82% 18%, rgba(235,246,252,0.42), transparent 34%),
linear-gradient(180deg, #dcebf4 0%, #c9dce8 46%, #eef5f8 100%)
`,
};

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  createSnowColumns();
  resetParticles();
}

function createSnowColumns() {
  const count = Math.ceil(width / SNOW_COL_W) + 2;

  state.snowColumns = Array.from({ length: count }, () => ({
    h: 0,
    meltDelay: Utils.rand(160, 390),
  }));
}

function getMaxSnowHeight() {
  return Math.min(52, height * 0.12);
}

function isInsideSnowAccumulationArea(x) {
  return x > SNOW_EDGE_PADDING && x < width - SNOW_EDGE_PADDING;
}

function getEdgeFade(x) {
  if (!isInsideSnowAccumulationArea(x)) return 0;

  const leftDistance = x - SNOW_EDGE_PADDING;
  const rightDistance = width - SNOW_EDGE_PADDING - x;
  const distance = Math.min(leftDistance, rightDistance);

  return Utils.clamp(distance / 95, 0, 1);
}

function getGroundYAt(x) {
  if (!state.snowColumns.length) return height;

  const columnIndex = Utils.clamp(
    Math.floor(x / SNOW_COL_W),
    0,
    state.snowColumns.length - 1,
  );

  const snowHeight = getSmoothedSnowHeight(columnIndex) * getEdgeFade(x);
  return height - snowHeight;
}

function getParticleTarget() {
  const base = Math.floor(state.intensity * 5);

  if (state.climate === "rain") return base;
  if (state.climate === "storm") return Math.floor(base * 2.15);
  if (state.climate === "snow") return Math.floor(base * 1.16);
  if (state.climate === "autumn") return Math.floor(base * 0.36);
  if (state.climate === "sunny") return Math.floor(base * 0.28);
  if (state.climate === "petals") return Math.floor(base * 0.64);

  console.error("Unknown climate type:", state.climate);
  return base;
}

function makeRainDrop(storm = false) {
  const startVy = storm ? Utils.rand(10, 17) : Utils.rand(6, 11);

  return {
    type: "rain",
    x: Utils.rand(-width * 0.2, width * 1.2),
    y: Utils.rand(-height * 0.75, -12),
    baseVx: Utils.rand(-0.55, 0.55),
    startVy,
    vy: startVy,
    gravity: storm ? Utils.rand(0.48, 0.74) : Utils.rand(0.28, 0.46),
    baseLen: storm ? Utils.rand(17, 24) : Utils.rand(11, 17),
    maxLen: storm ? Utils.rand(46, 68) : Utils.rand(28, 42),
    w: storm ? Utils.rand(1.15, 2.2) : Utils.rand(0.72, 1.35),
    alpha: storm ? Utils.rand(0.48, 0.88) : Utils.rand(0.28, 0.58),
  };
}

function createRainSplash(x, y, horizontalSpeed, storm) {
  const count = storm ? 5 : 3;

  for (let i = 0; i < count; i++) {
    if (state.splashes.length > MAX_SPLASHES) state.splashes.shift();

    const side = i % 2 === 0 ? 1 : -1;
    const spread = Utils.rand(1.1, storm ? 3.8 : 2.4);

    state.splashes.push({
      x: x + Utils.rand(-2, 2),
      y: y - Utils.rand(1, 4),
      vx: horizontalSpeed * 0.08 + side * spread,
      vy: -Utils.rand(1.4, storm ? 4.4 : 3.0),
      len: Utils.rand(2.5, storm ? 7 : 4.8),
      life: storm ? Utils.rand(16, 25) : Utils.rand(12, 20),
      maxLife: storm ? 25 : 20,
      alpha: storm ? Utils.rand(0.32, 0.68) : Utils.rand(0.22, 0.5),
    });
  }
}

function drawRainSplashes(dt) {
  for (let i = state.splashes.length - 1; i >= 0; i--) {
    const s = state.splashes[i];

    s.life -= dt;
    s.vy += 0.22 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    const alpha = Utils.clamp(s.life / s.maxLife, 0, 1) * s.alpha;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(205, 235, 255, 0.92)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * 0.8, s.y - s.vy * 0.45 - s.len);
    ctx.stroke();
    ctx.restore();

    if (s.life <= 0 || s.y > height + 10) {
      state.splashes.splice(i, 1);
    }
  }
}

function makeSnowFlake() {
  const depth = Utils.rand(0.55, 1.35);

  return {
    type: "snow",
    x: Utils.rand(-70, width + 70),
    y: Utils.rand(-height, -14),
    vx: Utils.rand(-0.55, 0.55) * depth,
    vy: Utils.rand(0.75, 2.35) * depth + state.intensity * 0.006,
    r: Utils.rand(2.8, 6.6) * depth,
    alpha: Utils.rand(0.46, 0.88),
    phase: Utils.rand(0, Math.PI * 2),
    wave: Utils.rand(0.8, 3.2) * depth,
    jitter: Utils.rand(0.6, 2.4),
    seed: Utils.rand(0, 1000),
    depth,
    rot: Utils.rand(0, Math.PI * 2),
    rotSpeed: Utils.rand(-0.018, 0.018),
  };
}

function makeBreezeParticle(kind) {
  const autumnColors = [
    "#d97706",
    "#f59e0b",
    "#b45309",
    "#dc2626",
    "#92400e",
    "#f97316",
    "#7c2d12",
    "#b91c1c",
    "#facc15",
  ];

  const petalColors = [
    "#fecdd3",
    "#f9a8d4",
    "#f0abfc",
    "#e9d5ff",
    "#fb7185",
    "#f472b6",
    "#ec4899",
    "#e11d48",
    "#facc15",
    "#f97316",
  ];

  const direction = state.windDirection === "left" ? -1 : 1;
  const fromLeft = direction > 0;

  return {
    type: kind,
    x: fromLeft ? Utils.rand(-260, width * 0.15) : Utils.rand(width * 0.85, width + 260),
    y: Utils.rand(-height * 0.22, height * 0.65),
    vx: Utils.rand(0.42, 1.24),
    vy: Utils.rand(0.28, 1.18),
    size: kind === "autumn" ? Utils.rand(14, 24) : Utils.rand(8, 17),
    rot: Utils.rand(0, Math.PI * 2),
    rotSpeed: Utils.rand(-0.045, 0.045),
    sway: Utils.rand(0.45, 1.18),
    phase: Utils.rand(0, Math.PI * 2),
    wave: Utils.rand(0.75, 1.9),
    alpha: kind === "autumn" ? Utils.rand(0.72, 0.96) : Utils.rand(0.62, 0.92),
    color:
      kind === "autumn"
        ? autumnColors[Math.floor(Utils.rand(0, autumnColors.length))]
        : petalColors[Math.floor(Utils.rand(0, petalColors.length))],
  };
}

function makeSunMote() {
  return {
    type: "mote",
    x: Utils.rand(0, width),
    y: Utils.rand(0, height),
    r: Utils.rand(0.8, 2.4),
    vx: Utils.rand(-0.2, 0.45),
    vy: Utils.rand(-0.25, 0.1),
    alpha: Utils.rand(0.18, 0.55),
    phase: Utils.rand(0, Math.PI * 2),
  };
}

function makeParticle() {
  if (state.climate === "rain") return makeRainDrop(false);
  if (state.climate === "storm") return makeRainDrop(true);
  if (state.climate === "snow") return makeSnowFlake();
  if (state.climate === "autumn") return makeBreezeParticle("autumn");
  if (state.climate === "sunny") return makeSunMote();
  if (state.climate === "petals") return makeBreezeParticle("petal");

  console.error("Unknown climate type:", state.climate);
  return makeRainDrop(false);
}

function resetParticles() {
  state.particles = [];
  state.splashes = [];
  const target = getParticleTarget();

  for (let i = 0; i < target; i++) {
    const p = makeParticle();
    p.y = Utils.rand(0, height);
    state.particles.push(p);
  }
}

function ensureParticleCount() {
  const target = getParticleTarget();

  while (state.particles.length < target) {
    state.particles.push(makeParticle());
  }

  if (state.particles.length > target) {
    state.particles.length = target;
  }
}

function drawRain(p, dt) {
  const wind = Utils.getWindVector(state.windDirection, state.windPower);
  const storm = state.climate === "storm";
  const windFactor = storm ? 1.35 : 0.82;
  const horizontalSpeed = p.baseVx + wind.x * windFactor;

  p.vy += p.gravity * dt;
  p.x += horizontalSpeed * dt;
  p.y += (p.vy + wind.y * 0.06) * dt;

  const stretch = Utils.clamp((p.vy - p.startVy) / (storm ? 18 : 13), 0, 1);
  const len = p.baseLen + (p.maxLen - p.baseLen) * stretch;
  const tailX = horizontalSpeed * (storm ? 2.0 : 1.55);

  const groundY = height - 13;
  if (p.y >= groundY || p.x > width + 150 || p.x < -150) {
    if (p.y >= groundY) createRainSplash(p.x, groundY, horizontalSpeed, storm);
    Object.assign(p, makeRainDrop(storm));
    return;
  }

  const dropGrad = ctx.createLinearGradient(p.x, p.y - len, p.x, p.y);
  dropGrad.addColorStop(0, `rgba(190, 225, 255, ${p.alpha * 0.18})`);
  dropGrad.addColorStop(0.4, `rgba(190, 225, 255, ${p.alpha})`);
  dropGrad.addColorStop(1, `rgba(225, 244, 255, ${p.alpha * 0.9})`);

  ctx.beginPath();
  ctx.strokeStyle = dropGrad;
  ctx.lineWidth = p.w;
  ctx.lineCap = "round";
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x - tailX, p.y - len);
  ctx.stroke();
}

function drawSnowCrystal(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);

  ctx.globalAlpha = p.alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = Math.max(0.62, p.r * 0.11);

  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const r1 = p.r;
    const r2 = p.r * 0.54;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();

    const bx = Math.cos(a) * r2;
    const by = Math.sin(a) * r2;
    const sideA = a + Math.PI * 0.72;
    const sideB = a - Math.PI * 0.72;

    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(
      bx + Math.cos(sideA) * p.r * 0.24,
      by + Math.sin(sideA) * p.r * 0.24,
    );
    ctx.moveTo(bx, by);
    ctx.lineTo(
      bx + Math.cos(sideB) * p.r * 0.24,
      by + Math.sin(sideB) * p.r * 0.24,
    );
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(0.72, p.r * 0.14), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawSnow(p, dt) {
  // Nevasca independente do controle de vento: o movimento é próprio, irregular e desordenado.
  p.phase += (0.018 + p.depth * 0.011) * dt;
  p.rot += p.rotSpeed * dt;

  const turbulence =
    Math.sin(p.phase * 1.15 + p.seed) * p.wave * 0.22 +
    Math.sin(p.phase * 2.4 + p.y * 0.012) * p.jitter * 0.12;
  const looseDrift = Math.sin((p.y + p.seed) * 0.018) * 0.28;

  p.x += (p.vx + turbulence + looseDrift) * dt;
  p.y += (p.vy + Math.cos(p.phase * 1.4) * 0.16) * dt;

  const columnIndex = Utils.clamp(
    Math.floor(p.x / SNOW_COL_W),
    0,
    state.snowColumns.length - 1,
  );
  const canPile = isInsideSnowAccumulationArea(p.x);
  const snowHeight = canPile ? state.snowColumns[columnIndex].h : 0;
  const floorY = height - snowHeight;

  if (p.y + p.r >= floorY) {
    if (canPile) {
      const maxH = getMaxSnowHeight();
      const edgeFade = getEdgeFade(p.x);
      const add = p.r * 0.16 * edgeFade;

      state.snowColumns[columnIndex].h = Utils.clamp(
        state.snowColumns[columnIndex].h + add,
        0,
        maxH,
      );

      state.snowColumns[columnIndex].meltDelay = Utils.rand(160, 390);
    }

    Object.assign(p, makeSnowFlake());
  }

  if (p.x > width + 110 || p.x < -110 || p.y > height + 90) {
    Object.assign(p, makeSnowFlake());
  }

  drawSnowCrystal(p);
}

function getSmoothedSnowHeight(index) {
  const a = state.snowColumns[index - 2]?.h || 0;
  const b = state.snowColumns[index - 1]?.h || 0;
  const c = state.snowColumns[index]?.h || 0;
  const d = state.snowColumns[index + 1]?.h || 0;
  const e = state.snowColumns[index + 2]?.h || 0;

  return (a + b * 2 + c * 3 + d * 2 + e) / 9;
}

function drawSnowAccumulation(dt) {
  if (state.climate !== "snow") return;

  ctx.beginPath();
  ctx.moveTo(0, height);

  for (let i = 0; i < state.snowColumns.length; i++) {
    const x = i * SNOW_COL_W;
    const edgeFade = getEdgeFade(x);
    const h = getSmoothedSnowHeight(i) * edgeFade;
    const soft = Math.sin(i * 0.35) * 1.2;

    ctx.lineTo(x, height - h - soft);
  }

  ctx.lineTo(width, height);
  ctx.closePath();

  const snowGrad = ctx.createLinearGradient(0, height - 90, 0, height);
  snowGrad.addColorStop(0, "rgba(255,255,255,0.98)");
  snowGrad.addColorStop(0.55, "rgba(232,244,250,0.97)");
  snowGrad.addColorStop(1, "rgba(202,225,235,0.93)");

  ctx.fillStyle = snowGrad;
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.34)";

  for (let i = 0; i < state.snowColumns.length; i += 6) {
    const x = i * SNOW_COL_W;
    const h = getSmoothedSnowHeight(i) * getEdgeFade(x);

    if (h > 4) {
      ctx.beginPath();
      ctx.arc(
        x,
        height - h - Utils.rand(0, 2),
        Utils.rand(1, 2.4),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  for (const col of state.snowColumns) {
    col.meltDelay -= dt;

    if (col.meltDelay <= 0) {
      col.h = Math.max(0, col.h - 0.04 * dt);
    }
  }
}

function clearSnowSlowly(dt) {
  if (state.climate === "snow") return;

  let hasSnow = false;

  for (const col of state.snowColumns) {
    if (col.h > 0) {
      col.h = Math.max(0, col.h - 0.18 * dt);
      hasSnow = true;
    }
  }

  if (!hasSnow) return;

  ctx.beginPath();
  ctx.moveTo(0, height);

  for (let i = 0; i < state.snowColumns.length; i++) {
    const x = i * SNOW_COL_W;
    const h = getSmoothedSnowHeight(i) * getEdgeFade(x);
    ctx.lineTo(x, height - h);
  }

  ctx.lineTo(width, height);
  ctx.closePath();

  ctx.fillStyle = "rgba(240, 250, 255, 0.78)";
  ctx.fill();
}

function drawAutumnLeaf(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.scale(1, 0.9);

  const s = p.size;

  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;

  ctx.beginPath();
  ctx.moveTo(0, s * 1.05);

  ctx.bezierCurveTo(-s * 0.28, s * 0.55, -s * 1.05, s * 0.48, -s * 0.75, s * 0.04);
  ctx.bezierCurveTo(-s * 1.23, -s * 0.12, -s * 0.82, -s * 0.48, -s * 0.48, -s * 0.4);
  ctx.bezierCurveTo(-s * 0.76, -s * 0.92, -s * 0.28, -s * 0.97, -s * 0.12, -s * 0.66);
  ctx.bezierCurveTo(-s * 0.02, -s * 1.25, s * 0.02, -s * 1.25, s * 0.12, -s * 0.66);
  ctx.bezierCurveTo(s * 0.28, -s * 0.97, s * 0.76, -s * 0.92, s * 0.48, -s * 0.4);
  ctx.bezierCurveTo(s * 0.82, -s * 0.48, s * 1.23, -s * 0.12, s * 0.75, s * 0.04);
  ctx.bezierCurveTo(s * 1.05, s * 0.48, s * 0.28, s * 0.55, 0, s * 1.05);

  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 237, 213, 0.54)";
  ctx.lineWidth = Math.max(0.8, s * 0.055);
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(0, s * 0.9);
  ctx.lineTo(0, -s * 0.72);
  ctx.stroke();

  ctx.lineWidth = Math.max(0.6, s * 0.035);

  for (let side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.25);
    ctx.lineTo(side * s * 0.52, -s * 0.42);
    ctx.moveTo(0, s * 0.04);
    ctx.lineTo(side * s * 0.62, s * 0.02);
    ctx.moveTo(0, s * 0.32);
    ctx.lineTo(side * s * 0.42, s * 0.42);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(91, 33, 18, 0.55)";
  ctx.lineWidth = Math.max(1, s * 0.08);

  ctx.beginPath();
  ctx.moveTo(0, s * 0.85);
  ctx.lineTo(0, s * 1.35);
  ctx.stroke();

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawPetalShape(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.scale(0.76, 1.25);

  const s = p.size;

  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  ctx.shadowBlur = 10;
  ctx.shadowColor = "rgba(244, 114, 182, 0.34)";

  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.92, -s * 0.46, s * 0.72, s * 0.72, 0, s);
  ctx.bezierCurveTo(-s * 0.72, s * 0.72, -s * 0.92, -s * 0.46, 0, -s);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.34)";
  ctx.lineWidth = 0.8;

  ctx.beginPath();
  ctx.moveTo(0, -s * 0.6);
  ctx.quadraticCurveTo(s * 0.18, 0, 0, s * 0.72);
  ctx.stroke();

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBreezeParticle(p, dt) {
  const wind = Utils.getWindVector(state.windDirection, state.windPower);
  const direction = state.windDirection === "left" ? -1 : 1;
  const power = state.windPower / 100;
  const gustPower = 0.55 + power * 1.55;
  const swirl = wind.swirl ? Math.sin(p.phase * 1.8) * 1.6 * power : 0;

  p.phase += 0.024 * dt;
  p.rot += (p.rotSpeed + Math.sin(p.phase) * 0.008) * dt;
  p.x +=
    (p.vx * direction * gustPower + wind.x * 0.22 + swirl + Math.sin(p.phase) * p.sway * 0.42) *
    dt;
  p.y += (p.vy + Math.sin(p.phase * 0.82) * p.wave * 0.17 + wind.y * 0.12) * dt;

  if (p.y > height + 90 || p.y < -240 || p.x > width + 280 || p.x < -280) {
    Object.assign(p, makeBreezeParticle(p.type));

    if (direction < 0) {
      p.x = Utils.rand(width + 40, width + 260);
    } else {
      p.x = Utils.rand(-260, -40);
    }

    p.y = Utils.rand(-height * 0.2, height * 0.65);
  }

  if (p.type === "autumn") drawAutumnLeaf(p);
  if (p.type === "petal") drawPetalShape(p);
}

function drawSunMote(p, dt) {
  p.phase += 0.015 * dt;
  p.x += (p.vx + Math.sin(p.phase) * 0.12) * dt;
  p.y += (p.vy + Math.cos(p.phase) * 0.08) * dt;

  if (p.x < -20) p.x = width + 20;
  if (p.x > width + 20) p.x = -20;
  if (p.y < -20) p.y = height + 20;
  if (p.y > height + 20) p.y = -20;

  const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
  glow.addColorStop(0, `rgba(255, 246, 196, ${p.alpha})`);
  glow.addColorStop(1, "rgba(255, 246, 196, 0)");

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawSunnyAtmosphere(time) {
  if (state.climate !== "sunny") return;

  const sunX = width * 0.74;
  const sunY = height * 0.18;
  const sunR = Math.min(width, height) * 0.09;
  const pulse = Math.sin(time * 0.002) * 0.06 + 1;
  const intensity = state.intensity / 100;

  ctx.save();

  const skyGlow = ctx.createRadialGradient(
    sunX,
    sunY,
    0,
    sunX,
    sunY,
    Math.max(width, height) * 0.78,
  );
  skyGlow.addColorStop(0, `rgba(255, 244, 189, ${0.38 + intensity * 0.24})`);
  skyGlow.addColorStop(0.38, `rgba(251, 191, 36, ${0.12 + intensity * 0.08})`);
  skyGlow.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = skyGlow;
  ctx.fillRect(0, 0, width, height);

  ctx.translate(sunX, sunY);
  ctx.rotate(time * 0.00018);

  const rayCount = 22;
  for (let i = 0; i < rayCount; i++) {
    const a = (i * Math.PI * 2) / rayCount;
    const inner = sunR * 1.18;
    const outer = sunR * (2.3 + Math.sin(time * 0.002 + i) * 0.24) * pulse;

    ctx.strokeStyle = `rgba(255, 244, 189, ${0.12 + intensity * 0.23})`;
    ctx.lineWidth = 2.3;

    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.stroke();
  }

  const sunGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, sunR * 3.1);
  sunGlow.addColorStop(0, "rgba(255, 255, 230, 1)");
  sunGlow.addColorStop(0.28, "rgba(255, 224, 102, 0.96)");
  sunGlow.addColorStop(0.6, "rgba(251, 191, 36, 0.32)");
  sunGlow.addColorStop(1, "rgba(251, 191, 36, 0)");

  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(0, 0, sunR * 3.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 247, 205, 0.98)";
  ctx.beginPath();
  ctx.arc(0, 0, sunR * 0.94, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSnowAtmosphere(time) {
  if (state.climate !== "snow") return;

  ctx.save();

  const haze = ctx.createLinearGradient(0, 0, 0, height);
  haze.addColorStop(0, "rgba(255,255,255,0.16)");
  haze.addColorStop(0.45, "rgba(235,246,252,0.12)");
  haze.addColorStop(1, "rgba(255,255,255,0.24)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.12 + state.intensity * 0.0012;

  for (let i = 0; i < 7; i++) {
    const x = ((time * 0.014 * (i + 1) + i * 280) % (width + 520)) - 260;
    const y = height * (0.18 + i * 0.095) + Math.sin(time * 0.002 + i) * 18;

    const grad = ctx.createRadialGradient(x, y, 0, x, y, 260);
    grad.addColorStop(0, "rgba(255,255,255,0.42)");
    grad.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, 300, 85, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBreezeAtmosphere(time) {
  if (state.climate !== "petals" && state.climate !== "autumn") return;

  ctx.save();

  const isPetals = state.climate === "petals";
  const grad = ctx.createLinearGradient(0, 0, width, height);

  if (isPetals) {
    grad.addColorStop(0, "rgba(76, 29, 149, 0.15)");
    grad.addColorStop(0.48, "rgba(190, 24, 93, 0.10)");
    grad.addColorStop(1, "rgba(251, 207, 232, 0.12)");
  } else {
    grad.addColorStop(0, "rgba(120, 53, 15, 0.13)");
    grad.addColorStop(0.48, "rgba(217, 119, 6, 0.08)");
    grad.addColorStop(1, "rgba(254, 215, 170, 0.10)");
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = isPetals ? 0.15 : 0.11;
  ctx.strokeStyle = isPetals ? "rgba(255, 228, 230, 0.66)" : "rgba(255, 237, 213, 0.58)";
  ctx.lineWidth = 1.1;

  const direction = state.windDirection === "left" ? -1 : 1;
  const windSpeed = 0.034 + (state.windPower / 100) * 0.042;

  for (let i = 0; i < 10; i++) {
    const baseY = 70 + i * 68 + Math.sin(time * 0.006 + i) * 22;
    const start =
      direction > 0
        ? ((time * windSpeed + i * 170) % (width + 460)) - 460
        : width - ((time * windSpeed + i * 170) % (width + 460)) + 210;

    ctx.beginPath();

    if (direction > 0) {
      ctx.moveTo(start, baseY);
      ctx.bezierCurveTo(start + 130, baseY - 55, start + 260, baseY + 48, start + 460, baseY - 8);
    } else {
      ctx.moveTo(start, baseY);
      ctx.bezierCurveTo(start - 130, baseY - 55, start - 260, baseY + 48, start - 460, baseY - 8);
    }

    ctx.stroke();
  }

  ctx.restore();
}

function drawStormMist(time) {
  if (state.climate !== "storm") return;

  const intensity = state.intensity / 100;

  ctx.save();
  ctx.globalAlpha = 0.06 + intensity * 0.12;

  for (let i = 0; i < 7; i++) {
    const x = ((time * 0.025 * (i + 1) + i * 260) % (width + 420)) - 210;
    const y = 75 + Math.sin(time * 0.006 + i) * 30;

    const grad = ctx.createRadialGradient(x, y, 0, x, y, 260);
    grad.addColorStop(0, "rgba(220,235,255,0.48)");
    grad.addColorStop(1, "rgba(220,235,255,0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 260, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function createLightning() {
  const startX = Utils.rand(width * 0.12, width * 0.88);
  const segments = [];
  let x = startX;
  let y = 0;

  while (y < height * Utils.rand(0.35, 0.75)) {
    const nextX = x + Utils.rand(-32, 32);
    const nextY = y + Utils.rand(22, 58);

    segments.push({ x1: x, y1: y, x2: nextX, y2: nextY });

    if (Math.random() < 0.24) {
      segments.push({
        x1: nextX,
        y1: nextY,
        x2: nextX + Utils.rand(-85, 85),
        y2: nextY + Utils.rand(20, 75),
      });
    }

    x = nextX;
    y = nextY;
  }

  state.bolts.push({
    life: 13,
    maxLife: 13,
    segments,
  });

  flash.style.transition = "none";
  flash.style.opacity = state.climate === "storm" ? "0.72" : "0.35";

  requestAnimationFrame(() => {
    flash.style.transition = "opacity 380ms ease-out";
    flash.style.opacity = "0";
  });
}

function updateLightning(dt) {
  state.lightningCooldown -= dt;

  const chance =
    state.climate === "storm"
      ? state.intensity * 0.003
      : state.climate === "rain"
        ? state.intensity * 0.000009
        : 0;

  if (state.lightningCooldown <= 0 && Math.random() < chance) {
    createLightning();
    state.lightningCooldown =
      state.climate === "storm" ? Utils.rand(40, 130) : Utils.rand(380, 900);
  }

  for (let i = state.bolts.length - 1; i >= 0; i--) {
    const bolt = state.bolts[i];
    bolt.life -= dt;

    const alpha = Utils.clamp(bolt.life / bolt.maxLife, 0, 1);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.shadowBlur = 24;
    ctx.shadowColor = "rgba(190, 225, 255, 0.95)";
    ctx.strokeStyle = `rgba(220, 245, 255, ${alpha})`;
    ctx.lineWidth = 3.2;

    ctx.beginPath();

    for (const s of bolt.segments) {
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }

    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 1.15;

    ctx.beginPath();

    for (const s of bolt.segments) {
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }

    ctx.stroke();
    ctx.restore();

    if (bolt.life <= 0) {
      state.bolts.splice(i, 1);
    }
  }
}

function drawVignette() {
  const isSnow = state.climate === "snow";
  const grad = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.1,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75,
  );

  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, isSnow ? "rgba(52, 77, 92, 0.16)" : "rgba(0,0,0,0.32)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function animate(timestamp) {
  requestAnimationFrame(animate);

  if (state.paused) {
    state.lastTime = timestamp;
    return;
  }

  const dt = Utils.clamp((timestamp - state.lastTime) / 16.666, 0.4, 2.2);
  state.lastTime = timestamp;

  ctx.clearRect(0, 0, width, height);

  ensureParticleCount();
  drawSunnyAtmosphere(timestamp);
  drawSnowAtmosphere(timestamp);
  drawStormMist(timestamp);
  drawBreezeAtmosphere(timestamp);

  for (const p of state.particles) {
    if (p.type === "rain") drawRain(p, dt);
    if (p.type === "snow") drawSnow(p, dt);
    if (p.type === "autumn" || p.type === "petal") drawBreezeParticle(p, dt);
    if (p.type === "mote") drawSunMote(p, dt);
  }

  drawRainSplashes(dt);
  drawSnowAccumulation(dt);
  clearSnowSlowly(dt);
  updateLightning(dt);
  drawVignette();
}

function updateUI() {
  document.body.classList.remove("sunny", "rain", "storm", "snow", "autumn", "petals");
  document.body.classList.add(state.climate);
  document.body.style.background = backgrounds[state.time];

  intensityValue.textContent = state.intensity + "%";
  windPowerValue.textContent = state.windPower + "%";
  windDirectionName.textContent = Utils.HandleString(state.windDirection);
  badge.textContent = ClimateLabels[state.climate].toUpperCase();
}

climateSelect.addEventListener("change", () => {
  state.climate = climateSelect.value;
  state.bolts = [];
  state.splashes = [];

  switch (state.climate) {
    case "sunny":
      state.time = "day";
      break;
    case "rain":
    case "storm":
      state.time = "night";
      break;
    case "snow":
      state.time = "cold";
      break;
    case "autumn":
      state.time = "sunset";
      break;
    case "petals":
      state.time = "night";
      break;
    default:
      state.time = "day";
  }

  resetParticles();
  updateUI();
});

intensityInput.addEventListener("input", () => {
  state.intensity = Number(intensityInput.value);
  updateUI();
});

windPowerInput.addEventListener("input", () => {
  state.windPower = Number(windPowerInput.value);
  updateUI();
});

windDirectionInput.addEventListener("change", () => {
  state.windDirection = windDirectionInput.value;
  updateUI();
});

controlBtn.addEventListener("click", () => {
  state.paused = !state.paused;
  controlBtn.textContent = state.paused ? "Continue" : "Pause";
});

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
updateUI();
requestAnimationFrame(animate);
