import { addLinear, module, spoken } from "./form-3";
module("Writing", "linear");
const sentences: [string, string[], number[], string, number[][]?][] = [
  ["Where is your next seminar?", ["in the new building", "is", "my next seminar"], [2, 1, 0], "My next seminar is in the new building."],
  ["Why are you staying after class?", ["to ask", "the instructor", "I need", "a question"], [2, 0, 1, 3], "I need to ask the instructor a question."],
  ["Do you know the student by the door?", ["helped us", "who", "that is", "with the experiment", "the student"], [2, 4, 1, 0, 3], "That is the student who helped us with the experiment."],
  ["What did the coordinator ask you?", ["I could attend", "she asked", "whether", "the meeting", "me"], [1, 4, 2, 0, 3], "She asked me whether I could attend the meeting."],
  ["Can we use the new classroom?", ["until", "will not be available", "the room", "have been completed", "the repairs"], [2, 1, 0, 4, 3], "The room will not be available until the repairs have been completed.", [[0, 4, 3, 2, 1]]],
  ["Why did you check the instructions again?", ["before", "to make sure", "I wanted", "we started", "that everyone understood"], [2, 1, 4, 0, 3], "I wanted to make sure that everyone understood before we started.", [[0, 3, 2, 1, 4]]],
  ["How can the team finish on time?", ["the work", "more carefully", "unless", "organize", "we will miss the deadline", "we"], [4, 2, 5, 3, 0, 1], "We will miss the deadline unless we organize the work more carefully.", [[2, 5, 3, 0, 1, 4]]],
  ["What surprised you about the findings?", ["was", "how consistent", "the results were", "what surprised me"], [3, 0, 1, 2], "What surprised me was how consistent the results were."],
  ["Why is another study necessary?", ["whether", "to determine", "the effect persists", "more evidence is needed", "over time"], [3, 1, 0, 2, 4], "More evidence is needed to determine whether the effect persists over time."],
  ["Would additional funding have helped?", ["if", "could have been expanded", "had been available", "the project", "additional funding"], [3, 1, 0, 4, 2], "The project could have been expanded if additional funding had been available.", [[0, 4, 2, 3, 1]]],
];
sentences.forEach(([question, wordBank, order, sentence, acceptedOrders], i) => addLinear(`w-sentence-${i + 1}`, "Build a Sentence", { question, wordBank, slots: wordBank.length }, { order, ...(acceptedOrders ? { acceptedOrders } : {}) }, sentence, i < 3 ? 2 : i < 7 ? 3 : 4));
addLinear("w-email", "Write an Email", {
  scenario: "You are part of a university study group that reserved a library room for a project meeting. On arrival, you discovered that the room's display screen was not working, so your group could not review its presentation together. Write an email to the library services manager, Ms. Brooks.",
  requiredPoints: ["Describe the problem and explain how it affected your group.", "Explain what your group needs for its next meeting.", "Request a practical solution and suggest a suitable arrangement."],
}, null, "Explain the incident clearly and describe its practical effect. Identify what the next meeting requires, make a polite request, and propose a realistic alternative such as a different equipped room. Keep the purpose and recipient in mind when organizing the message.", 3);
addLinear("w-discussion", "Write for an Academic Discussion", {
  professorPost: "Professor Torres: Universities are trying to reduce food waste in campus dining halls. One proposal is to offer smaller standard portions and let students request more at no extra cost. Another is to keep the current portions and invest in better information about food waste. Which approach would be more effective, and why? State and support your view and make your own contribution to the discussion.",
  studentReplies: [
    { author: "Maya", text: "Smaller initial portions would let students take an amount that matches their appetite. They could still ask for more, so nobody would need to go hungry." },
    { author: "Elias", text: "Information can help students make choices in many settings, not just one dining hall. Posters showing how much food is wasted could encourage lasting changes." },
  ], minWords: 100,
}, null, "Explain why your preferred approach would change behavior, with a specific example or condition. Consider an implementation issue or a limit of the alternative. Develop an original contribution rather than copying the students' wording; apply the discussion rubric holistically.", 4);
module("Speaking", "linear");
const repeats = [
  "The visitor entrance is beside the research garden.",
  "Please leave your outdoor shoes on the rack by the door.",
  "The greenhouse contains plants from several different climates.",
  "You may take photographs without touching the plants on display.",
  "Visitors who join the guided walk should meet near the water tank.",
  "The laboratory windows allow you to observe the researchers without interrupting their work.",
  "If you would like more information about the current projects, you can collect a booklet at the reception desk.",
];
repeats.forEach((text, i) => spoken(`s-repeat-${i + 1}`, "Listen and Repeat", text, "You are helping with an orientation visit to a research center. Listen and repeat each sentence.", i < 2 ? 2 : i < 5 ? 3 : 4, i < 2 ? 8 : i < 5 ? 10 : 12));
const interview = [
  "Thank you for taking part in our research about working with other people. First, think about a time when you completed a task as part of a group. What was the task, and what was your role?",
  "Some people prefer to divide a group project into separate individual tasks, while others prefer to work on each part together. Which approach do you usually prefer, and why?",
  "Imagine that two members of a student project team disagree about the best way to proceed. What should the team do to make a useful decision? Explain your recommendation.",
  "Do you think a university should give all members of a project group the same grade, or should individual contributions receive different grades? Explain your view, including a possible difficulty with your preferred approach.",
];
interview.forEach((text, i) => spoken(`s-interview-${i + 1}`, "Take an Interview", text, "Collaboration and group decisions", i + 2, 45));
