function loginRoute(req, res) {
  // BUG: undefinedVar is not defined
  if (undefinedVar) {
      res.status(200).send('Login successful');
  }
}
module.exports = loginRoute;
