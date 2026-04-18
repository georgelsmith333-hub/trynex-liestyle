import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { getApiBaseUrl } from "./lib/utils";

const apiBase = getApiBaseUrl();
if (apiBase) setBaseUrl(apiBase);

setAuthTokenGetter(() => localStorage.getItem('trynex_admin_token'));

createRoot(document.getElementById("root")!).render(<App />);
