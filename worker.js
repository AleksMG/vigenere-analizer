// Web Worker for parallel key testing

// Import n-gram data (in a real app, this would be imported via importScripts)
const ngrams = {};

self.onmessage = function(e) {
    if (e.data.type === 'start') {
        analyzeCiphertext(e.data.options, e.data.keyLengths, e.data.ngrams, e.data.jobId);
    }
};

function analyzeCiphertext(options, keyLengths, ngramsData, jobId) {
    // Set up n-gram data
    Object.assign(ngrams, ngramsData);
    
    const results = [];
    const totalKeysToTest = keyLengths.length * Math.pow(options.alphabet.length, 3); // Approximation
    
    let keysTested = 0;
    let lastProgress = 0;
    
    for (const keyLength of keyLengths) {
        if (options.knownPlaintext) {
            // If we have known plaintext, we can find parts of the key directly
            const partialKey = findPartialKeyWithKnownPlaintext(
                options.ciphertext, 
                options.knownPlaintext, 
                options.alphabet, 
                keyLength
            );
            
            if (partialKey) {
                // Test variations of the partial key
                const keyCandidates = generateKeyCandidates(partialKey, options.alphabet);
                
                for (const key of keyCandidates) {
                    const result = testKey(options.ciphertext, key, options.alphabet, options);
                    if (result) results.push(result);
                    
                    // Update progress
                    keysTested++;
                    const progress = Math.min(100, Math.floor(keysTested / totalKeysToTest * 100));
                    if (progress > lastProgress) {
                        lastProgress = progress;
                        self.postMessage({ type: 'progress', progress, jobId });
                    }
                }
            }
        } else {
            // No known plaintext - use frequency analysis
            const likelyKey = findLikelyKeyWithFrequencies(
                options.ciphertext, 
                options.alphabet, 
                keyLength
            );
            
            if (likelyKey) {
                const result = testKey(options.ciphertext, likelyKey, options.alphabet, options);
                if (result) results.push(result);
                
                // Update progress
                keysTested += Math.pow(options.alphabet.length, keyLength);
                const progress = Math.min(100, Math.floor(keysTested / totalKeysToTest * 100));
                if (progress > lastProgress) {
                    lastProgress = progress;
                    self.postMessage({ type: 'progress', progress, jobId });
                }
            }
        }
    }
    
    // Send results back to main thread
    self.postMessage({ type: 'result', results, jobId });
}

function findPartialKeyWithKnownPlaintext(ciphertext, knownPlaintext, alphabet, keyLength) {
    if (knownPlaintext.length < keyLength) return null;
    
    const partialKey = Array(keyLength).fill(null);
    const alphaLen = alphabet.length;
    
    for (let i = 0; i < knownPlaintext.length; i++) {
        const keyPos = i % keyLength;
        const cipherChar = ciphertext[i]?.toLowerCase();
        const plainChar = knownPlaintext[i]?.toLowerCase();
        
        if (!cipherChar || !plainChar) continue;
        
        const cipherPos = alphabet.indexOf(cipherChar);
        const plainPos = alphabet.indexOf(plainChar);
        
        if (cipherPos === -1 || plainPos === -1) continue;
        
        // key = (cipherPos - plainPos) mod alphabetLength
        let keyPosValue = (cipherPos - plainPos) % alphaLen;
        if (keyPosValue < 0) keyPosValue += alphaLen;
        
        partialKey[keyPos] = partialKey[keyPos] === null ? keyPosValue : 
                            (partialKey[keyPos] === keyPosValue ? keyPosValue : -1);
    }
    
    // Build the partial key
    let key = '';
    for (let i = 0; i < keyLength; i++) {
        if (partialKey[i] === null || partialKey[i] === -1) {
            key += '?'; // Unknown character
        } else {
            key += alphabet[partialKey[i]];
        }
    }
    
    return key.includes('?') ? key : null;
}

function generateKeyCandidates(partialKey, alphabet) {
    const unknownPositions = [];
    for (let i = 0; i < partialKey.length; i++) {
        if (partialKey[i] === '?') {
            unknownPositions.push(i);
        }
    }
    
    // If too many unknowns, return just the partial key
    if (unknownPositions.length > 3) {
        return [partialKey.replace(/\?/g, alphabet[0])];
    }
    
    // Generate all possible combinations for unknown positions
    const candidates = [];
    const totalCombinations = Math.pow(alphabet.length, unknownPositions.length);
    
    for (let i = 0; i < totalCombinations; i++) {
        let tempKey = partialKey.split('');
        let temp = i;
        
        for (const pos of unknownPositions) {
            const charIndex = temp % alphabet.length;
            tempKey[pos] = alphabet[charIndex];
            temp = Math.floor(temp / alphabet.length);
        }
        
        candidates.push(tempKey.join(''));
    }
    
    return candidates;
}

function findLikelyKeyWithFrequencies(ciphertext, alphabet, keyLength) {
    // For each key position, find the most likely shift based on letter frequencies
    const likelyKey = [];
    const alphaLen = alphabet.length;
    const freqTargets = getFrequencyTargets(); // English letter frequencies
    
    for (let k = 0; k < keyLength; k++) {
        // Extract every nth character for this key position
        const sequence = [];
        for (let i = k; i < ciphertext.length; i += keyLength) {
            const char = ciphertext[i].toLowerCase();
            if (alphabet.includes(char)) {
                sequence.push(char);
            }
        }
        
        // Calculate letter frequencies for this sequence
        const freq = calculateFrequencies(sequence, alphabet);
        
        // Find shift that best matches English frequencies
        let bestShift = 0;
        let bestScore = -Infinity;
        
        for (let shift = 0; shift < alphaLen; shift++) {
            let score = 0;
            
            for (let i = 0; i < alphaLen; i++) {
                const targetIndex = (i + shift) % alphaLen;
                const targetChar = alphabet[targetIndex];
                score += freq[alphabet[i]] * (freqTargets[targetChar] || 0);
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestShift = shift;
            }
        }
        
        likelyKey.push(alphabet[bestShift]);
    }
    
    return likelyKey.join('');
}

function getFrequencyTargets() {
    // English letter frequencies (percentages)
    return {
        'a': 8.167, 'b': 1.492, 'c': 2.782, 'd': 4.253, 'e': 12.702,
        'f': 2.228, 'g': 2.015, 'h': 6.094, 'i': 6.966, 'j': 0.153,
        'k': 0.772, 'l': 4.025, 'm': 2.406, 'n': 6.749, 'o': 7.507,
        'p': 1.929, 'q': 0.095, 'r': 5.987, 's': 6.327, 't': 9.056,
        'u': 2.758, 'v': 0.978, 'w': 2.360, 'x': 0.150, 'y': 1.974,
        'z': 0.074
    };
}

function calculateFrequencies(sequence, alphabet) {
    const freq = {};
    let total = 0;
    
    // Initialize frequencies
    for (const char of alphabet) {
        freq[char] = 0;
    }
    
    // Count occurrences
    for (const char of sequence) {
        freq[char]++;
        total++;
    }
    
    // Convert to percentages
    if (total > 0) {
        for (const char of alphabet) {
            freq[char] = (freq[char] / total) * 100;
        }
    }
    
    return freq;
}

function testKey(ciphertext, key, alphabet, options) {
    // Decrypt with this key
    const plaintext = vigenereDecrypt(ciphertext, key, alphabet);
    
    // Calculate scores
    const ic = options.useIc ? calculateIndexOfCoincidence(plaintext, alphabet) : 0;
    const ngramScore = options.useNgrams ? calculateNgramScore(plaintext) : 0;
    const dictScore = options.useDict ? calculateDictionaryScore(plaintext) : 0;
    
    // Only return results that meet minimum thresholds
    if ((!options.useIc || ic > 0.06) && 
        (!options.useNgrams || ngramScore > -3.5) && 
        (!options.useDict || dictScore > 0.1)) {
        return {
            key: key,
            plaintext: plaintext,
            ic: ic,
            ngramScore: ngramScore,
            dictScore: dictScore
        };
    }
    
    return null;
}

function vigenereDecrypt(ciphertext, key, alphabet) {
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

function calculateIndexOfCoincidence(text, alphabet) {
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

function calculateNgramScore(text) {
    let score = 0;
    let ngramCount = 0;
    
    // Calculate monogram score
    for (let i = 0; i < text.length; i++) {
        const gram = text[i].toLowerCase();
        score += ngrams.monograms[gram] || ngrams.monogramsFloor;
        ngramCount++;
    }
    
    // Calculate bigram score
    for (let i = 0; i < text.length - 1; i++) {
        const gram = text.substr(i, 2).toLowerCase();
        score += ngrams.bigrams[gram] || ngrams.bigramsFloor;
        ngramCount++;
    }
    
    // Calculate trigram score
    for (let i = 0; i < text.length - 2; i++) {
        const gram = text.substr(i, 3).toLowerCase();
        score += ngrams.trigrams[gram] || ngrams.trigramsFloor;
        ngramCount++;
    }
    
    // Calculate quadgram score
    for (let i = 0; i < text.length - 3; i++) {
        const gram = text.substr(i, 4).toLowerCase();
        score += ngrams.quadgrams[gram] || ngrams.quadgramsFloor;
        ngramCount++;
    }
    
    return ngramCount > 0 ? score / ngramCount : 0;
}

function calculateDictionaryScore(text) {
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

// English word list (simplified for example)
const ENGLISH_WORDS = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 
    'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 
    'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 
    'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'that', 'with'
]);
