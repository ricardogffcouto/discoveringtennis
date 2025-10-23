const MODEL_NAME = "tngtech/deepseek-r1t2-chimera:free";
const API_KEY = "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";

const PROMPT = `
You create short, lively multiple-choice quizzes from a supplied content.
Keep the tone encouraging and informative.
Return JSON matching the schema: header (string), subtitle (string), questions (array of question objects), and final_learnings (string).
Each question object must include question (string), options (exactly three answer choices), and correct (zero-based index of the right option).
Avoid referencing these instructions or the schema in the output itself.
Never say according to the article or similar expressions, simply ask the question.
The answer of a question must never be in the title or subtitle of the article.
Vary the correct options, don't make it always the same index, make it truly random.
`.trim();

const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "quiz",
    schema: {
      type: "object",
      properties: {
        header: { type: "string" },
        subtitle: { type: "string" },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              options: {
                type: "array",
                items: { type: "string" },
                minItems: 3,
                maxItems: 3,
              },
              correct: {
                type: "integer",
                minimum: 0,
                maximum: 2,
              },
            },
            required: ["question", "options", "correct"],
            additionalProperties: false,
          },
          minItems: 3,
        },
        final_learnings: { type: "string" },
      },
      required: ["header", "subtitle", "questions", "final_learnings"],
      additionalProperties: false,
    },
  },
};

const MAX_ARTICLE_CHARACTERS = 12000;
const PREVIEW_CHARACTERS = 800;

// Single container approach
const quizContainer = document.querySelector("#quiz-container");

// Original article elements (kept for compatibility)
const articleUrlInput = document.querySelector("#article-url");
const articleTextInput = document.querySelector("#article-text");
const loadArticleButton = document.querySelector("#load-article");
const useArticleTextButton = document.querySelector("#use-article-text");
const generateQuizButton = document.querySelector("#generate-quiz");
const articleStatus = document.querySelector("#article-status");
const articlePreview = document.querySelector("#article-preview");

const state = {
  articleText: "",
  quiz: null,
  index: 0,
  score: 0,
  loading: false,
  availableQuizzes: [],
  selectedQuizIndex: null,
  mode: 'selection', // 'selection', 'question', 'results'
};

// Initialize the application
async function initializeApp() {
  try {
    await loadAvailableQuizzes();
    showQuizSelection();
  } catch (error) {
    console.error("Failed to initialize app:", error);
    quizContainer.innerHTML = `
      <div class="error-message">
        <p>Failed to load quizzes. Please refresh the page.</p>
      </div>
    `;
  }
}

// Load quizzes from quizzes.jsonl file
async function loadAvailableQuizzes() {
  try {
    const response = await fetch('quizzes.jsonl');
    if (!response.ok) {
      throw new Error(`Failed to load quizzes: ${response.status}`);
    }
    
    const text = await response.text();
    const lines = text.trim().split('\n').filter(line => line.trim());
    
    state.availableQuizzes = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (error) {
        console.warn("Failed to parse quiz line:", line);
        return null;
      }
    }).filter(quiz => quiz !== null);
    
    if (state.availableQuizzes.length === 0) {
      throw new Error("No valid quizzes found");
    }
    
  } catch (error) {
    console.error("Error loading quizzes:", error);
    throw error;
  }
}

// Show quiz selection screen
function showQuizSelection() {
  state.mode = 'selection';
  
  const options = state.availableQuizzes.map((quiz, index) => 
    `<option value="${index}">${quiz.header || `Quiz ${index + 1}`}</option>`
  ).join('');
  
  quizContainer.innerHTML = `
    <div class="quiz-selection">
      <h2>Select a Quiz</h2>
      <div class="form">
        <div class="form__group">
          <select id="quiz-select" class="form__input" required>
            <option value="">-- Select a quiz --</option>
            ${options}
          </select>
        </div>
        <div id="quiz-subtitle-display" class="quiz-subtitle-display"></div>
        <div class="form__actions">
          <button id="load-quiz" type="button" class="button button--primary" disabled>
            Load Quiz
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Add event listeners for the dynamically created elements
  const quizSelect = document.querySelector("#quiz-select");
  const loadQuizButton = document.querySelector("#load-quiz");
  const subtitleDisplay = document.querySelector("#quiz-subtitle-display");
  
  quizSelect.addEventListener("change", () => {
    const selectedIndex = parseInt(quizSelect.value);
    state.selectedQuizIndex = isNaN(selectedIndex) ? null : selectedIndex;
    loadQuizButton.disabled = state.selectedQuizIndex === null;
    
    // Show subtitle below select box when quiz is selected
    if (state.selectedQuizIndex !== null) {
      const quiz = state.availableQuizzes[state.selectedQuizIndex];
      subtitleDisplay.innerHTML = `
        <div class="quiz-info">
          <p class="quiz-subtitle-text">${quiz.subtitle || ""}</p>
          <p class="quiz-questions-count">${quiz.questions.length} questions</p>
        </div>
      `;
    } else {
      subtitleDisplay.innerHTML = "";
    }
  });
  
  loadQuizButton.addEventListener("click", () => {
    if (state.selectedQuizIndex !== null) {
      startQuiz();
    }
  });
}

// Start the selected quiz
function startQuiz() {
  const selectedQuiz = state.availableQuizzes[state.selectedQuizIndex];
  state.quiz = selectedQuiz;
  state.index = 0;
  state.score = 0;
  state.mode = 'question';
  
  showQuizQuestion();
}

// Show quiz question screen
function showQuizQuestion() {
  const quiz = state.quiz;
  if (!quiz || state.index >= quiz.questions.length) {
    showQuizResults();
    return;
  }
  
  const current = quiz.questions[state.index];
  const total = quiz.questions.length;
  
  const options = current.options.map((option, idx) => 
    `<button type="button" class="quiz__option" data-index="${idx}">
      ${idx + 1}. ${option}
    </button>`
  ).join('');
  
  quizContainer.innerHTML = `
    <div class="quiz-question">
      <div class="quiz-header">
        <h3 class="quiz-title">${quiz.header}</h3>
        <p class="quiz-subtitle">${quiz.subtitle || ""}</p>
      </div>
      <p class="question-text">Question ${state.index + 1} of ${total}: ${current.question}</p>
      <div class="quiz__options" role="group" aria-live="polite">
        ${options}
      </div>
    </div>
  `;
  
  // Add event listeners to option buttons
  const optionButtons = document.querySelectorAll(".quiz__option");
  optionButtons.forEach(button => {
    button.addEventListener("click", () => {
      const choiceIndex = parseInt(button.dataset.index);
      handleAnswer(choiceIndex);
    });
  });
}

// Show quiz results screen
function showQuizResults() {
  state.mode = 'results';
  const total = state.quiz.questions.length;
  
  quizContainer.innerHTML = `
    <div class="quiz-results">
      <div class="score-display">Score: ${state.score} / ${total}</div>
      <h3 class="learnings-heading">Final learnings</h3>
      <p class="learnings-text">${state.quiz.final_learnings || ""}</p>
      <div class="quiz__retry-link">
        <a href="#" id="take-another-quiz">Take another quiz</a>
      </div>
    </div>
  `;
  
  // Add event listener for the retry link
  document.querySelector("#take-another-quiz").addEventListener("click", (e) => {
    e.preventDefault();
    showQuizSelection();
  });
}

// Handle answer selection
function handleAnswer(choiceIndex) {
  const question = state.quiz.questions[state.index];
  const correctIndex = question.correct;
  const buttons = document.querySelectorAll(".quiz__option");
  
  buttons.forEach((button, idx) => {
    button.disabled = true;
    if (idx === correctIndex) {
      button.classList.add("quiz__option--correct");
    }
    if (idx === choiceIndex && choiceIndex !== correctIndex) {
      button.classList.add("quiz__option--incorrect");
    }
  });
  
  if (choiceIndex === correctIndex) {
    state.score += 1;
  }
  
  setTimeout(() => {
    state.index += 1;
    showQuizQuestion();
  }, 1200);
}

// Commented out original article loading functionality (kept for compatibility)
/*
loadArticleButton.addEventListener("click", async () => {
  if (state.loading) {
    return;
  }
  const urlValue = articleUrlInput.value.trim();
  if (!urlValue) {
    setStatus("Enter an article URL before loading.", true);
    articleUrlInput.focus();
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(urlValue);
  } catch {
    setStatus("That URL does not look valid. Please double-check and try again.", true);
    articleUrlInput.focus();
    return;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    setStatus("Only HTTP and HTTPS URLs are supported.", true);
    articleUrlInput.focus();
    return;
  }

  setStatus("Loading article text…");
  toggleLoading(true);

  try {
    const text = await loadArticleText(parsedUrl.toString());
    applyArticleText(text);
    articleTextInput.value = state.articleText;
    setStatus("Article loaded. Review the summary and generate your quiz!");
  } catch (error) {
    setStatus(error.message || "Could not load the article. Please try another URL.", true);
  } finally {
    toggleLoading(false);
  }
});

useArticleTextButton.addEventListener("click", () => {
  if (state.loading) {
    return;
  }

  const manualText = articleTextInput.value.trim();
  if (!manualText) {
    setStatus("Paste some article text before using it.", true);
    articleTextInput.focus();
    return;
  }

  applyArticleText(manualText);
  setStatus("Using pasted text. Quiz ready when you are!");
});

generateQuizButton.addEventListener("click", async () => {
  if (state.loading) {
    return;
  }

  if (!state.articleText) {
    setStatus("Load an article first.", true);
    articleUrlInput.focus();
    return;
  }

  resetQuizUI();

  setStatus("Generating quiz… this can take a few seconds.");
  toggleLoading(true);

  try {
    const quiz = await generateQuiz(state.articleText);
    state.quiz = quiz;
    state.index = 0;
    state.score = 0;
    displayQuizMetadata(quiz);
    renderQuestion();
    setStatus("Quiz ready. Answer the question below!");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Something went wrong while generating the quiz.", true);
  } finally {
    toggleLoading(false);
  }
});

function toggleLoading(value) {
  state.loading = value;
  // Original article loading buttons (kept for compatibility)
  loadArticleButton.disabled = value;
  useArticleTextButton.disabled = value;
  generateQuizButton.disabled = value || !state.articleText;
}

async function loadArticleText(url) {
  const proxiedUrl = `https://r.jina.ai/${url}`;
  let response;
  try {
    response = await fetch(proxiedUrl, {
      headers: {
        Accept: "text/plain",
      },
    });
  } catch (error) {
    console.error(error);
    throw new Error("Network error while loading the article.");
  }

  if (!response.ok) {
    throw new Error(`Article request failed (${response.status}).`);
  }

  const rawText = (await response.text()).trim();
  if (!rawText) {
    throw new Error("The article appears to be empty.");
  }

  const botBlockedPatterns = [/verifying that you are not a robot/i, /enable javascript and cookies/i];
  if (botBlockedPatterns.some((pattern) => pattern.test(rawText))) {
    throw new Error(
      "This site is blocking automated access. Try pasting the article text manually instead."
    );
  }

  return rawText;
}

function applyArticleText(rawText) {
  const truncated = rawText.slice(0, MAX_ARTICLE_CHARACTERS);
  state.articleText = truncated;

  const totalWords = rawText.split(/\s+/).filter(Boolean).length;
  const truncatedWords = state.articleText.split(/\s+/).filter(Boolean).length;
  const truncatedNotice =
    truncated.length < rawText.length
      ? ` Trimmed to ${truncatedWords} words to fit within the prompt budget.`
      : "";

  articleStatus.textContent = `Loaded ${totalWords} words.${truncatedNotice}`;
  const previewSnippet = state.articleText.slice(0, PREVIEW_CHARACTERS);
  articlePreview.textContent =
    previewSnippet + (state.articleText.length > PREVIEW_CHARACTERS ? "\n\n…" : "");
  if (!articleTextInput.value.trim()) {
    articleTextInput.value = state.articleText;
  }

  generateQuizButton.disabled = false;
  resetQuizUI();
}

function clearArticleState() {
  state.articleText = "";
  articleStatus.textContent = "No article loaded yet.";
  articlePreview.textContent = "";
  generateQuizButton.disabled = true;
  resetQuizUI();
}

async function generateQuiz(text) {
  if (!text.trim()) {
    throw new Error("There is no article text to summarize. Load or paste content first.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: text },
      ],
      response_format: RESPONSE_FORMAT,
    }),
  });

  if (!response.ok) {
    const errorBody = await safeParseJson(response);
    const detail = errorBody?.error?.message || response.statusText;
    throw new Error(`Quiz request failed: ${detail}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Assistant response did not include any quiz content.");
  }

  let quiz;
  try {
    quiz = JSON.parse(content);
  } catch (error) {
    console.error(error);
    throw new Error("Assistant response was not valid JSON.");
  }

  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    throw new Error("Quiz response did not include any questions.");
  }

  return quiz;
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
*/





// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', initializeApp);
