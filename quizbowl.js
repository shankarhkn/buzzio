let questions = [];
let currentIndex = 0;
let reading = false;
let recognition = null;
let currentUtterance = null;

const questionElem = document.getElementById('questionText');
const resultElem = document.getElementById('result');

function clearQuestionDisplay() {
    if (questionElem) questionElem.textContent = '';
}

function showQuestionWords(words, highlightIndex = -1) {
    if (!questionElem) return;
    questionElem.innerHTML = words
        .map((w, i) =>
            i <= highlightIndex
                ? `<span class="highlighted">${w}</span>`
                : `<span class="hidden-word">${w}</span>`
        )
        .join(' ');
}

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

function setStatus(text, className) {
    if (!resultElem) return;
    resultElem.textContent = text;
    resultElem.className = className || '';
}

function speakWithSync(text, onEnd) {
    if (!('speechSynthesis' in window)) {
        alert('Text-to-speech not supported in your browser.');
        setStatus('Idle', 'idle');
        return;
    }

    stopSpeaking();

    const words = text.split(/\s+/);
    let wordCount = 0;

    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = 'en-US';

    clearQuestionDisplay();

    currentUtterance.onboundary = (event) => {
        if (event.name === 'word') {
            // increment word count on each boundary event
            wordCount++;
            showQuestionWords(words, wordCount - 1);
        }
    };

    currentUtterance.onend = () => {
        reading = false;
        setStatus('Idle', 'idle');
        showQuestionWords(words, words.length - 1);
        if (onEnd) onEnd();
    };

    currentUtterance.onerror = () => {
        reading = false;
        setStatus('Idle', 'idle');
        showQuestionWords(words, words.length - 1);
        if (onEnd) onEnd();
    };

    reading = true;
    setStatus('Reading question...', 'reading');
    speechSynthesis.speak(currentUtterance);
}

function stopSpeaking() {
    if ('speechSynthesis' in window && speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    reading = false;
    setStatus('Idle', 'idle');
    if (questions[currentIndex]) {
        showQuestionWords(questions[currentIndex].questionText.split(/\s+/), -1);
    }
}

function showQuestion(index) {
    if (!questions[index]) return;
    clearQuestionDisplay();
    setStatus('', '');
}

function readCurrentQuestion() {
    if (!questions[currentIndex]) return;
    speakWithSync(questions[currentIndex].questionText, () => {
        reading = false;
        setStatus('Idle', 'idle');
    });
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
    if (!reading) return; // Only allow buzz if reading question

    stopSpeaking();

    recognition = startRecognition();
    if (!recognition) return;

    setStatus('Listening for your answer...', 'listening');

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleAnswer(transcript);
    };

    recognition.onerror = (event) => {
        setStatus('Speech recognition error: ' + event.error, 'error');
    };

    recognition.onend = () => {
        if (resultElem.textContent === 'Listening for your answer...') {
            setStatus('No answer detected. Try buzzing again.', 'warning');
        }
    };

    recognition.start();
}

function handleAnswer(answerText) {
    if (recognition) recognition.stop();

    const correctAnswer = questions[currentIndex].answer.toLowerCase().trim();
    const userAnswer = answerText.toLowerCase().trim();

    const isCorrect = checkAnswer(userAnswer, correctAnswer);

    if (isCorrect) {
        setStatus(`You answered: "${answerText}". That is correct!`, 'correct');
    } else {
        setStatus(
            `You answered: "${answerText}". That is incorrect. Correct answer: "${questions[currentIndex].answer}"`,
            'incorrect'
        );
    }
}

function checkAnswer(userAnswer, correctAnswer) {
    // Basic contains check or exact match - can improve with fuzzy matching
    return userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer);
}

function nextQuestion() {
    if (reading) stopSpeaking();

    currentIndex++;
    if (currentIndex >= questions.length) {
        currentIndex = 0; // loop back to start
    }
    showQuestion(currentIndex);
    readCurrentQuestion();
}

// Keyboard buzz detection (spacebar)
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        onBuzz();
    }
});

// Initialization
window.onload = async () => {
    questions = await loadPacket('packet.txt');
    if (questions.length === 0) {
        if (questionElem) questionElem.textContent = 'No questions loaded.';
        return;
    }

    showQuestion(currentIndex);

    document.getElementById('nextBtn').addEventListener('click', () => {
        nextQuestion();
    });

    document.getElementById('repeatBtn').addEventListener('click', () => {
        if (!reading) readCurrentQuestion();
    });

    // Add a "Start Reading" button to trigger TTS on user gesture (some browsers require interaction)
    const startButton = document.createElement('button');
    startButton.textContent = "Start Reading";
    startButton.style.marginTop = "20px";
    startButton.onclick = () => {
        readCurrentQuestion();
        startButton.remove();
    };
    document.querySelector('.controls').appendChild(startButton);
};
