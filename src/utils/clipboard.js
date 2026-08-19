/**
 * Universal Clipboard Copy Helper
 * Supports Secure Contexts (navigator.clipboard) AND Insecure HTTP / LAN / Mobile Safari (execCommand fallback)
 */

export async function copyToClipboard(text) {
  if (!text) return false;

  // 1. Try modern navigator.clipboard API if available
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback below
    }
  }

  // 2. Universal Fallback using invisible textarea + document.execCommand('copy')
  // Guaranteed to work on HTTP (e.g. http://192.168.x.x:5173) and mobile browsers
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.setAttribute('readonly', '');

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, text.length);

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return !!successful;
    } catch (err) {
      console.error('Universal copy fallback failed:', err);
      return false;
    }
  }

  return false;
}
