export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/html")) return response;

    const html = await response.text();
    const injected = html.replace(
      /<\/body>/i,
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script><script src="/supabase-bridge.js"></script></body>'
    );

    return new Response(injected, {
      status: response.status,
      headers: new Headers(response.headers)
    });
  }
};