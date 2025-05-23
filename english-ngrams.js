// English n-gram frequencies (simplified for example)

// Monogram frequencies (letters)
const ENGLISH_MONOGRAMS = {
    'a': 8167, 'b': 1492, 'c': 2782, 'd': 4253, 'e': 12702,
    'f': 2228, 'g': 2015, 'h': 6094, 'i': 6966, 'j': 153,
    'k': 772, 'l': 4025, 'm': 2406, 'n': 6749, 'o': 7507,
    'p': 1929, 'q': 95, 'r': 5987, 's': 6327, 't': 9056,
    'u': 2758, 'v': 978, 'w': 2360, 'x': 150, 'y': 1974,
    'z': 74
};

// Bigram frequencies (letter pairs)
const ENGLISH_BIGRAMS = {
    'th': 152, 'he': 128, 'in': 94, 'er': 94, 'an': 82,
    're': 68, 'nd': 63, 'at': 59, 'on': 57, 'nt': 56,
    'ha': 56, 'es': 56, 'st': 55, 'en': 55, 'ed': 53,
    'to': 52, 'it': 50, 'ou': 50, 'ea': 47, 'hi': 46,
    'is': 46, 'or': 43, 'ti': 34, 'as': 33, 'te': 27,
    'et': 19, 'ng': 18, 'of': 18, 'al': 17, 'de': 17,
    'se': 16, 'le': 16, 'sa': 14, 'si': 13, 'ar': 12
};

// Trigram frequencies (letter triplets)
const ENGLISH_TRIGRAMS = {
    'the': 100, 'and': 42, 'ing': 31, 'ion': 24, 'tio': 23,
    'ent': 21, 'ati': 19, 'for': 17, 'her': 16, 'ter': 16,
    'hat': 14, 'tha': 14, 'ere': 13, 'ate': 13, 'his': 12,
    'con': 11, 'res': 11, 'ver': 10, 'all': 10, 'ons': 10,
    'nce': 9, 'men': 9, 'ith': 9, 'ted': 9, 'ers': 9,
    'pro': 8, 'thi': 8, 'wit': 8, 'are': 8, 'ess': 8,
    'not': 7, 'ive': 7, 'was': 7, 'ect': 7, 'rea': 7
};

// Quadgram frequencies (letter quadruplets)
const ENGLISH_QUADGRAMS = {
    'tion': 56, 'ther': 23, 'that': 20, 'ting': 15, 'with': 15,
    'this': 14, 'here': 13, 'ment': 13, 'them': 12, 'thei': 12,
    'ough': 11, 'atio': 11, 'ever': 10, 'from': 10, 'ight': 10,
    'hich': 9, 'have': 9, 'ould': 9, 'thin': 9, 'hter': 9,
    'atio': 8, 'ande': 8, 'sion': 8, 'some': 7, 'ting': 7,
    'ment': 7, 'they': 7, 'comp': 6, 'part': 6, 'form': 6
};

// English words for dictionary check
const ENGLISH_WORDS = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can',
    'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
    'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy',
    'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'that', 'with',
    'this', 'have', 'from', 'they', 'would', 'there', 'people', 'which', 'were',
    'about', 'other', 'into', 'your', 'could', 'their', 'some', 'time', 'more'
]);
