const PEOPLE = [
  {
    fio: "Баев Андрей Анатольевич",
    position: "Продавец-консультант",
    department: "Магазин №23, с. Кулига, ул. Доломитовая, зд. 2",
  },
  {
    fio: "Шихалев Вячеслав",
    position: "Продавец-консультант",
    department: "Магазин №23, с. Кулига, ул. Доломитовая, зд. 2",
  },
  {
    fio: "Коноплич Сергей",
    position: "Кладовщик",
    department: "Магазин №23, с. Кулига, ул. Доломитовая, зд. 2",
  },
  {
    fio: "Римберг Александра Александровна",
    position: "Менеджер по обучению и развитию персонала",
    department: "Служба управления бизнес-процессами",
    reviewer: true,
  },
];

const PASS_PER_BLOCK = 8;
const LIMIT_SEC = 40 * 60;
const TO_EMAIL = "arimberg@gmail.com";
const STORE_KEY = "kuliga-srez-2026";

const el = {
  start: document.getElementById("screen-start"),
  quiz: document.getElementById("screen-quiz"),
  result: document.getElementById("screen-result"),
  form: document.getElementById("start-form"),
  person: document.getElementById("user-person"),
  personMeta: document.getElementById("person-meta"),
  attempt: document.getElementById("attempt-note"),
  formError: document.getElementById("form-error"),
  startBtn: document.getElementById("btn-start"),
  openReview: document.getElementById("btn-open-review"),
  prev: document.getElementById("btn-prev"),
  next: document.getElementById("btn-next"),
  counter: document.getElementById("q-counter"),
  timer: document.getElementById("q-timer"),
  topic: document.getElementById("q-topic"),
  text: document.getElementById("q-text"),
  options: document.getElementById("options"),
  bar: document.getElementById("progress-bar"),
  scoreNum: document.getElementById("score-num"),
  scoreTotal: document.getElementById("score-total"),
  scorePercent: document.getElementById("score-percent"),
  scoreTitle: document.getElementById("score-title"),
  verdict: document.getElementById("score-verdict"),
  mailStatus: document.getElementById("mail-status"),
  topicStats: document.getElementById("topic-stats"),
  review: document.getElementById("review"),
};

const questions = window.QUESTIONS;
let answers = [];
let current = 0;
let person = null;
let deadline = 0;
let timerId = 0;
let finished = false;

function blankAnswers() {
  return questions.map(() => null);
}

function isPicked(value) {
  return Number.isInteger(value);
}

function storageKey(fio) {
  return `${STORE_KEY}:${fio}`;
}

function readSaved(fio) {
  try {
    const raw = localStorage.getItem(storageKey(fio));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function writeSaved(fio, data) {
  localStorage.setItem(storageKey(fio), JSON.stringify(data));
}

function show(name) {
  el.start.hidden = name !== "start";
  el.quiz.hidden = name !== "quiz";
  el.result.hidden = name !== "result";
}

function selectedPerson() {
  const fio = el.person.value;
  return PEOPLE.find((item) => item.fio === fio) || null;
}

function fillPeople() {
  PEOPLE.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.fio;
    option.textContent = `${item.fio}, ${item.position}`;
    el.person.appendChild(option);
  });
}

function syncStart() {
  person = selectedPerson();
  el.formError.hidden = true;
  if (!person) {
    el.personMeta.hidden = true;
    el.attempt.hidden = true;
    el.openReview.hidden = true;
    el.startBtn.hidden = false;
    el.startBtn.disabled = false;
    return;
  }
  el.personMeta.hidden = false;
  el.personMeta.textContent = `${person.position}. ${person.department}`;
  const saved = readSaved(person.fio);
  const done = saved && saved.done;
  const pending = saved && saved.started && !saved.done;
  if (done && !person.reviewer) {
    el.attempt.hidden = false;
    el.attempt.textContent = "Сдача уже есть. Откройте свой результат: повторно тест не запускаем, чтобы срез остался честным.";
    el.startBtn.hidden = true;
    el.openReview.hidden = false;
    return;
  }
  if (pending && !person.reviewer) {
    el.attempt.hidden = false;
    el.attempt.textContent = "Сдача уже начата. Продолжайте с того же места и с тем же временем. Новую попытку открыть нельзя.";
    el.startBtn.hidden = false;
    el.startBtn.textContent = "Продолжить";
    el.openReview.hidden = true;
    return;
  }
  if (done && person.reviewer) {
    el.attempt.hidden = false;
    el.attempt.textContent = "Прошлая сдача сохранена. Можно открыть её или пройти тест ещё раз и поправить формулировки.";
    el.startBtn.hidden = false;
    el.startBtn.textContent = "Пройти ещё раз";
    el.openReview.hidden = false;
    return;
  }
  el.attempt.hidden = true;
  el.startBtn.hidden = false;
  el.startBtn.textContent = "Начать";
  el.openReview.hidden = true;
}

const CORRECT_AT = [
  1, 3, 0, 2, 2, 0, 3, 1, 0, 2,
  1, 3, 3, 1, 0, 2, 1, 0, 2, 3,
  3, 2, 0, 1, 2, 1, 3, 0, 0, 3,
  1, 2, 2, 0, 1, 3, 1, 3, 2, 0,
];

function displayOrder(questionIndex, answerIndex) {
  const place = CORRECT_AT[questionIndex];
  const rest = [0, 1, 2, 3].filter((index) => index !== answerIndex);
  const order = [];
  for (let slot = 0; slot < 4; slot += 1) {
    order.push(slot === place ? answerIndex : rest.shift());
  }
  return order;
}

function formatTime(sec) {
  const safe = Math.max(0, sec);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function tick() {
  const left = Math.ceil((deadline - Date.now()) / 1000);
  el.timer.textContent = formatTime(left);
  if (left <= 0) {
    clearInterval(timerId);
    finish("Время вышло. Неотвеченные вопросы засчитаны как ошибка.");
  }
}

function renderQuestion() {
  const q = questions[current];
  el.counter.textContent = `${current + 1} / ${questions.length}`;
  el.topic.textContent = q.block;
  el.text.textContent = q.q;
  el.bar.style.width = `${((current + 1) / questions.length) * 100}%`;
  el.options.innerHTML = "";
  displayOrder(current, q.answer).forEach((index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option";
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", answers[current] === index ? "true" : "false");
    if (isPicked(answers[current]) && answers[current] === index) btn.classList.add("picked");
    btn.textContent = q.options[index];
    btn.addEventListener("click", () => {
      answers[current] = index;
      saveProgress();
      renderQuestion();
    });
    el.options.appendChild(btn);
  });
  el.prev.disabled = current === 0;
  el.next.disabled = !isPicked(answers[current]);
  el.next.textContent = current === questions.length - 1 ? "Завершить" : "Далее";
}

function saveProgress() {
  if (!person || finished) return;
  writeSaved(person.fio, {
    started: true,
    done: false,
    answers,
    current,
    deadline,
    fio: person.fio,
  });
}

function startQuiz(event) {
  event.preventDefault();
  person = selectedPerson();
  if (!person) {
    el.formError.hidden = false;
    return;
  }
  const saved = readSaved(person.fio);
  if (saved && saved.done && !person.reviewer) {
    showResult(saved.report, saved.mailNote || "Это сохранённый результат этой сдачи.");
    return;
  }
  if (saved && saved.started && !saved.done && !person.reviewer) {
    answers = blankAnswers().map((empty, index) => (
      isPicked(saved.answers && saved.answers[index]) ? saved.answers[index] : empty
    ));
    current = Number.isInteger(saved.current) ? saved.current : 0;
    if (current < 0 || current >= questions.length) current = 0;
    deadline = saved.deadline;
    finished = false;
    clearInterval(timerId);
    timerId = setInterval(tick, 250);
    show("quiz");
    renderQuestion();
    tick();
    return;
  }
  answers = blankAnswers();
  current = 0;
  finished = false;
  deadline = Date.now() + LIMIT_SEC * 1000;
  writeSaved(person.fio, {
    started: true,
    done: false,
    answers,
    current,
    deadline,
    fio: person.fio,
  });
  clearInterval(timerId);
  timerId = setInterval(tick, 250);
  tick();
  show("quiz");
  renderQuestion();
}

function blockStats(answerList) {
  const blocks = [];
  questions.forEach((q, index) => {
    let block = blocks.find((item) => item.name === q.block);
    if (!block) {
      block = { name: q.block, ok: 0, total: 0 };
      blocks.push(block);
    }
    block.total += 1;
    if (isPicked(answerList[index]) && answerList[index] === q.answer) block.ok += 1;
  });
  return blocks;
}

function buildReport(answerList, timeNote) {
  const blocks = blockStats(answerList);
  const correct = blocks.reduce((sum, block) => sum + block.ok, 0);
  const total = questions.length;
  const weak = blocks.filter((block) => block.ok < PASS_PER_BLOCK);
  const lines = [];
  lines.push(`Срез знаний. Кулига`);
  lines.push(person.fio);
  lines.push(`${person.position}. ${person.department}`);
  lines.push(`${correct} из ${total}`);
  blocks.forEach((block) => {
    const mark = block.ok >= PASS_PER_BLOCK ? "норма есть" : "ниже нормы";
    lines.push(`${block.name}: ${block.ok} из ${block.total}, ${mark}`);
  });
  if (timeNote) lines.push(timeNote);
  lines.push("");
  lines.push("Ошибки:");
  let mistakes = 0;
  questions.forEach((q, index) => {
    if (isPicked(answerList[index]) && answerList[index] === q.answer) return;
    mistakes += 1;
    const chosen = isPicked(answerList[index]) ? q.options[answerList[index]] : "нет ответа";
    lines.push(`${index + 1}. ${q.block}. ${q.q}`);
    lines.push(`Ответ: ${chosen}`);
    lines.push(`Верно: ${q.options[q.answer]}`);
  });
  if (!mistakes) lines.push("Ошибок нет.");
  return {
    correct,
    total,
    blocks,
    weak,
    timeNote: timeNote || "",
    message: lines.join("\n"),
    subject: `Срез знаний Кулига: ${person.fio}, ${correct} из ${total}`,
  };
}

function showResult(report, mailNote) {
  show("result");
  el.scoreNum.textContent = String(report.correct);
  el.scoreTotal.textContent = String(report.total);
  el.scorePercent.textContent = `${Math.round((report.correct / report.total) * 100)}% верных`;
  el.scoreTitle.textContent = `${person.fio}`;
  if (!report.weak.length) {
    el.verdict.textContent = "По каждому блоку норма есть: 8 из 10 или больше. Срез ровный.";
  } else {
    const names = report.weak.map((block) => `${block.name} (${block.ok} из ${block.total})`).join(", ");
    el.verdict.textContent = `Норма 8 из 10. Пока не дотягивает: ${names}.`;
  }
  if (report.timeNote) {
    el.verdict.textContent += ` ${report.timeNote}`;
  }
  el.mailStatus.textContent = mailNote || "";
  el.topicStats.innerHTML = "";
  report.blocks.forEach((block) => {
    const card = document.createElement("article");
    card.className = "block-card";
    const title = document.createElement("div");
    title.innerHTML = `<strong>${block.name}</strong>`;
    const mark = document.createElement("div");
    mark.className = "mark";
    mark.textContent = block.ok >= PASS_PER_BLOCK
      ? `${block.ok} из ${block.total}. Норма есть`
      : `${block.ok} из ${block.total}. Ниже нормы`;
    card.append(title, mark);
    el.topicStats.appendChild(card);
  });

  const rows = questions.map((q, index) => ({
    q,
    index,
    ok: isPicked(report.answers && report.answers[index]) && report.answers[index] === q.answer,
    chosen: isPicked(report.answers && report.answers[index]) ? report.answers[index] : null,
  }));
  rows.sort((a, b) => Number(a.ok) - Number(b.ok) || a.index - b.index);
  el.review.innerHTML = "";
  rows.forEach((row) => {
    const card = document.createElement("article");
    card.className = row.ok ? "card" : "card wrong";
    const chosen = row.chosen === null ? "Ответа нет." : row.q.options[row.chosen];
    card.innerHTML = `
      <p class="n">${row.index + 1}. ${row.q.block}. ${row.ok ? "Верно" : "Ошибка"}</p>
      <p><b>${escapeHtml(row.q.q)}</b></p>
      <p>Ваш ответ: ${escapeHtml(chosen)}</p>
      <p>Верно: ${escapeHtml(row.q.options[row.q.answer])}</p>
      <p>${escapeHtml(row.q.explain)}</p>
    `;
    el.review.appendChild(card);
  });
  window.scrollTo(0, 0);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendMail(report) {
  const payload = {
    _subject: report.subject,
    _captcha: "false",
    _template: "box",
    name: person.fio,
    email: TO_EMAIL,
    Должность: person.position,
    Подразделение: person.department,
    Балл: `${report.correct} из ${report.total}`,
    message: report.message,
  };
  const response = await fetch(`https://formsubmit.co/ajax/${TO_EMAIL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(response.status));
  const message = String(data.message || "");
  if (String(data.success) === "false" || /activat/i.test(message)) {
    const error = new Error(message || "activation");
    error.activation = true;
    throw error;
  }
  return data;
}

async function finish(timeNote) {
  if (finished) return;
  finished = true;
  clearInterval(timerId);
  const answerList = answers.slice();
  const report = buildReport(answerList, timeNote);
  report.answers = answerList;
  writeSaved(person.fio, {
    done: true,
    report,
    fio: person.fio,
  });
  showResult(report, "Отправляем результат…");
  try {
    await sendMail(report);
    const note = "Результат ушёл на arimberg@gmail.com.";
    const saved = readSaved(person.fio);
    saved.mailNote = note;
    writeSaved(person.fio, saved);
    el.mailStatus.textContent = note;
  } catch (err) {
    if (err && err.activation) {
      el.mailStatus.textContent = "На arimberg@gmail.com ушло письмо для подтверждения почты. Откройте его и нажмите ссылку. После этого ответы начнут приходить.";
      return;
    }
    const body = encodeURIComponent(report.message.slice(0, 1500));
    const subject = encodeURIComponent(report.subject);
    el.mailStatus.innerHTML =
      `Автоматически отправить не получилось. <a href="mailto:${TO_EMAIL}?subject=${subject}&body=${body}">Открыть письмо вручную</a>`;
  }
}

function openSaved() {
  person = selectedPerson();
  if (!person) return;
  const saved = readSaved(person.fio);
  if (!saved || !saved.done) return;
  showResult(saved.report, saved.mailNote || "Это сохранённый результат этой сдачи.");
}

el.form.addEventListener("submit", startQuiz);
el.person.addEventListener("change", syncStart);
el.openReview.addEventListener("click", openSaved);
el.prev.addEventListener("click", () => {
  if (current === 0) return;
  current -= 1;
  saveProgress();
  renderQuestion();
});
el.next.addEventListener("click", () => {
  if (!isPicked(answers[current])) return;
  if (current === questions.length - 1) {
    finish("");
    return;
  }
  current += 1;
  saveProgress();
  renderQuestion();
});

fillPeople();
syncStart();
