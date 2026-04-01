# 実装プラン: AIプロバイダー切り替えトグル (Gemini ↔ LMStudio)

このプランでは、ニュース翻訳や判定などのAIタスクを、Google Gemini（クラウド）と LMStudio（ローカル）でUIから切り替えられるようにします。

## ユーザー確認事項

> [!IMPORTANT]
> - **LMStudioの状態**: 本機能は、LMStudioが `http://localhost:1234` で起動しており、OpenAI互換APIが有効であることを前提としています。
> - **パフォーマンス**: ローカルモデルの速度は、マシンのスペックに依存し、Geminiより低速になる可能性があります。

---

## 変更内容

### [バックエンド設定]

#### [NEW] [ai_settings.json](file:///home/kinamon/product/KinamonKB/kinamon_kb/ai_settings.json)
- アクティブなプロバイダーと接続情報を保持します。
```json
{
  "active_provider": "gemini",
  "lmstudio_url": "http://localhost:1234/v1/chat/completions",
  "lmstudio_model": "local-model"
}
```

### [フロントエンド & Server Actions]

#### [MODIFY] [actions.ts](file:///home/kinamon/product/KinamonKB/system_ui/src/lib/actions.ts)
- `getAISettings()` と `updateAISettings(settings: any)` サーバーアクションを追加します。
- [fetchRSS](file:///home/kinamon/product/KinamonKB/system_ui/src/lib/actions.ts#589-604) や [runPatrol](file:///home/kinamon/product/KinamonKB/system_ui/src/lib/actions.ts#375-389) のトリガー時に、現在の設定が正しく反映されるようにします。

#### [NEW] [AIToggle.tsx](file:///home/kinamon/product/KinamonKB/system_ui/src/components/AIToggle.tsx)
- プロバイダーを切り替えるためのプレミアムなUIコンポーネントを作成します。
- 可能であれば LMStudio の接続状況（Online/Offline）を表示します。

#### [MODIFY] [page.tsx](file:///home/kinamon/product/KinamonKB/system_ui/src/app/page.tsx)
- サイドバーの下部セクションに `AIToggle` を統合します。

### [スクリプト & AIロジック]

#### [MODIFY] [fetch_news.py](file:///home/kinamon/product/KinamonKB/scripts/fetch_news.py)
- 起動時に `ai_settings.json` を読み込みます。
- AI呼び出し部分をモジュール化します。
  - `gemini` の場合: 既存の `gemini` CLI ロジックを使用。
  - `lmstudio` の場合: `subprocess` で `curl` を叩くか、`urllib` を使用してローカルAPIを呼び出します。
- プロバイダーに関わらず、これまで作成した「共有ペルソナ/ナレッジ」をシステムプロンプトとして一貫して注入します。

---

## 検証プラン

### 自動テスト
- `ai_settings.json` を `lmstudio` に書き換えます。
- [scripts/fetch_news.py](file:///home/kinamon/product/KinamonKB/scripts/fetch_news.py) を実行し、`localhost:1234` への接続試行が発生することを確認します。
- ログを確認し、システムプロンプトの構造が維持されていることを検証します。

### 手動確認
- UI上のスイッチを切り替えます。
- 設定が永続化されること（リロードしても維持される、またはファイルが書き換わっていること）を確認します。
- 「Fetch RSS」を実行し、選択したプロバイダー経由で翻訳が行われることを確認します。
