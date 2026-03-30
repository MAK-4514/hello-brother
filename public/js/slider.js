/**
 * Hero Slider
 * Automatic image slider with smooth transitions and dot navigation
 */
(function() {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.slider-dot');
  let currentSlide = 0;
  let slideInterval;
  const SLIDE_DURATION = 5000; // 5 seconds per slide

  function goToSlide(index) {
    // Remove active from all
    slides.forEach(s => s.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));

    // Set active
    currentSlide = index;
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
  }

  function nextSlide() {
    const next = (currentSlide + 1) % slides.length;
    goToSlide(next);
  }

  function startAutoplay() {
    slideInterval = setInterval(nextSlide, SLIDE_DURATION);
  }

  function stopAutoplay() {
    clearInterval(slideInterval);
  }

  // Dot click navigation
  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const slideIndex = parseInt(dot.getAttribute('data-slide'));
      goToSlide(slideIndex);
      stopAutoplay();
      startAutoplay(); // Restart timer
    });
  });

  // Touch/swipe support for mobile
  let touchStartX = 0;
  let touchEndX = 0;
  const slider = document.getElementById('hero-slider');

  if (slider) {
    slider.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    slider.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > 50) {
        stopAutoplay();
        if (diff > 0) {
          // Swipe left — next
          nextSlide();
        } else {
          // Swipe right — prev
          const prev = (currentSlide - 1 + slides.length) % slides.length;
          goToSlide(prev);
        }
        startAutoplay();
      }
    }, { passive: true });
  }

  // Initialize
  if (slides.length > 0) {
    goToSlide(0);
    startAutoplay();
  }
})();
