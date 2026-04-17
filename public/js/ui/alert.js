/* ===== カスタムアラート・確認ダイアログ ===== */
/* Extracted from game.js for modular organization */

/* ========== カスタム gameAlert / gameConfirm ========== */
(function() {
    const overlay = document.getElementById('gameAlertOverlay');
    const box = document.getElementById('gameAlertBox');
    const titleEl = document.getElementById('gameAlertTitle');
    const msgEl = document.getElementById('gameAlertMessage');
    const okBtn = document.getElementById('gameAlertOkBtn');
    const cancelBtn = document.getElementById('gameAlertCancelBtn');
    let _resolve = null;

    function closeAlert() {
        box.style.setProperty('animation', 'alertBoxOut 0.15s ease-in forwards', 'important');
        overlay.style.animation = 'alertOverlayOut 0.15s ease-in forwards';
        setTimeout(() => {
            overlay.classList.remove('active');
            overlay.style.animation = '';
            box.style.removeProperty('animation');
        }, 160);
    }

    /**
     * gameAlert(message, title?) - Promise<void>
     */
    window.gameAlert = function(message, title) {
        return new Promise(resolve => {
            _resolve = resolve;
            titleEl.innerText = title || 'NOTICE';
            msgEl.innerText = message;
            cancelBtn.style.display = 'none';
            okBtn.innerText = 'OK';
            overlay.classList.add('active');
            overlay.style.animation = 'alertOverlayIn 0.18s ease-out';
            box.style.setProperty('animation', 'alertBoxIn 0.2s cubic-bezier(0.16,1,0.3,1)', 'important');
            okBtn.focus();
        });
    };

    /**
     * gameConfirm(message, title?) - Promise<boolean>
     */
    window.gameConfirm = function(message, title) {
        return new Promise(resolve => {
            _resolve = resolve;
            titleEl.innerText = title || 'CONFIRM';
            msgEl.innerText = message;
            cancelBtn.style.display = '';
            okBtn.innerText = 'OK';
            overlay.classList.add('active');
            overlay.style.animation = 'alertOverlayIn 0.18s ease-out';
            box.style.setProperty('animation', 'alertBoxIn 0.2s cubic-bezier(0.16,1,0.3,1)', 'important');
            okBtn.focus();
        });
    };

    okBtn.addEventListener('click', () => {
        closeAlert();
        if (_resolve) { const r = _resolve; _resolve = null; r(true); }
    });
    cancelBtn.addEventListener('click', () => {
        closeAlert();
        if (_resolve) { const r = _resolve; _resolve = null; r(false); }
    });

    // Escでキャンセル扱い
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cancelBtn.click();
    });
})();
