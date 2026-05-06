"""In-memory users for prototype (reset when server restarts)."""
from __future__ import annotations

import bcrypt
from typing import Dict, Optional, TypedDict


class UserRecord(TypedDict, total=False):
    email: str
    name: str
    password_hash: Optional[bytes]
    provider: str


USERS: Dict[str, UserRecord] = {}


def hash_password(password: str) -> bytes:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())


def verify_password(password: str, password_hash: bytes) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash)


def get_user(email: str) -> Optional[UserRecord]:
    return USERS.get(email.lower().strip())


def create_email_user(email: str, password: str, name: str) -> UserRecord:
    key = email.lower().strip()
    if key in USERS:
        raise ValueError("Email already registered")
    rec: UserRecord = {
        "email": key,
        "name": name.strip() or key.split("@")[0],
        "password_hash": hash_password(password),
        "provider": "email",
    }
    USERS[key] = rec
    return rec


def upsert_google_user(email: str, name: str) -> UserRecord:
    key = email.lower().strip()
    if key in USERS:
        u = USERS[key]
        u["name"] = name or u.get("name", key.split("@")[0])
        u["provider"] = "google"
        return u
    rec: UserRecord = {
        "email": key,
        "name": name or key.split("@")[0],
        "password_hash": None,
        "provider": "google",
    }
    USERS[key] = rec
    return rec
