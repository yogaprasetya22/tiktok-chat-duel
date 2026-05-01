const fs = require('fs');
const html = fs.readFileSync('streamtoearn.html', 'utf8');

const gifts = [];
const regex = /<div class="gift">[\s\S]*?<img src="([^"]+)" alt="([^"]+)"[\s\S]*?<p class="gift-name">([^<]+)<\/p>[\s\S]*?<p class="gift-price">(\d+)[\s\S]*?<\/div>/g;

let match;
while ((match = regex.exec(html)) !== null) {
    gifts.push({
        img: match[1],
        alt: match[2],
        name: match[3].trim(),
        price: parseInt(match[4])
    });
}

fs.writeFileSync('all_gifts_from_html.json', JSON.stringify(gifts, null, 2));
console.log(`Extracted ${gifts.length} gifts.`);
