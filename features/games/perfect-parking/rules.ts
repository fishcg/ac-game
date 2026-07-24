export type ParkingEvaluation = {
  parked: boolean;
  crashed: boolean;
  quality: number;
  centerOffset: number;
};

export function evaluateParking(carCenter: number, carLength: number, bayStart: number, bayWidth: number, speed: number): ParkingEvaluation {
  const carLeft = carCenter - carLength / 2;
  const carRight = carCenter + carLength / 2;
  const bayEnd = bayStart + bayWidth;
  const targetCenter = bayStart + bayWidth / 2;
  const tolerance = Math.max(1, (bayWidth - carLength) / 2);
  const centerOffset = Math.abs(carCenter - targetCenter);
  const inside = carLeft >= bayStart && carRight <= bayEnd;
  const quality = inside ? Math.max(0, 1 - centerOffset / tolerance) : 0;
  return {
    parked: inside && speed <= 6,
    crashed: carRight >= bayEnd + 17,
    quality,
    centerOffset,
  };
}

export function parkingScore(quality: number, combo: number, level: number) {
  const precision = Math.round(420 + quality * 580);
  return Math.round(precision * Math.max(1, combo) + level * 75);
}
