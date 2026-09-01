const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const SLOT_HOURS = Array.from({ length: 13 }, (_, i) => i + 8);

let cachedToken = null;
let cachedUntil = 0;

function base64url(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function textBase64url(text) {
  return btoa(unescape(encodeURIComponent(text)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  return date >= today;
}

export function validSlot(time) {
  return /^(0[89]|1[0-9]|20):00$/.test(time);
}

export function slots() {
  return SLOT_HOURS.map(h => String(h).padStart(2, '0') + ':00');
}

async function accessToken(env) {
  if (cachedToken && Date.now() < cachedUntil) return cachedToken;
  if (!env.SERVICE_ACCOUNT_JSON) throw new Error('SERVICE_ACCOUNT_JSON is not configured');
  const account = JSON.parse(env.SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const header = textBase64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = textBase64url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToArrayBuffer(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' }, key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64url(signature)}`;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  if (!response.ok) throw new Error(`Google token request failed: ${response.status}`);
  const data = await response.json();
  cachedToken = data.access_token;
  cachedUntil = Date.now() + Math.max(60, (data.expires_in || 3600) - 120) * 1000;
  return cachedToken;
}

async function calendarRequest(env, path, init = {}) {
  if (!env.CALENDAR_ID) throw new Error('CALENDAR_ID is not configured');
  const token = await accessToken(env);
  const response = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(env.CALENDAR_ID)}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Google Calendar request failed: ${response.status}`);
  return data;
}

export async function busySlots(env, date) {
  const params = new URLSearchParams({
    timeMin: `${date}T08:00:00-03:00`,
    timeMax: `${date}T21:00:00-03:00`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100'
  });
  const data = await calendarRequest(env, `/events?${params}`);
  const busy = new Set();
  for (const event of data.items || []) {
    if (event.start?.date && !event.start?.dateTime) return new Set(slots());
    const start = event.start?.dateTime;
    const end = event.end?.dateTime;
    if (!start || !end) continue;
    const startHour = Number(start.slice(11, 13));
    const endHour = Number(end.slice(11, 13));
    for (let h = Math.max(8, startHour); h < Math.min(21, endHour); h++) {
      busy.add(String(h).padStart(2, '0') + ':00');
    }
  }
  return busy;
}

export async function createBooking(env, { date, time, service, name }) {
  const busy = await busySlots(env, date);
  if (busy.has(time)) return { conflict: true };
  const hour = Number(time.slice(0, 2));
  const end = String(hour + 1).padStart(2, '0') + ':00';
  const event = await calendarRequest(env, '/events', {
    method: 'POST',
    body: JSON.stringify({
      summary: `Orçamento de tatuagem — ${name}`,
      description: `Solicitação pelo site.\nNome: ${name}\nEstilo: ${service}\nSinal: 20% do orçamento, a combinar pelo WhatsApp.`,
      start: { dateTime: `${date}T${time}:00-03:00`, timeZone: 'America/Sao_Paulo' },
      end: { dateTime: `${date}T${end}:00-03:00`, timeZone: 'America/Sao_Paulo' },
      transparency: 'opaque',
      colorId: '6'
    })
  });
  return { conflict: false, eventId: event.id };
}
