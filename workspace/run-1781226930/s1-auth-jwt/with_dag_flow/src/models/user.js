const users = [];

module.exports = {
  users,
  findUserByEmail: (email) => users.find(u => u.email === email),
  addUser: (user) => {
    users.push(user);
    return user;
  }
};
