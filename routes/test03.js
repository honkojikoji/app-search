var express = require('express');
var router = express.Router();
router.get('/', function(req, res, next) {
  res.render('test03', { title: 'Express' });
});

module.exports = router;
