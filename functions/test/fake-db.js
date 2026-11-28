// Tiny in-memory stand-in for Firestore, enough for help.js and health.js tests.
module.exports = function fakeDb() {
  const store = new Map(); let n = 0;
  const docRef = path => ({
    id: path.split('/').pop(), path,
    get: async () => ({ exists: store.has(path), id: path.split('/').pop(), data: () => store.get(path) }),
    set: async (v, o) => { store.set(path, o && o.merge ? Object.assign({}, store.get(path) || {}, v) : v); }
  });
  const db = {
    store,
    doc: docRef,
    collection: c => ({
      doc: id => docRef(c + '/' + (id || 'auto' + (++n) + 'abcdef')),
      where: (f, op, v) => ({ get: async () => ({ docs: [...store.entries()].filter(([k, d]) => k.startsWith(c + '/') && k.split('/').length === 2 && d[f] >= v).map(([k, d]) => ({ id: k.split('/')[1], data: () => d })) }) })
    }),
    runTransaction: async fn => fn({ get: r => r.get(), set: (r, v, o) => r.set(v, o) })
  };
  return db;
};
