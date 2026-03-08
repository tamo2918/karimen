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

const MARK_LABELS = {
  O: "○",
  X: "×",
};

const state = {
  order: [],
  current: 0,
  sessionAnswers: new Map(),
  phase: "quiz",
  isLocked: false,
};

const els = {
  stageRing: document.getElementById("stage-ring"),
  questionCount: document.getElementById("question-count"),
  quizCard: document.getElementById("quiz-card"),
  questionView: document.getElementById("question-view"),
  resultView: document.getElementById("result-view"),
  questionText: document.getElementById("question-text"),
  btnO: document.getElementById("btn-o"),
  btnX: document.getElementById("btn-x"),
  feedback: document.getElementById("feedback"),
  feedbackTitle: document.getElementById("feedback-title"),
  feedbackText: document.getElementById("feedback-text"),
  explanation: document.getElementById("explanation"),
  sessionAnswer: document.getElementById("session-answer"),
  correctAnswer: document.getElementById("correct-answer"),
  nextBtn: document.getElementById("next-btn"),
  resultTitle: document.getElementById("result-title"),
  resultTotal: document.getElementById("result-total"),
  resultCorrect: document.getElementById("result-correct"),
  resultAccuracy: document.getElementById("result-accuracy"),
  resultMessage: document.getElementById("result-message"),
  reviewSection: document.getElementById("review-section"),
  reviewList: document.getElementById("review-list"),
  restartBtn: document.getElementById("restart-btn"),
};

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
  return state.order[state.current] || null;
}

function restartAnimation(element, className) {
  if (!element) {
    return;
  }

  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
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

function animateQuestionChange() {
  restartAnimation(els.quizCard, "is-transitioning");
  restartAnimation(els.stageRing, "is-energized");
}

function startRound() {
  state.order = shuffle(window.QUESTIONS);
  state.current = 0;
  state.phase = "quiz";
  state.isLocked = false;
  state.sessionAnswers.clear();
  render();
  animateQuestionChange();
}

function applyAnswerState(answer, correctAnswer) {
  const selectedButton = answer === "O" ? els.btnO : els.btnX;
  const correctButton = correctAnswer === "O" ? els.btnO : els.btnX;

  resetChoiceStyles();
  selectedButton.classList.add("is-selected", "is-pop");
  correctButton.classList.add("is-correct-choice");

  if (answer !== correctAnswer) {
    selectedButton.classList.add("is-wrong-choice");
  }
}

function finishRound() {
  state.phase = "result";
  state.isLocked = false;
  render();
  animateQuestionChange();
}

function moveToNextQuestion() {
  state.current += 1;
  state.isLocked = false;
  render();
  animateQuestionChange();
}

function renderFeedback(question, answer) {
  const isCorrect = answer === question.correctAnswer;

  els.feedback.classList.remove("hidden");
  els.feedback.classList.toggle("is-correct", isCorrect);
  els.feedback.classList.toggle("is-wrong", !isCorrect);
  els.feedbackTitle.textContent = isCorrect ? "正解" : "不正解";
  els.sessionAnswer.textContent = MARK_LABELS[answer];
  els.correctAnswer.textContent = MARK_LABELS[question.correctAnswer];
  els.feedbackText.textContent = isCorrect
    ? "ルールどおりに答えられています。解説で確認して次へ進めます。"
    : "正解との差分を解説で確認してから次へ進めます。";
  els.explanation.textContent = question.explanation;

  restartAnimation(els.feedback, "is-reveal");
}

function setAnswer(answer) {
  if (state.phase !== "quiz" || state.isLocked) {
    return;
  }

  const question = getCurrentQuestion();
  if (!question) {
    return;
  }

  state.sessionAnswers.set(question.id, answer);
  state.isLocked = true;
  els.btnO.disabled = true;
  els.btnX.disabled = true;
  applyAnswerState(answer, question.correctAnswer);
  renderFeedback(question, answer);
  els.nextBtn.textContent =
    state.current >= state.order.length - 1 ? "結果を見る" : "次へ";
  els.nextBtn.classList.remove("hidden");
}

function renderProgress() {
  const total = state.order.length;
  const index = state.phase === "result" ? total : state.current + 1;
  els.questionCount.textContent = `${String(index).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  els.stageRing?.style.setProperty("--progress-ratio", `${total ? index / total : 0}`);
}

function renderQuestion() {
  const question = getCurrentQuestion();
  resetChoiceStyles();

  if (!question) {
    els.questionText.textContent = "問題データがありません。";
    els.btnO.disabled = true;
    els.btnX.disabled = true;
    els.feedback.classList.add("hidden");
    els.nextBtn.classList.add("hidden");
    return;
  }

  els.questionText.textContent = question.question;
  els.btnO.disabled = false;
  els.btnX.disabled = false;
  els.feedback.classList.add("hidden");
  els.feedback.classList.remove("is-correct", "is-wrong", "is-reveal");
  els.sessionAnswer.textContent = "-";
  els.correctAnswer.textContent = "-";
  els.explanation.textContent = "";
  els.nextBtn.classList.add("hidden");
}

function renderReviewList() {
  const missed = state.order.filter(
    (question) => state.sessionAnswers.get(question.id) !== question.correctAnswer,
  );

  els.reviewList.innerHTML = "";

  if (!missed.length) {
    els.reviewSection.classList.add("hidden");
    return;
  }

  els.reviewSection.classList.remove("hidden");

  missed.forEach((question, index) => {
    const item = document.createElement("article");
    item.className = "review-item";
    item.innerHTML = `
      <p class="review-index">MISS ${String(index + 1).padStart(2, "0")}</p>
      <h3 class="review-question">${question.question}</h3>
      <div class="review-meta">
        <span>あなたの回答: ${MARK_LABELS[state.sessionAnswers.get(question.id)]}</span>
        <span>正解: ${MARK_LABELS[question.correctAnswer]}</span>
      </div>
      <p class="review-explanation">${question.explanation}</p>
    `;
    els.reviewList.appendChild(item);
  });
}

function renderResult() {
  const total = state.order.length;
  const correct = state.order.filter(
    (question) => state.sessionAnswers.get(question.id) === question.correctAnswer,
  ).length;
  const missed = total - correct;

  els.resultTitle.textContent = `${total}問完了`;
  els.resultTotal.textContent = String(total);
  els.resultCorrect.textContent = String(correct);
  els.resultAccuracy.textContent = toPercent(correct, total);
  els.resultMessage.textContent =
    missed === 0
      ? "全問正解です。このラウンドは仕上がっています。"
      : `${missed}問ミスしました。下の解説だけ見直して次のラウンドへ進めます。`;

  renderReviewList();
}

function render() {
  renderProgress();

  if (state.phase === "result") {
    els.questionView.classList.add("hidden");
    els.resultView.classList.remove("hidden");
    renderResult();
    return;
  }

  els.questionView.classList.remove("hidden");
  els.resultView.classList.add("hidden");
  renderQuestion();
}

function wireEvents() {
  els.btnO.addEventListener("click", () => setAnswer("O"));
  els.btnX.addEventListener("click", () => setAnswer("X"));
  els.nextBtn.addEventListener("click", () => {
    if (state.phase !== "quiz" || !state.isLocked) {
      return;
    }

    if (state.current >= state.order.length - 1) {
      finishRound();
      return;
    }

    moveToNextQuestion();
  });
  els.restartBtn.addEventListener("click", startRound);

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (state.phase === "quiz") {
      if (key === "o") {
        setAnswer("O");
      } else if (key === "x") {
        setAnswer("X");
      } else if ((key === "enter" || key === " ") && state.isLocked) {
        event.preventDefault();
        els.nextBtn.click();
      }
      return;
    }

    if (key === "enter" || key === "r" || key === " ") {
      event.preventDefault();
      startRound();
    }
  });
}

function init() {
  wireEvents();
  startRound();
}

init();
