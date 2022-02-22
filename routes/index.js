const { Router } = require('express');
const TracingAPI = require("../index");
const router = Router();

router.get('/ping', function(req, res) {
    res.sendStatus(200);
});

router.get('/entity', async function(req, res) {
     res.send(await TracingAPI.storage.fetchEntities())
});

router.get('/entity/:key', async function(req, res) {
    const key = req.params.key;
    res.send(await TracingAPI.storage.fetchEntity(key))
});


router.get('/entity/:id/item', async function(req, res) {
    const id = req.params.id;
    const page = req.query.page || 1;
    const query = req.query.query;
    const filterStepsFromQuery = req.query.filterSteps || "";
    const filterType = req.query.filterType || null;
    const filterSteps = filterStepsFromQuery.length ? filterStepsFromQuery.split(",").map( item => item.trim() ) : [];

    res.send(await TracingAPI.storage.fetchItemsOfEntity(id, page, 20, query, filterType, filterSteps));
});

router.get('/entity/:id/step', async function(req, res) {
    const id = req.params.id;
    res.send(await TracingAPI.storage.fetchEntitySteps(id));
});

router.get('/item/:id', async function(req, res) {
    const id = req.params.id;
    res.send(await TracingAPI.storage.fetchItem(id));
});

router.post('/trace', async function(req, res) {
    const { entity, item, step, data = {} } = req.body;

    if (
        !entity || !String(entity).trim().length ||
        !item || !String(item).trim().length ||
        !step || !String(step).trim().length
    ) {
        res.send({
            status: false,
            message: 'Invalid data. Entity, item or step is empty'
        });
        return;
    }

    const response = await TracingAPI.trace(entity, item, step, data);
    res.send(response);
});

module.exports = router;
