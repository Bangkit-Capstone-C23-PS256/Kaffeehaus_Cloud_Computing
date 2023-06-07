const express = require('express');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inisialisasi aplikasi admin Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://project-cap-1-21109.firebaseio.com'
});

// Inisialisasi Firebase Firestore
const db = admin.firestore();

const app = express();
app.use(express.json());

// Middleware untuk memverifikasi token pengguna
const verifyToken = async (req, res, next) => {
    try {
      const token = req.headers.authorization;
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.userId = decodedToken.uid;
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ error: 'Invalid token' });
    }
  };
  

// Register user
app.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Buat user dengan Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name
    });
    
    // Simpan data pengguna ke Firestore
    await db.collection('users').doc(userRecord.uid).set({
      name: name,
      email: email
      // tambahkan data pengguna lainnya sesuai kebutuhan
    });
    
    res.status(200).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// User login
app.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Autentikasi pengguna menggunakan Firebase Authentication
      const user = await admin.auth().getUserByEmail(email);
      const userToken = await admin.auth().createCustomToken(user.uid);
      
      const userData = await getUserDataFromFirestore(user.uid);

      res.status(200).json({ token: userToken });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  });

// Get user data
app.get('/users/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Ambil data pengguna dari Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
    } else {
      const userData = userDoc.data();
      res.status(200).json(userData);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Update user data
app.put('/users/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const newData = req.body;
    
    // Update data pengguna di Firestore
    await db.collection('users').doc(userId).update(newData);
    
    res.status(200).json({ message: 'User data updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Delete user
app.delete('/users/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Hapus pengguna dari Firebase Authentication
    await admin.auth().deleteUser(userId);
    
    // Hapus data pengguna dari Firestore
    await db.collection('users').doc(userId).delete();
    
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Create preference
app.post('/preferences', verifyToken, async (req, res) => {
    try {
      const { harga, vibe, rating, lokasi, jenis } = req.body;
      const userId = req.userId;
  
      // Simpan data preferensi ke Firestore dengan menggunakan ID pengguna
      const preferenceRef = await db.collection('preferences').add({
        IdUser: userId,
        harga: harga,
        vibe: vibe,
        rating: rating,
        lokasi: lokasi,
        jenis: jenis
      });
  
      res.status(200).json({ preferenceId: preferenceRef.id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  });
  
  // Get preference by ID
  app.get('/preferences/:preferenceId', verifyToken, async (req, res) => {
    try {
      const preferenceId = req.params.preferenceId;
      const userId = req.userId;
  
      // Verifikasi bahwa preferensi dimiliki oleh pengguna yang login
      const preferenceDoc = await db.collection('preferences').doc(preferenceId).get();
      if (!preferenceDoc.exists) {
        res.status(404).json({ error: 'Preference not found' });
        return;
      }
  
      const preferenceData = preferenceDoc.data();
      if (preferenceData.IdUser !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
  
      res.status(200).json(preferenceData);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  });
  
  // Update preference
  app.put('/preferences/:preferenceId', verifyToken, async (req, res) => {
    try {
      const preferenceId = req.params.preferenceId;
      const userId = req.userId;
      const updatedData = req.body;
  
      // Verifikasi bahwa preferensi dimiliki oleh pengguna yang login
      const preferenceDoc = await db.collection('preferences').doc(preferenceId).get();
      if (!preferenceDoc.exists) {
        res.status(404).json({ error: 'Preference not found' });
        return;
      }
  
      const preferenceData = preferenceDoc.data();
      if (preferenceData.IdUser !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
  
      // Update preferensi di Firestore
      await db.collection('preferences').doc(preferenceId).update(updatedData);
  
      res.status(200).json({ message: 'Preference updated successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  });
  
  // Delete preference
  app.delete('/preferences/:preferenceId', verifyToken, async (req, res) => {
    try {
      const preferenceId = req.params.preferenceId;
      const userId = req.userId;
  
      // Verifikasi bahwa preferensi dimiliki oleh pengguna yang login
      const preferenceDoc = await db.collection('preferences').doc(preferenceId).get();
      if (!preferenceDoc.exists) {
        res.status(404).json({ error: 'Preference not found' });
        return;
      }
  
      const preferenceData = preferenceDoc.data();
      if (preferenceData.IdUser !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
  
      // Hapus preferensi dari Firestore
      await db.collection('preferences').doc(preferenceId).delete();
  
      res.status(200).json({ message: 'Preference deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  });

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
