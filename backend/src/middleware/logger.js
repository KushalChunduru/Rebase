export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 400 ? '\x1b[31m' : status >= 300 ? '\x1b[33m' : '\x1b[32m';
    console.log(`  ${color}${req.method}\x1b[0m ${req.originalUrl} \x1b[90m${status} ${duration}ms\x1b[0m`);
  });
  next();
}
