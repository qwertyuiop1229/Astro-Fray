const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const JavaScriptObfuscator = require('javascript-obfuscator');

try {
    // firebase deploy のフック中で確実に現在のプロジェクトを取得
    const activeProject = (process.env.GCLOUD_PROJECT || execSync('firebase use').toString()).toLowerCase();

    // 本番環境プロジェクト名が含まれる場合のみ結合・難読化を実行
    if (activeProject.includes('astro-fray') || activeProject.includes('production')) {
        console.log("===============================================================");
        console.log("🔨 [PROD BUILD] 本番環境（production）へのデプロイを検知しました！");
        console.log("🔒 悪意あるユーザーからの解析を防ぐため、全ファイルの結合・暗号化を開始します...");
        console.log("===============================================================");

        const publicDir = path.join(__dirname, '../public');
        const indexHtmlPath = path.join(publicDir, 'index.html');
        const indexHtmlBackupPath = path.join(publicDir, 'index.html.bak');
        const gameJsPath = path.join(publicDir, 'js/game.js');
        const gameJsBackupPath = path.join(publicDir, 'js/game.js.bak');

        // バックアップの作成（すでに存在する場合はリストアしてクリーンな状態からスタート）
        if (!fs.existsSync(gameJsBackupPath)) fs.copyFileSync(gameJsPath, gameJsBackupPath);
        else fs.copyFileSync(gameJsBackupPath, gameJsPath);

        if (!fs.existsSync(indexHtmlBackupPath)) fs.copyFileSync(indexHtmlPath, indexHtmlBackupPath);
        else fs.copyFileSync(indexHtmlBackupPath, indexHtmlPath);

        // build_prod.jsと同等の22個のモジュール配列
        const modules = [
            'core/keybindings.js', 'core/audio.js', 'core/init_controls.js',
            'ui/transition.js', 'core/utils.js', 'core/faction.js', 'core/settings.js',
            'ui/layout_manager.js', 'core/state.js', 'core/touch.js', 'network/photon.js',
            'entities/bullet_effect.js', 'core/update_routine.js', 'core/update.js',
            'core/render.js', 'core/helpers.js', 'core/loop.js', 'ui/main_ui.js',
            'ui/devmode.js', 'ui/layout_editor.js', 'ui/alert.js', 'ui/auth.js'
        ];

        let bundleContent = "/* Astro-Fray Production Bundle */\n\n";
        for (const mod of modules) {
            const filePath = path.join(publicDir, 'js', mod);
            bundleContent += `\n/* --- MODULE: ${mod} --- */\n` + fs.readFileSync(filePath, 'utf8') + "\n";
        }
        // ルートとなる game.js 本体も末尾に追加
        bundleContent += `\n/* --- MODULE: game.js --- */\n` + fs.readFileSync(gameJsPath, 'utf8') + "\n";

        // 結合した内容を一括で難読化
        const obfuscationResult = JavaScriptObfuscator.obfuscate(bundleContent, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.1,
            stringArray: true,
            stringArrayEncoding: ['rc4'],
            stringArrayThreshold: 0.3,
            deadCodeInjection: false,
        });

        const originalSize = Buffer.byteLength(bundleContent, 'utf8') / 1024;
        const obfuscatedSize = Buffer.byteLength(obfuscationResult.getObfuscatedCode(), 'utf8') / 1024;

        // 難読化済みのコードを public/js/game.js として上書き保存
        fs.writeFileSync(gameJsPath, obfuscationResult.getObfuscatedCode());

        // index.htmlの整理（22個の別ファイルscriptタグを取り除く）
        let indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
        for (const mod of modules) {
            const regex = new RegExp(`[ \\t]*<script src="js/${mod}"></script>[ \\t]*\\r?\\n`, 'g');
            indexHtmlContent = indexHtmlContent.replace(regex, '');
        }
        fs.writeFileSync(indexHtmlPath, indexHtmlContent);

        console.log("✅ [PROD BUILD SUCCESS] 全ファイルの結合と暗号化（難読化）が完全に成功しました！");
        console.log(`📦 バンドルファイル数: ${modules.length + 1} 個`);
        console.log(`📏 暗号化前のサイズ: ${originalSize.toFixed(2)} KB -> 暗号化後のサイズ: ${obfuscatedSize.toFixed(2)} KB`);
        console.log("🛡️ この状態でFirebaseへ安全にアップロードされます。デプロイ後、自動的に開発環境用のコードに復元されます。");
        console.log("===============================================================\n");

    } else {
        console.log("===============================================================");
        console.log("⚡ [TEST BUILD] テスト環境（dev）へのデプロイを検知しました。");
        console.log("🔍 デバッグを容易にするため、暗号化・結合プロセスを完全スキップします。");
        console.log("===============================================================\n");
    }
} catch (error) {
    console.error("❌ [BUILD ERROR] 難読化プロセスでエラーが発生しました:", error);
    process.exit(1);
}
