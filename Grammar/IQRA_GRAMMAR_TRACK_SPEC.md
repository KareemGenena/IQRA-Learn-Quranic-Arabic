# IQRA Grammar Track: Curriculum and Build Spec

Version 0.1 (draft for build) · 2026-09-19 · Owner: Kareem

This file is the pedagogical and technical spec for a new grammar track inside the IQRA app. It was agreed in a design conversation and is meant to be handed to Claude Code as the single source of truth for this track.

Tags used throughout:

- **[VERIFY]** = written from recall; must be checked against corpus data or a qualified reviewer before it ships.
- **[DECIDE]** = needs Kareem's decision; a default is given so work is never blocked.

**Contents.** §0 how to use · §1 learner and scope · §2 principles · §3 teaching model · §4 roadmap (29 sessions, Level 2 outline, seeds ledger) · §5 concept registry · §6 data model · §7 unlock logic · §8 exercises · §9 review · §10 corpus pipeline · §11 Session 1 fully worked · §12 milestones M0 to M6 · §13 decisions and checks · §14 evidence · §15 sources and licenses · Appendix A authoring cautions

> **Quranic text warning.** All Arabic in this file is typed in standard spelling with full vowels, for readability. It is NOT a source of Quranic text. The app must always pull ayah text by reference from its verified source and must machine-check every fragment in this file against that source (see §10, task T2).

---

## 0. How to use this file (Claude Code: read this first)

1. Read the existing IQRA repo before writing anything. Report how lessons, content, progress and Quran text are currently modelled.
2. Map the schemas in §6 onto what already exists. Do not create parallel structures. Where this spec conflicts with the repo's code conventions, the repo wins on code and this spec wins on pedagogy.
3. Follow the build order in §12. Milestone M0 is recon only.
4. The design principles in §2 are hard constraints, not suggestions. If a feature idea violates one, raise it instead of building it.
5. Never invent Quranic references or grammar analyses. If something is missing, add a [VERIFY] item and ask.

Suggested first instruction: "Read IQRA_GRAMMAR_TRACK_SPEC.md. Do milestone M0 only and report back."

---

## 1. Learner, goal, scope

**Learner.** Adults. Non-native speakers of Arabic. They know the alphabet and the rules of tajweed and can read the mushaf fluently. Most have memorised salah text, adhkar and some short surahs without understanding the words.

**What "adults" changes.** Explicit explanation and Arabic terminology are appropriate and wanted. Time is short and use is likely self-paced, so every unit must pay off on real text inside the same sitting. The tone is direct and adult. If the app already has child-oriented rewards or mascots, keep them out of this track unless Kareem says otherwise; the reward here is text the learner can now parse (§7). Learners with some prior grammar should be able to test out of early sessions ([DECIDE] 13). This method lives on the vowel marks, and many adults read small vowel marks with difficulty, so Arabic must render large, with generous line height and an adjustable size (§12, M3 checklist).

**Goal.** Receptive only: understand the structure and meaning of Quranic verses. Not speaking, not writing, not modern standard Arabic.

**Success looks like.** Given a fragment the app says is unlocked, the learner can say for each word: what kind of word it is, what its shape tells them (root, tense, who), what its ending tells them (its job), and therefore who did what to whom. Unknown vocabulary may be glossed.

**Out of scope for Level 1.** Full conjugation tables, production drills, the six verb-vowel classes (abwab), noun sub-types such as ممدود / مقصور / منقوص, dual and feminine-plural production, rhetoric.

---

## 2. Design principles (hard constraints)

| # | Principle | What it means in the product |
|---|-----------|------------------------------|
| P1 | **Yield first** | A concept enters only when it unlocks real text soon. Taxonomy waits. |
| P2 | **One move at a time** | Each ladder line changes exactly one thing relative to a line the learner already owns. Maximum 4 new concepts per session. |
| P3 | **See it, then name it** | The pattern is shown and noticed before the Arabic term appears. Arabic terms are kept (they are the keys to every i'rab and tafsir resource) and paired with a plain handle: فَاعِل = "doer". |
| P4 | **Land on real text** | Constructed sentences are scaffolds only. Every session ends on real Quranic or liturgical text. |
| P5 | **Recognition, not production** | Every exercise is recognition or parsing. No "conjugate this verb". No Arabic typing. |
| P6 | **Frequency decides order** | Order of verbs, persons, particles and verb forms is computed from corpus counts, not guessed (§10). |
| P7 | **Two verb tracks** | Sound three-letter verbs teach the system. The most frequent irregular verbs are taught early as whole sight words and analysed later. |
| P8 | **Read with wasl** | Parsing mode always displays and reads full final vowels. Waqf hides the grammar. |
| P9 | **Cumulative, interleaved, spaced** | Practice sets always mix old concepts with the new one. Reviews are spaced. Every fourth or fifth session is integration only. |
| P10 | **Seed and harvest** | Known words (مُسْلِم، مُؤْمِن، مَسْجِد، كِتَاب) are used early as plain vocabulary and explained later when their pattern is taught. Seeds are tracked so later lessons can call back to them. |
| P11 | **Respect for the text** | Quranic text is never altered, never used as a wrong-answer option in altered form, and is visually distinct from constructed sentences. Contrast drills that change endings or order use constructed sentences only. No exercise option may state something theologically offensive (for example a role swap that makes Allah the done-to of "created"); role-swap items use human participants. Quranic audio is never synthesised. Fragments must be meaning-safe (Appendix A, item 15) and human-approved before release. |
| P12 | **Use what is already on the tongue** | Phrases the learner already recites are the preferred unlock targets (§4.4). |
| P13 | **Grammar, not tafsir** | Meaning notes stay at what the grammar itself shows: who did what to whom, "a" or "the", past or present. Anything interpretive needs a named source and human review. |

---

## 3. The teaching model: a growing sentence

### 3.1 The frame

```
(glue) + VERB + DOER + DONE-TO + DETAILS
```

Arabic labels, right to left: وَ / فَ ← فِعْل ← فَاعِل ← مَفْعُول بِهِ ← جَارّ وَمَجْرُور …

Classical grammar already treats verb + doer as the core of the sentence and everything else as additions, so this frame re-sequences the tradition by yield; it does not replace it. Al-Zamakhshari's *al-Mufassal* makes رفع the mark of doer-hood and treats the مبتدأ and خبر as extensions of it by analogy, which is the classical warrant for starting from the verbal sentence.

### 3.2 Three moves

Every lesson applies exactly one move to a frame the learner already owns.

| Move | Meaning | Examples |
|------|---------|----------|
| **Add a slot** | A new role and its ending | doer (رفع) → done-to (نصب) → after a حرف جر (جر) |
| **Change the verb** | Same slots, different verb shape | past → present → command; he → they → you → we; negation; passive; later Forms II to X |
| **Expand a filler** | Same slot, richer contents | bare noun → ال → adjective → idafa → pronoun suffix → الَّذِينَ + sentence |

### 3.3 Three tracks inside every session

- **Structure** (nahw): one move.
- **Word shape** (sarf): one item, often only a seed (a root family, a pattern met as vocabulary).
- **Frequency drip**: two or three high-frequency function words or one sight verb.

### 3.4 The session loop

1. **Retrieve.** Up to 10 spaced-review items from earlier sessions.
2. **Ladder.** One new move, shown as minimal pairs. Only the changed segment is highlighted.
3. **Notice.** The learner answers a "what changed?" prompt before any terminology appears.
4. **Name.** The Arabic term and its plain handle are revealed, with a one-sentence rule.
5. **Find it.** The learner spots the new concept in real ayah fragments.
6. **Unlock.** One or more real fragments are parsed in full. Familiar phrases come first.
7. **Exit check.** Five unseen items, interleaved with older concepts.

Integration sessions skip steps 2 to 4 and spend the time on step 6 with a connected text.

### 3.5 The parse routine (what learners carry to every word)

1. What **kind** of word is it? (فِعْل / اِسْم / حَرْف)
2. What does its **shape** say? (root, pattern, tense, who)
3. What does its **ending** say? (its job in this sentence)

Kind is what a word is. Job is what it does in this sentence. Keep these two ideas apart from session 1.

### 3.6 Two levels of knowing a fragment

- **Unlocked**: every visible affix and ending in the fragment can be explained, and every word's job is known. Stems may still be glossed ("taken on trust"), for example a Form IV verb before Phase 7.
- **Mastered**: the stems can be explained too (form, weakness, pattern).

Rule for authors: **endings and affixes must be explainable; stems may be glossed.** A fragment is never shown as unlocked if one of its visible endings would contradict what the learner has been taught so far (for example the kasra on a sound feminine plural object before S16).

---

## 4. Roadmap

The sequence below is provisional (v0.1). Session boundaries, verb choices and the order of persons and particles must be validated by the corpus counts in §10 and by a pilot (§12, M6). Concept IDs refer to the registry in §5.

Every unlock target is listed as Arabic + reference. Word ranges inside an ayah are resolved by the pipeline, never typed by hand. "Glossed" means the stem is taken on trust under the rule in §3.6.

### 4.1 Level 1: parse a simple verse (29 sessions)

#### Phase 1 · Verb + doer

**S1 · The verb is a sentence** (fully worked in §11)
- New: `V.PAST.3MS` `R.FAIL` `D.DEFINITENESS` `H.CONJ` · labels `K.FIL` `K.ISM` `K.HARF`
- Seeds: `Z.ROOT` (families س ج د and ك ت ب) · `Z.PATTERN.MAFUL` (مَكْتُوب met as plain vocabulary)
- Sight verb: جَاءَ
- Unlock: صَدَقَ اللَّهُ (3:95) · فَسَجَدَ الْمَلَائِكَةُ (15:30) · جَاءَ الْحَقُّ وَزَهَقَ الْبَاطِلُ (17:81) · وَجَاءَ رَجُلٌ (28:20)

**S2 · Now and ongoing: the مضارع**
- New: `V.PRES.3MS` `H.NEG.SIMPLE`
- Method: every verb is learned from now on as a pair (سَجَدَ / يَسْجُدُ). The stem vowel is lexical. No abwab. Restate the S1 rule here: damma marks the doer on a naming-word, not on the verb (Appendix A, item 20).
- Sight verb: قَالَ / يَقُولُ · Drip: مَا، لَا، قَدْ
- Unlock: قَالَ اللَّهُ (5:119) · وَيَقُولُ الْكَافِرُ (78:40) · يَنظُرُ الْمَرْءُ (78:40) · وَيَقُولُ الْإِنسَانُ (19:66) · يَصْدُرُ النَّاسُ (99:6) · مَا كَذَبَ الْفُؤَادُ (53:11)

**S3 · She did it**
- New: `V.PAST.3FS` `V.PRES.3FS` `N.GENDER.TA`
- Seed: `Z.PATTERN.FAIL` (وَقَعَ → الْوَاقِعَة ; رَجَفَ → الرَّاجِفَة ; كَفَرَ → الْكَافِر ; سَجَدَ → سَاجِد)
- Drip: إِذَا (with the note that a past form after إِذَا usually points forward: "when X happens"), إِذْ، ثُمَّ
- Unlock: قَالَتْ نَمْلَةٌ (27:18) · وَجَاءَتْ سَيَّارَةٌ (12:19) · أَزِفَتِ الْآزِفَةُ (53:57) · إِذَا وَقَعَتِ الْوَاقِعَةُ (56:1) · تَرْجُفُ الرَّاجِفَةُ (79:6; the opening يَوْمَ joins at S6, when its fatha can be explained)

#### Phase 2 · Done-to and details: all three endings

**S4 · Done to whom? The مفعول به**
- New: `R.MAFUL_BIH` `V.SUBJ.HIDDEN` `P.ENDINGS_NOT_ORDER`
- Ladder (constructed): كَتَبَ → كَتَبَ الرَّجُلُ → كَتَبَ الرَّجُلُ كِتَابًا → كَتَبَ كِتَابًا. Contrast pair, constructed only: نَصَرَ الرَّجُلُ الْمُؤْمِنَ versus نَصَرَ الرَّجُلَ الْمُؤْمِنُ.
- Sight verb: رَأَى / يَرَى
- Unlock: ضَرَبَ اللَّهُ مَثَلًا (16:75) · وَقَتَلَ دَاوُودُ جَالُوتَ (2:251) · وَوَرِثَ سُلَيْمَانُ دَاوُودَ (27:16) · خَلَقَ الْإِنسَانَ (55:3) · عَلَّمَ الْقُرْآنَ (55:2, stem glossed) · وَجَاءَ السَّحَرَةُ فِرْعَوْنَ (7:113)
- Real text for `P.ENDINGS_NOT_ORDER`: حَضَرَ يَعْقُوبَ الْمَوْتُ (2:133). The done-to comes first; only the endings say that death came to Jacob and not the reverse. Role-swap drills still use constructed sentences with human participants only (§8).
- Demo only, not assessed: إِنَّمَا يَخْشَى اللَّهَ مِنْ عِبَادِهِ الْعُلَمَاءُ (35:28). Ask "who fears whom?", then show the two endings.

**S5 · After a حرف: the third ending (I)**
- New: `H.JARR.1` (فِي، مِنْ، إِلَى، عَلَى) `R.MAJRUR`
- Seed: `Z.PATTERN.MAKAN` with the constructed line سَجَدَ الْمُسْلِمُ فِي الْمَسْجِدِ
- Fold into `H.CONJ` review (not a new concept): a noun joined by وَ copies the ending of the noun before it (فِي الْبَرِّ وَالْبَحْرِ).
- Unlock: خَلَقَ الْإِنسَانَ مِنْ عَلَقٍ (96:2) · خَلَقَ الْإِنسَانَ مِن نُّطْفَةٍ (16:4) · وَخَلَقَ الْجَانَّ مِن مَّارِجٍ مِّن نَّارٍ (55:15) · ظَهَرَ الْفَسَادُ فِي الْبَرِّ وَالْبَحْرِ (30:41; the S1 exit item grows) · وَأَنزَلَ مِنَ السَّمَاءِ مَاءً (2:22, stem glossed)

**S6 · After a حرف (II), and three endings, three jobs**
- New: `H.JARR.2` (بِـ، لِـ، عَنْ، كَـ) `C.THREE_STATES` `R.NASB_DETAIL`
- Synthesis: doer → رفع; done-to → نصب; after a حرف جر → جر. Any other منصوب word is "another detail of the action (how, when, why)" and gets its proper name in Level 2.
- Unlock: عَلَّمَ بِالْقَلَمِ (96:4) · خَلَقَ الْإِنسَانَ مِن صَلْصَالٍ كَالْفَخَّارِ (55:14) · وَالْتَفَّتِ السَّاقُ بِالسَّاقِ (75:29, stem glossed) · يَصْدُرُ النَّاسُ أَشْتَاتًا (99:6, now with its detail)

**S7 · A sentence with no verb (first taste) + Integration 1**
- New: `X.NOMINAL.BASIC` `X.NOMINAL.KHABAR_PP`
- Unlock: الْحَمْدُ لِلَّهِ (1:2) · اللَّهُ أَكْبَرُ (liturgy) · اللَّهُ الصَّمَدُ (112:2) · اللَّهُ أَحَدٌ (112:1) · وَاللَّهُ غَفُورٌ رَّحِيمٌ (2:218) · وَاللَّهُ سَمِيعٌ عَلِيمٌ (2:224)
- Integration passage: 55:1–3, 55:14–15, 96:2

#### Phase 3 · Pronouns: the people inside the verb

**S8 · They did it**
- New: `V.PAST.3MP` `N.PL.SOUND_M` `X.VERB_FIRST_SINGULAR`
- Harvest the S1 seed: in فَسَجَدَ الْمَلَائِكَةُ the verb stayed singular before a plural doer.
- Sight verb: آمَنَ · Drip: الَّذِينَ ("those who"), taught as a fixed word: it looks like a ـِينَ plural but never changes its shape, whatever its job (Appendix A, item 21). Use it in find-it steps only; it enters unlock targets at S17.
- Unlock: فَسَجَدُوا (2:34) · قَالَ الْكَافِرُونَ (10:2; singular verb before its plural doer) · قَدْ أَفْلَحَ الْمُؤْمِنُونَ (23:1, stem glossed) · وَصَدَقَ الْمُرْسَلُونَ (36:52) · وَقَد دَّخَلُوا بِالْكُفْرِ (5:61)

**S9 · You, I, we (past)**
- New: `V.PAST.2_1` (ـْتَ، ـْتُمْ، ـْتُ، ـْنَا) `R.MAFUL_BIH_2`
- Sight verbs: كَانَ (gloss only: "was"; grammar in S22), شَاءَ / يَشَاءُ · Drip: لَقَدْ، إِنْ
- Unlock: وَلَقَدْ خَلَقْنَا الْإِنسَانَ مِن سُلَالَةٍ مِّن طِينٍ (23:12) · وَجَعَلْنَا اللَّيْلَ لِبَاسًا (78:10) · وَجَعَلْنَا النَّهَارَ مَعَاشًا (78:11) · وَلَقَدْ كَتَبْنَا فِي الزَّبُورِ (21:105) · عَبَدتُّمْ (109:4) · إِنْ شَاءَ اللَّهُ (liturgy; 2:70)
- Do NOT use 51:56 truncated (Appendix A, item 15).

**S10 · Who is doing it? (present persons)**
- New: `V.PRES.PERSONS` (يَـ…ـُونَ، تَـ، تَـ…ـُونَ، أَ، نَـ)
- Drip: سَـ، سَوْفَ، كَلَّا، and مَا in its second meaning "what" (its S2 meaning was "not"); formalised at S17
- Unlock: لَا أَعْبُدُ مَا تَعْبُدُونَ (109:2) · كَلَّا سَوْفَ تَعْلَمُونَ (102:3) · كَلَّا سَيَعْلَمُونَ (78:4) · أَفَلَا يَنظُرُونَ إِلَى الْإِبِلِ (88:17) · أَسْتَغْفِرُ اللَّهَ (liturgy, stem glossed)

**S11 · The people attached to the verb**
- New: `P.ATT.OBJ` (ـهُ، ـهُمْ، ـكَ، ـكُمْ، ـنَا، ـنِي، ـهَا) `K.MABNI` `X.OBJ_BEFORE_DOER`
- Minimal pair, constructed: خَلَقْنَا ("we created") versus خَلَقَنَا ("he created us").
- Sight verb: هَدَى / يَهْدِي · Drip: لَمَّا، حَتَّى
- Unlock: وَلَقَدْ نَصَرَكُمُ اللَّهُ بِبَدْرٍ (3:123) · جَزَاكَ اللَّهُ خَيْرًا (liturgy) · وَخَلَقْنَاكُمْ أَزْوَاجًا (78:8) · خَلَقَكَ فَسَوَّاكَ فَعَدَلَكَ (82:7, from the second word) · مِن نُّطْفَةٍ خَلَقَهُ فَقَدَّرَهُ (80:19) · عَلَّمَهُ الْبَيَانَ (55:4; completes 55:1–4)

**S12 · The same people on nouns and prepositions**
- New: `P.ATT.POSS` `P.ATT.PREP` `P.DET` (plus إِيَّاكَ as vocabulary)
- Drip: place-and-time words that behave like prepositions: مَعَ، عِنْدَ، بَيْنَ، تَحْتَ، فَوْقَ، قَبْلَ، بَعْدَ · and مَنْ "who" (formalised at S17)
- Unlock: رَضِيَ اللَّهُ عَنْهُمْ وَرَضُوا عَنْهُ (98:8) · صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ (liturgy) · سَمِعَ اللَّهُ لِمَنْ حَمِدَهُ (liturgy) · السَّلَامُ عَلَيْكُمْ (liturgy) · خَتَمَ اللَّهُ عَلَىٰ قُلُوبِهِمْ (2:7) · لَكُمْ دِينُكُمْ وَلِيَ دِينِ (109:6) · وَوَضَعْنَا عَنكَ وِزْرَكَ (94:2) · وَرَفَعْنَا لَكَ ذِكْرَكَ (94:4) · إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ (1:5)

**S13 · Integration 2: سورة الكافرون**
- No new grammar. Author-glossed tokens allowed up to 15%: قُلْ as a sight command (commands are S24), the vocative يَا أَيُّهَا, and the participle governing an object in عَابِدُونَ مَا أَعْبُدُ.

#### Phase 4 · Growing the noun

**S14 · Belonging: الإضافة**
- New: `X.IDAFA`
- Bridge from S12: رَبُّكَ → رَبُّ الْعَالَمِينَ. Same relation, a noun instead of a suffix.
- Drip: idafa words كُلّ، بَعْض، غَيْر، مِثْل
- Unlock: بِسْمِ اللَّهِ (1:1) · رَبِّ الْعَالَمِينَ (1:2) · مَالِكِ يَوْمِ الدِّينِ (1:4) · السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ (liturgy) · مُحَمَّدٌ رَّسُولُ اللَّهِ (48:29) · إِذَا جَاءَ نَصْرُ اللَّهِ وَالْفَتْحُ (110:1) · وَرَأَيْتَ النَّاسَ يَدْخُلُونَ فِي دِينِ اللَّهِ أَفْوَاجًا (110:2) · وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ (64:1)

**S15 · Describing: الصفة**
- New: `X.NAAT`
- Contrast with idafa using constructed pairs (الْكِتَابُ الْكَرِيمُ versus كِتَابُ اللَّهِ).
- Harvest `Z.PATTERN.MAFUL`: مَأْكُول، مَحْفُوظ، مَكْتُوب.
- Unlock: بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ (1:1) · أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ (liturgy) · سُبْحَانَ رَبِّيَ الْعَظِيمِ (liturgy) · الصِّرَاطَ الْمُسْتَقِيمَ (1:6) · فَجَعَلَهُمْ كَعَصْفٍ مَّأْكُولٍ (105:5) · وَقَالَ رَجُلٌ مُّؤْمِنٌ (40:28) · وَجَعَلْنَا سِرَاجًا وَهَّاجًا (78:13) · فِي لَوْحٍ مَّحْفُوظٍ (85:22) · تَرْمِيهِم بِحِجَارَةٍ مِّن سِجِّيلٍ (105:4)

**S16 · More than one: plurals**
- New: `N.PL.SOUND_F` `N.PL.BROKEN` `X.NONHUMAN_PL_FEM` `N.DUAL` (dual is recognition only)
- Broken plurals are learned as vocabulary pairs (قَلْب / قُلُوب ; رَسُول / رُسُل ; عَبْد / عِبَاد ; نَهْر / أَنْهَار). No pattern theory.
- Drip: question words كَيْفَ، أَيْنَ، مَتَى (كَيْفَ is needed for 105:1 at S18)
- Unlock: خَلَقَ اللَّهُ السَّمَاوَاتِ وَالْأَرْضَ بِالْحَقِّ (29:44) · وَعَمِلُوا الصَّالِحَاتِ (103:3) · تَجْرِي مِن تَحْتِهَا الْأَنْهَارُ (2:25) · وَأَرْسَلَ عَلَيْهِمْ طَيْرًا أَبَابِيلَ (105:3) · وَالنَّجْمُ وَالشَّجَرُ يَسْجُدَانِ (55:6; spot the dual here, full unlock at S20 because the noun comes first) · compare فَسَجَدَ الْمَلَائِكَةُ (15:30) with إِذْ قَالَتِ الْمَلَائِكَةُ (3:45)

**S17 · Pointing and linking: الإشارة والموصول**
- New: `X.ISHARA` `X.MAWSUL` `C.HIDDEN`
- Unlock: صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ (1:7) · بِاسْمِ رَبِّكَ الَّذِي خَلَقَ (96:1) · الَّذِي أَطْعَمَهُم مِّن جُوعٍ وَآمَنَهُم مِّنْ خَوْفٍ (106:4) · هَٰذَا مَا وَعَدَ الرَّحْمَٰنُ وَصَدَقَ الْمُرْسَلُونَ (36:52) · مَا شَاءَ اللَّهُ (18:39) · تِلْكَ آيَاتُ الْكِتَابِ الْحَكِيمِ (10:1) · ذَٰلِكَ الْيَوْمُ الْحَقُّ (78:39) · أُولَٰئِكَ عَلَىٰ هُدًى مِّن رَّبِّهِمْ (2:5) · سُبْحَانَ رَبِّيَ الْأَعْلَىٰ (liturgy) · وَقَالَ الَّذِينَ كَفَرُوا (14:13; singular verb before its plural doer, plural verb inside the clause) · الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ (2:25)

**S18 · Integration 3**
- Texts: الفاتحة 1:1–4 · الفيل 105:1 and 105:3–5 (أَلَمْ تَرَ glossed as a chunk) · النصر 110:1–2 · الرحمن 55:1–4

#### Phase 5 · The sentence without a verb, in depth

**S19 · Two halves, no verb**
- New: `R.MUBTADA_KHABAR` `X.KHABAR_FRONTED`
- Unlock: لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ (64:1) · وَلَهُمْ عَذَابٌ أَلِيمٌ (2:10) · لِلَّهِ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ (2:284) · اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ (24:35) · وَهُوَ الْغَفُورُ الْوَدُودُ (85:14) · وَأُولَٰئِكَ هُمُ الْمُفْلِحُونَ (2:5)

**S20 · The flip: doer first**
- New: `X.KHABAR_VERBAL`
- Contrast with S8: verb first stays singular; noun first and the verb agrees in number.
- Unlock: وَاللَّهُ خَلَقَكُمْ وَمَا تَعْمَلُونَ (37:96) · وَاللَّهُ يَعْلَمُ وَأَنتُمْ لَا تَعْلَمُونَ (2:216) · الرَّحْمَٰنُ ۝ عَلَّمَ الْقُرْآنَ (55:1–2, read as one sentence in one common analysis) · اللَّهُ يَبْسُطُ الرِّزْقَ لِمَن يَشَاءُ وَيَقْدِرُ (13:26) · وَاللَّهُ يُحِبُّ الْمُحْسِنِينَ (3:134)

**S21 · إِنَّ and her sisters**
- New: `X.INNA` (first half flips to نصب)
- Unlock: إِنَّ الْإِنسَانَ لَفِي خُسْرٍ (103:2) · إِنَّ اللَّهَ غَفُورٌ رَّحِيمٌ (2:173) · إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ (108:1) · إِنَّ شَانِئَكَ هُوَ الْأَبْتَرُ (108:3) · إِنَّ اللَّهَ مَعَ الصَّابِرِينَ (2:153) · فَإِنَّ مَعَ الْعُسْرِ يُسْرًا (94:5) · إِنَّا أَنزَلْنَاهُ فِي لَيْلَةِ الْقَدْرِ (97:1) · إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ (2:156) · لَعَلَّكُمْ تَتَّقُونَ (2:21)

**S22 · كَانَ and her sisters**
- New: `X.KANA` (second half flips to نصب; the mirror image of إِنَّ)
- Unlock: إِنَّهُ كَانَ تَوَّابًا (110:3) · وَكَانَ اللَّهُ غَفُورًا رَّحِيمًا (4:96) · إِنَّ الْبَاطِلَ كَانَ زَهُوقًا (17:81) · جَزَاءً بِمَا كَانُوا يَعْمَلُونَ (32:17)
- Teaching gem: 17:81 now closes the loop opened in S1. الْبَاطِلُ (doer, damma) and الْبَاطِلَ (after إِنَّ, fatha): same word, two endings, two jobs, one ayah.

**S23 · Integration 4**
- Texts: العصر (full; the oath وَ, the لَـ of emphasis, إِلَّا and the stem of تَوَاصَوْا are author-glossed) · القدر 97:1 · الإسراء 17:81 from جَاءَ · الفاتحة 1:1–5 and 1:7 first half

#### Phase 6 · Tuning the verb

**S24 · Commands: الأمر**
- New: `V.IMPV`
- Sight commands: قُلْ، اهْدِ، صَلِّ، اتَّقُوا، كُنْ
- Unlock: اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ (96:1) · اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ (1:6) · فَصَلِّ لِرَبِّكَ وَانْحَرْ (108:2; الكوثر complete) · فَسَبِّحْ بِحَمْدِ رَبِّكَ وَاسْتَغْفِرْهُ (110:3; النصر complete) · قُلْ هُوَ اللَّهُ أَحَدٌ (112:1) · يَا أَيُّهَا النَّاسُ اعْبُدُوا رَبَّكُمُ (2:21) · فَإِذَا فَرَغْتَ فَانصَبْ ۝ وَإِلَىٰ رَبِّكَ فَارْغَب (94:7–8) · اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ (liturgy)

**S25 · Don't, and didn't: the jussive look**
- New: `V.MOOD.JUSSIVE` `H.LA_NAHIYA` `H.LAM`
- Unlock: لَمْ يَلِدْ (112:3) · أَلَمْ يَجْعَلْ كَيْدَهُمْ فِي تَضْلِيلٍ (105:2; الفيل complete, and أَلَمْ تَرَ can now be explained) · أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ (94:1; الشرح complete) · لَا تَحْزَنْ إِنَّ اللَّهَ مَعَنَا (9:40) · كَلَّا لَا تُطِعْهُ وَاسْجُدْ وَاقْتَرِب (96:19)

**S26 · So that, and never: the subjunctive look, plus time markers**
- New: `V.MOOD.SUBJ` (after أَنْ، لَنْ، لِـ، كَيْ، حَتَّى) `H.TIME` (قَدْ، سَـ، سَوْفَ formalised)
- Unlock: فَإِن لَّمْ تَفْعَلُوا وَلَن تَفْعَلُوا (2:24) · لَن تَنَالُوا الْبِرَّ حَتَّىٰ تُنفِقُوا مِمَّا تُحِبُّونَ (3:92) · وَمَا خَلَقْتُ الْجِنَّ وَالْإِنسَ إِلَّا لِيَعْبُدُونِ (51:56; full ayah only; flag as advanced, Appendix A item 17)

**S27 · When the doer is left out: the passive**
- New: `V.PASSIVE` `R.NAIB_FAIL`
- Natural minimal pair from two real ayat, neither altered: خَلَقَ الْإِنسَانَ (55:3) and وَخُلِقَ الْإِنسَانُ ضَعِيفًا (4:28).
- Unlock: خُلِقَ مِن مَّاءٍ دَافِقٍ (86:6) · وَلَمْ يُولَدْ (112:3) · وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ (112:4; الإخلاص complete) · كُتِبَ عَلَيْكُمُ الصِّيَامُ (2:183) · وَإِذَا قُرِئَ الْقُرْآنُ (7:204) · إِذَا زُلْزِلَتِ الْأَرْضُ زِلْزَالَهَا (99:1) · أَفَلَا يَنظُرُونَ إِلَى الْإِبِلِ كَيْفَ خُلِقَتْ (88:17) · غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ (1:7)

**S28–S29 · Level 1 capstone**
- S28: الفاتحة end to end.
- S29: الإخلاص، الكوثر، النصر، الفيل، الشرح، العصر، الكافرون end to end, then the Level 1 assessment.
- Still taken on trust until Level 2: derived-form stems (أَنْعَمْتَ، نَسْتَعِينُ، الْمُسْتَقِيمَ، عَلَّمَ، أَرْسَلَ، اسْتَغْفِرْ); weak-verb stem changes (قَالَ / قُلْ ; كَانَ / يَكُنْ ; اهْدِ ; تَرَ ; رَضُوا ; تَرْمِي); the doubled root in الضَّالِّينَ; غَيْرِ and لَا in 1:7; the vocative; the oath وَ.

### 4.2 Level 2: read connected passages (phase level only)

**Phase 7 · Verb families and noun patterns**
- Forms in corpus-frequency order. Provisional: IV, II, VIII, then V, X, III, VI, VII [VERIFY]. For each: past, present and command look; masdar; active and passive participle.
- Meaning tendencies are taught as tendencies, never as rules (IV and II often causative; V and VII often reflexive or passive; III and VI often mutual; X often "seek").
- Harvest the seeds: مُسْلِم and مُؤْمِن (IV), مُسْتَقِيم (X), مُتَّقِينَ (VIII).
- Form I noun patterns, many of them Names of Allah: فَاعِل، مَفْعُول، مَفْعَل / مَفْعِل (place), فَعِيل (رَحِيم، عَلِيم), فَعَّال (غَفَّار، تَوَّاب), أَفْعَل (أَكْبَر، أَعْلَم), masdar shapes.

**Phase 8 · Weak verbs, systematically**
- أَجْوَف (قَالَ، كَانَ), نَاقِص (دَعَا، هَدَى، رَأَى), مِثَال (وَعَدَ، وَجَدَ), مُضَعَّف (ضَلَّ، ظَنَّ، رَدَّ), مَهْمُوز. All already familiar as sight words.
- Recognition strategy: "find the missing or changed root letter."

**Phase 9 · Joining sentences and naming the details**
- Conditionals (إِنْ، مَنْ، مَا، إِذَا، لَوْ، لَوْلَا); أَنَّ and أَنْ clauses as slot fillers; الحال; التمييز; المفعول المطلق، لأجله، فيه (replacing the generic `R.NASB_DETAIL`); الاستثناء and the مَا … إِلَّا restriction; لَا النافية للجنس (لَا إِلَٰهَ إِلَّا اللَّهُ); النداء; القسم; emphasis (لَـ، نون التوكيد); البدل; diptotes and the five nouns in full.

**Phase 10 · Why word order moves**
- التقديم والتأخير (إِيَّاكَ نَعْبُدُ; 35:28; 2:124), الحذف, الالتفات. How tafsir uses i'rab. How to read an i'rab reference work unaided.

### 4.3 Milestone texts

| After | The learner can parse |
|-------|----------------------|
| S7 | الرحمن 55:1–3; many two- and three-word fragments; الْحَمْدُ لِلَّهِ; اللَّهُ أَكْبَرُ |
| S13 | سورة الكافرون (with author glosses) |
| S18 | الفاتحة 1–4; most of الفيل; النصر 1–2 |
| S23 | سورة العصر (with author glosses) |
| S24 | سورة الكوثر and سورة النصر complete |
| S25 | سورة الفيل and سورة الشرح complete |
| S27 | سورة الإخلاص complete |
| S28 | سورة الفاتحة complete |

### 4.4 Liturgical anchors (phrases already on the tongue)

These are non-Quranic or widely recited phrases used as unlock targets under P12. `source` is `liturgy`. Earliest session is where every ending becomes explainable.

| Phrase | Earliest | Why it is valuable |
|--------|----------|--------------------|
| اللَّهُ أَكْبَرُ | S7 | First verbless sentence. Note: أَكْبَرُ never takes tanwin. |
| الْحَمْدُ لِلَّهِ | S7 | Second half is حرف جر + اسم |
| إِنْ شَاءَ اللَّهُ | S9 | Verb + doer with a sight verb |
| أَسْتَغْفِرُ اللَّهَ | S10 | "I" prefix + done-to |
| جَزَاكَ اللَّهُ خَيْرًا | S11 | Suffix object before the noun doer; two done-to's |
| صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ | S12 | Verb + doer + preposition with suffix |
| رَضِيَ اللَّهُ عَنْهُ | S12 | Same shape |
| سَمِعَ اللَّهُ لِمَنْ حَمِدَهُ | S12 | Two verbs, a linker, a suffix object |
| السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ | S12 / S14 | Verbless sentence + idafa |
| بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ | S15 | Preposition + idafa + two adjectives |
| أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ | S15 | Two preposition phrases + adjective |
| سُبْحَانَ رَبِّيَ الْعَظِيمِ | S15 | A نصب detail + idafa + adjective |
| سُبْحَانَ رَبِّيَ الْأَعْلَىٰ | S17 | Hidden ending |
| مَا شَاءَ اللَّهُ | S17 | Linking مَا |
| رَبَّنَا وَلَكَ الْحَمْدُ | S19 | Fronted second half (vocative glossed) |
| إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ | S21 | إِنَّ with a suffix |
| اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ | S24 | Command |
| لَا إِلَٰهَ إِلَّا اللَّهُ | Level 2, Phase 9 | Needs لَا النافية للجنس and the exception |

### 4.5 Sight verbs and frequency drip (provisional) [VERIFY]

Replace this list with the corpus counts from §10 before authoring beyond Phase 2.

- **Sight verbs** (introduced as whole words with past, present and command where common): جَاءَ (S1), قَالَ (S2), رَأَى (S4), آمَنَ (S8), كَانَ and شَاءَ (S9), هَدَى (S11), then أَتَى / آتَى، دَعَا، أَرَادَ as they appear in targets.
- **Pattern-track verbs** (sound, frequent, concrete): خَلَقَ، جَعَلَ، عَلِمَ، عَمِلَ، كَفَرَ، عَبَدَ، ذَكَرَ، رَزَقَ، نَصَرَ، كَتَبَ، سَمِعَ، دَخَلَ، خَرَجَ، ظَلَمَ، غَفَرَ، سَجَدَ، صَدَقَ، ضَرَبَ، فَعَلَ. Keep سَجَدَ and رَكَعَ in S1 because salah makes them vivid, even though رَكَعَ is rare in the Quran. Hold قَرَأَ until S24, when اقْرَأْ pays it off, because its hamza spelling shifts.
- **Drip words** by session: S1 وَ، فَ · S2 مَا، لَا، قَدْ · S3 إِذَا، إِذْ، ثُمَّ · S4 أَوْ، بَلْ · S7 هَلْ، أَ · S8 الَّذِينَ · S9 لَقَدْ، إِنْ · S10 سَـ، سَوْفَ، كَلَّا، مَا "what" · S11 لَمَّا، حَتَّى · S12 مَعَ، عِنْدَ، بَيْنَ، تَحْتَ، فَوْقَ، قَبْلَ، بَعْدَ، مَنْ "who" · S14 كُلّ، بَعْض، غَيْر، مِثْل · S16 كَيْفَ، أَيْنَ، مَتَى · S17 مَنْ، مَا (linking, formalised) · S21 إِنَّمَا، لَٰكِنْ

### 4.6 Seeds and callbacks ledger

Things the learner meets early without explanation, and where each one pays off. Do not "fix" a seed by explaining it early (P10). Store `Z.*` seeds in `Session.seeds` and the rest in `Fragment.note`, so that the harvesting session can show a "you first met this in S1" callback.

| Planted | What the learner meets, unexplained | Harvested |
|---------|-------------------------------------|-----------|
| S1 | فَسَجَدَ الْمَلَائِكَةُ (15:30): a singular verb before a plural doer | S8 (`X.VERB_FIRST_SINGULAR`) |
| S1 | The same fragment has a masculine verb; قَالَتِ الْمَلَائِكَةُ (3:45) has a feminine one | S16 (noted; no rule is built on it) |
| S1 | مُسْلِم and مُؤْمِن as plain vocabulary | Phase 7 (Form IV participles) |
| S1 | شَهِدَ، سَمِعَ: the middle vowel of the past varies | S2 (verbs learned as pairs); stays lexical |
| S1 | Root families س ج د and ك ت ب (`Z.ROOT`) | The word-shape track of every session; Phase 7 |
| S1 | مَكْتُوب (`Z.PATTERN.MAFUL`) | S15, S27, Phase 7 |
| S1 | جَاءَ الْحَقُّ وَزَهَقَ الْبَاطِلُ (17:81) | S22: الْبَاطِلَ after إِنَّ, later in the same ayah |
| S1 exit check | ظَهَرَ الْفَسَادُ (30:41) | S5: grows by فِي الْبَرِّ وَالْبَحْرِ |
| S1 to S11 | Sight verbs جَاءَ، قَالَ، رَأَى، آمَنَ، كَانَ، شَاءَ، هَدَى | Phase 7 (آمَنَ) and Phase 8 (the rest); the grammar of كَانَ at S22 |
| S2 | يَصْدُرُ النَّاسُ (99:6) | S6: grows by أَشْتَاتًا |
| S3 | سَاجِد، كَافِر، الْوَاقِعَة (`Z.PATTERN.FAIL`) | Phase 7 |
| S3 | A past form after إِذَا points forward | Phase 9 (conditionals) |
| S4 | Names with no tanwin (دَاوُودُ، جَالُوتَ) | Phase 9 (diptotes) |
| S4, S11, S20 | الرحمن 55:1–4, assembled piece by piece: 55:2–3 at S4, 55:4 at S11, 55:1–2 read as one sentence at S20 | S20 |
| S5 | مَسْجِد (`Z.PATTERN.MAKAN`) | Phase 7 |
| S7 | أَكْبَرُ has no tanwin | Phase 7 (the أَفْعَل pattern) and Phase 9 (diptotes) |
| S8 | الَّذِينَ as a fixed word | S17 |
| S10, S12 | مَا "what" and مَنْ "who" as vocabulary | S17 |
| S12 | إِيَّاكَ placed before its verb (1:5) | Phase 10 |
| S18 | أَلَمْ تَرَ as a glossed chunk (105:1) | S25 |

---

## 5. Concept registry (Level 1)

One row per teachable unit. IDs are stable keys. "S" is the session where the concept becomes core. Seeds are exposure only: never assessed, never counted against the 4-concept cap.

ID prefixes: `K` kind of word · `V` verb shape · `R` role (job) · `C` case marks · `D` definiteness · `H` huruf and function words · `N` noun shape · `P` pronouns and principles · `X` structures · `Z` seeds.

| ID | Arabic term | Plain handle and rule | S | Prereqs |
|----|-------------|-----------------------|---|---------|
| `K.FIL` | فِعْل | doing-word | 1 | none |
| `K.ISM` | اِسْم | naming-word | 1 | none |
| `K.HARF` | حَرْف | linking-word; means nothing alone | 1 | none |
| `V.PAST.3MS` | فِعْل مَاضٍ | "he did"; three letters, last one carries fatha; a full sentence by itself | 1 | `K.FIL` |
| `R.FAIL` | فَاعِل | the doer; follows the verb; damma | 1 | `V.PAST.3MS` `K.ISM` |
| `D.DEFINITENESS` | نَكِرَة / مَعْرِفَة | "a" = tanwin; "the" = ال; never both on one word | 1 | `K.ISM` |
| `H.CONJ` | حَرْف عَطْف | glue: وَ "and", فَ "so"; written attached; a noun joined by وَ copies the ending of the noun before it (noted at S5) | 1 | `K.HARF` |
| `V.PRES.3MS` | فِعْل مُضَارِع | "he does / is doing"; يَـ prefix; ends in damma by default | 2 | `V.PAST.3MS` |
| `H.NEG.SIMPLE` | مَا، لَا | "not", with no change to the verb | 2 | `V.PRES.3MS` |
| `V.PAST.3FS` | ـَتْ | "she did" | 3 | `V.PAST.3MS` |
| `V.PRES.3FS` | تَـ | "she does" (same look as "you", see Appendix A item 6) | 3 | `V.PRES.3MS` |
| `N.GENDER.TA` | تَاء مَرْبُوطَة | ة marks most feminine nouns; the verb agrees | 3 | `R.FAIL` |
| `R.MAFUL_BIH` | مَفْعُول بِهِ | the done-to; fatha, or tanwin fath with alif | 4 | `R.FAIL` |
| `V.SUBJ.HIDDEN` | ضَمِير مُسْتَتِر | no noun doer after the verb means the doer is the "he" or "she" inside it | 4 | `R.MAFUL_BIH` |
| `P.ENDINGS_NOT_ORDER` | (principle) | endings, not word order, tell who did what | 4 | `R.MAFUL_BIH` |
| `H.JARR.1` | حُرُوف الْجَرّ | فِي، مِنْ، إِلَى، عَلَى | 5 | `K.HARF` |
| `R.MAJRUR` | اِسْم مَجْرُور | the noun after a حرف جر; kasra | 5 | `H.JARR.1` |
| `H.JARR.2` | حُرُوف الْجَرّ | attached: بِـ، لِـ، كَـ; and عَنْ | 6 | `R.MAJRUR` |
| `C.THREE_STATES` | رَفْع / نَصْب / جَرّ | three endings, three jobs | 6 | `R.FAIL` `R.MAFUL_BIH` `R.MAJRUR` |
| `R.NASB_DETAIL` | مَنْصُوب | another detail of the action (how, when, why); named properly in Level 2 | 6 | `C.THREE_STATES` |
| `X.NOMINAL.BASIC` | مُبْتَدَأ + خَبَر | a sentence with no verb; two رفع halves; "is" is not written | 7 | `C.THREE_STATES` |
| `X.NOMINAL.KHABAR_PP` | خَبَر شِبْه جُمْلَة | the second half is حرف جر + اسم | 7 | `X.NOMINAL.BASIC` `R.MAJRUR` |
| `V.PAST.3MP` | ـُوا | "they did"; the alif is silent | 8 | `V.PAST.3MS` |
| `N.PL.SOUND_M` | جَمْع مُذَكَّر سَالِم | ـُونَ in رفع, ـِينَ in نصب and جر; the letter is the ending | 8 | `C.THREE_STATES` |
| `X.VERB_FIRST_SINGULAR` | (rule) | a verb placed before a plural noun doer stays singular | 8 | `V.PAST.3MP` |
| `V.PAST.2_1` | ـْتَ، ـْتُمْ، ـْتُ، ـْنَا | you, you all, I, we did; the letter before the ending takes sukun | 9 | `V.PAST.3MP` |
| `R.MAFUL_BIH_2` | مَفْعُول بِهِ ثَانٍ | some verbs take two done-to's (جَعَلَ، عَلَّمَ، أَعْطَى) | 9 | `R.MAFUL_BIH` |
| `V.PRES.PERSONS` | يَـ…ـُونَ، تَـ، تَـ…ـُونَ، أَ، نَـ | who is doing it, present | 10 | `V.PRES.3MS` `V.PAST.2_1` |
| `P.ATT.OBJ` | ضَمِير مُتَّصِل | him, them, you, us, me, her, attached to a verb as its done-to | 11 | `R.MAFUL_BIH` `V.PAST.2_1` |
| `K.MABNI` | مَبْنِيّ | some words never change their ending; their job is read from position | 11 | `C.THREE_STATES` |
| `X.OBJ_BEFORE_DOER` | (pattern) | a suffix done-to sits between the verb and its noun doer | 11 | `P.ATT.OBJ` |
| `P.ATT.POSS` | ضَمِير مُتَّصِل | the same suffixes on a noun: his, their, your; the noun loses tanwin | 12 | `P.ATT.OBJ` |
| `P.ATT.PREP` | ضَمِير مُتَّصِل | the same suffixes on a preposition (لَهُ، عَلَيْهِمْ) | 12 | `P.ATT.OBJ` `H.JARR.2` |
| `P.DET` | ضَمِير مُنْفَصِل | هُوَ، هُمْ، هِيَ، أَنْتَ، أَنْتُمْ، أَنَا، نَحْنُ | 12 | `K.MABNI` |
| `X.IDAFA` | إِضَافَة | belonging; first word loses tanwin and ال; second word is always جر | 14 | `P.ATT.POSS` `R.MAJRUR` |
| `X.NAAT` | نَعْت / صِفَة | a describing word follows its noun in ending, definiteness, gender and number | 15 | `X.IDAFA` `N.GENDER.TA` |
| `N.PL.SOUND_F` | جَمْع مُؤَنَّث سَالِم | ـَات; takes kasra where fatha is expected | 16 | `N.PL.SOUND_M` |
| `N.PL.BROKEN` | جَمْع تَكْسِير | learned as vocabulary pairs | 16 | `K.ISM` |
| `X.NONHUMAN_PL_FEM` | (rule) | non-human plurals behave as feminine singular | 16 | `N.PL.BROKEN` `V.PAST.3FS` |
| `N.DUAL` | مُثَنًّى | recognition only: ـَانِ / ـَيْنِ; verb ـَا | 16 | `N.PL.SOUND_M` |
| `X.ISHARA` | اِسْم إِشَارَة | this, that, these, those | 17 | `K.MABNI` |
| `X.MAWSUL` | اِسْم مَوْصُول + صِلَة | who, which, what + a full sentence | 17 | `K.MABNI` `V.PAST.3MP` |
| `C.HIDDEN` | إِعْرَاب مُقَدَّر | the ending is hidden on words that end in a long ā (مُوسَى، هُدًى، الدُّنْيَا) | 17 | `C.THREE_STATES` |
| `R.MUBTADA_KHABAR` | مُبْتَدَأ / خَبَر | formal names for the two halves | 19 | `X.NOMINAL.BASIC` |
| `X.KHABAR_FRONTED` | خَبَر مُقَدَّم | the حرف جر half comes first (لَهُ الْمُلْكُ) | 19 | `R.MUBTADA_KHABAR` `P.ATT.PREP` |
| `X.KHABAR_VERBAL` | خَبَر جُمْلَة فِعْلِيَّة | the flip: noun first, then a verb sentence about it; the verb agrees in number | 20 | `R.MUBTADA_KHABAR` `X.VERB_FIRST_SINGULAR` |
| `X.INNA` | إِنَّ وَأَخَوَاتُهَا | the first half flips to نصب | 21 | `R.MUBTADA_KHABAR` |
| `X.KANA` | كَانَ وَأَخَوَاتُهَا | the second half flips to نصب | 22 | `X.INNA` |
| `V.IMPV` | فِعْل أَمْر | command; no person prefix; ends in sukun; plural ـُوا | 24 | `V.PRES.PERSONS` |
| `V.MOOD.JUSSIVE` | مَجْزُوم | the clipped present: sukun, or the ن drops, or a weak last letter drops | 25 | `V.PRES.PERSONS` |
| `H.LA_NAHIYA` | لَا النَّاهِيَة | "don't" + clipped present | 25 | `V.MOOD.JUSSIVE` |
| `H.LAM` | لَمْ | "did not": present look, past meaning | 25 | `V.MOOD.JUSSIVE` |
| `V.MOOD.SUBJ` | مَنْصُوب | fatha, or the ن drops, after أَنْ، لَنْ، لِـ، كَيْ، حَتَّى | 26 | `V.MOOD.JUSSIVE` |
| `H.TIME` | قَدْ، سَـ، سَوْفَ | already / will | 26 | `V.PRES.3MS` |
| `V.PASSIVE` | مَبْنِيّ لِلْمَجْهُول | فُعِلَ / يُفْعَلُ: the doer is left out | 27 | `V.PRES.PERSONS` |
| `R.NAIB_FAIL` | نَائِب فَاعِل | the done-to steps into the doer's place and takes رفع | 27 | `V.PASSIVE` |
| `Z.ROOT` | جَذْر | seed: three letters carry the meaning; the mould changes the kind of word | 1 | none |
| `Z.PATTERN.MAFUL` | مَفْعُول | seed: "the thing X-ed" (مَكْتُوب); harvested S15 and S27 | 1 | `Z.ROOT` |
| `Z.PATTERN.FAIL` | فَاعِل (pattern) | seed: "the one who X-es" (سَاجِد، كَافِر); harvested Phase 7 | 3 | `Z.ROOT` |
| `Z.PATTERN.MAKAN` | اِسْم مَكَان | seed: "the place of X-ing" (مَسْجِد); harvested Phase 7 | 5 | `Z.ROOT` |

**Reserved Level 2 IDs** (not taught in Level 1, but already valid in `stemRequires` so tokens can be tagged now): `V.FORM.II` `V.FORM.III` `V.FORM.IV` `V.FORM.V` `V.FORM.VI` `V.FORM.VII` `V.FORM.VIII` `V.FORM.X` · `V.WEAK.HOLLOW` `V.WEAK.DEFECTIVE` `V.WEAK.ASSIMILATED` `V.WEAK.DOUBLED` `V.WEAK.HAMZATED` · `N.DIPTOTE` `N.FIVE_NOUNS` · `R.HAL` `R.TAMYIZ` `R.MAFUL_MUTLAQ` `R.ZARF` · `X.SHART` `X.ISTITHNA` `X.NIDA` `X.QASAM` `X.LA_NAFIYA_LIL_JINS`. Level 2 authoring will give each a full row.

Naming clash to handle in the UI: فَاعِل is both a job (`R.FAIL`, the doer in this sentence) and a word pattern (`Z.PATTERN.FAIL`). Always show which one is meant.

---

## 6. Data model

Notation only. Adapt names and types to the repo's language and conventions.

```ts
type ConceptId = string;                        // "R.FAIL"
type Source = "constructed" | "quran" | "liturgy";

interface Concept {
  id: ConceptId;
  arTerm?: string;                              // "فَاعِل"
  handle: string;                               // "doer"
  rule: string;                                 // one sentence, shown after the notice step
  track: "structure" | "shape" | "lexical";
  move: "add_slot" | "change_verb" | "expand_filler" | "label" | "principle";
  status: "core" | "seed" | "recognition_only";
  session: number;
  prereqs: ConceptId[];
  noticePrompt: string;                         // asked BEFORE the name is shown (P3)
  signs: string[];                              // visible marks that identify it
  corpusSelector?: string;                      // how to detect it from corpus tags (§10)
  harvests?: ConceptId[];                       // seeds this concept cashes in (P10)
}

interface Segment {
  text: string;                                 // "فَ"
  kind: "prefix" | "stem" | "suffix" | "ending" | "helper";   // "helper" = helping vowel: sound, not grammar (Appendix A, item 8)
  concept?: ConceptId;
  gloss?: string;
}

interface Token {
  surface: string;                              // fully vowelled, wasl form (P8)
  segments: Segment[];
  wordKind: "fil" | "ism" | "harf";
  role?: ConceptId;                             // an R.* id
  state?: "raf" | "nasb" | "jarr" | "jazm" | "mabni";
  lemma?: string;
  root?: string;
  verbForm?: number;                            // 1..10
  requires: ConceptId[];                        // to explain every visible affix and ending, and the job
  stemRequires: ConceptId[];                    // to explain the stem: form, weakness, pattern
  gloss: string;
}

interface Fragment {
  id: string;
  source: "quran" | "liturgy";
  ref?: { surah: number; ayah: number; wordFrom?: number; wordTo?: number };
  // Quranic text is NOT stored here. It is pulled by ref from the verified source.
  checkString?: string;                         // author's typed Arabic, used only by the T2 verification test
  tokens: Token[];
  meaning: string;                              // team-authored, literal
  meaningSafe: boolean;                         // human-reviewed (P11)
  approvedBy?: string;
  familiar?: "salah" | "adhkar" | "short_surah" | "widely_heard";
  authorGlossTokens?: number[];                 // integration texts only, max 15% of tokens
  note?: string;
  cautions?: number[];                          // Appendix A item numbers that apply to this fragment
}

interface LadderItem {
  ar: string;
  en: string;
  source: Source;                               // ladders are almost always "constructed"
  diffFromPrev?: string;                        // the one thing that changed (P2)
  tokens?: Token[];
}

interface LadderStep {
  step: number;
  introduces?: ConceptId;
  items: LadderItem[];
  noticePrompt?: string;
  nameReveal?: { arTerm?: string; handle: string; rule: string };
  watchOut?: string;                            // the predictable confusion
}

interface Session {
  id: number;
  phase: number;
  title: string;
  integration: boolean;
  newConcepts: ConceptId[];                     // length <= 4
  labelsIntroduced?: ConceptId[];
  seeds: ConceptId[];
  sightVerbs: string[];
  dripWords: string[];
  ladder: LadderStep[];
  findIt?: string[];                            // Fragment ids for the "find it" step
  unlockTargets: string[];                      // Fragment ids
  rootFamilies?: { root: string; family: { ar: string; en: string }[] }[];   // seed content (P10)
  exitCheck: Exercise[];
}

interface Exercise {
  type: "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7" | "E8" | "E9";
  concepts: ConceptId[];                        // what it tests, used for interleaving and review
  fragmentId?: string;
  ladderItem?: LadderItem;
  prompt: string;
  options?: string[];
  answer: string | number | number[];
}

interface LearnerConceptState {
  concept: ConceptId;
  status: "new" | "learning" | "learned" | "mastered";
  box?: number;                                 // or whatever the scheduler needs
  due?: string;
}
```

---

## 7. Unlock and coverage logic

```
learned(c)            := status of c is "learned" or "mastered"

unlocked(fragment)    := for every token t not listed in authorGlossTokens:
                           every id in t.requires is learned
                         AND fragment.meaningSafe AND fragment.approvedBy is set

mastered(fragment)    := unlocked(fragment)
                         AND for every token t: every id in t.stemRequires is learned

coverage(text)        := tokens of text whose requires are all learned / all tokens of text
fullCoverage(text)    := same, using requires and stemRequires
```

- `requires` is auto-derived from corpus tags (§10, T4) and may be overridden by an author.
- A concept becomes "learned" when its session's exit check is passed and it has survived one spaced review. [DECIDE: threshold; default 4 of 5 on the exit check.]
- Show coverage for three targets: الفاتحة, Juz 'Amma, the whole Quran. This is the track's main progress indicator. Do not show "chapters completed".
- When a fragment flips to unlocked because of a newly learned concept, surface it ("You can now parse …"). Prefer fragments with a `familiar` value.

---

## 8. Exercise types (recognition only)

| Type | Name | What the learner does |
|------|------|-----------------------|
| E1 | Tap the role | Tap the verb, the doer, the done-to, the word after a حرف جر |
| E2 | Who did what to whom | Choose the correct English meaning. Uses constructed sentences where word order misleads, so the ending must be read. |
| E3 | Ending to job | One ending is highlighted; choose its job |
| E4 | Split the word | Cut وَخَلَقْنَاكُمْ into وَ + خَلَقْ + نَا + كُمْ and label each part |
| E5 | Root finder | Pick the three root letters; match words to a root family |
| E6 | Quick sort | a / the; past / present / command; he / she / they / you / I / we |
| E7 | Find it in the ayah | Tap every instance of concept X in a real fragment |
| E8 | Full parse | Walk the three-question routine (§3.5) word by word. Used in unlock and integration steps. |
| E9 | Build the meaning | Arrange English chunks into the meaning. The only "production" allowed, and it is in English. |

Rules for all exercises:

- No Arabic typing. No conjugation drills (P5).
- Distractors are labels, jobs or English meanings. A distractor is never an altered piece of Quranic text (P11).
- No option, right or wrong, may state something theologically offensive. Role-swap items use human participants only, for example الرَّجُل and الْوَلَد (P11).
- E2 items are always `source: "constructed"`. At least half of them put the done-to first or use two human participants, so that the ending is the only reliable cue.
- Every exercise carries its `concepts` so the review engine can schedule and interleave it.
- No transliteration anywhere; these learners read the script. [DECIDE: default none.]

---

## 9. Review scheduling

- If the app already has a spaced-repetition scheduler, reuse it. If not, start with a five-box Leitner scheme (1, 3, 7, 16, 35 days) at the concept level and the lexeme level. Do not over-engineer this in v1. [DECIDE]
- Each session opens with at most 10 due items.
- Interleaving: at least 40% of the items in any practice set or exit check come from earlier concepts. [DECIDE: ratio]
- Integration sessions (S7 second half, S13, S18, S23, S28, S29) add no new concepts. They are E8 on connected text plus review.
- A missed exit-check item goes into box 1 for each concept it carries.
- Log every answered item with its concept IDs, correctness, response time and session number from the first build. The pilot (M6) and any later resequencing depend on these numbers.

---

## 10. Corpus pipeline and sequencing validation

The order of this curriculum is a set of hypotheses. These tasks turn them into counts.

**T1 · Ingest the morphology data.** Source: Quranic Arabic Corpus, morphology v0.4 (see §15 for license). One line per segment: location `(surah:ayah:word:segment)`, form in Buckwalter transliteration, tag, features. Features include part of speech, `ROOT:` and `LEM:`, aspect (perfect, imperfect, imperative), person-gender-number such as `3MS`, verb form `(II)`…`(X)`, voice, mood, case, definiteness, and prefix and suffix segments for conjunctions, prepositions, ال and attached pronouns. [VERIFY: inspect the actual file; do not trust this description.] Keep the source file verbatim. Store our own annotations in separate files keyed by location.

**T2 · Align and verify text.** Use the app's existing verified Quran text if it has one; otherwise Tanzil (§15). Write an alignment test between corpus word indices and the display text. Then write the fragment verification test: for every Fragment with a `checkString`, normalise both sides (strip vowels and Quranic marks, unify alef forms, ignore the small differences between Uthmani and standard spelling) and assert a match at the stated `ref`. Every fragment in §4 and §11 must pass before release. Report failures as a list for human review; never auto-correct them.

**T3 · Frequency report (validates P6 and §4.5).**
- a. Verb lemmas by token count, split into sound versus weak or derived. Output: the pattern-track verb list and the top 10 sight verbs.
- b. Person-gender-number distribution for perfect and for imperfect verbs. Output: the order of persons in S8 to S10.
- c. Token share of verb Forms I to X. Output: the order of Phase 7.
- d. Top 100 particles, pronouns and other function words. Output: the drip list.
- e. Share of verbs whose doer is an explicit noun versus a suffix or hidden pronoun. This tests the claim behind P4 and the timing of Phase 3. If the syntactic treebank does not cover the whole text, approximate (a verb followed by a nominative noun) and say so.
- f. Share of verbal-sentence openers that carry وَ or فَ or another particle.

**T4 · Auto-tag tokens.** For every word in the Quran, derive `requires` and `stemRequires` from corpus tags using each concept's `corpusSelector`. Mark words that cannot be derived automatically for manual tagging. Know the limit: the morphology file gives each noun's case, not its job. A nominative noun may be a doer, a مبتدأ, a خبر or a نائب فاعل. Every `R.*` tag is therefore a heuristic candidate (for example: the first nominative noun after a verb, with no other verb between them) and stays a candidate until a human confirms it. The corpus site's syntactic treebank can seed roles where it exists, but it covers only part of the text [VERIFY]. When T4 runs, diff its output against the four hand-tagged fragments in §11.3 and report every conflict.

Indicative selectors [VERIFY against the corpus tagset documentation]:

| Corpus feature | Concept |
|----------------|---------|
| Verb, perfect, 3MS / 3FS / 3MP | `V.PAST.3MS` / `V.PAST.3FS` / `V.PAST.3MP` |
| Verb, perfect, 2nd or 1st person | `V.PAST.2_1` |
| Verb, imperfect, 3MS / 3FS / other persons | `V.PRES.3MS` / `V.PRES.3FS` / `V.PRES.PERSONS` |
| Verb, imperative | `V.IMPV` |
| Passive voice | `V.PASSIVE`; its nominative noun is a candidate `R.NAIB_FAIL` |
| Mood jussive / subjunctive | `V.MOOD.JUSSIVE` / `V.MOOD.SUBJ`, plus the particle that caused it |
| Verb form II to X | the matching `V.FORM.*`, in `stemRequires` |
| Root containing و, ي or ء, or with identical second and third letters | the matching `V.WEAK.*`, in `stemRequires` |
| Prefixed conjunction و or ف | `H.CONJ` |
| Determiner prefix ال, or the indefinite feature | `D.DEFINITENESS` |
| Preposition, by lemma: فِي، مِنْ، إِلَى، عَلَى / بِـ، لِـ، كَـ، عَنْ | `H.JARR.1` / `H.JARR.2`, with `R.MAJRUR` on the noun; any other preposition is drip vocabulary plus `R.MAJRUR` |
| Pronoun suffix on a verb / a noun / a preposition | `P.ATT.OBJ` / `P.ATT.POSS` / `P.ATT.PREP` |
| Nominative / accusative / genitive | case only; the job needs the heuristic above and human review |
| Plural or dual number on a noun | the corpus marks number, not sound versus broken: read the surface ending (ـُونَ، ـِينَ، ـَات، ـَانِ، ـَيْنِ) to choose `N.PL.SOUND_M`, `N.PL.SOUND_F`, `N.DUAL` or `N.PL.BROKEN` [VERIFY] |
| Demonstrative / relative pronoun | `X.ISHARA` / `X.MAWSUL` |
| Active participle, passive participle, verbal noun | `stemRequires` only (Phase 7 patterns) |

**T5 · Coverage curve.** Given the concept order in §5, compute coverage (§7) of الفاتحة, Juz 'Amma and the whole Quran after each session. Output a table and a chart. If swapping two sessions raises early coverage without breaking prerequisites, propose the swap; do not apply it silently.

**T6 · Fragment miner.** For each session k, list contiguous spans of 2 to 8 words inside one ayah whose `requires` are all learned by session k. Rank by: has a `familiar` value, short length, high lemma frequency, no author glosses. Output candidates for human curation. The miner proposes; a human approves (`meaningSafe`, `approvedBy`). It must never cut a span immediately before an exception, a condition or a continuation that reverses the meaning (Appendix A, item 15).

---

## 11. Session 1, fully worked: "The verb is a sentence"

This is the vertical slice to build first (§12, M3). It shows how a session is authored under the model.

### 11.1 Outcomes

By the end the learner can:

1. Recognise a past-tense verb and know that it is a complete sentence meaning "he did".
2. Find the doer: the naming-word after the verb, ending in damma.
3. Tell "a" (tanwin) from "the" (ال), and know they never share a word.
4. Peel وَ or فَ off the front of a word.
5. Parse four real Quranic fragments without help.

Four new ideas, no more. The مضارع, the done-to, prepositions and the place-noun from the original sketch move to S2, S4, S5 and S5.

### 11.2 Flow

| Loop step | Minutes (live class) | Content |
|-----------|----------------------|---------|
| Retrieve | 0 | Nothing yet. Replace with a two-minute orientation: three kinds of word exist; today we meet all three by pointing, not by definition. |
| Ladder 1 | 8 | The verb is a whole sentence |
| Ladder 2 | 10 | Who did it? |
| Ladder 3 | 8 | "A" versus "the" |
| Ladder 4 | 4 | Glue |
| Find it | 5 | Tap verb and doer in four real fragments |
| Unlock | 10 | Four fragments parsed in full with the three-question routine |
| Seed | 4 | One root, many words |
| Exit check | 5 | Five unseen items |

In the app this becomes four or five short units. [DECIDE: unit length; default 8 to 12 minutes.]

### 11.3 Lesson data

```json
{
  "session": {
    "id": 1,
    "phase": 1,
    "title": "The verb is a sentence",
    "integration": false,
    "newConcepts": ["V.PAST.3MS", "R.FAIL", "D.DEFINITENESS", "H.CONJ"],
    "labelsIntroduced": ["K.FIL", "K.ISM", "K.HARF"],
    "seeds": ["Z.ROOT", "Z.PATTERN.MAFUL"],
    "sightVerbs": ["جَاءَ"],
    "dripWords": ["وَ", "فَ"],
    "ladder": [
      {
        "step": 1,
        "introduces": "V.PAST.3MS",
        "items": [
          { "ar": "سَجَدَ", "en": "He prostrated.", "source": "constructed" },
          { "ar": "رَكَعَ", "en": "He bowed.", "source": "constructed", "diffFromPrev": "different verb, same shape" },
          { "ar": "خَلَقَ", "en": "He created.", "source": "constructed", "diffFromPrev": "different verb, same shape" },
          { "ar": "صَدَقَ", "en": "He spoke the truth.", "source": "constructed", "diffFromPrev": "different verb, same shape" },
          { "ar": "كَتَبَ", "en": "He wrote.", "source": "constructed", "diffFromPrev": "different verb, same shape" }
        ],
        "noticePrompt": "Each one-word line is a complete sentence. What do the five words have in common?",
        "nameReveal": {
          "arTerm": "فِعْل مَاضٍ",
          "handle": "past verb: 'he did'",
          "rule": "Three letters, with a fatha on the last one. The 'he' is already inside the verb, so the verb alone is a full sentence."
        },
        "watchOut": "English speakers read سَجَدَ as 'to prostrate'. It never means that. The middle vowel varies (شَهِدَ، سَمِعَ); only the final fatha is the signal."
      },
      {
        "step": 2,
        "introduces": "R.FAIL",
        "items": [
          { "ar": "سَجَدَ مُسْلِمٌ", "en": "A Muslim prostrated.", "source": "constructed", "diffFromPrev": "a doer is named after the verb" },
          { "ar": "رَكَعَ مُسْلِمٌ", "en": "A Muslim bowed.", "source": "constructed", "diffFromPrev": "verb changed" },
          { "ar": "سَجَدَ مُؤْمِنٌ", "en": "A believer prostrated.", "source": "constructed", "diffFromPrev": "doer changed" },
          { "ar": "صَدَقَ رَجُلٌ", "en": "A man spoke the truth.", "source": "constructed", "diffFromPrev": "verb and doer changed" }
        ],
        "noticePrompt": "A new word follows the verb. Where does it sit, and what mark does it end with every time?",
        "nameReveal": {
          "arTerm": "فَاعِل",
          "handle": "doer",
          "rule": "The doer is a naming-word that follows the verb and ends in damma. Kind and job are different things: مُسْلِم is an اِسْم by kind; its job here is فَاعِل."
        },
        "watchOut": "English puts the doer first; the Arabic verbal sentence puts the verb first. The named doer replaces the hidden 'he'. It does not add a second one."
      },
      {
        "step": 3,
        "introduces": "D.DEFINITENESS",
        "items": [
          { "ar": "سَجَدَ مُسْلِمٌ", "en": "A Muslim prostrated.", "source": "constructed" },
          { "ar": "سَجَدَ الْمُسْلِمُ", "en": "The Muslim prostrated.", "source": "constructed", "diffFromPrev": "ال added, tanwin removed" },
          { "ar": "رَكَعَ الْمُؤْمِنُ", "en": "The believer bowed.", "source": "constructed", "diffFromPrev": "verb and doer changed" },
          { "ar": "صَدَقَ الرَّجُلُ", "en": "The man spoke the truth.", "source": "constructed", "diffFromPrev": "sun letter after ال" }
        ],
        "noticePrompt": "What arrived at the front of the doer, and what left from its end?",
        "nameReveal": {
          "arTerm": "نَكِرَة / مَعْرِفَة",
          "handle": "'a' versus 'the'",
          "rule": "Tanwin marks 'a'. ال marks 'the'. They never appear on the same word, so ال leaves a single damma."
        },
        "watchOut": "In الرَّجُلُ the lam is silent and the ر is doubled: the sun-letter rule from tajweed. اللَّهُ carries ال, so it has a single damma. Proper names bend this rule later (Appendix A, item 1)."
      },
      {
        "step": 4,
        "introduces": "H.CONJ",
        "items": [
          { "ar": "وَسَجَدَ الْمُسْلِمُ", "en": "And the Muslim prostrated.", "source": "constructed", "diffFromPrev": "وَ attached to the verb" },
          { "ar": "فَسَجَدَ الْمُسْلِمُ", "en": "So the Muslim prostrated.", "source": "constructed", "diffFromPrev": "فَ instead of وَ" }
        ],
        "noticePrompt": "One letter was added to the front of the verb. Is it part of the verb?",
        "nameReveal": {
          "arTerm": "حَرْف عَطْف",
          "handle": "glue",
          "rule": "وَ means 'and'; فَ means 'so' or 'then'. One-letter words are written attached to the next word. A حَرْف is the third kind of word: neither doing-word nor naming-word."
        },
        "watchOut": "Most verbal sentences in the Quran open with a particle like these. Peel it off first, then read the verb."
      }
    ],
    "findIt": ["q.58.21.a", "q.3.18.a", "q.2.7.a", "q.29.44.a"],
    "unlockTargets": ["q.3.95.a", "q.15.30.a", "q.17.81.a", "q.28.20.a"],
    "rootFamilies": [
      {
        "root": "س ج د",
        "family": [
          { "ar": "سَجَدَ", "en": "he prostrated" },
          { "ar": "سُجُود", "en": "prostration, the act" },
          { "ar": "مَسْجِد", "en": "place of prostration, mosque" },
          { "ar": "سَاجِد", "en": "one who prostrates" },
          { "ar": "سَجْدَة", "en": "a single prostration" }
        ]
      },
      {
        "root": "ك ت ب",
        "family": [
          { "ar": "كَتَبَ", "en": "he wrote" },
          { "ar": "كِتَاب", "en": "book" },
          { "ar": "كَاتِب", "en": "writer" },
          { "ar": "مَكْتُوب", "en": "written" }
        ]
      }
    ],
    "exitCheck": [
      {
        "type": "E1",
        "concepts": ["R.FAIL", "V.PAST.3MS"],
        "fragmentId": "q.30.41.a",
        "prompt": "Tap the doer.",
        "answer": 1
      },
      {
        "type": "E6",
        "concepts": ["D.DEFINITENESS", "R.FAIL"],
        "fragmentId": "q.70.1.a",
        "prompt": "Is the doer 'a' or 'the'?",
        "options": ["a", "the"],
        "answer": 0
      },
      {
        "type": "E4",
        "concepts": ["H.CONJ", "V.PAST.3MS"],
        "fragmentId": "q.12.26.a",
        "prompt": "Split the first word into its parts.",
        "answer": "وَ|شَهِدَ"
      },
      {
        "type": "E2",
        "concepts": ["H.CONJ", "V.PAST.3MS", "R.FAIL", "D.DEFINITENESS"],
        "ladderItem": { "ar": "فَصَدَقَ الرَّجُلُ", "en": "So the man spoke the truth.", "source": "constructed" },
        "prompt": "Choose the meaning.",
        "options": [
          "So the man spoke the truth.",
          "So a man spoke the truth.",
          "And the man spoke the truth.",
          "The man spoke the truth."
        ],
        "answer": 0
      },
      {
        "type": "E8",
        "concepts": ["H.CONJ", "V.PAST.3MS", "R.FAIL", "D.DEFINITENESS"],
        "fragmentId": "q.7.118.a",
        "prompt": "Parse each word: what kind, what its shape says, what its ending says.",
        "answer": "from fragment tokens"
      }
    ]
  },
  "fragments": [
    {
      "id": "q.3.95.a",
      "source": "quran",
      "ref": { "surah": 3, "ayah": 95 },
      "checkString": "صَدَقَ اللَّهُ",
      "meaning": "Allah has spoken the truth.",
      "meaningSafe": true,
      "approvedBy": null,
      "familiar": "widely_heard",
      "tokens": [
        {
          "surface": "صَدَقَ",
          "segments": [
            { "text": "صَدَقَ", "kind": "stem", "concept": "V.PAST.3MS", "gloss": "he spoke the truth" }
          ],
          "wordKind": "fil",
          "root": "ص د ق",
          "verbForm": 1,
          "requires": ["V.PAST.3MS"],
          "stemRequires": [],
          "gloss": "spoke the truth"
        },
        {
          "surface": "اللَّهُ",
          "segments": [
            { "text": "اللَّه", "kind": "stem", "gloss": "Allah" },
            { "text": "ـُ", "kind": "ending", "concept": "R.FAIL" }
          ],
          "wordKind": "ism",
          "role": "R.FAIL",
          "state": "raf",
          "requires": ["R.FAIL", "D.DEFINITENESS"],
          "stemRequires": [],
          "gloss": "Allah"
        }
      ]
    },
    {
      "id": "q.15.30.a",
      "source": "quran",
      "ref": { "surah": 15, "ayah": 30 },
      "checkString": "فَسَجَدَ الْمَلَائِكَةُ",
      "meaning": "So the angels prostrated.",
      "meaningSafe": true,
      "approvedBy": null,
      "note": "Seed for S8: the doer is plural but the verb stayed singular. Do not explain yet. If asked: 'a verb that comes first stays singular; we return to this.'",
      "tokens": [
        {
          "surface": "فَسَجَدَ",
          "segments": [
            { "text": "فَ", "kind": "prefix", "concept": "H.CONJ", "gloss": "so" },
            { "text": "سَجَدَ", "kind": "stem", "concept": "V.PAST.3MS", "gloss": "he prostrated" }
          ],
          "wordKind": "fil",
          "root": "س ج د",
          "verbForm": 1,
          "requires": ["H.CONJ", "V.PAST.3MS"],
          "stemRequires": [],
          "gloss": "so ... prostrated"
        },
        {
          "surface": "الْمَلَائِكَةُ",
          "segments": [
            { "text": "الْ", "kind": "prefix", "concept": "D.DEFINITENESS", "gloss": "the" },
            { "text": "مَلَائِكَة", "kind": "stem", "gloss": "angels" },
            { "text": "ـُ", "kind": "ending", "concept": "R.FAIL" }
          ],
          "wordKind": "ism",
          "role": "R.FAIL",
          "state": "raf",
          "lemma": "مَلَك",
          "requires": ["R.FAIL", "D.DEFINITENESS"],
          "stemRequires": ["N.PL.BROKEN", "X.VERB_FIRST_SINGULAR"],
          "gloss": "the angels"
        }
      ]
    },
    {
      "id": "q.17.81.a",
      "source": "quran",
      "ref": { "surah": 17, "ayah": 81 },
      "checkString": "جَاءَ الْحَقُّ وَزَهَقَ الْبَاطِلُ",
      "meaning": "The truth has come, and falsehood has vanished.",
      "meaningSafe": true,
      "approvedBy": null,
      "note": "جَاءَ is the first sight verb. This ayah returns in S22, where its ending is unlocked and الْبَاطِل appears with a different ending and a different job.",
      "tokens": [
        {
          "surface": "جَاءَ",
          "segments": [
            { "text": "جَاءَ", "kind": "stem", "concept": "V.PAST.3MS", "gloss": "he came" }
          ],
          "wordKind": "fil",
          "root": "ج ي ء",
          "verbForm": 1,
          "requires": ["V.PAST.3MS"],
          "stemRequires": ["V.WEAK.HOLLOW"],
          "gloss": "came"
        },
        {
          "surface": "الْحَقُّ",
          "segments": [
            { "text": "الْ", "kind": "prefix", "concept": "D.DEFINITENESS", "gloss": "the" },
            { "text": "حَقّ", "kind": "stem", "gloss": "truth" },
            { "text": "ـُ", "kind": "ending", "concept": "R.FAIL" }
          ],
          "wordKind": "ism",
          "role": "R.FAIL",
          "state": "raf",
          "requires": ["R.FAIL", "D.DEFINITENESS"],
          "stemRequires": [],
          "gloss": "the truth"
        },
        {
          "surface": "وَزَهَقَ",
          "segments": [
            { "text": "وَ", "kind": "prefix", "concept": "H.CONJ", "gloss": "and" },
            { "text": "زَهَقَ", "kind": "stem", "concept": "V.PAST.3MS", "gloss": "it vanished" }
          ],
          "wordKind": "fil",
          "root": "ز ه ق",
          "verbForm": 1,
          "requires": ["H.CONJ", "V.PAST.3MS"],
          "stemRequires": [],
          "gloss": "and ... vanished"
        },
        {
          "surface": "الْبَاطِلُ",
          "segments": [
            { "text": "الْ", "kind": "prefix", "concept": "D.DEFINITENESS", "gloss": "the" },
            { "text": "بَاطِل", "kind": "stem", "gloss": "falsehood" },
            { "text": "ـُ", "kind": "ending", "concept": "R.FAIL" }
          ],
          "wordKind": "ism",
          "role": "R.FAIL",
          "state": "raf",
          "requires": ["R.FAIL", "D.DEFINITENESS"],
          "stemRequires": [],
          "gloss": "falsehood"
        }
      ]
    },
    {
      "id": "q.28.20.a",
      "source": "quran",
      "ref": { "surah": 28, "ayah": 20 },
      "checkString": "وَجَاءَ رَجُلٌ",
      "meaning": "And a man came.",
      "meaningSafe": true,
      "approvedBy": null,
      "note": "A real indefinite doer with tanwin: the constructed line صَدَقَ رَجُلٌ lands on real text.",
      "tokens": [
        {
          "surface": "وَجَاءَ",
          "segments": [
            { "text": "وَ", "kind": "prefix", "concept": "H.CONJ", "gloss": "and" },
            { "text": "جَاءَ", "kind": "stem", "concept": "V.PAST.3MS", "gloss": "he came" }
          ],
          "wordKind": "fil",
          "root": "ج ي ء",
          "verbForm": 1,
          "requires": ["H.CONJ", "V.PAST.3MS"],
          "stemRequires": ["V.WEAK.HOLLOW"],
          "gloss": "and ... came"
        },
        {
          "surface": "رَجُلٌ",
          "segments": [
            { "text": "رَجُل", "kind": "stem", "gloss": "man" },
            { "text": "ـٌ", "kind": "ending", "concept": "R.FAIL" }
          ],
          "wordKind": "ism",
          "role": "R.FAIL",
          "state": "raf",
          "requires": ["R.FAIL", "D.DEFINITENESS"],
          "stemRequires": [],
          "gloss": "a man"
        }
      ]
    },
    { "id": "q.58.21.a", "source": "quran", "ref": { "surah": 58, "ayah": 21 }, "checkString": "كَتَبَ اللَّهُ", "meaning": "Allah has decreed.", "meaningSafe": true, "approvedBy": null, "tokens": [] },
    { "id": "q.3.18.a", "source": "quran", "ref": { "surah": 3, "ayah": 18 }, "checkString": "شَهِدَ اللَّهُ", "meaning": "Allah bears witness.", "meaningSafe": true, "approvedBy": null, "tokens": [] },
    { "id": "q.2.7.a", "source": "quran", "ref": { "surah": 2, "ayah": 7 }, "checkString": "خَتَمَ اللَّهُ", "meaning": "Allah has set a seal.", "meaningSafe": true, "approvedBy": null, "tokens": [] },
    { "id": "q.29.44.a", "source": "quran", "ref": { "surah": 29, "ayah": 44 }, "checkString": "خَلَقَ اللَّهُ", "meaning": "Allah created.", "meaningSafe": true, "approvedBy": null, "tokens": [] },
    { "id": "q.30.41.a", "source": "quran", "ref": { "surah": 30, "ayah": 41 }, "checkString": "ظَهَرَ الْفَسَادُ", "meaning": "Corruption has appeared.", "meaningSafe": true, "approvedBy": null, "tokens": [] },
    { "id": "q.70.1.a", "source": "quran", "ref": { "surah": 70, "ayah": 1 }, "checkString": "سَأَلَ سَائِلٌ", "meaning": "A questioner asked.", "meaningSafe": true, "approvedBy": null, "tokens": [] },
    { "id": "q.12.26.a", "source": "quran", "ref": { "surah": 12, "ayah": 26 }, "checkString": "وَشَهِدَ شَاهِدٌ", "meaning": "And a witness testified.", "meaningSafe": true, "approvedBy": null, "tokens": [] },
    { "id": "q.7.118.a", "source": "quran", "ref": { "surah": 7, "ayah": 118 }, "checkString": "فَوَقَعَ الْحَقُّ", "meaning": "So the truth was established.", "meaningSafe": true, "approvedBy": null, "tokens": [] }
  ]
}
```

Notes on this data:

- Fragments with `"tokens": []` get their tokens from task T4. The four unlock targets are tagged by hand above so the engine has a reference for what T4 must produce.
- `approvedBy` is `null` everywhere. Nothing unlocks for learners until a human sets it (§7).
- `meaningSafe: true` is the author's proposal only. The reviewer confirms or overturns it when setting `approvedBy`.
- `meaning` strings are team-authored and literal. They are placeholders for review, not final translations.
- سَأَلَ سَائِلٌ and وَشَهِدَ شَاهِدٌ quietly re-seed `Z.PATTERN.FAIL`: the doer is "the one who did" the very verb before it.

### 11.4 What S2 and S3 add (so the rhythm is visible)

- **S2** takes line سَجَدَ الْمُسْلِمُ and changes only the verb: يَسْجُدُ الْمُسْلِمُ. Then رَكَعَ / يَرْكَعُ, كَتَبَ / يَكْتُبُ. Then the first sight pair قَالَ / يَقُولُ, landing on وَيَقُولُ الْكَافِرُ (78:40).
- **S3** changes only the doer's gender and watches the verb follow: سَجَدَ الْمُؤْمِنُ → سَجَدَتِ الْمُؤْمِنَةُ, landing on قَالَتْ نَمْلَةٌ (27:18).

---

## 12. Build order and acceptance criteria

| Milestone | Deliverable | Done when |
|-----------|-------------|-----------|
| **M0 Recon** | A short report: current models for lessons, content, progress, Quran text and review; proposed mapping of §6 onto them; risks | Kareem has read it and answered the [DECIDE] items that block M1 |
| **M1 Data layer** | Corpus ingest (T1), text alignment and fragment verification test (T2), concept registry loaded from §5, token auto-tagging (T4) | The T2 test runs over every fragment in §4 and §11 and produces a pass/fail list; registry IDs referenced anywhere resolve |
| **M2 Frequency report** | T3 a–f and the coverage curve T5, as a readable report | Kareem has reviewed it and locked sequence v1 (changes to §4 recorded in this file) |
| **M3 Session 1 vertical slice** | Lesson engine that renders §11.3 end to end | See the checklist below |
| **M4 Review engine** | Spaced retrieval and interleaving (§9) | A learner who misses an exit item sees its concepts again at the next session opening |
| **M5 Coverage and curation** | Coverage dashboard (§7), fragment miner (T6), a simple curation view to set `meaningSafe` and `approvedBy` | A fragment cannot reach a learner without approval |
| **M6 Author and pilot Phases 1–2** | S2 to S7 authored in the §11.3 format; pilot with 5 to 10 adult learners | Pilot notes fed back into this file before any Phase 3 authoring |

**M3 acceptance checklist**

- Ladder lines render right to left with full vowels, and only the changed segment is highlighted.
- The name and rule are hidden until the notice prompt has been answered or skipped.
- Constructed sentences and Quranic text look different at a glance. Quranic text is pulled by reference from the verified source, never from lesson JSON.
- Words can be tapped whole; فَسَجَدَ can also be shown split into its segments.
- The unlock view shows the reference, the meaning, the three-question parse for each word, and a "you already know this phrase" tag when `familiar` is set.
- The exit check has five items, records results per concept, and feeds misses to the review queue.
- Final vowels are always shown. There is no waqf rendering in parsing mode.
- Vowel marks are clearly legible on a phone: large Arabic type, generous line height, a font that places marks cleanly, and a size control.
- No transliteration appears.
- Every answered item is logged with its concept IDs, correctness and response time (§9).
- An attribution screen credits the text and corpus sources as their licenses require (§15).

---

## 13. Open decisions and items to verify

**[DECIDE]** (defaults in brackets)

1. Delivery: app only, or teacher-led with the app as companion? [Design for both; S1 timings assume a live class, units assume the app.]
2. Unit length in the app. [8 to 12 minutes]
3. Term display: plain handle first or Arabic term first? [Handle first through S7, Arabic term first afterwards.]
4. Source of English meanings. [Team-authored literal meanings; see §15 on translation copyright.]
5. "Learned" threshold. [4 of 5 on the exit check plus one successful spaced review.]
6. Scheduler. [Reuse the app's; otherwise five-box Leitner.]
7. Script: Uthmani for Quranic text and standard spelling for constructed sentences? [Yes; it also helps P11's visual distinction.]
8. Are liturgical, non-Quranic phrases in scope as unlock targets? [Yes, marked `liturgy`.]
9. License implications of bundling GPL-licensed corpus data for the app's own license. [Get proper advice; this file is not legal advice.]
10. Who approves fragments and grammar analyses? [A named reviewer qualified in nahw.]
11. Audio in parsing mode. Word-by-word recitation audio pauses on every word, and reciters pause at the end of most ayat, so most available audio hides the endings this track teaches (P8). Quranic audio is never synthesised (P11). [No audio in parsing mode in v1; a human recording of constructed sentences and wasl readings can come later.]
12. Interface language. [English only in v1.]
13. Can learners with prior grammar test out of early sessions? [Yes: offer each session's exit check as a placement test; passing marks its concepts "learned" subject to the first spaced review.]

**[VERIFY]**

1. Every Quranic reference and fragment string in §4 and §11 (machine check T2, then human review of failures).
2. All frequency-based ordering: sight verbs, pattern-track verbs, persons, verb forms, drip words (T3).
3. The claim that most Quranic verbs have a suffix or hidden doer rather than a noun doer (T3e).
4. The description of the corpus file format (T1).
5. Every grammar simplification in Appendix A, by the reviewer in [DECIDE] 10.
6. That each "complete surah" milestone in §4.3 really has no unexplained visible ending at that point.
7. The journal citations in §14, which were written from recall: check them before citing them anywhere public.
8. How much of the text the corpus site's syntactic treebank covers, and whether it can be downloaded under the same terms (T3e, T4).

---

## 14. Rationale and evidence (so the constraints are not optimised away)

Graded honestly. Almost none of this evidence comes from Arabic, let alone Quranic Arabic. Citation details were written from recall ([VERIFY] 7).

**Well supported in general second-language research**

- Explicit grammar instruction outperforms implicit instruction for adult learners: Norris & Ortega, *Language Learning* 2000;50:417–528; Spada & Tomita, *Language Learning* 2010;60:263–308. The usual caveat (tests favour explicit knowledge) matters less here, because explicit parsing knowledge is this track's actual goal. Supports P3 and the whole track.
- Spaced retrieval beats massed study: Cepeda et al., *Psychological Bulletin* 2006;132:354–380; Roediger & Karpicke, *Psychological Science* 2006;17:249–255. Supports P9.
- Interleaved grammar practice improves retention over blocked practice: Nakata & Suzuki, *Modern Language Journal* 2019;103:629–647. Supports P9.
- Unassisted reading needs roughly 95 to 98% known words: Hu & Nation, *Reading in a Foreign Language* 2000;13:403–430. Supports P6 and the frequency drip. Popular claims such as "300 words cover 70% of the Quran" are directionally right (word frequency is heavily skewed) but are unaudited counts.

**Extrapolated**

- Learners default to reading the first noun as the doer (VanPatten & Cadierno, *Studies in Second Language Acquisition* 1993;15:225–243, and later processing-instruction work). This is exactly the error that case endings prevent, and it motivates exercise E2. No trials on Arabic case marking are known to the author of this file.
- Limiting new elements per step follows cognitive load theory, whose evidence is mostly from mathematics and science learning. The cap of four per session (P2) is a judgment call.

**Classical warrant**

- Al-Zamakhshari, *al-Mufassal*, on the faces of i'rab: رفع is the mark of doer-hood, with the مبتدأ and خبر attached to the doer by analogy; نصب is the mark of the object-roles. Ibn Ya'ish's commentary adds the reason endings exist at all: if order alone marked doer and object, the language would lose its freedom to front and delay. This supports the verb-first spine, `C.THREE_STATES`, `R.NASB_DETAIL` and `P.ENDINGS_NOT_ORDER`.

**Unknown**

- No controlled comparison of Quranic Arabic curricula is known (Madinah books, Bayyinah, Understand Quran, the classical Ajurrumiyyah path). Verb-first versus noun-first sequencing is untested. The pilot in M6 is therefore not optional: collect exit-check accuracy per concept, time per unit, and drop-off per session, and let those numbers revise §4.

---

## 15. Data sources and licenses

Checked on 2026-09-19. Re-read the actual license headers before shipping. This is not legal advice.

- **Quranic Arabic Corpus, morphology v0.4** (Kais Dukes, University of Leeds; corpus.quran.com/download, which asks for an email address). GNU General Public License, with terms of use in the file header: verbatim copies may be distributed but the file may not be changed; it may be used in any website or application if the source is clearly credited with a link to corpus.quran.com; the notice must travel with copies and be reproduced in derived works. It is built on the Tanzil text. About 77,430 words. Consequence for this project: keep the file verbatim, layer our annotations in separate files keyed by location, credit and link in the app.
- **Tanzil Quran text** (tanzil.net). Creative Commons Attribution 3.0 with added terms: verbatim copies only, no changes to the text; usable in any website or application with clear credit and a link to tanzil.net; the notice must be kept. If the IQRA app already ships a verified text, keep using it and align to it (T2).
- **Community fork** github.com/mustafa0x/quran-morphology: Arabic-script output with root and lemma fixes, but its README says most person, gender and number tags on verbs were removed. This track depends on those tags, so do not use the fork as the primary source. It may help as a cross-check for roots and lemmas. [VERIFY]
- **English translations.** Most well-known translations are under copyright, and some open datasets carry no-derivatives or non-commercial terms. Default: write our own short literal meanings per fragment ([DECIDE] 4).

---

## Appendix A. Authoring cautions: simplifications and where they break

Each early rule is a deliberate simplification. Authors must know where it breaks so no unlock target contradicts what the learner has been told.

1. **"Tanwin means 'a'"** holds for common nouns. Proper names break it both ways: مُحَمَّدٌ is definite yet carries tanwin; إِبْرَاهِيمُ، دَاوُودُ، سُلَيْمَانُ، فِرْعَوْنُ never take tanwin. First note at S4. Avoid name doers in S1 to S3.
2. **Diptotes** (ممنوع من الصرف) take no tanwin and show fatha where kasra is expected: أَبَابِيلَ، مَسَاجِدَ، أَكْبَرُ، مِنْ إِبْرَاهِيمَ. Note at S4, S7 (أَكْبَرُ) and S16; full treatment in Phase 9.
3. **"The doer ends in damma"** becomes و for sound masculine plurals (S8), ا for duals (S16), and is hidden on words ending in long ā (S17). The five nouns (أَبُوكَ) wait for Phase 9.
4. **"The done-to ends in fatha"** becomes ـِينَ for sound masculine plurals (S8) and kasra for ـَات plurals (S16). Do not unlock الصَّالِحَاتِ or السَّمَاوَاتِ as objects before S16.
5. **Verb vowels are lexical.** The middle vowel of the past (فَعَلَ، فَعِلَ، فَعُلَ) and the stem vowel of the present are learned per verb as a pair. The six abwab are not taught in Level 1. A present prefix with damma (يُفْلِحُ) signals a derived form: gloss the stem, and avoid such verbs in S2.
6. **تَـ is ambiguous**: "she" or "you (m. sg.)". Context decides. Say so at S10.
7. **ـنَا is ambiguous**: "we" as doer (خَلَقْنَا, sukun before it) or "us" as done-to (خَلَقَنَا, fatha before it). Teach with a constructed pair at S11.
8. **Helping vowels are sound, not grammar**: قَالَتِ الْـ، نَصَرَكُمُ اللَّهُ، مِنَ السَّمَاءِ، عَلَيْهِمُ الْـ. Flag them in token data so the engine never reads them as endings.
9. **ـهُ and ـهُمْ become ـهِ and ـهِمْ** after a kasra or ي (بِهِ، عَلَيْهِمْ، قُلُوبِهِمْ). Sound, not grammar.
10. **Spelling**: لِـ + ال gives لِلْـ (لِلَّهِ); the basmala drops the alif of اسم; the alif after ـُوا is silent; tanwin fath is written with an alif (مَثَلًا), except after ة and after ـَاء (رَحْمَةً، مَاءً).
11. **Waqf habits.** Learners will say ayah-final words without their endings and read tanwin fath as ā. Parsing mode always shows and reads wasl forms (P8).
12. **ال is not always English "the".** الْإِنسَانَ in 96:2 is mankind in general.
13. **A past form does not always mean past time.** After إِذَا, and in scenes of the Last Day (وَخَسَفَ الْقَمَرُ, 75:8), it points forward. Level 1 flags this with the إِذَا note at S3. Keep S1 and S2 targets to true past narrative.
14. **Verb-first agreement is loose in gender too** when the doer is a broken plural: فَسَجَدَ الْمَلَائِكَةُ (15:30) but إِذْ قَالَتِ الْمَلَائِكَةُ (3:45). Note it at S16; do not build a rule on it.
15. **Meaning-unsafe truncation.** Never cut a fragment just before an exception, a condition or a continuation that reverses or distorts the meaning. Classic cases: 107:4 without 107:5; 51:56 without its إِلَّا clause; any مَا … إِلَّا or لَا … إِلَّا structure; 4:43 cut after "do not approach prayer". Every fragment needs human approval (P11).
16. **Second منصوب after a verb**: it may be a second done-to (جَعَلْنَا اللَّيْلَ لِبَاسًا) or a detail such as حال (خَلَقْنَاكُمْ أَزْوَاجًا). When in doubt in Level 1, label it `R.NASB_DETAIL` and let Phase 9 name it.
17. **Dropped ي with kasra left behind** (لِيَعْبُدُونِ، وَلِيَ دِينِ، فَارْهَبُونِ): the visible ending looks like something else. Flag such fragments as advanced and explain the dropped ي explicitly.
18. **فَاعِل names two things**: a job (`R.FAIL`) and a word pattern (`Z.PATTERN.FAIL`). Never show the bare term without saying which.
19. **One analysis among several.** Where classical grammarians differ (for example 55:1–2 as one sentence, or the role of رَبِّ in 1:2 as adjective or substitute), show one mainstream analysis and mark the token `note` with "other analyses exist". Do not present a contested parse as the only one.
20. **Damma is a doer mark on nouns only.** From S2 the learner meets يَسْجُدُ, where the damma belongs to the present verb and says nothing about a doer. Restate the S1 rule at S2 as "on a *naming-word* after the verb, damma marks the doer". The verb's own endings are named at S25 and S26.
21. **الَّذِينَ is not a ـِينَ plural.** It looks like the نصب and جر form of a sound masculine plural, but it never changes shape, whatever its job: in وَقَالَ الَّذِينَ كَفَرُوا (14:13) it is the doer. Introduce it at S8 as a fixed word with exactly this warning, use it only in find-it steps until S17, and tag it `K.MABNI` + `X.MAWSUL`.
22. **Same-looking مَا.** "Not" (S2), "what" (S10, S17), and later the مَا of questions and of إِنَّمَا. Every مَا token carries its own gloss and concept; the engine must never assume one meaning.

