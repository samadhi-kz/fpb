# Flag Play Board 5vs5

An interactive web-based tool for designing and visualizing flag football plays.

## Features

- Draw and edit football plays with routes, motions, passes, and blocks
- Switch offense formations in one click: Single back, Spread, Twins, Twins stack, Trips, Bunch, Tight, Double back, and I formation
- Keep fixed offensive roles: 1 Center/Screen, 2 QB, 3 RB/WR, 4 Blocker/WR/Screen, 5 WR
- Show or hide the defense markers while keeping their positions saved
- Customize player markers (light blue circles, red stars, yellow diamonds, green squares)
- Adjust player size and end cap size
- Save and load plays as JSON
- Export plays as PNG or PDF
- Manage playbooks with folders and multiple plays
- Responsive canvas for desktop, tablet, and phone use

## Usage

1. Open the application in a web browser
2. Create new plays and organize them into folders
3. Use the drawing tools to add routes and annotations
4. Use Offense Formation to place the offense quickly, then use Flip H for the opposite side
5. Use Defense to show or hide the defensive markers
6. Customize player markers and sizes
7. Save your playbook as JSON for later editing
8. Export plays as PNG or PDF for sharing and printing

## Tools

- **Select**: Select and move elements on the field
- **Route**: Draw player routes
- **Motion**: Draw motion routes (zigzag pattern)
- **Pass**: Draw pass routes (dashed)
- **Block**: Draw block assignments
- **Comment**: Add text annotations

## Player Marks

- Light Blue Circle (default)
- Red Star
- Yellow Diamond
- Green Square

## Offensive Roles

- `1`: Center / screen receiver
- `2`: QB
- `3`: RB/WR
- `4`: Blocker/WR / screen receiver
- `5`: WR

Formation presets follow these roles. `1` stays at center but can be used as a screen receiver, `2` stays behind as QB, `3` is used as the RB/slot-flex player, `4` is kept more inside as the blocker/inside WR and can also receive screens, and `5` is treated as the outside WR. Use `Flip H` to mirror the same concept to the other side.

## File Format

Playbooks are saved as JSON and can be easily backed up, shared, or version controlled.

## Formation Presets

- Single back
- Spread
- Twins
- Twins stack
- Trips
- Bunch
- Tight
- Double back
- I formation

The presets are defined for one side of the field. Use `Flip H` to mirror the play.

## Supported Environment

- Local desktop use: open `index.html` directly in a modern browser.
- PC web use: open the GitHub Pages URL in Chrome, Edge, Firefox, or Safari.
- Smartphone web use: open the GitHub Pages URL in iOS Safari or Android Chrome.
- Static hosting only: GitHub Pages or any static file host is enough. No server-side code is required.
- Optional file-system access: direct overwrite works only in browsers that support the File System Access API. Use `Save As` on Safari and other browsers without direct overwrite support.
- Export behavior depends on the browser: PNG downloads through the browser, and PDF uses the browser print dialog.

## Testing

No automated test suite is included. The recommended checks are:

1. Run JavaScript syntax checks:

   ```sh
   node --check js/config.js
   node --check js/model.js
   node --check js/playbook-tree.js
   node --check js/drawing.js
   node --check js/field-interactions.js
   node --check js/files.js
   node --check js/playbook-actions.js
   node --check js/main.js
   git diff --check
   ```

2. Open `index.html` locally in a desktop browser and verify:
   - tools switch correctly
   - offense formation buttons move only the offense
   - selecting offensive players shows their role in the Selection panel
   - Defense toggles the defensive markers without deleting them
   - new folder/play creation works
   - routes can be drawn, edited, and cleared
   - JSON export/import works
   - PNG and PDF export functions open correctly
3. Open the GitHub Pages URL on a desktop browser and verify static hosting works normally.
4. Open the GitHub Pages URL on a smartphone and verify tapping, route creation, the bottom dock, formation buttons, and file export work as expected.
5. Confirm the app remains functional when switching between tools and when using the save/load workflow.

## Usage Scenarios

- Local browser: open `index.html` directly and use the app without a server
- Desktop GitHub Pages: publish the repository and use the app from the hosted URL
- Mobile GitHub Pages: open the hosted URL on a smartphone for touch-friendly editing

## Security Notes

- The app is static HTML/CSS/JavaScript. It has no backend, login, cookies, or remote API calls.
- Scripts are loaded from local project files only.
- Playbook JSON is parsed in the browser and normalized before use.
- User-controlled names, notes, and comments are rendered with text APIs instead of HTML injection.
- File open/save uses browser file dialogs or browser downloads.
- Do not include private or sensitive information in play notes if you plan to share exported JSON, PNG, or PDF files.

## License

- This project is licensed under the MIT License.
- Copyright (c) 2026 Kazutaka Maeda (@samadhi-kz, @maek0812)
- See [LICENSE](./LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.


フラッグフットボールのオフェンスプレイ図を作るための静的Webアプリです。

## 使い方

`index.html` をブラウザで開くと動きます。

- 選択ツールで選手や守備Xをドラッグ
- 役割は 1 Center-Screen / 2 QB / 3 RB-WR / 4 Blocker-WR-Screen / 5 WR
- Offense Formation で Single back / Spread / Twins / Twins stack / Trips / Bunch / Tight / Double back / I formation を一発配置
- 反対側の形は Flip H で左右反転
- Defense で守備マーカーの表示・非表示を切り替え
- ルート、モーション、パス、ブロックを選んで、選手からドラッグして線を作成
- 線を選択してドラッグすると線全体を移動
- 青い点をドラッグするとルートを調整、黄色い点をドラッグすると中間点を追加
- Text ツールでプレイ内にコメントを書き込み
- 赤星は なし / 1-5 から切り替え
- 線を全消去でルートをまとめてクリア
- Folder と Play でプレイブックを整理してJSON保存
- PDF ボタンで印刷ダイアログを開き、PDFとして保存
- PNG と JSON でファイル出力
- 5v5固定のため、選手と守備Xは常に5人ずつです
