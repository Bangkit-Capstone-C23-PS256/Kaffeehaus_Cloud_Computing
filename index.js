const express = require('express');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

const multer = require('multer');

const app = express();
const upload = multer();
app.use(express.json());


// Enable CORS
app.use(upload.none());

// Initialize Firebase admin app
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Initialize Firestore instance
const db = admin.firestore(); 
const usersCollection = db.collection('users');
const preferensiCollection = db.collection('preferensi');

// Add a new user to Firestore
app.post('/users/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create a new document with auto-generated ID and email attribute
    const newUser = {
      id: uuidv4(),
      email: email,
      name: name,
      password: hashedPassword
    };

    const docRef = await usersCollection.add(newUser);
    const newUserId = docRef.id;

    const response = {
      success : true,
      message : "User Created",
    }

    res.status(201).json(response);
  } catch (error) {
    res.status(500).send('Error adding user: ' + error);
  }
});

// Get a user by document ID from Firestore
app.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const doc = await usersCollection.doc(userId).get();

    if (doc.exists) {
      const user = doc.data();
      user.id = doc.id;
      res.status(200).json(user);
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    res.status(500).send('Error getting user: ' + error);
  }
});

// Update a user by document ID in Firestore
app.put('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const updatedUser = req.body;

    await usersCollection.doc(userId).update(updatedUser);
    res.status(200).send('User updated successfully');
  } catch (error) {
    res.status(500).send('Error updating user: ' + error);
  }
});

// Delete a user by document ID from Firestore
app.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    await usersCollection.doc(userId).delete();
    res.status(200).send('User deleted successfully');
  } catch (error) {
    res.status(500).send('Error deleting user: ' + error);
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Mencari pengguna berdasarkan email
    const userDoc = await db.collection('users').where('email', '==', email).limit(1).get();
    
    // Jika pengguna tidak ditemukan
    if (userDoc.empty) {
      return res.status(401).json({ error: 'User Not Founds' });
    }

    const user = userDoc.docs[0].data();
    const userId = user.id;

    // Membandingkan password yang diberikan dengan password terenkripsi
    const isPasswordMatched = await bcrypt.compare(password, user.password);

    // Jika password cocok
    if (isPasswordMatched) {
      // Lakukan proses login
      // ...

      const response = {
        success : true,
        message : "Login Successful",
        LoginResult: {
          id : userId,
          ...user
        }
      }

      return res.status(200).json(response);
    } else {

      const response = {
        success : false,
        message : "Invalid Credentials",
      }

      // Jika password tidak cocok
      return res.status(401).json(response);
    }
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint untuk menambahkan preferensi
app.post('/preferensi', async (req, res) => {
  try {
    // Mendapatkan ID pengguna dari objek permintaan
    const userId = req.body.userId;

    // Mendapatkan data preferensi dari objek permintaan
    const { harga, vibe, rating, lokasi, jenis } = req.body;

    // Membuat objek preferensi baru
    const preferensiData = {
      harga,
      vibe,
      rating,
      lokasi,
      jenis,
      userId
    };

    // Menyimpan preferensi ke koleksi "preferensi" di Firestore
    const preferensiRef = await admin.firestore().collection('preferensi').add(preferensiData);

    // Respon ke pengguna dengan ID preferensi yang baru ditambahkan

    const response = {
      success : true,
      message : "Berhasil menambahkan preferensi",
      PreferensiResult : {
        preferensiId : preferensiRef.id,
        ...preferensiData
      }
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Gagal menambahkan preferensi' });
  }
});


// Start the server on port 3000
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});