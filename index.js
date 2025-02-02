const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://a12-pet-pals.netlify.app",
      "https://petpals-89872.firebaseapp.com",
      "https://petpals-89872.web.app",
    ],
  })
);
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
    // await client.connect();

    const usersCollection = client.db("PetPalsDb").collection("allUsers");
    const petsCollection = client.db("PetPalsDb").collection("allPets");
    const donationHistoryCollection = client
      .db("PetPalsDb")
      .collection("donationHistory");
    const campaignCollection = client
      .db("PetPalsDb")
      .collection("donationCampaign");
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
      console.log("auth token", req.headers.authorization);
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
      const isAdmin = user?.role === "admin" ? true : false;
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // -------------------------------------all apis------------------------------------

    // ----------Payment apis--------------
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      if (amount > 0) {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",

          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      }
    });

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
    app.get("/pets", verifyToken, verifyAdmin, async (req, res) => {
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
          .find({ adopted: false })
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
    app.get("/pets/userAdded/:email", verifyToken, async (req, res) => {
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

    // ---------------get campaign data----------------------
    app.get("/donationCampaign/user", verifyToken, async (req, res) => {
      const { email } = req.query;
      const filter = { email: email };
      const result = await campaignCollection
        .find(filter)
        .sort({ timestamp: -1 })
        .toArray();
      res.send(result);
    });
    app.get("/donationCampaign/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const result = await campaignCollection.findOne(filter);
      res.send(result);
    });
    app.get("/donate/random", async (req, res) => {
      const { id } = req.query;
      const filter = { _id: { $ne: new ObjectId(id) } };
      const result = await campaignCollection.find(filter).toArray();
      res.send(result);
    });
    app.get("/donationCampaign", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      try {
        const result = await campaignCollection
          .find()
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        const totalCount = await campaignCollection.countDocuments();

        res.send({
          campaigns: result,
          campaignCount: totalCount,
        });
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch campaign" });
      }
    });

    app.get(
      "/donationCampaign/history/:email",
      verifyToken,
      async (req, res) => {
        const { email } = req.params;
        const query = { ownerEmail: email };
        const result = await donationHistoryCollection
          .find(query)
          .sort({ timestamp: -1 })
          .toArray();
        res.send(result);
      }
    );
    app.get(
      "/donationCampaign/myDonation/:email",
      verifyToken,
      async (req, res) => {
        const { email } = req.params;
        const query = { user: email };
        const result = await donationHistoryCollection
          .find(query)
          .sort({ timestamp: -1 })
          .toArray();
        res.send(result);
      }
    );
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
    app.post("/donationCampaign", async (req, res) => {
      const newCampaign = req.body;
      const result = await campaignCollection.insertOne(newCampaign);
      res.send(result);
    });
    app.post("/donationCampaign/history", verifyToken, async (req, res) => {
      const newDonation = req.body;
      const result = await donationHistoryCollection.insertOne(newDonation);
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

    // campaign data update
    app.patch("/donationCampaign/donate/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const updatedValue = req.body;
      const updatedDoc = {
        $set: {
          maxAmount: updatedValue.maxAmount,
        },
      };
      const result = await campaignCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.patch("/donationCampaign/refund/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const campaign = await campaignCollection.findOne(filter);
      const updatedValue = req.body;
      if (campaign?.maxAmount >= updatedValue?.amount) {
        const updatedDoc = {
          $set: {
            maxAmount: campaign?.maxAmount - updatedValue.amount,
          },
        };
        const result = await campaignCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } else {
        res.send({ message: "Refund failed." });
      }
    });
    app.patch("/donationCampaign/update/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const updatedValue = req.body;
      const updatedDoc = {
        $set: {
          petName: updatedValue.petName,
          image: updatedValue.image,
          lastDate: updatedValue.lastDate,
          maxAmount: updatedValue?.maxAmount,
          shortDescription: updatedValue.shortDescription,
          longDescription: updatedValue.longDescription,
          timestamp: updatedValue?.timestamp,
          email: updatedValue?.email,
          userCanDonate: updatedValue.userCanDonate,
          pauseStatus: updatedValue?.pauseStatus,
        },
      };
      const result = await campaignCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.patch("/donationCampaign/pause/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const updatedValue = req.body;
      const updatedDoc = {
        $set: {
          pauseStatus: updatedValue?.pauseStatus,
        },
      };
      const result = await campaignCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/pets/status/:id", verifyToken, async (req, res) => {
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

    app.patch("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
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
    app.delete("/donationCampaign/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const result = await campaignCollection.deleteOne(filter);
      res.send(result);
    });
    app.delete("/donationCampaign/history/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await donationHistoryCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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
