// src/app/utils/api.js

import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export default api
