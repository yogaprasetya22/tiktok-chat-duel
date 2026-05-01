const fs = require('fs');
const html = fs.readFileSync('streamtoearn.html', 'utf8');

// The data in app router is typically in self.__next_f.push
// Let's just use regex to find URLs and their associated names if they are part of a JSON-like array or object
const urls = [...html.matchAll(/https:\/\/p16-webcast\.tiktokcdn\.com\/[^"'\\]+/g)].map(m => m[0]);
console.log(`Found ${urls.length} URLs. Unique: ${new Set(urls).size}`);

// Try to find the exact array of gifts.
// The array likely contains objects with properties like name, picture, coin
// Next.js encodes this as a string, e.g., ["Rose","https://..."]
const giftsMatch = html.match(/"name":"([^"]+)","picture":"(https:\/\/p16-webcast\.tiktokcdn\.com\/[^"]+)"/g);
if (giftsMatch) {
    console.log("Found structured JSON objects:");
    console.log(giftsMatch.slice(0, 5));
} else {
    console.log("No simple JSON objects found. The data might be heavily nested/encoded in Next.js format.");
    // Let's just find the gift names around the URLs
    // We'll search the raw HTML for the word "Rose"
    const roseIdx = html.indexOf('"Rose"');
    if (roseIdx !== -1) {
        console.log("Context around 'Rose':", html.substring(roseIdx - 100, roseIdx + 200));
    }
}
