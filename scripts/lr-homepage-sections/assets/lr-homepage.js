/**
 * LR Homepage Sections - JavaScript
 * Carousel functionality for past events and sponsors
 */
(function($) {
    'use strict';

    // Past Events Carousel
    function initPastEventsCarousel() {
        var $containers = $('.lr-carousel-container');
        
        $containers.each(function() {
            var $container = $(this);
            var $track = $container.find('.lr-carousel-track');
            var $items = $container.find('.lr-carousel-item');
            var $prevBtn = $container.find('.lr-carousel-prev');
            var $nextBtn = $container.find('.lr-carousel-next');
            
            if ($items.length === 0) return;
            
            var currentIndex = 0;
            var itemWidth = $items.first().outerWidth(true);
            var visibleItems = Math.floor($container.width() / itemWidth) || 1;
            var maxIndex = Math.max(0, $items.length - visibleItems);
            
            function updateCarousel() {
                var offset = -currentIndex * itemWidth;
                $track.css('transform', 'translateX(' + offset + 'px)');
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
            
            $nextBtn.on('click', function() {
                if (currentIndex < maxIndex) {
                    currentIndex++;
                } else {
                    currentIndex = 0;
                }
                updateCarousel();
            });
            
            $prevBtn.on('click', function() {
                if (currentIndex > 0) {
                    currentIndex--;
                } else {
                    currentIndex = maxIndex;
                }
                updateCarousel();
            });
            
            // Auto-play
            var autoplayInterval = setInterval(function() {
                if (currentIndex < maxIndex) {
                    currentIndex++;
                } else {
                    currentIndex = 0;
                }
                updateCarousel();
            }, 4000);
            
            // Pause on hover
            $container.on('mouseenter', function() {
                clearInterval(autoplayInterval);
            });
            
            $container.on('mouseleave', function() {
                autoplayInterval = setInterval(function() {
                    if (currentIndex < maxIndex) {
                        currentIndex++;
                    } else {
                        currentIndex = 0;
                    }
                    updateCarousel();
                }, 4000);
            });
            
            // Recalculate on resize
            $(window).on('resize', function() {
                recalculate();
            });
            
            // Touch support
            var touchStartX = 0;
            var touchEndX = 0;
            
            $track[0].addEventListener('touchstart', function(e) {
                touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });
            
            $track[0].addEventListener('touchend', function(e) {
                touchEndX = e.changedTouches[0].screenX;
                var diff = touchStartX - touchEndX;
                if (Math.abs(diff) > 50) {
                    if (diff > 0) {
                        // Swipe left - next
                        $nextBtn.trigger('click');
                    } else {
                        // Swipe right - prev
                        $prevBtn.trigger('click');
                    }
                }
            }, { passive: true });
        });
    }

    // Sponsors carousel - pause on hover
    function initSponsorsCarousel() {
        var $track = $('.lr-sponsors-track');
        
        $track.on('mouseenter', function() {
            $(this).css('animation-play-state', 'paused');
        });
        
        $track.on('mouseleave', function() {
            $(this).css('animation-play-state', 'running');
        });
    }

    // Hero Slider
    function initHeroSlider() {
        var $slider = $('.lr-hero-slider');
        if ($slider.length === 0) return;

        var $track = $slider.find('.lr-hero-track');
        var $slides = $track.children('.lr-hero-slide');
        var $dotsContainer = $slider.find('.lr-hero-dots');
        var $prevBtn = $slider.find('.lr-hero-prev');
        var $nextBtn = $slider.find('.lr-hero-next');
        var totalSlides = $slides.length;
        var currentSlide = 0;
        var autoplayDelay = parseInt($slider.data('autoplay')) || 5000;
        var autoplayTimer;

        if (totalSlides <= 1) return;

        // Create dots
        for (var i = 0; i < totalSlides; i++) {
            var dot = $('<span class="lr-hero-dot" data-index="' + i + '"></span>');
            if (i === 0) dot.addClass('active');
            $dotsContainer.append(dot);
        }

        var $dots = $dotsContainer.find('.lr-hero-dot');

        function goToSlide(index) {
            if (index < 0) index = totalSlides - 1;
            if (index >= totalSlides) index = 0;
            currentSlide = index;
            $track.css('transform', 'translateX(-' + (currentSlide * 100) + '%)');
            $dots.removeClass('active');
            $dots.eq(currentSlide).addClass('active');
        }

        function startAutoplay() {
            stopAutoplay();
            autoplayTimer = setInterval(function() {
                goToSlide(currentSlide + 1);
            }, autoplayDelay);
        }

        function stopAutoplay() {
            if (autoplayTimer) clearInterval(autoplayTimer);
        }

        $nextBtn.on('click', function() {
            goToSlide(currentSlide + 1);
            startAutoplay();
        });

        $prevBtn.on('click', function() {
            goToSlide(currentSlide - 1);
            startAutoplay();
        });

        $dots.on('click', function() {
            goToSlide($(this).data('index'));
            startAutoplay();
        });

        // Pause on hover
        $slider.on('mouseenter', function() {
            stopAutoplay();
        });

        $slider.on('mouseleave', function() {
            startAutoplay();
        });

        // Touch support
        var touchStartX = 0;
        $track[0].addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
            stopAutoplay();
        }, { passive: true });

        $track[0].addEventListener('touchend', function(e) {
            var diff = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    goToSlide(currentSlide + 1);
                } else {
                    goToSlide(currentSlide - 1);
                }
            }
            startAutoplay();
        }, { passive: true });

        startAutoplay();
    }

    // Initialize on DOM ready
    $(document).ready(function() {
        initHeroSlider();
        initPastEventsCarousel();
        initSponsorsCarousel();
    });

})(jQuery);
