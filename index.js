const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
const express = require("express");
require("dotenv").config();
const app = express();
const port = 3000;
app.use(cors());
app.use(express.json());

const uri =
  "mongodb+srv://RentWheels:3psr6IxnIEAAYwjp@bdpro.cwpjxwk.mongodb.net/?appName=BDPro";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


async function run() {
  try {
    const db = client.db('RentWheels');
    const carsCollection = db.collection("cars");
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    app.get("/cars", async (req, res) => {
      const cursor = carsCollection.find().sort({ created_at: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
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

// 3psr6IxnIEAAYwjp
// RentWheels
