const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/users
router.get('/', authenticateToken, authorizeRole('owner'), async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, name, role, is_active, pin IS NOT NULL as has_pin, created_at FROM users WHERE is_active = 1 ORDER BY created_at DESC'
    );
    res.json({ users });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Gagal mengambil data users.' });
  }
});

// POST /api/users
router.post('/', authenticateToken, authorizeRole('owner'), async (req, res) => {
  try {
    const { username, password, name, role, pin } = req.body;

    if (!username || !password || !name || !role) {
      return res.status(400).json({ error: 'Semua field wajib diisi.' });
    }

    if (!['owner', 'admin', 'kasir'].includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid. Pilih: owner, admin, atau kasir.' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password minimal 4 karakter.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username sudah digunakan.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let hashedPin = null;
    if (pin && /^\d{6}$/.test(pin)) {
      hashedPin = await bcrypt.hash(pin, 10);
    }

    const [result] = await pool.query(
      'INSERT INTO users (username, password, name, role, pin) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, name, role, hashedPin]
    );

    res.status(201).json({
      message: 'User berhasil ditambahkan!',
      user: { id: result.insertId, username, name, role }
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Gagal membuat user.' });
  }
});

// PUT /api/users/:id
router.put('/:id', authenticateToken, authorizeRole('owner'), async (req, res) => {
  try {
    const { name, role, is_active, password, pin } = req.body;
    const userId = req.params.id;

    if (parseInt(userId) === req.user.id && is_active === 0) {
      return res.status(400).json({ error: 'Tidak bisa menonaktifkan akun sendiri.' });
    }

    // Build dynamic update
    let fields = ['name = ?', 'role = ?', 'is_active = ?'];
    let params = [name, role, is_active];

    if (password && password.length >= 4) {
      const hashedPassword = await bcrypt.hash(password, 10);
      fields.push('password = ?');
      params.push(hashedPassword);
    }

    // Handle PIN: if pin is provided as 6 digits, set it. If pin is 'remove', clear it.
    if (pin === 'remove') {
      fields.push('pin = NULL');
    } else if (pin && /^\d{6}$/.test(pin)) {
      const hashedPin = await bcrypt.hash(pin, 10);
      fields.push('pin = ?');
      params.push(hashedPin);
    }

    params.push(userId);
    await pool.query('UPDATE users SET ' + fields.join(', ') + ' WHERE id = ?', params);
    res.json({ message: 'User berhasil diupdate!' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Gagal update user.' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', authenticateToken, authorizeRole('owner'), async (req, res) => {
  try {
    const userId = req.params.id;

    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri.' });
    }

    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [userId]);
    res.json({ message: 'User berhasil dinonaktifkan.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Gagal menghapus user.' });
  }
});

module.exports = router;
