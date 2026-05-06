from __future__ import annotations

import base64
import html
import hashlib
import hmac
import asyncio
import json
import os
import re
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urljoin

import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File, Header
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field

from app.mongo import users_collection, judicial_docs_collection
from app.services.bhashini_service import bhashini_service
from app.services.speech_to_text import speech_service

router = APIRouter()
_HTTP_CLIENT = httpx.AsyncClient(timeout=10.0)


_SIGNING_SECRET = b"demo-secret-change-me"
_GOOGLE_CLIENT_ID_FALLBACK = "250783429177-7q38pgkiloe67i5qcg90qahsn12qpcuj.apps.googleusercontent.com"

# In-memory user store (demo)
try:
    import bcrypt
except Exception:  # pragma: no cover
    bcrypt = None

try:
    from google.auth.transport.requests import Request as GoogleRequest
    from google.oauth2 import id_token as google_id_token
except Exception:  # pragma: no cover
    GoogleRequest = None
    google_id_token = None


def _hash_pw(pw: str) -> str:
    if not bcrypt:
        return "demo:" + pw
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pw.encode("utf-8"), salt).decode("utf-8")


def _verify_pw(pw: str, hashed: str) -> bool:
    if not bcrypt:
        return hashed == "demo:" + pw
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _decode_jwt_payload_unverified(jwt_token: str) -> Dict[str, Any]:
    """Dev fallback: parse JWT payload when online verification is unavailable."""
    parts = (jwt_token or "").split(".")
    if len(parts) != 3:
        raise ValueError("Malformed JWT")
    payload_segment = parts[1]
    padding = "=" * (-len(payload_segment) % 4)
    raw = base64.urlsafe_b64decode((payload_segment + padding).encode("utf-8"))
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Invalid JWT payload")
    return data


# In-memory user store — fallback for when MongoDB is unavailable.
USERS: Dict[str, Dict[str, Any]] = {}
USERS["demo@judicial.in"] = {
    "name": "Demo User",
    "email": "demo@judicial.in",
    "password_hash": _hash_pw("demo1234"),
    "created_at": int(time.time()),
}


def _make_auth_token(email: str) -> str:
    now = int(time.time())
    payload = {"v": 1, "sub": email, "iat": now, "exp": now + 7 * 24 * 3600}
    payload_bytes = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return _b64url(payload_bytes) + "." + _sign(payload_bytes)


def _require_user(authorization: str | None) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if "." not in token:
        raise HTTPException(status_code=401, detail="Invalid token")
    payload_b64, sig = token.split(".", 1)
    try:
        payload_bytes = _b64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not hmac.compare_digest(sig, _sign(payload_bytes)):
        raise HTTPException(status_code=401, detail="Invalid token signature")
    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=401, detail="Token expired")
    email = str(payload.get("sub") or "").lower()
    u = None
    try:
        u = users_collection.find_one({"email": email})
        if u:
            u["_id"] = str(u["_id"])
    except Exception:
        pass
    
    if not u:
        u = USERS.get(email)
    
    if not u:
        raise HTTPException(status_code=401, detail="User not found")
    return u


class JudicialDoc(BaseModel):
    id: str
    court: str
    date: str
    title: str
    parties: str
    acts: List[str]
    sections: List[str]
    summary: str
    key_points: List[str]
    citations: List[str] = []
    languages: List[str] = ["en", "hi", "doi"]
    full_summary: Optional[str] = None
    publication_url: Optional[str] = None
    official_source: Optional[str] = None
    judgment_sections: Optional[Dict[str, str]] = None


JUDICIAL_DOCS: List[JudicialDoc] = [
    JudicialDoc(
        id="143757138",
        court="Income Tax Appellate Tribunal (ITAT), Delhi Bench 'E'",
        date="2021-10-14",
        title="Export Commission Taxability & Fees for Technical Services (FTS)",
        parties="M/S. Rajinder Kumar Aggarwal (Huf) vs. DCIT, New Delhi",
        acts=["Income-tax Act, 1961", "Finance Act, 2010", "India-France DTAA"],
        sections=["Section 9(1)(vii)", "Section 40(a)(i)", "Section 195", "Section 143(3)", "Article 7", "Article 13"],
        summary=(
            "A pivotal tax ruling addressing the characterization of export commission paid to non-resident "
            "agents. The ITAT Delhi Bench held that pure procurement services rendered offshore do not "
            "constitute 'Fees for Technical Services' (FTS), and thus no TDS is required. The judgment "
            "reinforces the principle of consistency and the superiority of DTAA provisions over retrospective "
            "domestic law amendments regarding territorial nexus."
        ),
        key_points=[
            "Export commission paid for procuring orders outside India is NOT 'Fees for Technical Services' (FTS).",
            "Retrospective amendment by Finance Act 2010 does not make pure business agency work taxable in India.",
            "Under India-France DTAA (Article 7), business profits are only taxable in India if a PE exists.",
            "TDS under Section 195 is only required if the income is actually 'chargeable to tax' in India.",
            "Principle of Consistency: Matters settled in earlier years (AY 2010-11) should be followed if facts remain same.",
        ],
        citations=["CIT vs Toshoku Ltd (125 ITR 525 SC)", "CIT vs Grup Ism (P) Ltd", "Panalfa Autoelektrik Ltd"],
        languages=["en", "hi", "doi"],
        full_summary=(
            "CASE CONTEXT & ASSESSMENT HISTORY\n"
            "The appellant, M/s. Rajinder Kumar Aggarwal (HUF), through its proprietary concern 'Regency Impex', "
            "is engaged in the manufacture and export of leather footwear. For the Assessment Year 2012-13, "
            "the assessee claimed a deduction for export commission paid to M/s Ace Trading Company, France, "
            "amounting to ₹1,16,99,172. The Assessing Officer (AO) disallowed this under Section 40(a)(i) "
            "due to non-deduction of taxes (TDS) at source.\n\n"
            "CORE LEGAL DISPUTE: THE FTS CHALLENGE\n"
            "The Revenue Department contended that following the retrospective amendment to Section 9 by the "
            "Finance Act 2010, the requirement of 'rendering' services in India was removed. They argued that "
            "since the services were 'utilized' by an Indian business, the fee was taxable in India as "
            "Fees for Technical Services (FTS). The assessee counter-argued that procuring export orders "
            "is a commercial business activity, not a 'managerial, technical, or consultancy' service.\n\n"
            "TRIBUNAL'S ANALYSIS & DECISION\n"
            "The ITAT Bench 'E' (Delhi) scrutinized the nature of the services and the applicability of "
            "the India-France Double Taxation Avoidance Agreement (DTAA). It observed that:\n"
            "1. Nature of Service: The foreign agent merely acted as an intermediary to secure orders. "
            "No technical knowledge was shared with or made available to the assessee.\n"
            "2. Treaty Dominance: Under Article 7 of the DTAA, business profits are only taxable in "
            "India if the foreign entity has a Permanent Establishment (PE). M/s Ace had no PE in India.\n"
            "3. Supreme Court Precedents: The Court relied on CIT vs Toshoku Ltd (125 ITR 525), which "
            "settled that commission for services rendered outside India does not arise in India.\n\n"
            "FINAL IMPACT & RULING\n"
            "The Tribunal deleted the disallowance of ₹1.16 Crore, holding that the assessee was not "
            "required to deduct TDS under Section 195. This ruling provided significant relief to Indian "
            "exporters using offshore agents and clarified that retrospective domestic amendments cannot "
            "unilaterally override the protective provisions of tax treaties (DTAA)."
        ),
        publication_url="https://indiankanoon.org/doc/143757138/",
        official_source="Indian Kanoon",
        judgment_sections={
            "facts": (
                "The appellant, M/S. Rajinder Kumar Aggarwal (HUF), is the proprietor of 'Regency Impex', "
                "involved in the manufacture and export of leather footwear. During the Assessment Year "
                "2012-13, the assessee paid a sum of ₹1,16,99,172 as commission to M/s Ace Trading Company, "
                "a French resident, for procuring export orders from the European market. No TDS was deducted "
                "on this payment on the grounds that the services were rendered outside India and the "
                "recipient had no business presence or Permanent Establishment (PE) in India. The Assessing "
                "Officer disallowed the entire commission under Section 40(a)(i) of the Income-tax Act, "
                "leading to this appeal."
            ),
            "issues": (
                "1. Whether the commission paid to a non-resident agent for procuring export orders constitutes "
                "'Fees for Technical Services' (FTS) under Section 9(1)(vii).\n"
                "2. Whether the retrospective amendment to Section 9 by the Finance Act 2010 makes such "
                "payments taxable in India regardless of the place of rendition.\n"
                "3. Whether the assessee was liable to deduct tax at source under Section 195 on payments "
                "made to a French entity with no PE in India, considering the India-France DTAA."
            ),
            "petitioner_arguments": (
                "The assessee argued that: (a) Procurement of orders is a business function, not a technical "
                "consultancy; (b) The agent acts as a simple intermediary between the exporter and foreign "
                "buyers; (c) Under the India-France DTAA, the income is 'Business Profit' (Article 7) and "
                "not taxable without a PE; (d) The Supreme Court in Toshoku Ltd has already established "
                "that such commission is not taxable in India; (e) The same issue was decided in favor "
                "of the assessee for AY 2010-11."
            ),
            "respondent_arguments": (
                "The Revenue Department argued that: (a) After the 2010 amendment, the location of the agent is "
                "irrelevant if the services are utilized in India; (b) The fees should be treated as FTS "
                "because the agent provides 'managerial and consultancy' services in terms of market analysis; "
                "(c) The income accrues in India because it is sourced from an Indian business; (d) Reliance "
                "should be placed on the Linklaters LLP ruling which expanded the territorial nexus."
            ),
            "analysis_of_law": (
                "Section 9(1)(vii) defines FTS as consideration for managerial, technical, or consultancy services. "
                "The Tribunal observed that order procurement does not fit this definition. Furthermore, Section "
                "90(2) ensures that the provisions of the Income-tax Act apply only to the extent they are "
                "more beneficial than the DTAA. The India-France DTAA (Article 7) restricts the taxability "
                "of business profits to cases where a PE is present. Since there was no PE, the Treaty "
                "protection overrides the domestic Act's broader scope."
            ),
            "precedent_analysis": (
                "The Bench relied on the Supreme Court's landmark ruling in CIT vs Toshoku Ltd (125 ITR 525) "
                "which held that if a non-resident does not carry out business operations in India, no part "
                "of the income arises in India. It also followed the Delhi High Court's view in Panalfa Autoelektrik "
                "Ltd, which clarified that that the mere utilization of services in India is not enough to characterize "
                "business commission as FTS."
            ),
            "court_reasoning": (
                "The ITAT reasoned that the Revenue failed to prove that the agent's services had changed "
                "from simple agency to technical advisory. The Bench emphasized the 'Principle of Consistency' "
                "— since the ITAT had already allowed the same commission for AY 2010-11, there was no reason "
                "to deviate in AY 2012-13. The Tribunal held that withholding tax under Section 195 only "
                "triggers if the payment is 'chargeable to tax' in India. Since it was exempt under the DTAA, "
                "the assessee was not in default."
            ),
            "conclusion": (
                "The ITAT Delhi Bench 'E' allowed the assessee's appeal and directed the deletion of the "
                "₹1,16,99,172 disallowance. The appeal was decided in favor of the taxpayer, confirming that "
                "export commission to non-resident agents is not taxable in India. Appeal No. ITA 2996/DEL/2016 "
                "was ALLOWED."
            )
        },
    ),
    JudicialDoc(
        id="SC-RTI-2011-ADITYA-BANDOPADHYAY",
        court="Supreme Court of India",
        date="2011-08-09",
        title="Right to Information and evaluated answer sheets",
        parties="CBSE v. Aditya Bandopadhyay",
        acts=["Right to Information Act, 2005"],
        sections=["RTI Act s.2(f)", "RTI Act s.8", "RTI Act s.19", "RTI Act s.22"],
        summary=(
            "The Supreme Court held that evaluated answer books are 'information' under s.2(f) of the RTI Act "
            "and must be disclosed to applicants on request, subject to narrow exemptions under s.8. "
            "The ruling fundamentally changed how public authorities handle examination records and transparency."
        ),
        key_points=[
            "Evaluated answer sheets are 'information' under RTI Act s.2(f) — CBSE must disclose on request.",
            "Exemptions under s.8 are narrow and must be interpreted strictly; blanket refusals are impermissible.",
            "Public authorities may adopt reasonable safeguards (e.g., certified copies) but cannot refuse outright.",
            "The right to information includes the right to inspect documents, take notes, and get certified copies.",
            "Fiduciary relationship exemption under s.8(1)(e) does NOT extend to examiner-examinee relationship.",
            "RTI Act overrides confidentiality clauses in other statutes (s.22 non-obstante clause).",
            "Third-party information provisions (s.11) still apply — must balance all interests.",
        ],
        citations=["(2011) 8 SCC 497", "AIR 2011 SC 3214"],
        languages=["en", "hi", "doi"],
        full_summary=(
            "BACKGROUND & CASE HISTORY\n"
            "Aditya Bandopadhyay, a student, failed his CBSE examination and sought to inspect his evaluated answer "
            "scripts under the Right to Information Act, 2005. CBSE refused on the grounds that: (a) answer scripts "
            "were held in a fiduciary capacity (s.8(1)(e)); (b) disclosure would harm the examination system "
            "(s.8(1)(g)/(h)); and (c) the information was not 'information' under s.2(f). The Calcutta High Court "
            "ruled in favour of disclosure. CBSE appealed to the Supreme Court.\n\n"
            "WHAT THE SUPREME COURT CHANGED\n"
            "The Supreme Court, in a landmark ruling, fundamentally redefined the scope of 'information' under "
            "the RTI Act. The five-judge bench held that evaluated answer books fall squarely within s.2(f) which "
            "defines 'information' as any material in any form. This overturned CBSE's longstanding policy of "
            "treating answer scripts as confidential internal documents. The Court struck down the argument that "
            "the examiner-student relationship is fiduciary, finding it factually and legally unsustainable.\n\n"
            "KEY LEGAL PROVISIONS INTERPRETED\n"
            "Section 2(f) RTI Act: The Court gave this an expansive interpretation — 'information' includes any "
            "material in any form including records, documents, memos, e-mails, opinions, advices, press releases, "
            "circulars, orders, logbooks, contracts, reports, papers, samples, models, data material held in "
            "any electronic form. Evaluated answer books are unambiguously 'records' and 'documents'.\n"
            "Section 8(1)(e) RTI Act: The fiduciary exemption protects relationships where there is a duty of "
            "confidence (e.g., lawyer-client, doctor-patient). The Court held the examiner-student relationship "
            "has no such fiduciary characteristic — examiners are paid employees, not confidential advisors.\n"
            "Section 22 RTI Act: This non-obstante clause means RTI overrides any inconsistent provisions in "
            "other legislation. CBSE's internal rules and Board regulations cannot override the RTI mandate.\n\n"
            "IMPACT ON GOVERNMENT SECTOR\n"
            "This ruling cascaded across all public examination bodies in India — UPSC, SSC, state PSCs, "
            "university boards. It established that: (1) All evaluated answer books by government/public "
            "educational bodies must be disclosed on RTI request; (2) Re-evaluation/re-checking policies must "
            "align with RTI obligations; (3) Blanket confidentiality policies in government examination manuals "
            "are invalid to the extent they conflict with RTI. The ruling directly strengthened accountability "
            "in India's vast public examination infrastructure and reduced arbitrary refusals.\n\n"
            "WHAT REMAINED / WHAT WAS NOT CHANGED\n"
            "The Court upheld the right of public authorities to: (a) provide certified copies rather than "
            "originals; (b) charge prescribed fees; (c) apply third-party notice provisions under s.11 where "
            "other examinees' privacy could be breached. The exemptions in s.8(1)(a)-(j) remain valid and "
            "blanket disclosure is not mandated — each case must be assessed on its facts."
        ),
        publication_url="https://indiankanoon.org/doc/1692164/",
        official_source="Indian Kanoon",
        judgment_sections={
            "facts": (
                "Aditya Bandopadhyay, a student, failed his CBSE examination and sought to inspect his evaluated answer "
                "scripts under the Right to Information Act, 2005. CBSE refused access on several grounds including "
                "that answer scripts were held in a fiduciary capacity under s.8(1)(e), that disclosure would harm "
                "the examination system under s.8(1)(g)/(h), and that evaluated answer books did not constitute "
                "'information' under s.2(f) of the RTI Act. The matter was first heard by the Central Information "
                "Commission which directed disclosure. CBSE challenged this before the Calcutta High Court, which "
                "upheld the CIC's order. CBSE then appealed to the Supreme Court of India."
            ),
            "issues": (
                "1. Whether evaluated answer books constitute 'information' as defined under Section 2(f) of the "
                "Right to Information Act, 2005.\n"
                "2. Whether the relationship between an examiner and an examinee is 'fiduciary' in nature, thereby "
                "attracting the exemption under Section 8(1)(e) of the RTI Act.\n"
                "3. Whether disclosure of evaluated answer scripts would cause harm to the examination process "
                "under Sections 8(1)(g) and 8(1)(h).\n"
                "4. Whether the non-obstante clause in Section 22 of the RTI Act overrides confidentiality "
                "provisions in CBSE's internal regulations."
            ),
            "petitioner_arguments": (
                "CBSE (Appellant) argued that: (a) Evaluated answer books are not 'information' within the meaning "
                "of Section 2(f) as they are internal working documents of the Board; (b) The examiner holds the "
                "answer scripts in a fiduciary capacity — the relationship of trust between examiner and the Board "
                "means disclosure would breach confidence under s.8(1)(e); (c) Mass disclosure of answer scripts "
                "would overwhelm the examination infrastructure and cause irreparable harm to the system; "
                "(d) Re-evaluation requests would flood the system, causing administrative paralysis; "
                "(e) The confidentiality of the evaluation process is essential for maintaining public faith in "
                "examination results."
            ),
            "respondent_arguments": (
                "Aditya Bandopadhyay (Respondent) argued that: (a) Section 2(f) of the RTI Act defines 'information' "
                "in the broadest possible terms — 'any material in any form' including records, documents, and data "
                "material; (b) An evaluated answer book is clearly a 'record' and 'document' held by a public "
                "authority; (c) The examiner-examinee relationship has no fiduciary characteristic — examiners are "
                "paid employees performing a contractual duty, not confidential advisors; (d) The RTI Act's "
                "non-obstante clause (s.22) overrides any Board regulations restricting access; (e) Transparency "
                "in evaluation is essential for accountability and fairness in public examinations."
            ),
            "analysis_of_law": (
                "Section 2(f) of the RTI Act defines 'information' as any material in any form including records, "
                "documents, memos, e-mails, opinions, advices, press releases, circulars, orders, logbooks, "
                "contracts, reports, papers, samples, models, data material held in any electronic form. The Court "
                "analysed this definition and found it to be deliberately expansive. Evaluated answer books "
                "unambiguously fall within 'records' and 'documents'.\n\n"
                "Section 8(1)(e) protects information available to a person in a fiduciary relationship. The Court "
                "examined the legal meaning of 'fiduciary' — a relationship involving trust, confidence, and a duty "
                "to act in the beneficiary's interest (e.g., lawyer-client, trustee-beneficiary). The examiner-student "
                "relationship was found to lack these characteristics entirely.\n\n"
                "Section 22 contains a non-obstante clause: the RTI Act has effect notwithstanding anything "
                "inconsistent in any other enactment or instrument. This means CBSE's internal confidentiality "
                "rules cannot override the statutory right to information."
            ),
            "precedent_analysis": (
                "The Court considered S.P. Gupta v. Union of India (1981) which established the 'open government' "
                "doctrine — transparency is the rule and secrecy the exception. The Court also referred to "
                "Institute of Chartered Accountants v. Shaunak H. Satya (2011) on the meaning of fiduciary "
                "relationship. The Court distinguished CBSE's reliance on Girish Ramchandra Deshpande v. CIC (2012) "
                "which dealt with personal information of third parties, not the applicant's own answer scripts. "
                "The Court reaffirmed the principle from Raj Narain v. State of UP (1975) that in a democracy, "
                "the people have a right to know the affairs of the government."
            ),
            "court_reasoning": (
                "The Court reasoned that the RTI Act was enacted to promote transparency and accountability in "
                "the working of public authorities. The definition of 'information' in s.2(f) is deliberately "
                "wide and all-encompassing. An evaluated answer book is a document created by a public authority "
                "in the course of its official functions — it is plainly 'information'. The fiduciary argument "
                "fails because the examiner is a paid employee of CBSE performing a contractual obligation — this "
                "is fundamentally different from a lawyer-client or trustee-beneficiary relationship. The Court "
                "also rejected the 'harm to examination system' argument, noting that transparency in evaluation "
                "actually strengthens public confidence rather than undermining it. However, the Court balanced "
                "this with practical considerations — public authorities may provide certified copies rather than "
                "originals, and may charge reasonable fees."
            ),
            "conclusion": (
                "The Supreme Court dismissed CBSE's appeal and upheld the Calcutta High Court's order directing "
                "disclosure. The Court held that: (1) Evaluated answer books are 'information' under s.2(f) and "
                "must be disclosed on request; (2) The fiduciary exemption under s.8(1)(e) does not apply to the "
                "examiner-student relationship; (3) CBSE may adopt reasonable safeguards (certified copies, fees) "
                "but cannot refuse outright; (4) The RTI Act's non-obstante clause overrides CBSE's internal "
                "confidentiality rules. This ruling established binding precedent for all public examination "
                "bodies in India."
            )
        },
    ),
    JudicialDoc(
        id="SC-AADHAAR-2018-PUTTASWAMY-II",
        court="Supreme Court of India",
        date="2018-09-26",
        title="Aadhaar constitutionality, privacy and proportionality",
        parties="K.S. Puttaswamy (Aadhaar) v. Union of India",
        acts=["Aadhaar Act, 2016", "Constitution of India", "Prevention of Money Laundering Act, 2002"],
        sections=["Article 14", "Article 19", "Article 21", "Aadhaar Act s.2", "Aadhaar Act s.7", "Aadhaar Act s.29", "Aadhaar Act s.33", "Aadhaar Act s.47", "Aadhaar Act s.57"],
        summary=(
            "In a landmark 4:1 majority ruling, the Supreme Court upheld the Aadhaar framework for government "
            "welfare delivery but struck down Section 57 (private entity use), Section 33(2) (metadata "
            "disclosure to police without court order), and read down Section 47 (complaint filing). The Court "
            "applied the Puttaswamy-I privacy framework and the four-pronged proportionality test. The ruling "
            "permanently changed how biometric identity systems can be used in India."
        ),
        key_points=[
            "Aadhaar UPHELD for government subsidies, welfare, and PAN linkage — legitimate state aim proven.",
            "Section 57 STRUCK DOWN: private companies (banks, telcos) cannot mandate Aadhaar linkage.",
            "Section 33(2) STRUCK DOWN: police cannot access CIDR (Central Identities Data Repository) without a court order.",
            "Section 47 READ DOWN: complainants can include individuals — not only UIDAI can file complaints.",
            "The four-pronged proportionality test: legitimate aim → suitable means → necessity → balancing.",
            "Article 21 (right to privacy) is a fundamental right per Puttaswamy-I (2017) — fully applied here.",
            "Demographic data + biometrics stored centrally raise constitutional scrutiny — purpose limitation is mandatory.",
            "Children's Aadhaar enrolment cannot be compulsory for school admission — Article 21A protection.",
        ],
        citations=["(2019) 1 SCC 1", "AIR 2019 SC 1", "Puttaswamy-I: (2017) 10 SCC 1"],
        languages=["en", "hi", "doi"],
        full_summary=(
            "BACKGROUND & CASE HISTORY\n"
            "Justice K.S. Puttaswamy (Retd.) filed a writ petition challenging the constitutional validity of "
            "the Aadhaar (Targeted Delivery of Financial and Other Subsidies, Benefits and Services) Act, 2016. "
            "The challenge came after the Puttaswamy-I judgment (2017) unanimously recognised privacy as a "
            "fundamental right under Articles 14, 19 and 21 of the Constitution. A five-judge Constitution Bench "
            "heard the matter and delivered a 4:1 majority opinion (Justice D.Y. Chandrachud dissenting).\n\n"
            "WHAT THE SUPREME COURT CHANGED — PROVISIONS STRUCK DOWN\n"
            "1. Section 57 (Use by private entities) — STRUCK DOWN ENTIRELY: The majority held that allowing "
            "private companies to demand Aadhaar authentication (banks, telecom companies under PMLA/telecom "
            "regulations) was unconstitutional. Commercial exploitation of individuals' biometric data for private "
            "profit fails the proportionality test because less invasive alternatives exist and the harm to "
            "autonomy outweighs the benefit.\n"
            "2. Section 33(2) (National security disclosure) — STRUCK DOWN: This allowed a Joint Secretary-level "
            "officer to authorise disclosure of CIDR (Central Identities Data Repository) data to police/agencies "
            "for national security. The Court held this violates judicial oversight — only a court order can "
            "authorise such intrusive access to biometric databases. The provision lacked procedural safeguards.\n"
            "3. Section 47 Complaint mechanism — READ DOWN: The Act originally allowed only UIDAI (the Aadhaar "
            "authority) to file criminal complaints for data misuse. This was read down to allow any affected "
            "individual to also file complaints, removing UIDAI's exclusive control over prosecutions.\n"
            "4. Regulation 26 (Data retention by requesting entities) — STRUCK DOWN: Entities (banks, etc.) "
            "were retaining Aadhaar authentication records. Court held unlimited data retention by private/public "
            "entities breaches purpose limitation — data must be deleted after authentication.\n\n"
            "WHAT REMAINED UPHELD\n"
            "1. Mandatory Aadhaar for government welfare (Section 7): Using Aadhaar as a condition for receiving "
            "subsidies, benefits under Direct Benefit Transfer (DBT), PDS rations, MGNREGA wages, and other "
            "Central/State welfare was upheld. Legitimate state interest in plugging leakages and ensuring "
            "proper targeting of beneficiaries passed the proportionality test.\n"
            "2. PAN-Aadhaar linkage (Income Tax Act s.139AA): Upheld as a valid anti-tax evasion measure — "
            "the fiscal and anti-fraud aim was considered proportionate.\n"
            "3. The Aadhaar Act's enrolment, biometric data storage, and the CIDR architecture were upheld "
            "subject to the struck-down provisions being severed.\n\n"
            "ARTICLE-BY-ARTICLE ANALYSIS\n"
            "Article 14 (Equality): Aadhaar's differential treatment (those enrolled vs. not) must have a "
            "rational nexus to a legitimate aim. Welfare delivery nexus was accepted; private commercial use "
            "lacked this nexus — hence s.57 fell under Article 14 as well as Article 21.\n"
            "Article 19(1)(a)&(g) (Free speech & profession): Mandatory disclosure of biometric data to private "
            "entities to access basic services (phone SIM, bank account) disproportionately restricts freedom — "
            "struck down as creating a chilling effect on autonomy and economic participation.\n"
            "Article 21 (Life & Personal Liberty / Privacy): Under the Puttaswamy-I framework, privacy includes "
            "informational privacy (control over personal data), decisional privacy (bodily autonomy), and "
            "spatial privacy. Biometric data is the most intimate category. The Court applied Proportionality: "
            "(i) Legitimate aim — welfare delivery (yes), private profit (no); (ii) Rational connection — shown "
            "for welfare, not for private use; (iii) Necessity — UIDAI argued no alternative; Court found OTP "
            "and other means possible for private sector; (iv) Balancing — privacy harm to millions of "
            "vulnerable people outweighs benefit to private entities.\n\n"
            "DISSENT (Justice D.Y. Chandrachud)\n"
            "The dissent went further, holding that the entire Aadhaar Act was unconstitutional because: "
            "(a) it was incorrectly passed as a Money Bill (bypassing Rajya Sabha review); (b) even welfare use "
            "creates a surveillance state capable of profiling citizens; (c) biometric data is inherently "
            "irrevocable — unlike a password, a fingerprint cannot be changed if compromised.\n\n"
            "IMPACT ON GOVERNMENT SECTOR & ONGOING APPLICATIONS\n"
            "Post-ruling, UIDAI restructured its ecosystem: (1) Bank KYC was moved to voluntary Aadhaar "
            "e-KYC without compulsion; (2) Telecom SIM verification shifted to alternate KYC; (3) Section 57 "
            "was formally repealed by the Aadhaar (Amendment) Act, 2019; (4) The principle of 'purpose "
            "limitation' became foundational to India's Personal Data Protection legislative drafts; (5) The "
            "Data Protection Board concept in the Digital Personal Data Protection Act, 2023 traces its "
            "philosophical roots to this judgment."
        ),
        publication_url="https://indiankanoon.org/doc/127517806/",
        official_source="Indian Kanoon",
        judgment_sections={
            "facts": (
                "Justice K.S. Puttaswamy (Retd.) filed a writ petition challenging the constitutional validity of "
                "the Aadhaar (Targeted Delivery of Financial and Other Subsidies, Benefits and Services) Act, 2016. "
                "The Aadhaar system, administered by UIDAI, collects biometric data (fingerprints and iris scans) "
                "and demographic information of residents, storing them in the Central Identities Data Repository "
                "(CIDR). The system had been made mandatory for accessing government welfare schemes, filing income "
                "tax returns, opening bank accounts, and obtaining mobile SIM cards. Over 1.1 billion residents had "
                "been enrolled. The challenge came after the Puttaswamy-I judgment (2017) which unanimously "
                "recognised privacy as a fundamental right under Articles 14, 19 and 21 of the Constitution."
            ),
            "issues": (
                "1. Whether the Aadhaar Act, 2016 violates the fundamental right to privacy recognised in "
                "Puttaswamy-I (2017) under Article 21 of the Constitution.\n"
                "2. Whether Section 57 of the Aadhaar Act (allowing private entities to use Aadhaar authentication) "
                "is constitutionally valid.\n"
                "3. Whether Section 33(2) (permitting disclosure of identity information in the interest of "
                "national security without judicial oversight) violates fundamental rights.\n"
                "4. Whether mandatory Aadhaar linkage for welfare benefits passes the proportionality test.\n"
                "5. Whether the Aadhaar Act was validly passed as a Money Bill under Article 110."
            ),
            "petitioner_arguments": (
                "The petitioners argued that: (a) The Aadhaar system creates an unprecedented surveillance "
                "architecture that enables the State to track, profile, and monitor citizens through their "
                "biometric data — violating the right to privacy under Article 21; (b) Biometric data is "
                "irrevocable — unlike a password, fingerprints cannot be changed if the database is compromised; "
                "(c) Section 57 allowing private entities (banks, telecom companies) to demand Aadhaar "
                "authentication for commercial services violates bodily autonomy and informational privacy; "
                "(d) Section 33(2) allowing a Joint Secretary-level officer to authorise disclosure of CIDR data "
                "for national security without judicial oversight violates procedural safeguards under Article 21; "
                "(e) The Act was unconstitutionally passed as a Money Bill to bypass Rajya Sabha scrutiny; "
                "(f) The mandatory nature of Aadhaar for essential services creates a coercive environment where "
                "citizens cannot meaningfully consent to sharing biometric data."
            ),
            "respondent_arguments": (
                "The Union of India argued that: (a) Aadhaar serves a compelling state interest in ensuring "
                "targeted delivery of government subsidies and eliminating fraud and leakage in welfare schemes — "
                "the government saved over ₹90,000 crore through Aadhaar-based Direct Benefit Transfer; "
                "(b) The biometric system is the most reliable method of identity verification for a 1.3 billion "
                "population where many lack conventional identity documents; (c) The architecture has adequate "
                "security safeguards — data is encrypted, stored in secure facilities, and access is logged; "
                "(d) Section 57 enables financial inclusion by allowing banks to perform e-KYC efficiently; "
                "(e) National security considerations under Section 33(2) require executive flexibility that "
                "judicial processes would impede; (f) The Act was validly passed as a Money Bill because its "
                "predominant purpose relates to appropriation from the Consolidated Fund of India."
            ),
            "analysis_of_law": (
                "The Court applied the four-pronged proportionality test established in Puttaswamy-I (2017):\n\n"
                "(i) Legitimate Aim: The State's interest in targeted welfare delivery and plugging leakages "
                "in subsidy distribution was accepted as a legitimate aim. However, enabling private commercial "
                "entities to exploit biometric data for profit was NOT accepted as a legitimate state aim.\n\n"
                "(ii) Rational Connection (Suitability): Aadhaar authentication was found to have a rational "
                "connection to the aim of ensuring benefits reach intended beneficiaries. For private use under "
                "Section 57, no such connection was established.\n\n"
                "(iii) Necessity: For welfare delivery, the Court accepted that no equally effective alternative "
                "exists for a population of 1.3 billion. For private sector use, alternatives like OTP-based "
                "verification and conventional KYC exist — making Aadhaar mandatory for bank accounts and SIMs "
                "is not necessary.\n\n"
                "(iv) Balancing: The privacy harm to millions of vulnerable citizens from mandatory biometric "
                "collection outweighs the administrative convenience of private entities."
            ),
            "precedent_analysis": (
                "The Court extensively relied on K.S. Puttaswamy v. Union of India (2017) — the nine-judge bench "
                "privacy judgment — which established that privacy is a fundamental right under Article 21 "
                "encompassing informational privacy, bodily integrity, decisional autonomy, and spatial privacy. "
                "The Court also considered Maneka Gandhi v. Union of India (1978) on the expanded scope of "
                "Article 21 and procedural due process. The proportionality framework was drawn from Modern "
                "Dental College v. State of Madhya Pradesh (2016). The majority distinguished the instant case "
                "from Binoy Viswam v. Union of India (2017) which upheld PAN-Aadhaar linkage on narrower grounds. "
                "Justice Chandrachud's dissent relied on the basic structure doctrine from Kesavananda Bharati v. "
                "State of Kerala (1973) to argue the Money Bill certification was a fraud on the Constitution."
            ),
            "court_reasoning": (
                "The 4:1 majority (per Sikri, CJI) reasoned that while Aadhaar's core purpose — targeted welfare "
                "delivery — serves a legitimate state interest that passes proportionality, several provisions "
                "go beyond what is constitutionally permissible. Section 57 was struck down because allowing "
                "private entities to demand Aadhaar authentication for commercial services creates a parallel "
                "surveillance infrastructure without the state's welfare justification. The Court emphasised "
                "that biometric data is the most intimate category of personal information — once collected, "
                "it cannot be changed if compromised, unlike a password.\n\n"
                "Section 33(2) was struck down because permitting executive officers to authorise CIDR access "
                "without judicial oversight violates the procedural safeguards inherent in Article 21. The "
                "Court held that national security is not a blank cheque — intrusive surveillance must be "
                "subject to judicial scrutiny.\n\n"
                "Justice Chandrachud, in dissent, went further — holding the entire Act unconstitutional because "
                "(a) it was passed as a Money Bill in fraud of the Constitution to bypass Rajya Sabha, and "
                "(b) even welfare use creates a surveillance state capable of profiling citizens."
            ),
            "conclusion": (
                "The Supreme Court delivered a landmark 4:1 majority verdict: (1) The Aadhaar framework for "
                "government welfare delivery was UPHELD — mandatory linkage for subsidies, PAN, and DBT is valid; "
                "(2) Section 57 (private entity use) was STRUCK DOWN — banks and telecom companies cannot mandate "
                "Aadhaar; (3) Section 33(2) (metadata disclosure without court order) was STRUCK DOWN; "
                "(4) Section 47 was READ DOWN — individuals, not just UIDAI, can file complaints; "
                "(5) Children's Aadhaar enrolment cannot be compulsory for school admission. Parliament "
                "subsequently enacted the Aadhaar (Amendment) Act, 2019 to implement these directions. "
                "The ruling permanently shaped how biometric identity systems operate in India and became "
                "foundational for the Digital Personal Data Protection Act, 2023."
            )
        },
    ),
    JudicialDoc(
        id="SC-PRIVACY-2017-PUTTASWAMY-I",
        court="Supreme Court of India",
        date="2017-08-24",
        title="Right to Privacy as a Fundamental Right",
        parties="K.S. Puttaswamy v. Union of India (Privacy-I)",
        acts=["Constitution of India"],
        sections=["Article 12", "Article 13", "Article 14", "Article 19", "Article 21"],
        summary=(
            "A nine-judge Constitution Bench unanimously declared that the right to privacy is a fundamental "
            "right guaranteed under Part III of the Constitution, primarily under Article 21 read with Articles "
            "14 and 19. This overruled the earlier M.P. Sharma (1954) and Kharak Singh (1962) judgments that "
            "had denied privacy the status of a fundamental right."
        ),
        key_points=[
            "Privacy is an intrinsic part of life and liberty under Article 21 — unanimous 9-judge bench.",
            "M.P. Sharma (1954) and Kharak Singh (1962) are OVERRULED — both denied fundamental right to privacy.",
            "Privacy encompasses informational privacy, bodily integrity, decisional autonomy, and spatial privacy.",
            "Privacy is not absolute — state can restrict it if the restriction is lawful, proportionate, and has legitimate aim.",
            "Sexual orientation is protected under the privacy right — foundation for Navtej Johar (decriminalising s.377).",
            "Data protection framework is implicitly mandated — Parliament must enact legislation.",
        ],
        citations=["(2017) 10 SCC 1", "AIR 2017 SC 4161"],
        languages=["en", "hi", "doi"],
        full_summary=(
            "BACKGROUND & CONSTITUTIONAL SIGNIFICANCE\n"
            "This nine-judge bench judgment is considered one of the most important constitutional pronouncements "
            "in Indian legal history. It arose as a preliminary question in the Aadhaar challenge: does the "
            "Constitution guarantee a right to privacy? Earlier judgments (M.P. Sharma, 1954 — 8 judges; "
            "Kharak Singh, 1962 — 6 judges) had held it does not, or only partially. The Court constituted a "
            "9-judge bench to conclusively resolve this.\n\n"
            "WHAT THE COURT CHANGED — OVERRULING PRECEDENT\n"
            "The Court overruled M.P. Sharma v. Satish Chandra (1954) and Kharak Singh v. State of UP (1962) "
            "which both denied a standalone constitutional right to privacy. Six separate concurring opinions "
            "unanimously reached the same conclusion: privacy is fundamental. The shift was seismic — it "
            "opened the door to challenges against surveillance laws, Aadhaar compulsion, LGBTQ+ "
            "criminalisation, and food/lifestyle choices.\n\n"
            "DIMENSIONS OF PRIVACY RECOGNISED\n"
            "1. Bodily Integrity: The state cannot compel physical intrusion without legal authority and "
            "proportionate justification. This dimension underpins challenges to mandatory biometrics.\n"
            "2. Informational Privacy: Citizens have a right to control information about themselves. The Court "
            "directed Parliament to create a data protection regime — leading eventually to the Digital Personal "
            "Data Protection Act, 2023.\n"
            "3. Decisional Autonomy: Individuals have the right to make personal choices — whom to love, marry, "
            "associate with — without state interference. This directly enabled the Navtej Johar (2018) ruling "
            "decriminalising consensual same-sex relations.\n"
            "4. Spatial Privacy: The sanctity of the home and personal space is protected. Surveillance of "
            "private spaces requires judicial authorisation.\n\n"
            "ARTICLE-BY-ARTICLE BREAKDOWN\n"
            "Article 21 (Life and Personal Liberty): Privacy is an inalienable attribute of human dignity — "
            "it is inseparable from the right to life and liberty. Any interference must satisfy (i) legality: "
            "backed by a statute; (ii) legitimate aim: serving a public interest; (iii) proportionality: the "
            "least restrictive means for achieving the aim; (iv) procedural guarantees: safeguards against abuse.\n"
            "Article 19 (Freedoms): Privacy protects the space within which citizens exercise free speech, "
            "association, and movement. Surveillance that chills these freedoms is constitutionally suspect.\n"
            "Article 14 (Equality): Arbitrary invasions of privacy without intelligible basis violate equality.\n\n"
            "DOWNSTREAM IMPACT ON GOVERNMENT & LAW\n"
            "Navtej Singh Johar v. Union of India (2018): Section 377 IPC decriminalised — privacy upheld.\n"
            "Aadhaar case (2018 — Puttaswamy-II): Proportionality framework directly applied to strike down "
            "private-entity use of biometrics and police access without courts.\n"
            "Joseph Shine v. Union of India (2018): Adultery (s.497 IPC) struck down using privacy + dignity.\n"
            "Digital Personal Data Protection Act, 2023: Parliament's legislative response to the Court's "
            "direction to enact a data protection law. Rights of data principals, Data Protection Board, "
            "consent-based processing — all flow from Puttaswamy-I's mandate."
        ),
        publication_url="https://indiankanoon.org/doc/91938676/",
        official_source="Indian Kanoon",
    ),
    JudicialDoc(
        id="SC-ARBITRATION-2023-NTPC-SPML",
        court="Supreme Court of India",
        date="2023-08-17",
        title="Arbitration: stamp duty and enforceability of agreements",
        parties="N.N. Global Mercantile Pvt. Ltd. v. Indo Unique Flame Ltd. & Ors (5-judge bench review)",
        acts=["Arbitration and Conciliation Act, 1996", "Indian Stamp Act, 1899"],
        sections=["A&C Act s.7", "A&C Act s.8", "A&C Act s.11", "A&C Act s.16", "Stamp Act s.35"],
        summary=(
            "A 5-judge Constitution Bench overruled an earlier 3-judge ruling and held that an arbitration "
            "agreement in an unstamped or insufficiently stamped contract renders the agreement non-existent, "
            "unenforceable, and invalid in law — courts cannot refer parties to arbitration when stamping is "
            "defective. This significantly changed India's arbitration landscape before Parliament legislatively "
            "reversed it through the Arbitration Amendment Act, 2024."
        ),
        key_points=[
            "Unstamped/insufficiently stamped arbitration agreements are NOT enforceable — cannot be referred under s.8/s.11.",
            "Kompetenz-kompetenz (s.16) does not override the threshold defect — the agreement must be valid first.",
            "Courts at referral stage (s.8/s.11) can examine stamping deficiency — this is a jurisdictional preliminary.",
            "Separability doctrine (s.7) does not save an agreement inside an instrument that is invalid for want of stamp.",
            "Parliament responded: Arbitration (Amendment) Act 2024 reversed the ruling — stamp defects now curable.",
            "Practical impact: hundreds of arbitrations stayed pending re-stamping/curative processes.",
        ],
        citations=["(2023) 7 SCC 1", "2023 SCC OnLine SC 495"],
        languages=["en", "hi", "doi"],
        full_summary=(
            "BACKGROUND & CONFLICT IN COURTS\n"
            "The question was whether courts at the section 8 (stay of suit in favour of arbitration) and "
            "section 11 (appointment of arbitrator) stage could refuse to refer parties to arbitration solely "
            "because the underlying contract was unstamped. An earlier 3-judge bench in SMS Tea Estates (2011) "
            "and N.N. Global-I (3-judge, 2021) had given conflicting answers. In 2023, a 5-judge Constitution "
            "Bench revisited the question.\n\n"
            "WHAT THE SUPREME COURT CHANGED\n"
            "The 5-judge bench (3:2 majority) overruled the 3-judge N.N. Global-I decision and held:\n"
            "1. An unstamped or insufficiently stamped instrument is not merely 'inadmissible' — it is "
            "non-existent and invalid. It cannot form the legal foundation for arbitration proceedings.\n"
            "2. The arbitration agreement embedded in such an instrument also fails — even though s.7 "
            "treats it as a separate agreement, you cannot sever a valid agreement from a void document.\n"
            "3. Courts must impound unstamped instruments at the s.8/s.11 stage and send them for stamping "
            "before any referral to arbitration.\n\n"
            "LEGAL PRINCIPLES ANALYSED\n"
            "Section 7 A&C Act (Arbitration Agreement): Defines what constitutes a valid arbitration agreement. "
            "The majority held 'validity' presupposes an instrument that law recognises — an unstamped one "
            "does not achieve legal recognition under the Stamp Act (s.35), so there is nothing to sever.\n"
            "Section 11 A&C Act (Appointment of Arbitrator): Courts approached under s.11 were held to have an "
            "obligation to verify the prima facie existence of the arbitration agreement — stamping defects "
            "go to that very existence.\n"
            "Section 16 A&C Act (Kompetenz-kompetenz): The tribunal's power to rule on its own jurisdiction "
            "cannot substitute for the threshold legality of the instrument. If there is no valid agreement, "
            "there is no jurisdiction to confer.\n"
            "Section 35 Indian Stamp Act: Unstamped instruments 'shall not be admitted in evidence' — the "
            "majority interpreted this as rendering the instrument, and agreements within it, without legal "
            "effect until stamped and penalty paid.\n\n"
            "GOVERNMENT SECTOR IMPACT\n"
            "This ruling severely disrupted infrastructure and government contract arbitrations: (1) NHAI, "
            "NTPC, railways, and state PSUs faced hundreds of arbitration proceedings being challenged on "
            "stamp duty grounds; (2) State governments had varying stamp duty rates, creating forum shopping "
            "risks; (3) Commercial courts were flooded with impounding applications.\n\n"
            "LEGISLATIVE REVERSAL\n"
            "Parliament passed the Arbitration and Conciliation (Amendment) Act, 2024, which inserted a new "
            "proviso: stamp defects do not invalidate arbitration agreements and are curable — courts must refer "
            "parties to arbitration and the arbitral tribunal can deal with stamping. This effectively overturned "
            "the 5-judge ruling legislatively and restored the pro-arbitration position."
        ),
        publication_url="https://indiankanoon.org/search/?formInput=NN%20Global%20Mercantile%205%20judge",
        official_source="Indian Kanoon",
    ),
    JudicialDoc(
        id="SC-RESERVATION-2022-EWS",
        court="Supreme Court of India",
        date="2022-11-07",
        title="EWS Reservation — 10% for Economically Weaker Sections (103rd Constitutional Amendment)",
        parties="Janhit Abhiyan v. Union of India",
        acts=["Constitution of India (103rd Amendment Act, 2019)"],
        sections=["Article 15(6)", "Article 16(6)", "Article 46", "Article 368"],
        summary=(
            "A 5-judge Constitution Bench upheld (3:2 majority) the 103rd Constitutional Amendment that "
            "provides 10% reservation in education and employment for Economically Weaker Sections (EWS) "
            "from the general category. The dissent held it violates the basic structure by using economic "
            "criteria to exclude SC/ST/OBC communities — breaching equality and the anti-exclusion principle."
        ),
        key_points=[
            "EWS 10% reservation UPHELD by 3:2 majority — Articles 15(6) and 16(6) are valid.",
            "Exclusion of SC/ST/OBC from EWS quota does NOT violate equality (majority view).",
            "50% reservation ceiling (Indra Sawhney, 1992) applies only to backward-class reservations — EWS is separate.",
            "Economic criterion alone is a valid basis for special provision under Articles 15 and 16.",
            "Dissent: The Amendment violates basic structure — equality and the principle of non-exclusion of historically marginalised.",
            "Government sector hiring and all central/state educational institutions must implement EWS quota.",
        ],
        citations=["(2023) 2 SCC 1", "2022 SCC OnLine SC 1540"],
        languages=["en", "hi", "doi"],
        full_summary=(
            "BACKGROUND & THE AMENDMENT\n"
            "The Constitution (103rd Amendment) Act, 2019 inserted Articles 15(6) and 16(6), enabling the "
            "state to make special provisions for EWS citizens — defined as those with annual family income "
            "below ₹8 lakh and not owning large land or residential properties. The 10% reservation was "
            "in addition to existing reservations for SC/ST/OBC, but specifically excluded those communities "
            "from EWS eligibility.\n\n"
            "WHAT THE SUPREME COURT UPHELD (MAJORITY — 3:2)\n"
            "1. Economic criterion is constitutionally valid: Articles 15 and 16 already permit protective "
            "discrimination based on various grounds. Adding economic weakness is a legitimate state aim.\n"
            "2. 50% ceiling not breached by EWS: The Indra Sawhney (Mandal – 1992) 50% cap applies to "
            "reservations under Articles 15(4)/16(4) for backward classes. EWS falls under the new Articles "
            "15(6)/16(6) — a separate constitutional provision with its own ceiling.\n"
            "3. Excluding SC/ST/OBC from EWS is valid: These communities already have their own reservations "
            "(Articles 15(4), 16(4)) — creating a separate EWS category for general category poor does not "
            "amount to hostile discrimination against SC/ST/OBC.\n\n"
            "THE DISSENT (Justices Ravindra Bhat & Hima Kohli)\n"
            "The dissent held the Amendment violates the basic structure of the Constitution on three grounds:\n"
            "1. The equality doctrine and the anti-exclusion principle: SC/ST/OBC communities have the worst "
            "economic indicators — excluding them from EWS while creating a quota for general category poor "
            "perpetuates their exclusion and violates substantive equality.\n"
            "2. The foundational premise of Indian reservations is historical discrimination, not poverty alone "
            "— using pure economic criterion inverts the constitutional scheme.\n"
            "3. The Amendment fundamentally changes the equality code — a basic structure element — without "
            "following the correct constitutional framework.\n\n"
            "ARTICLE-BY-ARTICLE BREAKDOWN\n"
            "Article 15(6) [NEW]: State may make special provisions for EWS for admission to educational "
            "institutions (up to 10%), including private unaided institutions but excluding minority institutions.\n"
            "Article 16(6) [NEW]: State may make provisions for EWS reservation in public employment appointments.\n"
            "Article 46 (Directive Principle): Promotion of educational and economic interests of weaker sections "
            "— the Amendment operationalises this Directive Principle into enforceable rights.\n"
            "Article 368 (Amendment power): Court confirmed Parliament had power to amend these provisions "
            "without touching the basic structure (per majority).\n\n"
            "GOVERNMENT SECTOR IMPACT\n"
            "All Central Government ministries, public sector undertakings, autonomous bodies, and central "
            "educational institutions (IITs, IIMs, AIIMS, central universities) must now maintain 10% EWS "
            "roster in hiring and admissions. State governments must separately legislate or notify EWS "
            "implementation. The ruling settled a major political and legal controversy — giving constitutional "
            "backing to a policy that affects lakhs of aspirants annually."
        ),
        publication_url="https://indiankanoon.org/doc/644640/",
        official_source="Indian Kanoon",
    ),
    JudicialDoc(
        id="SC-NELP-2023-ELECTORAL-BONDS",
        court="Supreme Court of India",
        date="2024-02-15",
        title="Electoral Bonds Scheme struck down — Right to Information in political funding",
        parties="Association for Democratic Reforms v. Union of India",
        acts=["Constitution of India", "Representation of the People Act, 1951", "Income Tax Act, 1961", "Companies Act, 2013", "Foreign Contribution (Regulation) Act, 2010"],
        sections=["Article 19(1)(a)", "Article 14", "RPA s.29C", "Companies Act s.182", "Income Tax Act s.13A"],
        summary=(
            "A unanimous 5-judge Constitution Bench struck down the Electoral Bonds Scheme, 2018, holding it "
            "violates voters' fundamental right to political information under Article 19(1)(a). The Court "
            "directed SBI to stop issuing bonds and submit all donor-donee data to the Election Commission for "
            "public disclosure. Amendments to RPA, Companies Act and IT Act enabling the scheme were also struck down."
        ),
        key_points=[
            "Electoral Bonds Scheme STRUCK DOWN unanimously — violates Article 19(1)(a) right to know.",
            "Voter's right to know the source of political funding is a fundamental right — anonymous bonds unconstitutional.",
            "RPA Amendment (removing disclosure for electoral bonds) STRUCK DOWN.",
            "Companies Act Amendment (allowing unlimited corporate funding and removing profit conditionality) STRUCK DOWN.",
            "SBI directed to disclose all bond purchase and redemption data to Election Commission.",
            "The 'alternative' of corporate donations via transparent cheque/digital mode is less-restrictive means.",
            "Confidentiality argument (donor security) fails proportionality — less invasive alternatives available.",
        ],
        citations=["(2024) 6 SCC 1", "2024 SCC OnLine SC 240"],
        languages=["en", "hi", "doi"],
        full_summary=(
            "BACKGROUND & THE SCHEME\n"
            "The Electoral Bonds Scheme, 2018 was introduced through Finance Act amendments and allowed any "
            "Indian citizen or company to purchase bearer bonds from SBI in denominations from ₹1,000 to \n"
            "₹1 crore and donate them to registered political parties. The bonds were anonymous — the bank "
            "would not disclose who purchased them or which party received them. Amendments to the RPA, "
            "Companies Act, and Income Tax Act enabled the scheme by removing disclosure requirements.\n\n"
            "WHAT THE SUPREME COURT STRUCK DOWN\n"
            "1. The Electoral Bonds Scheme itself: The issuance, sale, and redemption of anonymous electoral "
            "bonds is unconstitutional as it destroys voters' right to know the source of political party funding.\n"
            "2. RPA s.29C Amendment: Previously, political parties had to disclose donations above ₹20,000. The "
            "amendment excluded electoral bonds from this disclosure — struck down.\n"
            "3. Companies Act s.182 Amendment: (a) Removed the requirement that companies be profit-making to "
            "donate; and (b) Removed the cap of 7.5% of average three-year net profit on donations. Both "
            "struck down — they enable unlimited corporate funding without accountability.\n"
            "4. IT Act s.13A Amendment: Political parties were exempted from disclosing electoral bond income "
            "in their income tax returns — struck down.\n\n"
            "THE CONSTITUTIONAL ANALYSIS\n"
            "Article 19(1)(a) — Right to Information in Political Funding: The Court held that citizens have a "
            "fundamental right to know who is funding political parties, because money in politics influences "
            "policy. Anonymity of donors serves only the interest of donors and recipient parties — not voters. "
            "The scheme fails proportionality: the stated aim (protecting donors from political victimisation) "
            "doesn't justify blanket anonymity — selective disclosure to regulators (EC, CBI, IT Dept) while "
            "maintaining public anonymity is a less-restrictive alternative.\n"
            "Article 14 — Arbitrariness: Allowing unlimited anonymous corporate donations while capping "
            "individual donations creates an arbitrary distinction. Companies (artificial legal persons) having "
            "unlimited anonymous funding rights while individual citizens have limits violates equal treatment.\n\n"
            "GOVERNMENT & ELECTION COMMISSION DIRECTIONS\n"
            "1. SBI was directed to immediately stop issuing bonds and submit a complete list of bond purchasers "
            "and redeemers to the Election Commission of India by a fixed date.\n"
            "2. ECI directed to publish all data on its official website — the data revealed ₹16,518 crore in "
            "electoral bonds had been purchased between 2018-2024.\n"
            "3. The ruling reignited debate on state funding of elections and the necessity of transparent "
            "campaign finance reform in India."
        ),
        publication_url="https://indiankanoon.org/doc/1399858/",
        official_source="Indian Kanoon",
    ),
]


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=6, max_length=200)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=6, max_length=200)


class GoogleAuthRequest(BaseModel):
    credential: str = Field(min_length=20, max_length=8000)
    email: Optional[str] = Field(default=None, max_length=200)
    name: Optional[str] = Field(default=None, max_length=200)
    picture: Optional[str] = Field(default=None, max_length=2000)
    google_sub: Optional[str] = Field(default=None, max_length=200)
    email_verified: Optional[bool] = None


@router.get("/auth/google/config")
def auth_google_config() -> Dict[str, Any]:
    client_id = (
        os.getenv("GOOGLE_CLIENT_ID")
        or os.getenv("VITE_GOOGLE_CLIENT_ID")
        or _GOOGLE_CLIENT_ID_FALLBACK
    ).strip()
    android_client_id = (os.getenv("GOOGLE_ANDROID_CLIENT_ID") or "").strip()
    ios_client_id = (os.getenv("GOOGLE_IOS_CLIENT_ID") or "").strip()
    return {
        "client_id": client_id,
        "android_client_id": android_client_id,
        "ios_client_id": ios_client_id,
    }


@router.post("/auth/signup")
def auth_signup(body: SignupRequest) -> Dict[str, Any]:
    email = body.email.strip().lower()
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Invalid email")
    
    # Try DB first
    try:
        existing = users_collection.find_one({"email": email})
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")
    except Exception:
        pass

    if email in USERS:
        raise HTTPException(status_code=409, detail="Email already registered")
    
    new_user = {
        "name": body.name.strip(),
        "email": email,
        "password_hash": _hash_pw(body.password),
        "created_at": int(time.time()),
    }
    
    try:
        users_collection.insert_one(new_user)
    except Exception:
        USERS[email] = new_user # Fallback to memory
    
    token = _make_auth_token(email)
    return {"token": token, "user": {"name": new_user["name"], "email": email}}


@router.post("/auth/login")
def auth_login(body: LoginRequest) -> Dict[str, Any]:
    email = body.email.strip().lower()
    u = None
    try:
        u = users_collection.find_one({"email": email})
    except Exception:
        pass
    
    if not u:
        u = USERS.get(email)
        
    if not u or not _verify_pw(body.password, u.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = _make_auth_token(email)
    return {"token": token, "user": {"name": u.get("name"), "email": u.get("email")}}


@router.post("/auth/google")
def auth_google(body: GoogleAuthRequest) -> Dict[str, Any]:
    if not google_id_token or not GoogleRequest:
        raise HTTPException(status_code=500, detail="Google auth dependencies are missing")

    google_client_id = (
        os.getenv("GOOGLE_CLIENT_ID")
        or os.getenv("VITE_GOOGLE_CLIENT_ID")
        or _GOOGLE_CLIENT_ID_FALLBACK
    ).strip()
    raw_ids = (os.getenv("GOOGLE_CLIENT_IDS") or "").strip()
    allowed_client_ids = {google_client_id}
    if raw_ids:
        allowed_client_ids.update({x.strip() for x in raw_ids.split(",") if x.strip()})
    allowed_client_ids = {x for x in allowed_client_ids if x}
    if not google_client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured")

    try:
        # Dev-friendly verification:
        # verify signature/issuer/time first, allow local audience mismatch.
        token_data = google_id_token.verify_oauth2_token(
            body.credential,
            GoogleRequest(),
            None,
        )
    except Exception:
        # Local fallback: allow development when cert/audience checks fail.
        try:
            token_data = _decode_jwt_payload_unverified(body.credential)
        except Exception:
            # Mobile Expo fallback: accept profile fields sent by client after
            # Google userinfo endpoint lookup, when ID token is unavailable.
            if body.email:
                token_data = {
                    "email": body.email,
                    "name": body.name or "Google User",
                    "sub": body.google_sub or "",
                    "picture": body.picture or "",
                    "email_verified": bool(body.email_verified),
                    "exp": int(time.time()) + 300,
                }
            else:
                raise HTTPException(status_code=401, detail="Invalid Google token")

    # Minimal freshness check for both verified and fallback paths.
    try:
        if int(token_data.get("exp", 0)) < int(time.time()):
            raise HTTPException(status_code=401, detail="Google token expired")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    email = str(token_data.get("email") or body.email or "").strip().lower()
    name = str(token_data.get("name") or body.name or "Google User").strip() or "Google User"
    email_verified = token_data.get("email_verified")
    if email_verified is None:
        email_verified = body.email_verified
    email_verified = bool(email_verified)
    google_sub = str(token_data.get("sub") or body.google_sub or "").strip()
    picture = str(token_data.get("picture") or body.picture or "").strip()

    if not email or "@" not in email or "." not in email or not email_verified:
        raise HTTPException(status_code=401, detail="Google account email is not verified")

    # Note: USERS in-memory dict has been removed in favor of users_collection.


    # Persist/update Google user in MongoDB.
    try:
        users_collection.update_one(
            {"email": email},
            {
                "$set": {
                    "email": email,
                    "name": name,
                    "google_sub": google_sub,
                    "picture": picture,
                    "provider": "google",
                    "updated_at": datetime.utcnow(),
                },
                "$setOnInsert": {
                    "created_at": datetime.utcnow(),
                },
            },
            upsert=True,
        )
    except Exception:
        # Do not block login if DB is temporarily unavailable.
        USERS[email] = {
            "email": email,
            "name": name,
            "provider": "google",
            "created_at": int(time.time()),
        }

    token = _make_auth_token(email)
    return {"token": token, "user": {"name": name, "email": email}}


@router.get("/auth/me")
def auth_me(authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    u = _require_user(authorization)
    return {"user": {"name": u["name"], "email": u["email"]}}


def _normalize(s: str) -> str:
    return (s or "").strip().lower()


def _build_detailed_summary(doc: JudicialDoc) -> str:
    """
    Build a comprehensive, multi-paragraph narrative summary for UI display.
    If the doc has a pre-written full_summary, use it verbatim (it already contains
    section headings and paragraphs). Otherwise fall back to a structured template.
    """
    # Use the rich pre-written summary if available
    if doc.full_summary and len(doc.full_summary) > 300:
        base = doc.full_summary.strip()
    else:
        base = (doc.summary or "").strip()

    acts = ", ".join(doc.acts) if doc.acts else "relevant statutory framework"
    sections_list = ", ".join(doc.sections) if doc.sections else "key constitutional/legal provisions"
    cites = ", ".join(doc.citations) if doc.citations else ""

    # If the full_summary is already detailed enough, return it with citation appended
    if len(base) > 500:
        cite_line = f"\n\nAUTHORITATIVE CITATIONS\n{cites}" if cites else ""
        return base + cite_line

    # Fallback structured template for documents without a pre-written full_summary
    parts: List[str] = []

    parts.append(
        f"CASE OVERVIEW\n"
        f"This matter — {doc.title} — concerns {doc.parties} before the {doc.court}, decided on {doc.date}. "
        f"The legal analysis principally engages with {acts}, specifically {sections_list}."
    )

    if base:
        parts.append(f"\nSUMMARY OF RULING\n{base}")

    if doc.key_points:
        kp_text = "\n".join(f"• {kp}" for kp in doc.key_points)
        parts.append(f"\nKEY LEGAL HOLDINGS\n{kp_text}")

    parts.append(
        f"\nLEGAL FRAMEWORK APPLIED\n"
        f"The {doc.court} evaluated this dispute under {acts}. "
        f"The critical statutory and constitutional provisions included {sections_list}. "
        f"The Court balanced the legislative intent of these provisions against constitutional safeguards, "
        f"applying established tests of proportionality, procedural fairness, and judicial review."
    )

    parts.append(
        "\nPRACTICAL IMPACT ON GOVERNMENT SECTOR\n"
        "The ruling establishes binding precedent that guides how public authorities, government departments, "
        "courts, and citizens must approach similar disputes. Public sector entities must align their policies "
        "and decision-making with the principles laid down. Non-compliance can lead to constitutional "
        "challenges, contempt proceedings, and judicial intervention."
    )

    if cites:
        parts.append(f"\nAUTHORITATIVE CITATIONS\n{cites}")

    return "\n".join(parts)


def _act_definition(act: str) -> str:
    t = _normalize(act)
    if "rti" in t or "right to information" in t:
        return (
            "Right to Information Act, 2005: Grants every citizen a legal right to request information from "
            "public authorities. It covers any material in any form (records, data, reports, e-mails, contracts) "
            "held by government bodies. Public authorities must respond within 30 days (48 hours for life/liberty). "
            "Exemptions under s.8 include national security, privacy, fiduciary information, and commercial "
            "confidence — all interpreted narrowly. The Act has a non-obstante clause (s.22) that overrides "
            "conflicting secrecy provisions in other laws. Central and State Information Commissions adjudicate disputes."
        )
    if "aadhaar" in t:
        return (
            "Aadhaar (Targeted Delivery of Financial and Other Subsidies, Benefits and Services) Act, 2016: "
            "Establishes and governs India's unique biometric identity system (12-digit Aadhaar number) "
            "administered by UIDAI. It authorises collection of biometric data (fingerprints, iris scans), "
            "demographic data, and their storage in the Central Identities Data Repository (CIDR). "
            "Post-Puttaswamy-II (2018): private entities cannot mandate Aadhaar; police cannot access CIDR "
            "without a court order; individuals can file complaints (not just UIDAI). "
            "Amended by Aadhaar (Amendment) Act, 2019 to implement the Supreme Court directions."
        )
    if "constitution" in t and "amendment" not in t:
        return (
            "Constitution of India (1950): The supreme law of India. Part III (Articles 12–35) guarantees "
            "fundamental rights — including equality (Art.14), freedom of speech/profession (Art.19), "
            "right to life and liberty (Art.21, includes privacy per Puttaswamy-I 2017), and remedies (Art.32). "
            "Part IV contains Directive Principles of State Policy — non-enforceable but guiding legislature. "
            "Part XX (Art.368) governs constitutional amendments — subject to 'basic structure' doctrine "
            "(Kesavananda Bharati, 1973) which prevents Parliament from destroying the Constitution's core identity."
        )
    if "103rd" in t or "103" in t:
        return (
            "Constitution (103rd Amendment) Act, 2019: Inserted Articles 15(6) and 16(6) to provide 10% "
            "reservation in education and government employment for Economically Weaker Sections (EWS) "
            "from the general category (those with annual family income below ₹8 lakh). "
            "Upheld by Supreme Court (5-judge bench, 3:2 majority) in Janhit Abhiyan v. UOI (2022)."
        )
    if "arbitration" in t and "conciliation" in t:
        return (
            "Arbitration and Conciliation Act, 1996: India's principal statute governing arbitral proceedings, "
            "enforcement of awards, and domestic and international commercial arbitration. Key provisions: "
            "s.7 (arbitration agreement must be in writing); s.8 (court must refer to arbitration if valid "
            "agreement exists); s.11 (court appoints arbitrator if parties fail); s.16 (tribunal rules on "
            "its own jurisdiction — kompetenz-kompetenz); s.34 (grounds for setting aside an award); "
            "s.36 (award is enforceable as a decree). Repeatedly amended (2015, 2019, 2021, 2024) to "
            "reduce court interference and promote institutional arbitration."
        )
    if "stamp" in t:
        return (
            "Indian Stamp Act, 1899: Requires certain instruments (contracts, agreements, conveyances, "
            "instruments creating charges) to bear appropriate stamp duty. Under s.35, unstamped or "
            "insufficiently stamped instruments are inadmissible in evidence as-is. Defects are generally "
            "curable on payment of duty and penalty. The Arbitration (Amendment) Act, 2024 has clarified "
            "that stamp defects do not invalidate arbitration agreements."
        )
    if "representation of the people" in t or "rpa" in t:
        return (
            "Representation of the People Act, 1951: Governs elections to Parliament and State Legislatures. "
            "s.29C requires political parties to disclose donations above ₹20,000 to the Election Commission. "
            "The Electoral Bonds amendment to s.29C was struck down by the Supreme Court in 2024 (ADR case) "
            "for violating voters' right to information about political funding."
        )
    if "prevention of money laundering" in t or "pmla" in t:
        return (
            "Prevention of Money Laundering Act, 2002: India's anti-money-laundering statute requiring "
            "financial institutions, intermediaries, and reporting entities to maintain KYC records, "
            "report suspicious transactions, and prevent laundering of proceeds of crime. Amended multiple "
            "times to strengthen powers of the Enforcement Directorate (ED) — some amendments challenged "
            "in Vijay Madanlal Choudhary v. UOI (2022)."
        )
    if "companies" in t:
        return (
            "Companies Act, 2013: The principal statute governing companies in India — incorporation, "
            "governance, accounts, directors' duties, and mergers. s.182 permits companies to donate up "
            "to 7.5% of average three-year net profit to political parties (and requires disclosure). "
            "The Electoral Bonds amendment removed both the profit conditionality and the 7.5% cap — "
            "struck down by the Supreme Court in 2024."
        )
    if "income tax" in t:
        return (
            "Income Tax Act, 1961: India's comprehensive direct taxation statute. s.13A exempts political "
            "parties from income tax on voluntary contributions subject to maintaining proper records and "
            "not accepting cash above ₹2,000. The Electoral Bonds amendment to s.13A exempted bonds from "
            "disclosure requirements — struck down in the ADR case (2024)."
        )
    if "foreign contribution" in t or "fcra" in t:
        return (
            "Foreign Contribution (Regulation) Act, 2010: Regulates acceptance and utilisation of foreign "
            "contributions by persons, associations, and companies. Political parties are prohibited from "
            "accepting foreign contributions. Amended in 2016 to redefine 'foreign source' in a way that "
            "permitted certain foreign-owned Indian companies to donate — challenged in the ADR case."
        )
    return (
        f"{act}: Relevant statutory framework cited in this dispute. Governs the subject matter of the "
        f"legal proceedings and provides the legislative basis for the rights and obligations at issue."
    )


def _section_definition(section: str) -> str:  # noqa: C901
    s = _normalize(section)
    # Constitutional Articles
    if "article 12" in s:
        return (
            "Article 12 (Definition of 'State'): Defines 'State' for Part III fundamental rights purposes — "
            "includes the Government of India, Parliament, State governments and legislatures, and all local "
            "or other authorities within India or under India's control. This widens the scope of who must "
            "respect fundamental rights."
        )
    if "article 13" in s:
        return (
            "Article 13 (Laws inconsistent with fundamental rights are void): Any pre-constitutional or "
            "post-constitutional law that is inconsistent with or abridges fundamental rights is void to the "
            "extent of inconsistency. This is the textual basis for judicial review of legislation."
        )
    if "article 14" in s:
        return (
            "Article 14 (Equality before law): Guarantees equality before the law and equal protection of "
            "laws to all persons within India. It prohibits arbitrary, unreasonable, or discriminatory "
            "state action. The 'reasonable classification' test allows different treatment if: (i) the "
            "classification is intelligible and non-arbitrary, and (ii) the differentia has a rational nexus "
            "to the object of the law. The Court has increasingly used substantive equality (not just formal "
            "equality) to strike down laws that perpetuate systemic disadvantage."
        )
    if "article 15" in s and "(6)" in s:
        return (
            "Article 15(6) [Inserted by 103rd Amendment, 2019]: Enables the State to make special provisions "
            "for the advancement of any Economically Weaker Section (EWS) of citizens — including reservation "
            "of up to 10% of seats in educational institutions (including private unaided, but not minority "
            "institutions). Upheld by Supreme Court 3:2 in Janhit Abhiyan (2022)."
        )
    if "article 15" in s:
        return (
            "Article 15 (Prohibition of discrimination): Prohibits discrimination on grounds of religion, "
            "race, caste, sex, or place of birth. Articles 15(3) and 15(4) are protective exceptions — "
            "allowing the State to make special provisions for women, children, and socially/educationally "
            "backward classes. Article 15(5) extends this to private unaided educational institutions "
            "(upheld in Pramati Educational Society, 2014)."
        )
    if "article 16" in s and "(6)" in s:
        return (
            "Article 16(6) [Inserted by 103rd Amendment, 2019]: Enables reservation in government "
            "appointments/posts for EWS citizens up to 10%, separate from and in addition to the existing "
            "reservation under Articles 16(4) and 16(4A) for backward classes and SCs/STs."
        )
    if "article 16" in s:
        return (
            "Article 16 (Equality of opportunity in public employment): Guarantees equal opportunity in "
            "matters of public employment. Article 16(4) allows the State to make reservations in public "
            "services for backward classes not adequately represented. The Indra Sawhney (1992) case capped "
            "total reservations under Art.16(4) at 50% (excluding EWS under Art.16(6))."
        )
    if "article 19(1)(a)" in s or ("article 19" in s and "(1)(a)" in s):
        return (
            "Article 19(1)(a) (Freedom of Speech and Expression): Includes the right to know — citizens have "
            "a fundamental right to receive information, including information about political party funding "
            "(ADR v. UOI, 2024) and government decision-making. Restrictions under Art.19(2) must be "
            "reasonable, narrowly tailored, and proportionate — they cannot blanket suppress information "
            "vital to democratic participation."
        )
    if "article 19" in s:
        return (
            "Article 19 (Protection of certain rights): Guarantees six fundamental freedoms: (a) speech and "
            "expression; (b) peaceful assembly; (c) form associations; (d) free movement; (e) reside anywhere; "
            "(g) practise any profession. Each is subject to specified reasonable restrictions (Arts.19(2)-(6)). "
            "The restrictions must be: prescribed by law, serve a listed constitutional objective, and be "
            "proportionate. Surveillance and censorship that chills these freedoms require judicial scrutiny."
        )
    if "article 21" in s:
        return (
            "Article 21 (Protection of life and personal liberty): 'No person shall be deprived of his life "
            "or personal liberty except according to procedure established by law.' The Supreme Court has "
            "progressively expanded 'life and liberty' to include: right to privacy (Puttaswamy-I, 2017); "
            "right to health, livelihood, and environment; right to dignity; right to speedy trial; right "
            "against torture; right to education (partially, also Art.21A). The 'procedure' must be fair, "
            "just, and reasonable — not merely any statutory procedure (Maneka Gandhi v. UOI, 1978)."
        )
    if "article 21a" in s or ("article 21" in s and "(a)" in s):
        return (
            "Article 21A (Right to Education): Inserted by 86th Amendment (2002) — guarantees free and "
            "compulsory education to all children between 6 and 14 years. Implemented through the Right to "
            "Education Act, 2009. Children cannot be compelled to provide Aadhaar for school admission "
            "(per Puttaswamy-II, 2018)."
        )
    if "article 32" in s:
        return (
            "Article 32 (Right to constitutional remedies): Guarantees the right to move the Supreme Court "
            "for enforcement of fundamental rights — considered a fundamental right itself by Dr. Ambedkar "
            "('heart and soul of the Constitution'). The Court can issue writs of habeas corpus, mandamus, "
            "prohibition, quo warranto, and certiorari."
        )
    if "article 46" in s:
        return (
            "Article 46 (Directive Principle — Weaker Sections): The State shall promote the educational and "
            "economic interests of the weaker sections of the people, in particular, of the Scheduled Castes "
            "and the Scheduled Tribes, and shall protect them from social injustice and all forms of exploitation. "
            "This Directive Principle underpins the legislative basis for EWS and backward class reservations."
        )
    if "article 368" in s:
        return (
            "Article 368 (Power to amend the Constitution): Provides the process for constitutional amendments "
            "(special majority + ratification by states for certain provisions). Subject to the 'Basic Structure "
            "Doctrine' (Kesavananda Bharati, 1973) — Parliament cannot amend the Constitution so as to destroy "
            "its basic or essential features (identity, democracy, federalism, judicial review, fundamental rights)."
        )
    # RTI sections
    if "2(f)" in s:
        return (
            "RTI Act Section 2(f) (Definition of 'information'): Defines 'information' very broadly as "
            "any material in any form including records, documents, memos, e-mails, opinions, advices, "
            "press releases, circulars, orders, logbooks, contracts, reports, papers, samples, models, "
            "and data held in electronic form. The Supreme Court in CBSE v. Aditya Bandopadhyay (2011) "
            "confirmed evaluated answer sheets fall within this definition."
        )
    if "s.8" in s or "section 8" in s or ("rti" in s and "8" in s):
        return (
            "RTI Act Section 8 (Exemptions): Lists categories of information exempt from disclosure: national "
            "security/sovereignty, cabinet deliberations, commercial confidence, personal privacy, ongoing "
            "investigations, court privileges, fiduciary information, foreign government information, and parliamentary "
            "privilege. These exemptions are interpreted narrowly — the public interest override in s.8(2) "
            "allows disclosure even of exempted information where public interest outweighs harm."
        )
    if "s.19" in s and "rti" in s:
        return (
            "RTI Act Section 19 (Appeal): First appeal lies to the senior officer in the same public authority. "
            "Second appeal (or complaint) lies to the Central/State Information Commission within 90 days. "
            "The Commission can impose penalties up to ₹25,000 on public information officers for delays or wrongful refusals."
        )
    if "s.22" in s and "rti" in s:
        return (
            "RTI Act Section 22 (Act to have overriding effect — non-obstante clause): The RTI Act prevails "
            "over the Official Secrets Act, 1923, and any other law inconsistent with its provisions. This means "
            "government departments cannot use secrecy statutes to circumvent RTI obligations."
        )
    # Aadhaar sections
    if "aadhaar" in s and "s.7" in s:
        return (
            "Aadhaar Act Section 7 (Proof of Aadhaar number necessary for receipt of certain subsidies): "
            "Allows the Government to require Aadhaar as a condition for receiving government subsidies, "
            "benefits, and services funded from the Consolidated Fund of India. Upheld by Supreme Court "
            "in Puttaswamy-II (2018) for welfare delivery — but not extendable to private services."
        )
    if "aadhaar" in s and "s.29" in s:
        return (
            "Aadhaar Act Section 29 (Restriction on sharing information): Prohibits the UIDAI or any "
            "requesting entity from using biometric information for any purpose other than generation of "
            "Aadhaar numbers and authentication. Biometric data cannot be used for profiling or tracking "
            "individuals without explicit authorisation."
        )
    if "aadhaar" in s and "s.33" in s:
        return (
            "Aadhaar Act Section 33(2) — STRUCK DOWN: This provision allowed a Joint Secretary to authorise "
            "disclosure of identity information from the CIDR in the interest of national security. The Supreme "
            "Court (Puttaswamy-II, 2018) held that authorisation by an executive officer without judicial "
            "oversight was unconstitutional — only a court order can permit such intrusive access to biometrics."
        )
    if "aadhaar" in s and "s.47" in s:
        return (
            "Aadhaar Act Section 47 (Cognizance of offences) — READ DOWN: Originally only UIDAI could file "
            "criminal complaints for violations. The Supreme Court read it down to also allow aggrieved "
            "individuals to file complaints, ensuring accountability beyond UIDAI's exclusive control."
        )
    if "aadhaar" in s and "s.57" in s:
        return (
            "Aadhaar Act Section 57 — STRUCK DOWN ENTIRELY: Allowed private entities (banks, telecom companies) "
            "to use Aadhaar authentication to establish identity. The Supreme Court held this unconstitutional — "
            "commercial use of biometric data for private profit failed the proportionality test. The provision "
            "was formally repealed by the Aadhaar (Amendment) Act, 2019."
        )
    # Arbitration sections
    if ("s.7" in s or "section 7" in s) and "arbitration" in s:
        return (
            "Arbitration Act Section 7 (Arbitration agreement): Defines a valid arbitration agreement — "
            "must be in writing (e-mail, exchange of statements of claim count). The agreement is separate "
            "from the main contract (separability doctrine). An invalid main contract does not necessarily "
            "invalidate the arbitration clause inside it — but an unstamped instrument may make the agreement "
            "unenforceable (N.N. Global, 2023, later reversed by 2024 Amendment)."
        )
    if "s.11" in s or ("section 11" in s and "arbitration" not in s):
        if "arbitration" in s or "a&c" in s:
            return (
                "Arbitration Act Section 11 (Appointment of arbitrators by court): When parties fail to "
                "constitute the tribunal, a party may apply to the Supreme Court / High Court to appoint. "
                "Post-2015 Amendment, courts must refer unless the arbitration agreement is 'null and void, "
                "inoperative or incapable of being performed'. The N.N. Global (2023) ruling temporarily "
                "added stamping defects as a threshold bar — reversed by the 2024 Amendment."
            )
    if "s.16" in s or ("section 16" in s):
        return (
            "Arbitration Act Section 16 (Kompetenz-kompetenz / Tribunal rules on own jurisdiction): The "
            "arbitral tribunal may rule on its own jurisdiction, including any objection about the existence "
            "or validity of the arbitration agreement. Objections must be raised before/with the first "
            "statement of defence. The Supreme Court has held this principle does not override threshold "
            "defects such as an agreement embedded in an unstamped instrument (N.N. Global, 2023)."
        )
    if "stamp" in s and "s.35" in s:
        return (
            "Indian Stamp Act Section 35 (Instruments not duly stamped inadmissible): An instrument not "
            "duly stamped 'shall not be admitted in evidence for any purpose, nor acted upon, registered or "
            "authenticated by any person having by law or consent of parties authority to receive evidence.' "
            "The N.N. Global (2023) Supreme Court ruling interpreted this as making the arbitration agreement "
            "within an unstamped instrument non-existent — a position legislatively reversed in 2024."
        )
    # RPA sections
    if "rpa" in s and "29c" in s or "s.29c" in s:
        return (
            "Representation of the People Act s.29C (Declaration of donation received): Political parties "
            "must file a report with the Election Commission declaring all donations above ₹20,000. "
            "The Electoral Bonds amendment exempted bonds from this requirement — struck down by the "
            "Supreme Court in ADR v. UOI (2024) as violating voters' right to know."
        )
    return (
        f"{section}: Key legal provision referenced in the reasoning and outcome of this case. "
        f"This provision forms part of the statutory or constitutional framework within which the "
        f"court evaluated the rights and obligations of the parties."
    )


def _enrich_doc_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    acts = [str(x) for x in (payload.get("acts") or [])]
    sections = [str(x) for x in (payload.get("sections") or [])]
    payload["act_details"] = [{"name": a, "definition": _act_definition(a)} for a in acts]
    payload["section_details"] = [{"name": s, "definition": _section_definition(s)} for s in sections]
    return payload



_I18N_DOC_FIELDS: Dict[str, Dict[str, Dict[str, Any]]] = {
    "SC-RTI-2011-ADITYA-BANDOPADHYAY": {
        "hi": {
            "summary": "सुप्रीम कोर्ट ने माना कि मूल्यांकित उत्तर-पुस्तिकाएं RTI अधिनियम के तहत सूचना हैं और सीमित अपवाद छोड़कर उपलब्ध कराई जानी चाहिए।",
            "full_summary": "वाद का संदर्भ: अदित्य बंद्योपाध्याय CBSE परीक्षा में असफल होने के बाद अपनी मूल्यांकित उत्तर-पुस्तिकाएं देखने के लिए RTI अधिनिम के तहत आवेदन ािया, जिसे CBSE ने नकार दिया। न्यायालय का परीक्षण: सुप्रीम कोर्ट ने RTI अधिनियम की धारा 2(f) की विस्तृत व्याख्या की और पाया कि CBSE द्वारा रखी गई उत्तर-पुस्तिकाएं 'रिकॉर्ड' की परिभाषा में आती हैं। मुख्य निष्कर्ष: CBSE को निर्देश दिया गया कि वह आवेदक को उसकी उत्तर-पुस्तिका उपलब्ध कराए। चूंकि परीक्षक CBSE का कर्मचारी है, इसलिए कोई फिडऽयूशियरी संबंध स्थापित नहीं होता।",
            "key_points": [
                "उत्तर-पुस्तिका RTI धारा 2(फ) के अंतर्गत सूचना है।",
                "धारा 8 के अपवाद संकीर्ण हैं; बिना कारण सामूहिक इनकार मान्य नहीं।",
                "लोक प्राधिकरण प्रक्रिया का पालन कर सूचना देने के लिए बाध्य है।",
            ],
            "judgment_sections": {
                "facts": "अदित्य बंद्योपाध्याय ने CBSE परीक्षा में असफल होने के बाद अपनी मूल्यांकित उत्तर-पुस्तिकाएं देखने के लिए RTI अधिनियम के तहत आवेदन किया। CBSE ने इनकार कर दिया।",
                "issues": "क्या मूल्यांकित उत्तर-पुस्तिकाएं RTI अधिनियम की धारा 2(f) के तहत 'सूचना' हैं?",
                "petitioner_arguments": "CBSE ने तर्क दिया कि उत्तर-पुस्तिकाएं गोपनीय हैं और विश्वास (fiduciary) के तहत रखी गई हैं।",
                "respondent_arguments": "छात्र ने तर्क दिया कि एक सार्वजनिक प्राधिकरण द्वारा रखी गई कोई भी सामग्री सूचना है।",
                "analysis_of_law": "न्यायालय ने धारा 2(f) की विस्तृत व्याख्या की और पाया कि उत्तर-पुस्तिकाएं 'रिकॉर्ड' की परिभाषा में आती हैं।",
                "precedent_analysis": "न्यायालय ने पिछले निजता और विश्वास संबंधी मामलों को अलग माना।",
                "court_reasoning": "चूंकि परीक्षक CBSE का कर्मचारी है, इसलिए कोई फिड्यूशियरी (विश्वास का) संबंध स्थापित नहीं होता।",
                "conclusion": "CBSE को निर्देश दिया गया कि वह आवेदक को उसकी उत्तर-पुस्तिका उपलब्ध कराए।"
            }
        },
        "doi": {
            "summary": "सुप्रीम कोर्ट ने आख्या कि जांची हुई उत्तर-पुस्तिकाएं RTI कानून तहत जानकारी ने, ते सीमित अपवाद छोड़ के दित्तियां जाणा चाहिदियां ने।",
            "full_summary": "वाद दा संदर्भ: अदित्य बंद्योपाध्याय ने CBSE इम्तिहान च फेल होण दे बाद अपनी जांची हुई उत्तर-पुस्तिकाएं RTI कानून तहत मंगियां। CBSE ने मना कर दित्ता। अदालत दा निर्णय: सुप्रीम कोर्ट ने RTI कानून दी धारा 2(f) गी विस्तृत व्याख्या कीती ते CBSE वल्लों रखीयां उत्तर-पुस्तिकाएं 'रिकॉर्ड' च आउंदियां ने। मुख्य निष्कर्ष: CBSE गी हुकम दित्ता गया जे ओ आवेदक गी उसदी उत्तर-पुस्तिका देवे।",
            "key_points": [
                "उत्तर-पुस्तिका RTI धारा 2(फ) तहत जानकारी एै।",
                "धारा 8 दे अपवाद सीमित निः; बिना वजह इनकार ठीक नै।",
                "सरकारी प्राधिकरण गी नियम अनुसार जानकारी देणी पैंदी एै।",
            ],
            "judgment_sections": {
                "facts": "अदित्य बंद्योपाध्याय ने CBSE इम्तिहान च फेल होण दे बाद अपनी जांची हुई उत्तर-पुस्तिकाएं RTI कानून तहत मंगियां। CBSE ने मना कर दित्ता।",
                "issues": "क्या जांची हुई उत्तर-पुस्तिकाएं RTI कानून दी धारा 2(f) दे तहत 'जानकारी' ने?",
                "petitioner_arguments": "CBSE दा तर्क हा जे उत्तर-पुस्तिकाएं गोपनीय ने ते विश्वास (fiduciary) तहत रखियां गइयां ने।",
                "respondent_arguments": "विद्यार्थी दा तर्क हा जे सरकारी संस्था कोल रखा हर कागज़ जानकारी ऐ।",
                "analysis_of_law": "अदालत ने धारा 2(f) गी बड़ा विस्तृत मन्या ते आखेया जे उत्तर-पुस्तिकाएं 'रिकॉर्ड' च आउंदियां ने।",
                "precedent_analysis": "अदालत ने पिछलें गोपनियता दे केसें गी बक्ख मन्या।",
                "court_reasoning": "क्यूंकि परीक्षक CBSE दा मुलाज़म ऐ, इस वास्ते कोई फिड्यूशियरी रिश्ता नै बनदा।",
                "conclusion": "CBSE गी हुकम दित्ता गया जे ओ आवेदक गी उसदी उत्तर-पुस्तिका देवे।"
            }
        },
        "ur": {
            "summary": "سپریم کورٹ نے فیصلہ دیا کہ جانچی گئی جوابی کاپیاں آر ٹی آئی ایکٹ کے تحت معلومات ہیں اور دی جانی چاہئیں۔",
            "full_summary": "واقعہ کا پس منظر: ادتیہ بندوپادھیائے نے سی بی ایس ای امتحان میں فیل ہونے کے بعد آر ٹی آئی کے تحت اپنی جانچی گئی جوابی کاپیاں مانگیں۔ سی بی ایس ای نے انکار کر دیا۔ عدالت کا فیصلہ: سپریم کورٹ نے RTI کی دفعہ 2(f) کی وسیع تفسیر کی اور کہا کہ جوابی کاپیاں ریکارڈ ہیں۔ چونکہ ممتحن سی بی ایس ای کا ملازم ہے، اس لیے کوئی فڈیشیری تعلق نہیں بنتا۔ سی بی ایس ای کو حکم دیا گیا کہ درخواست گزار کو اس کی جوابی کاپی دی جائے۔",
            "key_points": [
                "جوابی کاپی آر ٹی آئی کی دفعہ 2(ف) کے تحت معلومات ہے۔",
                "دفعہ 8 کے استثناء محدود ہیں؛ بغیر وجہ کے انکار جائز نہیں۔",
                "سرکاری محکمے قانون کے مطابق معلومات دینے کے پابند ہیں۔"
            ],
            "judgment_sections": {
                "facts": "ادتیہ بندوپادھیائے نے سی بی ایس ای امتحان میں فیل ہونے کے بعد اپنی جانچی گئی جوابی کاپیاں آر ٹی آئی کے تحت مانگیں۔ سی بی ایس ای نے انکار کر دیا۔",
                "issues": "کیا جانچی گئی جوابی کاپیاں آر ٹی آئی کی دفعہ 2(f) کے تحت 'معلومات' ہیں؟",
                "petitioner_arguments": "سی بی ایس ای کی دلیل تھی کہ جوابی کاپیاں خفیہ ہیں اور اعتماد (fiduciary) کے تحت رکھی گئی ہیں۔",
                "respondent_arguments": "طالب علم کی دلیل تھی کہ سرکاری ادارے کے پاس موجود ہر دستاویز معلومات ہے۔",
                "analysis_of_law": "عدالت نے دفعہ 2(f) کو وسیع مانا اور کہا کہ جوابی کاپیاں 'ریکارڈ' میں آتی ہیں۔",
                "precedent_analysis": "عدالت نے پچھلے رازداری کے کیسز کو مختلف مانا۔",
                "court_reasoning": "چونکہ ممتحن سی بی ایس ای کا ملازم ہے، اس لیے کوئی فڈیشیری رشتہ نہیں بنتا۔",
                "conclusion": "سی بی ایس ای کو حکم دیا گیا کہ وہ درخواست گزار کو اس کی جوابی کاپی دے۔"
            }
        },
        "ks": {
            "summary": "سپریم کورٹن دیت فیصلہ زہ جانچنہ آمت کاپی چھھں آر ٹی آئی ایکٹس تحت معلومات تہ یم گژھن دنہ ینہۍ۔",
            "full_summary": "واقعہس پس منظر: ادیتیا بندوپادھیائے ین کور سی بی ایس ای امتحانس منز فیل گژھنہ پتہ پننہ جواو کاپیہ آر ٹی آئی تحت طلب۔ سی بی ایس ای ین کور انکار۔ عدالتس فیصلہ: سپریم کورٹن کور RTI دفعہ 2(f) وسیع تہ وُن زہ جواو کاپیہ چھھں ریکارڈس منز یوان۔ تکیازۍ ممتحن چھھہ سی بی ایس ای ہند ملازم، تہۍ کۍن چھنہۍ کانہہ فڈیشیری رشتہ بنان۔ سی بی ایس ای ہس آو حکم دنہ زہ تم دۍن درخواست گزارس تسنز جواو کاپی۔",
            "key_points": [
                "جواو کاپی چھنہۍ آر ٹی آئی دفعہ 2(ف) ہس تحت معلومات۔",
                "دفعہ 8 ہک استثنیٰ چھھں محدود؛ بغیر وجہو انکار چھنہۍ جائز۔",
                "سرکاری ادارہٴ چھھں قانونکس مطابق معلوات دنک پابند۔"
            ],
            "judgment_sections": {
                "facts": "ادیتیا بندوپادھیائے ین کور سی بی ایس ای امتحانس منز فیل گژھنہ پتہ پننہ جواو کاپیہ آر ٹی آئی تحت طلب۔ سی بی ایس ای ین کور انکار۔",
                "issues": "کیا جانچنہ آمت جواو کاپیہ چھا آر ٹی آئی دفعہ 2(f) ہس تحت 'معلومات'؟",
                "petitioner_arguments": "سی بی ایس ای ہنز دلیل ٲس زہ جواو کاپیہ چھِ خفیہ تہ اعتمادس (fiduciary) تحت تھاونہ آمت۔",
                "respondent_arguments": "شاگر ہنز دلیل ٲس زہ سرکاری ادارس نش موجود ہر دستاویز چھِ معلومات۔",
                "analysis_of_law": "عدالتن من مان دفعہ 2(f) وسیع تہ وُن زہ جواو کاپیہ چھِ 'ریکارڈس' منز یوان۔",
                "precedent_analysis": "عدالتن من مان پتم رازداری ہند کیس الگ۔",
                "court_reasoning": "تکیازِ ممتحن چھُ سی بی ایس ای ہند ملازم، تہِ کِن چھنہِ کانہہ فڈیشیری رشتہ بنان۔",
                "conclusion": "سی بی ایس ای ہس آو حکم دنہ زہ تم دِن درخواست گزارس تسنز جواو کاپی۔"
            }
        }
    },
    "SC-AADHAAR-2018-PUTTASWAMY-II": {
        "hi": {
            "summary": "सुप्रीम कोर्ट ने आधार ढांचे को सीमाओं के साथ वैध माना, लेकिन निजी उपयोग और कुछ निगरानी प्रावधानों को असंवैधानिक ठहराया।",
            "full_summary": "वाद का संदर्भ: यह मामला आधार अधिनिम, 2016 की संवैधानिक वैधता, निजता के अधिकार, और राज्य द्वारा बायोमे™्रिक डेटा उपयोग की सीमाओं से संबंधित था। न्यायालय का परीक्षण ढांचा: सुप्रीम कोर्ट ने पुट्टस्वामी-I के सिद्धांतों और proportionality test को लागू किया—वैध उद्देश्य, उपयुक्त साधन, आवश्यकता, और अधिकारों पर न्यूनतम अतिक्रमण। मुख्य निष्कर्ष: सरकारी सब्सिडी के लिए आधार वैध रहा, लेकिन निजी कंपनियों द्वारा उपयोग की अनुमति देने वाली धारा 57 रद्द की गई।",
            "key_points": [
                "कल्याण योजनाओं के लिए आधार मान्य, निजी संस्थाओं द्वारा अनिवार्य उपयोग अमान्य।",
                "निजता और अनुपातिकता परीक्षण को केंद्रीय मानक माना गया।",
                "डेटा उपयोग में राज्य को सीमित, सुरक्षित और उद्देश्य-आधारित मॉडल अपनाना होगा।",
            ],
            "judgment_sections": {
                "facts": "जस्टिस के.एस. पुट्टास्वामी (रिटायर्ड) ने आधार अधिनियम, 2016 की संवैधानिक वैधता को चुनौती दी। यह प्रणाली सरकारी कल्याण योजनाओं, बैंक खातों और मोबाइल सिम के लिए अनिवार्य की गई थी।",
                "issues": "क्या आधार अधिनियम 2016 निजता के मौलिक अधिकार का उल्लंघन करता है? क्या धारा 57 (निजी संस्थाओं द्वारा उपयोग) संवैधानिक रूप से वैध है?",
                "petitioner_arguments": "याचिकाकर्ताओं ने तर्क दिया कि आधार प्रणाली अभूतपूर्व निगरानी वास्तुकला बनाती है और बायोमेट्रिक डेटा अटल है, जिससे निजता भंग होती है।",
                "respondent_arguments": "भारत संघ ने कहा कि आधार धोखाधड़ी को रोककर कल्याणकारी योजनाओं का लक्षित वितरण सुनिश्चित करता है और यह सुरक्षित है।",
                "analysis_of_law": "न्यायालय ने 4-चरणीय आनुपातिकता परीक्षण लागू किया: (1) वैध उद्देश्य (2) तर्कसंगत संबंध (3) आवश्यकता (4) अधिकारों के साथ संतुलन।",
                "precedent_analysis": "कोर्ट ने 2017 के पुट्टास्वामी फैसले पर भरोसा किया जिसने निजता को अनुच्छेद 21 के तहत मौलिक अधिकार माना।",
                "court_reasoning": "कल्याणकारी वितरण के लिए राज्य का हित वैध है। हालांकि, व्यावसायिक लाभ के लिए निजी कंपनियों द्वारा इसका उपयोग आनुपातिकता परीक्षण में विफल रहा।",
                "conclusion": "बहुमत ने सरकारी सब्सिडी के लिए आधार को बरकरार रखा लेकिन निजी कंपनियों द्वारा उपयोग की अनुमति देने वाली धारा 57 को रद्द कर दिया।"
            }
        },
        "doi": {
            "summary": "सुप्रीम कोर्ट ने आधार सिस्टम नूं कुझ हदां नाल वैध मन्या, पर निजी इस्तेमाल ते कुझ निगरानी प्रावधान रद्द कित्ते।",
            "full_summary": "मामले दा संदर्भ: एह केस आधार कानून 2016 दी संवैधानिक वैधता, निजता दे हक, ते सरकार वल्लों बायोमे™्रिक डेटा दे इस्तेमाल दी सीमा बारे सी। अदालत दा कानूनी टेस्ट: सुप्रीम कोर्ट ने proportionality test लागू कीता—वैध मकसद, सही साधन, जरूरत, ते अधिकारां च न्यूनतम दखल। मुख्य निष्कर्ष: सरकारी सब्सिडी लेई आधार वैध रिहा, पर निजी कंपनियां गी इस्तेमाल दी इजाज़त देने आली धारा 57 गी रद्द कित्ती।",
            "key_points": [
                "सरकारी योजनावां लिए आधार मंजूर, निजी कंपनियां लाजमी नै कर सकदियां।",
                "निजता ते अनुपातिकता दा टेस्ट लागू होया।",
                "डेटा इस्तेमाल च सरकार गी सीमित ते सुरक्षित ढांचा अपनोणा पौगा।",
            ],
            "judgment_sections": {
                "facts": "जस्टिस के.एस. पुट्टास्वामी ने आधार कानून, 2016 दी संवैधानिक वैधता गी चुनौती दित्ती। ए सिस्टम सरकारी योजनाएं ते बैंक खाते लेई لازमी कीता गेया हा।",
                "issues": "क्या आधार कानून 2016 निजता दे मौलिक हक दा उल्लंघन करदा ऐ? क्या धारा 57 (निजी कंपनियां दा इस्तेमाल) वैध ऐ?",
                "petitioner_arguments": "याचिकाकर्ताएं दा तर्क हा जे आधार सिस्टम निगरानी ढांचा बनांदा ऐ ते बायोमेट्रिक डेटा अटल ऐ, जिसदे कन्नै निजता दा नुकसान होंदा ऐ।",
                "respondent_arguments": "भारत सरकार ने आखेया जे आधार कन्नै धोखाधड़ी रुकदी ऐ ते कल्याणकारी योजनाएं दा सही लाभ लोकें तक पुजदा ऐ।",
                "analysis_of_law": "अदालत ने 4-चरणें दा टेस्ट लाया: (1) वैध मकसद (2) तर्कसंगत संबंध (3) लोड़ (4) हकें कन्नै संतुलन।",
                "precedent_analysis": "अदालत ने 2017 दे पुट्टास्वामी फैसले दा हवाला दित्ता जिने निजता गी मौलिक हक मन्या हा।",
                "court_reasoning": "कल्याणकारी फायदे लेई सरकार दा मकसद ठीक ऐ। पर मुनाफे लेई निजी कंपनियां द्वारा इसदा इस्तेमाल टेस्ट च फेल होया।",
                "conclusion": "बहुमत ने सरकारी सब्सिडी लेई आधार गी जायज़ मन्या पर निजी कंपनियां गी इस्तेमाल दी इजाज़त देने आली धारा 57 गी रद्द कर दित्ता।"
            }
        },
        "ur": {
            "summary": "سپریم کورٹ نے آدھار ایکٹ کو کچھ حدود کے ساتھ قانونی قرار دیا، لیکن اس کے نجی استعمال کو غیرآئینی قرار دیا۔",
            "key_points": [
                "فلاحی منصوبوں کے لیے آدھار درست، نجی اداروں کا لازمی استعمال غلط۔",
                "پرائیویسی کو بنیادی حق مانا گیا۔",
                "ریاست کو ڈیٹا کے استعمال میں محفوظ ماڈل اپنانا ہوگا۔"
            ],
            "judgment_sections": {
                "facts": "جسٹس کے ایس پٹاسوامی نے آدھار ایکٹ 2016 کی آئینی حیثیت کو چیلنج کیا۔ یہ سسٹم سرکاری اسکیموں، بینک اکاؤنٹس اور موبائل سمز کے لیے لازمی کیا گیا تھا۔",
                "issues": "کیا آدھار ایکٹ 2016 پرائیویسی کے بنیادی حق کی خلاف ورزی کرتا ہے؟ کیا دفعہ 57 (نجی اداروں کا استعمال) درست ہے؟",
                "petitioner_arguments": "درخواست گزاروں کی دلیل تھی کہ آدھار سسٹم نگرانی کا ڈھانچہ بناتا ہے اور بائیو میٹرک ڈیٹا اٹل ہے، جس سے پرائیویسی متاثر ہوتی ہے۔",
                "respondent_arguments": "وفاق ہند کا موقف تھا کہ آدھار دھوکہ دہی کو روکتا ہے اور فلاحی اسکیموں کی صحیح رسائی کو یقینی بناتا ہے۔",
                "analysis_of_law": "عدالت نے 4 مرحلوں پر مشتمل ٹیسٹ کیا: (1) قانونی مقصد (2) منطقی تعلق (3) ضرورت (4) حقوق کے ساتھ توازن۔",
                "precedent_analysis": "عدالت نے 2017 کے پٹاسوامی فیصلے کو بنیاد بنایا جس نے پرائیویسی کو بنیادی حق تسلیم کیا تھا۔",
                "court_reasoning": "فلاحی مقاصد کے لیے ریاست کا مفاد قانونی ہے۔ البتہ، نجی کمپنیوں کا منافع کے لیے اس کا استعمال غیرقانونی ہے۔",
                "conclusion": "عدالت نے سرکاری سبسڈی کے لیے آدھار کو برقرار رکھا لیکن نجی کمپنیوں کو استعمال کی اجازت دینے والی دفعہ 57 کو منسوخ کر دیا۔"
            }
        },
        "ks": {
            "summary": "سپریم کورٹن مان آدھار ایکٹ کیہہ حدودن سیتھ جائز، مگر نجی استعمالن کئرس غیر آئینی قرار۔",
            "full_summary": "کیسس پس منظر: یی کیس آوس آدھار ایکٹ 2016 ہچ آئینی حیثیتت، نجی ذات ہند حق، تہ بایو میٹرک ڈیٹا استعمال ہند حدودن سبند۔ عدالتس ٹیسٹ: سپریم کورٹن لاگو کور proportionality test—قانونی مقصد، مناسب ذریعہ، ضرورت، تہ حقوکن سیتھ توازن۔ فیصلہہ: سرکاری سبسڈی خٲطرٴ آدھار برقرار، مگر نجی کمپنین ہند استعمالچ اجازت دین وٲل دفعہ 57 منسوخ کرکھ۔",
            "key_points": [
                "فلاحی منصوبن خٲطرٴ آدھار درست، نجی ادارن ہند لازمی استعمال غلط۔",
                "پرائیویسی آیہ بنیادی حق ماننہ۔",
                "ریاستس پزۍ ڈیٹا استعمالس منز محفوظ ماڈل اپناوُن۔"
            ],
            "judgment_sections": {
                "facts": "جسٹس کے ایس پٹاسوامی ین کور آدھار ایکٹ 2016 ہچ آئینی حیثیتس چیلنج۔ یِہ سسٹم اوس سرکاری سکیمن، بینک اکاؤنٹن تہ موبائل سمن خٲطرٕ لازمی کرنہ آمت۔",
                "issues": "کیا آدھار ایکٹ 2016 چھا پرائیویسی ہند بنیادی حقچ خلاف ورزی کران؟ کیا دفعہ 57 (نجی ادارن ہند استعمال) چھا درست؟",
                "petitioner_arguments": "عرضی دارن ہنز دلیل ٲس زہ آدھار سسٹم چھُ نگرانی ہند ڈھانچہ بناوان تہ بائیو میٹرک ڈیٹا چھُ ناقابلِ تبدل، یم سیتھ پرائیویسی متاثر چھِ گژھان۔",
                "respondent_arguments": "حکومتِ ہند ہند موقف اوس زہ آدھار چھُ دھوکہ دہی رکاونان تہ فلاحی سکیمن ہنز صحیح رسائی یقینی بناوان۔",
                "analysis_of_law": "عدالتن کور 4 مرہلن پیٹھ مشتمل ٹیسٹ: (1) قانونی مقصد (2) منطقی تعلق (3) ضرورت (4) حقوکن سیتھ توازن۔",
                "precedent_analysis": "عدالتن بنووی 2017 ہک پٹاسوامی فیصلہ بنیاد یمِک پرائیویسی بنیادی حق تسلیم کورمت اوس۔",
                "court_reasoning": "فلاحی مقاصد خٲطرٕ ریاستک مفاد چھُ قانونی۔ البتہ، نجی کمپنین ہند منافعک خٲطرٕ یمیوک استعمال چھُ غیر قانونی۔",
                "conclusion": "عدالتن تھو سرکاری سبسڈی خٲطرٕ آدھار برقرار مگر نجی کمپنین ہند استعمالچ اجازت دین وٲل دفعہ 57 کرکھ منسوخ۔"
            }
        }
    }
}

_TRANS_CACHE: Dict[str, Dict[str, Any]] = {}
_UI_I18N_CACHE: Dict[str, str] = {}


class UiI18nItem(BaseModel):
    key: str = Field(..., min_length=1, max_length=120)
    text: str = Field(..., min_length=0, max_length=5000)


class UiI18nRequest(BaseModel):
    source_lang: str = Field(default="en", min_length=2, max_length=12)
    target_lang: str = Field(..., min_length=2, max_length=12)
    items: List[UiI18nItem] = Field(default_factory=list, max_length=250)


@router.post("/ui/translate")
async def ui_translate(req: UiI18nRequest) -> Dict[str, Any]:
    """
    Translate UI strings for the frontend.

    Uses a fast Google Translate public endpoint first, then falls back to Bhashini/NVIDIA
    if configured. Results are cached in-memory by (target_lang, text-hash).
    """
    target = _normalize(req.target_lang or "en")
    source = _normalize(req.source_lang or "en")

    if target == "en":
        return {"ok": True, "lang": target, "provider": "none", "translations": {it.key: it.text for it in req.items}}

    # Avoid runaway work
    items = [it for it in (req.items or []) if isinstance(it.text, str)]
    if not items:
        return {"ok": True, "lang": target, "provider": "none", "translations": {}}

    sem = asyncio.Semaphore(6)

    async def _one(it: UiI18nItem) -> tuple[str, str, str]:
        raw = (it.text or "").strip()
        if not raw:
            return it.key, "", "none"
        cache_key = f"{target}|{hashlib.sha256(raw.encode('utf-8')).hexdigest()}"
        if cache_key in _UI_I18N_CACHE:
            return it.key, _UI_I18N_CACHE[cache_key], "cache"
        async with sem:
            # Prefer the fast path, then configured providers.
            # Note: _translate_if_needed assumes English->target for now; for UI we accept source but still use fast path.
            out = await _google_translate_fast(raw, target)
            provider = "google_fast"
            if not out:
                res = await bhashini_service.translate_text(raw, source_lang=source, target_lang=target)
                if res.get("ok"):
                    out = str(res.get("text") or raw)
                    provider = str(res.get("provider") or "bhashini")
                else:
                    out = raw
                    provider = "unavailable"
            _UI_I18N_CACHE[cache_key] = out
            return it.key, out, provider

    results = await asyncio.gather(*[_one(it) for it in items])
    translations: Dict[str, str] = {}
    providers: Dict[str, int] = {}
    for k, v, prov in results:
        translations[k] = v
        providers[prov] = providers.get(prov, 0) + 1

    # Report the most common provider used.
    provider = "mixed"
    if providers:
        provider = sorted(providers.items(), key=lambda x: x[1], reverse=True)[0][0]

    return {"ok": True, "lang": target, "provider": provider, "translations": translations}


async def _google_translate_fast(text: str, target_lang: str) -> Optional[str]:
    """Uses a fast public Google Translate endpoint for immediate localized results."""
    if not text or not text.strip() or target_lang == "en":
        return text
    url = "https://translate.googleapis.com/translate_a/single"
    params = {
        "client": "gtx",
        "sl": "en",
        "tl": target_lang,
        "dt": "t",
        "q": text
    }
    try:
        # Use the global persistent client to avoid connection overhead
        resp = await _HTTP_CLIENT.get(url, params=params)
        if resp.status_code == 200:
            data = resp.json()
            if data and data[0]:
                return "".join([part[0] for part in data[0] if part[0]])
    except Exception:
        pass
    return None


async def _translate_if_needed(text: str, target_lang: str) -> str:
    if not text or not text.strip() or target_lang == "en":
        return text
    
    # Fast Path: Try Google Translate first for instant feedback
    fast_text = await _google_translate_fast(text, target_lang)
    if fast_text:
        return fast_text

    # Fail-safe Path: Fallback to Bhashini if Google fails or is too slow
    res = await bhashini_service.translate_text(text, source_lang="en", target_lang=target_lang)
    if res.get("ok"):
        return str(res.get("text") or text)
    return text


async def _localize_doc_payload(payload: Dict[str, Any], lang: str | None, minimal: bool = False) -> Dict[str, Any]:
    l = _normalize(lang or "en")
    if l == "en":
        return payload
    
    doc_id = str(payload.get("id") or "UNKNOWN")
    cache_key = f"{doc_id}|{l}"
    if cache_key in _TRANS_CACHE:
        # Return merged from cache to avoid duplicate work
        cached = _TRANS_CACHE[cache_key]
        for k, v in cached.items():
            payload[k] = v
        return payload

    # 1. Check pre-seeded hardware data
    i18n = _I18N_DOC_FIELDS.get(doc_id, {}).get(l, {})
    if i18n:
        if i18n.get("summary"):
            payload["summary"] = i18n["summary"]
        if i18n.get("full_summary"):
            payload["full_summary"] = i18n["full_summary"]
        elif i18n.get("summary"):
            payload["full_summary"] = i18n["summary"]
        if i18n.get("key_points"):
            payload["key_points"] = i18n["key_points"]
        if i18n.get("judgment_sections"):
            if "judgment_sections" not in payload or not isinstance(payload["judgment_sections"], dict):
                payload["judgment_sections"] = {}
            for k, v in i18n["judgment_sections"].items():
                payload["judgment_sections"][k] = v
        
        # Don't return early - continue to translate missing fields like 'title'
    
    # 2. Dynamic Fallback: Translate missing or English fields concurrently
    sem = asyncio.Semaphore(15)

    async def _t(text: str) -> str:
        if not text or not isinstance(text, str):
            return text
        async with sem:
            return await _translate_if_needed(text, l)

    # Prepare all translation tasks
    top_keys = []
    top_tasks = []
    to_translate = ["title", "parties", "summary", "full_summary", "official_source"]
    if minimal:
        to_translate = ["title", "summary"]

    for field in to_translate:
        if payload.get(field) and isinstance(payload[field], str) and field not in i18n:
            top_keys.append(field)
            top_tasks.append(_t(payload[field]))

    kp_tasks = []
    if not minimal and "key_points" in payload and isinstance(payload["key_points"], list) and "key_points" not in i18n:
        kp_tasks = [_t(str(p)) for p in payload["key_points"]]

    js_keys = []
    js_tasks = []
    if not minimal and "judgment_sections" in payload and isinstance(payload["judgment_sections"], dict):
        i18n_sections = i18n.get("judgment_sections", {})
        for k, v in payload["judgment_sections"].items():
            if k not in i18n_sections and isinstance(v, str):
                js_keys.append(k)
                js_tasks.append(_t(v))

    list_tasks = {"acts": [], "sections": [], "citations": []}
    if not minimal:
        for field in ["acts", "sections", "citations"]:
            if payload.get(field) and isinstance(payload[field], list):
                list_tasks[field] = [_t(str(item)) for item in payload[field]]

    detail_tasks = {"act_details": [], "section_details": []}
    if not minimal:
        for field in ["act_details", "section_details"]:
            if payload.get(field) and isinstance(payload[field], list):
                for item in payload[field]:
                    localized_item = dict(item)
                    detail_tasks[field].append((
                        localized_item,
                        _t(str(localized_item.get("name", ""))),
                        _t(str(localized_item.get("definition", "")))
                    ))

    # Execute all translation tasks in parallel
    all_awaitables = []
    all_awaitables.extend(top_tasks)
    all_awaitables.extend(kp_tasks)
    all_awaitables.extend(js_tasks)
    for field in ["acts", "sections", "citations"]:
        all_awaitables.extend(list_tasks[field])
    for field in ["act_details", "section_details"]:
        for item, name_task, def_task in detail_tasks[field]:
            all_awaitables.extend([name_task, def_task])

    import collections
    results = collections.deque(await asyncio.gather(*all_awaitables) if all_awaitables else [])

    def next_res():
        return results.popleft() if results else ""

    # Assign translated text back to payload
    for k in top_keys:
        payload[k] = next_res()

    if minimal:
        return payload

    if kp_tasks:
        payload["key_points"] = [next_res() for _ in kp_tasks]

    if js_tasks:
        for k in js_keys:
            payload["judgment_sections"][k] = next_res()

    for field in ["acts", "sections", "citations"]:
        if list_tasks[field]:
            payload[field] = [next_res() for _ in list_tasks[field]]

    for field in ["act_details", "section_details"]:
        if detail_tasks[field]:
            new_details = []
            for item, name_task, def_task in detail_tasks[field]:
                item["name"] = next_res()
                item["definition"] = next_res()
                new_details.append(item)
            payload[field] = new_details

    # Cache the localized results
    _TRANS_CACHE[cache_key] = {
        "title": payload.get("title"),
        "parties": payload.get("parties"),
        "summary": payload.get("summary"),
        "full_summary": payload.get("full_summary"),
        "key_points": payload.get("key_points"),
        "judgment_sections": payload.get("judgment_sections"),
        "acts": payload.get("acts"),
        "sections": payload.get("sections"),
        "citations": payload.get("citations"),
        "act_details": payload.get("act_details"),
        "section_details": payload.get("section_details"),
        "official_source": payload.get("official_source")
    }
    
    return payload


# Synonym/alias map for common government-sector search terms
_SYNONYMS: Dict[str, List[str]] = {
    "privacy": ["puttaswamy", "article 21", "fundamental right"],
    "biometric": ["aadhaar", "cidr", "uidai"],
    "aadhaar": ["puttaswamy", "uidai", "biometric"],
    "rti": ["right to information", "cbse", "bandopadhyay"],
    "right to information": ["rti", "cbse"],
    "reservation": ["ews", "janhit", "article 15", "article 16"],
    "ews": ["economically weaker", "janhit", "103rd amendment"],
    "electoral bonds": ["adr", "sbi", "election commission"],
    "election": ["electoral bonds", "adr", "article 19"],
    "arbitration": ["stamp", "nn global", "indo unique"],
    "stamp duty": ["nn global", "arbitration"],
    "article 19": ["freedom", "speech", "electoral"],
    "article 21": ["privacy", "liberty", "puttaswamy"],
    "article 14": ["equality", "arbitrary"],
    "article 15": ["reservation", "discrimination", "ews"],
    "article 16": ["employment", "reservation", "ews"],
    "cbse": ["rti", "answer sheets", "aditya"],
    "fundamental right": ["article 21", "constitution", "puttaswamy"],
    "data protection": ["puttaswamy", "privacy", "aadhaar"],
    "section 377": ["navtej", "privacy", "article 21"],
    "government": ["public authority", "rti", "reservation"],
}


def _doc_matches(doc: JudicialDoc, q: str, court: str | None, act: str | None, lang: str | None) -> bool:
    nq = _normalize(q)
    if nq:
        # Build hay from ALL fields including full_summary
        hay = " ".join(
            [
                doc.id,
                doc.court,
                doc.title,
                doc.parties,
                doc.summary,
                doc.full_summary or "",
                " ".join(doc.acts),
                " ".join(doc.sections),
                " ".join(doc.key_points),
                " ".join(doc.citations),
            ]
        ).lower()

        # Smart search: filter out filler words then check if ALL remaining words match
        filler = {"case", "act", "vs", "v.", "india", "court", "supreme", "the", "a", "of", "in", "and", "to"}
        words = [w for w in nq.split() if w not in filler]
        if not words:  # if query was only filler words, use the whole thing
            words = nq.split()

        # Expand query words using synonym map
        expanded_words: List[str] = []
        for word in words:
            expanded_words.append(word)
            for synonym_key, synonym_values in _SYNONYMS.items():
                if word in _normalize(synonym_key) or _normalize(synonym_key) in word:
                    for sv in synonym_values:
                        if sv not in expanded_words:
                            expanded_words.append(sv)

        # A match if ANY or enough words land in the haystack
        # For multi-word queries: ALL words must match (or their synonyms)
        # For single-word queries: direct or synonym match
        word_matched = all(
            any(w in hay for w in ([word] + [sv for sv in _SYNONYMS.get(word, [])]))
            for word in words
        )
        if not word_matched:
            # Try matching any synonym expansion
            if not any(w in hay for w in expanded_words):
                return False

    if court and _normalize(court) not in _normalize(doc.court):
        return False
    if act and not any(_normalize(act) in _normalize(a) for a in doc.acts):
        return False
    if lang and _normalize(lang) not in [_normalize(x) for x in doc.languages]:
        return False
    return True


def _query_tokens(q: str) -> List[str]:
    filler = {"case", "act", "vs", "v.", "india", "court", "supreme", "the", "a", "of", "in", "and", "to"}
    toks = [w for w in _normalize(q).split() if w and w not in filler]
    return toks or _normalize(q).split()


def _local_relevance_score(doc: JudicialDoc, q: str) -> int:
    toks = _query_tokens(q)
    if not toks:
        return 0
    title_hay = " ".join([doc.title, doc.parties]).lower()
    full_hay = " ".join(
        [
            doc.id,
            doc.court,
            doc.title,
            doc.parties,
            doc.summary,
            doc.full_summary or "",
            " ".join(doc.acts),
            " ".join(doc.sections),
            " ".join(doc.key_points),
            " ".join(doc.citations),
        ]
    ).lower()
    score = 0
    for t in toks:
        if t in title_hay:
            score += 3
        elif t in full_hay:
            score += 1
    return score


def _cache_judicial_doc(payload: Dict[str, Any], query_text: str = "") -> None:
    try:
        doc_id = str(payload.get("id") or "").strip()
        if not doc_id:
            return
        now = datetime.utcnow()
        cache_payload = dict(payload)
        cache_payload["id"] = doc_id
        cache_payload["cached_at"] = now
        if query_text:
            cache_payload["last_query"] = query_text
        judicial_docs_collection.update_one(
            {"id": doc_id},
            {
                "$set": cache_payload,
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
    except Exception:
        # Cache errors should not block user-facing search flow.
        return


def _get_cached_judicial_doc(doc_id: str) -> Optional[Dict[str, Any]]:
    try:
        rec = judicial_docs_collection.find_one({"id": doc_id}, {"_id": 0})
        return rec if isinstance(rec, dict) else None
    except Exception:
        return None


@router.get("/judicial/search")
async def judicial_search(
    q: str = "",
    court: Optional[str] = None,
    act: Optional[str] = None,
    lang: Optional[str] = None,
    limit: int = 20,
    authorization: str | None = Header(default=None),
) -> Dict[str, Any]:
    # PUBLIC SEARCH for the front page. Anyone can see the feed.
    limit = max(1, min(50, int(limit)))
    if not _normalize(q):
        return {
            "query": {"q": q, "court": court, "act": act, "lang": lang},
            "total": 0,
            "results": [],
            "sources_used": {
                "local_dataset": False,
                "indian_kanoon": False,
                "google_scholar": False,
                "bhashini_configured": bhashini_service.is_enabled(),
            },
        }


    # 1. Fetch from MongoDB (Source of Truth)
    try:
        # Load all locally stored records to filter
        all_local = []
        for doc_data in judicial_docs_collection.find({}, {"_id": 0}):
            # Convert back to JudicialDoc Pydantic model for matching
            try:
                all_local.append(JudicialDoc(**doc_data))
            except Exception:
                continue
        
        # If DB is empty, use the hardcoded list (failsafe)
        if not all_local:
            all_local = JUDICIAL_DOCS

        local_raw = [d for d in all_local if _doc_matches(d, q=q, court=court, act=act, lang=lang)]
    except Exception:
        # Fallback to hardcoded list if Mongo fails
        local_raw = [d for d in JUDICIAL_DOCS if _doc_matches(d, q=q, court=court, act=act, lang=lang)]

    # Fallback: if searching for "recent", include the best local docs even if score is low
    if "recent" in q.lower() and not local_raw:
        local_raw = JUDICIAL_DOCS[:3]
    
    local_hits = [d for d in local_raw if _local_relevance_score(d, q) >= 2 or "recent" in q.lower()]
    local_hits.sort(key=lambda d: _local_relevance_score(d, q), reverse=True)

    # ── External: 1st try Indian Kanoon public web scraper (no auth needed) ──
    kanoon_hits: List[Dict[str, Any]] = []
    try:
        kanoon_hits = await bhashini_service.kanoon_web_search(query=q, limit=limit)
    except Exception as e:
        print(f"[judicial_search] kanoon_web_search failed: {e}")

    # ── External: Also try old API path (in case token works) ──
    if not kanoon_hits:
        try:
            kanoon_hits = await bhashini_service.government_legal_search(query=q, lang=lang or "en", limit=limit)
        except Exception:
            kanoon_hits = []

    # ── Fallback: NVIDIA LLM search when no external results ──
    nvidia_hits: List[Dict[str, Any]] = []
    if not kanoon_hits and not local_hits:
        try:
            nvidia_hits = await bhashini_service.nvidia_legal_search(query=q, limit=min(limit, 8))
        except Exception as e:
            print(f"[judicial_search] nvidia_legal_search failed: {e}")

    merged: List[Dict[str, Any]] = []
    seen_keys: set[str] = set()

    def _get_key(item_title: str, item_url: str | None) -> str:
        t = re.sub(r"<[^>]+>", " ", item_title or "").strip().lower()
        t = re.sub(r"\s+", " ", t)
        u = (item_url or "").strip().lower().rstrip("/")
        return f"{t}|{u}"

    # Parallel Result Processing
    async def _process_hit(h, source_type: str):
        if source_type == "local":
            payload = h.model_dump()
            payload["full_summary"] = _build_detailed_summary(h)
        else:
            payload = h  # External hits are already dicts

        # Parallelize translation for search snippets (Minimal Mode)
        if lang and lang != "en":
            try:
                payload = await _localize_doc_payload(payload, lang, minimal=True)
            except Exception:
                pass
        # Cache external hits so they're retrievable by ID
        if source_type in ("kanoon", "nvidia"):
            try:
                _cache_judicial_doc(payload, query_text=q)
            except Exception:
                pass
        return _enrich_doc_payload(payload)

    # Gather tasks — local first, then kanoon, then nvidia
    tasks = []
    for h in local_hits:
        tasks.append(_process_hit(h, "local"))
    for k in kanoon_hits:
        tasks.append(_process_hit(k, "kanoon"))
    for n in nvidia_hits:
        tasks.append(_process_hit(n, "nvidia"))

    if tasks:
        all_hits = await asyncio.gather(*tasks)
        for enriched in all_hits:
            key = _get_key(enriched.get("title", ""), enriched.get("publication_url"))
            if key not in seen_keys:
                seen_keys.add(key)
                merged.append(enriched)

    return {
        "query": {"q": q, "court": court, "act": act, "lang": lang},
        "total": len(merged),
        "results": merged[:limit],
        "sources_used": {
            "local_dataset": bool(local_hits),
            "indian_kanoon": bool(kanoon_hits),
            "nvidia_ai": bool(nvidia_hits),
            "bhashini_configured": bhashini_service.is_enabled(),
        },
    }



@router.get("/judicial/{doc_id}")
async def judicial_get(doc_id: str, lang: Optional[str] = None, authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    _require_user(authorization)
    target_id = str(doc_id).strip()

    # 1. Check the hardcoded local dataset first
    for d in JUDICIAL_DOCS:
        if d.id.strip() == target_id:
            payload = d.model_dump()
            payload["full_summary"] = _build_detailed_summary(d)
            payload = await _localize_doc_payload(payload, lang)
            return _enrich_doc_payload(payload)

    # 2. Check in-memory cache (from search results)
    cached = _get_cached_judicial_doc(target_id)
    if cached:
        # Auto-enrich: if acts, sections, or judgment_sections are missing/empty,
        # and we have a publication_url, fetch the full text from Indian Kanoon
        pub_url = cached.get("publication_url") or ""
        needs_enrichment = (
            pub_url
            and "indiankanoon.org" in pub_url
            and not (
                cached.get("acts")
                or cached.get("sections")
                or cached.get("judgment_sections")
                or (len(cached.get("full_summary") or "") > 2000)
            )
        )
        if needs_enrichment:
            try:
                extracted = kanoon_extract(url=pub_url)
                # Merge extracted data into cached payload (overwrite only if richer)
                if extracted.get("full_summary"):
                    cached["full_summary"] = extracted["full_summary"]
                if extracted.get("summary"):
                    cached["summary"] = extracted["summary"]
                if extracted.get("key_points"):
                    cached["key_points"] = extracted["key_points"]
                if extracted.get("judgment_sections"):
                    cached["judgment_sections"] = extracted["judgment_sections"]
                if extracted.get("acts"):
                    cached["acts"] = extracted["acts"]
                if extracted.get("sections"):
                    cached["sections"] = extracted["sections"]
                if extracted.get("citations"):
                    cached["citations"] = extracted["citations"]
                # Re-cache the enriched version
                _cache_judicial_doc(cached, query_text="auto_enrich")
            except Exception:
                pass  # Serve what we have if enrichment fails

        payload = await _localize_doc_payload(cached, lang)
        return _enrich_doc_payload(payload)

    # 3. If not found anywhere, try to fetch directly from Indian Kanoon by numeric ID
    if target_id.isdigit():
        pub_url = f"https://indiankanoon.org/doc/{target_id}/"
        try:
            extracted = kanoon_extract(url=pub_url)
            payload: Dict[str, Any] = {
                "id": target_id,
                "title": extracted.get("title") or "Indian Kanoon Judgment",
                "court": "Indian Kanoon",
                "date": "",
                "parties": "",
                "summary": extracted.get("summary") or "",
                "full_summary": extracted.get("full_summary") or "",
                "key_points": extracted.get("key_points") or [],
                "judgment_sections": extracted.get("judgment_sections") or {},
                "acts": extracted.get("acts") or [],
                "sections": extracted.get("sections") or [],
                "citations": extracted.get("citations") or [],
                "publication_url": pub_url,
                "official_source": "Indian Kanoon",
            }
            _cache_judicial_doc(payload, query_text="direct_fetch")
            payload = await _localize_doc_payload(payload, lang)
            return _enrich_doc_payload(payload)
        except Exception:
            pass

    raise HTTPException(status_code=404, detail=f"Judicial doc not found: {target_id}")



class AssistantChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    lang: str = Field(default="en", description="ISO-ish language tag (demo): en/hi/ta/te/kn/ml/bn/gu/pa/ur")
    court: Optional[str] = None


@router.post("/assistant/chat")
async def assistant_chat(body: AssistantChatRequest, authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    _require_user(authorization)
    msg = body.message.strip()
    lang = _normalize(body.lang) or "en"

    # Simple retrieval: pick top docs that contain query tokens.
    q = _normalize(msg)
    ranked: List[JudicialDoc] = []
    if q:
        for d in JUDICIAL_DOCS:
            if _doc_matches(d, q=q, court=body.court, act=None, lang=None):
                ranked.append(d)
        if not ranked:
            ranked = JUDICIAL_DOCS[:]

    sources = ranked[:2]
    if sources:
        points = []
        for s in sources:
            points.append(f"- {s.title} ({s.court}, {s.date})")
            points.append(f"  - Parties: {s.parties}")
            points.append(f"  - Summary: {s.summary}")
            if s.key_points:
                points.append(f"  - Key points: {', '.join(s.key_points[:3])}")
            if s.citations:
                points.append(f"  - Citation(s): {', '.join(s.citations)}")
        answer = (
            "Judicial Assistant (demo): here are the most relevant references from the local dataset:\n"
            + "\n".join(points)
            + "\n\nIf you share your exact issue (facts + relief sought), I can draft a structured note (issues, rule, application)."
        )
    else:
        answer = (
            "Judicial Assistant (demo): I couldn't find a close match in the local dataset. "
            "Try keywords like the Act name, section, court, and a 1–2 line fact pattern."
        )

    # Mock "Bhashini integrated" behavior: we do not call external APIs here.
    if lang != "en":
        translated = await bhashini_service.translate_text(answer, source_lang="en", target_lang=lang)
        if translated.get("ok"):
            answer = str(translated.get("text") or answer)
        else:
            answer = f"[Translation unavailable for '{lang}' in current setup]\n" + answer

    return {
        "reply": answer,
        "lang": lang,
        "sources": [s.model_dump() for s in sources],
        "mode": "retrieval+template",
    }


@router.post("/voice-to-text")
async def voice_to_text(
    audio: UploadFile = File(...),
    authorization: str | None = Header(default=None),
) -> Dict[str, Any]:
    """Bhashini-flow helper: voice input -> text (demo uses Whisper if installed)."""
    _require_user(authorization)
    if not (audio.content_type or "").startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file")
    result = await speech_service.transcribe_audio(audio)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Transcription failed"))
    return {"text": result.get("text", ""), "language": result.get("language"), "success": True}


class TextToSpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    lang: str = Field(default="en", description="Target output language (en|hi|doi)")


@router.post("/tts/speak")
async def tts_speak(body: TextToSpeechRequest, authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    """
    Returns base64 audio when Bhashini TTS is configured.
    Frontend can fallback to browser speechSynthesis when unavailable.
    """
    _require_user(authorization)
    lang = _normalize(body.lang) or "en"
    lang_map = {"en": "en", "hi": "hi", "doi": "doi", "ur": "ur", "ks": "ks"}
    target_lang = lang_map.get(lang, "en")
    # Priority: NVIDIA TTS -> Bhashini TTS -> browser fallback.
    nvidia_tts = await bhashini_service.nvidia_text_to_speech(text=body.text, lang=target_lang)
    if nvidia_tts.get("ok"):
        return {
            "success": True,
            "audio_base64": nvidia_tts.get("audio_base64"),
            "lang": target_lang,
            "provider": "nvidia",
            "reason": None,
        }
    tts = await bhashini_service.text_to_speech(text=body.text, lang=target_lang)
    return {
        "success": bool(tts.get("ok")),
        "audio_base64": tts.get("audio_base64"),
        "lang": target_lang,
        "provider": "bhashini" if tts.get("ok") else "browser_fallback",
        "reason": tts.get("reason") or nvidia_tts.get("reason"),
    }


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode((s + pad).encode("ascii"))


def _sign(payload_bytes: bytes) -> str:
    sig = hmac.new(_SIGNING_SECRET, payload_bytes, hashlib.sha256).digest()
    return _b64url(sig)


PAYMENTS: Dict[str, Dict[str, Any]] = {}


class PaymentCreateRequest(BaseModel):
    payee_vpa: str = Field(default="merchant@upi", max_length=120)
    amount_paise: int = Field(ge=1, le=50_00_000, description="Amount in paise (₹1 = 100 paise)")
    note: str = Field(default="Offline UPI demo", max_length=140)


@router.post("/payments/create")
def payment_create(body: PaymentCreateRequest, authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    _require_user(authorization)
    payment_id = "PAY-" + uuid.uuid4().hex[:10].upper()
    now = int(time.time())
    payload = {
        "v": 1,
        "payment_id": payment_id,
        "payee_vpa": body.payee_vpa,
        "amount_paise": body.amount_paise,
        "note": body.note,
        "issued_at": now,
        "expires_at": now + 10 * 60,
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    token = _b64url(payload_bytes) + "." + _sign(payload_bytes)
    PAYMENTS[payment_id] = {"status": "issued", "payload": payload, "confirmed_at": None}
    return {"payment_id": payment_id, "token": token, "payload": payload}


class PaymentConfirmRequest(BaseModel):
    token: str = Field(min_length=10, max_length=5000)


@router.post("/payments/confirm")
def payment_confirm(body: PaymentConfirmRequest, authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    _require_user(authorization)
    token = body.token.strip()
    if "." not in token:
        raise HTTPException(status_code=400, detail="Invalid token format")
    payload_b64, sig = token.split(".", 1)
    try:
        payload_bytes = _b64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid token payload")
    expected = _sign(payload_bytes)
    if not hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=400, detail="Invalid token signature")

    now = int(time.time())
    if int(payload.get("expires_at", 0)) < now:
        raise HTTPException(status_code=400, detail="Token expired")
    payment_id = str(payload.get("payment_id") or "")
    if not payment_id:
        raise HTTPException(status_code=400, detail="Missing payment_id")

    rec = PAYMENTS.get(payment_id)
    if not rec:
        PAYMENTS[payment_id] = rec = {"status": "issued", "payload": payload, "confirmed_at": None}

    if rec["status"] != "confirmed":
        rec["status"] = "confirmed"
        rec["confirmed_at"] = now
    return {"payment_id": payment_id, "status": rec["status"], "confirmed_at": rec["confirmed_at"], "payload": payload}


@router.get("/payments/{payment_id}")
def payment_get(payment_id: str, authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    _require_user(authorization)
    rec = PAYMENTS.get(payment_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"payment_id": payment_id, **rec}


_KANOON_BASE = "https://indiankanoon.org"


def _rewrite_kanoon_html(raw_html: str, page_url: str) -> str:
    # Rewrite all links and asset sources to stay on this backend route.
    def repl_href(match: re.Match[str]) -> str:
        href = (match.group(2) or "").strip()
        if not href or href.startswith("#") or href.lower().startswith(("javascript:", "mailto:", "tel:")):
            return match.group(0)
        absolute = urljoin(page_url, href)
        proxied = f"/api/innovation/kanoon/view?url={quote(absolute, safe='')}"
        return f'{match.group(1)}="{proxied}"'

    def repl_src(match: re.Match[str]) -> str:
        src = (match.group(2) or "").strip()
        if not src or src.startswith("data:"):
            return match.group(0)
        absolute = urljoin(page_url, src)
        proxied = f"/api/innovation/kanoon/asset?url={quote(absolute, safe='')}"
        return f'{match.group(1)}="{proxied}"'

    html = re.sub(r'(href)\s*=\s*"([^"]*)"', repl_href, raw_html, flags=re.IGNORECASE)
    html = re.sub(r"(href)\s*=\s*'([^']*)'", repl_href, html, flags=re.IGNORECASE)
    html = re.sub(r'(src)\s*=\s*"([^"]*)"', repl_src, html, flags=re.IGNORECASE)
    html = re.sub(r"(src)\s*=\s*'([^']*)'", repl_src, html, flags=re.IGNORECASE)
    html = re.sub(r'(?is)<base[^>]*>', "", html)
    return html


def _html_to_text(raw_html: str) -> str:
    txt = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", raw_html)
    txt = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", txt)
    txt = re.sub(r"(?is)<[^>]+>", " ", txt)
    txt = html.unescape(txt)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt


def _extract_main_judgment_html(raw_html: str) -> str:
    patterns = [
        r'(?is)<div[^>]+id=["\']judgments["\'][^>]*>(.*?)</div>',
        r'(?is)<div[^>]+id=["\']judgment["\'][^>]*>(.*?)</div>',
        r'(?is)<div[^>]+class=["\'][^"\']*judgments?[^"\']*["\'][^>]*>(.*?)</div>',
        r'(?is)<pre[^>]*>(.*?)</pre>',
    ]
    candidates: List[str] = []
    for pat in patterns:
        matches = re.findall(pat, raw_html)
        for m in matches:
            if isinstance(m, tuple):
                m = " ".join([x for x in m if isinstance(x, str)])
            chunk = str(m or "").strip()
            if len(chunk) > 120:
                candidates.append(chunk)
    if candidates:
        candidates.sort(key=len, reverse=True)
        return candidates[0]
    return raw_html


def _extract_acts_sections_citations(text: str) -> Dict[str, List[str]]:
    t = text or ""
    act_matches = re.findall(r"\b([A-Z][A-Za-z&,\-\s]{3,80}? Act,?\s?\d{4})\b", t)
    acts = []
    seen = set()
    for a in act_matches:
        x = re.sub(r"\s+", " ", a).strip()
        k = x.lower()
        if k not in seen:
            seen.add(k)
            acts.append(x)
        if len(acts) >= 12:
            break

    sec_matches = re.findall(r"\b(?:Section|Sec\.?)\s*[0-9A-Za-z()./-]+\b", t, flags=re.IGNORECASE)
    sections = []
    seen_s = set()
    for s in sec_matches:
        x = re.sub(r"\s+", " ", s).strip()
        k = x.lower()
        if k not in seen_s:
            seen_s.add(k)
            sections.append(x)
        if len(sections) >= 20:
            break

    cit_matches = re.findall(r"\b(?:\(\d{4}\)\s*\d+\s*[A-Z]{2,}\s*\d+|AIR\s*\d{4}\s*[A-Z]{2,}\s*\d+)\b", t)
    citations = []
    seen_c = set()
    for c in cit_matches:
        x = re.sub(r"\s+", " ", c).strip()
        if x.lower() not in seen_c:
            seen_c.add(x.lower())
            citations.append(x)
        if len(citations) >= 10:
            break
    return {"acts": acts, "sections": sections, "citations": citations}


def _build_sections_from_text(text: str) -> Dict[str, str]:
    if not text:
        return {}

    # Normalize text for header detection: remove extra spaces and newlines
    normalized = re.sub(r"\s+", " ", text)

    # Markers for common Indian judgment sections
    markers = {
        "facts": [r"(?i)\bFacts\s+(?:of the case|briefly)?", r"(?i)\bBackground\b", r"(?i)\bCase\s+history\b"],
        "issues": [r"(?i)\bIssues?\s+(?:for consideration|involved)?", r"(?i)\bPoints?\s+for determination\b"],
        "args_p": [r"(?i)\bSubmissions?\s+of\s+the\s+(?:appellant|petitioner|assessee)\b", r"(?i)\bPetitioner'?s\s+arguments\b"],
        "args_r": [r"(?i)\bSubmissions?\s+of\s+the\s+respondent\b", r"(?i)\bRespondent'?s\s+arguments\b"],
        "analysis": [r"(?i)\bDiscussion\s+and\s+analysis\b", r"(?i)\bLegal\s+provisions\b", r"(?i)\bAnalysis\s+of\s+law\b"],
        "precedent": [r"(?i)\bPrecedent\s+analysis\b", r"(?i)\bCase\s+law\s+cited\b"],
        "reasoning": [r"(?i)\bCourt'?s\s+reasoning\b", r"(?i)\bFindings?\b", r"(?i)\bHeld\b"],
        "conclusion": [r"(?i)\bConclusion\b", r"(?i)\bOrder\b", r"(?i)\bDisposition\b", r"(?i)\bResult\b"],
    }

    results = {}
    indices = []

    # Find first match for each category to use as split points
    for cat, patterns in markers.items():
        found_pos = -1
        for pat in patterns:
            match = re.search(pat, text)
            if match:
                found_pos = match.start()
                break
        if found_pos != -1:
            indices.append((found_pos, cat))

    indices.sort()

    if len(indices) >= 3:
        # Use detected headers to split
        for i in range(len(indices)):
            start = indices[i][0]
            end = indices[i+1][0] if i + 1 < len(indices) else len(text)
            cat = indices[i][1]
            content = text[start:end].strip()
            # Remove the header itself from the start of content
            content = re.sub(r"^[A-Z:\s\-\.]{3,20}[\s:]+", "", content, count=1).strip()
            if len(content) > 50:
                results[cat] = content
    
    # Fill missing or weak sections using proportional slicing fallback
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    total_s = len(sentences)
    
    def get_zone(start_pct, end_pct):
        s = int(total_s * start_pct)
        e = int(total_s * end_pct)
        return " ".join(sentences[s:e]).strip()

    if not results.get("facts") or len(results.get("facts", "")) < 100:
        results["facts"] = get_zone(0, 0.2) or "Facts and background of the case."
    
    if not results.get("issues"):
        results["issues"] = get_zone(0.2, 0.35) or "Legal issues raised in the proceedings."

    if not results.get("petitioner_arguments"):
         results["petitioner_arguments"] = get_zone(0.35, 0.45) or "Case submissions and historical arguments."
    
    if not results.get("respondent_arguments"):
         results["respondent_arguments"] = get_zone(0.45, 0.55) or "Arguments presented by the responding parties."

    if not results.get("analysis_of_law"):
         results["analysis_of_law"] = get_zone(0.55, 0.7) or "Analysis of statutory provisions and rules."

    if not results.get("precedent_analysis"):
         # Default reasoning if no specific precedent section
         results["precedent_analysis"] = get_zone(0.7, 0.8) or "Reference to established legal precedents."

    if not results.get("court_reasoning"):
         results["court_reasoning"] = get_zone(0.7, 0.9) or results.get("facts", "")

    if not results.get("conclusion"):
         results["conclusion"] = " ".join(sentences[-8:]).strip() if total_s > 8 else text

    # Cleanup: make sure no section is a pure repeat of facts if there's other text
    for k in ["issues", "petitioner_arguments", "respondent_arguments", "analysis_of_law"]:
        if results.get(k) == results.get("facts") and total_s > 15:
            results[k] = f"Details for {k.replace('_', ' ')} are contained within the main judgment reasoning."

    return {
        "facts": results.get("facts"),
        "issues": results.get("issues"),
        "petitioner_arguments": results.get("petitioner_arguments"),
        "respondent_arguments": results.get("respondent_arguments"),
        "analysis_of_law": results.get("analysis_of_law"),
        "precedent_analysis": results.get("precedent_analysis"),
        "court_reasoning": results.get("court_reasoning"),
        "conclusion": results.get("conclusion"),
    }


@router.get("/kanoon/view", response_class=HTMLResponse)
def kanoon_view(page: str = "home", url: str | None = None):
    page_map = {
        "home": "https://indiankanoon.org/",
        "laws": "https://indiankanoon.org/browse/",
        "judgments": "https://indiankanoon.org/browse/supremecourt/",
        "recent": "https://indiankanoon.org/",
    }
    target = (url or page_map.get(page) or page_map["home"]).strip()
    if not target.startswith("http"):
        target = urljoin(_KANOON_BASE + "/", target.lstrip("/"))
    if "indiankanoon.org" not in target.lower():
        raise HTTPException(status_code=400, detail="Only Indian Kanoon URLs are allowed")

    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        with httpx.Client(timeout=25.0, follow_redirects=True, headers=headers) as client:
            resp = client.get(target)
        resp.raise_for_status()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch Indian Kanoon page: {exc}")

    html = _rewrite_kanoon_html(resp.text or "", str(resp.url))
    return HTMLResponse(content=html, status_code=200)


@router.get("/kanoon/asset")
def kanoon_asset(url: str):
    target = (url or "").strip()
    if "indiankanoon.org" not in target.lower():
        raise HTTPException(status_code=400, detail="Invalid asset URL")
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        with httpx.Client(timeout=25.0, follow_redirects=True, headers=headers) as client:
            resp = client.get(target)
        resp.raise_for_status()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch Indian Kanoon asset: {exc}")
    ctype = resp.headers.get("content-type", "application/octet-stream")
    return Response(content=resp.content, media_type=ctype, status_code=200)


@router.get("/kanoon/extract")
def kanoon_extract(url: str):
    target = (url or "").strip()
    if "indiankanoon.org" not in target.lower():
        raise HTTPException(status_code=400, detail="Only Indian Kanoon URLs are allowed")
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        with httpx.Client(timeout=25.0, follow_redirects=True, headers=headers) as client:
            resp = client.get(target)
        resp.raise_for_status()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch Indian Kanoon details: {exc}")

    raw_html = resp.text or ""
    title_match = re.search(r"(?is)<title>(.*?)</title>", raw_html)
    title = html.unescape(title_match.group(1).strip()) if title_match else "Indian Kanoon Judgment"
    main_html = _extract_main_judgment_html(raw_html)
    plain = _html_to_text(main_html)
    if not plain:
        raise HTTPException(status_code=404, detail="No extractable text found")

    # INCREASED LIMITS: 10,000 for display summary, 100,000 for deep extraction mapping
    summary = plain[:10000]
    key_points = [s.strip() for s in re.split(r"(?<=[.!?])\s+", summary) if s.strip()][:10]
    sections = _build_sections_from_text(plain[:100000])
    extra = _extract_acts_sections_citations(plain[:100000])
    return {
        "title": title,
        "summary": summary,
        "full_summary": plain[:100000],
        "key_points": key_points,
        "judgment_sections": sections,
        "acts": extra["acts"],
        "sections": extra["sections"],
        "citations": extra["citations"],
        "publication_url": str(resp.url),
        "official_source": "Indian Kanoon",
    }


class JudicialEnrichRequest(BaseModel):
    doc_id: str = Field(min_length=1, max_length=250)
    publication_url: str = Field(min_length=8, max_length=2000)
    title: Optional[str] = None
    court: Optional[str] = None
    date: Optional[str] = None
    parties: Optional[str] = None
    lang: Optional[str] = "en"


@router.post("/judicial/enrich")
def judicial_enrich(body: JudicialEnrichRequest, authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    _require_user(authorization)
    extracted = kanoon_extract(body.publication_url)
    payload: Dict[str, Any] = {
        "id": body.doc_id,
        "title": body.title or extracted.get("title") or "Indian Kanoon Judgment",
        "court": body.court or "Indian Kanoon",
        "date": body.date or "",
        "parties": body.parties or "",
        "summary": extracted.get("summary") or "",
        "full_summary": extracted.get("full_summary") or "",
        "key_points": extracted.get("key_points") or [],
        "judgment_sections": extracted.get("judgment_sections") or {},
        "acts": extracted.get("acts") or [],
        "sections": extracted.get("sections") or [],
        "citations": extracted.get("citations") or [],
        "publication_url": extracted.get("publication_url") or body.publication_url,
        "official_source": "Indian Kanoon",
        "languages": [body.lang or "en"],
    }
    _cache_judicial_doc(payload, query_text="manual_enrich")
    return {"ok": True, "doc": payload}


# ─────────────────────────────────────────────────────────────────────────────
# Google Translate TTS Proxy
# Avoids browser CORS restrictions by routing the request through our backend.
# Google Translate TTS supports 100+ languages including all 22 Indian languages.
# ─────────────────────────────────────────────────────────────────────────────

# Shared HTTP client with a browser-like User-Agent so Google doesn't block us
_TTS_CLIENT = httpx.AsyncClient(
    timeout=httpx.Timeout(15.0, connect=5.0),
    headers={
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Referer": "https://translate.google.com/",
        "Accept": "audio/mpeg, */*",
    },
    follow_redirects=True,
)

# Map our internal lang codes → Google Translate TTS language codes.
# Note: Google TTS supports fewer languages than Google Translate text.
# Unsupported codes are mapped to the closest supported language so users
# always hear audio rather than silence.
_GTTS_LANG_MAP: Dict[str, str] = {
    "en":  "en",
    "hi":  "hi",
    "bn":  "bn",
    "te":  "te",
    "mr":  "mr",
    "ta":  "ta",
    "gu":  "gu",
    "kn":  "kn",
    "ml":  "ml",
    "pa":  "pa",
    "or":  "or",
    "as":  "as",
    "ne":  "ne",
    "ur":  "ur",
    "sd":  "ur",   # Sindhi → Urdu (same script, closest TTS)
    "mai": "hi",   # Maithili → Hindi (closely related, Devanagari)
    "sa":  "hi",   # Sanskrit → Hindi (Devanagari, closest TTS)
    "doi": "hi",   # Dogri → Hindi (Dogri is closely related to Hindi/Punjabi)
    "kok": "mr",   # Konkani → Marathi (same region, Devanagari)
    "brx": "hi",   # Bodo → Hindi (fallback, no Bodo TTS available)
    "mni": "bn",   # Meitei/Manipuri → Bengali (closest script/sound)
    "ks":  "ur",   # Kashmiri → Urdu (Nastaliq script, closest TTS)
}



@router.get("/tts")
async def google_tts_proxy(
    text: str,
    lang: str = "en",
    # Standard HTTP header (for fetch()-based callers)
    authorization: Optional[str] = Header(default=None),
    # Query-param token — used when caller is HTML5 Audio() which cannot
    # set custom headers.  Named 'token' to avoid FastAPI header name clash.
    token: Optional[str] = None,
):
    """
    Proxy Google Translate TTS to the browser.
    Circumvents CORS — browser calls /api/innovation/tts?text=...&lang=hi
    and receives an MP3 audio stream.
    """
    # Build an auth string the _require_user helper understands
    auth_value = authorization or (f"Bearer {token}" if token else None)
    try:
        _require_user(auth_value)
    except HTTPException:
        raise

    # Sanitise inputs
    tl = _GTTS_LANG_MAP.get(lang, lang)  # fall back to raw code if unknown
    # Google TTS silently fails over ~200 chars — caller must chunk the text
    safe_text = (text or "").strip()[:200]
    if not safe_text:
        raise HTTPException(status_code=400, detail="text is required")

    gtts_url = (
        "https://translate.google.com/translate_tts"
        f"?ie=UTF-8&tl={quote(tl)}&q={quote(safe_text)}&client=tw-ob"
    )

    try:
        resp = await _TTS_CLIENT.get(gtts_url)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Google TTS returned HTTP {resp.status_code}",
            )
        return Response(
            content=resp.content,
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "public, max-age=86400",  # cache 24h — same text/lang = same audio
                "Access-Control-Allow-Origin": "*",
            },
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"TTS fetch error: {exc}")


def _ensure_judicial_docs_seeded():

    """Seeds the MongoDB collection with demo data so it's visible in Compass."""
    try:
        # Only seed if collection is relatively empty (demo logic)
        if judicial_docs_collection.count_documents({}) < 5:
            print("[SYNC] Seeding demo judicial docs to MongoDB...")
            for doc in JUDICIAL_DOCS:
                _cache_judicial_doc(doc.model_dump(), query_text="initial_seed")
            print("[SYNC] Seeding complete.")
    except Exception as e:
        print(f"[SYNC] Seeding skipped (Mongo might be unavailable): {e}")

# Trigger seeding on module load
_ensure_judicial_docs_seeded()


# ── Text-to-Speech endpoint ─────────────────────────────────────────────────
import io as _io

try:
    from gtts import gTTS as _gTTS
    _GTTS_OK = True
except Exception:
    _GTTS_OK = False

# Map BJCC language codes → gTTS/Google TTS lang codes
_TTS_LANG_MAP = {
    "en":  "en",  "hi":  "hi",  "bn":  "bn",  "te":  "te",
    "mr":  "mr",  "ta":  "ta",  "gu":  "gu",  "kn":  "kn",
    "ml":  "ml",  "pa":  "pa",  "or":  "hi",  "as":  "hi",
    "mai": "hi",  "sa":  "hi",  "sd":  "ur",  "ur":  "ur",
    "ks":  "ur",  "doi": "hi",  "kok": "mr",  "mni": "bn",
    "ne":  "ne",  "bo":  "hi",
}

@router.get("/tts")
async def text_to_speech(text: str, lang: str = "en"):
    """
    Returns MP3 audio for the given text in the specified language.
    Uses gTTS (Google Text-to-Speech) — supports all 22 Indian languages.
    """
    if not _GTTS_OK:
        raise HTTPException(status_code=503, detail="gTTS library not available")

    gtts_lang = _TTS_LANG_MAP.get(lang, "hi")
    safe_text  = (text or "").strip()[:3000]  # cap at 3000 chars

    if not safe_text:
        raise HTTPException(status_code=400, detail="No text provided")

    try:
        tts = _gTTS(text=safe_text, lang=gtts_lang, slow=False)
        buf = _io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        return Response(
            content=buf.read(),
            media_type="audio/mpeg",
            headers={"Cache-Control": "public, max-age=3600"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TTS failed: {exc}")
