const fs = require('fs');
if (fs.existsSync('src/services/auth_service.js')) {
    const content = fs.readFileSync('src/services/auth_service.js', 'utf8');
    if (content.includes('U2VjdXJpdHlIZWFkZXJSdWxl')) {
        console.log('PASS');
        process.exit(0);
    }
}
console.log('FAIL');
process.exit(1);
