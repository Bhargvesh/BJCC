const $ = (id) => document.getElementById(id);
let currentDoc = null;

function esc(s) {
  const d = document.createElement("div");
  d.textContent = String(s ?? "");
  return d.innerHTML;
}

/**
 * Renders our structured summary text into rich HTML.
 * Lines that are ALL CAPS (headings like "BACKGROUND & CASE HISTORY") become <h3>.
 * Lines starting with "•" or numbers like "1. " become styled list items.
 * Blank lines start a new paragraph.
 */
function renderSummaryHtml(text) {
  if (!text) return "<p>No summary available.</p>";
  const lines = text.split("\n");
  let html = "";
  let inParagraph = false;

  const closeParagraph = () => {
    if (inParagraph) { html += "</p>"; inParagraph = false; }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      closeParagraph();
      continue;
    }

    // Section heading: line is ALL CAPS with possible spaces, &, /, numbers, punctuation
    const isHeading = line === line.toUpperCase() && line.length > 4 && /[A-Z]{3}/.test(line);

    if (isHeading) {
      closeParagraph();
      html += `<h3 class="sumHeading">${esc(line)}</h3>`;
      continue;
    }

    // Bullet point or numbered list item
    if (line.startsWith("•") || line.startsWith("-") || /^\d+\.\s/.test(line)) {
      closeParagraph();
      const content = line.replace(/^[•\-]\s*/, "").replace(/^\d+\.\s*/, "");
      html += `<div class="sumBullet"><span class="sumBulletDot">▸</span><span>${esc(content)}</span></div>`;
      continue;
    }

    // Regular text — wrap in paragraph
    if (!inParagraph) {
      html += "<p class='sumPara'>";
      inParagraph = true;
    } else {
      html += " ";
    }
    html += esc(line);
  }
  closeParagraph();
  return html;
}

async function apiGet(path) {
  const token = localStorage.getItem("isi_token") || "";
  const r = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (r.status === 401) {
    localStorage.removeItem("isi_token");
    window.location.href = "/login?msg=Session+expired.+Please+login+again.";
    return null;
  }
  return await r.json();
}

async function apiPost(path, body) {
  const token = localStorage.getItem("isi_token") || "";
  const r = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (r.status === 401) {
    localStorage.removeItem("isi_token");
    window.location.href = "/login?msg=Session+expired.+Please+login+again.";
    return null;
  }
  return await r.json();
}

function langToVoice(lang) {
  const m = { en: "en-IN", hi: "hi-IN", doi: "hi-IN" };
  return m[lang] || "en-IN";
}

function waitForVoices() {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const now = window.speechSynthesis.getVoices();
    if (now.length) {
      resolve(now);
      return;
    }
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    setTimeout(done, 1200);
  });
}

async function chooseVoice(lang) {
  const voices = await waitForVoices();
  const wanted = langToVoice(lang).toLowerCase();
  return (
    voices.find((v) => (v.lang || "").toLowerCase() === wanted) ||
    voices.find((v) => (v.lang || "").toLowerCase().startsWith(wanted.split("-")[0])) ||
    voices.find((v) => (v.lang || "").toLowerCase().startsWith("en")) ||
    null
  );
}

let isSpeaking = false;

async function speakCurrentSummary() {
  if (!currentDoc) return;
  const btn = $("btnSpeakSummary");
  if (!btn) return;
  
  if (isSpeaking) {
      window.speechSynthesis?.cancel();
      isSpeaking = false;
      btn.textContent = "Speak summary";
      return;
  }

  const lang = $("speakLang")?.value || "en";
  const fullText = (currentDoc.full_summary || currentDoc.summary || currentDoc.title || "")
      .replace(/[#*•▸]/g, '') // remove markdown/bullets
      .replace(/\n+/g, '. '); // convert newlines to stops
  
  if (!fullText) return;

  btn.textContent = "Loading audio...";
  btn.disabled = true;

  // Primary: Browser Web Speech API with chunking (most reliable on local setup)
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    isSpeaking = true;
    btn.textContent = "Stop speaking";
    btn.disabled = false;
    const voice = await chooseVoice(lang);

    // Split text into smaller chunks by punctuation
    const chunks = fullText.match(/[^.!?]+[.!?]?/g) || [fullText];
    let currentChunk = 0;

    function speakNextChunk() {
        if (!isSpeaking || currentChunk >= chunks.length) {
            isSpeaking = false;
            btn.textContent = "Speak summary";
            return;
        }
        
        const text = chunks[currentChunk].trim();
        if (!text) {
            currentChunk++;
            speakNextChunk();
            return;
        }

        const u = new SpeechSynthesisUtterance(text);
        u.lang = langToVoice(lang);
        if (voice) u.voice = voice;
        u.rate = 0.95;
        u.onend = () => {
            currentChunk++;
            speakNextChunk();
        };
        u.onerror = (e) => {
            console.error("Speech error", e);
            currentChunk++;
            speakNextChunk();
        };
        window.speechSynthesis.speak(u);
    }

    speakNextChunk();
  } else {
    btn.textContent = "Speak summary";
    btn.disabled = false;
    alert("Speech synthesis is not supported in this browser.");
  }
}

// Function to get the query parameter 'id' from URL
function getCaseId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function loadCaseData() {
  const caseId = getCaseId();
  if (!caseId) {
    $("mainSpinner").innerHTML = `<div class="card" style="text-align: center; padding: 60px;"><h2>Error: No case ID provided.</h2><p><a href="/india-innovation" class="chip">Go back</a></p></div>`;
    return;
  }

  try {
    const selectedLang = $("speakLang")?.value || "en";
    const doc = await apiGet(`/api/innovation/judicial/${encodeURIComponent(caseId)}?lang=${encodeURIComponent(selectedLang)}`);
    currentDoc = doc;
    
    if (doc.detail) {
        $("mainSpinner").innerHTML = `<div class="card" style="text-align: center; padding: 60px;"><h2>Error: ${esc(doc.detail)}</h2><p><a href="/india-innovation" class="chip">Go back</a></p></div>`;
        return;
    }

    // Hide spinner, show content
    $("mainSpinner").style.display = "none";
    $("caseContent").style.display = "grid";

    // Populate header
    $("docMeta").textContent = `${doc.court} · ${doc.date} · ${doc.id}`;
    $("cTitle").textContent = doc.title;
    $("cParties").textContent = doc.parties;

    // Populate Summary — use rich HTML renderer
    const summaryText = doc.full_summary || doc.summary || "No summary available.";
    $("cSummary").innerHTML = renderSummaryHtml(summaryText);

    // Populate Key Points
    if (doc.key_points && doc.key_points.length > 0) {
        $("cKeyPoints").innerHTML = doc.key_points.map(kp => `<li>${esc(kp)}</li>`).join("");
    } else {
        $("cKeyPoints").innerHTML = `<li>No specific key points recorded.</li>`;
    }

    // Populate Acts
    if (doc.acts && doc.acts.length > 0) {
        $("cActs").innerHTML = doc.acts.map(act => `<span class="tag">${esc(act)}</span>`).join("");
    } else {
        $("cActs").innerHTML = `<span style="color:var(--muted)">N/A</span>`;
    }
    if (doc.act_details && doc.act_details.length > 0) {
      $("cActDetails").innerHTML = doc.act_details
        .map((a) => `<li><b>${esc(a.name)}:</b> ${esc(a.definition || "")}</li>`)
        .join("");
    } else {
      $("cActDetails").innerHTML = "";
    }

    // Populate Sections
    if (doc.sections && doc.sections.length > 0) {
        $("cSections").innerHTML = doc.sections.map(sec => `<span class="tag section">${esc(sec)}</span>`).join("");
    } else {
        $("cSections").innerHTML = `<span style="color:var(--muted)">N/A</span>`;
    }
    if (doc.section_details && doc.section_details.length > 0) {
      $("cSectionDetails").innerHTML = doc.section_details
        .map((s) => `<li><b>${esc(s.name)}:</b> ${esc(s.definition || "")}</li>`)
        .join("");
    } else {
      $("cSectionDetails").innerHTML = "";
    }

    // Citations (Optional)
    if (doc.citations && doc.citations.length > 0) {
        $("citationsCard").style.display = "block";
        $("cCitations").innerHTML = doc.citations.map(cit => `<li>${esc(cit)}</li>`).join("");
    }
    if (doc.publication_url || doc.official_source) {
      $("sourceCard").style.display = "block";
      $("cOfficialSource").textContent = doc.official_source || "Official legal publication";
      if (doc.publication_url) {
        $("cPublicationUrl").href = doc.publication_url;
      } else {
        $("cPublicationUrl").style.display = "none";
      }
    }

  } catch (err) {
    console.error(err);
    $("mainSpinner").innerHTML = `<div class="card" style="text-align: center; padding: 60px;"><h2>Request Failed</h2><p>${esc(err.message)}</p></div>`;
  }
}

// Make sure user is logged in
(async () => {
    const token = localStorage.getItem("isi_token") || "";
    if (!token) {
      window.location.href = "/login";
      return;
    }
    
    // Load the case data
    loadCaseData();
    $("btnSpeakSummary")?.addEventListener("click", speakCurrentSummary);
    $("speakLang")?.addEventListener("change", loadCaseData);
})();
