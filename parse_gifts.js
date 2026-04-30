const https = require('https');

https.get('https://streamtoearn.io/gifts?region=ID', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const regex = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;
        const match = data.match(regex);
        if (match) {
            const json = JSON.parse(match[1]);
            const gifts = json.props.pageProps.initialState || json.props.pageProps;
            // Let's just stringify and grep for a gift name to see where it is
            const str = JSON.stringify(json);
            const index = str.indexOf('"name":"Rose"');
            console.log("Found Rose at index:", index);
            if (index > -1) {
                console.log(str.substring(index - 100, index + 200));
            }
        } else {
            console.log("No __NEXT_DATA__ found. Let's look for other JSON patterns.");
            const scriptRegex = /<script>window\.__INITIAL_STATE__=([\s\S]*?)<\/script>/;
            const match2 = data.match(scriptRegex);
            if (match2) {
                console.log("Found __INITIAL_STATE__");
            } else {
                console.log("Looking for self.__next_f...");
                const fIndex = data.indexOf('self.__next_f');
                if (fIndex > -1) {
                    console.log("Found self.__next_f at index:", fIndex);
                    // extract a few lines
                    console.log(data.substring(fIndex, fIndex + 500));
                }
            }
        }
    });
});
