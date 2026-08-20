import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/app.css";

const preferredTheme = window.localStorage.getItem("infra-signal-theme");
document.documentElement.dataset.theme = preferredTheme === "light"
  || (preferredTheme === null && window.matchMedia("(prefers-color-scheme: light)").matches)
  ? "light"
  : "dark";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
