import { describe, expect, it } from "vitest";
// テスト実行環境はNodeだが、本番バンドルへ不要な@types/nodeは追加しない。
// @ts-expect-error Node組み込み型を開発依存へ持ち込まないため、この検査だけ型解決を省く。
import { readFileSync } from "node:fs";
import pageHtml from "../../index.html?raw";
import mainSource from "../main.ts?raw";
import introSource from "../scenes/intro.ts?raw";
import portalTimelineSource from "../scenes/portalTransitionTimeline.ts?raw";
import studioMascotSource from "../scenes/studioMascot.ts?raw";
import studioSource from "../scenes/studio.ts?raw";
import integratedScrubSource from "../scenes/integratedVideoScrub.ts?raw";
import worksFlightSource from "../scenes/worksFlight.ts?raw";

const mainStyles = readFileSync(
  new URL("../styles/main.css", import.meta.url),
  "utf8",
);
const worksFlightStyles = mainStyles.slice(
  mainStyles.indexOf("/* ---------- システム完成→飛行→制作実績 ---------- */"),
  mainStyles.indexOf(
    "/* ---------- 通常セクション",
    mainStyles.indexOf(
      "/* ---------- システム完成→飛行→制作実績 ---------- */",
    ),
  ),
);

describe("ページ共通UI", () => {
  it("ヘッダーだけをポートフォリオ名とお問い合わせ表記へ統一する", () => {
    expect(pageHtml).toContain("TSUBASA's PORTFOLIO");
    expect(pageHtml).not.toContain("T.KITAOKA.AI");
    expect(pageHtml).toMatch(
      /class="site-header__cta" href="#contact">お問い合わせ<\/a>/,
    );
    expect(pageHtml).toContain("お問い合わせはこちら →");
  });

  it("SVG faviconを明示する", () => {
    expect(pageHtml).toContain('rel="icon"');
    expect(pageHtml).toContain('href="/favicon.svg"');
  });

  it("CSS読み込み前も初期余白を持たず、ファーストビューをずらさない", () => {
    expect(pageHtml).toMatch(
      /<style>[\s\S]*?html,\s*body\s*\{[\s\S]*?margin:\s*0/,
    );
    expect(pageHtml).toMatch(
      /<style>[\s\S]*?\.scene-intro\s*\{[\s\S]*?height:\s*900vh/,
    );
    expect(pageHtml).toMatch(
      /\.portal-scrub-video\s*\{[\s\S]*?position:\s*absolute/,
    );
    expect(pageHtml).toMatch(
      /\.site-header,[\s\S]*?\.progress-bar\s*\{[\s\S]*?position:\s*fixed/,
    );
  });

  it("モバイル用メニューボタンとナビゲーションを持つ", () => {
    expect(pageHtml).toContain('aria-controls="mobile-navigation"');
    expect(pageHtml).toContain('aria-label="メニュー"');
    expect(pageHtml).toContain('id="mobile-navigation"');
    expect(mainStyles).toMatch(
      /@media \(max-width: 360px\)[\s\S]*?\.site-header__menu-label\s*\{[\s\S]*?display:\s*none/,
    );
  });

  it("ヒアリング導線にシーン内の着地進捗を指定する", () => {
    expect(pageHtml).toMatch(/href="#studio"[^>]+data-scene-progress="0\.08"/);
  });

  it("実績導線は制作実績カードが並ぶ地点へ着地する", () => {
    // #works の先頭は飛行前(studioの完成と重なる境界)なので、
    // カードが見える進捗を指定しないと「プロセス」に着地してしまう。
    const worksLinks = [
      ...pageHtml.matchAll(/href="#works"[\s\S]*?data-scene-link="works"/g),
    ];
    expect(worksLinks).toHaveLength(2); // PC・モバイル
    expect(
      pageHtml.match(/href="#works"[\s\S]*?data-scene-progress="0\.82"/g),
    ).toHaveLength(2);
  });

  it("リロードで前回のスクロール位置を復元しない", () => {
    // 復元されるとスクラブ演出の途中から始まって固まって見える
    expect(mainSource).toContain('window.history.scrollRestoration = "manual"');
    expect(mainSource).toContain("applyInitialScroll");
    // ScrollTriggerは登録時点のscrollRestorationを取り込み後で書き戻すため、
    // manualへの切り替えはプラグイン登録より前に済ませる必要がある
    expect(
      mainSource.indexOf('window.history.scrollRestoration = "manual"'),
    ).toBeLessThan(mainSource.indexOf("gsap.registerPlugin(ScrollTrigger)"));
    // リロード時の先頭戻しはアセット読込を待たずに行う(ブラウザ復元との競合回避)
    expect(mainSource.indexOf("applyEarlyTopReset()")).toBeLessThan(
      mainSource.indexOf("await Promise.all"),
    );
  });

  it("静的表示でもStudioをヒアリングシーンとして識別できる", () => {
    expect(pageHtml).toMatch(
      /class="scene-studio js-studio"[^>]+data-static-scene="hearing"/,
    );
  });
});

describe("モーション低減表示", () => {
  it("OS設定に応じて静的表示クラスを有効化する", () => {
    expect(mainSource).toContain('"(prefers-reduced-motion: reduce)"');
    expect(mainSource).toContain('classList.toggle("reduced-motion"');
  });

  it("モーション低減時は動画のcanplayを待たず静的UIを有効化する", () => {
    const staticBranch = mainSource.indexOf(
      "// モーション低減時は透過動画を読み込まず、静止マスコットと実績DOMを表示",
    );
    const videoPreparation = mainSource.indexOf("await Promise.all");
    expect(staticBranch).toBeGreaterThan(-1);
    expect(staticBranch).toBeLessThan(videoPreparation);
  });

  it("静止Heroとローディング文字の常時アニメーションも停止する", () => {
    expect(mainStyles).toContain("body.reduced-motion .portal-scrub-video");
    expect(mainStyles).toContain("body.reduced-motion .loading__text");
    expect(mainStyles).toMatch(/animation:\s*none\s*!important/);
    expect(mainStyles).toMatch(
      /body\.reduced-motion \.hero-idle-mascot[\s\S]*?animation:\s*none\s*!important/,
    );
  });

  it("静的ヒアリングでは共通マスコット・吹き出し・チャット全文を表示する", () => {
    expect(mainStyles).toContain("body.reduced-motion .studio-mascot-position");
    expect(mainStyles).toContain('body.reduced-motion [data-view="hearing"]');
    expect(mainStyles).toContain("body.reduced-motion .chat__bubble");
    expect(mainStyles).toMatch(
      /body\.reduced-motion \.studio-mascot-speech[\s\S]*?filter:\s*none\s*!important/,
    );
    expect(mainStyles).toMatch(
      /body\.reduced-motion \.studio-mascot-idle[\s\S]*?transform:\s*none\s*!important/,
    );
  });
});

describe("Hero・追加動画・ヒアリング統合契約", () => {
  it("透過待機マスコットを高品質な背景プレート上で動かし、短いスクロール区間で動画へ渡す", () => {
    expect(pageHtml).toContain(
      'href="/assets/hero/hero-mascot-idle-alpha.png"',
    );
    expect(pageHtml).toContain('src="/assets/hero/hero-idle-background.png"');
    expect(pageHtml).toMatch(
      /class="hero-idle-mascot js-hero-idle-mascot"[\s\S]*?hero-idle-mascot__shadow[\s\S]*?hero-idle-mascot__jump[\s\S]*?hero-idle-mascot__image/,
    );
    expect(pageHtml).not.toContain("hero-idle-mascot__arm");
    expect(pageHtml).toContain("js-hero-detail-layer");
    expect(introSource).toContain('".js-hero-idle-mascot"');
    expect(introSource).toContain('".js-hero-idle-background"');
    expect(portalTimelineSource).toContain("heroIdleHandoffEnd");
    expect(mainStyles).toContain("@keyframes hero-idle-jump");
    expect(mainStyles).toContain("@keyframes hero-idle-shadow");
  });

  it("動画右下のVeo表記を世界観に沿う常設オーバーレイで覆う", () => {
    expect(pageHtml).toContain("portal-video-watermark-cover");
    expect(mainStyles).toMatch(
      /\.portal-video-watermark-cover[\s\S]*?right:\s*0[\s\S]*?bottom:\s*0/,
    );
  });

  it("自動再生しない2本のスクラブ動画を同じカメラ内に持つ", () => {
    expect(
      pageHtml.match(/<video[\s\S]*?class="[^"]*js-scrub-video/g),
    ).toHaveLength(2);
    expect(pageHtml.match(/<video[\s\S]*?\smuted(?:\s|>)/g)).toHaveLength(3);
    expect(pageHtml.match(/<video[\s\S]*?\splaysinline(?:\s|>)/g)).toHaveLength(
      3,
    );
    expect(pageHtml.match(/preload="auto"/g)).toHaveLength(3);
    expect(
      pageHtml.match(/<video[\s\S]*?width="1280"[\s\S]*?height="720"/g),
    ).toHaveLength(3);
    expect(pageHtml).toContain(
      'poster="/assets/portal-tunnel/mascot-portal-tunnel-poster.jpg"',
    );
    expect(pageHtml).toContain(
      'poster="/assets/portal-arrival/mascot-tunnel-coding-poster.jpg"',
    );
    expect(pageHtml).toMatch(
      /rel="preload"[\s\S]*?as="image"[\s\S]*?href="\/assets\/portal-tunnel\/mascot-portal-tunnel-poster\.jpg"/,
    );
    expect(pageHtml).toContain(
      'data-src="/assets/portal-tunnel/mascot-portal-tunnel-scroll.mp4"',
    );
    expect(pageHtml).toContain(
      'data-src="/assets/portal-arrival/mascot-tunnel-coding-scroll.mp4"',
    );
    expect(pageHtml).not.toMatch(/<source[^>]*\ssrc="/);
    expect(mainSource).toContain("await Promise.all");
    expect(pageHtml).not.toMatch(/<video[^>]*\sautoplay(?:\s|>)/);
    expect(pageHtml).not.toMatch(/<video[^>]*\sloop(?:\s|>)/);
    expect(pageHtml).not.toContain("data-portal-frame");
    expect(pageHtml).not.toMatch(/href="\/assets\/portal-tunnel\/[1-5]\.png"/);
  });

  it("二動画を同じ補間クロックで制御し、前景演出を接続中も継続する", () => {
    expect(pageHtml).toContain("js-portal-camera");
    expect(pageHtml).toContain("js-portal-tunnel-canvas");
    expect(pageHtml).toContain("js-portal-glow");
    expect(pageHtml).toContain("js-portal-flash");
    expect(pageHtml).toContain("portal-video-vignette");
    expect(pageHtml).toContain("portal-video-grain");
    expect(pageHtml).toContain("js-portal-next-preview");
    expect(introSource).toContain("IntegratedVideoScrubber");
    expect(integratedScrubSource).toContain("integratedVideoTimesAt");
    expect(introSource).toContain("setProgress");
    expect(introSource).not.toContain(".play(");
  });

  it("予告・静止レイヤー・ヒアリングを同じ補間進捗で制御する", () => {
    expect(introSource).toContain("visualProgress: () => visualProgress");
    expect(mainSource).toContain("worksFlight.progress");
    expect(portalTimelineSource).toContain("videoBridgeEnd");
    expect(portalTimelineSource).toContain("additionalVideoEnd");
    expect(portalTimelineSource).toContain("previewStart");
    expect(studioSource).toContain("endTrigger");
    expect(studioSource).toContain("studioPreludeStart");
    expect(mainSource).toContain("TRANSITION_CONFIG.desktopLengthVh");
    expect(mainSource).toContain("TRANSITION_CONFIG.mobileLengthVh");
    expect(introSource).toContain(
      "if (visualProgress < TRANSITION_CONFIG.heroJourneyEnd)",
    );
    expect(mainSource).toContain(
      "intro.visualProgress() < TRANSITION_CONFIG.studioPreludeStart",
    );
    expect(mainSource).toContain("studio.progress() <= 0 &&");
    expect(mainSource).toContain(
      "if (studio && studio.progress() > 0) return;",
    );
    expect(introSource).toMatch(
      /onUpdate: \(progress, times\) => \{[\s\S]*?onUpdate\?\.\(\);[\s\S]*?onDecodedFrame:/,
    );
  });

  it("透過済みマスコット1体を4工程共通の分離ラッパーで管理する", () => {
    expect(pageHtml.match(/data-arrival-layer=/g)).toHaveLength(1);
    expect(pageHtml.match(/data-studio-mascot/g)).toHaveLength(1);
    expect(pageHtml).toContain("/assets/portal-arrival/1-1-alpha.png");
    for (let index = 2; index <= 7; index += 1) {
      expect(pageHtml).not.toContain(
        `/assets/portal-arrival/1-${index}-alpha.png`,
      );
    }
    expect(pageHtml).not.toContain("/assets/portal-arrival/1-8-background.png");
    expect(pageHtml).not.toContain("見本.png");
    expect(mainSource).toContain("arrivalImages.length !== 1");
    expect(mainSource).toContain("arrivalLayerOpacityAt");
    expect(pageHtml).toMatch(
      /class="studio-mascot-position js-studio-mascot-position"[\s\S]*?class="studio-mascot-idle js-studio-mascot-idle"[\s\S]*?class="studio-mascot-reaction js-studio-mascot-reaction"[\s\S]*?class="studio-mascot-sway js-studio-mascot-sway"[\s\S]*?class="studio-mascot-breathe js-studio-mascot-breathe"[\s\S]*?data-arrival-layer="mascot"/,
    );
    expect(mainSource).toContain("arrivalMascotPosition.style.transform");
    expect(mainSource).toContain(
      "applyMascotHandoff(beforeStudio ? handoffMorph : 1)",
    );
    expect(mainSource).toMatch(/const introOpacity =\s*beforeStudio\s*\?/);
    expect(mainSource).not.toContain("arrivalMascot.style.transform");
    expect(mainSource).not.toContain("studioDeparture");
    expect(mainStyles).toMatch(/\.studio-mascot-position[\s\S]*?z-index:\s*70/);
    expect(mainStyles).toMatch(/\.studio-mockup-entry[\s\S]*?z-index:\s*60/);
  });

  it("共通吹き出しを1個だけ持ち、idle・reaction・speechを別timelineで破棄する", () => {
    expect(
      pageHtml.match(/class="studio-mascot-speech js-studio-mascot-speech"/g),
    ).toHaveLength(1);
    expect(pageHtml.match(/class="js-studio-speech-text"/g)).toHaveLength(1);
    expect(pageHtml).toContain("お話を聞かせてください！");
    expect(studioMascotSource).toContain("mascotIdleTimeline");
    expect(studioMascotSource).toContain("speechBubbleTimeline");
    expect(studioMascotSource).toContain("mascotReactionTimeline");
    expect(studioMascotSource).toContain("timeline.kill()");
    expect(studioSource).toContain("onLeave: () => mascot.setVisible(true)");
    expect(studioSource).toContain("setMascotVisible");
    expect(studioSource).toContain(
      "onEnterBack: () => mascot.setVisible(true)",
    );
  });

  it("Studioコピーを前面の共通レイヤーへまとめ、PCを4:6配置にする", () => {
    expect(pageHtml).toMatch(
      /class="studio-copy-entry js-studio-copy-entry"[\s\S]*?data-copy="hearing"[\s\S]*?data-copy="requirements"[\s\S]*?data-copy="workflow"[\s\S]*?data-copy="build"/,
    );
    expect(mainStyles).toMatch(/\.studio-copy-entry[\s\S]*?z-index:\s*80/);
    // 右端の補助ナビを廃止したぶん、テキスト側を広げてモックアップを右へ寄せた
    expect(mainStyles).toMatch(
      /\.scene-studio \.stage[\s\S]*?--studio-split:\s*43vw/,
    );
    expect(mainStyles).toMatch(
      /\.macbook[\s\S]*?left:\s*calc\(var\(--studio-split\) \+ 1\.5vw\)/,
    );
    // モックアップの右端はヘッダーのパディングと同じラインで止める
    // (整形でmin()が複数行になることがあるため空白は緩く見る)
    expect(mainStyles).toMatch(
      /\.macbook[\s\S]*?width:\s*min\(\s*760px,[\s\S]*?clamp\(\s*16px,\s*3vw,\s*40px\s*\)/,
    );
    expect(mainStyles).toMatch(
      /\.scene-studio \.scene-copy__text[\s\S]*?max-width:\s*500px/,
    );
  });

  it("Heroコピーをヘッダー下の実表示領域で中央配置する", () => {
    expect(mainStyles).toMatch(
      /\.scene-intro \.scene-copy\s*\{[\s\S]*?top:\s*var\(--header-height\)[\s\S]*?bottom:\s*0[\s\S]*?min-height:\s*calc\(100svh - var\(--header-height\)\)[\s\S]*?display:\s*flex[\s\S]*?justify-content:\s*center/,
    );
  });

  it("4工程共通タイトルを1個だけ持ち、最終見出しを構築・完成へ合わせる", () => {
    expect(pageHtml.match(/AI導入までのフロー/g)).toHaveLength(1);
    expect(pageHtml).toContain("js-studio-flow-title");
    // 見出しから句読点を外し、4工程で表記を揃えている
    expect(pageHtml).toContain("システムを構築し完成");
    expect(pageHtml).not.toContain("完成したシステムが、動き出す。");
    expect(mainStyles).toMatch(
      /\.studio-flow-title\s*\{[\s\S]*?position:\s*absolute[\s\S]*?z-index:\s*85/,
    );
  });

  it("吹き出しをマスコット横へ置き、右側の尻尾で案内役を指す", () => {
    expect(mainStyles).toMatch(
      /\.studio-mascot-speech-gate\s*\{[\s\S]*?right:\s*calc\(100% \+ 14px\)[\s\S]*?bottom:\s*30%/,
    );
    expect(mainStyles).toMatch(
      /\.studio-mascot-speech::after\s*\{[\s\S]*?right:\s*-12px[\s\S]*?top:\s*50%[\s\S]*?clip-path:\s*polygon\(0 0, 0 100%, 100% 50%\)/,
    );
  });

  it("『AI導入の、裏側へ。』は説明ブロックを伴わない動画内オーバーレイにする", () => {
    expect(pageHtml).not.toContain('data-copy="tunnel"');
    expect(pageHtml).toMatch(
      /class="portal-next-preview js-portal-next-preview"[\s\S]*?<h2[^>]*>AI導入の、裏側へ。<\/h2>/,
    );
    expect(mainStyles).toMatch(
      /\.portal-next-preview\s*\{[\s\S]*?inset:\s*0[\s\S]*?place-items:\s*center[\s\S]*?text-align:\s*center/,
    );
  });

  it("モバイルでは被写体を優先しつつ、チャット全文と説明文の可読域を確保する", () => {
    expect(mainStyles).toMatch(
      /@media \(max-width: 820px\)[\s\S]*?\.portal-scrub-video\s*\{[\s\S]*?object-position:\s*83% 50%/,
    );
    expect(mainStyles).toMatch(
      /@media \(max-width: 820px\)[\s\S]*?\.studio-mascot-position\s*\{[\s\S]*?right:\s*16px[\s\S]*?bottom:\s*20px[\s\S]*?width:\s*clamp\(80px, 26vw, 116px\)/,
    );
    expect(mainStyles).toMatch(
      /@media \(max-width: 820px\)[\s\S]*?\.studio-mascot-speech[\s\S]*?max-width:\s*min\(220px, calc\(100vw - var\(--guide-mascot-width\) - 52px\)\)/,
    );
    expect(mainStyles).toMatch(
      /@media \(max-width: 820px\)[\s\S]*?\.chat__bubble\s*\{[\s\S]*?font-size:\s*clamp\(8px, 2\.2vw, 10px\)/,
    );
  });

  it("Studioの4工程で同じマスコット制御を使い、予告文を一箇所だけ保持する", () => {
    expect(studioSource).toContain("initStudioMascot");
    expect(studioSource).toContain("studioPresentationAt");
    expect(pageHtml.match(/data-studio-mascot/g)).toHaveLength(1);
    expect(pageHtml.match(/AI導入の、裏側へ。/g)).toHaveLength(1);
  });

  it("旧キーフレーム画像をHTMLとCSSのどちらからも読み込まない", () => {
    expect(pageHtml).not.toMatch(/portal-tunnel\/[1-5]\.png/);
    expect(mainStyles).not.toMatch(/portal-tunnel\/[1-5]\.png/);
  });

  it("bfcache復帰では破棄せずScrollTriggerを再計測する", () => {
    expect(mainSource).toContain("if (!event.persisted) cleanup();");
    expect(mainSource).toContain('window.addEventListener("pageshow"');
    expect(mainSource).toContain("ScrollTrigger.refresh();");
  });
});

describe("システム完成から制作実績への飛行遷移", () => {
  it("背景を含まない無音の透過マスコット動画だけをスクラブする", () => {
    expect(
      pageHtml.match(/<video[\s\S]*?class="[^"]*js-scrub-video/g),
    ).toHaveLength(2);
    expect(
      pageHtml.match(/class="[^"]*js-works-flight-mascot-video[^"]*"/g),
    ).toHaveLength(1);
    expect(pageHtml).toMatch(
      /<video[\s\S]*?class="[^"]*js-works-flight-mascot-video[^"]*"[\s\S]*?muted[\s\S]*?playsinline[\s\S]*?preload="auto"/,
    );
    expect(pageHtml).toContain(
      'data-src="/assets/works-flight/mascot-achievements-alpha.webm"',
    );
    expect(pageHtml).not.toMatch(
      /<video[^>]*js-works-flight-mascot-video[^>]*(?:autoplay|loop)/,
    );
    expect(pageHtml).toMatch(
      /class="works-flight-landing-mascot js-works-flight-landing-mascot"[\s\S]*?src="\/assets\/portal-arrival\/1-1-alpha\.png"/,
    );
    expect(pageHtml).not.toContain("js-works-flight-takeoff-frame");
    expect(pageHtml).not.toContain("js-works-flight-landing-frame");
  });

  it("既存デザインの通過用4枚と、2枚ずつの制作実績1・2を別レイヤーで管理する", () => {
    // 最終レイヤーのカードは詳細ページへのリンク(a)、通過用はarticleのまま。
    // タグや属性の並びは整形で変わるため、クラス名の出現数で数える。
    expect(pageHtml.match(/js-works-flight-pass-card/g)).toHaveLength(4);
    expect(pageHtml.match(/js-works-flight-card /g)).toHaveLength(4);
    expect(pageHtml.match(/class="work-card[ "]/g)).toHaveLength(8);
    expect(
      pageHtml.match(/works-flight-pass-card[\s\S]*?work-card__thumb--[a-d]/g),
    ).toHaveLength(4);
    expect(pageHtml).not.toContain("AI AUTOMATION");
    expect(pageHtml).not.toContain("RAG SEARCH");
    expect(
      pageHtml.match(
        /<h2 class="works-flight-copy__title"[^>]*>\s*制作実績 01\s*<\/h2>/g,
      ),
    ).toHaveLength(1);
    expect(
      pageHtml.match(
        /<h2 class="works-flight-copy__title"[^>]*>\s*制作実績 02\s*<\/h2>/g,
      ),
    ).toHaveLength(1);
    expect(pageHtml.match(/data-works-page="one"/g)).toHaveLength(1);
    expect(pageHtml.match(/data-works-page="two"/g)).toHaveLength(1);
    const firstGroup = pageHtml.match(
      /data-works-page="one"[\s\S]*?<\/div>\s*<div[^>]+data-works-page="two"/,
    )?.[0];
    const secondGroup = pageHtml.match(
      /data-works-page="two"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/section>/,
    )?.[0];
    expect(firstGroup?.match(/js-works-flight-card/g)).toHaveLength(2);
    expect(secondGroup?.match(/js-works-flight-card/g)).toHaveLength(2);
    expect(pageHtml).toContain("js-works-flight-pass-layer");
    expect(pageHtml).toContain("js-works-flight-final-layer");
    expect(worksFlightSource).toContain("worksPageStateAt");
    expect(worksFlightSource).toContain("worksTwoLift");
  });

  it("旧紫トンネルを制作実績遷移だけから除去し、Heroトンネルは残す", () => {
    for (const source of [
      pageHtml,
      mainSource,
      mainStyles,
      worksFlightSource,
    ]) {
      expect(source).not.toContain("scene-works-tunnel");
      expect(source).not.toContain("WorksTunnel");
      expect(source).not.toContain("TunnelRenderer");
    }
    expect(pageHtml).toContain("js-portal-tunnel-canvas");
    expect(introSource).toContain("PortalTunnelCanvas");
  });

  it("GSAP区間から目標だけを渡し、rAF補間と破棄処理を行う", () => {
    expect(worksFlightSource).toContain("PortalVideoScrubber");
    expect(worksFlightSource).toContain("worksFlightVideoTimeAt");
    expect(worksFlightSource).toContain("scrubber.setProgress");
    expect(worksFlightSource).toContain("scrubber.setActive");
    expect(worksFlightSource).toContain("scrubber.destroy");
    expect(worksFlightSource).toContain("trigger.kill");
    // フォーマッタの改行位置に依存しないよう、呼び出しの意図だけを検証する
    expect(worksFlightSource).toMatch(
      /worksFlightVideoTimeAt\(\s*0,\s*mascotVideo\.duration/,
    );
    expect(worksFlightSource).not.toContain(".play(");
  });

  it("固定100svh・十分な距離・指定レイヤー順で構成する", () => {
    expect(mainStyles).toMatch(
      /\.scene-works-flight\s*\{[\s\S]*?height:\s*var\(--works-flight-length\)/,
    );
    expect(mainStyles).toMatch(
      /\.works-flight-stage\s*\{[\s\S]*?position:\s*sticky[\s\S]*?height:\s*100svh/,
    );
    expect(mainStyles).toMatch(/\.works-flight-effects[\s\S]*?z-index:\s*8/);
    expect(mainStyles).toMatch(
      /\.works-flight-mascot-layer[\s\S]*?z-index:\s*25/,
    );
    expect(mainStyles).toMatch(
      /\.works-flight-pass-layer\s*\{[\s\S]*?z-index:\s*20[\s\S]*?width:\s*100vw[\s\S]*?height:\s*100svh/,
    );
    expect(mainStyles).toMatch(
      /\.works-flight-final-layer[\s\S]*?z-index:\s*24/,
    );
    expect(mainStyles).toMatch(/\.works-flight-copy[\s\S]*?z-index:\s*30/);
    expect(mainStyles).toMatch(
      /\.works-flight-cards\s*\{[\s\S]*?left:\s*50%[\s\S]*?width:\s*min\(80vw, 1160px\)[\s\S]*?transform:\s*translateX\(-50%\)/,
    );
    expect(mainStyles).toContain(
      "--guide-mascot-width: clamp(90px, 8vw, 140px)",
    );
    expect(mainStyles).toMatch(
      /\.studio-mascot-position\s*\{[\s\S]*?width:\s*var\(--guide-mascot-width\)/,
    );
    expect(mainStyles).toMatch(
      /\.works-flight-landing-mascot\s*\{[\s\S]*?width:\s*var\(--guide-mascot-width\)/,
    );
    expect(worksFlightStyles).not.toContain("clip-path");
    expect(worksFlightStyles).not.toContain("mask-image");
    expect(worksFlightSource).not.toContain("style.clipPath");
    expect(worksFlightSource).not.toContain("maskImage");
    expect(worksFlightSource).not.toContain("clampMaskRadius");
    expect(worksFlightSource).toContain("quadraticBezierPoint");
    expect(worksFlightSource).toContain("passCardStateAt");
    expect(worksFlightSource).toContain("finalCardStateAt");
  });

  it("通常セクションは共通の暖色ダーク背景へ溶かし、境界線を作らない", () => {
    expect(mainStyles).toMatch(
      /main\s*\{[\s\S]*?radial-gradient[\s\S]*?linear-gradient/,
    );
    expect(mainStyles).toMatch(
      /\.section\s*\{[\s\S]*?background:\s*transparent/,
    );
    expect(mainStyles).toMatch(/\.section::before[\s\S]*?filter:\s*blur/);
  });

  it("放射線を主線・補助線・高速ストリーク・粒子へ分け、マスコットへ追従させる", () => {
    expect(pageHtml).toContain("works-flight-effects__rays--main");
    expect(pageHtml).toContain("works-flight-effects__rays--detail");
    expect(pageHtml).toContain("works-flight-effects__streaks");
    expect(pageHtml).toContain("works-flight-effects__particles");
    expect(mainStyles).toContain("--ray-origin-x");
    expect(mainStyles).toContain("--ray-origin-y");
    expect(mainStyles).toContain("--ray-intensity");
    expect(worksFlightSource).toContain('"--ray-origin-x"');
    expect(worksFlightSource).toContain('"--ray-origin-y"');
    expect(worksFlightStyles).not.toContain("clip-path");
    expect(worksFlightStyles).not.toContain("mask-image");
  });

  it("共通カラーをオレンジ・アンバー・ゴールドの階層へ統一する", () => {
    for (const token of [
      "--color-bg-primary: #09090d",
      "--color-bg-secondary: #121015",
      "--color-bg-warm: #1b110d",
      "--color-accent-orange: #ff7a1a",
      "--color-accent-amber: #ff9d3d",
      "--color-accent-gold: #ffc267",
      "--color-accent-coral: #ff6542",
      "--color-text-primary: #fff8ef",
      "--color-text-secondary: #cbbeb1",
      "--color-border-warm: rgba(255, 145, 64, 0.28)",
    ]) {
      expect(mainStyles).toContain(token);
    }
    expect(mainStyles).not.toContain("#7c6cf0");
    expect(mainStyles).not.toContain("#46e6ff");
  });

  it("飛び立ちと着地の座標を各stage内のローカル座標で測る", () => {
    expect(worksFlightSource).toContain('".js-studio-stage"');
    expect(worksFlightSource).toContain("elementBoxWithin");
    expect(worksFlightSource).toContain("studioStage");
    expect(worksFlightSource).not.toContain(
      "subjectInElement(studioMascotRect, stageRect",
    );
  });

  it("モーション低減時は動画を読み込まず単体マスコットと4枚を通常表示する", () => {
    const staticBranch = mainSource.indexOf(
      "// モーション低減時は透過動画を読み込まず、静止マスコットと実績DOMを表示",
    );
    const worksMediaPreparation = mainSource.indexOf(
      "preparePortalVideo(worksFlightVideo",
    );
    expect(staticBranch).toBeGreaterThan(-1);
    expect(worksMediaPreparation).toBeGreaterThan(staticBranch);
    expect(mainStyles).toMatch(
      /body\.reduced-motion \.scene-works-flight[\s\S]*?height:\s*auto/,
    );
    expect(mainStyles).toMatch(
      /body\.reduced-motion \.works-flight-stage[\s\S]*?position:\s*relative/,
    );
    expect(mainStyles).toMatch(
      /body\.reduced-motion \.works-flight-mascot-video[\s\S]*?display:\s*none/,
    );
    expect(mainStyles).toMatch(
      /body\.reduced-motion \.works-flight-pass-layer[\s\S]*?display:\s*none/,
    );
    expect(mainStyles).toMatch(
      /body\.reduced-motion \.works-flight-landing-mascot[\s\S]*?display:\s*block/,
    );
    expect(mainStyles).toMatch(
      /body\.reduced-motion \[data-works-page="two"\][\s\S]*?display:\s*grid/,
    );
  });
});

describe("制作実績後の通常セクション", () => {
  it("作品カードは2枚表示に適した大きさと16:9サムネイルを持つ", () => {
    expect(mainStyles).toMatch(
      /\.works-flight-cards \.work-card\s*\{[\s\S]*?min-height:\s*clamp\(340px, 51svh, 430px\)/,
    );
    expect(mainStyles).toMatch(
      /\.works-flight-cards \.work-card__thumb\s*\{[\s\S]*?width:\s*100%[\s\S]*?aspect-ratio:\s*16 \/ 9[\s\S]*?height:\s*auto/,
    );
  });

  it("プロフィール文言を変更し、短いsticky滞在を背景境界なしで作る", () => {
    expect(pageHtml).toContain("ABOUT &amp; PROFILE");
    expect(pageHtml).toContain("使われ続ける仕組みに変換する");
    expect(pageHtml).not.toContain("SKILLS &amp; PROFILE");
    expect(pageHtml).not.toContain("スキルと経歴");
    expect(mainStyles).toMatch(
      /\.section--skills\s*\{[\s\S]*?min-height:\s*160svh[\s\S]*?border-top:\s*0[\s\S]*?box-shadow:\s*none/,
    );
    expect(mainStyles).toMatch(
      /\.section--skills \.section__inner\s*\{[\s\S]*?position:\s*sticky[\s\S]*?top:\s*0[\s\S]*?min-height:\s*100svh/,
    );
  });

  it("コンタクトの背景を末尾からはみ出さず、1画面で本文とfooterを収める", () => {
    expect(mainStyles).toMatch(
      /\.section--contact\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-rows:\s*1fr auto[\s\S]*?min-height:\s*100svh/,
    );
    expect(mainStyles).toMatch(
      /\.section--contact::before\s*\{[\s\S]*?bottom:\s*0/,
    );
    expect(mainStyles).toMatch(
      /\.section--contact \.footer\s*\{[\s\S]*?margin-top:\s*0/,
    );
  });
});
