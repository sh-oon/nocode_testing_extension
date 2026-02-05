/**
 * Simple nanoid implementation for generating unique IDs
 */
const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function nanoid(size = 21): string {
  let id = '';
  const crypto = window.crypto || (window as typeof window & { msCrypto: Crypto }).msCrypto;
  const bytes = crypto.getRandomValues(new Uint8Array(size));

  for (let i = 0; i < size; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }

  return id;
}
