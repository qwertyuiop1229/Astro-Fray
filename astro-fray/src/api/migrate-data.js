import { decodeAndVerifyIdToken } from '../utils/auth';
import { queryByUid, updateDocument, createDocument, deleteDocument, fromFirestoreFields } from '../utils/firestore';

export async function handleMigrateData(body, idToken, accessToken, projectId, rankingCollections) {
	if (!idToken) return new Response(JSON.stringify({ success: false, error: 'Missing token' }), { status: 401 });

	let callerUid;
	try {
		callerUid = decodeAndVerifyIdToken(idToken).uid;
	} catch (e) {
		return new Response(JSON.stringify({ success: false, error: 'Invalid token', details: e.message }), { status: 401 });
	}
	
	const oldUid = body.oldUid;
	const migrateAction = body.migrateAction;
	if (!oldUid || !migrateAction) return new Response(JSON.stringify({ success: false, error: 'Missing params' }), { status: 400 });

	if (migrateAction === 'local') {
		let migratedCount = 0;
		for (const col of rankingCollections) {
			const oldDocs = await queryByUid(accessToken, projectId, col, oldUid);
			if (oldDocs.length > 0) {
				const oldData = fromFirestoreFields(oldDocs[0].fields);
				const newDocs = await queryByUid(accessToken, projectId, col, callerUid);
				
				if (newDocs.length > 0) {
					await updateDocument(accessToken, newDocs[0].name, {
						score: oldData.score || 0, playTimeSeconds: oldData.playTimeSeconds || 0, name: oldData.name || 'UNKNOWN', uid: callerUid, isAnonymous: false
					});
				} else {
					const diff = col === 'rankings_easy' ? 'easy' : col === 'rankings_hard' ? 'hard' : 'normal';
					await createDocument(accessToken, projectId, col, {
						name: oldData.name || 'UNKNOWN', score: oldData.score || 0, playTimeSeconds: oldData.playTimeSeconds || 0, difficulty: diff, createdAt: 'SERVER_TIMESTAMP', uid: callerUid, isAnonymous: false
					});
				}
				migratedCount++;
			}
		}
		for (const col of rankingCollections) {
			const oldDocs = await queryByUid(accessToken, projectId, col, oldUid);
			for (const doc of oldDocs) await deleteDocument(accessToken, doc.name);
		}
		return new Response(JSON.stringify({ success: true, migrated: true, migratedCollections: migratedCount }), { status: 200 });
	}

	if (migrateAction === 'cloud') {
		for (const col of rankingCollections) {
			const oldDocs = await queryByUid(accessToken, projectId, col, oldUid);
			for (const doc of oldDocs) await deleteDocument(accessToken, doc.name);
		}
		return new Response(JSON.stringify({ success: true, migrated: false }), { status: 200 });
	}

	return new Response(JSON.stringify({ success: false, error: 'Invalid migrateAction' }), { status: 400 });
}
