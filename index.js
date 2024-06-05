const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("pet adoption site server is running.......");
});

// mongodb

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pvtbyiu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("PetPalsDb").collection("allUsers");
    const petsCollection = client.db("PetPalsDb").collection("allPets");

    // all apis

    // get apis
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/user", async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const result = await usersCollection.findOne(filter);
      res.send(result);
    });

    app.get("/pets", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
    
      try {
        const result = await petsCollection
          .find()
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();
          
        const totalCount = await petsCollection.countDocuments();
    
        res.send({
          pets: result,
          petsCount: totalCount,
        });
      } catch (error) {
        res.status(500).send({ error: 'Failed to fetch pets' });
      }
    });
    app.get("/pets/search", async (req, res) => {
      const { name } = req.query;
      try {
        let result;
        if (name) {
          result = await petsCollection.find({ petName: new RegExp(name, "i") })
            .sort({ timestamp: -1 })
            .toArray();
        } else {
          result = await petsCollection.find().sort({ timestamp: -1 }).toArray();
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error fetching pets", error });
      }
    });
    // post apis
    app.post("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const existUser = await usersCollection.findOne(filter);
      if (existUser) {
        return res.send({ message: "User already exist." });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.post("/pets", async (req, res) => {
      const newPet = req.body;
      const result = await petsCollection.insertOne(newPet);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, (req, res) => {
  console.log(`server is running on port: ${port}`);
});
