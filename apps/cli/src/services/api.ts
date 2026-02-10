import axios from "axios";
import chalk from "chalk";
import { logOut, readToken } from "../services/auth.js";

const API_URL = process.env.SHIPLIO_API_URL || "http://localhost:4000/api";

export const apiClient = axios.create({
  baseURL: API_URL,
});

apiClient.interceptors.request.use(
  function (config) {
    const token = readToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  function (error) {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  function (response) {
    return response;
  },
  function onRejected(error) {
    if (
      error.status === 401 &&
      error.config.url !== "/auth/login" &&
      error.config.url !== "/auth/register"
    ) {
      logOut();
      console.log(chalk.yellow("Session expired. Please login again."));
      console.log(chalk.dim("Run 'shiplio login' to get started."));
    }
    return Promise.reject(error);
  }
);
