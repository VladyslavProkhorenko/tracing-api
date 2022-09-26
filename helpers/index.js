const getUniqueFrom = (items, key) => Object.keys(
    items.reduce( (acc, item) => {
        acc[item[key]] = true;
        return acc;
    }, {} )
);

module.exports = {
    getUniqueFrom
}