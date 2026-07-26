import { describe, expect, it } from "vitest";
import { IDLE_FRAME_INTERVAL_MS, TunnelRenderGate } from "./tunnelRenderGate";

describe("TunnelRenderGate", () => {
  it("初回は必ず描画を許可する", () => {
    const gate = new TunnelRenderGate();
    expect(gate.shouldRender(0, 1000)).toBe(true);
  });

  it("進捗が変わらない間はアイドル間隔まで描画を間引く", () => {
    const gate = new TunnelRenderGate();
    gate.shouldRender(0, 1000);
    expect(gate.shouldRender(0, 1000 + IDLE_FRAME_INTERVAL_MS / 2)).toBe(false);
  });

  it("進捗が変わらなくてもアイドル間隔が経過したら描画する", () => {
    const gate = new TunnelRenderGate();
    gate.shouldRender(0, 1000);
    expect(gate.shouldRender(0, 1000 + IDLE_FRAME_INTERVAL_MS)).toBe(true);
  });

  it("進捗が変わったら間隔に関係なく即座に描画する", () => {
    const gate = new TunnelRenderGate();
    gate.shouldRender(0.1, 1000);
    expect(gate.shouldRender(0.2, 1001)).toBe(true);
  });

  it("スクラブ停止後は再び30fps相当に戻る", () => {
    const gate = new TunnelRenderGate();
    gate.shouldRender(0.1, 1000);
    gate.shouldRender(0.2, 1008);
    expect(gate.shouldRender(0.2, 1016)).toBe(false);
    expect(gate.shouldRender(0.2, 1008 + IDLE_FRAME_INTERVAL_MS)).toBe(true);
  });

  it("不正な進捗値は安全側に倒して描画を許可する", () => {
    const gate = new TunnelRenderGate();
    gate.shouldRender(0, 1000);
    expect(gate.shouldRender(Number.NaN, 1001)).toBe(true);
  });

  it("時刻が巻き戻っても例外にせず描画を許可する", () => {
    const gate = new TunnelRenderGate();
    gate.shouldRender(0, 1000);
    expect(gate.shouldRender(0, 500)).toBe(true);
  });
});
