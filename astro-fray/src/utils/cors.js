const ALLOWED_ORIGINS_DEV = [
	'https://shooting-games-1.web.app',
	'https://shooting-games-1.firebaseapp.com',
	'http://localhost:5000',
	'http://localhost:5500',
	'http://127.0.0.1:5500',
	'http://127.0.0.1:5000',
];
const ALLOWED_ORIGINS_PROD = [
	'https://astro-fray.web.app',
	'https://astro-fray.firebaseapp.com',
];

export function getCorsHeaders(request, env) {
	const origin = request.headers.get('Origin') || '';
	const isProd = env.WORKER_ENV === 'prod';
	const allowed = isProd ? ALLOWED_ORIGINS_PROD : ALLOWED_ORIGINS_DEV;
	const allowedOrigin = allowed.includes(origin) ? origin : '';

	return {
		'Access-Control-Allow-Origin': allowedOrigin,
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		'Access-Control-Max-Age': '86400',
	};
}
