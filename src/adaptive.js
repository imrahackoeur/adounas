/**
 * 📱 Solo Adaptive Screen & Device Detection Engine
 * Detects device form factors, orientation, touch capabilities, DPR,
 * and sets dynamic CSS custom properties & root data-attributes.
 */

export function initAdaptive() {
  const root = document.documentElement;

  function updateDeviceMetrics() {
    const width = window.innerWidth || root.clientWidth || document.body.clientWidth;
    const height = window.innerHeight || root.clientHeight || document.body.clientHeight;

    // 1. Device form factor category
    let deviceType = 'desktop';
    if (width <= 380) {
      deviceType = 'compact'; // iPhone SE, ultra-compact phones
    } else if (width < 768) {
      deviceType = 'mobile';  // standard smartphones
    } else if (width <= 1024) {
      deviceType = 'tablet';  // iPads, tablets
    } else if (width <= 1440) {
      deviceType = 'laptop';
    } else {
      deviceType = 'desktop'; // large monitors / ultra-wide
    }

    root.setAttribute('data-device', deviceType);
    root.setAttribute('data-screen-width', width);

    // 2. Screen Orientation
    const isPortrait = height >= width;
    root.setAttribute('data-orientation', isPortrait ? 'portrait' : 'landscape');

    // 3. Touch capability & pointer type
    const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    root.setAttribute('data-pointer', hasTouch ? 'touch' : 'mouse');
    root.setAttribute('data-touch', hasTouch ? 'true' : 'false');

    // 4. Device Pixel Ratio (Retina detection)
    const dpr = window.devicePixelRatio || 1;
    root.setAttribute('data-dpr', dpr >= 2 ? (dpr >= 3 ? '3x' : '2x') : '1x');

    // 5. Dynamic Viewport CSS Units (fixes mobile browser address bar jumps)
    const dvh = height * 0.01;
    const dvw = width * 0.01;
    root.style.setProperty('--vh', `${dvh}px`);
    root.style.setProperty('--vw', `${dvw}px`);
    root.style.setProperty('--app-height', `${height}px`);
    root.style.setProperty('--app-width', `${width}px`);
  }

  // Initial calculation
  updateDeviceMetrics();

  // Listen to resize, orientation changes, and visualViewport
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateDeviceMetrics, 50);
  }, { passive: true });

  window.addEventListener('orientationchange', () => {
    setTimeout(updateDeviceMetrics, 100);
  }, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      root.style.setProperty('--viewport-height', `${window.visualViewport.height}px`);
    }, { passive: true });
  }

  // Fix iOS 100vh scroll issue and smooth fast-tap delay
  document.addEventListener('touchstart', () => {}, { passive: true });
}

// Auto-run when imported
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdaptive);
  } else {
    initAdaptive();
  }
}
