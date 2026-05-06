import os
from pymongo import MongoClient

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://127.0.0.1:27017/")
MONGODB_DB = os.getenv("MONGODB_DB", "bharatcourtconnect_app")

client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=1000, connectTimeoutMS=1000)
db = client[MONGODB_DB]

users_collection = db["users"]
judicial_docs_collection = db["judicial_docs"]
