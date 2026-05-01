const fs = require('fs');
const content = fs.readFileSync('src/core/logic/gift/giftDictionary.ts', 'utf8');

const dictMatch = content.match(/export const GIFT_DICTIONARY: GiftDictionary = \{([\s\S]*?)\};/);
if (dictMatch) {
    const keys = dictMatch[1].match(/^    ["']?([a-zA-Z0-9_ ]+)["']?: \{/gm);
    if (keys) {
        keys.forEach(k => {
            const cleanKey = k.replace(/^    ["']?/, '').replace(/["']?: \{$/, '');
            if (cleanKey !== cleanKey.trim() || cleanKey.includes(' ')) {
                console.log(`WEIRD KEY: "${cleanKey}"`);
            }
        });
    }
}
