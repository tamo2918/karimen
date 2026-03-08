function normalizeQuestionText(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[「」『』（）()\[\]【】〈〉《》・,，.．、。!！?？:：;；"'`´]/g, "");
}

function buildQuestionBank() {
  const base = Array.isArray(window.QUESTIONS) ? window.QUESTIONS : [];
  const extra = Array.isArray(window.EXTRA_QUESTIONS) ? window.EXTRA_QUESTIONS : [];
  const raw = [...base, ...extra];
  const seen = new Set();
  const merged = [];

  raw.forEach((question) => {
    if (!question || !question.question || !question.correctAnswer) {
      return;
    }

    const key = `${normalizeQuestionText(question.question)}|${question.correctAnswer}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    merged.push({
      sourceNo: question.sourceNo ?? "-",
      question: question.question,
      yourAnswer: question.yourAnswer === "O" ? "O" : "X",
      correctAnswer: question.correctAnswer === "O" ? "O" : "X",
      explanation: question.explanation || "解説は未登録です。",
    });
  });

  return merged.map((question, index) => ({
    ...question,
    id: index + 1,
  }));
}

window.QUESTIONS = buildQuestionBank();

const MODE_LABELS = {
  all: "全問題",
  missed: "前回ミスのみ",
  random: "ランダム",
};

const MARK_LABELS = {
  O: "○",
  X: "×",
};

const state = {
  mode: "all",
  pool: [],
  current: 0,
  sessionAnswers: new Map(),
};

const els = {
  statTotal: document.getElementById("stat-total"),
  statPrevAccuracy: document.getElementById("stat-prev-accuracy"),
  statPrevMissed: document.getElementById("stat-prev-missed"),
  statSessionAccuracy: document.getElementById("stat-session-accuracy"),
  modeButtons: [...document.querySelectorAll(".mode-btn")],
  progressLabel: document.getElementById("progress-label"),
  progressBar: document.getElementById("progress-bar"),
  stageRing: document.getElementById("stage-ring"),
  questionCount: document.getElementById("question-count"),
  sourceNo: document.getElementById("source-no"),
  previousResult: document.getElementById("previous-result"),
  questionText: document.getElementById("question-text"),
  sessionAnswer: document.getElementById("session-answer"),
  yourAnswer: document.getElementById("your-answer"),
  correctAnswer: document.getElementById("correct-answer"),
  btnO: document.getElementById("btn-o"),
  btnX: document.getElementById("btn-x"),
  feedback: document.getElementById("feedback"),
  feedbackTitle: document.getElementById("feedback-title"),
  feedbackText: document.getElementById("feedback-text"),
  explanation: document.getElementById("explanation"),
  prevBtn: document.getElementById("prev-btn"),
  nextBtn: document.getElementById("next-btn"),
  missedCount: document.getElementById("missed-count"),
  missedList: document.getElementById("missed-list"),
  quizCard: document.getElementById("quiz-card"),
};

function wasPreviouslyCorrect(question) {
  return question.yourAnswer === question.correctAnswer;
}

function shuffle(list) {
  const cloned = [...list];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

function toPercent(correct, total) {
  if (!total) {
    return "0%";
  }
  return `${Math.round((correct / total) * 100)}%`;
}

function getCurrentQuestion() {
  return state.pool[state.current] || null;
}

function restartAnimation(element, className) {
  if (!element) {
    return;
  }

  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function triggerQuestionTransition() {
  restartAnimation(els.quizCard, "is-transitioning");
  restartAnimation(els.stageRing, "is-energized");
}

function setMode(mode, jumpToId = null) {
  state.mode = mode;
  const base =
    mode === "missed"
      ? window.QUESTIONS.filter((q) => !wasPreviouslyCorrect(q))
      : [...window.QUESTIONS];

  state.pool = mode === "random" ? shuffle(base) : base;
  state.current = 0;

  if (jumpToId !== null) {
    const targetIndex = state.pool.findIndex((q) => q.id === jumpToId);
    if (targetIndex >= 0) {
      state.current = targetIndex;
    }
  }

  render();
  triggerQuestionTransition();
}

function setAnswer(answer) {
  const question = getCurrentQuestion();
  if (!question) {
    return;
  }

  state.sessionAnswers.set(question.id, answer);
  render();
}

function goToPrev() {
  const nextIndex = Math.max(0, state.current - 1);
  if (nextIndex === state.current) {
    return;
  }
  state.current = nextIndex;
  render();
  triggerQuestionTransition();
}

function goToNext() {
  const nextIndex = Math.min(state.pool.length - 1, state.current + 1);
  if (nextIndex === state.current) {
    return;
  }
  state.current = nextIndex;
  render();
  triggerQuestionTransition();
}

function renderGlobalStats() {
  const total = window.QUESTIONS.length;
  const prevCorrectCount = window.QUESTIONS.filter(wasPreviouslyCorrect).length;
  const prevMissedCount = total - prevCorrectCount;

  const answeredInMode = state.pool.filter((q) =>
    state.sessionAnswers.has(q.id),
  ).length;
  const sessionCorrectInMode = state.pool.filter(
    (q) =>
      state.sessionAnswers.has(q.id) &&
      state.sessionAnswers.get(q.id) === q.correctAnswer,
  ).length;

  const sessionRate = toPercent(sessionCorrectInMode, answeredInMode);

  els.statTotal.textContent = String(total);
  els.statPrevAccuracy.textContent = toPercent(prevCorrectCount, total);
  els.statPrevMissed.textContent = String(prevMissedCount);
  els.statSessionAccuracy.textContent = `${sessionRate} (${sessionCorrectInMode}/${answeredInMode})`;
}

function renderModeButtons() {
  els.modeButtons.forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", active);
  });
}

function renderProgress() {
  const total = state.pool.length;
  const index = total ? state.current + 1 : 0;
  const ratio = total ? (index / total) * 100 : 0;

  els.progressLabel.textContent = `${MODE_LABELS[state.mode]} / ${String(index).padStart(2, "0")} - ${String(total).padStart(2, "0")}`;
  els.progressBar.style.width = `${ratio}%`;
  els.stageRing?.style.setProperty("--progress-ratio", `${total ? index / total : 0}`);
}

function resetChoiceStyles() {
  [els.btnO, els.btnX].forEach((button) => {
    button.classList.remove(
      "is-selected",
      "is-correct-choice",
      "is-wrong-choice",
      "is-pop",
    );
  });
}

function renderFeedback(question, sessionAnswer) {
  if (!sessionAnswer) {
    els.feedback.classList.add("hidden");
    els.feedback.classList.remove("is-correct", "is-wrong", "is-reveal");
    resetChoiceStyles();
    return;
  }

  const isCorrect = sessionAnswer === question.correctAnswer;
  const selectedButton = sessionAnswer === "O" ? els.btnO : els.btnX;
  const correctButton = question.correctAnswer === "O" ? els.btnO : els.btnX;

  els.feedback.classList.remove("hidden");
  els.feedback.classList.toggle("is-correct", isCorrect);
  els.feedback.classList.toggle("is-wrong", !isCorrect);
  els.feedbackTitle.textContent = isCorrect ? "Correct." : "Need one more pass.";
  els.sessionAnswer.textContent = MARK_LABELS[sessionAnswer];
  els.yourAnswer.textContent = MARK_LABELS[question.yourAnswer];
  els.correctAnswer.textContent = MARK_LABELS[question.correctAnswer];
  els.feedbackText.textContent = `前回は ${MARK_LABELS[question.yourAnswer]}、今回は ${MARK_LABELS[sessionAnswer]}。ルールの差分を解説で固めます。`;
  els.explanation.textContent = question.explanation;

  resetChoiceStyles();
  selectedButton.classList.add("is-selected", "is-pop");
  correctButton.classList.add("is-correct-choice");
  if (!isCorrect) {
    selectedButton.classList.add("is-wrong-choice");
  }
  restartAnimation(els.feedback, "is-reveal");
}

function renderQuestion() {
  const question = getCurrentQuestion();
  if (!question) {
    els.questionCount.textContent = "00 / 00";
    els.sourceNo.textContent = "出典No: -";
    els.previousResult.textContent = "前回結果: -";
    els.previousResult.classList.remove("pill-correct", "pill-missed");
    els.questionText.textContent = "このモードで表示できる問題がありません。";
    els.sessionAnswer.textContent = "-";
    els.yourAnswer.textContent = "-";
    els.correctAnswer.textContent = "-";
    els.btnO.disabled = true;
    els.btnX.disabled = true;
    els.prevBtn.disabled = true;
    els.nextBtn.disabled = true;
    renderFeedback(null, null);
    return;
  }

  const previouslyCorrect = wasPreviouslyCorrect(question);
  const sessionAnswer = state.sessionAnswers.get(question.id);

  els.questionCount.textContent = `${String(state.current + 1).padStart(2, "0")} / ${String(
    state.pool.length,
  ).padStart(2, "0")}`;
  els.sourceNo.textContent = `source ${question.sourceNo}`;
  els.previousResult.textContent = previouslyCorrect ? "前回: 正解" : "前回: ミス";
  els.previousResult.classList.toggle("pill-correct", previouslyCorrect);
  els.previousResult.classList.toggle("pill-missed", !previouslyCorrect);
  els.questionText.textContent = question.question;
  els.sessionAnswer.textContent = "-";
  els.yourAnswer.textContent = "-";
  els.correctAnswer.textContent = "-";

  els.btnO.disabled = false;
  els.btnX.disabled = false;
  els.prevBtn.disabled = state.current === 0;
  els.nextBtn.disabled = state.current === state.pool.length - 1;

  renderFeedback(question, sessionAnswer);
}

function renderMissedJumps() {
  const missed = window.QUESTIONS.filter((q) => !wasPreviouslyCorrect(q));
  els.missedCount.textContent = `前回ミス ${missed.length}問。クリックで該当問題に移動します。`;
  els.missedList.innerHTML = "";

  missed.forEach((question) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "jump-btn";
    button.textContent = `Q${String(question.id).padStart(2, "0")} / ${question.sourceNo}`;
    button.addEventListener("click", () => {
      setMode("all", question.id);
      els.quizCard.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    els.missedList.appendChild(button);
  });
}

function render() {
  renderModeButtons();
  renderGlobalStats();
  renderProgress();
  renderQuestion();
}

function wireEvents() {
  els.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setMode(button.dataset.mode);
    });
  });

  els.btnO.addEventListener("click", () => setAnswer("O"));
  els.btnX.addEventListener("click", () => setAnswer("X"));
  els.prevBtn.addEventListener("click", goToPrev);
  els.nextBtn.addEventListener("click", goToNext);

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft") {
      goToPrev();
    } else if (key === "arrowright") {
      goToNext();
    } else if (key === "o") {
      setAnswer("O");
    } else if (key === "x") {
      setAnswer("X");
    }
  });
}

function init() {
  wireEvents();
  renderMissedJumps();
  setMode("all");
}

init();
