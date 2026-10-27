/** An ordering answer is positional, unlike an unordered multiple selection. */
export function validSentenceOrder(order: unknown, wordBank: unknown, slots?: unknown): order is number[] {
  if (!Array.isArray(wordBank) || !Array.isArray(order)) return false;
  const length = typeof slots === "number" ? slots : wordBank.length;
  return order.length === length && new Set(order).size === order.length &&
    order.every((index) => Number.isInteger(index) && index >= 0 && index < wordBank.length);
}

export function sentenceOrderMatches(expected: unknown, received: unknown, wordBank: unknown, slots?: unknown): boolean {
  return Array.isArray(expected) && validSentenceOrder(received, wordBank, slots) &&
    expected.length === received.length && expected.every((value, index) => Number(value) === received[index]);
}
