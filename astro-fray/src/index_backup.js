// ========================================================
// Astro Fray - Cloudflare Workers API
// firebase-admin は Cloudflare Workers の https.request 非対応で動作しないため、
// すべて fetch() + Firebase REST API で実装
// ========================================================

// 環境別の許可ドメインリスト
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

function getCorsHeaders(request, env) {
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

// ========================================================
// Google OAuth2 アクセストークン取得（サービスアカウント）
// Cloudflare Workers の Web Crypto API を使用してJWTに署名
// ========================================================
let cachedAccessToken = null;
let tokenExpiry = 0;

function base64urlEncode(data) {
	if (typeof data === 'string') {
		data = new TextEncoder().encode(data);
	}
	return btoa(String.fromCharCode(...new Uint8Array(data)))
		.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(serviceAccount) {
	const now = Math.floor(Date.now() / 1000);

	// キャッシュが有効ならそれを返す
	if (cachedAccessToken && tokenExpiry > now + 60) {
		return cachedAccessToken;
	}

	// サービスアカウントの秘密鍵をインポート
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

	// JWT作成
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

	// アクセストークンと交換
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

// ========================================================
// Firebase Auth REST API ヘルパー
// ========================================================

// ユーザー情報取得
async function getUser(accessToken, uid) {
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

// ユーザー削除
async function deleteUser(accessToken, uid) {
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

// ユーザーが匿名かどうかの判定（providerUserInfoが空 = 匿名）
function isAnonymousUser(userInfo) {
	if (!userInfo) return false;
	return !userInfo.providerUserInfo || userInfo.providerUserInfo.length === 0;
}

// ========================================================
// Firestore REST API ヘルパー
// ========================================================

function firestoreBaseUrl(projectId) {
	return 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents';
}

// コレクション内のドキュメントをUIDでクエリ
async function queryByUid(accessToken, projectId, collectionName, uid) {
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
	// runQueryの結果はドキュメントの配列
	return results.filter(r => r.document).map(r => r.document);
}

// ドキュメント削除
async function deleteDocument(accessToken, docPath) {
	const url = 'https://firestore.googleapis.com/v1/' + docPath;
	const resp = await fetch(url, {
		method: 'DELETE',
		headers: { 'Authorization': 'Bearer ' + accessToken }
	});
	return resp.ok;
}

// ドキュメント作成
async function createDocument(accessToken, projectId, collectionName, data) {
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

// ドキュメント更新
async function updateDocument(accessToken, docPath, data) {
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

// JS値 → Firestore REST形式 変換
function toFirestoreFields(obj) {
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

// Firestoreドキュメント → JS値 変換
function fromFirestoreFields(fields) {
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

// ========================================================
// IDトークン手動検証（JWT署名検証は省略、クレームのみチェック）
// ========================================================
function decodeAndVerifyIdToken(token) {
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

// ========================================================
// セッショントークン（HMAC署名付き）& チート対策
// ========================================================
let hmacKey = null;

async function getHmacKey(serviceAccount) {
	if (hmacKey) return hmacKey;
	// サービスアカウントの秘密鍵の一部からHMAC用キーを導出
	const secret = serviceAccount.private_key_id + ':' + serviceAccount.client_email;
	const keyData = new TextEncoder().encode(secret);
	hmacKey = await crypto.subtle.importKey(
		'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
	);
	return hmacKey;
}

async function createSessionToken(key, uid, difficulty) {
	const nonce = crypto.randomUUID();
	const startTime = Date.now();
	const payload = JSON.stringify({ uid, startTime, nonce, difficulty });
	const payloadB64 = base64urlEncode(payload);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
	const sigB64 = base64urlEncode(sig);
	return payloadB64 + '.' + sigB64;
}

async function verifySessionToken(key, token) {
	const dotIdx = token.indexOf('.');
	if (dotIdx < 0) throw new Error('Invalid session token format');
	const payloadB64 = token.substring(0, dotIdx);
	const sigB64 = token.substring(dotIdx + 1);
	// 署名を復元
	const sigStr = atob(sigB64.replace(/-/g, '+').replace(/_/g, '/'));
	const sigBytes = Uint8Array.from(sigStr, c => c.charCodeAt(0));
	const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadB64));
	if (!valid) throw new Error('Invalid session token signature');
	const payloadStr = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
	return JSON.parse(payloadStr);
}

// 使用済みnonce短期キャッシュ（リプレイ攻撃防止）
// Workerの再起動でリセットされるが、時間チェックがフォールバック
const usedNonces = new Map();
const NONCE_TTL_MS = 4 * 60 * 60 * 1000; // 4時間

function markNonceUsed(nonce) {
	usedNonces.set(nonce, Date.now());
	// 古いエントリを掃除
	if (usedNonces.size > 10000) {
		const cutoff = Date.now() - NONCE_TTL_MS;
		for (const [k, v] of usedNonces) {
			if (v < cutoff) usedNonces.delete(k);
		}
	}
}

function isNonceUsed(nonce) {
	return usedNonces.has(nonce);
}

// スコア制限定数
const MAX_SCORE_PER_SECOND = 300;
const MAX_PLAY_TIME_SECONDS = 10800; // 3時間

// ========================================================
// メインハンドラ
// ========================================================
export default {
	async fetch(request, env, ctx) {
		const corsHeaders = getCorsHeaders(request, env);

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}
		if (request.method !== 'POST') {
			return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
		}
		if (!corsHeaders['Access-Control-Allow-Origin']) {
			return new Response('Forbidden: Origin not allowed', { status: 403, headers: corsHeaders });
		}

		const url = new URL(request.url);
		const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

		try {
			const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
			const projectId = serviceAccount.project_id;

			// アクセストークン取得
			const accessToken = await getAccessToken(serviceAccount);

			// リクエストボディとIDトークン取得
			const body = await request.json();
			const authHeader = request.headers.get('Authorization') || '';
			const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : body.token;

			const rankingCollections = ['rankings', 'rankings_easy', 'rankings_hard'];

			// ==========================================
			// API 0: 訪問者カウンター（ユニーク訪問）
			// ==========================================
			if (url.pathname === '/api/track-visit') {
				const getUrl = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/site_stats/counters';
				let getResp = await fetch(getUrl, { headers: { 'Authorization': 'Bearer ' + accessToken } });
				let currentCount = 0;
				if (getResp.ok) {
					const docData = await getResp.json();
					currentCount = parseInt(docData.fields?.visitors?.integerValue || docData.fields?.visitors?.doubleValue || 0);
				}
				await updateDocument(accessToken, 'projects/' + projectId + '/databases/(default)/documents/site_stats/counters', { visitors: currentCount + 1 });
				
				return new Response(JSON.stringify({ success: true }), {
					status: 200, headers: jsonHeaders
				});
			}

			// ==========================================
			// API 1: 古いデータの削除（Auth + Firestore）
			// ==========================================
			if (url.pathname === '/api/delete-anonymous') {
				if (!idToken) {
					return new Response(JSON.stringify({ success: false, error: 'Missing token' }), {
						status: 401, headers: jsonHeaders
					});
				}

				// IDトークン検証
				let callerUid;
				let isCallerAnonymous = true;
				try {
					const decoded = decodeAndVerifyIdToken(idToken);
					callerUid = decoded.uid;
					if (decoded.payload && decoded.payload.firebase && decoded.payload.firebase.sign_in_provider !== 'anonymous') {
						isCallerAnonymous = false;
					}
				} catch (e) {
					return new Response(JSON.stringify({ success: false, error: 'Invalid token', details: e.message }), {
						status: 401, headers: jsonHeaders
					});
				}
				const oldUid = body.oldUid;
				if (!oldUid) {
					return new Response(JSON.stringify({ success: false, error: 'Missing oldUid' }), {
						status: 400, headers: jsonHeaders
					});
				}
				if (oldUid === callerUid) {
					return new Response(JSON.stringify({ success: false, error: 'Cannot delete own account' }), {
						status: 400, headers: jsonHeaders
					});
				}

				let authDeleted = false;
				let firestoreCleaned = false;

				// 1. Auth: 匿名ユーザーか確認して削除
				try {
					const userInfo = await getUser(accessToken, oldUid);
					if (userInfo) {
						if (!isAnonymousUser(userInfo)) {
							return new Response(JSON.stringify({
								success: false, error: 'Target is not anonymous',
								authDeleted: false, firestoreCleaned: false
							}), { status: 403, headers: jsonHeaders });
						}
						authDeleted = await deleteUser(accessToken, oldUid);
						console.log('Auth delete result for ' + oldUid + ':', authDeleted);
					} else {
						// ユーザーが見つからない = 既に削除済み
						authDeleted = true;
						console.log('User ' + oldUid + ' already deleted from Auth');
					}
				} catch (e) {
					console.error('Auth delete error:', e.message);
				}

				// 2. Firestore: ランキングデータ削除
				try {
					for (const col of rankingCollections) {
						const docs = await queryByUid(accessToken, projectId, col, oldUid);
						for (const doc of docs) {
							await deleteDocument(accessToken, doc.name);
							console.log('Deleted doc from ' + col + ': ' + doc.name);
						}
					}
					firestoreCleaned = true;
				} catch (e) {
					console.error('Firestore cleanup error:', e.message);
				}

				return new Response(JSON.stringify({
					success: authDeleted,
					authDeleted,
					firestoreCleaned
				}), { status: authDeleted ? 200 : 500, headers: jsonHeaders });
			}

			// ==========================================
			// API 2: データ移行のみ
			// ==========================================
			if (url.pathname === '/api/migrate-data') {
				if (!idToken) {
					return new Response(JSON.stringify({ success: false, error: 'Missing token' }), {
						status: 401, headers: jsonHeaders
					});
				}

				let callerUid;
				try {
					const decoded = decodeAndVerifyIdToken(idToken);
					callerUid = decoded.uid;
				} catch (e) {
					return new Response(JSON.stringify({ success: false, error: 'Invalid token', details: e.message }), {
						status: 401, headers: jsonHeaders
					});
				}
				const oldUid = body.oldUid;
				const migrateAction = body.migrateAction;

				if (!oldUid || !migrateAction) {
					return new Response(JSON.stringify({ success: false, error: 'Missing params' }), {
						status: 400, headers: jsonHeaders
					});
				}

				if (migrateAction === 'local') {
					let migratedCount = 0;
					for (const col of rankingCollections) {
						const oldDocs = await queryByUid(accessToken, projectId, col, oldUid);
						if (oldDocs.length > 0) {
							const oldData = fromFirestoreFields(oldDocs[0].fields);
							const newDocs = await queryByUid(accessToken, projectId, col, callerUid);
							if (newDocs.length > 0) {
								await updateDocument(accessToken, newDocs[0].name, {
									score: oldData.score || 0,
									playTimeSeconds: oldData.playTimeSeconds || 0,
									name: oldData.name || 'UNKNOWN',
									uid: callerUid,
									isAnonymous: false
								});
							} else {
								const diff = col === 'rankings_easy' ? 'easy' : col === 'rankings_hard' ? 'hard' : 'normal';
								await createDocument(accessToken, projectId, col, {
									name: oldData.name || 'UNKNOWN',
									score: oldData.score || 0,
									playTimeSeconds: oldData.playTimeSeconds || 0,
									difficulty: diff,
									createdAt: 'SERVER_TIMESTAMP',
									uid: callerUid,
									isAnonymous: false
								});
							}
							migratedCount++;
						}
					}
					// 古いデータ削除
					for (const col of rankingCollections) {
						const oldDocs = await queryByUid(accessToken, projectId, col, oldUid);
						for (const doc of oldDocs) {
							await deleteDocument(accessToken, doc.name);
						}
					}
					return new Response(JSON.stringify({ success: true, migrated: true, migratedCollections: migratedCount }), {
						status: 200, headers: jsonHeaders
					});
				}

				if (migrateAction === 'cloud') {
					for (const col of rankingCollections) {
						const oldDocs = await queryByUid(accessToken, projectId, col, oldUid);
						for (const doc of oldDocs) {
							await deleteDocument(accessToken, doc.name);
						}
					}
					return new Response(JSON.stringify({ success: true, migrated: false }), {
						status: 200, headers: jsonHeaders
					});
				}

				return new Response(JSON.stringify({ success: false, error: 'Invalid migrateAction' }), {
					status: 400, headers: jsonHeaders
				});
			}

			// ==========================================
			// レガシーAPI（後方互換）
			// ==========================================
			if (url.pathname === '/api/cleanup-anonymous' || url.pathname === '/api/migrate-and-cleanup') {
				if (!idToken) {
					return new Response(JSON.stringify({ success: false, error: 'Missing token' }), {
						status: 401, headers: jsonHeaders
					});
				}

				let callerUid;
				try {
					const decoded = decodeAndVerifyIdToken(idToken);
					callerUid = decoded.uid;
				} catch (e) {
					return new Response(JSON.stringify({ success: false, error: 'Invalid token', details: e.message }), {
						status: 401, headers: jsonHeaders
					});
				}
				const oldUid = body.oldUid;
				const migrateAction = body.migrateAction || 'cloud';
				const targetUid = oldUid || callerUid;

				// 匿名チェック
				if (oldUid) {
					const userInfo = await getUser(accessToken, targetUid);
					if (userInfo && !isAnonymousUser(userInfo)) {
						return new Response('Target is not anonymous', { status: 403, headers: corsHeaders });
					}
				}

				// データ移行
				if (migrateAction === 'local' && oldUid && oldUid !== callerUid) {
					for (const col of rankingCollections) {
						const oldDocs = await queryByUid(accessToken, projectId, col, oldUid);
						if (oldDocs.length > 0) {
							const oldData = fromFirestoreFields(oldDocs[0].fields);
							const newDocs = await queryByUid(accessToken, projectId, col, callerUid);
							if (newDocs.length > 0) {
								await updateDocument(accessToken, newDocs[0].name, {
									score: oldData.score || 0,
									playTimeSeconds: oldData.playTimeSeconds || 0,
									name: oldData.name || 'UNKNOWN',
									uid: callerUid,
									isAnonymous: false
								});
							} else {
								const diff = col === 'rankings_easy' ? 'easy' : col === 'rankings_hard' ? 'hard' : 'normal';
								await createDocument(accessToken, projectId, col, {
									name: oldData.name || 'UNKNOWN',
									score: oldData.score || 0,
									playTimeSeconds: oldData.playTimeSeconds || 0,
									difficulty: diff,
									createdAt: 'SERVER_TIMESTAMP',
									uid: callerUid,
									isAnonymous: false
								});
							}
						}
					}
				}

				// Firestoreデータ削除
				for (const col of rankingCollections) {
					const oldDocs = await queryByUid(accessToken, projectId, col, targetUid);
					for (const doc of oldDocs) {
						await deleteDocument(accessToken, doc.name);
					}
				}

				// Auth削除
				await deleteUser(accessToken, targetUid).catch(e => console.error('Auth delete failed:', e));

				return new Response(JSON.stringify({ success: true, migrated: migrateAction === 'local' }), {
					status: 200, headers: jsonHeaders
				});
			}

			// ==========================================
			// API 3: ゲームセッション開始
			// ==========================================
			if (url.pathname === '/api/start-session') {
				if (!idToken) {
					return new Response(JSON.stringify({ success: false, error: 'Missing token' }), {
						status: 401, headers: jsonHeaders
					});
				}

				let callerUid;
				try {
					const decoded = decodeAndVerifyIdToken(idToken);
					callerUid = decoded.uid;
				} catch (e) {
					return new Response(JSON.stringify({ success: false, error: 'Invalid token', details: e.message }), {
						status: 401, headers: jsonHeaders
					});
				}
				const difficulty = body.difficulty || 'normal';
				const key = await getHmacKey(serviceAccount);
				const sessionToken = await createSessionToken(key, callerUid, difficulty);
				return new Response(JSON.stringify({
					success: true,
					sessionToken
				}), { status: 200, headers: jsonHeaders });
			}

			// ==========================================
			// API 4: スコア送信（サーバーサイド検証）
			// ==========================================
			if (url.pathname === '/api/submit-score') {
				if (!idToken) {
					return new Response(JSON.stringify({ success: false, error: 'Missing token' }), {
						status: 401, headers: jsonHeaders
					});
				}

				let callerUid;
				let isCallerAnonymous = true;
				try {
					const decoded = decodeAndVerifyIdToken(idToken);
					callerUid = decoded.uid;
					if (decoded.payload && decoded.payload.firebase && decoded.payload.firebase.sign_in_provider !== 'anonymous') {
						isCallerAnonymous = false;
					}
				} catch (e) {
					return new Response(JSON.stringify({ success: false, error: 'Invalid token', details: e.message }), {
						status: 401, headers: jsonHeaders
					});
				}
				const { sessionToken, score, name } = body;

				if (!sessionToken || score === undefined || score === null) {
					return new Response(JSON.stringify({ success: false, error: 'Missing params' }), {
						status: 400, headers: jsonHeaders
					});
				}

				// 1. セッショントークンのHMAC検証
				let session;
				try {
					const key = await getHmacKey(serviceAccount);
					session = await verifySessionToken(key, sessionToken);
				} catch (e) {
					return new Response(JSON.stringify({
						success: false, error: 'Invalid session', details: e.message
					}), { status: 403, headers: jsonHeaders });
				}

				// 2. セッションのUIDが呼び出し元と一致するか
				if (session.uid !== callerUid) {
					return new Response(JSON.stringify({
						success: false, error: 'Session UID mismatch'
					}), { status: 403, headers: jsonHeaders });
				}

				// 3. nonce再利用チェック（リプレイ攻撃防止）
				if (isNonceUsed(session.nonce)) {
					return new Response(JSON.stringify({
						success: false, error: 'Session already used'
					}), { status: 403, headers: jsonHeaders });
				}

				// 4. サーバー側経過時間の計算と検証
				const elapsedMs = Date.now() - session.startTime;
				const elapsedSeconds = elapsedMs / 1000;
				const finalScore = Math.max(0, Math.floor(Number(score) || 0));
				const finalName = (typeof name === 'string' && name.length > 0 && name.length <= 12)
					? name : 'UNKNOWN';
				const difficulty = session.difficulty || 'normal';

				// 最低プレイ時間チェック（3秒未満でのスコア送信は拒否）
				if (elapsedSeconds < 3 && finalScore > 0) {
					return new Response(JSON.stringify({
						success: false, error: 'Play time too short'
					}), { status: 403, headers: jsonHeaders });
				}

				// 経過時間に上限を設定
				const cappedSeconds = Math.min(elapsedSeconds, MAX_PLAY_TIME_SECONDS);

				// スコア/時間の整合性チェック
				const maxPossibleScore = cappedSeconds * MAX_SCORE_PER_SECOND;
				if (finalScore > maxPossibleScore) {
					console.warn('Suspicious score rejected:', finalScore, 'max:', maxPossibleScore, 'uid:', callerUid);
					return new Response(JSON.stringify({
						success: false, error: 'Score exceeds time limit'
					}), { status: 403, headers: jsonHeaders });
				}

				// 5. nonceを使用済みにマーク
				markNonceUsed(session.nonce);

				// 6. Firestoreにスコア書き込み
				const colName = difficulty === 'easy' ? 'rankings_easy'
					: difficulty === 'hard' ? 'rankings_hard' : 'rankings';
				const playTimeSeconds = Math.floor(cappedSeconds);

				try {
					// 既存ドキュメントを検索
					const existingDocs = await queryByUid(accessToken, projectId, colName, callerUid);

					if (existingDocs.length > 0) {
						const existingData = fromFirestoreFields(existingDocs[0].fields);
						const existingScore = existingData.score || 0;

						if (finalScore > existingScore) {
							// ハイスコア更新
							await updateDocument(accessToken, existingDocs[0].name, {
								name: finalName,
								score: finalScore,
								playTimeSeconds: playTimeSeconds,
								uid: callerUid,
								isAnonymous: isCallerAnonymous
							});
						} else {
							// スコアは低いが名前は同期
							await updateDocument(accessToken, existingDocs[0].name, {
								name: finalName,
								uid: callerUid,
								score: existingScore,
								playTimeSeconds: existingData.playTimeSeconds || 0,
								isAnonymous: isCallerAnonymous
							});
						}
					} else {
						// 新規作成
						await createDocument(accessToken, projectId, colName, {
							name: finalName,
							score: finalScore,
							playTimeSeconds: playTimeSeconds,
							difficulty: difficulty,
							createdAt: 'SERVER_TIMESTAMP',
							uid: callerUid,
							isAnonymous: isCallerAnonymous
						});
					}

					return new Response(JSON.stringify({ success: true }), {
						status: 200, headers: jsonHeaders
					});
				} catch (e) {
					console.error('Score write error:', e.message);
					return new Response(JSON.stringify({
						success: false, error: 'Failed to write score'
					}), { status: 500, headers: jsonHeaders });
				}
			}

			return new Response('API Not Found', { status: 404, headers: corsHeaders });

		} catch (error) {
			console.error('Worker error:', error);
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}
	}
};