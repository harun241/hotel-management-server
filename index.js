
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


app.get('/trending/tips', async (req, res) => {
  try {
    const trendingTips = await trendingTipsCollection
      .find({ istrending: true })
      .limit(6)
      .toArray();

    res.json(trendingTips);
  } catch (error) {
    console.error("Error in /tips/trending:", error);
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/garden-tips', async (req, res) => {
  try {
    const tip = req.body;

    if (tip.totalLiked === undefined) {
      tip.totalLiked = 0;
    }

    const result = await tipsCollection.insertOne(tip);
    res.status(201).json({ message: 'Tip saved successfully', id: result.insertedId });
  } catch (error) {
    console.error('Error saving tip:', error);
    res.status(500).json({ message: 'Failed to save tip', error: error.message });
  }
});


app.get('/api/garden-tips', async (req, res) => {
  try {
    const userId = req.query.userId;
    const query = userId ? { userId } : {};
    const tips = await tipsCollection.find(query).toArray();
    res.json(tips);
  } catch (error) {
    console.error('Error fetching tips:', error);
    res.status(500).json({ message: 'Failed to fetch tips' });
  }
});

app.get('/api/garden-tips/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid tip ID' });
    }

    const tip = await tipsCollection.findOne({ _id: new ObjectId(id) });
    if (!tip) {
      return res.status(404).json({ message: 'Tip not found' });
    }

    res.json(tip);
  } catch (error) {
    console.error('Error fetching tip details:', error);
    res.status(500).json({ message: 'Failed to fetch tip details' });
  }
});


app.put('/api/garden-tips/:id', async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid tip ID' });
    }

    const {
      title,
      plantType,
      difficultyLevel,
      description,
      imagesUrl,
      isPublic,
    } = req.body;

    const result = await tipsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          title,
          plantType,
          difficultyLevel,
          description,
          imagesUrl,
          isPublic,
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Tip not found' });
    }

    res.json({ message: 'Tip updated successfully' });
  } catch (error) {
    console.error('Error updating tip:', error);
    res.status(500).json({ message: 'Failed to update tip' });
  }
});


 


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
