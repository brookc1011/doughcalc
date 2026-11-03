// Ball weight geometry. Thickness factor (TF) = ounces of dough per square inch of pizza.

export const GRAMS_PER_OZ = 28.349523125;

export function roundArea(diameterIn: number): number {
  return Math.PI * (diameterIn / 2) ** 2;
}

export function rectArea(lengthIn: number, widthIn: number): number {
  return lengthIn * widthIn;
}

export function tfFromBall(ballG: number, areaIn2: number): number {
  return ballG / GRAMS_PER_OZ / areaIn2;
}

export function ballFromTf(tf: number, areaIn2: number): number {
  return tf * areaIn2 * GRAMS_PER_OZ;
}

/**
 * Rescale a ball the baker already likes to a new size, keeping their own thickness.
 * e.g. 340 g at 12" -> same thickness at 14".
 */
export function rescaleBall(refBallG: number, refAreaIn2: number, newAreaIn2: number): number {
  return ballFromTf(tfFromBall(refBallG, refAreaIn2), newAreaIn2);
}
