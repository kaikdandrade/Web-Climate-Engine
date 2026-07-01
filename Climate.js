// Controla todos os efeitos climáticos desenhados no canvas.
// A classe também contém os utilitários internos que antes ficavam em Utils.
class Climate {
  // Prepara o canvas, os limites e o estado inicial do sistema climático.
  constructor({ canvas, onFlash = null } = {}) {
    if (!canvas) throw new Error("Climate required canvas HTML reference.");

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
    this.RARE_STORM_LIGHTNING_CHANCE = 0.05; // 0.05% por raio criado.

    // Lista fechada de climas aceitos para evitar estados inválidos.
    this.validClimates = new Set([
      "sunny",
      "rain",
      "storm",
      "snow",
      "autumn",
      "petals",
      "sandstorm",
    ]);

    // Estado mutável usado pelo loop de animação.
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
      nextTumbleweed: 120,
    };
  }

  // Troca o clima atual e reinicia partículas/efeitos temporários.
  setClimate(climate) {
    if (!this.validClimates.has(climate)) return;

    this.state.climate = climate;
    this.state.bolts = [];
    this.state.splashes = [];
    this.state.lightningCooldown = climate === "storm" ? 120 : 9999;
    this.state.nextTumbleweed = Climate.rand(35, 130);
    this.resetParticles();
  }

  setIntensity(value) {
    this.state.intensity = Climate.clamp(Number(value), 1, 100);
  }

  setWindPower(value) {
    this.state.windPower = Climate.clamp(Number(value), 0, 100);
  }

  setWindDirection(value) {
    if (
      ["right", "left", "diagonal_right", "diagonal_left", "swirl"].includes(
        value,
      )
    ) {
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

  // Ajusta o canvas ao tamanho real da tela respeitando o DPR do dispositivo.
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

  // Cria colunas independentes para controlar o acúmulo suave de neve no chão.
  createSnowColumns() {
    const count = Math.ceil(this.width / this.SNOW_COL_W) + 3;
    this.state.snowColumns = Array.from({ length: count }, (_, index) => ({
      h: 0,
      meltDelay: Climate.rand(210, 470),
      sparkleSeed: (index * 17) % 31,
    }));
  }

  // Recria as partículas do clima ativo para preencher a cena corretamente.
  resetParticles() {
    this.state.particles = [];
    this.state.splashes = [];

    const target = this.getParticleTarget();
    for (let i = 0; i < target; i++) {
      const particle = this.makeParticle();
      particle.y = Climate.rand(0, this.height);
      this.state.particles.push(particle);
    }
  }

  // Define a quantidade base de partículas por clima e intensidade.
  getParticleTarget() {
    const intensity = this.state.intensity;

    if (this.state.climate === "rain") return Math.floor(intensity * 5);
    if (this.state.climate === "storm")
      return Math.floor(Climate.mapRange(intensity, 1, 100, 45, 980));
    if (this.state.climate === "snow")
      return Math.floor(Climate.mapRange(intensity, 1, 100, 115, 470));
    if (this.state.climate === "autumn")
      return Math.floor(Climate.mapRange(intensity, 1, 100, 45, 190));
    if (this.state.climate === "petals")
      return Math.floor(Climate.mapRange(intensity, 1, 100, 70, 270));
    if (this.state.climate === "sandstorm")
      return Math.floor(Climate.mapRange(intensity, 1, 100, 160, 620));

    return Math.floor(35 + intensity * 1.15);
  }

  // Mantém a quantidade de partículas compatível com a intensidade atual.
  ensureParticleCount() {
    const target = this.getParticleTarget();
    let regularCount = this.state.particles.filter(
      (particle) => particle.type !== "tumbleweed",
    ).length;

    while (regularCount < target) {
      this.state.particles.push(this.makeParticle());
      regularCount++;
    }

    if (regularCount > target) {
      for (
        let i = this.state.particles.length - 1;
        i >= 0 && regularCount > target;
        i--
      ) {
        if (this.state.particles[i].type !== "tumbleweed") {
          this.state.particles.splice(i, 1);
          regularCount--;
        }
      }
    }
  }

  // Cria a partícula correta conforme o clima selecionado.
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

  // Calcula o vetor de vento usado pelo clima atual.
  getActiveWindVector() {
    if (this.state.climate === "sunny" || this.state.climate === "snow") {
      return { x: 0, y: 0, swirl: false };
    }

    if (this.state.climate === "autumn" || this.state.climate === "petals") {
      return Climate.getWindVector("swirl", this.state.windPower);
    }

    return Climate.getWindVector(this.state.windDirection, this.state.windPower);
  }

  getHorizontalDirection() {
    return this.state.windDirection === "left" ||
      this.state.windDirection === "diagonal_left"
      ? -1
      : 1;
  }

  // Loop de atualização/desenho; a pausa impede qualquer avanço visual no canvas.
  tick(timestamp) {
    if (!this.state.lastTime) this.state.lastTime = timestamp;

    if (this.state.paused) {
      this.state.lastTime = timestamp;
      return;
    }

    const dt = Climate.clamp(
      (timestamp - this.state.lastTime) / 16.666,
      0.35,
      2.15,
    );
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

  // Gera uma gota de chuva comum ou de tempestade.
  makeRainDrop(storm = false) {
    const startVy = storm ? Climate.rand(10, 17) : Climate.rand(6, 11);

    return {
      type: "rain",
      x: Climate.rand(-this.width * 0.2, this.width * 1.2),
      y: Climate.rand(-this.height * 0.75, -12),
      baseVx: Climate.rand(-0.55, 0.55),
      startVy,
      vy: startVy,
      gravity: storm ? Climate.rand(0.48, 0.74) : Climate.rand(0.28, 0.46),
      baseLen: storm ? Climate.rand(17, 24) : Climate.rand(11, 17),
      maxLen: storm ? Climate.rand(46, 68) : Climate.rand(28, 42),
      w: storm ? Climate.rand(1.15, 2.2) : Climate.rand(0.72, 1.35),
      alpha: storm ? Climate.rand(0.48, 0.88) : Climate.rand(0.28, 0.58),
    };
  }

  createRainSplash(x, y, horizontalSpeed, storm) {
    const count = storm ? 5 : 3;

    for (let i = 0; i < count; i++) {
      if (this.state.splashes.length > this.MAX_SPLASHES)
        this.state.splashes.shift();

      const side = i % 2 === 0 ? 1 : -1;
      const spread = Climate.rand(1.1, storm ? 3.8 : 2.4);

      this.state.splashes.push({
        x: x + Climate.rand(-2, 2),
        y: y - Climate.rand(1, 4),
        vx: horizontalSpeed * 0.08 + side * spread,
        vy: -Climate.rand(1.4, storm ? 4.4 : 3.0),
        len: Climate.rand(2.5, storm ? 7 : 4.8),
        life: storm ? Climate.rand(16, 25) : Climate.rand(12, 20),
        maxLife: storm ? 25 : 20,
        alpha: storm ? Climate.rand(0.32, 0.68) : Climate.rand(0.22, 0.5),
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

      const alpha =
        Climate.clamp(splash.life / splash.maxLife, 0, 1) * splash.alpha;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(205, 235, 255, 0.92)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(splash.x, splash.y);
      ctx.lineTo(
        splash.x - splash.vx * 0.8,
        splash.y - splash.vy * 0.45 - splash.len,
      );
      ctx.stroke();
      ctx.restore();

      if (splash.life <= 0 || splash.y > this.height + 10) {
        this.state.splashes.splice(i, 1);
      }
    }
  }

  // Rain está preservado: gota acelera, estica e respinga no impacto.
  drawRain(p, dt) {
    const ctx = this.ctx;
    const wind = this.getActiveWindVector();
    const storm = this.state.climate === "storm";
    const windFactor = storm ? 1.35 : 0.82;
    const horizontalSpeed = p.baseVx + wind.x * windFactor;

    p.vy += p.gravity * dt;
    p.x += horizontalSpeed * dt;
    p.y += (p.vy + wind.y * 0.06) * dt;

    const stretch = Climate.clamp((p.vy - p.startVy) / (storm ? 18 : 13), 0, 1);
    const len = p.baseLen + (p.maxLen - p.baseLen) * stretch;
    const tailX = horizontalSpeed * (storm ? 2.0 : 1.55);

    const groundY = this.height - 13;
    if (p.y >= groundY || p.x > this.width + 150 || p.x < -150) {
      if (p.y >= groundY)
        this.createRainSplash(p.x, groundY, horizontalSpeed, storm);
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

  // Gera um floco com variações de tamanho, rotação e profundidade.
  makeSnowFlake() {
    const depth = Climate.rand(0.58, 1.26);

    return {
      type: "snow",
      x: Climate.rand(-90, this.width + 90),
      y: Climate.rand(-this.height * 0.85, -16),
      vx: Climate.rand(-0.5, 0.5) * depth,
      vy: Climate.rand(0.76, 1.95) * depth + this.state.intensity * 0.004,
      r: Climate.rand(2.4, 6.4) * depth,
      alpha: Climate.rand(0.5, 0.95),
      phase: Climate.rand(0, Math.PI * 2),
      wave: Climate.rand(0.8, 3.4) * depth,
      jitter: Climate.rand(0.45, 2.1),
      seed: Climate.rand(0, 1000),
      depth,
      rot: Climate.rand(0, Math.PI * 2),
      rotSpeed: Climate.rand(-0.018, 0.018),
    };
  }

  getMaxSnowHeight() {
    return Math.min(56, this.height * 0.14);
  }

  isInsideSnowAccumulationArea(x) {
    return (
      x > this.SNOW_EDGE_PADDING && x < this.width - this.SNOW_EDGE_PADDING
    );
  }

  getEdgeFade(x) {
    if (!this.isInsideSnowAccumulationArea(x)) return 0;

    const left = x - this.SNOW_EDGE_PADDING;
    const right = this.width - this.SNOW_EDGE_PADDING - x;
    return Climate.clamp(Math.min(left, right) / 90, 0, 1);
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
      ctx.lineTo(
        bx + Math.cos(a + Math.PI * 0.72) * p.r * 0.24,
        by + Math.sin(a + Math.PI * 0.72) * p.r * 0.24,
      );
      ctx.moveTo(bx, by);
      ctx.lineTo(
        bx + Math.cos(a - Math.PI * 0.72) * p.r * 0.24,
        by + Math.sin(a - Math.PI * 0.72) * p.r * 0.24,
      );
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.72, p.r * 0.14), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Atualiza e desenha um floco, acumulando neve quando toca o chão.
  drawSnow(p, dt) {
    const speedBoost = 0.7 + (this.state.windPower / 100) * 1.45;

    p.phase += (0.02 + p.depth * 0.012) * dt * speedBoost;
    p.rot += p.rotSpeed * dt * speedBoost;

    const turbulence =
      Math.sin(p.phase * 1.18 + p.seed) * p.wave * 0.24 +
      Math.sin(p.phase * 2.7 + p.y * 0.012) * p.jitter * 0.18;
    const whiteoutPush = Math.sin(this.elapsed * 0.00055 + p.seed) * 0.34;

    p.x += (p.vx + turbulence + whiteoutPush) * dt;
    p.y += (p.vy * speedBoost + Math.cos(p.phase * 1.35) * 0.15) * dt;

    const columnIndex = Climate.clamp(
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
        this.state.snowColumns[columnIndex].h = Climate.clamp(
          this.state.snowColumns[columnIndex].h + add,
          0,
          this.getMaxSnowHeight(),
        );
        this.state.snowColumns[columnIndex].meltDelay = Climate.rand(210, 470);
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
    ctx.save();
    ctx.shadowColor = "rgba(255, 255, 255, 0.34)";
    ctx.shadowBlur = 16;

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

    const snowGrad = ctx.createLinearGradient(
      0,
      this.height - 92,
      0,
      this.height,
    );
    snowGrad.addColorStop(0, "rgba(255,255,255,1)");
    snowGrad.addColorStop(0.52, "rgba(232,247,255,0.99)");
    snowGrad.addColorStop(1, "rgba(184,219,235,0.98)");

    ctx.fillStyle = snowGrad;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < this.state.snowColumns.length; i++) {
      const x = i * this.SNOW_COL_W;
      const h = this.getSmoothedSnowHeight(i) * this.getEdgeFade(x);
      const soft = Math.sin(i * 0.42) * 1.05;
      if (i === 0) ctx.moveTo(x, this.height - h - soft);
      else ctx.lineTo(x, this.height - h - soft);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.48)";
    for (let i = 4; i < this.state.snowColumns.length; i += 8) {
      const x = i * this.SNOW_COL_W;
      const h = this.getSmoothedSnowHeight(i) * this.getEdgeFade(x);

      if (h > 5) {
        const r = 0.95 + (this.state.snowColumns[i].sparkleSeed % 9) * 0.12;
        ctx.beginPath();
        ctx.arc(x, this.height - h - 1.8, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

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

  // Partículas compartilhadas por Autumn e Petals; o desenho muda pelo tipo.
  makeBreezeParticle(kind) {
    const autumnColors = [
      "#7c2d12",
      "#9a3412",
      "#b45309",
      "#c2410c",
      "#d97706",
      "#ea580c",
      "#f97316",
      "#f59e0b",
      "#facc15",
      "#854d0e",
      "#991b1b",
      "#b91c1c",
      "#78350f",
      "#a16207",
      "#ca8a04",
    ];

    const petalColors = [
      "#fecdd3",
      "#f9a8d4",
      "#f0abfc",
      "#e9d5ff",
      "#fb7185",
      "#f43f5e",
      "#f472b6",
      "#ec4899",
      "#e11d48",
      "#be185d",
      "#9d174d",
      "#7e22ce",
      "#4f46e5",
      "#6366f1",
      "#3b82f6",
      "#facc15",
      "#f97316",
      "#f87171",
      "#ea580c",
      "#d97706",
    ];

    const isPetal = kind === "petal";

    return {
      type: kind,
      x: Climate.rand(-260, this.width * 0.24),
      y: isPetal
        ? Climate.rand(-this.height * 0.5, this.height * 0.45)
        : Climate.rand(-this.height * 0.12, this.height * 1.02),
      vx: isPetal ? Climate.rand(2.2, 6.2) : Climate.rand(2.35, 5.9),
      vy: isPetal ? Climate.rand(-0.3, 2.4) : Climate.rand(-0.28, 0.72),
      size: isPetal ? Climate.rand(7, 17) : Climate.rand(13, 25),
      rot: Climate.rand(0, Math.PI * 2),
      rotSpeed: isPetal ? Climate.rand(-0.13, 0.13) : Climate.rand(-0.11, 0.11),
      sway: isPetal ? Climate.rand(1.1, 2.8) : Climate.rand(1.2, 3.2),
      phase: Climate.rand(0, Math.PI * 2),
      wave: isPetal ? Climate.rand(2.2, 6.5) : Climate.rand(1.8, 4.8),
      alpha: isPetal ? Climate.rand(0.62, 0.96) : Climate.rand(0.72, 0.98),
      color: isPetal ? Climate.pick(petalColors) : Climate.pick(autumnColors),
    };
  }

  drawBreezeParticle(p, dt) {
    const isAutumn = p.type === "autumn";
    const gustPower = isAutumn ? 1.62 : 1.6;
    const swirl =
      Math.sin(p.phase * 2.1 + p.y * 0.006) * (isAutumn ? 5.4 : 6.8);

    p.phase += (isAutumn ? 0.043 : 0.045) * dt;
    p.rot += p.rotSpeed * dt;
    p.x += (p.vx * gustPower + swirl) * dt;

    if (isAutumn) {
      // Autumn deve ocupar a tela toda, mas com vendaval mais horizontal.
      p.y +=
        (p.vy +
          Math.sin(p.phase) * p.wave * 0.16 +
          Math.cos(p.phase * 0.72) * 0.22) *
        dt;
    } else {
      p.y += (p.vy + Math.sin(p.phase) * p.wave * 0.22) * dt;
    }

    if (
      p.y > this.height + 95 ||
      p.y < -230 ||
      p.x > this.width + 270 ||
      p.x < -270
    ) {
      Object.assign(p, this.makeBreezeParticle(p.type));
      p.x = Climate.rand(-260, -40);
      p.y =
        p.type === "petal"
          ? Climate.rand(-this.height * 0.18, this.height * 0.65)
          : Climate.rand(-this.height * 0.08, this.height * 1.02);
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
    ctx.bezierCurveTo(
      -s * 0.28,
      s * 0.55,
      -s * 1.05,
      s * 0.48,
      -s * 0.75,
      s * 0.04,
    );
    ctx.bezierCurveTo(
      -s * 1.23,
      -s * 0.12,
      -s * 0.82,
      -s * 0.48,
      -s * 0.48,
      -s * 0.4,
    );
    ctx.bezierCurveTo(
      -s * 0.76,
      -s * 0.92,
      -s * 0.28,
      -s * 0.97,
      -s * 0.12,
      -s * 0.66,
    );
    ctx.bezierCurveTo(
      -s * 0.02,
      -s * 1.25,
      s * 0.02,
      -s * 1.25,
      s * 0.12,
      -s * 0.66,
    );
    ctx.bezierCurveTo(
      s * 0.28,
      -s * 0.97,
      s * 0.76,
      -s * 0.92,
      s * 0.48,
      -s * 0.4,
    );
    ctx.bezierCurveTo(
      s * 0.82,
      -s * 0.48,
      s * 1.23,
      -s * 0.12,
      s * 0.75,
      s * 0.04,
    );
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

  // Cria pequenos pontos de luz para reforçar o clima ensolarado.
  makeSunMote() {
    return {
      type: "mote",
      x: Climate.rand(0, this.width),
      y: Climate.rand(0, this.height),
      r: Climate.rand(0.8, 2.4),
      vx: Climate.rand(-0.2, 0.45),
      vy: Climate.rand(-0.25, 0.1),
      alpha: Climate.rand(0.18, 0.55),
      phase: Climate.rand(0, Math.PI * 2),
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

  // Cria partículas alongadas de areia seguindo a direção do vento.
  makeSandGrain() {
    const direction = this.getHorizontalDirection();
    const y = Climate.rand(this.height * 0.06, this.height * 0.96);
    const depth = Climate.rand(0.55, 1.35);

    return {
      type: "sand",
      x:
        direction > 0
          ? Climate.rand(-260, this.width * 0.18)
          : Climate.rand(this.width * 0.82, this.width + 260),
      y,
      vx: direction * Climate.rand(5.8, 13.2) * depth,
      vy: Climate.rand(-0.18, 0.62) * depth,
      len: Climate.rand(18, 74) * depth,
      alpha: Climate.rand(0.1, 0.42),
      w: Climate.rand(0.7, 1.8) * depth,
      phase: Climate.rand(0, Math.PI * 2),
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

  // Gera um arbusto rolante usado apenas na tempestade de areia.
  makeTumbleweed() {
    const direction = this.getHorizontalDirection();
    const radius = Climate.rand(15, 30);

    return {
      type: "tumbleweed",
      x: direction > 0 ? -radius - 40 : this.width + radius + 40,
      y: Climate.rand(this.height * 0.68, this.height - 68),
      r: radius,
      vx: direction * Climate.rand(2.6, 4.8),
      vy: Climate.rand(-0.18, 0.26),
      rot: Climate.rand(0, Math.PI * 2),
      rotSpeed: direction * Climate.rand(0.08, 0.18),
      life: Climate.rand(420, 820),
      seed: Climate.rand(0, 1000),
    };
  }

  spawnTumbleweeds(dt) {
    if (this.state.climate !== "sandstorm") return;

    this.state.nextTumbleweed -= dt;
    const existing = this.state.particles.filter(
      (p) => p.type === "tumbleweed",
    ).length;

    if (this.state.nextTumbleweed <= 0 && existing < this.MAX_TUMBLEWEEDS) {
      this.state.particles.push(this.makeTumbleweed());
      this.state.nextTumbleweed =
        Climate.rand(90, 260) - this.state.intensity * 0.75;
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

    const offscreen =
      direction > 0 ? p.x > this.width + p.r + 120 : p.x < -p.r - 120;
    if (p.life <= 0 || offscreen) {
      Object.assign(p, this.makeSandGrain());
    }
  }

  // Encaminha cada partícula para o desenhador específico do seu tipo.
  drawParticle(p, dt) {
    if (p.type === "rain") this.drawRain(p, dt);
    else if (p.type === "snow") this.drawSnow(p, dt);
    else if (p.type === "autumn" || p.type === "petal")
      this.drawBreezeParticle(p, dt);
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
    const pulse = 1 + Math.sin(time * 0.002) * 0.035;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const skyGlow = ctx.createRadialGradient(
      sunX,
      sunY,
      0,
      sunX,
      sunY,
      Math.max(this.width, this.height) * 0.72,
    );
    skyGlow.addColorStop(0, `rgba(255, 246, 196, ${0.3 + intensity * 0.18})`);
    skyGlow.addColorStop(
      0.36,
      `rgba(251, 191, 36, ${0.08 + intensity * 0.06})`,
    );
    skyGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = skyGlow;
    ctx.fillRect(0, 0, this.width, this.height);

    // Aura suave ao redor do sol, parecida com brilho de lente sem criar feixe forte.
    const sunGlow = ctx.createRadialGradient(
      sunX,
      sunY,
      0,
      sunX,
      sunY,
      sunR * 3.28,
    );
    sunGlow.addColorStop(0, "rgba(255, 255, 230, 1)");
    sunGlow.addColorStop(0.28, "rgba(255, 224, 102, 0.96)");
    sunGlow.addColorStop(0.58, "rgba(251, 191, 36, 0.36)");
    sunGlow.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 3.28, 0, Math.PI * 2);
    ctx.fill();

    // Traços finos ao redor do sol, como no desenho de referência enviado.
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(Math.sin(time * 0.0008) * 0.035);
    ctx.strokeStyle = `rgba(255, 238, 140, ${0.3 + intensity * 0.18})`;
    ctx.lineWidth = 1.55;
    ctx.lineCap = "round";

    const rayCount = 28;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i * Math.PI * 2) / rayCount;
      const inner = sunR * (1.22 + (i % 2) * 0.08);
      const outer = sunR * (2.15 + (i % 3) * 0.22) * pulse;

      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255, 247, 205, 0.98)";
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 0.94, 0, Math.PI * 2);
    ctx.fill();

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
      const y =
        this.height * (0.22 + i * 0.2) + Math.sin(time * 0.0012 + i) * 18;
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
    if (this.state.climate !== "petals" && this.state.climate !== "autumn")
      return;

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
    ctx.globalAlpha = isPetals ? 0.2 : 0.16;
    ctx.strokeStyle = isPetals
      ? "rgba(255, 228, 230, 0.75)"
      : "rgba(255, 237, 213, 0.66)";
    ctx.lineWidth = 1.2;

    const windSpeed = 0.08 + (this.state.windPower / 100) * 0.11;

    for (let i = 0; i < 13; i++) {
      const baseY = 70 + i * 62 + Math.sin(time * 0.012 + i) * 26;
      const start = ((time * windSpeed + i * 145) % (this.width + 420)) - 420;
      ctx.beginPath();
      ctx.moveTo(start, baseY);
      ctx.bezierCurveTo(
        start + 130,
        baseY - 55,
        start + 260,
        baseY + 48,
        start + 460,
        baseY - 8,
      );
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

  // Atmosfera da Sandstorm sem redemoinhos: apenas poeira horizontal e véu de areia.
  drawSandstormAtmosphere(time) {
    if (this.state.climate !== "sandstorm") return;

    const ctx = this.ctx;
    const direction = this.getHorizontalDirection();
    const power = this.state.intensity / 100;

    ctx.save();
    const dusty = ctx.createLinearGradient(0, 0, 0, this.height);
    dusty.addColorStop(0, `rgba(179, 119, 54, ${0.1 + power * 0.08})`);
    dusty.addColorStop(0.42, `rgba(222, 166, 91, ${0.16 + power * 0.13})`);
    dusty.addColorStop(1, `rgba(122, 76, 35, ${0.22 + power * 0.18})`);
    ctx.fillStyle = dusty;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.globalAlpha = 0.16 + power * 0.16;
    ctx.strokeStyle = "rgba(255, 224, 159, 0.62)";
    ctx.lineWidth = 1.4;

    for (let i = 0; i < 16; i++) {
      const y = 55 + i * 45 + Math.sin(time * 0.006 + i) * 18;
      const start =
        direction > 0
          ? ((time * (0.12 + power * 0.12) + i * 120) % (this.width + 520)) -
            520
          : this.width -
            ((time * (0.12 + power * 0.12) + i * 120) % (this.width + 520)) +
            120;

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

    ctx.restore();
  }

  // Desenha camadas atmosféricas de fundo antes das partículas principais.
  drawAtmosphere(time) {
    this.drawSunnyAtmosphere(time);
    this.drawSnowAtmosphere(time);
    this.drawStormMist(time);
    this.drawBreezeAtmosphere(time);
    this.drawSandstormAtmosphere(time);
  }

  // Monta o caminho ramificado do raio e dispara o flash externo, se existir.
  createLightning() {
    const rare = Climate.chance(this.RARE_STORM_LIGHTNING_CHANCE);
    const rareColor = rare ? Climate.pick(["red", "violet"]) : null;
    const startX = Climate.rand(this.width * 0.12, this.width * 0.88);
    const endY = this.height + Climate.rand(20, 160);
    const segments = [];
    let x = startX;
    let y = 0;

    while (y < endY) {
      const nextX = Climate.clamp(x + Climate.rand(-42, 42), -60, this.width + 60);
      const nextY = Math.min(endY, y + Climate.rand(34, 76));
      segments.push({ x1: x, y1: y, x2: nextX, y2: nextY });

      if (Climate.chance(0.22) && nextY < this.height * 0.9) {
        segments.push({
          x1: nextX,
          y1: nextY,
          x2: nextX + Climate.rand(-120, 120),
          y2: nextY + Climate.rand(32, 120),
        });
      }

      x = nextX;
      y = nextY;
    }

    const palette =
      rareColor === "red"
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

  // Controla chance, duração e desenho dos raios durante tempestades.
  updateLightning(dt) {
    if (this.state.climate !== "storm") {
      this.state.bolts = [];
      return;
    }

    const ctx = this.ctx;
    const power = this.state.intensity / 100;
    this.state.lightningCooldown -= dt;

    const lightningChance = Math.pow(power, 3.25) * 0.033;
    if (
      power > 0.055 &&
      this.state.lightningCooldown <= 0 &&
      Climate.chance(lightningChance)
    ) {
      this.createLightning();
      this.state.lightningCooldown = Climate.rand(
        Climate.lerp(260, 20, power),
        Climate.lerp(520, 72, power),
      );
    }

    for (let i = this.state.bolts.length - 1; i >= 0; i--) {
      const bolt = this.state.bolts[i];
      bolt.life -= dt;

      const alpha = Climate.clamp(bolt.life / bolt.maxLife, 0, 1);
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

  // Escurece suavemente as bordas para dar profundidade ao clima atual.
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

  // Métodos estáticos incorporados da antiga classe Utils.
  // Utilitários internos: números aleatórios, interpolação e cálculos auxiliares.
  static rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  // Retorna um inteiro aleatório dentro do intervalo informado.
  static randInt(min, max) {
    return Math.floor(Climate.rand(min, max + 1));
  }

  // Testa uma probabilidade entre 0 e 1.
  static chance(probability) {
    return Math.random() < probability;
  }

  // Sorteia um item de uma lista.
  static pick(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  // Limita um valor entre mínimo e máximo.
  static clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // Interpola suavemente entre dois valores.
  static lerp(a, b, t) {
    return a + (b - a) * Climate.clamp(t, 0, 1);
  }

  // Converte um valor de uma escala para outra.
  static mapRange(value, inMin, inMax, outMin, outMax) {
    if (inMax === inMin) return outMin;
    const t = (value - inMin) / (inMax - inMin);
    return Climate.lerp(outMin, outMax, t);
  }

  // Formata textos técnicos para exibição em labels.
  static formatLabel(value) {
    return String(value || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  // Traduz direção e força do vento em um vetor usado pelas partículas.
  static getWindVector(windDirection, windPower) {
    const p = Climate.clamp(windPower, 0, 100) / 100;

    const vectors = {
      right: { x: 7 * p, y: 0, swirl: false },
      left: { x: -7 * p, y: 0, swirl: false },
      diagonal_right: { x: 6 * p, y: 2.2 * p, swirl: false },
      diagonal_left: { x: -6 * p, y: 2.2 * p, swirl: false },
      swirl: { x: 4.5 * p, y: 0, swirl: true },
    };

    return vectors[windDirection] || { x: 0, y: 0, swirl: false };
  }

  // Faz um valor circular dentro de um intervalo, útil para reposicionamentos.
  static wrap(value, min, max) {
    const size = max - min;
    return ((((value - min) % size) + size) % size) + min;
  }
}
