/*
 * SEZ Studio — commercial configuration
 * ------------------------------------------------------------------
 * Set one of the following before taking project inquiries live:
 *
 *   email:    a real studio inbox. The form will open a prefilled
 *             mail draft after copying the brief.
 *
 *   endpoint: an optional HTTPS form endpoint (Formspree, a Cloudflare
 *             Worker, your own API) that accepts a JSON POST and returns
 *             2xx. It receives the payload described in pc.js.
 *
 * Leave both empty to run the form in local/copy mode.
 */
window.SEZ_STUDIO = {
  email: '',
  endpoint: '',
};
