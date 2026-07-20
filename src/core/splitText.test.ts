import { describe, expect, it } from "vitest";
import { normalizeSplitText, splitChars } from "./splitText";

describe("splitChars", () => {
  it("日本語の文字列を1文字ずつに分割する", () => {
    expect(splitChars("握る手に")).toEqual(["握", "る", "手", "に"]);
  });

  it("半角スペースは保持する(文字送りで語間が詰まらないように)", () => {
    expect(splitChars("AI Engineer")).toEqual([
      "A",
      "I",
      " ",
      "E",
      "n",
      "g",
      "i",
      "n",
      "e",
      "e",
      "r",
    ]);
  });

  it("空文字列は空配列を返す", () => {
    expect(splitChars("")).toEqual([]);
  });

  it("サロゲートペア(絵文字等)を壊さない", () => {
    expect(splitChars("AI🚀")).toEqual(["A", "I", "🚀"]);
  });
});

describe("normalizeSplitText", () => {
  it("HTML整形用の改行とインデントを除去する", () => {
    expect(normalizeSplitText("\n    要件定義書に、落とし込む。\n  ")).toBe(
      "要件定義書に、落とし込む。",
    );
  });

  it("単語間の連続空白は1文字へまとめる", () => {
    expect(normalizeSplitText("AI   Engineer")).toBe("AI Engineer");
  });
});
