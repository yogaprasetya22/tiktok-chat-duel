const fs = require('fs');

const allGifts = JSON.parse(fs.readFileSync('all_gifts_from_html.json', 'utf8'));
const keys = fs.readFileSync('dictionary_keys.txt', 'utf8').split('\n').map(k => k.trim()).filter(k => k);

const decodeEntities = (s) => s.replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const normalize = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const missing = [];
allGifts.forEach(g => {
    const name = decodeEntities(g.name);
    const key = normalize(name);
    if (!keys.includes(key)) {
        missing.push({ name, key, img: g.img, price: g.price });
    }
});

console.log(`Total missing: ${missing.length}`);
missing.forEach(m => console.log(`Missing: ${m.name} (${m.key})`));
fs.writeFileSync('missing_from_dict.json', JSON.stringify(missing, null, 2));
