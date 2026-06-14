const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Mock user fetching
        const user = { username: 'admin', passwordHash: '$2b$10$somehashvalue' };
        
        if (username !== user.username) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // BUG: Missing await here
        const match = bcrypt.compare(password, user.passwordHash);
        
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.status(200).json({ token: 'mock-jwt-token' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
