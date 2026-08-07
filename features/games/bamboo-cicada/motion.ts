export type MotionPermissionState = "checking" | "unknown" | "requesting" | "enabled" | "denied" | "unsupported";

export type MotionVector = {
  x: number | null;
  y: number | null;
  z: number | null;
};

export type MotionReading = {
  rotationRate?: {
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
  } | null;
  acceleration?: MotionVector | null;
  accelerationIncludingGravity?: MotionVector | null;
};

export type MotionSignal = {
  intensity: number;
  direction: -1 | 1;
  timestamp: number;
};

type PermissionAwareDeviceMotionEvent = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const finite = (value: number | null | undefined) => Number.isFinite(value) ? Number(value) : 0;

function magnitude(vector?: MotionVector | null) {
  if (!vector) return 0;
  return Math.hypot(finite(vector.x), finite(vector.y), finite(vector.z));
}

function strongestSigned(values: number[]) {
  return values.reduce((strongest, value) => Math.abs(value) > Math.abs(strongest) ? value : strongest, 0);
}

/** 将不同手机的旋转率和加速度归一到稳定的 0–1 甩动力度。 */
export function normalizeMotionReading(reading: MotionReading): Omit<MotionSignal, "timestamp"> {
  const rotation = reading.rotationRate;
  const rotationValues = [finite(rotation?.alpha), finite(rotation?.beta), finite(rotation?.gamma)];
  const rotationMagnitude = Math.hypot(...rotationValues);

  const directAcceleration = magnitude(reading.acceleration);
  const gravityAcceleration = magnitude(reading.accelerationIncludingGravity);
  const accelerationMagnitude = directAcceleration > 0.01
    ? directAcceleration
    : Math.abs(gravityAcceleration - 9.81);

  const rotationStrength = clamp01((rotationMagnitude - 18) / 230);
  const accelerationStrength = clamp01((accelerationMagnitude - 0.8) / 15.2);
  const rawStrength = Math.max(rotationStrength, accelerationStrength * 0.86);
  const intensity = rawStrength <= 0.035 ? 0 : rawStrength * rawStrength * (3 - 2 * rawStrength);

  let signedAxis = strongestSigned(rotationValues);
  if (Math.abs(signedAxis) < 5) {
    const acceleration = reading.acceleration ?? reading.accelerationIncludingGravity;
    signedAxis = strongestSigned([finite(acceleration?.x), finite(acceleration?.y)]);
  }

  return {
    intensity,
    direction: signedAxis < 0 ? -1 : 1,
  };
}

export function supportsDeviceMotion() {
  return typeof window !== "undefined" && typeof window.DeviceMotionEvent !== "undefined";
}

export class BambooMotionInput {
  private listening = false;
  private readonly onSignal: (signal: MotionSignal) => void;

  constructor(onSignal: (signal: MotionSignal) => void) {
    this.onSignal = onSignal;
  }

  async enable(): Promise<MotionPermissionState> {
    if (!supportsDeviceMotion()) return "unsupported";

    const MotionEvent = window.DeviceMotionEvent as PermissionAwareDeviceMotionEvent;
    if (typeof MotionEvent.requestPermission === "function") {
      try {
        const permission = await MotionEvent.requestPermission();
        if (permission !== "granted") return "denied";
      } catch {
        return "denied";
      }
    }

    if (!this.listening) {
      window.addEventListener("devicemotion", this.handleMotion, { passive: true });
      this.listening = true;
    }
    return "enabled";
  }

  disable() {
    if (!this.listening) return;
    window.removeEventListener("devicemotion", this.handleMotion);
    this.listening = false;
  }

  destroy() {
    this.disable();
  }

  private handleMotion = (event: DeviceMotionEvent) => {
    const signal = normalizeMotionReading(event);
    this.onSignal({ ...signal, timestamp: performance.now() });
  };
}
