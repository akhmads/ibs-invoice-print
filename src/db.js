import sql from 'mssql';

let poolPromise = null;

function buildConfig() {
  const env = process.env;
  const config = {
    server: env.DB_SERVER || 'localhost',
    database: env.DB_NAME || 'IBSFin',
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    options: {
      encrypt: env.DB_ENCRYPT !== 'false',
      // true jika SQL Server memakai sertifikat self-signed (umum di server internal)
      trustServerCertificate: env.DB_TRUST_CERT === 'true',
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };
  // Named instance (mis. SERVER\SQL2016) memakai instanceName, bukan port
  if (env.DB_INSTANCE) config.options.instanceName = env.DB_INSTANCE;
  else config.port = Number(env.DB_PORT || 1433);
  return config;
}

export function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(buildConfig()).connect().catch((err) => {
      poolPromise = null; // supaya request berikutnya mencoba konek ulang
      throw err;
    });
  }
  return poolPromise;
}

export { sql };
