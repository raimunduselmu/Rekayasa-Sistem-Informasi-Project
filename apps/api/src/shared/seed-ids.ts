// ID data seed (sql/002_seed.sql) yang dipakai contoh Swagger dan skrip demo.
export const SEED = {
  rooms: { gereja: 1, aula: 2 },
  assets: {
    proyektor: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', // sedang dipinjam hari ke-7 (seed)
    sound: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    generator: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', // status PEMELIHARAAN
    kursi: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    mikrofon: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', // is_lendable = false
  },
} as const;
