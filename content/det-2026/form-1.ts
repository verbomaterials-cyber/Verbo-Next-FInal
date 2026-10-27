import { DET_FORMAT, type DetMeta } from "../../src/lib/det-format";
export type DetQuestion = { key: string; type: string; prompt: Record<string, unknown>; answer: Record<string, unknown> | null; difficulty: number; feedback: string };
export const questions: DetQuestion[] = [];
export const audioScripts: { id: string; text: string; speaker: number }[] = [];
export function audio(id: string, text: string, speaker = 0) {
  audioScripts.push({ id, text, speaker }); return `/audio/det-2026/${id}.wav`;
}
export function add(key: string, type: string, task: DetMeta["task"], skill: DetMeta["skill"], seconds: number,
  prompt: Record<string, unknown>, answer: Record<string, unknown> | null, extra: Partial<DetMeta> = {}, feedback = "") {
  questions.push({ key, type, prompt: { ...prompt, _det: { format: DET_FORMAT.version, key, task, skill, seconds, prep: 0, ...extra } }, answer, difficulty: extra.level ?? 3,
    feedback: feedback || "Revisa el contexto, el propósito y la precisión de tu respuesta con tu asesor." });
}
const words: [string, boolean][][] = [
  [["window",true],["cautious",true],["meticulous",true]], [["brindlef",false],["sustract",false],["plausivity",false]],
  [["garden",true],["reluctant",true],["ambiguous",true]], [["chareful",false],["mindify",false],["perseveratez",false]],
  [["borrow",true],["efficient",true],["ubiquitous",true]], [["tablesome",false],["respondate",false],["subsequental",false]],
  [["quiet",true],["reliable",true],["conscientious",true]], [["mornfuly",false],["describeful",false],["incompativate",false]],
  [["narrow",true],["evidence",true],["pragmatic",true]], [["walkment",false],["accuracity",false],["circumspectful",false]],
  [["improve",true],["flexible",true],["resilient",true]], [["runnish",false],["predictness",false],["empiricity",false]],
  [["journey",true],["adequate",true],["tentative",true]], [["chairness",false],["analysify",false],["discrepancious",false]],
  [["measure",true],["sustain",true],["corroborate",true]], [["bookwisez",false],["relevancyx",false],["unprecedentive",false]],
];
function word(i: number) {
  words[i].forEach(([text, real], j) => add(`word-${i+1}-${j}`, "Read and Select", "word", "Reading", 5,
    { instruction: "Is this a real English word?", text, options: { options: ["Yes", "No"] } }, { options: real ? 0 : 1 }, { slot: `word-${i+1}`, level: [1,3,5][j] as 1|3|5 }, real ? `${text} is an English word.` : `${text} is not a standard English word.`));
}
const sentences = [
  ["Please cl[ose] the door before you leave.", "The instructions were clear enough to fo[llow] without help.", "The figures appear to con[tradict] the proposed explanation."],
  ["We bought fresh br[ead] at the bakery.", "The museum will ex[tend] its opening hours this summer.", "Her conclusion was con[tingent] on further independent evidence."],
  ["He wears a warm co[at] in winter.", "A local charity will pro[vide] all the equipment.", "The committee tried to rec[oncile] the two conflicting accounts."],
  ["The bus will ar[rive] at six.", "Students must sub[mit] their applications by Friday.", "The proposal was scr[utinized] before funding was approved."],
  ["We can me[et] outside the library.", "The new bridge will re[duce] travel time between the villages.", "The experiment revealed a sub[stantial] difference between the groups."],
  ["She put the book on the sh[elf].", "Regular practice can str[engthen] your confidence.", "The historian sought to dis[tinguish] fact from speculation."],
];
function letters(i: number) {
  sentences[i].forEach((text,j) => add(`blank-${i+1}-${j}`, "Fill in the Blanks", "letters", "Reading", 20,
    { instruction: "Complete the sentence with the correct word.", text }, { answers: [...text.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]) }, { slot:`blank-${i+1}`, level:[1,3,5][j] as 1|3|5 }));
}
const passages = [
  ["Our town has a small mar[ket] every Saturday. Farmers br[ing] vegetables from nearby farms. People enj[oy] talking while they shop. Last week a new stall opened, selling bread made with local flour. The owner hopes to ret[urn] next weekend.",
   "Community gardens offer more than fresh food. Neigh[bours] who rarely meet can work together and ex[change] practical advice. Some gardens also col[lect] rainwater to reduce waste. Although each plot belongs to a different family, decisions about shared paths are made tog[ether]. This cooperation can strengthen relationships across the neighbourhood.",
   "Urban gardens are sometimes credited with restoring social co[hesion], yet their effects depend on how access is organised. A project that ex[cludes] residents without spare time may reinforce existing differences. Successful organisers therefore dis[tribute] responsibilities flexibly and consult participants before allocating space. Their approach suggests that shared ownership, rather than cultivation alone, is the dec[isive] ingredient."],
  ["A friend invited me to a music class. I had never played a gui[tar] before. The teacher showed us how to hold the instrument and move our fin[gers]. We practised one short song. It was dif[ficult] at first, but by the end I could play it slowly. I decided to con[tinue] the lessons.",
   "Learning an instrument involves repeated practice, but simply repeating a passage is not always eff[ective]. Musicians often divide a difficult piece into short sec[tions]. They focus on one problem at a time and gradually increase the speed. Recording a practice session can also rev[eal] errors that are hard to notice while playing. Progress depends on attention as much as dur[ation].",
   "Researchers investigating musical expertise emphasise the qua[lity] of practice rather than its duration alone. Learners benefit when tasks are challenging enough to require focused attention but not so difficult that meaningful feedback becomes imp[ossible]. Alternating demanding exercises with familiar material may sustain motivation. This balance also enables performers to con[solidate] techniques without becoming excessively dependent on a single routine. Expertise emerges through del[iberate] adjustment."],
  ["Our class visited a river near the school. We looked for small ani[mals] in the water and counted the trees beside it. The teacher asked us to write down what we could see. We took pho[tos] of the bridge and made a map. Back at school, we sha[red] our notes and discussed how to keep the river cl[ean].",
   "A school river project began with a simple question about water quality. Students col[lected] samples at several locations and compared their results. They soon realised that a single visit could not show a reliable pat[tern]. Rainfall and temperature changed the readings. By repeating their measurements over several months, they developed a better under[standing] of the river. The project demonstrated why scientific conclusions require con[sistent] observation.",
   "Environmental monitoring often relies on volunteers whose observations extend beyond the reach of professional teams. Their con[tributions] can reveal local changes, although inconsistent methods may introduce uncertainty. Coordinators address this problem by providing clear protocols and retaining information about the cir[cumstances] of each measurement. Instead of discarding imperfect observations, analysts assess their rel[iability] alongside other evidence. This approach reconciles broad participation with methodological cau[tion]."],
];
function complete(i:number) { passages[i].forEach((text,j)=>add(`complete-${i+1}-${j}`,"Read and Complete","letters","Reading",180,
  {instruction:"Type the missing letters to complete the text below.",text}, {answers:[...text.matchAll(/\[([^\]]+)\]/g)].map((m)=>m[1])}, {slot:`complete-${i+1}`,level:[1,3,5][j] as 1|3|5})); }
const dictations = [
  ["The library closes at six today.","The library has extended its opening hours for the examination period.","Although the library normally closes early, additional study spaces will remain available throughout the examination period."],
  ["Please bring a notebook to the meeting.","Participants should bring a notebook and check the updated meeting schedule.","Participants who cannot attend the preliminary meeting should request the revised schedule from the programme coordinator."],
  ["We walked to the station after lunch.","The new footbridge makes it easier to reach the station from the park.","Despite initial concerns about its cost, the footbridge has considerably improved pedestrian access to the station."],
  ["She is learning to repair her bicycle.","The workshop teaches students how to repair a bicycle using basic tools.","Rather than replacing damaged components immediately, participants are encouraged to determine whether a simple repair would be sufficient."],
  ["The students planted trees behind the school.","The students recorded how much the newly planted trees grew each month.","The researchers attributed the variation in growth primarily to differences in soil moisture rather than exposure to sunlight."],
  ["Our teacher asked us to read the report.","Before drawing a conclusion, compare the findings with the original research question.","The report acknowledges that its findings cannot be generalised without further investigation involving a more representative sample."],
];
function dictation(i:number) { dictations[i].forEach((text,j)=>add(`dictation-${i+1}-${j}`,"Listen and Type","dictation","Listening",60,
  {instruction:"Type the statement that you hear.",audioUrl:audio(`dictation-${i+1}-${j}`,text,j%2)}, {transcript:text}, {slot:`dictation-${i+1}`,level:[1,3,5][j] as 1|3|5})); }

// Mixed short tasks. Each slot selects one of three original editorial levels.
for(let block=0;block<3;block++) { for(let n=0;n<(block===2?6:5);n++) word(block*5+n); letters(block*2); dictation(block*2); complete(block); letters(block*2+1); dictation(block*2+1); }
