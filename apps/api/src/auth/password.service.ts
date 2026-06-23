import { Injectable } from "@nestjs/common";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
      N: SCRYPT_N,
      p: SCRYPT_P,
      r: SCRYPT_R
    });

    return [
      "scrypt",
      SCRYPT_N,
      SCRYPT_R,
      SCRYPT_P,
      salt.toString("base64url"),
      derivedKey.toString("base64url")
    ].join("$");
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    const [algorithm, n, r, p, salt, storedHash] = passwordHash.split("$");

    if (algorithm !== "scrypt" || !n || !r || !p || !salt || !storedHash) {
      return false;
    }

    const derivedKey = await scrypt(password, Buffer.from(salt, "base64url"), KEY_LENGTH, {
      N: Number(n),
      p: Number(p),
      r: Number(r)
    });
    const storedKey = Buffer.from(storedHash, "base64url");

    return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
  }
}

function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; p: number; r: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}
