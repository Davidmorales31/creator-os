import React from "react";
import ReactDOM from "react-dom/client";
import "@creator-os/ui/tokens.css";
import "./styles.css";

function App() {
  return (
    <main className="app-shell">
      <section className="welcome-card" aria-labelledby="creator-os-title">
        <span className="eyebrow">Creator OS v0.0.1</span>
        <h1 id="creator-os-title">Creator OS</h1>
        <p>Your local-first creator workspace.</p>
        <button type="button">New Project</button>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
