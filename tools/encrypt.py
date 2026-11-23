#!/usr/bin/env python3
"""Šifruje data.json lozinkom ekipe -> data.enc.json (isti format kao crypto.js u aplikaciji).
Upotreba: python3 encrypt.py data.json data.enc.json "lozinka"
"""
import sys, json, os, base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
src, dst, pw = sys.argv[1:4]
it, salt, iv = 250000, os.urandom(16), os.urandom(12)
key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=it).derive(pw.encode())
pt = json.dumps(json.load(open(src, encoding="utf-8")), ensure_ascii=False, separators=(",", ":")).encode()
ct = AESGCM(key).encrypt(iv, pt, None)
b = lambda x: base64.b64encode(x).decode()
json.dump({"v": 1, "iter": it, "salt": b(salt), "iv": b(iv), "ct": b(ct)}, open(dst, "w"))
print("OK", dst)
