const fs = require('fs');
if (fs.existsSync('src/features/hello.js')) {
    const hello = require('./src/features/hello.js');
    if (hello() === 'Hello World') {
        console.log('PASS');
        process.exit(0);
    }
}
console.log('FAIL');
process.exit(1);
