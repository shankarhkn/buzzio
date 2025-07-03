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
    const questionElem = document.getElementById('questionText');
    const resultElem = document.getElementById('result');
    if (questionElem) questionElem.textContent = q.questionText;
    if (resultElem) resultElem.textContent = '';
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

    const resultElem = document.getElementById('result');
    if (resultElem) resultElem.textContent = 'Listening for your answer...';

    // Only set event handlers if recognition is valid
    if (recognition) {
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            handleAnswer(transcript);
        };

        recognition.onerror = (event) => {
            if (resultElem) resultElem.textContent = 'Speech recognition error: ' + event.error;
        };

        recognition.onend = () => {
            if (resultElem && resultElem.textContent === 'Listening for your answer...') {
                resultElem.textContent = 'No answer detected. Try buzzing again.';
            }
        };

        recognition.start();
    }
}

function handleAnswer(answerText) {
    if (recognition) recognition.stop();

    const correctAnswer = questions[currentIndex].answer.toLowerCase();
    const userAnswer = answerText.toLowerCase();

    const isCorrect = checkAnswer(userAnswer, correctAnswer);

    const resultElem = document.getElementById('result');
    if (resultElem) {
        resultElem.textContent =
            `You answered: "${answerText}". That is ${isCorrect ? 'correct!' : 'incorrect.'}`;
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

function readCurrentQuestion() {
    reading = true;
    speak(questions[currentIndex].questionText, () => {
        reading = false;
    });
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
        const questionElem = document.getElementById('questionText');
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
