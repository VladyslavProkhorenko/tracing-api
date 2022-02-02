const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();
const TracingAPIRoutes = require("./package/tracing-api/routes");
const TracingAPI = require("./package/tracing-api");

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(cors());
app.options('*', cors());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


TracingAPI.init().storage.connect(
    'localhost',
    'random',
    'secret',
    3306,
    'tracing-api'
);
TracingAPI.registerEntity('Leads 2', 'Leads');
TracingAPI.registerEntity('Reps', 'Reps');
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/tracing-ui', TracingAPIRoutes)

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
