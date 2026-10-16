export function randomUnit(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 4294967296;
}
