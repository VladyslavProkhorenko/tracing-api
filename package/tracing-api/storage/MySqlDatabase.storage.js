const mysql = require("mysql");
const moment = require("moment");

const MySqlDatabaseStorage = {
    pool: null,

    connect(host, user, password, port, database) {
        this.pool = mysql.createPool({ host, user, password, port, database })
        this.pool.on('connection', function (connection) {
            connection.query('SET SESSION group_concat_max_len = 500000')
        });

        return this;
    },

    async store(event, leadId, data = []) {
        const columns = [ 'lead_id', 'event', 'data', 'created_at' ];
        const values = [ leadId, event, JSON.stringify(data), moment().format('Y-M-D H:m:s') ]

        const query = 'INSERT INTO ?? (??, ??, ??, ??) VALUES(?, ?, ?, ?)';
        const args = [ TABLE, ...columns, ...values ];

        return await this.query(query, args);
    },
    async query(query, args) {
        return new Promise((resolve, reject) => {
            if (!this.pool) this.connect();

            this.pool.query(
                this.createQueryOptions(query, args),
                (error, rows, fields) => {
                    if (error) {
                        console.error(error);
                        reject(error);
                        return
                    }

                    resolve(rows, fields)
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
        const sqlForEntities = "SELECT id, name FROM tracing_entities";
        const entities = await this.query(sqlForEntities, []);

        const entitiesIds = entities.map( entity => entity.id);

        const sqlForItems = `SELECT id, name, entity_id FROM tracing_items WHERE entity_id IN (${entitiesIds.map( () => "?").join(", ")})`;

        const items = await this.query(sqlForItems, [...entitiesIds]);

        entities.forEach( entity => {
            entity.items = items.filter( item => item.entity_id === entity.id)
        })

        return entities;
    },

    async fetchItem(id) {
        const item = (await this.query("SELECT id, name, entity_id FROM tracing_items WHERE id = ?", [ id ]))[0];
        if (!item) return null;

        const steps = await this.query("SELECT id, name, datetime, data FROM tracing_steps WHERE item_id = ?", [ id ]);

        steps.forEach(step => {
            step.data = JSON.parse(step.data) || [];
        })

        item.steps = steps;

        return item;
    },

    async searchItems(query, entityId) {
        const searchQuery = `%${query}%`
        const sql = "SELECT id, name, entity_id FROM tracing_items WHERE entity_id = ? AND (id LIKE ? OR name LIKE ?)";

        return await this.query(sql, [ entityId, searchQuery, searchQuery ]);
    },

    async registerEntity(name, key) {
        if (await this.findEntity(key) !== null) return true;

        const sql = "INSERT INTO tracing_entities (`name`, `key`) VALUES (?, ?)";
        const inserted = (await this.query(sql, [ name, key ])).insertId || null;

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
        const sql = "INSERT INTO tracing_items (`name`, `key`, `entity_id`) VALUES(?, ?, ?)";
        return (await this.query(sql, [ item, item, entityId ])).insertId || null;
    },

    async createStep(step, data, itemId) {
        data = JSON.stringify(data);

        const datetime = moment().format('HH:mm:ss DD.MM.Y');
        const sql = "INSERT INTO tracing_steps (`name`, `datetime`, `item_id`, `data`) VALUES(?, ?, ?, ?)";
        return (await this.query(sql, [ step, datetime, itemId, data ])).insertId || null;
    }
}

module.exports = MySqlDatabaseStorage;