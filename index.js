const MySqlDatabaseStorage = require("./storage/MySqlDatabase.storage");
const axios = require("axios");
const QueueService = require( "./services/queue.service" );

const TracingAPI = {
    storage: null,
    isRemote: false,
    queue: null,
    entities: {},

    init(storage = MySqlDatabaseStorage, queue = QueueService)
    {
        this.isRemote = false;
        this.storage = storage;
        this.queue = queue;

        this.queue.init(storage);

        return this;
    },

    initRemote(server, headers = {})
    {
        this.isRemote = true;
        this.axiosInstance = axios.create({
            baseURL: server,
            headers
        });

        if (this.queue.enabled) {
            this.queue.stop();
            console.warn("Queue has been stopped. Queue can't be enabled for remote servers");
        }
        return this;
    },

    enableQueue(timeout = 5)
    {
        if (this.isRemote) {
            throw new Error("Queue can't be enabled for remote servers");
        }

        this.queue.enable(timeout);
        return this;
    },

    disableQueue()
    {
        this.queue.disable();
        return this;
    },

    async trace(entity, item, step, data = {}, searchKeys = [], customStepName = null) {
        if (this.queue.enabled) {
            this.queue.push(entity, item, step, data, searchKeys, customStepName);
            return generateResponse(true, "Tracing has been added to the queue");
        }

        return this.isRemote
            ? this.traceRemote(entity, item, step, data, searchKeys, customStepName)
            : this.traceLocal(entity, item, step, data, searchKeys, customStepName);
    },

    async traceRemote(entity, item, step, data = {}, searchKeys = [], customStepName = null) {
        return await this.axiosInstance
            .post("/trace", {
                entity, item, step, data, searchKeys, customStepName
            })
            .then( ({ data }) => {
                return generateResponse(data.status, data.message);
            })
            .catch( error => {
                return generateResponse(false, error.message);
            });
    },

    async traceLocal(entity, item, step, data = {}, searchKeys = [], customStepName = null) {
        const entityId = await this.storage.findEntity(entity);

        if (!entityId) {
            return generateResponse(false, "Entity has not been found", { entity });
        }

        let foundItem = await this.storage.findItem(item, entityId);

        if (foundItem === null) {
            foundItem = {};
            foundItem.id = await this.storage.createItem(item, entityId, searchKeys);

            if (foundItem.id === null) {
                return generateResponse(false, "Item has not been created", { item, entityId });
            }
        } else {
            await this.storage.updateSearchKeys(foundItem, searchKeys);
        }

        const isStepCreated = Number.isFinite(await this.storage.createStep(step, data, foundItem.id, customStepName));

        return isStepCreated
            ? generateResponse(true, "Tracing has been saved")
            : generateResponse(false, "Tracing step has not been saved", { step, data, itemId : foundItem ? foundItem.id : null });
    },

    async registerEntity(name, key) {
        this.entities[key] = { stepsForFiltering: {} };
        return this.storage.registerEntity(name, key);
    },

    registerEntitySteps(entity, steps) {
        if (! this.entities[entity]) {
            throw new Error(`No registered entity with same name: ${entity}`);
        }

        steps.forEach( step => {
            this.entities[entity].stepsForFiltering[step] = true;
        })

        return this;
    }
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
