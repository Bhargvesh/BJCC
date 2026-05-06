import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import "../styles/global.css";

const S = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', 'Space Grotesk', system-ui, sans-serif",
    padding: 20,
    transition: "background 0.4s ease",
    position: "relative",
    overflow: "hidden",
  },
  themeBtn: {
    position: "fixed", top: 18, right: 18, zIndex: 9999,
    width: 40, height: 40, borderRadius: "50%",
    border: "none", cursor: "pointer",
    fontSize: "1.1rem", display: "flex",
    alignItems: "center", justifyContent: "center",
    boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
    transition: "all 0.2s",
  },
  card: {
    width: "100%",
    maxWidth: 1000,
    height: 620,
    borderRadius: 24,
    boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
    position: "relative",
    overflow: "hidden",
  },
  panelBtn: {
    padding: "10px 32px",
    borderRadius: 999,
    border: "2px solid rgba(255,255,255,0.85)",
    background: "transparent",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.9rem",
    cursor: "pointer",
    letterSpacing: "0.04em",
    transition: "all 0.2s",
  },
  inputWrap: {
    position: "relative",
    width: "100%",
    marginBottom: 13,
  },
  input: {
    width: "100%",
    padding: "13px 44px 13px 18px",
    borderRadius: 12,
    border: "none",
    outline: "none",
    fontSize: "0.93rem",
    fontFamily: "inherit",
    transition: "box-shadow 0.2s",
    boxSizing: "border-box",
  },
  inputIcon: {
    position: "absolute", right: 14, top: "50%",
    transform: "translateY(-50%)",
    opacity: 0.4, fontSize: "1rem",
    pointerEvents: "none",
  },
  primaryBtn: {
    width: "100%",
    padding: "13px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #7b8cde, #5c6bc0)",
    color: "#fff",
    fontWeight: 800,
    fontSize: "1rem",
    cursor: "pointer",
    letterSpacing: "0.04em",
    transition: "opacity 0.2s",
    fontFamily: "inherit",
    marginBottom: 16,
  },
  dividerRow: {
    display: "flex", alignItems: "center", gap: 12,
    width: "100%", marginBottom: 16,
  },
  msg: (isErr) => ({
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    marginBottom: 12,
    fontSize: "0.83rem",
    fontWeight: 600,
    background: isErr ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
    color: isErr ? "#dc2626" : "#16a34a",
    border: `1px solid ${isErr ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)"}`,
    textAlign: "center",
  }),
};

// Extracted Google Button Component to ensure it mounts properly when ready
const GoogleAuthButton = ({ isDark, clientId, onCredential, id }) => {
  useEffect(() => {
    if (!clientId || !window.google?.accounts?.id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = "";
    window.google.accounts.id.renderButton(el, {
      theme: isDark ? "filled_black" : "outline",
      size: "large",
      shape: "pill",
      text: "signin_with",
      width: 260,
    });
  }, [clientId, isDark, id]);

  return <div id={id} style={{ minHeight: 44, display: "flex", justifyContent: "center", width: "100%" }} />;
};

export default function AuthLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState(
    location?.state?.mode === "register" ? "register" : "login"
  );

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  const [msg, setMsg] = useState({ text: "", err: true });
  const [loading, setLoading] = useState(false);

  const [googleClientId, setGoogleClientId] = useState(null);
  const [googleReady, setGoogleReady] = useState(false);
  const googleInitDone = useRef(false);

  const isDark = theme === "dark";
  const bg         = isDark ? "linear-gradient(135deg,#0a0520,#1a1040)" : "linear-gradient(135deg,#dce8f5,#e8effa,#d6e4f7)";
  const cardBg     = isDark ? "#18122b" : "#ffffff";
  const inputBg    = isDark ? "rgba(255,255,255,0.07)" : "#f1f3f9";
  const inputColor = isDark ? "#fff" : "#0d1f30";
  const textColor  = isDark ? "#fff" : "#0d1f30";
  const mutedColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(13,31,48,0.45)";
  const linkColor  = isDark ? "#a78bfa" : "#5c6bc0";
  const divColor   = isDark ? "rgba(255,255,255,0.12)" : "rgba(13,31,48,0.12)";
  const themeBg    = isDark ? "#1e1040" : "#fff";

  useEffect(() => {
    if (localStorage.getItem("isi_token")) navigate("/");
  }, [navigate]);

  // Init Google Sign-In
  useEffect(() => {
    if (googleInitDone.current) return;
    googleInitDone.current = true;
    (async () => {
      try {
        const cfg  = await fetch("/api/innovation/auth/google/config");
        const data = await cfg.json();
        const clientId = (data?.client_id || "").trim();
        if (!clientId) return;
        setGoogleClientId(clientId);

        const init = () => {
          if (!window.google?.accounts?.id) return;
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (resp) => handleGoogleCredential(resp?.credential),
          });
          setGoogleReady(true);
        };

        if (window.google?.accounts?.id) { init(); return; }
        const s = document.createElement("script");
        s.src    = "https://accounts.google.com/gsi/client";
        s.async  = true; s.defer = true; s.onload = init;
        document.head.appendChild(s);
      } catch { /* ignore */ }
    })();
  }, []);

  const decodeJwt = (cred) => {
    try {
      const p = (cred || "").split(".");
      if (p.length !== 3) return {};
      const n = p[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(window.atob(n + "=".repeat((4 - n.length % 4) % 4)));
    } catch { return {}; }
  };

  // Login with email/password
  const handleLogin = async (e) => {
    e?.preventDefault();
    setMsg({ text: "", err: true });
    if (!email || !password) { setMsg({ text: "Please enter email and password.", err: true }); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/innovation/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ text: d?.detail || "Login failed.", err: true }); return; }
      localStorage.setItem("isi_token", d.token);
      localStorage.setItem("isi_user", JSON.stringify(d.user || {}));
      setMsg({ text: "Login successful! Redirecting…", err: false });
      setTimeout(() => navigate("/"), 600);
    } catch { setMsg({ text: "Error connecting to server.", err: true }); }
    finally { setLoading(false); }
  };

  // Register with email/password
  const handleRegister = async (e) => {
    e?.preventDefault();
    setMsg({ text: "", err: true });
    if (!regName || !regEmail || !regPassword) { setMsg({ text: "All fields are required.", err: true }); return; }
    if (regPassword !== regConfirm) { setMsg({ text: "Passwords do not match.", err: true }); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/innovation/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ text: d?.detail || "Sign-up failed.", err: true }); return; }
      localStorage.setItem("isi_token", d.token);
      localStorage.setItem("isi_user", JSON.stringify(d.user || {}));
      setMsg({ text: "Account created! Redirecting…", err: false });
      setTimeout(() => navigate("/"), 600);
    } catch { setMsg({ text: "Error connecting to server.", err: true }); }
    finally { setLoading(false); }
  };

  // Google OAuth
  const handleGoogleCredential = async (credential) => {
    setMsg({ text: "Signing in with Google…", err: false });
    try {
      const profile = decodeJwt(credential);
      const r = await fetch("/api/innovation/auth/google", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential,
          email: profile.email, name: profile.name,
          picture: profile.picture, google_sub: profile.sub,
          email_verified: profile.email_verified,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ text: d?.detail || "Google Sign-In failed.", err: true }); return; }
      localStorage.setItem("isi_token", d.token);
      localStorage.setItem("isi_user", JSON.stringify(d.user || {}));
      setMsg({ text: "Signed in successfully! Redirecting…", err: false });
      setTimeout(() => navigate("/"), 600);
    } catch { setMsg({ text: "Error connecting to server.", err: true }); }
  };

  const switchMode = (to) => { setMode(to); setMsg({ text: "", err: true }); };
  const isRegister = mode === "register";

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ ...S.page, background: bg }}>

        {/* Theme toggle */}
        <button id="auth-theme-toggle" onClick={toggleTheme}
          style={{ ...S.themeBtn, background: themeBg, color: textColor }}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}>
          {isDark ? "☀️" : "🌙"}
        </button>

        {/* Card */}
        <div style={{ ...S.card, background: cardBg }}>

          {/* ══ LEFT PANEL (COLORED OVERLAY) ══ */}
          <div style={{
            position: "absolute",
            top: 0, bottom: 0,
            left: isRegister ? "58%" : "0%",
            width: "42%",
            zIndex: 10,
            transition: "all 0.6s cubic-bezier(0.68, -0.15, 0.265, 1.15)",
            background: "linear-gradient(145deg, #7b8cde 0%, #5c6bc0 60%, #4a57b5 100%)",
            borderRadius: isRegister ? "120px 24px 24px 120px" : "24px 120px 120px 24px",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "48px 36px", textAlign: "center", overflow: "hidden"
          }}>
            {/* Blobs */}
            <div style={{ position:"absolute", top:-40, right:-40, width:180, height:180, borderRadius:"50%", background:"rgba(255,255,255,0.08)", pointerEvents:"none" }} />
            <div style={{ position:"absolute", bottom:-60, left:-30, width:220, height:220, borderRadius:"50%", background:"rgba(255,255,255,0.06)", pointerEvents:"none" }} />

            <div style={{ position:"relative", zIndex:1, width: "100%", transition: "transform 0.5s ease", transform: "translateY(0)" }}>
              {/* Ashoka Emblem — Original Colors inside white badge */}
              <div style={{
                width: 106, height: 106, borderRadius: "50%",
                background: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                padding: 6,
              }}>
                <img
                  src="/ashoka-emblem.png"
                  alt="Ashoka Emblem"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>

              <p style={{ color:"rgba(255,255,255,0.6)", fontSize:"0.72rem", fontWeight:700, letterSpacing:"0.16em", textTransform:"uppercase", marginBottom:10 }}>
                BJCC Platform
              </p>
              
              {/* Animated Text Content */}
              <div style={{ position: "relative", height: 80, margin: "0 auto 10px" }}>
                {/* Login View Text */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0,
                  opacity: isRegister ? 0 : 1, pointerEvents: isRegister ? "none" : "auto",
                  transition: "opacity 0.4s ease", transitionDelay: isRegister ? "0s" : "0.2s"
                }}>
                  <h2 style={{ color:"#fff", fontSize:"clamp(1.4rem,3vw,1.9rem)", fontWeight:800, marginBottom:10, letterSpacing:"-0.5px", lineHeight:1.3 }}>
                    Hello,{"\n"}Welcome!
                  </h2>
                  <p style={{ color:"rgba(255,255,255,0.7)", fontSize:"0.84rem" }}>Don't have an account?</p>
                </div>

                {/* Register View Text */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0,
                  opacity: isRegister ? 1 : 0, pointerEvents: isRegister ? "auto" : "none",
                  transition: "opacity 0.4s ease", transitionDelay: isRegister ? "0.2s" : "0s"
                }}>
                  <h2 style={{ color:"#fff", fontSize:"clamp(1.4rem,3vw,1.9rem)", fontWeight:800, marginBottom:10, letterSpacing:"-0.5px", lineHeight:1.3 }}>
                    Welcome{"\n"}Back!
                  </h2>
                  <p style={{ color:"rgba(255,255,255,0.7)", fontSize:"0.84rem" }}>Already have an account?</p>
                </div>
              </div>

              <button
                style={S.panelBtn}
                onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
                onMouseOut={e => e.currentTarget.style.background = "transparent"}
                onClick={() => switchMode(isRegister ? "login" : "register")}
              >
                {isRegister ? "Login" : "Register"}
              </button>
            </div>
          </div>

          {/* ══ RIGHT PANEL (FORMS CONTAINER) ══ */}
          <div style={{
            position: "absolute",
            top: 0, bottom: 0,
            left: isRegister ? "0%" : "42%",
            width: "58%",
            zIndex: 5,
            transition: "all 0.6s cubic-bezier(0.68, -0.15, 0.265, 1.15)",
            background: cardBg,
          }}>
            {/* Inner wrapper to hold both forms stacked */}
            <div style={{ position: "relative", width: "100%", height: "100%" }}>

              {/* ── LOGIN FORM ── */}
              <div style={{
                position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "30px 52px",
                opacity: isRegister ? 0 : 1,
                pointerEvents: isRegister ? "none" : "auto",
                transition: "opacity 0.4s ease", transitionDelay: isRegister ? "0s" : "0.3s",
              }}>
                <h1 style={{ fontSize:"clamp(1.6rem,3vw,2rem)", fontWeight:800, color:textColor, marginBottom:22, letterSpacing:"-0.5px" }}>
                  Login
                </h1>
                
                {!isRegister && msg.text && <div style={S.msg(msg.err)}>{msg.text}</div>}

                <form onSubmit={handleLogin} style={{ width:"100%" }}>
                  <div style={S.inputWrap}>
                    <input id="login-email" type="email" placeholder="Username or Email"
                      autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
                      style={{ ...S.input, background: inputBg, color: inputColor }}
                      onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(92,107,192,0.25)"}
                      onBlur={e => e.target.style.boxShadow = "none"} />
                    <span style={S.inputIcon}>👤</span>
                  </div>
                  <div style={S.inputWrap}>
                    <input id="login-password" type="password" placeholder="Password"
                      autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
                      style={{ ...S.input, background: inputBg, color: inputColor }}
                      onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(92,107,192,0.25)"}
                      onBlur={e => e.target.style.boxShadow = "none"} />
                    <span style={S.inputIcon}>🔒</span>
                  </div>
                  <div style={{ textAlign:"right", marginBottom:18, marginTop:-4 }}>
                    <span style={{ color:linkColor, cursor:"pointer", fontWeight:600, fontSize:"0.8rem" }}>Forgot Password?</span>
                  </div>
                  <button id="login-submit" type="submit" disabled={loading}
                    style={{ ...S.primaryBtn, opacity: loading ? 0.7 : 1 }}>
                    {loading ? "Logging in…" : "Login"}
                  </button>

                  <div style={S.dividerRow}>
                    <div style={{ flex:1, height:1, background:divColor }} />
                    <span style={{ color:mutedColor, fontSize:"0.78rem" }}>or login with</span>
                    <div style={{ flex:1, height:1, background:divColor }} />
                  </div>

                  <div style={{ display:"flex", justifyContent:"center", minHeight: 44 }}>
                    {googleReady ? (
                      <GoogleAuthButton isDark={isDark} clientId={googleClientId} onCredential={handleGoogleCredential} id="google-login-btn" />
                    ) : (
                      <span style={{ color:mutedColor, fontSize:"0.82rem", alignSelf: "center" }}>Loading Google Sign-In…</span>
                    )}
                  </div>
                </form>
              </div>

              {/* ── REGISTER FORM ── */}
              <div style={{
                position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "20px 44px",
                opacity: isRegister ? 1 : 0,
                pointerEvents: isRegister ? "auto" : "none",
                transition: "opacity 0.4s ease", transitionDelay: isRegister ? "0.3s" : "0s",
              }}>
                <h1 style={{ fontSize:"clamp(1.6rem,3vw,2rem)", fontWeight:800, color:textColor, marginBottom:16, letterSpacing:"-0.5px" }}>
                  Create Account
                </h1>

                {isRegister && msg.text && <div style={{...S.msg(msg.err), marginBottom: 8}}>{msg.text}</div>}

                <form onSubmit={handleRegister} style={{ width:"100%" }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{...S.inputWrap, marginBottom: 10, flex: 1}}>
                      <input id="reg-name" type="text" placeholder="Full Name"
                        autoComplete="name" value={regName} onChange={e => setRegName(e.target.value)}
                        style={{ ...S.input, padding: "11px 36px 11px 16px", background: inputBg, color: inputColor }}
                        onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(92,107,192,0.25)"}
                        onBlur={e => e.target.style.boxShadow = "none"} />
                      <span style={{...S.inputIcon, right: 12}}>👤</span>
                    </div>
                    <div style={{...S.inputWrap, marginBottom: 10, flex: 1}}>
                      <input id="reg-email" type="email" placeholder="Email Address"
                        autoComplete="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                        style={{ ...S.input, padding: "11px 36px 11px 16px", background: inputBg, color: inputColor }}
                        onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(92,107,192,0.25)"}
                        onBlur={e => e.target.style.boxShadow = "none"} />
                      <span style={{...S.inputIcon, right: 12}}>✉️</span>
                    </div>
                  </div>
                  <div style={{...S.inputWrap, marginBottom: 10}}>
                    <input id="reg-password" type="password" placeholder="Password"
                      autoComplete="new-password" value={regPassword} onChange={e => setRegPassword(e.target.value)}
                      style={{ ...S.input, padding: "11px 36px 11px 16px", background: inputBg, color: inputColor }}
                      onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(92,107,192,0.25)"}
                      onBlur={e => e.target.style.boxShadow = "none"} />
                    <span style={{...S.inputIcon, right: 12}}>🔒</span>
                  </div>
                  <div style={{...S.inputWrap, marginBottom: 12}}>
                    <input id="reg-confirm" type="password" placeholder="Confirm Password"
                      autoComplete="new-password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)}
                      style={{ ...S.input, padding: "11px 36px 11px 16px", background: inputBg, color: inputColor }}
                      onFocus={e => e.target.style.boxShadow = "0 0 0 3px rgba(92,107,192,0.25)"}
                      onBlur={e => e.target.style.boxShadow = "none"} />
                    <span style={{...S.inputIcon, right: 12}}>🔒</span>
                  </div>
                  <button id="register-submit" type="submit" disabled={loading}
                    style={{ ...S.primaryBtn, padding: "11px", marginBottom: 12, opacity: loading ? 0.7 : 1 }}>
                    {loading ? "Creating account…" : "Create Account"}
                  </button>

                  <div style={{...S.dividerRow, marginBottom: 12}}>
                    <div style={{ flex:1, height:1, background:divColor }} />
                    <span style={{ color:mutedColor, fontSize:"0.78rem" }}>or register with</span>
                    <div style={{ flex:1, height:1, background:divColor }} />
                  </div>

                  <div style={{ display:"flex", justifyContent:"center", minHeight: 44 }}>
                    {googleReady ? (
                      <GoogleAuthButton isDark={isDark} clientId={googleClientId} onCredential={handleGoogleCredential} id="google-register-btn" />
                    ) : (
                      <span style={{ color:mutedColor, fontSize:"0.82rem", alignSelf: "center" }}>Loading Google Sign-In…</span>
                    )}
                  </div>
                </form>
              </div>

            </div>
          </div>

        </div>{/* /card */}

        <div style={{
          position:"absolute", bottom:18, left:0, right:0,
          textAlign:"center", fontSize:"0.72rem",
          color: isDark ? "rgba(255,255,255,0.22)" : "rgba(13,31,48,0.28)",
          letterSpacing:"0.06em",
        }}>
          ⚖ Bharat Judicial Court Connect · सत्यमेव जयते
        </div>
      </div>
    </>
  );
}
