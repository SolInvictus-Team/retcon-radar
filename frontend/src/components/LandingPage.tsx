/**
 * frontend/src/components/LandingPage.tsx
 * Complete redesign for RETCON-RADAR landing page.
 * High-craft, writer-focused, finished product presentation.
 * Features GSAP ScrollTrigger for pinned scroll storytelling,
 * interactive SVG CanonGraphVisual, bento features grid with 3D card tilt,
 * word-by-word hero reveal, magnetic button physics, and custom desktop cursor glow.
 */

import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Radar,
  ArrowRight,
  AlertTriangle,
  BookOpen,
  GitBranch,
  Layers,
  History,
  ShieldCheck,
  Menu,
  X,
  Clapperboard,
  Gamepad2,
  PenTool,
  CheckCircle2,
} from "lucide-react";
import { CanonGraphVisual } from "./CanonGraphVisual";

// Register ScrollTrigger plugin with GSAP
gsap.registerPlugin(ScrollTrigger);

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  // Navigation scroll state & progress bar
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeNavSection, setActiveNavSection] = useState("hero");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Desktop custom cursor glow position
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [isDesktop, setIsDesktop] = useState(true);

  // Hero headline intro animation trigger
  const [isIntroComplete, setIsIntroComplete] = useState(false);

  // Hero 12-second typing and graph build sequence
  const [heroStage, setHeroStage] = useState(0); // 0..4
  const [heroTypedText, setHeroTypedText] = useState("");
  const [heroShowUnderline, setHeroShowUnderline] = useState(false);
  const [heroShowConflictCard, setHeroShowConflictCard] = useState(false);

  // Pinned storytelling section ref & beat indicator
  const pinnedSectionRef = useRef<HTMLDivElement>(null);
  const pinnedTriggerRef = useRef<HTMLDivElement>(null);
  const [pinnedBeat, setPinnedBeat] = useState(1); // 1, 2, or 3

  // Magnetic hover state for primary buttons
  const [magnetPosDemo, setMagnetPosDemo] = useState({ x: 0, y: 0 });
  const [magnetPosCta, setMagnetPosCta] = useState({ x: 0, y: 0 });

  // Hero mouse parallax for subtle background dot grid
  const [dotGridParallax, setDotGridParallax] = useState({ x: 0, y: 0 });

  // Navigation helpers
  const handleTryDemo = () => {
    navigate("/app?demo=true");
  };

  const handleOpenApp = () => {
    navigate("/app");
  };

  // Check desktop vs mobile viewport & listen to window resize
  useEffect(() => {
    const checkWidth = () => {
      setIsDesktop(window.innerWidth >= 900);
    };
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  // Desktop custom soft cursor glow & dot grid parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
      const xNorm = (e.clientX / window.innerWidth - 0.5) * 20;
      const yNorm = (e.clientY / window.innerHeight - 0.5) * 20;
      setDotGridParallax({ x: xNorm, y: yNorm });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Scroll tracking for progress bar, nav shrink/shadow, and active section
  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = window.scrollY;
      setIsScrolled(currentScroll > 20);
      if (totalScroll > 0) {
        setScrollProgress((currentScroll / totalScroll) * 100);
      }

      // Track active section
      const sections = ["hero", "problem", "how-it-works", "features", "built-for"];
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200 && rect.bottom >= 200) {
            setActiveNavSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Intro page load trigger: 600ms intro
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsIntroComplete(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Hero 12-second synchronized sequence:
  // 0-2.5s: Kabir node pops in, typing begins
  // 2.5-5s: Injury node pops in, typing continues
  // 5-7.5s: Sniper rifle node pops in, typing completes
  // 7.5-9s: Rule node pops in, red wavy underline draws under "right shoulder"
  // 9-11.5s: Conflict card slides in, contradiction edge pulses
  // 11.5-12s: Short reset and loop repeats
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fullSentence = "He raised the sniper rifle with his right shoulder and took steady aim.";

    if (prefersReducedMotion) {
      setHeroTypedText(fullSentence);
      setHeroShowUnderline(true);
      setHeroShowConflictCard(true);
      setHeroStage(4);
      return;
    }

    let isMounted = true;
    let mainLoopTimeout: any;

    const runHeroLoop = () => {
      if (!isMounted) return;

      // Reset state
      setHeroStage(0);
      setHeroTypedText("");
      setHeroShowUnderline(false);
      setHeroShowConflictCard(false);

      // Typing animation
      let charIdx = 0;
      const typeInterval = setInterval(() => {
        if (!isMounted) return;
        if (charIdx <= fullSentence.length) {
          setHeroTypedText(fullSentence.slice(0, charIdx));
          charIdx++;
        } else {
          clearInterval(typeInterval);
        }
      }, 42);

      // Stage 1: Injury node (at 2.5s)
      const t1 = setTimeout(() => {
        if (isMounted) setHeroStage(1);
      }, 2400);

      // Stage 2: Sniper rifle node (at 5.0s)
      const t2 = setTimeout(() => {
        if (isMounted) setHeroStage(2);
      }, 4800);

      // Stage 3: Rule node & underline (at 7.2s)
      const t3 = setTimeout(() => {
        if (isMounted) {
          setHeroStage(3);
          setHeroShowUnderline(true);
        }
      }, 7200);

      // Stage 4: Contradiction edge & conflict card slide-in (at 8.8s)
      const t4 = setTimeout(() => {
        if (isMounted) {
          setHeroStage(4);
          setHeroShowConflictCard(true);
        }
      }, 8800);

      // Loop restart at 12s
      mainLoopTimeout = setTimeout(() => {
        clearInterval(typeInterval);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        if (isMounted) runHeroLoop();
      }, 12500);
    };

    runHeroLoop();
    return () => {
      isMounted = false;
      clearTimeout(mainLoopTimeout);
    };
  }, []);

  // GSAP ScrollTrigger for pinned scroll storytelling section ("The problem")
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || !isDesktop) return;

    const triggerEl = pinnedTriggerRef.current;
    const sectionEl = pinnedSectionRef.current;
    if (!triggerEl || !sectionEl) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: triggerEl,
        start: "top top",
        end: "+=200%",
        pin: sectionEl,
        scrub: 0.6,
        onUpdate: (self) => {
          const progress = self.progress;
          if (progress < 0.33) {
            setPinnedBeat(1);
          } else if (progress < 0.66) {
            setPinnedBeat(2);
          } else {
            setPinnedBeat(3);
          }
        },
      });
    });

    return () => ctx.revert();
  }, [isDesktop]);

  // Magnetic button hover handler
  const handleMagnetMove = (
    e: React.MouseEvent<HTMLButtonElement>,
    setter: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.28;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.28;
    setter({ x, y });
  };

  const handleMagnetLeave = (
    setter: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  ) => {
    setter({ x: 0, y: 0 });
  };

  // 3D Card Tilt Handler for Features Bento Grid
  const handleCardTilt = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    const glow = card.querySelector<HTMLElement>(".card-cursor-glow");
    if (glow) {
      glow.style.transform = `translate(${x - 80}px, ${y - 80}px)`;
      glow.style.opacity = "1";
    }
  };

  const handleCardLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)`;
    const glow = card.querySelector<HTMLElement>(".card-cursor-glow");
    if (glow) glow.style.opacity = "0";
  };

  const headlineWords = [
    "Catch",
    "continuity",
    "slips",
    "before",
    "your",
    "readers",
    "do.",
  ];

  return (
    <div className="min-h-screen bg-radar-bg text-ink font-serif selection:bg-accent/15 selection:text-ink relative overflow-x-hidden">
      {/* Desktop Custom Soft Cursor Glow (follows mouse, desktop only) */}
      {isDesktop && (
        <div
          className="fixed w-64 h-64 rounded-full pointer-events-none z-30 transition-opacity duration-300"
          style={{
            transform: `translate3d(${cursorPos.x - 128}px, ${cursorPos.y - 128}px, 0)`,
            background:
              "radial-gradient(circle, rgba(42, 69, 89, 0.045) 0%, rgba(42, 69, 89, 0) 70%)",
          }}
          aria-hidden="true"
        />
      )}

      {/* Top Scroll Progress Bar */}
      <div
        className="fixed top-0 left-0 h-[3px] bg-accent z-50 transition-[width] duration-75 ease-out"
        style={{ width: `${scrollProgress}%` }}
        role="progressbar"
        aria-valuenow={Math.round(scrollProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Page scroll progress"
      />

      {/* ============================================================ */}
      {/* 1. STICKY GLASS NAV                                           */}
      {/* ============================================================ */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 border-b ${
          isScrolled
            ? "glass-panel bg-white/80 backdrop-blur-md border-white/90 shadow-glass py-2.5"
            : "bg-white/45 backdrop-blur-sm border-white/60 py-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8 flex items-center justify-between">
          {/* Logo & Intro Scaling */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-control p-1"
          >
            <div
              className={`w-9 h-9 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-accent shadow-sm transition-all duration-500 ${
                isIntroComplete ? "scale-100 opacity-100" : "scale-75 opacity-0"
              }`}
            >
              <Radar className="w-4.5 h-4.5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-medium text-lg tracking-tight text-ink">
                  RETCON-RADAR
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted font-sans border border-black/10 px-1.5 py-0.5 rounded-control bg-white/60">
                  v1.0
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Nav Links (18px, active section highlight, finished product) */}
          <nav className="hidden md:flex items-center gap-8 text-[18px] font-serif italic text-muted">
            <a
              href="#how-it-works"
              className={`transition-colors py-1 px-1.5 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                activeNavSection === "how-it-works"
                  ? "text-accent font-medium not-italic"
                  : "hover:text-accent"
              }`}
            >
              How it works
            </a>
            <a
              href="#features"
              className={`transition-colors py-1 px-1.5 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                activeNavSection === "features"
                  ? "text-accent font-medium not-italic"
                  : "hover:text-accent"
              }`}
            >
              Features
            </a>
            <a
              href="#built-for"
              className={`transition-colors py-1 px-1.5 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                activeNavSection === "built-for"
                  ? "text-accent font-medium not-italic"
                  : "hover:text-accent"
              }`}
            >
              Built for
            </a>
          </nav>

          {/* Action Button & Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenApp}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-control text-sm font-serif font-medium transition-all shadow-sm hover:-translate-y-0.5 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Open app
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-control hover:bg-black/5 text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden px-6 py-4 border-t border-black/5 bg-white/95 backdrop-blur-md flex flex-col gap-3 text-base font-serif italic animate-in slide-in-from-top-2 duration-150">
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 text-muted hover:text-accent transition-colors"
            >
              How it works
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 text-muted hover:text-accent transition-colors"
            >
              Features
            </a>
            <a
              href="#built-for"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 text-muted hover:text-accent transition-colors"
            >
              Built for
            </a>
          </div>
        )}
      </header>

      {/* ============================================================ */}
      {/* 2. HERO (BIG AND DRAMATIC)                                    */}
      {/* ============================================================ */}
      <section
        id="hero"
        className="relative pt-16 pb-20 md:pt-24 md:pb-28 px-6 hero-mesh-bg overflow-hidden"
      >
        {/* Faint dot grid that parallax-shifts with cursor */}
        <div
          className="absolute inset-0 pointer-events-none select-none graph-grid-bg opacity-40 transition-transform duration-300 ease-out"
          style={{
            transform: `translate3d(${dotGridParallax.x}px, ${dotGridParallax.y}px, 0)`,
          }}
          aria-hidden="true"
        />

        <div className="max-w-6xl mx-auto text-center relative z-10 space-y-7">
          {/* Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-control border border-white/90 text-xs font-serif italic text-muted shadow-sm">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span>Deterministic Story Continuity Linter for Serialized Fiction</span>
          </div>

          {/* Huge Headline: clamp(56px, 7vw, 104px), Word-by-Word Slide Up from Mask */}
          <h1 className="text-[clamp(48px,6.8vw,104px)] font-medium text-ink tracking-tight leading-[1.05] max-w-5xl mx-auto">
            {headlineWords.map((word, idx) => {
              return (
                <React.Fragment key={idx}>
                  <span className="inline-block overflow-hidden pb-2 align-top relative">
                    <span
                      className={`inline-block transition-transform duration-700 ease-out ${
                        isIntroComplete ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
                      }`}
                      style={{ transitionDelay: `${idx * 80}ms` }}
                    >
                      {word}
                    </span>

                    {/* Red-pen wavy underline that draws itself under "continuity slips" */}
                    {word === "slips" && (
                      <span className="absolute left-[-115%] right-0 bottom-0 h-4 pointer-events-none overflow-visible">
                        <svg
                          viewBox="0 0 160 16"
                          className="w-full h-full overflow-visible"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M2 10 Q 15 4, 30 10 T 60 10 T 90 10 T 120 10 T 150 10"
                            stroke="#b8402f"
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            className="animate-draw-wavy"
                          />
                        </svg>
                      </span>
                    )}
                  </span>
                  {" "}
                </React.Fragment>
              );
            })}
          </h1>

          {/* Subtitle 22px */}
          <p className="text-[20px] sm:text-[22px] text-muted font-serif italic max-w-2xl mx-auto leading-relaxed">
            A continuity checker for TV, novel and game writers. It reads your story, builds its
            canon, and flags what contradicts it.
          </p>

          {/* Two Big Buttons (56px high, 18px text) */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleTryDemo}
              onMouseMove={(e) => handleMagnetMove(e, setMagnetPosDemo)}
              onMouseLeave={() => handleMagnetLeave(setMagnetPosDemo)}
              style={{
                transform: `translate3d(${magnetPosDemo.x}px, ${magnetPosDemo.y}px, 0)`,
                transition: "transform 150ms ease-out",
              }}
              className="w-full sm:w-auto h-14 px-8 bg-accent hover:bg-accent-hover text-white rounded-control text-[18px] font-serif font-medium transition-colors shadow-md flex items-center justify-center gap-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
            >
              <span>Try the demo</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <a
              href="#how-it-works"
              className="w-full sm:w-auto h-14 px-8 glass-control hover:bg-white text-ink border border-white/90 rounded-control text-[18px] font-serif font-medium transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 hover:-translate-y-0.5"
            >
              <span>See how it works</span>
            </a>
          </div>

          {/* ONE LARGE HERO STAGE (1100px wide, split in two, NEVER overlapping headline) */}
          <div className="pt-8 max-w-[1100px] w-full mx-auto text-left">
            <div className="glass-panel bg-white/90 rounded-[22px] border border-white p-6 sm:p-8 shadow-sheet grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[440px]">
              {/* Left Column: Screenplay sheet typing itself */}
              <div className="lg:col-span-6 space-y-4">
                <div className="screenplay-sheet rounded-card p-6 border border-black/[0.08] relative">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/[0.06] text-xs font-serif text-muted">
                    <span className="font-mono uppercase tracking-wider text-[11px] text-muted/70">
                      SCENE 5: THE SNIPER'S PERCH — EXT. ROOFTOP — NIGHT
                    </span>
                    <span className="italic font-serif">p. 42</span>
                  </div>

                  <div className="font-mono text-sm sm:text-base leading-relaxed text-ink/90 min-h-[96px] space-y-3">
                    <p className="text-xs uppercase tracking-wider text-muted font-bold">KABIR</p>
                    <p>
                      {heroShowUnderline ? (
                        <>
                          He raised the sniper rifle with his{" "}
                          <span className="conflict-underline conflict-active inline-block">
                            right shoulder
                          </span>{" "}
                          and took steady aim.
                        </>
                      ) : (
                        <>
                          {heroTypedText}
                          <span className="inline-block w-2 h-4 bg-accent ml-0.5 align-middle animate-pulse" />
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Conflict card that slides in under sentence */}
                {heroShowConflictCard && (
                  <div className="p-4 glass-card bg-white/95 rounded-card border border-conflict/30 shadow-glass flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="p-1.5 rounded-full bg-conflict/10 text-conflict shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 flex-1 font-serif">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded bg-conflict/10 text-conflict">
                          INJURED_PART_HEAVY_USE
                        </span>
                        <span className="text-xs text-muted italic">Scene 5 conflict</span>
                      </div>
                      <p className="text-xs text-ink leading-snug">
                        Kabir's right shoulder holds a serious injury (severity 0.8) established in{" "}
                        <strong className="font-medium text-ink">Scene 2</strong>.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Live SVG Graph that builds itself */}
              <div className="lg:col-span-6 h-[340px] sm:h-[380px] rounded-card border border-white/80 bg-white/60 relative overflow-hidden flex items-center justify-center">
                <CanonGraphVisual stage={heroStage} draggable={true} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. SCROLL STORYTELLING (PINNED SECTION, "THE PROBLEM")        */}
      {/* ============================================================ */}
      <div ref={pinnedTriggerRef} id="problem" className="relative">
        <section
          ref={pinnedSectionRef}
          className="min-h-screen flex flex-col justify-center items-center px-6 py-20 relative overflow-hidden max-w-6xl mx-auto"
        >
          {/* Section Heading */}
          <div className="text-center space-y-3 mb-10">
            <span className="text-xs font-serif italic text-accent uppercase tracking-wider">
              The Continuity Trap
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium text-ink tracking-tight">
              A story's memory must outlast its drafting time.
            </h2>
          </div>

          {/* Storytelling Canvas with 3 Beats */}
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center relative min-h-[300px]">
            {/* Beat 1: Chapter 1 Sheet (Slides in & stays highlighted) */}
            <div
              className={`glass-card p-6 sm:p-7 rounded-[22px] border transition-all duration-500 shadow-sheet space-y-3 ${
                pinnedBeat >= 1
                  ? "opacity-100 translate-x-0 border-white"
                  : "opacity-40 -translate-x-6 border-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-control bg-accent/10 text-accent font-serif text-xs italic">
                  Chapter 1 (Established)
                </span>
                <span className="text-xs text-muted font-serif italic">Canon fact</span>
              </div>
              <div className="screenplay-sheet p-4 rounded-card font-mono text-xs sm:text-sm text-ink leading-relaxed">
                "Aarav's{" "}
                <span className="bg-[#f6dcd6] px-1 py-0.5 rounded text-[#b8402f] font-medium">
                  right hand is badly burned
                </span>{" "}
                in the electrical blast."
              </div>
              <p className="text-xs text-muted font-serif italic">
                Recorded: <span className="text-ink font-medium">Aarav.injury(right_hand, severity: 0.85)</span>
              </p>
            </div>

            {/* Connecting Red Dashed Line (Draws on Beat 3) */}
            <div
              className={`hidden md:flex absolute left-1/2 -translate-x-1/2 w-12 items-center justify-center transition-opacity duration-500 ${
                pinnedBeat >= 3 ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden="true"
            >
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path
                  d="M4 24H44M44 24L32 12M44 24L32 36"
                  stroke="#b8402f"
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                  className="animate-dash-flow"
                />
              </svg>
            </div>

            {/* Beat 2: Chapter 3 Sheet (Slides in with contradiction) */}
            <div
              className={`glass-card p-6 sm:p-7 rounded-[22px] border transition-all duration-500 shadow-sheet space-y-3 ${
                pinnedBeat >= 2
                  ? "opacity-100 translate-x-0 border-conflict/30"
                  : "opacity-20 translate-x-8 border-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-control bg-conflict/10 text-conflict font-serif text-xs italic font-medium">
                  Chapter 3 (Contradiction)
                </span>
                <span className="text-xs text-conflict font-serif italic font-medium">
                  Flagged by Sentinel
                </span>
              </div>
              <div className="screenplay-sheet p-4 rounded-card font-mono text-xs sm:text-sm text-ink leading-relaxed">
                "He gripped the rope tightly with his{" "}
                <span className={pinnedBeat >= 3 ? "conflict-underline conflict-active" : ""}>
                  right hand
                </span>
                ."
              </div>
              <p className="text-xs text-conflict font-serif italic">
                Rule breach: Severe burn forbids heavy gripping without healing interval.
              </p>
            </div>
          </div>

          {/* Beat 3 Big Takeaway Line */}
          <div
            className={`mt-12 text-center transition-all duration-700 ${
              pinnedBeat >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <p className="text-2xl sm:text-3xl md:text-4xl font-serif italic text-ink">
              "Readers never forget what writers do."
            </p>
          </div>

          {/* 3-Dot Beat Indicator on Desktop */}
          <div className="hidden lg:flex items-center gap-3 mt-8 text-xs font-serif italic text-muted">
            <span
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                pinnedBeat === 1 ? "bg-accent scale-125" : "bg-black/20"
              }`}
            />
            <span
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                pinnedBeat === 2 ? "bg-accent scale-125" : "bg-black/20"
              }`}
            />
            <span
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                pinnedBeat === 3 ? "bg-conflict scale-125" : "bg-black/20"
              }`}
            />
          </div>
        </section>
      </div>

      {/* ============================================================ */}
      {/* 4. HOW IT WORKS (SCROLL-SCRUBBED)                              */}
      {/* ============================================================ */}
      <section id="how-it-works" className="py-24 px-6 max-w-6xl mx-auto scroll-mt-20">
        <div className="text-center space-y-3 mb-16">
          <span className="text-xs font-serif italic text-accent uppercase tracking-wider">
            Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium text-ink tracking-tight">
            How RETCON-RADAR works
          </h2>
          <p className="text-base text-muted font-serif italic max-w-lg mx-auto">
            From raw prose to a verified entity canon graph in four deterministic steps.
          </p>
        </div>

        {/* 4 Large Steps in a row with connecting line and micro-animations */}
        <div className="relative">
          <div
            className="hidden lg:block absolute top-9 left-16 right-16 h-[1.5px] bg-black/10 z-0"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
            {/* Step 1 */}
            <div className="glass-card p-6 rounded-[22px] border border-white shadow-sheet flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-all duration-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
                    <BookOpen className="w-5 h-5" />
                  </span>
                  <span className="font-serif italic text-4xl text-muted/50 font-normal">01</span>
                </div>
                <h3 className="text-[24px] font-medium text-ink leading-tight">Write your story</h3>
                <p className="text-[17px] text-muted font-serif leading-relaxed">
                  Compose directly in the screenplay editor or paste chapters. Standard prose and
                  screenplay formatting are parsed immediately.
                </p>
              </div>
              {/* Micro-illustration */}
              <div className="p-3 bg-white/70 rounded-card border border-black/5 space-y-1.5 font-mono text-[11px] text-muted">
                <div className="w-3/4 h-2 bg-black/10 rounded animate-pulse" />
                <div className="w-full h-2 bg-black/10 rounded animate-pulse" />
                <div className="w-1/2 h-2 bg-accent/30 rounded" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="glass-card p-6 rounded-[22px] border border-white shadow-sheet flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-all duration-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
                    <PenTool className="w-5 h-5" />
                  </span>
                  <span className="font-serif italic text-4xl text-muted/50 font-normal">02</span>
                </div>
                <h3 className="text-[24px] font-medium text-ink leading-tight">Facts are extracted</h3>
                <p className="text-[17px] text-muted font-serif leading-relaxed">
                  Bodily injuries, carried items, character appearances, and location states are
                  extracted deterministically.
                </p>
              </div>
              {/* Micro-illustration: Extracted Chips */}
              <div className="p-3 bg-white/70 rounded-card border border-black/5 flex flex-wrap gap-1 text-[10px] font-sans">
                <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">Kabir</span>
                <span className="px-1.5 py-0.5 rounded bg-[#f6dcd6] text-[#b8402f] font-medium">Right Shoulder</span>
                <span className="px-1.5 py-0.5 rounded bg-[#f3e8cf] text-[#8c6d2c] font-medium">Sniper Rifle</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="glass-card p-6 rounded-[22px] border border-white shadow-sheet flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-all duration-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
                    <GitBranch className="w-5 h-5" />
                  </span>
                  <span className="font-serif italic text-4xl text-muted/50 font-normal">03</span>
                </div>
                <h3 className="text-[24px] font-medium text-ink leading-tight">Canon graph is built</h3>
                <p className="text-[17px] text-muted font-serif leading-relaxed">
                  An entity relationship network maps characters, inventory, injuries, and lore
                  invariants across chronological scenes.
                </p>
              </div>
              {/* Micro-illustration: Node connections */}
              <div className="p-3 bg-white/70 rounded-card border border-black/5 flex items-center justify-between text-[11px] font-serif">
                <span className="w-5 h-5 rounded-full bg-[#e6ebef] border border-[#8aa0b0] flex items-center justify-center text-[9px]">K</span>
                <span className="flex-1 h-[1px] bg-black/20 mx-2" />
                <span className="w-5 h-5 rounded-full bg-[#f6dcd6] border border-[#d28a7d] flex items-center justify-center text-[9px] text-[#b8402f]">S</span>
                <span className="flex-1 h-[1px] bg-black/20 mx-2" />
                <span className="w-5 h-5 rounded-full bg-[#f3e8cf] border border-[#c9a86a] flex items-center justify-center text-[9px]">R</span>
              </div>
            </div>

            {/* Step 4 */}
            <div className="glass-card p-6 rounded-[22px] border border-white shadow-sheet flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-all duration-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-full bg-conflict/10 border border-conflict/25 flex items-center justify-center text-conflict">
                    <AlertTriangle className="w-5 h-5" />
                  </span>
                  <span className="font-serif italic text-4xl text-muted/50 font-normal">04</span>
                </div>
                <h3 className="text-[24px] font-medium text-ink leading-tight">Conflicts flagged & fixed</h3>
                <p className="text-[17px] text-muted font-serif leading-relaxed">
                  Contradictions receive red wavy underlines with 1-click jump to source and
                  context-aware patches with full undo.
                </p>
              </div>
              {/* Micro-illustration: Conflict solved */}
              <div className="p-3 bg-white/70 rounded-card border border-black/5 flex items-center justify-between text-xs font-serif italic text-conflict">
                <span className="flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> Flagged
                </span>
                <span className="text-ok font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Patched
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. FEATURES BENTO GRID & SEE IT IN ACTION                     */}
      {/* ============================================================ */}
      <section id="features" className="py-24 px-6 max-w-6xl mx-auto scroll-mt-20">
        <div className="text-center space-y-3 mb-16">
          <span className="text-xs font-serif italic text-accent uppercase tracking-wider">
            Capabilities
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium text-ink tracking-tight">
            Built for serious fiction writers
          </h2>
          <p className="text-base text-muted font-serif italic max-w-lg mx-auto">
            Everything you need to keep sprawling multi-chapter sagas physically and canonically intact.
          </p>
        </div>

        {/* Bento Grid with 3D tilt & soft cursor glow */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 (Large 2-column on desktop): Live Red-Underline Detection */}
          <div
            onMouseMove={handleCardTilt}
            onMouseLeave={handleCardLeave}
            className="lg:col-span-2 glass-card p-7 rounded-[22px] border border-white shadow-sheet relative overflow-hidden transition-all duration-200"
          >
            <div className="card-cursor-glow absolute w-40 h-40 rounded-full bg-accent/5 blur-xl pointer-events-none opacity-0 transition-opacity" />
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-full bg-conflict/10 border border-conflict/25 flex items-center justify-center text-conflict">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[22px] font-medium text-ink">
                  Live red-underline conflict detection
                </h3>
                <p className="text-sm text-muted font-serif italic mt-1 leading-relaxed">
                  Real-time inline feedback directly in your screenplay or manuscript when a sentence
                  breaches established story lore, character injuries, or physical states.
                </p>
              </div>
              <div className="screenplay-sheet p-4 rounded-card font-mono text-xs sm:text-sm text-ink leading-relaxed">
                He raised the sniper rifle with his{" "}
                <span className="conflict-underline conflict-active">right shoulder</span> and took
                steady aim.
              </div>
            </div>
          </div>

          {/* Card 2: Draggable Canon Sentinel graph */}
          <div
            onMouseMove={handleCardTilt}
            onMouseLeave={handleCardLeave}
            className="glass-card p-7 rounded-[22px] border border-white shadow-sheet relative overflow-hidden transition-all duration-200"
          >
            <div className="card-cursor-glow absolute w-40 h-40 rounded-full bg-accent/5 blur-xl pointer-events-none opacity-0 transition-opacity" />
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
                <GitBranch className="w-5 h-5" />
              </div>
              <h3 className="text-[20px] font-medium text-ink">Draggable Canon Sentinel graph</h3>
              <p className="text-xs text-muted font-serif leading-relaxed">
                Physics-based visual graph mapping characters, items, injuries, and lore rules with
                spatial relations, zoom, and fullscreen modal expansion.
              </p>
            </div>
          </div>

          {/* Card 3: Deterministic Lore Rules */}
          <div
            onMouseMove={handleCardTilt}
            onMouseLeave={handleCardLeave}
            className="glass-card p-7 rounded-[22px] border border-white shadow-sheet relative overflow-hidden transition-all duration-200"
          >
            <div className="card-cursor-glow absolute w-40 h-40 rounded-full bg-ok/10 border border-ok/25 flex items-center justify-center text-ok">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-3 mt-3">
              <h3 className="text-[20px] font-medium text-ink">Deterministic lore rules</h3>
              <p className="text-xs text-muted font-serif leading-relaxed">
                Rigorously verified physical invariants: injured limb exertion limits, dead character
                actions, and item availability across scenes.
              </p>
            </div>
          </div>

          {/* Card 4: Conflict Panel & Jump to Source */}
          <div
            onMouseMove={handleCardTilt}
            onMouseLeave={handleCardLeave}
            className="glass-card p-7 rounded-[22px] border border-white shadow-sheet relative overflow-hidden transition-all duration-200"
          >
            <div className="card-cursor-glow absolute w-40 h-40 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
              <ArrowRight className="w-5 h-5" />
            </div>
            <div className="space-y-3 mt-3">
              <h3 className="text-[20px] font-medium text-ink">Conflict panel & Jump to source</h3>
              <p className="text-xs text-muted font-serif leading-relaxed">
                Clicking any underline reveals the exact earlier scene and quotes the sentence where
                the fact was established, with 1-click two-way jumping.
              </p>
            </div>
          </div>

          {/* Card 5: Fix suggestions with Apply and Undo */}
          <div
            onMouseMove={handleCardTilt}
            onMouseLeave={handleCardLeave}
            className="glass-card p-7 rounded-[22px] border border-white shadow-sheet relative overflow-hidden transition-all duration-200"
          >
            <div className="card-cursor-glow absolute w-40 h-40 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
              <History className="w-5 h-5" />
            </div>
            <div className="space-y-3 mt-3">
              <h3 className="text-[20px] font-medium text-ink">Fix suggestions & Undo</h3>
              <p className="text-xs text-muted font-serif leading-relaxed">
                Three targeted patch options (Rewrite sentence, Modify earlier scene, Bridge gap) with
                1-click live preview and multi-scene instant undo.
              </p>
            </div>
          </div>

          {/* Card 6 (Large 2-column on desktop): Scene Outline with Realtime Status */}
          <div
            onMouseMove={handleCardTilt}
            onMouseLeave={handleCardLeave}
            className="lg:col-span-3 glass-card p-7 rounded-[22px] border border-white shadow-sheet relative overflow-hidden transition-all duration-200 flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-accent mb-2">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-[22px] font-medium text-ink">
                Scene outline with real-time health status
              </h3>
              <p className="text-sm text-muted font-serif italic max-w-xl leading-relaxed">
                Storyboard overview tracking scene order, word count, and real-time canon status. Know
                at a glance whether your entire manuscript is canon-consistent.
              </p>
            </div>
            <div className="px-4 py-2 rounded-control bg-ok/10 border border-ok/30 text-ok text-xs font-serif italic flex items-center gap-2 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
              <span>Continuity invariants verified</span>
            </div>
          </div>
        </div>

        {/* "See It in Action" Section (Interactive Graph Preview Card) */}
        <div className="mt-14 glass-panel rounded-[22px] border border-white/90 p-6 md:p-8 shadow-sheet grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 h-[360px] rounded-card border border-white/80 bg-white/70 overflow-hidden relative">
            <CanonGraphVisual draggable={true} stage={4} />
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-serif italic text-accent uppercase tracking-wider">
                Interactive Canvas
              </span>
              <h3 className="text-2xl font-medium text-ink">
                Test the graph with live pointer interaction
              </h3>
              <p className="text-xs md:text-sm text-muted font-serif leading-relaxed">
                Drag nodes around above. Boundary curves, labels, and contradiction pulses recompute in
                real-time. The same engine powers the right column of the writer workspace.
              </p>
            </div>

            <button
              onClick={handleTryDemo}
              className="w-full py-3.5 bg-accent hover:bg-accent-hover text-white rounded-control text-sm font-serif font-medium transition-all shadow-md hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span>Open the live demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 6. WHO IT'S FOR ("BUILT FOR" BAND)                             */}
      {/* ============================================================ */}
      <section id="built-for" className="py-24 px-6 max-w-6xl mx-auto scroll-mt-20">
        <div className="text-center space-y-3 mb-16">
          <span className="text-xs font-serif italic text-accent uppercase tracking-wider">
            Audience
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium text-ink tracking-tight">
            Built for storytellers across mediums
          </h2>
          <p className="text-base text-muted font-serif italic max-w-lg mx-auto">
            Engineered specifically for narrative teams managing complex, serialized universes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: TV Writers' Rooms */}
          <div className="glass-card p-7 rounded-[22px] border border-white shadow-sheet space-y-4 hover:-translate-y-1 transition-all duration-200">
            <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
              <Clapperboard className="w-6 h-6" />
            </div>
            <h3 className="text-[22px] font-medium text-ink">TV writers' rooms</h3>
            <p className="text-sm text-muted font-serif leading-relaxed">
              Maintain episode-to-episode consistency across multiple writers, guest scripts, and
              multi-season character arcs without manual bible lookups.
            </p>
          </div>

          {/* Card 2: Novelists */}
          <div className="glass-card p-7 rounded-[22px] border border-white shadow-sheet space-y-4 hover:-translate-y-1 transition-all duration-200">
            <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-[22px] font-medium text-ink">Novelists & authors</h3>
            <p className="text-sm text-muted font-serif leading-relaxed">
              Track multi-chapter sagas, carried weapons, wounds, and world invariants across hundreds
              of manuscript pages with zero mental overhead.
            </p>
          </div>

          {/* Card 3: Game Narrative Designers */}
          <div className="glass-card p-7 rounded-[22px] border border-white shadow-sheet space-y-4 hover:-translate-y-1 transition-all duration-200">
            <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <h3 className="text-[22px] font-medium text-ink">Game narrative designers</h3>
            <p className="text-sm text-muted font-serif leading-relaxed">
              Validate dialogue beat states, quest inventory preconditions, and character physical
              capabilities across complex questlines.
            </p>
          </div>
        </div>

        {/* Marquee Strip: Real Engine Rules and Tracked Fact Types */}
        <div className="mt-16 py-4 border-y border-black/10 overflow-hidden relative select-none">
          <div className="animate-marquee flex items-center gap-8 text-xs font-mono tracking-wider uppercase text-muted/80">
            <span>INJURED_PART_HEAVY_USE</span>
            <span>•</span>
            <span>PHYSICAL INJURIES</span>
            <span>•</span>
            <span>INVENTORY & WEAPONS</span>
            <span>•</span>
            <span>CHRONOLOGICAL ORDER</span>
            <span>•</span>
            <span>APPEARANCES & DEATH</span>
            <span>•</span>
            <span>CANON INVARIANTS</span>
            <span>•</span>
            <span>MULTI-SCENE CASUALTY TRACKING</span>
            <span>•</span>
            <span>DETERMINISTIC GRAPH VERIFICATION</span>
            <span>•</span>
            {/* Repeated for continuous seamless loop */}
            <span>INJURED_PART_HEAVY_USE</span>
            <span>•</span>
            <span>PHYSICAL INJURIES</span>
            <span>•</span>
            <span>INVENTORY & WEAPONS</span>
            <span>•</span>
            <span>CHRONOLOGICAL ORDER</span>
            <span>•</span>
            <span>APPEARANCES & DEATH</span>
            <span>•</span>
            <span>CANON INVARIANTS</span>
            <span>•</span>
            <span>MULTI-SCENE CASUALTY TRACKING</span>
            <span>•</span>
            <span>DETERMINISTIC GRAPH VERIFICATION</span>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 7. FINAL CALL TO ACTION                                       */}
      {/* ============================================================ */}
      <section className="py-24 px-6 max-w-4xl mx-auto">
        <div className="glass-panel rounded-[22px] p-8 sm:p-14 text-center space-y-7 border border-white shadow-sheet relative overflow-hidden">
          <div className="w-14 h-14 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-accent mx-auto shadow-sm">
            <Radar className="w-7 h-7 animate-spin-slow" />
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium text-ink tracking-tight">
              Bring your story. We'll check the canon.
            </h2>
            <p className="text-base sm:text-lg text-muted font-serif italic max-w-lg mx-auto leading-relaxed">
              Test your scenes against live deterministic graph invariants in under 30 seconds.
            </p>
          </div>

          <div className="pt-2 flex justify-center">
            <button
              onClick={handleTryDemo}
              onMouseMove={(e) => handleMagnetMove(e, setMagnetPosCta)}
              onMouseLeave={() => handleMagnetLeave(setMagnetPosCta)}
              style={{
                transform: `translate3d(${magnetPosCta.x}px, ${magnetPosCta.y}px, 0)`,
                transition: "transform 150ms ease-out",
              }}
              className="h-14 px-9 bg-accent hover:bg-accent-hover text-white rounded-control text-[18px] font-serif font-medium transition-colors shadow-md cta-button-glow flex items-center justify-center gap-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
            >
              <span>Try the demo</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FOOTER                                                        */}
      {/* ============================================================ */}
      <footer className="border-t border-black/10 py-12 px-6 text-xs text-muted font-serif italic">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-accent">
              <Radar className="w-3.5 h-3.5" />
            </div>
            <span className="font-serif font-medium text-ink not-italic text-sm">RETCON-RADAR</span>
            <span>—</span>
            <span>GeNarrative Clash 2026</span>
          </div>

          <div className="flex items-center gap-6">
            <span>Built by Aditya</span>
            <a
              href="#todo"
              onClick={(e) => e.preventDefault()}
              className="hover:text-accent transition-colors underline cursor-pointer"
              title="GitHub repository placeholder"
            >
              TODO:
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
