import { addLinear, audioScripts, module } from "./form-1";
module("Writing", "linear");
const sentences: [string, string[], number[], string][] = [
  ["What did you think of the lecture?", ["very clearly", "the topic", "explained", "the speaker"], [3, 2, 1, 0], "The speaker explained the topic very clearly."],
  ["Why is the library so quiet?", ["have already", "most students", "their exams", "finished"], [1, 0, 3, 2], "Most students have already finished their exams."],
  ["Did you find a place to study?", ["a room", "where", "could work", "we found", "without interruptions", "we"], [3, 0, 1, 5, 2, 4], "We found a room where we could work without interruptions."],
  ["Can you help me with the software?", ["how", "this program", "could you", "works", "explain"], [2, 4, 0, 1, 3], "Could you explain how this program works?"],
  ["Why didn't you attend the workshop?", ["if", "I would have", "earlier", "I had known", "attended", "about it"], [1, 4, 0, 3, 5, 2], "I would have attended if I had known about it earlier."],
  ["Is the new equipment ready?", ["before", "needs to", "it", "be tested", "can use it", "the class"], [2, 1, 3, 0, 5, 4], "It needs to be tested before the class can use it."],
  ["What impressed you about the exhibition?", ["the way", "combined", "was", "traditional materials", "what impressed me", "the artists", "with new technology"], [4, 2, 0, 5, 1, 3, 6], "What impressed me was the way the artists combined traditional materials with new technology."],
  ["Will you apply for the research position?", ["whether", "I haven't", "to apply", "decided", "for it", "yet"], [1, 3, 0, 2, 4, 5], "I haven't decided whether to apply for it yet."],
  ["How can we improve the report?", ["the limitations", "more explicitly", "we should", "the data", "acknowledge", "of"], [2, 4, 0, 5, 3, 1], "We should acknowledge the limitations of the data more explicitly."],
  ["Why was the project successful?", ["the careful planning", "would not have", "without", "it", "succeeded", "of the team"], [3, 1, 4, 2, 0, 5], "It would not have succeeded without the careful planning of the team."],
];
const alternativeOrders: Record<number, number[][]> = {
  1: [[3, 0, 2, 1]],
  5: [[0, 3, 5, 2, 1, 4]],
  6: [[0, 5, 4, 2, 1, 3]],
  8: [[1, 5, 3, 0, 2, 4], [1, 3, 5, 0, 2, 4]],
  9: [[2, 1, 4, 0, 5, 3]],
  10: [[2, 0, 5, 3, 1, 4]],
};
sentences.forEach(([question, wordBank, order, sentence], i) => addLinear(`w-sentence-${i + 1}`, "Build a Sentence", { question, wordBank, slots: wordBank.length }, { order, ...(alternativeOrders[i + 1] ? { acceptedOrders: alternativeOrders[i + 1] } : {}) }, sentence, i < 3 ? 2 : i < 7 ? 3 : 4));
addLinear("w-email", "Write an Email", {
  scenario: "You are a university student taking a weekend field course. The instructor, Dr. Rivera, has announced a compulsory preparation meeting on Friday afternoon. You have a laboratory class at the same time and cannot miss it. Write an email to Dr. Rivera.",
  requiredPoints: ["Explain the scheduling conflict clearly.", "Explain why attending the preparation meeting matters to you.", "Suggest a practical way to receive the information and ask whether your suggestion is acceptable."],
}, null, "Address all three points. Explain the conflict without sounding dismissive, propose a workable alternative such as a recording or another meeting, and use a polite request and suitable opening and closing.", 3);
addLinear("w-discussion", "Write for an Academic Discussion", {
  professorPost: "Professor Ellis: Cities sometimes have a limited budget for improving public spaces. Some people believe the money should create one large central park that can host many activities. Others prefer several small parks within walking distance of different neighborhoods. Which approach should a city prioritize, and why? In your response, express and support your opinion and make a contribution to the discussion in your own words.",
  studentReplies: [
    { author: "Lena", text: "A large park gives a city a place for concerts and sports facilities that would not fit into a small space. It can bring together people from different neighborhoods." },
    { author: "Mateo", text: "Small parks are easier to visit regularly. Families who cannot travel far still need somewhere to relax, and several parks can distribute the benefits more fairly." },
  ], minWords: 100,
}, null, "Take a clear position and develop a reason or example that adds to the discussion. You can qualify either student's argument, but avoid simply repeating it. Evaluate development, organization, language range, and accuracy rather than counting words alone.", 4);
module("Speaking", "linear");
const repeats = [
  "The visitor desk is next to the entrance.",
  "Please keep your ticket until the end of the tour.",
  "The gallery upstairs displays work by local artists.",
  "You can leave your bags in the lockers near the stairs.",
  "Photography is permitted as long as you do not use a flash.",
  "Visitors who would like to join the workshop should register at the information desk.",
  "Although the main exhibition closes at five, the cafe and the museum shop remain open for another hour.",
];
repeats.forEach((transcript, i) => {
  const key = `s-repeat-${i + 1}`;
  audioScripts.push({ id: key, turns: [{ voice: i % 2, text: transcript }] });
  addLinear(key, "Listen and Repeat", { audioUrl: `/audio/toefl-2026/form-1/${key}.wav`, transcript, context: "You are helping a visitor become familiar with a museum. Listen and repeat each sentence." }, null,
    "Evaluate how completely and accurately the sentence is repeated and how readily it can be understood. Use the Listen and Repeat rubric from 0 to 5; accent alone is not an error.", i < 2 ? 2 : i < 5 ? 3 : 4, i < 2 ? 8 : i < 5 ? 10 : 12);
});
const interview = [
  "Thank you for taking part in our study about learning in everyday life. First, think about a skill you learned outside a classroom. What was the skill, and how did you learn it?",
  "Some people prefer learning a new skill alone, while others prefer working with someone more experienced. Which approach do you usually prefer, and why?",
  "Imagine that your university could offer short practical workshops led by local residents. What kind of workshop would be most useful to students? Explain your choice with specific reasons.",
  "Do you think universities should give students academic credit for skills learned outside formal courses? Explain your position, including a possible advantage or difficulty of this policy.",
];
interview.forEach((transcript, i) => {
  const key = `s-interview-${i + 1}`;
  audioScripts.push({ id: key, turns: [{ voice: 1, text: transcript }] });
  addLinear(key, "Take an Interview", { audioUrl: `/audio/toefl-2026/form-1/${key}.wav`, transcript, topicLabel: "Learning in everyday life" }, null,
    "Respond directly and develop your ideas with relevant detail. Evaluate coherence, grammar and vocabulary, fluency, and intelligibility using the interview rubric from 0 to 5.", i + 2, 45);
});
