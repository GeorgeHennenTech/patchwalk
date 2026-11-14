// How a question is recognised as "the same question as before", shared by the browser's memory and the
// site's shared memory.
/** Two wordings count as the same question when they differ only in capitals, punctuation and spacing. */
export const sameQuestionKey = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
