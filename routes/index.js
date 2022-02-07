const { Router } = require('express');
const TracingAPI = require("../index");
const router = Router();

router.get('/ping', function(req, res) {
    res.sendStatus(200);
});

router.get('/entities', async function(req, res) {
     res.send(await TracingAPI.storage.fetchEntities())
});

router.get('/item/:id', async function(req, res) {
    const id = req.params.id;
    res.send(await TracingAPI.storage.fetchItem(id));
});

router.get('/entity/:id/item', async function(req, res) {
    const entityId = req.params.id;
    const query = req.query.query;

    res.send(await TracingAPI.storage.searchItems(query, entityId));
});

router.post('/trace', async function(req, res) {
    const { entity, item, step, data = {} } = req.body;

    const response = await TracingAPI.trace(entity, item, step, data);
    res.send(response);
});

module.exports = router;
