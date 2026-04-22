import { decodeAndVerifyIdToken } from '../utils/auth';
import { getHmacKey, createSessionToken } from '../utils/crypto';

export async function handleStartSession(body, idToken, serviceAccount) {
	if (!idToken) return new Response(JSON.stringify({ success: false, error: 'Missing token' }), { status: 401 });

	let callerUid;
	try {
		callerUid = decodeAndVerifyIdToken(idToken).uid;
	} catch (e) {
		return new Response(JSON.stringify({ success: false, error: 'Invalid token', details: e.message }), { status: 401 });
	}

	const difficulty = body.difficulty || 'normal';
	const key = await getHmacKey(serviceAccount);
	const sessionToken = await createSessionToken(key, callerUid, difficulty);
	
	return new Response(JSON.stringify({ success: true, sessionToken }), { status: 200 });
}
