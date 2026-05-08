# 使い方メモ

Flag Play Board 5vs5 は、フラッグフットボールのオフェンスプレイ図を作るための静的Webアプリです。

`index.html` をブラウザで開くと動きます。GitHub Pages版は <https://samadhi-kz.github.io/fpb/> から使えます。

## 基本操作

- 選択ツールで選手や守備Xをドラッグ
- 役割は `1` Center/Screen、`2` QB、`3`/`4`/`5` RB/WR・blocker・screen
- Offense Formation で Single back / Spread / Twins / Twins stack / Trips / Bunch / Tight / Double back / I formation を一発配置
- 反対側の形は Flip H で左右反転
- Defense で守備マーカーの表示・非表示を切り替え
- Route / Motion / Pass / Block を選んで、選手からドラッグして線を作成
- 線を選択してドラッグすると線全体を移動
- 青い点をドラッグするとルートを調整、黄色い点をドラッグすると中間点を追加
- Comment ツールでプレイ内にコメントを書き込み
- Clear Lines でルートをまとめてクリア
- Folder と Play でプレイブックを整理してJSON保存
- PDFボタンで印刷ダイアログを開き、PDFとして保存
- Book Link が長い場合は、開く用HTMLファイルまたはURLテキストとして保存・共有
- 共有URLを開いた後もURLは残るため、そのままブックマーク可能
- JSONでファイル出力

5v5固定のため、選手と守備Xは常に5人ずつです。
