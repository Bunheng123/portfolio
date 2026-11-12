/**
 * Lim Bunheng — Personal Portfolio Scripts
 * Stack: Plain HTML5 + CSS3 + Vanilla JavaScript + Tailwind CSS CDN
 * Features:
 *   - WebGL2 / 2D Topographic contour line canvas over #060608
 *   - Section reveal on scroll (IntersectionObserver, triggers once)
 *   - Fixed navbar with 2px sliding active underline (IntersectionObserver scroll spy)
 *   - Centered scroll line (--p) and Exploring indicator next to Let's talk
 *   - Original Typewriter with multi-phrase rotation & 1s steps cursor
 *   - Interactive 3D Lanyard ID card with idle sway & physics tilt
 *   - Full prefers-reduced-motion accessibility support
 */

document.addEventListener("DOMContentLoaded", () => {
  initTopographicCanvas();
  initSectionObserver();
  initNavigation();
  initScrollProgress();
  initTypewriter();
  initLanyardInteraction();
  initTickerControls();
});

/* ==========================================================================
   1. FULL-SCREEN TOPOGRAPHIC CONTOUR CANVAS (#060608)
   ========================================================================== */
function initTopographicCanvas() {
  const canvas = document.getElementById("topo-canvas");
  if (!canvas) return;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  });

  if (gl) {
    runWebGLTopo(gl, canvas, motionQuery);
  } else {
    run2DTopoFallback(canvas, motionQuery);
  }
}

function runWebGLTopo(gl, canvas, motionQuery) {
  const vsSource = `#version 300 es
    in vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fsSource = `#version 300 es
    precision highp float;

    out vec4 fragColor;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_mouse;

    vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
        + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
        dot(x12.zw, x12.zw)), 0.0);
      m = m * m;
      m = m * m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      vec3 g;
      g.x  = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    float fbm(vec2 p) {
      float total = 0.0;
      total += 0.56 * snoise(p);
      total += 0.28 * snoise(p * 2.04 + vec2(1.7, 9.2));
      total += 0.16 * snoise(p * 4.08 + vec2(8.3, 2.8));
      return total;
    }

    void main() {
      vec2 st = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);

      float t = u_time * 0.035;
      vec2 pos = st * 1.55 + vec2(t * 0.16, t * 0.11);

      vec2 mNorm = (u_mouse * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
      float mDist = length(st - mNorm);
      pos += normalize(st - mNorm + 0.0001) * exp(-mDist * 2.4) * 0.12;

      float warp = fbm(pos * 0.85 + vec2(t * 0.04, 0.0));
      float elevation = fbm(pos + vec2(warp * 0.55, warp * 0.42));

      float height = (elevation + 1.0) * 8.5;

      float lineDist = abs(fract(height) - 0.5) * 2.0;
      float d = fwidth(height);
      float line = 1.0 - smoothstep(0.0, d * 1.6, lineDist);

      float indexHeight = height * 0.2;
      float indexDist = abs(fract(indexHeight) - 0.5) * 2.0;
      float indexD = fwidth(indexHeight);
      float indexLine = 1.0 - smoothstep(0.0, indexD * 2.2, indexDist);

      // Matte Black Background (#060608)
      vec3 bg = vec3(0.0235, 0.0235, 0.0314);

      // Crisp slate-white line tint
      vec3 lineCol = vec3(0.88, 0.90, 0.94);

      float alpha = clamp(line * 0.13 + indexLine * 0.26, 0.0, 0.75);
      vec3 finalColor = mix(bg, lineCol, alpha);

      fragColor = vec4(finalColor, 1.0);
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(program));
    return;
  }

  gl.useProgram(program);

  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]),
    gl.STATIC_DRAW
  );

  const posLoc = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const resLoc = gl.getUniformLocation(program, "u_resolution");
  const timeLoc = gl.getUniformLocation(program, "u_time");
  const mouseLoc = gl.getUniformLocation(program, "u_mouse");

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let targetMouseX = mouseX;
  let targetMouseY = mouseY;

  window.addEventListener("pointermove", (e) => {
    targetMouseX = e.clientX;
    targetMouseY = window.innerHeight - e.clientY;
  }, { passive: true });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();

  let startTime = performance.now();
  let animationFrameId = null;

  function render(now) {
    if (document.hidden) {
      animationFrameId = requestAnimationFrame(render);
      return;
    }

    const elapsed = (now - startTime) * 0.001;
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    gl.useProgram(program);
    gl.uniform2f(resLoc, canvas.width, canvas.height);
    gl.uniform1f(timeLoc, motionQuery.matches ? 0.0 : elapsed);
    gl.uniform2f(
      mouseLoc,
      mouseX * Math.min(window.devicePixelRatio || 1, 1.5),
      mouseY * Math.min(window.devicePixelRatio || 1, 1.5)
    );

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (!motionQuery.matches) {
      animationFrameId = requestAnimationFrame(render);
    }
  }

  animationFrameId = requestAnimationFrame(render);

  motionQuery.addEventListener("change", (e) => {
    if (e.matches) {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      render(startTime);
    } else {
      startTime = performance.now();
      animationFrameId = requestAnimationFrame(render);
    }
  });
}

function run2DTopoFallback(canvas, motionQuery) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  let t = 0;
  function draw() {
    ctx.fillStyle = "#060608";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(228, 228, 231, 0.12)";
    ctx.lineWidth = 1;

    const lines = 18;
    const spacing = canvas.height / (lines - 1);

    for (let i = 0; i < lines; i++) {
      ctx.beginPath();
      const baseY = i * spacing;
      for (let x = 0; x <= canvas.width; x += 12) {
        const wave1 = Math.sin(x * 0.003 + t + i * 0.4) * 35;
        const wave2 = Math.cos(x * 0.006 - t * 0.8 + i * 0.2) * 18;
        const y = baseY + wave1 + wave2;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    if (!motionQuery.matches && !document.hidden) {
      t += 0.008;
      requestAnimationFrame(draw);
    }
  }

  draw();
}

/* ==========================================================================
   2. SECTION REVEAL OBSERVER (FADE-UP ONCE)
   ========================================================================== */
function initSectionObserver() {
  const nodes = document.querySelectorAll(".reveal");
  if (!nodes.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  nodes.forEach((node) => observer.observe(node));
}

/* ==========================================================================
   3. FIXED NAVBAR & INTERSECTIONOBSERVER SCROLL SPY
   ========================================================================== */
function initNavigation() {
  const toggleBtn = document.querySelector(".mobile-toggle");
  const mobileMenu = document.getElementById("mobileMenu");
  const navMenu = document.getElementById("navMenu");
  const navLinks = document.querySelectorAll(".nav-link");
  const indicator = document.getElementById("navIndicator");
  const sections = document.querySelectorAll("main section[id]");

  // Hamburger toggle with aria-expanded & Escape key listener
  if (toggleBtn && mobileMenu) {
    toggleBtn.addEventListener("click", () => {
      const isExpanded = toggleBtn.getAttribute("aria-expanded") === "true";
      const nextState = !isExpanded;
      toggleBtn.setAttribute("aria-expanded", String(nextState));
      mobileMenu.classList.toggle("hidden", !nextState);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !mobileMenu.classList.contains("hidden")) {
        mobileMenu.classList.add("hidden");
        toggleBtn.setAttribute("aria-expanded", "false");
        toggleBtn.focus();
      }
    });

    const mobileLinks = mobileMenu.querySelectorAll("a");
    mobileLinks.forEach((link) => {
      link.addEventListener("click", () => {
        mobileMenu.classList.add("hidden");
        toggleBtn.setAttribute("aria-expanded", "false");
      });
    });
  }

  let isInitialLoad = true;

  const sectionNavMap = {
    home: "#home",
    about: "#about",
    skills: "#skills",
    projects: "#projects",
    experience: "#about",
    contact: "#contact",
  };

  // 2px sliding underline movement on desktop
  function moveIndicator(link, animate = true) {
    if (!indicator || !link || !navMenu) return;

    if (window.getComputedStyle(navMenu).display === "none") {
      indicator.style.opacity = "0";
      return;
    }

    const shouldAnimate = Boolean(animate && !isInitialLoad && indicator.classList.contains("is-ready"));

    if (!shouldAnimate) {
      indicator.style.transition = "none";
    }

    const linkRect = link.getBoundingClientRect();
    const menuRect = navMenu.getBoundingClientRect();

    indicator.style.width = `${linkRect.width}px`;
    indicator.style.transform = `translateX(${linkRect.left - menuRect.left}px)`;
    indicator.style.opacity = "1";

    if (!shouldAnimate) {
      void indicator.offsetWidth;
      if (indicator.classList.contains("is-ready")) {
        indicator.style.transition = "";
      }
    }
  }

  function setActive(targetHref, animate = true) {
    let matchedLink = null;
    navLinks.forEach((link) => {
      const isMatch = link.getAttribute("href") === targetHref;
      link.classList.toggle("active", isMatch);
      if (isMatch) matchedLink = link;
    });

    if (matchedLink) {
      moveIndicator(matchedLink, animate);
    }
  }

  // Detect which link should be active on initial page load
  function getInitialActiveLink() {
    if (window.location.hash) {
      const hashLink = document.querySelector(`#navMenu a[href="${window.location.hash}"]`);
      if (hashLink) return hashLink;
    }

    if (window.scrollY > 80) {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60) {
        const contactLink = document.querySelector('#navMenu a[href="#contact"]');
        if (contactLink) return contactLink;
      }

      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.45 && rect.bottom >= 100) {
          const id = section.getAttribute("id");
          const targetHref = sectionNavMap[id] || `#${id}`;
          const matched = document.querySelector(`#navMenu a[href="${targetHref}"]`);
          if (matched) return matched;
        }
      }
    }

    return document.querySelector("#navMenu .nav-link.active") || navLinks[0];
  }

  // Immediately position the indicator under the target link with zero animation (no sliding from left to right)
  const initialLink = getInitialActiveLink();
  if (initialLink) {
    const initialHref = initialLink.getAttribute("href");
    setActive(initialHref, false);
    moveIndicator(initialLink, false);
  }

  // Once fonts & initial layout settle, confirm exact coordinates and enable smooth transitions for user interaction
  function finalizeInitialPosition() {
    const activeLink = document.querySelector("#navMenu .nav-link.active") || initialLink;
    if (activeLink) {
      moveIndicator(activeLink, false);
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        indicator.classList.add("is-ready");
        isInitialLoad = false;
      });
    });
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(finalizeInitialPosition);
  } else {
    setTimeout(finalizeInitialPosition, 50);
  }

  // Hover states: slide indicator smoothly on hover, restore active on mouseleave
  navLinks.forEach((link) => {
    link.addEventListener("mouseenter", () => {
      moveIndicator(link, true);
    });

    link.addEventListener("click", () => {
      setActive(link.getAttribute("href"), true);
    });
  });

  navMenu?.addEventListener("mouseleave", () => {
    const activeLink = document.querySelector("#navMenu .nav-link.active") || navLinks[0];
    if (activeLink) {
      moveIndicator(activeLink, true);
    }
  });

  // IntersectionObserver for scroll spy active link updates
  const observerOptions = {
    root: null,
    rootMargin: "-25% 0px -55% 0px",
    threshold: 0,
  };

  const navObserver = new IntersectionObserver((entries) => {
    if (isInitialLoad) return;
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute("id");
        const targetHref = sectionNavMap[id] || `#${id}`;
        setActive(targetHref, true);
      }
    });
  }, observerOptions);

  sections.forEach((section) => navObserver.observe(section));

  // Boundary scroll listener for top and bottom edge snapping
  window.addEventListener(
    "scroll",
    () => {
      if (isInitialLoad) return;
      if (window.scrollY < 80) {
        setActive("#home", true);
      } else if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 60
      ) {
        setActive("#contact", true);
      }
    },
    { passive: true }
  );

  window.addEventListener(
    "resize",
    () => {
      const activeLink = document.querySelector("#navMenu .nav-link.active") || navLinks[0];
      if (activeLink) moveIndicator(activeLink, false);
    },
    { passive: true }
  );
}

/* ==========================================================================
   4. SCROLL LINE & "EXPLORING" INDICATOR (ONE PASSIVE SCROLL LISTENER + RAF)
   ========================================================================== */
function initScrollProgress() {
  const scrollLine = document.getElementById("scrollLine");
  const ringBar = document.getElementById("progressRingBar");
  const checkIcon = document.getElementById("progressCheck");
  const labelEl = document.getElementById("scrollLabel");
  const percentEl = document.getElementById("scrollPercent");
  const ringWrap = document.getElementById("ringWrap");

  if (!scrollLine || !ringBar || !percentEl) return;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ringCircumference = 50.27; // 2 * Math.PI * 8

  let maxScroll = 1;
  let targetProgress = 0;
  let targetPercent = 0;
  let displayedPercent = 0;
  let isCompleted = false;
  let scrollTicking = false;
  let easeRafId = null;

  function calculateMaxScroll() {
    maxScroll = Math.max(
      1,
      document.documentElement.scrollHeight - window.innerHeight
    );
  }

  function updateEasedPercentage() {
    if (motionQuery.matches) {
      displayedPercent = targetPercent;
      percentEl.textContent = `${targetPercent}%`;
      easeRafId = null;
      return;
    }

    const diff = targetPercent - displayedPercent;
    if (Math.abs(diff) < 0.1) {
      displayedPercent = targetPercent;
      percentEl.textContent = `${targetPercent}%`;
      easeRafId = null;
    } else {
      displayedPercent += diff * 0.15;
      percentEl.textContent = `${Math.round(displayedPercent)}%`;
      easeRafId = requestAnimationFrame(updateEasedPercentage);
    }
  }

  function updateProgress() {
    calculateMaxScroll();
    const raw = window.scrollY / maxScroll;
    targetProgress = Math.max(0, Math.min(1, raw));
    targetPercent = Math.round(targetProgress * 100);

    // 1. Update scroll line (--p) from center outward
    scrollLine.style.setProperty("--p", targetProgress.toFixed(4));

    // 2. Update ring dashoffset
    const offset = ringCircumference * (1 - targetProgress);
    ringBar.style.strokeDashoffset = offset.toFixed(2);

    // 3. Update percentage easing
    if (motionQuery.matches) {
      displayedPercent = targetPercent;
      percentEl.textContent = `${targetPercent}%`;
    } else {
      if (!easeRafId) {
        easeRafId = requestAnimationFrame(updateEasedPercentage);
      }
    }

    // 4. Handle 100% completion state
    if (targetPercent >= 100) {
      if (!isCompleted) {
        isCompleted = true;
        if (labelEl) labelEl.textContent = "Explored";
        ringBar.setAttribute("fill", "#FFFFFF");
        if (checkIcon) checkIcon.classList.remove("hidden");

        if (ringWrap && !motionQuery.matches) {
          ringWrap.classList.remove("ring-pulse");
          void ringWrap.offsetWidth; // Force reflow
          ringWrap.classList.add("ring-pulse");
        }
      }
    } else {
      if (isCompleted) {
        isCompleted = false;
        if (labelEl) labelEl.textContent = "Exploring";
        ringBar.setAttribute("fill", "none");
        if (checkIcon) checkIcon.classList.add("hidden");
        if (ringWrap) ringWrap.classList.remove("ring-pulse");
      }
    }
  }

  // ONE passive scroll listener with requestAnimationFrame throttling
  window.addEventListener(
    "scroll",
    () => {
      if (!scrollTicking) {
        requestAnimationFrame(() => {
          updateProgress();
          scrollTicking = false;
        });
        scrollTicking = true;
      }
    },
    { passive: true }
  );

  window.addEventListener(
    "resize",
    () => {
      calculateMaxScroll();
      updateProgress();
    },
    { passive: true }
  );

  // Initial calculation on load
  calculateMaxScroll();
  updateProgress();
}

/* ==========================================================================
   5. TYPEWRITER (ORIGINAL MULTI-PHRASE IMPLEMENTATION)
   ========================================================================== */
function initTypewriter() {
  const textEl = document.getElementById("typewriterText");
  const cursorEl = document.getElementById("typewriterCursor");
  if (!textEl) return;

  const phrases = [
    "I build full-stack web applications.",
    "I create modern, responsive user interfaces.",
    "I develop and integrate RESTful APIs.",
    "I implement JWT authentication and RBAC.",
  ];

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (motionQuery.matches) {
    textEl.textContent = phrases[0];
    if (cursorEl) cursorEl.style.display = "none";
    return;
  }

  let phraseIndex = 0;
  let charIndex = phrases[0].length;
  let isDeleting = false;
  let typingTimeout = null;

  const typeSpeed = 85;
  const deleteSpeed = 40;
  const pauseComplete = 1800;
  const pauseEmpty = 450;

  function tick() {
    if (document.hidden) {
      typingTimeout = setTimeout(tick, 300);
      return;
    }

    const currentPhrase = phrases[phraseIndex];

    if (isDeleting) {
      charIndex--;
      textEl.textContent = currentPhrase.substring(0, charIndex);
    } else {
      charIndex++;
      textEl.textContent = currentPhrase.substring(0, charIndex);
    }

    let nextDelay = isDeleting ? deleteSpeed : typeSpeed;

    if (!isDeleting && charIndex === currentPhrase.length) {
      nextDelay = pauseComplete;
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      nextDelay = pauseEmpty;
    }

    typingTimeout = setTimeout(tick, nextDelay);
  }

  typingTimeout = setTimeout(() => {
    isDeleting = true;
    tick();
  }, pauseComplete);

  motionQuery.addEventListener("change", (event) => {
    if (event.matches) {
      clearTimeout(typingTimeout);
      textEl.textContent = phrases[0];
      if (cursorEl) cursorEl.style.display = "none";
    } else {
      if (cursorEl) cursorEl.style.display = "";
      isDeleting = false;
      charIndex = textEl.textContent.length;
      tick();
    }
  });
}

/* ==========================================================================
   6. INTERACTIVE 3D LANYARD ID CARD
   ========================================================================== */
function initLanyardInteraction() {
  const scene = document.getElementById("lanyardScene");
  const cardWrapper = document.getElementById("lanyardCardWrapper");
  const strap = scene ? scene.querySelector(".lanyard-strap-container") : null;
  if (!scene || !cardWrapper) return;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (motionQuery.matches) return;

  let isInteracting = false;
  let targetRotX = 0;
  let targetRotY = 0;
  let targetStrapRot = 0;
  let currentRotX = 0;
  let currentRotY = 0;
  let currentStrapRot = 0;
  let rafId = null;

  function renderPhysics() {
    if (isInteracting) {
      currentRotX += (targetRotX - currentRotX) * 0.12;
      currentRotY += (targetRotY - currentRotY) * 0.12;
      currentStrapRot += (targetStrapRot - currentStrapRot) * 0.12;

      cardWrapper.style.transform = `rotateX(${currentRotX.toFixed(2)}deg) rotateY(${currentRotY.toFixed(2)}deg) translateY(-2px)`;
      if (strap) {
        strap.style.transform = `rotate(${currentStrapRot.toFixed(2)}deg)`;
      }

      rafId = requestAnimationFrame(renderPhysics);
    }
  }

  scene.addEventListener("pointermove", (event) => {
    isInteracting = true;
    cardWrapper.classList.remove("lanyard-swaying");

    const rect = scene.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = event.clientX - centerX;
    const deltaY = event.clientY - centerY;

    targetRotX = Math.max(-16, Math.min(16, (-deltaY / (rect.height / 2)) * 14));
    targetRotY = Math.max(-18, Math.min(18, (deltaX / (rect.width / 2)) * 16));
    targetStrapRot = Math.max(-8, Math.min(8, (deltaX / (rect.width / 2)) * 6));

    if (!rafId) {
      rafId = requestAnimationFrame(renderPhysics);
    }
  });

  function resetCard() {
    isInteracting = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    cardWrapper.style.transition = "transform 0.6s cubic-bezier(0.2, 1, 0.4, 1)";
    if (strap) strap.style.transition = "transform 0.6s cubic-bezier(0.2, 1, 0.4, 1)";

    cardWrapper.style.transform = "rotateX(0deg) rotateY(0deg) translateY(0)";
    if (strap) strap.style.transform = "rotate(0deg)";

    setTimeout(() => {
      cardWrapper.style.transition = "";
      if (strap) strap.style.transition = "";
      currentRotX = 0;
      currentRotY = 0;
      currentStrapRot = 0;
      if (!isInteracting && !motionQuery.matches) {
        cardWrapper.classList.add("lanyard-swaying");
      }
    }, 600);
  }

  scene.addEventListener("pointerleave", resetCard);
  scene.addEventListener("pointerup", resetCard);

  motionQuery.addEventListener("change", (e) => {
    if (e.matches) {
      resetCard();
      cardWrapper.classList.remove("lanyard-swaying");
    }
  });
}

/* ==========================================================================
   7. TICKER CONTROLS (CLICK OR KEYBOARD TO PAUSE/RESUME)
   ========================================================================== */
function initTickerControls() {
  const tracks = document.querySelectorAll(".tech-track");
  tracks.forEach((track) => {
    track.addEventListener("click", () => {
      track.classList.toggle("is-paused");
    });
    track.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        track.classList.toggle("is-paused");
      }
    });
  });
}
