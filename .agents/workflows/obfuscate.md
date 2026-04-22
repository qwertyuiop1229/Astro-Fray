---
description: JSファイルの難読化を行い、チーターによる解析を困難にする手順
---

このワークフローは、オンラインシューティングゲームのチート対策の一環として、本番環境へのデプロイ前に `game.js` を難読化（obfuscate）するための手順です。

## 前提条件
`javascript-obfuscator` パッケージが必要です。未インストールの場合は以下のコマンドでグローバルインストールします。

```bash
npm install -g javascript-obfuscator
```

## 難読化手順

以下のコマンドを実行して、`public/game.js` を難読化します。

// turbo-all
1. `scripts/build_prod.js` を実行して結合と暗号化を全自動で行います。
```bash
node scripts/build_prod.js
```
2. 実行後、`public/js/game.obfuscated.js` が自動生成されます。
3. `index.html` 内で `<script src="js/core/keybindings.js">` など分割された22個のスクリプトタグを全削除し、一時的に `<script src="js/game.obfuscated.js"></script>` を1つだけ記述してデプロイします。
※ 本番デプロイが完了した後は、開発継続のために元の `index.html` (22個のファイルを読み込む状態) に戻すことを推奨します（Gitの変更を破棄するか、元に戻してください）。
