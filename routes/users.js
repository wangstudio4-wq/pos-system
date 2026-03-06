const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/users
router.get('/', authenticateToken, authorizeRole('owner'), async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, name, role, is_active, created_at FROM users ORDER BY created_at DESC'
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
    const { username, password, name, role } = req.body;

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

    const [result] = await pool.query(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, name, role]
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
    const { name, role, is_active, password } = req.body;
    const userId = req.params.id;

    if (parseInt(userId) === req.user.id && is_active === 0) {
      return res.status(400).json({ error: 'Tidak bisa menonaktifkan akun sendiri.' });
    }

    let query = 'UPDATE users SET name = ?, role = ?, is_active = ? WHERE id = ?';
    let params = [name, role, is_active, userId];

    if (password && password.length >= 4) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = 'UPDATE users SET name = ?, role = ?, is_active = ?, password = ? WHERE id = ?';
      params = [name, role, is_active, hashedPassword, userId];
    }

    await pool.query(query, params);
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
