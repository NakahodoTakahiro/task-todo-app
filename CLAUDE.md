# CLAUDE.md

このファイルはClaude Codeが参照するプロジェクト情報と開発ルールです。

---

## プロジェクト概要

Slack / Chatwork に散らばる「自分宛メンション」をWebhookでリアルタイム収集し、
Claude API で依頼判定・束ね候補提示を行い、TODO として一元管理するツール。

詳細は `design.md` / `ux-design.md` を参照。

---

## 技術スタック

- **Next.js 16** (App Router) + TypeScript
- **PostgreSQL 16**（Docker）+ Prisma
- **Claude API**（Anthropic）
- **Basic認証**（将来 Auth.js に差し替え可能な構造）

---

## よく使うコマンド

```bash
# DB起動
docker compose up -d

# 開発サーバー起動
npm run dev

# Prismaマイグレーション
npx prisma migrate dev

# Prisma Studio（DB GUI）
npx prisma studio

# 型チェック
npx tsc --noEmit

# lint
npm run lint
```

---

## ディレクトリ構成のルール

```
src/app/api/        # APIルート（Route Handlers）
src/app/tasks/      # ページ（UI）
src/lib/adapters/   # 外部サービスのペイロード正規化
src/lib/auth/       # 認証ロジック（ここだけ差し替えで認証方式を変更できる）
src/lib/db/         # DB操作関数（Prisma クエリはここに集約）
```

---

## 開発の約束事

### 全般
- `any` 型は使わない
- 環境変数は必ず `src/lib/env.ts` で一元管理・バリデーションする
- エラーは握りつぶさず、必ずログを残す

### APIルート
- Webhook エンドポイントは必ず署名検証を行う（Slack: `X-Slack-Signature`、Chatwork: `X-ChatWorkWebhookToken`）
- Webhook は必ず即座に200を返し、重い処理は fire-and-forget で非同期実行する
- DBへの重複登録は `(source, externalId)` のユニーク制約で防ぐ（アプリ側で重複チェックしない）

### DB操作
- Prisma クエリは `src/lib/db/` に集約し、APIルートに直接書かない
- トランザクションが必要な処理は `prisma.$transaction()` を使う

### 外部サービス連携
- Slack / Chatwork のペイロードは必ず `src/lib/adapters/` で `IncomingEvent` 型に正規化してからDBに保存する
- 新サービスの追加は `src/lib/adapters/` に1ファイル追加するだけで済む設計を維持する

### 認証
- 認証チェックは `middleware.ts` で行う
- APIルート・ページに直接認証ロジックを書かない
- `src/lib/auth/index.ts` だけを参照する（`basic.ts` を直接 import しない）

### LLM処理
- Claude API の呼び出しは `src/lib/llm/` にまとめる
- プロンプトはコード内にハードコードせず、`src/lib/llm/prompts.ts` に集約する
- LLM のレスポンスは必ずバリデーションしてから使う（JSON parseに失敗しても落ちない）

---

## データモデルの重要な制約

- `Message.taskId` が `null` → LLMが `uncertain` と判定したMessage（ヘッダーバッジに表示）
- `Task.groupId` が `null` → グループ未所属のTask
- `GroupSuggestion.status` が `pending` → ユーザーの承認待ち

---

## 実装フェーズ

一気に完成させず、以下のフェーズに分けて進める。
**全フェーズ・全ステップ完了後は必ずユーザーに確認を取り、承認を得てから次のステップに進む。確認なしに次のステップに進んではいけない。**

### Phase 1 - MVP

| ステップ | 内容 |
| -------- | ---- |
| 1 | Next.js セットアップ + Prisma スキーマ |
| 2 | Webhook受信（Slack + Chatwork）+ LLM判定 |
| 3 | Task CRUD API |
| 4 | TODO一覧UI（最低限） |

### Phase 2 - 認証

| ステップ | 内容 |
| -------- | ---- |
| 1 | `src/lib/auth/basic.ts` + `src/lib/auth/index.ts` の実装 |
| 2 | `middleware.ts` で全ルートに認証チェック適用・動作確認 |

### Phase 3 - 機能拡充

| ステップ | 内容 |
| -------- | ---- |
| 1 | 束ね候補バナーUI（承認・却下） |
| 2 | uncertain Messageモーダル（ヘッダーバッジ + モーダル） |
| 3 | 元メッセージのインライン展開UI（カード内で本文・permalink を表示） |
| 4 | フィルター（Slack/Chatwork絞り込み） |

---

## 環境変数

`.env.example` を参照。ローカル開発は `.env.local` を使う。
