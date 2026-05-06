import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/* Signup is now handled inside the combined AuthLogin card (/login).
   This redirect ensures any links to /signup still work. */
export default function AuthSignup() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/login", { replace: true, state: { mode: "register" } });
  }, [navigate]);
  return null;
}
