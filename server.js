const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
const KOYEB_HOST = 'open-mora-natking151-ea9216fb.koyeb.app';
const ROOT = __dirname;
const CACHE_DIR = path.join(ROOT, 'cache');
const WEB_DIST = path.join(ROOT, '..', 'build', 'web');

if (!fs.existsSync(CACHE_DIR)) {
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (_) {}
}

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 60,
  maxFreeSockets: 20,
  timeout: 45000
});

// Ultra-fast in-memory cache and in-flight request deduplication
const MEMORY_CACHE = new Map();
const INFLIGHT_REQUESTS = new Map();

function getCachedResponse(key) {
  const item = MEMORY_CACHE.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    MEMORY_CACHE.delete(key);
    return null;
  }
  return item;
}

function setCachedResponse(key, data, ttlMs = 1800000) {
  if (MEMORY_CACHE.size > 1200) {
    const firstKey = MEMORY_CACHE.keys().next().value;
    MEMORY_CACHE.delete(firstKey);
  }
  MEMORY_CACHE.set(key, {
    ...data,
    expiresAt: Date.now() + ttlMs
  });
}

// Token pool with automatic fallback
let tokenPool = [
  '3297ac63-96dd-4522-b27b-76514f9829f0.rH196KmUsjzvHnJz336Uc7u2Xaszt8vQB1cMcKKqCNA',
  '0a137676-ec1d-4601-a661-96b0ced2dbec.eD-WyKiGeRYFf6wzf2oXfRud9dVbnTc00x_dvwStqRg'
];
let currentTokenIdx = 0;

function loadTokens() {
  const tokenFile = path.join(ROOT, 'tokens.json');
  if (fs.existsSync(tokenFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
      if (Array.isArray(data.tokens) && data.tokens.length > 0) {
        tokenPool = data.tokens.map(t => typeof t === 'string' ? t : t.token).filter(Boolean);
      }
    } catch (_) {}
  }
}
loadTokens();

function getActiveToken() {
  return tokenPool[currentTokenIdx % tokenPool.length];
}

function rotateToken() {
  currentTokenIdx = (currentTokenIdx + 1) % tokenPool.length;
  return getActiveToken();
}

function fetchUpstream(upstreamPath) {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(`https://${KOYEB_HOST}${upstreamPath.startsWith('/') ? '' : '/'}${upstreamPath}`);
    const token = getActiveToken();

    const req = https.request({
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: 443,
      path: targetUrl.pathname + targetUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0',
        'Accept': 'application/json, text/plain, */*',
        'Authorization': 'Bearer ' + token
      },
      agent: httpsAgent,
      timeout: 35000
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Upstream timeout'));
    });
    req.on('error', reject);
    req.end();
  });
}

// Active Platforms + Locked Directory
const PLATFORMS = [
  {
    id: 'kgs',
    title: 'Khan GS Research',
    subtitle: 'BPSC, UPSC, SSC & All Exams by Khan Sir',
    logoUrl: 'https://play-lh.googleusercontent.com/57kzPUr7GvTJHgqzUpiOw_fLwldAiuPVbPBbqiFA81U1jEcohJ0MfRzY86Q2rqYSHrHC-eG7DG7sGGMxrB35wQ',
    colors: ['#2563EB', '#1D4ED8'],
    enabled: true,
    isLocked: false,
    tag: '1,080+ Batches'
  },
  {
    id: 'cw',
    title: 'CareerWill',
    subtitle: 'General Competition, Maths, English & Reasoning',
    logoUrl: 'https://play-lh.googleusercontent.com/GuXFo6caz9vT2xBqMrPNQ7pB3KOk9qE9dxrbz42VAjjl8EywFlmJD0-NXAcvvr7Br1Va_NtXuwiztlkxpK5KVA=w480-h960-rw',
    colors: ['#A855F7', '#D946EF'],
    enabled: true,
    isLocked: false,
    tag: 'HLS Streams'
  },
  {
    id: 'rwa',
    title: 'Rojgar With Ankit',
    subtitle: 'UP Police, SSC GD, Railway NTPC & Teaching',
    logoUrl: 'https://nocache-appxdb-v2.classx.co.in/subject/2025-02-10-0.7774698446151698.jpeg',
    colors: ['#059669', '#10B981'],
    enabled: true,
    isLocked: false,
    tag: '191+ Batches'
  },
  {
    id: 'studyiq',
    title: 'Study IQ',
    subtitle: 'UPSC CSE, State PSC, Judiciary & Banking',
    logoUrl: 'https://i.ibb.co/XkjwPNwr/studyiq.png',
    colors: ['#DC2626', '#EF4444'],
    enabled: true,
    isLocked: false,
    tag: '4,700+ Batches'
  },
  {
    id: 'nexttopper',
    title: 'Next Topper',
    subtitle: 'Class 9th-12th Board & Competitive Exams',
    logoUrl: 'https://decicqog4ulhy.cloudfront.net/0/admin_v2/uploads/courses/thumbnail/3880932_1_4415521540_Group%2018441%20%282%29.png',
    colors: ['#D97706', '#F59E0B'],
    enabled: true,
    isLocked: false,
    tag: '20+ Batches'
  },
  {
    id: 'apnacollege',
    title: 'Apna College',
    subtitle: 'Alpha 3.0, Delta, DSA & Full-Stack Coding',
    logoUrl: 'https://lwfiles.mycourse.app/62a6cd5e1e9e2fbf212d608d-public/0f275b1c30123c908cc8491a86d9146a.png',
    colors: ['#4F46E5', '#6366F1'],
    enabled: true,
    isLocked: false,
    tag: '44+ Courses'
  },
  {
    id: 'selectionway',
    title: 'Selection Way',
    subtitle: 'SSC Maths Special, Gagan Pratap Sir & Foundation',
    logoUrl: 'https://i.ibb.co/4ZQRb8gf/favicon.jpg',
    colors: ['#0284C7', '#38BDF8'],
    enabled: true,
    isLocked: false,
    tag: '125+ Batches'
  },
  {
    id: 'tbv2',
    title: 'Testbook V2',
    subtitle: 'Interactive Test Engine & Mock Test Series',
    logoUrl: 'https://i.ibb.co/q3yGXHSv/Testbook.png',
    colors: ['#0D9488', '#14B8A6'],
    enabled: true,
    isLocked: false,
    tag: 'V2 Engine'
  },
  {
    id: 'testbook',
    title: 'Testbook Pro',
    subtitle: '153+ All-India Test Series (56k+ Tests)',
    logoUrl: 'https://cdn-icons-png.flaticon.com/512/3426/3426653.png',
    colors: ['#0284C7', '#0EA5E9'],
    enabled: true,
    isLocked: false,
    tag: '56k+ Tests'
  },
  {
    id: 'kautilya_alp',
    title: 'Kautilya ALP',
    subtitle: 'RRB ALP, Technician & Technical Exams',
    logoUrl: 'https://i.ibb.co/23YX8LCw/2023-08-26-0-8909847966109323.png',
    colors: ['#EA580C', '#F97316'],
    enabled: true,
    isLocked: false,
    tag: 'ALP Special'
  },
  {
    id: 'appx',
    title: 'AppX Directory',
    subtitle: '50+ Coaching Institutes Directory',
    logoUrl: 'https://appx.co.in/favicon.ico',
    colors: ['#6B7280', '#4B5563'],
    enabled: true,
    isLocked: true,
    lockReason: 'Coming Soon • 50+ Coaching Institutes Directory Under Optimization',
    tag: 'Locked'
  }
];

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4'
};

const server = http.createServer(async (req, res) => {
  // Ultra-permissive CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.searchParams;

  function jsonResponse(data, status = 200) {
    const payload = JSON.stringify(data);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload)
    });
    res.end(payload);
  }

  try {
    // 1. Platforms
    if (pathname === '/api/platforms' || pathname === '/api/edu-platforms') {
      return jsonResponse({ success: true, platforms: PLATFORMS });
    }

    // 1b. Cache Purge (Removes stale RAM & Disk cache)
    if (pathname === '/api/cache/clear') {
      MEMORY_CACHE.clear();
      try {
        const files = fs.readdirSync(CACHE_DIR);
        for (const f of files) {
          if (f.endsWith('.json')) {
            try { fs.unlinkSync(path.join(CACHE_DIR, f)); } catch (_) {}
          }
        }
      } catch (_) {}
      return jsonResponse({ success: true, message: 'RAM and Disk caches cleared completely' });
    }

    // 2a. Ultra-Fast In-App PDF Proxy (eliminates CORS & Frame blocking for all platforms)
    if (pathname === '/api/pdf-proxy') {
      const pdfTarget = query.get('url');
      if (!pdfTarget) {
        return jsonResponse({ error: 'url parameter required' }, 400);
      }

      try {
        const targetUrl = new URL(pdfTarget);
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36',
          'Referer': targetUrl.origin + '/'
        };
        if (req.headers['range']) {
          headers['Range'] = req.headers['range'];
        }

        const proxyReq = https.request({
          protocol: targetUrl.protocol,
          hostname: targetUrl.hostname,
          port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
          path: targetUrl.pathname + targetUrl.search,
          method: 'GET',
          headers: headers,
          agent: httpsAgent
        }, (proxyRes) => {
          const resHeaders = { ...proxyRes.headers };
          delete resHeaders['content-security-policy'];
          delete resHeaders['x-frame-options'];
          delete resHeaders['x-content-type-options'];
          resHeaders['access-control-allow-origin'] = '*';
          resHeaders['access-control-allow-methods'] = 'GET, OPTIONS, HEAD';
          resHeaders['access-control-allow-headers'] = '*';
          resHeaders['content-type'] = 'application/pdf';
          resHeaders['content-disposition'] = 'inline';
          resHeaders['cross-origin-resource-policy'] = 'cross-origin';

          res.writeHead(proxyRes.statusCode, resHeaders);
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          jsonResponse({ error: 'PDF Proxy Error', details: err.message }, 502);
        });
        proxyReq.end();
        return;
      } catch (e) {
        return jsonResponse({ error: 'Invalid PDF URL', details: e.message }, 400);
      }
    }

    // 2b. AES-128 Key Proxy (/hls-key & /appx/hls-key from Cryvex Boss)
    if (pathname.startsWith('/hls-key') || pathname.startsWith('/appx/hls-key')) {
      let targetPath = pathname + (parsedUrl.search || '');
      if (pathname.startsWith('/hls-key')) {
        targetPath = '/appx' + targetPath;
      }
      try {
        const token = getActiveToken();
        const keyReq = https.request({
          protocol: 'https:',
          hostname: KOYEB_HOST,
          port: 443,
          path: targetPath,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Authorization': 'Bearer ' + token
          },
          agent: httpsAgent
        }, (keyRes) => {
          const keyChunks = [];
          keyRes.on('data', c => keyChunks.push(c));
          keyRes.on('end', () => {
            const buf = Buffer.concat(keyChunks);
            res.writeHead(keyRes.statusCode, {
              'Content-Type': 'application/octet-stream',
              'Content-Length': buf.length,
              'Access-Control-Allow-Origin': '*'
            });
            res.end(buf);
          });
        });
        keyReq.on('error', () => {
          jsonResponse({ error: 'Key error' }, 502);
        });
        keyReq.end();
        return;
      } catch (e) {
        return jsonResponse({ error: 'Key exception' }, 500);
      }
    }

    // 2. High-Speed HLS Stream & Segment Proxy with Referer Injector (For RWA & ClassX)
    if (pathname === '/hls' || pathname === '/proxy') {
      const targetUrlStr = query.get('url');
      const refererStr = query.get('referer') || 'https://rwa-web.classx.co.in/';

      if (!targetUrlStr) {
        return jsonResponse({ error: 'url parameter required' }, 400);
      }

      try {
        const targetUrl = new URL(targetUrlStr);
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0',
          'Referer': refererStr
        };

        if (req.headers['range']) {
          headers['Range'] = req.headers['range'];
        }

        const proxyReq = https.request({
          protocol: targetUrl.protocol,
          hostname: targetUrl.hostname,
          port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
          path: targetUrl.pathname + targetUrl.search,
          method: req.method,
          headers: headers,
          agent: httpsAgent
        }, (proxyRes) => {
          const resHeaders = { ...proxyRes.headers };
          delete resHeaders['content-security-policy'];
          delete resHeaders['x-frame-options'];
          delete resHeaders['x-content-type-options'];
          delete resHeaders['content-encoding'];
          delete resHeaders['transfer-encoding'];

          resHeaders['access-control-allow-origin'] = '*';
          resHeaders['access-control-allow-methods'] = 'GET, POST, OPTIONS, HEAD';
          resHeaders['access-control-allow-headers'] = '*';
          resHeaders['cross-origin-resource-policy'] = 'cross-origin';

          const isM3u8 = (resHeaders['content-type'] || '').includes('mpegurl') || targetUrlStr.includes('.m3u8');
          if (isM3u8) {
            const bodyChunks = [];
            proxyRes.on('data', chunk => bodyChunks.push(chunk));
            proxyRes.on('end', () => {
              let text = Buffer.concat(bodyChunks).toString('utf8');
              const baseDir = targetUrlStr.substring(0, targetUrlStr.lastIndexOf('/') + 1);
              const lines = text.split('\n');
              const proto = req.headers['x-forwarded-proto'] || 'https';
              const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'nainoxhrry-backend-production.up.railway.app';
              const proxyBase = `${proto}://${host}`;

              let parentQuery = '';
              try {
                parentQuery = new URL(targetUrlStr).search;
              } catch (_) {}

              const rewritten = lines.map(line => {
                const trimmed = line.trim();
                if (!trimmed) return line;
                if (trimmed.startsWith('#')) {
                  // Rewrite AES-128 key URI so ExoPlayer on Android can fetch encryption key with proxy headers
                  if (trimmed.includes('URI=')) {
                    return line.replace(/URI=["']([^"']+)["']/, (match, uri) => {
                      let keyUrl = uri;
                      if (!keyUrl.startsWith('http://') && !keyUrl.startsWith('https://')) {
                        keyUrl = baseDir + keyUrl;
                      }
                      return `URI="${proxyBase}/hls?url=${encodeURIComponent(keyUrl)}&referer=${encodeURIComponent(refererStr)}"`;
                    });
                  }
                  return line;
                }
                let segmentUrl = trimmed;
                if (!segmentUrl.startsWith('http://') && !segmentUrl.startsWith('https://')) {
                  segmentUrl = baseDir + segmentUrl;
                }
                if (parentQuery && !segmentUrl.includes('?')) {
                  segmentUrl += parentQuery;
                }
                return `${proxyBase}/hls?url=${encodeURIComponent(segmentUrl)}&referer=${encodeURIComponent(refererStr)}`;
              }).join('\n');

              const outBuf = Buffer.from(rewritten, 'utf8');
              resHeaders['content-length'] = outBuf.length;
              resHeaders['content-type'] = 'application/vnd.apple.mpegurl';
              res.writeHead(proxyRes.statusCode, resHeaders);
              res.end(outBuf);
            });
            return;
          }

          res.writeHead(proxyRes.statusCode, resHeaders);
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
          jsonResponse({ error: 'HLS proxy error', details: err.message }, 502);
        });
        proxyReq.end();
        return;
      } catch (e) {
        return jsonResponse({ error: 'Invalid URL', details: e.message }, 400);
      }
    }

    // 3. Transparent & Cached Routes for all Platforms
    const isPlatformRoute = pathname.startsWith('/kgs/') ||
      pathname.startsWith('/cw/') ||
      pathname.startsWith('/rwa/') ||
      pathname.startsWith('/studyiq/') ||
      pathname.startsWith('/nexttopper/') ||
      pathname.startsWith('/apnacollege/') ||
      pathname.startsWith('/selectionway/') ||
      pathname.startsWith('/testbook/') ||
      pathname === '/testbook' ||
      pathname.startsWith('/appx/') ||
      pathname.startsWith('/kautilya_alp/') ||
      pathname === '/kautilya_alp' ||
      pathname.startsWith('/tbv2/') ||
      pathname === '/tbv2' ||
      pathname.startsWith('/pw/') ||
      pathname.startsWith('/winners/') ||
      pathname.startsWith('/cds/') ||
      pathname.startsWith('/tg/');

    if (isPlatformRoute) {
      let targetPath = pathname + (parsedUrl.search || '');
      if (pathname.startsWith('/kautilya_alp/batches')) {
        targetPath = '/appx/batches?apiBase=' + encodeURIComponent('https://kautilyaalpjeapi.classx.co.in');
      } else if (pathname.startsWith('/tbv2/series')) {
        targetPath = '/testbook/series';
      }

      const isNoCache = query.get('nocache') === '1' || query.get('refresh') === '1';
      const isVideoDetails = pathname.includes('/video-details');

      // 1. Check ultra-fast RAM cache (never cache video-details with short-lived tokens on disk)
      if (!isNoCache && !isVideoDetails) {
        const ramCached = getCachedResponse(targetPath);
        if (ramCached) {
          res.writeHead(200, {
            'Content-Type': ramCached.contentType || 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(ramCached.body),
            'X-Cache': 'HIT-RAM'
          });
          return res.end(ramCached.body);
        }
      }

      const safeKey = targetPath.replace(/[^a-zA-Z0-9_-]/g, '_');
      const cacheKey = path.join(CACHE_DIR, `${safeKey}.json`);

      // 2. Check Disk Cache (only for batches/directories, NEVER for video-details)
      if (!isNoCache && !isVideoDetails && fs.existsSync(cacheKey)) {
        try {
          const cached = fs.readFileSync(cacheKey, 'utf8');
          const parsedCache = JSON.parse(cached);
          // Don't serve empty batches from cache!
          const isEmpty = targetPath.includes('/batches') && Array.isArray(parsedCache.batches) && parsedCache.batches.length === 0;
          if (!isEmpty) {
            setCachedResponse(targetPath, { body: cached, contentType: 'application/json; charset=utf-8' });
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': Buffer.byteLength(cached),
              'X-Cache': 'HIT-DISK'
            });
            return res.end(cached);
          }
        } catch (_) {}
      }

      // 3. In-flight promise deduplication
      let upstreamPromise = INFLIGHT_REQUESTS.get(targetPath);
      if (!upstreamPromise) {
        upstreamPromise = (async () => {
          let up;
          try {
            up = await fetchUpstream(targetPath);
            if (up.status === 401 || up.status === 403 || up.status >= 500) {
              rotateToken();
              up = await fetchUpstream(targetPath);
            }
            // Auto-retry if upstream returned empty batches on first attempt
            if (targetPath.includes('/batches')) {
              try {
                const chk = JSON.parse(up.body);
                if (chk && Array.isArray(chk.batches) && chk.batches.length === 0) {
                  rotateToken();
                  up = await fetchUpstream(targetPath);
                }
              } catch (_) {}
            }
          } catch (err) {
            rotateToken();
            try {
              up = await fetchUpstream(targetPath);
            } catch (e2) {
              up = {
                status: 503,
                headers: { 'content-type': 'application/json; charset=utf-8' },
                body: JSON.stringify({ success: false, available: false, error: 'Upstream server busy. Please retry.' })
              };
            }
          }
          return up;
        })().finally(() => {
          INFLIGHT_REQUESTS.delete(targetPath);
        });
        INFLIGHT_REQUESTS.set(targetPath, upstreamPromise);
      }

      let upstream;
      try {
        upstream = await upstreamPromise;
      } catch (err) {
        upstream = {
          status: 503,
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ success: false, available: false, error: 'Upstream connection error.' })
        };
      }

      // If video-details returned error from KGS/RWA (e.g. pending live class or recording not uploaded)
      if (pathname.includes('/video-details') && (upstream.status >= 400 || upstream.body.includes('Failed to fetch'))) {
        const payload = JSON.stringify({
          success: false,
          available: false,
          error: 'Is lecture ka video abhi server par ready/uploaded nahi hai (Live discussion ya pending recording).'
        });
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(payload),
          'X-Handled': 'Normalized'
        });
        return res.end(payload);
      }

      if (upstream.status >= 200 && upstream.status < 300) {
        try {
          const parsed = JSON.parse(upstream.body);
          if (parsed && parsed.success !== false && !parsed.error) {
            const isEmptyBatches = targetPath.includes('/batches') && Array.isArray(parsed.batches) && parsed.batches.length === 0;
            if (isVideoDetails) {
              // Cache video-details in RAM for ONLY 60 seconds (prevents expired CloudFront/Edge tokens)
              setCachedResponse(targetPath, {
                body: upstream.body,
                contentType: upstream.headers['content-type'] || 'application/json; charset=utf-8'
              }, 60000);
            } else if (!isEmptyBatches) {
              const ttl = targetPath.includes('/batches') ? 1800000 : 900000;
              setCachedResponse(targetPath, {
                body: upstream.body,
                contentType: upstream.headers['content-type'] || 'application/json; charset=utf-8'
              }, ttl);
              try { fs.writeFileSync(cacheKey, upstream.body); } catch (_) {}
            }
          }
        } catch (_) {}
      }

      res.writeHead(upstream.status, {
        'Content-Type': upstream.headers['content-type'] || 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(upstream.body),
        'X-Cache': 'MISS'
      });
      return res.end(upstream.body);
    }

    // 4. Serve Flutter Web Static Build
    if (fs.existsSync(WEB_DIST)) {
      let targetFile = path.join(WEB_DIST, pathname === '/' ? 'index.html' : pathname.replace(/^\//, ''));
      if (!fs.existsSync(targetFile) || fs.statSync(targetFile).isDirectory()) {
        targetFile = path.join(WEB_DIST, 'index.html');
      }

      if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
        const ext = path.extname(targetFile).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_MAP[ext] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*'
        });
        return fs.createReadStream(targetFile).pipe(res);
      }
    }

    jsonResponse({ error: 'Not found', path: pathname }, 404);
  } catch (err) {
    console.error('[Server Error]:', err.message);
    jsonResponse({ error: 'Server error', details: err.message }, 500);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` ⚡ Nainoxhrry Supercharged Backend running on :${PORT}`);
  console.log(` 📚 Active Platforms: Khan GS, CareerWill, RWA, Testbook`);
  console.log(` 🔒 Coming Soon: AppX Coaching Directory`);
  console.log(` 🚀 HLS Proxy: Enabled with Auto-Referer Injector`);
  console.log(`=======================================================`);
});
