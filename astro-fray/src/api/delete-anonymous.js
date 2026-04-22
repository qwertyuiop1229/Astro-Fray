import { decodeAndVerifyIdToken, getUser, deleteUser, isAnonymousUser } from '../utils/auth';
import { queryByUid, deleteDocument } from '../utils/firestore';

export async function handleDeleteAnonymous(body, idToken, accessToken, projectId, rankingCollections) {
	if (!idToken) return new Response(JSON.stringify({ success: false, error: 'Missing token' }), { status: 401 });

	let callerUid;
	let isCallerAnonymous = true;
	try {
		const decoded = decodeAndVerifyIdToken(idToken);
		callerUid = decoded.uid;
		if (decoded.payload?.firebase?.sign_in_provider !== 'anonymous') {
			isCallerAnonymous = false;
		}
	} catch (e) {
		return new Response(JSON.stringify({ success: false, error: 'Invalid token', details: e.message }), { status: 401 });
	}

	const oldUid = body.oldUid;
	if (!oldUid) return new Response(JSON.stringify({ success: false, error: 'Missing oldUid' }), { status: 400 });
	if (oldUid === callerUid) return new Response(JSON.stringify({ success: false, error: 'Cannot delete own account' }), { status: 400 });

	let authDeleted = false;
	let firestoreCleaned = false;

	try {
		const userInfo = await getUser(accessToken, oldUid);
		if (userInfo) {
			if (!isAnonymousUser(userInfo)) {
				return new Response(JSON.stringify({ success: false, error: 'Target is not anonymous', authDeleted: false, firestoreCleaned: false }), { status: 403 });
			}
			authDeleted = await deleteUser(accessToken, oldUid);
		} else {
			authDeleted = true;
		}
	} catch (e) {
		console.error('Auth delete error:', e.message);
	}

	try {
		for (const col of rankingCollections) {
			const docs = await queryByUid(accessToken, projectId, col, oldUid);
			for (const doc of docs) {
				await deleteDocument(accessToken, doc.name);
			}
		}
		firestoreCleaned = true;
	} catch (e) {
		console.error('Firestore cleanup error:', e.message);
	}

	return new Response(JSON.stringify({ success: authDeleted, authDeleted, firestoreCleaned }), { status: authDeleted ? 200 : 500 });
}
