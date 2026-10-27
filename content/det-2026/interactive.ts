import { add, audio } from "./form-1";

function reading(set: string, title: string, opening: string, blanks: { text: string; options: string[]; correct: number }[], bridge: string,
  ending: string, distractors: string[], highlights: [string,string][], idea: string[], titleOptions: string[]) {
  const group = { key: set, seconds: 420 };
  const passage = `${opening}\n\n${bridge}\n\n${ending}`;
  let cloze=opening;
  blanks.forEach((blank,i)=>{const word=blank.options[blank.correct];const regex=new RegExp(`\\b${word}\\b`);if(!regex.test(cloze))throw new Error(`Missing cloze word: ${word}`);cloze=cloze.replace(regex,`___${i}___`);});
  add(`${set}-words`, "Interactive Reading: Complete the Sentences", "reading-words", "Reading",420,
    {instruction:"Select the best option for each missing word.", title, passage:cloze, blanks:blanks.map(({text,options})=>({text,options}))},
    {choices:blanks.map((b)=>b.correct)}, {group,set,step:1});
  add(`${set}-sentence`,"Interactive Reading: Complete the Passage","reading-sentence","Reading",420,
    {instruction:"Select the best sentence to fill in the blank.",title,passage:`${opening}\n\n[ … ]\n\n${ending}`,options:{options:[distractors[0],bridge,...distractors.slice(1)]}},
    {options:1},{group,set,step:2});
  highlights.forEach(([question,target],i)=> {
    const tokens=passage.split(/\s+/), words=target.split(/\s+/); const start=tokens.findIndex((_,n)=>tokens.slice(n,n+words.length).join(" ")===target);
    if(start<0)throw new Error(`Highlight missing: ${target}`);
    add(`${set}-highlight-${i+1}`,"Interactive Reading: Highlight the Answer","highlight","Reading",420,
      {instruction:"Click and drag the text to highlight the answer to the question below.",title,passage,text:question}, {start,end:start+words.length-1},{group,set,step:i+3});
  });
  add(`${set}-idea`,"Interactive Reading: Identify the Idea","choice","Reading",420,
    {instruction:"Select the idea that is expressed in the passage.",title,passage,options:{options:idea}},{options:0},{group,set,step:5});
  add(`${set}-title`,"Interactive Reading: Title the Passage","choice","Reading",420,
    {instruction:"Select the best title for the passage.",passage,options:{options:titleOptions}},{options:2},{group,set,step:6});
}
reading("reading-1","A different kind of library",
  "When a neighbourhood library began lending kitchen tools, some residents were surprised. The staff had noticed that people often needed an expensive item for just one afternoon. Buying it made little sense if it would then remain unused in a cupboard. A small collection of mixers and baking tins offered an alternative. Each borrower received simple instructions and agreed to return the equipment clean.",
  [{text:"Missing word 1",options:["library","hospital","factory"],correct:0},
   {text:"Missing word 2",options:["avoided","needed","prevented"],correct:1},
   {text:"Missing word 3",options:["Selling","Forgetting","Buying"],correct:2},
   {text:"Missing word 4",options:["obstacle","alternative","exception"],correct:1},
   {text:"Missing word 5",options:["broken","clean","missing"],correct:1}],
  "The collection soon expanded because residents donated useful items they rarely used themselves.",
  "Staff members then introduced short demonstrations on Saturday mornings. These sessions helped visitors feel confident using unfamiliar equipment and gave neighbours a reason to talk. The project was not without difficulties: checking every item took time, and popular tools sometimes had waiting lists. Rather than abandoning the scheme, the library trained volunteers to inspect returns. It also published a booking calendar. The service showed that a library could reduce unnecessary purchases while creating opportunities for practical learning. Its success depended on careful organisation as much as on the equipment itself.",
  ["The library therefore stopped accepting any equipment donations.","Most residents preferred to buy every item after one use.","The demonstrations were cancelled before the collection opened."],
  [["Why did buying some tools make little sense?","it would then remain unused in a cupboard."],["Who inspected returned items after the project grew?","volunteers"]],
  ["Lending practical equipment can benefit a community when the service is carefully managed.","Libraries should replace all books with kitchen equipment.","Buying tools is always cheaper than sharing them.","Demonstrations are unnecessary when written instructions exist."],
  ["The History of Kitchen Technology","Why Libraries Should Stop Lending Books","Sharing Tools, Building a Community","A Guide to Buying Expensive Equipment"]);
reading("reading-2","Learning from a quiet street",
  "A city closed one residential street to through traffic for a six-month trial. Officials wanted to find out whether a quieter environment would encourage people to spend more time outdoors. Instead of making permanent changes immediately, they used removable planters to redirect vehicles. Residents could still reach their homes, and emergency access remained open. Before the trial began, researchers counted pedestrians and interviewed local businesses.",
  [{text:"Missing word 1",options:["closed","repeated","hired"],correct:0},
   {text:"Missing word 2",options:["ignore","conceal","encourage"],correct:2},
   {text:"Missing word 3",options:["removable","edible","invisible"],correct:0},
   {text:"Missing word 4",options:["never","still","rarely"],correct:1},
   {text:"Missing word 5",options:["Before","Despite","Unless"],correct:0}],
  "Repeating these observations during the trial allowed the researchers to distinguish lasting changes from initial curiosity.",
  "The results were mixed. More children played outside, and several cafes reported longer visits. However, deliveries became less convenient for two shops near the barriers. Interviews revealed another complication: some older residents appreciated the reduced noise but found the new walking routes confusing. The city added clearer signs and moved one planter. By the end of the trial, support had increased, although not everyone agreed on the final design. The exercise demonstrated the value of testing an idea before committing to expensive construction. It also showed why simple counts cannot replace listening to the people affected.",
  ["The researchers refused to gather any evidence after the first day.","All businesses agreed that deliveries had become easier.","Permanent concrete barriers had already replaced every planter."],
  [["What did the city use to redirect vehicles?","removable planters"],["What made the walking routes easier to understand?","clearer signs"]],
  ["Temporary street changes can reveal both benefits and problems that inform a better final design.","All residents opposed quieter streets.","Pedestrian counts alone explain every effect of a transport policy.","Cities should avoid consulting local businesses."],
  ["The End of Local Shopping","How to Build a Permanent Road","A Street Trial That Helped a City Learn","Why Emergency Vehicles Need New Routes"]);

function listening(set:string, scenario:string, questions:string[], accepted:string[][], turns:[string,string[],number][], speaker:number) {
  const group={key:set,seconds:390}; const scenarioAudio=audio(`${set}-scenario`,scenario,speaker);
  add(`${set}-complete`,"Interactive Listening: Listen and Complete","listen-complete","Listening",390,
    {instruction:"Listen to the scenario and complete the sentences.",audioUrl:scenarioAudio,blanks:questions.map((text)=>({text}))}, {accepted},{group,set,step:1,scenarioAudio});
  turns.forEach(([text,options,correct],i)=>add(`${set}-respond-${i+1}`,"Interactive Listening: Listen and Respond","listen-respond","Listening",390,
    {instruction:"Select the best response to continue the conversation.",audioUrl:audio(`${set}-turn-${i+1}`,text,speaker===0?1:0),options:{options},_transcript:text},
    {options:correct},{group,set,step:i+2,scenarioAudio}));
  add(`${set}-summary`,"Interactive Listening: Summarize the Conversation","summary","Writing",75,
    {instruction:"Write a summary of the conversation you just had.",text:"Include who was speaking, the problem, and the outcome. Write a connected paragraph."},null,{set,step:7});
}
listening("listening-1",
  "You are a university student working on a group presentation about local history. Your group has booked a room in the library for Thursday afternoon, but the room has no projector. You need to show old photographs during the presentation. You are speaking with a library assistant to find a suitable alternative.",
  ["Your group is preparing a presentation about ___.","The room is booked for ___ afternoon.","The group needs a ___ to show photographs."],
  [["local history","the history of the area","history of the local area"],["Thursday","Thursday afternoon"],["projector","a projector"]],
  [["Hello! You mentioned a problem with your room booking. Could you explain what you need?",["We need to show photographs, but our booked room has no projector.","I would like to renew a history book.","We have already finished our presentation.","I do not know where the photographs came from."],0],
   ["I see. The media room has a projector, but it is only free after four on Thursday. Would that work?",["The projector is about local history.","Our group can meet at four, so that would be helpful.","Thursday was yesterday in every room.","I will return the room next week."],1],
   ["Great. It seats eight people. How many students are in your group?",["The photographs are black and white.","We have eight rooms in the library.","There are six of us, so there should be enough space.","I would prefer to cancel every booking."],2],
   ["That will be fine. You will need to bring a laptop and a suitable cable. Do you have those?",["The library closes in the evening.","The room does not need any chairs.","Six people are studying history.","We have a laptop, but could we borrow a cable from the desk?"],3],
   ["Certainly. Please collect the cable ten minutes before your session, and return it before the desk closes at six.",["Thank you. I will collect it at three fifty and return it before six.","I will leave the cable in the street.","We will arrive after the desk closes.","There is no need to bring a laptop."],0]],0);
listening("listening-2",
  "You are taking an environmental science course. Your class is collecting information about household food waste for a research project. Your survey currently asks people to estimate how much food they throw away each month. You are meeting your professor because you are concerned that people may not remember accurately.",
  ["The research project concerns household ___.","The survey currently asks about waste over one ___.","You are worried that people's estimates may not be ___."],
  [["food waste","wasted food","household food waste"],["month","a month"],["accurate","reliable","correct"]],
  [["You said you had a concern about your survey. What have you noticed?",["I think remembering a whole month's food waste may be difficult.","The course has no research project.","I have already measured every household.","My survey is about library opening hours."],0],
   ["That is a reasonable concern. What could you ask participants to do instead?",["Forget the food they have thrown away.","Keep a short daily record for one week.","Guess how much their neighbours waste.","Avoid reading the survey questions."],1],
   ["A diary could help, but it may take more effort. How would you make it manageable?",["Ask them to write a long essay every evening.","Leave every category undefined.","Provide a simple table with clear examples.","Only collect information from other countries."],2],
   ["Good. Remember that one unusual week might not represent normal behaviour. How could you address that?",["Assume every week is identical.","Remove all questions about timing.","Tell participants which answers to choose.","Ask whether the week was typical and explain this limitation in our report."],3],
   ["Exactly. Try your revised table with two volunteers first, then send me their feedback before recruiting the full group.",["I will run a small pilot and share what the volunteers find confusing.","I will publish the final findings before collecting data.","I will stop recording limitations.","The volunteers should write my report instead."],0]],1);

const photos=["market","library","bicycle"];
photos.forEach((name,i)=>add(`photo-write-${i+1}`,"Write About the Photo","photo-write","Writing",60,
  {instruction:"Write one or more sentences that describe the image below.",imageUrl:`/images/det-2026/${name}.jpg`,imageAlt:`Practice photograph ${i+1}`},null));
add("writing-1","Interactive Writing","writing","Writing",300,
  {instruction:"Write about the topic below for 5 minutes.",text:"Describe a practical skill you learned outside a classroom. Explain how you learned it, what was difficult, and why the skill matters to you."},null,{prep:30,set:"writing",step:1});
add("writing-2","Interactive Writing","writing","Writing",180,
  {instruction:"Write a follow-up response for 3 minutes.",text:"Think about the learning experience you described. How would you teach that skill to a beginner? Explain what you would do differently from the way you learned it."},null,{previousKey:"writing-1",set:"writing",step:2});
add("photo-speak","Speak About the Photo","photo-speak","Speaking",90,
  {instruction:"Speak about the image below.",imageUrl:"/images/det-2026/park.jpg",imageAlt:"Practice photograph for speaking"},null,{prep:20});
add("read-speak","Read, Then Speak","read-speak","Speaking",90,
  {instruction:"Speak about the topic below.",text:"Describe a place in your town that you would recommend to a new resident. Where is it? What can people do there? Why do you think it is worth visiting?"},null,{prep:20});
[
  "Let's talk about learning new things. What is something you enjoy learning, and why?",
  "When you start learning something unfamiliar, how do you decide where to begin?",
  "Describe a time when another person helped you understand something difficult.",
  "Some people prefer learning alone, while others prefer a group. What are the advantages of each?",
  "How could a teacher help someone who has lost confidence after making mistakes?",
  "Do you think opportunities to learn will change in the future? Explain your view.",
].forEach((text,i)=>add(`interview-${i+1}`,"Interactive Speaking","interview","Speaking",35,
  {instruction:"Listen to the question, then record your answer.",audioUrl:audio(`interview-${i+1}`,text,1),_transcript:text},null,{set:"speaking",step:i+1}));
add("writing-sample","Writing Sample","writing-sample","Writing",300,
  {instruction:"Write about the topic below for 5 minutes.",text:"Some communities turn unused buildings into shared spaces. Describe one kind of shared space you would create, explain who would benefit, and discuss a challenge that would need to be solved."},null,{prep:30});
add("speaking-sample","Speaking Sample","speaking-sample","Speaking",180,
  {instruction:"Speak about the topic below.",text:"Describe an experience that changed how you think about working with other people. Explain what happened, what you learned, and how you might use that lesson in the future."},null,{prep:30});
