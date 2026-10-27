import { addLinear, module, spoken } from "./form-2";
module("Writing", "linear");
const sentences: [string, string[], number[], string, number[][]?][] = [
  ["When does the workshop begin?", ["in the afternoon", "starts", "the workshop"], [2, 1, 0], "The workshop starts in the afternoon.", [[0, 2, 1]]],
  ["What is the latest news on campus?", ["that", "have you heard", "has opened", "a new cafe"], [1, 0, 3, 2], "Have you heard that a new cafe has opened?"],
  ["Which notes do you need?", ["that", "the notes", "yesterday", "you shared", "I am looking for"], [4, 1, 0, 3, 2], "I am looking for the notes that you shared yesterday."],
  ["Can we study there tonight?", ["is open", "do you know", "this evening", "the library", "whether"], [1, 4, 3, 0, 2], "Do you know whether the library is open this evening?"],
  ["Did the team consider my comments?", ["your suggestions", "has been revised", "the report", "in response to"], [2, 1, 3, 0], "The report has been revised in response to your suggestions.", [[3, 0, 2, 1]]],
  ["Can we publish the findings now?", ["until", "have been checked", "we should wait", "the results"], [2, 0, 3, 1], "We should wait until the results have been checked.", [[0, 3, 1, 2]]],
  ["Where will the event take place?", ["outside", "the weather improves", "we will hold", "if", "the event"], [3, 1, 2, 4, 0], "If the weather improves, we will hold the event outside.", [[2, 4, 0, 3, 1]]],
  ["Which part of the article helped you most?", ["between", "was", "the two studies", "what I found useful", "the comparison"], [3, 1, 4, 0, 2], "What I found useful was the comparison between the two studies."],
  ["Does the evidence support the statement?", ["that", "the claim", "equally", "the data", "do not justify", "all groups benefited"], [3, 4, 1, 0, 5, 2], "The data do not justify the claim that all groups benefited equally."],
  ["Could the error have been prevented?", ["earlier", "we could have", "the measurements", "corrected the error", "had we received"], [4, 2, 0, 1, 3], "Had we received the measurements earlier, we could have corrected the error.", [[1, 3, 4, 2, 0]]],
];
sentences.forEach(([question, wordBank, order, sentence, acceptedOrders], i) => addLinear(`w-sentence-${i + 1}`, "Build a Sentence", { question, wordBank, slots: wordBank.length }, { order, ...(acceptedOrders ? { acceptedOrders } : {}) }, sentence, i < 3 ? 2 : i < 7 ? 3 : 4));
addLinear("w-email", "Write an Email", {
  scenario: "You are helping a university club organize a public science demonstration. The equipment office has offered to lend a portable sound system, but the collection time conflicts with the team's final rehearsal. Write an email to the equipment coordinator, Mr. Patel.",
  requiredPoints: ["Thank him and explain why the sound system is important for the event.", "Explain the problem with the proposed collection time.", "Suggest a practical alternative and ask what arrangements are possible."],
}, null, "Cover all three points with relevant detail. Clearly explain why audio matters, describe the scheduling problem, and propose a workable alternative such as an earlier collection or an authorized team member. Use an appropriate greeting, polite request, and closing.", 3);
addLinear("w-discussion", "Write for an Academic Discussion", {
  professorPost: "Professor Ahmed: Some cities are considering removing fares from local buses. Supporters say free buses would make travel more accessible and encourage people to drive less. Critics argue that the same money would be better spent making services more frequent and reliable. If a city has a limited transport budget, which approach should it prioritize? Express and support your opinion and contribute an idea to the discussion in your own words.",
  studentReplies: [
    { author: "Clara", text: "Free travel would help residents who need to make several short trips each day. A fare that seems small can become a real expense over a week." },
    { author: "Owen", text: "A free bus is not very useful if it comes only once an hour. I think frequent services would persuade more people to leave their cars at home." },
  ], minWords: 100,
}, null, "Develop a clear position on the budget choice. Explain a consequence, condition, or example rather than repeating the posts. A qualified proposal is acceptable if its priorities are clear. Evaluate relevance, elaboration, organization, and language using the discussion rubric.", 4);
module("Speaking", "linear");
const repeats = [
  "The information desk is opposite the ticket machines.",
  "Please have your booking number ready when you arrive.",
  "The next train will depart from the platform on your left.",
  "Passengers with large bags should use the lift near the exit.",
  "You can change your ticket here if your travel plans have changed.",
  "Anyone who requires assistance should speak to a member of staff before boarding.",
  "Although the main entrance is closed for repairs, passengers can reach every platform through the side gate.",
];
repeats.forEach((text, i) => spoken(`s-repeat-${i + 1}`, "Listen and Repeat", text, "You are helping visitors become familiar with a railway station. Listen and repeat each sentence.", i < 2 ? 2 : i < 5 ? 3 : 4, i < 2 ? 8 : i < 5 ? 10 : 12));
const interview = [
  "Thank you for joining our study about everyday travel. First, think about a journey you make regularly, such as traveling to a class or a workplace. How do you usually make that journey, and why do you use that form of transport?",
  "Some people prefer a shorter journey even when it costs more, while others prefer to save money even if the journey takes longer. Which consideration is usually more important to you? Explain with an example.",
  "Imagine your university wants to help students travel to campus more easily. What improvement should it make first? Explain why that change would be useful.",
  "Do you think universities should encourage students to live close to campus, or is it more important to give students freedom to choose where they live? Explain your view, considering a possible benefit or difficulty.",
];
interview.forEach((text, i) => spoken(`s-interview-${i + 1}`, "Take an Interview", text, "Everyday travel and university life", i + 2, 45));
