const MySqlDatabaseStorage = require("./storage/MySqlDatabase.storage");
const axios = require("axios");

const TracingAPI = {
    storage: null,
    isRemote: false,

    init(storage = MySqlDatabaseStorage)
    {
        this.isRemote = false;
        this.storage = storage;
        return this;
    },

    initRemote(server, headers = {})
    {
        this.isRemote = true;
        this.axiosInstance = axios.create({
            baseURL: server,
            headers
        });
        return this;
    },

    async trace(entity, item, step, data = {}, searchKeys = []) {
        return this.isRemote
            ? this.traceRemote(entity, item, step, data, searchKeys)
            : this.traceLocal(entity, item, step, data, searchKeys);
    },

    async traceRemote(entity, item, step, data = {}, searchKeys = []) {
        return await this.axiosInstance
            .post("/trace", {
                entity, item, step, data, searchKeys
            })
            .then( ({ data }) => {
                return generateResponse(data.status, data.message);
            })
            .catch( error => {
                return generateResponse(false, error.message);
            });
    },

    async traceLocal(entity, item, step, data = {}, searchKeys = []) {
        const entityId = await this.storage.findEntity(entity);

        if (!entityId) {
            return generateResponse(false, 'Entity has not been found', { entity });
        }

        let itemId = await this.storage.findItem(item, entityId);

        if (itemId === null) {
            itemId = await this.storage.createItem(item, entityId, searchKeys);

            if (itemId === null) {
                return generateResponse(false, 'Item has not been created', { item, entityId });
            }
        }

        const isStepCreated = Number.isFinite(await this.storage.createStep(step, data, itemId));

        return isStepCreated
            ? generateResponse(true, 'Tracing has been saved')
            : generateResponse(false, 'Tracing step has not been saved', { step, data, itemId });
    },

    async registerEntity(name, key) {
        return this.storage.registerEntity(name, key);
    },
}

const generateResponse = (status, message, context = {}) => {
    if (!status) {
        console.log(message, context);
    }

    return {
        status,
        message
    }
}

module.exports = TracingAPI;
