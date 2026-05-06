import { useState } from "react";

export default function ChatBot() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello. Share your complaint details and I will guide you." },
  ]);
  const [input, setInput] = useState("");

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    const res = await fetch("/api/chatbot/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, conversation_history: [] }),
    });
    const data = await res.json();
    setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
  };

  return (
    <div className="card">
      <h3>AI Complaint Assistant</h3>
      <div className="chatbox">
        {messages.map((m, i) => (
          <p key={i}><b>{m.role}:</b> {m.content}</p>
        ))}
      </div>
      <div className="row">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type in Hindi/Urdu/English" />
        <button className="btn" onClick={send}>Send</button>
      </div>
      <p className="note">Voice input API is available at /api/chatbot/voice-to-text.</p>
    </div>
  );
}
