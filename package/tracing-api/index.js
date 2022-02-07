const MySqlDatabaseStorage = require("./storage/MySqlDatabase.storage");

const TracingAPI = {
    storage: null,

    init(storage = MySqlDatabaseStorage.connect())
    {
        this.storage = storage;
        return this;
    },

    async trace(entity, item, step, data = {}) {
        const entityId = await this.storage.findEntity(entity);

        if (!entityId) {
            console.log('Item has not been found');
            return false;
        }

        let itemId = await this.storage.findItem(item, entityId);

        if (itemId === null) {
            itemId = await this.storage.createItem(item, entityId);

            if (itemId === null) {
                console.log('Item has not been created.');
                return false;
            }
        }

        return Number.isFinite(await this.storage.createStep(step, data, itemId));
    },

    async registerEntity(name, key) {
        return this.storage.registerEntity(name, key);
    },
}

module.exports = TracingAPI;
