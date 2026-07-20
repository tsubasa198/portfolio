/**
 * 文字送りアニメーション(ionicのjs-ionText相当)のための文字分割。
 * Array.fromでコードポイント単位に分割し、絵文字などのサロゲートペアを壊さない。
 */
export function splitChars(text: string): string[] {
  return Array.from(text);
}

/** HTMLの可読性のために入れた改行・インデントを、文字送りへ混ぜないよう正規化する。 */
export function normalizeSplitText(text: string): string {
  return text.trim().replace(/\s+/gu, " ");
}
