const fs = require('fs');

const allGifts = JSON.parse(fs.readFileSync('all_gifts_from_html.json', 'utf8'));
const content = fs.readFileSync('src/core/logic/gift/giftDictionary.ts', 'utf8');

const normalize = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const missing = [];
allGifts.forEach(g => {
    const key = normalize(g.name);
    const regex = new RegExp(`${key}: \\{[\\s\\S]*?\\}`, 'g');
    const match = content.match(regex);
    
    if (!match) {
        missing.push({ type: 'missing_entirely', name: g.name, key, img: g.img, price: g.price });
    } else {
        const block = match[0];
        if (!block.includes('picture:')) {
            missing.push({ type: 'missing_picture', name: g.name, key, img: g.img, price: g.price });
        }
    }
});

console.log(`Total gifts in HTML: ${allGifts.length}`);
console.log(`Total problematic: ${missing.length}`);
fs.writeFileSync('problematic_gifts.json', JSON.stringify(missing, null, 2));
missing.forEach(m => console.log(`${m.type}: ${m.name} (${m.key})`));
