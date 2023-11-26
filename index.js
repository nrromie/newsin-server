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

        //Add New Articles
        app.post('/article', async (req, res) => {
            const article = req.body;
            const result = await articleCollection.insertOne(article);
            res.send(result);
        });

        //Getting and searching articles
        app.get('/articles', async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const PAGE_SIZE = 5;
            const skip = (page - 1) * PAGE_SIZE;
            const searchTitle = req.query.title;

            try {
                let query = {};

                if (searchTitle) {
                    query = { title: { $regex: new RegExp(searchTitle, 'i') } };
                }

                const result = await articleCollection
                    .find(query)
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