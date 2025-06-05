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
let reviewsCollection; 
let bookingsCollection;  

async function run() {
  try {
    const hoteldb = client.db('hoteldb');

    roomCollection = hoteldb.collection('FeaturedRooms');
    reviewsCollection = hoteldb.collection('reviews');     
    bookingsCollection = hoteldb.collection('bookings');  

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
      .find({ rating: { $gt: 4.7 } }) 
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

app.get("/api/rooms/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const room = await roomCollection.findOne({ _id: new ObjectId(id) });
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


app.get('/api/reviews', async (req, res) => {
  const { roomId } = req.query;
  if (!roomId) return res.status(400).json({ message: "roomId query parameter is required" });

  try {
    const reviews = await reviewsCollection.find({ roomId }).toArray();
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


app.post('/api/reviews', async (req, res) => {
  const { roomId, user, comment, rating } = req.body;
  if (!roomId || !comment || !rating) {
    return res.status(400).json({ message: "roomId, comment, and rating are required" });
  }

  try {
    const review = { roomId, user: user || "Anonymous", comment, rating, createdAt: new Date() };
    const result = await reviewsCollection.insertOne(review);
    res.json({ success: true, reviewId: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add review" });
  }
});


app.post('/api/bookings', async (req, res) => {
  const { roomId, userEmail, userName, bookingDate } = req.body;

  if (!roomId || !userEmail || !bookingDate) {
    return res.status(400).json({ success: false, message: "roomId, userEmail, and bookingDate are required" });
  }

  try {
 
    const room = await roomCollection.findOne({ _id: new ObjectId(roomId) });
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });


    const existingBooking = await bookingsCollection.findOne({
      roomId,
      bookingDate: new Date(bookingDate),
    });
    if (existingBooking) {
      return res.status(409).json({ success: false, message: "Room already booked for this date" });
    }

    const booking = {
      roomId,
      userEmail,
      userName: userName || "Anonymous",
      bookingDate: new Date(bookingDate),
      createdAt: new Date(),
    };

    await bookingsCollection.insertOne(booking);
    res.json({ success: true, message: "Room booked successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



app.get('/api/bookings', async (req, res) => {
  const { roomId, userEmail } = req.query;

  try {
    let filter = {};
    if (roomId) filter.roomId = roomId;
    if (userEmail) filter.userEmail = userEmail;

    const bookings = await bookingsCollection.find(filter).toArray();

    // Fetch room data for each booking
    const bookingsWithRoom = await Promise.all(
      bookings.map(async (booking) => {
        const room = await roomCollection.findOne({ _id: new ObjectId(booking.roomId) });
        return { ...booking, room };
      })
    );

    res.json(bookingsWithRoom);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});



// PATCH /api/bookings/:id
app.patch('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { bookingDate } = req.body;

  if (!bookingDate) {
    return res.status(400).json({ message: 'New booking date is required' });
  }

  try {
    const result = await bookingsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { bookingDate } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'Booking not found or date unchanged' });
    }

    res.json({ message: 'Booking date updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update booking date', error: error.message });
  }
});



app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
