// Talks to the "LWEC helper" snippet on the college website (wordpress/lwec-helper.php).
//
// No shared password: each call carries a Google-signed identity token of this Cloud Function's
// service account (from the metadata server). The snippet checks Google's signature, the audience
// (the website address) and that the token belongs to the lwec-field-logbook service account.

const WEBSITE = 'https://limpopowildlifeecocollege.com';
const META = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?format=full&audience=';

let cached = { token: null, until: 0 };
async function idToken(fetchFn) {
  if (cached.token && Date.now() < cached.until) return cached.token;
  const r = await fetchFn(META + encodeURIComponent(WEBSITE), { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error('no identity token (' + r.status + ')');
  cached = { token: (await r.text()).trim(), until: Date.now() + 45 * 60000 };
  return cached.token;
}

function makeWp(fetchFn) {
  fetchFn = fetchFn || fetch;
  return async function wp(action, body) {
    if (!/^[a-z-]+$/.test(action)) throw new Error('bad action');
    const token = await idToken(fetchFn);
    // ?rest_route= works whatever the permalink settings are.
    const r = await fetchFn(WEBSITE + '/?rest_route=/lwec/v1/' + action, {
      method: 'POST', signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'X-LWEC-Token': token, 'User-Agent': 'LWEC-portal/1.0' },
      body: JSON.stringify(body || {})
    });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
    if (!r.ok || !json) throw new Error('website answered ' + r.status + (json && json.code ? ' ' + json.code : ''));
    return json;
  };
}

module.exports = { makeWp, WEBSITE };
