db = db.getSiblingDB('fs_assignment');
db.createCollection('characters');
db.characters.createIndex({ name: 'text', species: 'text', status: 'text', type: 'text' });
db.characters.createIndex({ externalId: 1 }, { unique: true });
db.characters.createIndex({ name: 1 });

db = db.getSiblingDB('fs_assignment_logs');
db.createCollection('event_logs');
db.event_logs.createIndex({ timestamp: -1 });
db.event_logs.createIndex({ eventType: 1, timestamp: -1 });
