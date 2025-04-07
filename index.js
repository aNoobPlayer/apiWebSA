const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Database connection with SSL
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    ca: fs.readFileSync('./ca.pem') // Adjust path to your CA certificate
  }
};

// Test database connection
async function testConnection() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('Kết nối thành công tới cơ sở dữ liệu MySQL');
    await connection.end();
  } catch (err) {
    console.error('Kết nối cơ sở dữ liệu thất bại:', err);
  }
}
testConnection();

// --- Khoa (Faculty) API ---
app.get('/api/khoa', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM Khoa');
    await connection.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/khoa', async (req, res) => {
  const { tenkhoa } = req.body;
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute('INSERT INTO Khoa (tenkhoa) VALUES (?)', [tenkhoa]);
    await connection.end();
    res.status(201).json({ khoa_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Users API ---
app.get('/api/users', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM Users');
    await connection.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute('INSERT INTO Users (username, password, role) VALUES (?, ?, ?)', [username, password, role]);
    await connection.end();
    res.status(201).json({ user_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Admin API ---
app.get('/api/admin', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM Admin');
    await connection.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin', async (req, res) => {
  const { user_id, hoten, email, sdt } = req.body;
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute('INSERT INTO Admin (user_id, hoten, email, sdt) VALUES (?, ?, ?, ?)', [user_id, hoten, email, sdt]);
    await connection.end();
    res.status(201).json({ admin_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GiangVien (Lecturer) API ---
app.get('/api/giangvien', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM GiangVien');
    await connection.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/giangvien', async (req, res) => {
  const { user_id, magv, hoten, email, sdt, khoa_id } = req.body;
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute('INSERT INTO GiangVien (user_id, magv, hoten, email, sdt, khoa_id) VALUES (?, ?, ?, ?, ?, ?)', [user_id, magv, hoten, email, sdt, khoa_id]);
    await connection.end();
    res.status(201).json({ giangvien_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SinhVien (Student) API ---
app.get('/api/sinhvien', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM SinhVien');
    await connection.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sinhvien/:id', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM SinhVien WHERE sinhvien_id = ?', [req.params.id]);
    await connection.end();
    if (rows.length === 0) return res.status(404).json({ error: 'Sinh viên không tồn tại' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sinhvien', async (req, res) => {
  const { user_id, masv, hoten, ngaysinh, gioitinh, diachi, sdt, khoa_id } = req.body;
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO SinhVien (user_id, masv, hoten, ngaysinh, gioitinh, diachi, sdt, khoa_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [user_id, masv, hoten, ngaysinh, gioitinh, diachi, sdt, khoa_id]
    );
    await connection.end();
    res.status(201).json({ sinhvien_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sinhvien/:id', async (req, res) => {
  const { user_id, masv, hoten, ngaysinh, gioitinh, diachi, sdt, khoa_id } = req.body;
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'UPDATE SinhVien SET user_id = ?, masv = ?, hoten = ?, ngaysinh = ?, gioitinh = ?, diachi = ?, sdt = ?, khoa_id = ? WHERE sinhvien_id = ?',
      [user_id, masv, hoten, ngaysinh, gioitinh, diachi, sdt, khoa_id, req.params.id]
    );
    await connection.end();
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Sinh viên không tồn tại' });
    res.json({ message: 'Cập nhật sinh viên thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sinhvien/:id', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute('DELETE FROM SinhVien WHERE sinhvien_id = ?', [req.params.id]);
    await connection.end();
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Sinh viên không tồn tại' });
    res.json({ message: 'Xóa sinh viên thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MonHoc (Subject) API ---
app.get('/api/monhoc', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM MonHoc');
    await connection.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/monhoc', async (req, res) => {
  const { mamon, tenmon, sotinchi } = req.body;
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute('INSERT INTO MonHoc (mamon, tenmon, sotinchi) VALUES (?, ?, ?)', [mamon, tenmon, sotinchi]);
    await connection.end();
    res.status(201).json({ monhoc_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- LopHoc (Class) API ---
app.get('/api/lophoc', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM LopHoc');
    await connection.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lophoc', async (req, res) => {
  const { monhoc_id, giangvien_id, namhoc, hocky, phonghoc } = req.body;
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO LopHoc (monhoc_id, giangvien_id, namhoc, hocky, phonghoc) VALUES (?, ?, ?, ?, ?)',
      [monhoc_id, giangvien_id, namhoc, hocky, phonghoc]
    );
    await connection.end();
    res.status(201).json({ lophoc_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- DangKyHoc (Course Registration) API ---
app.get('/api/dangkyhoc', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM DangKyHoc');
    await connection.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dangkyhoc', async (req, res) => {
  const { sinhvien_id, lophoc_id } = req.body;
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute('INSERT INTO DangKyHoc (sinhvien_id, lophoc_id) VALUES (?, ?)', [sinhvien_id, lophoc_id]);
    await connection.end();
    res.status(201).json({ message: 'Đăng ký học thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- BangDiem (Grades) API ---
app.get('/api/bangdiem', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM BangDiem');
    await connection.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bangdiem', async (req, res) => {
  const { sinhvien_id, lophoc_id, diem_giua_ky, diem_cuoi_ky } = req.body;
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO BangDiem (sinhvien_id, lophoc_id, diem_giua_ky, diem_cuoi_ky) VALUES (?, ?, ?, ?)',
      [sinhvien_id, lophoc_id, diem_giua_ky, diem_cuoi_ky]
    );
    await connection.end();
    res.status(201).json({ message: 'Thêm bảng điểm thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/bangdiem', async (req, res) => {
  const { sinhvien_id, lophoc_id, diem_giua_ky, diem_cuoi_ky } = req.body;
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'UPDATE BangDiem SET diem_giua_ky = ?, diem_cuoi_ky = ? WHERE sinhvien_id = ? AND lophoc_id = ?',
      [diem_giua_ky, diem_cuoi_ky, sinhvien_id, lophoc_id]
    );
    await connection.end();
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Bảng điểm không tồn tại' });
    res.json({ message: 'Cập nhật bảng điểm thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Máy chủ đang chạy trên cổng ${PORT}`);
});