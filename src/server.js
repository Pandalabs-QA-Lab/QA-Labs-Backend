const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`QA Lab backend listening on http://localhost:${env.port}`);
});
