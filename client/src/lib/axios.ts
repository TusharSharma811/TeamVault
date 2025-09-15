import axios from "axios";

const Axios = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

export default Axios;
