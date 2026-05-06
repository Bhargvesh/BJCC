const $ = (id) => document.getElementById(id);

const QUOTES = [
  "Satyameva Jayate - Truth alone triumphs.",
  "Justice must be accessible in every language.",
  "Nyaya sabke liye, bina bhedbhaav ke.",
  "Law protects dignity, equality, and constitutional rights.",
  "Samvidhan is the guiding light of governance.",
];

function startQuoteRotation() {
  const el = $("rotatingQuote");
  if (!el) return;
  let idx = 0;
  el.textContent = QUOTES[idx];
  window.setInterval(() => {
    el.classList.add("fade-out");
    window.setTimeout(() => {
      idx = (idx + 1) % QUOTES.length;
      el.textContent = QUOTES[idx];
      el.classList.remove("fade-out");
      el.classList.add("fade-in");
      window.setTimeout(() => el.classList.remove("fade-in"), 650);
    }, 620);
  }, 5000);
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = String(s ?? "");
  return d.innerHTML;
}

function fmtINR(amountPaise) {
  const r = (Number(amountPaise) || 0) / 100;
  return `₹${r.toFixed(2)}`;
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

async function speakText(text, lang) {
  // Use Web Speech API directly for reliable local playback.
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const voice = await chooseVoice(lang);
    const chunks = String(text || "").match(/[^.!?]+[.!?]?/g) || [String(text || "")];
    for (const chunk of chunks) {
      const c = chunk.trim();
      if (!c) continue;
      await new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(c);
        u.lang = langToVoice(lang);
        if (voice) u.voice = voice;
        u.rate = 0.95;
        u.onend = () => resolve(true);
        u.onerror = () => resolve(false);
        window.speechSynthesis.speak(u);
      });
    }
  }
}

// ------------------ Judicial search ------------------

function renderResults(results) {
  const el = $("results");
  if (!results?.length) {
    el.classList.add("empty");
    el.textContent = "No results. Try different keywords (Act name / section / parties).";
    return;
  }
  el.classList.remove("empty");
  el.innerHTML = results
    .map((d) => {
      const acts = (d.acts || []).slice(0, 2).join(", ");
      const source = d.official_source ? ` · ${esc(d.official_source)}` : "";
      const preview = String(d.summary || d.full_summary || "").replace(/\s+/g, " ").trim();
      const shortPreview = preview ? `${esc(preview.slice(0, 180))}${preview.length > 180 ? "..." : ""}` : "Click Open to view full details.";
      const sourceBtn = d.publication_url
        ? `<button class="btn" data-source="${esc(d.publication_url)}">Original page</button>`
        : "";
      return `
      <div class="item">
        <div class="t">${esc(d.title)}</div>
        <div class="m">${shortPreview}</div>
        <div class="meta">${esc(d.court)} · ${esc(d.date)} · ${esc(d.id)}${acts ? ` · ${esc(acts)}` : ""}${source}</div>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn" data-doc="${esc(d.id)}">Open</button>
          ${sourceBtn}
          <button class="btn" data-speak="${esc(d.id)}">Speak</button>
        </div>
      </div>
    `;
    })
    .join("");

  el.querySelectorAll("button[data-doc]").forEach((b) => {
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-doc");
      window.location.href = `/static/case.html?id=${encodeURIComponent(id)}`;
    });
  });
  el.querySelectorAll("button[data-speak]").forEach((b) => {
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-speak");
      const selected = (results || []).find((x) => x.id === id);
      if (!selected) return;
      const lang = $("lang").value || "en";
      const text = selected.full_summary || selected.summary || selected.title || "No readable text.";
      await speakText(text, lang);
    });
  });
  el.querySelectorAll("button[data-source]").forEach((b) => {
    b.addEventListener("click", () => {
      const url = b.getAttribute("data-source");
      if (!url) return;
      window.open(url, "_blank", "noopener,noreferrer");
    });
  });
}

async function doSearch() {
  const q = $("q").value || "";
  const court = $("court").value || "";
  const lang = $("lang").value || "en";
  const url =
    `/api/innovation/judicial/search?q=${encodeURIComponent(q)}` +
    `&court=${encodeURIComponent(court)}` +
    `&lang=${encodeURIComponent(lang)}` +
    `&limit=20`;
  try {
    const d = await apiGet(url);
    if (d.detail) {
      const el = $("results");
      el.classList.add("empty");
      el.textContent = "Error: " + d.detail;
      return;
    }
    renderResults(d.results || []);
  } catch (err) {
    const el = $("results");
    el.classList.add("empty");
    el.textContent = "Request Failed: " + err.message;
    console.error(err);
  }
}

function seedExamples() {
  $("q").value = "Aadhaar privacy";
  $("court").value = "Supreme Court of India";
}

// ------------------ Assistant ------------------

function appendChat(who, text) {
  const log = $("chatLog");
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.innerHTML = `<div class="who">${who === "user" ? "You" : "Assistant"}:</div><div class="txt">${esc(text)}</div>`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

async function askAssistant(text) {
  const msg = (text ?? $("assistantMsg").value ?? "").trim();
  if (!msg) return;
  $("assistantMsg").value = "";
  appendChat("user", msg);
  const lang = $("lang").value || "en";
  const res = await apiPost("/api/innovation/assistant/chat", { message: msg, lang });
  appendChat("bot", res.reply || JSON.stringify(res));
}

async function voiceToText() {
  const token = localStorage.getItem("isi_token") || "";
  if (!token) {
    window.location.href = "/login";
    return;
  }
  appendChat("bot", "Listening… (allow microphone if prompted)");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  rec.start();

  await new Promise((r) => setTimeout(r, 3500));
  rec.stop();

  const blob = await new Promise((resolve) => (rec.onstop = () => resolve(new Blob(chunks, { type: "audio/webm" }))));
  stream.getTracks().forEach((t) => t.stop());

  const fd = new FormData();
  fd.append("audio", blob, "voice.webm");

  const r = await fetch("/api/innovation/voice-to-text", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const d = await r.json();
  const t = (d.text || "").trim();
  if (!t) {
    appendChat("bot", "No transcript returned.");
    return;
  }
  appendChat("user", `[dictation] ${t}`);
  await askAssistant(t);
}

// ------------------ Sound-wave payment (demo) ------------------

let issuedToken = "";
let decodedToken = "";
let listening = false;
let audioCtx = null;
let analyser = null;
let micSource = null;
let rafId = null;

function tokenToBits(token) {
  const bytes = new TextEncoder().encode(token);
  const bits = [];
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  }
  return bits;
}

function bitsToToken(bits) {
  const bytes = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] ? 1 : 0);
    bytes.push(b);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

async function playToken(token) {
  // BFSK-ish: bit0=18000Hz, bit1=19000Hz, with short symbol time.
  // Many devices won’t reproduce ultrasonic well; still works often in audible band if needed.
  const f0 = 18000;
  const f1 = 19000;
  const sym = 0.035; // seconds per bit
  const lead = 0.25; // seconds of preamble tone

  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  gain.gain.value = 0.0001;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();

  const bits = tokenToBits(token);
  const t0 = audioCtx.currentTime + 0.02;

  // Preamble: 17500Hz
  osc.frequency.setValueAtTime(17500, t0);
  gain.gain.setValueAtTime(0.35, t0);
  gain.gain.setValueAtTime(0.35, t0 + lead);

  let t = t0 + lead;
  for (const bit of bits) {
    osc.frequency.setValueAtTime(bit ? f1 : f0, t);
    t += sym;
  }
  gain.gain.setValueAtTime(0.0001, t);
  osc.stop(t + 0.05);
}

function peakFreq() {
  const buf = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(buf);
  let max = -Infinity;
  let idx = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] > max) {
      max = buf[i];
      idx = i;
    }
  }
  const nyquist = audioCtx.sampleRate / 2;
  return (idx / buf.length) * nyquist;
}

function classifyBit(freq) {
  const f0 = 18000;
  const f1 = 19000;
  const d0 = Math.abs(freq - f0);
  const d1 = Math.abs(freq - f1);
  return d1 < d0 ? 1 : 0;
}

async function startListening() {
  if (listening) return;
  listening = true;
  decodedToken = "";
  $("decodedOut").textContent = "Listening…";
  $("btnConfirm").disabled = true;

  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.resume();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  micSource = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  micSource.connect(analyser);

  // Collect bits for fixed window; in real systems you'd use framing + CRC.
  const bits = [];
  const symMs = 35;
  const totalMs = 250 + 35 * 2200; // up to ~2.2k bytes worst-case; we’ll cut early if we decode printable token.
  const start = performance.now();

  const tick = () => {
    if (!listening) return;
    const f = peakFreq();
    // Ignore low frequencies: treat as silence/noise
    if (f > 16000) bits.push(classifyBit(f));

    const now = performance.now();
    if (now - start > 250 && bits.length >= 8 * 40) {
      // Attempt decode progressively. If looks like base64url.payload.sig (contains a dot), accept.
      const tok = bitsToToken(bits);
      if (tok.includes(".") && tok.length > 30) {
        decodedToken = tok.replace(/\u0000/g, "").trim();
        $("decodedOut").textContent = decodedToken;
        $("btnConfirm").disabled = false;
        stopListening();
        return;
      }
    }
    if (now - start > totalMs) {
      $("decodedOut").textContent = "Timeout. Try again (speaker/mic closer, less noise).";
      stopListening();
      return;
    }
    rafId = window.setTimeout(tick, symMs);
  };
  tick();
}

function stopListening() {
  listening = false;
  if (rafId) {
    clearTimeout(rafId);
    rafId = null;
  }
  if (micSource?.mediaStream) micSource.mediaStream.getTracks().forEach((t) => t.stop());
  micSource = null;
}

async function createPayment() {
  const payee_vpa = ($("payee").value || "merchant@upi").trim();
  const amount = Number($("amount").value || 1);
  const note = ($("note").value || "Offline UPI demo").trim();
  const amount_paise = Math.max(1, Math.round(amount * 100));
  const d = await apiPost("/api/innovation/payments/create", { payee_vpa, amount_paise, note });
  issuedToken = d.token || "";
  $("tokenOut").textContent = issuedToken ? issuedToken : JSON.stringify(d, null, 2);
  $("btnPlay").disabled = !issuedToken;
}

async function confirmDecoded() {
  if (!decodedToken) return;
  const d = await apiPost("/api/innovation/payments/confirm", { token: decodedToken });
  $("decodedOut").textContent =
    d?.status === "confirmed"
      ? `CONFIRMED: ${d.payment_id} · ${fmtINR(d.payload?.amount_paise)} · ${d.payload?.payee_vpa}\n\n${JSON.stringify(d, null, 2)}`
      : JSON.stringify(d, null, 2);
}

// ------------------ Wire up ------------------

window.addEventListener("beforeunload", stopListening);

$("whoChip")?.addEventListener("click", (e) => {
  const token = localStorage.getItem("isi_token");
  if (!token) return; // goes to /login normally
  e.preventDefault();
  const u = (() => {
    try {
      return JSON.parse(localStorage.getItem("isi_user") || "{}");
    } catch {
      return {};
    }
  })();
  const name = (u?.name || u?.email || "Account").toString();
  const ok = confirm(`Logged in as: ${name}\n\nPress OK to logout.`);
  if (ok) {
    localStorage.removeItem("isi_token");
    localStorage.removeItem("isi_user");
    window.location.href = "/login";
  }
});

$("btnSearch").addEventListener("click", doSearch);
$("btnSeed").addEventListener("click", () => {
  seedExamples();
  doSearch();
});

$("btnAsk").addEventListener("click", () => askAssistant());
$("assistantMsg").addEventListener("keydown", (e) => {
  if (e.key === "Enter") askAssistant();
});
$("btnVoice").addEventListener("click", voiceToText);

$("btnCreatePay")?.addEventListener("click", createPayment);
$("btnPlay")?.addEventListener("click", async () => {
  if (!issuedToken) return;
  await playToken(issuedToken);
});
$("btnListen")?.addEventListener("click", () => (listening ? stopListening() : startListening()));
$("btnConfirm")?.addEventListener("click", confirmDecoded);

seedExamples();
// Require login
(async () => {
  const token = localStorage.getItem("isi_token") || "";
  if (!token) {
    window.location.href = "/login";
    return;
  }
  // Update account chip label
  try {
    const me = await apiGet("/api/innovation/auth/me");
    const who = me?.user?.name || me?.user?.email;
    if ($("whoChip") && who) $("whoChip").textContent = who;
  } catch {}
  const el = $("results");
  if (el) {
    el.classList.add("empty");
    el.textContent = "Type your query and click Search.";
  }
})();

startQuoteRotation();

