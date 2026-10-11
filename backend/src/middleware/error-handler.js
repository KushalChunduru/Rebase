export function errorHandler(err, req, res, next) {
  console.error(`\x1b[31m  ERROR\x1b[0m ${req.method} ${req.originalUrl}: ${err.message}`);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    path: req.originalUrl
  });
}
