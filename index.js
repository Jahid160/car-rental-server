const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express')

const app = express()
const port = 3000



const uri = "mongodb+srv://RentWheels:3psr6IxnIEAAYwjp@bdpro.cwpjxwk.mongodb.net/?appName=BDPro";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/model', (req,res)=>{
  res.send('model')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

// 3psr6IxnIEAAYwjp
// RentWheels
