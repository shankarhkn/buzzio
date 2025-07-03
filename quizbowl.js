let questions = [];
let currentIndex = 0;

let reading = false;
let recognition = null;
let utterance = null;

let sentences = [];
let currentSentenceIndex = 0;
let displayedText = '';

let category = '';
let year = '';
let level = '';
let round = '';

let currentQuestionIndex = 0;
let packetData = null;  // This will hold metadata and questions once loaded

async function initialize() {
    packetData = await loadPacket('packet.txt');
    questions = packetData.questions;

    if (!questions || questions.length === 0) {
        questionElem.textContent = 'No questions loaded.';
        enableButtons(false);
        return;
    }

    shuffleArray(questions);
    currentQuestionIndex = 0;

    updateMetadataDisplay(currentQuestionIndex, packetData);
    showQuestion(currentQuestionIndex);
    enableButtons(true);
}
function showQuestion(index) {
    const question = questions[index];
    if (!question) {
        questionElem.textContent = 'No question available.';
        return;
    }

    questionElem.textContent = '';  // Empty until spoken
    resultElem.textContent = '';    // Clear any previous result
    displayedText = '';
    sentences = splitIntoSentences(question.questionText);
    currentSentenceIndex = 0;
}

  

const questionElem = document.getElementById('questionText');
const resultElem = document.getElementById('result');
const buzzBtn = document.getElementById('buzzBtn');
const startReadingBtn = document.getElementById('startReadingBtn');
const nextBtn = document.getElementById('nextBtn');
const repeatBtn = document.getElementById('repeatBtn');
const speedSlider = document.getElementById('speedSlider');
const speedDisplay = document.getElementById('speedDisplay');
const metaElem = document.getElementById('metadata'); // new element to show metadata

async function loadPacket(url) {
    const response = await fetch(url);
    const text = await response.text();

    // Parse metadata
    let category = '', year = '', level = '', round = '';
    const metaLines = text.split(/\r?\n/).slice(0, 10);
    metaLines.forEach(line => {
        if (line.toLowerCase().startsWith('category:')) category = line.split(':')[1].trim();
        else if (line.toLowerCase().startsWith('year:')) year = line.split(':')[1].trim();
        else if (line.toLowerCase().startsWith('level:')) level = line.split(':')[1].trim();
        else if (line.toLowerCase().startsWith('round:')) round = line.split(':')[1].trim();
    });

    // Extract all question blocks separated by ***
    const rawQuestions = text.split('***').map(s => s.trim()).filter(s => s.length > 0);

    // Parse each question block
    const parsedQuestions = rawQuestions.map(raw => {
        // Split lines for each block
        const lines = raw.split(/\r?\n/);

        // Find line starting with ANSWER:
        const answerIndex = lines.findIndex(line => line.toUpperCase().startsWith('ANSWER:'));

        if (answerIndex === -1) {
            // No answer line found, skip
            return null;
        }

        // Question lines: from start to answerIndex - 1
        const questionLines = lines.slice(0, answerIndex);

        // Join question lines, remove leading question number if present (like "(1)")
        let questionText = questionLines.join(' ').replace(/^\(\d+\)\s*/, '').trim();

        // Answer lines: from answerIndex to end
        const answerText = lines.slice(answerIndex)[0].replace(/^ANSWER:\s*/i, '').trim();

        return {
            questionText,
            answer: answerText
        };
    }).filter(q => q !== null);

    return { category, year, level, round, questions: parsedQuestions };
}

function updateMetadataDisplay(currentIndex, packetData) {
  document.getElementById('question-category').textContent = packetData.category || 'Unknown Category';
  document.getElementById('question-year').textContent = packetData.year || 'Unknown Year';
  document.getElementById('question-level').textContent = packetData.level || 'Unknown Level';
  document.getElementById('question-round').textContent = packetData.round || 'Unknown Round';
  document.getElementById('question-number').textContent = `Q${currentIndex + 1}`;
}


function splitIntoSentences(text) {
    return text.match(/[^.!?]+[.!?]?/g).map(s => s.trim());
}

function speakSentence(sentence, onWordCallback, onEnd) {
    if (!('speechSynthesis' in window)) {
        alert('Text-to-speech not supported in your browser.');
        return;
    }

    window.speechSynthesis.cancel();

    utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = 'en-US';
    utterance.rate = parseFloat(speedSlider.value);

    utterance.onboundary = (event) => {
        if (event.name === 'word') {
            const charIndex = event.charIndex;
            const word = getWordAt(sentence, charIndex);
            if (onWordCallback) onWordCallback(word);
        }
    };

    utterance.onend = () => {
        if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
    reading = true;
}

function getWordAt(text, charIndex) {
    const words = text.split(/\s+/);
    let count = 0;
    for (const word of words) {
        if (charIndex >= count && charIndex < count + word.length) {
            return word;
        }
        count += word.length + 1;
    }
    return '';
}

function updateDisplayedText(sentence, spokenWords) {
    let previousSentencesText = sentences.slice(0, currentSentenceIndex).join(' ') + ' ';
    let currentText = spokenWords.join(' ');
    questionElem.textContent = (previousSentencesText + currentText).trim();
}

function readCurrentQuestion() {
    if (reading) return;

    sentences = splitIntoSentences(questions[currentIndex].questionText);
    currentSentenceIndex = 0;
    displayedText = '';
    questionElem.textContent = '';

    readNextSentence();
}

function readNextSentence() {
    if (currentSentenceIndex >= sentences.length) {
        reading = false;
        enableButtons(true);
        return;
    }

    const sentence = sentences[currentSentenceIndex];
    let spokenWords = [];

    enableButtons(false);

    utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = 'en-US';
    utterance.rate = parseFloat(speedSlider.value);

    utterance.onboundary = (event) => {
        if (event.name === 'word') {
            const charIndex = event.charIndex;
            const word = getWordAt(sentence, charIndex);
            if (word) {
                spokenWords.push(word);
                updateDisplayedText(sentence, spokenWords);
            }
        }
    };

    utterance.onend = () => {
        setTimeout(() => {
            currentSentenceIndex++;
            readNextSentence();
        }, 400);
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    reading = true;
}

function stopSpeaking() {
    if ('speechSynthesis' in window && speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    reading = false;
    enableButtons(true);
}

function enableButtons(enabled) {
    buzzBtn.disabled = !enabled;
    nextBtn.disabled = !enabled;
    repeatBtn.disabled = !enabled;
    startReadingBtn.disabled = !enabled;
}

function startRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Speech recognition not supported in your browser.');
        return null;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    return rec;
}

function onBuzz() {
    if (!reading) return;

    stopSpeaking();

    recognition = startRecognition();
    if (!recognition) return;

    resultElem.textContent = 'Listening for your answer...';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleAnswer(transcript);
    };

    recognition.onerror = (event) => {
        resultElem.textContent = 'Speech recognition error: ' + event.error;
    };

    recognition.onend = () => {
        if (resultElem.textContent === 'Listening for your answer...') {
            resultElem.textContent = 'No answer detected. Try buzzing again.';
        }
    };

    recognition.start();
}

function handleAnswer(answerText) {
    if (recognition) recognition.stop();

    const correctAnswer = questions[currentIndex].answer.toLowerCase();
    const userAnswer = answerText.toLowerCase();

    const isCorrect = checkAnswer(userAnswer, correctAnswer);

    if (resultElem) {
        if (isCorrect) {
            resultElem.textContent = `You answered: "${answerText}". That is correct! 🎉`;
        } else {
            resultElem.textContent = `You answered: "${answerText}". That is incorrect. The correct answer is: "${questions[currentIndex].answer}".`;
        }
    }
}

function checkAnswer(userAnswer, correctAnswer) {
    return userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer);
}

function nextQuestion() {
    if (currentQuestionIndex + 1 < questions.length) {
        currentQuestionIndex++;
        updateMetadataDisplay(currentQuestionIndex, packetData);
        showQuestion(currentQuestionIndex);
    }
}
  

function resetUIForNewQuestion() {
    questionElem.textContent = '';
    resultElem.textContent = '';
    displayedText = '';
    sentences = [];
    currentSentenceIndex = 0;
    reading = false;
    enableButtons(true);
}

function repeatQuestion() {
    if (!reading) {
        readCurrentQuestion();
        resultElem.textContent = '';
    }
}
window.onload = async () => {
    packetData = await loadPacket('packet.txt');
    questions = packetData.questions || [];

    if (questions.length === 0) {
        questionElem.textContent = 'No questions loaded.';
        enableButtons(false);
        return;
    }

    shuffleArray(questions);
    currentQuestionIndex = 0;

    updateMetadataDisplay(currentQuestionIndex, packetData);
    showQuestion(currentQuestionIndex);
    enableButtons(true);
    resetUIForNewQuestion();

    startReadingBtn.addEventListener('click', () => {
        if (!reading) {
            readCurrentQuestion();
            resultElem.textContent = '';
        }
    });

    buzzBtn.addEventListener('click', () => {
        onBuzz();
    });

    nextBtn.addEventListener('click', () => {
        nextQuestion();
    });

    repeatBtn.addEventListener('click', () => {
        repeatQuestion();
    });

    speedSlider.addEventListener('input', () => {
        speedDisplay.textContent = speedSlider.value + 'x';
    });

    speedDisplay.textContent = speedSlider.value + 'x';
};

  

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        onBuzz();
    }
});
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

  