require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const moment = require('moment');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Firebase Admin Initialization
const serviceAccount = require('./firebase-admin.key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Verify Firebase Token Middleware
const VerifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// MongoDB Connection
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
    await client.connect();
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

// JWT API
app.post('/jwt', async (req, res) => {
  const { email } = req.body;
  const user = { email };
  const token = jwt.sign(user, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
  res.send({ token });
});

// Root route
app.get('/', (req, res) => {
  res.send('🌿 hotel management server is running');
});

// Get Top Rated Hotels
app.get('/hotels/top-rated', async (req, res) => {
  try {
    const topRatedRooms = await roomCollection.find({ rating: { $gt: 4.7 } }).limit(6).toArray();
    res.json(topRatedRooms);
  } catch (error) {
    console.error("Error in /hotels/top-rated:", error);
    res.status(500).json({ error: error.message });
  }
});

// All Rooms
app.get('/all-rooms', async (req, res) => {
  try {
    const allRooms = await roomCollection.find().toArray();
    res.json(allRooms);
  } catch (error) {
    console.error("Error in /all-rooms", error);
    res.status(500).json({ error: error.message });
  }
});

// Room Details
app.get('/api/rooms/:id', async (req, res) => {
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

// Get Reviews for a Room
app.get('/api/reviews', async (req, res) => {
  const { roomId } = req.query;
  if (!roomId) return res.status(400).json({ message: "roomId query parameter is required" });

  try {
    const reviews = await reviewsCollection.find({ roomId: new ObjectId(roomId) }).toArray();
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Book a Room
app.post('/api/bookings', async (req, res) => {
  const { roomId, userEmail, userName, bookingDate } = req.body;

  if (!roomId || !userEmail || !bookingDate) {
    return res.status(400).json({ success: false, message: "roomId, userEmail, and bookingDate are required" });
  }

  try {
    const room = await roomCollection.findOne({ _id: new ObjectId(roomId) });
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    const bookingDateObj = new Date(bookingDate);
    if (isNaN(bookingDateObj.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid bookingDate" });
    }

    const existingBooking = await bookingsCollection.findOne({
      roomId: new ObjectId(roomId),
      bookingDate: bookingDateObj,
    });

    if (existingBooking) {
      return res.status(409).json({ success: false, message: "Room already booked for this date" });
    }

    const booking = {
      roomId: new ObjectId(roomId),
      userEmail,
      userName: userName || "Anonymous",
      bookingDate: bookingDateObj,
      createdAt: new Date(),
    };

    await bookingsCollection.insertOne(booking);
    res.json({ success: true, message: "Room booked successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get Bookings (Protected)
app.get('/api/bookings', VerifyFirebaseToken, async (req, res) => {
  const { roomId, userEmail } = req.query;
  console.log('req header',req.headers);

  if (req.tokenEmail !== userEmail) {
    return res.status(403).send({ message: 'Forbidden access' });
  }

  try {
    let filter = {};
    if (roomId) filter.roomId = new ObjectId(roomId);
    if (userEmail) filter.userEmail = userEmail;

    const bookings = await bookingsCollection.find(filter).toArray();

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

// Edit Booking Date
app.patch('/api/bookings/:id', async (req, res) => {
  const bookingId = req.params.id;
  const { bookingDate, roomId } = req.body;

  if (!bookingDate || !roomId) {
    return res.status(400).json({ message: "bookingDate and roomId are required" });
  }

  try {
    const bookingObjectId = new ObjectId(bookingId);
    const bookingDateObj = new Date(bookingDate);

    const room = await roomCollection.findOne({ _id: new ObjectId(roomId) });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const conflict = await bookingsCollection.findOne({
      roomId: new ObjectId(roomId),
      bookingDate: bookingDateObj,
      _id: { $ne: bookingObjectId },
    });

    if (conflict) {
      return res.status(409).json({ message: 'Date already booked for this room' });
    }

    const result = await bookingsCollection.updateOne(
      { _id: bookingObjectId },
      { $set: { bookingDate: bookingDateObj } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'Booking not found or no change' });
    }

    const updatedBooking = await bookingsCollection.findOne({ _id: bookingObjectId });
    res.json(updatedBooking);

  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ message: 'Failed to update booking' });
  }
});

// Cancel Booking
app.delete('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const bookingDate = moment(booking.bookingDate);
    const today = moment().startOf('day');
    const latestCancellationDate = moment(bookingDate).subtract(1, 'days');

    if (today.isAfter(latestCancellationDate)) {
      return res.status(403).json({
        message: 'Cancellation period has expired. You can only cancel at least 1 day before the booking date.',
      });
    }

    const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Failed to delete the booking.' });
    }

    res.json({ message: 'Booking cancelled successfully and room is now available again.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error cancelling booking', error: err.message });
  }
});

// Post Review
app.post('/api/reviews', async (req, res) => {
  const { roomId, userEmail, userName, rating, comment } = req.body;

  if (!roomId || !userEmail || !rating || !comment) {
    return res.status(400).json({ message: 'roomId, userEmail, rating, and comment are required' });
  }

  try {
    const booking = await bookingsCollection.findOne({ roomId: new ObjectId(roomId), userEmail });

    if (!booking) {
      return res.status(403).json({ message: 'You can only review rooms you have booked.' });
    }

    const existingReview = await reviewsCollection.findOne({ roomId: new ObjectId(roomId), userEmail });
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this room.' });
    }

    const newReview = {
      roomId: new ObjectId(roomId),
      userEmail,
      userName: userName || 'Anonymous',
      rating: Number(rating),
      comment,
      timestamp: new Date(),
    };

    await reviewsCollection.insertOne(newReview);

    res.status(201).json({ message: 'Review submitted successfully.' });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ message: 'Error submitting review.' });
  }
});

// Latest Reviews
app.get('/reviews', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  try {
    const reviews = await reviewsCollection
      .find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    res.send(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Error fetching reviews.' });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
