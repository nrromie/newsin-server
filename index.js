const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

// Midlewares
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.plm4jqn.mongodb.net/?retryWrites=true&w=majority`;


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

        const userCollection = client.db('newsinDB').collection('users')
        const publisherCollection = client.db('newsinDB').collection('publishers')
        const articleCollection = client.db('newsinDB').collection('articles')

        //Add New Publishers
        app.post('/newpublisher', async (req, res) => {
            const publisher = req.body;
            const query = { name: publisher.name }
            const existsPublisher = await publisherCollection.findOne(query);
            if (existsPublisher) {
                return res.send({ message: 'Publisher already inserted', insertedId: null })
            }
            const result = await publisherCollection.insertOne(publisher);
            res.send(result);
        });

        //Getting Publishers
        app.get('/publishers', async (req, res) => {
            const result = await publisherCollection.find().toArray();
            res.send(result);
        });

        //Add New Articles
        app.post('/article', async (req, res) => {
            const article = req.body;
            const result = await articleCollection.insertOne(article);
            res.send(result);
        });

        // Getting and searching approved articles
        app.get('/articles', async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const PAGE_SIZE = 5;
            const skip = (page - 1) * PAGE_SIZE;
            const searchTitle = req.query.title;

            try {
                let query = { isApproved: true }; // Include condition for approved articles

                if (searchTitle) {
                    query.title = { $regex: new RegExp(searchTitle, 'i') };
                }

                const result = await articleCollection
                    .find(query)
                    .sort({ _id: -1 })
                    .skip(skip)
                    .limit(PAGE_SIZE)
                    .toArray();

                const totalArticlesCount = await articleCollection.countDocuments(query);

                res.json({
                    articles: result,
                    articlesCount: totalArticlesCount,
                    currentPage: page,
                    totalPages: Math.ceil(totalArticlesCount / PAGE_SIZE),
                });
            } catch (error) {
                console.error('Error fetching articles:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // Getting all articles for admin
        app.get('/adminallarticles', async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const PAGE_SIZE = 10;
            const skip = (page - 1) * PAGE_SIZE;

            try {
                const result = await articleCollection
                    .find({})
                    .sort({ _id: -1 })
                    .skip(skip)
                    .limit(PAGE_SIZE)
                    .toArray();

                const totalArticlesCount = await articleCollection.countDocuments({});

                res.json({
                    articles: result,
                    articlesCount: totalArticlesCount,
                    currentPage: page,
                    totalPages: Math.ceil(totalArticlesCount / PAGE_SIZE),
                });
            } catch (error) {
                console.error('Error fetching articles:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });


        //Getting single article details
        app.get('/articles/:id', async (req, res) => {
            try {
                const articleId = req.params.id;

                const result = await articleCollection.findOne({ _id: new ObjectId(articleId) });
                res.send(result);

                await articleCollection.updateOne(
                    { _id: new ObjectId(articleId) },
                    { $inc: { view: 1 } }
                );

            } catch (error) {
                console.error('Error fetching article:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        //Getting Trending Articles
        app.get('/trending', async (req, res) => {
            try {
                const result = await articleCollection.find().sort({ view: -1 }).limit(6).toArray();
                res.json(result);
            } catch (error) {
                console.error('Error fetching trending articles:', error);
                res.status(500).send('Internal Server Error');
            }
        });


        //Getting Premium Articles
        app.get('/premium-articles', async (req, res) => {
            try {
                const premiumArticles = await articleCollection.find({ isPremium: true }).toArray();
                res.json(premiumArticles);
            } catch (error) {
                console.error('Error fetching premium articles:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        //Getting My Articles
        app.get('/myarticles/:email', async (req, res) => {
            try {
                const email = req.params.email;
                const myArticles = await articleCollection.find({ writerEmail: email }).toArray();
                res.json(myArticles);
            } catch (error) {
                console.error('Error fetching premium articles:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });


        // Getting articles statistics
        app.get('/articlestats', async (req, res) => {
            try {
                const totalArticles = await articleCollection.countDocuments();

                const premiumArticlesResult = await articleCollection.aggregate([
                    {
                        $match: { isPremium: true }
                    },
                    {
                        $count: 'premiumArticlesCount'
                    }
                ]).next();

                const premiumArticlesCount = premiumArticlesResult ? premiumArticlesResult.premiumArticlesCount : 0;

                res.json({ totalArticles, premiumArticlesCount });
            } catch (error) {
                console.error('Error fetching Article stats:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });


        app.patch('/approve-article/:id', async (req, res) => {
            const articleId = req.params.id;

            try {
                await articleCollection.updateOne(
                    { _id: new ObjectId(articleId) },
                    {
                        $set: {

                            isApproved: true,
                        },
                    }
                );

                res.json({ success: true, message: 'Article approved successfully' });
            } catch (error) {
                console.error('Error approving article:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        //Decline article
        app.patch('/decline-article/:id', async (req, res) => {
            const articleId = req.params.id;
            const { declineMessage } = req.body;

            try {
                await articleCollection.updateOne(
                    { _id: new ObjectId(articleId) },
                    {
                        $set: {
                            isApproved: false,
                            declineMessage: declineMessage,
                        },
                    }
                );

                res.json({ success: true, message: 'Article declined successfully' });
            } catch (error) {
                console.error('Error declining article:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });


        // Toggle premium status
        app.patch('/toggle-premium/:id', async (req, res) => {
            const articleId = req.params.id;

            try {
                const article = await articleCollection.findOne({ _id: new ObjectId(articleId) });

                if (!article) {
                    return res.status(404).json({ error: 'Article not found' });
                }

                const updatedPremiumStatus = !article.isPremium;

                await articleCollection.updateOne(
                    { _id: new ObjectId(articleId) },
                    { $set: { isPremium: updatedPremiumStatus } }
                );

                res.json({ success: true, message: 'Premium status toggled successfully' });
            } catch (error) {
                console.error('Error toggling premium status:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });


        //Adding User Info
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        //Getting all users
        app.get('/users', async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        //Getting user data
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });

            if (user && user.isPremium && user.isPremium < new Date()) {
                user.isPremium = false;
                res.send(user)
            } else if (user && user.isPremium && user.isPremium > new Date()) {
                const modifiedUser = {
                    ...user,
                    expires: user.isPremium,
                    isPremium: true,
                };

                res.send(modifiedUser);
            } else {
                res.send(user);
            }
        });

        //Getting users statistics
        app.get('/userstats', async (req, res) => {
            try {
                const totalUsers = await userCollection.countDocuments();

                const premiumUsers = await userCollection
                    .aggregate([
                        {
                            $addFields: {
                                isPremium: {
                                    $cond: {
                                        if: { $gte: ["$isPremium", new Date()] },
                                        then: true,
                                        else: false
                                    }
                                }
                            }
                        },
                        {
                            $match: { isPremium: true }
                        },
                        {
                            $count: "premiumUsers"
                        }
                    ])
                    .next();

                res.json({ totalUsers, premiumUsers: premiumUsers ? premiumUsers.premiumUsers : 0 });
            } catch (error) {
                console.error('Error fetching user stats:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        //Subscription
        app.patch('/subscribe/:email/:plan', async (req, res) => {
            const { email, plan } = req.params;
            let expirationDate;
            switch (plan) {
                case 'Starter':
                    expirationDate = new Date();
                    expirationDate.setMinutes(expirationDate.getMinutes() + 1);
                    break;
                case 'Standard':
                    expirationDate = new Date();
                    expirationDate.setDate(expirationDate.getDate() + 5);
                    break;
                case 'Premium':
                    expirationDate = new Date();
                    expirationDate.setDate(expirationDate.getDate() + 10);
                    break;
                default:
                    return res.status(400).json({ error: 'Invalid plan' });
            }
            try {
                await userCollection.updateOne(
                    { email },
                    {
                        $set: {
                            isPremium: expirationDate,
                        },
                    }
                );
                res.json({ success: true, message: 'Subscription successful!' });
            } catch (error) {
                console.error('Error subscribing user:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        app.get('/publication-stats', async (req, res) => {
            try {
                const pipeline = [
                    {
                        $lookup: {
                            from: 'articles', // The name of the articles collection
                            localField: 'name', // Field from the publications collection
                            foreignField: 'publisher', // Field from the articles collection
                            as: 'articles',
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            publication: '$name',
                            articleCount: { $size: '$articles' },
                        },
                    },
                ];

                const results = await publisherCollection.aggregate(pipeline).toArray();
                res.json(results);
            } catch (error) {
                console.error('Error fetching publication stats:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });


    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('server is running')
})

app.listen(port, () => {
    console.log(`Server is on port: ${port}`)
})