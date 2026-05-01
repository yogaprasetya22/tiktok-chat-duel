const fs = require('fs');
const content = fs.readFileSync('src/core/logic/gift/giftDictionary.ts', 'utf8');

const dictMatch = content.match(/export const GIFT_DICTIONARY: GiftDictionary = \{([\s\S]*?)\};/);
if (dictMatch) {
    const dict = dictMatch[1];
    const lines = dict.split('\n');
    let currentKey = '';
    let hasPicture = false;
    let block = [];
    
    lines.forEach(line => {
        const keyMatch = line.match(/^    ([a-z0-9_]+): \{/);
        if (keyMatch) {
            if (currentKey && !hasPicture) {
                console.log(`Missing picture: ${currentKey}`);
            }
            currentKey = keyMatch[1];
            hasPicture = false;
        }
        if (line.includes('picture:')) {
            hasPicture = true;
        }
    });
    if (currentKey && !hasPicture) {
        console.log(`Missing picture: ${currentKey}`);
    }
}
