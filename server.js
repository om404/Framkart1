const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const Razorpay = require("razorpay");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ MySQL Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "ad335", // ✅ your MySQL password
  database: "framkart"
});
db.connect((err) => {
  if (err) console.error("❌ MySQL connection failed:", err);
  else console.log("✅ Connected to MySQL Database");
});

// ✅ Razorpay Setup
const razorpay = new Razorpay({
  key_id: "rzp_test_XXXXXX",        // 🔁 Replace with your test key ID
  key_secret: "XXXXXXXXXXXXXX"      // 🔁 Replace with your test key secret
});

// ✅ Send Razorpay Key to Frontend
app.get("/get-razorpay-key", (req, res) => {
  res.json({ key: razorpay.key_id });
});

// ✅ Create Razorpay Order
app.post("/create-order", async (req, res) => {
  const { amount } = req.body;
  try {
    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `order_rcptid_${Date.now()}`
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (err) {
    console.error("❌ Razorpay Order Error:", err);
    res.status(500).json({ message: "Razorpay order failed", error: err.message });
  }
});

// ✅ Save Razorpay Payment Order
app.post("/save-order", (req, res) => {
  const { name, address, pincode, phone, cart, amount, paymentId } = req.body;
  const payment_mode = "Razorpay";
  const status = "Paid";
  const productList = cart.map(item => `${item.name} x1`).join(", ");

  const sql = `INSERT INTO orders (name, address, pincode, phone, products, amount, payment_mode, status, payment_id) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [name, address, pincode, phone, productList, amount, payment_mode, status, paymentId], (err) => {
    if (err) {
      console.error("❌ Order Save Error:", err);
      return res.status(500).json({ success: false, message: "Database error", error: err.message });
    }
    res.json({ success: true });
  });
});

// ✅ Save Cash on Delivery Order
app.post("/place-cod-order", (req, res) => {
  const { name, address, pincode, phone, cart, amount, paymentMode } = req.body;
  if (!name || !address || !pincode || !phone || !cart || !amount) {
    return res.status(400).json({ success: false, message: "Missing order details" });
  }

  const productList = cart.map(item => `${item.name} x1`).join(", ");
  const sql = `INSERT INTO orders (name, address, pincode, phone, products, amount, payment_mode, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const values = [name, address, pincode, phone, productList, amount, paymentMode, "Pending"];

  db.query(sql, values, (err) => {
    if (err) {
      console.error("❌ COD Order Error:", err);
      return res.status(500).json({ success: false, message: "Database error", error: err.message });
    }
    res.json({ success: true });
  });
});

// ✅ Admin - Get All Orders
app.get("/admin/all-orders", (req, res) => {
  db.query("SELECT * FROM orders ORDER BY order_date DESC", (err, results) => {
    if (err) {
      console.error("❌ Fetch Orders Error:", err);
      return res.status(500).json({ success: false, message: "Database error", error: err.message });
    }
    res.json(results);
  });
});

// ✅ Product Upload Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ✅ Upload Product
app.post("/upload-product", upload.single("image"), (req, res) => {
  const { name, price, category } = req.body;
  const image = `/uploads/${req.file.filename}`;
  const sql = "INSERT INTO products (name, price, category, image) VALUES (?, ?, ?, ?)";
  db.query(sql, [name, price, category, image], (err, result) => {
    if (err) {
      console.error("❌ Product Upload Error:", err);
      return res.status(500).json({ success: false, message: "Database error", error: err.message });
    }
    res.json({ success: true, id: result.insertId });
  });
});

// ✅ Get All Products
app.get("/products", (req, res) => {
  db.query("SELECT * FROM products", (err, results) => {
    if (err) {
      console.error("❌ Fetch Products Error:", err);
      return res.status(500).json({ success: false, message: "Database error", error: err.message });
    }
    res.json(results);
  });
});

// ✅ Delete Product by ID
app.delete("/delete-product/:id", (req, res) => {
  const id = req.params.id;
  db.query("DELETE FROM products WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ message: "Delete failed" });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  });
});

// ✅ Delete Product by Name
app.delete("/delete-product-by-name/:name", (req, res) => {
  const name = req.params.name;
  db.query("DELETE FROM products WHERE name = ?", [name], (err, result) => {
    if (err) return res.status(500).json({ message: "Delete failed" });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Product not found" });
    res.json({ message: `Product "${name}" deleted` });
  });
});

// ✅ Serve Frontend HTML Pages
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/index.html", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/farmer.html", (req, res) => res.sendFile(path.join(__dirname, "public/farmer.html")));
app.get("/admin.html", (req, res) => res.sendFile(path.join(__dirname, "public/admin.html")));

// ✅ Start Server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
