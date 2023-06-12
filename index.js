const express = require('express');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
const multer = require('multer');
require("dotenv").config();
const auth = require("./auth");
const idForUser = uuidv4()

const PORT = process.env.PORT || 3000;
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
db.settings({ ignoreUndefinedProperties: true })
const usersCollection = db.collection('users');
const preferensiCollection = db.collection('preferensi');

// Add a new user to Firestore
app.post('/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create a new document with auto-generated ID and email attribute
    const newUser = {
      id: idForUser,
      email: email,
      name: name,
      password: hashedPassword
    };

    const token = jwt.sign(
      { user_id: newUser.id, email },
      process.env.TOKEN_KEY,
      {
        expiresIn: "30d",
      }
    );

    newUser.token = token

    const docRef = await usersCollection.doc(idForUser).set(newUser);
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

      const token = jwt.sign(
        { user_id: userId, email},
        process.env.TOKEN_KEY,
        {
          expiresIn: "30d",
        }
      );

      const response = {
        success : true,
        message : "Login Successful",
        loginResult: {
          id : userId,
          name : user.name,
          token : user.token
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
app.post('/preferensi', auth, async (req, res) => {
  try {
    // Mendapatkan ID pengguna dari objek permintaan
    const userId = req.body.userId;

    // Mendapatkan data preferensi dari objek permintaan
    const { name , ambience, utils, view } = req.body;

    // Membuat objek preferensi baru
    const preferensiData = {
      name,
      ambience,
      utils,
      view,
      userId
    };

 

    const parentDoc = usersCollection.doc?.(userId)

    // Menyimpan preferensi ke koleksi "preferensi" di Firestore
    const preferensiRef = await parentDoc.collection("preferensi").doc().set(preferensiData);

    // Respon ke pengguna dengan ID preferensi yang baru ditambahkan

    const response = {
      success : true,
      message : "Berhasil menambahkan preferensi",
      preferensiResult : {
        preferensiId : preferensiRef.id,
        name : name,
        ambience : ambience,
        utils : utils,
        view : view,
        userId : userId
      }
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Gagal menambahkan preferensi' });
  }
});

app.post("/preferensiall", auth, async (req, res) => {
  
  const userId = req.body.userId;

  const snapshotPreferensi = await usersCollection?.doc(userId).collection("preferensi").get()
  const preferensiData = []

  snapshotPreferensi.forEach(doc => {
    const preferensi = doc.data()
    preferensi.id = doc.id
    preferensiData.push(preferensi)
  })

  res.status(200).json(preferensiData)

})

app.get("/welcome", auth, (req, res) => {
  res.status(200).send("Welcome 🙌 ");
});

app.get("/", (req, res) => {
  res.status(200).send("Welcome 🙌 ");
});


// Start the server on port 3000
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});