import { getCorsHeaders } from './utils/cors';
import { getAccessToken } from './utils/auth';
import { handleTrackVisit } from './api/track-visit';
import { handleDeleteAnonymous } from './api/delete-anonymous';
import { handleMigrateData } from './api/migrate-data';
import { handleStartSession } from './api/start-session';
import { handleSubmitScore } from './api/submit-score';
import { handleLegacyLegacyCleanup } from './api/legacy';

export default {
	async fetch(request, env, ctx) {
		const corsHeaders = getCorsHeaders(request, env);

		if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
		if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
		if (!corsHeaders['Access-Control-Allow-Origin']) return new Response('Forbidden: Origin not allowed', { status: 403, headers: corsHeaders });

		const url = new URL(request.url);
		const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

		try {
			const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
			const projectId = serviceAccount.project_id;
			const accessToken = await getAccessToken(serviceAccount);
			const rankingCollections = ['rankings', 'rankings_easy', 'rankings_hard'];

			const body = await request.json().catch(() => ({}));
			const authHeader = request.headers.get('Authorization') || '';
			const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : body.token;

			let response;

			switch (url.pathname) {
				case '/api/track-visit':
					response = await handleTrackVisit(accessToken, projectId);
					break;
				case '/api/delete-anonymous':
					response = await handleDeleteAnonymous(body, idToken, accessToken, projectId, rankingCollections);
					break;
				case '/api/migrate-data':
					response = await handleMigrateData(body, idToken, accessToken, projectId, rankingCollections);
					break;
				case '/api/start-session':
					response = await handleStartSession(body, idToken, serviceAccount);
					break;
				case '/api/submit-score':
					response = await handleSubmitScore(body, idToken, accessToken, projectId, serviceAccount);
					break;
				case '/api/cleanup-anonymous':
				case '/api/migrate-and-cleanup':
					response = await handleLegacyLegacyCleanup(body, idToken, accessToken, projectId, rankingCollections);
					break;
				default:
					response = new Response(JSON.stringify({ error: 'Endpoint not found' }), { status: 404 });
			}

			// Add CORS headers to all responses
			Object.entries(jsonHeaders).forEach(([k, v]) => response.headers.set(k, v));
			return response;

		} catch (error) {
			console.error('Unhandled Server Error:', error);
			return new Response(JSON.stringify({ success: false, error: 'Internal Server Error', details: error.message }), { status: 500, headers: jsonHeaders });
		}
	}
};
