import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '5mb' }));

/**
 * Helper to extract coordinates and venue place name from Google Maps URLs and HTML
 */
function extractCoordinatesAndName(rawUrl: string, htmlContent: string = '') {
  let lat: number | undefined = undefined;
  let lng: number | undefined = undefined;
  let venueName: string | undefined = undefined;

  let decoded = rawUrl;
  try {
    decoded = decodeURIComponent(rawUrl);
  } catch {
    decoded = rawUrl;
  }

  // 1. Extract venue name from /place/Venue+Name/
  const placeNameMatch = decoded.match(/\/place\/([^/@?]+)/i);
  if (placeNameMatch && placeNameMatch[1]) {
    const rawPlace = placeNameMatch[1].replace(/\+/g, ' ').replace(/_/g, ' ').trim();
    if (!/^-?\d+(?:\.\d+)?,-?\d+/.test(rawPlace) && !rawPlace.includes('°')) {
      venueName = rawPlace;
    }
  }

  // 2. Extract venue name from HTML <title> or <meta property="og:title">
  if (htmlContent) {
    const ogTitleMatch = htmlContent.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
      htmlContent.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
      const cleanTitle = ogTitleMatch[1].replace(/ - Google Maps$/i, '').replace(/ · .*$/i, '').trim();
      if (cleanTitle && !cleanTitle.includes('Google Maps') && !cleanTitle.includes('404')) {
        venueName = venueName || cleanTitle;
      }
    }

    if (!venueName) {
      const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        const cleanTitle = titleMatch[1].replace(/ - Google Maps$/i, '').replace(/ · .*$/i, '').trim();
        if (cleanTitle && !cleanTitle.includes('Google Maps') && !cleanTitle.includes('404')) {
          venueName = cleanTitle;
        }
      }
    }
  }

  // 3. Extract coordinates from data parameters: !3d<lat>!4d<lng>
  const dataParamRegex = /!3d(-?\d{1,2}(?:\.\d+)?)[^!]*!4d(-?\d{1,3}(?:\.\d+)?)/;
  const dataMatch = decoded.match(dataParamRegex);
  if (dataMatch) {
    lat = parseFloat(dataMatch[1]);
    lng = parseFloat(dataMatch[2]);
  }

  // 4. Extract coordinates from @<lat>,<lng> pattern
  if (lat === undefined || lng === undefined) {
    const atMatch = decoded.match(/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
    if (atMatch) {
      lat = parseFloat(atMatch[1]);
      lng = parseFloat(atMatch[2]);
    }
  }

  // 5. Extract coordinates from query parameters ?q=lat,lng or ?ll=lat,lng or ?center=lat,lng
  if (lat === undefined || lng === undefined) {
    const queryParamRegex = /[?&](?:q|query|ll|destination|daddr|saddr|center)=(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/i;
    const queryMatch = decoded.match(queryParamRegex);
    if (queryMatch) {
      lat = parseFloat(queryMatch[1]);
      lng = parseFloat(queryMatch[2]);
    }
  }

  // 6. Extract coordinates from HTML meta tags or static map preview
  if ((lat === undefined || lng === undefined) && htmlContent) {
    // Static map meta image: center=6.5954%2C3.3421 or center=6.5954,3.3421
    const staticMapMatch = htmlContent.match(/staticmap[^"']*?[?&]center=(-?\d{1,2}(?:\.\d+)?)(?:%2C|,)(-?\d{1,3}(?:\.\d+)?)/i);
    if (staticMapMatch) {
      lat = parseFloat(staticMapMatch[1]);
      lng = parseFloat(staticMapMatch[2]);
    }

    if (lat === undefined || lng === undefined) {
      // itemprop="image" content="https://maps.google.com/maps/api/staticmap?center=...
      const itemPropMatch = htmlContent.match(/itemprop=["']image["']\s+content=["'][^"']*?center=(-?\d{1,2}(?:\.\d+)?)(?:%2C|,)(-?\d{1,3}(?:\.\d+)?)/i) ||
        htmlContent.match(/content=["'][^"']*?center=(-?\d{1,2}(?:\.\d+)?)(?:%2C|,)(-?\d{1,3}(?:\.\d+)?)[^"']*?itemprop=["']image["']/i);
      if (itemPropMatch) {
        lat = parseFloat(itemPropMatch[1]);
        lng = parseFloat(itemPropMatch[2]);
      }
    }

    if (lat === undefined || lng === undefined) {
      // APP_INITIALIZATION_STATE or window._pageData coordinates pattern: [null,null,lat,lng]
      const initStateMatch = htmlContent.match(/\[null,null,(-?\d{1,2}\.\d{3,9}),(-?\d{1,3}\.\d{3,9})\]/);
      if (initStateMatch) {
        lat = parseFloat(initStateMatch[1]);
        lng = parseFloat(initStateMatch[2]);
      }
    }

    if (lat === undefined || lng === undefined) {
      // Data-lat and data-lng attributes
      const latAttr = htmlContent.match(/itemprop=["']latitude["']\s+content=["'](-?\d{1,2}(?:\.\d+)?)["']/i);
      const lngAttr = htmlContent.match(/itemprop=["']longitude["']\s+content=["'](-?\d{1,3}(?:\.\d+)?)["']/i);
      if (latAttr && lngAttr) {
        lat = parseFloat(latAttr[1]);
        lng = parseFloat(lngAttr[1]);
      }
    }
  }

  // 7. Check path-based coords: e.g. /search/6.5954,3.3421
  if (lat === undefined || lng === undefined) {
    const pathCoordRegex = /\/(?:search|place|dir)\/[^/]*?(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/i;
    const pathMatch = decoded.match(pathCoordRegex);
    if (pathMatch) {
      lat = parseFloat(pathMatch[1]);
      lng = parseFloat(pathMatch[2]);
    }
  }

  if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        venueName: venueName ? venueName.replace(/\+/g, ' ') : undefined,
      };
    }
  }

  return { lat: undefined, lng: undefined, venueName };
}

/**
 * POST /api/resolve-maps-url
 * Accepts { url: string } and follows redirects to unshorten Google Maps share links,
 * extracting latitude, longitude, and place title.
 */
app.post('/api/resolve-maps-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing required "url" parameter in request body.',
      });
    }

    const trimmedUrl = url.trim();

    // Check if raw coordinates directly: e.g. "6.5954, 3.3421"
    const rawCoordMatch = trimmedUrl.match(/^[\[\(]?\s*(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)\s*[\)\]]?$/);
    if (rawCoordMatch) {
      const lat = parseFloat(rawCoordMatch[1]);
      const lng = parseFloat(rawCoordMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return res.json({
          success: true,
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          sourceType: 'coordinates',
          resolvedUrl: trimmedUrl,
          originalUrl: trimmedUrl,
        });
      }
    }

    // Ensure valid URL scheme
    let targetUrl = trimmedUrl;
    if (!/^https?:\/\//i.test(targetUrl)) {
      if (targetUrl.includes('goo.gl') || targetUrl.includes('maps.') || targetUrl.includes('google.com/maps')) {
        targetUrl = 'https://' + targetUrl;
      }
    }

    // Try direct extraction first from the input string
    const quickExtract = extractCoordinatesAndName(targetUrl, '');
    if (quickExtract.lat !== undefined && quickExtract.lng !== undefined && !targetUrl.includes('goo.gl') && !targetUrl.includes('maps.app')) {
      return res.json({
        success: true,
        latitude: quickExtract.lat,
        longitude: quickExtract.lng,
        venueName: quickExtract.venueName,
        sourceType: 'direct_url',
        resolvedUrl: targetUrl,
        originalUrl: trimmedUrl,
      });
    }

    // Fetch and follow HTTP redirects to unshorten
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    clearTimeout(timeout);

    const finalUrl = response.url || targetUrl;
    const html = await response.text();

    const extracted = extractCoordinatesAndName(finalUrl, html);

    if (extracted.lat !== undefined && extracted.lng !== undefined) {
      return res.json({
        success: true,
        latitude: extracted.lat,
        longitude: extracted.lng,
        venueName: extracted.venueName,
        sourceType: 'short_url_resolved',
        resolvedUrl: finalUrl,
        originalUrl: trimmedUrl,
      });
    }

    // If still missing coordinates after full resolve
    return res.json({
      success: false,
      error:
        'Could not locate exact GPS coordinates from this Google Maps link. Try opening it in Google Maps, clicking "Share", or copying the full browser URL with @lat,lng.',
      resolvedUrl: finalUrl,
      originalUrl: trimmedUrl,
      venueName: extracted.venueName,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error resolving Google Maps URL.';
    return res.status(500).json({
      success: false,
      error: `Failed to resolve link: ${errorMsg}`,
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        if (e instanceof Error) {
          vite.ssrFixStacktrace(e);
        }
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IWasHere server running on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Server failed to start:', err);
});
