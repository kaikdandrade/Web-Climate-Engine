class Climate {
  constructor() {
    this.canvas = document.getElementById("climateCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.flash = document.getElementById("flash");

    this.ui = {
      climateSelect: document.getElementById("climateOptions"),
      intensityInput: document.getElementById("intensity"),
      windPowerInput: document.getElementById("windPower"),
      windDirectionInput: document.getElementById("windDirection"),
      windDirectionControl: document.getElementById("windDirectionControl"),
      intensityValue: document.getElementById("intensityValue"),
      windPowerValue: document.getElementById("windPowerValue"),
      windDirectionName: document.getElementById("windDirectionName"),
      badge: document.getElementById("badge"),
      controlBtn: document.getElementById("controlBtn"),
    };

    this.width = 0;
    this.height = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.SNOW_COL_W = 7;
    this.SNOW_EDGE_PADDING = 22;
    this.MAX_SPLASHES = 280;
    this.RARE_STORM_LIGHTNING_CHANCE = 0.00005; // 0.005%

    this.state = {
      climate: "sunny",
      intensity: 50,
      windPower: 30,
      windDirection: "right",
      paused: false,
      particles: [],
      splashes: [],
      bolts: [],
      snowColumns: [],
      lastTime: 0,
      lightningCooldown: 0,
    };

    this.labels = {
      sunny: "Sunny",
      rain: "Rain",
      storm: "Storm",
      snow: "Snow",
      autumn: "Autumn Breeze",
      petals: "Gale of Petals",
      starry: "Starry Night",
    };

    this.backgrounds = {
      sunny: `
radial-gradient(circle at 20% 18%, rgba(255,255,255,0.38), transparent 22%),
radial-gradient(circle at 70% 8%, rgba(125,211,252,0.36), transparent 28%),
linear-gradient(180deg, #5fa8d8, #9ed8f5 50%, #d7f4ff)
`,
      rain: `
radial-gradient(circle at 20% 20%, rgba(125, 211, 252, 0.12), transparent 28%),
radial-gradient(circle at 80% 10%, rgba(251, 191, 36, 0.05), transparent 30%),
linear-gradient(180deg, #08111f 0%, #111a2b 58%, #101722 100%)
`,
      storm: `
radial-gradient(circle at 26% 12%, rgba(145, 163, 184, 0.16), transparent 26%),
radial-gradient(circle at 76% 16%, rgba(96, 165, 250, 0.09), transparent 31%),
linear-gradient(180deg, #050816 0%, #0b1221 42%, #111827 100%)
`,
      snow: `
radial-gradient(ellipse at 48% 98%, rgba(238, 250, 252, 0.56), transparent 42%),
radial-gradient(circle at 18% 18%, rgba(183, 218, 234, 0.18), transparent 31%),
radial-gradient(circle at 84% 14%, rgba(235, 249, 252, 0.14), transparent 28%),
linear-gradient(180deg, #102033 0%, #1f3c52 40%, #5f8394 74%, #dceef2 100%)
`,
      autumn: `
radial-gradient(circle at 75% 20%, rgba(255, 238, 186, 0.48), transparent 22%),
radial-gradient(circle at 35% 25%, rgba(251, 146, 60, 0.20), transparent 34%),
linear-gradient(180deg, #3b2d63, #c56a5a 52%, #f5c47a)
`,
      petals: `
radial-gradient(circle at 28% 15%, rgba(244, 114, 182, 0.13), transparent 25%),
radial-gradient(circle at 76% 12%, rgba(168, 85, 247, 0.12), transparent 30%),
linear-gradient(180deg, #0b1025 0%, #1d1538 52%, #2f1f4a 100%)
`,
      starry: `
radial-gradient(circle at 76% 17%, rgba(191, 219, 254, 0.14), transparent 24%),
radial-gradient(circle at 35% 68%, rgba(99, 102, 241, 0.10), transparent 36%),
linear-gradient(180deg, #020617 0%, #07111f 48%, #111827 100%)
`,
    };

    this.bindEvents();
    this.resizeCanvas();
    this.updateUI();
    requestAnimationFrame(time => this.animate(time));
  }

  bindEvents() {
    this.ui.climateSelect.addEventListener("change", () => {
      this.setClimate(this.ui.climateSelect.value);
    });

    this.ui.intensityInput.addEventListener("input", () => {
      this.state.intensity = Number(this.ui.intensityInput.value);
      this.updateUI();
    });

    this.ui.windPowerInput.addEventListener("input", () => {
      this.state.windPower = Number(this.ui.windPowerInput.value);
      this.updateUI();
    });

    this.ui.windDirectionInput.addEventListener("change", () => {
      this.state.windDirection = this.ui.windDirectionInput.value;
      this.updateUI();
    });

    this.ui.controlBtn.addEventListener("click", () => {
      this.state.paused = !this.state.paused;
      this.ui.controlBtn.textContent = this.state.paused ? "Continue" : "Pause";
    });

    window.addEventListener("resize", () => this.resizeCanvas());
  }

  setClimate(climate) {
    this.state.climate = climate;
    this.state.bolts = [];
    this.state.splashes = [];
    this.resetParticles();
    this.updateUI();
  }

  resizeCanvas() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.createSnowColumns();
    this.resetParticles();
  }

  createSnowColumns() {
    const count = Math.ceil(this.width / this.SNOW_COL_W) + 2;

    this.state.snowColumns = Array.from({ length: count }, () => ({
      h: 0,
      meltDelay: Utils.rand(160, 390),
    }));
  }

  updateUI() {
    const climateNames = Object.keys(this.labels);
    document.body.classList.remove(...climateNames);
    document.body.classList.add(this.state.climate);
    document.body.style.background = this.backgrounds[this.state.climate];

    const windDirectionLocked = ["snow", "autumn", "petals"].includes(this.state.climate);

    if (this.state.climate === "autumn" || this.state.climate === "petals") {
      this.state.windDirection = "swirl";
      this.ui.windDirectionInput.value = "swirl";
      this.ui.windDirectionName.textContent = "Swirl locked";
      this.ui.windDirectionInput.title = "Autumn e Petals usam Swirl fixo.";
    } else if (this.state.climate === "snow") {
      this.ui.windDirectionName.textContent = "Own snowstorm";
      this.ui.windDirectionInput.title = "Snow usa movimento próprio; Wind Power altera a velocidade dos flocos.";
    } else {
      this.ui.windDirectionInput.value = this.state.windDirection;
      this.ui.windDirectionName.textContent = Utils.normalizeLabel(this.state.windDirection);
      this.ui.windDirectionInput.title = "";
    }

    this.ui.windDirectionInput.disabled = windDirectionLocked;
    this.ui.windDirectionControl.classList.toggle("is-disabled", windDirectionLocked);

    this.ui.intensityValue.textContent = this.state.intensity + "%";
    this.ui.windPowerValue.textContent = this.state.windPower + "%";
    this.ui.badge.textContent = this.labels[this.state.climate].toUpperCase();
  }

  getParticleTarget() {
    const base = Math.floor(this.state.intensity * 5);

    const targets = {
      rain: base,
      storm: Math.floor(base * 2.15),
      snow: Math.floor(base * 1.18),
      autumn: Math.floor(base * 0.36),
      sunny: Math.floor(base * 0.28),
      petals: Math.floor(base * 0.58),
      starry: Math.floor(120 + this.state.intensity * 1.8),
    };

    return targets[this.state.climate] ?? base;
  }

  resetParticles() {
    this.state.particles = [];
    this.state.splashes = [];

    const target = this.getParticleTarget();
    for (let i = 0; i < target; i++) {
      const particle = this.makeParticle();
      particle.y = Utils.rand(0, this.height);
      this.state.particles.push(particle);
    }
  }

  ensureParticleCount() {
    const target = this.getParticleTarget();

    while (this.state.particles.length < target) {
      this.state.particles.push(this.makeParticle());
    }

    if (this.state.particles.length > target) {
      this.state.particles.length = target;
    }
  }

  makeParticle() {
    const factories = {
      rain: () => this.makeRainDrop(false),
      storm: () => this.makeRainDrop(true),
      snow: () => this.makeSnowFlake(),
      autumn: () => this.makeBreezeParticle("autumn"),
      sunny: () => this.makeSunMote(),
      petals: () => this.makeBreezeParticle("petal"),
      starry: () => this.makeStar(),
    };

    return (factories[this.state.climate] || factories.rain)();
  }

  makeRainDrop(storm = false) {
    const startVy = storm ? Utils.rand(10, 17) : Utils.rand(6, 11);

    return {
      type: "rain",
      x: Utils.rand(-this.width * 0.2, this.width * 1.2),
      y: Utils.rand(-this.height * 0.75, -12),
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

  makeSnowFlake() {
    const depth = Utils.rand(0.55, 1.35);

    return {
      type: "snow",
      x: Utils.rand(-70, this.width + 70),
      y: Utils.rand(-this.height, -14),
      vx: Utils.rand(-0.55, 0.55) * depth,
      vy: Utils.rand(0.72, 2.2) * depth + this.state.intensity * 0.005,
      r: Utils.rand(2.8, 6.6) * depth,
      alpha: Utils.rand(0.5, 0.93),
      phase: Utils.rand(0, Math.PI * 2),
      wave: Utils.rand(0.8, 3.2) * depth,
      jitter: Utils.rand(0.6, 2.4),
      seed: Utils.rand(0, 1000),
      depth,
      rot: Utils.rand(0, Math.PI * 2),
      rotSpeed: Utils.rand(-0.018, 0.018),
    };
  }

  makeBreezeParticle(kind) {
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

    return {
      type: kind,
      x: Utils.rand(-260, this.width * 0.32),
      y: Utils.rand(-this.height * 0.22, this.height * 0.65),
      vx: kind === "autumn" ? Utils.rand(0.28, 0.86) : Utils.rand(0.22, 0.72),
      vy: Utils.rand(0.2, 0.95),
      size: kind === "autumn" ? Utils.rand(14, 24) : Utils.rand(8, 17),
      rot: Utils.rand(0, Math.PI * 2),
      rotSpeed: Utils.rand(-0.045, 0.045),
      sway: Utils.rand(0.45, 1.18),
      phase: Utils.rand(0, Math.PI * 2),
      wave: Utils.rand(0.75, 1.9),
      alpha: kind === "autumn" ? Utils.rand(0.72, 0.96) : Utils.rand(0.62, 0.92),
      color: kind === "autumn" ? Utils.pick(autumnColors) : Utils.pick(petalColors),
    };
  }

  makeSunMote() {
    return {
      type: "mote",
      x: Utils.rand(0, this.width),
      y: Utils.rand(0, this.height),
      r: Utils.rand(0.8, 2.4),
      vx: Utils.rand(-0.2, 0.45),
      vy: Utils.rand(-0.25, 0.1),
      alpha: Utils.rand(0.18, 0.55),
      phase: Utils.rand(0, Math.PI * 2),
    };
  }

  makeStar() {
    return {
      type: "star",
      x: Utils.rand(0, this.width),
      y: Utils.rand(0, this.height * 0.72),
      r: Utils.rand(0.55, 1.9),
      alpha: Utils.rand(0.36, 0.95),
      phase: Utils.rand(0, Math.PI * 2),
      pulse: Utils.rand(0.006, 0.018),
      glow: Utils.rand(1.6, 4.6),
    };
  }

  getMaxSnowHeight() {
    return Math.min(52, this.height * 0.12);
  }

  isInsideSnowAccumulationArea(x) {
    return x > this.SNOW_EDGE_PADDING && x < this.width - this.SNOW_EDGE_PADDING;
  }

  getEdgeFade(x) {
    if (!this.isInsideSnowAccumulationArea(x)) return 0;

    const leftDistance = x - this.SNOW_EDGE_PADDING;
    const rightDistance = this.width - this.SNOW_EDGE_PADDING - x;
    const distance = Math.min(leftDistance, rightDistance);

    return Utils.clamp(distance / 95, 0, 1);
  }

  getSmoothedSnowHeight(index) {
    const cols = this.state.snowColumns;
    const a = cols[index - 2]?.h || 0;
    const b = cols[index - 1]?.h || 0;
    const c = cols[index]?.h || 0;
    const d = cols[index + 1]?.h || 0;
    const e = cols[index + 2]?.h || 0;

    return (a + b * 2 + c * 3 + d * 2 + e) / 9;
  }

  getGroundYAt(x) {
    if (!this.state.snowColumns.length) return this.height;

    const columnIndex = Utils.clamp(
      Math.floor(x / this.SNOW_COL_W),
      0,
      this.state.snowColumns.length - 1,
    );

    const snowHeight = this.getSmoothedSnowHeight(columnIndex) * this.getEdgeFade(x);
    return this.height - snowHeight;
  }

  getActiveWindVector() {
    if (this.state.climate === "autumn" || this.state.climate === "petals") {
      return Utils.getWindVector("swirl", this.state.windPower);
    }

    if (this.state.climate === "snow") {
      return { x: 0, y: 0, swirl: false };
    }

    return Utils.getWindVector(this.state.windDirection, this.state.windPower);
  }

  createRainSplash(x, y, horizontalSpeed, storm) {
    const count = storm ? 5 : 3;

    for (let i = 0; i < count; i++) {
      if (this.state.splashes.length > this.MAX_SPLASHES) this.state.splashes.shift();

      const side = i % 2 === 0 ? 1 : -1;
      const spread = Utils.rand(1.1, storm ? 3.8 : 2.4);

      this.state.splashes.push({
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

  drawRainSplashes(dt) {
    const ctx = this.ctx;

    for (let i = this.state.splashes.length - 1; i >= 0; i--) {
      const s = this.state.splashes[i];

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

      if (s.life <= 0 || s.y > this.height + 10) {
        this.state.splashes.splice(i, 1);
      }
    }
  }

  drawRain(p, dt) {
    const ctx = this.ctx;
    const wind = this.getActiveWindVector();
    const storm = this.state.climate === "storm";
    const windFactor = storm ? 1.35 : 0.82;
    const horizontalSpeed = p.baseVx + wind.x * windFactor;

    p.vy += p.gravity * dt;
    p.x += horizontalSpeed * dt;
    p.y += (p.vy + wind.y * 0.06) * dt;

    const stretch = Utils.clamp((p.vy - p.startVy) / (storm ? 18 : 13), 0, 1);
    const len = p.baseLen + (p.maxLen - p.baseLen) * stretch;
    const tailX = horizontalSpeed * (storm ? 2.0 : 1.55);

    const groundY = this.height - 13;
    if (p.y >= groundY || p.x > this.width + 150 || p.x < -150) {
      if (p.y >= groundY) this.createRainSplash(p.x, groundY, horizontalSpeed, storm);
      Object.assign(p, this.makeRainDrop(storm));
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

  drawSnowCrystal(p) {
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);

    ctx.globalAlpha = p.alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.96)";
    ctx.shadowBlur = p.r * 1.4;
    ctx.shadowColor = "rgba(230, 247, 255, 0.36)";
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
      ctx.lineTo(bx + Math.cos(sideA) * p.r * 0.24, by + Math.sin(sideA) * p.r * 0.24);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(sideB) * p.r * 0.24, by + Math.sin(sideB) * p.r * 0.24);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.72, p.r * 0.14), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawSnow(p, dt) {
    const speedBoost = 0.75 + (this.state.windPower / 100) * 1.35;

    p.phase += (0.018 + p.depth * 0.011) * dt * speedBoost;
    p.rot += p.rotSpeed * dt * speedBoost;

    const turbulence =
      Math.sin(p.phase * 1.15 + p.seed) * p.wave * 0.22 +
      Math.sin(p.phase * 2.4 + p.y * 0.012) * p.jitter * 0.12;
    const looseDrift = Math.sin((p.y + p.seed) * 0.018) * 0.28;

    p.x += (p.vx + turbulence + looseDrift) * dt;
    p.y += (p.vy * speedBoost + Math.cos(p.phase * 1.4) * 0.16) * dt;

    const columnIndex = Utils.clamp(
      Math.floor(p.x / this.SNOW_COL_W),
      0,
      this.state.snowColumns.length - 1,
    );
    const canPile = this.isInsideSnowAccumulationArea(p.x);
    const snowHeight = canPile ? this.state.snowColumns[columnIndex].h : 0;
    const floorY = this.height - snowHeight;

    if (p.y + p.r >= floorY) {
      if (canPile) {
        const maxH = this.getMaxSnowHeight();
        const edgeFade = this.getEdgeFade(p.x);
        const add = p.r * 0.16 * edgeFade;

        this.state.snowColumns[columnIndex].h = Utils.clamp(
          this.state.snowColumns[columnIndex].h + add,
          0,
          maxH,
        );

        this.state.snowColumns[columnIndex].meltDelay = Utils.rand(160, 390);
      }

      Object.assign(p, this.makeSnowFlake());
    }

    if (p.x > this.width + 110 || p.x < -110 || p.y > this.height + 90) {
      Object.assign(p, this.makeSnowFlake());
    }

    this.drawSnowCrystal(p);
  }

  drawSnowAccumulation(dt) {
    if (this.state.climate !== "snow") return;

    const ctx = this.ctx;

    ctx.beginPath();
    ctx.moveTo(0, this.height);

    for (let i = 0; i < this.state.snowColumns.length; i++) {
      const x = i * this.SNOW_COL_W;
      const edgeFade = this.getEdgeFade(x);
      const h = this.getSmoothedSnowHeight(i) * edgeFade;
      const soft = Math.sin(i * 0.35) * 1.2;

      ctx.lineTo(x, this.height - h - soft);
    }

    ctx.lineTo(this.width, this.height);
    ctx.closePath();

    const snowGrad = ctx.createLinearGradient(0, this.height - 90, 0, this.height);
    snowGrad.addColorStop(0, "rgba(255,255,255,0.99)");
    snowGrad.addColorStop(0.52, "rgba(235,247,251,0.98)");
    snowGrad.addColorStop(1, "rgba(205,228,236,0.95)");

    ctx.fillStyle = snowGrad;
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.38)";

    for (let i = 0; i < this.state.snowColumns.length; i += 6) {
      const x = i * this.SNOW_COL_W;
      const h = this.getSmoothedSnowHeight(i) * this.getEdgeFade(x);

      if (h > 4) {
        ctx.beginPath();
        ctx.arc(x, this.height - h - Utils.rand(0, 2), Utils.rand(1, 2.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const col of this.state.snowColumns) {
      col.meltDelay -= dt;

      if (col.meltDelay <= 0) {
        col.h = Math.max(0, col.h - 0.04 * dt);
      }
    }
  }

  clearSnowSlowly(dt) {
    if (this.state.climate === "snow") return;

    let hasSnow = false;

    for (const col of this.state.snowColumns) {
      if (col.h > 0) {
        col.h = Math.max(0, col.h - 0.18 * dt);
        hasSnow = true;
      }
    }

    if (!hasSnow) return;

    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(0, this.height);

    for (let i = 0; i < this.state.snowColumns.length; i++) {
      const x = i * this.SNOW_COL_W;
      const h = this.getSmoothedSnowHeight(i) * this.getEdgeFade(x);
      ctx.lineTo(x, this.height - h);
    }

    ctx.lineTo(this.width, this.height);
    ctx.closePath();

    ctx.fillStyle = "rgba(240, 250, 255, 0.78)";
    ctx.fill();
  }

  drawAutumnLeaf(p) {
    const ctx = this.ctx;
    const s = p.size;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, 0.9);

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
    for (const side of [-1, 1]) {
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

  drawPetalShape(p) {
    const ctx = this.ctx;
    const s = p.size;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(0.76, 1.25);

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

  drawBreezeParticle(p, dt) {
    const wind = this.getActiveWindVector();
    const gustPower = 0.32 + (this.state.windPower / 100) * 0.82;
    const swirl = Math.sin(p.phase * 1.7 + p.y * 0.008) * (0.42 + this.state.windPower * 0.018);

    p.phase += (0.018 + this.state.windPower * 0.00032) * dt;
    p.rot += p.rotSpeed * dt;
    p.x += (p.vx * gustPower + wind.x * 0.16 + swirl + Math.sin(p.phase) * p.sway * 0.36) * dt;
    p.y += (p.vy + Math.sin(p.phase * 0.82) * p.wave * 0.15 + wind.y * 0.1) * dt;

    if (p.y > this.height + 90 || p.y < -240 || p.x > this.width + 280 || p.x < -280) {
      Object.assign(p, this.makeBreezeParticle(p.type));
      p.x = Utils.rand(-260, -40);
      p.y = Utils.rand(-this.height * 0.2, this.height * 0.65);
    }

    if (p.type === "autumn") this.drawAutumnLeaf(p);
    if (p.type === "petal") this.drawPetalShape(p);
  }

  drawSunMote(p, dt) {
    const ctx = this.ctx;

    p.phase += 0.015 * dt;
    p.x += (p.vx + Math.sin(p.phase) * 0.12) * dt;
    p.y += (p.vy + Math.cos(p.phase) * 0.08) * dt;

    if (p.x < -20) p.x = this.width + 20;
    if (p.x > this.width + 20) p.x = -20;
    if (p.y < -20) p.y = this.height + 20;
    if (p.y > this.height + 20) p.y = -20;

    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
    glow.addColorStop(0, `rgba(255, 246, 196, ${p.alpha})`);
    glow.addColorStop(1, "rgba(255, 246, 196, 0)");

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
    ctx.fill();
  }

  drawStar(p, dt) {
    const ctx = this.ctx;

    p.phase += p.pulse * dt;
    const twinkle = 0.55 + Math.sin(p.phase) * 0.45;
    const alpha = p.alpha * Utils.clamp(twinkle, 0.25, 1);

    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * p.glow);
    glow.addColorStop(0, `rgba(255,255,255,${alpha})`);
    glow.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.glow, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawParticle(p, dt) {
    if (p.type === "rain") this.drawRain(p, dt);
    if (p.type === "snow") this.drawSnow(p, dt);
    if (p.type === "autumn" || p.type === "petal") this.drawBreezeParticle(p, dt);
    if (p.type === "mote") this.drawSunMote(p, dt);
    if (p.type === "star") this.drawStar(p, dt);
  }

  drawSunnyAtmosphere(time) {
    if (this.state.climate !== "sunny") return;

    const ctx = this.ctx;
    const sunX = this.width * 0.74;
    const sunY = this.height * 0.18;
    const sunR = Math.min(this.width, this.height) * 0.09;
    const pulse = Math.sin(time * 0.002) * 0.06 + 1;
    const intensity = this.state.intensity / 100;

    ctx.save();

    const skyGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(this.width, this.height) * 0.78);
    skyGlow.addColorStop(0, `rgba(255, 244, 189, ${0.38 + intensity * 0.24})`);
    skyGlow.addColorStop(0.38, `rgba(251, 191, 36, ${0.12 + intensity * 0.08})`);
    skyGlow.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = skyGlow;
    ctx.fillRect(0, 0, this.width, this.height);

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

  drawSnowAtmosphere(time) {
    if (this.state.climate !== "snow") return;

    const ctx = this.ctx;
    ctx.save();

    const haze = ctx.createLinearGradient(0, 0, 0, this.height);
    haze.addColorStop(0, "rgba(119, 154, 176, 0.10)");
    haze.addColorStop(0.42, "rgba(199, 222, 233, 0.08)");
    haze.addColorStop(1, "rgba(235, 247, 251, 0.18)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.globalAlpha = 0.10 + this.state.intensity * 0.0011;

    for (let i = 0; i < 6; i++) {
      const x = ((time * 0.012 * (i + 1) + i * 310) % (this.width + 580)) - 290;
      const y = this.height * (0.18 + i * 0.11) + Math.sin(time * 0.0018 + i) * 18;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, 280);
      grad.addColorStop(0, "rgba(210, 232, 242, 0.34)");
      grad.addColorStop(0.54, "rgba(173, 203, 219, 0.12)");
      grad.addColorStop(1, "rgba(210, 232, 242, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y, 330, 88, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawBreezeAtmosphere(time) {
    if (this.state.climate !== "petals" && this.state.climate !== "autumn") return;

    const ctx = this.ctx;
    const isPetals = this.state.climate === "petals";
    const grad = ctx.createLinearGradient(0, 0, this.width, this.height);

    if (isPetals) {
      grad.addColorStop(0, "rgba(76, 29, 149, 0.15)");
      grad.addColorStop(0.48, "rgba(190, 24, 93, 0.10)");
      grad.addColorStop(1, "rgba(251, 207, 232, 0.12)");
    } else {
      grad.addColorStop(0, "rgba(120, 53, 15, 0.13)");
      grad.addColorStop(0.48, "rgba(217, 119, 6, 0.08)");
      grad.addColorStop(1, "rgba(254, 215, 170, 0.10)");
    }

    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.globalAlpha = isPetals ? 0.15 : 0.11;
    ctx.strokeStyle = isPetals ? "rgba(255, 228, 230, 0.66)" : "rgba(255, 237, 213, 0.58)";
    ctx.lineWidth = 1.1;

    const windSpeed = 0.018 + (this.state.windPower / 100) * 0.036;

    for (let i = 0; i < 10; i++) {
      const baseY = 70 + i * 68 + Math.sin(time * 0.006 + i) * 22;
      const start = ((time * windSpeed + i * 170) % (this.width + 460)) - 460;

      ctx.beginPath();
      ctx.moveTo(start, baseY);
      ctx.bezierCurveTo(start + 130, baseY - 55, start + 260, baseY + 48, start + 460, baseY - 8);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawStormMist(time) {
    if (this.state.climate !== "storm") return;

    const ctx = this.ctx;
    const intensity = this.state.intensity / 100;

    ctx.save();
    ctx.globalAlpha = 0.06 + intensity * 0.12;

    for (let i = 0; i < 7; i++) {
      const x = ((time * 0.025 * (i + 1) + i * 260) % (this.width + 420)) - 210;
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

  drawStarryAtmosphere() {
    if (this.state.climate !== "starry") return;

    const ctx = this.ctx;
    const moonX = this.width * 0.76;
    const moonY = this.height * 0.18;
    const moonR = Math.min(this.width, this.height) * 0.07;

    ctx.save();

    const milky = ctx.createLinearGradient(0, 0, this.width, this.height);
    milky.addColorStop(0, "rgba(255,255,255,0)");
    milky.addColorStop(0.52, "rgba(169, 196, 255, 0.055)");
    milky.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = milky;
    ctx.fillRect(0, 0, this.width, this.height);

    const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 4.1);
    moonGlow.addColorStop(0, "rgba(226, 242, 255, 0.74)");
    moonGlow.addColorStop(0.28, "rgba(191, 219, 254, 0.26)");
    moonGlow.addColorStop(1, "rgba(191, 219, 254, 0)");
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 4.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(235, 245, 255, 0.98)";
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.beginPath();
    ctx.arc(moonX + moonR * 0.38, moonY - moonR * 0.12, moonR * 0.96, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(226, 242, 255, 0.16)";
    const craters = [
      [-0.28, -0.18, 0.045],
      [0.05, -0.31, 0.032],
      [-0.12, 0.22, 0.038],
      [0.26, 0.13, 0.028],
      [-0.36, 0.08, 0.024],
      [0.18, -0.05, 0.022],
    ];

    for (const [cx, cy, cr] of craters) {
      ctx.beginPath();
      ctx.arc(moonX + cx * moonR, moonY + cy * moonR, moonR * cr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  createLightning() {
    const rare = this.state.climate === "storm" && Utils.chance(this.RARE_STORM_LIGHTNING_CHANCE);
    const rareColor = true ? Utils.pick(["red", "violet"]) : null;
    const startX = Utils.rand(this.width * 0.12, this.width * 0.88);
    const segments = [];
    let x = startX;
    let y = 0;

    while (y < this.height * Utils.rand(0.35, 0.75)) {
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

    const palette = rareColor === "red"
      ? {
          glow: "rgba(255, 40, 80, 0.98)",
          outer: "rgba(255, 60, 96, ALPHA)",
          inner: "rgba(255, 215, 225, ALPHA)",
          flash: "rgba(255, 48, 96, 0.82)",
        }
      : rareColor === "violet"
        ? {
            glow: "rgba(190, 88, 255, 0.98)",
            outer: "rgba(190, 88, 255, ALPHA)",
            inner: "rgba(245, 220, 255, ALPHA)",
            flash: "rgba(177, 92, 255, 0.80)",
          }
        : {
            glow: "rgba(190, 225, 255, 0.95)",
            outer: "rgba(220, 245, 255, ALPHA)",
            inner: "rgba(255, 255, 255, ALPHA)",
            flash: "rgba(220, 238, 255, 0.95)",
          };

    this.state.bolts.push({
      life: rare ? 18 : 13,
      maxLife: rare ? 18 : 13,
      segments,
      palette,
      rare,
    });

    this.flash.style.transition = "none";
    this.flash.style.background = palette.flash;
    this.flash.style.opacity = rare ? "0.92" : "0.72";

    requestAnimationFrame(() => {
      this.flash.style.transition = "opacity 380ms ease-out";
      this.flash.style.opacity = "0";
    });
  }

  updateLightning(dt) {
    if (this.state.climate !== "storm") {
      this.state.bolts = [];
      return;
    }

    const ctx = this.ctx;
    this.state.lightningCooldown -= dt;

    const chance = this.state.intensity * 0.003;

    if (this.state.lightningCooldown <= 0 && Math.random() < chance) {
      this.createLightning();
      this.state.lightningCooldown = Utils.rand(40, 130);
    }

    for (let i = this.state.bolts.length - 1; i >= 0; i--) {
      const bolt = this.state.bolts[i];
      bolt.life -= dt;

      const alpha = Utils.clamp(bolt.life / bolt.maxLife, 0, 1);
      const outer = bolt.palette.outer.replace("ALPHA", alpha);
      const inner = bolt.palette.inner.replace("ALPHA", alpha);

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.shadowBlur = bolt.rare ? 34 : 24;
      ctx.shadowColor = bolt.palette.glow;
      ctx.strokeStyle = outer;
      ctx.lineWidth = bolt.rare ? 4.2 : 3.2;

      ctx.beginPath();
      for (const s of bolt.segments) {
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
      }
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = inner;
      ctx.lineWidth = bolt.rare ? 1.45 : 1.15;

      ctx.beginPath();
      for (const s of bolt.segments) {
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
      }
      ctx.stroke();
      ctx.restore();

      if (bolt.life <= 0) this.state.bolts.splice(i, 1);
    }
  }

  drawVignette() {
    const ctx = this.ctx;
    const isSnow = this.state.climate === "snow";
    const isStarry = this.state.climate === "starry";

    const grad = ctx.createRadialGradient(
      this.width / 2,
      this.height / 2,
      this.height * 0.1,
      this.width / 2,
      this.height / 2,
      Math.max(this.width, this.height) * 0.75,
    );

    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, isSnow ? "rgba(11, 24, 38, 0.28)" : isStarry ? "rgba(0,0,0,0.48)" : "rgba(0,0,0,0.32)");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawAtmosphere(time) {
    this.drawSunnyAtmosphere(time);
    this.drawSnowAtmosphere(time);
    this.drawStormMist(time);
    this.drawBreezeAtmosphere(time);
  }

  animate(timestamp) {
    requestAnimationFrame(time => this.animate(time));

    if (this.state.paused) {
      this.state.lastTime = timestamp;
      return;
    }

    const dt = Utils.clamp((timestamp - this.state.lastTime) / 16.666, 0.4, 2.2);
    this.state.lastTime = timestamp;

    this.ctx.clearRect(0, 0, this.width, this.height);

    this.ensureParticleCount();
    this.drawAtmosphere(timestamp);

    for (const particle of this.state.particles) {
      this.drawParticle(particle, dt);
    }

    this.drawStarryAtmosphere(timestamp);
    this.drawRainSplashes(dt);
    this.drawSnowAccumulation(dt);
    this.clearSnowSlowly(dt);
    this.updateLightning(dt);
    this.drawVignette();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.climateApp = new Climate();
});
