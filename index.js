const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const express = require("express");
require("dotenv").config();
const app = express();
const port = 3000;
app.use(cors());
app.use(express.json());


// firebase admin adk
const serviceAccount = require("./firebaseAdminSdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});



const verifyJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const token = authHeader.split(" ")[1];
    // console.log(token);
    const decoded = await admin.auth().verifyIdToken(token);

    req.decoded = decoded; 
    next();
  } catch (err) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};


const uri =
  `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@bdpro.cwpjxwk.mongodb.net/?appName=BDPro`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("RentWheels");
    const carsCollection = db.collection("cars");
    const userDBCollection = db.collection("userDB");
    const contactCollection = db.collection("contact")
    const userCarCollection = db.collection('userCars')


    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded?.email;
      console.log(email);
      const query = { email };
      const user = await userDBCollection.findOne(query);

      if (!user || user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }

      next();
    };

    // const addCarCollection = db.collection('addCar')

    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // for home page
    app.get("/cars", async (req, res) => {
      const cursor = carsCollection.find().sort({ created_at: 1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    // for browse car page
app.get("/browse-cars", async (req, res) => {
  try {
    console.log("QUERY PARAMS:", req.query);

    const {
      search,
      category,
      minPrice,
      maxPrice,
      sort,
      page = 1,
      limit = 8,
    } = req.query;

    const query = {};

    // 🔍 Search
    if (search) {
      query.car_name = { $regex: search, $options: "i" };
    }

    // 📂 Category
    if (category) {
      query.category = category;
    }

    // 💰 Price filter
    if (minPrice !== "" && maxPrice !== "") {
      query.rent_price_per_day = {
        $gte: Number(minPrice),
        $lte: Number(maxPrice),
      };
    }

    // 🔃 Sort
    let sortOption = {};
    if (sort === "priceAsc") sortOption.rent_price_per_day = 1;
    if (sort === "priceDesc") sortOption.rent_price_per_day = -1;
    if (sort === "latest") sortOption.created_at = -1;

    const skip = (Number(page) - 1) * Number(limit);

    const cars = await carsCollection   // ✅ FIX HERE
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    const total = await carsCollection.countDocuments(query);

    res.send({
      cars,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Browse Cars Error:", error);
    res.status(500).send({ message: error.message });
  }
});

    // for browse car page
    app.get("/all-cars", async (req, res) => {
      const cursor = carsCollection.find()
      const result = await cursor.toArray();
      res.send(result);
    });






    // add car page
    app.post("/cars",verifyJWT, async (req, res) => {
      const data = req.body;
      console.log(data);

      // Example: insert the new car into MongoDB
      const result = await carsCollection.insertOne(data);

      res.send(result);
    });

    // view details page
    app.get("/browse-cars/:id", async (req, res) => {
      const { id } = req.params;
      console.log(id);
      const objectId = new ObjectId(id);
      const result = await carsCollection.findOne({ _id: objectId });

      res.send(result);
    });

    // My Listings page
app.get("/my-listing",verifyJWT,  async (req, res) => {
  const email = req.query.email;
// console.log('req.decoded_email',req.decoded, 'email',email);
// console.log(email, 'red decoded',req.decoded.email);
  if (email !== req.decoded.email) {
    return res.status(403).send({ message: "Forbidden access" });
  }

  const result = await carsCollection
    .find({ provider_email: email })
    .toArray();

  res.send(result);
});


    // my Listings page card update
    app.put("/browse-cars/:id", async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      console.log(id);
      console.log(data);
      const objectId = new ObjectId(id);
      const filter = { _id: objectId };
      const update = {
        $set: data,
      };

      const result = await carsCollection.updateOne(filter, update);

      res.send({
        success: true,
        result,
      });
    });
    // my Listings page card delete
app.delete("/browse-cars/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1️⃣ Delete booking (or rented car record)
    const deleteResult = await userCarCollection.deleteOne({
      carId: new ObjectId(id),
    });

    // 2️⃣ Update car status back to available
    const updateResult = await carsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "available" } }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).send({ message: "Car not found" });
    }

    res.send({
      success: true,
      deletedBooking: deleteResult.deletedCount,
      carStatusUpdated: updateResult.modifiedCount,
    });
  } catch (error) {
    console.error("Delete booking + update car error:", error);
    res.status(500).send({ message: "Server error" });
  }
});


    // user create api
app.post("/userDB/:id", async (req, res) => {
  const user = req.body;

  const adminEmails = ["demoadmin@example.com"];

  if (adminEmails.includes(user.email)) {
    user.role = "admin";
  }

  const existingUser = await userDBCollection.findOne({ uid: user.uid });

  if (existingUser) {
    return res.send({ message: "User already exists" });
  }

  const result = await userDBCollection.insertOne(user);
  res.send(result);
});


    app.get("/my-booking",verifyJWT, async (req, res) => {
      const cursor = userCarCollection.find().sort({ created_at: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });


    // get car details 
    app.get("/my-booking/:id",verifyJWT, async (req, res) => {
      const { id } = req.params;
      console.log(id);
      const objectId = new ObjectId(id);
      const result = await userCarCollection.findOne({ _id: objectId });

      res.send(result);
    });

    // get user by role
app.get("/users/role", verifyJWT, async (req, res) => {
  try {
    const email = req.decoded?.email;

    if (!email) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    console.log("JWT email:", email);

    const user = await userDBCollection.findOne({
      email: email.toLowerCase(),
    });

    console.log("DB user role:", user?.role);

    res.send({ role: user?.role || "user" });
  } catch (error) {
    console.error("Error fetching user role:", error);
    res.status(500).send({ message: "Server error" });
  }
});

// GET profile
app.get("/users/profile/:email", verifyJWT, async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();

    if (req.decoded.email !== email) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    const user = await userDBCollection.findOne({ email });
    res.send(user);
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// UPDATE profile
app.patch("/users/profile/:email", verifyJWT, async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();

    if (req.decoded.email !== email) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    const updatedData = req.body;

    const result = await userDBCollection.updateOne(
      { email },
      { $set: updatedData }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});



    // status update
    app.patch("/browse-cars/status/:id",verifyJWT, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      const result = await carsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );

      res.send(result);
    });

// POST: Book a car
app.post("/userCar/:carId", verifyJWT, async (req, res) => {
  try {
    const carId = req.params.carId;
    const bookingData = req.body;

    // Logged-in user email from JWT
    const userEmail = req.decoded.email;

    // Basic validation
    if (!carId) {
      return res.status(400).send({ message: "Car ID is required" });
    }

    if (!bookingData?.car_name || !bookingData?.rent_price_per_day) {
      return res.status(400).send({ message: "Invalid booking data" });
    }

    // Prevent duplicate booking by same user for same car
    const alreadyBooked = await userCarCollection.findOne({
      carId,
      provider_email: userEmail,
    });

    if (alreadyBooked) {
      return res.status(409).send({ message: "Car already booked by you" });
    }

    // Final booking document
    const bookingDoc = {
      ...bookingData,
      carId,
      provider_email: userEmail, // force from JWT (secure)
      status: "booked",
      created_at: new Date(),
    };

    const result = await userCarCollection.insertOne(bookingDoc);

    res.send({
      success: true,
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Car booking error:", error);
    res.status(500).send({ message: "Server error" });
  }
});


    // my booking update
    app.put("/my-booking/:id",verifyJWT, async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      console.log(id);
      console.log(data);
      const objectId = new ObjectId(id);
      const filter = { _id: objectId };
      const update = {
        $set: data,
      };

      const result = await carsCollection.updateOne(filter, update);

      res.send({
        success: true,
        result,
      });
    });

    // my booking page delete
app.delete("/my-booking/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Find the booking first
    const booking = await userCarCollection.findOne({ _id: new ObjectId(id) });
    if (!booking) {
      return res.status(404).send({ message: "Booking not found" });
    }

    // 2️⃣ Delete the booking
    const deleteResult = await userCarCollection.deleteOne({ _id: new ObjectId(id) });

    // 3️⃣ Update car status back to available
    const updateResult = await carsCollection.updateOne(
      { _id: new ObjectId(booking.carId) }, // Use carId from booking
      { $set: { status: "available" } }
    );

    res.send({
      success: true,
      deletedBooking: deleteResult.deletedCount,
      carStatusUpdated: updateResult.modifiedCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Server error" });
  }
});


    // search api
    app.get("/search", async (req, res) => {
      const searchText = req.query.search;
      const result = await carsCollection
        .find({ car_name: { $regex: searchText, $options: "i" } })
        .toArray();
      res.send(result);
    });

    // contact from api
    app.post("/contact", async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message)
    return res.status(400).json({ error: "All fields are required" });

  // Save to DB or send email
  // await ContactModel.create({ name, email, subject, message, createdAt: new Date() });

  const result = contactCollection.insertOne({ name, email, subject, message, createdAt: new Date() })

  // res.status(200).json({ message: "Message received" });
  res.send(result)
});


// Admin dashboard stats
app.get("/admin/cars-stats", verifyJWT, verifyAdmin, async (req, res) => {
  try {
    console.log('api hit done');
    // email from verified JWT
    const email = req.decoded?.email;

    // Total cars
    const totalCars = await carsCollection.countDocuments();

    // Available / unavailable cars
    const availableCars = await carsCollection.countDocuments({ status: "available" });
    const unavailableCars = await carsCollection.countDocuments({ status: "unavailable" });

    // Average rent per day
    const aggregateRent = await carsCollection.aggregate([
      { $group: { _id: null, avgRent: { $avg: "$rent_price_per_day" } } },
    ]).toArray();
    const averageRent = aggregateRent[0]?.avgRent || 0;

    // Cars by category
    const carsByCategory = await carsCollection.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $project: { category: "$_id", count: 1, _id: 0 } },
    ]).toArray();

    // Cars by status
    const carsByStatus = await carsCollection.aggregate([
      { $group: { _id: "$status", value: { $sum: 1 } } },
      { $project: { status: "$_id", value: 1, _id: 0 } },
    ]).toArray();

    // Cars added per month
    const carsAddedPerMonth = await carsCollection.aggregate([
      {
        $group: {
          _id: { $month: "$createdAt" }, // make sure your field is "createdAt"
          count: { $sum: 1 },
        },
      },
      { $project: { month: { $toString: "$_id" }, count: 1, _id: 0 } },
      { $sort: { month: 1 } },
    ]).toArray();

    // Recent 5 cars
    const recentCars = await carsCollection.find().sort({ createdAt: -1 }).limit(5).toArray();

    // Send response with safe defaults
    res.send({
      totalCars: totalCars || 0,
      availableCars: availableCars || 0,
      unavailableCars: unavailableCars || 0,
      averageRent: averageRent || 0,
      carsByCategory: carsByCategory || [],
      carsByStatus: carsByStatus || [],
      carsAddedPerMonth: carsAddedPerMonth || [],
      recentCars: recentCars || [],
    });
  } catch (error) {
    console.error("Error fetching cars stats:", error);
    res.status(500).send({ message: "Server error" });
  }
});


app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const searchText = req.query.searchText || "";

    const query = {
      $or: [
        { email: { $regex: searchText, $options: "i" } },
        { displayName: { $regex: searchText, $options: "i" } },
      ],
    };

    const users = await userDBCollection.find(query).toArray();
    res.send(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).send({ message: "Server error" });
  }
});


app.patch("/users/:id/role", verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["admin", "user"].includes(role)) {
      return res.status(400).send({ message: "Invalid role" });
    }

    const result = await userDBCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { role } }
    );

    res.send(result);
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).send({ message: "Server error" });
  }
});

app.get("/cars/user/:email", verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();

    const car = await userDBCollection
      .find({ createdBy: email })
      .toArray();

    res.send(car);
  } catch (error) {
    console.error("Lesson count error:", error);
    res.status(500).send({ message: "Server error" });
  }
});



  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});


