var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var wishlistRouter = require('./routes/wishlist');
var paliRouter = require('./routes/pali');
var sktRouter = require('./routes/skt');
var testRouter = require('./routes/test');
var test01Router = require('./routes/test01');
var test02Router = require('./routes/test02');
var test03Router = require('./routes/test03');
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/wishlist', wishlistRouter);
app.use('/wishlist/add', wishlistRouter);
app.use('/pali', paliRouter);
app.use('/skt', sktRouter);
app.use('/test', testRouter);
app.use('/test01', test01Router);
app.use('/test02', test02Router);
app.use('/test03', test03Router);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;