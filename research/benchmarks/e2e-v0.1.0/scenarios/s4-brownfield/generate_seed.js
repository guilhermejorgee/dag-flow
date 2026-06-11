const fs = require('fs');
const path = require('path');

const SEED_DIR = path.join(__dirname, 'seed');

// Helper to write file
const write = (file, content) => fs.writeFileSync(path.join(SEED_DIR, file), content);

// Middleware
write('middleware/auth.js', 'module.exports = (req, res, next) => next();\n');
write('middleware/logger.js', 'module.exports = (req, res, next) => next();\n');
write('middleware/error.js', 'module.exports = (err, req, res, next) => res.status(500).json({error: err.message});\n');
write('middleware/rateLimit.js', 'module.exports = (req, res, next) => next();\n');
write('middleware/validate.js', 'module.exports = (schema) => (req, res, next) => next();\n');

// Models
write('models/User.js', 'class User {}\nmodule.exports = User;\n');
write('models/Task.js', 'class Task {}\nmodule.exports = Task;\n');
write('models/Project.js', 'class Project {}\nmodule.exports = Project;\n');
write('models/Comment.js', 'class Comment {}\nmodule.exports = Comment;\n');
write('models/Tag.js', 'class Tag {}\nmodule.exports = Tag;\n');

// Controllers
for(const name of ['user', 'task', 'project', 'comment', 'tag']) {
  write(`controllers/${name}Controller.js`, `
    const ${name}Service = require('../services/${name}Service');
    exports.list = (req, res) => res.json([]);
    exports.get = (req, res) => res.json({});
    exports.create = (req, res) => res.status(201).json({});
    exports.update = (req, res) => res.json({});
    exports.remove = (req, res) => res.status(204).send();
  `);
}

// Services
for(const name of ['user', 'task', 'project', 'comment', 'tag']) {
  write(`services/${name}Service.js`, `
    const Model = require('../models/${name.charAt(0).toUpperCase() + name.slice(1)}');
    exports.findAll = () => [];
    exports.findById = (id) => ({id});
  `);
}

// Routes
for(const name of ['users', 'tasks', 'projects', 'comments', 'tags']) {
  const ctrl = name.slice(0, -1);
  write(`routes/${name}.js`, `
    const express = require('express');
    const router = express.Router();
    const ctrl = require('../controllers/${ctrl}Controller');
    const auth = require('../middleware/auth');
    router.get('/', auth, ctrl.list);
    router.post('/', auth, ctrl.create);
    router.get('/:id', auth, ctrl.get);
    router.put('/:id', auth, ctrl.update);
    router.delete('/:id', auth, ctrl.remove);
    module.exports = router;
  `);
}

// Utils
for(let i=1; i<=10; i++) {
  write(`utils/helper${i}.js`, `exports.helper${i} = () => ${i};\n`);
}

// Jobs
for(let i=1; i<=5; i++) {
  write(`jobs/job${i}.js`, `exports.run = () => console.log('job${i}');\n`);
}

// Config
write('config/database.js', 'module.exports = { url: "mongodb://localhost/test" };\n');
write('config/cache.js', 'module.exports = { url: "redis://localhost" };\n');

// README
write('README.md', '# S4 Seed\nBrownfield project with multiple routes, middleware, models, and controllers.\n');

console.log('Seed files generated.');
