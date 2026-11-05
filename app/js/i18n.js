// All student-facing text. Czech is the default. Czech strings don't assume the student's gender.
import { store } from "./util.js";

export const lang = () => store.get("lang", "cs");
export function setLang(l) { store.set("lang", l); document.documentElement.lang = l; }
const plCs = (n, one, few, many) => n === 1 ? one : (n >= 2 && n <= 4 ? few : many);
export const pl = (n, cs, en) => lang() === "en" ? `${n} ${n === 1 ? en[0] : en[1]}` : `${n} ${plCs(n, ...cs)}`;
export const days = n => pl(n, ["den", "dny", "dní"], ["day", "days"]);
export const pages = n => pl(n, ["strana", "strany", "stran"], ["page", "pages"]);
export const hours = n => lang() === "en" ? `${n} h` : `${String(n).replace(".", ",")} h`;
export const itemCount = n => pl(n, ["položka", "položky", "položek"], ["item", "items"]);
export const lessonCount = n => pl(n, ["lekce", "lekce", "lekcí"], ["lesson", "lessons"]);
export const fileCount = n => pl(n, ["soubor", "soubory", "souborů"], ["file", "files"]);
export const minutesLeft = sec => lang() === "en" ? (sec < 60 ? "Less than a minute left" : `About ${Math.ceil(sec / 60)} min left`) : (sec < 60 ? "Zbývá méně než minuta" : `Zbývá asi ${Math.ceil(sec / 60)} min`);
export const voiceMinutes = sec => { const m = Math.floor(sec / 60); return lang() === "en" ? `${m} min left` : `Zbývá ${m} min`; };
export const times = n => pl(n, ["krát", "krát", "krát"], ["time", "times"]);

const D = {
  cs: {
    brand: "Penny", landingTitle: "Slidy dovnitř. Kurz na zkoušku ven.", landingSub: "Nahraj přednášky a dostaneš kurz jako hru: kartičky, kvízy a plán až do dne testu.",
    landingStart: "Začít", landingHaveCode: "Už mám kód", landingResume: "Pokračovat v nastavení", landingWait: "Můj kurz", how1: "Nahraj slidy", how2: "Vyber si učitele", how3: "Nastav plán", how4: "Uč se",
    testBadge: "Testovací verze", inviteTitle: "Máš pozvánku?", inviteSub: "Teď to zkouší jen pár lidí. Zadej kód z pozvánky.", invitePh: "Kód pozvánky", next: "Pokračovat", back: "Zpět", close: "Zavřít",
    loginTitle: "Zadej svůj kód", loginSub: "Je to 8 znaků, které se ukázaly po koupi.", loginPh: "Tvůj kód", loginGo: "Přihlásit",
    errbad_invite: "Tenhle kód nefunguje.", errbad_code: "Tenhle kód nefunguje.", errtoo_many: "Moc pokusů. Zkus to za 10 minut.", erroffline: "Jsi offline. Zkus to znovu.", errserver: "Něco se pokazilo. Zkus to znovu.",
    errbad_type: "Jen PDF nebo PPTX.", errtoo_big: "Soubor je větší než 50 MB.", errtoo_many_files: "Maximálně 20 souborů.", errorder_too_big: "Celkem maximálně 200 MB.", errstorage_full: "Testovací úložiště je plné. Zkus to později.", errno_files: "Nejdřív nahraj aspoň jeden soubor.", errincomplete: "Něco v nastavení chybí.", errfake: "Tohle není platné PDF ani PPTX.",
    filesTitle: "Nahraj své slidy", filesSub: "PDF nebo PPTX, až 50 MB na soubor.", filesDrop: "Vybrat soubory", filesPages: "stran", filesEst: "odhad", filesUploading: "Nahrávám…", filesFailed: "Nepovedlo se", filesRemove: "Odebrat", filesTotal: "Celkem", filesNote: "Soubory uvidí jen ty a ten, kdo staví kurz. Nahrávej jen materiály, které smíš používat.",
    tutorTitle: "Kdo tě bude učit?", tutorSub: "Provede tě celým kurzem.",
    dateTitle: "Kdy máš test?", dateSub: "Podle toho poskládáme plán.", dateIn: "za", dateErr: "Vyber datum v budoucnu.",
    timeTitle: "Kolik času tomu dáš?", timeMin: "Minut denně", timeDays: "Dní v týdnu",
    fcHead: "Víc času a pravidelnosti = lepší šance na úspěch", fcHours: "hodin", fcCover: "stihneš", fcRepeat: "opakování", fcGap: "dne mezi učením",
    fcL0: "Všechno nestihneš", fcL1: "Stihneš jen jedno projití", fcL2: "Stihneš projít i opakovat", fcL3: "Silná příprava",
    fcL0s: "Část látky zůstane nepřečtená.", fcL1s: "Bez opakování se hodně zapomene.", fcL2s: "Základ máš. Pravidelnost ti pomůže ještě víc.", fcL3s: "Časté opakování v krátkých rozestupech je nejúčinnější.",
    fcYou: "Tvůj plán", fcMore: "O trochu víc denně", fcDaily: "Každý den", fcEst: "Odhad z počtu stran a tvého času, ne slib výsledku. Počítáme 1,5 minuty na stranu poprvé a 0,5 minuty při opakování.", fcMinDay: "min/den", fcDaysWk: "dní/týden", fcNoPass: "projdeš", fcRep: "opakování",
    storeTitle: "Vyber si kurz", storeRecap: "Tvůj plán", storeTest: "TESTOVACÍ REŽIM: nic se neplatí, kliknutí = koupeno.", storeBuy: "Koupit (test)", storeBuying: "Moment…", storeFiles: "souborů", storeBest: "Doporučujeme", storeTestDate: "Test",
    buildWhat: "Co stavíme", buildQueued: "Čeká na spuštění. Samotná stavba zabere asi % min.", buildTotal: "Stavba zabere asi % min.", buildAlmost: "Skoro hotovo", buildStale: "Trvá to déle, než jsme čekali. Kurz se objeví tady, nemusíš nic dělat.",
    buildStage_outline: "Procházíme slidy a plánujeme lekce", buildStage_lessons: "Píšeme lekce a otázky", buildStage_checking: "Kontrolujeme otázky proti slidům", buildStage_publishing: "Dokončujeme kurz",
    waitTitle: "Stavíme tvůj kurz", waitSub: "Můžeš to zavřít. Až bude hotovo, najdeš ho tady.", waitReady: "Kurz je hotový!", waitReadySub: "Můžeš začít.", waitStart: "Začít kurz", waitFailed: "Něco se zadrhlo", waitFailedSub: "Podíváme se na to. Tvůj kód platí dál.", waitS1: "Soubory přijaté", waitS2: "Čtení slidů", waitS3: "Stavba lekcí", waitS4: "Hotovo",
    codeTitle: "Tvůj přístupový kód", codeSave: "Ulož si ho. S ním se přihlásíš na jiném zařízení.", codeCopy: "Zkopírovat", codeCopied: "Zkopírováno",
    navPath: "Cesta", navPractice: "Procvičovat", navProgress: "Pokrok", navVoice: "Hlas",
    voiceTitle: "Hlasový doučovatel", voiceSub: "Zeptej se na cokoliv z kurzu.", voiceStart: "Začít hovor", voiceEnd: "Ukončit hovor", voiceLimit: "Jeden hovor trvá nejvýš 10 minut. Přesný čas se započítá po hovoru.", voiceListening: "Poslouchám…", voiceSpeaking: "Mluvím…", voiceMic: "Bez mikrofonu to nepůjde. Povol ho v prohlížeči a zkus to znovu.",
    voiceCapTitle: "Minuty došly", voiceCapSub: "Všechny hlasové minuty máš provolané. Další si budeš moct brzy dokoupit a pokračovat dál.", voiceBuy: "Dokoupit minuty (připravujeme)", voiceOffTitle: "Hlas tu není", voiceOffSub: "Tenhle kurz hlasového doučovatele nemá.", voiceSoonTitle: "Připravujeme", voiceSoonSub: "Hlasový doučovatel tu bude brzy. Tvoje minuty zatím běžet nezačaly.",
    errvoice_cap: "Hlasové minuty došly.", errvoice_off: "Tenhle kurz hlasového doučovatele nemá.", errvoice_not_configured: "Hlasový doučovatel se ještě připravuje.", errvoice_failed: "Hovor se nepodařilo spustit. Zkus to znovu.",
    unit: "Jednotka", startBubble: "START", todayGoal: "Dnešní cíl", todayItems: "položek", daysLeft: "do testu", testToday: "Test je dnes", testPast: "Test už byl",
    pick: "Vyber správnou odpověď", tfQ: "Pravda, nebo ne?", tfT: "Pravda", tfF: "Nepravda", check: "Kontrola", cont: "Pokračovat", correctIs: "Správně je:", fillQ: "Doplň chybějící slovo", fillPh: "Napiš odpověď", matchQ: "Spoj dvojice", showAns: "Ukázat odpověď", cardNew: "nová", cardRepeat: "opakování",
    gNo: "Nevím", gNoS: "znovu", gHard: "Těžké", gHardS: "brzy", gYes: "Vím", gYesS: "později", gEasy: "Hračka", gEasyS: "za dlouho",
    say1: "Správně!", say2: "Přesně tak!", say3: "Výborně!", say4: "Skvěle!", mistakeMatch: "Spojeno, ale s chybou.", source: "Zdroj", srcPage: "str.", srcSlides: "slidy", srcLecture: "přednáška", srcSection: "část",
    doneTitle: "Lekce hotová!", doneMore: "Dílčí kolo hotové!", xp: "XP", correct: "Správně", streak: "Série", read: "Přečteno",
    pracTitle: "Procvičovat", pracDue: "Kartičky k opakování", pracMistakes: "Moje chyby", pracMix: "Rychlý mix", pracNone: "Teď nic", pracItems: "položek", pracEmpty: "Nejdřív dokonči první lekci.",
    progTitle: "Pokrok", progLearned: "Zvládnuto", progStreak: "Dní v řadě", progDays: "Do testu", progPlan: "Tvůj plán", progPace: "Tempo", progPaceNeed: "Aby se stihlo všechno", settings: "Nastavení", setLang: "Jazyk", setSound: "Zvuky", setOn: "Zapnuté", setOff: "Vypnuté", setLogout: "Odhlásit", setLogoutQ: "Bez kódu se zpátky nedostaneš. Máš ho uložený?", setCode: "Kód", synced: "V cloudu", syncing: "Ukládám…", offline: "Offline, uložím později", setDate: "Datum testu", paceDaily: "denně",
    courseFail: "Kurz se nepodařilo načíst.", retry: "Zkusit znovu", sessionExpired: "Přihlas se znovu svým kódem.", noPlan: "Plán není nastavený", minPerDay: "min denně", perWeek: "× týdně",
  },
  en: {
    brand: "Penny", landingTitle: "Slides in. Exam course out.", landingSub: "Upload your lectures and get a course that plays like a game: flashcards, quizzes and a plan up to test day.",
    landingStart: "Get started", landingHaveCode: "I have a code", landingResume: "Continue setup", landingWait: "My course", how1: "Upload slides", how2: "Pick a teacher", how3: "Set your plan", how4: "Learn",
    testBadge: "Test version", inviteTitle: "Got an invite?", inviteSub: "Only a few people are trying this for now. Enter your invite code.", invitePh: "Invite code", next: "Continue", back: "Back", close: "Close",
    loginTitle: "Enter your code", loginSub: "It's the 8 characters shown after you bought the course.", loginPh: "Your code", loginGo: "Log in",
    errbad_invite: "That code doesn't work.", errbad_code: "That code doesn't work.", errtoo_many: "Too many tries. Try again in 10 minutes.", erroffline: "You're offline. Try again.", errserver: "Something went wrong. Try again.",
    errbad_type: "PDF or PPTX only.", errtoo_big: "That file is over 50 MB.", errtoo_many_files: "20 files at most.", errorder_too_big: "200 MB in total at most.", errstorage_full: "Test storage is full. Try again later.", errno_files: "Upload at least one file first.", errincomplete: "Something in your setup is missing.", errfake: "That isn't a valid PDF or PPTX.",
    filesTitle: "Upload your slides", filesSub: "PDF or PPTX, up to 50 MB per file.", filesDrop: "Choose files", filesPages: "pages", filesEst: "estimate", filesUploading: "Uploading…", filesFailed: "Failed", filesRemove: "Remove", filesTotal: "Total", filesNote: "Only you and the person building the course see your files. Upload only material you're allowed to use.",
    tutorTitle: "Who will teach you?", tutorSub: "They'll guide you through the whole course.",
    dateTitle: "When is your test?", dateSub: "We'll build your plan around it.", dateIn: "in", dateErr: "Pick a future date.",
    timeTitle: "How much time will you give it?", timeMin: "Minutes a day", timeDays: "Days a week",
    fcHead: "More time and consistency = a better chance of success", fcHours: "hours", fcCover: "covered", fcRepeat: "repeats", fcGap: "days between sessions",
    fcL0: "You won't get through it all", fcL1: "Time for one pass only", fcL2: "Time to cover and repeat", fcL3: "Strong preparation",
    fcL0s: "Part of the material stays unread.", fcL1s: "Without repeats, a lot gets forgotten.", fcL2s: "You have the basics. More regular study helps even more.", fcL3s: "Frequent repeats in short gaps work best.",
    fcYou: "Your plan", fcMore: "A bit more each day", fcDaily: "Every day", fcEst: "An estimate from your page count and time, not a promise of results. We assume 1.5 minutes a page the first time and 0.5 minutes on repeats.", fcMinDay: "min/day", fcDaysWk: "days/week", fcNoPass: "covered", fcRep: "repeats",
    storeTitle: "Choose your course", storeRecap: "Your plan", storeTest: "TEST MODE: nothing is charged, a click counts as bought.", storeBuy: "Buy (test)", storeBuying: "One moment…", storeFiles: "files", storeBest: "Recommended", storeTestDate: "Test",
    buildWhat: "What we're building", buildQueued: "Waiting to start. The build itself takes about % min.", buildTotal: "The build takes about % min.", buildAlmost: "Almost done", buildStale: "This is taking longer than expected. Your course will appear here, nothing for you to do.",
    buildStage_outline: "Going through your slides and planning lessons", buildStage_lessons: "Writing lessons and questions", buildStage_checking: "Checking the questions against your slides", buildStage_publishing: "Finishing the course",
    waitTitle: "We're building your course", waitSub: "You can close this. It'll be here when it's done.", waitReady: "Your course is ready!", waitReadySub: "You can start now.", waitStart: "Start the course", waitFailed: "Something got stuck", waitFailedSub: "We will take a look. Your code still works.", waitS1: "Files received", waitS2: "Reading slides", waitS3: "Building lessons", waitS4: "Done",
    codeTitle: "Your access code", codeSave: "Save it. You'll need it to log in on another device.", codeCopy: "Copy", codeCopied: "Copied",
    navPath: "Path", navPractice: "Practice", navProgress: "Progress", navVoice: "Voice",
    voiceTitle: "Voice tutor", voiceSub: "Ask anything from the course.", voiceStart: "Start call", voiceEnd: "End call", voiceLimit: "One call lasts 10 minutes at most. The exact time is counted after the call.", voiceListening: "Listening…", voiceSpeaking: "Speaking…", voiceMic: "This needs your microphone. Allow it in your browser and try again.",
    voiceCapTitle: "You're out of minutes", voiceCapSub: "You've used all your voice minutes. You'll be able to buy more and pick up where you left off.", voiceBuy: "Buy more minutes (coming soon)", voiceOffTitle: "No voice here", voiceOffSub: "This course doesn't have a voice tutor.", voiceSoonTitle: "Coming soon", voiceSoonSub: "The voice tutor will be here soon. None of your minutes have been used.",
    errvoice_cap: "You're out of voice minutes.", errvoice_off: "This course doesn't have a voice tutor.", errvoice_not_configured: "The voice tutor isn't ready yet.", errvoice_failed: "The call couldn't start. Try again.",
    unit: "Unit", startBubble: "START", todayGoal: "Today's goal", todayItems: "items", daysLeft: "to test", testToday: "Test is today", testPast: "Test has passed",
    pick: "Pick the right answer", tfQ: "True or false?", tfT: "True", tfF: "False", check: "Check", cont: "Continue", correctIs: "Correct answer:", fillQ: "Fill in the missing word", fillPh: "Type your answer", matchQ: "Match the pairs", showAns: "Show answer", cardNew: "new", cardRepeat: "repeat",
    gNo: "Don't know", gNoS: "again", gHard: "Hard", gHardS: "soon", gYes: "Know it", gYesS: "later", gEasy: "Easy", gEasyS: "much later",
    say1: "Correct!", say2: "Exactly!", say3: "Great!", say4: "Well done!", mistakeMatch: "Matched, with a mistake.", source: "Source", srcPage: "p.", srcSlides: "slides", srcLecture: "lecture", srcSection: "section",
    doneTitle: "Lesson complete!", doneMore: "Round complete!", xp: "XP", correct: "Correct", streak: "Streak", read: "Read",
    pracTitle: "Practice", pracDue: "Flashcards due", pracMistakes: "My mistakes", pracMix: "Quick mix", pracNone: "Nothing now", pracItems: "items", pracEmpty: "Finish your first lesson first.",
    progTitle: "Progress", progLearned: "Mastered", progStreak: "Day streak", progDays: "To test", progPlan: "Your plan", progPace: "Pace", progPaceNeed: "To finish everything", settings: "Settings", setLang: "Language", setSound: "Sounds", setOn: "On", setOff: "Off", setLogout: "Log out", setLogoutQ: "You can't get back in without your code. Have you saved it?", setCode: "Code", synced: "In the cloud", syncing: "Saving…", offline: "Offline, will save later", setDate: "Test date", paceDaily: "a day",
    courseFail: "Couldn't load the course.", retry: "Try again", sessionExpired: "Log in again with your code.", noPlan: "No plan set", minPerDay: "min a day", perWeek: "× a week",
  },
};

export const t = k => D[lang()][k] ?? D.cs[k] ?? k;
export const errText = code => D[lang()]["err" + code] || D[lang()].errserver;
