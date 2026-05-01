const fs = require('fs');
const html = fs.readFileSync('streamtoearn.html', 'utf8');

const regex = /<img[^>]+src="([^"]+)"[^>]*alt="([^"]+)"/g;
let match;
const gifts = {};
while ((match = regex.exec(html)) !== null) {
    const src = match[1];
    const name = match[2];
    if (src.includes('tiktokcdn.com')) {
        gifts[name] = src;
    }
}
console.log(JSON.stringify(gifts, null, 2));
