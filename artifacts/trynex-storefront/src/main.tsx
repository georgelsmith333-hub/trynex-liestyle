import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

const apiBase = import.meta.env.VITE_API_BASE_URL;
if (apiBase) setBaseUrl(apiBase);

setAuthTokenGetter(() => localStorage.getItem('trynex_admin_token'));

createRoot(document.getElementById("root")!).render(<App />);
