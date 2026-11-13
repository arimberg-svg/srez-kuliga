const PEOPLE = [
  {
    fio: "Баев Андрей",
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
    fio: "Римберг Александра",
    position: "Менеджер по обучению и развитию персонала",
    department: "Служба управления бизнес-процессами",
    reviewer: true,
  },
];

const LIMIT_SEC = 60 * 60;
const TO_EMAIL = "arimberg@gmail.com";
const STORE_KEY = "kuliga-srez-2026g";

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
  1, 3, 0, 2, 2, 0, 3, 1, 0, 2, 1, 3,
  3, 1, 0, 2, 1, 0, 2, 3, 0, 2, 1,
  3, 2, 0, 1, 2, 1, 3, 0, 0, 3, 2,
  1, 2, 2, 0, 1, 3, 1, 3, 2, 0, 3,
  2, 0, 3, 1, 2, 0, 3, 1, 0, 2, 3, 1,
  0, 3, 1, 2, 0, 3, 1, 2, 0, 3, 1, 2,
];

function normOf(total) {
  return Math.round(total * 0.8);
}

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

function offerResend(saved) {
  if (!saved || !saved.report) return;
  if (saved.mailNote && saved.mailNote.indexOf("ушёл") !== -1) return;
  showMailFail(saved.report);
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
    offerResend(saved);
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
  const weak = blocks.filter((block) => block.ok < normOf(block.total));
  const lines = [];
  lines.push(`Срез знаний. Кулига`);
  lines.push(person.fio);
  lines.push(`${person.position}. ${person.department}`);
  lines.push(`${correct} из ${total}`);
  blocks.forEach((block) => {
    const mark = block.ok >= normOf(block.total) ? "норма есть" : "ниже нормы";
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
    el.verdict.textContent = "По каждому блоку норма есть: восемь верных из десяти. Срез ровный.";
  } else {
    const names = report.weak.map((block) => `${block.name} (${block.ok} из ${block.total})`).join(", ");
    el.verdict.textContent = `Норма: восемь верных из десяти в блоке. Пока не дотягивает: ${names}.`;
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
    mark.textContent = block.ok >= normOf(block.total)
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
  const params = new URLSearchParams();
  params.set("_subject", report.subject);
  params.set("_captcha", "false");
  params.set("_template", "box");
  params.set("name", person.fio);
  params.set("Должность", person.position);
  params.set("Подразделение", person.department);
  params.set("Балл", `${report.correct} из ${report.total}`);
  let message = report.message;
  if (message.length > 8000) {
    message = `${message.slice(0, 8000)}\n… Дальше текст не влез в письмо. Полный разбор остаётся на экране телефона.`;
  }
  params.set("message", message);
  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(TO_EMAIL)}`, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: params,
  });
  const raw = await response.text();
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch (err) {
    data = {};
  }
  const messageText = String(data.message || "");
  if (!response.ok || String(data.success) !== "true") {
    const error = new Error(messageText || String(response.status || "send"));
    error.activation = /activat/i.test(messageText);
    throw error;
  }
  return data;
}

function rememberMail(note) {
  const saved = readSaved(person.fio);
  if (!saved) return;
  saved.mailNote = note;
  writeSaved(person.fio, saved);
}

function showMailFail(report) {
  el.mailStatus.textContent = "";
  const note = document.createElement("p");
  note.textContent = "С этого телефона письмо само не ушло. Нажмите «Отправить снова». Если опять не выйдет, скопируйте текст ниже и пришлите его Александре.";
  const actions = document.createElement("div");
  actions.className = "mail-actions";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "btn primary";
  retry.textContent = "Отправить снова";
  retry.addEventListener("click", () => {
    deliver(report);
  });
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "btn ghost";
  copy.textContent = "Скопировать результат";
  copy.addEventListener("click", async () => {
    const text = report.message;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (err) {
      ok = false;
    }
    copy.textContent = ok ? "Скопировано" : "Выделите текст ниже и скопируйте";
  });
  const area = document.createElement("textarea");
  area.className = "mail-copy";
  area.readOnly = true;
  area.value = report.message;
  actions.append(retry, copy);
  el.mailStatus.append(note, actions, area);
}

async function deliver(report) {
  el.mailStatus.textContent = "Отправляем результат…";
  try {
    await sendMail(report);
    const note = "Результат ушёл на arimberg@gmail.com.";
    rememberMail(note);
    el.mailStatus.textContent = note;
  } catch (err) {
    if (err && err.activation) {
      const note = "Почта для ответов ещё не подтверждена. Александре нужно открыть письмо от FormSubmit и нажать ссылку. После этого результат уйдёт.";
      rememberMail(note);
      el.mailStatus.textContent = note;
      return;
    }
    try {
      await sendMail(report);
      const note = "Результат ушёл на arimberg@gmail.com.";
      rememberMail(note);
      el.mailStatus.textContent = note;
    } catch (second) {
      if (second && second.activation) {
        const note = "Почта для ответов ещё не подтверждена. Александре нужно открыть письмо от FormSubmit и нажать ссылку. После этого результат уйдёт.";
        rememberMail(note);
        el.mailStatus.textContent = note;
        return;
      }
      rememberMail("Письмо с телефона само не ушло.");
      showMailFail(report);
    }
  }
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
  await deliver(report);
}

function openSaved() {
  person = selectedPerson();
  if (!person) return;
  const saved = readSaved(person.fio);
  if (!saved || !saved.done) return;
  showResult(saved.report, saved.mailNote || "Это сохранённый результат этой сдачи.");
  offerResend(saved);
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
