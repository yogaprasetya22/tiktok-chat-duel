const fs = require('fs');
const content = fs.readFileSync('src/core/logic/gift/giftDictionary.ts', 'utf8');

const blocks = content.match(/[a-z0-9_]+: \{[\s\S]*?\}/g);
blocks.forEach(block => {
    if (block.includes('picture: ""') || block.includes('picture: " "') || !block.includes('picture:')) {
         const keyMatch = block.match(/([a-z0-9_]+): \{/);
         if (keyMatch) console.log(keyMatch[1]);
    }
});
