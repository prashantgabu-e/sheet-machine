function identity_(input) {
  const idToken = typeof input === 'string' ? input : input && input.idToken;
  if (!idToken || typeof idToken !== 'string') throw new Error('Please sign in with Google.');
  // Google validates the token's signature. We then strictly validate its audience,
  // issuer, expiry, verified-email state, and account identifier before authorizing.
  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('Your sign-in token is invalid or expired.');
  const claim = JSON.parse(response.getContentText());
  if (claim.aud !== required_('GOOGLE_CLIENT_ID') || !['accounts.google.com', 'https://accounts.google.com'].includes(claim.iss) || String(claim.email_verified) !== 'true' || !claim.sub || !claim.email || Number(claim.exp) * 1000 <= Date.now()) throw new Error('Your Google sign-in could not be verified.');
  const email = String(claim.email).toLowerCase();
  return { subject: claim.sub, email };
}
