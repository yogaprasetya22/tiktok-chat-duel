const fs = require('fs');
const content = fs.readFileSync('src/core/logic/gift/giftDictionary.ts', 'utf8');

const keys = ["rose", "gg", "tiktok", "youre_awesome", "love_you_so_much", "glow_stick", "so_cute", "thumbs_up", "heart", "love_you", "coffee", "heart_me", "ice_cream_cone", "pop", "creeper", "wink_wink", "freestyle", "cake_slice", "orange_juice", "fairy_wings"];

for (const k of keys) {
    const match = content.match(new RegExp(`${k}:\\s*\\{\\s*name:\\s*"([^"]+)"`, 'i'));
    if (match) {
        console.log(`${k} -> "${match[1]}"`);
    } else {
        console.log(`Not found: ${k}`);
    }
}
