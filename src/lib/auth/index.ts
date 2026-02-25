// 認証方式の差し替えはここだけを変更する
// 将来 Auth.js に移行する場合は basic.ts の代わりに authjs.ts を作成してここで差し替える
export { checkBasicAuth as checkAuth } from './basic'
