const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("pet adoption site server is running.......");
});

// mongodb

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const adoptionRequestCollection = client
      .db("PetPalsDb")
      .collection("adoptionRequest");

    // --------------------------jwt related apis-------------------------
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middle ware
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };
    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // -------------------------------------all apis------------------------------------
    // ---------------get apis-------------------
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/user/admin", verifyToken, async (req, res) => {
      const email = req.query.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const filter = { email: email };
      const user = await usersCollection.findOne(filter);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });
    // get all pets for admin Dashboard
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
        res.status(500).send({ error: "Failed to fetch pets" });
      }
    });
    // ------------get all pet by descending order and infinite scroll-----------------
    app.get("/pets/listing", async (req, res) => {
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
        res.status(500).send({ error: "Failed to fetch pets" });
      }
    });
    //--------------- get user added pet-----------------------
    app.get("/pets/userAdded/:email", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const { email } = req.params;

      try {
        const result = await petsCollection
          .find({ email: email })
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
        res.status(500).send({ error: "Failed to fetch pets" });
      }
    });
    // ----------------------------get pets with category--------------------------
    app.get("/pets/category/:petName", async (req, res) => {
      const { petName } = req.params;
      try {
        const result = await petsCollection
          .find({ petCategory: new RegExp(petName, "i") })
          .sort({ timestamp: -1 })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch pets" });
      }
    });
    // -------------------get single pet with id-------------------------------
    app.get("/pets/details/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await petsCollection.findOne({ _id: new ObjectId(id) });

        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch pets" });
      }
    });
    // ------------------get search pets with name and category------------------------
    app.get("/pets/search", async (req, res) => {
      const name = req.query.name;
      const category = req.query.category;
      console.log(category);
      const filter = { petCategory: new RegExp(category, "i") };
      try {
        let result;
        if (name) {
          result = await petsCollection
            .find({ petName: new RegExp(name, "i") })
            .sort({ timestamp: -1 })
            .toArray();
        } else if (category) {
          result = await petsCollection
            .find(filter)
            .sort({ timestamp: -1 })
            .toArray();
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error fetching pets", error });
      }
    });
    // ----------------------post apis-------------------------
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

    // --------------------adoption request api-----------------------

    app.post("/adoptionRequest", async (req, res) => {
      const newRequest = req.body;
      const result = await adoptionRequestCollection.insertOne(newRequest);
      res.send(result);
    });
    app.get("/adoptionRequest", async (req, res) => {
      const { email } = req.query;
      const filter = { ownerEmail: email };
      const result = await adoptionRequestCollection.find(filter).toArray();
      res.send(result);
    });

    // -----------------------------update api-----------------------------

    app.patch("/pets/status/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const updatedValue = req.body;
      const updatedDoc = {
        $set: {
          adopted: updatedValue.adopted,
        },
      };
      const result = await petsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.patch("/adoptionRequest/status/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const updatedValue = req.body;
      const updatedDoc = {
        $set: {
          status: updatedValue.status,
        },
      };
      const result = await adoptionRequestCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });
    app.patch("/pets/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const updatedValue = req.body;
      const updatedDoc = {
        $set: {
          petName: updatedValue.petName,
          image: updatedValue.image,
          petAge: updatedValue.petAge,
          petCategory: updatedValue.petCategory,
          location: updatedValue.location,
          shortDescription: updatedValue.shortDescription,
          longDescription: updatedValue.longDescription,
          timestamp: updatedValue.timestamp,
          adopted: false,
          email: updatedValue.email,
        },
      };
      const result = await petsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/users/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const updatedValue = req.body;
      const updatedDoc = {
        $set: {
          role: updatedValue.role,
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // -----------------------------update api end-----------------------------

    // -----------------------------delete api-----------------------------

    app.delete("/adoptionRequest/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const result = await adoptionRequestCollection.deleteOne(filter);
      res.send(result);
    });
    app.delete("/pets/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const result = await petsCollection.deleteOne(filter);
      res.send(result);
    });
    app.delete("/users/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
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
