const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/CaseDetails.jsx', 'utf8');

// 1. Replace state: activeSections (Set) → activeView (string, default "case-study")
code = code.replace(
  `  /* Judgment section selection state */\n  const [activeSections, setActiveSections] = useState(new Set());\n  const sectionRefs = useRef({});`,
  `  /* Active view: "case-study" | "all" | section key */\n  const [activeView, setActiveView] = useState("case-study");\n  const sectionRefs = useRef({});`
);

// 2. Remove old selectAll / clearAll / toggleSection / scrollToSection helpers
code = code.replace(
  `  /* ─── Section toggle ─── */
  const toggleSection = useCallback((key) => {
    setActiveSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!doc?.judgment_sections) return;
    setActiveSections(new Set(SECTION_KEYS.filter(k => doc.judgment_sections[k])));
  }, [doc]);

  const clearAll = useCallback(() => {
    setActiveSections(new Set());
  }, []);

  /* Scroll to section on click */
  const scrollToSection = useCallback((key) => {
    const el = sectionRefs.current[key];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);`,
  `  /* Scroll to section top */
  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);`
);

// 3. Update PDF export to use activeView instead of activeSections
code = code.replace(
  `    const keysToExport = activeSections.size > 0
      ? SECTION_KEYS.filter(k => activeSections.has(k) && sections[k])
      : SECTION_KEYS.filter(k => sections[k]);`,
  `    const keysToExport = (activeView !== "all" && activeView !== "case-study")
      ? SECTION_KEYS.filter(k => k === activeView && sections[k])
      : SECTION_KEYS.filter(k => sections[k]);`
);

// 4. Replace the entire main content section (the IIFE) in the return
const iifeStart = code.indexOf('        {/* ══ MAIN CONTENT ══ */}\n        {!loading && doc && !errorMsg && (() => {');
const iifeEnd = code.indexOf('\n      </div>\n    </>\n  );\n}');
if (iifeStart === -1 || iifeEnd === -1) {
  console.error('Could not find IIFE block. iifeStart:', iifeStart, 'iifeEnd:', iifeEnd);
  process.exit(1);
}

const beforeIIFE = code.substring(0, iifeStart);
const afterIIFE = code.substring(iifeEnd);

const newIIFE = `        {/* ══ MAIN CONTENT ══ */}
        {!loading && doc && !errorMsg && (() => {
          const availableKeys = SECTION_KEYS.filter(k => judgmentSections[k]);

          return (
            <div style={{ display: "flex", width: "100%", minHeight: "calc(100vh - 58px)", alignItems: "stretch" }}>

              {/* ── SIDEBAR ── */}
              <aside style={{
                width: 255,
                flexShrink: 0,
                position: "sticky",
                top: 58,
                height: "calc(100vh - 58px)",
                overflowY: "auto",
                borderRight: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(10,5,32,0.65)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                padding: "22px 14px",
              }}>
                <div style={{ marginBottom: 18 }}>
                  <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 5 }}>Navigation</p>
                  <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{doc.court} · {doc.date}</p>
                </div>

                {/* Show All button */}
                <button
                  onClick={() => setActiveView("all")}
                  className={"cd-ctrl-btn" + (activeView === "all" ? " is-all" : "")}
                  style={{ width: "100%", marginBottom: 12 }}
                >{t.showAll}</button>

                {/* Case Study nav item */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button
                    className={"cd-sidebar-btn" + (activeView === "case-study" ? " active" : "")}
                    onClick={() => setActiveView("case-study")}
                    style={{
                      borderColor: activeView === "case-study" ? "rgba(124,58,237,0.6)" : undefined,
                      background: activeView === "case-study" ? "rgba(124,58,237,0.18)" : undefined,
                      color: activeView === "case-study" ? "#c4b5fd" : undefined,
                      fontWeight: activeView === "case-study" ? 700 : undefined,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(167,139,250,0.9)", display: "inline-block", flexShrink: 0 }} />
                    Case Study
                  </button>

                  {/* Judgment section nav items */}
                  {availableKeys.map(key => {
                    const isActive = activeView === key;
                    return (
                      <button
                        key={key}
                        className={"cd-sidebar-btn" + (isActive ? " active" : "")}
                        onClick={() => {
                          setActiveView(key);
                          setTimeout(() => {
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }, 50);
                        }}
                        style={{
                          borderColor: isActive ? SECTION_BORDER_COLORS[key] : undefined,
                          background: isActive ? SECTION_COLORS[key] : undefined,
                          color: isActive ? "#fff" : undefined,
                          fontWeight: isActive ? 700 : undefined,
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: SECTION_BORDER_COLORS[key], display: "inline-block", flexShrink: 0 }} />
                        {sectionLabels[key] || key}
                      </button>
                    );
                  })}
                </div>
              </aside>

              {/* ── MAIN PANEL ── */}
              <main style={{ flex: 1, minWidth: 0, padding: "32px 44px 60px" }}>

                {/* Case Header */}
                <div style={{ marginBottom: 32, animation: "fadeSlideUp 0.7s ease" }}>
                  <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(1.4rem, 2.8vw, 2.3rem)", letterSpacing: "-0.5px", color: "#fff", marginBottom: 10, lineHeight: 1.25 }}>
                    {doc.title}
                  </h1>
                  {doc.parties && (
                    <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.48)", marginBottom: 5 }}>{doc.parties}</p>
                  )}
                  <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.28)", letterSpacing: "0.04em" }}>
                    {doc.court} · {doc.date} · {doc.id}
                  </p>
                </div>

                {/* ── CASE STUDY — shown when activeView is "case-study" or "all" ── */}
                {(activeView === "case-study" || activeView === "all") && (
                  <div className="cd-section-card" style={{ borderLeft: "4px solid rgba(124,58,237,0.8)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                      <h2 className="cd-section-title" style={{ color: "#c4b5fd" }}>
                        <span className="cd-section-dot" style={{ background: "rgba(167,139,250,0.9)" }} />
                        Case Study
                      </h2>
                      <button className="cd-speak-btn" onClick={() => toggleSpeak(doc.full_summary || doc.summary || doc.title, "summary")}>
                        {speakingSection === "summary" ? "🔊" : "🔈"} {speakingSection === "summary" ? btnText : t.speakBtn}
                      </button>
                    </div>
                    <div
                      className="cd-section-body"
                      dangerouslySetInnerHTML={{ __html: renderSummaryHtml(doc.full_summary || doc.summary || "No case study available.") }}
                    />
                  </div>
                )}

                {/* ── JUDGMENT SECTIONS ── */}
                {availableKeys.length > 0 ? (
                  availableKeys.map(key => {
                    // Show only when: "all" mode, or this specific key is selected
                    const shouldShow = activeView === "all" || activeView === key;
                    if (!shouldShow) return null;
                    return (
                      <div
                        key={key}
                        ref={el => { sectionRefs.current[key] = el; }}
                        className="cd-section-card"
                        style={{
                          borderLeft: \`4px solid \${SECTION_BORDER_COLORS[key]}\`,
                          background: activeView === key ? SECTION_COLORS[key] : undefined,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                          <h2 className="cd-section-title" style={{ color: "#fff" }}>
                            <span className="cd-section-dot" style={{ background: SECTION_BORDER_COLORS[key] }} />
                            {sectionLabels[key] || key}
                          </h2>
                          <button className="cd-speak-btn" onClick={() => toggleSpeak(judgmentSections[key], key)}>
                            {speakingSection === key ? "🔊" : "🔈"} {speakingSection === key ? btnText : t.speakBtn}
                          </button>
                        </div>
                        <div className="cd-section-body">{judgmentSections[key]}</div>
                      </div>
                    );
                  })
                ) : (
                  activeView !== "case-study" && (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.35)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 16 }}>
                      {t.noSections}
                    </div>
                  )
                )}

              </main>
            </div>
          );
        })()}`;

fs.writeFileSync('frontend/src/pages/CaseDetails.jsx', beforeIIFE + newIIFE + afterIIFE);
console.log('Done! activeView logic applied.');
