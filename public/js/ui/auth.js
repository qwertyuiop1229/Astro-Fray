/* ===== Firebase Auth / Account Linkage ===== */
/* Extracted from game.js for modular organization */

/* ========== Firebase Auth / Account Linkage ========== */
function initFirebaseAuthUI() {
    if (!window.firebaseAuthUI || !window.firebaseAuth) {
        setTimeout(initFirebaseAuthUI, 50);
        return;
    }
    const { 
        signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
        signOut, linkWithCredential, EmailAuthProvider
    } = window.firebaseAuthUI;
    const auth = window.firebaseAuth;
    
    let isGuest = true;

    // Account Status Elements
    const accountStatusText = document.getElementById("accountStatusText");
    const btnOpenAuthFromSettings = document.getElementById("btnOpenAuthFromSettings");
    const btnSignOutButton = document.getElementById("btnSignOutButton");

    // Auth Modal Elements
    const authModal = document.getElementById("authModal");
    const authEmailInput = document.getElementById("authEmailInput");
    const authPasswordInput = document.getElementById("authPasswordInput");
    const btnCancelAuth = document.getElementById("btnCancelAuth");
    const btnSubmitAuth = document.getElementById("btnSubmitAuth");
    const authErrorMsg = document.getElementById("authErrorMsg");

    // Conflict Modal
    const dataConflictModal = document.getElementById("dataConflictModal");
    const btnConfirmConflict = document.getElementById("btnConfirmConflict");
    const btnCancelConflict = document.getElementById("btnCancelConflict");
    let selectedConflictChoice = null;

    // ======== ヘルパー: Workers API のベースURL ========
    function getWorkerBaseUrl() {
        const isProd = window.currentFirebaseProjectId === "astro-fray";
        return isProd 
            ? "https://astro-fray-prod.astro-fray-server.workers.dev" 
            : "https://astro-fray-dev.astro-fray-server.workers.dev";
    }

    // ======== API 1: 古いデータの削除（Auth + Firestore） ========
    // ログイン成功直後に即呼ばれる。データ移行は行わない。
    async function deleteAnonymousAccount(oldUid, retryCount) {
        if (!oldUid) return false;
        const maxRetries = typeof retryCount === 'number' ? retryCount : 2;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const currentUser = window.firebaseAuth.currentUser;
                if (!currentUser) {
                    console.error("deleteAnonymousAccount: No current user");
                    return false;
                }
                const idToken = await currentUser.getIdToken(true); // 強制リフレッシュ

                const response = await fetch(getWorkerBaseUrl() + "/api/delete-anonymous", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + idToken
                    },
                    body: JSON.stringify({ oldUid: oldUid, token: idToken })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    console.log("🗑️ 古いデータ " + oldUid + " を整理完了");
                    return true;
                }

                console.error("データ整理失敗 (試行 " + (attempt + 1) + "/" + (maxRetries + 1) + "):", result.error, result.details || "");
            } catch (e) {
                console.error("データ整理エラー (試行 " + (attempt + 1) + "/" + (maxRetries + 1) + "):", e);
            }

            // リトライの場合は少し待つ
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }

        return false;
    }

    // ======== API 2: データ移行のみ（コンフリクト選択後に呼ばれる） ========
    async function migrateData(oldUid, migrateAction) {
        if (!oldUid || !migrateAction) return false;
        try {
            const currentUser = window.firebaseAuth.currentUser;
            if (!currentUser) return false;
            const idToken = await currentUser.getIdToken(true);

            const response = await fetch(getWorkerBaseUrl() + "/api/migrate-data", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + idToken
                },
                body: JSON.stringify({ oldUid: oldUid, migrateAction: migrateAction, token: idToken })
            });

            const result = await response.json();
            if (response.ok && result.success) {
                console.log("✅ データ移行完了:", migrateAction);
                return true;
            }
            console.error("データ移行失敗:", result.error || response.statusText);
            return false;
        } catch (e) {
            console.error("データ移行エラー:", e);
            return false;
        }
    }

    function updateAccountUI(user) {
        const detailSection = document.getElementById('accountDetailSection');
        const acctNickname = document.getElementById('acctNickname');
        const acctEmail = document.getElementById('acctEmail');
        const acctUid = document.getElementById('acctUid');
        const restoreBtn = document.getElementById('btnRestoreSettings');

        if (!user) {
            if (accountStatusText) {
                accountStatusText.innerText = "OFFLINE";
                accountStatusText.style.color = "#aaa";
            }
            if (btnOpenAuthFromSettings) btnOpenAuthFromSettings.style.display = "block";
            if (btnSignOutButton) btnSignOutButton.style.display = "none";
            if (restoreBtn) restoreBtn.style.display = "none";
            if (detailSection) detailSection.style.display = "none";
            return;
        }
        isGuest = user.isAnonymous;
        if (isGuest) {
            if (accountStatusText) {
                accountStatusText.innerText = "GUEST (未連携)";
                accountStatusText.style.color = "#0f0";
                accountStatusText.style.textShadow = "0 0 10px #0f0";
            }
            if (btnOpenAuthFromSettings) btnOpenAuthFromSettings.style.display = "block";
            if (btnSignOutButton) btnSignOutButton.style.display = "none";
            if (restoreBtn) restoreBtn.style.display = "none";
            if (detailSection) detailSection.style.display = "none";
        } else {
            if (accountStatusText) {
                accountStatusText.innerText = "LINKED";
                accountStatusText.style.color = "#00f0ff";
                accountStatusText.style.textShadow = "0 0 10px #00f0ff";
            }
            if (btnOpenAuthFromSettings) btnOpenAuthFromSettings.style.display = "none";
            if (btnSignOutButton) btnSignOutButton.style.display = "block";
            if (restoreBtn) restoreBtn.style.display = "block";
            // アカウント詳細表示
            if (detailSection) {
                detailSection.style.display = "block";
                if (acctNickname) acctNickname.textContent = localStorage.getItem('playerNickname_v1') || 'UNKNOWN';
                if (acctEmail) acctEmail.textContent = user.email || '-';
                if (acctUid) acctUid.textContent = user.uid.substring(0, 12) + '...';
            }
        }
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            updateAccountUI(user);
            if (!user.isAnonymous && window.restoreSettingsFromCloud) {
                const cloudData = await window.restoreSettingsFromCloud();
                if (cloudData) {
                    if (cloudData.features) {
                        localStorage.setItem("featureSettings_v1", JSON.stringify(cloudData.features));
                        Object.assign(featureSettings, cloudData.features);
                        applyFeatureSettingsToRuntime();
                    }
                    if (cloudData.audio) {
                        localStorage.setItem("audioSettings_v1", JSON.stringify(cloudData.audio));
                        Object.assign(audioSettings, cloudData.audio);
                        if (window.sfxGain) window.sfxGain.gain.value = audioSettings.sfx;
                        if (window.bgmGainNode) window.bgmGainNode.gain.value = audioSettings.bgm;
                    }
                    if (cloudData.lightweight !== undefined) {
                        localStorage.setItem("lightweight_v1", cloudData.lightweight ? "1" : "0");
                        if (typeof applyLightweightMode === "function") applyLightweightMode(cloudData.lightweight);
                        const lt = document.getElementById("lightweightToggle");
                        if (lt && typeof setLightweightUI === "function") setLightweightUI(cloudData.lightweight);
                    }
                    if (cloudData.simpleTransition !== undefined) {
                        localStorage.setItem("simpleTransition_v1", cloudData.simpleTransition ? "1" : "0");
                        simpleTransition = cloudData.simpleTransition;
                        const st = document.getElementById("toggleSimpleTransition");
                        if (st && typeof setToggleElem === "function") setToggleElem(st, cloudData.simpleTransition);
                    }
                    if (cloudData.nickname) {
                        localStorage.setItem("playerNickname_v1", cloudData.nickname);
                        const acctNickname = document.getElementById('acctNickname');
                        if (acctNickname) acctNickname.textContent = cloudData.nickname;
                    }
                    if (cloudData.keyBindings) {
                        localStorage.setItem("keyBindings_v1", JSON.stringify(cloudData.keyBindings));
                        Object.assign(keyBindings, cloudData.keyBindings);
                        renderKeymapList();
                    }
                    if (cloudData.uiLayout) {
                        localStorage.setItem("uiLayout_v1", JSON.stringify(cloudData.uiLayout));
                        // UILayoutManager will naturally pick it up on next use or we could force refresh
                    }
                    if (cloudData.zoomLevel !== undefined) {
                        localStorage.setItem("zoomLevel_v1", cloudData.zoomLevel.toString());
                        zoomLevel = cloudData.zoomLevel;
                    }
                    if (cloudData.minecraftSensitivity !== undefined) {
                        localStorage.setItem("minecraftSensitivity_v1", cloudData.minecraftSensitivity.toString());
                        minecraftSensitivity = cloudData.minecraftSensitivity;
                    }
                    if (cloudData.controlMode) {
                        localStorage.setItem("controlMode_v1", cloudData.controlMode);
                        controlMode = cloudData.controlMode;
                    }
                    if (cloudData.minecraftMode !== undefined) {
                        localStorage.setItem("minecraftMode_v1", cloudData.minecraftMode ? "1" : "0");
                        minecraftMode = cloudData.minecraftMode;
                    }
                    if (cloudData.forceTouchUI !== undefined) {
                        localStorage.setItem("forceTouchUI_v1", cloudData.forceTouchUI ? "1" : "0");
                        useTouchUI = cloudData.forceTouchUI;
                        updateTouchUIVisibility();
                    }
                } else {
                    debouncedCloudSync();
                }
            }
        } else {
            try {
                await signInAnonymously(auth);
            } catch(e) {
                console.error("Anonymous login failed", e);
            }
        }
    });

    window.openAuthModal = function() {
        authErrorMsg.innerText = "";
        authEmailInput.value = "";
        authPasswordInput.value = "";
        
        // 他の画面が開いていたら一時的に隠す
        const viewsToHide = ["modeSelectModal", "pauseSettingsMenu", "startScreen"];
        viewsToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.style.display !== "none") {
                el.dataset.hiddenByAuth = "true";
                el.style.display = "none";
            }
        });

        authModal.style.display = "block";
    };

    btnOpenAuthFromSettings?.addEventListener("click", () => {
        window.openAuthModal();
    });

    btnSignOutButton?.addEventListener("click", async () => {
        const yes = await window.gameConfirm("サインアウトしますか？\n現在のデータからはログアウトされます。");
        if (yes) {
            await signOut(auth);
            await window.gameAlert("サインアウトしました。");
            document.getElementById("pauseSettingsView").style.display = "none";
            document.getElementById("pauseSettingsMenu").style.display = "none";
            window.location.reload();
        }
    });

    // クラウドから設定を復元
    document.getElementById("btnRestoreSettings")?.addEventListener("click", async () => {
        if (!window.restoreSettingsFromCloud) return;
        const cloudData = await window.restoreSettingsFromCloud();
        if (!cloudData) {
            await window.gameAlert("クラウドに保存された設定がありません。", "RESTORE");
            return;
        }
        // ローカルストレージに書き戻し
        if (cloudData.features) {
            localStorage.setItem("featureSettings_v1", JSON.stringify(cloudData.features));
        }
        if (cloudData.audio) {
            localStorage.setItem("audioSettings_v1", JSON.stringify(cloudData.audio));
        }
        if (cloudData.lightweight !== undefined) {
            localStorage.setItem("lightweight_v1", cloudData.lightweight ? "1" : "0");
        }
        if (cloudData.simpleTransition !== undefined) {
            localStorage.setItem("simpleTransition_v1", cloudData.simpleTransition ? "1" : "0");
        }
        if (cloudData.nickname) {
            localStorage.setItem("playerNickname_v1", cloudData.nickname);
        }
        if (cloudData.keyBindings) {
            localStorage.setItem("keyBindings_v1", JSON.stringify(cloudData.keyBindings));
        }
        if (cloudData.uiLayout) {
            localStorage.setItem("uiLayout_v1", JSON.stringify(cloudData.uiLayout));
        }
        if (cloudData.zoomLevel !== undefined) {
            localStorage.setItem("zoomLevel_v1", cloudData.zoomLevel.toString());
        }
        if (cloudData.minecraftSensitivity !== undefined) {
            localStorage.setItem("minecraftSensitivity_v1", cloudData.minecraftSensitivity.toString());
        }
        if (cloudData.controlMode) {
            localStorage.setItem("controlMode_v1", cloudData.controlMode);
        }
        if (cloudData.minecraftMode !== undefined) {
            localStorage.setItem("minecraftMode_v1", cloudData.minecraftMode ? "1" : "0");
        }
        if (cloudData.forceTouchUI !== undefined) {
            localStorage.setItem("forceTouchUI_v1", cloudData.forceTouchUI ? "1" : "0");
        }
        await window.gameAlert("クラウドから設定を復元しました。\nページを再読み込みして反映します。", "RESTORE");
        window.location.reload();
    });

    function hideAuthModal() {
        authModal.style.display = "none";
        
        // 隠していた画面を元に戻す
        const viewsToHide = ["modeSelectModal", "pauseSettingsMenu", "startScreen"];
        let restoredAny = false;
        viewsToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.dataset.hiddenByAuth === "true") {
                el.style.display = id === "startScreen" ? "flex" : "block";
                delete el.dataset.hiddenByAuth;
                restoredAny = true;
            }
        });

        // 何も復元されなかった場合（例: ニックネーム画面からログインに飛んだ場合など）はモード選択を出す
        if (!restoredAny) {
            const modeSelect = document.getElementById("modeSelectModal");
            if (modeSelect && (!running || isPaused)) {
                modeSelect.style.display = "block";
            }
        }
    }

    btnCancelAuth.addEventListener("click", () => {
        hideAuthModal();
    });

    btnSubmitAuth.addEventListener("click", async () => {
        const email = authEmailInput.value.trim();
        const pwd = authPasswordInput.value;
        if (!email || pwd.length < 6) {
            authErrorMsg.innerText = "有効なメールアドレスと6文字以上のパスワードを入力してください。";
            return;
        }
        authErrorMsg.innerText = "処理中...";
        authErrorMsg.style.color = "#aaa";
        btnSubmitAuth.disabled = true;

        let localData = null;
        let oldUidForPushing = null;

        try {
            // ===== 最適化フロー =====
            // 既存アカウントログイン（最も多いケース）を先に試し、
            // 不要なAPI呼び出しによる400エラーを回避する
            if (auth.currentUser && auth.currentUser.isAnonymous) {
                oldUidForPushing = auth.currentUser.uid;
                localData = await window.getPersonalHighScoreAndData(oldUidForPushing, "normal");
            }

            // Step 1: まずサインインを試みる（既存アカウント向け）
            let signInSucceeded = false;
            try {
                authErrorMsg.innerText = "ログイン中...";
                const result = await signInWithEmailAndPassword(auth, email, pwd);
                signInSucceeded = true;
                const newUid = result.user.uid;

                // ログイン成功 → 古いデータの整理
                if (oldUidForPushing) {
                    authErrorMsg.innerText = "ログイン完了。古いデータを整理中...";
                    const deleteSuccess = await deleteAnonymousAccount(oldUidForPushing);
                    if (!deleteSuccess) {
                        await window.gameAlert(
                            "古いデータの整理に失敗しました。\nゲームプレイには影響ありません。",
                            "WARNING"
                        );
                    }
                }

                let cloudData = await window.getPersonalHighScoreAndData(newUid, "normal");
                hideAuthModal();

                if (oldUidForPushing) {
                    localData = localData || { score: 0, playTimeSeconds: 0 };
                    cloudData = cloudData || { score: 0, playTimeSeconds: 0 };
                    localData.uid = oldUidForPushing;
                    showConflictModal(localData, cloudData, newUid, oldUidForPushing);
                } else {
                    await window.gameAlert("ログインしました！", "LOGIN SUCCESS");
                }
                btnSubmitAuth.disabled = false;
                return;
            } catch (signInErr) {
                if (signInErr.code === 'auth/user-not-found' ||
                    signInErr.code === 'auth/invalid-login-credentials') {
                    // アカウントが存在しない → 新規作成フローへ
                } else if (signInErr.code === 'auth/wrong-password') {
                    throw signInErr;
                } else if (signInErr.code === 'auth/too-many-requests') {
                    throw signInErr;
                } else if (signInSucceeded) {
                    throw signInErr;
                } else {
                    // 不明なエラーでも新規作成を試みる
                }
            }

            // Step 2: 新規アカウント作成
            // 匿名ユーザーならまず linkWithCredential を試す（UIDが変わらない最善の方法）
            if (auth.currentUser && auth.currentUser.isAnonymous) {
                try {
                    authErrorMsg.innerText = "アカウントを作成中...";
                    const credential = EmailAuthProvider.credential(email, pwd);
                    const result = await linkWithCredential(auth.currentUser, credential);
                    // リンク成功: UIDが変わらないので、Auth削除もデータ移行も不要
                    hideAuthModal();
                    await window.gameAlert("アカウントを連携しました！\nデータが安全にバックアップされています。", "LINKED");
                    updateAccountUI(auth.currentUser);
                    btnSubmitAuth.disabled = false;
                    return;
                } catch (linkErr) {
                    if (linkErr.code !== 'auth/operation-not-allowed' &&
                        linkErr.code !== 'auth/email-already-in-use' &&
                        linkErr.code !== 'auth/credential-already-in-use') {
                        throw linkErr;
                    }
                    // linkが使えない → createUserWithEmailAndPassword で新規作成
                }
            }

            // Step 3: 通常の新規作成（linkが使えない場合のフォールバック）
            authErrorMsg.innerText = "アカウントを作成中...";
            try {
                const createResult = await createUserWithEmailAndPassword(auth, email, pwd);
                if (oldUidForPushing) {
                    authErrorMsg.innerText = "アカウント作成完了。古いデータを整理中...";
                    const deleteSuccess = await deleteAnonymousAccount(oldUidForPushing);
                    if (!deleteSuccess) {
                        console.warn("古いデータの整理に失敗。リトライ済み。");
                    }
                    if (localData && localData.score > 0) {
                        await migrateData(oldUidForPushing, "local");
                    }
                }
                hideAuthModal();
                await window.gameAlert("アカウントを作成しました！\nデータが安全にバックアップされています。", "SIGNUP SUCCESS");
                updateAccountUI(auth.currentUser);
                btnSubmitAuth.disabled = false;
                return;
            } catch (createErr) {
                if (createErr.code === 'auth/email-already-in-use') {
                    // signIn で auth/invalid-login-credentials が返され、
                    // createUser でも email-already-in-use → パスワードが間違っている
                    throw { code: 'auth/wrong-password', message: 'パスワードが間違っています。' };
                }
                throw createErr;
            }
        } catch (e) {
            console.error(e);
            authErrorMsg.style.color = "#ff0055";
            let msg = "エラーが発生しました。";
            if (e.code === 'auth/email-already-in-use') msg = "このメールアドレスは既に別のアカウントに連携されています。「ログイン」をお試しください。";
            if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-login-credentials') msg = "パスワードが間違っています。";
            if (e.code === 'auth/user-not-found') msg = "このメールアドレスは登録されていません。新規登録する場合はそのまま入力してください。";
            if (e.code === 'auth/invalid-email') msg = "メールアドレスの形式が正しくありません。";
            if (e.code === 'auth/too-many-requests') msg = "試行回数が多すぎます。しばらくお待ちください。";
            if (e.code === 'auth/requires-recent-login') msg = "セッションが古くなっています。ページを更新してから再度お試しください。";
            authErrorMsg.innerText = msg;
        }
        btnSubmitAuth.disabled = false;
    });

    const conflictCards = document.querySelectorAll('.conflict-card');
    conflictCards.forEach(card => {
        card.addEventListener('click', () => {
            conflictCards.forEach(c => {
                c.style.borderColor = c.dataset.choice === 'local' ? '#00f0ff' : '#ff3355';
                c.style.boxShadow = '';
                c.style.opacity = '0.5';
            });
            card.style.opacity = '1';
            card.style.boxShadow = "0 0 15px " + (card.dataset.choice === 'local' ? 'rgba(0,240,255,0.4)' : 'rgba(255,51,85,0.4)');
            selectedConflictChoice = card.dataset.choice;
            btnConfirmConflict.disabled = false;
        });
    });

    function showConflictModal(local, cloud, newUid, oldUidForPushing) {
        selectedConflictChoice = null;
        btnConfirmConflict.disabled = true;
        conflictCards.forEach(c => {
            c.style.opacity = '1';
            c.style.boxShadow = '';
            c.style.borderColor = c.dataset.choice === 'local' ? '#00f0ff' : '#ff3355';
        });

        document.getElementById("conflictLocalScore").innerText = local.score || 0;
        document.getElementById("conflictLocalTime").innerText = local.playTimeSeconds || 0;
        
        document.getElementById("conflictCloudScore").innerText = cloud.score || 0;
        document.getElementById("conflictCloudTime").innerText = cloud.playTimeSeconds || 0;

        btnConfirmConflict.onclick = async () => {
            btnConfirmConflict.disabled = true;
            btnConfirmConflict.innerText = "処理中...";
            
            // サーバー側でデータ移行のみ実行（Auth削除は既に完了済み）
            if (oldUidForPushing) {
                const migrated = await migrateData(oldUidForPushing, selectedConflictChoice);
                if (!migrated) {
                    await window.gameAlert("データ移行に失敗しました。もう一度お試しください。", "ERROR");
                    btnConfirmConflict.disabled = false;
                    btnConfirmConflict.innerText = "選択したデータで引き継ぐ";
                    return;
                }
            }
            
            if (selectedConflictChoice === 'local') {
                await window.gameAlert("現在のプレイデータで上書きしました！", "DATA SYNCED");
            } else {
                await window.gameAlert("クラウドのデータを引き継ぎました！", "DATA SYNCED");
            }
            
            dataConflictModal.style.display = "none";
            btnConfirmConflict.innerText = "選択したデータで引き継ぐ";
            await window.gameAlert("画面を再読み込みして変更を反映します...", "RELOADING");
            window.location.reload();
        };

        // キャンセル時: Auth削除は既に完了済み。古いデータだけ消す
        btnCancelConflict.onclick = async () => {
            dataConflictModal.style.display = "none";
            if (oldUidForPushing) {
                await migrateData(oldUidForPushing, "cloud");
            }
            await window.gameAlert("キャンセルしました。クラウドのデータを引き継ぎます。", "DATA SYNCED");
            await window.gameAlert("画面を再読み込みして変更を反映します...", "RELOADING");
            window.location.reload();
        };

        dataConflictModal.style.display = "block";
    }
}
initFirebaseAuthUI();