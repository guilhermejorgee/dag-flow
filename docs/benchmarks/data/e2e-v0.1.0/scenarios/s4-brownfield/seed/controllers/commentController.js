
    const commentService = require('../services/commentService');
    exports.list = (req, res) => res.json([]);
    exports.get = (req, res) => res.json({});
    exports.create = (req, res) => res.status(201).json({});
    exports.update = (req, res) => res.json({});
    exports.remove = (req, res) => res.status(204).send();
  