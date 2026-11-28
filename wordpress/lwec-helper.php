<?php
/**
 * LWEC helper for limpopowildlifeecocollege.com (WordPress + Tutor LMS Pro).
 * Paste as ONE PHP snippet ("Run everywhere") in the code-snippets plugin, or upload as a plugin.
 *
 *  1. 💬 Help chat bubble on every public page (help/lwec-help-chat.js from the Learning Portal site).
 *  2. Records whether the website's emails go out (last sent / last failed), for the daily check.
 *  3. Private endpoints ONLY the LWEC Cloud Functions can call (Google-signed identity token of the
 *     lwec-field-logbook service account; no password is stored anywhere):
 *       health       email status, stuck sign-ups (email not confirmed), duplicate accounts
 *       reset        WordPress "Forgot password" email for one address
 *       account      does an account with this email exist / is it confirmed (yes/no only)
 *       verify-link  a signed one-time "Confirm my email" link (the Cloud Function emails it)
 *  4. WP Admin › Users: column "Email confirmed" and the link "Mark email verified".
 *  5. WP Admin › Tools › LWEC helper: status page.
 * Nothing is ever deleted.
 */
if (!defined('ABSPATH')) { return; }
if (defined('LWEC_HELPER')) { return; }
define('LWEC_HELPER', '1.0');

const LWEC_AUD = 'https://limpopowildlifeecocollege.com';
const LWEC_CALLERS = array('67985548748-compute@developer.gserviceaccount.com', 'lwec-field-logbook@appspot.gserviceaccount.com');
const LWEC_CHAT_JS = 'https://lwec123.github.io/wildlife-sighting-system/help/lwec-help-chat.js';

/* ---------- 1. chat bubble ---------- */
add_action('wp_footer', function () {
	echo '<script src="' . esc_url(LWEC_CHAT_JS) . '" defer></script>' . "\n";
}, 99);

/* ---------- 2. did the website's emails go out? ---------- */
add_action('wp_mail_succeeded', function () { update_option('lwec_mail_last_ok', time(), false); });
add_action('wp_mail_failed', function ($err) {
	update_option('lwec_mail_last_fail', time(), false);
	update_option('lwec_mail_last_error', is_wp_error($err) ? substr(wp_strip_all_tags($err->get_error_message()), 0, 200) : 'unknown', false);
});
function lwec_mail_result($ok, $error = '') {
	if ($ok) { update_option('lwec_mail_last_ok', time(), false); }
	else { update_option('lwec_mail_last_fail', time(), false); update_option('lwec_mail_last_error', substr($error, 0, 200), false); }
}

/* ---------- Tutor LMS Pro email verification ----------
 * LWEC_VERIFY_KEY is the user meta that Tutor Pro keeps while an email is NOT confirmed yet.
 * Until it is known for this site (see Tools › LWEC helper), sign-ups are found by any meta key
 * containing "verif" and "Mark email verified" is not offered. */
const LWEC_VERIFY_KEY = '';
function lwec_unverified_keys($uid) {
	$out = array();
	foreach ((array) get_user_meta($uid) as $k => $v) {
		$val = is_array($v) ? (string) reset($v) : (string) $v;
		if (LWEC_VERIFY_KEY !== '' ? $k === LWEC_VERIFY_KEY : preg_match('/verif/i', $k)) {
			if ($val !== '' && !in_array(strtolower($val), array('1', 'yes', 'true', 'verified'), true)) { $out[$k] = $val; }
		}
	}
	return $out;
}
/** true = confirmed, false = not confirmed, null = cannot tell */
function lwec_is_verified($uid) {
	if (user_can($uid, 'edit_posts')) { return true; }
	return count(lwec_unverified_keys($uid)) ? false : true;
}
function lwec_verify_supported() { return LWEC_VERIFY_KEY !== ''; }
function lwec_mark_verified($uid) {
	if (!lwec_verify_supported()) { return false; }
	delete_user_meta($uid, LWEC_VERIFY_KEY);
	update_user_meta($uid, 'lwec_email_confirmed', time());
	do_action('lwec_email_marked_verified', $uid);
	return lwec_is_verified($uid) === true;
}

/* ---------- signed "Confirm my email" links (3 days) ---------- */
function lwec_sig($uid, $exp) { return substr(hash_hmac('sha256', 'lwec-verify|' . $uid . '|' . $exp, wp_salt('auth')), 0, 32); }
function lwec_verify_link($uid) { $exp = time() + 3 * DAY_IN_SECONDS; return add_query_arg('lwec_verify', $uid . '.' . $exp . '.' . lwec_sig($uid, $exp), home_url('/')); }
add_action('init', function () {
	if (empty($_GET['lwec_verify'])) { return; }
	$p = explode('.', sanitize_text_field(wp_unslash($_GET['lwec_verify'])));
	$ok = count($p) === 3 && ctype_digit($p[0]) && ctype_digit($p[1]) && (int) $p[1] >= time() && hash_equals(lwec_sig((int) $p[0], (int) $p[1]), $p[2]) && get_userdata((int) $p[0]);
	if ($ok) { $ok = lwec_is_verified((int) $p[0]) === true || lwec_mark_verified((int) $p[0]); }
	wp_die($ok ? '<h2>✅ Your email is confirmed.</h2><p>You can sign in now.</p><p><a href="' . esc_url(home_url('/')) . '">Go to the website</a></p>'
		: '<h2>This link does not work any more.</h2><p>Ask the 💬 Help chat on the website for a new one, or email the LWEC office.</p>', 'LWEC', array('response' => 200));
});

/* ---------- 3. private endpoints for the LWEC Cloud Functions ---------- */
function lwec_b64($s) { return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4)); }
function lwec_google_certs() {
	$c = get_transient('lwec_google_certs');
	if (is_array($c)) { return $c; }
	$r = wp_remote_get('https://www.googleapis.com/oauth2/v1/certs', array('timeout' => 10));
	$c = json_decode(wp_remote_retrieve_body($r), true);
	if (!is_array($c) || !$c) { return array(); }
	set_transient('lwec_google_certs', $c, HOUR_IN_SECONDS);
	return $c;
}
/** Returns '' when the token is a valid identity token of an LWEC Cloud Function, else the reason. */
function lwec_check_token($jwt, $certs = null, $now = null) {
	$p = explode('.', (string) $jwt);
	if (count($p) !== 3) { return 'no token'; }
	$h = json_decode(lwec_b64($p[0]), true); $c = json_decode(lwec_b64($p[1]), true);
	if (!is_array($h) || !is_array($c) || ($h['alg'] ?? '') !== 'RS256') { return 'bad token'; }
	$certs = $certs === null ? lwec_google_certs() : $certs;
	$cert = $certs[$h['kid'] ?? ''] ?? null;
	if (!$cert || openssl_verify($p[0] . '.' . $p[1], lwec_b64($p[2]), $cert, OPENSSL_ALGO_SHA256) !== 1) { return 'bad signature'; }
	$now = $now === null ? time() : $now;
	if (!in_array($c['iss'] ?? '', array('https://accounts.google.com', 'accounts.google.com'), true)) { return 'bad issuer'; }
	if (($c['aud'] ?? '') !== LWEC_AUD) { return 'bad audience'; }
	if ((int) ($c['exp'] ?? 0) < $now - 60 || (int) ($c['iat'] ?? 0) > $now + 300) { return 'expired'; }
	if (empty($c['email_verified']) || !in_array($c['email'] ?? '', LWEC_CALLERS, true)) { return 'not an LWEC caller'; }
	return '';
}
function lwec_auth(WP_REST_Request $req) {
	$t = $req->get_header('x_lwec_token');
	if (!$t && preg_match('/^Bearer\s+(\S+)$/', (string) $req->get_header('authorization'), $m)) { $t = $m[1]; }
	$why = lwec_check_token($t);
	return $why === '' ? true : new WP_Error('lwec_forbidden', 'Forbidden: ' . $why, array('status' => 403));
}
function lwec_user_by_email($email) {
	$email = sanitize_email($email);
	if (!$email || !is_email($email)) { return array(); }
	return get_users(array('search' => $email, 'search_columns' => array('user_email'), 'number' => 10, 'orderby' => 'ID', 'order' => 'DESC'));
}

add_action('rest_api_init', function () {
	$reg = function ($route, $cb) { register_rest_route('lwec/v1', '/' . $route, array('methods' => 'POST', 'callback' => $cb, 'permission_callback' => 'lwec_auth')); };

	$reg('health', function () {
		$test = null;
		if ((int) get_option('lwec_mail_last_ok', 0) < time() - 20 * HOUR_IN_SECONDS) {
			// Nothing sent for 20 hours: send one small test email to the site's admin address.
			$err = '';
			$catch = function ($e) use (&$err) { $err = is_wp_error($e) ? $e->get_error_message() : 'failed'; };
			add_action('wp_mail_failed', $catch);
			$sent = wp_mail(get_option('admin_email'), 'LWEC website email check (OK, you can delete this)', "The college website can send email.\nThis is the daily automatic check. You can delete this email.");
			remove_action('wp_mail_failed', $catch);
			lwec_mail_result($sent, wp_strip_all_tags($err));
			$test = array('sent' => (bool) $sent, 'error' => substr(wp_strip_all_tags($err), 0, 200));
		}
		$unverified = array();
		foreach (get_users(array('date_query' => array(array('after' => '60 days ago', 'inclusive' => true)), 'orderby' => 'registered', 'order' => 'DESC', 'number' => 200)) as $u) {
			if (lwec_is_verified($u->ID) === false) {
				$unverified[] = array('id' => $u->ID, 'name' => $u->display_name, 'email' => $u->user_email, 'registered' => strtotime($u->user_registered . ' UTC'),
					'fix_url' => admin_url('users.php?s=' . rawurlencode($u->user_email)));
			}
		}
		global $wpdb;
		$dups = $wpdb->get_results("SELECT LOWER(user_email) AS email, COUNT(*) AS n FROM {$wpdb->users} GROUP BY LOWER(user_email) HAVING n > 1 ORDER BY n DESC LIMIT 20", ARRAY_A);
		return array('ok' => true, 'helper' => LWEC_HELPER, 'wp' => get_bloginfo('version'),
			'mail' => array('last_ok' => (int) get_option('lwec_mail_last_ok', 0), 'last_fail' => (int) get_option('lwec_mail_last_fail', 0), 'last_error' => (string) get_option('lwec_mail_last_error', ''), 'test' => $test),
			'unverified' => $unverified, 'duplicates' => array_map(function ($d) { return array('email' => $d['email'], 'count' => (int) $d['n']); }, (array) $dups),
			'verify_supported' => lwec_verify_supported());
	});

	$reg('reset', function (WP_REST_Request $req) {
		$users = lwec_user_by_email($req->get_param('email'));
		if (!$users) { return array('status' => 'ok'); }   // same answer when there is no account
		$r = retrieve_password($users[0]->user_login);
		if (is_wp_error($r)) {
			lwec_mail_result(false, $r->get_error_message());
			return array('status' => $r->get_error_code() === 'retrieve_password_email_failure' ? 'mail_failed' : 'error');
		}
		lwec_mail_result(true);
		return array('status' => 'ok');
	});

	$reg('account', function (WP_REST_Request $req) {
		$users = lwec_user_by_email($req->get_param('email'));
		if (!$users) { return array('found' => false); }
		$v = array_map(function ($u) { return lwec_is_verified($u->ID); }, $users);
		return array('found' => true, 'count' => count($users), 'verified' => in_array(true, $v, true) ? true : (in_array(false, $v, true) ? false : null));
	});

	$reg('verify-link', function (WP_REST_Request $req) {
		$users = lwec_user_by_email($req->get_param('email'));
		if (!$users) { return array('status' => 'not_found'); }
		foreach ($users as $u) { if (lwec_is_verified($u->ID) === true) { return array('status' => 'verified'); } }
		if (!lwec_verify_supported()) { return array('status' => 'not_supported'); }
		$u = $users[0];
		return array('status' => 'ok', 'link' => lwec_verify_link($u->ID), 'name' => $u->first_name ? $u->first_name : $u->display_name);
	});
});

/* ---------- 4. WP Admin › Users ---------- */
add_filter('manage_users_columns', function ($c) { $c['lwec_conf'] = 'Email confirmed'; return $c; });
add_filter('manage_users_custom_column', function ($out, $col, $uid) {
	if ($col !== 'lwec_conf') { return $out; }
	return lwec_is_verified($uid) === false ? '<span style="color:#b32d2e">❌ Not yet</span>' : '✅ Yes';
}, 10, 3);
add_filter('user_row_actions', function ($a, $u) {
	if (current_user_can('edit_users') && lwec_verify_supported() && lwec_is_verified($u->ID) === false) {
		$a['lwec_verify'] = '<a href="' . esc_url(wp_nonce_url(admin_url('users.php?lwec_mark=' . $u->ID), 'lwec_mark_' . $u->ID)) . '">Mark email verified</a>';
	}
	return $a;
}, 10, 2);
add_action('admin_init', function () {
	if (empty($_GET['lwec_mark']) || !current_user_can('edit_users')) { return; }
	$uid = (int) $_GET['lwec_mark'];
	check_admin_referer('lwec_mark_' . $uid);
	$ok = lwec_mark_verified($uid);
	wp_safe_redirect(add_query_arg('lwec_marked', $ok ? 1 : 0, admin_url('users.php')));
	exit;
});
add_action('admin_notices', function () {
	if (isset($_GET['lwec_marked'])) {
		echo $_GET['lwec_marked'] ? '<div class="notice notice-success"><p>✅ Email marked as verified. The student can sign in now.</p></div>'
			: '<div class="notice notice-error"><p>That did not work. Tell Claude in the project chat.</p></div>';
	}
});

/* ---------- 5. WP Admin › Tools › LWEC helper ---------- */
add_action('admin_menu', function () {
	add_management_page('LWEC helper', 'LWEC helper', 'manage_options', 'lwec-helper', function () {
		$t = function ($x) { return $x ? esc_html(wp_date('j M Y H:i', $x)) : 'never'; };
		echo '<div class="wrap"><h1>LWEC helper ' . esc_html(LWEC_HELPER) . '</h1>';
		echo '<p>Last website email sent: <b>' . $t((int) get_option('lwec_mail_last_ok', 0)) . '</b> · last failed: <b>' . $t((int) get_option('lwec_mail_last_fail', 0)) . '</b> ' . esc_html((string) get_option('lwec_mail_last_error', '')) . '</p>';
		echo '<p>Email-confirm setting: ' . (lwec_verify_supported() ? 'known (' . esc_html(LWEC_VERIFY_KEY) . ')' : 'not set yet') . '</p>';
		echo '<h2>Newest 12 accounts: settings that look like email confirmation</h2><table class="widefat striped"><tr><th>ID</th><th>Signed up</th><th>Email</th><th>Settings (name = value)</th></tr>';
		foreach (get_users(array('orderby' => 'registered', 'order' => 'DESC', 'number' => 12)) as $u) {
			$keys = array();
			foreach ((array) get_user_meta($u->ID) as $k => $v) {
				if (!preg_match('/verif|token|confirm|activat|_tutor/i', $k)) { continue; }
				$val = is_array($v) ? (string) reset($v) : (string) $v;
				$show = strlen($val) > 12 ? substr($val, 0, 4) . '… (' . strlen($val) . ' characters)' : $val;
				$keys[] = esc_html($k) . ' = <code>' . esc_html($show) . '</code>';
			}
			echo '<tr><td>' . (int) $u->ID . '</td><td>' . esc_html($u->user_registered) . '</td><td>' . esc_html($u->user_email) . '</td><td>' . implode('<br>', $keys) . '</td></tr>';
		}
		echo '</table></div>';
	});
});
