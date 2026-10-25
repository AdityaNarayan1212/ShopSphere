import axios from "axios";
export const api = axios.create({baseURL:import.meta.env.VITE_API_URL || "/api"});
api.interceptors.request.use(config => {
  const token = localStorage.getItem("shopsphere_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
export const money = (v: unknown) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(v || 0));
