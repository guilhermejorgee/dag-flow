/**
 * Finds 'PROMO' in a string and returns the next word.
 * @param {string} text - The text to search.
 * @returns {string|null} - The next word after 'PROMO' or null if not found/no next word.
 */
export function getDiscount(text) {
  if (!text) return null;
  const words = text.split(/\s+/);
  const index = words.indexOf('PROMO');
  if (index === -1 || index === words.length - 1) {
    return null;
  }
  return words[index + 1];
}
