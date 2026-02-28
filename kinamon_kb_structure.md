# kinamon_project — Knowledge Base フォルダー構成 v0.3.0

> kinamon アイデンティティを核とした自律型知識循環システム

---

## フォルダーツリー

```
kinamon_kb/
│
├── 00_identity/                          # kinamonのコアアイデンティティ（全ての起点）
│   ├── kinamon_core.md                   # 価値観・思想・興味関心の定義
│   ├── tone_and_voice.md                 # 発信トーン・言語スタイル
│   ├── interests_map.md                  # 関心領域マップ（AI / Crypto / Tech）
│   └── kinamon_log/                      # ★ kinamonの日々の思考・気づき置き場
│       └── YYYY-MM-DD_log.md             #   方向転換・意思決定の記録も含む
│
├── 01_bots/                              # ボット個体定義
│   ├── _shared/
│   │   ├── bot_protocol.md               # 共通ルール・行動プロトコル
│   │   ├── communication_rules.md        # ボット間通信ルール
│   │   ├── interpretation_rules.md       # 個々解釈のルール定義
│   │   └── conflict_resolution.md        # ★ 意見が割れた時の裁定ルール
│   ├── bot_0X_[name]/
│   │   ├── persona.md                    # ペルソナ定義
│   │   ├── platform.md                   # 担当SNS・投稿スタイル
│   │   ├── memory.md                     # 個体の記憶・傾向ログ
│   │   ├── growth_log.md                 # 選択履歴が個性を形成するログ
│   │   ├── interpretation_style.md       # そのボット固有の解釈傾向
│   │   └── opinion_history/              # 過去の意見・2択分岐ログ
│   │       └── YYYY-MM-DD_topic.md
│   └── 00_evaluator/                     # 評価ボット（メタレイヤー・6体目）
│       ├── persona.md                    # 評価者としてのペルソナ
│       ├── evaluation_criteria.md        # 評価軸の定義
│       ├── reports/                      # 評価レポート
│       │   └── YYYY-MM-DD_report.md
│       └── priority_control.md           # 重点配分の現在設定（0〜1のウェイト）
│
├── 02_news_pool/                         # 一次情報プール
│   ├── _inbox/                           # 未処理の最新情報
│   ├── _processed/                       # 処理済みアーカイブ
│   ├── _tagged/                          # タグ別分類済み
│   │   ├── ai/
│   │   ├── crypto/
│   │   ├── dev_tools/
│   │   └── product_hints/                # プロダクトのヒントになるネタ
│   ├── _bot_interpretations/             # ボット別解釈・独自情報取得ストレージ
│   │   ├── bot_01/ … bot_05/
│   └── feed_config.md                    # 情報ソース設定
│
├── 03_opinion_gate/                      # 意見分岐 → kinamon選択レイヤー
│   ├── _pending/                         # 選択待ち（2択が届いている状態）
│   │   └── YYYY-MM-DD_[topic]_choice.md  # フォーマット：A案・B案・根拠
│   ├── _decided/                         # kinamon選択済み → 自動承認・記事生成へ
│   └── _rejected/                        # 見送り・保留
│
├── 04_brainstorm/                        # ボット間ブレインストーミング
│   ├── _sessions/                        # セッションログ（日時別）
│   │   └── YYYY-MM-DD_topic.md
│   ├── _ideas/                           # 生まれたアイデアのストック
│   └── _decisions/                       # 採択・棄却の決定ログ
│
├── 05_sns_content/                       # SNS投稿コンテンツ管理
│   ├── _generated/                       # 選択後に自動生成された記事
│   ├── _review/                          # kinamon承認・評価・加筆待ち
│   ├── _approved/                        # Go済み記事
│   ├── _scheduled/                       # 予約投稿
│   ├── _published/                       # 投稿済みアーカイブ
│   └── _performance/                     # 反応・エンゲージメントログ
│
├── 06_products/                          # プロダクト管理
│   ├── _proposals/                       # 提案書（承認待ち）
│   │   └── YYYY-MM-DD_[name].md
│   ├── _approved/                        # kinamon承認済み
│   ├── _in_development/                  # 開発中
│   ├── _deployed/                        # デプロイ済み・公開中
│   └── _template/
│       └── proposal_template.md          # 提案書テンプレート
│
├── 07_knowledge_cycles/                  # 知識循環ログ
│   ├── weekly_digest.md                  # 週次サマリー
│   ├── learning_log.md                   # 学習・更新履歴
│   ├── feedback_loop.md                  # 改善ループの記録
│   └── brainstorm_to_kb/                 # ブレスト知見のKBフィードバック
│       └── YYYY-MM-DD_insights.md
│
├── 08_maintenance/                       # ★ 劣化・修正管理
│   ├── _deprecated/                      # 古くなったコンテンツ・ルールのアーカイブ
│   ├── correction_log.md                 # ボットのズレ・誤解釈の記録と修正履歴
│   ├── reset_protocol.md                 # ボット・KBリセットの手順書
│   └── health_check.md                   # 定期的なシステム健全性チェック項目
│
├── 09_kinamon_queue/                     # ★ kinamon対応キュー一本化
│   ├── README.md                         # キューの使い方・優先度ルール
│   ├── _urgent/                          # 即対応（24h以内）
│   ├── _normal/                          # 通常対応（週内）
│   └── _someday/                         # いつかやる・アイデアストック
│
├── 10_external_feedback/                 # ★ 外部反応のKB還流
│   ├── _raw/                             # SNSエンゲージメント生データ
│   ├── _analyzed/                        # 分析済み・パターン抽出
│   └── insights_to_kb.md                 # KBへの反映サマリー
│
├── 11_workflows/                         # ワークフロー・スケジュール管理
│   ├── master_workflow.md                # 全体フロー俯瞰図
│   ├── triggers.md                       # トリガー定義一覧
│   ├── schedules/
│   │   ├── daily.md                      # 日次スケジュール
│   │   ├── weekly.md                     # 週次スケジュール
│   │   └── event_driven.md               # イベントドリブンのトリガー
│   ├── automation_rules.md               # 自動化ルール
│   └── escalation_rules.md               # kinamon介入が必要な条件定義
│
└── 12_system/                            # システム設定・メタ情報
    ├── architecture.md                   # 全体アーキテクチャ図
    ├── agent_instructions/
    │   ├── news_bot.md
    │   ├── sns_bot_common.md
    │   ├── product_agent.md
    │   └── evaluator_bot.md              # 評価ボット指示書
    ├── approval_flow.md                  # kinamon承認フロー
    └── changelog.md                      # 知識ベース自体の変更履歴
```

---

## v0.2 → v0.3 追加ポイント

### 1. `00_identity/kinamon_log/`
kinamonの日々の思考・気づき・方向転換を記録する場所。
システムの「重力の中心」となる。ここが充実するほど、全ボットの判断軸が安定する。

### 2. `08_maintenance/` — 劣化管理
成長サイクルだけでなく、ズレ・腐敗への対処フロー。
`correction_log.md` に誤解釈を記録し、`reset_protocol.md` でリセット手順を標準化する。

### 3. `09_kinamon_queue/` — kinamon対応キュー一本化
2択選択・記事承認・プロダクト承認が散らばらないよう、
kinamon宛のタスクをすべてここに集約。優先度で `_urgent / _normal / _someday` に振り分ける。

### 4. `10_external_feedback/` — 外部反応のKB還流
SNSの反応を `_performance` に記録するだけで終わらせず、
分析してKBに戻す専用レイヤー。これで初めて「本当の循環」が完成する。

---

## コアサイクル v0.3

```
[情報収集]
news_bot → 02_news_pool/_inbox

[解釈・個性化]
各bot → _bot_interpretations（個別解釈・独自調査）
→ 03_opinion_gate/_pending（2択を09_kinamon_queueへ）

[kinamon選択]
09_kinamon_queue/_urgent → 選択 → _decided
→ 記事自動生成 → 05_sns_content/_generated
→ kinamon評価・加筆 → _approved → 配信

[外部反応の還流]
_published → _performance → 10_external_feedback → 07_knowledge_cycles

[評価・リバランス]
00_evaluator → 週次レポート → priority_control.md 更新
→ ペルソナ成長 / ブレスト品質 / プロダクト開発 の重点シフト

[メンテナンス]
08_maintenance → correction_log / reset_protocol
→ 劣化したコンテンツを _deprecated へ
```

---

## 優先度コントロール（evaluatorが管理）

| モード | 内容 | 発火条件の例 |
|--------|------|-------------|
| `persona_growth` | ペルソナ育成優先（2択頻度↑） | ボット個性スコアが低い時 |
| `brainstorm_quality` | ブレスト品質優先（セッション↑） | product_hintsが蓄積されている時 |
| `product_dev` | プロダクト開発優先（提案→開発加速） | 採択済み提案が滞留している時 |

現在のウェイト設定は `00_evaluator/priority_control.md` で管理。

---

*kinamon_project / ver 0.3.0 / 2026*
