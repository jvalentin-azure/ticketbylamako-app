<?php
/**
 * Plugin Name: LR Homepage Sections
 * Description: Custom homepage shortcodes for TicketByLamako - displays Tickera events, LamakoRewards banner, sponsors carousel
 * Version: 1.0.0
 * Author: Lamako Events
 * Text Domain: lr-homepage
 */

if (!defined('ABSPATH')) exit;

class LR_Homepage_Sections {

    public function __construct() {
        add_shortcode('lr_hero_slider', [$this, 'hero_slider']);
        add_shortcode('lr_upcoming_events', [$this, 'upcoming_events']);
        add_shortcode('lr_past_events', [$this, 'past_events']);
        add_shortcode('lr_lamako_rewards_banner', [$this, 'rewards_banner']);
        add_shortcode('lr_sponsors_carousel', [$this, 'sponsors_carousel']);
        add_shortcode('lr_event_search', [$this, 'event_search']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
    }

    /**
     * [lr_hero_slider] - Full-width hero slider with upcoming events + static promo slides
     */
    public function hero_slider($atts) {
        $atts = shortcode_atts([
            'count' => 3,
            'autoplay' => 5000,
        ], $atts);

        $now = current_time('timestamp');
        
        $events = $this->get_tickera_events([
            'posts_per_page' => intval($atts['count']),
            'meta_query' => [
                [
                    'key' => 'event_date_time',
                    'value' => $now,
                    'compare' => '>=',
                    'type' => 'NUMERIC',
                ],
            ],
        ]);

        ob_start();
        ?>
        <div class="lr-hero-slider" data-autoplay="<?php echo esc_attr($atts['autoplay']); ?>">
            <div class="lr-hero-track">
                <?php 
                // Slide 1: LamakoRewards promo
                ?>
                <div class="lr-hero-slide lr-hero-slide-promo lr-hero-slide-rewards">
                    <div class="lr-hero-slide-bg" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);"></div>
                    <div class="lr-hero-slide-content">
                        <span class="lr-hero-tag">Programme de fidélité</span>
                        <h2 class="lr-hero-title">LamakoRewards</h2>
                        <p class="lr-hero-subtitle">Gagnez des points à chaque achat de billet et profitez de réductions exclusives</p>
                        <a href="/lamakorewards/" class="lr-btn lr-btn-hero">Découvrir le programme</a>
                    </div>
                </div>

                <?php 
                // Event slides
                if ($events->have_posts()) :
                    while ($events->have_posts()) : $events->the_post();
                        $meta = $this->get_event_meta(get_the_ID());
                        $thumbnail = get_the_post_thumbnail_url(get_the_ID(), 'full');
                        if (!$thumbnail) {
                            $thumbnail = '';
                        }
                ?>
                <div class="lr-hero-slide lr-hero-slide-event">
                    <div class="lr-hero-slide-bg" style="background-image: url('<?php echo esc_url($thumbnail); ?>');"></div>
                    <div class="lr-hero-slide-overlay"></div>
                    <div class="lr-hero-slide-content">
                        <?php if ($meta['start']) : ?>
                        <span class="lr-hero-tag"><?php echo date_i18n('d F Y', $meta['start']); ?></span>
                        <?php endif; ?>
                        <h2 class="lr-hero-title"><?php the_title(); ?></h2>
                        <?php if ($meta['location']) : ?>
                        <p class="lr-hero-subtitle">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            <?php echo esc_html($meta['location']); ?>
                        </p>
                        <?php endif; ?>
                        <a href="<?php the_permalink(); ?>" class="lr-btn lr-btn-hero">Acheter des billets</a>
                    </div>
                </div>
                <?php endwhile; wp_reset_postdata();
                endif;
                ?>

                <?php 
                // Slide: CTA Devis
                ?>
                <div class="lr-hero-slide lr-hero-slide-promo lr-hero-slide-devis">
                    <div class="lr-hero-slide-bg" style="background: linear-gradient(135deg, #0f3460 0%, #533483 50%, #e94560 100%);"></div>
                    <div class="lr-hero-slide-content">
                        <span class="lr-hero-tag">Organisez votre événement</span>
                        <h2 class="lr-hero-title">Demandez un devis</h2>
                        <p class="lr-hero-subtitle">Billetterie, gestion des participants, contrôle d'accès... On s'occupe de tout !</p>
                        <a href="/contact/" class="lr-btn lr-btn-hero">Demander un devis</a>
                    </div>
                </div>
            </div>

            <div class="lr-hero-nav">
                <button class="lr-hero-prev" aria-label="Précédent">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>
                </button>
                <div class="lr-hero-dots"></div>
                <button class="lr-hero-next" aria-label="Suivant">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,6 15,12 9,18"/></svg>
                </button>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Enqueue CSS and JS
     */
    public function enqueue_assets() {
        if (is_front_page() || is_page()) {
            wp_enqueue_style('lr-homepage-css', plugin_dir_url(__FILE__) . 'assets/lr-homepage.css', [], '1.0.0');
            wp_enqueue_script('lr-homepage-js', plugin_dir_url(__FILE__) . 'assets/lr-homepage.js', ['jquery'], '1.0.0', true);
        }
    }

    /**
     * Helper: Get Tickera events
     */
    private function get_tickera_events($args = []) {
        $defaults = [
            'post_type' => 'tc_events',
            'post_status' => 'publish',
            'posts_per_page' => 6,
            'meta_key' => 'event_date_time',
            'orderby' => 'meta_value',
            'order' => 'ASC',
        ];
        $query_args = wp_parse_args($args, $defaults);
        return new WP_Query($query_args);
    }

    /**
     * Helper: Get event meta
     */
    private function get_event_meta($post_id) {
        $start = get_post_meta($post_id, 'event_date_time', true);
        $end = get_post_meta($post_id, 'event_end_date_time', true);
        $location = get_post_meta($post_id, 'event_location', true);
        
        // Try alternative meta keys if empty
        if (empty($location)) {
            $location = get_post_meta($post_id, '_event_location', true);
        }
        if (empty($start)) {
            $start = get_post_meta($post_id, '_event_date_time', true);
        }
        
        return [
            'start' => $start,
            'end' => $end,
            'location' => $location,
            'start_formatted' => $start ? date_i18n('d M Y - H:i', $start) : '',
            'end_formatted' => $end ? date_i18n('d M Y - H:i', $end) : '',
        ];
    }

    /**
     * Helper: Get event categories
     */
    private function get_event_categories($post_id) {
        $terms = wp_get_post_terms($post_id, 'event_category');
        if (is_wp_error($terms) || empty($terms)) {
            // Try tc_event_category taxonomy
            $terms = wp_get_post_terms($post_id, 'tc_event_category');
        }
        return $terms;
    }

    /**
     * [lr_upcoming_events] - Grid of upcoming Tickera events
     */
    public function upcoming_events($atts) {
        $atts = shortcode_atts([
            'count' => 6,
            'columns' => 3,
            'title' => 'Événements',
            'subtitle' => 'À Venir',
            'description' => 'Découvrez nos prochains événements ! Concerts, spectacles, conférences et plus encore.',
        ], $atts);

        $now = current_time('timestamp');
        
        $events = $this->get_tickera_events([
            'posts_per_page' => intval($atts['count']),
            'meta_query' => [
                [
                    'key' => 'event_date_time',
                    'value' => $now,
                    'compare' => '>=',
                    'type' => 'NUMERIC',
                ],
            ],
        ]);

        ob_start();
        ?>
        <div class="lr-section lr-upcoming-events">
            <div class="lr-section-header">
                <h2 class="lr-section-title">
                    <span class="lr-title-primary"><?php echo esc_html($atts['title']); ?></span>
                    <span class="lr-title-secondary"><?php echo esc_html($atts['subtitle']); ?></span>
                </h2>
                <div class="lr-section-separator"></div>
                <p class="lr-section-description"><?php echo esc_html($atts['description']); ?></p>
            </div>

            <?php if ($events->have_posts()) : ?>
            <div class="lr-events-grid lr-columns-<?php echo esc_attr($atts['columns']); ?>">
                <?php while ($events->have_posts()) : $events->the_post();
                    $meta = $this->get_event_meta(get_the_ID());
                    $categories = $this->get_event_categories(get_the_ID());
                    $thumbnail = get_the_post_thumbnail_url(get_the_ID(), 'large');
                    if (!$thumbnail) {
                        $thumbnail = plugin_dir_url(__FILE__) . 'assets/default-event.jpg';
                    }
                ?>
                <div class="lr-event-card">
                    <a href="<?php the_permalink(); ?>" class="lr-event-card-link">
                        <div class="lr-event-image" style="background-image: url('<?php echo esc_url($thumbnail); ?>');">
                            <?php if (!empty($categories) && !is_wp_error($categories)) : ?>
                            <span class="lr-event-category"><?php echo esc_html($categories[0]->name); ?></span>
                            <?php endif; ?>
                            <div class="lr-event-date-badge">
                                <?php if ($meta['start']) : ?>
                                <span class="lr-date-day"><?php echo date_i18n('d', $meta['start']); ?></span>
                                <span class="lr-date-month"><?php echo date_i18n('M', $meta['start']); ?></span>
                                <?php endif; ?>
                            </div>
                        </div>
                        <div class="lr-event-info">
                            <h3 class="lr-event-title"><?php the_title(); ?></h3>
                            <?php if ($meta['start_formatted']) : ?>
                            <div class="lr-event-meta">
                                <span class="lr-event-meta-item lr-event-time">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                                    <?php echo esc_html($meta['start_formatted']); ?>
                                </span>
                            </div>
                            <?php endif; ?>
                            <?php if ($meta['location']) : ?>
                            <div class="lr-event-meta">
                                <span class="lr-event-meta-item lr-event-location">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    <?php echo esc_html($meta['location']); ?>
                                </span>
                            </div>
                            <?php endif; ?>
                        </div>
                    </a>
                </div>
                <?php endwhile; wp_reset_postdata(); ?>
            </div>

            <div class="lr-section-cta">
                <a href="/evenements/" class="lr-btn lr-btn-primary">Voir tous les événements</a>
            </div>
            <?php else : ?>
            <div class="lr-no-events">
                <p>Aucun événement à venir pour le moment. Revenez bientôt !</p>
            </div>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * [lr_past_events] - Carousel of past events
     */
    public function past_events($atts) {
        $atts = shortcode_atts([
            'count' => 8,
            'title' => 'Événements',
            'subtitle' => 'Passés',
            'description' => 'Revivez les moments forts de nos événements précédents.',
        ], $atts);

        $now = current_time('timestamp');
        
        $events = $this->get_tickera_events([
            'posts_per_page' => intval($atts['count']),
            'order' => 'DESC',
            'meta_query' => [
                [
                    'key' => 'event_date_time',
                    'value' => $now,
                    'compare' => '<',
                    'type' => 'NUMERIC',
                ],
            ],
        ]);

        ob_start();
        ?>
        <div class="lr-section lr-past-events">
            <div class="lr-section-header">
                <h2 class="lr-section-title">
                    <span class="lr-title-primary"><?php echo esc_html($atts['title']); ?></span>
                    <span class="lr-title-secondary"><?php echo esc_html($atts['subtitle']); ?></span>
                </h2>
                <div class="lr-section-separator"></div>
                <p class="lr-section-description"><?php echo esc_html($atts['description']); ?></p>
            </div>

            <?php if ($events->have_posts()) : ?>
            <div class="lr-carousel-container">
                <button class="lr-carousel-btn lr-carousel-prev" aria-label="Précédent">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>
                </button>
                <div class="lr-carousel-track">
                    <?php while ($events->have_posts()) : $events->the_post();
                        $meta = $this->get_event_meta(get_the_ID());
                        $thumbnail = get_the_post_thumbnail_url(get_the_ID(), 'medium_large');
                        if (!$thumbnail) {
                            $thumbnail = plugin_dir_url(__FILE__) . 'assets/default-event.jpg';
                        }
                    ?>
                    <div class="lr-carousel-item">
                        <a href="<?php the_permalink(); ?>" class="lr-past-event-card">
                            <div class="lr-past-event-image" style="background-image: url('<?php echo esc_url($thumbnail); ?>');">
                                <div class="lr-past-event-overlay">
                                    <span class="lr-past-event-badge">Terminé</span>
                                </div>
                            </div>
                            <div class="lr-past-event-info">
                                <h4 class="lr-past-event-title"><?php the_title(); ?></h4>
                                <?php if ($meta['start_formatted']) : ?>
                                <span class="lr-past-event-date"><?php echo esc_html($meta['start_formatted']); ?></span>
                                <?php endif; ?>
                            </div>
                        </a>
                    </div>
                    <?php endwhile; wp_reset_postdata(); ?>
                </div>
                <button class="lr-carousel-btn lr-carousel-next" aria-label="Suivant">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
                </button>
            </div>
            <?php else : ?>
            <div class="lr-no-events">
                <p>Aucun événement passé à afficher.</p>
            </div>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * [lr_lamako_rewards_banner] - LamakoRewards promotional banner
     */
    public function rewards_banner($atts) {
        $atts = shortcode_atts([
            'title' => 'LamakoRewards',
            'subtitle' => 'Gagnez des points à chaque achat',
            'description' => 'Rejoignez notre programme de fidélité et bénéficiez de réductions exclusives sur vos prochains billets.',
            'cta_text' => 'Rejoindre le programme',
            'cta_url' => '/lamakorewards/',
        ], $atts);

        ob_start();
        ?>
        <div class="lr-section lr-rewards-banner">
            <div class="lr-rewards-content">
                <div class="lr-rewards-icon">
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                </div>
                <h2 class="lr-rewards-title"><?php echo esc_html($atts['title']); ?></h2>
                <p class="lr-rewards-subtitle"><?php echo esc_html($atts['subtitle']); ?></p>
                <p class="lr-rewards-description"><?php echo esc_html($atts['description']); ?></p>
                <div class="lr-rewards-features">
                    <div class="lr-reward-feature">
                        <span class="lr-reward-feature-icon">🎫</span>
                        <span>1 point par 1000 Ar dépensé</span>
                    </div>
                    <div class="lr-reward-feature">
                        <span class="lr-reward-feature-icon">🎁</span>
                        <span>Réductions exclusives</span>
                    </div>
                    <div class="lr-reward-feature">
                        <span class="lr-reward-feature-icon">⭐</span>
                        <span>Accès prioritaire</span>
                    </div>
                </div>
                <a href="<?php echo esc_url($atts['cta_url']); ?>" class="lr-btn lr-btn-rewards"><?php echo esc_html($atts['cta_text']); ?></a>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * [lr_sponsors_carousel] - Sponsors/partners logo carousel
     */
    public function sponsors_carousel($atts) {
        $atts = shortcode_atts([
            'title' => 'Ils nous ont',
            'subtitle' => 'fait confiance',
            'ids' => '', // comma-separated attachment IDs
        ], $atts);

        // Default sponsor images from media library
        $sponsor_urls = [
            'https://www.ticketbylamako.com/wp-content/uploads/2018/11/sponsor-1.jpg',
            'https://www.ticketbylamako.com/wp-content/uploads/2018/11/sponsor-2.jpg',
            'https://www.ticketbylamako.com/wp-content/uploads/2018/11/sponsor-3.jpg',
            'https://www.ticketbylamako.com/wp-content/uploads/2018/11/sponsor-4.jpg',
            'https://www.ticketbylamako.com/wp-content/uploads/2018/11/sponsor-5.jpg',
            'https://www.ticketbylamako.com/wp-content/uploads/2018/11/sponsor-6.jpg',
            'https://www.ticketbylamako.com/wp-content/uploads/2018/11/sponsor-7.jpg',
            'https://www.ticketbylamako.com/wp-content/uploads/2018/11/sponsor-8.jpg',
        ];

        ob_start();
        ?>
        <div class="lr-section lr-sponsors-section">
            <div class="lr-section-header">
                <h2 class="lr-section-title">
                    <span class="lr-title-primary"><?php echo esc_html($atts['title']); ?></span>
                    <span class="lr-title-secondary"><?php echo esc_html($atts['subtitle']); ?></span>
                </h2>
                <div class="lr-section-separator"></div>
            </div>
            <div class="lr-sponsors-carousel">
                <div class="lr-sponsors-track">
                    <?php foreach ($sponsor_urls as $url) : ?>
                    <div class="lr-sponsor-item">
                        <img src="<?php echo esc_url($url); ?>" alt="Partenaire" loading="lazy">
                    </div>
                    <?php endforeach; ?>
                    <?php // Duplicate for infinite scroll effect ?>
                    <?php foreach ($sponsor_urls as $url) : ?>
                    <div class="lr-sponsor-item">
                        <img src="<?php echo esc_url($url); ?>" alt="Partenaire" loading="lazy">
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * [lr_event_search] - Event search bar
     */
    public function event_search($atts) {
        $atts = shortcode_atts([
            'placeholder' => 'Rechercher un événement...',
            'action_url' => '/evenements/',
        ], $atts);

        ob_start();
        ?>
        <div class="lr-section lr-event-search-section">
            <form class="lr-search-form" action="<?php echo esc_url($atts['action_url']); ?>" method="GET">
                <div class="lr-search-fields">
                    <div class="lr-search-field lr-search-keyword">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" name="s" placeholder="<?php echo esc_attr($atts['placeholder']); ?>" class="lr-search-input">
                    </div>
                    <div class="lr-search-field lr-search-category">
                        <select name="event_category" class="lr-search-select">
                            <option value="">Toutes les catégories</option>
                            <?php
                            $categories = get_terms(['taxonomy' => 'event_category', 'hide_empty' => true]);
                            if (is_wp_error($categories)) {
                                $categories = get_terms(['taxonomy' => 'tc_event_category', 'hide_empty' => true]);
                            }
                            if (!is_wp_error($categories) && !empty($categories)) :
                                foreach ($categories as $cat) :
                            ?>
                            <option value="<?php echo esc_attr($cat->slug); ?>"><?php echo esc_html($cat->name); ?></option>
                            <?php endforeach; endif; ?>
                        </select>
                    </div>
                    <div class="lr-search-field lr-search-submit">
                        <button type="submit" class="lr-btn lr-btn-search">Rechercher</button>
                    </div>
                </div>
            </form>
        </div>
        <?php
        return ob_get_clean();
    }
}

// Initialize
new LR_Homepage_Sections();
