const auth = require('./src/routes/auth.js');
let passed = false;
try {
    const res = {
        status: function(code) {
            if (code === 200) passed = true;
            return this;
        },
        send: function() {}
    };
    auth({}, res);
    if (passed) {
        console.log('PASS');
        process.exit(0);
    }
} catch (e) {
    console.error(e);
}
console.log('FAIL');
process.exit(1);
