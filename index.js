
require('dotenv').config();
const express = require('express');
const app = express();

const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB URI and Client
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@rjdvhav.mongodb.net/?retryWrites=true&w=majority&appName=hash`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let roomCollection;


async function run() {
  try {
    const hoteldb = client.db('hoteldb');

    roomCollection = hoteldb.collection('FeaturedRooms');
   
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('🌿 hotel management server is running');
});

app.get('/hotels/top-rated', async (req, res) => {
  try {
    const topRatedRooms = await roomCollection
      .find({ rating: { $gt: 4.5 } }) 
      .limit(6)
      .toArray();

    res.json(topRatedRooms);
  } catch (error) {
    console.error("Error in /hotels/top-rated:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/all-rooms', async (req, res) => {
  try {
    const allRooms = await roomCollection.find().toArray(); 
    res.json(allRooms);
  } catch (error) {
    console.error("Error in /all-rooms", error);
    res.status(500).json({ error: error.message });
  }
});



