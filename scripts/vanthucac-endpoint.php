<?php
/**
 * Plugin snippet: expose comics data with view counts.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route('vanthucac/v1', '/comics', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'vanthucac_rest_get_comics',
        'permission_callback' => '__return_true',
        'args'                => [
            'limit' => [
                'type'              => 'integer',
                'sanitize_callback' => 'absint',
                'default'           => 100,
            ],
            'orderby' => [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_key',
                'default'           => 'date',
            ],
            'order' => [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'default'           => 'desc',
            ],
        ],
    ]);
});

function vanthucac_rest_get_view_count($post_id)
{
    $keys = [
        'views',
        'view_count',
        'post_views',
        'post_views_count',
        'wpb_post_views_count',
        'manga_views',
    ];

    foreach ($keys as $key) {
        $val = get_post_meta($post_id, $key, true);
        if ($val === '' || $val === null) {
            continue;
        }

        $num = intval($val);
        if ($num || $val === '0' || $val === 0) {
            return $num;
        }
    }

    return 0;
}

function vanthucac_rest_detect_genre($post)
{
    $taxonomy_candidates = ['wp-manga-genre', 'manga-genre', 'category'];

    foreach ($taxonomy_candidates as $tax) {
        $terms = get_the_terms($post, $tax);
        if (is_wp_error($terms) || empty($terms)) {
            continue;
        }

        foreach ($terms as $term) {
            $slug = strtolower($term->slug);
            if ($slug === 'manhwa' || $slug === 'manhua') {
                return $slug;
            }
        }
    }

    $meta_genre = get_post_meta($post->ID, 'genre', true);
    if (is_string($meta_genre)) {
        $slug = strtolower(trim($meta_genre));
        if ($slug === 'manhwa' || $slug === 'manhua') {
            return $slug;
        }
    }

    return '';
}

function vanthucac_rest_get_comics(WP_REST_Request $request)
{
    $limit   = max(1, min(500, (int) $request->get_param('limit')));
    $orderby = $request->get_param('orderby') ?: 'date';
    $order   = strtolower($request->get_param('order')) === 'asc' ? 'asc' : 'desc';

    $query = new WP_Query([
        'post_type'      => ['wp-manga', 'manga'],
        'post_status'    => 'publish',
        'posts_per_page' => $limit,
        'orderby'        => $orderby === 'views' ? 'date' : $orderby,
        'order'          => $order,
    ]);

    $items = [];

    foreach ($query->posts as $post) {
        $views = vanthucac_rest_get_view_count($post->ID);
        $genre = vanthucac_rest_detect_genre($post);

        $items[] = [
            'id'    => $post->post_name,
            'title' => html_entity_decode(get_the_title($post), ENT_QUOTES, 'UTF-8'),
            'genre' => $genre,
            'cover' => get_the_post_thumbnail_url($post, 'full') ?: '',
            'url'   => get_permalink($post),
            'views' => $views,
        ];
    }

    if ($orderby === 'views') {
        usort($items, function ($a, $b) use ($order) {
            $cmp = ($b['views'] ?? 0) <=> ($a['views'] ?? 0);
            if ($cmp === 0) {
                return strcmp($a['title'], $b['title']);
            }
            return $order === 'asc' ? -$cmp : $cmp;
        });
        $items = array_slice($items, 0, $limit);
    }

    return rest_ensure_response([
        'updatedAt' => current_time('c'),
        'items'     => $items,
    ]);
}