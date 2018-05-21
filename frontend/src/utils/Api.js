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

    const res = await fetch(`${process.env.REACT_APP_API_URL}/${path}`, opts);
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
    return RawApi._send("POST", path, body)
  }
}

export default class Api {
  static async getCodeTrace(lang, code) {
    const path = `wsgi-bin/wsgi_backend.py?lang=${encodeURIComponent(lang)}&code=${encodeURIComponent(code)}`;
    return new ProgramTrace(await RawApi.get(path));
  }
}
