const mysql = require("mysql");
const moment = require("moment");
const MySqlDatabaseMigration = require("./MySqlDatabase.migration");

const databaseDateTimeFormat = 'Y-MM-DD HH:mm:ss';

const MySqlDatabaseStorage = {
    pool: null,
    retentionPeriod: null,
    retentionInterval: null,

    async setup() {
        await MySqlDatabaseMigration((query, args = []) => this.query(query, args));
        console.log("Storage for tracing has been initialized");
    },

    connect(host, user, password, port, database) {
        this.pool = mysql.createPool({ host, user, password, port, database })
        this.pool.on('connection', function (connection) {
            connection.query('SET SESSION group_concat_max_len = 500000')
        });

        return this;
    },
    
    async query(query, args = []) {
        return new Promise((resolve, reject) => {
            if (!this.pool) this.connect();

            this.pool.query(
                this.createQueryOptions(query, args),
                (error, rows, fields) => {
                    if (error) {
                        console.error(error);
                        reject(error);
                        return false;
                    }

                    resolve(rows, fields);
                    return true;
                }
            )
        });
    },
    
    createQueryOptions(query, args) {
        return {
            sql: query,
            values: args
        };
    },

    async fetchEntities() {
        const sqlForEntities = "SELECT id, name FROM tracing_entities ORDER BY id DESC";
        return await this.query(sqlForEntities, []);
    },

    async fetchItemsOfEntity(entityId, page = 1, limit = 20, query = null) {
        page = page > 0 ? page : 1;

        const searchQuery = `%${query}%`;
        const searchParams = query !== null ? [ searchQuery, searchQuery ] : [];
        const searchSql = query !== null ? 'AND (id LIKE ? OR name LIKE ?)' : '';
        const pageStart = limit * (page - 1);

        const sqlForItems = `SELECT id, name, entity_id FROM tracing_items WHERE entity_id = ? ${searchSql} ORDER BY id DESC LIMIT ? OFFSET ?`;
        const items = await this.query(sqlForItems, [ entityId, ...searchParams, limit, pageStart ]);

        const sqlForCount = `SELECT COUNT(*) as count FROM tracing_items WHERE entity_id = ? ${searchSql}`;
        const count = (await this.query(sqlForCount, [ entityId, ...searchParams ]))[0].count;

        let lastPage = parseInt(count / limit);

        lastPage += count % limit !== 0 ? 1 : 0;

        return {
            items,
            page,
            lastPage,
            count
        }
    },

    async fetchItem(id) {
        const item = (await this.query("SELECT id, name, entity_id FROM tracing_items WHERE id = ?", [ id ]))[0];
        if (!item) return null;

        const steps = await this.query("SELECT id, name, datetime, data FROM tracing_steps WHERE item_id = ? ORDER BY id", [ id ]);

        steps.forEach(step => {
            step.data = JSON.parse(step.data) || [];
        })

        item.steps = steps;

        return item;
    },

    async searchItems(query, entityId) {
        const searchQuery = `%${query}%`
        const sql = "SELECT id, name, entity_id FROM tracing_items WHERE entity_id = ? AND (id LIKE ? OR name LIKE ?) ORDER BY id DESC";

        return await this.query(sql, [ entityId, searchQuery, searchQuery ]);
    },

    async registerEntity(name, key) {
        if (await this.findEntity(key) !== null) {
            console.log(`Entity ${name} [${key}] has been registered already`);
            return true;
        }

        const sql = "INSERT INTO tracing_entities (`name`, `key`) VALUES (?, ?)";
        const inserted = (await this.query(sql, [ name, key ])).insertId || null;

        if (!!inserted) {
            console.log(`Entity ${name} [${key}] has been created`);
            return true;
        }

        return !!inserted;
    },

    async findEntity(key) {
        const sql = "SELECT id FROM tracing_entities WHERE `key` = ?";
        const entity = (await this.query(sql, [ key ]))[0] || null;

        return entity ? entity.id : null;
    },

    async findItem(key, entityId) {
        const sql = "SELECT id FROM tracing_items WHERE `key` = ? AND entity_id = ?";
        const item = (await this.query(sql, [ key, entityId ]))[0] || null;

        return item ? item.id : null;
    },

    async createItem(item, entityId) {
        const datetime = moment().format(databaseDateTimeFormat);
        const sql = "INSERT INTO tracing_items (`name`, `key`, `entity_id`, `datetime`) VALUES(?, ?, ?, ?)";
        return (await this.query(sql, [ item, item, entityId, datetime ])).insertId || null;
    },

    async createStep(step, data, itemId) {
        data = JSON.stringify(data);

        const datetime = moment().format(databaseDateTimeFormat);
        const sql = "INSERT INTO tracing_steps (`name`, `datetime`, `item_id`, `data`) VALUES(?, ?, ?, ?)";
        return (await this.query(sql, [ step, datetime, itemId, data ])).insertId || null;
    },
    
    setRetentionPeriod(timeInMinutes) {
        if (typeof timeInMinutes !== 'number') throw new Error("Time for retention is not a number.");
        if (timeInMinutes <= 0) throw new Error("Time for retention should be greater than zero.");
        
        this.retentionPeriod = timeInMinutes;
        return this;
    },
    
    async retention() {
        if (!this.retentionPeriod) {
            console.log("Retention period has not been configured.");
            return this;
        }
        
        console.log("Old tracing data cleaning has been started.");
        let deletedCount = 0;
        const oldItemsIds = await this.getOldItemsIds();

        if (oldItemsIds.length) {
            deletedCount = await this.deleteItems(oldItemsIds);
        }

        console.log(`Old tracing data has been deleted. Count of deleted items: ${deletedCount}`);
        return this;
    },
    
    async startRetention(intervalInMinutes = 5) {
        if (typeof intervalInMinutes !== 'number') throw new Error("Retention interval is not a number.");
        if (intervalInMinutes <= 0) throw new Error("Retention interval should be greater than zero.");
        
        this.stopRetention();
        await this.retention();
        this.retentionInterval = setInterval(async () => await this.retention(), intervalInMinutes * 1000 * 60);
        return this;
    },
    
    stopRetention() {
        if (this.retentionInterval) {
            clearInterval(this.retentionInterval);
        }
        
        return this;
    },

    async getOldItemsIds() {
        const period = moment().subtract(this.retentionPeriod, 'minutes').format(databaseDateTimeFormat);
        return (await this.query(
            "SELECT id FROM `tracing_items` WHERE datetime < ? or datetime IS NULL",
            [ period ]
        )).map( item => item.id);
    },

    async deleteItems(ids) {
        const placeholder = ids.map( () => "?").join(", ");
        const deletedCount = (await this.query(
            `DELETE FROM \`tracing_items\` WHERE id IN (${placeholder})`,
            [ ...ids ]
        )).affectedRows;

        await this.query(
            `DELETE FROM \`tracing_steps\` WHERE item_id IN (${placeholder})`,
            [ ...ids ]
        );

        return deletedCount;
    }
}

module.exports = MySqlDatabaseStorage;
