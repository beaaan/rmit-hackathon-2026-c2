// Synthetic water-treatment plant. Nothing here talks to real equipment.

export const ACTIONS = {
  shutdown_pumps: "Shut down pumps",
  restart_pumps: "Restart pumps",
  close_inlet_valve: "Close inlet valve",
};

const NORMAL_KPA = 420;
const STOPPED_KPA = 150;
const SPIKE_RATE_KPA = 20;
const MAX_KPA = 760;
const HISTORY = 120;

export const ALARM_KPA = 600;
export const TRIP_KPA = 700;

function defaultLines() {
  return [
    { id: "L1", name: "Line 1 · Intake" },
    { id: "L2", name: "Line 2 · Filtration" },
    { id: "L3", name: "Line 3 · Distribution" },
  ];
}

export class Plant {
  constructor({ random = Math.random, now = () => new Date() } = {}) {
    this.random = random;
    this.now = now;
    this.lines = new Map(
      defaultLines().map((line) => [
        line.id,
        { ...line, pumps: "running", inletValve: "open", pressureKpa: NORMAL_KPA, spiking: false, history: [] },
      ]),
    );
    // Start with a minute of calm history, one reading a second, ending now.
    const start = this.now().getTime() - 60_000;
    for (let i = 0; i < 60; i++) this.tick(new Date(start + i * 1000));
  }

  hasLine(id) {
    return this.lines.has(id);
  }

  tick(time = this.now()) {
    const at = time.toISOString();
    for (const line of this.lines.values()) {
      const noise = (this.random() - 0.5) * 8;
      let target = NORMAL_KPA;
      if (line.pumps === "stopped" || line.inletValve === "closed") target = STOPPED_KPA;

      if (line.spiking && target === NORMAL_KPA) {
        line.pressureKpa = Math.min(MAX_KPA, line.pressureKpa + SPIKE_RATE_KPA + noise);
      } else {
        // Ease towards the target pressure.
        line.pressureKpa += (target - line.pressureKpa) * 0.15 + noise;
      }
      line.pressureKpa = Math.round(line.pressureKpa * 10) / 10;
      line.history.push({ at, kpa: line.pressureKpa });
      if (line.history.length > HISTORY) line.history.shift();
    }
  }

  startSpike(lineId) {
    this.lines.get(lineId).spiking = true;
  }

  reset() {
    for (const line of this.lines.values()) {
      Object.assign(line, { pumps: "running", inletValve: "open", spiking: false });
    }
  }

  /** Applies an approved command. Only the controller's approval logic calls this. */
  apply(action, lineId) {
    const line = this.lines.get(lineId);
    switch (action) {
      case "shutdown_pumps":
        line.pumps = "stopped";
        line.spiking = false;
        break;
      case "restart_pumps":
        line.pumps = "running";
        break;
      case "close_inlet_valve":
        line.inletValve = "closed";
        line.spiking = false;
        break;
      default:
        throw new Error(`Unknown action ${action}`);
    }
  }

  status(line) {
    if (line.pressureKpa >= TRIP_KPA) return "trip";
    if (line.pressureKpa >= ALARM_KPA) return "alarm";
    return "normal";
  }

  state() {
    return {
      at: this.now().toISOString(),
      thresholds: { alarmKpa: ALARM_KPA, tripKpa: TRIP_KPA },
      lines: [...this.lines.values()].map(({ spiking, ...line }) => ({
        ...line,
        status: this.status(line),
        history: [...line.history],
      })),
    };
  }
}
