# セットアップ手順

## 必要なもの

- Node.js 20以上
- Docker（PostgreSQL起動に使用）
- Anthropic APIキー（[console.anthropic.com](https://console.anthropic.com) で取得）なくても動作確認可能
- Slack アプリのトークン類（Slack連携を使う場合）
- Chatwork APIトークン・Webhookトークン（Chatwork連携を使う場合）

---

## 初回セットアップ

### 1. パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、各値を埋めてください。

```bash
cp .env.example .env
```

`.env` の設定項目：

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `DATABASE_URL` | 必須 | デフォルト値のままでOK（Docker設定に合わせてあります） |
| `BASIC_AUTH_USER` | 必須 | ログイン時のユーザー名（半角英数字のみ） |
| `BASIC_AUTH_PASSWORD` | 必須 | ログイン時のパスワード（半角英数字のみ） |
| `ANTHROPIC_API_KEY` | 必須 | Claude APIキー（`sk-ant-` から始まる） |
| `SLACK_SIGNING_SECRET` | 必須 | Slack Webhook の署名検証キー |
| `SLACK_USER_ID` | 必須 | 自分の Slack ユーザーID（`U` から始まる） |
| `SLACK_BOT_TOKEN` | 任意 | Slack 送信者名を解決する場合に必要（`xoxb-` から始まる） |
| `CHATWORK_WEBHOOK_TOKEN` | 必須 | Chatwork Webhook トークン |
| `CHATWORK_API_TOKEN` | 任意 | Chatwork 送信者名を解決する場合に必要 |

> **注意**: `BASIC_AUTH_USER` と `BASIC_AUTH_PASSWORD` は半角英数字・記号（ASCII）のみ使用可能です。日本語などは起動時にエラーになります。

### 3. データベースの起動

```bash
docker compose up -d
```

### 4. テーブルの作成

```bash
npx prisma migrate deploy
```

### 5. 開発サーバーの起動

```bash
npm run dev
```

---

## 2回目以降の起動

```bash
docker compose up -d
npm run dev
```

---

## Anthropic APIキーを持っていない場合

`ANTHROPIC_API_KEY` が未設定または無効の場合、AI判定が失敗してメッセージが全て「未確認」に振り分けられます。システムは正常に動作するため、未確認モーダルから手動でタスク化することで全ての機能を確認できます。

---

## 動作確認

起動後、以下を確認してください。

- [ ] ブラウザで [localhost:3000/tasks](http://localhost:3000/tasks) にアクセスできる
- [ ] Basic認証ダイアログが表示される（`.env` の `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` を入力）
- [ ] ログイン後、タスク一覧画面（Mension）が表示される
