import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { getApiBaseUrl } from "./lib/utils";
import { checkBuildVersion, installChunkErrorRecovery } from "./lib/cache-recovery";

// MUST run before anything else: returning visitors carrying an old service
// worker get auto-recovered (unregister SW + clear caches + reload). This
// silently fixes the "HTTP 400 password required" admin-login bug and the
// blank Design Studio page caused by stale chunk references.
if (typeof window !== "undefined") {
  checkBuildVersion();
  installChunkErrorRecovery();
}

const apiBase = getApiBaseUrl();
if (apiBase) setBaseUrl(apiBase);

if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.info(
    `[trynex] API base = ${apiBase || "(same-origin)"} | host = ${window.location.host}`
  );
}

setAuthTokenGetter(() => localStorage.getItem("trynex_admin_token"));

createRoot(document.getElementById("root")!).render(<App />);
