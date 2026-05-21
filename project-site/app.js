const knowledge = window.PROJECT_KNOWLEDGE;

const metricGrid = document.querySelector("#metricGrid");
const workflowList = document.querySelector("#workflowList");
const suggestionList = document.querySelector("#suggestionList");
const chatLog = document.querySelector("#chatLog");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");

function normalizeText(value) {
  return value
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderMetrics() {
  metricGrid.innerHTML = knowledge.metrics
    .map(
      (item) => `
        <article class="metric-card">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
          <small>${item.note}</small>
        </article>
      `,
    )
    .join("");
}

function renderWorkflow() {
  workflowList.innerHTML = knowledge.workflow
    .map(
      (item, index) => `
        <article class="workflow-item">
          <div class="workflow-index">${index + 1}</div>
          <strong>${item.title}</strong>
          <span>${item.text}</span>
        </article>
      `,
    )
    .join("");
}

function renderSuggestions() {
  suggestionList.innerHTML = knowledge.faq
    .slice(0, 8)
    .map(
      (item) => `
        <button type="button" data-question="${item.question}">
          ${item.question}
        </button>
      `,
    )
    .join("");
}

function addMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.textContent = text;
  chatLog.appendChild(message);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function scoreFaq(query, faq) {
  const normalizedQuery = normalizeText(query);
  const queryWords = new Set(normalizedQuery.split(" ").filter((word) => word.length >= 2));
  const searchable = normalizeText([faq.question, faq.answer, ...(faq.keywords || [])].join(" "));
  let score = 0;

  for (const word of queryWords) {
    if (searchable.includes(word)) {
      score += word.length > 4 ? 2 : 1;
    }
  }

  for (const keyword of faq.keywords || []) {
    if (normalizedQuery.includes(normalizeText(keyword))) {
      score += 4;
    }
  }

  return score;
}

function findAnswer(query) {
  const ranked = knowledge.faq
    .map((item) => ({ item, score: scoreFaq(query, item) }))
    .sort((a, b) => b.score - a.score);

  if (!ranked[0] || ranked[0].score < 2) {
    return (
      "Mình chưa tìm thấy câu trả lời sát với câu hỏi này trong bộ dữ liệu hiện tại.\n\n" +
      "Bạn có thể hỏi theo các chủ đề như: PLC S7-1200, MFM384, RS485, workflow dữ liệu, " +
      "Server API, app hiển thị gì, AI dự báo phụ tải hoặc Cloudflare Tunnel."
    );
  }

  return ranked[0].item.answer;
}

function askQuestion(question) {
  const cleaned = question.trim();
  if (!cleaned) return;

  addMessage("user", cleaned);
  addMessage("bot", findAnswer(cleaned));
}

function bindEvents() {
  suggestionList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-question]");
    if (!button) return;
    askQuestion(button.dataset.question || button.textContent);
  });

  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = chatInput.value;
    chatInput.value = "";
    askQuestion(value);
  });
}

renderMetrics();
renderWorkflow();
renderSuggestions();
bindEvents();

addMessage(
  "bot",
  "Xin chào, mình là AI Project Assistant. Bạn có thể hỏi về PLC S7-1200, MFM384, luồng dữ liệu, app, server API hoặc phần AI dự báo phụ tải.",
);
