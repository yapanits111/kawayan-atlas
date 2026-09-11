"""Password hashing and signed auth tokens using only the Python standard library.

Release 2 adds accounts, but the project deliberately avoids extra dependencies (keeping
the free-tier deploy simple). Passwords are stored as salted PBKDF2-HMAC-SHA256 hashes;
sessions are stateless HMAC-signed bearer tokens carrying the user id and an expiry.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time

from .config import settings

_PBKDF2_ROUNDS = 200_000


def hash_password(password: str) -> str:
    """Return a self-describing `pbkdf2_sha256$rounds$salt$hash` string."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${_PBKDF2_ROUNDS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Constant-time check of a password against a stored hash."""
    try:
        algo, rounds_s, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds_s))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(digest.hex(), hash_hex)


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sign(payload: str) -> str:
    return hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()


def create_token(user_id: str) -> str:
    """A stateless bearer token: base64url(user_id:expiry).signature."""
    exp = int(time.time()) + settings.token_ttl_seconds
    payload = _b64url(f"{user_id}:{exp}".encode())
    return f"{payload}.{_sign(payload)}"


def verify_token(token: str) -> str | None:
    """Return the user id if the token's signature is valid and it has not expired."""
    try:
        payload, sig = token.split(".", 1)
    except ValueError:
        return None
    if not hmac.compare_digest(sig, _sign(payload)):
        return None
    try:
        user_id, exp_s = _b64url_decode(payload).decode().rsplit(":", 1)
    except (ValueError, UnicodeDecodeError):
        return None
    if int(exp_s) < int(time.time()):
        return None
    return user_id
