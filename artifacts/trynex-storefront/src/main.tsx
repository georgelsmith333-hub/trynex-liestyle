import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { getApiBaseUrl } from "./lib/utils";

const apiBase = getApiBaseUrl();
if (apiBase) setBaseUrl(apiBase);

// One-line diagnostic so we can quickly verify on production whether the
// build picked up the right backend host. Prints once at app boot.
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.info(
    `[trynex] API base = ${apiBase || '(same-origin)'} | host = ${window.location.host}`
  );
}

setAuthTokenGetter(() => localStorage.getItem('trynex_admin_token'));

createRoot(document.getElementById("root")!).render(<App />);
