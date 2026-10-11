# A device to house IQRA — mini project charter

**Status:** feasibility only. Nothing is committed, nothing is built.
**Date:** 2026-09-21
**Question asked:** when the content is done, can IQRA live on a cheap
touchscreen-and-speaker device a parent buys for their child at **$25**? Not
for profit — so that a family that cannot buy an iPad can still have the
lessons in the house.

---

## 0. The short answer

**$25 is reachable as a bill of materials at volume. It is not reachable as a
price to a parent.** The honest delivered figures, with zero margin:

| Route | What it is | Delivered to a parent |
|---|---|---|
| **A** Cheap Android tablet | The PWA runs unchanged in kiosk mode | **$40–50** at 1,000 units |
| **B** Fixed-function appliance | MCU + LCD + speaker, firmware port | **$35–52** at 5,000 units, after $10–20k fixed costs and a 3–6 month port |
| **C** Bring your own screen | Kids Mode lock + offline download + a printed card | **$0–6** — and it ships in weeks |
| **D** Audio-only, card-driven | Yoto shape: NFC cards, no screen | **$28–34** — but it deletes the letter highlighting, which is the whole point |

The gap between a $25 BOM and a $40 doorstep is not waste. It is freight, a
2026 tariff of 12.5–37.5% on Chinese electronics, certification amortised over
a small run, yield loss, spares, and postage. Every one of those is real and
none of them is negotiable by being clever.

**So the real question is not "can it be built for $25". It is "who pays the
other $15".** For a non-profit purpose that answer exists and is ordinary: a
waqf or sadaqah fund, a sponsor, or the Masjid buying a class set. Reframed
that way the project becomes fundable rather than impossible. Reframed the
wrong way — a $25 retail price the author eats the difference on — it becomes
a slow personal loss with an RMA queue attached.

**Recommendation: do Route C now, and nothing else yet.** It is the demand
test, it costs weeks instead of years, it carries no compliance exposure, and
it works for all three tracks today. Then a class set for the Maktab (Route A,
~30 units, the Masjid paying) before any thought of a manufactured product.

---

## 1. Two precedents to read before anything else

Both were exactly this idea, with governments behind them.

- **OLPC** promised a $100 laptop for children and shipped one at ~$200 after
  six years of spec churn. Its own post-mortem is the sentence that should
  govern this charter: **hardware is 5–15% of the cost of an ICT-in-education
  intervention.** Support and training are recurrent and together exceed it.
- **Aakash** promised India a $35 student tablet. The premier hardware
  integrator won the tender and then *walked away* on realising the price was
  not makeable. What was eventually shown cost ~$60, was less capable than the
  prototype, and never delivered at rate.

And the live market comparable: **Yoto and Toniebox** — funded companies, real
scale, a children's audio appliance with *no screen at all* — retail at
**$99.99**. That is what delivered cost plus support plus margin looks like
when professionals do it.

None of this says don't. It says the hardware price was never the hard part,
and a charter that only costs the BOM is a charter that has not started.

---

## 2. Scope

### In scope for a v1 device, if one is ever built

- **IQRA Kids, lessons 20–32.** The author's own priority, and the only track
  whose interaction model fits a cheap appliance: a picture, a letter, four
  sound cards, tap, hear, watch the letter light up.
- Fully offline. A device that needs Wi-Fi to teach the alphabet has failed at
  the one thing it was for.
- One child, one device. No accounts.

### Phase 2, technically portable by the same route

- **Tajweed, lessons 1–7.** Same shape as kids: a word, a per-letter
  highlight, a coloured target letter, badges. The pre-render route in §4
  carries it unchanged.

### Out of scope, and one of them permanently

- **The Grammar track.** Twenty-nine sessions of parsing, growing sentences
  and i'rab: text-heavy, interactive, laid out at runtime. It needs a real
  layout engine and a real browser. **Do not attempt it on an MCU.** If
  grammar must be on the device, that decides Route A for you, and the
  decision is made.
- Notes (the endless canvas, stylus, typing) — needs a browser and a stylus.
- Accounts, classes, join codes, Firestore sync, roster.
- Tap-to-calibrate admin, the laser pointer, class recordings.

A device is a **frozen snapshot of one track**, not the app.

---

## 3. The four routes, costed

### Route A — the PWA runs unchanged, on a junk-tier Android tablet

7" Android kids tablets quote **$17–28 wholesale**, with one supplier at
**$20–25 at MOQ 1,000**. Amazon's own Fire 7 is ~$50 new and ~$60 refurbished
— and Amazon sells near cost, which is a useful sanity check on the tier.

| | |
|---|---|
| Hardware FOB | $20–25 |
| Ocean freight | $1.50–3 |
| Duty (2026, Chinese electronics) | $2.50–9 |
| Packaging, content load, QA labour | $1.50–3 |
| Spares / RMA reserve (5–8%) | $1.50–2.50 |
| Fulfilment to a US doorstep | $6–9 |
| **Delivered, zero margin** | **$33–51** |

**Software cost: near zero.** A kiosk launcher and the existing PWA. All three
tracks work. This is the only route where the content work does not stop.

Risks specific to it: 1–2 GB RAM, 1024×600, an old WebView — the PWA leans on
service workers, blob audio URLs and the Range API, all of which must be
*tested* on the actual SKU, never assumed. **Counterfeit and borrowed FCC IDs
are common in this tier**, and an importer inherits that problem. Battery
quality is the ODM's; the liability is yours.

### Route B — a fixed-function appliance

BOM at 5,000 units, each line researched rather than guessed:

| Part | Cost |
|---|---|
| ESP32-S3-WROOM-1-N16R8 (distributor tier ~$2.85 at 500+) | $2.50–3.00 |
| 3.5–5" IPS + capacitive touch + FPC (bare 5" 800×480 reaches ~$4 at 1k) | $6.00–9.00 |
| Audio codec / I²S DAC + class-D amp + speaker | $1.50–2.50 |
| microSD socket + 8 GB card | $1.50–2.50 |
| Li-ion cell + PMIC/charger + USB-C | $3.50–5.00 |
| PCB + SMT assembly + functional test | $2.50–4.00 |
| Enclosure (2-part mould), buttons | $2.00–3.50 |
| Packaging, printed guide | $0.80–1.50 |
| **BOM** | **$20.30–31.00** |

So the **$25 BOM target is real** — mid-range, at 5,000 units. Then:

| Added per unit at 5,000 | Cost |
|---|---|
| Tooling amortised (mould $3–7k) | $0.60–1.40 |
| Certification amortised ($10–20k, see §5) | $2.00–4.00 |
| Freight + duty | $4.00–9.00 |
| Yield loss, RMA, spares | $1.50–2.50 |
| Fulfilment | $5.00–8.00 |
| **Delivered, zero margin** | **$33–56** |

And **NRE is excluded from that entirely**: industrial design, DFM, samples,
and a 3–6 month firmware port. Bought, that is $40–120k. Done by the author, it
is a year of evenings during which no lesson is written.

At **1,000 units** rather than 5,000 the fixed costs amortise five times worse
and the delivered figure passes $50 — worse than buying a whole Android tablet
that needs no port at all. **Route B only makes sense above ~5,000 units, which
means it only makes sense with an institution behind it.**

### Route C — bring your own screen *(recommended first)*

The PWA is already free and already installable. Most households that cannot
buy an iPad still have a phone in a drawer. What is missing is not silicon:

1. **Kids Mode lock** — a child cannot navigate out. The `#/kids` route and
   the `data-mode="kids"` skin already exist; this is a lock on top of them.
2. **Per-lesson offline download.** Audio is deliberately runtime-cached and
   not precached, and that decision is correct and must stand — so this is a
   "download lesson 20" button that warms the audio cache for one lesson, plus
   a plain indicator of what the device is holding.
3. **A printed card** — QR code, the three-line mark, how to add to the home
   screen, what to do when the phone says it is out of space.
4. Optional **$3–6 accessory**: a stand, or a small USB-C speaker for a room
   with children in it.

Cost to the family **$0–6**. Cost to the project **weeks**. Compliance
exposure **nil**. Works for kids, tajweed and grammar **today**.

It is also the only route that produces the number every other route needs:
**do families actually use this at home?** Nobody knows that yet. Cutting a
mould before knowing it is how OLPC happened.

### Route D — audio-only, card-driven

Drop the screen; print the cards. The 32 letter pictures already exist, the
Word tables already exist, NFC tags are ~$0.06. BOM lands around **$18–20**,
delivered **$28–34** — genuinely the $25-class device.

But IQRA's teaching act is *watching each letter light up exactly as it is
pronounced*. Removing the screen removes the one thing that distinguishes this
from every Quran audio player already on Amazon at $13–50. It would be a good
**revision** device and a poor **teaching** one.

Worth keeping in the drawer as a cheap companion, not as the device.

---

## 4. The engineering finding that makes Route B possible at all

The obvious blocker: an MCU has no Arabic shaper. LVGL — the standard embedded
UI library — carries documented, open, unresolved failures on Arabic cursive
joining; letters render disconnected. A mushaf that does not join is not a
mushaf. That alone looked fatal.

**It is not, because IQRA never asks for a shaper.** The app's own rule is that
a word is *never* split into per-letter spans — it renders the full string and
stacks **clipped copies of the same string**, measured with the Range API
(`ArabicWord.tsx`). That rule exists to protect cursive joining in a browser,
and it happens to be exactly the rule that lets a device do no text layout
whatsoever.

The generator can, at build time:

1. Render each word with the real KFGQPC font in **headless Chrome** — which
   this repo already does, in `Brand/build.mjs`, with the font embedded
   byte-identically — at the device's exact pixel size.
2. Emit one bitmap per word, plus the greyed and dimmed variants, and the
   **per-letter clip offsets in pixels**, taken from the same Range-API
   measurement `ArabicWord` already performs.
3. Ship bitmaps + offsets + the existing per-letter timings + the existing WAVs.

Device firmware then: blit a bitmap; blit a coloured strip over columns x₀..x₁
at time *t*; play a WAV. A few hundred lines of C, not a rendering engine. The
ghunna's violet phase is the same trick with a second colour.

Two consequences worth having in writing:

- **The mushaf is pixel-identical to the web app**, which no MCU font pipeline
  could promise. The font licence forbids modification; pre-rendering never
  touches the font, whereas converting it into an embedded bitmap font arguably
  does.
- **Storage is free.** Eleven lessons of audio are already 85 MB on disk (389
  clips). Word bitmaps at ~40 KB × ~700 words × 3 states ≈ 84 MB. An 8 GB
  microSD is $1.50 and holds all of it twice over, uncompressed, with the WAVs
  byte-identical to what the generators cut — so the timing engine needs no
  re-validation and calibrations stay meaningful.

This is the one genuinely unknown piece of engineering in the whole charter,
and it can be proved for the price of a **$26 Waveshare ESP32-S3-Touch-LCD-3.5**
board — buyable today, two weekends of work. See §7 Phase 2.

---

## 5. Compliance — the real gate, and it is not code

A powered, lithium-battery, screen-bearing product **marketed to children**, in
the US and UK:

| Requirement | Cost | Note |
|---|---|---|
| **CPSIA** third-party testing at a CPSC-accepted lab + self-issued CPC | $500–1,200+ | Mandatory for a children's product. The CPC itself is free; the test report is not. |
| **ASTM F963 / 16 CFR 1250** toy safety | folded into the above | Applies if it reads as a toy for ≤12. Small parts; a battery compartment must need a tool for ≤3. |
| **FCC** — unintentional radiator only, *if* a pre-certified radio module is used | $3,000–8,000 | Without one, Wi-Fi certification is $6,500–12,000. This is the argument for an ESP32 *module* over a bare chip. |
| **UN38.3** + MSDS, per battery model | $300–930 | Required to ship the battery at all, by air or sea. |
| **CE / UKCA** (RED, EMC, LVD, RoHS, EN 71, EN 62115) | $2,000–5,000 | Only if selling into the UK/EU. |
| **WEEE + battery registration** | recurring | Same. |
| **Product liability insurance** | recurring, and the real one | A lithium cell in a child's hands. |

**Fixed compliance: $10–20k before one unit ships.** At 1,000 units that is
$10–20 per device on its own — most of the $25 target, spent before a single
part is bought.

This table is the strongest argument for Route C, and the second strongest for
never being the importer of record yourself: an ODM or distributor who already
holds these certifications for a platform product carries them at a fraction of
the marginal cost.

---

## 6. Risks

Ordered by likelihood × damage, not by size.

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| 1 | **The firmware port consumes the content work.** The author is the single author of every lesson, every recording, every sheet. Content is the moat; a plastic box is not. | High | Severe | Route C. If a device is ever built, buy the firmware or do not build it. Never let the device block a lesson. |
| 2 | **$25 retail is unreachable**, and the difference is absorbed personally. | Certain | High | Reframe now: $25 *to a family* via sponsor / waqf / class set; ~$40 is the honest cost. Never state $25 publicly before a real quote exists. |
| 3 | **Compliance and liability** (children + lithium). | High | Severe | §5. Buy a certified platform; do not be importer of record; insurance before the first unit leaves. |
| 4 | **Support burden lands on one person.** 500 devices is a permanent queue of won't-charge, dropped-it, how-do-I-update. | High | High | Route C has none. A class set has a teacher in the room. A retail run has neither. |
| 5 | **Content drift.** The device is frozen; the PWA updates. Two copies of one curriculum diverge, and the frozen one teaches the older tajweed. | High | Medium | The single source of truth stays the Word sheets and the generators. The device consumes *generated* output only — the same rule the app already lives by. |
| 6 | **Tariffs.** 2026 effective rates on Chinese electronics run 12.5–37.5% depending on classification; de minimis is suspended for all countries; the legal ground moved twice in eighteen months. | High | Medium | Quote landed cost, never FOB. Re-quote at order. Treat any price built on a tariff number as provisional. |
| 7 | **ODM quality and fake FCC IDs** in the sub-$25 tablet tier. | Medium | High | Buy three SKUs retail and test before any MOQ. Verify FCC IDs in the FCC database against the actual board. |
| 8 | **Obsolescence and e-waste.** A locked single-purpose device against a child's rate of growth. | Medium | Medium | Design so the lesson set is replaceable — SD card, or Wi-Fi update. A device that cannot receive lesson 8 is landfill the day lesson 8 ships. |
| 9 | Screen-time objection: some parents want *less* glowing rectangle, not one more. | Medium | Low | Route D exists for exactly that family. Worth asking the committee before assuming a screen is wanted. |

---

## 7. A staged decision, cheapest first

Each phase buys the information the next one needs. No phase commits the one
after it.

**Phase 0 — now, 2–4 weeks, $0.** Kids Mode kiosk lock; per-lesson offline
download; the printed "use the phone in your drawer" card. Give it to the
Maktab families. *Measure: how many install it, how many open it twice.*
**Gate: if families will not use a free app, they will not use a $40 box.**

**Phase 1 — ~$100, one weekend.** Buy three candidate sub-$30 tablets retail.
Load the PWA. Run one real Maktab session on them. *Answers: does the cheap
Android tier actually run this — service worker, blob audio, Range API, touch
latency, a speaker loud enough for a child in a room of children?*

**Phase 2 — ~$30 and two weekends, only if a device is still wanted.** The
pre-render spike on a Waveshare ESP32-S3-Touch-LCD-3.5: one word, one bitmap,
one WAV, one moving highlight. *Answers the only unknown engineering question
in this charter (§4), before anyone spends real money.*

**Phase 3 — a class set. ~30 units, Route A, the Masjid paying.** This is the
author's actual context: they sit on the education committee, the teacher is in
the room, it is an institutional purchase rather than a consumer sale, and 30
is not 5,000. This is the natural first hardware — and it may be the last
hardware needed.

**Phase 4 — a manufactured product.** Only with an institution, a waqf or a
committee owning fulfilment, compliance and support. If nobody but the author
will own those three, the answer to Phase 4 is no — and that is a fine answer:
Phase 0 already put the lessons in the house.

---

## 8. What would change the answer

- A **masjid, waqf or foundation** willing to own compliance, fulfilment and
  support, and to fund the $10–20k of fixed cost. This is the decisive one.
- An **existing certified Islamic-education tablet ODM** willing to
  white-label. That ecosystem is real and quotes $7–11/unit at MOQ 50 for
  toy-tier Quran tablets. Those are fixed-firmware toys today, but an ODM that
  already holds CE/RoHS on a platform and will flash a payload changes Route
  B's arithmetic completely. **Worth one email before anything else here.**
- **5,000+ units** of committed demand. Below that, Route B is arithmetic
  working against you.
- The grammar track becoming a requirement → Route A, decided, no port.
- A decision that **audio-only is enough** → Route D at $28–34, today's
  technology, no new engineering.

---

## 9. Sources

- OLPC's own cost lesson and Aakash's collapse — [ICTworks on OLPC](https://www.ictworks.org/olpc-predictable-failure/), [Fast Company on Aakash](https://www.fastcompany.com/1839297/how-failed-aakash-tablet-object-lesson-indias-long-road-ahead-to-tech-innovation), [Forbes India](https://www.forbesindia.com/article/real-issue/what-went-wrong-with-the-aakash-tablet/33218/1), [World Bank blog](https://blogs.worldbank.org/en/education/aakash)
- Cheap tablet tier — [Alibaba 7" kids tablets](https://electronics.alibaba.com/product/low-price-tablet-7-kids), [Fire 7 refurbished](https://amazon.com/Certified-Refurbished-Amazon-portable-entertainment/dp/B099HGQ575)
- MCU and display — [Waveshare ESP32-S3-Touch-LCD-3.5](https://www.waveshare.com/esp32-s3-touch-lcd-3.5.htm), [ESP32-S3-WROOM-1 volume tiers](https://www.accio.com/plp/esp32-s3-wroom-1-module-price), [5" panel volume pricing](https://www.displaymodule.com/blogs/knowledge/lcd-display-module-price-retail-wholesale-guide)
- Arabic shaping on embedded — [LVGL issue 9404](https://github.com/lvgl/lvgl/issues/9404), [LVGL issue 1433](https://github.com/lvgl/lvgl/issues/1433), [LVGL v7.8 Arabic support](https://lvgl.io/blog/release-v7-8)
- Compliance — [CPSIA CPC guide](https://www.compliancegate.com/cpsia-childrens-product-certificate-cpc/), [CPSC third-party testing](https://www.cpsc.gov/Business--Manufacturing/Testing-Certification/Third-Party-Testing), [FCC cost 2026](https://markready.io/learn/fcc-certification-cost), [pre-certified module path](https://hubble.com/community/guides/how-using-a-pre-certified-wireless-module-simplifies-your-fcc-path/), [UN38.3 cost](https://www.jjrlab.com/news/what-is-a-un383-test-report-how-much-does-it-cost.html)
- Tariffs 2026 — [electronics from China](https://www.tariffstool.com/guides/tariff-on-electronics-from-china-2026), [de minimis status](https://nstarfinance.com/resources/ecommerce-tariff-guide-2026)
- Market comparables — [Yoto vs Toniebox pricing](https://www.bedtime-stories.fun/blog/is-toniebox-worth-it), [Quran pen readers $13–50](https://www.amazon.com/Upgraded-Digital-Translation-Reciters-Multilingual/dp/B0CN3BD5KX), [Islamic kids tablet ODMs](https://www.alibaba.com/supplier/islamic-educational-tablets-kids.html)
- Tooling — [injection mould cost](https://boyanmfg.com/injection-mold-cost-in-china/)

Figures are September 2026 and provisional. Every BOM line needs a real quote
before it is used in a decision; the tariff lines need re-quoting at order.
