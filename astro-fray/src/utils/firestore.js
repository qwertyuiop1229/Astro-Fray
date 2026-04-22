function firestoreBaseUrl(projectId) {
	return 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents';
}

export async function queryByUid(accessToken, projectId, collectionName, uid) {
	const url = firestoreBaseUrl(projectId) + ':runQuery';
	const resp = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + accessToken
		},
		body: JSON.stringify({
			structuredQuery: {
				from: [{ collectionId: collectionName }],
				where: {
					fieldFilter: {
						field: { fieldPath: 'uid' },
						op: 'EQUAL',
						value: { stringValue: uid }
					}
				}
			}
		})
	});
	if (!resp.ok) return [];
	const results = await resp.json();
	return results.filter(r => r.document).map(r => r.document);
}

export async function deleteDocument(accessToken, docPath) {
	const url = 'https://firestore.googleapis.com/v1/' + docPath;
	const resp = await fetch(url, {
		method: 'DELETE',
		headers: { 'Authorization': 'Bearer ' + accessToken }
	});
	return resp.ok;
}

export async function createDocument(accessToken, projectId, collectionName, data) {
	const url = firestoreBaseUrl(projectId) + '/' + collectionName;
	const resp = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + accessToken
		},
		body: JSON.stringify({ fields: toFirestoreFields(data) })
	});
	return resp.ok;
}

export async function updateDocument(accessToken, docPath, data) {
	const url = 'https://firestore.googleapis.com/v1/' + docPath;
	const updateMask = Object.keys(data).map(k => 'updateMask.fieldPaths=' + k).join('&');
	const resp = await fetch(url + '?' + updateMask, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + accessToken
		},
		body: JSON.stringify({ fields: toFirestoreFields(data) })
	});
	return resp.ok;
}

export function toFirestoreFields(obj) {
	const fields = {};
	for (const [k, v] of Object.entries(obj)) {
		if (v === null || v === undefined) continue;
		if (typeof v === 'string') fields[k] = { stringValue: v };
		else if (typeof v === 'number') {
			if (Number.isInteger(v)) fields[k] = { integerValue: String(v) };
			else fields[k] = { doubleValue: v };
		}
		else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
		else if (v === 'SERVER_TIMESTAMP') fields[k] = { timestampValue: new Date().toISOString() };
	}
	return fields;
}

export function fromFirestoreFields(fields) {
	if (!fields) return {};
	const obj = {};
	for (const [k, v] of Object.entries(fields)) {
		if (v.stringValue !== undefined) obj[k] = v.stringValue;
		else if (v.integerValue !== undefined) obj[k] = parseInt(v.integerValue);
		else if (v.doubleValue !== undefined) obj[k] = v.doubleValue;
		else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
		else if (v.timestampValue !== undefined) obj[k] = v.timestampValue;
		else if (v.nullValue !== undefined) obj[k] = null;
	}
	return obj;
}

export async function customGetDocument(accessToken, projectId, collectionName, docId) {
	const url = firestoreBaseUrl(projectId) + '/' + collectionName + '/' + docId;
	const resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } });
	if (!resp.ok) return null;
	return await resp.json();
}
