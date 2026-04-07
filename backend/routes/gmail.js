// routes/gmail.js
// Robust Gmail OAuth + incremental fetch with bootstrap and cursor recovery

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const authenticate = require('../middleware/auth');
const GmailTokens = require('../models/GmailToken'); // see models/GmailToken.js

// ------------ helpers ------------
function b64urlToUtf8(b64url) {
  if (!b64url) return '';
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const buff = Buffer.from(b64, 'base64');
  return buff.toString('utf8');
}

function extractPlainText(payload) {
  if (!payload) return '';
  // Prefer text/plain
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return b64urlToUtf8(payload.body.data);
  }
  const plain = (payload.parts || []).find(p => p.mimeType === 'text/plain' && p.body?.data);
  if (plain) return b64urlToUtf8(plain.body.data);
  // Fallback: strip HTML
  const html = (payload.parts || []).find(p => p.mimeType === 'text/html' && p.body?.data);
  if (html) return b64urlToUtf8(html.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  // Last resort: body on root
  if (payload.body?.data) return b64urlToUtf8(payload.body.data);
  return '';
}

async function gmailProfile(accessToken) {
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!r.ok) throw new Error(`profile_error ${r.status}`);
  return r.json();
}

async function tokenExchangeByCode(code) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`token_code_error ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function refreshAccess(rec) {
  // If not close to expiry, reuse
  if (rec.access_token && rec.expiry_date && rec.expiry_date > Date.now() + 60_000) return rec;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: rec.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`token_refresh_error ${r.status} ${JSON.stringify(j)}`);
  rec.access_token = j.access_token;
  rec.expiry_date = Date.now() + (j.expires_in || 0) * 1000;
  await GmailTokens.updateOne(
    { userId: rec.userId },
    { $set: { access_token: rec.access_token, expiry_date: rec.expiry_date } }
  );
  return rec;
}

async function fetchHistoryAll(accessToken, startHistoryId) {
  // Pull and paginate History; no label filter to avoid missing archived/auto-labeled messages
  const ids = new Set();
  let nextPageToken = undefined;
  let lastHistoryId = null;

  do {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/history');
    url.searchParams.set('startHistoryId', String(startHistoryId));
    if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);

    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (r.status === 404) {
      // startHistoryId too old or invalid
      const err = new Error('history_404');
      err.code = 404;
      throw err;
    }
    const j = await r.json();
    if (!r.ok) throw new Error(`history_error ${r.status} ${JSON.stringify(j)}`);

    (j.history || []).forEach(h => {
      (h.messagesAdded || []).forEach(m => ids.add(m.message.id));
    });
    lastHistoryId = j.historyId || lastHistoryId;
    nextPageToken = j.nextPageToken;
  } while (nextPageToken);

  return { ids: Array.from(ids), lastHistoryId };
}

async function fetchMessages(accessToken, ids, limit) {
  const slice = ids.slice(0, Math.min(limit, 50)); // cap to avoid bursts
  const out = [];
  for (const id of slice) {
    const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const j = await r.json();
    if (!r.ok) continue;
    const hdr = name => (j.payload?.headers || []).find(h => h.name.toLowerCase() === name)?.value || '';
    const subject = hdr('subject');
    out.push({
      id,
      threadId: j.threadId,
      from: hdr('from'),
      to: hdr('to'),
      date: hdr('date'),
      title: subject,
      description: extractPlainText(j.payload)
    });
  }
  return out;
}

async function bootstrapList(accessToken, { windowDays = 7, unreadOnly = true, limit = 10 }) {
  const qParts = [`newer_than:${Math.max(1, windowDays)}d`, 'in:inbox', '-label:chats'];
  if (unreadOnly) qParts.push('is:unread');
  const q = qParts.join(' ');
  const ids = [];
  let nextPageToken;
  do {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    url.searchParams.set('q', q);
    url.searchParams.set('maxResults', String(Math.min(50, limit - ids.length)));
    if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);

    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(`list_error ${r.status} ${JSON.stringify(j)}`);
    (j.messages || []).forEach(m => ids.push(m.id));
    nextPageToken = j.nextPageToken && ids.length < limit ? j.nextPageToken : undefined;
  } while (nextPageToken && ids.length < limit);

  return ids;
}

// ------------ routes ------------

// POST /api/gmail/auth/url  -> consent URL
router.post('/auth/url', authenticate, async (req, res) => {
  const state = jwt.sign({ uid: req.user.id }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const base = 'https://accounts.google.com/o/oauth2/v2/auth';
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI, // /api/gmail/auth/callback
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state
  });
  return res.json({ url: `${base}?${params.toString()}` });
});

// GET /api/gmail/auth/callback  -> store refresh token + seed cursor
router.get('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const { uid } = jwt.verify(state, process.env.JWT_SECRET);
    const tokens = await tokenExchangeByCode(code);

    // Seed cursor with current historyId
    const profile = await gmailProfile(tokens.access_token);

    await GmailTokens.findOneAndUpdate(
      { userId: uid },
      {
        $set: {
          refresh_token: tokens.refresh_token, // present on first consent
          access_token: tokens.access_token,
          expiry_date: Date.now() + (tokens.expires_in || 0) * 1000,
          last_history_id: profile.historyId,
          last_fetched_at: new Date(),
          scopes: ['https://www.googleapis.com/auth/gmail.readonly']
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).send('Gmail connected. You can close this tab.');
  } catch (e) {
    console.error('oauth_callback_error', e);
    return res.status(400).send('Gmail connect failed.');
  }
});

// GET /api/gmail/status
router.get('/status', authenticate, async (req, res) => {
  const rec = await GmailTokens.findOne({ userId: req.user.id }).lean();
  return res.json({
    connected: !!rec?.refresh_token,
    last_history_id: rec?.last_history_id || null,
    last_fetched_at: rec?.last_fetched_at || null
  });
});

// POST /api/gmail/fetch  -> robust fetch
// body: { limit?, windowDays?, unreadOnly?, forceBootstrap? }
router.post('/fetch', authenticate, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.body?.limit || 10), 1), 50);
    const windowDays = Math.min(Math.max(Number(req.body?.windowDays || 7), 1), 30);
    const unreadOnly = req.body?.unreadOnly !== false; // default true
    const forceBootstrap = req.body?.forceBootstrap === true;

    let rec = await GmailTokens.findOne({ userId: req.user.id });
    if (!rec?.refresh_token) return res.status(400).json({ msg: 'not_connected' });

    rec = await refreshAccess(rec);

    // Try incremental history unless forced to bootstrap or we lack a cursor
    let source = 'history';
    let ids = [];
    let nextCursor = rec.last_history_id;

    if (!forceBootstrap && rec.last_history_id) {
      try {
        const hist = await fetchHistoryAll(rec.access_token, rec.last_history_id);
        ids = hist.ids;
        nextCursor = hist.lastHistoryId || rec.last_history_id;
      } catch (e) {
        if (e.code === 404) {
          // Cursor too old; reseed from profile and fall back to bootstrap
          const prof = await gmailProfile(rec.access_token);
          nextCursor = prof.historyId;
          source = 'bootstrap';
        } else {
          throw e;
        }
      }
    } else {
      source = 'bootstrap';
    }

    if (source === 'bootstrap' || ids.length === 0) {
      const bIds = await bootstrapList(rec.access_token, { windowDays, unreadOnly, limit });
      ids = bIds;
      // After bootstrap, seed cursor for future deltas
      const prof = await gmailProfile(rec.access_token);
      nextCursor = prof.historyId;
    }

    const candidates = await fetchMessages(rec.access_token, ids, limit);

    // Advance cursor (only if we have one)
    if (nextCursor) {
      await GmailTokens.updateOne(
        { userId: req.user.id },
        { $set: { last_history_id: String(nextCursor), last_fetched_at: new Date() } }
      );
    }

    return res.json({
      source,
      count: candidates.length,
      candidates
    });
  } catch (e) {
    console.error('gmail_fetch_error', e);
    return res.status(500).json({ msg: 'gmail_fetch_error' });
  }
});

module.exports = router;
