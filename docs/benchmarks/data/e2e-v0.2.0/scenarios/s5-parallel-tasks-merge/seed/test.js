const fs = require('fs');
if (fs.existsSync('src/index.js') && fs.existsSync('src/logger.js') && fs.existsSync('src/cache.js')) {
    console.log('PASS');
    process.exit(0);
}
console.log('FAIL');
process.exit(1);
