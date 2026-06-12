const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const multer = require('multer');

router.post('/', (req, res) => {
  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Max 5MB.' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      if (err.message === 'Invalid file type') {
        return res.status(400).json({ error: 'Invalid file type' });
      }
      return res.status(500).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    res.status(200).json({
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  });
});

module.exports = router;
