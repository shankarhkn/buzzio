let questions = [];
let currentIndex = 0;
let reading = false;
let recognition = null;
let wordSpans = [];

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

function showQuestion(index) {
    const q = questions[index];
    const questionElem = document.getElementById('questionText');
    const resultElem = document.getElementById('result');
    resultElem.textContent = '';

    if (!questionElem) return;

    questionElem.innerHTML = '';
    const words = q.questionText.split(/\s+/);
    wordSpans = words.map((word, i) => {
        const span = document.createElement('span');
        span.textContent = word + ' ';
        questionElem.appendChild(span);
        return span;
    });
}

function speakWordByWord(text, onEnd) {
    if (!('speechSynthesis' in window)) {
        alert('Text-to-speech not supported in your browser.');
        return;
    }

    const words = text.split(/\s+/);
    let index = 0;

    const speakNext = () => {
        if (index >= words.length) {
            reading = false;
            if (onEnd) onEnd();
            return;
        }

        const word = words[index];
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';

        // Highlight the word
        wordSpans.forEach((span, i) => {
            span.classList.toggle('visible', i === index);
        });

        utterance.onend = () => {
            index++;
            speakNext();
        };

        speechSynthesis.speak(utterance);
    };

    reading = true;
    speakNext();
}

function stopSpeaking() {
    if ('speechSynthesis' in window && speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    reading = false;
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
    if (!reading) return; // Only buzz during reading

    stopSpeaking();

    recognition = startRecognition();
    if (!recognition) return;

    const resultElem = document.getElementById('result');
    resultElem.textContent = 'Listening for your answer...';
    resultElem.className = 'listening';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleAnswer(transcript);
    };

    recognition.onerror = (event) => {
        resultElem.textContent = 'Speech recognition error: ' + event.error;
        resultElem.className = 'error';
    };

    recognition.onend = () => {
        if (resultElem.textContent === 'Listening for your answer...') {
            resultElem.textContent = 'No answer detected. Try buzzing again.';
            resultElem.className = 'warning';
        }
    };

    recognition.start();
}

function handleAnswer(answerText) {
    if (recognition) recognition.stop();

    const correctAnswer = questions[currentIndex].answer.toLowerCase();
    const userAnswer = answerText.toLowerCase();

    const isCorrect = checkAnswer(userAnswer, correctAnswer);

    const resultElem = document.getElementById('result');
    if (resultElem) {
        resultElem.innerHTML =
            `You answered: "<strong>${answerText}</strong>".<br>` +
            (isCorrect
                ? `<span class="correct">That is correct!</span>`
                : `<span class="incorrect">That is incorrect.</span> The correct answer was: <strong>${questions[currentIndex].answer}</strong>.`);
        resultElem.className = isCorrect ? 'correct' : 'incorrect';
    }
}

function checkAnswer(userAnswer, correctAnswer) {
    return userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer);
}

function nextQuestion() {
    stopSpeaking();

    currentIndex++;
    if (currentIndex >= questions.length) {
        currentIndex = 0;
    }
    showQuestion(currentIndex);
    readCurrentQuestion();
}

function readCurrentQuestion() {
    const q = questions[currentIndex];
    speakWordByWord(q.questionText);
}

// Keyboard buzz detection (spacebar)
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        onBuzz();
    }
});

// Init
window.onload = async () => {
    questions = await loadPacket('packet.txt');
    if (questions.length === 0) {
        document.getElementById('questionText').textContent = 'No questions loaded.';
        return;
    }

    showQuestion(currentIndex);

    document.getElementById('startBtn').addEventListener('click', () => {
        if (!reading) readCurrentQuestion();
    });

    document.getElementById('nextBtn').addEventListener('click', () => {
        nextQuestion();
    });

    document.getElementById('repeatBtn').addEventListener('click', () => {
        if (!reading) readCurrentQuestion();
    });

    document.getElementById('buzzBtn').addEventListener('click', () => {
        onBuzz();
    });
};
