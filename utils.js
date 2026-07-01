class Utils {
  static rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  static randInt(min, max) {
    return Math.floor(Utils.rand(min, max + 1));
  }

  static chance(probability) {
    return Math.random() < probability;
  }

  static pick(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  static clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  static lerp(a, b, t) {
    return a + (b - a) * Utils.clamp(t, 0, 1);
  }

  static mapRange(value, inMin, inMax, outMin, outMax) {
    if (inMax === inMin) return outMin;
    const t = (value - inMin) / (inMax - inMin);
    return Utils.lerp(outMin, outMax, t);
  }

  static formatLabel(value) {
    return String(value || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  static getWindVector(windDirection, windPower) {
    const p = Utils.clamp(windPower, 0, 100) / 100;

    const vectors = {
      right: { x: 7 * p, y: 0, swirl: false },
      left: { x: -7 * p, y: 0, swirl: false },
      diagonal_right: { x: 6 * p, y: 2.2 * p, swirl: false },
      diagonal_left: { x: -6 * p, y: 2.2 * p, swirl: false },
      swirl: { x: 4.5 * p, y: 0, swirl: true },
    };

    return vectors[windDirection] || { x: 0, y: 0, swirl: false };
  }

  static wrap(value, min, max) {
    const size = max - min;
    return ((((value - min) % size) + size) % size) + min;
  }
}
