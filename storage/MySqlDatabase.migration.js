const MySqlDatabaseMigration = async (queryExecutor) => {
    const migrations = [
        createTracingEntitiesTableIfNotExists,
        createTracingItemsTableIfNotExists,
        createTracingStepsTableIfNotExists,
        addDateTimeFieldToTracingItemsTableIfNotExists,
        changeTypeOfDateTimeColumn,
        addSearchFieldToTracingItems,
        addIndexes,
    ];

    await migrate(queryExecutor, migrations);
}

const createTracingEntitiesTableIfNotExists = async (queryExecutor) => {
    await queryExecutor(
        "CREATE TABLE IF NOT EXISTS `tracing_entities` (\n" +
        "  `id` int(11) NOT NULL AUTO_INCREMENT,\n" +
        "  `name` varchar(255) NOT NULL,\n" +
        "  `key` varchar(255) NOT NULL,\n" +
        "  PRIMARY KEY (`id`)\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=latin1;"
    );
}

const createTracingItemsTableIfNotExists = async (queryExecutor) => {
    await queryExecutor(
        "CREATE TABLE IF NOT EXISTS `tracing_items` (\n" +
        " `id` int(11) NOT NULL AUTO_INCREMENT,\n" +
        " `name` varchar(255) NOT NULL,\n" +
        " `datetime` varchar(255) NOT NULL,\n" +
        " `key` varchar(255) NOT NULL,\n" +
        " `entity_id` int(11) NOT NULL,\n" +
        " PRIMARY KEY (`id`)\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=latin1;"
    );
}

const createTracingStepsTableIfNotExists = async (queryExecutor) => {
    await queryExecutor(
        "CREATE TABLE IF NOT EXISTS `tracing_steps` (\n" +
        "  `id` int(11) NOT NULL AUTO_INCREMENT,\n" +
        "  `name` varchar(255) NOT NULL,\n" +
        "  `datetime` varchar(255) NOT NULL,\n" +
        "  `item_id` int(11) NOT NULL,\n" +
        "  `data` longtext NOT NULL,\n" +
        "  PRIMARY KEY (`id`)\n" +
        ") ENGINE=InnoDB DEFAULT CHARSET=latin1;"
    );
}

const addDateTimeFieldToTracingItemsTableIfNotExists = async (queryExecutor) => {
    if (await columnExist(queryExecutor, 'tracing_items', 'datetime')) return;

    await queryExecutor(
        "ALTER TABLE `tracing_items` \n" +
        "ADD COLUMN datetime varchar(255);"
    );
}

const changeTypeOfDateTimeColumn = async (queryExecutor) => {
    await queryExecutor(
        "ALTER TABLE `tracing_items` \n" +
        "MODIFY `datetime` timestamp NOT NULL;"
    );

    await queryExecutor(
        "ALTER TABLE `tracing_steps` \n" +
        "MODIFY `datetime` timestamp NOT NULL;"
    );
}

const addSearchFieldToTracingItems = async (queryExecutor) => {
    if (await columnExist(queryExecutor, 'tracing_items', 'searchable')) return;

    await queryExecutor(
        "ALTER TABLE `tracing_items` \n" +
        "ADD COLUMN searchable longtext;"
    );
}

const addIndexes = async (queryExecutor) => {
    const indexes = [
        {
            table: "tracing_entities",
            column: "key",
            name: "tracing_entity_key"
        },
        {
            table: "tracing_items",
            column: "key",
            name: "tracing_item_key"
        },
        {
            table: "tracing_items",
            column: "entity_id",
            name: "tracing_item_entity_id"
        },
        {
            table: "tracing_steps",
            column: "name",
            name: "tracing_step_name"
        },
        {
            table: "tracing_steps",
            column: "item_id",
            name: "tracing_step_item_id"
        }
    ];

    for (const index of indexes) {
        if (await indexExist(queryExecutor, index.table, index.name)) continue;

        await queryExecutor(`CREATE INDEX ${index.name} ON ${index.table} (\`${index.column}\`);`);
    }
}

const columnExist = async (queryExecutor, table, column) => {
    return (await queryExecutor(
        "SHOW COLUMNS FROM ?? WHERE Field = ?;",
        [ table, column ]
    )).length > 0;
}

const indexExist = async (queryExecutor, table, indexName) => {
    return (await queryExecutor(
        "SHOW INDEX FROM ?? WHERE Key_name = ?;",
        [ table, indexName ]
    )).length > 0;
}

const migrate = async (queryExecutor, migrations) => {
    for (const migration of migrations) {
        console.log(`Tracing API: Running migration ${migration.name}`);
        await migration(queryExecutor);
    }
}

module.exports = MySqlDatabaseMigration;
