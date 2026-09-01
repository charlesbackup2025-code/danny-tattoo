import { busySlots, createBooking, validDate, validSlot, slots } from './google.js';

const SERVICES = new Set(['Realismo', 'Blackwork', 'Fine Line', 'Coberturas', 'Arte de terror', 'Projeto autoral']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/availability' && request.method === 'GET') {
      const date = url.searchParams.get('date') || '';
      if (!validDate(date)) return Response.json({ error: 'Data inválida.' }, { status: 400 });
      try {
        const busy = await busySlots(env, date);
        return Response.json({ date, slots: slots().map(time => ({ time, available: !busy.has(time) })) }, { headers: { 'cache-control': 'no-store' } });
      } catch {
        return Response.json({ error: 'Não foi possível consultar a agenda.' }, { status: 500 });
      }
    }
    if (url.pathname === '/api/book' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: 'Dados inválidos.' }, { status: 400 }); }
      const { date, time, service, name } = body || {};
      if (!validDate(date) || !validSlot(time) || !SERVICES.has(service) || typeof name !== 'string' || name.trim().length < 2) {
        return Response.json({ error: 'Informe seu nome e escolha um serviço, uma data e um horário válidos.' }, { status: 400 });
      }
      try {
        const result = await createBooking(env, { date, time, service, name: name.trim() });
        if (result.conflict) return Response.json({ error: 'Esse horário acabou de ser reservado. Escolha outro.' }, { status: 409 });
        return Response.json({ ok: true, eventId: result.eventId });
      } catch {
        return Response.json({ error: 'Não foi possível confirmar o horário agora.' }, { status: 500 });
      }
    }
    return env.ASSETS.fetch(request);
  }
};
