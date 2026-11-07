const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404; // So errorHandler sends 404, not 500
  next(error);
};

module.exports = notFound;
