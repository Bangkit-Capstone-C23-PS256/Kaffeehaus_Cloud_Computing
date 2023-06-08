const express = require('express');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: '.env'});
const {promisify} = require('util');
const jwt = require('jsonwebtoken');
const verify = promisify(jwt.verify);
const JWT_SECRET = process.env.ACCESS_TOKEN_SECRET;

const multer = require('multer');


const app = express();
const upload = multer();
app.use(express.json());


// Enable CORS
app.use(upload.none());

const generateToken = (id) => {
  return jwt.sign({id: id}, JWT_SECRET);
};

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
    const idForUser = uuidv4()
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create a new document with auto-generated ID and email attribute
    const newUser = {
      id: idForUser,
      email: email,
      name: name,
      password: hashedPassword
    };

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
app.get('/users', async (req, res) => {
  const token = req.headers.authorization;
  try {
    // Decode token id dari payload
    const decoded = await verify(token.split(" ")[1], JWT_SECRET);
    const id = decoded.id;
    console.log(id);

    //const userId = req.params.id;
    //const doc = await db.collection('users').where('id', '==', id).limit(1).get();
    const doc = await usersCollection.doc(id).get();
    const userData = doc.data();
    res.send({name: userData.name, email: userData.email});

   
  } catch (error) {
    res.status(500).send('Error getting user: ' + error);
  }
});

// Update a user by document ID in Firestore
app.put('/users', async (req, res) => {
  const token = req.headers.authorization;
  try {
     // Decode token id dari payload
     const decoded = await verify(token.split(" ")[1], JWT_SECRET);
     const id = decoded.id;
 
     //const userId = req.params.id;
     const {name} = req.body; 

    await usersCollection.doc(id).update({name});
    res.status(200).send('User updated successfully');
  } catch (error) {
    res.status(500).send('Error updating user: ' + error);
  }
});

// Delete a user by document ID from Firestore
app.delete('/users', async (req, res) => {
  try {
    const decoded = await verify(token.split(" ")[1], JWT_SECRET);
    const id = decoded.id;

    await usersCollection.doc(id).delete();
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
    
    // Buat Token
    const token = generateToken(userId);

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
          name : user.name,
          email : user.email,
          token : token
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
  const token = req.headers.authorization;
  try {
    // Mendapatkan ID pengguna dari objek permintaan
    const decoded = await verify(token.split(" ")[1], JWT_SECRET);
    const id = decoded.id;

    // Mendapatkan data preferensi dari objek permintaan
    const { ambience, name, utils, view } = req.body;

    // Membuat objek preferensi baru
    const preferensiData = {
      ambience: ambience,
      name: name,
      utils: utils,
      view: view,
      userId : id
    };
    console.log(preferensiData);

    // Menyimpan preferensi ke koleksi "preferensi" di Firestore
    const preferensiRef = await usersCollection.doc(id).collection("preferensi").doc().set(preferensiData)

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

//Get Preferensi by document ID from Firestore
app.get('/preferensi', async (req, res) => {
  const token = req.headers.authorization;
  try {
    // Decode token id dari payload
    const decoded = await verify(token.split(" ")[1], JWT_SECRET);
    const id = decoded.id;

    const snapshotPreferensi = await usersCollection.doc(id).collection('preferensi').get();
    const preferensiData = [];

    snapshotPreferensi.forEach(doc => {
      const preferensi = doc.data();
      preferensi.id = doc.id;
      preferensiData.push(preferensi);
    });
    res.status(200).json(preferensiData);
  } catch (error) {
    res.status(500).send('Error getting user: ' + error);
  }
});


// Start the server on port 3000
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});