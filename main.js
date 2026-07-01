window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("climateCanvas");
  const flash = document.getElementById("flash");

  const ui = {
    climateSelect: document.getElementById("climateOptions"),
    intensityInput: document.getElementById("intensity"),
    windPowerInput: document.getElementById("windPower"),
    windPowerControl: document.getElementById("windPowerControl"),
    windDirectionInput: document.getElementById("windDirection"),
    windDirectionControl: document.getElementById("windDirectionControl"),
    intensityValue: document.getElementById("intensityValue"),
    windPowerValue: document.getElementById("windPowerValue"),
    windDirectionName: document.getElementById("windDirectionName"),
    badge: document.getElementById("badge"),
    controlBtn: document.getElementById("controlBtn"),
    controlBtnIcon: document.querySelector("#controlBtn .btn-icon"),
    controlBtnText: document.querySelector("#controlBtn .btn-text"),
  };

  const CLIMATE_LABELS = {
    sunny: "Sunny",
    rain: "Rain",
    storm: "Storm",
    snow: "Snow",
    autumn: "Autumn Breeze",
    petals: "Gale of Petals",
    sandstorm: "Sandstorm",
  };

  const BACKGROUNDS = {
    sunny: `
radial-gradient(circle at 18% 18%, rgba(255,255,255,0.36), transparent 22%),
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
radial-gradient(ellipse at 50% 105%, rgba(246, 252, 255, 0.56), transparent 42%),
radial-gradient(circle at 18% 18%, rgba(190, 218, 232, 0.18), transparent 31%),
radial-gradient(circle at 84% 14%, rgba(248, 252, 255, 0.13), transparent 28%),
linear-gradient(180deg, #162331 0%, #263848 42%, #657983 76%, #e8eef1 100%)
`,
    autumn: `
radial-gradient(circle at 75% 20%, rgba(255, 238, 186, 0.48), transparent 22%),
radial-gradient(circle at 35% 25%, rgba(251, 146, 60, 0.20), transparent 34%),
linear-gradient(180deg, #3b2d63, #c56a5a 52%, #f5c47a)
`,
    petals: `
radial-gradient(circle at 28% 15%, rgba(244, 114, 182, 0.14), transparent 25%),
radial-gradient(circle at 76% 12%, rgba(168, 85, 247, 0.12), transparent 30%),
linear-gradient(180deg, #0b1025 0%, #1d1538 52%, #2f1f4a 100%)
`,
    sandstorm: `
radial-gradient(circle at 73% 13%, rgba(255, 231, 173, 0.32), transparent 24%),
radial-gradient(circle at 18% 18%, rgba(146, 64, 14, 0.20), transparent 32%),
linear-gradient(180deg, #80522b 0%, #c48a47 48%, #d8a65c 75%, #8a5428 100%)
`,
  };

  const BODY_CLASSES = Object.keys(CLIMATE_LABELS);

  const app = new Climate({
    canvas,
    onFlash: ({ color, opacity, duration }) => {
      flash.style.transition = "none";
      flash.style.background = color;
      flash.style.opacity = String(opacity);

      requestAnimationFrame(() => {
        flash.style.transition = `opacity ${duration}ms ease-out`;
        flash.style.opacity = "0";
      });
    },
  });

  let activeClimate = ui.climateSelect.value;
  let rememberedWindPower = Number(ui.windPowerInput.value);
  let rememberedWindDirection = ui.windDirectionInput.value;

  function isWindPowerLocked(climate) {
    return climate === "sunny";
  }

  function getWindDirectionMode(climate) {
    if (climate === "sunny") return "none";
    if (climate === "snow") return "snowstorm";
    if (climate === "autumn" || climate === "petals") return "swirl";
    return "free";
  }

  function cacheCurrentWindControls() {
    if (!isWindPowerLocked(activeClimate)) {
      rememberedWindPower = Number(ui.windPowerInput.value);
    }

    const mode = getWindDirectionMode(activeClimate);
    if (mode === "free" && ui.windDirectionInput.value !== "swirl") {
      rememberedWindDirection = ui.windDirectionInput.value;
    }
  }

  function setBodyClimate(climate) {
    document.body.classList.remove(...BODY_CLASSES);
    document.body.classList.add(climate);
    document.body.style.background = BACKGROUNDS[climate];
  }

  function applyWindPowerRule(climate) {
    const locked = isWindPowerLocked(climate);

    ui.windPowerInput.disabled = locked;
    ui.windPowerControl.classList.toggle("is-disabled", locked);

    if (locked) {
      ui.windPowerInput.value = 0;
      app.setWindPower(0);
      ui.windPowerValue.textContent = "0%";
      ui.windPowerInput.title = "Sunny não usa vento.";
      return;
    }

    if (activeClimate === "sunny") {
      ui.windPowerInput.value = rememberedWindPower;
    }

    app.setWindPower(Number(ui.windPowerInput.value));
    ui.windPowerValue.textContent = `${ui.windPowerInput.value}%`;
    ui.windPowerInput.title = climate === "snow"
      ? "No Snow, Wind Power aumenta a velocidade dos flocos, sem mudar a direção."
      : "";
  }

  function applyWindDirectionRule(climate) {
    const mode = getWindDirectionMode(climate);
    const locked = mode !== "free";

    ui.windDirectionInput.disabled = locked;
    ui.windDirectionControl.classList.toggle("is-disabled", locked);

    if (mode === "none") {
      ui.windDirectionInput.value = rememberedWindDirection;
      ui.windDirectionName.textContent = "No wind";
      ui.windDirectionInput.title = "Sunny não usa direção de vento.";
      app.setWindDirection(rememberedWindDirection);
      return;
    }

    if (mode === "snowstorm") {
      ui.windDirectionInput.value = rememberedWindDirection;
      ui.windDirectionName.textContent = "Own snowstorm";
      ui.windDirectionInput.title = "Snow usa movimento próprio de nevasca.";
      app.setWindDirection(rememberedWindDirection);
      return;
    }

    if (mode === "swirl") {
      ui.windDirectionInput.value = "swirl";
      ui.windDirectionName.textContent = "Swirl auto";
      ui.windDirectionInput.title = "Swirl é bloqueado para seleção manual e aplicado apenas via código.";
      app.setWindDirection("swirl");
      return;
    }

    if (ui.windDirectionInput.value === "swirl") {
      ui.windDirectionInput.value = rememberedWindDirection;
    }

    ui.windDirectionName.textContent = Utils.formatLabel(ui.windDirectionInput.value);
    ui.windDirectionInput.title = "";
    app.setWindDirection(ui.windDirectionInput.value);
  }

  function updatePanelText(climate) {
    ui.intensityValue.textContent = `${ui.intensityInput.value}%`;
    ui.badge.textContent = CLIMATE_LABELS[climate].toUpperCase();
  }

  function applyScene(climate) {
    setBodyClimate(climate);
    applyWindPowerRule(climate);
    applyWindDirectionRule(climate);
    updatePanelText(climate);
  }

  function setClimate(climate) {
    cacheCurrentWindControls();
    app.setClimate(climate);
    applyScene(climate);
    activeClimate = climate;
  }

  function resize() {
    app.resize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio || 1, 2));
  }

  ui.climateSelect.addEventListener("change", () => {
    setClimate(ui.climateSelect.value);
  });

  ui.intensityInput.addEventListener("input", () => {
    app.setIntensity(ui.intensityInput.value);
    ui.intensityValue.textContent = `${ui.intensityInput.value}%`;
  });

  ui.windPowerInput.addEventListener("input", () => {
    if (isWindPowerLocked(activeClimate)) return;

    rememberedWindPower = Number(ui.windPowerInput.value);
    app.setWindPower(rememberedWindPower);
    ui.windPowerValue.textContent = `${rememberedWindPower}%`;
  });

  ui.windDirectionInput.addEventListener("change", () => {
    if (getWindDirectionMode(activeClimate) !== "free") return;

    if (ui.windDirectionInput.value === "swirl") {
      ui.windDirectionInput.value = rememberedWindDirection;
      return;
    }

    rememberedWindDirection = ui.windDirectionInput.value;
    app.setWindDirection(rememberedWindDirection);
    ui.windDirectionName.textContent = Utils.formatLabel(rememberedWindDirection);
  });

  ui.controlBtn.addEventListener("click", () => {
    const paused = app.togglePaused();
    ui.controlBtnText.textContent = paused ? "Resume" : "Pause";
    ui.controlBtnIcon.textContent = paused ? "▶" : "Ⅱ";
  });

  window.addEventListener("resize", resize);

  function loop(timestamp) {
    app.tick(timestamp);
    requestAnimationFrame(loop);
  }

  resize();
  app.setIntensity(ui.intensityInput.value);
  setClimate(activeClimate);
  requestAnimationFrame(loop);
});
