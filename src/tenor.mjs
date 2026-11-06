// Tenor GIF search for the Tenor GIF Search plugin. Tenor's own API is closed (it shut down on 30 June 2026), so this reads the public
// search page the way a browser does: ONE page load per search someone types, never in bulk and never downloading the GIFs themselves
// (the app just shows them straight from Tenor's own servers). Searches are queued one at a time, remembered for a few minutes, and
// capped per minute. The page can only send a short search phrase; it never supplies an address, so nothing else can be fetched.
const HOST_OK = /^https:\/\/media\d*\.tenor\.com\//;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MAX_BYTES = 4 * 1024 * 1024;

const decode = (t) => String(t ?? '').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attr = (tag, name) => { const m = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tag); return m ? decode(m[1]) : ''; };

// Turns a search page into a list of GIFs. Exported so it can be tested without the network.
export function parseResults(html, limit = 48) {
  const out = []; const seen = new Set();
  for (const chunk of String(html).split('<figure class="UniversalGifListItem').slice(1)) {
    const block = chunk.split('</figure>')[0];
    const href = /<a href="(\/view\/[^"]+)"/.exec(block)?.[1];
    const imgTag = /<img\s[^>]*>/i.exec(block)?.[0];
    if (!href || !imgTag) continue;
    const url = attr(imgTag, 'src');
    if (!HOST_OK.test(url) || seen.has(url)) continue;
    seen.add(url);
    const webp = /<source type="image\/webp" srcset="([^"\s]+)/.exec(block)?.[1];
    const mp4 = /<source type="video\/mp4" srcset="([^"\s]+)/.exec(block)?.[1];
    const w = Number(attr(imgTag, 'width')) || Number(/data-width="(\d+)"/.exec(chunk)?.[1]) || 200;
    const h = Number(attr(imgTag, 'height')) || Number(/data-height="(\d+)"/.exec(chunk)?.[1]) || 200;
    out.push({
      id: /-(\d{6,})$/.exec(href)?.[1] || href, title: attr(imgTag, 'alt'), url, preview: webp && HOST_OK.test(webp) ? webp : url,
      mp4: mp4 && HOST_OK.test(mp4) ? mp4 : '', w: Math.round(w), h: Math.round(h), page: `https://tenor.com${href}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

// Tenor's home page also carries its current trending searches with a picture each: the category tiles.
export function parseCategories(html, limit = 16) {
  const out = []; const seen = new Set();
  const un = (t) => { try { return JSON.parse(`"${t}"`); } catch { return ''; } };
  const STR = '((?:[^"\\\\]|\\\\.)*)'; // the inside of a JSON string: anything but a quote or backslash, or a backslash and one character
  const re = new RegExp(`"searchterm":"${STR}","path":"(?:[^"\\\\]|\\\\.)*","image":"${STR}","name":"${STR}"`, 'g');
  for (const m of String(html).matchAll(re)) {
    const term = un(m[1]).trim(), image = un(m[2]), name = un(m[3]).replace(/^#/, '').trim();
    if (!term || term.length > 60 || !HOST_OK.test(image) || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase()); out.push({ term, name: name || term, image });
    if (out.length >= limit) break;
  }
  return out;
}

export function cleanQuery(q) {
  const t = String(q ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 80) return null;
  const slug = t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return slug ? { text: t, slug } : null;
}

export function createTenor({ fetchFn = globalThis.fetch, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), minGapMs = 900, perMinute = 24, ttlMs = 10 * 60 * 1000, timeoutMs = 12000 } = {}) {
  const cache = new Map(); // slug -> { at, results }
  let chain = Promise.resolve(); let lastAt = 0; const stamps = [];

  async function fetchPage(url) {
    const res = await fetchFn(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`Tenor answered ${res.status}`);
    if (res.url && !/^https:\/\/tenor\.com\//.test(res.url)) throw new Error('Tenor sent us somewhere else');
    const len = Number(res.headers?.get?.('content-length')) || 0;
    if (len > MAX_BYTES) throw new Error('The page was too big');
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error('The page was too big');
    return text;
  }

  function search(q, limit = 48) {
    const c = cleanQuery(q);
    if (!c) return Promise.resolve({ ok: false, error: 'Type a search of 1 to 80 characters.' });
    const hit = cache.get(c.slug);
    if (hit && now() - hit.at < ttlMs) return Promise.resolve({ ok: true, query: c.text, results: hit.results.slice(0, limit), cached: true });
    const run = chain.then(async () => {
      const again = cache.get(c.slug); if (again && now() - again.at < ttlMs) return { ok: true, query: c.text, results: again.results.slice(0, limit), cached: true };
      while (stamps.length && now() - stamps[0] > 60000) stamps.shift();
      if (stamps.length >= perMinute) return { ok: false, error: 'That is a lot of searches. Wait a moment and try again.' };
      const wait = minGapMs - (now() - lastAt); if (wait > 0) await sleep(wait);
      lastAt = now(); stamps.push(lastAt);
      try {
        const results = parseResults(await fetchPage(`https://tenor.com/search/${encodeURIComponent(c.slug)}-gifs`), 48);
        if (cache.size >= 60) cache.delete(cache.keys().next().value);
        if (results.length) cache.set(c.slug, { at: now(), results });
        return { ok: true, query: c.text, results: results.slice(0, limit) };
      } catch (e) { return { ok: false, error: String(e?.message ?? e).slice(0, 160) }; }
    });
    chain = run.catch(() => {});
    return run;
  }
  // The front page: what is trending now, and the category tiles. One page load, remembered like a search.
  function home(limit = 48) {
    const hit = cache.get('\u0000home');
    if (hit && now() - hit.at < ttlMs) return Promise.resolve({ ok: true, ...hit.value, trending: hit.value.trending.slice(0, limit), cached: true });
    const run = chain.then(async () => {
      const again = cache.get('\u0000home'); if (again && now() - again.at < ttlMs) return { ok: true, ...again.value, trending: again.value.trending.slice(0, limit), cached: true };
      while (stamps.length && now() - stamps[0] > 60000) stamps.shift();
      if (stamps.length >= perMinute) return { ok: false, error: 'That is a lot of searches. Wait a moment and try again.' };
      const wait = minGapMs - (now() - lastAt); if (wait > 0) await sleep(wait);
      lastAt = now(); stamps.push(lastAt);
      try {
        const html = await fetchPage('https://tenor.com/');
        const value = { trending: parseResults(html, 48), categories: parseCategories(html) };
        if (value.trending.length) cache.set('\u0000home', { at: now(), value });
        return { ok: true, ...value, trending: value.trending.slice(0, limit) };
      } catch (e) { return { ok: false, error: String(e?.message ?? e).slice(0, 160) }; }
    });
    chain = run.catch(() => {});
    return run;
  }
  return { search, home };
}
