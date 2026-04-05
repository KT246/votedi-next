import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/votedi';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let indexesReadyPromise: Promise<void> | null = null;

async function ensureDatabaseIndexes(db: Db): Promise<void> {
    await Promise.all([
        db.collection('admins').createIndex({ username: 1 }),
        db.collection('users').createIndex({ username: 1 }),
        db.collection('users').createIndex({ studentId: 1 }),
        db.collection('users').createIndex({ createdByAdminId: 1 }),
        db.collection('rooms').createIndex({ roomCode: 1 }),
        db.collection('rooms').createIndex({ ownerAdminId: 1, updatedAt: -1 }),
        db.collection('rooms').createIndex({ allowedUsers: 1, updatedAt: -1 }),
        db.collection('votes').createIndex({ roomId: 1 }),
        db.collection('votes').createIndex({ userId: 1, roomId: 1 }),
    ]);
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
    if (cachedClient && cachedDb) {
        return { client: cachedClient, db: cachedDb };
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();

    const db = client.db();

    cachedClient = client;
    cachedDb = db;

    if (!indexesReadyPromise) {
        indexesReadyPromise = ensureDatabaseIndexes(db).catch((error) => {
            indexesReadyPromise = null;
            console.error('Failed to ensure MongoDB indexes:', error);
        });
    }

    return { client, db };
}
