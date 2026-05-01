const fs = require('fs');
const html = fs.readFileSync('streamtoearn.html', 'utf8');

const names = html.match(/<p class="gift-name">([^<]+)<\/p>/g) || [];
const imgs = html.match(/<img src="([^"]+)" alt="[^"]*"/g) || [];

console.log(`Found ${names.length} names and ${imgs.length} images.`);
