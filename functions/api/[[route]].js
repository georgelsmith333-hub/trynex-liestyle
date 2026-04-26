const RENDER_API = "https://trynex-api.onrender.com";

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const target = `${RENDER_API}${url.pathname}${url.search}`;

  let body = undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  const reqHeaders = new Headers(request.headers);
  ["cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor"].forEach(h => reqHeaders.delete(h));
  reqHeaders.set("x-forwarded-host", url.hostname);

  let resp;
  try {
    resp = await fetch(target, {
      method: request.method,
      headers: reqHeaders,
      body,
      redirect: "follow",
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "proxy_error", message: "API service unavailable" }),
      { status: 503, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  const resHeaders = new Headers(resp.headers);
  resHeaders.delete("transfer-encoding");
  resHeaders.delete("connection");
  resHeaders.set("x-proxied-by", "cf-pages-function");

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: resHeaders,
  });
}
