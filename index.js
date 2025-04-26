const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',  // Consider restricting this in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Use environment variables or fallback to config object
const dbConfig = {
  host: process.env.DB_HOST || 'mysql-sm-22-webstudentmanagement-22.f.aivencloud.com',
  user: process.env.DB_USER || 'avnadmin',
  password: 'AVNS_yjWd4zniwN9lIlaw-z7',
  database: process.env.DB_NAME || 'SA_Web',
  port: process.env.DB_PORT || 10065,
  ssl: {
    // Check if ca.pem exists before attempting to read it
    ca: fs.existsSync('./ca.pem') ? fs.readFileSync('./ca.pem') : undefined,
    rejectUnauthorized: true,
  },
};

// Create connection pool
const db = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('Database connection successful');
    await connection.end();
  } catch (err) {
    console.error('Database connection failed:', err);
  }
}
testConnection();

// JWT Secret from environment variable or fallback
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key';
const TOKEN_EXPIRY = '999999999999999999999h'; // Token expiry time

// Authentication middleware with better error handling
const authenticateToken = async (req, res, next) => {
  try {
    // Check for Authorization header
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }
    
    // Extract the token
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    // Verify token
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error('Token verification error:', err.message);
        return res.status(403).json({ 
          error: 'Token invalid or expired',
          details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
      
      req.user = decoded;
      next();
    });
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).json({ error: 'Authentication process failed' });
  }
};

// Authorization middleware
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
  };
};

// Login endpoint with improved security
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Basic validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Query user
    const [rows] = await db.query(
      'SELECT * FROM Users WHERE username = ? AND password = ?', 
      [username, password]
    );
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }
    
    const user = rows[0];
    
    // Generate JWT token with expiry
    const token = jwt.sign(
      { user_id: user.user_id, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: TOKEN_EXPIRY }
    );
    
    // Send response without exposing sensitive data
    res.json({ 
      token, 
      user: { 
        user_id: user.user_id, 
        username: user.username, 
        role: user.role 
      } 
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      error: 'Database connection error', 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Debug endpoint to verify token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ 
    message: 'Token valid',
    user: {
      user_id: req.user.user_id,
      role: req.user.role
    }
  });
});

// Student: Get grades
app.get('/api/sinhvien/diem', authenticateToken, restrictTo('SinhVien'), async (req, res) => {
  try {
    const { hocky, namhoc } = req.query;
    let query = `
      SELECT m.tenmon, b.diem_giua_ky, b.diem_cuoi_ky, b.diem_tong_ket, b.xep_loai, l.hocky, l.namhoc
      FROM BangDiem b
      JOIN LopGiangDay l ON b.lophoc_id = l.lophoc_id
      JOIN MonHoc m ON l.monhoc_id = m.monhoc_id
      WHERE b.sinhvien_id = ?
    `;
    const params = [req.user.user_id];
    if (hocky) { query += ' AND l.hocky = ?'; params.push(hocky); }
    if (namhoc) { query += ' AND l.namhoc = ?'; params.push(namhoc); }

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

//Student: Information of student
app.get('/api/sinhvien/thongtin', authenticateToken, restrictTo('SinhVien'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT hoten, masv, lophoc_id, tenkhoa, email, sdt 
      FROM SinhVien sv 
      JOIN DangKyHoc dkh on sv.sinhvien_id = dkh.sinhvien_id 
      JOIN Khoa k on sv.khoa_id = k.khoa_id 
      WHERE sv.sinhvien_id = (SELECT sinhvien_id 
                              FROM SinhVien SV JOIN Users U on SV.user_id = U.user_id
                              where SV.user_id = ?)`,
      [req.user.user_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});
// Student: View course information
app.get('/api/sinhvien/lophoc', authenticateToken, async (req, res) => {
  if (req.user.role !== 'SinhVien') return res.status(403).json({ error: 'Forbidden' });
  try {
    const [rows] = await db.query(
      `SELECT m.monhoc_id, m.tenmon, m.sotinchi, bd.diem_qua_trinh, bd.diem_giua_ky, bd.diem_cuoi_ky
       FROM LopGiangDay lgd
       JOIN MonHoc m ON lgd.monhoc_id = m.monhoc_id
       JOIN DangKyHoc dkh on lgd.lophoc_id = dkh.lophoc_id
       LEFT JOIN BangDiem bd ON lgd.lophoc_id = bd.lophoc_id AND bd.sinhvien_id = (SELECT sinhvien_id 
                          FROM SinhVien SV JOIN Users U on SV.user_id = U.user_id
                          where SV.user_id = ?)
       WHERE dkh.sinhvien_id = (SELECT sinhvien_id 
                          FROM SinhVien SV JOIN Users U on SV.user_id = U.user_id
                          where SV.user_id = ?)`,
      [req.user.user_id, req.user.user_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Student: Track academic progress
app.get('/api/sinhvien/hoc-tap', authenticateToken, restrictTo('SinhVien'), async (req, res) => {
  try {
    const [diem] = await db.query(`
      SELECT AVG(b.diem_tong_ket) AS diem_trung_binh, SUM(m.sotinchi) AS tong_so_tin_chi
      FROM BangDiem b
      JOIN LopGiangDay l ON b.lophoc_id = l.lophoc_id
      JOIN MonHoc m ON l.monhoc_id = m.monhoc_id
      WHERE b.sinhvien_id = ?
    `, [req.user.user_id]);
    
    const diemTB = diem[0].diem_trung_binh || 0;
    const xepLoai = diemTB >= 8.5 ? 'Giỏi' : diemTB >= 7.0 ? 'Khá' : 'Trung bình';
    res.json({
      tong_so_tin_chi: diem[0].tong_so_tin_chi || 0,
      diem_trung_binh: parseFloat(diemTB.toFixed(2)),
      xep_loai: xepLoai
    });
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});
//Teacher: View class
app.get('/api/giangvien/lophoc', authenticateToken, restrictTo('GiangVien'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT l.lophoc_id, l.monhoc_id, m.tenmon, l.namhoc, l.hocky
      FROM LopGiangDay l
      JOIN MonHoc m ON l.monhoc_id = m.monhoc_id
      WHERE l.giangvien_id in (SELECT giangvien_id 
                                FROM GiangVien GV JOIN Users U on GV.user_id = U.user_id
                                where GV.user_id = ?)
    `, [req.user.user_id]);

    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error' });
  }
});

// Teacher: Enter grades
app.post('/api/giangvien/diem', authenticateToken, restrictTo('GiangVien'), async (req, res) => {
  try {
    const { lophoc_id, danh_sach_diem } = req.body;
    
    if (!lophoc_id || !danh_sach_diem || !Array.isArray(danh_sach_diem)) {
      return res.status(400).json({ error: 'Invalid input data' });
    }
    
    for (const diem of danh_sach_diem) {
      await db.query(`
        INSERT INTO BangDiem (sinhvien_id, lophoc_id, diem_giua_ky, diem_cuoi_ky, ghi_chu)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE diem_giua_ky = ?, diem_cuoi_ky = ?, ghi_chu = ?
      `, [diem.sinhvien_id, lophoc_id, diem.diem_giua_ky, diem.diem_cuoi_ky, diem.ghi_chu,
          diem.diem_giua_ky, diem.diem_cuoi_ky, diem.ghi_chu]);
    }
    res.status(201).json({ message: 'Grades entered successfully' });
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// Teacher: Edit grades
app.put('/api/giangvien/diem', authenticateToken, restrictTo('GiangVien'), async (req, res) => {
  try {
    const { sinhvien_id, lophoc_id, diem_giua_ky, diem_cuoi_ky, ghi_chu } = req.body;
    
    if (!sinhvien_id || !lophoc_id) {
      return res.status(400).json({ error: 'Student ID and class ID required' });
    }
    
    await db.query(`
      UPDATE BangDiem 
      SET diem_giua_ky = ?, diem_cuoi_ky = ?, ghi_chu = ?
      WHERE sinhvien_id = ? AND lophoc_id = ?
    `, [diem_giua_ky, diem_cuoi_ky, ghi_chu, sinhvien_id, lophoc_id]);
    res.json({ message: 'Grades updated successfully' });
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});
//Teacher: View class id
app.get('/api/giangvien/lophoc/:lophoc_id', authenticateToken, restrictTo('GiangVien'), async (req, res) => {
  try {
    const { lophoc_id } = req.params;
    const [rows] = await db.query(`
      SELECT l.lophoc_id, l.hocky, l.namhoc, m.tenmon
      FROM LopGiangDay l
      JOIN MonHoc m ON l.monhoc_id = m.monhoc_id
      WHERE l.lophoc_id = ?
    `, [lophoc_id]);

    res.json(rows[0] || {});
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error' });
  }
});

// Teacher: View student list
app.get('/api/giangvien/lophoc/:lophoc_id/sinhvien', authenticateToken, restrictTo('GiangVien'), async (req, res) => {
  try {
    const { lophoc_id } = req.params;
    const [rows] = await db.query(`
      SELECT s.sinhvien_id, s.masv, s.hoten, b.diem_giua_ky, b.diem_cuoi_ky, b.diem_tong_ket
      FROM DangKyHoc d
      JOIN SinhVien s ON d.sinhvien_id = s.sinhvien_id
      LEFT JOIN BangDiem b ON d.sinhvien_id = b.sinhvien_id AND d.lophoc_id = b.lophoc_id
      WHERE d.lophoc_id = ?
    `, [lophoc_id]);
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// Teacher: Search student
app.get('/api/giangvien/sinhvien/:sinhvien_id', authenticateToken, restrictTo('GiangVien'), async (req, res) => {
  try {
    const { sinhvien_id } = req.params;
    const [rows] = await db.query(`
      SELECT s.sinhvien_id, s.masv, s.hoten, s.email, AVG(b.diem_tong_ket) AS diem_trung_binh
      FROM SinhVien s
      LEFT JOIN BangDiem b ON s.sinhvien_id = b.sinhvien_id
      WHERE s.sinhvien_id = ?
      GROUP BY s.sinhvien_id, s.masv, s.hoten, s.email
    `, [sinhvien_id]);
    res.json(rows[0] || {});
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// Admin: Add user
app.post('/api/admin/users', authenticateToken, restrictTo('Admin'), async (req, res) => {
  try {
    const { username, password, role, hoten, email } = req.body;
    
    if (!username || !password || !role || !hoten) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const user_id = `U${Date.now()}`;
    await db.query('INSERT INTO Users (user_id, username, password, role) VALUES (?, ?, ?, ?)', [user_id, username, password, role]);
    
    if (role === 'SinhVien') {
      await db.query('INSERT INTO SinhVien (sinhvien_id, user_id, masv, hoten, email) VALUES (?, ?, ?, ?, ?)', 
        [user_id, user_id, `SV${Date.now()}`, hoten, email]);
    } else if (role === 'GiangVien') {
      await db.query('INSERT INTO GiangVien (giangvien_id, user_id, magv, hoten, email) VALUES (?, ?, ?, ?, ?)', 
        [user_id, user_id, `GV${Date.now()}`, hoten, email]);
    } else if (role === 'Admin') {
      await db.query('INSERT INTO Admin (admin_id, user_id, hoten, email) VALUES (?, ?, ?, ?)', 
        [user_id, user_id, hoten, email]);
    }
    res.status(201).json({ user_id, message: 'User created successfully' });
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// Admin: Edit user
app.put('/api/admin/users/:user_id', authenticateToken, restrictTo('Admin'), async (req, res) => {
  try {
    const { user_id } = req.params;
    const { username, role } = req.body;
    
    if (!username || !role) {
      return res.status(400).json({ error: 'Username and role required' });
    }
    
    await db.query('UPDATE Users SET username = ?, role = ? WHERE user_id = ?', [username, role, user_id]);
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// Admin: Delete user
app.delete('/api/admin/users/:user_id', authenticateToken, restrictTo('Admin'), async (req, res) => {
  try {
    const { user_id } = req.params;
    await db.query('DELETE FROM Users WHERE user_id = ?', [user_id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// Admin: View student list
app.get('/api/admin/sinhvien', authenticateToken, restrictTo('Admin'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT sinhvien_id, masv, hoten, khoa_id FROM SinhVien');
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// Admin: View department list
app.get('/api/admin/khoa', authenticateToken, restrictTo('Admin'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT khoa_id,tenkhoa FROM Khoa');
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});
// Admin: View department id monhoc list
app.get('/api/admin/khoa/:khoa_id/monhoc', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const [rows] = await db.query('SELECT monhoc_id, tenmon FROM MonHoc WHERE khoa_id = ?', [
      req.params.khoa_id,
    ]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});
// Admin: View MonHocCuaLopGiangDay
app.get('/api/admin/monhoc/:monhoc_id/lophoc', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const [rows] = await db.query('SELECT lophoc_id FROM LopGiangDay WHERE monhoc_id = ?', [
      req.params.monhoc_id,
    ]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});
//Admin: View sinhvien of lopgiangday
app.get('/api/admin/lophoc/:lophoc_id/sinhvien', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const [rows] = await db.query(
      `SELECT sv.sinhvien_id, sv.hoten, sv.masv, bd.diem_qua_trinh, bd.diem_giua_ky, bd.diem_cuoi_ky
       FROM SinhVien sv
       JOIN DangKyHoc dkh on dkh.sinhvien_id = sv.sinhvien_id
       JOIN LopGiangDay lgd ON dkh.lophoc_id = lgd.lophoc_id
       LEFT JOIN BangDiem bd ON lgd.lophoc_id = bd.lophoc_id AND sv.sinhvien_id = bd.sinhvien_id
       WHERE lgd.lophoc_id = ?`,
      [req.params.lophoc_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});
// Admin: View student grades
app.get('/api/admin/diem', authenticateToken, restrictTo('Admin'), async (req, res) => {
  try {
    const { lophoc_id, monhoc_id, khoa_id } = req.query;
    let query = `
      SELECT s.masv, s.hoten, m.tenmon, b.diem_giua_ky, b.diem_cuoi_ky, b.diem_tong_ket
      FROM BangDiem b
      JOIN SinhVien s ON b.sinhvien_id = s.sinhvien_id
      JOIN LopGiangDay l ON b.lophoc_id = l.lophoc_id
      JOIN MonHoc m ON l.monhoc_id = m.monhoc_id
      WHERE 1=1
    `;
    const params = [];
    if (lophoc_id) { query += ' AND b.lophoc_id = ?'; params.push(lophoc_id); }
    if (monhoc_id) { query += ' AND l.monhoc_id = ?'; params.push(monhoc_id); }
    if (khoa_id) { query += ' AND s.khoa_id = ?'; params.push(khoa_id); }

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// Admin: Create class
app.post('/api/admin/lophoc', authenticateToken, restrictTo('Admin'), async (req, res) => {
  try {
    const { lophoc_id, tenlop, khoa_id, nien_khoa, so_sinh_vien, trang_thai } = req.body;
    
    if (!lophoc_id || !tenlop || !khoa_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    await db.query(`
      INSERT INTO LopHoc (lophoc_id, tenlop, khoa_id, nien_khoa, so_sinh_vien, trang_thai)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [lophoc_id, tenlop, khoa_id, nien_khoa, so_sinh_vien, trang_thai]);
    res.status(201).json({ message: 'Class created successfully' });
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// Admin: Add department
app.post('/api/admin/khoa', authenticateToken, restrictTo('Admin'), async (req, res) => {
  try {
    const { khoa_id, tenkhoa } = req.body;
    
    if (!khoa_id || !tenkhoa) {
      return res.status(400).json({ error: 'Department ID and name required' });
    }
    
    await db.query('INSERT INTO Khoa (khoa_id, tenkhoa) VALUES (?, ?)', [khoa_id, tenkhoa]);
    res.status(201).json({ message: 'Department added successfully' });
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// Admin: Add course
app.post('/api/admin/monhoc', authenticateToken, restrictTo('Admin'), async (req, res) => {
  try {
    const { monhoc_id, mamon, tenmon, sotinchi } = req.body;
    
    if (!monhoc_id || !mamon || !tenmon || !sotinchi) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    await db.query('INSERT INTO MonHoc (monhoc_id, mamon, tenmon, sotinchi) VALUES (?, ?, ?, ?)', 
      [monhoc_id, mamon, tenmon, sotinchi]);
    res.status(201).json({ message: 'Course added successfully' });
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});
// Admin: View user list
app.get('/api/admin/users', authenticateToken, restrictTo('Admin'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.user_id, u.username, u.role, 
             COALESCE(sv.hoten, gv.hoten, ad.hoten) AS hoten, 
             COALESCE(sv.email, gv.email, ad.email) AS email
      FROM Users u
      LEFT JOIN SinhVien sv ON u.user_id = sv.user_id
      LEFT JOIN GiangVien gv ON u.user_id = gv.user_id
      LEFT JOIN Admin ad ON u.user_id = ad.user_id
    `);
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});
// Admin: Reset password
app.post('/api/admin/reset-password', authenticateToken, restrictTo('Admin'), async (req, res) => {
  try {
    const { user_id, new_password } = req.body;
    
    if (!user_id || !new_password) {
      return res.status(400).json({ error: 'User ID and new password required' });
    }
    
    await db.query('UPDATE Users SET password = ? WHERE user_id = ?', [new_password, user_id]);
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Query error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// Admin: Check system status
app.get('/api/admin/system/status', authenticateToken, restrictTo('Admin'), async (req, res) => {
  res.json({ status: 'running', uptime: process.uptime() });
});

// Catch-all error handler for unhandled routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});