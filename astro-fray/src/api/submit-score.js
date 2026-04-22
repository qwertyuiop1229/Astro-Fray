import { decodeAndVerifyIdToken } from '../utils/auth';
import { getHmacKey, verifySessionToken, isNonceUsed, markNonceUsed } from '../utils/crypto';
import { queryByUid, updateDocument, createDocument, fromFirestoreFields } from '../utils/firestore';

const MAX_SCORE_PER_SECOND = 300;
const MAX_PLAY_TIME_SECONDS = 10800; // 3 hours

export async function handleSubmitScore(body, idToken, accessToken, projectId, serviceAccount) {
	if (!idToken) return new Response(JSON.stringify({ success: false, error: 'Missing token' }), { status: 401 });

	let callerUid;
	let isCallerAnonymous = true;
	try {
		const decoded = decodeAndVerifyIdToken(idToken);
		callerUid = decoded.uid;
		if (decoded.payload?.firebase?.sign_in_provider !== 'anonymous') isCallerAnonymous = false;
	} catch (e) {
		return new Response(JSON.stringify({ success: false, error: 'Invalid token', details: e.message }), { status: 401 });
	}

	const { sessionToken, score, name } = body;
	if (!sessionToken || score === undefined || score === null) {
		return new Response(JSON.stringify({ success: false, error: 'Missing params' }), { status: 400 });
	}

	let session;
	try {
		const key = await getHmacKey(serviceAccount);
		session = await verifySessionToken(key, sessionToken);
	} catch (e) {
		return new Response(JSON.stringify({ success: false, error: 'Invalid session', details: e.message }), { status: 403 });
	}

	if (session.uid !== callerUid) return new Response(JSON.stringify({ success: false, error: 'Session UID mismatch' }), { status: 403 });
	if (isNonceUsed(session.nonce)) return new Response(JSON.stringify({ success: false, error: 'Session already used' }), { status: 403 });

	const elapsedMs = Date.now() - session.startTime;
	const elapsedSeconds = elapsedMs / 1000;
	const finalScore = Math.max(0, Math.floor(Number(score) || 0));
	const finalName = (typeof name === 'string' && name.length > 0 && name.length <= 12) ? name : 'UNKNOWN';
	const difficulty = session.difficulty || 'normal';

	if (elapsedSeconds < 3 && finalScore > 0) return new Response(JSON.stringify({ success: false, error: 'Play time too short' }), { status: 403 });
	
	const cappedSeconds = Math.min(elapsedSeconds, MAX_PLAY_TIME_SECONDS);
	const maxPossibleScore = cappedSeconds * MAX_SCORE_PER_SECOND;
	if (finalScore > maxPossibleScore) return new Response(JSON.stringify({ success: false, error: 'Score exceeds time limit' }), { status: 403 });

	markNonceUsed(session.nonce);
	const colName = difficulty === 'easy' ? 'rankings_easy' : difficulty === 'hard' ? 'rankings_hard' : 'rankings';
	const playTimeSeconds = Math.floor(cappedSeconds);

	try {
		const existingDocs = await queryByUid(accessToken, projectId, colName, callerUid);
		if (existingDocs.length > 0) {
			const existingData = fromFirestoreFields(existingDocs[0].fields);
			const existingScore = existingData.score || 0;

			if (finalScore > existingScore) {
				await updateDocument(accessToken, existingDocs[0].name, {
					name: finalName, score: finalScore, playTimeSeconds, uid: callerUid, isAnonymous: isCallerAnonymous
				});
			} else {
				await updateDocument(accessToken, existingDocs[0].name, {
					name: finalName, uid: callerUid, score: existingScore, playTimeSeconds: existingData.playTimeSeconds || 0, isAnonymous: isCallerAnonymous
				});
			}
		} else {
			await createDocument(accessToken, projectId, colName, {
				name: finalName, score: finalScore, playTimeSeconds, difficulty, createdAt: 'SERVER_TIMESTAMP', uid: callerUid, isAnonymous: isCallerAnonymous
			});
		}
		return new Response(JSON.stringify({ success: true }), { status: 200 });
	} catch (e) {
		return new Response(JSON.stringify({ success: false, error: 'Firestore write failed', details: e.message }), { status: 500 });
	}
}
