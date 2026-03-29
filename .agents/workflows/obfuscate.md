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
1. `javascript-obfuscator` コマンドでファイルを変換します
```bash
npx javascript-obfuscator public/game.js --output public/game.obfuscated.js --compact true --control-flow-flattening true --dead-code-injection true --string-array true --string-array-encoding 'base64'
```

2. 変換が完了したら、`index.html` 内の `<script src="game.js"></script>` なとで読み込んでいる部分を一時的に `game.obfuscated.js` に変更してデプロイします。
※ 本番デプロイが完了した後は、ローカルでの開発継続のために元の `game.js` の読み込みに戻すことを推奨します。
