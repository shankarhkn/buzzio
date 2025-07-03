let questions = [];
let currentIndex = 0;
let reading = false;
let recognition = null;
let speechRate = 1.5; // default speech rate

async function loadPacket(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load packet');
        const text = await response.text();
        const rawQuestions = text.split('***');

        const parsedQuestions = rawQuestions
            .map((raw) => {
                const lines = raw.trim().split('\n');
                const answerLine = lines.find((line) =>
                    line.toLowerCase().startsWith('answer:')
                );
                const answer = answerLine ? answerLine.replace(/answer:/i, '').trim() : '';
                const questionText = lines
                    .filter((line) => !line.toLowerCase().startsWith('answer:'))
                    .join(' ')
                    .trim();
                return { questionText, answer };
            })
            .filter((q) => q.questionText.length > 0);

        return parsedQuestions;
    } catch (error) {
        alert('Error loading packet: ' + error.message);
        return [];
    }
}

function stopSpeaking() {
    if ('speechSynthesis' in window && speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    reading = false;
}

function speakWords(words, onEnd) {
    if (!('speechSynthesis' in window)) {
        alert('Text-to-speech not supported in your browser.');
        reading = false;
        return;
    }

    const questionElem = document.getElementById('questionText');
    questionElem.textContent = '';

    let index = 0;

    function speakNextWord() {
        if (!reading || index >= words.length) {
            reading = false;
            if (onEnd) onEnd();
            return;
        }

        // Append the current word to the displayed text
        if (index === 0) {
            questionElem.textContent = words[index];
        } else {
            questionElem.textContent += ' ' + words[index];
        }

        const word = words[index];
        const utterance = new SpeechSynthesisUtterance(word);

        utterance.lang = 'en-US';
        utterance.rate = speechRate;

        // Add extra pause if word ends with period or comma or semicolon
        utterance.onend = () => {
            if (!reading) {
                if (onEnd) onEnd();
                return;
            }
            let pauseDuration = 0;
            if (word.match(/[.,;!?]$/)) {
                if (word.endsWith('.')) pauseDuration = 400; // longer pause for periods
                else pauseDuration = 200; // shorter pause for commas etc.
            }
            setTimeout(() => {
                index++;
                speakNextWord();
            }, pauseDuration);
        };

        speechSynthesis.speak(utterance);
    }

    reading = true;
    speakNextWord();
}

function showQuestion(index) {
    // Show empty or loading while not reading
    const questionElem = document.getElementById('questionText');
    const resultElem = document.getElementById('result');
    if (!reading && questionElem) questionElem.textContent = questions[index].questionText;
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
    if (!reading && currentIndex >= questions.length) return; // no questions?

    // Stop speaking immediately
    stopSpeaking();

    recognition = startRecognition();
    if (!recognition) return;

    const resultElem = document.getElementById('result');
    if (resultElem) resultElem.textContent = 'Listening for your answer...';

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

function handleAnswer(answerText) {
    if (recognition) recognition.stop();

    const correctAnswer = questions[currentIndex].answer.toLowerCase();
    const userAnswer = answerText.toLowerCase();

    const isCorrect = checkAnswer(userAnswer, correctAnswer);

    const resultElem = document.getElementById('result');
    if (resultElem) {
        resultElem.textContent = `You answered: "${answerText}". That is ${isCorrect ? 'correct!' : 'incorrect.'}`;
        if (!isCorrect) {
            resultElem.textContent += ` Correct answer: "${questions[currentIndex].answer}".`;
        }
    }
}

function checkAnswer(userAnswer, correctAnswer) {
    // Basic contains check or exact match - can improve with fuzzy matching
    return userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer);
}

function nextQuestion() {
    stopSpeaking();

    currentIndex++;
    if (currentIndex >= questions.length) {
        currentIndex = 0; // loop back
    }
    showQuestion(currentIndex);
    readCurrentQuestion();
}

function readCurrentQuestion() {
    if (currentIndex >= questions.length) return;

    const questionText = questions[currentIndex].questionText;
    const words = questionText.split(/\s+/);
    speakWords(words);
}

// Init
window.onload = async () => {
    questions = await loadPacket('packet.txt');
    if (questions.length === 0) {
        const questionElem = document.getElementById('questionText');
        if (questionElem) questionElem.textContent = 'No questions loaded.';
        return;
    }

    showQuestion(currentIndex);

    document.getElementById('nextBtn').addEventListener('click', nextQuestion);
    document.getElementById('repeatBtn').addEventListener('click', () => {
        if (!reading) readCurrentQuestion();
    });
    document.getElementById('buzzBtn').addEventListener('click', onBuzz);

    // Speed slider
    const speedSlider = document.getElementById('speedSlider');
    const speedDisplay = document.getElementById('speedDisplay');
    speedSlider.value = speechRate;
    speedDisplay.textContent = speechRate.toFixed(2) + 'x';

    speedSlider.addEventListener('input', () => {
        speechRate = parseFloat(speedSlider.value);
        speedDisplay.textContent = speechRate.toFixed(2) + 'x';
    });

    // Start reading button
    const startButton = document.getElementById('startReadingBtn');
    startButton.addEventListener('click', () => {
        if (!reading) readCurrentQuestion();
        startButton.disabled = true;
    });
};
