import { describe, it, expect, vi } from 'vitest'

// コロンを含むパスワードのテストも兼ねるため password にコロンを含める
vi.mock('@/lib/env', () => ({
  env: {
    basicAuthUser: 'admin',
    basicAuthPassword: 'p@ss:w0rd',
  },
}))

import { checkBasicAuth } from '@/lib/auth/basic'

function encodeBasic(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
}

describe('checkBasicAuth', () => {
  it('正しい認証情報で true を返す', () => {
    expect(checkBasicAuth(encodeBasic('admin', 'p@ss:w0rd'))).toBe(true)
  })

  it('パスワードが違う場合 false を返す', () => {
    expect(checkBasicAuth(encodeBasic('admin', 'wrong'))).toBe(false)
  })

  it('ユーザー名が違う場合 false を返す', () => {
    expect(checkBasicAuth(encodeBasic('wrong', 'p@ss:w0rd'))).toBe(false)
  })

  it('ユーザー名・パスワード両方が違う場合 false を返す', () => {
    expect(checkBasicAuth(encodeBasic('wrong', 'wrong'))).toBe(false)
  })

  it('null の場合 false を返す', () => {
    expect(checkBasicAuth(null)).toBe(false)
  })

  it('"Basic " プレフィックスがない場合 false を返す', () => {
    expect(checkBasicAuth('Bearer sometoken')).toBe(false)
  })

  it('不正な base64 の場合 false を返す', () => {
    expect(checkBasicAuth('Basic !!invalid!!')).toBe(false)
  })

  it('コロンがない（user:pass 形式でない）場合 false を返す', () => {
    const noColon = `Basic ${Buffer.from('nocolon').toString('base64')}`
    expect(checkBasicAuth(noColon)).toBe(false)
  })

  it('パスワードにコロンが含まれる場合でも正しく検証できる（最初の : で分割）', () => {
    // "admin:p@ss:w0rd" → user="admin", password="p@ss:w0rd" → モックと一致 → true
    expect(checkBasicAuth(encodeBasic('admin', 'p@ss:w0rd'))).toBe(true)
    // user が違えば false
    expect(checkBasicAuth(encodeBasic('admin', 'p@ss:WRONG'))).toBe(false)
  })
})
