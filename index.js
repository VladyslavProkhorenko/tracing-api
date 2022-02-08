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

    async trace(entity, item, step, data = {}) {
        return this.isRemote
            ? this.traceRemote(entity, item, step, data)
            : this.traceLocal(entity, item, step, data);
    },

    async traceRemote(entity, item, step, data = {}) {
        return await this.axiosInstance
            .post("/trace", {
                entity, item, step, data
            })
            .then( ({ data }) => {
                return generateResponse(data.status, data.message);
            })
            .catch( error => {
                return generateResponse(false, error.message);
            });
    },

    async traceLocal(entity, item, step, data = {}) {
        const entityId = await this.storage.findEntity(entity);

        if (!entityId) {
            return generateResponse(false, 'Entity has not been found');
        }

        let itemId = await this.storage.findItem(item, entityId);

        if (itemId === null) {
            itemId = await this.storage.createItem(item, entityId);

            if (itemId === null) {
                return generateResponse(false, 'Item has not been created');
            }
        }

        const isStepCreated = Number.isFinite(await this.storage.createStep(step, data, itemId));

        return isStepCreated
            ? generateResponse(true, 'Tracing has been saved')
            : generateResponse(false, 'Tracing step has not been saved');
    },

    async registerEntity(name, key) {
        return this.storage.registerEntity(name, key);
    },
}

const generateResponse = (status, message) => {
    console.log(message);
    return {
        status,
        message
    }
}

module.exports = TracingAPI;
