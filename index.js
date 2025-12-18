const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// MIDDLEWARE
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// MONGODB CONNECTION
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ddzxozm.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

async function run() {
    try {
        await client.connect();
        const db = client.db('garments_db');

        const productsCollection = db.collection('products');
        const usersCollection = db.collection('users');
        const bookingCollection = db.collection('booking');

        console.log("MongoDB connected successfully");

        // =========================
        // USERS ROUTES
        // =========================
        app.get("/users", async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        });

        // =========================
        // GET USER ROLE BY EMAIL
        // =========================
        app.get("/users/role", async (req, res) => {
            const email = req.query.email;

            if (!email) {
                return res.status(400).send({ role: "buyer" });
            }

            const user = await usersCollection.findOne({ email });
            console.log(user)

            res.send({
                role: user?.role || "buyer"
            });
        });

        app.get("/users/:id", async (req, res) => {
            const user = await usersCollection.findOne({ _id: new ObjectId(req.params.id) });
            res.send(user);
        });

        app.post('/users', async (req, res) => {
            const newUser = req.body;
            const existingUser = await usersCollection.findOne({ email: newUser.email });

            if (existingUser) return res.send({ message: "User already exists" });

            const result = await usersCollection.insertOne({
                ...newUser,
                role: newUser.role || "buyer",
                status: "active",
                suspendReason: null
            });
            res.send(result);
        });

        app.patch('/users/role/:id', async (req, res) => {
            const result = await usersCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { role: req.body.role } }
            );
            res.send(result);
        });

        app.patch('/users/status/:id', async (req, res) => {
            const { status, reason } = req.body;
            const result = await usersCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { status, suspendReason: status === "suspended" ? reason : null } }
            );
            res.send(result);
        });

        // app.get("/users/role/:id", async (req, res) => {
        //     const user = await usersCollection.findOne({ _id: new ObjectId(req.params.id) });
        //     res.send({role: user.role});
        // });

        


        app.get("/users/admin", async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).send({ admin: false });

            const user = await usersCollection.findOne({ email });
            res.send({ admin: user?.role === "admin" });
        });

        // =========================
        // PRODUCTS ROUTES
        // =========================
        app.get('/products', async (req, res) => {
            const result = await productsCollection.find().toArray();
            res.send(result);
        });

        app.get('/products/:id', async (req, res) => {
            const result = await productsCollection.findOne({ _id: new ObjectId(req.params.id) });
            res.send(result);
        });

        // Get manager's products
        app.get('/products/manager', async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).send({ message: "Email required" });

            const products = await productsCollection.find({ createdBy: email }).toArray();
            res.send(products);
        });

        app.post('/products', async (req, res) => {
            const result = await productsCollection.insertOne(req.body);
            res.send(result);
        });

        app.patch('/products/:id', async (req, res) => {
            const { _id, ...rest } = req.body;
            const result = await productsCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { ...rest, updatedAt: new Date() } }
            );
            res.send(result);
        });

        app.delete('/products/:id', async (req, res) => {
            const result = await productsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
            res.send(result);
        });

        // =========================
        // BOOKING / ORDERS ROUTES
        // =========================

        // Create order
        app.post('/booking', async (req, res) => {
            const order = {
                ...req.body,
                status: "pending",
                trackingHistory: [
                    { status: "pending", date: new Date() }
                ],
                createdAt: new Date(),
            };
            const result = await bookingCollection.insertOne(order);
            res.send(result);
        });

        // Get all orders (Admin)
        app.get('/orders', async (req, res) => {
            const orders = await bookingCollection.find().sort({ createdAt: -1 }).toArray();
            res.send(orders);
        });

        // Get pending orders
        app.get('/orders/pending', async (req, res) => {
            const orders = await bookingCollection.find({ status: "pending" }).toArray();
            res.send(orders);
        });

        // Get approved orders
        app.get('/orders/approved', async (req, res) => {
            const orders = await bookingCollection.find({ status: "approved" }).toArray();
            res.send(orders);
        });

        // Get single order
        app.get('/orders/:id', async (req, res) => {
            const order = await bookingCollection.findOne({ _id: new ObjectId(req.params.id) });
            if (!order) return res.status(404).send({ message: "Order not found" });
            res.send(order);
        });

        // Update order status (approve/reject)
        app.patch('/orders/:id', async (req, res) => {
            const { status } = req.body;
            const allowedStatus = ["pending", "approved", "rejected"];
            if (!allowedStatus.includes(status)) return res.status(400).send({ message: "Invalid status" });

            const result = await bookingCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                {
                    $set: { status, updatedAt: new Date() },
                    $push: { trackingHistory: { status, date: new Date() } }
                }
            );
            res.send(result);
        });

        // Add tracking update
        app.post('/orders/:id/tracking', async (req, res) => {
            const tracking = req.body; // { status, note, location, date }
            const result = await bookingCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $push: { trackingHistory: tracking } }
            );
            res.send(result);
        });

        console.log("All routes are ready");
    } catch (error) {
        console.error(error);
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Garments server is running!')
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
