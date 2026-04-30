const fs = require('fs');

const giftsData = JSON.parse(fs.readFileSync('gifts_extracted.json', 'utf8'));
let tsFile = fs.readFileSync('src/core/logic/gift/giftDictionary.ts', 'utf8');

// 1. Update interface
if (!tsFile.includes('picture?: string;')) {
    tsFile = tsFile.replace(
        '  spawn_tier: number;',
        '  spawn_tier: number;\n  picture?: string;'
    );
}

// 2. Update GIFT_DICTIONARY
// We need to inject the `picture` property into each object if it matches a name in giftsData.
// A typical line: `rose: { name: "Rose", coin_value: 1, spawn_tier: 1, spawn_count: 1 },`
tsFile = tsFile.replace(/([a-zA-Z0-9_]+):\s*\{\s*name:\s*"([^"]+)",([^}]+)\}/g, (match, key, name, rest) => {
    let pictureUrl = giftsData[name];
    if (!pictureUrl && name === "You're awesome") {
        pictureUrl = giftsData["You&#39;re awesome"];
    }
    
    if (pictureUrl) {
        // If it already has a picture, don't add it again
        if (rest.includes('picture:')) {
            return match;
        }
        // inject picture before the closing brace
        return `${key}: { name: "${name}",${rest.trim().replace(/,$/, '')}, picture: "${pictureUrl}" }`;
    }
    return match;
});

fs.writeFileSync('src/core/logic/gift/giftDictionary.ts', tsFile);
console.log("Updated giftDictionary.ts");
