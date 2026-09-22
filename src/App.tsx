import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronRight, Hexagon } from "lucide-react";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260729_102822_0e6c87e8-c141-4744-bf32-ad30db296371.mp4";

const PORTRAIT_URL =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260728_050334_5b076e26-0ce7-4898-b432-d764190e448f.png&w=1280&q=85";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

function Reveal({ children, delay = 0, className = "" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties = {
    transitionDelay: `${delay}ms`,
  };

  return (
    <div
      ref={ref}
      style={style}
      className={[
        "will-change-transform transition-all duration-700 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function coverDraw(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  canvasWidth: number,
  canvasHeight: number
) {
  const scale = Math.max(canvasWidth / sourceWidth, canvasHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (canvasWidth - drawWidth) / 2;
  const y = (canvasHeight - drawHeight) / 2;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.drawImage(source, x, y, drawWidth, drawHeight);
}

function ScrollVideo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visibleVideoRef = useRef<HTMLVideoElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);

  const [videoFrameReady, setVideoFrameReady] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  const framesRef = useRef<ImageBitmap[]>([]);
  const dimensionsRef = useRef({ width: 1920, height: 1080 });
  const progressRef = useRef(0);
  const smoothRef = useRef(0);
  const cacheReadyRef = useRef(false);
  const videoFrameReadyRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const video = visibleVideoRef.current;
    const canvas = canvasRef.current;
    const poster = posterRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let extractionStarted = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(window.innerWidth * dpr));
      const height = Math.max(1, Math.floor(window.innerHeight * dpr));
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      draw();
    };

    const updateProgress = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      progressRef.current = Math.min(1, Math.max(0, window.scrollY / max));
    };

    const draw = () => {
      const target = progressRef.current;
      smoothRef.current += (target - smoothRef.current) * 0.12;

      const progress = smoothRef.current;

      if (cacheReadyRef.current && framesRef.current.length) {
        const index = Math.min(
          framesRef.current.length - 1,
          Math.round(progress * (framesRef.current.length - 1))
        );
        const frame = framesRef.current[index];
        if (frame) {
          coverDraw(
            ctx,
            frame,
            dimensionsRef.current.width,
            dimensionsRef.current.height,
            canvas.width,
            canvas.height
          );
        }
      } else if (videoFrameReadyRef.current && Number.isFinite(video.duration) && video.duration > 0) {
        const targetTime = progress * Math.max(0, video.duration - 0.05);
        if (Math.abs(video.currentTime - targetTime) > 0.04) {
          video.currentTime = targetTime;
        }
        if (video.videoWidth && video.videoHeight) {
          coverDraw(
            ctx,
            video,
            video.videoWidth,
            video.videoHeight,
            canvas.width,
            canvas.height
          );
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    const markVideoReady = () => {
      if (disposed) return;
      videoFrameReadyRef.current = true;
      setVideoFrameReady(true);
      if (poster) poster.style.opacity = "0";
      video.style.opacity = "1";
      window.setTimeout(() => {
        if (!disposed) void extractFrames();
      }, 300);
    };

    const extractFrames = async () => {
      if (extractionStarted || disposed || !video.duration || !video.videoWidth) return;
      extractionStarted = true;

      const duration = video.duration;
      const count = Math.min(90, Math.max(24, Math.floor(duration * 12)));
      const scale = Math.min(1, 960 / video.videoWidth);
      const width = Math.max(1, Math.floor(video.videoWidth * scale));
      const height = Math.max(1, Math.floor(video.videoHeight * scale));
      dimensionsRef.current = { width, height };

      const offscreen = document.createElement("video");
      offscreen.src = VIDEO_URL;
      offscreen.muted = true;
      offscreen.playsInline = true;
      offscreen.preload = "auto";
      offscreen.crossOrigin = "anonymous";

      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(
            () => reject(new Error("Frame extraction timed out")),
            20000
          );
          offscreen.onloadedmetadata = () => {
            window.clearTimeout(timeout);
            resolve();
          };
          offscreen.onerror = () => {
            window.clearTimeout(timeout);
            reject(new Error("Frame extraction failed"));
          };
          offscreen.load();
        });

        const workCanvas = document.createElement("canvas");
        workCanvas.width = width;
        workCanvas.height = height;
        const workCtx = workCanvas.getContext("2d");
        if (!workCtx) throw new Error("No canvas context");

        const frames: ImageBitmap[] = [];

        for (let i = 0; i < count; i += 1) {
          if (disposed) return;

          const time = (i / (count - 1)) * Math.max(0, duration - 0.05);
          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              offscreen.removeEventListener("seeked", onSeeked);
              resolve();
            };
            offscreen.addEventListener("seeked", onSeeked, { once: true });
            offscreen.currentTime = time;
          });

          workCtx.clearRect(0, 0, width, height);
          workCtx.drawImage(offscreen, 0, 0, width, height);

          try {
            const bitmap = await createImageBitmap(workCanvas);
            frames.push(bitmap);
          } catch {
            // If ImageBitmap is unavailable, fallback seeking remains active.
            framesRef.current = [];
            return;
          }
        }

        if (!disposed && frames.length) {
          framesRef.current = frames;
          cacheReadyRef.current = true;
          setCacheReady(true);
        }
      } catch {
        // The visible video seeking path is the intentional fallback.
      } finally {
        offscreen.src = "";
      }
    };

    const onLoadedData = () => markVideoReady();
    const onScroll = () => updateProgress();

    video.addEventListener("loadeddata", onLoadedData);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });

    resize();
    updateProgress();
    if (video.readyState >= 2) markVideoReady();

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      video.removeEventListener("loadeddata", onLoadedData);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      framesRef.current.forEach((frame) => frame.close());
      framesRef.current = [];
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = visibleVideoRef.current;
    if (!canvas || !video) return;

    if (cacheReady) {
      canvas.style.opacity = "1";
      video.style.opacity = "0";
    } else if (videoFrameReady) {
      canvas.style.opacity = "1";
      video.style.opacity = "1";
    }
  }, [cacheReady, videoFrameReady]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#0a0a0a]">
      <img
        ref={posterRef}
        src="/hero-poster.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-100 transition-opacity duration-500"
        onError={(event) => {
          event.currentTarget.style.opacity = "0";
        }}
      />
      <video
        ref={visibleVideoRef}
        className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500"
        muted
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        src={VIDEO_URL}
      />
      <canvas
        ref={canvasRef}
        className={[
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
          cacheReady ? "opacity-100" : videoFrameReady ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />
      <div className="absolute inset-0 bg-black/5" />
    </div>
  );
}

function Navbar() {
  const links = [
    { label: "Projects", count: "6" },
    { label: "About" },
    { label: "Blog" },
    { label: "Contact" },
  ];

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/15 bg-black/5 backdrop-blur-[2px]">
      <div className="mx-auto flex h-16 items-center justify-between px-5 sm:h-[72px] sm:px-8 md:px-12">
        <Reveal delay={0} className="shrink-0">
          <a href="#" className="flex items-center gap-2 text-white">
            <Hexagon size={24} strokeWidth={1.5} />
            <span className="text-lg font-medium tracking-tight sm:text-xl">novaai</span>
          </a>
        </Reveal>

        <nav className="hidden items-center gap-8 md:flex lg:gap-10">
          {links.map((link, i) => (
            <Reveal key={link.label} delay={100 + i * 100}>
              <a
                href="#"
                className="text-sm text-white/85 transition-colors duration-300 hover:text-white"
              >
                {link.label}
                {link.count && (
                  <sup className="ml-1 font-mono text-[10px] text-white/60">{link.count}</sup>
                )}
              </a>
            </Reveal>
          ))}
        </nav>

        <Reveal delay={500}>
          <a
            href="#contact"
            className="rounded-md border border-white/20 bg-white/15 px-4 py-2 text-xs text-white backdrop-blur-md transition-colors duration-300 hover:bg-white/25 sm:px-5 sm:text-sm"
          >
            Get Free Consultation
          </a>
        </Reveal>
      </div>
    </header>
  );
}

function GlassBadge({ children, delay }: { children: ReactNode; delay: number }) {
  return (
    <Reveal delay={delay}>
      <div className="inline-flex border-l-2 border-white bg-white/15 px-3 py-1.5 backdrop-blur-md">
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-white">
          {children}
        </span>
      </div>
    </Reveal>
  );
}

function SectionOne() {
  const services = ["AI AUTOMATION", "AI INTEGRATION", "AI AGENT DEVELOPMENT"];

  return (
    <section className="relative flex min-h-screen flex-col justify-between px-5 pb-12 pt-24 sm:px-8 sm:pt-28 md:px-12 md:pb-16 supports-[height:100svh]:min-h-[100svh]">
      <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-2">
          {services.map((service, i) => (
            <Reveal key={service} delay={150 + i * 120}>
              <div className="font-mono text-xs uppercase tracking-[0.15em] text-white/90 drop-shadow-md">
                / {service}
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={300} className="max-w-xs sm:text-right">
          <p className="text-lg leading-relaxed text-white drop-shadow-md sm:text-xl">
            We design automation that brings clarity, precision, and efficiency to the way your
            company operates.
          </p>
        </Reveal>
      </div>

      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <GlassBadge delay={150}>We Automate 100+ Businesses</GlassBadge>

          <Reveal delay={280} className="mt-5">
            <h1 className="text-5xl font-normal leading-[1.05] tracking-tight text-white drop-shadow-lg sm:text-6xl lg:text-7xl">
              Clear. Precise.
              <br />
              Automated.
            </h1>
          </Reveal>
        </div>

        <Reveal delay={420}>
          <div className="flex items-center gap-4 rounded-xl bg-white/15 p-3 backdrop-blur-md">
            <img
              src={PORTRAIT_URL}
              alt="Mitha, co-founder of NovaAI"
              className="h-24 w-20 rounded-lg object-cover"
            />
            <div className="flex flex-col gap-1.5 pr-2">
              <div className="text-sm font-medium text-white">Talk with Mitha</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/60">
                Co-founder of NovaAI
              </div>
              <a
                href="#contact"
                className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-white px-4 py-2 text-xs font-medium text-black transition-colors duration-300 hover:bg-white/85"
              >
                Book 15-mins call
                <ChevronRight size={14} />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const capabilities = [
  {
    index: "01",
    title: "Real-time vision",
    body: "Reads context as it happens and surfaces what matters before you ask.",
  },
  {
    index: "02",
    title: "Layered insight",
    body: "Moves from rough outline to sharp output without losing the thread.",
  },
  {
    index: "03",
    title: "Adaptive speed",
    body: "Learns your cadence and tightens every pass as you work.",
  },
];

function CapabilityRow({
  index,
  title,
  body,
  delay,
}: {
  index: string;
  title: string;
  body: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <div className="group flex gap-5 border-b border-white/15 py-5 last:border-b-0">
        <span className="font-mono text-[11px] tracking-[0.15em] text-white/55">{index}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-base font-medium text-white sm:text-lg">
            <span>{title}</span>
            <ChevronRight
              size={16}
              className="text-white/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-white"
            />
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-white/70">{body}</p>
        </div>
      </div>
    </Reveal>
  );
}

function SectionTwo() {
  return (
    <section
      id="contact"
      className="relative flex min-h-screen flex-col justify-between px-5 pb-12 pt-24 sm:px-8 sm:pt-28 md:px-12 md:pb-16 supports-[height:100svh]:min-h-[100svh]"
    >
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <GlassBadge delay={120}>Insight On Demand</GlassBadge>

        <Reveal delay={220} className="max-w-sm sm:text-right">
          <p className="text-lg leading-relaxed text-white drop-shadow-md sm:text-xl">
            Our AI doesn't just respond — it interprets, sharpens, and delivers the signal you
            need.
          </p>
        </Reveal>
      </div>

      <div className="flex flex-1 flex-col justify-end gap-12 md:flex-row md:items-end md:justify-between md:gap-16">
        <div className="max-w-xl">
          <Reveal delay={180}>
            <h2 className="text-5xl font-normal leading-[1.05] tracking-tight text-white drop-shadow-lg sm:text-6xl lg:text-7xl">
              Learn to see
              <br />
              brilliantly.
            </h2>
          </Reveal>

          <Reveal delay={320}>
            <p className="mt-6 max-w-md text-sm text-white/80 drop-shadow-md sm:text-base">
              From the first sketch to the final render, Nova turns raw intent into decisions your
              team can act on — quietly, precisely, at speed.
            </p>
          </Reveal>

          <Reveal delay={420}>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#demo"
                className="inline-flex items-center gap-1 rounded-full bg-white px-5 py-2.5 text-xs font-medium text-black transition-colors duration-300 hover:bg-white/85 sm:text-sm"
              >
                Run the demo
                <ChevronRight size={14} />
              </a>
              <a
                href="#contact"
                className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-xs text-white backdrop-blur-md transition-colors duration-300 hover:bg-white/20 sm:text-sm"
              >
                Free consultation
              </a>
            </div>
          </Reveal>
        </div>

        <div className="w-full max-w-md rounded-2xl border border-white/15 bg-white/10 px-5 backdrop-blur-md sm:px-6">
          {capabilities.map((item, i) => (
            <CapabilityRow key={item.index} {...item} delay={300 + i * 110} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#0a0a0a]">
      <ScrollVideo />
      <div className="relative z-10">
        <Navbar />
        <main>
          <SectionOne />
          <div className="h-[80vh]" aria-hidden="true" />
          <SectionTwo />
        </main>
      </div>
    </div>
  );
}