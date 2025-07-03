let questions = [];
let currentIndex = 0;

let reading = false;
let recognition = null;
let utterance = null;

let sentences = [];
let currentSentenceIndex = 0;
let displayedText = '';

const questionElem = document.getElementById('questionText');
const resultElem = document.getElementById('result');
const buzzBtn = document.getElementById('buzzBtn');
const startReadingBtn = document.getElementById('startReadingBtn');
const nextBtn = document.getElementById('nextBtn');
const repeatBtn = document.getElementById('repeatBtn');
const speedSlider = document.getElementById('speedSlider');
const speedDisplay = document.getElementById('speedDisplay');

async function loadPacket(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load packet');
        const text = await response.text();
        const rawQuestions = text.split('***');

        const parsedQuestions = rawQuestions.map(raw => {
            const lines = raw.trim().split('\n');
            const answerLine = lines.find(line => line.toLowerCase().startsWith('answer:'));
            const answer = answerLine ? answerLine.replace(/answer:/i, '').trim() : '';
            const questionText = lines.filter(line => !line.toLowerCase().startsWith('answer:')).join(' ').trim();
            return { questionText, answer };
        }).filter(q => q.questionText.length > 0);

        return parsedQuestions;
    } catch (error) {
        alert('Error loading packet: ' + error.message);
        return [];
    }
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
    if (reading) stopSpeaking();

    currentIndex++;
    if (currentIndex >= questions.length) {
        currentIndex = 0;
    }
    resetUIForNewQuestion();
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
    questions = await loadPacket('packet.txt');
    if (questions.length === 0) {
        questionElem.textContent = 'No questions loaded.';
        enableButtons(false);
        return;
    }

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
    enableButtons(true);
};

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        onBuzz();
    }
});
