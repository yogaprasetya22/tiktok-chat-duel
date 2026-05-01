const fs = require('fs');
const content = fs.readFileSync('src/core/logic/gift/giftDictionary.ts', 'utf8');

const dictPart = content.match(/export const GIFT_DICTIONARY: GiftDictionary = \{([\s\S]*?)\};/);
if (!dictPart) {
    console.log("GIFT_DICTIONARY not found");
    process.exit(0);
}

const blocks = dictPart[1].match(/[a-z0-9_]+: \{[\s\S]*?\}/g);
if (!blocks) {
    console.log("No blocks found in dictionary");
    process.exit(0);
}

let count = 0;
blocks.forEach(block => {
    if (!block.includes('picture:')) {
        const nameMatch = block.match(/name: "([^"]+)"/);
        const keyMatch = block.match(/([a-z0-9_]+): \{/);
        if (nameMatch && keyMatch) {
            console.log(`Missing picture: ${keyMatch[1]} (${nameMatch[1]})`);
            count++;
        }
    }
});

console.log(`Total missing in dictionary: ${count}`);
