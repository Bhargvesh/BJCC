const $ = (id) => document.getElementById(id);

function fmtINR(amountPaise) {
  const r = (Number(amountPaise) || 0) / 100;
  return `INR ${r.toFixed(2)}`;
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
  for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
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
  const f0 = 18000;
  const f1 = 19000;
  const sym = 0.035;
  const lead = 0.25;

  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  gain.gain.value = 0.0001;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();

  const bits = tokenToBits(token);
  const t0 = audioCtx.currentTime + 0.02;
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
  return Math.abs(freq - f1) < Math.abs(freq - f0) ? 1 : 0;
}

async function startListening() {
  if (listening) return;
  listening = true;
  decodedToken = "";
  $("decodedOut").textContent = "Listening...";
  $("btnConfirm").disabled = true;

  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.resume();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  micSource = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  micSource.connect(analyser);

  const bits = [];
  const symMs = 35;
  const totalMs = 250 + 35 * 2200;
  const start = performance.now();

  const tick = () => {
    if (!listening) return;
    const f = peakFreq();
    if (f > 16000) bits.push(classifyBit(f));

    const now = performance.now();
    if (now - start > 250 && bits.length >= 8 * 40) {
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
  issuedToken = d?.token || "";
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

window.addEventListener("beforeunload", stopListening);

$("btnCreatePay").addEventListener("click", createPayment);
$("btnPlay").addEventListener("click", async () => {
  if (!issuedToken) return;
  await playToken(issuedToken);
});
$("btnListen").addEventListener("click", () => (listening ? stopListening() : startListening()));
$("btnConfirm").addEventListener("click", confirmDecoded);

(async () => {
  const token = localStorage.getItem("isi_token") || "";
  if (!token) {
    window.location.href = "/login";
    return;
  }
  try {
    const me = await apiGet("/api/innovation/auth/me");
    const who = me?.user?.name || me?.user?.email;
    if ($("whoChip") && who) $("whoChip").textContent = who;
  } catch {}
})();
