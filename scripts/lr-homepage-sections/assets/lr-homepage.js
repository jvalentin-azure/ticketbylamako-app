/**
 * LR Homepage Sections - JavaScript
 * Carousel functionality for past events and sponsors
 */
(function ($) {
  "use strict";

  // Past Events Carousel
  function initPastEventsCarousel() {
    let $containers = $(".lr-carousel-container");

    $containers.each(function () {
      let $container = $(this);
      let $track = $container.find(".lr-carousel-track");
      let $items = $container.find(".lr-carousel-item");
      let $prevBtn = $container.find(".lr-carousel-prev");
      let $nextBtn = $container.find(".lr-carousel-next");

      if ($items.length === 0) return;

      let currentIndex = 0;
      let itemWidth = $items.first().outerWidth(true);
      let visibleItems = Math.floor($container.width() / itemWidth) || 1;
      let maxIndex = Math.max(0, $items.length - visibleItems);

      function updateCarousel() {
        let offset = -currentIndex * itemWidth;
        $track.css("transform", "translateX(" + offset + "px)");
      }

      function recalculate() {
        itemWidth = $items.first().outerWidth(true);
        visibleItems = Math.floor(($container.width() - 100) / itemWidth) || 1;
        maxIndex = Math.max(0, $items.length - visibleItems);
        if (currentIndex > maxIndex) {
          currentIndex = maxIndex;
        }
        updateCarousel();
      }

      $nextBtn.on("click", function () {
        if (currentIndex < maxIndex) {
          currentIndex++;
        } else {
          currentIndex = 0;
        }
        updateCarousel();
      });

      $prevBtn.on("click", function () {
        if (currentIndex > 0) {
          currentIndex--;
        } else {
          currentIndex = maxIndex;
        }
        updateCarousel();
      });

      // Auto-play
      let autoplayInterval = setInterval(function () {
        if (currentIndex < maxIndex) {
          currentIndex++;
        } else {
          currentIndex = 0;
        }
        updateCarousel();
      }, 4000);

      // Pause on hover
      $container.on("mouseenter", function () {
        clearInterval(autoplayInterval);
      });

      $container.on("mouseleave", function () {
        autoplayInterval = setInterval(function () {
          if (currentIndex < maxIndex) {
            currentIndex++;
          } else {
            currentIndex = 0;
          }
          updateCarousel();
        }, 4000);
      });

      // Recalculate on resize
      $(window).on("resize", function () {
        recalculate();
      });

      // Touch support
      let touchStartX = 0;
      let touchEndX = 0;

      $track[0].addEventListener(
        "touchstart",
        function (e) {
          touchStartX = e.changedTouches[0].screenX;
        },
        { passive: true },
      );

      $track[0].addEventListener(
        "touchend",
        function (e) {
          touchEndX = e.changedTouches[0].screenX;
          let diff = touchStartX - touchEndX;
          if (Math.abs(diff) > 50) {
            if (diff > 0) {
              // Swipe left - next
              $nextBtn.trigger("click");
            } else {
              // Swipe right - prev
              $prevBtn.trigger("click");
            }
          }
        },
        { passive: true },
      );
    });
  }

  // Sponsors carousel - pause on hover
  function initSponsorsCarousel() {
    let $track = $(".lr-sponsors-track");

    $track.on("mouseenter", function () {
      $(this).css("animation-play-state", "paused");
    });

    $track.on("mouseleave", function () {
      $(this).css("animation-play-state", "running");
    });
  }

  // Hero Slider
  function initHeroSlider() {
    let $slider = $(".lr-hero-slider");
    if ($slider.length === 0) return;

    let $track = $slider.find(".lr-hero-track");
    let $slides = $track.children(".lr-hero-slide");
    let $dotsContainer = $slider.find(".lr-hero-dots");
    let $prevBtn = $slider.find(".lr-hero-prev");
    let $nextBtn = $slider.find(".lr-hero-next");
    let totalSlides = $slides.length;
    let currentSlide = 0;
    let autoplayDelay = parseInt($slider.data("autoplay")) || 5000;
    let autoplayTimer;

    if (totalSlides <= 1) return;

    // Create dots
    for (let i = 0; i < totalSlides; i++) {
      let dot = $('<span class="lr-hero-dot" data-index="' + i + '"></span>');
      if (i === 0) dot.addClass("active");
      $dotsContainer.append(dot);
    }

    let $dots = $dotsContainer.find(".lr-hero-dot");

    function goToSlide(index) {
      if (index < 0) index = totalSlides - 1;
      if (index >= totalSlides) index = 0;
      currentSlide = index;
      $track.css("transform", "translateX(-" + currentSlide * 100 + "%)");
      $dots.removeClass("active");
      $dots.eq(currentSlide).addClass("active");
    }

    function startAutoplay() {
      stopAutoplay();
      autoplayTimer = setInterval(function () {
        goToSlide(currentSlide + 1);
      }, autoplayDelay);
    }

    function stopAutoplay() {
      if (autoplayTimer) clearInterval(autoplayTimer);
    }

    $nextBtn.on("click", function () {
      goToSlide(currentSlide + 1);
      startAutoplay();
    });

    $prevBtn.on("click", function () {
      goToSlide(currentSlide - 1);
      startAutoplay();
    });

    $dots.on("click", function () {
      goToSlide($(this).data("index"));
      startAutoplay();
    });

    // Pause on hover
    $slider.on("mouseenter", function () {
      stopAutoplay();
    });

    $slider.on("mouseleave", function () {
      startAutoplay();
    });

    // Touch support
    let touchStartX = 0;
    $track[0].addEventListener(
      "touchstart",
      function (e) {
        touchStartX = e.changedTouches[0].screenX;
        stopAutoplay();
      },
      { passive: true },
    );

    $track[0].addEventListener(
      "touchend",
      function (e) {
        let diff = touchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 50) {
          if (diff > 0) {
            goToSlide(currentSlide + 1);
          } else {
            goToSlide(currentSlide - 1);
          }
        }
        startAutoplay();
      },
      { passive: true },
    );

    startAutoplay();
  }

  // Initialize on DOM ready
  $(document).ready(function () {
    initHeroSlider();
    initPastEventsCarousel();
    initSponsorsCarousel();
  });
})(jQuery);
