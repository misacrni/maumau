// AES-GCM šifrovanje podataka lozinkom ekipe (PBKDF2-SHA256).
// Format: {v:1, iter, salt, iv, ct} — base64; ct uključuje GCM tag (kompatibilno sa Python cryptography AESGCM).
const MMCrypto = (() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function key(pw, salt, iter) {
    const base = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function decrypt(box, pw) {
    const k = await key(pw, unb64(box.salt), box.iter);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, k, unb64(box.ct));
    return JSON.parse(dec.decode(pt));
  }
  async function encrypt(obj, pw, iter = 250000) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const k = await key(pw, salt, iter);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(JSON.stringify(obj)));
    return { v: 1, iter, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  }
  return { encrypt, decrypt, b64 };
})();
