# 設計書：Mension（チャット横断 Mention → TODO 管理ツール）

---

## 1. 技術スタック

| レイヤー         | 技術                              | 備考 |
| ---------------- | --------------------------------- | ---- |
| フレームワーク   | Next.js 16 (App Router)           |      |
| 言語             | TypeScript                        |      |
| DB               | PostgreSQL 16                     | Docker で起動 |
| ORM              | Prisma                            |      |
| 認証             | Basic認証（env で ID/PW 管理）        | 将来 Auth.js + Google OAuth に差し替え可能 |
| LLM              | Claude API (Anthropic) `claude-haiku-4-5-20251001` | 依頼判定 + 束ね候補の自動提示。モデル選定は下記参照 |

---

## 2. 外部サービス連携

| サービス  | 取り込み方式 | イベント | 署名検証 |
| --------- | ------------ | -------- | -------- |
| Slack     | Webhook (Event API) | `message` (サーバー側でメンション含有を確認) | HMAC-SHA256（`X-Slack-Signature` ヘッダー、タイムスタンプ5分チェック） |
| Chatwork  | Webhook      | メンション受信 | HMAC-SHA256（クエリパラメータ `chatwork_webhook_signature`、トークンをBase64デコードしてキーに使用） |

### Slack Webhook の設計判断

- **購読イベント**: `message.channels`（`app_mention` ではない）
  - 理由: `app_mention` はボットへのメンションを取る。自分（人間アカウント）宛のメンションを取るには `message.channels` が必要
- **サーバー側フィルタリング**: `<@SLACK_USER_ID>` を含むメッセージのみ処理（env で管理）
- **bot_message サブタイプは除外**: ボット自身の発言を再処理しない
- **送信者名解決**: Slack API `users.info` で `display_name` → `real_name` の順に取得（`SLACK_BOT_TOKEN` が設定されている場合のみ。未設定時はユーザーIDにフォールバック）
- **本文クリーニング**: `<@SLACK_USER_ID>` をメッセージ本文から除去してから保存・LLM判定

### Chatwork Webhook の設計判断

- **送信者名解決**: Chatwork API `/v2/rooms/{room_id}/members` で `to_account_id`（自分）のアカウント名を取得（`CHATWORK_API_TOKEN` が設定されている場合のみ。未設定時はaccount_idにフォールバック）
- **本文クリーニング**: `[To:数字]名前 ` 形式のプレフィックスを除去してから保存・LLM判定

### 共通

- Webhook 受信 → 共通の `IncomingEvent` 型に正規化（アダプター層 `src/lib/adapters/`）
- 新サービス追加は `src/lib/adapters/` に1ファイル追加するだけ

---

## 3. データモデル

### Task（TODO）

| カラム        | 型         | 説明 |
| ------------- | ---------- | ---- |
| id            | UUID       | PK |
| title         | String     | TODO のタイトル（初期値はメッセージ本文から生成） |
| status        | Enum       | `todo` / `doing` / `done` |
| groupId       | UUID?      | 束ねグループID（nullable） |
| createdAt     | DateTime   |      |
| updatedAt     | DateTime   |      |

### Message（元メッセージ）

| カラム        | 型         | 説明 |
| ------------- | ---------- | ---- |
| id            | UUID       | PK |
| taskId        | UUID?      | 紐づくTask（nullable: 未紐づけ状態も持つ） |
| source        | Enum       | `slack` / `chatwork` |
| externalId    | String     | 各サービスのメッセージID |
| senderName    | String     | 送信者名（API解決済み。失敗時はID文字列） |
| body          | String     | メッセージ本文（メンションプレフィックス除去済み） |
| permalink     | String?    | 元メッセージへのURL |
| rawPayload    | Json       | Webhook ペイロード原文 |
| isProcessing  | Boolean    | LLM判定処理中フラグ（処理完了後に false に更新）。true の間は未確認バッジに表示しない |
| receivedAt    | DateTime   |      |

**ユニーク制約**: `(source, externalId)` → Webhook 重複配信対策

### TaskGroup（束ねグループ）

| カラム        | 型         | 説明 |
| ------------- | ---------- | ---- |
| id            | UUID       | PK |
| title         | String     | グループのタイトル |
| createdAt     | DateTime   |      |

**グループ作成フロー**: 「まとめる」ボタン押下 → タイトル入力ダイアログ表示 → 確定でグループ作成・Task に groupId を付与

**グループ自動解除**: タスク削除時にグループ内の残タスクが1件以下になった場合、グループを自動的に解除・削除する

**「グループに追加」ボタンは意図的に未実装**: グループへの追加はLLMの類似検出バナー（GroupSuggestion）経由のみとする。手動追加は「LLMが見逃した類似タスク」のケースだが稀であり、LLMの精度向上で不要になる。「グループから外す」（間違いの修正）は必要だが、「グループに追加」（能動的操作）はLLMに委ねる設計。
- 残1件 → 残タスクの `groupId` を null にしてグループを削除
- 残0件 → グループのみ削除

### GroupSuggestion（LLM による束ね候補）

| カラム         | 型         | 説明 |
| -------------- | ---------- | ---- |
| id             | UUID       | PK |
| newTaskId      | UUID       | 新着Task |
| candidateTaskId| UUID       | 候補Task |
| reason         | String?    | LLMが類似と判断した理由 |
| status         | Enum       | `pending` / `accepted` / `rejected` |
| createdAt      | DateTime   |      |

---

## 4. API エンドポイント

### Webhook 受信

| メソッド | パス                        | 説明 |
| -------- | --------------------------- | ---- |
| POST     | `/api/webhooks/slack`       | Slack Event API 受信 |
| POST     | `/api/webhooks/chatwork`    | Chatwork Webhook 受信 |

### タスク操作

| メソッド | パス                        | 説明 |
| -------- | --------------------------- | ---- |
| GET      | `/api/tasks`                | タスク一覧 |
| PATCH    | `/api/tasks/[id]`           | ステータス変更・グループ紐づけ |
| DELETE   | `/api/tasks/[id]`           | タスク削除 |
| POST     | `/api/tasks/[id]/group`     | グループ作成・統合 |

### 束ね候補

| メソッド | パス                              | 説明 |
| -------- | --------------------------------- | ---- |
| GET      | `/api/suggestions`                | 未対応の候補一覧 |
| POST     | `/api/suggestions/[id]/accept`    | 候補を承認（グループ統合） |
| POST     | `/api/suggestions/[id]/reject`    | 候補を却下 |

### uncertain Message

| メソッド | パス                          | 説明 |
| -------- | ----------------------------- | ---- |
| GET      | `/api/messages`               | uncertain なMessage一覧（バッジ・救済UI用） |
| POST     | `/api/messages/[id]/taskify`  | MessageをTask化（手動） |
| DELETE   | `/api/messages/[id]`          | Messageを削除 |

---

## 5. LLM処理の設計

### モデル選定

現在は `claude-haiku-4-5-20251001` を使用している。変更は `src/lib/llm/judge.ts` の1行で済む。

| モデル | 精度 | 速度 | コスト | 備考 |
|---|---|---|---|---|
| `claude-haiku-4-5-20251001` | ◯ | ◎ | 安い | **現在採用**。個人利用の呼び出し頻度に適する |
| `claude-sonnet-4-6` | ◎ | ◯ | 中 | 判定ミスが多い場合の移行候補 |
| `claude-opus-4-6` | ◎◎ | △ | 高い | 通常は不要 |

**Haiku を選んだ理由**
- タスクが「3択分類＋類似ID抽出」のみで、高性能モデルは不要
- Webhook の fire-and-forget 処理でレスポンス速度が重要
- 個人利用で呼び出し頻度が高くなりやすいためコストを抑える

### フロー

```
Webhook受信
  → Messageを保存（全件）
  → 200を即返す
  → [fire-and-forget] Claude APIを呼び出し（1回のプロンプトで2役）
        ├─ actionable → Task作成
        │                 ├─ 類似Taskあり → GroupSuggestion作成 → UIにバナー表示
        │                 └─ 類似Taskなし → そのままTODO一覧に表示
        ├─ uncertain  → Messageはそのまま保存（taskId: null） → ヘッダーバッジに表示
        └─ not_actionable → Messageを物理削除
```

### LLMに渡す情報

- 新着メッセージ本文・送信者・ソース（Slack/Chatwork）
- **同一ソース**の直近30件の未完了Task（id・title・メッセージ本文）
  - Slack から来たメッセージ → Slack 発タスクのみを類似検索対象にする
  - Chatwork から来たメッセージ → Chatwork 発タスクのみを類似検索対象にする
  - 設計判断: サービスをまたいだグループ化は文脈が異なり誤検出リスクが高いため除外

### LLMから受け取る情報（JSON形式）

```json
{
  "judgment": "actionable",
  "reason": "見積もり提出を依頼している",
  "similar_task_ids": ["uuid-xxx"]
}
```

- LLM がマークダウンコードブロック（` ```json ` ）で返す場合があるため、サーバー側でパース前にブロック記法を除去する
- パース失敗時は `uncertain` にフォールバック（依頼の見落とし防止）

### 判定後の処理

| judgment | 処理 |
|----------|------|
| `actionable` | Task作成 → TODO一覧に表示 |
| `uncertain` | Messageを保存 → ヘッダーにバッジ表示（ユーザーが手動でTask化 or 削除） |
| `not_actionable` | Messageを保存せず破棄 |

### 判定基準（プロンプトに明記する内容）

| judgment | 基準 | 例 |
|----------|------|----|
| `not_actionable` | 完全に明らかな感謝・挨拶・リアクションのみ | 「ありがとう」「お疲れ様」「了解です」「いいですね」 |
| `actionable` | 依頼・指示・確認依頼が明確なもの | 「〜してください」「〜までにお願い」「〜確認してもらえますか」 |
| `uncertain` | 少しでも迷ったら全てこちら | 「例のやつどうなってる？」「よろしく」「〜だと助かるんだけど」 |

### LLM判定のリスクと対策

| リスク | 具体例 | 対策 |
|--------|--------|------|
| 依頼をスルー（偽陰性） | 文脈依存の依頼を `not_actionable` に誤判定 | `uncertain` を広く取り、迷ったら必ずバッジ表示に回す |
| 雑談をTask化（偽陽性） | 「また相談させて」を `actionable` に誤判定 | Taskを簡単に削除できるUIを用意する |
| 類似判定の誤り | 全く別の依頼を同じグループに束ねる | GroupSuggestionは候補提示に留め、ユーザーが承認するまでグループ化しない |
| サービス混在による誤グループ化 | SlackとChatworkの別文脈の依頼を束ねる | 類似検索を同一ソース内に限定する |

---

## 6. 認証

### 方針

- **現在: Basic認証**（環境変数でID/PW管理、個人利用前提）
- 認証ロジックを `src/lib/auth/` に閉じ込め、将来の差し替えに備える
- アプリ側（middleware・APIルート）は `src/lib/auth/index.ts` だけを参照する

### ディレクトリ構成

```
src/lib/auth/
  index.ts       ← アプリ全体はここだけを見る（実装を差し替えてもここは変わらない）
  basic.ts       ← 現在の実装（Basic認証）
  nextauth.ts    ← 将来の実装（Google OAuth など）※今は未使用
```

### 現在の実装（Basic認証）

```
BASIC_AUTH_USER=admin
BASIC_AUTH_PASSWORD=yourpassword  # ASCII文字のみ（日本語・全角文字不可）
```

- `middleware.ts` で全ルートに認証チェックをかける
- 未認証は 401 を返しブラウザのBasic認証ダイアログを表示

### 将来の差し替えイメージ

```ts
// src/lib/auth/index.ts
// ここを変えるだけでアプリ側は無変更
export { auth, signIn, signOut } from './basic'   // 今
// export { auth, signIn, signOut } from './nextauth' // 将来
```

### 拡張ロードマップ

| フェーズ | 認証方式 | 対応内容 |
| -------- | -------- | -------- |
| 現在     | Basic認証 | env の ID/PW で保護 |
| 個人→チーム公開時 | Google OAuth | `nextauth.ts` に差し替え |
| さらなる拡張 | GitHub OAuth / メール+PW | Auth.js にプロバイダー追加 |
| チーム→マルチテナント | Organization 概念追加 | User に organizationId を追加 |

---

## 7. 冪等性・エラーハンドリング

- `(source, externalId)` のユニーク制約で Webhook 重複を防ぐ
- Slack の URL verification チャレンジに対応
- Slack Webhook 署名検証: HMAC-SHA256（`X-Slack-Signature`）＋タイムスタンプ5分チェック
- Chatwork Webhook 署名検証: クエリパラメータ `chatwork_webhook_signature` を HMAC-SHA256 で検証。トークンは Base64 デコードしてキーに使用

---

## 8. 環境変数

| 変数名                   | 必須   | 説明 |
| ------------------------ | ------ | ---- |
| `DATABASE_URL`           | 必須   | PostgreSQL 接続URL |
| `ANTHROPIC_API_KEY`      | 必須   | Claude API キー |
| `SLACK_SIGNING_SECRET`   | 必須   | Slack Webhook 署名検証シークレット |
| `SLACK_USER_ID`          | 必須   | 自分の Slack ユーザーID（メンション検出に使用） |
| `SLACK_BOT_TOKEN`        | 任意   | Slack Bot Token（送信者名解決に使用。未設定時はユーザーIDで表示） |
| `CHATWORK_WEBHOOK_TOKEN` | 必須   | Chatwork Webhook トークン（HMAC-SHA256 署名検証に使用） |
| `CHATWORK_API_TOKEN`     | 任意   | Chatwork API トークン（送信者名解決に使用。未設定時はaccount_idで表示） |
| `BASIC_AUTH_USER`        | 必須   | Basic認証ユーザー名（ASCII文字のみ） |
| `BASIC_AUTH_PASSWORD`    | 必須   | Basic認証パスワード（ASCII文字のみ） |

---

## 9. 未決事項リスト

- [x] 3.1 Task のステータス設計 → `todo` / `doing` / `done` の3段階（LLM束ね候補があるので inbox 不要）
- [x] 5.1 Claude API 呼び出しの非同期方式 → fire-and-forget（Vercel 非使用のためシンプルに `void suggest()` で処理）
- [x] 5.2 LLM処理設計 → 1回のプロンプトで「依頼判定（3段階）」+「類似Task検索」を同時実施。誤判定リスクは救済UIで対応
- [x] UI のページ構成・操作フロー → `/tasks` の1画面で全操作完結。元メッセージはカード内インライン展開。uncertain はヘッダーバッジ+モーダル

## 10. 将来の改善候補

- [ ] **未確認バッジのリアルタイム更新**: 現在は10秒ポーリング（個人利用では十分）。複数人が同時利用するようになったタイミングで SSE（Server-Sent Events）または WebSocket に切り替えを検討する。
