import { updateDocument } from '../utils/firestore';

export async function handleTrackVisit(accessToken, projectId) {
	const getUrl = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/site_stats/counters';
	let getResp = await fetch(getUrl, { headers: { 'Authorization': 'Bearer ' + accessToken } });
	let currentCount = 0;
	if (getResp.ok) {
		const docData = await getResp.json();
		currentCount = parseInt(docData.fields?.visitors?.integerValue || docData.fields?.visitors?.doubleValue || 0);
	}
	await updateDocument(accessToken, 'projects/' + projectId + '/databases/(default)/documents/site_stats/counters', { visitors: currentCount + 1 });
	
	return new Response(JSON.stringify({ success: true }), { status: 200 });
}
