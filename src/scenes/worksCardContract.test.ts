import { describe, expect, it } from "vitest";
import pageHtml from "../../index.html?raw";

/**
 * 実績カードは通過レイヤーと最終レイヤーに同じ内容が二重に書かれている。
 * 飛行中に手前を通り過ぎるカードが、着地後にグリッドへ整列する演出のため、
 * 同一のカードとして認識される必要がある。
 * サムネイル修飾子（--a 〜 --d）を対応キーとして内容の一致を検証する。
 */

interface WorkCard {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly chips: readonly string[];
}

/** HTMLの改行・インデントを取り除き、表示上のテキストへ揃える。 */
const normalize = (html: string): string =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

const parseCards = (source: string): WorkCard[] => {
  const cards: WorkCard[] = [];
  // 最終レイヤーのカードは詳細ページへのリンクなので article と a の両方を拾う
  for (const card of source.matchAll(
    /<(article|a)\b[\s\S]*?class="[^"]*work-card[^"]*"[\s\S]*?<\/\1>/g,
  )) {
    const html = card[0];
    const key = html.match(/work-card__thumb--([a-z])/)?.[1];
    const title = html.match(/<h3>([\s\S]*?)<\/h3>/)?.[1];
    const body = html.match(/<p>([\s\S]*?)<\/p>/)?.[1];
    if (!key || !title || !body) continue;
    cards.push({
      key,
      title: normalize(title),
      body: normalize(body),
      chips: [...html.matchAll(/<span class="chip">([\s\S]*?)<\/span/g)].map(
        (chip) => normalize(chip[1]),
      ),
    });
  }
  return cards;
};

const sliceLayer = (startMarker: string, endMarker: string): string => {
  const start = pageHtml.indexOf(startMarker);
  const end = pageHtml.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw new Error(`レイヤー ${startMarker} が見つかりません`);
  }
  return pageHtml.slice(start, end);
};

const passCards = parseCards(
  sliceLayer("works-flight-pass-layer", "works-flight-final-layer"),
);
const finalCards = parseCards(
  sliceLayer("works-flight-final-layer", "</main>"),
);

describe("実績カードの二重定義", () => {
  it("通過レイヤーと最終レイヤーが同じ枚数を持つ", () => {
    expect(passCards).toHaveLength(4);
    expect(finalCards).toHaveLength(4);
  });

  it("サムネイル修飾子が重複なく a〜d を網羅する", () => {
    expect(passCards.map((card) => card.key)).toEqual(["a", "b", "c", "d"]);
    expect(finalCards.map((card) => card.key)).toEqual(["a", "b", "c", "d"]);
  });

  it.each(["a", "b", "c", "d"])(
    "カード%sの内容が通過レイヤーと最終レイヤーで一致する",
    (key) => {
      const pass = passCards.find((card) => card.key === key);
      const final = finalCards.find((card) => card.key === key);
      expect(pass).toBeDefined();
      expect(final).toBeDefined();
      expect(pass!.title).toBe(final!.title);
      expect(pass!.body).toBe(final!.body);
      expect(pass!.chips).toEqual(final!.chips);
    },
  );
});
