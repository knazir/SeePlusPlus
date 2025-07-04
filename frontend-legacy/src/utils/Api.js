import ProgramTrace from "../models/ProgramTrace";

class RawApi {
  static async _send(method, path, body = null) {
    const opts = {
      method: method,
      headers: {}
    };

    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }

    // Default to localhost:3000 for dockerized backend if no environment variable is set
    const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3000";
    const res = await fetch(`${apiUrl}/${path}`, opts);
    let json;
    try {
      json = await res.json();
    } catch (e) {
      const text = e.message ? e.message : await res.text();
      throw new Error(`API: Non-JSON response to ${path}: ${text}`);
    }
    return json;
  }

  static async get(path) {
    return RawApi._send("GET", path);
  }

  static async post(path, body) {
    return RawApi._send("POST", path, body);
  }
}

export default class Api {
  static async getCodeTrace(lang, code) {
    // Updated to use the new /run endpoint with new backend format
    const path = `run`;
    const body = {
      code: code  // Remove language parameter as new backend doesn't expect it
    };
    return new ProgramTrace(await RawApi.post(path, body));
  }
}
