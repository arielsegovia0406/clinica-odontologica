import { hash, verify, type Options } from "@node-rs/argon2";

/** OWASP-ish argon2id parameters for password and PIN hashing */
const opts: Options = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
  algorithm: 2, // argon2id
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, opts);
}

export async function verifyPassword(data: {
  password: string;
  hash: string;
}): Promise<boolean> {
  return verify(data.hash, data.password, opts);
}

export async function hashPin(pin: string): Promise<string> {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error("PIN must be 4–6 digits");
  }
  return hash(pin, opts);
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  return verify(pinHash, pin, opts);
}
