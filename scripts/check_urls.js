const fs = require('fs');
const content = fs.readFileSync('src/core/logic/gift/giftDictionary.ts', 'utf8');

const blocks = content.match(/[a-z0-9_]+: \{[\s\S]*?\}/g);
blocks.forEach(block => {
    const picMatch = block.match(/picture: "([^"]+)"/);
    if (picMatch) {
        const url = picMatch[1];
        if (!url.startsWith('http')) {
            const keyMatch = block.match(/([a-z0-9_]+): \{/);
            console.log(`Non-http URL for ${keyMatch[1]}: ${url}`);
        }
    }
});
