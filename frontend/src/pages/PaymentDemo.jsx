import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./india_innovation_shadow.css";
import { useTheme } from "../context/ThemeContext";

function fmtINR(amountPaise) {
  const r = (Number(amountPaise) || 0) / 100;
  return `INR ${r.toFixed(2)}`;
}

export default function PaymentDemo() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [payee, setPayee] = useState("merchant@upi");
  const [amount, setAmount] = useState(5);
  const [note, setNote] = useState("Offline UPI soundwave demo");
  
  const [issuedToken, setIssuedToken] = useState("");
  const [decodedToken, setDecodedToken] = useState("");
  const [tokenOutput, setTokenOutput] = useState("Create a token...");
  const [decodedOutput, setDecodedOutput] = useState("Start listening...");
  const [listening, setListening] = useState(false);
  const [whoChip, setWhoChip] = useState("Account");

  // Web Audio internals (we use refs so closures in listeners work well, but logic needs state)
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const micSourceRef = useRef(null);
  const rafIdRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("isi_token");
    if (!token) {
      navigate("/signup");
      return;
    }
    
    // Fetch profile
    (async () => {
      try {
        const r = await fetch("/api/innovation/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const d = await r.json();
        const who = d?.user?.name || d?.user?.email;
        if (who) setWhoChip(who);
      } catch (err) {
        // ignore
      }
    })();

    return () => {
      stopListening();
    };
  }, [navigate]);

  const tokenToBits = (tok) => {
    const bytes = new TextEncoder().encode(tok);
    const bits = [];
    for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
    return bits;
  };

  const bitsToToken = (bits) => {
    const bytes = [];
    for (let i = 0; i + 7 < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] ? 1 : 0);
      bytes.push(b);
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  };

  const playToken = async (tok) => {
    const f0 = 18000;
    const f1 = 19000;
    const sym = 0.035;
    const lead = 0.25;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    await ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(ctx.destination);
    osc.start();

    const bits = tokenToBits(tok);
    const t0 = ctx.currentTime + 0.02;
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
  };

  const peakFreq = (analyser) => {
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
    const nyquist = audioCtxRef.current.sampleRate / 2;
    return (idx / buf.length) * nyquist;
  };

  const classifyBit = (freq) => {
    const f0 = 18000;
    const f1 = 19000;
    return Math.abs(freq - f1) < Math.abs(freq - f0) ? 1 : 0;
  };

  const stopListening = () => {
    setListening(false);
    if (rafIdRef.current) {
      clearTimeout(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (micSourceRef.current?.mediaStream) {
      micSourceRef.current.mediaStream.getTracks().forEach(t => t.stop());
    }
    micSourceRef.current = null;
  };

  const startListening = async () => {
    if (listening) return;
    setListening(true);
    setDecodedToken("");
    setDecodedOutput("Listening...");

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    await ctx.resume();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micSourceRef.current = ctx.createMediaStreamSource(stream);
    analyserRef.current = ctx.createAnalyser();
    analyserRef.current.fftSize = 2048;
    micSourceRef.current.connect(analyserRef.current);

    const bits = [];
    const symMs = 35;
    const totalMs = 250 + 35 * 2200;
    const start = performance.now();
    let isStillListening = true;

    const tick = () => {
      if (!isStillListening) return;
      const f = peakFreq(analyserRef.current);
      if (f > 16000) bits.push(classifyBit(f));

      const now = performance.now();
      if (now - start > 250 && bits.length >= 8 * 40) {
        const tok = bitsToToken(bits);
        if (tok.includes(".") && tok.length > 30) {
          const finalTok = tok.replace(/\u0000/g, "").trim();
          setDecodedToken(finalTok);
          setDecodedOutput(finalTok);
          stopListening();
          isStillListening = false;
          return;
        }
      }
      if (now - start > totalMs) {
        setDecodedOutput("Timeout. Try again (speaker/mic closer, less noise).");
        stopListening();
        isStillListening = false;
        return;
      }
      rafIdRef.current = window.setTimeout(tick, symMs);
    };
    tick();
  };

  const createPayment = async () => {
    const token = localStorage.getItem("isi_token");
    // amount is rupees, backend needs paise
    const amount_paise = Math.max(1, Math.round(Number(amount) * 100));
    try {
      const r = await fetch("/api/innovation/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ payee_vpa: payee, amount_paise, note })
      });
      const d = await r.json();
      const tok = d?.token || "";
      setIssuedToken(tok);
      setTokenOutput(tok ? tok : JSON.stringify(d, null, 2));
    } catch (err) {
      setTokenOutput("Error creating payment.");
    }
  };

  const confirmDecoded = async () => {
    if (!decodedToken) return;
    const token = localStorage.getItem("isi_token");
    try {
      const r = await fetch("/api/innovation/payments/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ token: decodedToken })
      });
      const d = await r.json();
      setDecodedOutput(
        d?.status === "confirmed"
          ? `CONFIRMED: ${d.payment_id} · ${fmtINR(d.payload?.amount_paise)} · ${d.payload?.payee_vpa}\n\n${JSON.stringify(d, null, 2)}`
          : JSON.stringify(d, null, 2)
      );
    } catch (err) {
      setDecodedOutput("Error confirming decoded token.");
    }
  };

  return (
    <div style={{minHeight:"100vh", backgroundColor: theme === "light" ? "#f0f4f8" : "#0a192f", color: theme === "light" ? "#0d1f30" : "#eaf4ff", fontFamily:"'DM Sans', sans-serif", transition:"background 0.3s ease, color 0.3s ease"}}>
      <div className="bg"></div>
      <div className="wrap" style={{maxWidth:1200, margin:"0 auto", padding:"30px 18px", position:"relative", zIndex:1}}>
        <header className="top" style={{display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid rgba(255,255,255,0.1)", paddingBottom:16, marginBottom:24}}>
          <div className="brand" style={{display:"flex", alignItems:"center", gap:14}}>
            <div className="logo" style={{width:46, height:46, borderRadius:16, background:"linear-gradient(135deg, #3d9fd9, #1a8f6e)", display:"grid", placeItems:"center", fontWeight:900, color:"#fff"}}>IN</div>
            <div>
              <h1 style={{margin:0, fontSize:"1.5rem", fontFamily:"Fraunces, serif"}}>Offline Micropayment via Sound Waves</h1>
              <p style={{margin:"4px 0 0", fontSize:"0.85rem", color:"var(--muted, #8fa3bb)"}}>Standalone concept demo page</p>
            </div>
          </div>
          <div className="links" style={{display:"flex", gap:8}}>
            <Link className="chip" to="/">Back to Judicial Assistant</Link>
            <Link className="chip" to="/login" title="Account">{whoChip}</Link>
          </div>
        </header>

        <section className="grid">
          <div className="card" style={{background: theme === "light" ? "rgba(255,255,255,0.85)" : "linear-gradient(145deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.05) 100%)", borderRadius:18, border: theme === "light" ? "1px solid rgba(0,0,0,0.1)" : "1px solid rgba(255,255,255,0.14)", padding:24}}>
            <h2 style={{marginTop:0}}>Offline micropayment via sound waves (concept demo)</h2>
            <p className="sub" style={{color:"#8fa3bb", marginBottom:20}}>
              Token {"->"} audio {"->"} microphone decode {"->"} confirm. This demonstrates offline transfer via sound and is not production UPI.
            </p>

            <div className="row" style={{display:"flex", gap:16, flexWrap:"wrap"}}>
              <div className="field" style={{flex:1, minWidth:200}}>
                <label style={{display:"block", fontSize:"0.75rem", textTransform:"uppercase", fontWeight:800, color:"#8fa3bb", marginBottom:6}}>Payee VPA</label>
                <input style={{width:"100%", padding:"10px 12px", borderRadius:10, border: theme === "light" ? "1px solid rgba(0,0,0,0.18)" : "1px solid rgba(255,255,255,0.15)", background: theme === "light" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.2)", color: theme === "light" ? "#0d1f30" : "#fff"}} value={payee} onChange={(e) => setPayee(e.target.value)} />
              </div>
              <div className="field" style={{flex:1, minWidth:200}}>
                <label style={{display:"block", fontSize:"0.75rem", textTransform:"uppercase", fontWeight:800, color:"#8fa3bb", marginBottom:6}}>Amount (INR)</label>
                <input style={{width:"100%", padding:"10px 12px", borderRadius:10, border: theme === "light" ? "1px solid rgba(0,0,0,0.18)" : "1px solid rgba(255,255,255,0.15)", background: theme === "light" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.2)", color: theme === "light" ? "#0d1f30" : "#fff"}} type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="field" style={{flex:2, minWidth:200}}>
                <label style={{display:"block", fontSize:"0.75rem", textTransform:"uppercase", fontWeight:800, color:"#8fa3bb", marginBottom:6}}>Note</label>
                <input style={{width:"100%", padding:"10px 12px", borderRadius:10, border: theme === "light" ? "1px solid rgba(0,0,0,0.18)" : "1px solid rgba(255,255,255,0.15)", background: theme === "light" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.2)", color: theme === "light" ? "#0d1f30" : "#fff"}} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>

            <div className="row" style={{display:"flex", gap:16, marginTop:20, flexWrap:"wrap"}}>
              <button className="btn primary" onClick={createPayment} style={{background:"linear-gradient(135deg, #3d9fd9, #2a8bc4)", padding:"12px 18px", border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:"pointer"}}>Create token</button>
              <button className="btn" disabled={!issuedToken} onClick={() => playToken(issuedToken)} style={{background:"rgba(255,255,255,0.08)", padding:"12px 18px", border:"1px solid rgba(255,255,255,0.2)", borderRadius:12, color:"#fff", fontWeight:800, cursor:issuedToken?"pointer":"not-allowed", opacity:issuedToken?1:0.5}}>Play sound token</button>
              <button className="btn" onClick={() => (listening ? stopListening() : startListening())} style={{background:"rgba(255,255,255,0.08)", padding:"12px 18px", border:"1px solid rgba(255,255,255,0.2)", borderRadius:12, color:"#fff", fontWeight:800, cursor:"pointer"}}>
                {listening ? "Stop listening" : "Listen (mic)"}
              </button>
              <button className="btn" disabled={!decodedToken} onClick={confirmDecoded} style={{background:"rgba(255,255,255,0.08)", padding:"12px 18px", border:"1px solid rgba(255,255,255,0.2)", borderRadius:12, color:"#fff", fontWeight:800, cursor:decodedToken?"pointer":"not-allowed", opacity:decodedToken?1:0.5}}>Confirm decoded token</button>
            </div>

            <div className="split" style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginTop:30}}>
              <div>
                <h3 style={{margin:"0 0 10px", fontSize:"1rem"}}>Issued token</h3>
                <pre className="pre small" style={{background: theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.25)", color: theme === "light" ? "#0d1f30" : undefined, padding:16, borderRadius:12, border: theme === "light" ? "1px solid rgba(0,0,0,0.1)" : "1px solid rgba(255,255,255,0.1)", fontSize:"0.8rem", whiteSpace:"pre-wrap", wordBreak:"break-all", minHeight:100}}>
                  {tokenOutput}
                </pre>
              </div>
              <div>
                <h3 style={{margin:"0 0 10px", fontSize:"1rem"}}>Decoded token</h3>
                <pre className="pre small" style={{background: theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.25)", color: theme === "light" ? "#0d1f30" : undefined, padding:16, borderRadius:12, border: theme === "light" ? "1px solid rgba(0,0,0,0.1)" : "1px solid rgba(255,255,255,0.1)", fontSize:"0.8rem", whiteSpace:"pre-wrap", wordBreak:"break-all", minHeight:100}}>
                  {decodedOutput}
                </pre>
              </div>
            </div>

            <div className="row" style={{marginTop: 20}}>
              <div className="hint" style={{fontSize:"0.85rem", color: theme === "light" ? "#4a6580" : "#8fa3bb", padding:"12px", background: theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.2)", borderRadius:10}}>
                For best results: keep speaker + mic close, reduce background noise, and do not set volume too low.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
