const fs = require('fs');

const names = fs.readFileSync('all_names.txt', 'utf8').split('\n').map(n => n.trim()).filter(n => n);
const content = fs.readFileSync('src/core/logic/gift/giftDictionary.ts', 'utf8');

const decodeEntities = (s) => s.replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const normalize = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const missing = [];
names.forEach(n => {
    const decoded = decodeEntities(n);
    const key = normalize(decoded);
    if (!content.includes(key + ': {')) {
        missing.push(decoded);
    }
});

console.log(`Missing from dict: ${missing.length}`);
missing.forEach(m => console.log(m));
