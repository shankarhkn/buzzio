let questions = [];
let currentIndex = 0;
let reading = false;
let recognition = null;

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

function speak(text, onEnd) {
    if (!('speechSynthesis' in window)) {
        alert('Text-to-speech not supported in your browser.');
        return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    if (onEnd) utterance.onend = onEnd;
    speechSynthesis.speak(utterance);
    reading = true;
}

function stopSpeaking() {
    if ('speechSynthesis' in window && speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    reading = false;
}

function showQuestion(index) {
    const q = questions[index];
    document.getElementById('questionText').textContent = q.questionText;
    document.getElementById('result').textContent = '';
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

    document.getElementById('result').textContent = 'Listening for your answer...';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleAnswer(transcript);
    };

    recognition.onerror = (event) => {
        document.getElementById('result').textContent = 'Speech recognition error: ' + event.error;
    };

    recognition.onend = () => {
        if (document.getElementById('result').textContent === 'Listening for your answer...') {
            document.getElementById('result').textContent = 'No answer detected. Try buzzing again.';
        }
    };

    recognition.start();
}

function handleAnswer(answerText) {
    if (recognition) recognition.stop();

    const correctAnswer = questions[currentIndex].answer.toLowerCase();
    const userAnswer = answerText.toLowerCase();

    const isCorrect = checkAnswer(userAnswer, correctAnswer);

    document.getElementById('result').textContent =
        `You answered: "${answerText}". That is ${isCorrect ? 'correct!' : 'incorrect.'}`;
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

function readCurrentQuestion() {
    reading = true;
    speak(questions[currentIndex].questionText, () => {
        reading = false;
    });
}

// Keyboard buzz detection
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        onBuzz();
    }
});

// Button event listeners
window.onload = async () => {
    questions = await loadPacket('packet.txt');
    if (questions.length === 0) {
        document.getElementById('questionText').textContent = 'No questions loaded.';
        return;
    }
    showQuestion(currentIndex);
    readCurrentQuestion();

    document.getElementById('nextBtn').addEventListener('click', () => {
        nextQuestion();
    });

    document.getElementById('repeatBtn').addEventListener('click', () => {
        if (!reading) readCurrentQuestion();
    });
};
