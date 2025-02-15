require('dotenv').config(); // Loads .env variables
const express = require('express');
const proxy = require('express-http-proxy');

const app = express();
const port = process.env.PORT || 5000;

app.use((req, res, next) => {
  console.log('Incoming request:', req.method, req.url);
  next();
});

app.use(
  '/usda',
  proxy('https://quickstats.nass.usda.gov', {
    proxyReqPathResolver: (req) => {
      let newPath = req.originalUrl.replace(/^\/usda/, '/api');

      if (newPath.includes('?')) {
        newPath += `&key=${process.env.USDA_API_KEY || 'NO_KEY_FOUND'}`;
      } else {
        newPath += `?key=${process.env.USDA_API_KEY || 'NO_KEY_FOUND'}`;
      }
      
      console.log('Proxy path:', newPath);
      return newPath;
    },
    userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
      console.log('Proxy response status:', proxyRes.statusCode);
      return proxyResData;
    },
    proxyErrorHandler: (err, res, next) => {
      console.error('Proxy error:', err);
      next(err);
    },
  })
);

app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
});
