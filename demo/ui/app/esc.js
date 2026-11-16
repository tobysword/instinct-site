// The one HTML escape for every page and the overlay (QC F: it was copied six times). Escapes ' too, so a value is safe in a
// single-quoted attribute as well.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
