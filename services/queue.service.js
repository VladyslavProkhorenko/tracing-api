const { getUniqueFrom } = require( "../helpers" );

const createItemKey = (item, keyName) => `${item.entity_id}-${item[keyName]}`;

const QueueService = {
    enabled: false,
    timeout: null,
    storage: null,
    queue: [],

    init(storage)
    {
        this.storage = storage;
        return this;
    },

    enable(timeout = 5)
    {
        this.timeout = timeout;
        this.enabled = true;
        this.runQueue();

        return this;
    },

    disable()
    {
        this.timeout = null;
        this.enabled = false;

        return this;
    },

    push(entity, item, step, data = {}, searchKeys = [])
    {
        this.queue.push({
            entity, item, step, data, searchKeys
        });
        return this;
    },

    empty()
    {
        return this.queue.length === 0;
    },

    clear()
    {
        this.queue = [];
        return this;
    },

    clone()
    {
        return JSON.parse(JSON.stringify(this.queue));
    },

    schedule()
    {
        if (!this.enabled) return;

        setTimeout(
            async () => await this.runQueue(),
            this.timeout * 1_000
        );
    },

    async runQueue()
    {
        if (!this.enabled) return;
        if (this.empty()) return this.schedule();

        const clonedQueue = this.clone();
        this.clear();

        await this.process(clonedQueue);
        this.schedule();
    },

    async process(queue)
    {
        await this.processEntities(queue);
        await this.processItems(queue);
        await this.processSteps(queue);
    },

    async processEntities(queuedTasks)
    {
        const uniqueEntities = getUniqueFrom(queuedTasks, "entity");
        const storageEntities = await this.getStorageEntities(uniqueEntities);

        this.checkMissedEntities(queuedTasks, storageEntities);
        this.addEntityIdToTasks(queuedTasks, storageEntities)
    },

    async getStorageEntities(keys)
    {
        let storageEntities = await this.storage.getEntities(keys);
        storageEntities = storageEntities.reduce(
            (acc, entity) => {
                acc[entity.key] = entity.id;
                return acc;
            }, {}
        );

        return storageEntities;
    },

    checkMissedEntities(queuedTasks, storageEntities)
    {
        const missedEntities = Object.keys(queuedTasks.reduce(
            (acc, task) => {
                if (!storageEntities[task.entity]) {
                    acc[task.entity] = true;
                }

                return acc;
            }, {}
        ));

        if (missedEntities.length) {
            throw new Error(`Entities ${missedEntities.join(", ")} is missed`);
        }
    },

    addEntityIdToTasks(queuedTasks, storageEntities)
    {
        queuedTasks.forEach( task => task.entity_id = storageEntities[task.entity] );
    },

    async processItems(queuedTasks)
    {
        const {
            uniqueItems,
            neededEntities,
            neededItems
        } = this.preprocessItems(queuedTasks);

        const { itemsToCreate, itemsToUpdate } = await this.getItemsForCreatingAndUpdating(uniqueItems, neededItems, neededEntities);

        await this.storage.createManyItems(itemsToCreate);
        await this.storage.updateManyItems(itemsToUpdate);

        await this.checkMissedItemsAndIdToExisted(queuedTasks, neededItems, neededEntities);
    },

    async processSteps(queuedTasks)
    {
        const steps = queuedTasks.map( task => ({
            step: task.step,
            data: task.data,
            item_id: task.item_id
        }));

        await this.storage.createManySteps(steps);
    },

    preprocessItems(queuedTasks)
    {
        let uniqueItems = {};
        let neededEntities = {};
        let neededItems = {};

        queuedTasks.forEach( task => {
            const key = createItemKey(task, "item");

            uniqueItems[key] = {
                item: task.item,
                entity_id: task.entity_id,
                searchKeys: task.searchKeys
            }

            neededEntities[task.entity_id] = true;
            neededItems[task.item] = true;
        });

        uniqueItems = Object.values(uniqueItems);
        neededEntities = Object.keys(neededEntities).map( id => Number(id) );
        neededItems = Object.keys(neededItems);

        return {
            uniqueItems,
            neededEntities,
            neededItems
        }
    },

    async getItemsForCreatingAndUpdating(uniqueItems, neededItems, neededEntities)
    {
        const itemsToCreate = [];
        const itemsToUpdate = [];
        const storageItems = await this.getItemsForEntitiesFromStorage(neededItems, neededEntities);

        uniqueItems.forEach( item => {
            const key = createItemKey(item, "item");

            if (!storageItems[key]) {
                itemsToCreate.push(item);
            } else {
                itemsToUpdate.push({
                    ...item,
                    id: storageItems[key].id,
                    searchable: storageItems[key].searchable
                });
            }
        });

        return { itemsToCreate, itemsToUpdate }
    },

    async checkMissedItemsAndIdToExisted(queuedTasks, neededItems, neededEntities)
    {
        const storageItems = await this.getItemsForEntitiesFromStorage(neededItems, neededEntities);

        queuedTasks.forEach( task => {
            const key = createItemKey(task, "item");

            if (!storageItems[key]) {
                throw new Error(`Item ${task.item} for entity ${task.entity_id} has not been created`);
            }

            task.item_id = storageItems[key].id;
        });
    },

    async getItemsForEntitiesFromStorage(neededItems, neededEntities)
    {
        const storageItems = await this.storage.getItemsByKeysForEntities(neededItems, neededEntities);

        return storageItems.reduce(
            (acc, item) => {
                const key = createItemKey(item, "key");

                acc[key] = item;
                return acc;
            }, {}
        );
    }
}

module.exports = QueueService;