class VigenereAnalyzer {
    constructor() {
        this.worker = null;
        this.currentJobId = 0;
        this.initElements();
        this.initEventListeners();
        this.initNgrams();
    }

    initElements() {
        this.elements = {
            ciphertext: document.getElementById('ciphertext'),
            alphabet: document.getElementById('alphabet'),
            knownKey: document.getElementById('known-key'),
            knownPlaintext: document.getElementById('known-plaintext'),
            minKeyLength: document.getElementById('min-key-length'),
            maxKeyLength: document.getElementById('max-key-length'),
            useIc: document.getElementById('use-ic'),
            useNgrams: document.getElementById('use-ngrams'),
            useDict: document.getElementById('use-dict'),
            decryptBtn: document.getElementById('decrypt-btn'),
            analyzeBtn: document.getElementById('analyze-btn'),
            encryptBtn: document.getElementById('encrypt-btn'),
            clearBtn: document.getElementById('clear-btn'),
            resultDisplay: document.getElementById('result-display'),
            sortBy: document.getElementById('sort-by'),
            progressContainer: document.getElementById('progress-container'),
            progressBar: document.getElementById('progress-bar'),
            progressText: document.getElementById('progress-text'),
            resultsContainer: document.getElementById('results')
        };
    }

    initEventListeners() {
        this.elements.decryptBtn.addEventListener('click', () => this.decryptWithKnownKey());
        this.elements.analyzeBtn.addEventListener('click', () => this.analyzeCiphertext());
        this.elements.encryptBtn.addEventListener('click', () => this.encryptPlaintext());
        this.elements.clearBtn.addEventListener('click', () => this.clearAll());
        
        // Validate alphabet input
        this.elements.alphabet.addEventListener('input', (e) => {
            const uniqueChars = [...new Set(e.target.value.toLowerCase())].join('');
            e.target.value = uniqueChars;
        });
    }

    initNgrams() {
        // Load n-gram data from english-ngrams.js
        this.ngrams = {
            monograms: ENGLISH_MONOGRAMS,
            bigrams: ENGLISH_BIGRAMS,
            trigrams: ENGLISH_TRIGRAMS,
            quadgrams: ENGLISH_QUADGRAMS
        };
        
        // Calculate log probabilities for n-grams
        this.calculateNgramLogs();
    }

    calculateNgramLogs() {
        // Calculate floor log probabilities for all n-grams
        for (const [type, data] of Object.entries(this.ngrams)) {
            const total = Object.values(data).reduce((sum, count) => sum + count, 0);
            const floor = Math.log10(0.01 / total);
            
            this.ngrams[type] = Object.fromEntries(
                Object.entries(data).map(([ngram, count]) => [
                    ngram, 
                    Math.log10(count / total)
                ])
            );
            
            // Store floor value for unknown n-grams
            this.ngrams[`${type}Floor`] = floor;
        }
    }

    decryptWithKnownKey() {
        const ciphertext = this.elements.ciphertext.value.trim();
        const key = this.elements.knownKey.value.trim();
        const alphabet = this.elements.alphabet.value.toLowerCase();
        
        if (!ciphertext) {
            this.showError("Please enter ciphertext");
            return;
        }
        
        if (!key) {
            this.showError("Please enter a known key");
            return;
        }
        
        if (!alphabet) {
            this.showError("Please specify an alphabet");
            return;
        }
        
        const plaintext = this.vigenereDecrypt(ciphertext, key, alphabet);
        this.displaySingleResult({
            key: key,
            plaintext: plaintext,
            score: 100,
            ic: this.calculateIndexOfCoincidence(plaintext, alphabet),
            ngramScore: this.calculateNgramScore(plaintext),
            dictScore: this.calculateDictionaryScore(plaintext)
        });
    }

    encryptPlaintext() {
        const ciphertext = this.elements.ciphertext.value.trim();
        const key = this.elements.knownKey.value.trim();
        const alphabet = this.elements.alphabet.value.toLowerCase();
        
        if (!ciphertext) {
            this.showError("Please enter plaintext");
            return;
        }
        
        if (!key) {
            this.showError("Please enter a key for encryption");
            return;
        }
        
        if (!alphabet) {
            this.showError("Please specify an alphabet");
            return;
        }
        
        const encryptedText = this.vigenereEncrypt(ciphertext, key, alphabet);
        this.elements.ciphertext.value = encryptedText;
        this.showSuccess("Text encrypted successfully");
    }

    analyzeCiphertext() {
        const ciphertext = this.elements.ciphertext.value.trim();
        const alphabet = this.elements.alphabet.value.toLowerCase();
        const knownPlaintext = this.elements.knownPlaintext.value.trim();
        const minLen = parseInt(this.elements.minKeyLength.value);
        const maxLen = parseInt(this.elements.maxKeyLength.value);
        
        if (!ciphertext) {
            this.showError("Please enter ciphertext");
            return;
        }
        
        if (!alphabet) {
            this.showError("Please specify an alphabet");
            return;
        }
        
        if (minLen > maxLen) {
            this.showError("Minimum key length cannot be greater than maximum");
            return;
        }
        
        // Prepare analysis options
        const options = {
            useIc: this.elements.useIc.checked,
            useNgrams: this.elements.useNgrams.checked,
            useDict: this.elements.useDict.checked,
            knownPlaintext: knownPlaintext,
            minKeyLength: minLen,
            maxKeyLength: maxLen,
            alphabet: alphabet,
            ciphertext: ciphertext
        };
        
        this.startAnalysis(options);
    }

    startAnalysis(options) {
        // Clear previous results
        this.elements.resultsContainer.innerHTML = '';
        this.elements.progressContainer.style.display = 'block';
        this.elements.progressBar.style.width = '0%';
        this.elements.progressText.textContent = '0%';
        
        // Create a new job ID
        const jobId = ++this.currentJobId;
        this.currentJobId = jobId;
        
        // Create web workers for parallel processing
        const workerCount = navigator.hardwareConcurrency || 4;
        this.workers = [];
        this.results = [];
        this.completedWorkers = 0;
        
        // Calculate key lengths to test per worker
        const keyLengths = Array.from({length: options.maxKeyLength - options.minKeyLength + 1}, 
            (_, i) => options.minKeyLength + i);
        
        const keysPerWorker = Math.ceil(keyLengths.length / workerCount);
        
        for (let i = 0; i < workerCount; i++) {
            const startIdx = i * keysPerWorker;
            const endIdx = startIdx + keysPerWorker;
            const workerKeyLengths = keyLengths.slice(startIdx, endIdx);
            
            if (workerKeyLengths.length === 0) continue;
            
            const worker = new Worker('worker.js');
            this.workers.push(worker);
            
            worker.onmessage = (e) => {
                if (e.data.jobId !== jobId) return;
                
                if (e.data.type === 'progress') {
                    this.updateProgress(e.data.progress);
                } else if (e.data.type === 'result') {
                    this.results.push(...e.data.results);
                    this.completedWorkers++;
                    
                    if (this.completedWorkers === this.workers.length) {
                        this.analysisComplete();
                    }
                }
            };
            
            // Start worker
            worker.postMessage({
                type: 'start',
                jobId: jobId,
                options: options,
                keyLengths: workerKeyLengths,
                ngrams: this.ngrams
            });
        }
    }

    updateProgress(progress) {
        this.elements.progressBar.style.width = `${progress}%`;
        this.elements.progressText.textContent = `${Math.round(progress)}%`;
    }

    analysisComplete() {
        // Terminate all workers
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
        
        // Hide progress bar
        this.elements.progressContainer.style.display = 'none';
        
        // Process and display results
        this.processResults();
    }

    processResults() {
        if (this.results.length === 0) {
            this.showError("No valid keys found. Try expanding the key length range.");
            return;
        }
        
        // Normalize scores
        this.normalizeScores();
        
        // Sort results
        this.sortResults();
        
        // Display results
        this.displayResults();
    }

    normalizeScores() {
        // Find min/max for each score type
        const scoreTypes = ['ic', 'ngramScore', 'dictScore', 'totalScore'];
        const ranges = {};
        
        scoreTypes.forEach(type => {
            const values = this.results.map(r => r[type]);
            ranges[type] = {
                min: Math.min(...values),
                max: Math.max(...values)
            };
        });
        
        // Normalize all scores to 0-100 range
        this.results.forEach(result => {
            scoreTypes.forEach(type => {
                const range = ranges[type];
                if (range.max !== range.min) {
                    result[`${type}Norm`] = 100 * (result[type] - range.min) / (range.max - range.min);
                } else {
                    result[`${type}Norm`] = 50; // Neutral value when all same
                }
            });
            
            // Calculate weighted total score
            result.totalScore = 
                (result.icNorm * 0.3) + 
                (result.ngramScoreNorm * 0.5) + 
                (result.dictScoreNorm * 0.2);
        });
    }

    sortResults() {
        const sortBy = this.elements.sortBy.value;
        
        this.results.sort((a, b) => {
            if (sortBy === 'ic') {
                return b.icNorm - a.icNorm;
            } else if (sortBy === 'ngram') {
                return b.ngramScoreNorm - a.ngramScoreNorm;
            } else if (sortBy === 'dict') {
                return b.dictScoreNorm - a.dictScoreNorm;
            } else {
                return b.totalScore - a.totalScore;
            }
        });
    }

    displayResults() {
        const displayMode = this.elements.resultDisplay.value;
        let resultsToShow = [];
        
        if (displayMode === 'top10') {
            resultsToShow = this.results.slice(0, 10);
        } else if (displayMode === 'all') {
            resultsToShow = this.results;
        } else {
            resultsToShow = [this.results[0]];
        }
        
        this.elements.resultsContainer.innerHTML = '';
        
        if (resultsToShow.length === 0) {
            this.elements.resultsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>No results found. Try adjusting your parameters.</p>
                </div>
            `;
            return;
        }
        
        resultsToShow.forEach((result, idx) => {
            const resultElement = document.createElement('div');
            resultElement.className = `result-item ${idx === 0 ? 'best' : ''}`;
            
            resultElement.innerHTML = `
                <div class="result-header">
                    <span class="result-key">${result.key}</span>
                    <span class="result-score">${Math.round(result.totalScore)}</span>
                </div>
                <div class="result-metrics">
                    <div class="result-metric" title="Index of Coincidence">
                        <i class="fas fa-chart-line"></i>
                        <span>IC: ${result.ic.toFixed(4)} (${Math.round(result.icNorm)})</span>
                    </div>
                    <div class="result-metric" title="N-gram Score">
                        <i class="fas fa-chart-bar"></i>
                        <span>N-gram: ${result.ngramScore.toFixed(2)} (${Math.round(result.ngramScoreNorm)})</span>
                    </div>
                    <div class="result-metric" title="Dictionary Match">
                        <i class="fas fa-book"></i>
                        <span>Dict: ${result.dictScore.toFixed(2)} (${Math.round(result.dictScoreNorm)})</span>
                    </div>
                </div>
                <div class="result-plaintext">${result.plaintext}</div>
            `;
            
            this.elements.resultsContainer.appendChild(resultElement);
        });
    }

    displaySingleResult(result) {
        this.elements.resultsContainer.innerHTML = '';
        
        const resultElement = document.createElement('div');
        resultElement.className = 'result-item best';
        
        resultElement.innerHTML = `
            <div class="result-header">
                <span class="result-key">${result.key}</span>
                <span class="result-score">${Math.round(result.score)}</span>
            </div>
            <div class="result-metrics">
                <div class="result-metric" title="Index of Coincidence">
                    <i class="fas fa-chart-line"></i>
                    <span>IC: ${result.ic.toFixed(4)}</span>
                </div>
                <div class="result-metric" title="N-gram Score">
                    <i class="fas fa-chart-bar"></i>
                    <span>N-gram: ${result.ngramScore.toFixed(2)}</span>
                </div>
                <div class="result-metric" title="Dictionary Match">
                    <i class="fas fa-book"></i>
                    <span>Dict: ${result.dictScore.toFixed(2)}</span>
                </div>
            </div>
            <div class="result-plaintext">${result.plaintext}</div>
        `;
        
        this.elements.resultsContainer.appendChild(resultElement);
    }

    vigenereDecrypt(ciphertext, key, alphabet) {
        const alphaLen = alphabet.length;
        const keyLen = key.length;
        let plaintext = '';
        
        for (let i = 0; i < ciphertext.length; i++) {
            const cipherChar = ciphertext[i].toLowerCase();
            const keyChar = key[i % keyLen].toLowerCase();
            
            const cipherPos = alphabet.indexOf(cipherChar);
            const keyPos = alphabet.indexOf(keyChar);
            
            if (cipherPos === -1) {
                plaintext += cipherChar; // Leave non-alphabet chars as-is
                continue;
            }
            
            let plainPos = (cipherPos - keyPos) % alphaLen;
            if (plainPos < 0) plainPos += alphaLen;
            
            plaintext += alphabet[plainPos];
        }
        
        return plaintext;
    }

    vigenereEncrypt(plaintext, key, alphabet) {
        const alphaLen = alphabet.length;
        const keyLen = key.length;
        let ciphertext = '';
        
        for (let i = 0; i < plaintext.length; i++) {
            const plainChar = plaintext[i].toLowerCase();
            const keyChar = key[i % keyLen].toLowerCase();
            
            const plainPos = alphabet.indexOf(plainChar);
            const keyPos = alphabet.indexOf(keyChar);
            
            if (plainPos === -1) {
                ciphertext += plainChar; // Leave non-alphabet chars as-is
                continue;
            }
            
            const cipherPos = (plainPos + keyPos) % alphaLen;
            ciphertext += alphabet[cipherPos];
        }
        
        return ciphertext;
    }

    calculateIndexOfCoincidence(text, alphabet) {
        const freq = {};
        let totalLetters = 0;
        
        // Count letter frequencies
        for (const char of text.toLowerCase()) {
            if (alphabet.includes(char)) {
                freq[char] = (freq[char] || 0) + 1;
                totalLetters++;
            }
        }
        
        if (totalLetters < 2) return 0;
        
        // Calculate IC
        let sum = 0;
        for (const char of alphabet) {
            const count = freq[char] || 0;
            sum += count * (count - 1);
        }
        
        return sum / (totalLetters * (totalLetters - 1));
    }

    calculateNgramScore(text) {
        let score = 0;
        let ngramCount = 0;
        
        // Calculate monogram score
        for (let i = 0; i < text.length; i++) {
            const gram = text[i].toLowerCase();
            score += this.ngrams.monograms[gram] || this.ngrams.monogramsFloor;
            ngramCount++;
        }
        
        // Calculate bigram score
        for (let i = 0; i < text.length - 1; i++) {
            const gram = text.substr(i, 2).toLowerCase();
            score += this.ngrams.bigrams[gram] || this.ngrams.bigramsFloor;
            ngramCount++;
        }
        
        // Calculate trigram score
        for (let i = 0; i < text.length - 2; i++) {
            const gram = text.substr(i, 3).toLowerCase();
            score += this.ngrams.trigrams[gram] || this.ngrams.trigramsFloor;
            ngramCount++;
        }
        
        // Calculate quadgram score
        for (let i = 0; i < text.length - 3; i++) {
            const gram = text.substr(i, 4).toLowerCase();
            score += this.ngrams.quadgrams[gram] || this.ngrams.quadgramsFloor;
            ngramCount++;
        }
        
        return ngramCount > 0 ? score / ngramCount : 0;
    }

    calculateDictionaryScore(text) {
        // Simple dictionary check - count English words
        const words = text.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 1);
        if (words.length === 0) return 0;
        
        let knownWords = 0;
        for (const word of words) {
            if (ENGLISH_WORDS.has(word)) {
                knownWords++;
            }
        }
        
        return knownWords / words.length;
    }

    showError(message) {
        this.elements.resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
            </div>
        `;
    }

    showSuccess(message) {
        const alert = document.createElement('div');
        alert.className = 'alert success';
        alert.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(alert);
        setTimeout(() => alert.remove(), 3000);
    }

    clearAll() {
        this.elements.ciphertext.value = '';
        this.elements.knownKey.value = '';
        this.elements.knownPlaintext.value = '';
        this.elements.resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-microscope"></i>
                <p>No results yet. Enter ciphertext and click "Analyze" to begin.</p>
            </div>
        `;
    }
}

// English word list (simplified for example)
const ENGLISH_WORDS = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 
    'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 
    'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 
    'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'that', 'with'
]);

// Initialize the analyzer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VigenereAnalyzer();
});
