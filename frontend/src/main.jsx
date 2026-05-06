import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: String(error?.message || error || "Unknown UI error") };
  }

  componentDidCatch(error, info) {
    // Keep full stack in console for debugging while showing a user-friendly panel.
    // eslint-disable-next-line no-console
    console.error("UI crash captured by boundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(to bottom right, #0a0520, #1a1040, #0a0520)",
            color: "#fff",
            fontFamily: "system-ui, sans-serif",
            padding: "24px",
          }}
        >
          <div style={{ maxWidth: 760, textAlign: "center" }}>
            <h1 style={{ marginBottom: 12 }}>Something went wrong in the page UI.</h1>
            <p style={{ opacity: 0.85, marginBottom: 18 }}>
              Refresh once. If it still fails, share this error text and I will fix it quickly.
            </p>
            <pre
              style={{
                textAlign: "left",
                whiteSpace: "pre-wrap",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 12,
                padding: 12,
              }}
            >
              {this.state.message}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
