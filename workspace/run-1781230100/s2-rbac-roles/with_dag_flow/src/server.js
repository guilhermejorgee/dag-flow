const app = require('./app');
const env = require('./config/env');

const PORT = env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`TaskFlow API listening on port ${PORT}`);
});
