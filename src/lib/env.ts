function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

function optionalEnv(key: string): string | undefined {
  return process.env[key] || undefined
}

function requireAsciiEnv(key: string): string {
  const value = requireEnv(key)
  if (!/^[\x20-\x7E]+$/.test(value)) {
    throw new Error(
      `Environment variable ${key} must contain only half-width alphanumeric characters (ASCII 0x20-0x7E). Japanese and other multi-byte characters are not supported.`
    )
  }
  return value
}

export const env = {
  databaseUrl: requireEnv('DATABASE_URL'),
  anthropicApiKey: requireEnv('ANTHROPIC_API_KEY'),
  slackSigningSecret: requireEnv('SLACK_SIGNING_SECRET'),
  slackUserId: requireEnv('SLACK_USER_ID'),
  slackBotToken: optionalEnv('SLACK_BOT_TOKEN'),       // 将来: Slack API呼び出し時に requireEnv に変更
  chatworkWebhookToken: requireEnv('CHATWORK_WEBHOOK_TOKEN'),
  chatworkApiToken: optionalEnv('CHATWORK_API_TOKEN'),  // 将来: Chatwork API呼び出し時に requireEnv に変更
  basicAuthUser: requireAsciiEnv('BASIC_AUTH_USER'),
  basicAuthPassword: requireAsciiEnv('BASIC_AUTH_PASSWORD'),
}
