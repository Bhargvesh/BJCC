import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import IndiaInnovation from "./pages/IndiaInnovation";
import AuthLogin from "./pages/AuthLogin";
import AuthSignup from "./pages/AuthSignup";
import CaseDetails from "./pages/CaseDetails";
import PaymentDemo from "./pages/PaymentDemo";
import BrowseLaws from "./pages/BrowseLaws";
import BrowseJudgments from "./pages/BrowseJudgments";
import { ThemeProvider } from "./context/ThemeContext";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<IndiaInnovation />} />
          <Route path="/innovation" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<AuthLogin />} />
          <Route path="/signup" element={<AuthSignup />} />
          <Route path="/case" element={<CaseDetails />} />
          <Route path="/payment-demo" element={<PaymentDemo />} />
          <Route path="/browse-laws" element={<BrowseLaws />} />
          <Route path="/browse-judgments" element={<BrowseJudgments />} />
          <Route path="*" element={<IndiaInnovation />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
