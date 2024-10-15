// src/app/utils/api.js

import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api',
})

export default api
