/** Verified against ETS's current content page; base times exclude instructions. */
export const TOEFL_FORMAT = {
  version: "toefl-ibt-2026-01-21",
  verifiedOn: "2026-10-23",
  sources: [
    "https://www.ets.org/toefl/test-takers/ibt/about/content.html",
    "https://www.ets.org/pdfs/toefl/toefl-ibt-test-specifications-2026.pdf",
    "https://www.ets.org/pdfs/toefl/toefl-ibt-test-overview.pdf",
  ],
  sections: [
    { name: "Reading", minutes: 30, items: 50, tasks: ["Complete the Words", "Read in Daily Life", "Read an Academic Passage"] },
    { name: "Listening", minutes: 29, items: 47, tasks: ["Listen and Choose a Response", "Listen to a Conversation", "Listen to an Announcement", "Listen to an Academic Talk"] },
    { name: "Writing", minutes: 23, items: 12, tasks: ["Build a Sentence", "Write an Email", "Write for an Academic Discussion"] },
    { name: "Speaking", minutes: 8, items: 11, tasks: ["Listen and Repeat", "Take an Interview"] },
  ],
} as const;

export function toeflTaskInstructions(name: string): string {
  switch (name) {
    case "Complete the Words": return "Complete the missing letters in the passage.";
    case "Build a Sentence": return "Move the words and phrases to make a grammatically correct sentence.";
    case "Write an Email": return "Write an email that addresses each point in the task. Use complete sentences.";
    case "Write for an Academic Discussion":
    case "Academic Discussion": return "Read the discussion and contribute your own response. Support your opinion with reasons and examples.";
    case "Listen and Repeat": return "Listen carefully. When prompted, repeat the sentence as clearly and accurately as you can.";
    case "Take an Interview":
    case "Interview Speaking": return "Listen to the interview question and respond clearly, using details and examples.";
    default: return name.startsWith("Listen") ? "Listen to the recording once, then select the best answer." : "Read the text and select the best answer to the question.";
  }
}
