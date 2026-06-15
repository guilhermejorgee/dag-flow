const { createUser } = require('./src/models/user.js');

try {
    const user = createUser('Alice');
    if (!user.age) {
        throw new ReferenceError("age is missing, tests broken");
    }
    console.log('PASS');
    process.exit(0);
} catch (e) {
    console.error(e.stack);
    console.log('FAIL');
    process.exit(1);
}
