"use strict";

const nano = require("nano"),
    namespaces = [
        "users",
        "channels",
        "teams",
        "enterprise-metadata"
    ],
    designDocs = namespaces
        .map(namespace => {
            return {
                namespace,
                doc: {
                    "views": {
                        "all": {
                            "map": `function (doc) { if (doc.type === "${namespace}") emit(doc._id, doc) }`
                        }
                    }
                }
            };
        }),
        handleSaveResponse = done => (err, body) => {
            if (err) {
                return done(err);
            }

            done(null, body.id);
        };


function getStorage (db, namespace) {
    return {
        save: (doc, done) => {
            const update = Object.assign({}, doc);

            update._id = `${namespace}/${update.id}`;
            update.type = namespace;

            if (!update._rev) {
                db.get(update._id, (err, body) => {
                    if (!err && body._rev) {
                        update._rev = body._rev;
                    }

                    db.insert(update, handleSaveResponse(done));
                });
            } else {
                db.insert(update, handleSaveResponse(done));
            }
        },
        get: (id, done) => {
            db.get(`${namespace}/${id}`, (err, doc) => {
                if (err) {
                    return done(err);
                }

                done(null, doc);
            });
        },
        delete: (obj, done) => {
            db.get(obj.id, (err, doc) => {
                if (err) {
                    return done(err)
                }

                db.destroy(doc._id, doc._rev, done);
            })
        },
        all: done => {
            db.view(namespace, "all", (err, result) => {
                if (err) {
                    return done(err);
                }

                done(null, result.rows.map(row => row.value));
            })
        }
    }
}

module.exports = config => {
    const db = nano(config);

    designDocs.forEach(design => {
        db.insert(design.doc, `_design/${design.namespace}`);
    });

    return namespaces
        .map(namespace => ({namespace, storage: getStorage(db, namespace)}))
        .reduce((storage, obj) => {
            storage[obj.namespace] = obj.storage;

            return storage;
        },{});
};
