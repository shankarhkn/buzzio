let questions = [];
let currentIndex = 0;
let reading = false;
let recognition = null;
let buzzing = false;

const questionElem = document.getElementById('questionText');
const resultElem = document.getElementById('result');
const statusElem = document.getElementById('status');
const buzzBtn = document.getElementById('buzzBtn');
const nextBtn = document.getElementById('nextBtn');
const repeatBtn = document.getElementById('repeatBtn');
const startReadingBtn = document.getElementById('startReadingBtn');

async function loadPacket(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load packet');
        const text = await response.text();
        const rawQuestions = text.split('***');

        const parsedQuestions = rawQuestions
            .map((raw) => {
                const lines = raw.trim().split('\n');
                const answerLine = lines.find((line) => line.toLowerCase().startsWith('answer:'));
                const answer = answerLine ? answerLine.replace(/answer:/i, '').trim() : '';
                const questionText = lines.filter((line) => !line.toLowerCase().startsWith('answer:')).join(' ').trim();
                return { questionText, answer };
            })
            .filter((q) => q.questionText.length > 0);

        return parsedQuestions;
    } catch (error) {
        alert('Error loading packet: ' + error.message);
        return [];
    }
}

function setStatus(text, state) {
    statusElem.textContent = text;
    statusElem.className = 'status ' + state;
}

function speak(text, onEnd) {
    if (!('speechSynthesis' in window)) {
        alert('Text-to-speech not supported in your browser.');
        setStatus('Idle', 'idle');
        return;
    }

    stopSpeaking(); // Cancel any ongoing speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.onend = () => {
        reading = false;
        setStatus('Idle', 'idle');
        if (onEnd) onEnd();
    };

    utterance.onerror = () => {
        reading = false;
        setStatus('Idle', 'idle');
        if (onEnd) onEnd();
    };

    reading = true;
    setStatus('Reading question...', 'reading');
    speechSynthesis.speak(utterance);
}

function stopSpeaking() {
    if ('speechSynthesis' in window && speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    reading = false;
    setStatus('Idle', 'idle');
}

function fadeOut(element, callback) {
    element.classList.add('fade-out');
    element.classList.remove('fade-in');
    setTimeout(() => {
        callback();
        element.classList.remove('fade-out');
        element.classList.add('fade-in');
    }, 500);
}

function showQuestion(index) {
    if (!questions[index]) return;

    fadeOut(questionElem, () => {
        questionElem.textContent = questions[index].questionText;
        resultElem.textContent = '';
    });
}

function playBuzzSound() {
    try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const o = context.createOscillator();
        const g = context.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(600, context.currentTime);
        g.gain.setValueAtTime(0.1, context.currentTime);
        o.connect(g);
        g.connect(context.destination);
        o.start();
        o.stop(context.currentTime + 0.1);
    } catch {
        // no audio context support
    }
}

function startRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Speech recognition not supported in your browser.');
        setStatus('Idle', 'idle');
        return null;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    return rec;
}

function onBuzz() {
    if (!reading || buzzing) return; // Only buzz during reading and if not already buzzing

    buzzing = true;
    playBuzzSound();
    stopSpeaking();

    recognition = startRecognition();
    if (!recognition) {
        buzzing = false;
        return;
    }

    setStatus('Listening for your answer...', 'listening');
    resultElem.textContent = '';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleAnswer(transcript);
    };

    recognition.onerror = (event) => {
        setStatus('Idle', 'idle');
        resultElem.textContent = 'Speech recognition error: ' + event.error;
        buzzing = false;
    };

    recognition.onend = () => {
        if (statusElem.textContent === 'Listening for your answer...') {
            resultElem.textContent = 'No answer detected. Try buzzing again.';
            setStatus('Idle', 'idle');
        }
        buzzing = false;
    };

    recognition.start();
}

function normalizeText(str) {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function similarity(s1, s2) {
    // Simple similarity: ratio of common words to total words
    const a1 = normalizeText(s1).split(' ');
    const a2 = normalizeText(s2).split(' ');

    if (a1.length === 0 || a2.length === 0) return 0;

    const common = a1.filter((w) => a2.includes(w)).length;
    return common / Math.max(a1.length, a2.length);
}

function checkAnswer(userAnswer, correctAnswer) {
    const sim = similarity(userAnswer, correctAnswer);
    // Consider correct if similarity > 0.5 or userAnswer contains correctAnswer string directly
    return sim > 0.5 || userAnswer.includes(correctAnswer);
}

function handleAnswer(answerText) {
    if (recognition) recognition.stop();
    buzzing = false;

    const correctAnswer = questions[currentIndex].answer.toLowerCase();
    const userAnswer = answerText.toLowerCase();

    const isCorrect = checkAnswer(userAnswer, correctAnswer);

    resultElem.textContent = `You answered: "${answerText}". That is ${isCorrect ? 'correct!' : 'incorrect.'}`;
    setStatus('Idle', 'idle');
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
    setStatus('Reading question...', 'reading');
    speak(questions[currentIndex].questionText, () => {
        reading = false;
        setStatus('Idle', 'idle');
    });
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !buzzing) {
        e.preventDefault();
        onBuzz();
    }
});

// Initialization
window.onload = async () => {
    questions = await loadPacket('packet.txt');
    if (questions.length === 0) {
        questionElem.textContent = 'No questions loaded.';
        setStatus('Idle', 'idle');
        return;
    }

    showQuestion(currentIndex);

    buzzBtn.addEventListener('click', () => onBuzz());
    nextBtn.addEventListener('click', () => nextQuestion());
    repeatBtn.addEventListener('click', () => {
        if (!reading) readCurrentQuestion();
    });
    startReadingBtn.addEventListener('click', () => {
        readCurrentQuestion();
        startReadingBtn.disabled = true;
    });
};
