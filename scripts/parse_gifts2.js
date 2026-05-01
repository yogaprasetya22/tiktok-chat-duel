const https = require('https');
const fs = require('fs');

https.get('https://streamtoearn.io/gifts?region=ID', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        fs.writeFileSync('streamtoearn.html', data);
        console.log("Saved to streamtoearn.html");
    });
});
