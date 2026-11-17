// Each tutor talks in their own voice (Marek, 2026-11-15: "každý z tutorů by měl mít vlastní personality").
// Czech and English only: jokes don't survive machine translation, so the other languages keep the neutral lines in i18n.js.
// Rules for new lines:
// - Oskar plays it cool, but the joke is on him or the subject, never on the student (a stressed student the night before the exam).
// - Czech never puts the student in the past tense (zvládl/zvládla): we don't know who is reading. The tutor's own gender is fine.
// - Short: a cheer is on screen for 1.6 s, a bubble is the step's headline on a phone.
// Keys: tag (under the name in the tutor picker), cheer (3, 5, 10… right in a row, {n}), miss (after two misses, once a round),
// src (the "where did you hear about us" step, {brand}), notify (the reminders step).
import { lang } from "./i18n.js";

const V = {
  cs: {
    penny: {
      tag: "Vlídná, krok za krokem",
      cheer: ["Krok za krokem. {n} v řadě!", "{n} v řadě. Tak se to dělá.", "{n} správně za sebou, jde ti to!", "{n} v řadě. Jsem na tebe pyšná!"],
      miss: "Nevadí. Tohle si teď zapamatuješ.",
      src: "Odkud o {brand} víš?",
      notify: "Budu ti připomínat, ať ti učení nevypadne!",
    },
    bear: {
      tag: "Přísná, ale férová",
      cheer: ["{n} v řadě. Tak to má vypadat.", "{n} správně. Pokračujeme.", "{n} za sebou. Výborně, za jedna.", "{n} v řadě. U zkoušky to oceníš."],
      miss: "Chyba. Přečti si proč a jedeme dál.",
      src: "Tak. Odkud o {brand} víš?",
      notify: "Každý den ti připomenu učení. Bez výmluv.",
    },
    fox: {
      tag: "Nadšený šprt, miluje fakta",
      cheer: ["{n} správně! Mozek se ti zahřívá.", "{n} v řadě! Neurony jedou naplno.", "Fascinující! {n} za sebou.", "{n} v řadě! Tohle je skoro věda."],
      miss: "Aha, záludná! Ale teď už víš proč.",
      src: "Sbírám data! Odkud o {brand} víš?",
      notify: "Připomenu se ti. Mozek se líp učí po kouskách.",
    },
    cat: {
      tag: "V pohodě, tajně ti fandí",
      cheer: ["Hm. {n} v řadě. Skoro jsem zvedl obočí.", "{n} za sebou. Nejsem dojatý. Možná trochu.", "{n} v řadě. Dobře, tohle bylo cool.", "{n} správně. Kvůli tomu si kravatu nepovolím. Skoro."],
      miss: "To se stává i nejlepším. Mně ne, ale jinak jo.",
      src: "Jen ze zvědavosti… odkud o {brand} víš?",
      notify: "Připomenu se ti. Nenápadně, jako kočka.",
    },
    pig: {
      tag: "Tvoje největší fanynka",
      cheer: ["JOOO! {n} v řadě, ty jsi hvězda!", "{n} za sebou! Tleskám jako o život!", "WOW, {n} v řadě! Nezastavuj!", "{n} správně! Tohle se slaví!"],
      miss: "Chybička! Hlavu vzhůru, jedeme dál!",
      src: "Jsem tak ráda, že jsi tu! Odkud o {brand} víš?",
      notify: "Každý den ti pošlu povzbuzení, ať jedeš dál!",
    },
    frog: {
      tag: "Pohodář, nestresuje se",
      cheer: ["{n} v řadě, v klidu si to dáváš.", "{n} za sebou. Kvák, pěkný.", "{n} v řadě. Tohle je pohodička.", "{n} správně. Skáču radostí. Doslova."],
      miss: "Žbluňk. Nic se neděje, další.",
      src: "Hele, odkud o {brand} víš?",
      notify: "Občas na tebe kvaknu, ať na učení nezapomeneš.",
    },
    panda: {
      tag: "Klidná, hlídá stres před zkouškou",
      cheer: ["{n} v řadě. Dýchej, jde ti to.", "{n} za sebou. Klidně a jistě.", "{n} v řadě. Pomalu, ale jistě.", "{n} správně. Krásně klidné tempo."],
      miss: "Klid. Chyba je jen informace.",
      src: "V klidu, jen jedna otázka: odkud o {brand} víš?",
      notify: "Jemně ti připomenu učení. Před zkouškou žádná panika.",
    },
  },
  en: {
    penny: {
      tag: "Kind, one step at a time",
      cheer: ["Step by step. {n} in a row!", "{n} in a row. That's how it's done.", "{n} right in a row, you've got this!", "{n} in a row. I'm proud of you!"],
      miss: "No worries. Now this one will stick.",
      src: "How did you hear about {brand}?",
      notify: "I'll remind you, so studying doesn't slip!",
    },
    bear: {
      tag: "Strict but fair",
      cheer: ["{n} in a row. That's how it should look.", "{n} right. Moving on.", "{n} in a row. Excellent, top marks.", "{n} in a row. You'll be glad at the exam."],
      miss: "A mistake. Read why, then we move on.",
      src: "Right. How did you hear about {brand}?",
      notify: "I'll remind you to study every day. No excuses.",
    },
    fox: {
      tag: "Happy nerd who loves facts",
      cheer: ["{n} right! Your brain is warming up.", "{n} in a row! Neurons firing on all cylinders.", "Fascinating! {n} in a row.", "{n} in a row! This is practically science."],
      miss: "Ooh, a tricky one! Now you know why.",
      src: "Collecting data! How did you hear about {brand}?",
      notify: "I'll remind you. Brains learn best in small daily bits.",
    },
    cat: {
      tag: "Too cool, secretly rooting for you",
      cheer: ["Hm. {n} in a row. I almost raised an eyebrow.", "{n} in a row. I'm not moved. Maybe a little.", "{n} in a row. Fine, that was cool.", "{n} right. Not loosening my tie for this. Almost."],
      miss: "Happens to the best of us. Not me, but everyone else.",
      src: "Just curious… how did you hear about {brand}?",
      notify: "I'll remind you. Quietly, like a cat.",
    },
    pig: {
      tag: "Your biggest fan",
      cheer: ["YESSS! {n} in a row, you're a star!", "{n} in a row! I'm clapping like crazy!", "WOW, {n} in a row! Don't stop!", "{n} right! This calls for a party!"],
      miss: "Oopsie! Chin up, let's go!",
      src: "So happy you're here! How did you hear about {brand}?",
      notify: "I'll cheer you on every day, so you keep going!",
    },
    frog: {
      tag: "Laid-back, never stressed",
      cheer: ["{n} in a row, cool as you like.", "{n} in a row. Ribbit, nice.", "{n} in a row. Easy-peasy.", "{n} right. Jumping for joy. Literally."],
      miss: "Splash. No big deal, next one.",
      src: "So, how'd you hear about {brand}?",
      notify: "I'll croak at you now and then, so you don't forget to study.",
    },
    panda: {
      tag: "Calm, keeps exam stress down",
      cheer: ["{n} in a row. Breathe, you're doing great.", "{n} in a row. Calm and steady.", "{n} in a row. Slowly but surely.", "{n} right. Lovely calm pace."],
      miss: "It's okay. A mistake is just information.",
      src: "No rush, just one question: how did you hear about {brand}?",
      notify: "I'll gently remind you. No panic before the exam.",
    },
  },
};

// The tutor's own line in the student's language, or null (another language, or no such line): the caller then uses its neutral t() string.
export function persona(id, key, vars = {}) {
  const l = V[lang()]?.[id]?.[key];
  if (l == null) return null;
  const s = Array.isArray(l) ? l[Math.floor(Math.random() * l.length)] : l;
  return s.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}
// For the test: every line of one tutor, so it can check a cheer came from the right tutor.
export const personaLines = (l, id) => V[l]?.[id];
