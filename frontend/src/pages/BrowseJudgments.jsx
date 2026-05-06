import React from "react";
import "../styles/auth_react.css";
import "../styles/global.css";
import { useTheme } from "../context/ThemeContext";

const MOCK_BROWSE_JUDGMENTS_DATA = [
  {
    category: "Supreme Court & High Courts",
    items: [
      "Supreme Court of India",
      "Supreme Court - Daily Orders",
      "Allahabad High Court",
      "Andhra Pradesh High Court - Amravati",
      "Bombay High Court",
      "Calcutta High Court",
      "Chattisgarh High Court",
      "Delhi High Court",
      "Gauhati High Court",
      "Gujarat High Court",
      "Himachal Pradesh High Court",
      "Jammu & Kashmir High Court",
      "Jharkhand High Court",
      "Karnataka High Court",
      "Kerala High Court",
      "Madhya Pradesh High Court",
      "Manipur High Court",
      "Meghalaya High Court",
      "Madras High Court",
      "Orissa High Court",
      "Patna High Court",
      "Punjab-Haryana High Court",
      "Rajasthan High Court - Jaipur",
      "Rajasthan High Court - Jodhpur",
      "Sikkim High Court",
      "Telangana High Court",
      "Tripura High Court",
      "Uttarakhand High Court",
    ]
  },
  {
    category: "District Courts",
    items: [
      "Bangalore District Court",
      "Delhi District Court",
    ]
  },
  {
    category: "Tribunals & Commissions",
    items: [
      "Appellate Tribunal For Electricity",
      "Central Administrative Tribunal",
      "Central Electricity Regulatory Commission",
      "Central Information Commission",
      "Competition Commission of India",
      "Consumer Disputes Redressal",
      "Custom, Excise & Service Tax Tribunal",
      "Debt Recovery Appellate Tribunal",
      "Income Tax Appellate Tribunal",
      "Intellectual Property Appellate Board",
      "National Company Law Appellate Tribunal",
      "National Green Tribunal",
      "Securities Appellate Tribunal",
      "Telecom Disputes Settlement Tribunal",
    ]
  }
];

const getYearsFor = (item) => {
  const years = [];
  let start = 1950; // default for most
  if (item.match(/(Allahabad|Bombay|Calcutta|Madras)/i)) start = 1860;
  else if (item.match(/(Tribunal|Commission|Board|Authority)/i)) start = 1990;
  else if (item.match(/District/i)) start = 2000;
  
  for (let y = start; y <= 2025; y++) years.push(y);
  return years;
};



const BrowseJudgments = () => {
  const [expandedItem, setExpandedItem] = React.useState(null);
  const [expandedYear, setExpandedYear] = React.useState(null);
  const containerRef = React.useRef(null);
  const { theme, toggleTheme } = useTheme();

  React.useEffect(() => {
    const handleMouseMove = (e) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        containerRef.current.style.setProperty('--mouse-x', `${x}px`);
        containerRef.current.style.setProperty('--mouse-y', `${y}px`);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        backgroundColor: theme === "light" ? "#f0f4f8" : "#0b101e",
        minHeight: "100vh",
        padding: "40px 20px",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        transition: "background 0.3s ease",
        "--mouse-x": "50vw",
        "--mouse-y": "50vh"
      }}
    >
      <div 
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "radial-gradient(circle 700px at var(--mouse-x) var(--mouse-y), rgba(99, 179, 237, 0.06), transparent 80%)",
          pointerEvents: "none",
          zIndex: 0
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          margin: "0 auto",
          width: "100%",
          maxWidth: "1200px",
          color: theme === "light" ? "rgba(13,31,48,0.9)" : "rgba(255, 255, 255, 0.9)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", borderBottom: `1px solid ${theme === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"}`, paddingBottom: "20px" }}>
          <div>
            <h1 style={{
              margin: "0",
              fontSize: "2.2rem",
              fontFamily: "'Times New Roman', Times, serif",
              background: theme === "light" ? "linear-gradient(90deg, #0d1f30 60%, #b45309)" : "linear-gradient(90deg, #fff 60%, #f1c40f)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "0.5px"
            }}>Browse Judgments</h1>
            <p style={{ margin: "5px 0 0 0", color: theme === "light" ? "rgba(13,31,48,0.55)" : "rgba(255, 255, 255, 0.5)", fontSize: "0.9rem" }}>
              Explore judgments across High Courts, Supreme Court, and Tribunals
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              id="judgments-theme-toggle"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button
              onClick={() => window.history.back()}
              style={{
                background: "transparent",
                border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.3)" : "rgba(255, 255, 255, 0.3)"}`,
                color: theme === "light" ? "#0d1f30" : "#fff",
                padding: "8px 16px",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "background 0.2s"
              }}
              onMouseOver={(e) => e.currentTarget.style.background = theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)"}
              onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
            >
              ← Back
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
          {MOCK_BROWSE_JUDGMENTS_DATA.map((section, idx) => (
            <div key={idx}>
              <h2 style={{ 
                fontSize: "1.4rem", 
                color: theme === "light" ? "#1a2c42" : "#e2e8f0", 
                borderBottom: `2px solid ${theme === "light" ? "rgba(0,0,0,0.15)" : "#2d3748"}`, 
                paddingBottom: "10px",
                marginBottom: "16px",
                fontFamily: "'Times New Roman', Times, serif",
                letterSpacing: "0.5px"
              }}>
                {section.category}
              </h2>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
                gap: "8px 24px" 
              }}>
                {section.items.map((item, itemIdx) => {
                  const isExpanded = expandedItem === item;
                  return (
                    <div key={itemIdx} style={{ display: "flex", flexDirection: "column", gap: "8px", gridColumn: isExpanded ? "1 / -1" : "auto" }}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <span style={{ color: "#f1c40f", marginRight: "8px", fontSize: "0.8rem", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▪</span>
                        <a 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault();
                            setExpandedItem(isExpanded ? null : item);
                            setExpandedYear(null);
                          }}
                          style={{
                            color: isExpanded ? "#90cdf4" : "#63b3ed",
                            textDecoration: "none",
                            fontSize: "0.95rem",
                            lineHeight: "1.5",
                            transition: "color 0.1s",
                            fontWeight: isExpanded ? "bold" : "normal"
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.textDecoration = "underline";
                            e.currentTarget.style.color = "#90cdf4";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.textDecoration = "none";
                            e.currentTarget.style.color = isExpanded ? "#90cdf4" : "#63b3ed";
                          }}
                        >
                          {item}
                        </a>
                      </div>
                      
                      {isExpanded && (
                        <div style={{
                          background: theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(0, 0, 0, 0.2)",
                          border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.1)" : "rgba(255, 255, 255, 0.05)"}`,
                          borderRadius: "8px",
                          padding: "16px",
                          marginTop: "8px",
                          marginBottom: "16px",
                        }}>
                          {/* Years Grid */}
                          <div style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "8px",
                            alignItems: "center"
                          }}>
                            {getYearsFor(item).map((year) => {
                              const isYearSelected = expandedYear === year;
                              return (
                                <a
                                  key={year}
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setExpandedYear(isYearSelected ? null : year);
                                  }}
                                  style={{
                                    background: isYearSelected ? "#f1c40f" : (theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)"),
                                    border: `1px solid ${isYearSelected ? "#f1c40f" : (theme === "light" ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.1)")}`,
                                    borderRadius: "4px",
                                    padding: "6px 12px",
                                    color: isYearSelected ? "#111" : (theme === "light" ? "rgba(13,31,48,0.8)" : "rgba(255,255,255,0.8)"),
                                    fontSize: "0.85rem",
                                    textDecoration: "none",
                                    transition: "all 0.2s"
                                  }}
                                  onMouseOver={(e) => {
                                    if(!isYearSelected) {
                                      e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                                      e.currentTarget.style.color = "#fff";
                                    }
                                  }}
                                  onMouseOut={(e) => {
                                    if(!isYearSelected) {
                                      e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                      e.currentTarget.style.color = "rgba(255,255,255,0.8)";
                                    }
                                  }}
                                >
                                  {year}
                                </a>
                              );
                            })}
                          </div>

                          {/* Entire Year option */}
                          {expandedYear && (
                            <div style={{
                              marginTop: "20px",
                              paddingTop: "20px",
                              borderTop: `1px solid ${theme === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"}`,
                              animation: "fadeIn 0.3s ease"
                            }}>
                              <h4 style={{ margin: "0 0 12px 0", color: theme === "light" ? "#1a2c42" : "#e2e8f0", fontSize: "1rem" }}>
                                Browsing {expandedYear}
                              </h4>
                              <div>
                                <a 
                                  href="#"
                                  onClick={e => e.preventDefault()}
                                  style={{
                                    display: "inline-block",
                                    background: "rgba(99, 179, 237, 0.1)",
                                    color: "#90cdf4",
                                    border: "1px solid rgba(99, 179, 237, 0.2)",
                                    padding: "8px 24px",
                                    textAlign: "center",
                                    borderRadius: "6px",
                                    textDecoration: "none",
                                    fontSize: "0.9rem",
                                    transition: "all 0.2s"
                                  }}
                                  onMouseOver={e => {
                                    e.currentTarget.style.background = "rgba(99, 179, 237, 0.2)";
                                    e.currentTarget.style.color = "#fff";
                                  }}
                                  onMouseOut={e => {
                                    e.currentTarget.style.background = "rgba(99, 179, 237, 0.1)";
                                    e.currentTarget.style.color = "#90cdf4";
                                  }}
                                >
                                  Entire Year
                                </a>
                              </div>
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default BrowseJudgments;
