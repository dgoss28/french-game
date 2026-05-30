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

  function buildDeck() {
    let pool = EXAMPLES;
    if (state.filter !== "all") {
      pool = EXAMPLES.filter(function (e) { return e.verb === state.filter; });
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
    const item = state.deck[state.index];
    state.answered = false;

    // Alternate input mode: even index → multiple choice, odd → typed.
    const mode = (state.index % 2 === 0) ? "choice" : "type";

    el.verbChip.textContent = item.verb;
    el.modeChip.textContent = mode === "choice" ? "tap" : "type";
    el.promptText.innerHTML = renderPrompt(item.prompt);
    // Translation starts hidden behind a toggle so it doesn't give the meaning away.
    el.translationText.textContent = item.translation;
    el.translationText.hidden = true;
    el.translationToggle.hidden = false;
    el.translationToggle.textContent = "Show translation 👁";

    el.feedback.hidden = true;
    el.feedback.className = "feedback";
    el.nextBtn.hidden = true;
    el.skipBtn.hidden = false;
    el.answerArea.innerHTML = "";

    if (mode === "choice") {
      renderChoices(item);
    } else {
      renderTypeInput(item);
    }

    renderStats();
  }

  // Replace the ___ blank with a styled placeholder.
  function renderPrompt(prompt) {
    const safe = prompt.replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
    return safe.replace(/_{2,}/, '<span class="blank">?</span>');
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

  el.translationToggle.addEventListener("click", function () {
    const show = el.translationText.hidden;
    el.translationText.hidden = !show;
    el.translationToggle.textContent = show ? "Hide translation" : "Show translation 👁";
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
  loadProgress();
  // Reflect persisted filter in the UI.
  Array.prototype.forEach.call(el.filters.children, function (b) {
    b.classList.toggle("is-active", b.dataset.filter === state.filter);
  });
  startRun();
})();
