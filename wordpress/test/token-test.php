<?php
// Offline test of the identity-token check: php wordpress/test/token-test.php
define('ABSPATH', '/');
function add_action() {} function add_filter() {} function wp_salt() { return 'salt'; }
require __DIR__ . '/../lwec-helper.php';
$k = openssl_pkey_new(array('private_key_bits' => 2048));
$csr = openssl_csr_new(array('commonName' => 'test'), $k);
openssl_x509_export(openssl_csr_sign($csr, null, $k, 1), $pem);
$b = function ($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); };
$make = function ($claims, $kid = 'k1') use ($k, $b) {
	$h = $b(json_encode(array('alg' => 'RS256', 'kid' => $kid))); $p = $b(json_encode($claims));
	openssl_sign("$h.$p", $sig, $k, OPENSSL_ALGO_SHA256); return "$h.$p." . $b($sig);
};
$now = 1800000000; $certs = array('k1' => $pem);
$good = array('iss' => 'https://accounts.google.com', 'aud' => LWEC_AUD, 'exp' => $now + 3000, 'iat' => $now, 'email' => LWEC_CALLERS[0], 'email_verified' => true);
$cases = array(
	array($make($good), ''),
	array($make(array_merge($good, array('aud' => 'https://evil.example'))), 'bad audience'),
	array($make(array_merge($good, array('email' => 'x@developer.gserviceaccount.com'))), 'not an LWEC caller'),
	array($make(array_merge($good, array('exp' => $now - 500))), 'expired'),
	array($make($good, 'other'), 'bad signature'),
	array(substr($make($good), 0, -4) . 'AAAA', 'bad signature'),
	array('nonsense', 'no token'),
);
foreach ($cases as $i => $c) { $r = lwec_check_token($c[0], $certs, $now); if ($r !== $c[1]) { echo "case $i: got '$r' want '{$c[1]}'\n"; exit(1); } }
echo "token tests passed\n";
