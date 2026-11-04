# Penny — design rules v2 (Duolingo-style)

Researched on duolingo.com (path, lesson, feedback, practice hub). Every screen follows these. Change a rule here first, then the tokens in `app.css`.

## 1. Feel
- **One screen, one obvious next tap.** The thing to press is the biggest, most colourful element. Everything else is white or grey.
- **Show, don't write.** Icons, numbers, rings and the hamster carry meaning. Text is a title plus at most one short line. No paragraphs of instructions.
- **Game loop:** path → lesson → instant feedback → celebration → back to the path.

## 2. Type — Nunito (closest free match to Duolingo's rounded font)
| Role | Size | Weight |
|---|---|---|
| Screen / lesson title | 24 | 800 |
| Card title | 19 | 800 |
| Body | 17 | 600 |
| Small | 15 | 600 |
| Label | 13 | 800, UPPERCASE, +0.06em (labels and buttons only) |

## 3. Colour — white canvas, colour only on things you can tap or on feedback
| Token | Hex | Meaning |
|---|---|---|
| green | #58CC02 | main button, correct, progress |
| blue | #1CB0F6 | secondary action, info, Penny |
| red | #FF4B4B | wrong |
| orange | #FF9600 | days to exam |
| yellow | #FFC800 | readiness, celebration |
| purple | #CE82FF | memory (flashcards, lists) |
| eel / wolf / hare / swan / polar | #4B4B4B / #777 / #AFAFAF / #E5E5E5 / #F7F7F7 | text, muted, disabled, borders, fills |

The dark theme follows the phone setting and uses Duolingo's night palette.

## 4. Shape
- Everything tappable is 3D: a 2 px border plus a 4 px darker "lip" underneath. When pressed it sinks.
- Radius is 16 for buttons and cards, 12 for chips, and circles for path nodes.
- Cards are white with a 2 px #E5E5E5 border and no shadows. They never nest.

## 5. Navigation
- Bottom bar with 4 icons, no labels: Cesta · Procvičovat · Penny · Pokrok.
- The active tab gets a blue outlined box.
- The top bar holds stats only: days to exam, flashcards due, readiness. Each one is tappable.
- Lessons, flashcards, quizzes and the Penny chat have no menu. They show **X / Zpět** with a progress bar instead.

## 6. Lesson flow
Read → **POKRAČOVAT**, then pick an answer → **KONTROLA**. A green or red sheet slides up with a short verdict and the explanation → **POKRAČOVAT**. At the end Penny jumps, confetti falls and 3 stat boxes count up → **POKRAČOVAT**.

## 7. Motion
- Buttons sink on press.
- The current path node bobs with a START bubble.
- Correct answers chime and incorrect ones shake.
- The finish screen has confetti and count-ups.
- Reduced-motion settings are respected.
