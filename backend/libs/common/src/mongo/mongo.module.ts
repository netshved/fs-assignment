import { DynamicModule, Global, Module, OnApplicationShutdown, Provider } from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';
import { getLogsMongoUri, getMongoUri } from '../config/app.config';
import { DATABASE_CONNECTION, LOGS_DATABASE_CONNECTION } from './mongo.types';

export type MongoConnectionName = 'main' | 'logs';

interface ConnectionSpec {
  token: string;
  uri: () => string;
  dbName: string;
}

const CONNECTIONS: Record<MongoConnectionName, ConnectionSpec> = {
  main: { token: DATABASE_CONNECTION, uri: getMongoUri, dbName: 'fs_assignment' },
  logs: { token: LOGS_DATABASE_CONNECTION, uri: getLogsMongoUri, dbName: 'fs_assignment_logs' },
};

@Global()
@Module({})
export class MongoModule implements OnApplicationShutdown {
  private static clients: MongoClient[] = [];

  /** Each service registers only the connections it actually uses. */
  static forRoot(connections: MongoConnectionName[]): DynamicModule {
    const providers: Provider[] = connections.map((name) => {
      const spec = CONNECTIONS[name];
      return {
        provide: spec.token,
        useFactory: async (): Promise<Db> => {
          const client = new MongoClient(spec.uri(), { serverSelectionTimeoutMS: 10_000 });
          await client.connect();
          MongoModule.clients.push(client);
          return client.db(spec.dbName);
        },
      };
    });

    return {
      module: MongoModule,
      providers,
      exports: connections.map((name) => CONNECTIONS[name].token),
    };
  }

  async onApplicationShutdown() {
    await Promise.allSettled(MongoModule.clients.map((client) => client.close()));
    MongoModule.clients = [];
  }
}
