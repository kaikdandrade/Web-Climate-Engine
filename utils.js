class Utils {
  static HandleString(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).replace("_", " ");
  }

  static rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  static clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  static getWindVector(windDirection, windPower) {
    const p = windPower / 100;
    if (windDirection === "right") return { x: 7 * p, y: 0 };
    if (windDirection === "left") return { x: -7 * p, y: 0 };
    if (windDirection === "diagonal_right") return { x: 6 * p, y: 2.2 * p };
    if (windDirection === "diagonal_left") return { x: -6 * p, y: 2.2 * p };
    if (windDirection === "swirl") return { x: 4.5 * p, y: 0, swirl: true };
    return { x: 0, y: 0 };
  }
}
