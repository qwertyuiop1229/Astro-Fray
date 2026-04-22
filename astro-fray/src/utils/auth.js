export function base64urlEncode(data) {
	if (typeof data === 'string') {
		data = new TextEncoder().encode(data);
	}
	return btoa(String.fromCharCode(...new Uint8Array(data)))
		.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

let cachedAccessToken = null;
let tokenExpiry = 0;

export async function getAccessToken(serviceAccount) {
	const now = Math.floor(Date.now() / 1000);
	if (cachedAccessToken && tokenExpiry > now + 60) return cachedAccessToken;

	const pemContents = serviceAccount.private_key
		.replace(/-----BEGIN PRIVATE KEY-----/g, '')
		.replace(/-----END PRIVATE KEY-----/g, '')
		.replace(/\n/g, '');
	const keyData = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

	const key = await crypto.subtle.importKey(
		'pkcs8',
		keyData.buffer,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign']
	);

	const header = { alg: 'RS256', typ: 'JWT' };
	const payload = {
		iss: serviceAccount.client_email,
		sub: serviceAccount.client_email,
		aud: 'https://oauth2.googleapis.com/token',
		iat: now,
		exp: now + 3600,
		scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/identitytoolkit'
	};

	const headerB64 = base64urlEncode(JSON.stringify(header));
	const payloadB64 = base64urlEncode(JSON.stringify(payload));
	const signInput = new TextEncoder().encode(headerB64 + '.' + payloadB64);

	const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, signInput);
	const sigB64 = base64urlEncode(signature);
	const jwt = headerB64 + '.' + payloadB64 + '.' + sigB64;

	const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
	});

	if (!tokenResponse.ok) {
		const errText = await tokenResponse.text();
		throw new Error('Failed to get access token: ' + errText);
	}

	const tokenData = await tokenResponse.json();
	cachedAccessToken = tokenData.access_token;
	tokenExpiry = now + (tokenData.expires_in || 3600);
	return cachedAccessToken;
}

export async function getUser(accessToken, uid) {
	const resp = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + accessToken
		},
		body: JSON.stringify({ localId: [uid] })
	});
	if (!resp.ok) return null;
	const data = await resp.json();
	return data.users?.[0] || null;
}

export async function deleteUser(accessToken, uid) {
	const resp = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:delete', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + accessToken
		},
		body: JSON.stringify({ localId: uid })
	});
	return resp.ok;
}

export function isAnonymousUser(userInfo) {
	if (!userInfo) return false;
	return !userInfo.providerUserInfo || userInfo.providerUserInfo.length === 0;
}

export function decodeAndVerifyIdToken(token) {
	const parts = token.split('.');
	if (parts.length !== 3) throw new Error('Not a valid JWT');

	const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
	const payload = JSON.parse(atob(payloadB64));

	const now = Math.floor(Date.now() / 1000);
	if (!payload.exp || payload.exp < now) throw new Error('Token expired');
	if (!payload.iss || !payload.iss.startsWith('https://securetoken.google.com/')) {
		throw new Error('Invalid issuer');
	}

	const uid = payload.sub || payload.user_id;
	if (!uid) throw new Error('No user ID in token');
	return { uid, payload };
}
