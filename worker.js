const ASSET_CONTENT_TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.map': 'application/json; charset=utf-8',
};

const SECURITY_HEADERS = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'X-XSS-Protection': '1; mode=block',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), payment=()',
	'Content-Security-Policy':
		"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none';",
};

const CACHE_HEADERS = {
	html: {
		'Cache-Control': 'public, max-age=0, must-revalidate',
	},
	asset: {
		'Cache-Control': 'public, max-age=31536000, immutable',
	},
	svg: {
		'Cache-Control': 'public, max-age=86400',
	},
};

function getContentType(pathname) {
	const ext = pathname.slice(Math.max(0, pathname.lastIndexOf('.'))).toLowerCase();
	return ASSET_CONTENT_TYPES[ext] || 'application/octet-stream';
}

function getCacheHeaders(pathname) {
	const ext = pathname.slice(Math.max(0, pathname.lastIndexOf('.'))).toLowerCase();
	if (ext === '.html') return CACHE_HEADERS.html;
	if (ext === '.css' || ext === '.js') return CACHE_HEADERS.asset;
	if (ext === '.svg') return CACHE_HEADERS.svg;
	return CACHE_HEADERS.asset;
}

function getKVKey(pathname) {
	if (pathname === '/') return 'index.html';
	return pathname.replace(/^\//, '');
}

function buildHeaders(contentType, cacheHeaders) {
	const headers = new Headers();
	headers.set('Content-Type', contentType);
	Object.entries(SECURITY_HEADERS).forEach(([k, v]) => headers.set(k, v));
	Object.entries(cacheHeaders).forEach(([k, v]) => headers.set(k, v));
	return headers;
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const key = getKVKey(url.pathname);
		const contentType = getContentType(url.pathname);
		const cacheHeaders = getCacheHeaders(url.pathname);

		try {
			const value = await env.ASSETS.get(key, { type: 'arrayBuffer' });

			if (value !== null) {
				return new Response(value, {
					status: 200,
					headers: buildHeaders(contentType, cacheHeaders),
				});
			}
		} catch (e) {
			// KV lookup failed
		}

		// SPA fallback: serve index.html for any non-fetched path
		if (contentType !== 'text/html; charset=utf-8' && key !== 'index.html') {
			try {
				const indexValue = await env.ASSETS.get('index.html', { type: 'arrayBuffer' });
				if (indexValue !== null) {
					return new Response(indexValue, {
						status: 200,
						headers: buildHeaders('text/html; charset=utf-8', CACHE_HEADERS.html),
					});
				}
			} catch (e) {
				// Fall through to 404
			}
		}

		return new Response('Not Found', {
			status: 404,
			headers: buildHeaders('text/plain; charset=utf-8', CACHE_HEADERS.html),
		});
	},
};
