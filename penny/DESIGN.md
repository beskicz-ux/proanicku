# Penny — design rules

Every screen follows these. If a rule needs to change, change it here first, then in the `:root` tokens in `app.css`. No one-off colours, sizes or radii in the code.

Sources: five mobile-UX videos Marek picked (mobile UI basics, bottom navigation, bad vs great UX, peak–end rule, research-first design), plus Apple HIG.

## 1. Structure
- **One screen = one job.** Only "Dnes" (home) may combine things. Everything else gets its own screen or a bottom sheet.
- **Context stays.** Help and explanations open as a **bottom sheet** on phone and a side panel on iPad. They never jump to another page.
- **Focus mode.** While Anna practises (reading, cards, quiz, exam, essay), the menu disappears. The one primary action sits in the thumb dock at the bottom.
- **One direction per section.** On phone, lists stack vertically.

## 2. Type (2 families + Penny's hand)
| Role | Token | Font | Size |
|---|---|---|---|
| Result number | `--t-hero` | Gloock | 48 |
| Screen title (h1) | `--t-display` | Gloock | 32 |
| Section title, question (h2, h3) | `--t-title` | Gloock | 24 |
| Card headline | `--t-head` | Karla 700 | 18 |
| Body | `--t-body` | Karla | 17 |
| Secondary (`.small`) | `--t-sec` | Karla | 15 |
| Caption / label (`.cap`) | `--t-cap` | Karla 600 | 13 |
| Penny speaking (`.hand`) | `--t-penny` | Caveat 700 | 22 |

- **Caveat is used only when Penny speaks** (speech bubble, her notes in the reading, end-screen line). It is never used for labels or headings.
- Labels are sentence case, never ALL CAPS.
- Body text is never smaller than 15.

## 3. Hierarchy
- Every card has **one** primary line. Everything else steps back: secondary size and muted colour.
- Numbers that matter use Gloock.

## 4. Shape language (one family)
| Token | Size | Used for |
|---|---|---|
| `--r-ctl` | 14 | buttons, inputs, answer options |
| `--r-card` | 20 | cards, paper sheets, flashcards, tiles |
| `--r-sheet` | 28 | bottom sheets (feedback, Penny panel) |
| `--r-pill` | 999 | tabs, chips, tags, nav indicator |

- Circles are only for Penny, rings and progress discs.
- **Never put a card inside a card.** Inside a card, group with spacing and 1 px hairlines (`--line`).

## 5. Spacing
- 4-pt grid: `--s1…s7` = 4 · 8 · 12 · 16 · 24 · 32 · 48.
- Gutter: 16 on phone, 24 on tablet, 32 on desktop.
- Gap between cards: 12. Gap before a new section: 32.

## 6. Colour (60 · 30 · 10)
- **60 % neutral plum surfaces:** `--wine` base, `--wine-2` card, `--wine-3` control, `--wine-4` track.
- **30 % content:** ink text, and cream paper for reading.
- **10 % accent, always with a meaning, never decoration:**

| Colour | Meaning |
|---|---|
| **Gold** | The one main action on a screen (max **one** gold button per view), plus the readiness pill and the active tab. |
| **Teal** | Reading / new material: read bars, learn icons. |
| **Violet** | Memory: flashcards, lists, memory bars. |
| **Sky** | Testing yourself: quiz, mock exam, essay. |
| **Emerald** | Correct / done. |
| **Coral** | Wrong / needs work. |

- Readiness rings are coloured by level: coral < 40 · gold < 65 · teal < 85 · emerald.
- Secondary buttons are ghost (plum). The selected tab is ink, not gold.

## 7. Navigation
- 5 tabs, labelled 12 px, neutral grey.
- The active tab changes in three ways at once: gold colour, a filled pill indicator behind the icon, and a bold label.
- A 1 px hairline separates the nav from content. It respects the safe area.
- On iPad landscape the nav becomes a side rail with the same rules.

## 8. Icons
- One outline set: 24 px, 2.1 px stroke, round caps.
- Only the active tab gets a fill.

## 9. Tap targets & feedback
- Minimum target is 44 × 44. Primary buttons are 56 tall.
- Every tap gets a visible response:
  - raised buttons sink 3 px;
  - tiles and rows scale to 0.98–0.99.
- A screen change is one 180 ms fade-up. Sheets slide in.
- Reduced motion is respected.

## 10. Say what will happen
Buttons name the action and its size. Examples:
- "Začít 1A · 14 částí"
- "Zopakovat 20 kartiček"
- "Odevzdat esej · 312 slov"
- "Ukázat krok 2 z 6"

## 11. Peak and end (what she'll remember)
- **The peak.** Finishing a lecture is the one celebration: confetti, "1A máš přečtenou!", and the readiness jump ("+6 %"). Confetti also fires when readiness reaches a new level, or after an exam of 70 %+. It never fires anywhere else.
- **The end of every session** (cards, quiz, lists, exam) shows a summary card:
  - what she did;
  - readiness before → after;
  - **the next step** as the one gold button.
- **The end of the day.** When everything is done, "Dnešek je hotový ♡" plus tomorrow's plan.
- **Negative moments** (a wrong answer, a drop in readiness, an empty screen) always get kind words plus what to do next.

## 12. Empty states
- Penny + what's going on + one action.
- Never a blank screen.
