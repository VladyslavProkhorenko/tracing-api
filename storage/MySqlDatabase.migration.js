const MySqlDatabaseMigration = async (queryExecutor) => {
    await createTracingEntitiesTableIfNotExists(queryExecutor);
    await createTracingItemsTableIfNotExists(queryExecutor);
    await createTracingStepsTableIfNotExists(queryExecutor);
    await addDateTimeFieldToTracingItemsTableIfNotExists(queryExecutor);
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
        "ADD COLUMN datetime varchar(255) \n"
    );
}

const columnExist = async (queryExecutor, table, column) => {
    return (await queryExecutor(
        "SHOW COLUMNS FROM ?? WHERE Field = ?;",
        [ table, column ]
    )).length > 0;
}

module.exports = MySqlDatabaseMigration;
