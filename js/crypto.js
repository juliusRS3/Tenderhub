// TenderHub encryption — runs only in the user's browser.
// RFQs, quotes, Q&A and attachments are scrambled here before they are saved,
// so the server (and the TenderHub admin) only ever stores unreadable text.
//
//  * Every user has a key pair. The public half is shared; the private half is
//    locked with the user's password, and a second copy with a recovery code.
//  * Every RFQ and every quote has its own random key, locked separately for
//    each person allowed to read it (the buyer and the invited suppliers).

const C = crypto.subtle;
const te = new TextEncoder();
const td = new TextDecoder();
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

export const b64 = (buf) => {
  const b = new Uint8Array(buf); let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
};
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (buf) => b64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s) => unb64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));

const RSA = { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };
const AES = { name: "AES-GCM", length: 256 };
const ITER = 310000;

// ---------------------------------------------------------------- user key pair
export const newKeyPair = () => C.generateKey(RSA, true, ["encrypt", "decrypt"]);
export const exportPublic = async (k) => b64(await C.exportKey("spki", k));
const importPublic = (s) => C.importKey("spki", unb64(s), RSA, false, ["encrypt"]);

async function secretKey(secret, salt, iterations) {
  const base = await C.importKey("raw", te.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return C.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, base, AES, false, ["encrypt", "decrypt"]);
}

/** Lock a private key with a password or recovery code. */
export async function lockPrivate(priv, secret) {
  const salt = rand(16), iv = rand(12);
  const k = await secretKey(secret, salt, ITER);
  const ct = await C.encrypt({ name: "AES-GCM", iv }, k, await C.exportKey("pkcs8", priv));
  return JSON.stringify({ v: 1, n: ITER, s: b64(salt), i: b64(iv), c: b64(ct) });
}

/** Unlock a private key. Throws an error with message "WRONG_SECRET" if the password/code is wrong. */
export async function unlockPrivate(blob, secret, extractable = false) {
  const o = JSON.parse(blob);
  const k = await secretKey(secret, unb64(o.s), o.n);
  let raw;
  try { raw = await C.decrypt({ name: "AES-GCM", iv: unb64(o.i) }, k, unb64(o.c)); }
  catch { throw new Error("WRONG_SECRET"); }
  return C.importKey("pkcs8", raw, RSA, extractable, ["decrypt"]);
}

/** Copy of a private key that can be used but never exported (safer to keep on the device). */
export async function deviceCopy(priv) {
  return C.importKey("pkcs8", await C.exportKey("pkcs8", priv), RSA, false, ["decrypt"]);
}

// ---------------------------------------------------------------- RFQ / quote keys
export const newKey = () => C.generateKey(AES, true, ["encrypt", "decrypt"]);
const importAes = (raw) => C.importKey("raw", raw, "AES-GCM", true, ["encrypt", "decrypt"]);

/** Lock an RFQ/quote key for one person, using their public key. */
export async function keyFor(aes, publicKeyB64) {
  return b64(await C.encrypt({ name: "RSA-OAEP" }, await importPublic(publicKeyB64), await C.exportKey("raw", aes)));
}
/** Open an RFQ/quote key that was locked for me. */
export async function openKey(wrapped, priv) {
  return importAes(await C.decrypt({ name: "RSA-OAEP" }, priv, unb64(wrapped)));
}

// ---------------------------------------------------------------- invitation links
// The secret travels only inside the invitation link (after the #), which browsers never send to the server.
export const newLinkSecret = () => b64url(rand(32));
const linkKey = (secret) => C.importKey("raw", unb64url(secret), "AES-GCM", false, ["encrypt", "decrypt"]);
export async function keyForLink(aes, secret) { return seal(await linkKey(secret), b64(await C.exportKey("raw", aes))); }
export async function openLinkKey(blob, secret) { return importAes(unb64(await open(await linkKey(secret), blob))); }

// ---------------------------------------------------------------- data
export async function seal(key, value) {
  const iv = rand(12);
  const ct = await C.encrypt({ name: "AES-GCM", iv }, key, te.encode(JSON.stringify(value)));
  return "v1." + b64(iv) + "." + b64(ct);
}
export async function open(key, sealed) {
  const [v, iv, ct] = String(sealed || "").split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("This item is not in a readable format.");
  try { return JSON.parse(td.decode(await C.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct)))); }
  catch { throw new Error("This item could not be unlocked with your key."); }
}
export async function sealBytes(key, buf) {
  const iv = rand(12);
  const ct = new Uint8Array(await C.encrypt({ name: "AES-GCM", iv }, key, buf));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out;
}
export async function openBytes(key, buf) {
  const b = new Uint8Array(buf);
  return C.decrypt({ name: "AES-GCM", iv: b.subarray(0, 12) }, key, b.subarray(12));
}
export const exportKeyB64 = async (k) => b64(await C.exportKey("raw", k));
export const importKeyB64 = (s) => importAes(unb64(s));

// ---------------------------------------------------------------- recovery code
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I mix-ups
export function newRecoveryCode() {
  const r = rand(20); let s = "";
  for (let i = 0; i < 20; i++) { s += ALPHA[r[i] % 32]; if (i % 4 === 3 && i < 19) s += "-"; }
  return s;
}
/** The form used for locking/unlocking: capitals only, no dashes or spaces. */
export const codeSecret = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// ---------------------------------------------------------------- keep the unlocked key on this device
const DB = "tenderhub_keys";
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("k");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
function tx(mode, fn) {
  return idb().then((d) => new Promise((res, rej) => {
    const t = d.transaction("k", mode); const out = fn(t.objectStore("k"));
    t.oncomplete = () => res(out?.result); t.onerror = () => rej(t.error);
  }));
}
export async function deviceSave(userId, priv) { try { await tx("readwrite", (s) => s.put(priv, userId)); } catch {} }
export async function deviceLoad(userId) { try { return (await tx("readonly", (s) => s.get(userId))) || null; } catch { return null; } }
export async function deviceClear() { try { await tx("readwrite", (s) => s.clear()); } catch {} }
