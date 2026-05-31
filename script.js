/* Être & Avoir — present-tense fill-in-the-blank game.
   Depends on EXAMPLES (data.js). Vanilla JS, no build step. */

(function () {
  "use strict";

  // Present-tense conjugation pools — used to build plausible multiple-choice distractors.
  const FORMS = {
    "être": ["suis", "es", "est", "sommes", "êtes", "sont"],
    "avoir": ["ai", "as", "a", "avons", "avez", "ont"]
  };

  const STORAGE_KEY = "etreavoir.progress.v1";

  const HAS_SPEECH = typeof window !== "undefined" && "speechSynthesis" in window;

  const GLOSS = typeof GLOSSARY !== "undefined" ? GLOSSARY : {};

  // Circled-number badges for numbering multiple blanks.
  const BADGES = ["①", "②", "③", "④"];

  // ---- per-item helpers (support both single- and multi-blank shapes) ----
  function blanksOf(item) {
    return item.blanks || [{ verb: item.verb, answer: item.answer }];
  }
  function isMulti(item) {
    return !!(item.blanks && item.blanks.length > 1);
  }
  function verbsOf(item) {
    const s = new Set();
    blanksOf(item).forEach(function (b) { s.add(b.verb); });
    return s;
  }
  function chipLabel(item) {
    const blanks = blanksOf(item);
    if (blanks.length === 1) return blanks[0].verb;
    const verbs = verbsOf(item);
    if (verbs.size === 1) return blanks[0].verb + " ×" + blanks.length;
    return "être + avoir";
  }

  // ---- DOM refs ----
  const el = {
    scoreNum: byId("scoreNum"),
    accuracyNum: byId("accuracyNum"),
    streakNum: byId("streakNum"),
    progressNum: byId("progressNum"),
    filters: byId("filters"),
    quizView: byId("quizView"),
    summaryView: byId("summaryView"),
    verbChip: byId("verbChip"),
    modeChip: byId("modeChip"),
    promptText: byId("promptText"),
    wordPopover: byId("wordPopover"),
    listenBtn: byId("listenBtn"),
    translationToggle: byId("translationToggle"),
    translationText: byId("translationText"),
    answerArea: byId("answerArea"),
    feedback: byId("feedback"),
    feedbackHeadline: byId("feedbackHeadline"),
    explanationText: byId("explanationText"),
    skipBtn: byId("skipBtn"),
    nextBtn: byId("nextBtn"),
    summaryScore: byId("summaryScore"),
    summaryHint: byId("summaryHint"),
    playAgainBtn: byId("playAgainBtn"),
    resetBtn: byId("resetBtn")
  };

  // ---- Game state ----
  const state = {
    filter: "all",
    deck: [],        // shuffled list of example objects for this run
    index: 0,        // current position in deck
    answered: false, // has the current question been answered?
    score: 0,
    attempts: 0,
    streak: 0,
    bestStreak: 0
  };

  // ---------------------------------------------------------------- helpers
  function byId(id) { return document.getElementById(id); }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Lowercase, trim, and strip accents so "etes" matches "êtes" on a phone keyboard.
  function normalize(str) {
    return str
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[''`]/g, "'");
  }

  // Glossary lookup key for a displayed word (also strips edge apostrophes).
  function wordKey(token) {
    return normalize(token).replace(/^'+|'+$/g, "");
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ---------------------------------------------------------------- speech (TTS)
  // Natural-sounding French voices to prefer (by substring, case-insensitive).
  const PREFERRED_FR_VOICES = [
    "google français", "google francais",       // Android Chrome
    "thomas", "amélie", "amelie", "audrey",      // Apple enhanced
    "aurélie", "aurelie", "marie", "virginie",
    "microsoft"                                  // Windows
  ];
  // Apple's joke/novelty voices that sound robotic or silly — avoid these.
  const NOVELTY_VOICES = [
    "eddy", "flo", "grandma", "grandpa", "reed", "rocko", "sandy", "shelley",
    "bad news", "good news", "bubbles", "bells", "boing", "jester", "organ",
    "superstar", "trinoids", "whisper", "wobble", "zarvox", "cellos", "bahh"
  ];

  function frenchVoice() {
    const voices = window.speechSynthesis.getVoices() || [];
    const fr = voices.filter(function (v) { return /^fr([-_]|$)/i.test(v.lang); });
    if (!fr.length) return null;
    // Prefer France French over other regions (Canada, etc.).
    const frFR = fr.filter(function (v) { return /^fr[-_]fr/i.test(v.lang); });
    const pool = frFR.length ? frFR : fr;
    const name = function (v) { return v.name.toLowerCase(); };

    // 1. A known good voice by name.
    for (var i = 0; i < PREFERRED_FR_VOICES.length; i++) {
      var want = PREFERRED_FR_VOICES[i];
      var hit = pool.find(function (v) { return name(v).indexOf(want) !== -1; });
      if (hit) return hit;
    }
    // 2. Any voice that isn't a known novelty voice.
    var normal = pool.find(function (v) {
      return !NOVELTY_VOICES.some(function (n) { return name(v).indexOf(n) !== -1; });
    });
    if (normal) return normal;
    // 3. Fall back to the default / first available.
    return pool.find(function (v) { return v.default; }) || pool[0];
  }

  // Reads the full sentence (with every blank filled in) so the learner can hear it,
  // then pick the matching answer.
  function speakFrench() {
    if (!HAS_SPEECH) return;
    const item = state.deck[state.index];
    if (!item) return;
    const blanks = blanksOf(item);
    let bi = 0;
    const text = item.prompt.replace(/_{2,}/g, function () {
      return blanks[bi++].answer;
    });

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = 0.85;
    u.pitch = 1;
    const v = frenchVoice();
    if (v) u.voice = v;
    u.onstart = function () { el.listenBtn.classList.add("speaking"); };
    u.onend = function () { el.listenBtn.classList.remove("speaking"); };
    u.onerror = function () { el.listenBtn.classList.remove("speaking"); };
    window.speechSynthesis.speak(u);
  }

  function stopSpeech() {
    if (!HAS_SPEECH) return;
    window.speechSynthesis.cancel();
    el.listenBtn.classList.remove("speaking");
  }

  function buildDeck() {
    let pool = EXAMPLES;
    if (state.filter !== "all") {
      pool = EXAMPLES.filter(function (e) { return verbsOf(e).has(state.filter); });
    }
    state.deck = shuffle(pool);
    state.index = 0;
  }

  // ---------------------------------------------------------------- persistence
  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        score: state.score,
        attempts: state.attempts,
        bestStreak: state.bestStreak,
        filter: state.filter
      }));
    } catch (e) { /* storage may be unavailable (private mode) — ignore */ }
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.score = data.score || 0;
      state.attempts = data.attempts || 0;
      state.bestStreak = data.bestStreak || 0;
      if (data.filter) state.filter = data.filter;
    } catch (e) { /* ignore corrupt data */ }
  }

  // ---------------------------------------------------------------- stats UI
  function renderStats() {
    el.scoreNum.textContent = state.score;
    el.streakNum.textContent = state.streak;
    el.accuracyNum.textContent = state.attempts
      ? Math.round((state.score / state.attempts) * 100) + "%"
      : "—";
    el.progressNum.textContent = state.index + "/" + state.deck.length;
  }

  // ---------------------------------------------------------------- question render
  function renderQuestion() {
    stopSpeech();
    hideWordPopover();
    const item = state.deck[state.index];
    state.answered = false;

    // Alternate input mode: even index → multiple choice, odd → typed.
    const mode = (state.index % 2 === 0) ? "choice" : "type";

    el.verbChip.textContent = chipLabel(item);
    el.modeChip.textContent = mode === "choice" ? "tap" : "type";
    el.promptText.innerHTML = renderPrompt(item);
    // Translation starts hidden behind a toggle so it doesn't give the meaning away.
    el.translationText.textContent = item.translation;
    el.translationText.hidden = true;
    el.translationToggle.hidden = false;
    el.translationToggle.textContent = "Show full translation 👁";

    el.feedback.hidden = true;
    el.feedback.className = "feedback";
    el.nextBtn.hidden = true;
    el.skipBtn.hidden = false;
    el.answerArea.innerHTML = "";

    if (isMulti(item)) {
      renderMultiBlanks(item, mode);
    } else if (mode === "choice") {
      renderChoices(item);
    } else {
      renderTypeInput(item);
    }

    renderStats();
  }

  // Render the prompt: number each blank (when there are several) and wrap glossable
  // words in tappable spans. A single tokenizer pass handles both.
  function renderPrompt(item) {
    const blanks = blanksOf(item);
    const multi = blanks.length > 1;
    const tokenRe = /(_{2,})|([A-Za-zÀ-ÿœŒæÆ'']+)|([^_A-Za-zÀ-ÿœŒæÆ'']+)/g;
    let blankIdx = 0;
    let out = "";
    let m;
    while ((m = tokenRe.exec(item.prompt)) !== null) {
      if (m[1] !== undefined) {
        // a blank
        const label = multi ? (BADGES[blankIdx] || "•") : "?";
        out += '<span class="blank">' + label + "</span>";
        blankIdx++;
      } else if (m[2] !== undefined) {
        // a word — make it tappable if it's in the glossary
        const word = m[2];
        const gloss = GLOSS[wordKey(word)];
        if (gloss) {
          out += '<span class="word" data-gloss="' + escapeHtml(gloss) + '">' +
                 escapeHtml(word) + "</span>";
        } else {
          out += escapeHtml(word);
        }
      } else {
        // spaces / punctuation
        out += escapeHtml(m[3]);
      }
    }
    return out;
  }

  function renderChoices(item) {
    const correct = item.answer;
    // Distractors: other forms of the SAME verb (always plausible conjugations).
    const others = shuffle(FORMS[item.verb].filter(function (f) {
      return normalize(f) !== normalize(correct);
    })).slice(0, 3);
    const choices = shuffle([correct].concat(others));

    const grid = document.createElement("div");
    grid.className = "choices";

    choices.forEach(function (choice) {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.textContent = choice;
      btn.addEventListener("click", function () {
        if (state.answered) return;
        handleAnswer(choice, item, grid, btn);
      });
      grid.appendChild(btn);
    });

    el.answerArea.appendChild(grid);
  }

  function renderTypeInput(item) {
    const wrap = document.createElement("div");
    wrap.className = "type-wrap";

    const row = document.createElement("div");
    row.className = "type-row";

    const input = document.createElement("input");
    input.className = "text-input";
    input.type = "text";
    input.name = "answer";
    input.id = "answerInput";
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;
    input.setAttribute("inputmode", "text");
    input.placeholder = "type the verb…";

    const submit = document.createElement("button");
    submit.className = "submit-btn";
    submit.textContent = "Check";

    row.appendChild(input);
    row.appendChild(submit);

    // Accent helper — full set of common French accented characters.
    const accents = document.createElement("div");
    accents.className = "accent-row";
    ["é", "è", "ê", "ë", "à", "â", "ä", "î", "ï", "ô", "ö", "ù", "û", "ü", "ç", "œ"].forEach(function (ch) {
      const ab = document.createElement("button");
      ab.className = "accent-btn";
      ab.textContent = ch;
      ab.addEventListener("click", function () {
        input.value += ch;
        input.focus();
      });
      accents.appendChild(ab);
    });

    function submitAnswer() {
      if (state.answered) return;
      const val = input.value;
      if (!normalize(val)) { input.focus(); return; }
      handleAnswer(val, item, null, input);
    }

    submit.addEventListener("click", submitAnswer);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); submitAnswer(); }
    });

    wrap.appendChild(row);
    wrap.appendChild(accents);
    el.answerArea.appendChild(wrap);
    input.focus();
  }

  // ---------------------------------------------------------------- multi-blank
  // Two (or more) blanks in one sentence — each gets its own choices/input and is
  // checked together via a single Check button. Stats are credited per blank.
  function renderMultiBlanks(item, mode) {
    const blanks = blanksOf(item);
    const controls = [];
    let lastInput = null;

    blanks.forEach(function (blank, idx) {
      const group = document.createElement("div");
      group.className = "blank-group";

      const label = document.createElement("span");
      label.className = "blank-label";
      label.textContent = BADGES[idx] || "•";
      group.appendChild(label);

      if (mode === "choice") {
        const grid = document.createElement("div");
        grid.className = "choices";
        const correct = blank.answer;
        const others = shuffle(FORMS[blank.verb].filter(function (f) {
          return normalize(f) !== normalize(correct);
        })).slice(0, 3);
        shuffle([correct].concat(others)).forEach(function (choice) {
          const btn = document.createElement("button");
          btn.className = "choice";
          btn.textContent = choice;
          btn.addEventListener("click", function () {
            if (state.answered) return;
            Array.prototype.forEach.call(grid.children, function (b) {
              b.classList.remove("selected");
            });
            btn.classList.add("selected");
          });
          grid.appendChild(btn);
        });
        group.appendChild(grid);

        controls.push({
          getValue: function () {
            const sel = grid.querySelector(".choice.selected");
            return sel ? sel.textContent : "";
          },
          mark: function (correctRight) {
            Array.prototype.forEach.call(grid.children, function (b) {
              b.disabled = true;
              if (normalize(b.textContent) === normalize(blank.answer)) {
                b.classList.add("correct");
              } else if (b.classList.contains("selected") && !correctRight) {
                b.classList.add("wrong");
              }
            });
          }
        });
      } else {
        const row = document.createElement("div");
        row.className = "type-row";
        const input = document.createElement("input");
        input.className = "text-input";
        input.type = "text";
        input.name = "answer" + idx;
        input.autocomplete = "off";
        input.autocapitalize = "off";
        input.spellcheck = false;
        input.setAttribute("inputmode", "text");
        input.placeholder = "blank " + (idx + 1) + "…";
        input.addEventListener("focus", function () { lastInput = input; });
        row.appendChild(input);
        group.appendChild(row);
        if (!lastInput) lastInput = input;

        controls.push({
          getValue: function () { return input.value; },
          mark: function (correctRight) {
            input.disabled = true;
            input.classList.add(correctRight ? "correct" : "wrong");
          }
        });
      }

      el.answerArea.appendChild(group);
    });

    // One shared accent helper for typed multi-blank questions.
    if (mode === "type") {
      const accents = document.createElement("div");
      accents.className = "accent-row";
      ["é", "è", "ê", "ë", "à", "â", "ä", "î", "ï", "ô", "ö", "ù", "û", "ü", "ç", "œ"].forEach(function (ch) {
        const ab = document.createElement("button");
        ab.className = "accent-btn";
        ab.textContent = ch;
        ab.addEventListener("click", function () {
          if (lastInput) { lastInput.value += ch; lastInput.focus(); }
        });
        accents.appendChild(ab);
      });
      el.answerArea.appendChild(accents);
    }

    const check = document.createElement("button");
    check.className = "submit-btn check-multi";
    check.textContent = "Check answers";
    check.addEventListener("click", function () {
      if (state.answered) return;
      // Require every blank to have a value first.
      for (var i = 0; i < controls.length; i++) {
        if (!normalize(controls[i].getValue())) {
          if (mode === "type" && lastInput) lastInput.focus();
          return;
        }
      }
      handleMultiAnswer(item, controls, check);
    });
    el.answerArea.appendChild(check);
  }

  function handleMultiAnswer(item, controls, check) {
    state.answered = true;
    const blanks = blanksOf(item);
    let allRight = true;

    controls.forEach(function (control, i) {
      const right = normalize(control.getValue()) === normalize(blanks[i].answer);
      state.attempts += 1;
      if (right) {
        state.score += 1;
        state.streak += 1;
        if (state.streak > state.bestStreak) state.bestStreak = state.streak;
      } else {
        state.streak = 0;
        allRight = false;
      }
      control.mark(right);
    });

    if (check) check.disabled = true;

    el.feedback.hidden = false;
    el.feedback.className = "feedback " + (allRight ? "good" : "bad");
    const answers = blanks.map(function (b, i) {
      return (BADGES[i] || "•") + " " + b.answer;
    }).join("  ·  ");
    el.feedbackHeadline.textContent = (allRight ? "Correct! ✓  " : "Not quite —  ") + answers;
    el.explanationText.textContent = item.explanation;

    el.skipBtn.hidden = true;
    el.nextBtn.hidden = false;
    el.nextBtn.focus();
    renderStats();
    saveProgress();
  }

  // ---------------------------------------------------------------- word hint popover
  function showWordPopover(wordEl) {
    const gloss = wordEl.getAttribute("data-gloss");
    if (!gloss) return;
    const pop = el.wordPopover;
    pop.textContent = gloss;
    pop.hidden = false;
    pop.classList.remove("below");

    // Position relative to the .card (its offsetParent).
    const card = pop.offsetParent || pop.parentElement;
    const cardRect = card.getBoundingClientRect();
    const wr = wordEl.getBoundingClientRect();
    const popW = pop.offsetWidth;
    const popH = pop.offsetHeight;

    let left = (wr.left - cardRect.left) + wr.width / 2 - popW / 2;
    const maxLeft = card.clientWidth - popW - 6;
    if (left < 6) left = 6;
    if (left > maxLeft) left = maxLeft;

    let top = (wr.top - cardRect.top) - popH - 8;
    if (top < 2) {
      // No room above — flip below the word.
      top = (wr.bottom - cardRect.top) + 8;
      pop.classList.add("below");
    }
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  function hideWordPopover() {
    if (el.wordPopover) el.wordPopover.hidden = true;
  }

  // ---------------------------------------------------------------- answering
  function handleAnswer(given, item, grid, target) {
    state.answered = true;
    const isRight = normalize(given) === normalize(item.answer);

    state.attempts += 1;
    if (isRight) {
      state.score += 1;
      state.streak += 1;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    } else {
      state.streak = 0;
    }

    // Visual marking.
    if (grid) {
      // Multiple choice: disable all, mark correct + the wrong pick.
      Array.prototype.forEach.call(grid.children, function (btn) {
        btn.disabled = true;
        if (normalize(btn.textContent) === normalize(item.answer)) {
          btn.classList.add("correct");
        } else if (btn === target && !isRight) {
          btn.classList.add("wrong");
        }
      });
    } else if (target) {
      // Typed input.
      target.disabled = true;
      target.classList.add(isRight ? "correct" : "wrong");
      const accentRow = el.answerArea.querySelector(".accent-row");
      if (accentRow) accentRow.style.display = "none";
      const submitBtn = el.answerArea.querySelector(".submit-btn");
      if (submitBtn) submitBtn.disabled = true;
    }

    showFeedback(isRight, item);
    el.skipBtn.hidden = true;
    el.nextBtn.hidden = false;
    el.nextBtn.focus();
    renderStats();
    saveProgress();
  }

  function showFeedback(isRight, item) {
    el.feedback.hidden = false;
    el.feedback.className = "feedback " + (isRight ? "good" : "bad");
    el.feedbackHeadline.textContent = isRight
      ? "Correct! ✓  " + capitalize(item.answer)
      : "Not quite — the answer is “" + item.answer + "”.";
    el.explanationText.textContent = item.explanation;
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------------------------------------------------------------- navigation
  function nextQuestion() {
    state.index += 1;
    if (state.index >= state.deck.length) {
      showSummary();
    } else {
      renderQuestion();
    }
  }

  function showSummary() {
    el.quizView.hidden = true;
    el.summaryView.hidden = false;
    el.skipBtn.hidden = true;
    el.nextBtn.hidden = true;

    const total = state.deck.length;
    const correctThisRun = state.attempts; // attempts ~ questions seen; show session-style line
    el.summaryScore.textContent =
      "You finished all " + total + " questions in this deck.";
    el.summaryHint.textContent =
      "Best streak: " + state.bestStreak + " 🔥 · Overall accuracy: " +
      (state.attempts ? Math.round((state.score / state.attempts) * 100) + "%" : "—");
    el.progressNum.textContent = total + "/" + total;
  }

  function startRun() {
    buildDeck();
    el.summaryView.hidden = true;
    el.quizView.hidden = false;
    if (state.deck.length === 0) {
      el.promptText.textContent = "No questions for this filter.";
      el.answerArea.innerHTML = "";
      return;
    }
    renderQuestion();
  }

  // ---------------------------------------------------------------- events
  el.filters.addEventListener("click", function (e) {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    state.filter = btn.dataset.filter;
    Array.prototype.forEach.call(el.filters.children, function (b) {
      b.classList.toggle("is-active", b === btn);
    });
    saveProgress();
    startRun();
  });

  el.listenBtn.addEventListener("click", speakFrench);

  // Tap a word in the sentence → show its meaning in a popover bubble.
  let activeWord = null;
  el.promptText.addEventListener("click", function (e) {
    const wordEl = e.target.closest(".word");
    if (!wordEl) return;
    e.stopPropagation();
    if (activeWord === wordEl && !el.wordPopover.hidden) {
      activeWord = null;
      hideWordPopover();
    } else {
      activeWord = wordEl;
      showWordPopover(wordEl);
    }
  });
  // Tap anywhere else (or scroll) dismisses the popover.
  document.addEventListener("click", function (e) {
    if (el.wordPopover.hidden) return;
    if (e.target.closest(".word")) return;
    activeWord = null;
    hideWordPopover();
  });
  window.addEventListener("scroll", function () { activeWord = null; hideWordPopover(); }, true);

  el.translationToggle.addEventListener("click", function () {
    const show = el.translationText.hidden;
    el.translationText.hidden = !show;
    el.translationToggle.textContent = show ? "Hide full translation" : "Show full translation 👁";
  });

  el.nextBtn.addEventListener("click", nextQuestion);
  el.skipBtn.addEventListener("click", function () {
    // Skipping counts as a miss-free pass: breaks streak but no attempt recorded.
    state.streak = 0;
    nextQuestion();
  });
  el.playAgainBtn.addEventListener("click", startRun);

  el.resetBtn.addEventListener("click", function () {
    state.score = 0;
    state.attempts = 0;
    state.streak = 0;
    state.bestStreak = 0;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    startRun();
  });

  // ---------------------------------------------------------------- init
  if (!HAS_SPEECH) {
    el.listenBtn.hidden = true;
  } else if (typeof window.speechSynthesis.getVoices === "function") {
    // Warm up the voice list (loads asynchronously in some browsers).
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = function () {
      window.speechSynthesis.getVoices();
    };
  }

  loadProgress();
  // Reflect persisted filter in the UI.
  Array.prototype.forEach.call(el.filters.children, function (b) {
    b.classList.toggle("is-active", b.dataset.filter === state.filter);
  });
  startRun();
})();
