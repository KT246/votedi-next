const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/votedi';

async function createAdmin() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db();
        const adminsCollection = db.collection('admins');

        const username = process.env.ADMIN_USERNAME || 'admin';
        const password = process.env.ADMIN_PASSWORD || 'admin123';
        const fullName = process.env.ADMIN_FULL_NAME || 'Administrator';

        // Keep exactly one admin account in the collection.
        await adminsCollection.deleteMany({});

        // Create new admin with bcrypt hash
        const hashedPassword = await bcrypt.hash(password, 10);

        const admin = {
            username,
            password: hashedPassword,
            fullName,
            role: 'admin',
            permissions: null,
            createdByAdminId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await adminsCollection.insertOne(admin);
        console.log('Admin created successfully!');
        console.log('ID:', result.insertedId);
        console.log('Username:', username);
        console.log('Password:', password);
        console.log('Role: admin');

    } catch (error) {
        console.error('Error creating admin:', error);
    } finally {
        await client.close();
    }
}

createAdmin();
