import os
from pymongo import MongoClient
import time
import bcrypt

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://127.0.0.1:27017/")
MONGODB_DB = os.getenv("MONGODB_DB", "bharatcourtconnect_app")

client = MongoClient(MONGODB_URL)
db = client[MONGODB_DB]
users_collection = db["users"]

email = "demo@judicial.in"
password = "demo1234"

# Hash password
salt = bcrypt.gensalt(rounds=12)
password_hash = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

# Upsert demo user
users_collection.update_one(
    {"email": email},
    {
        "$set": {
            "name": "Demo User",
            "email": email,
            "password_hash": password_hash,
            "created_at": int(time.time()),
        }
    },
    upsert=True
)

print(f"User {email} ensured in MongoDB.")
