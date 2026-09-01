const TATTOO_SERVICES = new Set(['Realismo', 'Blackwork', 'Fine Line', 'Coberturas', 'Arte de terror', 'Projeto autoral']);
const CALENDAR_BACKEND = 'https://barber.charlesbackup2025.workers.dev';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/availability' && request.method === 'GET') {
      const date = url.searchParams.get('date') || '';
      const response = await fetch(`${CALENDAR_BACKEND}/api/availability?date=${encodeURIComponent(date)}`, { headers: { 'cache-control': 'no-store' } });
      return new Response(await response.text(), { status: response.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/api/book' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: 'Dados inválidos.' }, { status: 400 }); }
      const { date, time, service, name } = body || {};
      if (!TATTOO_SERVICES.has(service) || typeof name !== 'string' || name.trim().length < 2) {
        return Response.json({ error: 'Informe seu nome e escolha um estilo, uma data e um horário válidos.' }, { status: 400 });
      }
      const response = await fetch(`${CALENDAR_BACKEND}/api/tattoo-book`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date, time, service, name: name.trim() })
      });
      return new Response(await response.text(), { status: response.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }
    return env.ASSETS.fetch(request);
  }
};
