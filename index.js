const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
const port = process.env.PORT || 3000

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')

// MIDDLEWARE
app.use(express.json())
app.use(cors())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ddzxozm.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const db = client.db('garments_db')
        const productsCollection = db.collection('products')
        const usersCollection = db.collection('users');
        const bookingCollection = db.collection('booking');

        // =========================
        // BOOKING API
        // =========================
        app.get('/booking', async (req, res) => {
            const query = {}
            const { email } = req.query;
            if (email) {
                query.senderEmail = email;
            }

            const result = await bookingCollection.find(query).toArray();
            res.send(result)
        })

        app.post('/booking', async (req, res) => {
            const order = {
                ...req.body,
                status: "pending",
                createdAt: new Date()
            };
            const result = await bookingCollection.insertOne(order)
            res.send(result)
        })

        // =========================
        // ORDER APIs (NEW)
        // =========================

        // GET ALL ORDERS (ADMIN)
        app.get('/orders', async (req, res) => {
            try {
                const { email } = req.query;
                const query = email ? { userEmail: email } : {};

                const orders = await bookingCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .toArray();

                res.send(orders);
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch orders" });
            }
        });

        // GET SINGLE ORDER DETAILS
        app.get('/orders/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const order = await bookingCollection.findOne({ _id: new ObjectId(id) });

                if (!order) {
                    return res.status(404).send({ message: "Order not found" });
                }

                res.send(order);
            } catch (error) {
                res.status(500).send({ message: "Failed to get order" });
            }
        });

        // UPDATE ORDER STATUS (APPROVE / REJECT)
        app.patch('/orders/status/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { status } = req.body;

                const allowedStatus = ["pending", "approved", "rejected"];
                if (!allowedStatus.includes(status)) {
                    return res.status(400).send({ message: "Invalid status" });
                }

                const result = await bookingCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            status,
                            updatedAt: new Date()
                        }
                    }
                );

                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to update order" });
            }
        });

        // =========================
        // USERS API
        // =========================

        app.get("/users/admin", async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).send({ admin: false });

            const user = await usersCollection.findOne({ email });
            res.send({ admin: user?.role === "admin" });
        });

        app.patch('/users/status/:id', async (req, res) => {
            const id = req.params.id;
            const { status, reason } = req.body;

            const result = await usersCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status,
                        suspendReason: status === "suspended" ? reason : null
                    }
                }
            );
            res.send(result);
        });

        app.get("/users", async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        });

        app.get('/users/:id', async (req, res) => {
            const result = await usersCollection.findOne({ _id: new ObjectId(req.params.id) })
            res.send(result)
        });

        app.post('/users', async (req, res) => {
            const newUser = req.body;
            const existingUser = await usersCollection.findOne({ email: newUser.email });

            if (existingUser) {
                return res.send({ message: "User already exists" });
            }

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

        // =========================
        // PRODUCTS API
        // =========================

        app.get('/products', async (req, res) => {
            const result = await productsCollection.find().toArray()
            res.send(result);
        })

        app.get('/products/:id', async (req, res) => {
            const result = await productsCollection.findOne({ _id: new ObjectId(req.params.id) })
            res.send(result)
        })

        app.post('/products', async (req, res) => {
            const result = await productsCollection.insertOne(req.body);
            res.send(result);
        })

        app.patch('/products/:id', async (req, res) => {
            const result = await productsCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { ...req.body, updatedAt: new Date() } }
            );
            res.send(result);
        })

        app.delete('/products/:id', async (req, res) => {
            const result = await productsCollection.deleteOne({ _id: new ObjectId(req.params.id) })
            res.send(result)
        })

        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error(error);
    }
}
run();

app.get('/', (req, res) => {
    res.send('Garments server is running!')
})

app.listen(port, () => {
    console.log(`Garments server running on port ${port}`)
})
