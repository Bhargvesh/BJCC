import sys
sys.path.insert(0, '.')
import os
os.environ.setdefault("SECRET_KEY", "test")
os.environ.setdefault("MONGODB_URL", "mongodb://localhost")

# Test the localize function directly
from app.routes.innovation import _I18N_DOC_FIELDS, _localize_doc_payload

print("Keys in _I18N_DOC_FIELDS:", list(_I18N_DOC_FIELDS.keys()))
aadhaar = _I18N_DOC_FIELDS.get("SC-AADHAAR-2018-PUTTASWAMY-II", {})
print("Languages for Aadhaar case:", list(aadhaar.keys()))
hi = aadhaar.get("hi", {})
print("Keys in hi entry:", list(hi.keys()))
if "judgment_sections" in hi:
    print("judgment_sections keys:", list(hi["judgment_sections"].keys()))
    print("facts (first 80 chars):", hi["judgment_sections"]["facts"][:80])
else:
    print("NO judgment_sections in hi!")

# Now simulate the localize call
payload = {
    "id": "SC-AADHAAR-2018-PUTTASWAMY-II",
    "summary": "English summary",
    "full_summary": "English full summary",
    "key_points": ["English point"],
    "judgment_sections": {
        "facts": "English facts",
        "issues": "English issues",
    }
}
result = _localize_doc_payload(payload, "hi")
print("\nAfter localize with lang=hi:")
print("summary:", result["summary"][:60])
print("facts:", result["judgment_sections"].get("facts", "NOT SET")[:80])

result2 = _localize_doc_payload({
    "id": "SC-AADHAAR-2018-PUTTASWAMY-II",
    "summary": "English summary",
    "full_summary": "English full summary",
    "key_points": [],
    "judgment_sections": {"facts": "English"}
}, "ur")
print("\nAfter localize with lang=ur:")
print("summary:", result2["summary"][:80])
print("facts:", result2["judgment_sections"].get("facts", "NOT SET")[:80])
