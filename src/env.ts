export function getEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function getOptionalEnv(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}
