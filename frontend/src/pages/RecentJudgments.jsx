import React from "react";
import "../styles/auth_react.css";
import "../styles/global.css";
import { useTheme } from "../context/ThemeContext";

const MOCK_RECENT_JUDGMENTS_DATA = [
  {
    category: "Supreme Court",
    items: ["Supreme Court - Recent", "Supreme Court - Daily Orders"]
  },
  {
    category: "Major High Courts",
    items: [
      "Allahabad High Court",
      "Andhra Pradesh High Court",
      "Bombay High Court",
      "Calcutta High Court",
      "Chattisgarh High Court",
      "Delhi High Court",
      "Gauhati High Court",
      "Gujarat High Court",
      "Karnataka High Court",
      "Kerala High Court",
      "Madras High Court",
      "Madhya Pradesh High Court",
      "Odisha High Court",
      "Patna High Court",
      "Punjab & Haryana High Court",
    ]
  },
  {
    category: "Tribunals & Others",
    items: [
      "Appellate Tribunal For Electricity",
      "Central Administrative Tribunal",
      "Central Information Commission",
      "Competition Commission of India",
      "Custom, Excise & Service Tax Tribunal",
      "Income Tax Appellate Tribunal",
      "National Company Law Appellate Tribunal",
      "National Green Tribunal",
      "Securities Appellate Tribunal",
      "Telecom Disputes Settlement Tribunal",
    ]
  }
];

const RecentJudgments = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div style={{
      backgroundColor: theme === "light" ? "#f0f4f8" : "#0b101e",
      minHeight: "100vh",
      padding: "40px 20px",
      width: "100%",
      transition: "background 0.3s ease, color 0.3s ease"
    }}>
      <div style={{
        margin: "0 auto",
        width: "100%",
        maxWidth: "1200px",
        color: theme === "light" ? "rgba(13,31,48,0.9)" : "rgba(255, 255, 255, 0.9)"
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "30px",
          borderBottom: `1px solid ${theme === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"}`,
          paddingBottom: "20px"
        }}>
          <div>
            <h1 style={{
              margin: "0",
              fontSize: "2.2rem",
              fontFamily: "'Times New Roman', Times, serif",
              background: theme === "light"
                ? "linear-gradient(90deg, #0d1f30 60%, #b45309)"
                : "linear-gradient(90deg, #fff 60%, #f1c40f)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "0.5px"
            }}>Recent Judgments Feeds</h1>
            <p style={{ margin: "5px 0 0 0", color: theme === "light" ? "rgba(13,31,48,0.55)" : "rgba(255, 255, 255, 0.5)", fontSize: "0.9rem" }}>
              Daily updates and RSS feeds for all major Indian Courts
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              id="recent-theme-toggle"
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
                border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)"}`,
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
          {MOCK_RECENT_JUDGMENTS_DATA.map((section, idx) => (
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
                gap: "16px 24px"
              }}>
                {section.items.map((item, itemIdx) => (
                  <div key={itemIdx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{ color: "#f1c40f", marginRight: "8px", fontSize: "0.8rem" }}>▪</span>
                      <span style={{ color: theme === "light" ? "#1a2c42" : "#e2e8f0", fontSize: "0.95rem" }}>{item}</span>
                    </div>
                    <div style={{ display: "flex", gap: "10px", paddingLeft: "15px", fontSize: "0.8rem" }}>
                      <a href="#" style={{ color: theme === "light" ? "#1a6da8" : "#63b3ed", textDecoration: "none" }}
                        onMouseOver={e => e.target.style.textDecoration = "underline"}
                        onMouseOut={e => e.target.style.textDecoration = "none"}>Search</a>
                      <a href="#" style={{ color: theme === "light" ? "#1a6da8" : "#63b3ed", textDecoration: "none" }}
                        onMouseOver={e => e.target.style.textDecoration = "underline"}
                        onMouseOut={e => e.target.style.textDecoration = "none"}>Added Today</a>
                      <a href="#" style={{ color: "#f1c40f", textDecoration: "none" }}
                        onMouseOver={e => e.target.style.textDecoration = "underline"}
                        onMouseOut={e => e.target.style.textDecoration = "none"}>RSS Feed</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecentJudgments;
