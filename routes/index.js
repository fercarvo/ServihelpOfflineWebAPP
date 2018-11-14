var express = require('express');
var router = express.Router();
var login = require('./login').router

/* GET home page. */
router.get('/', function(req, res, next) {
    res.set('Cache-Control', 'private, max-age=60')
    res.render('index');
})

module.exports = router;
