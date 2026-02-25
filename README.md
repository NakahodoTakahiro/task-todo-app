# Mension

Slack / Chatwork に届いた自分宛メンションを自動収集し、AIが依頼判定してTODOとして一元管理するツール。

---

## 事前準備チェックリスト

実装を始める前に以下を用意してください。

- [ ] **Anthropic API キー** — [console.anthropic.com](https://console.anthropic.com) でAPIキーを発行
- [ ] **Slack App 作成** — [api.slack.com/apps](https://api.slack.com/apps) でアプリを作成し `SLACK_SIGNING_SECRET` / `SLACK_BOT_TOKEN` を取得
- [ ] **Chatwork Webhook 設定** — 管理画面でWebhookを作成し `CHATWORK_WEBHOOK_TOKEN` / `CHATWORK_API_TOKEN` を取得

---

## 技術スタック

| レイヤー       | 技術                              |
| -------------- | --------------------------------- |
| フレームワーク | Next.js 14 (App Router)           |
| 言語           | TypeScript                        |
| DB             | PostgreSQL 16（Docker）           |
| ORM            | Prisma                            |
| 認証           | Basic認証（将来 Auth.js + Google OAuth に差し替え可能） |
| LLM            | Claude API (Anthropic)            |

---

## セットアップ

### 前提条件

- Node.js 20+
- Docker

### 手順

```bash
# 1. 依存インストール
npm install

# 2. 環境変数を設定
cp .env.example .env.local
# .env.local を編集（下記「環境変数一覧」参照）

# 3. DB 起動
docker compose up -d

# 4. DB マイグレーション
npx prisma migrate dev

# 5. 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 を開く。

---

## 環境変数一覧

> **注意：** アプリ起動時に **全ての環境変数** が揃っているか検証されます。
> 1つでも未設定・空の場合はサーバーが起動しません。`npm run dev` の前に必ず全て設定してください。

| 変数名                   | 説明                                                        | 取得方法                                |
| ------------------------ | ----------------------------------------------------------- | --------------------------------------- |
| `DATABASE_URL`           | PostgreSQL 接続文字列                                       | `docker-compose.yml` の設定に合わせる   |
| `BASIC_AUTH_USER`        | Basic認証のユーザー名（半角英数字・記号のみ）               | 任意の文字列                            |
| `BASIC_AUTH_PASSWORD`    | Basic認証のパスワード（半角英数字・記号のみ）               | 任意の文字列                            |
| `ANTHROPIC_API_KEY`      | Claude API キー                                             | Anthropic Console                       |
| `SLACK_SIGNING_SECRET`   | Webhook 署名検証用シークレット                              | Slack App 管理画面 → Basic Information  |
| `SLACK_BOT_TOKEN`        | Bot API トークン（`xoxb-` から始まる）                      | Slack App 管理画面 → OAuth & Permissions|
| `CHATWORK_WEBHOOK_TOKEN` | Webhook 検証トークン                                        | Chatwork 管理画面 → Webhook             |
| `CHATWORK_API_TOKEN`     | API アクセストークン                                        | Chatwork 管理画面 → API トークン        |

---

## Webhook エンドポイント

サーバー公開後、各サービスの管理画面に以下の URL を登録してください。

| サービス  | エンドポイント                                 | 登録場所                                           |
| --------- | ---------------------------------------------- | -------------------------------------------------- |
| Slack     | `https://{your-domain}/api/webhooks/slack`     | Slack App → Event Subscriptions → Request URL      |
| Chatwork  | `https://{your-domain}/api/webhooks/chatwork`  | Chatwork 管理画面 → Webhook                        |

### Slack 設定手順

1. [api.slack.com/apps](https://api.slack.com/apps) でアプリを作成
2. **Event Subscriptions** を有効化 → Request URL に上記 URL を登録
3. Subscribe to bot events: `app_mention` を追加
4. **OAuth & Permissions** → Bot Token Scopes に以下を追加
   - `app_mentions:read`
   - `channels:history`
5. ワークスペースにアプリをインストール → Bot Token をコピーして `SLACK_BOT_TOKEN` に設定

### Chatwork 設定手順

1. Chatwork 管理画面 → API トークンを発行 → `CHATWORK_API_TOKEN` に設定
2. Webhook 管理画面 → 上記 URL を登録
3. イベント: **メンション受信** を選択
4. 発行されたトークンを `CHATWORK_WEBHOOK_TOKEN` に設定

---

## ローカル開発時の Webhook テスト

外部サービスからローカルに Webhook を届けるには公開 URL が必要です。

```bash
# ngrok を使う場合
ngrok http 3000

# 表示された Forwarding URL（例: https://xxxx.ngrok-free.app）を
# 各サービスの Webhook 設定に一時的に登録する
```

---

## 設計判断メモ

### 「束ねる」機能について

LLM（Claude API）が新着メッセージ受信時に既存の未完了タスクと類似するものを自動検出し、候補として提示する。
ユーザーが「まとめる」を押したタイミングでタイトルを入力してグループ化する（半自動方式）。

- LLM は1回のプロンプトで「依頼判定（3段階）」と「類似Task検索」を同時実施
- GroupSuggestion はあくまで候補提示に留め、ユーザーが承認するまでグループ化しない

### LLM による依頼判定（3段階）

| 判定           | 処理                                       |
| -------------- | ------------------------------------------ |
| `actionable`   | Task作成 → TODO一覧に表示                  |
| `uncertain`    | Messageを保存 → ヘッダーバッジで通知       |
| `not_actionable` | Messageを破棄                            |

`uncertain` の範囲を広く取ることで、依頼の見落とし（偽陰性）を最小化している。

### 外部サービスの正規化レイヤー

Slack / Chatwork のペイロードは形式が異なるため、共通の `IncomingEvent` 型に変換するアダプター層を設けた。
新サービスの追加は `src/lib/adapters/` に1ファイル追加するだけで対応できる。

### 認証

個人利用前提のため Basic認証を採用。認証ロジックを `src/lib/auth/` に閉じ込めており、
将来 Google OAuth 等に差し替える場合は `src/lib/auth/index.ts` の export 先を変えるだけで対応できる。

### 冪等性

`(source, externalId)` にユニーク制約を設けており、Webhook の重複配信が来ても DB に二重登録されない。

---

## ディレクトリ構成

```
src/
  app/
    api/
      webhooks/
        slack/route.ts            # Slack Event API 受信
        chatwork/route.ts         # Chatwork Webhook 受信
      tasks/
        route.ts                  # タスク一覧取得
        [id]/
          route.ts                # タスク詳細・更新・削除
          group/route.ts          # グループ作成・統合
      suggestions/
        route.ts                  # 束ね候補一覧
        [id]/
          accept/route.ts         # 候補を承認
          reject/route.ts         # 候補を却下
      messages/
        route.ts                  # uncertain Message一覧
        [id]/
          route.ts                # Message削除
          taskify/route.ts        # MessageをTask化
    tasks/
      page.tsx                    # TODO一覧UI
  lib/
    adapters/
      types.ts                    # IncomingEvent 共通型
      slack.ts                    # Slack → IncomingEvent 変換
      chatwork.ts                 # Chatwork → IncomingEvent 変換
      index.ts                    # アダプター振り分け
    auth/
      index.ts                    # アプリ全体が参照するエントリーポイント
      basic.ts                    # Basic認証（現在の実装）
      nextauth.ts                 # Google OAuth（将来の実装）
    db/
      tasks.ts                    # Task 操作
      messages.ts                 # Message 操作
      suggestions.ts              # GroupSuggestion 操作
  middleware.ts                   # Basic認証チェック
  prisma/
    schema.prisma
```
