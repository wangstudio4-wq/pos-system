const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/auth/cashiers - List active kasir for PIN login (no auth required)
router.get('/cashiers', async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, name, username FROM users WHERE role = ? AND is_active = 1 AND pin IS NOT NULL',
      ['kasir']
    );
    res.json({ cashiers: users });
  } catch (err) {
    console.error('List cashiers error:', err);
    res.status(500).json({ error: 'Gagal mengambil data kasir.' });
  }
});

// POST /api/auth/login-pin - Login with PIN
router.post('/login-pin', async (req, res) => {
  try {
    const { user_id, pin } = req.body;

    if (!user_id || !pin) {
      return res.status(400).json({ error: 'Pilih kasir dan masukkan PIN.' });
    }

    const [users] = await pool.query(
      'SELECT * FROM users WHERE id = ? AND is_active = 1',
      [user_id]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Kasir tidak ditemukan.' });
    }

    const user = users[0];

    if (!user.pin) {
      return res.status(401).json({ error: 'PIN belum diatur untuk kasir ini.' });
    }

    const validPin = await bcrypt.compare(pin, user.pin);
    if (!validPin) {
      return res.status(401).json({ error: 'PIN salah.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      message: 'Login berhasil!',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('PIN login error:', err);
    res.status(500).json({ error: 'Gagal login. Coba lagi.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi.' });
    }

    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ? AND is_active = 1',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    const user = users[0];

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      message: 'Login berhasil!',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Gagal login. Coba lagi.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, name, role FROM users WHERE id = ? AND is_active = 1',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan.' });
    }

    res.json({ user: users[0] });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Gagal mengambil data user.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
      return res.status(400).json({ error: 'Password lama dan baru wajib diisi.' });
    }

    if (new_password.length < 4) {
      return res.status(400).json({ error: 'Password baru minimal 4 karakter.' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = users[0];

    const validPassword = await bcrypt.compare(old_password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Password lama salah.' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    res.json({ message: 'Password berhasil diubah!' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Gagal mengubah password.' });
  }
});

// POST /api/auth/change-pin
router.post('/change-pin', authenticateToken, async (req, res) => {
  try {
    const { old_pin, new_pin } = req.body;

    if (!new_pin || new_pin.length !== 6 || !/^\d{6}$/.test(new_pin)) {
      return res.status(400).json({ error: 'PIN harus 6 digit angka.' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = users[0];

    // If user already has a PIN, verify old PIN
    if (user.pin) {
      if (!old_pin) {
        return res.status(400).json({ error: 'PIN lama wajib diisi.' });
      }
      const validPin = await bcrypt.compare(old_pin, user.pin);
      if (!validPin) {
        return res.status(401).json({ error: 'PIN lama salah.' });
      }
    }

    const hashedPin = await bcrypt.hash(new_pin, 10);
    await pool.query('UPDATE users SET pin = ? WHERE id = ?', [hashedPin, req.user.id]);

    res.json({ message: 'PIN berhasil diubah!' });
  } catch (err) {
    console.error('Change PIN error:', err);
    res.status(500).json({ error: 'Gagal mengubah PIN.' });
  }
});

module.exports = router;
