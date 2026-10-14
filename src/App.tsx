import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "./App.css";
import { PxIcon } from "./PxIcon";

interface Section {
  id: string;
  title: string;
  active: boolean;
}

/** Pixels scrolled per animation frame while a direction button is held */
const CHARACTER_NAV_SPEED = 16;

const isMobileViewport = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;

/** Live project previews — never auto-load iframes on mobile (OOM / tab kills). */
function ProjectPreviewFrame({
  src,
  title,
  href,
}: {
  src: string;
  title: string;
  href: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [loadIframe, setLoadIframe] = useState(false);

  useEffect(() => {
    if (isMobileViewport()) return;

    const node = wrapperRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLoadIframe(true);
          observer.disconnect();
        }
      },
      { rootMargin: "80px", threshold: 0.01 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="iframe-wrapper" ref={wrapperRef}>
      {loadIframe ? (
        <iframe
          src={src}
          title={title}
          className="project-iframe"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          style={{ width: "1280px", height: "800px" }}
        />
      ) : (
        <div className="iframe-placeholder" aria-hidden="true">
          <span className="iframe-placeholder-icon">
            <PxIcon name="external-link" />
          </span>
          <span className="iframe-placeholder-text">Tap to open live site</span>
        </div>
      )}
      <div
        className="iframe-overlay"
        onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
        role="link"
        aria-label={`Open ${title}`}
      />
    </div>
  );
}

function App() {
  // Loading state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingCharacterFrame, setLoadingCharacterFrame] = useState<number>(2);
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeSection, setActiveSection] = useState<string>("about");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sections] = useState<Section[]>([
    { id: "about", title: "About", active: true },
    { id: "projects", title: "Projects", active: false },
    { id: "skills", title: "Skills", active: false },
    { id: "contact", title: "Contact", active: false },
  ]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [typedText, setTypedText] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isTyping, setIsTyping] = useState(true);

  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [currentPersonFrame, setCurrentPersonFrame] = useState<number>(1);
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  const [scrollTimeout, setScrollTimeout] = useState<NodeJS.Timeout | null>(
    null
  );
  const [scrollEventCounter, setScrollEventCounter] = useState<number>(0);
  const [lastScrollTop, setLastScrollTop] = useState<number>(0);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("down");

  // Chat bubble state
  const [showChatBubble, setShowChatBubble] = useState<boolean>(false);
  const [currentChatIndex, setCurrentChatIndex] = useState<number>(0);
  
  // Copy notification state
  const [showCopyNotification, setShowCopyNotification] = useState<boolean>(false);
  const [copyNotificationText, setCopyNotificationText] = useState<string>('');
  
  // Jump animation state
  const [isJumping, setIsJumping] = useState<boolean>(false);
  const [hasWelcomeJumped, setHasWelcomeJumped] = useState<boolean>(false);

  const chatMessages = useMemo(() => [
    "Hey — I'm Junre. Thanks for stopping by.",
    "Scroll to move through the sections. Click me for another note.",
    "I manage software development at Vananaz Technologies.",
    "I grew up in Cebu City, Philippines.",
    "Started in BSIT at University of Cebu, then went into industry.",
    "These days I focus on architecture, delivery, and keeping systems usable.",
    "I still get involved when something is slow or hard to maintain.",
    "Most of my work has been web, mobile, APIs, and cloud.",
    "Happy to talk about projects, roles, or just swap notes.",
    "Click me if you want another line.",
  ], []);
  const pausedElementsRef = useRef<Set<string>>(new Set());

  // Loading animation effect
  useEffect(() => {
    // Separate timers for smooth animation
    const loadingTimer = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(loadingTimer);
          setTimeout(() => setIsLoading(false), 500); // Small delay for smooth transition
          return 100;
        }
        return prev + 1; // Increment by 1% every 40ms (4 seconds total)
      });
    }, 40);

    // Character running animation - optimized timing for smooth running
    const frameTimer = setInterval(() => {
      setLoadingCharacterFrame((currentFrame) => {
        if (currentFrame >= 6) return 2; // Reset to frame 2 after frame 6
        return currentFrame + 1;
      });
    }, 120); // 120ms per frame for smooth running animation

    return () => {
      clearInterval(loadingTimer);
      clearInterval(frameTimer);
    };
  }, []);

  // Auto-scroll for content cards (desktop only — skips mobile to avoid jank/OOM)
  useEffect(() => {
    if (isMobileViewport()) return;

    const scrollableElements = [
      { selector: ".projects-list", speed: 1 },
      { selector: ".innovation-grid", speed: 0.8 },
      { selector: ".skills-categories", speed: 0.8 },
      { selector: ".timeline", speed: 0.6 },
    ];

    const eventListeners: Array<{
      element: HTMLElement;
      enter: () => void;
      leave: () => void;
    }> = [];
    const resetTimers = new Map<string, ReturnType<typeof setTimeout>>();

    scrollableElements.forEach(({ selector }) => {
      const element = document.querySelector(selector) as HTMLElement;
      const parentCard = element?.closest(".content-card") as HTMLElement;

      if (element && parentCard) {
        const handleMouseEnter = () => {
          pausedElementsRef.current.add(selector);
        };

        const handleMouseLeave = () => {
          pausedElementsRef.current.delete(selector);
        };

        parentCard.addEventListener("mouseenter", handleMouseEnter);
        parentCard.addEventListener("mouseleave", handleMouseLeave);

        eventListeners.push({
          element: parentCard,
          enter: handleMouseEnter,
          leave: handleMouseLeave,
        });
      }
    });

    const cached = scrollableElements
      .map(({ selector, speed }) => {
        const element = document.querySelector(selector) as HTMLElement | null;
        return element ? { selector, speed, element } : null;
      })
      .filter(Boolean) as Array<{
      selector: string;
      speed: number;
      element: HTMLElement;
    }>;

    const autoScrollCards = () => {
      cached.forEach(({ selector, speed, element }) => {
        if (pausedElementsRef.current.has(selector)) return;

        const maxScroll = element.scrollHeight - element.clientHeight;
        if (maxScroll <= 0) return;

        if (element.scrollTop >= maxScroll - 1) {
          if (resetTimers.has(selector)) return;
          const timer = setTimeout(() => {
            resetTimers.delete(selector);
            if (!pausedElementsRef.current.has(selector)) {
              element.scrollTop = 0;
            }
          }, 2000);
          resetTimers.set(selector, timer);
        } else {
          element.scrollTop += speed;
        }
      });
    };

    const interval = setInterval(autoScrollCards, 50);

    return () => {
      clearInterval(interval);
      resetTimers.forEach((timer) => clearTimeout(timer));
      eventListeners.forEach(({ element, enter, leave }) => {
        element.removeEventListener("mouseenter", enter);
        element.removeEventListener("mouseleave", leave);
      });
    };
  }, []);

  // Contact form submission handler
  const handleContactSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name");
    const email = formData.get("email");
    const subject = formData.get("subject");

    // Simple success message for now
    alert(
      `Thanks, ${name}. Got your message about "${subject}" — I'll reply at ${email}.`
    );

    // Reset form
    e.currentTarget.reset();
  };

  const textsToType = useMemo(() => [
    "Software Development Manager at Vananaz Technologies",
    "Architecture, delivery, and practical engineering problems",
    "Based in Cebu — open to interesting conversations",
  ], []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
  };

  // Random message picker function
  const getRandomMessage = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * chatMessages.length);
    setCurrentChatIndex(randomIndex);
  }, [chatMessages]);

  // Handle contact copy function
  const handleContactCopy = useCallback(async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotificationText(`${type} copied to clipboard!`);
      setShowCopyNotification(true);
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setShowCopyNotification(false);
      }, 3000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopyNotificationText(`${type} copied to clipboard!`);
      setShowCopyNotification(true);
      
      setTimeout(() => {
        setShowCopyNotification(false);
      }, 3000);
    }
  }, []);

  // Enhanced message picker for instant display
  const showNewMessage = useCallback(() => {
    setShowChatBubble(false); // Hide bubble briefly
    getRandomMessage(); // Pick new message
    // Quick reappear with new message
    setTimeout(() => {
      setShowChatBubble(true);
    }, 150); // Slightly longer for smooth transition
  }, [getRandomMessage]);

  // Handle background click to make character jump
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    // Only trigger if clicking on the background (not on cards or UI elements)
    if (e.target === e.currentTarget && !isJumping) {
      setIsJumping(true);
      // Reset jump state after animation completes
      setTimeout(() => {
        setIsJumping(false);
      }, 600); // Jump animation duration
    }
  }, [isJumping]);

  const canGoLeft = scrollProgress > 0.02;
  const canGoRight = scrollProgress < 0.98;

  const navDirectionRef = useRef<"left" | "right" | null>(null);
  const navRafRef = useRef<number | null>(null);

  const stopCharacterNav = useCallback(() => {
    navDirectionRef.current = null;
    if (navRafRef.current != null) {
      cancelAnimationFrame(navRafRef.current);
      navRafRef.current = null;
    }
  }, []);

  const tickCharacterNav = useCallback(() => {
    const direction = navDirectionRef.current;
    if (!direction) {
      navRafRef.current = null;
      return;
    }

    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;
    const y = window.pageYOffset;

    if (
      (direction === "left" && y <= 0) ||
      (direction === "right" && y >= maxScroll - 1)
    ) {
      stopCharacterNav();
      return;
    }

    window.scrollBy(
      0,
      direction === "right" ? CHARACTER_NAV_SPEED : -CHARACTER_NAV_SPEED
    );
    navRafRef.current = requestAnimationFrame(tickCharacterNav);
  }, [stopCharacterNav]);

  const startCharacterNav = useCallback(
    (direction: "left" | "right") =>
      (e: React.PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        navDirectionRef.current = direction;
        if (navRafRef.current == null) {
          navRafRef.current = requestAnimationFrame(tickCharacterNav);
        }
      },
    [tickCharacterNav]
  );

  useEffect(() => () => stopCharacterNav(), [stopCharacterNav]);

  // Preload person images
  useEffect(() => {
    const preloadImages = () => {
      for (let i = 1; i <= 6; i++) {
        const img = new Image();
        img.src = `${process.env.PUBLIC_URL}/person/person${i}.png`;
      }
    };
    
    preloadImages();
  }, []);

  // Show initial chat bubble on page load
  useEffect(() => {
    const initialChatTimeout = setTimeout(() => {
      getRandomMessage(); // Pick random message
      setShowChatBubble(true); // Show immediately since it's the first message
    }, 2000); // Show initial chat bubble after 2 seconds

    return () => clearTimeout(initialChatTimeout);
  }, [getRandomMessage]);

  // Welcome jump when loading finishes
  useEffect(() => {
    if (!isLoading && !hasWelcomeJumped) {
      // Delay the jump slightly to let the page settle
      const welcomeJumpTimeout = setTimeout(() => {
        setIsJumping(true);
        setHasWelcomeJumped(true);
        
        // Reset jump state after animation completes
        setTimeout(() => {
          setIsJumping(false);
        }, 600); // Jump animation duration
      }, 300); // Small delay after loading screen disappears

      return () => clearTimeout(welcomeJumpTimeout);
    }
  }, [isLoading, hasWelcomeJumped]);

  // Handle viewport height for mobile browsers (Safari toolbar issue)
  useEffect(() => {
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    // Set initial viewport height
    setViewportHeight();

    // Update on resize (handles Safari toolbar show/hide)
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);

    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
    };
  }, []);

  // Keep scroll hot-path values in refs so the window listener stays stable
  const lastScrollTopRef = useRef(lastScrollTop);
  const scrollTimeoutRef = useRef(scrollTimeout);
  const isScrollGestureRef = useRef(false);
  lastScrollTopRef.current = lastScrollTop;
  scrollTimeoutRef.current = scrollTimeout;

  // Mouse tracking and scroll-based 3D animation
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Skip unused mouse tracking on touch devices
      if (window.matchMedia("(pointer: coarse)").matches) return;
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleScroll = (): void => {
      const scrollTop: number = window.pageYOffset;
      const docHeight: number =
        document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent: number = docHeight > 0 ? scrollTop / docHeight : 0;

      setScrollProgress(scrollPercent);

      // Detect scroll direction
      const direction = scrollTop > lastScrollTopRef.current ? "down" : "up";
      setScrollDirection(direction);
      setLastScrollTop(scrollTop);

      // Walking animation + chat side-effects once per gesture
      if (!isScrollGestureRef.current) {
        isScrollGestureRef.current = true;
        setIsScrolling(true);
        setShowChatBubble(false);
        getRandomMessage();
      }

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Increment scroll counter and update frame
      setScrollEventCounter((prev) => {
        const newCounter = prev + 1;

        // Only change frame every 8 scroll events (adjust this number to make walking faster/slower)
        if (newCounter % 8 === 0) {
          setCurrentPersonFrame((currentFrame) => {
            if (currentFrame === 1) return 2; // Start walking from frame 2
            if (currentFrame >= 6) return 2; // Reset to frame 2 after frame 6
            return currentFrame + 1;
          });
        }

        return newCounter;
      });

      // Set timeout to stop walking animation
      const newTimeout = setTimeout(() => {
        isScrollGestureRef.current = false;
        setIsScrolling(false);
        setCurrentPersonFrame(1); // Reset to idle frame
        setScrollEventCounter(0); // Reset counter when stopping

        // Show chat bubble when character becomes idle (message already prepared)
        setTimeout(() => {
          setShowChatBubble(true);
        }, 500); // Show chat bubble 500ms after stopping
      }, 800); // Stop animation 800ms after scrolling stops (longer delay)

      setScrollTimeout(newTimeout);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [getRandomMessage]);

  // Typewriter effect
  useEffect(() => {
    let currentTextIndex = 0;
    let currentCharIndex = 0;
    let completedTexts: string[] = [];
    let timeoutId: NodeJS.Timeout;

    const typeText = () => {
      const currentText = textsToType[currentTextIndex];

      if (currentCharIndex <= currentText.length) {
        const displayText =
          completedTexts.join("\n\n") +
          (completedTexts.length > 0 ? "\n\n" : "") +
          currentText.substring(0, currentCharIndex);
        setTypedText(displayText);
        currentCharIndex++;
        timeoutId = setTimeout(typeText, 50); // Typing speed
      } else {
        // Finished typing current text
        completedTexts.push(currentText);
        currentTextIndex++;
        currentCharIndex = 0;

        if (currentTextIndex < textsToType.length) {
          timeoutId = setTimeout(typeText, 800); // Pause between sentences
        } else {
          setIsTyping(false); // Finished all texts
        }
      }
    };

    const initialTimer = setTimeout(() => {
      typeText();
    }, 1000); // Delay before starting to type

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(timeoutId);
    };
  }, [textsToType]);

  // Get device width
  const [deviceWidth, setDeviceWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1920);

  // Update device width on resize
  useEffect(() => {
    const handleResize = () => {
      setDeviceWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate game elements based on scroll with device-specific coefficients
  const getWorldOffsetCoefficient = useCallback(() => {
    // Fixed pixel positioning: furthest card at 5900px + card width (500px) + margin (200px) = 6600px
    // Consistent 700px gaps between cards, 300px from left edge
    // Added Innovation Hub card, removed Achievement Gallery
    
    // NOTE: ADJUST THIS VALUE TO CHANGE THE GAME WIDTH
    return -6600 + (deviceWidth || 0);
  }, [deviceWidth]);
  
  const gameWidth = useMemo(() => getWorldOffsetCoefficient() * -1, [getWorldOffsetCoefficient]);
  
  const worldOffset = useMemo(() => scrollProgress * getWorldOffsetCoefficient(), [scrollProgress, getWorldOffsetCoefficient]);
  const characterJump = useMemo(() => Math.sin(scrollProgress * 20) * 5, [scrollProgress]); // Bouncing effect

      return (
      <div className="App">
        {/* Loading Screen */}
        {isLoading && (
          <div className="loading-screen">
            <div className="loading-forest">
              {/* Animated background layers */}
              <div className="loading-sky" style={{ opacity: loadingProgress > 10 ? 1 : 0 }}>
                <div className="loading-sun" style={{ opacity: loadingProgress > 60 ? 1 : 0 }}></div>
              </div>
              <div className="loading-mountains" style={{ 
                opacity: loadingProgress > 20 ? 1 : 0,
                transform: `translateY(${Math.max(0, 50 - loadingProgress/2)}px)`
              }}></div>
              <div className="loading-trees" style={{ 
                opacity: loadingProgress > 40 ? 1 : 0,
                transform: `translateY(${Math.max(0, 30 - loadingProgress/3)}px)`
              }}></div>
              
              {/* Character runs across from start */}
              {loadingProgress > 0 && (
                <div className="loading-character">
                  <img
                    src={`${process.env.PUBLIC_URL}/person/person${loadingCharacterFrame}.png`}
                    alt="Loading Character"
                    className="loading-character-sprite"
                  />
                </div>
              )}
            </div>
            
            {/* Loading UI */}
            <div className="loading-ui">
              <h1 className="loading-title">JUNRE'S DIGITAL FOREST</h1>
              <div className="loading-subtitle">
                {loadingProgress < 30 && (
                  <>
                    <PxIcon name="human" className="loading-status-icon" /> Loading character...
                  </>
                )}
                {loadingProgress >= 30 && loadingProgress < 60 && (
                  <>
                    <PxIcon name="leaf" className="loading-status-icon" /> Loading background...
                  </>
                )}
                {loadingProgress >= 60 && loadingProgress < 85 && (
                  <>
                    <PxIcon name="tree-pine" className="loading-status-icon" /> Almost there...
                  </>
                )}
                {loadingProgress >= 85 && (
                  <>
                    <PxIcon name="check" className="loading-status-icon" /> Ready
                  </>
                )}
              </div>
              
              {/* Progress Bar */}
              <div className="loading-progress-container">
                <div className="loading-progress-bar">
                  <div 
                    className="loading-progress-fill" 
                    style={{ width: `${loadingProgress}%` }}
                  ></div>
                </div>
                <div className="loading-percentage">{Math.round(loadingProgress)}%</div>
              </div>
              
              {loadingProgress === 100 && (
                <div className="loading-complete">
                  <div className="press-any-key"><PxIcon name="sparkles" /> Ready to scroll</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scroll Progress Bar */}
        <div className="scroll-progress-bar">
        <div
          className="scroll-progress-fill"
          style={{ width: `${scrollProgress * 100}%` }}
        ></div>
      </div>

      {/* Mario-style Game Scene */}
      <div className="mario-game-scene" onClick={handleBackgroundClick}>
        {/* Forest Parallax Background Layers */}
                 <div
           className="parallax-layer sky-layer"
           style={{ transform: `translateX(${worldOffset * 0.05}px)` }}
         >
           <img
             src={`${process.env.PUBLIC_URL}/parallax_background_forest/forest_background_sky.png`}
             alt="Sky"
             className="forest-sky"
           />

           <img
             src={`${process.env.PUBLIC_URL}/parallax_background_forest/forest_background_sun.png`}
             alt="Sun"
             className="forest-sun"
           />
         </div>

                 <div
           className="parallax-layer clouds-layer"
           style={{ transform: `translateX(${worldOffset * 0.1}px)` }}
         >
           <div
             className="forest-clouds"
             style={{
               backgroundImage: `url(${process.env.PUBLIC_URL}/parallax_background_forest/forest_background_clouds.png)`,
             }}
           ></div>

         </div>

                 <div
           className="parallax-layer mountains-layer-3"
           style={{ transform: `translateX(${worldOffset * 0.2}px)` }}
         >
           <div
             className="forest-mountains-3"
             style={{
               backgroundImage: `url(${process.env.PUBLIC_URL}/parallax_background_forest/forest_background_mountains_3.png)`,
             }}
           ></div>

         </div>

                 <div
           className="parallax-layer mountains-layer-2"
           style={{ transform: `translateX(${worldOffset * 0.3}px)` }}
         >
           <div
             className="forest-mountains-2"
             style={{
               backgroundImage: `url(${process.env.PUBLIC_URL}/parallax_background_forest/forest_background_mountains_2.png)`,
             }}
           ></div>

         </div>

                 <div
           className="parallax-layer mountains-layer-1"
           style={{ transform: `translateX(${worldOffset * 0.4}px)` }}
         >
           <div
             className="forest-mountains-1"
             style={{
               backgroundImage: `url(${process.env.PUBLIC_URL}/parallax_background_forest/forest_background_mountains_1.png)`,
             }}
           ></div>

         </div>

                 <div
           className="parallax-layer trees-layer"
           style={{ transform: `translateX(${worldOffset * 0.6}px)` }}
         >
           <div
             className="forest-trees"
             style={{
               backgroundImage: `url(${process.env.PUBLIC_URL}/parallax_background_forest/forest_background_trees.png)`,
             }}
           ></div>

         </div>

                 <div
           className="parallax-layer rocks-layer"
           style={{ transform: `translateX(${worldOffset * 0.8}px)` }}
         >
           <div
             className="forest-rocks"
             style={{
               backgroundImage: `url(${process.env.PUBLIC_URL}/parallax_background_forest/forest_background_rocks.png)`,
             }}
           ></div>

         </div>

        <div
          className="parallax-layer ground-layer"
          style={{ transform: `translateX(${worldOffset}px)` }}
        >
          {/* Portfolio Content Cards - standing cardboard style */}

          {/* Welcome/Instructions Card */}
          <div className="content-card welcome-card">
            <div className="card-header">
              <div className="card-icon"><PxIcon name="star" /></div>
              <h3>Welcome</h3>
            </div>
            <div className="card-content">
              <div className="instruction-list">
                <div className="instruction-item">
                  <span className="instruction-icon"><PxIcon name="gamepad" /></span>
                  <div>
                    <strong>Scroll to move</strong>
                    <p>The scene moves as you go through the cards</p>
                  </div>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon"><PxIcon name="book-open" /></span>
                  <div>
                    <strong>Read the cards</strong>
                    <p>About me, work, skills, and how to reach me</p>
                  </div>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon"><PxIcon name="lightbulb" /></span>
                  <div>
                    <strong>Open the demos</strong>
                    <p>Some projects have live previews you can click</p>
                  </div>
                </div>
              </div>
              <div className="adventure-banner">
                <span className="adventure-text">
                  <PxIcon name="flag" /> Scroll/Use the buttons to move
                </span>
              </div>
            </div>
          </div>

          {/* About Me Card - Enhanced */}
          <div className="content-card about-card">
            <div className="card-header">
              <div className="card-icon rotating"><PxIcon name="user" /></div>
              <h3>About Me</h3>
            </div>
            <div className="card-content">
              <div className="about-intro">
                <h4>Software Development Manager</h4>
                <div className="experience-badge">Vananaz Technologies</div>
              </div>
              <div className="qualities-grid">
                <div className="quality-item">
                  <span className="quality-icon"><PxIcon name="building" /></span>
                  <div>
                    <strong>System Architecture</strong>
                    <p>How services, data, and deployments fit together</p>
                  </div>
                </div>
                <div className="quality-item">
                  <span className="quality-icon"><PxIcon name="zap" /></span>
                  <div>
                    <strong>Performance</strong>
                    <p>Improving systems that are slow or unstable</p>
                  </div>
                </div>
                <div className="quality-item">
                  <span className="quality-icon"><PxIcon name="notes" /></span>
                  <div>
                    <strong>Technical Specs</strong>
                    <p>Helping define what should be built and why</p>
                  </div>
                </div>
                <div className="quality-item">
                  <span className="quality-icon"><PxIcon name="users" /></span>
                  <div>
                    <strong>Department Leadership</strong>
                    <p>Managing people and delivery day to day</p>
                  </div>
                </div>
              </div>
              <div className="quote-section">
                <p className="quote-text">
                  &ldquo;Around here, however, we don't look backwards for very long. We keep moving forward, opening new doors, and doing new things, because we're curious&hellip; and curiosity keeps leading us down new paths.&rdquo;
                </p>
                <p className="quote-attribution">— Meet the Robinsons</p>
              </div>
            </div>
          </div>

          {/* Projects Card - Enhanced */}
          <div className="content-card projects-card">
            <div className="card-header">
              <div className="card-icon pulse"><PxIcon name="sliders" /></div>
              <h3>Featured Projects</h3>
            </div>
            <div className="card-content">
              <div className="projects-list">
                <div className="project-item">
                  <div className="project-header">
                    <span className="project-icon"><PxIcon name="cpu" /></span>
                    <h4>AI Motion &amp; Posture Platform</h4>
                    <div className="project-focus">HealthTech</div>
                  </div>
                  <div className="project-details">
                    <p className="project-summary">
                      Worked on architecture for AI processing, and fixed parts of the product that were slow in normal use.
                    </p>
                    <div className="tech-stack">
                      <span className="tech-tag">Three.js</span>
                      <span className="tech-tag">Node.js</span>
                      <span className="tech-tag">Python</span>
                      <span className="tech-tag">AWS</span>
                    </div>
                    <div className="project-metrics">
                      <span className="metric"><PxIcon name="building" /> Architecture</span>
                      <span className="metric"><PxIcon name="zap" /> Performance</span>
                      <span className="metric"><PxIcon name="reload" /> CI/CD</span>
                    </div>
                  </div>
                </div>

                <div className="project-item">
                  <div className="project-header">
                    <span className="project-icon"><PxIcon name="users" /></span>
                    <h4>Wellness CRM Platform</h4>
                    <div className="project-focus">Department Lead</div>
                  </div>
                  <div className="project-details">
                    <p className="project-summary">
                      Handled frontend, backend, and AWS work on the platform while managing the development department through delivery.
                    </p>
                    <div className="tech-stack">
                      <span className="tech-tag">React</span>
                      <span className="tech-tag">AWS</span>
                      <span className="tech-tag">Jest</span>
                    </div>
                    <div className="project-metrics">
                      <span className="metric"><PxIcon name="users" /> Department management</span>
                      <span className="metric"><PxIcon name="building" /> Full stack</span>
                      <span className="metric"><PxIcon name="check" /> Reviews &amp; tests</span>
                    </div>
                  </div>
                </div>

                <div className="project-item">
                  <div className="project-header">
                    <span className="project-icon"><PxIcon name="heart" /></span>
                    <h4>Medical Consultation Platform</h4>
                    <div className="project-focus">Healthcare</div>
                  </div>
                  <div className="project-details">
                    <p className="project-summary">
                      Built Laravel APIs for consultation workflows and cleaned up older code that had gotten slow.
                    </p>
                    <div className="tech-stack">
                      <span className="tech-tag">Laravel</span>
                      <span className="tech-tag">PHP</span>
                      <span className="tech-tag">MySQL</span>
                    </div>
                    <div className="project-metrics">
                      <span className="metric"><PxIcon name="plug" /> REST APIs</span>
                      <span className="metric"><PxIcon name="zap" /> Performance fixes</span>
                    </div>
                  </div>
                </div>

                <div className="project-item">
                  <div className="project-header">
                    <span className="project-icon"><PxIcon name="layout" /></span>
                    <h4>Real-Time Virtual Whiteboard</h4>
                    <div className="project-focus">Collaboration</div>
                  </div>
                  <div className="project-details">
                    <p className="project-summary">
                      Built real-time collaboration features and helped translate client requests into concrete engineering tasks.
                    </p>
                    <div className="tech-stack">
                      <span className="tech-tag">Laravel</span>
                      <span className="tech-tag">MySQL</span>
                      <span className="tech-tag">Real-time</span>
                    </div>
                    <div className="project-metrics">
                      <span className="metric"><PxIcon name="reload" /> Real-time sync</span>
                      <span className="metric"><PxIcon name="contact" /> Client coordination</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Innovation Hub Card - New */}
          <div className="content-card innovation-card">
            <div className="card-header">
              <div className="card-icon glow"><PxIcon name="lightbulb" /></div>
              <h3>Innovation Hub</h3>
            </div>
            <div className="card-content">
              <div className="innovation-grid">
                <div className="innovation-item">
                  <div className="innovation-header">
                    <span className="innovation-icon"><PxIcon name="map" /></span>
                    <h4>GeoScape Explorer</h4>
                  </div>
                  <div className="innovation-details">
                    <div className="project-preview">
                      <div className="preview-image">
                        <span className="preview-icon"><PxIcon name="map" /></span>
                      </div>
                      <div className="preview-info">
                        <span className="project-type">3D Geospatial Explorer</span>
                        <span className="project-url">zapicojunredexter.github.io/3d-map</span>
                      </div>
                    </div>
                    <div className="innovation-tech">
                      <span className="tech-badge">Three.js</span>
                      <span className="tech-badge">WebGL</span>
                      <span className="tech-badge">JavaScript</span>
                    </div>
                    <div className="innovation-description">
                      <p>3D map explorer with keyboard movement and mouse look</p>
                    </div>
                    <div className="project-features">
                      <span className="feature"><PxIcon name="earth" /> 3D Terrain</span>
                      <span className="feature"><PxIcon name="keyboard" /> WASD Controls</span>
                      <span className="feature"><PxIcon name="mouse" /> Mouse Look</span>
                    </div>
                    <div className="project-preview-frame">
                      <div className="preview-header">
                        <span className="preview-label">Live Preview</span>
                        <a href="https://zapicojunredexter.github.io/3d-map/" target="_blank" rel="noopener noreferrer" className="preview-link">
                          <PxIcon name="external-link" /> Open Full Site
                        </a>
                      </div>
                      <ProjectPreviewFrame
                        src="https://zapicojunredexter.github.io/3d-map/"
                        title="GeoScape Explorer Preview"
                        href="https://zapicojunredexter.github.io/3d-map/"
                      />
                    </div>
                  </div>
                </div>

                <div className="innovation-item">
                  <div className="innovation-header">
                    <span className="innovation-icon"><PxIcon name="teach" /></span>
                    <h4>Kana Practice</h4>
                  </div>
                  <div className="innovation-details">
                    <div className="project-preview">
                      <div className="preview-image">
                        <span className="preview-icon"><PxIcon name="teach" /></span>
                      </div>
                      <div className="preview-info">
                        <span className="project-type">Japanese Learning App</span>
                        <span className="project-url">zapicojunredexter.github.io/jp-tutor</span>
                      </div>
                    </div>
                    <div className="innovation-tech">
                      <span className="tech-badge">React</span>
                      <span className="tech-badge">Vite</span>
                      <span className="tech-badge">SVG</span>
                    </div>
                    <div className="innovation-description">
                      <p>Hiragana and katakana practice with quizzes and a handwriting mode</p>
                    </div>
                    <div className="project-features">
                      <span className="feature"><PxIcon name="pencil" /> Write Mode</span>
                      <span className="feature"><PxIcon name="gamepad" /> Quiz Modes</span>
                      <span className="feature"><PxIcon name="volume" /> Pronunciation</span>
                    </div>
                    <div className="project-preview-frame">
                      <div className="preview-header">
                        <span className="preview-label">Live Preview</span>
                        <a href="https://zapicojunredexter.github.io/jp-tutor/" target="_blank" rel="noopener noreferrer" className="preview-link">
                          <PxIcon name="external-link" /> Open Full Site
                        </a>
                      </div>
                      <ProjectPreviewFrame
                        src="https://zapicojunredexter.github.io/jp-tutor/"
                        title="Kana Practice Preview"
                        href="https://zapicojunredexter.github.io/jp-tutor/"
                      />
                    </div>
                  </div>
                </div>

                <div className="innovation-item">
                  <div className="innovation-header">
                    <span className="innovation-icon"><PxIcon name="brush" /></span>
                    <h4>Interactive Portfolio</h4>
                  </div>
                  <div className="innovation-details">
                    <div className="project-preview">
                      <div className="preview-image">
                        <span className="preview-icon"><PxIcon name="gamepad" /></span>
                      </div>
                      <div className="preview-info">
                        <span className="project-type">Portfolio</span>
                        <span className="project-url">junre.dev</span>
                      </div>
                    </div>
                    <div className="innovation-tech">
                      <span className="tech-badge">React</span>
                      <span className="tech-badge">TypeScript</span>
                      <span className="tech-badge">CSS3</span>
                    </div>
                    <div className="innovation-description">
                      <p>Gamified portfolio with parallax scrolling and a walkable character</p>
                    </div>
                    <div className="project-features">
                      <span className="feature"><PxIcon name="gamepad" /> Gamified UI</span>
                      <span className="feature"><PxIcon name="tree-pine" /> Parallax Background</span>
                      <span className="feature"><PxIcon name="user" /> Animated Character</span>
                    </div>
                    <div className="project-preview-frame">
                      <div className="preview-header">
                        <span className="preview-label">Current Portfolio</span>
                        <span className="preview-link"><PxIcon name="gamepad" /> You're on it now</span>
                      </div>
                      <div className="portfolio-preview">
                        <div className="preview-placeholder">
                          <span className="preview-icon-large"><PxIcon name="gamepad" /></span>
                          <p>This site</p>
                          <span className="preview-subtitle">Keep scrolling for more</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="innovation-item">
                  <div className="innovation-header">
                    <span className="innovation-icon"><PxIcon name="analytics" /></span>
                    <h4>Sales Analytics Dashboard</h4>
                  </div>
                  <div className="innovation-details">
                    <div className="project-preview">
                      <div className="preview-image">
                        <span className="preview-icon"><PxIcon name="analytics" /></span>
                      </div>
                      <div className="preview-info">
                        <span className="project-type">Business Analytics</span>
                        <span className="project-url">reports.vananaz.com</span>
                      </div>
                    </div>
                    <div className="innovation-tech">
                      <span className="tech-badge">HTML5</span>
                      <span className="tech-badge">CSS3</span>
                      <span className="tech-badge">JavaScript</span>
                    </div>
                    <div className="innovation-description">
                      <p>Sales dashboard for revenue, products, and regional breakdowns</p>
                    </div>
                    <div className="project-features">
                      <span className="feature"><PxIcon name="chart-line" /> Revenue Analytics</span>
                      <span className="feature"><PxIcon name="earth" /> Regional Performance</span>
                      <span className="feature"><PxIcon name="chart" /> Product Metrics</span>
                    </div>
                    <div className="project-preview-frame">
                      <div className="preview-header">
                        <span className="preview-label">Live Preview</span>
                        <a href="https://zapicojunredexter.github.io/reports/" target="_blank" rel="noopener noreferrer" className="preview-link">
                          <PxIcon name="external-link" /> Open Full Site
                        </a>
                      </div>
                      <ProjectPreviewFrame
                        src="https://zapicojunredexter.github.io/reports/"
                        title="Sales Analytics Dashboard Preview"
                        href="https://zapicojunredexter.github.io/reports/"
                      />
                    </div>
                  </div>
                </div>

                <div className="innovation-item">
                  <div className="innovation-header">
                    <span className="innovation-icon"><PxIcon name="camera" /></span>
                    <h4>Nice Shot Creatives</h4>
                  </div>
                  <div className="innovation-details">
                    <div className="project-preview">
                      <div className="preview-image">
                        <span className="preview-icon"><PxIcon name="camera" /></span>
                      </div>
                      <div className="preview-info">
                        <span className="project-type">Photography Studio</span>
                        <span className="project-url">niceshotcreatives.com</span>
                      </div>
                    </div>
                    <div className="innovation-tech">
                      <span className="tech-badge">React</span>
                      <span className="tech-badge">CSS3</span>
                      <span className="tech-badge">Responsive</span>
                    </div>
                    <div className="innovation-description">
                      <p>Photography studio site with booking and portfolio pages</p>
                    </div>
                    <div className="project-features">
                      <span className="feature"><PxIcon name="smartphone" /> Mobile-First Design</span>
                      <span className="feature"><PxIcon name="calendar" /> Booking Integration</span>
                      <span className="feature"><PxIcon name="image" /> Portfolio Gallery</span>
                    </div>
                    <div className="project-preview-frame">
                      <div className="preview-header">
                        <span className="preview-label">Live Preview</span>
                        <a href="https://zapicojunredexter.github.io/nice-shot-creatives/" target="_blank" rel="noopener noreferrer" className="preview-link">
                          <PxIcon name="external-link" /> Open Full Site
                        </a>
                      </div>
                      <ProjectPreviewFrame
                        src="https://zapicojunredexter.github.io/nice-shot-creatives/"
                        title="Nice Shot Creatives Preview"
                        href="https://zapicojunredexter.github.io/nice-shot-creatives/"
                      />
                    </div>
                  </div>
                </div>

                <div className="innovation-item">
                  <div className="innovation-header">
                    <span className="innovation-icon"><PxIcon name="zap" /></span>
                    <h4>Pokedex</h4>
                  </div>
                  <div className="innovation-details">
                    <div className="project-preview">
                      <div className="preview-image">
                        <span className="preview-icon"><PxIcon name="zap" /></span>
                      </div>
                      <div className="preview-info">
                        <span className="project-type">Pokemon Database</span>
                        <span className="project-url">pokedex.com</span>
                      </div>
                    </div>
                    <div className="innovation-tech">
                      <span className="tech-badge">HTML5</span>
                      <span className="tech-badge">CSS3</span>
                      <span className="tech-badge">JavaScript</span>
                    </div>
                    <div className="innovation-description">
                      <p>Simple Pokemon lookup with search</p>
                    </div>
                    <div className="project-features">
                      <span className="feature"><PxIcon name="search" /> Search Functionality</span>
                      <span className="feature"><PxIcon name="smartphone" /> Responsive Design</span>
                      <span className="feature"><PxIcon name="gamepad" /> Pokemon Database</span>
                    </div>
                    <div className="project-preview-frame">
                      <div className="preview-header">
                        <span className="preview-label">Live Preview</span>
                        <a href="https://zapicojunredexter.github.io/pokedex/" target="_blank" rel="noopener noreferrer" className="preview-link">
                          <PxIcon name="external-link" /> Open Full Site
                        </a>
                      </div>
                      <ProjectPreviewFrame
                        src="https://zapicojunredexter.github.io/pokedex/"
                        title="Pokedex Preview"
                        href="https://zapicojunredexter.github.io/pokedex/"
                      />
                    </div>
                  </div>
                </div>

                <div className="innovation-item">
                  <div className="innovation-header">
                    <span className="innovation-icon"><PxIcon name="sun" /></span>
                    <h4>Saint Bernard Beach House</h4>
                  </div>
                  <div className="innovation-details">
                    <div className="project-preview">
                      <div className="preview-image">
                        <span className="preview-icon"><PxIcon name="sun" /></span>
                      </div>
                      <div className="preview-info">
                        <span className="project-type">Vacation Rental</span>
                        <span className="project-url">saintbernardbeach.com</span>
                      </div>
                    </div>
                    <div className="innovation-tech">
                      <span className="tech-badge">HTML5</span>
                      <span className="tech-badge">CSS3</span>
                      <span className="tech-badge">Responsive</span>
                    </div>
                    <div className="innovation-description">
                      <p>Beach house rental site with booking pages</p>
                    </div>
                    <div className="project-features">
                      <span className="feature"><PxIcon name="sun" /> Golden Hour Theme</span>
                      <span className="feature"><PxIcon name="home" /> Property Showcase</span>
                      <span className="feature"><PxIcon name="calendar" /> Reservation System</span>
                    </div>
                    <div className="project-preview-frame">
                      <div className="preview-header">
                        <span className="preview-label">Live Preview</span>
                        <a href="https://zapicojunredexter.github.io/beach-house/" target="_blank" rel="noopener noreferrer" className="preview-link">
                          <PxIcon name="external-link" /> Open Full Site
                        </a>
                      </div>
                      <ProjectPreviewFrame
                        src="https://zapicojunredexter.github.io/beach-house/"
                        title="Saint Bernard Beach House Preview"
                        href="https://zapicojunredexter.github.io/beach-house/"
                      />
                    </div>
                  </div>
                </div>

                <div className="innovation-item">
                  <div className="innovation-header">
                    <span className="innovation-icon"><PxIcon name="cake" /></span>
                    <h4>Patisserie Bakeshop</h4>
                  </div>
                  <div className="innovation-details">
                    <div className="project-preview">
                      <div className="preview-image">
                        <span className="preview-icon"><PxIcon name="cake" /></span>
                      </div>
                      <div className="preview-info">
                        <span className="project-type">French Patisserie</span>
                        <span className="project-url">bakeshop.com</span>
                      </div>
                    </div>
                    <div className="innovation-tech">
                      <span className="tech-badge">HTML5</span>
                      <span className="tech-badge">CSS3</span>
                      <span className="tech-badge">JavaScript</span>
                    </div>
                    <div className="innovation-description">
                      <p>Bakery site with menu and ordering pages</p>
                    </div>
                    <div className="project-features">
                      <span className="feature"><PxIcon name="cake" /> Custom Cakes</span>
                      <span className="feature"><PxIcon name="gift" /> Holiday Collections</span>
                      <span className="feature"><PxIcon name="smartphone" /> Online Ordering</span>
                    </div>
                    <div className="project-preview-frame">
                      <div className="preview-header">
                        <span className="preview-label">Live Preview</span>
                        <a href="https://zapicojunredexter.github.io/bakeshop/" target="_blank" rel="noopener noreferrer" className="preview-link">
                          <PxIcon name="external-link" /> Open Full Site
                        </a>
                      </div>
                      <ProjectPreviewFrame
                        src="https://zapicojunredexter.github.io/bakeshop/"
                        title="Patisserie Bakeshop Preview"
                        href="https://zapicojunredexter.github.io/bakeshop/"
                      />
                    </div>
                  </div>
                </div>

                <div className="innovation-item">
                  <div className="innovation-header">
                    <span className="innovation-icon"><PxIcon name="monitor" /></span>
                    <h4>TerraTech Solutions</h4>
                  </div>
                  <div className="innovation-details">
                    <div className="project-preview">
                      <div className="preview-image">
                        <span className="preview-icon"><PxIcon name="monitor" /></span>
                      </div>
                      <div className="preview-info">
                        <span className="project-type">Tech Company</span>
                        <span className="project-url">terratech.com</span>
                      </div>
                    </div>
                    <div className="innovation-tech">
                      <span className="tech-badge">HTML5</span>
                      <span className="tech-badge">CSS3</span>
                      <span className="tech-badge">JavaScript</span>
                    </div>
                    <div className="innovation-description">
                      <p>Company site for hardware and software services</p>
                    </div>
                    <div className="project-features">
                      <span className="feature"><PxIcon name="sliders" /> Service Showcase</span>
                      <span className="feature"><PxIcon name="cpu" /> Hardware Catalog</span>
                      <span className="feature"><PxIcon name="phone" /> Contact Integration</span>
                    </div>
                    <div className="project-preview-frame">
                      <div className="preview-header">
                        <span className="preview-label">Live Preview</span>
                        <a href="https://zapicojunredexter.github.io/terratech/" target="_blank" rel="noopener noreferrer" className="preview-link">
                          <PxIcon name="external-link" /> Open Full Site
                        </a>
                      </div>
                      <ProjectPreviewFrame
                        src="https://zapicojunredexter.github.io/terratech/"
                        title="TerraTech Solutions Preview"
                        href="https://zapicojunredexter.github.io/terratech/"
                      />
                    </div>
                  </div>
                </div>

                <div className="innovation-item">
                  <div className="innovation-header">
                    <span className="innovation-icon"><PxIcon name="building" /></span>
                    <h4>CE Portfolio</h4>
                  </div>
                  <div className="innovation-details">
                    <div className="project-preview">
                      <div className="preview-image">
                        <span className="preview-icon"><PxIcon name="building" /></span>
                      </div>
                      <div className="preview-info">
                        <span className="project-type">Civil Engineering</span>
                        <span className="project-url">ce-portfolio.com</span>
                      </div>
                    </div>
                    <div className="innovation-tech">
                      <span className="tech-badge">HTML5</span>
                      <span className="tech-badge">CSS3</span>
                      <span className="tech-badge">JavaScript</span>
                    </div>
                    <div className="innovation-description">
                      <p>Civil engineering portfolio site</p>
                    </div>
                    <div className="project-features">
                      <span className="feature"><PxIcon name="building" /> Project Showcase</span>
                      <span className="feature"><PxIcon name="chart" /> Technical Expertise</span>
                      <span className="feature"><PxIcon name="clipboard" /> Professional Certifications</span>
                    </div>
                    <div className="project-preview-frame">
                      <div className="preview-header">
                        <span className="preview-label">Live Preview</span>
                        <a href="https://zapicojunredexter.github.io/ce-portfolio/" target="_blank" rel="noopener noreferrer" className="preview-link">
                          <PxIcon name="external-link" /> Open Full Site
                        </a>
                      </div>
                      <ProjectPreviewFrame
                        src="https://zapicojunredexter.github.io/ce-portfolio/"
                        title="CE Portfolio Preview"
                        href="https://zapicojunredexter.github.io/ce-portfolio/"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="innovation-footer">
                <span className="future-icon"><PxIcon name="sparkle" /></span>
                <p>Personal and client-facing projects with live demos</p>
              </div>
            </div>
          </div>



          {/* Skills Card - Enhanced */}
          <div className="content-card skills-card">
            <div className="card-header">
              <div className="card-icon sparkle"><PxIcon name="star" /></div>
              <h3>Technical Arsenal</h3>
            </div>
            <div className="card-content">
              <div className="skills-categories">
                <div className="skill-category">
                  <div className="category-header">
                    <span className="category-icon"><PxIcon name="briefcase" /></span>
                    <h4>Leadership & Delivery</h4>
                  </div>
                  <p className="skill-focus">Day-to-day management work</p>
                  <div className="skill-tags">
                    <span className="skill-tag architecture">System Architecture</span>
                    <span className="skill-tag management">Department Leadership</span>
                    <span className="skill-tag architecture">Technical Specs</span>
                    <span className="skill-tag cicd">CI/CD</span>
                    <span className="skill-tag management">Code Review</span>
                  </div>
                </div>

                <div className="skill-category">
                  <div className="category-header">
                    <span className="category-icon"><PxIcon name="brush" /></span>
                    <h4>Frontend</h4>
                  </div>
                  <p className="skill-focus">UI and client apps</p>
                  <div className="skill-tags">
                    <span className="skill-tag react">React.js</span>
                    <span className="skill-tag reactnative">React Native</span>
                    <span className="skill-tag ts">TypeScript</span>
                    <span className="skill-tag vue">Vue.js</span>
                    <span className="skill-tag threejs">Three.js</span>
                  </div>
                </div>

                <div className="skill-category">
                  <div className="category-header">
                    <span className="category-icon"><PxIcon name="gear" /></span>
                    <h4>Backend & APIs</h4>
                  </div>
                  <p className="skill-focus">Server-side work</p>
                  <div className="skill-tags">
                    <span className="skill-tag node">Node.js</span>
                    <span className="skill-tag laravel">Laravel</span>
                    <span className="skill-tag php">PHP</span>
                    <span className="skill-tag python">Python</span>
                    <span className="skill-tag express">REST APIs</span>
                  </div>
                </div>

                <div className="skill-category">
                  <div className="category-header">
                    <span className="category-icon"><PxIcon name="cloud" /></span>
                    <h4>Cloud & Data</h4>
                  </div>
                  <p className="skill-focus">Hosting and storage</p>
                  <div className="skill-tags">
                    <span className="skill-tag aws">AWS</span>
                    <span className="skill-tag firebase">Firebase</span>
                    <span className="skill-tag firestore">Firestore</span>
                    <span className="skill-tag dynamodb">DynamoDB</span>
                    <span className="skill-tag mysql">MySQL</span>
                    <span className="skill-tag gcp">GCP</span>
                  </div>
                </div>

                <div className="skill-category">
                  <div className="category-header">
                    <span className="category-icon"><PxIcon name="git-branch" /></span>
                    <h4>Engineering Practice</h4>
                  </div>
                  <p className="skill-focus">How work gets done</p>
                  <div className="skill-tags">
                    <span className="skill-tag git">Git</span>
                    <span className="skill-tag jest">Jest</span>
                    <span className="skill-tag cicd">Automated Deployments</span>
                    <span className="skill-tag architecture">Performance Tuning</span>
                    <span className="skill-tag management">Reliability</span>
                  </div>
                </div>
              </div>
              <div className="expanding-note">
                <span className="growth-icon"><PxIcon name="target" /></span>
                <p>I pick tools based on the problem, not the trend.</p>
              </div>
            </div>
          </div>

          {/* Experience Card - New */}
          <div className="content-card experience-card">
            <div className="card-header">
              <div className="card-icon bounce"><PxIcon name="briefcase" /></div>
              <h3>Professional Journey</h3>
            </div>
            <div className="card-content">
              <div className="timeline">
                <div className="timeline-item current">
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <div className="job-header">
                      <h4>Software Development Manager</h4>
                      <span className="company">@ Vananaz Technologies</span>
                      <span className="duration">Mar 2023 – Present</span>
                    </div>
                    <div className="achievements">
                      <div className="achievement">
                        <PxIcon name="building" /> Plan architecture and cloud setup for production systems
                      </div>
                      <div className="achievement">
                        <PxIcon name="notes" /> Give technical input when specs are being written
                      </div>
                      <div className="achievement">
                        <PxIcon name="zap" /> Work on speed, stability, and maintainability issues
                      </div>
                      <div className="achievement">
                        <PxIcon name="users" /> Manage the development department
                      </div>
                    </div>
                  </div>
                </div>

                <div className="timeline-item">
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <div className="job-header">
                      <h4>Development Lead Supervisor</h4>
                      <span className="company">@ Vananaz Technologies</span>
                      <span className="duration">Oct 2021 – Mar 2023</span>
                    </div>
                    <div className="achievements">
                      <div className="achievement">
                        <PxIcon name="cloud" /> Supported AWS delivery and architecture decisions
                      </div>
                      <div className="achievement">
                        <PxIcon name="notes" /> Helped turn product requests into technical plans
                      </div>
                      <div className="achievement">
                        <PxIcon name="chart" /> Balanced scope, quality, and deadlines across projects
                      </div>
                    </div>
                  </div>
                </div>

                <div className="timeline-item">
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <div className="job-header">
                      <h4>Senior Development Leader</h4>
                      <span className="company">@ Vananaz Technologies</span>
                      <span className="duration">Dec 2019 – Oct 2021</span>
                    </div>
                    <div className="achievements">
                      <div className="achievement">
                        <PxIcon name="globe" /> Built features across React, Laravel, Node, and Firebase
                      </div>
                      <div className="achievement">
                        <PxIcon name="zap" /> Fixed slow parts of existing systems when needed
                      </div>
                      <div className="achievement">
                        <PxIcon name="teach" /> Reviewed code and mentored other developers
                      </div>
                    </div>
                  </div>
                </div>

                <div className="timeline-item">
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <div className="job-header">
                      <h4>Software Engineer</h4>
                      <span className="company">@ Vananaz Technologies</span>
                      <span className="duration">Apr 2018 – Dec 2019</span>
                    </div>
                    <div className="achievements">
                      <div className="achievement">
                        <PxIcon name="smartphone" /> Built web and mobile apps with React and React Native
                      </div>
                      <div className="achievement">
                        <PxIcon name="plug" /> Worked on APIs, automation, and basic CI testing
                      </div>
                      <div className="achievement">
                        <PxIcon name="git-branch" /> Used Git and reviews as part of normal team work
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Final Contact Card */}
          <div className="content-card final-contact-card">
            <div className="card-header">
              <div className="card-icon wave"><PxIcon name="send" /></div>
              <h3>Contact</h3>
            </div>
            <div className="card-content">
              <div className="contact-intro">
                <h4>Want to talk?</h4>
                <p>Email, LinkedIn, GitHub, or the form below.</p>
              </div>
              <div className="contact-methods-grid">
                <div className="contact-method" onClick={() => handleContactCopy('zapicojunredexter@gmail.com', 'Email')}>
                  <span className="contact-icon"><PxIcon name="mail" /></span>
                  <div className="contact-info">
                    <strong>Email</strong>
                    <p className="contact-url">zapicojunredexter@gmail.com</p>
                  </div>
                  <div className="copy-hint">Click to copy</div>
                </div>
                <div className="contact-method" onClick={() => handleContactCopy('https://www.linkedin.com/in/junre-dexter-zapico-23a70413a/', 'LinkedIn')}>
                  <span className="contact-icon"><PxIcon name="linkedin" /></span>
                  <div className="contact-info">
                    <strong>LinkedIn</strong>
                    <p className="contact-url">linkedin.com/in/junre-dexter-zapico-23a70413a</p>
                  </div>
                  <div className="copy-hint">Click to copy</div>
                </div>
                <div className="contact-method" onClick={() => handleContactCopy('https://github.com/zapicojunredexter', 'GitHub')}>
                  <span className="contact-icon"><PxIcon name="github" /></span>
                  <div className="contact-info">
                    <strong>GitHub</strong>
                    <p className="contact-url">github.com/zapicojunredexter</p>
                  </div>
                  <div className="copy-hint">Click to copy</div>
                </div>
                <a
                  className="contact-method resume-link"
                  href={`${process.env.PUBLIC_URL}/resume.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="contact-icon"><PxIcon name="file-text" /></span>
                  <div className="contact-info">
                    <strong>Resume</strong>
                    <p className="contact-url">View or download PDF</p>
                  </div>
                  <div className="copy-hint">Open PDF</div>
                </a>
              </div>
              <div className="opportunities-section">
                <div className="opportunities-header">
                  <span className="opportunity-icon"><PxIcon name="lightbulb" /></span>
                  <h4>Open to Opportunities</h4>
                </div>
                <div className="opportunity-types">
                  <span className="opportunity-tag"><PxIcon name="coffee" /> Coffee Chats</span>
                  <span className="opportunity-tag"><PxIcon name="lightbulb" /> Project Ideas</span>
                  <span className="opportunity-tag"><PxIcon name="briefcase" /> Job Opportunities</span>
                  <span className="opportunity-tag"><PxIcon name="users" /> Collaborations</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form Card */}
          <div className="content-card contact-form-card">
            <div className="card-header">
              <div className="card-icon float"><PxIcon name="mail" /></div>
              <h3>Send Me a Message</h3>
            </div>
            <div className="card-content">
              <div className="form-intro">
                <p>Send a short note and I’ll reply when I can.</p>
              </div>
              <form className="contact-form" onSubmit={handleContactSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="name">
                      <span className="label-icon"><PxIcon name="user" /></span>
                      Your Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">
                      <span className="label-icon"><PxIcon name="mail" /></span>
                      Your Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="subject">
                    <span className="label-icon"><PxIcon name="briefcase" /></span>
                    Subject
                  </label>
                  <select id="subject" name="subject" required>
                    <option value="">What would you like to discuss?</option>
                    <option value="collaboration">Collaboration Opportunity</option>
                    <option value="job">Job Opportunity</option>
                    <option value="project">Project Discussion</option>
                    <option value="consultation">Consultation</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="message">
                    <span className="label-icon"><PxIcon name="pencil" /></span>
                    Your Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    placeholder="Tell me about your project, opportunity, or any questions you have..."
                    required
                  ></textarea>
                </div>
                <button type="submit" className="submit-btn">
                  <span className="btn-icon"><PxIcon name="send" /></span>
                  Send Message
                  <div className="btn-ripple"></div>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Person Character - stays in center */}
        <div
          className={`person-character ${isScrolling ? "walking" : "idle"} ${isJumping ? "jumping" : ""}`}
          style={{
            // Keep translateX(-50%) here — inline transform overrides the CSS centering
            transform: `translateX(-50%) translateY(${characterJump}px)${
              scrollDirection === "up" ? " scaleX(-1)" : ""
            }`,
          }}
        >
          <img
            src={`${process.env.PUBLIC_URL}/person/person${currentPersonFrame}.png`}
            alt="Person Character"
            className="person-sprite"
          />
        </div>

        {/* Direction buttons flanking the character — hold to scroll */}
        <div className="character-nav">
          {canGoLeft && (
            <button
              type="button"
              className="character-nav-btn character-nav-left"
              onPointerDown={startCharacterNav("left")}
              onPointerUp={stopCharacterNav}
              onPointerCancel={stopCharacterNav}
              onLostPointerCapture={stopCharacterNav}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Hold to go left"
            >
              <PxIcon name="arrow-left" />
            </button>
          )}
          {canGoRight && (
            <button
              type="button"
              className="character-nav-btn character-nav-right"
              onPointerDown={startCharacterNav("right")}
              onPointerUp={stopCharacterNav}
              onPointerCancel={stopCharacterNav}
              onLostPointerCapture={stopCharacterNav}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Hold to go right"
            >
              <PxIcon name="arrow-right" />
            </button>
          )}
        </div>

        {/* Chat Bubble - positioned independently */}
        {showChatBubble && !isScrolling && (
          <div className="chat-bubble" onClick={showNewMessage}>
            <div className="chat-bubble-content">
              {chatMessages[currentChatIndex]}
            </div>
            <div className="chat-bubble-tail"></div>
            <div className="chat-bubble-hint">Click to change message</div>
          </div>
        )}

        {/* Copy Notification Popup */}
        {showCopyNotification && (
          <div className="copy-notification">
            <div className="copy-notification-content">
              <span className="copy-icon"><PxIcon name="check" /></span>
              <span className="copy-text">{copyNotificationText}</span>
            </div>
          </div>
        )}
      </div>

      {/* Spacer div to enable scrolling - optimized for fixed 700px card gaps */}
      <div style={{ height: `${gameWidth}px` }}></div>
    </div>
  );
}

export default App;
