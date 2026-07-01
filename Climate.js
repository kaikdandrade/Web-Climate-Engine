class Climate {
  constructor({ canvas, onFlash = null } = {}) {
    if (!canvas) throw new Error("Climate precisa receber um canvas.");

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onFlash = typeof onFlash === "function" ? onFlash : null;

    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.elapsed = 0;

    this.SNOW_COL_W = 12;
    this.SNOW_EDGE_PADDING = 18;
    this.MAX_SPLASHES = 260;
    this.MAX_TUMBLEWEEDS = 5;
    this.RARE_STORM_LIGHTNING_CHANCE = 0.04; // 0.04% por raio criado.

    this.validClimates = new Set([
      "sunny",
      "rain",
      "storm",
      "snow",
      "autumn",
      "petals",
      "sandstorm",
    ]);

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
      lightningCooldown: 90,
      nextTumbleweed: 120,
    };
  }

  setClimate(climate) {
    if (!this.validClimates.has(climate)) return;

    this.state.climate = climate;
    this.state.bolts = [];
    this.state.splashes = [];
    this.state.lightningCooldown = climate === "storm" ? 120 : 9999;
    this.state.nextTumbleweed = Utils.rand(35, 130);
    this.resetParticles();
  }

  setIntensity(value) {
    this.state.intensity = Utils.clamp(Number(value), 1, 100);
  }

  setWindPower(value) {
    this.state.windPower = Utils.clamp(Number(value), 0, 100);
  }

  setWindDirection(value) {
    if (["right", "left", "diagonal_right", "diagonal_left", "swirl"].includes(value)) {
      this.state.windDirection = value;
    }
  }

  setPaused(paused) {
    this.state.paused = Boolean(paused);
  }

  togglePaused() {
    this.setPaused(!this.state.paused);
    return this.state.paused;
  }

  resize(width, height, dpr = 1) {
    this.width = Math.max(1, Number(width));
    this.height = Math.max(1, Number(height));
    this.dpr = Math.min(Math.max(Number(dpr) || 1, 1), 2);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.createSnowColumns();
    this.resetParticles();
  }

  createSnowColumns() {
    const count = Math.ceil(this.width / this.SNOW_COL_W) + 3;
    this.state.snowColumns = Array.from({ length: count }, (_, index) => ({
      h: 0,
      meltDelay: Utils.rand(210, 470),
      sparkleSeed: (index * 17) % 31,
    }));
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

  getParticleTarget() {
    const intensity = this.state.intensity;

    if (this.state.climate === "rain") return Math.floor(intensity * 5);
    if (this.state.climate === "storm") return Math.floor(Utils.mapRange(intensity, 1, 100, 45, 980));
    if (this.state.climate === "snow") return Math.floor(Utils.mapRange(intensity, 1, 100, 75, 285));
    if (this.state.climate === "autumn") return Math.floor(Utils.mapRange(intensity, 1, 100, 45, 190));
    if (this.state.climate === "petals") return Math.floor(Utils.mapRange(intensity, 1, 100, 70, 270));
    if (this.state.climate === "sandstorm") return Math.floor(Utils.mapRange(intensity, 1, 100, 160, 620));

    return Math.floor(35 + intensity * 1.15);
  }

  ensureParticleCount() {
    const target = this.getParticleTarget();
    let regularCount = this.state.particles.filter(particle => particle.type !== "tumbleweed").length;

    while (regularCount < target) {
      this.state.particles.push(this.makeParticle());
      regularCount++;
    }

    if (regularCount > target) {
      for (let i = this.state.particles.length - 1; i >= 0 && regularCount > target; i--) {
        if (this.state.particles[i].type !== "tumbleweed") {
          this.state.particles.splice(i, 1);
          regularCount--;
        }
      }
    }
  }

  makeParticle() {
    switch (this.state.climate) {
      case "rain":
        return this.makeRainDrop(false);
      case "storm":
        return this.makeRainDrop(true);
      case "snow":
        return this.makeSnowFlake();
      case "autumn":
        return this.makeBreezeParticle("autumn");
      case "petals":
        return this.makeBreezeParticle("petal");
      case "sandstorm":
        return this.makeSandGrain();
      case "sunny":
      default:
        return this.makeSunMote();
    }
  }

  getActiveWindVector() {
    if (this.state.climate === "sunny" || this.state.climate === "snow") {
      return { x: 0, y: 0, swirl: false };
    }

    if (this.state.climate === "autumn" || this.state.climate === "petals") {
      return Utils.getWindVector("swirl", this.state.windPower);
    }

    return Utils.getWindVector(this.state.windDirection, this.state.windPower);
  }

  getHorizontalDirection() {
    return this.state.windDirection === "left" || this.state.windDirection === "diagonal_left" ? -1 : 1;
  }

  tick(timestamp) {
    if (!this.state.lastTime) this.state.lastTime = timestamp;

    if (this.state.paused) {
      this.state.lastTime = timestamp;
      return;
    }

    const dt = Utils.clamp((timestamp - this.state.lastTime) / 16.666, 0.35, 2.15);
    this.state.lastTime = timestamp;
    this.elapsed = timestamp;

    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ensureParticleCount();
    this.drawAtmosphere(timestamp);

    for (const particle of this.state.particles) {
      this.drawParticle(particle, dt);
    }

    this.spawnTumbleweeds(dt);
    this.drawRainSplashes(dt);
    this.drawSnowAccumulation(dt);
    this.clearSnowSlowly(dt);
    this.updateLightning(dt);
    this.drawVignette();
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
      const splash = this.state.splashes[i];

      splash.life -= dt;
      splash.vy += 0.22 * dt;
      splash.x += splash.vx * dt;
      splash.y += splash.vy * dt;

      const alpha = Utils.clamp(splash.life / splash.maxLife, 0, 1) * splash.alpha;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(205, 235, 255, 0.92)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(splash.x, splash.y);
      ctx.lineTo(splash.x - splash.vx * 0.8, splash.y - splash.vy * 0.45 - splash.len);
      ctx.stroke();
      ctx.restore();

      if (splash.life <= 0 || splash.y > this.height + 10) {
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

  makeSnowFlake() {
    const depth = Utils.rand(0.58, 1.26);

    return {
      type: "snow",
      x: Utils.rand(-90, this.width + 90),
      y: Utils.rand(-this.height * 0.85, -16),
      vx: Utils.rand(-0.5, 0.5) * depth,
      vy: Utils.rand(0.76, 1.95) * depth + this.state.intensity * 0.004,
      r: Utils.rand(2.4, 6.4) * depth,
      alpha: Utils.rand(0.5, 0.95),
      phase: Utils.rand(0, Math.PI * 2),
      wave: Utils.rand(0.8, 3.4) * depth,
      jitter: Utils.rand(0.45, 2.1),
      seed: Utils.rand(0, 1000),
      depth,
      rot: Utils.rand(0, Math.PI * 2),
      rotSpeed: Utils.rand(-0.018, 0.018),
    };
  }

  getMaxSnowHeight() {
    return Math.min(56, this.height * 0.14);
  }

  isInsideSnowAccumulationArea(x) {
    return x > this.SNOW_EDGE_PADDING && x < this.width - this.SNOW_EDGE_PADDING;
  }

  getEdgeFade(x) {
    if (!this.isInsideSnowAccumulationArea(x)) return 0;

    const left = x - this.SNOW_EDGE_PADDING;
    const right = this.width - this.SNOW_EDGE_PADDING - x;
    return Utils.clamp(Math.min(left, right) / 90, 0, 1);
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

  drawSnowFlakeShape(p) {
    const ctx = this.ctx;

    if (p.r < 3.6 || p.depth < 0.74) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = "rgba(248, 253, 255, 0.95)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.1, p.r * 0.48), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.96)";
    ctx.lineWidth = Math.max(0.62, p.r * 0.11);

    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const r1 = p.r;
      const r2 = p.r * 0.54;
      const bx = Math.cos(a) * r2;
      const by = Math.sin(a) * r2;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a + Math.PI * 0.72) * p.r * 0.24, by + Math.sin(a + Math.PI * 0.72) * p.r * 0.24);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a - Math.PI * 0.72) * p.r * 0.24, by + Math.sin(a - Math.PI * 0.72) * p.r * 0.24);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.72, p.r * 0.14), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawSnow(p, dt) {
    const speedBoost = 0.7 + (this.state.windPower / 100) * 1.45;

    p.phase += (0.02 + p.depth * 0.012) * dt * speedBoost;
    p.rot += p.rotSpeed * dt * speedBoost;

    const turbulence =
      Math.sin(p.phase * 1.18 + p.seed) * p.wave * 0.24 +
      Math.sin(p.phase * 2.7 + p.y * 0.012) * p.jitter * 0.18;
    const whiteoutPush = Math.sin((this.elapsed * 0.00055) + p.seed) * 0.34;

    p.x += (p.vx + turbulence + whiteoutPush) * dt;
    p.y += (p.vy * speedBoost + Math.cos(p.phase * 1.35) * 0.15) * dt;

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
        const add = p.r * 0.18 * this.getEdgeFade(p.x);
        this.state.snowColumns[columnIndex].h = Utils.clamp(
          this.state.snowColumns[columnIndex].h + add,
          0,
          this.getMaxSnowHeight(),
        );
        this.state.snowColumns[columnIndex].meltDelay = Utils.rand(210, 470);
      }

      Object.assign(p, this.makeSnowFlake());
      return;
    }

    if (p.x > this.width + 120 || p.x < -120 || p.y > this.height + 90) {
      Object.assign(p, this.makeSnowFlake());
      return;
    }

    this.drawSnowFlakeShape(p);
  }

  drawSnowAccumulation(dt) {
    if (this.state.climate !== "snow") return;

    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(0, this.height);

    for (let i = 0; i < this.state.snowColumns.length; i++) {
      const x = i * this.SNOW_COL_W;
      const h = this.getSmoothedSnowHeight(i) * this.getEdgeFade(x);
      const soft = Math.sin(i * 0.42) * 1.05;
      ctx.lineTo(x, this.height - h - soft);
    }

    ctx.lineTo(this.width, this.height);
    ctx.closePath();

    const snowGrad = ctx.createLinearGradient(0, this.height - 86, 0, this.height);
    snowGrad.addColorStop(0, "rgba(255,255,255,0.99)");
    snowGrad.addColorStop(0.54, "rgba(235,247,251,0.97)");
    snowGrad.addColorStop(1, "rgba(198,224,235,0.93)");

    ctx.fillStyle = snowGrad;
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.32)";
    for (let i = 4; i < this.state.snowColumns.length; i += 9) {
      const x = i * this.SNOW_COL_W;
      const h = this.getSmoothedSnowHeight(i) * this.getEdgeFade(x);

      if (h > 6) {
        const r = 0.85 + (this.state.snowColumns[i].sparkleSeed % 9) * 0.11;
        ctx.beginPath();
        ctx.arc(x, this.height - h - 1.4, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const col of this.state.snowColumns) {
      col.meltDelay -= dt;
      if (col.meltDelay <= 0) {
        col.h = Math.max(0, col.h - 0.035 * dt);
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

  makeBreezeParticle(kind) {
    const autumnColors = [
      "#d97706", "#f59e0b", "#b45309", "#dc2626", "#92400e",
      "#f97316", "#7c2d12", "#b91c1c", "#f87171", "#facc15",
    ];

    const petalColors = [
      "#fecdd3", "#f9a8d4", "#f0abfc", "#e9d5ff", "#fb7185",
      "#f43f5e", "#f472b6", "#ec4899", "#e11d48", "#be185d",
      "#9d174d", "#7e22ce", "#4f46e5", "#6366f1", "#3b82f6",
      "#facc15", "#f97316", "#f87171",
    ];

    return {
      type: kind,
      x: Utils.rand(-230, this.width * 0.28),
      y: kind === "petal" ? Utils.rand(-this.height * 0.5, this.height * 0.45) : Utils.rand(-this.height * 0.35, -20),
      vx: kind === "petal" ? Utils.rand(2.2, 6.2) : Utils.rand(0.8, 3.4),
      vy: kind === "petal" ? Utils.rand(-0.3, 2.4) : Utils.rand(1.1, 3.2),
      size: kind === "petal" ? Utils.rand(7, 17) : Utils.rand(13, 25),
      rot: Utils.rand(0, Math.PI * 2),
      rotSpeed: kind === "petal" ? Utils.rand(-0.13, 0.13) : Utils.rand(-0.08, 0.08),
      sway: Utils.rand(0.8, 2.4),
      phase: Utils.rand(0, Math.PI * 2),
      wave: kind === "petal" ? Utils.rand(2.2, 6.5) : Utils.rand(0.8, 2.4),
      alpha: kind === "petal" ? Utils.rand(0.62, 0.96) : Utils.rand(0.68, 0.96),
      color: kind === "petal" ? Utils.pick(petalColors) : Utils.pick(autumnColors),
    };
  }

  drawBreezeParticle(p, dt) {
    const wind = Utils.getWindVector("swirl", this.state.windPower);
    const gustPower = 1.15 + this.state.windPower / 48;
    const swirl = Math.sin(p.phase * 2.1 + p.y * 0.006) * (3.1 + this.state.windPower * 0.072);

    p.phase += (0.038 + this.state.windPower * 0.00016) * dt;
    p.rot += p.rotSpeed * dt;
    p.x += (p.vx * gustPower + wind.x * 0.72 + swirl) * dt;
    p.y += (p.vy + Math.sin(p.phase) * p.wave * 0.22 + wind.y * 0.25) * dt;

    if (p.y > this.height + 95 || p.y < -230 || p.x > this.width + 270 || p.x < -270) {
      Object.assign(p, this.makeBreezeParticle(p.type));
      p.x = Utils.rand(-240, -40);
      p.y = p.type === "petal" ? Utils.rand(-this.height * 0.18, this.height * 0.65) : Utils.rand(-190, -20);
    }

    if (p.type === "autumn") this.drawAutumnLeaf(p);
    if (p.type === "petal") this.drawPetalShape(p);
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
    ctx.shadowBlur = 9;
    ctx.shadowColor = "rgba(251, 146, 60, 0.24)";

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

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 237, 213, 0.58)";
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
    ctx.shadowBlur = 14;
    ctx.shadowColor = "rgba(244, 114, 182, 0.45)";

    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.92, -s * 0.46, s * 0.72, s * 0.72, 0, s);
    ctx.bezierCurveTo(-s * 0.72, s * 0.72, -s * 0.92, -s * 0.46, 0, -s);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.38)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.6);
    ctx.quadraticCurveTo(s * 0.18, 0, 0, s * 0.72);
    ctx.stroke();
    ctx.restore();
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

  makeSandGrain() {
    const direction = this.getHorizontalDirection();
    const y = Utils.rand(this.height * 0.06, this.height * 0.96);
    const depth = Utils.rand(0.55, 1.35);

    return {
      type: "sand",
      x: direction > 0 ? Utils.rand(-260, this.width * 0.18) : Utils.rand(this.width * 0.82, this.width + 260),
      y,
      vx: direction * Utils.rand(5.8, 13.2) * depth,
      vy: Utils.rand(-0.18, 0.62) * depth,
      len: Utils.rand(18, 74) * depth,
      alpha: Utils.rand(0.10, 0.42),
      w: Utils.rand(0.7, 1.8) * depth,
      phase: Utils.rand(0, Math.PI * 2),
      depth,
    };
  }

  drawSandGrain(p, dt) {
    const ctx = this.ctx;
    const wind = this.getActiveWindVector();
    const direction = this.getHorizontalDirection();
    const force = 0.8 + this.state.windPower / 95 + this.state.intensity / 170;

    p.phase += 0.018 * dt;
    p.x += (p.vx * force + wind.x * 0.45) * dt;
    p.y += (p.vy + Math.sin(p.phase + p.x * 0.004) * 0.38 + wind.y * 0.12) * dt;

    const offscreen = direction > 0 ? p.x > this.width + 260 : p.x < -260;
    if (offscreen || p.y < -70 || p.y > this.height + 80) {
      Object.assign(p, this.makeSandGrain());
      return;
    }

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(246, 205, 137, 0.88)";
    ctx.lineWidth = p.w;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - direction * p.len, p.y - Math.sin(p.phase) * 5);
    ctx.stroke();
    ctx.restore();
  }

  makeTumbleweed() {
    const direction = this.getHorizontalDirection();
    const radius = Utils.rand(15, 30);

    return {
      type: "tumbleweed",
      x: direction > 0 ? -radius - 40 : this.width + radius + 40,
      y: Utils.rand(this.height * 0.68, this.height - 68),
      r: radius,
      vx: direction * Utils.rand(2.6, 4.8),
      vy: Utils.rand(-0.18, 0.26),
      rot: Utils.rand(0, Math.PI * 2),
      rotSpeed: direction * Utils.rand(0.08, 0.18),
      life: Utils.rand(420, 820),
      seed: Utils.rand(0, 1000),
    };
  }

  spawnTumbleweeds(dt) {
    if (this.state.climate !== "sandstorm") return;

    this.state.nextTumbleweed -= dt;
    const existing = this.state.particles.filter(p => p.type === "tumbleweed").length;

    if (this.state.nextTumbleweed <= 0 && existing < this.MAX_TUMBLEWEEDS) {
      this.state.particles.push(this.makeTumbleweed());
      this.state.nextTumbleweed = Utils.rand(90, 260) - this.state.intensity * 0.75;
    }
  }

  drawTumbleweed(p, dt) {
    const ctx = this.ctx;
    const direction = this.getHorizontalDirection();
    const force = 0.9 + this.state.windPower / 140 + this.state.intensity / 230;

    p.life -= dt;
    p.rot += p.rotSpeed * dt * force;
    p.x += p.vx * force * dt;
    p.y += (p.vy + Math.sin(this.elapsed * 0.004 + p.seed) * 0.12) * dt;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = "rgba(91, 57, 27, 0.78)";
    ctx.lineWidth = Math.max(1.2, p.r * 0.07);
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const b = a + Math.sin(p.seed + i) * 0.72;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * p.r * 0.22, Math.sin(a) * p.r * 0.22);
      ctx.quadraticCurveTo(
        Math.cos(b) * p.r * 0.72,
        Math.sin(b) * p.r * 0.72,
        Math.cos(a + 0.42) * p.r,
        Math.sin(a + 0.42) * p.r,
      );
      ctx.stroke();
    }

    ctx.restore();

    const offscreen = direction > 0 ? p.x > this.width + p.r + 120 : p.x < -p.r - 120;
    if (p.life <= 0 || offscreen) {
      Object.assign(p, this.makeSandGrain());
    }
  }

  drawParticle(p, dt) {
    if (p.type === "rain") this.drawRain(p, dt);
    else if (p.type === "snow") this.drawSnow(p, dt);
    else if (p.type === "autumn" || p.type === "petal") this.drawBreezeParticle(p, dt);
    else if (p.type === "mote") this.drawSunMote(p, dt);
    else if (p.type === "sand") this.drawSandGrain(p, dt);
    else if (p.type === "tumbleweed") this.drawTumbleweed(p, dt);
  }

  drawSunnyAtmosphere(time) {
    if (this.state.climate !== "sunny") return;

    const ctx = this.ctx;
    const sunX = this.width * 0.74;
    const sunY = this.height * 0.18;
    const sunR = Math.min(this.width, this.height) * 0.092;
    const intensity = this.state.intensity / 100;
    const pulse = Math.sin(time * 0.002) * 0.04 + 1;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const skyGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(this.width, this.height) * 0.8);
    skyGlow.addColorStop(0, `rgba(255, 246, 196, ${0.32 + intensity * 0.22})`);
    skyGlow.addColorStop(0.38, `rgba(251, 191, 36, ${0.10 + intensity * 0.08})`);
    skyGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = skyGlow;
    ctx.fillRect(0, 0, this.width, this.height);

    for (let i = 0; i < 7; i++) {
      const angle = -0.58 + i * 0.055 + Math.sin(time * 0.0009 + i) * 0.018;
      const length = Math.max(this.width, this.height) * (0.72 + i * 0.035);
      const endX = sunX - Math.cos(angle) * length;
      const endY = sunY - Math.sin(angle) * length;
      const ray = ctx.createLinearGradient(sunX, sunY, endX, endY);
      ray.addColorStop(0, `rgba(255, 248, 205, ${0.18 + intensity * 0.16})`);
      ray.addColorStop(0.5, `rgba(255, 229, 138, ${0.035 + intensity * 0.035})`);
      ray.addColorStop(1, "rgba(255, 248, 205, 0)");

      ctx.strokeStyle = ray;
      ctx.lineWidth = 18 + i * 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sunX, sunY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    const rayCount = 24;
    ctx.translate(sunX, sunY);
    ctx.rotate(time * 0.00016);
    for (let i = 0; i < rayCount; i++) {
      const a = (i * Math.PI * 2) / rayCount;
      const inner = sunR * 1.13;
      const outer = sunR * (2.25 + Math.sin(time * 0.002 + i) * 0.22) * pulse;
      ctx.strokeStyle = `rgba(255, 244, 189, ${0.10 + intensity * 0.2})`;
      ctx.lineWidth = 2.15;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
      ctx.stroke();
    }

    const sunGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, sunR * 3.05);
    sunGlow.addColorStop(0, "rgba(255, 255, 230, 1)");
    sunGlow.addColorStop(0.28, "rgba(255, 224, 102, 0.96)");
    sunGlow.addColorStop(0.6, "rgba(251, 191, 36, 0.32)");
    sunGlow.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(0, 0, sunR * 3.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 247, 205, 0.98)";
    ctx.beginPath();
    ctx.arc(0, 0, sunR * 0.94, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    this.drawLensArtifacts(sunX, sunY, intensity);
  }

  drawLensArtifacts(sunX, sunY, intensity) {
    const ctx = this.ctx;
    const targetX = this.width * 0.28;
    const targetY = this.height * 0.68;
    const artifacts = [
      [0.22, 12, 0.22],
      [0.38, 22, 0.14],
      [0.56, 9, 0.18],
      [0.72, 34, 0.08],
      [0.86, 15, 0.12],
    ];

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const [t, radius, alpha] of artifacts) {
      const x = Utils.lerp(sunX, targetX, t);
      const y = Utils.lerp(sunY, targetY, t);
      const r = radius * (1 + intensity * 0.6);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(255, 247, 205, ${alpha + intensity * 0.08})`);
      grad.addColorStop(0.45, `rgba(125, 211, 252, ${(alpha * 0.44) + intensity * 0.03})`);
      grad.addColorStop(1, "rgba(255, 247, 205, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawSnowAtmosphere(time) {
    if (this.state.climate !== "snow") return;

    const ctx = this.ctx;
    ctx.save();

    const haze = ctx.createLinearGradient(0, 0, 0, this.height);
    haze.addColorStop(0, "rgba(115, 143, 160, 0.10)");
    haze.addColorStop(0.5, "rgba(190, 212, 223, 0.07)");
    haze.addColorStop(1, "rgba(235, 247, 251, 0.15)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.globalAlpha = 0.08 + this.state.intensity * 0.00055;
    for (let i = 0; i < 3; i++) {
      const x = ((time * 0.006 * (i + 1) + i * 380) % (this.width + 760)) - 380;
      const y = this.height * (0.22 + i * 0.2) + Math.sin(time * 0.0012 + i) * 18;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 260);
      grad.addColorStop(0, "rgba(210, 232, 242, 0.28)");
      grad.addColorStop(0.52, "rgba(173, 203, 219, 0.10)");
      grad.addColorStop(1, "rgba(210, 232, 242, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y, 350, 82, 0, 0, Math.PI * 2);
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
      grad.addColorStop(0, "rgba(76, 29, 149, 0.18)");
      grad.addColorStop(0.48, "rgba(190, 24, 93, 0.13)");
      grad.addColorStop(1, "rgba(251, 207, 232, 0.15)");
    } else {
      grad.addColorStop(0, "rgba(120, 53, 15, 0.15)");
      grad.addColorStop(0.48, "rgba(217, 119, 6, 0.10)");
      grad.addColorStop(1, "rgba(254, 215, 170, 0.13)");
    }

    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalAlpha = isPetals ? 0.20 : 0.16;
    ctx.strokeStyle = isPetals ? "rgba(255, 228, 230, 0.75)" : "rgba(255, 237, 213, 0.66)";
    ctx.lineWidth = 1.2;

    const windSpeed = 0.08 + (this.state.windPower / 100) * 0.11;

    for (let i = 0; i < 13; i++) {
      const baseY = 70 + i * 62 + Math.sin(time * 0.012 + i) * 26;
      const start = ((time * windSpeed + i * 145) % (this.width + 420)) - 420;
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
    const power = this.state.intensity / 100;

    ctx.save();
    ctx.globalAlpha = 0.035 + power * 0.12;

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

  drawSandstormAtmosphere(time) {
    if (this.state.climate !== "sandstorm") return;

    const ctx = this.ctx;
    const direction = this.getHorizontalDirection();
    const power = this.state.intensity / 100;

    ctx.save();
    const dusty = ctx.createLinearGradient(0, 0, 0, this.height);
    dusty.addColorStop(0, `rgba(179, 119, 54, ${0.10 + power * 0.08})`);
    dusty.addColorStop(0.42, `rgba(222, 166, 91, ${0.16 + power * 0.13})`);
    dusty.addColorStop(1, `rgba(122, 76, 35, ${0.22 + power * 0.18})`);
    ctx.fillStyle = dusty;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.globalAlpha = 0.16 + power * 0.16;
    ctx.strokeStyle = "rgba(255, 224, 159, 0.62)";
    ctx.lineWidth = 1.4;

    for (let i = 0; i < 16; i++) {
      const y = 55 + i * 45 + Math.sin(time * 0.006 + i) * 18;
      const start = direction > 0
        ? ((time * (0.12 + power * 0.12) + i * 120) % (this.width + 520)) - 520
        : this.width - ((time * (0.12 + power * 0.12) + i * 120) % (this.width + 520)) + 120;

      ctx.beginPath();
      ctx.moveTo(start, y);
      ctx.bezierCurveTo(
        start + direction * 160,
        y - 35,
        start + direction * 330,
        y + 42,
        start + direction * 560,
        y - 5,
      );
      ctx.stroke();
    }

    ctx.globalAlpha = 0.12 + power * 0.11;
    ctx.strokeStyle = "rgba(116, 74, 36, 0.72)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const cx = Utils.wrap(time * (0.025 + i * 0.01) * direction + i * this.width * 0.34, -180, this.width + 180);
      const cy = this.height * (0.54 + i * 0.1);
      const h = 150 + i * 24;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.25) {
        const r = 9 + a * 5.2;
        const x = cx + Math.cos(a + time * 0.006) * r;
        const y = cy - h * (a / (Math.PI * 5)) + Math.sin(a) * 7;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  drawAtmosphere(time) {
    this.drawSunnyAtmosphere(time);
    this.drawSnowAtmosphere(time);
    this.drawStormMist(time);
    this.drawBreezeAtmosphere(time);
    this.drawSandstormAtmosphere(time);
  }

  createLightning() {
    const rare = Utils.chance(this.RARE_STORM_LIGHTNING_CHANCE);
    const rareColor = rare ? Utils.pick(["red", "violet"]) : null;
    const startX = Utils.rand(this.width * 0.12, this.width * 0.88);
    const endY = this.height + Utils.rand(20, 160);
    const segments = [];
    let x = startX;
    let y = 0;

    while (y < endY) {
      const nextX = Utils.clamp(x + Utils.rand(-42, 42), -60, this.width + 60);
      const nextY = Math.min(endY, y + Utils.rand(34, 76));
      segments.push({ x1: x, y1: y, x2: nextX, y2: nextY });

      if (Utils.chance(0.22) && nextY < this.height * 0.9) {
        segments.push({
          x1: nextX,
          y1: nextY,
          x2: nextX + Utils.rand(-120, 120),
          y2: nextY + Utils.rand(32, 120),
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
          flash: "rgba(255, 48, 96, 0.84)",
        }
      : rareColor === "violet"
        ? {
            glow: "rgba(190, 88, 255, 0.98)",
            outer: "rgba(190, 88, 255, ALPHA)",
            inner: "rgba(245, 220, 255, ALPHA)",
            flash: "rgba(177, 92, 255, 0.82)",
          }
        : {
            glow: "rgba(190, 225, 255, 0.95)",
            outer: "rgba(220, 245, 255, ALPHA)",
            inner: "rgba(255, 255, 255, ALPHA)",
            flash: "rgba(220, 238, 255, 0.95)",
          };

    this.state.bolts.push({
      life: rare ? 19 : 14,
      maxLife: rare ? 19 : 14,
      segments,
      palette,
      rare,
    });

    if (this.onFlash) {
      this.onFlash({
        color: palette.flash,
        opacity: rare ? 0.94 : 0.68,
        duration: rare ? 450 : 360,
      });
    }
  }

  updateLightning(dt) {
    if (this.state.climate !== "storm") {
      this.state.bolts = [];
      return;
    }

    const ctx = this.ctx;
    const power = this.state.intensity / 100;
    this.state.lightningCooldown -= dt;

    const lightningChance = Math.pow(power, 3.25) * 0.04;
    if (power > 0.055 && this.state.lightningCooldown <= 0 && Utils.chance(lightningChance)) {
      this.createLightning();
      this.state.lightningCooldown = Utils.rand(
        Utils.lerp(260, 20, power),
        Utils.lerp(520, 72, power),
      );
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
      ctx.lineWidth = bolt.rare ? 4.4 : 3.4;
      ctx.beginPath();
      for (const s of bolt.segments) {
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
      }
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = inner;
      ctx.lineWidth = bolt.rare ? 1.5 : 1.15;
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
    const climate = this.state.climate;
    const grad = ctx.createRadialGradient(
      this.width / 2,
      this.height / 2,
      this.height * 0.1,
      this.width / 2,
      this.height / 2,
      Math.max(this.width, this.height) * 0.75,
    );

    let edge = "rgba(0,0,0,0.32)";
    if (climate === "snow") edge = "rgba(8, 20, 32, 0.31)";
    if (climate === "storm") edge = "rgba(0,0,0,0.46)";
    if (climate === "sandstorm") edge = "rgba(79, 45, 18, 0.42)";

    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, edge);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
  }
}
