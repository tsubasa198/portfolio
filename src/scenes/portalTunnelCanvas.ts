import {
  TRANSITION_CONFIG,
  canvasProfileForViewport,
  transitionStateAt,
  type CanvasProfile,
} from "./portalTransitionConfig";

const FULL_CIRCLE = Math.PI * 2;

interface ParticleSeed {
  readonly angle: number;
  readonly depth: number;
  readonly size: number;
  readonly speed: number;
  readonly drift: number;
  readonly phase: number;
}

interface StreakSeed {
  readonly angle: number;
  readonly length: number;
  readonly phase: number;
  readonly width: number;
}

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 91.731 + salt * 17.113) * 43758.5453;
  return value - Math.floor(value);
}

function createParticles(count: number): ParticleSeed[] {
  return Array.from({ length: count }, (_, index) => ({
    angle: seededUnit(index, 1) * FULL_CIRCLE,
    depth: seededUnit(index, 2),
    size: 0.6 + seededUnit(index, 3) * 2.4,
    speed: 0.7 + seededUnit(index, 4) * 0.75,
    drift: (seededUnit(index, 5) - 0.5) * 0.16,
    phase: seededUnit(index, 6) * FULL_CIRCLE,
  }));
}

function createStreaks(count: number): StreakSeed[] {
  return Array.from({ length: count }, (_, index) => ({
    angle: seededUnit(index, 7) * FULL_CIRCLE,
    length: 0.08 + seededUnit(index, 8) * 0.22,
    phase: seededUnit(index, 9),
    width: 0.5 + seededUnit(index, 10) * 1.5,
  }));
}

/** 動画と別速度で動く、ポータル周辺とトンネル手前の前景レイヤー。 */
export class PortalTunnelCanvas {
  private readonly context: CanvasRenderingContext2D;
  private readonly particles = createParticles(
    TRANSITION_CONFIG.desktopParticleCount,
  );
  private readonly streaks = createStreaks(
    TRANSITION_CONFIG.desktopStreakCount,
  );
  private width = 1;
  private height = 1;
  private profile: CanvasProfile = canvasProfileForViewport(1, 1, false);

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("PortalTunnelCanvas: 2D描画を開始できません");
    this.context = context;
  }

  resize(
    width: number,
    height: number,
    devicePixelRatio: number,
    reducedMotion = false,
  ): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.profile = canvasProfileForViewport(
      this.width,
      devicePixelRatio,
      reducedMotion,
    );
    this.canvas.width = Math.round(this.width * this.profile.dpr);
    this.canvas.height = Math.round(this.height * this.profile.dpr);
  }

  render(progress: number, timeMs: number): void {
    const ctx = this.context;
    const state = transitionStateAt(progress);
    ctx.setTransform(this.profile.dpr, 0, 0, this.profile.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    if (this.profile.particleCount === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (progress < TRANSITION_CONFIG.portalEntryEnd) {
      this.drawPortalOrbit(
        ctx,
        state.portalCenterX,
        state.portalIntensity,
        timeMs,
      );
    }

    if (progress >= TRANSITION_CONFIG.portalFlashPeak) {
      const tunnelFade = Math.min(
        1,
        (progress - TRANSITION_CONFIG.portalFlashPeak) /
          (TRANSITION_CONFIG.portalEntryEnd - TRANSITION_CONFIG.portalFlashPeak),
      );
      ctx.globalAlpha = tunnelFade * state.foregroundIntensity;
      this.drawConvergingRings(ctx, state.tunnelDepth, state.tunnelSpeed, timeMs);
      this.drawConvergingParticles(
        ctx,
        state.tunnelDepth,
        state.tunnelSpeed,
        timeMs,
      );
      this.drawPassingStreaks(ctx, state.tunnelDepth, state.tunnelSpeed, timeMs);
    }
    ctx.restore();
  }

  clear(): void {
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawPortalOrbit(
    ctx: CanvasRenderingContext2D,
    centerPercent: number,
    intensity: number,
    timeMs: number,
  ): void {
    const mobile = this.width <= TRANSITION_CONFIG.mobileBreakpoint;
    const cx = (centerPercent / 100) * this.width;
    const cy = this.height * (mobile ? 0.55 : 0.49);
    const baseRadius = Math.min(this.width, this.height) * (mobile ? 0.25 : 0.18);
    const pulse = 1 + Math.sin(timeMs * 0.0017) * 0.025;

    for (let index = 0; index < 3; index += 1) {
      const ringScale = pulse * (0.9 + index * 0.11);
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy,
        baseRadius * ringScale,
        baseRadius * ringScale * 1.48,
        Math.sin(timeMs * 0.0002 + index) * 0.012,
        0,
        FULL_CIRCLE,
      );
      ctx.strokeStyle = `rgba(255, ${166 + index * 18}, ${76 + index * 15}, ${intensity * (0.13 - index * 0.025)})`;
      ctx.lineWidth = 0.8 + (2 - index) * 0.55;
      ctx.shadowBlur = 9 + intensity * 12;
      ctx.shadowColor = "rgba(255, 141, 45, 0.72)";
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    for (const [index, particle] of this.particles
      .slice(0, this.profile.particleCount)
      .entries()) {
      const angle =
        particle.angle + timeMs * 0.000045 * particle.speed + particle.drift;
      const orbit = baseRadius * (0.7 + particle.depth * 1.85);
      const x = cx + Math.cos(angle) * orbit;
      const y = cy + Math.sin(angle) * orbit * 0.7;
      const flicker = 0.4 + Math.sin(timeMs * 0.002 + particle.phase) * 0.22;
      ctx.beginPath();
      ctx.arc(x, y, particle.size, 0, FULL_CIRCLE);
      ctx.fillStyle = `rgba(255, ${168 + (index % 4) * 13}, 100, ${intensity * flicker})`;
      ctx.fill();
    }
  }

  private drawConvergingRings(
    ctx: CanvasRenderingContext2D,
    depth: number,
    speed: number,
    timeMs: number,
  ): void {
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const maxRadius = Math.hypot(this.width, this.height) * 0.62;
    const flow = timeMs * 0.000035 * speed + depth * 1.4;

    for (let index = 0; index < this.profile.ringCount; index += 1) {
      const phase = (index / this.profile.ringCount + flow) % 1;
      const inward = 1 - phase;
      const radius = 16 + Math.pow(inward, 1.65) * maxRadius;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(timeMs * 0.000018 * (index % 2 === 0 ? 1 : -1));
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * 0.59, 0, 0, FULL_CIRCLE);
      ctx.strokeStyle = `rgba(255, ${154 + Math.round(phase * 70)}, 82, ${0.035 + inward * 0.12})`;
      ctx.lineWidth = 0.55 + inward * 1.4;
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawConvergingParticles(
    ctx: CanvasRenderingContext2D,
    depth: number,
    speed: number,
    timeMs: number,
  ): void {
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const maxRadius = Math.hypot(this.width, this.height) * 0.68;
    const flow = timeMs * 0.00008 * speed + depth * 1.75;

    for (const particle of this.particles.slice(0, this.profile.particleCount)) {
      const phase = (particle.depth + flow * particle.speed) % 1;
      const inward = 1 - phase;
      const radius = 8 + Math.pow(inward, 1.55) * maxRadius;
      const angle =
        particle.angle +
        Math.sin(timeMs * 0.00025 + particle.phase) * 0.035;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius * 0.62;
      const size = particle.size * (0.35 + inward * 1.8);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, FULL_CIRCLE);
      ctx.fillStyle = `rgba(255, ${168 + Math.round(phase * 62)}, 112, ${0.14 + inward * 0.46})`;
      ctx.fill();
    }
  }

  private drawPassingStreaks(
    ctx: CanvasRenderingContext2D,
    depth: number,
    speed: number,
    timeMs: number,
  ): void {
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const maxRadius = Math.hypot(this.width, this.height) * 0.68;
    const flow = timeMs * 0.00015 * speed + depth * 2.3;

    for (const streak of this.streaks.slice(0, this.profile.streakCount)) {
      const phase = (streak.phase + flow) % 1;
      const outward = phase * phase;
      const startRadius = 12 + outward * maxRadius * 0.74;
      const endRadius =
        startRadius + maxRadius * streak.length * (0.25 + phase);
      const angle =
        streak.angle + Math.sin(timeMs * 0.00045 + streak.phase * 10) * 0.015;
      const startX = cx + Math.cos(angle) * startRadius;
      const startY = cy + Math.sin(angle) * startRadius * 0.62;
      const endX = cx + Math.cos(angle) * endRadius;
      const endY = cy + Math.sin(angle) * endRadius * 0.62;
      const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
      gradient.addColorStop(0, "rgba(255, 153, 62, 0)");
      gradient.addColorStop(
        1,
        `rgba(255, 224, 174, ${0.12 + phase * 0.44})`,
      );
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = streak.width * (0.45 + phase * 1.65);
      ctx.stroke();
    }
  }
}
