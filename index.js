const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();
const port = process.env.PORT;
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("enevthq_db");
    const organizationCollection = db.collection("organizations");
    const eventsCollection = db.collection("events");
    const usersCollection = db.collection("user");
    const bookingCollection = db.collection("bookings");
    const paymentCollection = db.collection("payments");

    app.get("/api/organization/:email", async (req, res) => {
      const { email } = req.params;
      const result = await organizationCollection.findOne({
        organizerEmail: email,
      });
      //   console.log(result);
      res.send({ data: result });
    });

    app.post("/api/organizations", async (req, res) => {
      console.log(req.body);
      const {
        organizationName,
        organizationLogo,
        organizationWebsite,
        description,
        organizerEmail,
      } = req.body;

      const addData = {
        organizationName,
        organizationLogo,
        organizationWebsite,
        description,
        organizerEmail,
        createdAt: new Date(),
        status: "active",
      };

      const result = await organizationCollection.insertOne(addData);
      // console.log(result);

      res.send(result);
    });

    app.post("/api/events", async (req, res) => {
      const data = req.body;
      const organizer = await usersCollection.findOne({
        email: data?.organizationEmail,
      });
      const organizerEventsCounts = await eventsCollection.countDocuments({
        organizationEmail: data?.organizationEmail,
      });
      // console.log(organizerEventsCounts);

      if (!organizer?.isPremium && organizerEventsCounts >= 3) {
        return res.status(401).send({
          message: "Your free limit is over",
        });
      }
      const result = await eventsCollection.insertOne({
        ...data,
        status: "pending",
      });
      res.send(result);
    });

    app.get("/api/events/:email", async (req, res) => {
      const { email } = req.params;
      // console.log(email);

      const result = await eventsCollection
        .find({ organizationEmail: email })
        .toArray();
      res.send(result);
    });

    app.get("/api/events", async (req, res) => {
      const search = req.query.search;
      const category = req.query.category;
      const location = req.query.location;
      console.log(search,category,location);
      const query = {}; // {title: "mern"}
      if (search) {
        query.title = {
          $regex: search,
          $options: "i", // upper lower matter korbe na
        };
      }
      if (category) {
        // query.category = category;
        // ?category=Music,Tech,Digial
        // console.log(category, category.split(',')); ["Music", "Tech", "Digital"]

        query.category = { $in: category.split(",") };
      }
      if (location) {
        query.location = location;
      }

      const cursor = eventsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/api/single-events/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await eventsCollection.findOne(query);
      res.send(result);
    });

    app.patch("/api/organizations/:id", async (req, res) => {
      const { id } = req.params;
      const {
        organizationName,
        organizationLogo,
        organizationWebsite,
        description,
        organizerEmail,
      } = req.body;

      const updateData = {
        organizationName,
        organizationLogo,
        organizationWebsite,
        description,
        organizerEmail,
        createdAt: new Date(),
        status: "active",
      };

      const result = await organizationCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            ...updateData,
          },
        },
      );
      // console.log(result);

      res.send(result);
    });

    app.patch("/api/users/upgrade-premium/:email", async (req, res) => {
      const { email } = req.params;
      const { amount, transactionId, paymentStatus, paymentType } = req.body;

      const result = await usersCollection.updateOne(
        { email },
        {
          $set: {
            isPremium: true,
          },
        },
      );
      const paymentData = {
        userEmail: email,
        amount,
        transactionId,
        paymentStatus,
        paymentType,
        paidAt: new Date(),
      };

      await paymentCollection.insertOne(paymentData);

      res.send(result);
    });


     app.post('/api/events/booking', async (req, res) => {
      const { amount, evetId, eventTitle, quantity, email, paymentType, transactionId, paymentStatus } = req.body;
      // console.log(req.body);
      const bookingData = {
        evetId,
        eventTitle,
        attendeeEmail: email,
        quantity,
        amount,
        transactionId,
        paymentStatus,
        bookingDate: new Date(),
      };
      const isBookingExist = await bookingCollection.findOne({ transactionId });
      if (isBookingExist) {
        return res.status(200).send({ message: 'Already paid' });
      }
      const bookingRes = await bookingCollection.insertOne(bookingData);

      await eventsCollection.updateOne(
        { _id: new ObjectId(evetId) },
        {
          $inc: {
            capacity: -quantity,
          },
        }
      );
      const paymentData = {
        userEmail: email,
        amount,
        transactionId,
        paymentStatus,
        paymentType,
        paidAt: new Date(),
      };

      await paymentCollection.insertOne(paymentData);
      res.send(bookingRes);
    });

    app.patch("/api/events/:id", async (req, res) => {
      // console.log(req.body);
      const { id } = req.params;

      const updateData = req.body;

      const result = await eventsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            ...updateData,
          },
        },
      );
      // console.log(result);

      res.send(result);
    });

    app.delete("/api/events/:id", async (req, res) => {
      const { id } = req.params;
      const result = await eventsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server Running Well");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
