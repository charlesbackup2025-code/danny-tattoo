const TATTOO_SERVICES = new Set(['Realismo', 'Blackwork', 'Fine Line', 'Coberturas', 'Arte de terror', 'Projeto autoral']);
const CALENDAR_BACKEND = 'https://barber.charlesbackup2025.workers.dev';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/availability' && request.method === 'GET') {
      const date = url.searchParams.get('date') || '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Data inválida.' }, 400);
      try {
        const response = await fetch(`${CALENDAR_BACKEND}/api/availability?date=${encodeURIComponent(date)}`, {
          headers: { 'cache-control': 'no-store' }
        });
        return new Response(await response.text(), {
          status: response.status,
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
        });
      } catch {
        return json({ error: 'Não foi possível consultar a agenda.' }, 502);
      }
    }

    if (url.pathname === '/api/book' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Dados inválidos.' }, 400); }
      const { date, time, service, name } = body || {};
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^(0[89]|1[0-9]|20):00$/.test(time || '') || !TATTOO_SERVICES.has(service) || typeof name !== 'string' || name.trim().length < 2) {
        return json({ error: 'Informe nome, estilo, data e horário válidos.' }, 400);
      }
      try {
        const response = await fetch(`${CALENDAR_BACKEND}/api/tattoo-book`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ date, time, service, name: name.trim() })
        });
        return new Response(await response.text(), {
          status: response.status,
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
        });
      } catch {
        return json({ error: 'Não foi possível confirmar o horário agora.' }, 502);
      }
    }

    if (env?.ASSETS?.fetch) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  }
};
