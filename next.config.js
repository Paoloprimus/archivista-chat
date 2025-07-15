// next.config.js
const path = require('path');

/** @type {import('next').NextConfig} */
module.exports = {
  webpack(config) {
    // rende '@/...' equivalente a 'app/...'
    config.resolve.alias['@'] = path.resolve(__dirname, 'app');
    return config;
  },
};
