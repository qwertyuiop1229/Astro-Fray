import { base64urlEncode } from './auth';

let hmacKey = null;

export async function getHmacKey(serviceAccount) {
	if (hmacKey) return hmacKey;
	const secret = serviceAccount.private_key_id + ':' + serviceAccount.client_email;
	const keyData = new TextEncoder().encode(secret);
	hmacKey = await crypto.subtle.importKey(
		'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
	);
	return hmacKey;
}

export async function createSessionToken(key, uid, difficulty) {
	const nonce = crypto.randomUUID();
	const startTime = Date.now();
	const payload = JSON.stringify({ uid, startTime, nonce, difficulty });
	const payloadB64 = base64urlEncode(payload);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
	const sigB64 = base64urlEncode(sig);
	return payloadB64 + '.' + sigB64;
}

export async function verifySessionToken(key, token) {
	const dotIdx = token.indexOf('.');
	if (dotIdx < 0) throw new Error('Invalid session token format');
	const payloadB64 = token.substring(0, dotIdx);
	const sigB64 = token.substring(dotIdx + 1);
	
	const sigStr = atob(sigB64.replace(/-/g, '+').replace(/_/g, '/'));
	const sigBytes = Uint8Array.from(sigStr, c => c.charCodeAt(0));
	const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadB64));
	if (!valid) throw new Error('Invalid session token signature');
	
	const payloadStr = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
	return JSON.parse(payloadStr);
}

const usedNonces = new Map();
const NONCE_TTL_MS = 4 * 60 * 60 * 1000;

export function markNonceUsed(nonce) {
	usedNonces.set(nonce, Date.now());
	if (usedNonces.size > 10000) {
		const cutoff = Date.now() - NONCE_TTL_MS;
		for (const [k, v] of usedNonces) {
			if (v < cutoff) usedNonces.delete(k);
		}
	}
}

export function isNonceUsed(nonce) {
	return usedNonces.has(nonce);
}
